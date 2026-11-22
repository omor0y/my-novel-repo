#!/usr/bin/env python3
"""
fadaa — فضاء الروايات (cenele.com) → EPUB عربي

Downloads a novel's chapters (with a local cache, so re-runs only fetch new
chapters) and builds right-to-left Arabic EPUBs with a JPEG cover, paragraph
spacing and a table of contents per volume. Optionally sends the files to a
Kindle running KOReader over its SSH server.

Works in Termux on Android (share a novel link to Termux) and on macOS/Linux.

    fadaa                       # asks for the link
    fadaa https://cenele.com/cont/shadow-novel/
    fadaa URL --volumes 1-3 --send
    fadaa --setup-kindle        # save the Kindle's IP address
"""

import argparse
import html
import io
import json
import os
import re
import subprocess
import sys
import time
import uuid
import zipfile
from datetime import datetime, timezone

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Missing libraries. Run:  pip install requests beautifulsoup4")

try:
    from PIL import Image
except ImportError:  # the cover is then embedded as WebP
    Image = None

VERSION = "1.0.0"
SITE = "https://cenele.com/"
# The site answers 403 to Android WebView user agents and to mobile requests
# that carry a homepage Referer, so page requests identify as mobile Chrome
# and send no Referer.
UA = (
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
)

HOME = os.path.expanduser("~")
DATA_DIR = os.path.join(HOME, ".fadaa")
CACHE_DIR = os.path.join(DATA_DIR, "cache")
CONFIG_PATH = os.path.join(DATA_DIR, "config.json")
IN_TERMUX = bool(os.environ.get("TERMUX_VERSION")) or os.path.isdir("/data/data/com.termux")


# ---------------------------------------------------------------- display ----

def _make_ar():
    # Termux has no Arabic shaping or bidi, so reshape there; other terminals
    # (macOS Terminal, most Linux ones) already do it themselves.
    if not IN_TERMUX:
        return lambda s: s
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return lambda s: get_display(arabic_reshaper.reshape(s))
    except Exception:
        return lambda s: s


ar = _make_ar()


def say(msg=""):
    print(ar(msg), flush=True)


def ask(prompt, default=""):
    try:
        answer = input(ar(prompt) + " ")
    except EOFError:
        return default
    return answer.strip() or default


def yes(prompt, default=True):
    hint = "[Y/n]" if default else "[y/N]"
    answer = ask(f"{prompt} {hint}", "y" if default else "n").lower()
    return answer.startswith("y") or answer.startswith("ن")


def progress(done, total, label):
    width = 24
    filled = int(width * done / max(total, 1))
    bar = "█" * filled + "·" * (width - filled)
    line = f"\r[{bar}] {done}/{total} {ar(label)[:40]}"
    sys.stdout.write(line.ljust(80))
    sys.stdout.flush()


def load_config():
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_config(cfg):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def default_out_dir():
    termux_downloads = os.path.join(HOME, "storage", "downloads")
    if os.path.isdir(termux_downloads):
        return os.path.join(termux_downloads, "Fadaa")
    return os.path.join(HOME, "Downloads", "Fadaa")


def safe_name(s):
    s = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", s).strip()
    return re.sub(r"\s+", " ", s)[:120] or "novel"


# ------------------------------------------------------------------- site ----

class Site:
    def __init__(self, delay=3.0):
        self.delay = delay
        self.http = requests.Session()
        self.http.headers.update({"User-Agent": UA, "Accept-Language": "ar,en;q=0.8"})

    def get(self, url):
        last = ""
        for attempt in range(4):
            try:
                r = self.http.get(url, timeout=45)
                if r.status_code == 200:
                    r.encoding = "utf-8"
                    return r.text
                last = f"HTTP {r.status_code}"
                if r.status_code == 404:
                    break
            except requests.RequestException as e:
                last = str(e)
            time.sleep(2 * (attempt + 1))
        raise RuntimeError(f"{last} — {url}")

    def get_bytes(self, url):
        r = self.http.get(url, timeout=45, headers={"Referer": SITE})
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "")


def normalize_novel_url(url):
    url = url.strip()
    m = re.search(r"cenele\.com/cont/([^/?#\s]+)", url)
    if not m:
        raise ValueError("هذا مو رابط رواية من فضاء الروايات (لازم يكون فيه cenele.com/cont/)")
    return f"{SITE}cont/{m.group(1)}/"


def chapter_number(text):
    m = re.search(r"الفصل\s*(\d+(?:\.\d+)?)", text or "")
    return float(m.group(1)) if m else None


AR_MONTHS = {
    "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "مايو": 5, "يونيو": 6,
    "يوليو": 7, "أغسطس": 8, "اغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10,
    "نوفمبر": 11, "ديسمبر": 12,
}


def parse_chapter_items(fragment_html):
    soup = BeautifulSoup(fragment_html or "", "html.parser")
    items = []
    for li in soup.select("li.wp-manga-chapter"):
        a = li.find("a")
        if not a or not a.get("href"):
            continue
        full = re.sub(r"\s+", " ", a.get_text(" ")).strip()
        title_el = li.select_one(".nhv-chapter-name")
        title = re.sub(r"\s+", " ", title_el.get_text(" ")).strip() if title_el else ""
        name = full
        if title and full.endswith(title) and len(full) > len(title):
            name = f"{full[: -len(title)].strip()} - {title}"
        items.append({
            "name": name,
            "url": requests.compat.urljoin(SITE, a["href"]),
            "number": chapter_number(full),
        })
    return items


class Novel:
    def __init__(self, site, url):
        self.site = site
        self.url = normalize_novel_url(url)
        self.slug = self.url.rstrip("/").rsplit("/", 1)[-1]
        self.page_html = site.get(self.url)
        soup = BeautifulSoup(self.page_html, "html.parser")

        def text(sel):
            el = soup.select_one(sel)
            return re.sub(r"\s+", " ", el.get_text(" ")).strip() if el else ""

        self.name = text("h1.nhv-novel-title") or text("div.post-title h1") or self.slug
        img = soup.select_one("div.nhv-novel-cover img, div.summary_image img")
        self.cover_url = ""
        if img:
            self.cover_url = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
        self.summary = "\n".join(
            p.get_text(" ").strip() for p in soup.select("div.nhv-novel-synopsis p") if p.get_text(strip=True)
        )
        meta = {}
        for div in soup.select("div.nhv-novel-meta > div"):
            label, value = div.find("span"), div.find("strong")
            if label and value:
                meta[label.get_text(strip=True)] = re.sub(r"\s+", " ", value.get_text(" ")).strip()
        self.author = meta.get("المؤلف") or meta.get("الكاتب") or ""
        self.translator = re.sub(r"^المترجم\s*:\s*", "", meta.get("المترجم", "")).strip()
        self.status = text("div.nhv-novel-status strong") or meta.get("الحالة", "")
        self.genres = [a.get_text(strip=True) for a in soup.select("div.nhv-novel-genres a")]
        self.latest = parse_chapter_items(self.page_html)

        cfg = self.page_html
        self.post_id = (re.search(r'"postId"\s*:\s*"?(\d+)', cfg) or re.search(r"\bpostid-(\d+)\b", cfg) or [None, None])[1]
        nonce = re.search(r'"chaptersNonce"\s*:\s*"([^"]+)"', cfg)
        self.nonce = nonce.group(1) if nonce else ""
        ajax = re.search(r'"ajaxurl"\s*:\s*"([^"]+)"', cfg)
        self.ajax_url = ajax.group(1).replace("\\/", "/") if ajax else SITE + "wp-admin/admin-ajax.php"

    # --- chapter list: same requests as the site's "قائمة الفصول" panel ---

    def _post(self, params):
        headers = {
            "Origin": SITE.rstrip("/"),
            "Referer": self.url,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
        }
        last = ""
        for attempt in range(3):
            if attempt:
                time.sleep(1.5 * attempt)
            try:
                r = self.site.http.post(self.ajax_url, data={**params, "nonce": self.nonce}, headers=headers, timeout=45)
                try:
                    data = r.json()
                except ValueError:
                    data = None
                if r.status_code == 200 and data and data.get("success"):
                    return data
                snippet = re.sub(r"<[^>]+>|\s+", " ", r.text)[:80].strip()
                last = f"HTTP {r.status_code} — {snippet}"
                if r.status_code == 403 or (data and data.get("success") is False):
                    self._refresh_nonce(headers)
            except requests.RequestException as e:
                last = str(e)
        raise RuntimeError(f"تعذّر تحميل قائمة الفصول: {last}")

    def _refresh_nonce(self, headers):
        try:
            r = self.site.http.post(self.ajax_url, data={"action": "nhv_refresh_front_nonces"}, headers=headers, timeout=45)
            data = r.json()
            if data.get("success") and data.get("data", {}).get("chapters_nonce"):
                self.nonce = data["data"]["chapters_nonce"]
        except Exception:
            pass

    def volumes(self):
        base = {"action": "nhv_manga_single_chapters_page", "manga_id": self.post_id, "per_page": 50, "order": "asc"}
        if not self.post_id:
            raise RuntimeError("ما لقيت رقم الرواية في الصفحة")
        if not self.nonce:
            self._refresh_nonce({"Origin": SITE.rstrip("/"), "Referer": self.url})
        meta = self._post({**base, "volume": -1, "page": 1, "meta_only": 1})
        vols = []
        for v in meta.get("volumes") or []:
            num = int(v.get("num") or 0)
            label = re.sub(r"\s+", " ", str(v.get("label") or (f"المجلد {num}" if num else "بدون مجلد"))).strip()
            vols.append({"num": num, "label": label, "count": int(v.get("count") or 0)})
        self._base = base
        return vols

    def chapters_of(self, volume_num):
        chapters, page = [], 1
        while page <= 200:
            data = self._post({**self._base, "volume": volume_num, "page": page})
            items = parse_chapter_items(data.get("html", ""))
            chapters.extend(items)
            if not data.get("has_more") or not items:
                break
            page += 1
            time.sleep(self.site.delay)
        return chapters


def assign_unfiled(loaded, all_numbered):
    """Move chapters from "بدون مجلدات" (volume 0) into a numbered volume.

    "بدون مجلدات" mixes intro chapters (0.1, 0.2) with recent chapters that
    were not filed yet. A chapter goes to the loaded volume whose range holds
    it; otherwise to the volume just before it (intro chapters go to the first
    volume). When only some volumes were chosen, chapters that belong to a
    volume that wasn't loaded are left out.

    loaded: volume dicts with chapters; all_numbered: every numbered volume
    number of the novel, in order."""
    numbered = [v for v in loaded if v["num"] != 0]
    unfiled = [c for v in loaded if v["num"] == 0 for c in v["chapters"]]
    if not numbered:
        return loaded
    for vol in numbered:
        nums = [c["number"] for c in vol["chapters"] if c["number"] is not None]
        vol["lo"], vol["hi"] = (min(nums), max(nums)) if nums else (None, None)
    with_range = sorted((v for v in numbered if v["lo"] is not None), key=lambda v: v["lo"])
    all_loaded = set(all_numbered) <= {v["num"] for v in numbered}
    first_num, last_num = (all_numbered[0], all_numbered[-1]) if all_numbered else (None, None)

    for ch in unfiled:
        n = ch["number"]
        target = None
        if n is not None and with_range:
            inside = [v for v in with_range if v["lo"] <= n <= v["hi"]]
            before = [v for v in with_range if v["hi"] < n]
            if inside:
                target = inside[0]
            elif n < with_range[0]["lo"]:
                if all_loaded or with_range[0]["num"] == first_num:
                    target = with_range[0]
            elif before and (all_loaded or (n > with_range[-1]["hi"] and with_range[-1]["num"] == last_num)):
                target = before[-1]
        elif all_loaded and numbered:
            target = numbered[-1]
        if target is not None:
            target["chapters"].append(ch)
    for vol in numbered:
        vol["chapters"] = sort_chapters(vol["chapters"])
    return numbered


def sort_chapters(chapters):
    seen, unique = set(), []
    for c in chapters:
        if c["url"] not in seen:
            seen.add(c["url"])
            unique.append(c)
    keyed, prev = [], -1.0
    for i, c in enumerate(unique):
        key = c["number"] if c["number"] is not None else prev + 0.0001
        prev = key
        keyed.append((key, i, c))
    keyed.sort(key=lambda t: (t[0], t[1]))
    return [c for _, _, c in keyed]


# ----------------------------------------------------------- chapter text ----

class HumanCheck(Exception):
    """The site served its "not a robot" check instead of the chapter."""

def fetch_chapter(site, chapter, cache_dir, cache_only=False):
    key = re.sub(r"[^\w.-]+", "_", requests.utils.unquote(chapter["url"]).rstrip("/").rsplit("/cont/", 1)[-1])[:150]
    path = os.path.join(cache_dir, key + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f), True
    if cache_only:
        return None, False

    soup = BeautifulSoup(site.get(chapter["url"]), "html.parser")
    if soup.select_one(".nhv-ts-gate"):
        # The site asks for a human check ("أكمل التحقق بأنك لست روبوت") instead
        # of sending the chapter. Stop here; this tool does not get around it.
        raise HumanCheck()
    title_el = soup.select_one("h3.chapter-name")
    reading = soup.select_one("div.reading-content")
    paragraphs = []
    if reading:
        for p in reading.find_all("p"):
            # Skip the store/app promo boxes; chapter paragraphs live in the main flow.
            if p.find_parent(["aside", "script", "style"]) or p.find_parent(class_="nhv-reader-promo"):
                continue
            for br in p.find_all("br"):
                br.replace_with("\n")
            for line in p.get_text().replace(" ", " ").split("\n"):
                line = re.sub(r"\s+", " ", line).strip()
                if line:
                    paragraphs.append(line)
    data = {
        "title": chapter["name"],
        "page_title": re.sub(r"\s+", " ", title_el.get_text(" ")).strip() if title_el else "",
        "paragraphs": paragraphs,
    }
    if paragraphs:  # empty pages (locked/failed) are not cached, so they are retried next time
        os.makedirs(cache_dir, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    return data, False


# ------------------------------------------------------------------- EPUB ----

CSS = """@charset "utf-8";
html, body { direction: rtl; }
body { margin: 0 3%; line-height: 1.6; }
h1, h2 { text-align: center; line-height: 1.4; margin: 0.6em 0 1.2em 0; page-break-after: avoid; }
p { margin: 0 0 0.9em 0; text-indent: 0; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }
.titlepage { text-align: center; margin-top: 18%; }
.titlepage p { text-align: center; margin: 0 0 0.6em 0; }
.titlepage .name { font-size: 1.8em; font-weight: bold; margin-bottom: 0.4em; }
.titlepage .part { font-size: 1.25em; margin-bottom: 1.6em; }
.titlepage .small { font-size: 0.85em; margin-top: 2.5em; }
"""


def esc(s):
    return html.escape(s or "", quote=False)


def attr(s):
    return html.escape(s or "", quote=True)


def xhtml(title, body):
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" '
        'xml:lang="ar" lang="ar" dir="rtl">\n'
        f'<head><meta charset="utf-8"/><title>{esc(title)}</title>'
        '<link rel="stylesheet" type="text/css" href="../style.css"/></head>\n'
        f'<body dir="rtl">\n{body}\n</body>\n</html>\n'
    )


def prepare_cover(site, url):
    """Returns (bytes, extension, media type). WebP covers become JPEG so every
    reader shows them; without Pillow the WebP is kept with its real type."""
    if not url:
        return None
    try:
        data, ctype = site.get_bytes(url)
    except Exception:
        return None
    if Image is not None:
        try:
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGB")
            im.thumbnail((1264, 1680))
            out = io.BytesIO()
            im.save(out, "JPEG", quality=90, optimize=True)
            return out.getvalue(), "jpg", "image/jpeg"
        except Exception:
            pass
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return data, "webp", "image/webp"
    if data[:3] == b"\xff\xd8\xff":
        return data, "jpg", "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return data, "png", "image/png"
    return None


def write_epub(path, novel, book_title, part_label, series_index, sections, cover):
    """sections: [(volume label or None, [chapter dicts with 'paragraphs'])]"""
    book_id = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, novel.url + '#' + (part_label or 'all'))}"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    files = []  # (zip path, content, media type, manifest id, properties)
    spine = []
    if cover:
        cover_bytes, ext, mtype = cover
        files.append((f"OEBPS/images/cover.{ext}", cover_bytes, mtype, "cover-image", "cover-image"))
        files.append(("OEBPS/text/cover.xhtml",
                      xhtml(book_title, f'<div class="cover"><img src="../images/cover.{ext}" alt="{attr(book_title)}"/></div>'),
                      "application/xhtml+xml", "cover", None))
        spine.append("cover")

    lines = [f'<p class="name">{esc(novel.name)}</p>']
    if part_label:
        lines.append(f'<p class="part">{esc(part_label)}</p>')
    if novel.author:
        lines.append(f"<p>المؤلف: {esc(novel.author)}</p>")
    if novel.translator:
        lines.append(f"<p>المترجم: {esc(novel.translator)}</p>")
    lines.append(f'<p class="small">ترجمة ونشر: فضاء الروايات<br/>{esc(novel.url)}</p>')
    files.append(("OEBPS/text/title.xhtml", xhtml(book_title, '<div class="titlepage">' + "\n".join(lines) + "</div>"),
                  "application/xhtml+xml", "titlepage", None))
    spine.append("titlepage")

    toc = []  # (volume label or None, [(file, title)])
    n = 0
    for label, chapters in sections:
        entries = []
        for ch in chapters:
            n += 1
            fname = f"c{n:05d}.xhtml"
            body = f'<section epub:type="chapter">\n<h2>{esc(ch["title"])}</h2>\n'
            body += "\n".join(f"<p>{esc(p)}</p>" for p in ch["paragraphs"]) + "\n</section>"
            files.append((f"OEBPS/text/{fname}", xhtml(ch["title"], body), "application/xhtml+xml", f"c{n:05d}", None))
            spine.append(f"c{n:05d}")
            entries.append((f"text/{fname}", ch["title"]))
        toc.append((label, entries))

    # nav.xhtml (EPUB 3) and toc.ncx (older readers)
    def nav_list(items):
        return "".join(f'<li><a href="{attr(h)}">{esc(t)}</a></li>' for h, t in items)

    grouped = len(toc) > 1 or (toc and toc[0][0])
    if grouped:
        nav_items = "".join(
            f'<li><a href="{attr(entries[0][0])}">{esc(label or "فصول")}</a><ol>{nav_list(entries)}</ol></li>'
            for label, entries in toc if entries
        )
    else:
        nav_items = nav_list(toc[0][1] if toc else [])
    nav = (
        '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ar" lang="ar" dir="rtl">\n'
        f'<head><meta charset="utf-8"/><title>{esc(book_title)}</title></head>\n'
        f'<body dir="rtl"><nav epub:type="toc" id="toc"><h1>المحتويات</h1><ol>{nav_items}</ol></nav></body>\n</html>\n'
    )
    files.append(("OEBPS/nav.xhtml", nav, "application/xhtml+xml", "nav", "nav"))

    play = [0]

    def nav_point(title, href, children=""):
        play[0] += 1
        return (f'<navPoint id="np{play[0]}" playOrder="{play[0]}"><navLabel><text>{esc(title)}</text></navLabel>'
                f'<content src="{attr(href)}"/>{children}</navPoint>')

    if grouped:
        points = ""
        for label, entries in toc:
            if not entries:
                continue
            play[0] += 1
            head = play[0]
            kids = "".join(nav_point(t, h) for h, t in entries)
            points += (f'<navPoint id="np{head}" playOrder="{head}"><navLabel><text>{esc(label or "فصول")}</text></navLabel>'
                       f'<content src="{attr(entries[0][0])}"/>{kids}</navPoint>')
    else:
        points = "".join(nav_point(t, h) for h, t in (toc[0][1] if toc else []))
    ncx = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="ar">\n'
        f'<head><meta name="dtb:uid" content="{attr(book_id)}"/></head>\n'
        f'<docTitle><text>{esc(book_title)}</text></docTitle>\n<navMap>{points}</navMap>\n</ncx>\n'
    )
    files.append(("OEBPS/toc.ncx", ncx, "application/x-dtbncx+xml", "ncx", None))
    files.append(("OEBPS/style.css", CSS, "text/css", "css", None))

    meta = [
        f'<dc:identifier id="bookid">{esc(book_id)}</dc:identifier>',
        f"<dc:title>{esc(book_title)}</dc:title>",
        "<dc:language>ar</dc:language>",
        f'<meta property="dcterms:modified">{modified}</meta>',
        "<dc:publisher>فضاء الروايات</dc:publisher>",
        f"<dc:source>{esc(novel.url)}</dc:source>",
    ]
    if novel.author:
        meta.append(f'<dc:creator id="author">{esc(novel.author)}</dc:creator>')
        meta.append('<meta refines="#author" property="role" scheme="marc:relators">aut</meta>')
    if novel.translator:
        meta.append(f'<dc:contributor id="translator">{esc(novel.translator)}</dc:contributor>')
        meta.append('<meta refines="#translator" property="role" scheme="marc:relators">trl</meta>')
    if novel.summary:
        meta.append(f"<dc:description>{esc(novel.summary)}</dc:description>")
    meta += [f"<dc:subject>{esc(g)}</dc:subject>" for g in novel.genres]
    if series_index is not None:
        meta += [
            f'<meta property="belongs-to-collection" id="series">{esc(novel.name)}</meta>',
            '<meta refines="#series" property="collection-type">series</meta>',
            f'<meta refines="#series" property="group-position">{series_index}</meta>',
            f'<meta name="calibre:series" content="{attr(novel.name)}"/>',
            f'<meta name="calibre:series_index" content="{series_index}"/>',
        ]
    if cover:
        meta.append('<meta name="cover" content="cover-image"/>')

    manifest = "\n".join(
        f'<item id="{mid}" href="{attr(zp[len("OEBPS/"):])}" media-type="{mt}"' + (f' properties="{props}"' if props else "") + "/>"
        for zp, _, mt, mid, props in files
    )
    spine_xml = "\n".join(f'<itemref idref="{i}"/>' for i in spine)
    opf = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ar" dir="rtl">\n'
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' + "\n".join(meta) + "\n</metadata>\n"
        f"<manifest>\n{manifest}\n</manifest>\n"
        f'<spine toc="ncx" page-progression-direction="rtl">\n{spine_xml}\n</spine>\n'
        + ('<guide><reference type="cover" title="cover" href="text/cover.xhtml"/></guide>\n' if cover else "")
        + "</package>\n"
    )

    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    with zipfile.ZipFile(tmp, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml",
                   '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" '
                   'xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>'
                   '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
                   "</rootfiles></container>\n", compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
        for zp, content, mt, _, _ in files:
            data = content if isinstance(content, bytes) else content.encode("utf-8")
            kind = zipfile.ZIP_STORED if mt.startswith("image/") else zipfile.ZIP_DEFLATED
            z.writestr(zp, data, compress_type=kind)
    os.replace(tmp, path)
    return path


# ----------------------------------------------------------------- Kindle ----

def setup_kindle():
    cfg = load_config()
    say("في الكيندل: افتح KOReader ← الإعدادات ← الشبكة ← SSH server")
    say("فعّل Login without password، وشغّل الخادم، وانسخ عنوان IP اللي يطلع.")
    ip = ask(f"عنوان IP حق الكيندل ({cfg.get('kindle_ip', '')}):", cfg.get("kindle_ip", ""))
    if not ip:
        return
    cfg["kindle_ip"] = ip
    cfg.setdefault("kindle_port", 2222)
    cfg.setdefault("kindle_dir", "/mnt/us/documents/Fadaa")
    save_config(cfg)
    say(f"انحفظ: {ip}")


def send_to_kindle(paths, cfg):
    ip = cfg.get("kindle_ip")
    if not ip:
        say("ما فيه عنوان للكيندل. شغّل: fadaa --setup-kindle")
        return False
    dest = cfg.get("kindle_dir", "/mnt/us/documents/Fadaa")
    batch = [f'-mkdir "{dest}"'] + [f'put "{p}" "{dest}/{os.path.basename(p)}"' for p in paths]
    # KOReader's "Login without password" accepts any password; sftp -b needs
    # BatchMode=no so sshpass can supply it.
    cmd = ["sshpass", "-p", "koreader", "sftp", "-oBatchMode=no", "-oStrictHostKeyChecking=no",
           "-oUserKnownHostsFile=/dev/null", "-oConnectTimeout=15", "-P", str(cfg.get("kindle_port", 2222)),
           "-b", "-", f"root@{ip}"]
    say(f"إرسال {len(paths)} ملف للكيندل ({ip})…")
    try:
        r = subprocess.run(cmd, input="\n".join(batch) + "\n", text=True, capture_output=True, timeout=600)
    except FileNotFoundError:
        say("لازم sshpass و openssh:  pkg install openssh sshpass")
        return False
    except subprocess.TimeoutExpired:
        say("انتهت المهلة. تأكد إن خادم SSH شغّال في KOReader وإن الجهازين على نفس الواي فاي.")
        return False
    if r.returncode != 0:
        say("ما قدرت أرسل. تأكد إن خادم SSH شغّال في KOReader وإن الجهازين على نفس الواي فاي.")
        err = (r.stderr or "").strip().splitlines()
        if err:
            print(err[-1])
        return False
    say(f"وصلت للكيندل في: {dest}")
    return True


# ------------------------------------------------------------------- main ----

def parse_selection(text, available):
    """'all' | '1 3 5' | '2-4' | '1,3-5' → list of volume numbers."""
    text = (text or "").strip().lower()
    if text in ("", "all", "الكل", "a"):
        return list(available)
    chosen = []
    for part in re.split(r"[\s,،]+", text):
        if not part:
            continue
        m = re.fullmatch(r"(\d+)\s*-\s*(\d+)", part)
        if m:
            chosen += list(range(int(m.group(1)), int(m.group(2)) + 1))
        elif part.isdigit():
            chosen.append(int(part))
    return [v for v in available if v in chosen]


def main():
    ap = argparse.ArgumentParser(prog="fadaa", description="فضاء الروايات → EPUB")
    ap.add_argument("url", nargs="?", help="رابط الرواية")
    ap.add_argument("-v", "--volumes", help="المجلدات: all أو 1,3-5")
    ap.add_argument("--from", dest="ch_from", type=float, help="من الفصل رقم")
    ap.add_argument("--to", dest="ch_to", type=float, help="إلى الفصل رقم")
    ap.add_argument("--single", action="store_true", help="ملف واحد لكل الرواية")
    ap.add_argument("--split", action="store_true", help="ملف لكل مجلد")
    ap.add_argument("--send", action="store_true", help="أرسل الملفات للكيندل")
    ap.add_argument("--no-send", action="store_true", help="لا ترسل للكيندل")
    ap.add_argument("--out", help="مجلد الحفظ")
    ap.add_argument("--delay", type=float, default=3.0, help="ثواني بين الطلبات (الأبطأ أقل إزعاج للموقع)")
    ap.add_argument("-y", "--yes", action="store_true", help="بدون أسئلة (الإعدادات الافتراضية)")
    ap.add_argument("--setup-kindle", action="store_true", help="احفظ عنوان الكيندل")
    ap.add_argument("--version", action="version", version=f"fadaa {VERSION}")
    args = ap.parse_args()

    if args.setup_kindle:
        setup_kindle()
        return

    interactive = sys.stdin.isatty() and not args.yes
    cfg = load_config()
    url = args.url or (ask("الصق رابط الرواية:") if interactive else "")
    if not url:
        ap.print_help()
        return

    site = Site(delay=args.delay)
    say("فتح صفحة الرواية…")
    novel = Novel(site, url)
    say(f"\n{novel.name}")
    if novel.translator:
        say(f"المترجم: {novel.translator}")

    say("تحميل قائمة الفصول…")
    vols = novel.volumes()
    total = sum(v["count"] for v in vols)
    say(f"{total} فصل في {len(vols)} قسم\n")
    for v in vols:
        say(f"  {v['num']:>3}) {v['label']}  ({v['count']} فصل)")

    available = [v["num"] for v in vols]
    if args.volumes:
        chosen = parse_selection(args.volumes, available)
    elif interactive and len(vols) > 1:
        chosen = parse_selection(ask("\nأي المجلدات؟ (Enter = الكل، أو مثل 1 3 أو 2-5):"), available)
    else:
        chosen = available
    if not chosen:
        say("ما اخترت شي.")
        return
    # Unfiled chapters (volume 0) are placed into their numbered volumes, so
    # load them whenever a numbered volume is chosen.
    to_load = sorted(set(chosen) | ({0} if 0 in available else set()))

    for v in vols:
        v["chapters"] = []
    by_num = {v["num"]: v for v in vols}
    for num in to_load:
        say(f"قائمة {by_num[num]['label']}…")
        by_num[num]["chapters"] = novel.chapters_of(num)
        time.sleep(site.delay)
    loaded = [by_num[n] for n in to_load]
    all_numbered = [n for n in available if n != 0]
    parts = assign_unfiled(loaded, all_numbered) if any(v["num"] for v in loaded) else loaded
    parts = [v for v in parts if v["num"] in chosen or (v["num"] == 0 and 0 in chosen)]
    for v in parts:
        v["chapters"] = sort_chapters(v["chapters"])
        if args.ch_from is not None or args.ch_to is not None:
            lo = args.ch_from if args.ch_from is not None else float("-inf")
            hi = args.ch_to if args.ch_to is not None else float("inf")
            v["chapters"] = [c for c in v["chapters"] if c["number"] is None or lo <= c["number"] <= hi]
    parts = [v for v in parts if v["chapters"]]
    if not parts:
        say("ما فيه فصول في الاختيار هذا.")
        return

    if args.single:
        split = False
    elif args.split:
        split = True
    elif interactive and len(parts) > 1:
        split = yes("ملف لكل مجلد؟", True)
    else:
        split = len(parts) > 1

    # Download (cached chapters are reused)
    cache_dir = os.path.join(CACHE_DIR, novel.slug)
    todo = [c for v in parts for c in v["chapters"]]
    say(f"\nتحميل {len(todo)} فصل…")
    failed = []
    stopped_at_check = False
    for i, ch in enumerate(todo, 1):
        progress(i - 1, len(todo), ch["name"])
        ch["title"] = ch["name"]
        try:
            # After a human check, only chapters already on disk are used.
            data, cached = fetch_chapter(site, ch, cache_dir, cache_only=stopped_at_check)
            ch["paragraphs"] = data["paragraphs"] if data else []
            if data is not None and not data["paragraphs"]:
                failed.append(ch)
            if data is not None and not cached:
                time.sleep(site.delay)
        except HumanCheck:
            print()
            say(f"الموقع طلب تحقق «لست روبوت» عند: {ch['name']}")
            say("وقفت التحميل من الموقع. الفصول المحفوظة من قبل بتدخل في الملف.")
            stopped_at_check = True
            ch["paragraphs"] = []
        except KeyboardInterrupt:
            print()
            say("وقفت. الفصول اللي نزلت محفوظة، وشغّل نفس الأمر عشان تكمل.")
            sys.exit(1)
        except Exception as e:
            ch["paragraphs"] = []
            failed.append(ch)
            print()
            say(f"فشل: {ch['name']} ({e})")
    progress(len(todo), len(todo), "")
    print()

    for v in parts:
        v["chapters"] = [c for c in v["chapters"] if c.get("paragraphs")]

    # Build EPUBs
    out_dir = args.out or cfg.get("out_dir") or default_out_dir()
    novel_dir = os.path.join(out_dir, safe_name(novel.name))
    say("تجهيز الغلاف…")
    cover = prepare_cover(site, novel.cover_url)
    written = []
    if split:
        for idx, v in enumerate(parts, 1):
            if not v["chapters"]:
                continue
            index = v["num"] if v["num"] else idx
            title = f"{novel.name} - {v['label']}"
            path = os.path.join(novel_dir, safe_name(f"{novel.name} - {index:02d} - {v['label']}") + ".epub")
            written.append(write_epub(path, novel, title, v["label"], index, [(None, v["chapters"])], cover))
    else:
        sections = [(v["label"], v["chapters"]) for v in parts if v["chapters"]]
        everything = set(chosen) >= set(available)
        label = None if everything else "، ".join(v["label"] for v in parts)
        title = novel.name if not label else f"{novel.name} - {label}"
        path = os.path.join(novel_dir, safe_name(title) + ".epub")
        written.append(write_epub(path, novel, title, label, None, sections, cover))

    say(f"\nجاهز: {len(written)} ملف في")
    print(novel_dir)
    for p in written:
        print("  " + os.path.basename(p))
    missing = [c for c in todo if not c.get("paragraphs")]
    if missing:
        say(f"\n{len(missing)} فصل ما دخل في الملف:")
        for ch in missing[:10]:
            say("  " + ch["name"])
        if len(missing) > 10:
            say(f"  … و{len(missing) - 10} غيرها")
    if stopped_at_check:
        say("\nالتحقق هذا من الموقع نفسه، والأداة ما تتجاوزه.")
    if not cover:
        say("ملاحظة: ما قدرت أجيب الغلاف.")

    send = args.send or (
        not args.no_send and interactive and cfg.get("kindle_ip") and yes("\nإرسال للكيندل؟", True)
    )
    if send:
        send_to_kindle(written, cfg)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print()
        say(f"خطأ: {e}")
        sys.exit(1)

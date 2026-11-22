const mangayomiSources = [{
  "name": "فضاء الروايات",
  "lang": "ar",
  "baseUrl": "https://cenele.com",
  "apiUrl": "",
  "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=cenele.com",
  "typeSource": "single",
  "itemType": 2,
  "version": "1.2.0",
  "dateFormat": "",
  "dateFormatLocale": "",
  "pkgPath": "novel/src/ar/riwyat-novel.js",
  "isNsfw": false,
  "hasCloudflare": false,
  "notes": ""
}];

class DefaultExtension extends MProvider {
  headers = {
    Referer: this.source.baseUrl,
    Origin: this.source.baseUrl,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // All novels archive (sorted with ?m_orderby=views | latest | rating | alphabet)
  browsePath = "/cont/";

  getHeaders(url) {
    return this.headers;
  }

  // ---------- helpers ----------
  _getHref(el) {
    if (!el) return "";
    try {
      if (typeof el.getHref === "function") return el.getHref();
      if (typeof el.getHref === "string") return el.getHref;
      if (typeof el.getHref === "object" && el.getHref) return String(el.getHref);
      if (typeof el.attr === "function") return el.attr("href") || "";
    } catch (_) {}
    return "";
  }

  _getSrc(el) {
    if (!el) return "";
    try {
      if (typeof el.getSrc === "function") return el.getSrc();
      if (typeof el.getSrc === "string") return el.getSrc;
      if (typeof el.attr === "function") return el.attr("src") || "";
    } catch (_) {}
    return "";
  }

  _decodeEntities(input) {
    if (!input) return "";
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
      if (code[0] === "#") {
        const isHex = code[1] === "x" || code[1] === "X";
        const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isNaN(num) ? m : String.fromCodePoint(num);
      }
      return Object.prototype.hasOwnProperty.call(named, code) ? named[code] : m;
    });
  }

  _escapeHtml(input) {
    return String(input ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Convert a small HTML fragment to text, preserving <br> as newlines.
  _htmlFragmentToText(fragmentHtml) {
    let s = String(fragmentHtml ?? "");
    s = s
      .replace(/<\s*script[\s\S]*?<\/\s*script\s*>/gi, "")
      .replace(/<\s*style[\s\S]*?<\/\s*style\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    s = this._decodeEntities(s).replace(/\r/g, "");
    return s;
  }

  // ---------- browse / popular ----------
  parseBrowse(res) {
    const doc = new Document(res.body);

    // New site theme (2026): <article class="nhv-library-card">
    let nodes = doc.select("article.nhv-library-card");
    if (!nodes.length) nodes = doc.select("div.page-item-detail");
    if (!nodes.length) {
      // Search results still use the classic Madara markup.
      nodes = doc.select("div.c-tabs-item__content, div.page-listing-item");
    }

    const list = [];
    const seen = {};

    for (const node of nodes) {
      const a =
        node.selectFirst(".nhv-library-card__title a") ||
        node.selectFirst("div.post-title a") ||
        node.selectFirst("h3 a") ||
        node.selectFirst("h4 a") ||
        null;

      const name = a?.text?.trim() || "";
      const link = this._getHref(a);

      if (!name || !link || !link.includes("/cont/")) continue;
      if (seen[link]) continue;
      seen[link] = true;

      const imageUrl =
        this._getSrc(node.selectFirst(".nhv-library-card__cover img")) ||
        this._getSrc(node.selectFirst("div.item-thumb img")) ||
        this._getSrc(node.selectFirst("div.item-thumb a img")) ||
        this._getSrc(node.selectFirst("div.tab-thumb img")) ||
        this._getSrc(node.selectFirst("div.tab-thumb a img")) ||
        "";

      list.push({ name, imageUrl, link });
    }

    const hasNextPage =
      doc.selectFirst("a.next.page-numbers") != null ||
      doc.selectFirst("a.next") != null;

    return { list, hasNextPage };
  }

  async browse(page, orderBy) {
    const suffix = page > 1 ? `page/${page}/` : "";
    const url = `${this.source.baseUrl}${this.browsePath}${suffix}?m_orderby=${orderBy}`;
    const res = await new Client().get(url, this.headers);
    return this.parseBrowse(res);
  }

  async getPopular(page) {
    return this.browse(page, "views");
  }

  async getLatestUpdates(page) {
    return this.browse(page, "latest");
  }

  // ---------- search ----------
  async search(query, page, filters) {
    const q = String(query || "").trim();
    if (!q) return { list: [], hasNextPage: false };

    const client = new Client();
    const enc = encodeURIComponent(q);
    const candidates = [];

    if (page > 1) {
      candidates.push(`${this.source.baseUrl}/page/${page}/?s=${enc}&post_type=wp-manga`);
    }
    candidates.push(`${this.source.baseUrl}/?s=${enc}&post_type=wp-manga&paged=${page}`);
    candidates.push(`${this.source.baseUrl}/?s=${enc}&post_type=wp-manga`);

    for (const url of candidates) {
      const res = await client.get(url, this.headers);
      const parsed = this.parseBrowse(res);
      if (parsed?.list?.length) return parsed;
    }

    // Ajax fallback
    try {
      const ajaxUrl = `${this.source.baseUrl}/wp-admin/admin-ajax.php?action=wp-manga-search-manga&title=${enc}`;
      const res = await client.get(ajaxUrl, {
        Referer: this.source.baseUrl + "/",
        Origin: this.source.baseUrl,
      });
      const data = JSON.parse(res.body || "null");
      const arr = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

      const list = arr
        .map((it) => {
          const name = (it?.title || it?.name || it?.text || "").toString().trim();
          const link = (it?.url || it?.link || it?.permalink || "").toString().trim();
          const imageUrl = (it?.image || it?.img || it?.thumbnail || "").toString().trim();
          return { name, link, imageUrl };
        })
        .filter((x) => x.name && x.link);

      return { list, hasNextPage: false };
    } catch (_) {
      return { list: [], hasNextPage: false };
    }
  }

  // ---------- details / chapters ----------
  toStatus(text) {
    const t = String(text || "").toLowerCase();
    if (t.includes("مستم") || t.includes("ongoing")) return 0;
    if (t.includes("مكتمل") || t.includes("completed")) return 1;
    if (t.includes("متوقف") || t.includes("hiatus")) return 2;
    if (t.includes("متروك") || t.includes("dropped")) return 3;
    return 5;
  }

  async getDetail(url) {
    const client = new Client();
    const res = await client.get(url, this.headers);
    const doc = new Document(res.body);

    const name =
      doc.selectFirst("h1.nhv-novel-title")?.text?.trim() ||
      doc.selectFirst("div.post-title h1")?.text?.trim() ||
      "";
    const imageUrl =
      this._getSrc(doc.selectFirst("div.nhv-novel-cover img")) ||
      this._getSrc(doc.selectFirst("div.summary_image img"));

    const description =
      doc
        .select("div.nhv-novel-synopsis p")
        .map((el) => el.text.trim())
        .filter(Boolean)
        .join("\n")
        .trim() ||
      doc.selectFirst("div.nhv-novel-synopsis")?.text?.trim() ||
      doc
        .select("div.summary__content p")
        .map((el) => el.text.trim())
        .join("\n")
        .trim() ||
      doc.selectFirst("div.summary__content")?.text?.trim() ||
      doc.selectFirst("div.description-summary")?.text?.trim() ||
      "";

    // Label/value pairs: new theme uses <div><span>label</span><strong>value</strong></div>
    const extra = {};
    for (const b of doc.select("div.nhv-novel-meta > div")) {
      const label = b.selectFirst("span")?.text?.trim();
      const value = b.selectFirst("strong")?.text?.trim();
      if (label && value) extra[label] = value;
    }
    for (const b of doc.select("div.post-content_item")) {
      const label = b.selectFirst("div.summary-heading h5")?.text?.trim();
      const value = b.selectFirst("div.summary-content")?.text?.trim();
      if (label && value) extra[label] = value;
    }

    const author =
      extra["المؤلف"] ||
      extra["مؤلف"] ||
      extra["الكاتب"] ||
      doc.selectFirst("div.author-content a")?.text?.trim() ||
      "";

    // On this site the "artist" taxonomy holds the translator.
    const artist =
      extra["المترجم"] ||
      extra["الرسام"] ||
      doc.selectFirst("div.artist-content a")?.text?.trim() ||
      "";

    const statusText =
      doc.selectFirst("div.nhv-novel-status strong")?.text?.trim() ||
      extra["الحالة"] ||
      doc.selectFirst("div.post-status div.summary-content")?.text?.trim() ||
      "";
    const status = this.toStatus(statusText);

    let genre = doc.select("div.nhv-novel-genres a").map((el) => el.text.trim());
    if (!genre.length) genre = doc.select("div.genres-content a").map((el) => el.text.trim());
    if (!genre.length && extra["التصنيفات"]) {
      genre = extra["التصنيفات"]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Chapters: full list from the site's "قائمة الفصول" panel (volumes + load more).
    // Falls back to the "آخر 8 فصول" block printed in the page.
    let chapters = [];
    try {
      chapters = await this.fetchAllChapters(res.body, url);
    } catch (_) {
      chapters = [];
    }
    if (!chapters.length) {
      chapters = this.parseChapterItems(doc.select("li.wp-manga-chapter"));
    }

    return { name, imageUrl, description, genre, author, artist, status, chapters };
  }

  // Turns <li class="wp-manga-chapter"> items into Mangayomi chapters.
  parseChapterItems(chapterEls) {
    const chapters = [];
    for (const el of chapterEls) {
      const a = el.selectFirst("a");
      const chUrl = this._getHref(a);
      let full = (a?.text ?? "").replace(/\s+/g, " ").trim();
      full = full.replace(/^[\"\x27“”«»]+|[\"\x27“”«»]+$/g, "").trim();
      if (!full || !chUrl) continue;

      // "الفصل 1 الكابوس يبدأ" -> "الفصل 1 - الكابوس يبدأ"
      const title = (el.selectFirst(".nhv-chapter-name")?.text ?? "").replace(/\s+/g, " ").trim();
      let chName = full;
      if (title && full.endsWith(title) && full.length > title.length) {
        chName = `${full.slice(0, -title.length).trim()} - ${title}`;
      }

      const dateText = el.selectFirst(".chapter-release-date")?.text?.trim() || "";
      chapters.push({
        name: chName,
        url: chUrl,
        // Mangayomi expects a numeric string
        dateUpload: String(this.parseChapterDate(dateText)),
        scanlator: "",
      });
    }
    return chapters;
  }

  // "يونيو 30, 2022" -> timestamp; relative dates ("منذ يومين") -> now.
  parseChapterDate(text) {
    const months = {
      "يناير": 0, "فبراير": 1, "مارس": 2, "أبريل": 3, "ابريل": 3, "مايو": 4, "يونيو": 5,
      "يوليو": 6, "أغسطس": 7, "اغسطس": 7, "سبتمبر": 8, "أكتوبر": 9, "اكتوبر": 9,
      "نوفمبر": 10, "ديسمبر": 11,
    };
    const m = (text || "").match(/([؀-ۿ]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && months[m[1]] !== undefined) {
      const t = Date.UTC(parseInt(m[3], 10), months[m[1]], parseInt(m[2], 10));
      if (!isNaN(t)) return t;
    }
    return Date.now();
  }

  // Same requests the site makes when you open "قائمة الفصول":
  // 1) volume list (meta_only), 2) each volume in pages of 50 ("تحميل المزيد").
  async fetchAllChapters(pageHtml, novelUrl) {
    const cfg = (pageHtml.match(/nhvNovelV2\s*=\s*(\{[^;]*\})/) || [])[1] || "";
    const postId = (cfg.match(/"postId"\s*:\s*"?(\d+)/) || [])[1];
    let nonce = (cfg.match(/"chaptersNonce"\s*:\s*"([^"]+)"/) || [])[1];
    const ajaxUrl =
      ((cfg.match(/"ajaxurl"\s*:\s*"([^"]+)"/) || [])[1] || "").replace(/\\\//g, "/") ||
      `${this.source.baseUrl}/wp-admin/admin-ajax.php`;
    if (!postId || !nonce) return [];

    const client = new Client();
    const headers = {
      ...this.headers,
      Referer: novelUrl,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    const encode = (obj) =>
      Object.keys(obj)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(obj[k]))}`)
        .join("&");

    const post = async (params, retried) => {
      const r = await client.post(ajaxUrl, headers, encode({ ...params, nonce }));
      if (r.statusCode === 403 && !retried) {
        // Nonce expired: refresh it like the site does, then retry once.
        const fr = await client.post(ajaxUrl, headers, encode({ action: "nhv_refresh_front_nonces" }));
        const fresh = JSON.parse(fr.body || "{}");
        if (fresh?.success && fresh.data?.chapters_nonce) nonce = fresh.data.chapters_nonce;
        return post(params, true);
      }
      const data = JSON.parse(r.body || "{}");
      if (!data || !data.success) throw new Error("chapters_failed");
      return data;
    };

    const base = {
      action: "nhv_manga_single_chapters_page",
      manga_id: postId,
      per_page: 50,
      order: "asc",
    };

    const meta = await post({ ...base, volume: -1, page: 1, meta_only: 1 });
    const volumes = Array.isArray(meta.volumes) ? meta.volumes : [];
    if (!volumes.length) return [];

    const chapters = [];
    const seen = {};
    for (const vol of volumes) {
      const volNum = parseInt(vol.num || 0, 10);
      let page = 1;
      let more = true;
      while (more && page <= 200) {
        const data = await post({ ...base, volume: volNum, page });
        const items = this.parseChapterItems(new Document(data.html || "").select("li.wp-manga-chapter"));
        for (const ch of items) {
          if (seen[ch.url]) continue;
          seen[ch.url] = true;
          chapters.push(ch);
        }
        more = !!data.has_more && items.length > 0;
        page++;
      }
    }

    // "بدون مجلدات" mixes intro chapters (0.1, 0.2) with recent chapters that were
    // not filed into a volume yet, so order everything by chapter number.
    // Chapters without a number stay right after their neighbour in site order.
    let prevKey = -1;
    const keyed = chapters.map((ch, i) => {
      const m =
        ch.name.match(/الفصل\s*(\d+(?:\.\d+)?)/) ||
        decodeURIComponent(ch.url).match(/الفصل-(\d+)(?:-(\d+))?\/?$/);
      let key;
      if (m && m[0].startsWith("الفصل-")) key = parseFloat(m[2] ? `${m[1]}.${m[2]}` : m[1]);
      else if (m) key = parseFloat(m[1]);
      if (key === undefined || isNaN(key)) key = prevKey + 0.0001;
      prevKey = key;
      return { ch, key, i };
    });
    keyed.sort((a, b) => a.key - b.key || a.i - b.i);

    // Mangayomi lists newest first.
    return keyed.map((k) => k.ch).reverse();
  }

  // ---------- chapter content ----------
  async getHtmlContent(name, url) {
    const res = await new Client().get(url, this.headers);
    return this.cleanHtmlContent(res.body, name, url);
  }

  async cleanHtmlContent(html, fallbackTitle, pageUrl) {
    const doc = new Document(html);

    const title =
      doc.selectFirst("li.active")?.text?.trim() ||
      doc.selectFirst("div.post-title h1")?.text?.trim() ||
      doc.selectFirst("h1")?.text?.trim() ||
      fallbackTitle ||
      "";

    // IMPORTANT: For chapter pages on this site, the real text is inside div.reading-content.
    // If we fall back to body/article we may accidentally extract the chapter list (Select Chapter).
    const reading = doc.selectFirst("div.reading-content");

    if (!reading) {
      // If this happens, it's most likely not a chapter page.
      const msg =
        "تعذّر العثور على محتوى الفصل (div.reading-content). " +
        "تأكّد أن رابط الفصل صحيح وليس رابط صفحة الرواية.";
      return `<h2>${this._escapeHtml(title)}</h2>\n<div>${this._escapeHtml(msg)}</div>`;
    }

    // Extract ONLY paragraphs to avoid pulling navigation/dropdowns.
    const pEls = reading.select("p") || [];

    const HARD_STOP_PATTERNS = [
      /Patreon/i,
      /Ko-?fi/i,
      /PayPal/i,
      /Visa/i,
      /تخل(?:ص|ّص)\s+من\s+الإعلانات/i,
      /عضوية\s+مميزة/i,
      /اشترك\s+عبر/i,
      /طرق\s+الدفع/i,
      /فضاء\s+روايات/i,
      /cenele\.com/i,
    ];

    const SOFT_REMOVE_PATTERNS = [
      /استمتع\s+بتجربة\s+قراءة/i,
      /ملاحظة\s*[:：]\s*أرسل\s+اسمك/i,
      /للتواصل\s+معنا/i,
      /جميع\s+ما\s+تم\s+ترجمته/i,
      /هذا\s+مجرد\s+محتوى\s+ترفيهي/i,
    ];

    function _matchAny(text, patterns) {
      for (const re of patterns) {
        if (re.test(text)) return true;
      }
      return false;
    }

    function shouldHardStop(text) {
      return _matchAny(text, HARD_STOP_PATTERNS);
    }

    function shouldRemove(text) {
      return _matchAny(text, SOFT_REMOVE_PATTERNS);
    }

    const blocks = [];

    if (pEls.length) {
      for (const p of pEls) {
        // Use innerHtml to preserve <br> inside paragraph, then convert to text.
        const frag = p?.innerHtml ?? p?.text ?? "";
        let t = this._htmlFragmentToText(frag)
          .replace(/\u00A0/g, " ")
          .trim();

        // Keep truly empty paragraphs as blank lines.
        if (!t) {
          blocks.push("");
          continue;
        }

        // Stop before site-wide membership/ads/disclaimer block (usually appended at the end).
        if (shouldHardStop(t)) break;
        if (shouldRemove(t)) continue;

        // Normalize spaces per line but keep line breaks inside the paragraph.
        const lines = t
          .split("\n")
          .map((line) => String(line ?? "").replace(/\s+/g, " ").trim());
        t = lines.join("\n").trim();

        blocks.push(t);
      }
    } else {
      // Fallback: split whole text by lines
      let t = String(reading.text ?? "").replace(/\r/g, "");
      const lines = t
        .split("\n")
        .map((line) => String(line ?? "").replace(/\s+/g, " ").trim());
      for (const line of lines) {
        if (!line) {
          blocks.push("");
          continue;
        }
        if (shouldHardStop(line)) break;
        if (shouldRemove(line)) continue;
        blocks.push(line);
      }
    }

    // Preserve empty lines, but prevent huge blank runs.
    const cleaned = [];
    let blankRun = 0;
    for (const b of blocks) {
      if (!b) {
        blankRun += 1;
        if (blankRun <= 4) cleaned.push("");
        continue;
      }
      blankRun = 0;
      cleaned.push(b);
    }

    // Build HTML with real paragraphs so Mangayomi renders spacing like the website.
    const parts = [];
    for (const b of cleaned) {
      if (!b) {
        parts.push("<p><br></p>");
        continue;
      }
      const safe = this._escapeHtml(b).replace(/\n/g, "<br>\n");
      parts.push(`<p>${safe}</p>`);
    }

    const bodyHtml = parts.join("\n");
    return `<h2>${this._escapeHtml(title)}</h2>\n<div>${bodyHtml}</div>`;
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }
}

import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio, CheerioAPI } from 'cheerio';
import { NovelStatus } from '@libs/novelStatus';

/**
 * فضاء الروايات (cenele.com)
 *
 * The chapter list is loaded the same way the site's "قائمة الفصول" panel does:
 * all volumes at once in pages of 100 (falls back to volume by volume).
 * Chapter text is wrapped in dir="rtl" so exported EPUBs read right-to-left.
 */
class FadaaRiwayatPlugin implements Plugin.PluginBase {
  id = 'fadaaRiwayat';
  name = 'فضاء الروايات';
  icon = 'src/ar/fadaariwayat/icon.png';
  site = 'https://cenele.com/';
  version = '1.0.10';

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: { Referer: 'https://cenele.com/' },
  };

  // The site answers 403 to Android WebView user agents (LNReader's default),
  // so requests identify as mobile Chrome. Page requests carry no Referer:
  // the firewall also rejects mobile requests with a homepage Referer.
  private userAgent =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

  private async getHtml(url: string): Promise<string> {
    const res = await fetchApi(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) throw new Error(`الموقع رفض الطلب (HTTP ${res.status})`);
    return await res.text();
  }

  private async getPage(url: string): Promise<CheerioAPI> {
    return loadCheerio(await this.getHtml(url));
  }

  private absolute(href: string | undefined): string {
    if (!href) return '';
    try {
      return new URL(href, this.site).toString();
    } catch {
      return '';
    }
  }

  private toPath(href: string | undefined): string {
    return this.absolute(href).replace(/^https?:\/\/[^/]+\//, '');
  }

  // ---------- lists ----------

  private parseNovelList($: CheerioAPI): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    const seen: Record<string, boolean> = {};

    // New theme cards, then classic Madara markup (still used by search).
    let nodes = $('article.nhv-library-card');
    if (!nodes.length) nodes = $('div.page-item-detail');
    if (!nodes.length) nodes = $('div.c-tabs-item__content, div.page-listing-item');

    nodes.each((_, el) => {
      const node = $(el);
      const a = node
        .find('.nhv-library-card__title a, div.post-title a, h3 a, h4 a')
        .first();
      const name = a.text().trim();
      const path = this.toPath(a.attr('href'));
      if (!name || !path.startsWith('cont/') || seen[path]) return;
      seen[path] = true;

      const img = node
        .find('.nhv-library-card__cover img, div.item-thumb img, div.tab-thumb img, img')
        .first();
      const cover = this.absolute(
        img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src'),
      );
      novels.push({ name, path, cover });
    });
    return novels;
  }

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const order = showLatestNovels ? 'latest' : 'views';
    const page = pageNo > 1 ? `page/${pageNo}/` : '';
    const $ = await this.getPage(`${this.site}cont/${page}?m_orderby=${order}`);
    return this.parseNovelList($);
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const url =
      `${this.site}?s=${encodeURIComponent(searchTerm.trim())}` +
      `&post_type=wp-manga&paged=${pageNo}`;
    const $ = await this.getPage(url);
    return this.parseNovelList($);
  }

  // ---------- novel ----------

  private toStatus(text: string): string {
    if (/مستمر|جاري|مستمرة/.test(text)) return NovelStatus.Ongoing;
    if (/مكتمل|منتهي/.test(text)) return NovelStatus.Completed;
    if (/متوقف/.test(text)) return NovelStatus.OnHiatus;
    if (/ملغ/.test(text)) return NovelStatus.Cancelled;
    return NovelStatus.Unknown;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novelUrl = this.site + novelPath;
    const html = await this.getHtml(novelUrl);
    const $ = loadCheerio(html);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name:
        $('h1.nhv-novel-title').first().text().trim() ||
        $('div.post-title h1').first().text().trim() ||
        'Untitled',
    };

    const img = $('div.nhv-novel-cover img, div.summary_image img').first();
    novel.cover = this.absolute(
      img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src'),
    );

    const summary = $('div.nhv-novel-synopsis p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .join('\n\n');
    novel.summary = summary || $('div.nhv-novel-synopsis').text().trim();

    // <div><span>label</span><strong>value</strong></div>
    const meta: Record<string, string> = {};
    $('div.nhv-novel-meta > div').each((_, el) => {
      const label = $(el).find('span').first().text().trim();
      const value = $(el).find('strong').first().text().trim();
      if (label && value) meta[label] = value;
    });
    novel.author = meta['المؤلف'] || meta['الكاتب'] || '';
    novel.artist = meta['المترجم'] || '';

    novel.genres = $('div.nhv-novel-genres a')
      .map((_, a) => $(a).text().trim())
      .get()
      .filter(Boolean)
      .join(',');

    novel.status = this.toStatus(
      $('div.nhv-novel-status strong').first().text().trim() || meta['الحالة'] || '',
    );

    // Full list from the "قائمة الفصول" panel. Whatever loads is kept and merged
    // with the "آخر 8 فصول" block printed in the page.
    const latest = this.parseChapterItems($, $('li.wp-manga-chapter'));
    const result = await this.fetchAllChapters(html, novelUrl);
    novel.chapters = this.sortChapters(result.chapters.concat(latest));

    if (result.error) {
      // Shown at the top of the description so the reason is visible on the device.
      novel.summary =
        `⚠️ قائمة الفصول ناقصة (${novel.chapters.length} فصل): ${result.error}\n\n` +
        (novel.summary || '');
    }
    return novel;
  }

  // Dedupe by path and order by chapter number. "بدون مجلدات" mixes intro
  // chapters (0.1, 0.2) with recent chapters not yet filed into a volume.
  // Unnumbered chapters stay right after their neighbour in site order.
  private sortChapters(list: Plugin.ChapterItem[]): Plugin.ChapterItem[] {
    const seen: Record<string, boolean> = {};
    const unique = list.filter(ch => (seen[ch.path] ? false : (seen[ch.path] = true)));
    let prev = -1;
    const keyed = unique.map((ch, i) => {
      const key =
        ch.chapterNumber !== undefined && !isNaN(ch.chapterNumber) ? ch.chapterNumber : prev + 0.0001;
      prev = key;
      return { ch, key, i };
    });
    keyed.sort((a, b) => a.key - b.key || a.i - b.i);
    return keyed.map(k => k.ch);
  }

  private parseChapterItems($: CheerioAPI, items: ReturnType<CheerioAPI>): Plugin.ChapterItem[] {
    const chapters: Plugin.ChapterItem[] = [];
    items.each((_, el) => {
      const li = $(el);
      const a = li.find('a').first();
      const path = this.toPath(a.attr('href'));
      const full = a.text().replace(/\s+/g, ' ').trim();
      if (!path || !full) return;

      // "الفصل 1 الكابوس يبدأ" -> "الفصل 1 - الكابوس يبدأ"
      const title = li.find('.nhv-chapter-name').text().replace(/\s+/g, ' ').trim();
      let name = full;
      if (title && full.endsWith(title) && full.length > title.length) {
        name = `${full.slice(0, -title.length).trim()} - ${title}`;
      }

      const num = full.match(/الفصل\s*(\d+(?:\.\d+)?)/);
      chapters.push({
        name,
        path,
        chapterNumber: num ? parseFloat(num[1]) : undefined,
        releaseTime: this.parseDate(li.find('.chapter-release-date').text().trim()),
      });
    });
    return chapters;
  }

  // "يونيو 30, 2022" -> ISO date. Relative dates ("منذ يومين") are left empty.
  private parseDate(text: string): string | null {
    const months: Record<string, number> = {
      'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3, 'ابريل': 3, 'مايو': 4,
      'يونيو': 5, 'يوليو': 6, 'أغسطس': 7, 'اغسطس': 7, 'سبتمبر': 8,
      'أكتوبر': 9, 'اكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11,
    };
    const m = text.match(/([؀-ۿ]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && months[m[1]] !== undefined) {
      return new Date(Date.UTC(+m[3], months[m[1]], +m[2])).toISOString();
    }
    return null;
  }

  // Same requests the site makes when you open "قائمة الفصول": the volume list,
  // then each volume in pages of 50 ("تحميل المزيد"). Never throws: returns the
  // chapters it got plus a readable reason if something failed.
  private async fetchAllChapters(
    pageHtml: string,
    novelUrl: string,
  ): Promise<{ chapters: Plugin.ChapterItem[]; error?: string }> {
    const chapters: Plugin.ChapterItem[] = [];
    let step = 'قراءة إعدادات الصفحة';
    try {
      // Read the values from anywhere in the page, not only the nhvNovelV2 block.
      const postId =
        (pageHtml.match(/"postId"\s*:\s*"?(\d+)/) || [])[1] ||
        (pageHtml.match(/\bpostid-(\d+)\b/) || [])[1];
      let nonce = (pageHtml.match(/"chaptersNonce"\s*:\s*"([^"]+)"/) || [])[1];
      const ajaxUrl =
        ((pageHtml.match(/"ajaxurl"\s*:\s*"([^"]+)"/) || [])[1] || '').replace(/\\\//g, '/') ||
        `${this.site}wp-admin/admin-ajax.php`;
      if (!postId) return { chapters, error: 'ما لقيت رقم الرواية في الصفحة' };

      const result = await this.loadVolumes(postId, nonce, ajaxUrl, novelUrl, chapters, s => (step = s));
      return { chapters, error: result };
    } catch (e: any) {
      return { chapters, error: `${step}: ${e?.message || e}` };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async loadVolumes(
    postId: string,
    initialNonce: string | undefined,
    ajaxUrl: string,
    novelUrl: string,
    chapters: Plugin.ChapterItem[],
    setStep: (s: string) => void,
  ): Promise<string | undefined> {
    let nonce = initialNonce || '';
    const headers = {
      'User-Agent': this.userAgent,
      'Origin': 'https://cenele.com',
      'Referer': novelUrl,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const encode = (obj: Record<string, string | number>) =>
      Object.keys(obj)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(obj[k]))}`)
        .join('&');

    // One POST, decoded as JSON; failures carry the HTTP status and the start of
    // the reply so the reason is readable on the device.
    const postOnce = async (body: string): Promise<{ status: number; data?: any; text: string }> => {
      const res = await fetchApi(ajaxUrl, { method: 'POST', headers, body });
      const text = (await res.text()) || '';
      try {
        return { status: res.status, data: JSON.parse(text), text };
      } catch {
        return { status: res.status, text };
      }
    };
    const describe = (r: { status: number; text: string }) =>
      `HTTP ${r.status} — ${r.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)}`;

    const refreshNonce = async () => {
      // The site's own way to get a fresh nonce (its script calls this on 403).
      const r = await postOnce(encode({ action: 'nhv_refresh_front_nonces' }));
      if (r.data?.success && r.data.data?.chapters_nonce) nonce = r.data.data.chapters_nonce;
    };

    // Up to 3 attempts per request, refreshing the nonce after a 403.
    const post = async (params: Record<string, string | number>): Promise<any> => {
      let last = { status: 0, text: '' };
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await this.sleep(1500 * attempt);
        try {
          const r = await postOnce(encode({ ...params, nonce }));
          if (r.status === 200 && r.data?.success) return r.data;
          last = r;
          if (r.status === 403 || r.data?.success === false) await refreshNonce();
        } catch (e: any) {
          last = { status: 0, text: String(e?.message || e) };
        }
      }
      throw new Error(describe(last));
    };

    const base = {
      action: 'nhv_manga_single_chapters_page',
      manga_id: postId,
      per_page: 50,
      order: 'asc',
    };

    if (!nonce) {
      setStep('جلب رمز الطلب');
      await refreshNonce();
    }

    // Fast path: every volume at once (volume=-1), 100 chapters a page, a few
    // pages at a time. 3259 chapters take 33 requests instead of ~66 in a row.
    const fast = await this.loadAllAtOnce(post, base, setStep);
    if (fast) {
      for (const ch of fast) chapters.push(ch);
      return undefined;
    }

    setStep('قائمة المجلدات');
    const meta = await post({ ...base, volume: -1, page: 1, meta_only: 1 });
    const volumes: { num: number; label?: string }[] = Array.isArray(meta.volumes) ? meta.volumes : [];
    if (!volumes.length) return 'الموقع رجّع قائمة مجلدات فاضية';

    for (const vol of volumes) {
      const volume = parseInt(String(vol.num || 0), 10);
      let page = 1;
      let more = true;
      while (more && page <= 200) {
        setStep(`${vol.label || `المجلد ${volume}`}، الصفحة ${page}`);
        const data = await post({ ...base, volume, page });
        const $ = loadCheerio(data.html || '');
        const items = this.parseChapterItems($, $('li.wp-manga-chapter'));
        for (const ch of items) chapters.push(ch);
        more = !!data.has_more && items.length > 0;
        page++;
      }
    }
    return undefined;
  }

  // All volumes in one listing. Returns undefined (so the caller falls back to
  // reading volume by volume) if anything fails or the count doesn't match the
  // site's total.
  private async loadAllAtOnce(
    post: (params: Record<string, string | number>) => Promise<any>,
    base: Record<string, string | number>,
    setStep: (s: string) => void,
  ): Promise<Plugin.ChapterItem[] | undefined> {
    const perPage = 100;
    const parallel = 4;
    try {
      const parse = (data: any) => {
        const $ = loadCheerio(data.html || '');
        return this.parseChapterItems($, $('li.wp-manga-chapter'));
      };
      setStep('قائمة الفصول، الصفحة 1');
      const first = await post({ ...base, volume: -1, page: 1, per_page: perPage });
      const total = parseInt(String(first.total || 0), 10);
      const pages: Plugin.ChapterItem[][] = [parse(first)];
      if (!total || !pages[0].length) return undefined;

      const lastPage = Math.ceil(total / perPage);
      for (let start = 2; start <= lastPage; start += parallel) {
        const batch: Promise<Plugin.ChapterItem[]>[] = [];
        for (let page = start; page < start + parallel && page <= lastPage; page++) {
          batch.push(post({ ...base, volume: -1, page, per_page: perPage }).then(parse));
        }
        setStep(`قائمة الفصول، الصفحة ${start} من ${lastPage}`);
        const got = await Promise.all(batch);
        for (const list of got) pages.push(list);
      }

      const all: Plugin.ChapterItem[] = [];
      const seen: Record<string, boolean> = {};
      for (const list of pages) {
        for (const ch of list) {
          if (seen[ch.path]) continue;
          seen[ch.path] = true;
          all.push(ch);
        }
      }
      return all.length >= total ? all : undefined;
    } catch {
      return undefined;
    }
  }

  // ---------- chapter ----------

  // Inline so it travels with the chapter into exported EPUBs: a blank-line gap
  // after every paragraph, no first-line indent.
  private paragraphStyle = 'margin: 0 0 0.9em 0; text-indent: 0;';

  // A reply without the chapter text or a failed request is a site glitch:
  // retry the same chapter after a few seconds. Only the site's "not a robot"
  // check gets the long waits. If a chapter still meets the check after every
  // wait, the following chapters fail fast (one try each) until one comes
  // through again.
  private quickWaits = [2000, 4000, 8000];
  private gateWaits = [15000, 30000, 60000, 120000];
  // "Cloudflare" in the message is what Bunori looks for to pause the source's
  // downloads and offer its own verification screen (the check is Cloudflare
  // Turnstile).
  private gateMessage = 'Cloudflare: الموقع طلب تحقق «لست روبوت». افتح التحقق من شاشة التحميل';

  // Bunori pauses downloads and lets the reader pass the check himself, so
  // there the plugin reports the check at once instead of waiting it out.
  private inBunori =
    typeof globalThis !== 'undefined' && !!(globalThis as any).__bunori_bridge;
  private holdingBack = false;

  // Apps may ask for several chapters at once (Bunori downloads three in
  // parallel). Up to three chapters are fetched at the same time. When the site
  // asks for its "not a robot" check, every chapter waits together (pauseUntil)
  // instead of each one hitting the site again.
  private maxParallel = 3;
  private active = 0;
  private waiting: (() => void)[] = [];
  private pauseUntil = 0;

  private acquire(): Promise<void> {
    if (this.active < this.maxParallel) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    await this.acquire();
    try {
      return await this.fetchChapter(chapterPath);
    } finally {
      this.release();
    }
  }

  private async fetchChapter(chapterPath: string): Promise<string> {
    let quick = 0;
    let gate = 0;
    for (;;) {
      try {
        const html = await this.readChapter(chapterPath);
        this.holdingBack = false;
        return html;
      } catch (e) {
        const isGate = e instanceof Error && e.message === this.gateMessage;
        if (isGate) {
          if (this.inBunori || this.holdingBack || gate >= this.gateWaits.length) {
            this.holdingBack = true;
            throw e;
          }
          this.pauseUntil = Math.max(this.pauseUntil, Date.now() + this.gateWaits[gate++]);
        } else {
          if (quick >= this.quickWaits.length) throw e;
          await this.sleep(this.quickWaits[quick++]);
        }
      }
    }
  }

  private async readChapter(chapterPath: string): Promise<string> {
    const wait = this.pauseUntil - Date.now();
    if (wait > 0) await this.sleep(wait);
    const $ = await this.getPage(this.site + chapterPath);
    if ($('.nhv-ts-gate').length) {
      // The site sent its "not a robot" check instead of the chapter. Fail the
      // download (so no empty chapter is saved); this source doesn't get around it.
      throw new Error(this.gateMessage);
    }
    const title = $('h3.chapter-name').first().text().replace(/\s+/g, ' ').trim();
    const reading = $('div.reading-content').first();

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const paragraphs: string[] = [];
    reading.find('p').each((_, el) => {
      const p = $(el);
      // Skip the store/app promo boxes; chapter paragraphs live in the main flow.
      if (p.closest('aside, .nhv-reader-promo, script, style').length) return;
      p.find('br').replaceWith('\n');
      const text = p
        .text()
        .replace(/ /g, ' ')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .join('\n')
        .trim();
      if (text) {
        // Lines split by <br> become their own paragraphs, so every paragraph
        // gets the same spacing.
        for (const line of text.split('\n')) {
          if (line.trim()) paragraphs.push(`<p style="${this.paragraphStyle}">${escape(line.trim())}</p>`);
        }
      }
    });

    if (!paragraphs.length) {
      // No chapter text in the reply (error page, interrupted load, ...). Fail
      // the download so LNReader doesn't save an empty chapter; a retry usually works.
      throw new Error('ما وصل نص الفصل من الموقع، جرب تحمّله مرة ثانية بعد شوي');
    }

    const heading = title
      ? `<h2 style="margin: 0 0 1.2em 0;">${escape(title)}</h2>\n`
      : '';
    return (
      '<div dir="rtl" lang="ar" style="direction: rtl;">\n' +
      heading +
      paragraphs.join('\n') +
      '\n</div>'
    );
  }
}

export default new FadaaRiwayatPlugin();

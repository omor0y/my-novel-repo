import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio, CheerioAPI } from 'cheerio';
import { NovelStatus } from '@libs/novelStatus';

/**
 * Riwyat (cenele.com) — a straight port of IReader's own "Riwyat" source
 * (IReaderorg/IReader-extensions, sources/ar/riwyat) to an LNReader plugin.
 *
 * Same requests, same parsing, no waits and no queue: the chapter list comes
 * from every page of the site's chapter panel at once, and each chapter is
 * fetched as soon as the app asks for it.
 *
 * One difference from IReader: requests identify as mobile Chrome, because the
 * site answers 403 to the Android WebView user agent LNReader uses by default.
 */
class RiwyatPlugin implements Plugin.PluginBase {
  id = 'riwyat';
  name = 'Riwyat (cenele)';
  icon = 'src/ar/riwyat/icon.png';
  site = 'https://cenele.com/';
  version = '1.0.0';

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: { Referer: 'https://cenele.com/' },
  };

  private headers = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Accept-Language': 'ar,en;q=0.8',
  };

  private async get(url: string): Promise<string> {
    const res = await fetchApi(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  private toPath(href: string | undefined): string {
    if (!href) return '';
    return href.trim().replace(/^https?:\/\/[^/]+\//, '');
  }

  // ---------- lists ----------

  private parseList($: CheerioAPI): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    const seen: Record<string, boolean> = {};
    $('article.nhv-library-card, .nhv-library-card').each((_, el) => {
      const card = $(el);
      const a = card.find('h2.nhv-library-card__title a, .nhv-library-card__title a').first();
      const name = a.text().trim();
      const path = this.toPath(a.attr('href'));
      if (!name || !path || seen[path]) return;
      seen[path] = true;
      const cover = (
        card.find('a.nhv-library-card__cover img, .nhv-library-card__cover img').first().attr('src') || ''
      ).trim();
      novels.push({ name, path, cover });
    });
    return novels;
  }

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const url = showLatestNovels
      ? `${this.site}cont/?paged=${pageNo}`
      : `${this.site}cont/?m_orderby=views&paged=${pageNo}`;
    return this.parseList(loadCheerio(await this.get(url)));
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return [];
    const url =
      `${this.site}wp-admin/admin-ajax.php?action=nhv_manga_suggest&term=` +
      encodeURIComponent(searchTerm.trim());
    const json = JSON.parse(await this.get(url));
    const items: any[] = (json && json.data && json.data.items) || [];
    return items
      .filter(it => it && it.title && it.url)
      .map(it => ({
        name: String(it.title).trim(),
        path: this.toPath(String(it.url)),
        cover: String(it.thumb || '').trim(),
      }));
  }

  // ---------- novel ----------

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const html = await this.get(this.site + novelPath);
    const $ = loadCheerio(html);

    const status = $('div.nhv-novel-meta div.nhv-novel-status, .nhv-novel-status').first().text();
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('h1.nhv-novel-title, h1.entry-title').first().text().trim() || 'Untitled',
      cover: ($('div.nhv-novel-cover img, .nhv-novel-cover img').first().attr('src') || '').trim(),
      summary: $('div.nhv-novel-synopsis p, .nhv-novel-synopsis p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean)
        .join('\n\n'),
      author: $("div.nhv-novel-meta a[href*='/cont-author/'], .nhv-novel-meta a[href*='/cont-author/']")
        .map((_, a) => $(a).text().trim())
        .get()
        .join(', '),
      genres: $('div.nhv-novel-genres a, .nhv-novel-genres a')
        .map((_, a) => $(a).text().trim())
        .get()
        .filter(Boolean)
        .join(','),
      status: /مكتملة|Completed/i.test(status)
        ? NovelStatus.Completed
        : /مستمرة|Ongoing/i.test(status)
          ? NovelStatus.Ongoing
          : NovelStatus.Unknown,
    };

    const nonce = (html.match(/chaptersNonce["']?\s*[:=]\s*["']([^"']+)["']/) || [])[1];
    const postId =
      $('[data-post-id]').first().attr('data-post-id') ||
      (html.match(/postId["']?\s*[:=]\s*["']?(\d+)/) || [])[1];

    let chapters: Plugin.ChapterItem[] = [];
    if (nonce && postId) chapters = await this.fetchChapters(postId, nonce);
    if (!chapters.length) chapters = this.parseChapters($);
    novel.chapters = chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    return novel;
  }

  private parseChapters($: CheerioAPI): Plugin.ChapterItem[] {
    const chapters: Plugin.ChapterItem[] = [];
    $('li.wp-manga-chapter').each((_, el) => {
      const a = $(el).find('a').first();
      const name = a.text().replace(/\s+/g, ' ').trim();
      const path = this.toPath(a.attr('href'));
      if (!name || !path) return;
      const num = name.match(/(\d+(?:\.\d+)?)/);
      chapters.push({ name, path, chapterNumber: num ? parseFloat(num[1]) : undefined });
    });
    return chapters;
  }

  // The site's chapter panel: page 1 gives the total, then every other page is
  // requested at the same time.
  private async fetchChapters(postId: string, nonce: string): Promise<Plugin.ChapterItem[]> {
    const perPage = 100;
    const page = async (n: number): Promise<any> => {
      const body =
        `action=nhv_manga_single_chapters_page&nonce=${encodeURIComponent(nonce)}` +
        `&manga_id=${postId}&volume=-1&page=${n}&per_page=${perPage}&order=desc`;
      const res = await fetchApi(`${this.site}wp-admin/admin-ajax.php`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body,
      });
      return JSON.parse(await res.text());
    };
    const parse = (json: any) => this.parseChapters(loadCheerio((json && json.html) || ''));

    try {
      const first = await page(1);
      const all = parse(first);
      const total = parseInt(String(first.total || 0), 10);
      if (!first.has_more || total <= perPage) return all;
      const rest: Promise<Plugin.ChapterItem[]>[] = [];
      for (let n = 2; n <= Math.ceil(total / perPage); n++) {
        rest.push(page(n).then(parse, () => []));
      }
      for (const list of await Promise.all(rest)) all.push(...list);
      const seen: Record<string, boolean> = {};
      return all.filter(ch => (seen[ch.path] ? false : (seen[ch.path] = true)));
    } catch {
      return [];
    }
  }

  // ---------- chapter ----------

  async parseChapter(chapterPath: string): Promise<string> {
    const $ = loadCheerio(await this.get(this.site + chapterPath));

    $(
      'script, style, .nhv-reader-promo, .nhv-reading-chapter-head, .nhv-reading-meta-strip, ' +
        '.nhv-reading-topbar, blockquote[data-nosnippet=true], blockquote[inert], .nhv-report-slot',
    ).remove();

    let container = $('.reading-content.current').first();
    if (!container.length) container = $('.reading-content-wrap.chapter-type-text').first();
    let ps = container.find('p');
    if (!ps.length) ps = $('.reading-content.current p, .reading-content-wrap.chapter-type-text p');

    const watermark = /هذا التطبيق يسرق|فضاء الروايات|عالم الروايات|حقوق النشر|جميع الحقوق محفوظة/i;
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const seen: Record<string, boolean> = {};
    const paragraphs: string[] = [];
    ps.each((_, el) => {
      const p = $(el);
      p.find('span[aria-hidden=true], span[role=presentation], span[data-nosnippet=true], input[type=hidden]').remove();
      const text = p
        .text()
        .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\u00AD]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (text.length < 2 || watermark.test(text) || seen[text]) return;
      seen[text] = true;
      paragraphs.push(`<p style="margin: 0 0 0.9em 0; text-indent: 0;">${escape(text)}</p>`);
    });

    // An empty page is reported as an error so no empty chapter is saved.
    // "Cloudflare" lets Bunori offer its verification screen.
    if (!paragraphs.length) {
      throw new Error('Cloudflare: ما وصل نص الفصل. افتح التحقق أو جرّب مرة ثانية');
    }

    const title = $('h3.chapter-name').first().text().trim();
    return (
      '<div dir="rtl" lang="ar">\n' +
      (title ? `<h2>${escape(title)}</h2>\n` : '') +
      paragraphs.join('\n') +
      '\n</div>'
    );
  }
}

export default new RiwyatPlugin();

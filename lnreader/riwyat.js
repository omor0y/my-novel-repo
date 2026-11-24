"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fetch_1 = require("@libs/fetch");
var cheerio_1 = require("cheerio");
var novelStatus_1 = require("@libs/novelStatus");
var RiwyatPlugin = (function () {
    function RiwyatPlugin() {
        this.id = 'riwyat';
        this.name = 'Riwyat (cenele)';
        this.icon = 'src/ar/riwyat/icon.png';
        this.site = 'https://cenele.com/';
        this.version = '1.0.0';
        this.imageRequestInit = {
            headers: { Referer: 'https://cenele.com/' },
        };
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'ar,en;q=0.8',
        };
    }
    RiwyatPlugin.prototype.get = function (url) {
        return __awaiter(this, void 0, Promise, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, (0, fetch_1.fetchApi)(url, { headers: this.headers })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("HTTP ".concat(res.status));
                        return [4, res.text()];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    RiwyatPlugin.prototype.toPath = function (href) {
        if (!href)
            return '';
        return href.trim().replace(/^https?:\/\/[^/]+\//, '');
    };
    RiwyatPlugin.prototype.parseList = function ($) {
        var _this = this;
        var novels = [];
        var seen = {};
        $('article.nhv-library-card, .nhv-library-card').each(function (_, el) {
            var card = $(el);
            var a = card.find('h2.nhv-library-card__title a, .nhv-library-card__title a').first();
            var name = a.text().trim();
            var path = _this.toPath(a.attr('href'));
            if (!name || !path || seen[path])
                return;
            seen[path] = true;
            var cover = (card.find('a.nhv-library-card__cover img, .nhv-library-card__cover img').first().attr('src') || '').trim();
            novels.push({ name: name, path: path, cover: cover });
        });
        return novels;
    };
    RiwyatPlugin.prototype.popularNovels = function (pageNo_1, _a) {
        return __awaiter(this, arguments, Promise, function (pageNo, _b) {
            var url, _c, _d;
            var showLatestNovels = _b.showLatestNovels;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        url = showLatestNovels
                            ? "".concat(this.site, "cont/?paged=").concat(pageNo)
                            : "".concat(this.site, "cont/?m_orderby=views&paged=").concat(pageNo);
                        _c = this.parseList;
                        _d = cheerio_1.load;
                        return [4, this.get(url)];
                    case 1: return [2, _c.apply(this, [_d.apply(void 0, [_e.sent()])])];
                }
            });
        });
    };
    RiwyatPlugin.prototype.searchNovels = function (searchTerm, pageNo) {
        return __awaiter(this, void 0, Promise, function () {
            var url, json, _a, _b, items;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (pageNo > 1)
                            return [2, []];
                        url = "".concat(this.site, "wp-admin/admin-ajax.php?action=nhv_manga_suggest&term=") +
                            encodeURIComponent(searchTerm.trim());
                        _b = (_a = JSON).parse;
                        return [4, this.get(url)];
                    case 1:
                        json = _b.apply(_a, [_c.sent()]);
                        items = (json && json.data && json.data.items) || [];
                        return [2, items
                                .filter(function (it) { return it && it.title && it.url; })
                                .map(function (it) { return ({
                                name: String(it.title).trim(),
                                path: _this.toPath(String(it.url)),
                                cover: String(it.thumb || '').trim(),
                            }); })];
                }
            });
        });
    };
    RiwyatPlugin.prototype.parseNovel = function (novelPath) {
        return __awaiter(this, void 0, Promise, function () {
            var html, $, status, novel, nonce, postId, chapters;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.get(this.site + novelPath)];
                    case 1:
                        html = _a.sent();
                        $ = (0, cheerio_1.load)(html);
                        status = $('div.nhv-novel-meta div.nhv-novel-status, .nhv-novel-status').first().text();
                        novel = {
                            path: novelPath,
                            name: $('h1.nhv-novel-title, h1.entry-title').first().text().trim() || 'Untitled',
                            cover: ($('div.nhv-novel-cover img, .nhv-novel-cover img').first().attr('src') || '').trim(),
                            summary: $('div.nhv-novel-synopsis p, .nhv-novel-synopsis p')
                                .map(function (_, p) { return $(p).text().trim(); })
                                .get()
                                .filter(Boolean)
                                .join('\n\n'),
                            author: $("div.nhv-novel-meta a[href*='/cont-author/'], .nhv-novel-meta a[href*='/cont-author/']")
                                .map(function (_, a) { return $(a).text().trim(); })
                                .get()
                                .join(', '),
                            genres: $('div.nhv-novel-genres a, .nhv-novel-genres a')
                                .map(function (_, a) { return $(a).text().trim(); })
                                .get()
                                .filter(Boolean)
                                .join(','),
                            status: /مكتملة|Completed/i.test(status)
                                ? novelStatus_1.NovelStatus.Completed
                                : /مستمرة|Ongoing/i.test(status)
                                    ? novelStatus_1.NovelStatus.Ongoing
                                    : novelStatus_1.NovelStatus.Unknown,
                        };
                        nonce = (html.match(/chaptersNonce["']?\s*[:=]\s*["']([^"']+)["']/) || [])[1];
                        postId = $('[data-post-id]').first().attr('data-post-id') ||
                            (html.match(/postId["']?\s*[:=]\s*["']?(\d+)/) || [])[1];
                        chapters = [];
                        if (!(nonce && postId)) return [3, 3];
                        return [4, this.fetchChapters(postId, nonce)];
                    case 2:
                        chapters = _a.sent();
                        _a.label = 3;
                    case 3:
                        if (!chapters.length)
                            chapters = this.parseChapters($);
                        novel.chapters = chapters.sort(function (a, b) { return (a.chapterNumber || 0) - (b.chapterNumber || 0); });
                        return [2, novel];
                }
            });
        });
    };
    RiwyatPlugin.prototype.parseChapters = function ($) {
        var _this = this;
        var chapters = [];
        $('li.wp-manga-chapter').each(function (_, el) {
            var a = $(el).find('a').first();
            var name = a.text().replace(/\s+/g, ' ').trim();
            var path = _this.toPath(a.attr('href'));
            if (!name || !path)
                return;
            var num = name.match(/(\d+(?:\.\d+)?)/);
            chapters.push({ name: name, path: path, chapterNumber: num ? parseFloat(num[1]) : undefined });
        });
        return chapters;
    };
    RiwyatPlugin.prototype.fetchChapters = function (postId, nonce) {
        return __awaiter(this, void 0, Promise, function () {
            var perPage, page, parse, first, all, total, rest, n, _i, _a, list, seen_1, _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        perPage = 100;
                        page = function (n) { return __awaiter(_this, void 0, Promise, function () {
                            var body, res, _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        body = "action=nhv_manga_single_chapters_page&nonce=".concat(encodeURIComponent(nonce)) +
                                            "&manga_id=".concat(postId, "&volume=-1&page=").concat(n, "&per_page=").concat(perPage, "&order=desc");
                                        return [4, (0, fetch_1.fetchApi)("".concat(this.site, "wp-admin/admin-ajax.php"), {
                                                method: 'POST',
                                                headers: __assign(__assign({}, this.headers), { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }),
                                                body: body,
                                            })];
                                    case 1:
                                        res = _c.sent();
                                        _b = (_a = JSON).parse;
                                        return [4, res.text()];
                                    case 2: return [2, _b.apply(_a, [_c.sent()])];
                                }
                            });
                        }); };
                        parse = function (json) { return _this.parseChapters((0, cheerio_1.load)((json && json.html) || '')); };
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        return [4, page(1)];
                    case 2:
                        first = _c.sent();
                        all = parse(first);
                        total = parseInt(String(first.total || 0), 10);
                        if (!first.has_more || total <= perPage)
                            return [2, all];
                        rest = [];
                        for (n = 2; n <= Math.ceil(total / perPage); n++) {
                            rest.push(page(n).then(parse, function () { return []; }));
                        }
                        _i = 0;
                        return [4, Promise.all(rest)];
                    case 3:
                        _a = _c.sent();
                        _c.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3, 6];
                        list = _a[_i];
                        all.push.apply(all, list);
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3, 4];
                    case 6:
                        seen_1 = {};
                        return [2, all.filter(function (ch) { return (seen_1[ch.path] ? false : (seen_1[ch.path] = true)); })];
                    case 7:
                        _b = _c.sent();
                        return [2, []];
                    case 8: return [2];
                }
            });
        });
    };
    RiwyatPlugin.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, Promise, function () {
            var $, _a, container, ps, watermark, escape, seen, paragraphs, title;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4, this.get(this.site + chapterPath)];
                    case 1:
                        $ = _a.apply(void 0, [_b.sent()]);
                        $('script, style, .nhv-reader-promo, .nhv-reading-chapter-head, .nhv-reading-meta-strip, ' +
                            '.nhv-reading-topbar, blockquote[data-nosnippet=true], blockquote[inert], .nhv-report-slot').remove();
                        container = $('.reading-content.current').first();
                        if (!container.length)
                            container = $('.reading-content-wrap.chapter-type-text').first();
                        ps = container.find('p');
                        if (!ps.length)
                            ps = $('.reading-content.current p, .reading-content-wrap.chapter-type-text p');
                        watermark = /هذا التطبيق يسرق|فضاء الروايات|عالم الروايات|حقوق النشر|جميع الحقوق محفوظة/i;
                        escape = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
                        seen = {};
                        paragraphs = [];
                        ps.each(function (_, el) {
                            var p = $(el);
                            p.find('span[aria-hidden=true], span[role=presentation], span[data-nosnippet=true], input[type=hidden]').remove();
                            var text = p
                                .text()
                                .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\u00AD]/g, '')
                                .replace(/\s{2,}/g, ' ')
                                .trim();
                            if (text.length < 2 || watermark.test(text) || seen[text])
                                return;
                            seen[text] = true;
                            paragraphs.push("<p style=\"margin: 0 0 0.9em 0; text-indent: 0;\">".concat(escape(text), "</p>"));
                        });
                        if (!paragraphs.length) {
                            throw new Error('Cloudflare: ما وصل نص الفصل. افتح التحقق أو جرّب مرة ثانية');
                        }
                        title = $('h3.chapter-name').first().text().trim();
                        return [2, ('<div dir="rtl" lang="ar">\n' +
                                (title ? "<h2>".concat(escape(title), "</h2>\n") : '') +
                                paragraphs.join('\n') +
                                '\n</div>')];
                }
            });
        });
    };
    return RiwyatPlugin;
}());
exports.default = new RiwyatPlugin();

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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fetch_1 = require("@libs/fetch");
var cheerio_1 = require("cheerio");
var novelStatus_1 = require("@libs/novelStatus");
var FadaaRiwayatPlugin = (function () {
    function FadaaRiwayatPlugin() {
        this.id = 'fadaaRiwayat';
        this.name = 'فضاء الروايات';
        this.icon = 'src/ar/fadaariwayat/icon.png';
        this.site = 'https://cenele.com/';
        this.version = '1.0.0';
        this.imageRequestInit = {
            headers: { Referer: 'https://cenele.com/' },
        };
    }
    FadaaRiwayatPlugin.prototype.getHtml = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("HTTP ".concat(res.status, " \u2014 \u0627\u0641\u062A\u062D \u0627\u0644\u0645\u0648\u0642\u0639 \u0641\u064A WebView \u062B\u0645 \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649"));
                        return [4, res.text()];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.getPage = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4, this.getHtml(url)];
                    case 1: return [2, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.absolute = function (href) {
        if (!href)
            return '';
        try {
            return new URL(href, this.site).toString();
        }
        catch (_a) {
            return '';
        }
    };
    FadaaRiwayatPlugin.prototype.toPath = function (href) {
        return this.absolute(href).replace(/^https?:\/\/[^/]+\//, '');
    };
    FadaaRiwayatPlugin.prototype.parseNovelList = function ($) {
        var _this = this;
        var novels = [];
        var seen = {};
        var nodes = $('article.nhv-library-card');
        if (!nodes.length)
            nodes = $('div.page-item-detail');
        if (!nodes.length)
            nodes = $('div.c-tabs-item__content, div.page-listing-item');
        nodes.each(function (_, el) {
            var node = $(el);
            var a = node
                .find('.nhv-library-card__title a, div.post-title a, h3 a, h4 a')
                .first();
            var name = a.text().trim();
            var path = _this.toPath(a.attr('href'));
            if (!name || !path.startsWith('cont/') || seen[path])
                return;
            seen[path] = true;
            var img = node
                .find('.nhv-library-card__cover img, div.item-thumb img, div.tab-thumb img, img')
                .first();
            var cover = _this.absolute(img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src'));
            novels.push({ name: name, path: path, cover: cover });
        });
        return novels;
    };
    FadaaRiwayatPlugin.prototype.popularNovels = function (pageNo_1, _a) {
        return __awaiter(this, arguments, void 0, function (pageNo, _b) {
            var order, page, $;
            var showLatestNovels = _b.showLatestNovels;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        order = showLatestNovels ? 'latest' : 'views';
                        page = pageNo > 1 ? "page/".concat(pageNo, "/") : '';
                        return [4, this.getPage("".concat(this.site, "cont/").concat(page, "?m_orderby=").concat(order))];
                    case 1:
                        $ = _c.sent();
                        return [2, this.parseNovelList($)];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.searchNovels = function (searchTerm, pageNo) {
        return __awaiter(this, void 0, void 0, function () {
            var url, $;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.site, "?s=").concat(encodeURIComponent(searchTerm.trim())) +
                            "&post_type=wp-manga&paged=".concat(pageNo);
                        return [4, this.getPage(url)];
                    case 1:
                        $ = _a.sent();
                        return [2, this.parseNovelList($)];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.toStatus = function (text) {
        if (/مستمر|جاري|مستمرة/.test(text))
            return novelStatus_1.NovelStatus.Ongoing;
        if (/مكتمل|منتهي/.test(text))
            return novelStatus_1.NovelStatus.Completed;
        if (/متوقف/.test(text))
            return novelStatus_1.NovelStatus.OnHiatus;
        if (/ملغ/.test(text))
            return novelStatus_1.NovelStatus.Cancelled;
        return novelStatus_1.NovelStatus.Unknown;
    };
    FadaaRiwayatPlugin.prototype.parseNovel = function (novelPath) {
        return __awaiter(this, void 0, void 0, function () {
            var novelUrl, html, $, novel, img, summary, meta, chapters, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        novelUrl = this.site + novelPath;
                        return [4, this.getHtml(novelUrl)];
                    case 1:
                        html = _b.sent();
                        $ = (0, cheerio_1.load)(html);
                        novel = {
                            path: novelPath,
                            name: $('h1.nhv-novel-title').first().text().trim() ||
                                $('div.post-title h1').first().text().trim() ||
                                'Untitled',
                        };
                        img = $('div.nhv-novel-cover img, div.summary_image img').first();
                        novel.cover = this.absolute(img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src'));
                        summary = $('div.nhv-novel-synopsis p')
                            .map(function (_, p) { return $(p).text().trim(); })
                            .get()
                            .filter(Boolean)
                            .join('\n\n');
                        novel.summary = summary || $('div.nhv-novel-synopsis').text().trim();
                        meta = {};
                        $('div.nhv-novel-meta > div').each(function (_, el) {
                            var label = $(el).find('span').first().text().trim();
                            var value = $(el).find('strong').first().text().trim();
                            if (label && value)
                                meta[label] = value;
                        });
                        novel.author = meta['المؤلف'] || meta['الكاتب'] || '';
                        novel.artist = meta['المترجم'] || '';
                        novel.genres = $('div.nhv-novel-genres a')
                            .map(function (_, a) { return $(a).text().trim(); })
                            .get()
                            .filter(Boolean)
                            .join(',');
                        novel.status = this.toStatus($('div.nhv-novel-status strong').first().text().trim() || meta['الحالة'] || '');
                        chapters = [];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4, this.fetchAllChapters(html, novelUrl)];
                    case 3:
                        chapters = _b.sent();
                        return [3, 5];
                    case 4:
                        _a = _b.sent();
                        chapters = [];
                        return [3, 5];
                    case 5:
                        if (!chapters.length) {
                            chapters = this.parseChapterItems($, $('li.wp-manga-chapter')).reverse();
                        }
                        novel.chapters = chapters;
                        return [2, novel];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.parseChapterItems = function ($, items) {
        var _this = this;
        var chapters = [];
        items.each(function (_, el) {
            var li = $(el);
            var a = li.find('a').first();
            var path = _this.toPath(a.attr('href'));
            var full = a.text().replace(/\s+/g, ' ').trim();
            if (!path || !full)
                return;
            var title = li.find('.nhv-chapter-name').text().replace(/\s+/g, ' ').trim();
            var name = full;
            if (title && full.endsWith(title) && full.length > title.length) {
                name = "".concat(full.slice(0, -title.length).trim(), " - ").concat(title);
            }
            var num = full.match(/الفصل\s*(\d+(?:\.\d+)?)/);
            chapters.push({
                name: name,
                path: path,
                chapterNumber: num ? parseFloat(num[1]) : undefined,
                releaseTime: _this.parseDate(li.find('.chapter-release-date').text().trim()),
            });
        });
        return chapters;
    };
    FadaaRiwayatPlugin.prototype.parseDate = function (text) {
        var months = {
            'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3, 'ابريل': 3, 'مايو': 4,
            'يونيو': 5, 'يوليو': 6, 'أغسطس': 7, 'اغسطس': 7, 'سبتمبر': 8,
            'أكتوبر': 9, 'اكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11,
        };
        var m = text.match(/([؀-ۿ]+)\s+(\d{1,2}),?\s+(\d{4})/);
        if (m && months[m[1]] !== undefined) {
            return new Date(Date.UTC(+m[3], months[m[1]], +m[2])).toISOString();
        }
        return null;
    };
    FadaaRiwayatPlugin.prototype.fetchAllChapters = function (pageHtml, novelUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var cfg, postId, nonce, ajaxUrl, headers, encode, post, base, meta, volumes, chapters, seen, _i, volumes_1, vol, volume, page, more, data, $, items, _a, items_1, ch, prev, keyed;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        cfg = (pageHtml.match(/nhvNovelV2\s*=\s*(\{[^;]*\})/) || [])[1] || '';
                        postId = (cfg.match(/"postId"\s*:\s*"?(\d+)/) || [])[1];
                        nonce = (cfg.match(/"chaptersNonce"\s*:\s*"([^"]+)"/) || [])[1];
                        ajaxUrl = ((cfg.match(/"ajaxurl"\s*:\s*"([^"]+)"/) || [])[1] || '').replace(/\\\//g, '/') ||
                            "".concat(this.site, "wp-admin/admin-ajax.php");
                        if (!postId || !nonce)
                            return [2, []];
                        headers = {
                            'Origin': 'https://cenele.com',
                            'Referer': novelUrl,
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'X-Requested-With': 'XMLHttpRequest',
                        };
                        encode = function (obj) {
                            return Object.keys(obj)
                                .map(function (k) { return "".concat(encodeURIComponent(k), "=").concat(encodeURIComponent(String(obj[k]))); })
                                .join('&');
                        };
                        post = function (params_1) {
                            var args_1 = [];
                            for (var _i = 1; _i < arguments.length; _i++) {
                                args_1[_i - 1] = arguments[_i];
                            }
                            return __awaiter(_this, __spreadArray([params_1], args_1, true), void 0, function (params, retried) {
                                var res, fr, fresh, _a, _b, data, _c, _d;
                                var _e;
                                if (retried === void 0) { retried = false; }
                                return __generator(this, function (_f) {
                                    switch (_f.label) {
                                        case 0: return [4, (0, fetch_1.fetchApi)(ajaxUrl, {
                                                method: 'POST',
                                                headers: headers,
                                                body: encode(__assign(__assign({}, params), { nonce: nonce })),
                                            })];
                                        case 1:
                                            res = _f.sent();
                                            if (!(res.status === 403 && !retried)) return [3, 4];
                                            return [4, (0, fetch_1.fetchApi)(ajaxUrl, {
                                                    method: 'POST',
                                                    headers: headers,
                                                    body: encode({ action: 'nhv_refresh_front_nonces' }),
                                                })];
                                        case 2:
                                            fr = _f.sent();
                                            _b = (_a = JSON).parse;
                                            return [4, fr.text()];
                                        case 3:
                                            fresh = _b.apply(_a, [(_f.sent()) || '{}']);
                                            if ((fresh === null || fresh === void 0 ? void 0 : fresh.success) && ((_e = fresh.data) === null || _e === void 0 ? void 0 : _e.chapters_nonce))
                                                nonce = fresh.data.chapters_nonce;
                                            return [2, post(params, true)];
                                        case 4:
                                            _d = (_c = JSON).parse;
                                            return [4, res.text()];
                                        case 5:
                                            data = _d.apply(_c, [(_f.sent()) || '{}']);
                                            if (!data || !data.success)
                                                throw new Error('chapters_failed');
                                            return [2, data];
                                    }
                                });
                            });
                        };
                        base = {
                            action: 'nhv_manga_single_chapters_page',
                            manga_id: postId,
                            per_page: 50,
                            order: 'asc',
                        };
                        return [4, post(__assign(__assign({}, base), { volume: -1, page: 1, meta_only: 1 }))];
                    case 1:
                        meta = _b.sent();
                        volumes = Array.isArray(meta.volumes) ? meta.volumes : [];
                        if (!volumes.length)
                            return [2, []];
                        chapters = [];
                        seen = {};
                        _i = 0, volumes_1 = volumes;
                        _b.label = 2;
                    case 2:
                        if (!(_i < volumes_1.length)) return [3, 6];
                        vol = volumes_1[_i];
                        volume = parseInt(String(vol.num || 0), 10);
                        page = 1;
                        more = true;
                        _b.label = 3;
                    case 3:
                        if (!(more && page <= 200)) return [3, 5];
                        return [4, post(__assign(__assign({}, base), { volume: volume, page: page }))];
                    case 4:
                        data = _b.sent();
                        $ = (0, cheerio_1.load)(data.html || '');
                        items = this.parseChapterItems($, $('li.wp-manga-chapter'));
                        for (_a = 0, items_1 = items; _a < items_1.length; _a++) {
                            ch = items_1[_a];
                            if (seen[ch.path])
                                continue;
                            seen[ch.path] = true;
                            chapters.push(ch);
                        }
                        more = !!data.has_more && items.length > 0;
                        page++;
                        return [3, 3];
                    case 5:
                        _i++;
                        return [3, 2];
                    case 6:
                        prev = -1;
                        keyed = chapters.map(function (ch, i) {
                            var key = ch.chapterNumber !== undefined && !isNaN(ch.chapterNumber) ? ch.chapterNumber : prev + 0.0001;
                            prev = key;
                            return { ch: ch, key: key, i: i };
                        });
                        keyed.sort(function (a, b) { return a.key - b.key || a.i - b.i; });
                        return [2, keyed.map(function (k) { return k.ch; })];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, void 0, function () {
            var $, title, reading, escape, paragraphs, heading;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.getPage(this.site + chapterPath)];
                    case 1:
                        $ = _a.sent();
                        title = $('h3.chapter-name').first().text().replace(/\s+/g, ' ').trim();
                        reading = $('div.reading-content').first();
                        escape = function (s) {
                            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        };
                        paragraphs = [];
                        reading.find('p').each(function (_, el) {
                            var p = $(el);
                            if (p.closest('aside, .nhv-reader-promo, script, style').length)
                                return;
                            p.find('br').replaceWith('\n');
                            var text = p
                                .text()
                                .replace(/ /g, ' ')
                                .split('\n')
                                .map(function (line) { return line.replace(/\s+/g, ' ').trim(); })
                                .join('\n')
                                .trim();
                            if (text)
                                paragraphs.push("<p>".concat(escape(text).replace(/\n/g, '<br>'), "</p>"));
                        });
                        heading = title ? "<h2>".concat(escape(title), "</h2>\n") : '';
                        return [2, ('<div dir="rtl" lang="ar" style="direction: rtl; text-align: right;">\n' +
                                heading +
                                paragraphs.join('\n') +
                                '\n</div>')];
                }
            });
        });
    };
    return FadaaRiwayatPlugin;
}());
exports.default = new FadaaRiwayatPlugin();

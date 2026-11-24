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
var FadaaRiwayatPlugin = (function () {
    function FadaaRiwayatPlugin() {
        this.id = 'fadaaRiwayat';
        this.name = 'فضاء الروايات';
        this.icon = 'src/ar/fadaariwayat/icon.png';
        this.site = 'https://cenele.com/';
        this.version = '1.0.7';
        this.imageRequestInit = {
            headers: { Referer: 'https://cenele.com/' },
        };
        this.userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
        this.paragraphStyle = 'margin: 0 0 0.9em 0; text-indent: 0;';
        this.quickWaits = [2000, 4000, 8000];
        this.gateWaits = [15000, 30000, 60000, 120000];
        this.gateMessage = 'الموقع طلب تحقق «لست روبوت» بدل الفصل';
        this.holdingBack = false;
    }
    FadaaRiwayatPlugin.prototype.getHtml = function (url) {
        return __awaiter(this, void 0, Promise, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, (0, fetch_1.fetchApi)(url, { headers: { 'User-Agent': this.userAgent } })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("\u0627\u0644\u0645\u0648\u0642\u0639 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628 (HTTP ".concat(res.status, ")"));
                        return [4, res.text()];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.getPage = function (url) {
        return __awaiter(this, void 0, Promise, function () {
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
        return __awaiter(this, arguments, Promise, function (pageNo, _b) {
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
        return __awaiter(this, void 0, Promise, function () {
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
        return __awaiter(this, void 0, Promise, function () {
            var novelUrl, html, $, novel, img, summary, meta, latest, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        novelUrl = this.site + novelPath;
                        return [4, this.getHtml(novelUrl)];
                    case 1:
                        html = _a.sent();
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
                        latest = this.parseChapterItems($, $('li.wp-manga-chapter'));
                        return [4, this.fetchAllChapters(html, novelUrl)];
                    case 2:
                        result = _a.sent();
                        novel.chapters = this.sortChapters(result.chapters.concat(latest));
                        if (result.error) {
                            novel.summary =
                                "\u26A0\uFE0F \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0641\u0635\u0648\u0644 \u0646\u0627\u0642\u0635\u0629 (".concat(novel.chapters.length, " \u0641\u0635\u0644): ").concat(result.error, "\n\n") +
                                    (novel.summary || '');
                        }
                        return [2, novel];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.sortChapters = function (list) {
        var seen = {};
        var unique = list.filter(function (ch) { return (seen[ch.path] ? false : (seen[ch.path] = true)); });
        var prev = -1;
        var keyed = unique.map(function (ch, i) {
            var key = ch.chapterNumber !== undefined && !isNaN(ch.chapterNumber) ? ch.chapterNumber : prev + 0.0001;
            prev = key;
            return { ch: ch, key: key, i: i };
        });
        keyed.sort(function (a, b) { return a.key - b.key || a.i - b.i; });
        return keyed.map(function (k) { return k.ch; });
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
        return __awaiter(this, void 0, Promise, function () {
            var chapters, step, postId, nonce, ajaxUrl, result, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chapters = [];
                        step = 'قراءة إعدادات الصفحة';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        postId = (pageHtml.match(/"postId"\s*:\s*"?(\d+)/) || [])[1] ||
                            (pageHtml.match(/\bpostid-(\d+)\b/) || [])[1];
                        nonce = (pageHtml.match(/"chaptersNonce"\s*:\s*"([^"]+)"/) || [])[1];
                        ajaxUrl = ((pageHtml.match(/"ajaxurl"\s*:\s*"([^"]+)"/) || [])[1] || '').replace(/\\\//g, '/') ||
                            "".concat(this.site, "wp-admin/admin-ajax.php");
                        if (!postId)
                            return [2, { chapters: chapters, error: 'ما لقيت رقم الرواية في الصفحة' }];
                        return [4, this.loadVolumes(postId, nonce, ajaxUrl, novelUrl, chapters, function (s) { return (step = s); })];
                    case 2:
                        result = _a.sent();
                        return [2, { chapters: chapters, error: result }];
                    case 3:
                        e_1 = _a.sent();
                        return [2, { chapters: chapters, error: "".concat(step, ": ").concat((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || e_1) }];
                    case 4: return [2];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.sleep = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    FadaaRiwayatPlugin.prototype.loadVolumes = function (postId, initialNonce, ajaxUrl, novelUrl, chapters, setStep) {
        return __awaiter(this, void 0, Promise, function () {
            var nonce, headers, encode, postOnce, describe, refreshNonce, post, base, meta, volumes, _i, volumes_1, vol, volume, page, more, data, $, items, _a, items_1, ch;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        nonce = initialNonce || '';
                        headers = {
                            'User-Agent': this.userAgent,
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
                        postOnce = function (body) { return __awaiter(_this, void 0, Promise, function () {
                            var res, text;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4, (0, fetch_1.fetchApi)(ajaxUrl, { method: 'POST', headers: headers, body: body })];
                                    case 1:
                                        res = _a.sent();
                                        return [4, res.text()];
                                    case 2:
                                        text = (_a.sent()) || '';
                                        try {
                                            return [2, { status: res.status, data: JSON.parse(text), text: text }];
                                        }
                                        catch (_b) {
                                            return [2, { status: res.status, text: text }];
                                        }
                                        return [2];
                                }
                            });
                        }); };
                        describe = function (r) {
                            return "HTTP ".concat(r.status, " \u2014 ").concat(r.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80));
                        };
                        refreshNonce = function () { return __awaiter(_this, void 0, void 0, function () {
                            var r;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4, postOnce(encode({ action: 'nhv_refresh_front_nonces' }))];
                                    case 1:
                                        r = _c.sent();
                                        if (((_a = r.data) === null || _a === void 0 ? void 0 : _a.success) && ((_b = r.data.data) === null || _b === void 0 ? void 0 : _b.chapters_nonce))
                                            nonce = r.data.data.chapters_nonce;
                                        return [2];
                                }
                            });
                        }); };
                        post = function (params) { return __awaiter(_this, void 0, Promise, function () {
                            var last, attempt, r, e_2;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        last = { status: 0, text: '' };
                                        attempt = 0;
                                        _c.label = 1;
                                    case 1:
                                        if (!(attempt < 3)) return [3, 9];
                                        if (!(attempt > 0)) return [3, 3];
                                        return [4, this.sleep(1500 * attempt)];
                                    case 2:
                                        _c.sent();
                                        _c.label = 3;
                                    case 3:
                                        _c.trys.push([3, 7, , 8]);
                                        return [4, postOnce(encode(__assign(__assign({}, params), { nonce: nonce })))];
                                    case 4:
                                        r = _c.sent();
                                        if (r.status === 200 && ((_a = r.data) === null || _a === void 0 ? void 0 : _a.success))
                                            return [2, r.data];
                                        last = r;
                                        if (!(r.status === 403 || ((_b = r.data) === null || _b === void 0 ? void 0 : _b.success) === false)) return [3, 6];
                                        return [4, refreshNonce()];
                                    case 5:
                                        _c.sent();
                                        _c.label = 6;
                                    case 6: return [3, 8];
                                    case 7:
                                        e_2 = _c.sent();
                                        last = { status: 0, text: String((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || e_2) };
                                        return [3, 8];
                                    case 8:
                                        attempt++;
                                        return [3, 1];
                                    case 9: throw new Error(describe(last));
                                }
                            });
                        }); };
                        base = {
                            action: 'nhv_manga_single_chapters_page',
                            manga_id: postId,
                            per_page: 50,
                            order: 'asc',
                        };
                        if (!!nonce) return [3, 2];
                        setStep('جلب رمز الطلب');
                        return [4, refreshNonce()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        setStep('قائمة المجلدات');
                        return [4, post(__assign(__assign({}, base), { volume: -1, page: 1, meta_only: 1 }))];
                    case 3:
                        meta = _b.sent();
                        volumes = Array.isArray(meta.volumes) ? meta.volumes : [];
                        if (!volumes.length)
                            return [2, 'الموقع رجّع قائمة مجلدات فاضية'];
                        _i = 0, volumes_1 = volumes;
                        _b.label = 4;
                    case 4:
                        if (!(_i < volumes_1.length)) return [3, 8];
                        vol = volumes_1[_i];
                        volume = parseInt(String(vol.num || 0), 10);
                        page = 1;
                        more = true;
                        _b.label = 5;
                    case 5:
                        if (!(more && page <= 200)) return [3, 7];
                        setStep("".concat(vol.label || "\u0627\u0644\u0645\u062C\u0644\u062F ".concat(volume), "\u060C \u0627\u0644\u0635\u0641\u062D\u0629 ").concat(page));
                        return [4, post(__assign(__assign({}, base), { volume: volume, page: page }))];
                    case 6:
                        data = _b.sent();
                        $ = (0, cheerio_1.load)(data.html || '');
                        items = this.parseChapterItems($, $('li.wp-manga-chapter'));
                        for (_a = 0, items_1 = items; _a < items_1.length; _a++) {
                            ch = items_1[_a];
                            chapters.push(ch);
                        }
                        more = !!data.has_more && items.length > 0;
                        page++;
                        return [3, 5];
                    case 7:
                        _i++;
                        return [3, 4];
                    case 8: return [2, undefined];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, Promise, function () {
            var quick, gate, html, e_3, isGate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        quick = 0;
                        gate = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 8]);
                        return [4, this.readChapter(chapterPath)];
                    case 2:
                        html = _a.sent();
                        this.holdingBack = false;
                        return [2, html];
                    case 3:
                        e_3 = _a.sent();
                        isGate = e_3 instanceof Error && e_3.message === this.gateMessage;
                        if (!isGate) return [3, 5];
                        if (this.holdingBack || gate >= this.gateWaits.length) {
                            this.holdingBack = true;
                            throw e_3;
                        }
                        return [4, this.sleep(this.gateWaits[gate++])];
                    case 4:
                        _a.sent();
                        return [3, 7];
                    case 5:
                        if (quick >= this.quickWaits.length)
                            throw e_3;
                        return [4, this.sleep(this.quickWaits[quick++])];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [3, 8];
                    case 8: return [3, 1];
                    case 9: return [2];
                }
            });
        });
    };
    FadaaRiwayatPlugin.prototype.readChapter = function (chapterPath) {
        return __awaiter(this, void 0, Promise, function () {
            var $, title, reading, escape, paragraphs, heading;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.getPage(this.site + chapterPath)];
                    case 1:
                        $ = _a.sent();
                        if ($('.nhv-ts-gate').length) {
                            throw new Error(this.gateMessage);
                        }
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
                            if (text) {
                                for (var _i = 0, _a = text.split('\n'); _i < _a.length; _i++) {
                                    var line = _a[_i];
                                    if (line.trim())
                                        paragraphs.push("<p style=\"".concat(_this.paragraphStyle, "\">").concat(escape(line.trim()), "</p>"));
                                }
                            }
                        });
                        if (!paragraphs.length) {
                            throw new Error('ما وصل نص الفصل من الموقع، جرب تحمّله مرة ثانية بعد شوي');
                        }
                        heading = title
                            ? "<h2 style=\"margin: 0 0 1.2em 0;\">".concat(escape(title), "</h2>\n")
                            : '';
                        return [2, ('<div dir="rtl" lang="ar" style="direction: rtl;">\n' +
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

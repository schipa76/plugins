(function () {
    'use strict';

    // Плагин для Lampa: страница фильма как в Cardify.
    //  - убирает карточку-постер слева;
    //  - контент внизу экрана, фон на весь экран, без затемнения;
    //  - порядок: название -> слоган -> год и страна -> время и жанр -> кнопки,
    //    рейтинги, возрастной ценз и статус - справа внизу;
    //  - трейлер фоном (YouTube или Rutube). Если трейлера нет, остаётся обычный фон.
    // Настройки: Настройки -> "Страница фильма".

    if (window.fullscreen_card_plugin) return;
    window.fullscreen_card_plugin = true;

    var LAYER_ID = 'trailer-bg-layer';
    var timer = null;
    var watcher = null;
    var token = 0;
    var ytReachable = null; // кэш проверки YouTube

    function opt(name, def) {
        try {
            var v = Lampa.Storage.field(name);
            return (v === undefined || v === null || v === '') ? def : v;
        } catch (e) {
            return def;
        }
    }

    // =====================================================================
    //  ЧАСТЬ 1. Оформление страницы фильма
    // =====================================================================

    // подсказки о работе трейлера: шаги собираются в одно сообщение на экране
    // (можно выключить в настройках)
    var dbgLog = [];
    var dbgTimer = null;

    function dbgReset() {
        dbgLog = [];
        clearTimeout(dbgTimer);
    }

    function dbg(msg) {
        try {
            if (!opt('trailer_bg_debug', false)) return;

            dbgLog.push(msg);
            clearTimeout(dbgTimer);

            // ждём, пока закончатся шаги, и показываем всё сразу
            dbgTimer = setTimeout(function () {
                var text = 'Трейлер: ' + dbgLog.join(' → ');
                dbgLog = [];

                try {
                    Lampa.Noty.show(text, { time: 12000 });
                } catch (e) {
                    Lampa.Noty.show(text);
                }
            }, 2500);
        } catch (e) {}
    }

    function apply() {
        $('body')
            .toggleClass('fsc-nofposter', !!opt('fsc_hide_poster', true))
            .toggleClass('fsc-bottom', !!opt('fsc_bottom', true))
            .toggleClass('fsc-layout', !!opt('fsc_layout', true))
            .toggleClass('fsc-main-btns', !!opt('fsc_main_buttons', true))
            .toggleClass('fsc-labels', !!opt('fsc_labels', true))
            .toggleClass('fsc-nosource', !!opt('fsc_hide_source', true))
            .toggleClass('fsc-blue', !!opt('fsc_blue_progress', true))
            .toggleClass('fsc-torrent', !!opt('fsc_torrent_layout', true));
    }

    // помечаем блок с годом и страной ("2026, Великобритания | США"),
    // чтобы его можно было переставить под название
    function tagYear(render) {
        try {
            var right = render.find('.full-start-new__right, .full-start__right').first();
            right.children().each(function () {
                var el = $(this);
                var cls = el.attr('class') || '';
                if (cls.indexOf('title') !== -1 || cls.indexOf('rate') !== -1 || cls.indexOf('button') !== -1) return;
                if (/^\s*\d{4}\s*[,|]/.test(el.text())) el.addClass('fsc-year');
            });
        } catch (e) {}
    }

    function addStyles() {
        $('head').append(
            '<style id="fsc-style">' +

            // --- убираем постер (новый и старый вид карточки) ---
            'body.fsc-nofposter .full-start-new__left,' +
            'body.fsc-nofposter .full-start__left,' +
            'body.fsc-nofposter .full-start-new__poster,' +
            'body.fsc-nofposter .full-start__poster{display:none !important;}' +

            'body.fsc-nofposter .full-start-new__right,' +
            'body.fsc-nofposter .full-start__right{margin-left:0 !important;}' +

            'body.fsc-nofposter .full-start-new__body,' +
            'body.fsc-nofposter .full-start__body{padding-left:1.5em;}' +

            // --- контент внизу экрана ---
            'body.fsc-bottom .full-start-new__body,' +
            'body.fsc-bottom .full-start__body{' +
                'min-height:calc(100vh - 8em);' +
                'align-items:flex-end !important;' +
            '}' +

            // --- порядок блоков как в Cardify ---
            'body.fsc-layout .full-start-new__body{position:relative !important;}' +

            'body.fsc-layout .full-start-new__right{' +
                'position:static !important;' +
                'display:flex !important;' +
                'flex-direction:column !important;' +
                'align-items:flex-start !important;' +
            '}' +

            'body.fsc-layout .full-start-new__right > *{order:6 !important;}' +
            'body.fsc-layout .full-start-new__right > .full-start-new__title{order:1 !important;}' +
            'body.fsc-layout .full-start-new__right > .full-start-new__head,' +
            'body.fsc-layout .full-start-new__right > .fsc-year{order:3 !important;margin:.4em 0 .3em 0 !important;}' +
            'body.fsc-layout .full-start-new__right > .full-start-new__tagline{order:2 !important;}' +
            'body.fsc-layout .full-start-new__right > .full-start-new__details{order:4 !important;}' +
            'body.fsc-layout .full-start-new__right > .full-start-new__buttons{order:5 !important;}' +

            'body.fsc-layout .full-start-new__right > .full-start-new__rate-line{' +
                'position:absolute !important;' +
                'right:0;' +
                'bottom:1em;' +
                'margin:0 !important;' +
                'order:7 !important;' +
            '}' +

            // --- из UI Style: оригинальное название над основным ---
            '.full-start-new__title-original{font-size:1.6em;margin-bottom:0;}' +
            'body.fsc-layout .full-start-new__right > .fsc-orig{order:0 !important;}' +

            // --- из UI Style: подписи на всех кнопках, не только на выбранной ---
            'body.fsc-labels .full-start-new__buttons .full-start__button:not(.focus) span{display:unset;}' +

            // --- из UI Style: скрыть названия источников ---
            'body.fsc-nosource .source--name{display:none;}' +

            // --- из UI Style: синяя полоска прогресса просмотра ---
            'body.fsc-blue .time-line > div{background-color:#3498DB;}' +
            'body.fsc-blue .torrent-serial .time-line{width:stretch;top:unset;bottom:0;left:unset;}' +

            // --- из UI Style: компактная строка с деталями у торрентов ---
            'body.fsc-torrent .torrent-item__ffprobe > .m-general + div,' +
            'body.fsc-torrent .torrent-item__ffprobe > div:not(.m-channels):not(.m-audio) + .m-channels,' +
            'body.fsc-torrent .torrent-item__ffprobe > div:not(.m-channels):not(.m-audio) + .m-audio,' +
            'body.fsc-torrent .torrent-item__ffprobe > div:not(.m-subtitle) + .m-subtitle{clear:both;}' +
            '@media screen and (min-width:768px){' +
                'body.fsc-torrent .torrent-item__details{flex-wrap:wrap;}' +
                'body.fsc-torrent .torrent-item__tracker{order:1;}' +
                'body.fsc-torrent .torrent-item__seeds{order:2;}' +
                'body.fsc-torrent .torrent-item__grabs{order:3;margin-right:0;}' +
                'body.fsc-torrent .torrent-item__details::after{content:"";order:4;flex-basis:100%;margin-top:.4em;}' +
                'body.fsc-torrent .torrent-item__date{order:5;margin-right:auto;}' +
                'body.fsc-torrent .torrent-item__bitrate{order:6;margin-right:0;}' +
                'body.fsc-torrent .torrent-item__size{order:7;margin-left:1em;}' +
            '}' +

            // --- редактор кнопок: скрытые кнопки ---
            '.fsc-btn-hide{display:none !important;}' +

            // --- редактор кнопок: выбор иконки ---
            '.fsc-icon-grid{display:flex;flex-wrap:wrap;justify-content:center;}' +
            '.fsc-icon-item{width:4em;height:4em;margin:.3em;display:flex;align-items:center;justify-content:center;border-radius:.3em;cursor:pointer;}' +
            '.fsc-icon-item.focus{background:rgba(255,255,255,.2);}' +
            '.fsc-icon-item svg{width:1.8em;height:1.8em;}' +
            '.fsc-icon-reset{width:100%;height:auto;padding:.8em;margin:.5em .3em;background:rgba(200,80,80,.5);font-size:1.2em;}' +

            // --- слой с трейлером (без затемнения) ---
            '.trailer-bg{position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;opacity:0;transition:opacity 1s ease;}' +
            '.trailer-bg--ready{opacity:1;}' +
            '.trailer-bg__frame{position:absolute;top:50%;left:50%;width:100vw;height:56.25vw;min-height:100vh;min-width:177.78vh;transform:translate(-50%,-50%);}' +
            '.trailer-bg__frame iframe{width:100%;height:100%;border:0;}' +
            '.trailer-bg__frame video{width:100%;height:100%;object-fit:cover;background:#000;transform-origin:50% 50%;transition:transform .8s ease;}' +
            '.trailer-bg video::-webkit-media-controls,.trailer-bg video::-webkit-media-controls-start-playback-button,.trailer-bg video::-webkit-media-controls-overlay-play-button{display:none !important;-webkit-appearance:none;opacity:0;}' +
            '.fsc-bg-hidden{opacity:0 !important;transition:opacity .6s ease;}' +
            // фон карточки: свою картинку карточки прячем, показываем общий фон Lampa на весь экран
            'body.fsc-card-bg .full-start__background{opacity:0 !important;transition:none !important;}' +
            'body.fsc-card-bg .background{opacity:1 !important;visibility:visible !important;}' +
            '.fsc-nograd{background-image:none !important;}' +
            '.fsc-nomask{-webkit-mask-image:none !important;mask-image:none !important;}' +
            '.fsc-nobefore::before{background:none !important;background-image:none !important;}' +
            '.fsc-noafter::after{background:none !important;background-image:none !important;}' +
            // лишние кнопки скрываются сразу, ещё до того как их уберёт скрипт
            'body.fsc-main-btns .full-start-new__buttons .full-start__button:not(.view--online):not(.view--torrent):not(.button--book){display:none !important;}' +
            '.fsc-bg-clear{background-image:none !important;}' +

            '</style>'
        );
    }

    // =====================================================================
    //  ЧАСТЬ 2. Трейлер на фоне
    // =====================================================================

    // ---------- проверка доступности YouTube ----------

    function checkYouTube(cb) {
        if (ytReachable !== null) return cb(ytReachable);

        var done = false;
        var img = new Image();

        function finish(v) {
            if (done) return;
            done = true;
            clearTimeout(t);
            ytReachable = v;
            cb(v);
        }

        var t = setTimeout(function () { finish(false); }, 3500);

        // YouTube считается доступным, только если открываются оба адреса:
        // картинки (i.ytimg.com) и сам youtube.com, с которого грузится плеер
        var ok = 0;
        function one(src) {
            var im = new Image();
            im.onload = function () {
                ok++;
                if (ok >= 2) finish(true);
            };
            im.onerror = function () { finish(false); };
            im.src = src + (src.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
        }

        one('https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg');
        one('https://www.youtube.com/favicon.ico');
    }

    function resolveSource(cb) {
        var s = String(opt('trailer_bg_source', 'auto'));
        if (s === 'youtube' || s === 'rutube') {
            dbg('источник ' + (s === 'youtube' ? 'YouTube' : 'Rutube'));
            return cb(s);
        }
        checkYouTube(function (ok) {
            dbg(ok ? 'YouTube доступен, беру его' : 'YouTube недоступен, беру Rutube');
            cb(ok ? 'youtube' : 'rutube');
        });
    }

    // ---------- YouTube: трейлер через TMDB ----------

    function pickYouTube(list) {
        if (!list || !list.length) return null;

        var yt = list.filter(function (v) {
            return v.site === 'YouTube' && v.key;
        });
        var trailers = yt.filter(function (v) {
            return v.type === 'Trailer';
        });
        var pool = trailers.length ? trailers : yt;
        if (!pool.length) return null;

        var lang = Lampa.Storage.get('language', 'ru');
        var own = pool.filter(function (v) {
            return v.iso_639_1 === lang;
        });
        pool = own.length ? own : pool;

        pool.sort(function (a, b) {
            return (b.official ? 1 : 0) - (a.official ? 1 : 0);
        });

        return pool[0].key;
    }

    function loadYouTube(card, method, data, cb) {
        // видео могут лежать в данных карточки в разных местах
        var inline = (data && data.videos && data.videos.results) ||
            (card && card.videos && card.videos.results) || [];

        dbg('YouTube: в карточке видео ' + inline.length);

        var found = pickYouTube(inline);
        if (found) return cb(found);

        var type = method || ((card.first_air_date && !card.title) ? 'tv' : 'movie');
        var langs = ['ru-RU', 'en-US'];

        function next(i) {
            if (i >= langs.length) return cb(null);

            var url;
            try {
                url = Lampa.TMDB.api(type + '/' + card.id + '/videos?api_key=' + Lampa.TMDB.key() + '&language=' + langs[i]);
            } catch (err) {
                dbg('YouTube: нет доступа к TMDB (' + err + ')');
                return cb(null);
            }

            fetch(url)
                .then(function (r) { return r.json(); })
                .then(function (json) {
                    var list = (json && json.results) || [];
                    dbg('YouTube: TMDB ' + langs[i] + ', видео ' + list.length);

                    var key = pickYouTube(list);
                    if (key) cb(key);
                    else next(i + 1);
                })
                .catch(function (err) {
                    dbg('YouTube: запрос TMDB не сработал (' + err + ')');
                    next(i + 1);
                });
        }

        next(0);
    }

    // ---------- Rutube: поиск трейлера по названию ----------

    // Запрос несколькими способами подряд (JSON или текст). Браузер часто блокирует
    // запросы к чужим сайтам (CORS), поэтому сначала пробуем сетевой модуль самой Lampa
    // (на Android он ходит в обход этого ограничения), потом обычный fetch.
    function errText(e) {
        if (!e) return 'ошибка';
        if (typeof e === 'string') return e;
        if (e.message) return e.message;
        if (e.status !== undefined) return 'HTTP ' + e.status;
        return String(e);
    }

    function httpGet(url, asText, cb) {
        var errors = [];
        var tries = [];
        var params = asText ? { dataType: 'text' } : undefined;

        var proxy = String(opt('trailer_bg_proxy', '') || '').replace(/^\s+|\s+$/g, '');

        try {
            if (window.Lampa && Lampa.Reguest) {
                tries.push({
                    name: 'native',
                    run: function (ok, fail) {
                        var n = new Lampa.Reguest();
                        if (typeof n.native !== 'function') return fail('нет native');
                        n.native(url, ok, fail, false, params);
                    }
                });

                tries.push({
                    name: 'lampa',
                    run: function (ok, fail) {
                        new Lampa.Reguest().silent(url, ok, fail, false, params);
                    }
                });
            }
        } catch (e) {}

        function viaFetch(u) {
            return function (ok, fail) {
                fetch(u)
                    .then(function (r) { return asText ? r.text() : r.json(); })
                    .then(ok)
                    .catch(fail);
            };
        }

        tries.push({ name: 'fetch', run: viaFetch(url) });

        // свой прокси из настроек (необязательно): адрес дописывается перед ссылкой
        if (proxy) tries.push({ name: 'прокси', run: viaFetch(proxy + url) });

        function next(i) {
            if (i >= tries.length) return cb(errors.join('; '), null);

            var t = tries[i];
            var done = false;

            function finish(data, err) {
                if (done) return;
                done = true;
                clearTimeout(guard);

                var value = data;
                if (!err && !asText && typeof data === 'string') {
                    try { value = JSON.parse(data); } catch (e) { value = null; }
                }

                var good = !err && (asText
                    ? (typeof value === 'string' && value.length > 0)
                    : (value && typeof value === 'object'));

                if (good) return cb(null, value, t.name);

                errors.push(t.name + ': ' + (err ? errText(err) : 'пустой ответ'));
                next(i + 1);
            }

            var guard = setTimeout(function () { finish(null, 'таймаут'); }, 8000);

            try {
                t.run(function (d) { finish(d); }, function (e) { finish(null, e || 'ошибка'); });
            } catch (e) {
                finish(null, e);
            }
        }

        next(0);
    }

    function httpJson(url, cb) { httpGet(url, false, cb); }
    function httpText(url, cb) { httpGet(url, true, cb); }

    // приводим название к простому виду: без регистра, знаков и буквы "ё"
    function norm(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-zа-я0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^ | $/g, '');
    }

    function loadRutube(card, cb) {
        var titleRu = card.title || card.name || '';
        var titleOrig = card.original_title || card.original_name || '';
        var title = titleRu || titleOrig;
        if (!title) return cb(null);

        var date = card.release_date || card.first_air_date || '';
        var year = date ? String(date).slice(0, 4) : '';
        var query = title + ' ' + year + ' трейлер';
        var url = 'https://rutube.ru/api/search/video/?format=json&query=' + encodeURIComponent(query);

        var names = [norm(titleRu), norm(titleOrig)].filter(function (x) { return x.length > 1; });

        httpJson(url, function (err, json, via) {
            if (err) {
                dbg('Rutube: поиск не сработал (' + err + ')');
                return cb(null);
            }

            (function () {
                var list = (json && json.results) || [];
                var best = null;

                dbg('Rutube: результатов ' + list.length + ' (' + via + ')');

                for (var i = 0; i < list.length; i++) {
                    var it = list[i];
                    var raw = String(it.title || '');
                    var t = norm(raw);
                    var dur = parseInt(it.duration, 10) || 0;

                    var isTrailer = /трейлер|trailer|тизер|teaser/.test(t);
                    var hasTitle = names.some(function (n) { return t.indexOf(n) !== -1; });
                    // если длительность не пришла, не отбрасываем ролик
                    var okLen = dur === 0 || (dur >= 20 && dur <= 360);

                    if (isTrailer && hasTitle && okLen) {
                        best = it;
                        break;
                    }
                }

                if (!best) {
                    // показываем, что именно нашлось, чтобы понять причину
                    var sample = list.slice(0, 3).map(function (it) {
                        return '«' + String(it.title || '?').slice(0, 30) + '» ' + (it.duration || '?') + 'с';
                    }).join('; ');
                    dbg('Rutube: подходящего нет' + (sample ? ' (' + sample + ')' : ''));
                    return cb(null);
                }

                dbg('Rutube: выбрал «' + String(best.title).slice(0, 40) + '»');

                var id = best.id || String(best.video_url || '').split('/').filter(Boolean).pop();
                cb(id || null);
            })();
        });
    }

    // ---------- слой с видео ----------

    function buildSrc(source, id, sound) {
        if (source === 'rutube') {
            return 'https://rutube.ru/play/embed/' + id + '/?autoplay=true&skinColor=000000';
        }

        return 'https://www.youtube.com/embed/' + id +
            '?autoplay=1&mute=' + (sound ? 0 : 1) +
            '&controls=0&loop=1&playlist=' + id +
            '&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&disablekb=1&fs=0';
    }

    function showIframe(source, id) {
        var sound = opt('trailer_bg_sound', false);

        var layer = $(
            '<div id="' + LAYER_ID + '" class="trailer-bg">' +
                '<div class="trailer-bg__frame">' +
                    '<iframe src="' + buildSrc(source, id, sound) + '" allow="autoplay; encrypted-media" frameborder="0" tabindex="-1"></iframe>' +
                '</div>' +
            '</div>'
        );

        // вставляем рядом с фоном Lampa, чтобы интерфейс остался поверх видео
        var bg = $('.background').first();
        if (bg.length) bg.after(layer);
        else $('body').prepend(layer);

        var frame = layer.find('iframe');

        frame.on('load', function () {
            // Rutube: пробуем выключить звук командами плеера (работа не гарантируется)
            if (source === 'rutube' && !sound) {
                [800, 2000, 3500].forEach(function (ms) {
                    setTimeout(function () {
                        try {
                            var w = frame[0] && frame[0].contentWindow;
                            if (!w) return;
                            w.postMessage(JSON.stringify({ type: 'player:mute', data: {} }), '*');
                            w.postMessage(JSON.stringify({ type: 'player:setVolume', data: { volume: 0 } }), '*');
                        } catch (e) {}
                    }, ms);
                });
            }

            // плавно показываем, когда видео успело стартовать
            setTimeout(function () {
                layer.addClass('trailer-bg--ready');
                hideBackdrop();
            }, source === 'rutube' ? 3500 : 2500);
        });
    }

    // ---------- Rutube без рекламы: прямой поток в обычном <video> ----------

    // Пока играет трейлер, прячем крупную картинку фона (постер/бэкдроп карточки),
    // иначе она закрывает видео. Классы элементов заранее неизвестны, поэтому ищем
    // по размеру: изображение или фон-картинка шириной от трети экрана и высотой от половины.
    var hiddenBackdrops = [];

    function restoreBackdrop() {
        try {
            $(hiddenBackdrops).removeClass('fsc-bg-hidden fsc-bg-clear');
        } catch (e) {}
        hiddenBackdrops = [];
    }

    function hideBackdrop() {
        try {
            if (!opt('trailer_bg_hide_backdrop', true)) return;

            restoreBackdrop();

            var w = window.innerWidth || 1280;
            var h = window.innerHeight || 720;
            var layerEl = document.getElementById(LAYER_ID);

            $('body').find('img, div, section, span').each(function () {
                var el = this;

                if (layerEl && (layerEl === el || layerEl.contains(el) || el.contains(layerEl))) return;

                var r = el.getBoundingClientRect();
                if (r.width < w * 0.35 || r.height < h * 0.5) return;

                if (el.tagName === 'IMG') {
                    $(el).addClass('fsc-bg-hidden');
                    hiddenBackdrops.push(el);
                    return;
                }

                var bi = window.getComputedStyle(el).backgroundImage;
                if (bi && bi.indexOf('url(') !== -1) {
                    $(el).addClass('fsc-bg-clear');
                    hiddenBackdrops.push(el);
                }
            });
        } catch (e) {}
    }

    // ---------- картинка фона карточки: без сдвига вправо и без затемнения слева ----------

    // Через секунду после открытия карточки Lampa двигает фоновую картинку вправо и
    // накладывает слева затемнение. Названия нужных элементов заранее неизвестны, поэтому
    // ищем крупные элементы и убираем у них смещение, маску и градиент. Всё, что изменили,
    // запоминаем и возвращаем при выходе из карточки.
    var cardFix = { els: [], props: [], seen: {} };
    var cardFixTimers = [];

    function describeEl(el) {
        var raw = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : el.className;
        var c = String(raw || '').split(/\s+/).filter(function (x) {
            return x && x.indexOf('fsc-') !== 0;
        }).slice(0, 2).join('.');

        return el.tagName.toLowerCase() + (c ? '.' + c : '');
    }

    function restoreCardFix() {
        cardFixTimers.forEach(function (t) { clearTimeout(t); });
        cardFixTimers = [];

        try {
            $('body').removeClass('fsc-card-bg');
            $(cardFix.els).removeClass('fsc-bd-fix fsc-nograd fsc-nobefore fsc-noafter fsc-nomask');

            cardFix.props.forEach(function (p) {
                if (p.old) p.el.style.setProperty(p.prop, p.old, p.priority || '');
                else p.el.style.removeProperty(p.prop);
            });
        } catch (e) {}

        cardFix = { els: [], props: [], seen: {} };
    }

    function fixCardBackdrop() {
        try {
            if (!opt('fsc_fix_backdrop', true)) return;

            var act = Lampa.Activity.active();
            if (!act || act.component !== 'full') return;

            var w = window.innerWidth || 1280;
            var h = window.innerHeight || 720;
            var layerEl = document.getElementById(LAYER_ID);
            var touched = [];

            $('body').find('img, div, section, span').each(function () {
                var el = this;

                if (layerEl && (layerEl === el || layerEl.contains(el) || el.contains(layerEl))) return;

                var r = el.getBoundingClientRect();
                if (r.width < w * 0.35 || r.height < h * 0.5) return;

                var cs = window.getComputedStyle(el);
                var bi = cs.backgroundImage || '';
                var hasUrl = bi.indexOf('url(') !== -1;
                var hasGrad = bi.indexOf('gradient') !== -1;
                var flags = '';

                // сама картинка фона (её прячет отдельное правило, тут только для подсказки)
                if (el.tagName === 'IMG' || hasUrl) flags += 'B';

                // затемнение градиентом в самом элементе
                if (hasGrad) {
                    if (hasUrl) {
                        // и картинка, и градиент в одном свойстве: оставляем только картинку
                        var urls = bi.match(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g);
                        if (urls) {
                            cardFix.props.push({
                                el: el,
                                prop: 'background-image',
                                old: el.style.getPropertyValue('background-image'),
                                priority: el.style.getPropertyPriority('background-image')
                            });
                            el.style.setProperty('background-image', urls.join(','), 'important');
                            flags += 'G';
                        }
                    } else {
                        $(el).addClass('fsc-nograd');
                        cardFix.els.push(el);
                        flags += 'G';
                    }
                }

                // затемнение часто сделано псевдоэлементами ::before / ::after
                ['::before', '::after'].forEach(function (ps) {
                    var pbi = window.getComputedStyle(el, ps).backgroundImage || '';
                    if (pbi.indexOf('gradient') !== -1) {
                        $(el).addClass(ps === '::before' ? 'fsc-nobefore' : 'fsc-noafter');
                        cardFix.els.push(el);
                        flags += ps === '::before' ? 'b' : 'a';
                    }
                });

                // маска, которой картинку растворяют слева
                var mask = cs.webkitMaskImage || cs.maskImage || '';
                if (mask && mask !== 'none') {
                    $(el).addClass('fsc-nomask');
                    cardFix.els.push(el);
                    flags += 'M';
                }

                if (cs.transform && cs.transform !== 'none') flags += 'T';

                if (flags) {
                    var key = describeEl(el) + '[' + flags + ']';
                    if (!cardFix.seen[key]) {
                        cardFix.seen[key] = true;
                        touched.push(key);
                    }
                }
            });

            if (touched.length) dbg('фон: ' + touched.join(', '));
        } catch (e) {}
    }

    // Берём адрес картинки из карточки и ставим её общим фоном Lampa: он на весь экран,
    // по центру и не сдвигается. Заодно один раз выводим в подсказку размеры, чтобы
    // было видно, что именно происходит с фоном.
    function syncCardBackground() {
        try {
            if (!opt('fsc_fix_backdrop', true)) return;

            var act = Lampa.Activity.active();
            if (!act || act.component !== 'full') return;

            var img = $('img.full-start__background').first();
            var src = img.length ? img.attr('src') : '';

            if (src && window.Lampa && Lampa.Background && typeof Lampa.Background.immediately === 'function') {
                Lampa.Background.immediately(src);
            }

            if (!cardFix.infoShown) {
                var bgEl = $('.background').first();

                if (bgEl.length && img.length) {
                    var rb = bgEl[0].getBoundingClientRect();
                    var ri = img[0].getBoundingClientRect();
                    var ob = window.getComputedStyle(bgEl[0]).opacity;

                    cardFix.infoShown = true;
                    dbg('.background: ' + Math.round(rb.width) + '×' + Math.round(rb.height) + ' слева ' + Math.round(rb.left) +
                        ', прозрачность ' + ob + '; картинка карточки: слева ' + Math.round(ri.left) + ', ширина ' + Math.round(ri.width) +
                        (src ? '' : ', без адреса'));
                }
            }
        } catch (e) {}
    }

    // проверяем несколько раз: смещение и затемнение появляются не сразу
    function scheduleCardFix() {
        restoreCardFix();
        if (!opt('fsc_fix_backdrop', true)) return;

        $('body').addClass('fsc-card-bg');

        [0, 250, 700, 1300, 2200, 3500, 5000].forEach(function (ms) {
            cardFixTimers.push(setTimeout(function () {
                syncCardBackground();
                fixCardBackdrop();
            }, ms));
        });
    }

    function removeLayer() {
        restoreBackdrop();

        var layer = $('#' + LAYER_ID);
        if (!layer.length) return;

        var hls = layer.data('hls');
        if (hls) {
            try { hls.destroy(); } catch (e) {}
        }

        layer.find('video').each(function () {
            try {
                this.pause();
                this.removeAttribute('src');
                this.load();
            } catch (e) {}
        });

        layer.remove();
    }

    function rutubeStream(id, cb) {
        httpJson('https://rutube.ru/api/play/options/' + id + '/?no_404=true&referer&pver=v2', function (err, json) {
            if (err) {
                dbg('Rutube: запрос потока не сработал (' + err + ')');
                return cb(null);
            }

            var b = json && json.video_balancer;
            var url = (b && (b.m3u8 || b['default'])) || null;
            if (!url) dbg('Rutube: ссылка на поток не получена');
            cb(url);
        });
    }

    // ---------- качество: выбираем нужный вариант из общего плейлиста ----------

    function resolveUrl(u, base) {
        try {
            return new URL(u, base).href;
        } catch (e) {
            if (/^https?:/i.test(u)) return u;
            return base.slice(0, base.lastIndexOf('/') + 1) + u;
        }
    }

    function parseVariants(text, base) {
        var lines = String(text).split(/\r?\n/);
        var out = [];

        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (l.indexOf('#EXT-X-STREAM-INF') !== 0) continue;

            var res = /RESOLUTION=(\d+)x(\d+)/i.exec(l);
            var bw = /[^-]BANDWIDTH=(\d+)/i.exec(l);
            var uri = '';

            for (var j = i + 1; j < lines.length; j++) {
                var t = lines[j].replace(/^\s+|\s+$/g, '');
                if (t && t.charAt(0) !== '#') {
                    uri = t;
                    break;
                }
            }

            if (uri) {
                out.push({
                    url: resolveUrl(uri, base),
                    w: res ? parseInt(res[1], 10) : 0,
                    h: res ? parseInt(res[2], 10) : 0,
                    bw: bw ? parseInt(bw[1], 10) : 0
                });
            }
        }

        return {
            variants: out,
            audioGroup: /#EXT-X-MEDIA:[^\n]*TYPE=AUDIO/i.test(text)
        };
    }

    // want: нужная высота кадра (например 1080) или 'max'.
    // Берём ближайшее качество не ниже нужного, а если такого нет - самое высокое.
    function pickVariant(list, want) {
        if (!list.length) return null;

        var known = list.filter(function (v) { return v.h > 0; });
        if (!known.length) {
            return list.slice().sort(function (a, b) { return b.bw - a.bw; })[0];
        }

        var byHeightDesc = known.slice().sort(function (a, b) { return b.h - a.h || b.bw - a.bw; });
        if (want === 'max') return byHeightDesc[0];

        var up = known
            .filter(function (v) { return v.h >= want; })
            .sort(function (a, b) { return a.h - b.h || b.bw - a.bw; });

        return up.length ? up[0] : byHeightDesc[0];
    }

    // cb(ссылка, запасная ссылка на общий плейлист)
    function bestStream(master, cb) {
        var q = String(opt('trailer_bg_quality', '1080'));
        if (q === 'auto') return cb(master, null);

        httpText(master, function (err, text) {
            if (err) {
                dbg('Rutube: список качеств не получен, играю как есть');
                return cb(master, null);
            }

            var info = parseVariants(text, master);
            if (!info.variants.length) return cb(master, null);

            // со звуком нужен общий плейлист: звук может лежать отдельной дорожкой
            if (info.audioGroup && opt('trailer_bg_sound', false)) {
                dbg('Rutube: звук отдельной дорожкой, качество выбирает Rutube');
                return cb(master, null);
            }

            var best = pickVariant(info.variants, q === 'max' ? 'max' : (parseInt(q, 10) || 1080));
            if (!best) return cb(master, null);

            var heights = [];
            info.variants.forEach(function (v) {
                if (v.h && heights.indexOf(v.h) === -1) heights.push(v.h);
            });
            heights.sort(function (a, b) { return a - b; });

            dbg('Rutube: качество ' + (best.h ? best.h + 'p' : 'максимальное') + (heights.length ? ' (есть ' + heights.join('/') + ')' : ''));
            cb(best.url, master);
        });
    }

    // ---------- чёрные полосы в самом видео ----------

    // Разбираем кадр: сколько строк и столбцов с краёв почти чёрные.
    // data - пиксели RGBA, w x h - размер уменьшенного кадра.
    function analyzeBars(data, w, h) {
        var TH = 34; // ниже этой яркости считаем чёрным
        var rowMax = [];
        var colMax = [];
        var x, y, i, lum;

        for (y = 0; y < h; y++) rowMax[y] = 0;
        for (x = 0; x < w; x++) colMax[x] = 0;

        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) {
                i = (y * w + x) * 4;
                lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                if (lum > rowMax[y]) rowMax[y] = lum;
                if (lum > colMax[x]) colMax[x] = lum;
            }
        }

        var top = 0;
        while (top < h && rowMax[top] < TH) top++;

        var bottom = 0;
        while (bottom < h && rowMax[h - 1 - bottom] < TH) bottom++;

        var left = 0;
        while (left < w && colMax[left] < TH) left++;

        var right = 0;
        while (right < w && colMax[w - 1 - right] < TH) right++;

        return { top: top, bottom: bottom, left: left, right: right };
    }

    // По найденным полосам считаем увеличение и сдвиг, чтобы картинка заполнила экран.
    // frac: доли полос от размера кадра (0..1).
    function zoomFor(fT, fB, fL, fR) {
        var zV = 1 / (1 - fT - fB);
        var zH = 1 / (1 - fL - fR);
        var z = Math.min(Math.max(zV, zH), 1.7);

        if (!(z >= 1.04)) z = 1; // мелкие полосы не трогаем

        return { z: z, dx: (fL - fR) / 2, dy: (fT - fB) / 2 };
    }

    function applyZoom(video, zoom) {
        if (!zoom || zoom.z <= 1) {
            video.style.transform = '';
            return;
        }

        video.style.transform = 'scale(' + zoom.z.toFixed(3) + ') translate(' +
            (-zoom.dx * 100).toFixed(2) + '%,' + (-zoom.dy * 100).toFixed(2) + '%)';
    }

    // Увеличение по умолчанию, когда кадр прочитать нельзя (Rutube не даёт доступ к картинке):
    // это закрывает полосы кино 2.39:1. Для фона обрезанные края не страшны.
    var FALLBACK_ZOOM = 1.34;

    // помним, что доступ к кадру не получился, чтобы не тратить время на повторную попытку
    var corsState = null;

    function startBarWatch(video, mode) {
        if (mode === 'off') return;

        if (mode !== 'auto') {
            var fixed = parseFloat(mode);
            if (fixed > 1) applyZoom(video, { z: fixed, dx: 0, dy: 0 });
            return;
        }

        var W = 128;
        var H = 72;
        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext('2d');

        var best = null; // минимальные полосы по всем кадрам: настоящие полосы есть всегда,
        var count = 0;   // а тёмные сцены дают лишь временное завышение
        var good = 0;
        var lastZ = 1;

        function sample() {
            if (!document.body.contains(video)) return;
            count++;

            var info;
            try {
                ctx.drawImage(video, 0, 0, W, H);
                info = analyzeBars(ctx.getImageData(0, 0, W, H).data, W, H);
            } catch (e) {
                dbg('кадр недоступен, полосы не убрать (' + errText(e) + ')');
                return;
            }

            var usable = (info.top + info.bottom) <= H * 0.55 && (info.left + info.right) <= W * 0.55;

            if (usable) {
                good++;

                if (!best) {
                    best = { top: info.top, bottom: info.bottom, left: info.left, right: info.right };
                } else {
                    best.top = Math.min(best.top, info.top);
                    best.bottom = Math.min(best.bottom, info.bottom);
                    best.left = Math.min(best.left, info.left);
                    best.right = Math.min(best.right, info.right);
                }

                var zoom = zoomFor(best.top / H, best.bottom / H, best.left / W, best.right / W);
                applyZoom(video, zoom);

                if (Math.abs(zoom.z - lastZ) >= 0.03) {
                    dbg('полосы: увеличение ×' + zoom.z.toFixed(2));
                    lastZ = zoom.z;
                }
            }

            if (count < 12) setTimeout(sample, 1000);
            else if (!good) dbg('не удалось определить чёрные полосы');
        }

        setTimeout(sample, 500);
    }

    // ---------- сам видеоплеер ----------

    // opts.cors - просить доступ к кадру (нужен для поиска полос), opts.alt - запасной адрес потока
    function showVideo(url, id, my, opts) {
        opts = opts || {};

        var sound = opt('trailer_bg_sound', false);
        var zoomMode = String(opt('trailer_bg_zoom', 'auto'));
        var cors = (opts.cors === undefined) ? (zoomMode === 'auto' && corsState !== false) : opts.cors;

        var layer = $(
            '<div id="' + LAYER_ID + '" class="trailer-bg">' +
                '<div class="trailer-bg__frame">' +
                    '<video playsinline loop autoplay poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"' + (sound ? '' : ' muted') + '></video>' +
                '</div>' +
            '</div>'
        );

        var bg = $('.background').first();
        if (bg.length) bg.after(layer);
        else $('body').prepend(layer);

        var video = layer.find('video')[0];
        var failed = false;
        var guard = null;

        if (cors) video.crossOrigin = 'anonymous';

        // фиксированное увеличение ставим сразу, до начала воспроизведения, без плавной анимации
        var fixedZoom = 0;
        if (zoomMode !== 'off') {
            if (zoomMode !== 'auto') fixedZoom = parseFloat(zoomMode) || 0;
            else if (!cors) fixedZoom = FALLBACK_ZOOM;
        }

        if (fixedZoom > 1) {
            video.style.transition = 'none';
            applyZoom(video, { z: fixedZoom, dx: 0, dy: 0 });
            setTimeout(function () { video.style.transition = ''; }, 100);

            if (zoomMode === 'auto') dbg('кадр недоступен, увеличение ×' + fixedZoom + ' по умолчанию');
        }

        function fail() {
            if (failed) return;
            failed = true;
            clearTimeout(guard);
            removeLayer();

            if (my !== token) return;

            if (cors) {
                // сервер не разрешил доступ к кадру - играем без поиска полос
                corsState = false;
                dbg('без доступа к кадру, пробую без CORS');
                return showVideo(url, id, my, { cors: false, alt: opts.alt });
            }

            if (opts.alt) {
                dbg('выбранное качество не запустилось, беру обычный поток');
                return showVideo(opts.alt, id, my, { cors: false });
            }

            // прямой поток не получился - запасной вариант: плеер Rutube (может показать рекламу)
            dbg('прямой поток не запустился, открываю плеер Rutube');
            showIframe('rutube', id);
        }

        video.muted = !sound;
        video.addEventListener('error', fail);
        video.addEventListener('playing', function () {
            clearTimeout(guard);
            dbg('играет (Rutube, прямой поток)');
            layer.addClass('trailer-bg--ready');
            hideBackdrop();
            if (cors) corsState = true;
            if (zoomMode === 'auto' && cors) startBarWatch(video, 'auto');
        });

        // если за несколько секунд ничего не заиграло - считаем, что не вышло
        // (с CORS ждём меньше: если сервер не разрешил, быстрее перейдём к обычному запуску)
        guard = setTimeout(fail, cors ? 7000 : 12000);

        function tryPlay() {
            var p = video.play();
            if (p && p.catch) {
                p.catch(function () {
                    // автозапуск со звуком мог быть заблокирован - пробуем без звука
                    video.muted = true;
                    var p2 = video.play();
                    if (p2 && p2.catch) p2.catch(fail);
                });
            }
        }

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            tryPlay();
        } else if (window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
            var hls = new window.Hls();
            layer.data('hls', hls);
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(window.Hls.Events.ERROR, function (ev, d) {
                if (d && d.fatal) fail();
            });
            tryPlay();
        } else {
            fail();
        }
    }

    function show(source, id, my) {
        if (source === 'rutube' && opt('trailer_bg_rutube_direct', true)) {
            rutubeStream(id, function (url) {
                if (my !== token) return;
                if (!url) return showIframe('rutube', id);

                bestStream(url, function (best, alt) {
                    if (my !== token) return;
                    showVideo(best, id, my, { alt: alt });
                });
            });
        } else {
            showIframe(source, id);
        }
    }

    function stopTrailer() {
        token++;
        clearTimeout(timer);
        clearInterval(watcher);
        removeLayer();
    }

    // убираем видео, как только ушли с карточки
    function watch() {
        clearInterval(watcher);
        watcher = setInterval(function () {
            var act = Lampa.Activity.active();
            if (!act || act.component !== 'full') stopTrailer();
        }, 250);
    }

    function startTrailer(e) {
        stopTrailer();
        dbgReset();
        if (!opt('trailer_bg_enable', true)) return;

        var my = ++token;
        var card = e.data && e.data.movie;

        if (!card || !card.id) {
            dbg('нет данных карточки');
            return;
        }

        dbg('«' + String(card.title || card.name || card.original_title || '?').slice(0, 30) + '»');

        var delay = parseInt(opt('trailer_bg_delay', '3'), 10) || 3;
        var method = e.object && e.object.method;

        timer = setTimeout(function () {
            resolveSource(function (source) {
                if (my !== token) return;

                function done(id) {
                    // трейлера нет - остаётся обычный фон
                    if (!id) dbg('не найден, остаётся обычный фон');
                    if (!id || my !== token) return;
                    dbg('нашёл, запускаю');
                    show(source, id, my);
                    watch();
                }

                if (source === 'rutube') loadRutube(card, done);
                else loadYouTube(card, method, e.data, done);
            });
        }, delay * 1000);
    }

    // =====================================================================
    //  Настройки и запуск
    // =====================================================================

    function addSettings() {
        try {
            Lampa.SettingsApi.addComponent({
                component: 'fullscreen_card',
                name: 'Страница фильма',
                icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 15h18" stroke="currentColor" stroke-width="2"/></svg>'
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_hide_poster', type: 'trigger', 'default': true },
                field: {
                    name: 'Убрать постер в карточке',
                    description: 'Скрывает карточку-постер слева на странице фильма'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_bottom', type: 'trigger', 'default': true },
                field: {
                    name: 'Контент внизу экрана',
                    description: 'Название, кнопки и рейтинги внизу, фон на весь экран'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_layout', type: 'trigger', 'default': true },
                field: {
                    name: 'Расположение как в Cardify',
                    description: 'Год и страна под названием, рейтинги справа внизу'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_orig_title', type: 'trigger', 'default': true },
                field: {
                    name: 'Оригинальное название',
                    description: 'Показывать название на языке оригинала над основным'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_labels', type: 'trigger', 'default': true },
                field: {
                    name: 'Подписи на всех кнопках',
                    description: 'Текст у кнопок карточки виден всегда, а не только у выбранной'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_main_buttons', type: 'trigger', 'default': true },
                field: {
                    name: 'Только основные кнопки',
                    description: 'Оставить Онлайн, Торренты и Закладки, остальные кнопки убрать'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_hide_source', type: 'trigger', 'default': true },
                field: { name: 'Скрыть названия источников' }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_blue_progress', type: 'trigger', 'default': true },
                field: { name: 'Синяя полоска прогресса просмотра' }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_torrent_layout', type: 'trigger', 'default': true },
                field: {
                    name: 'Компактный список торрентов',
                    description: 'Детали раздачи в две строки'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_btn_editor', type: 'trigger', 'default': true },
                field: {
                    name: 'Редактор кнопок',
                    description: 'Долгое нажатие на кнопку в карточке: скрыть, сдвинуть, переименовать'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_quick_exit', type: 'trigger', 'default': false },
                field: {
                    name: 'Выход без вопроса',
                    description: 'Не спрашивать подтверждение при выходе из приложения'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_enable', type: 'trigger', 'default': true },
                field: {
                    name: 'Трейлер на фоне',
                    description: 'Если трейлера нет, остаётся обычный фон'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: {
                    name: 'trailer_bg_source',
                    type: 'select',
                    values: { 'auto': 'Авто', 'youtube': 'YouTube', 'rutube': 'Rutube' },
                    'default': 'auto'
                },
                field: {
                    name: 'Источник трейлеров',
                    description: 'Авто: если YouTube недоступен, берётся Rutube'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: {
                    name: 'trailer_bg_quality',
                    type: 'select',
                    values: { '1080': 'Full HD (1080p)', '720': 'HD (720p)', 'max': 'Максимальное', 'auto': 'Авто (как выберет Rutube)' },
                    'default': '1080'
                },
                field: {
                    name: 'Качество трейлера (Rutube)',
                    description: 'Берётся ближайшее качество не ниже выбранного. Нужен выключенный звук'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: {
                    name: 'trailer_bg_zoom',
                    type: 'select',
                    values: { 'auto': 'Авто (по кадру, иначе ×1.34)', 'off': 'Выключено', '1.2': 'Всегда ×1.2', '1.34': 'Всегда ×1.34 (для кино 2.39:1)', '1.5': 'Всегда ×1.5' },
                    'default': 'auto'
                },
                field: {
                    name: 'Убрать чёрные полосы в трейлере',
                    description: 'Увеличивает видео, чтобы оно закрыло весь экран. Края слева и справа обрезаются'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_fix_backdrop', type: 'trigger', 'default': true },
                field: {
                    name: 'Фон карточки без сдвига и затемнения',
                    description: 'Картинка остаётся по центру, затемнение слева убирается'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_hide_backdrop', type: 'trigger', 'default': true },
                field: {
                    name: 'Скрывать картинку фона при трейлере',
                    description: 'Пока играет трейлер, убирается неподвижная картинка фильма поверх видео'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_debug', type: 'trigger', 'default': false },
                field: {
                    name: 'Подсказки о запуске трейлера',
                    description: 'Короткие сообщения на экране: что нашлось и почему трейлер не играет'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_rutube_direct', type: 'trigger', 'default': true },
                field: {
                    name: 'Rutube без рекламы',
                    description: 'Играет прямой поток вместо плеера Rutube. Если не получилось, откроется обычный плеер'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_sound', type: 'trigger', 'default': false },
                field: {
                    name: 'Трейлер со звуком',
                    description: 'Автозапуск со звуком может блокироваться системой'
                }
            });

            Lampa.SettingsApi.addParam({
                component: 'fullscreen_card',
                param: {
                    name: 'trailer_bg_delay',
                    type: 'select',
                    values: { '1': '1 сек', '3': '3 сек', '5': '5 сек' },
                    'default': '3'
                },
                field: {
                    name: 'Задержка перед запуском трейлера',
                    description: 'Чтобы не грузить трейлеры при быстром листании'
                }
            });
        } catch (e) {
            console.log('fullscreen_card: settings error', e);
        }
    }

    // =====================================================================
    //  ЧАСТЬ 3. Функции из плагина UI Style (interfaceStyle.js)
    // =====================================================================

    // только кнопки "Онлайн", "Торренты" и "Закладки", остальные убираем
    function tuneButtons(body) {
        try {
            if (!opt('fsc_main_buttons', true)) return;

            var box = body.find('.full-start-new__buttons').first();
            if (!box.length) return;

            var keep = body.find('.view--online, .view--torrent, .button--book');
            box.children('.full-start__button').not(keep).remove();

            ['.view--online', '.view--torrent', '.button--book'].forEach(function (sel) {
                var b = body.find(sel).first();
                if (b.length) box.append(b);
            });
        } catch (e) {}
    }

    // =====================================================================
    //  ЧАСТЬ 4. Редактор кнопок карточки
    //  Долгое нажатие на кнопку: скрыть, сдвинуть, переименовать.
    //  Это моя упрощённая версия, а не копия card_buttons_editor.js.
    // =====================================================================

    function store(name, def) {
        var v = Lampa.Storage.get(name, def);
        return (v === undefined || v === null || v === '') ? def : v;
    }

    // устойчивый идентификатор кнопки по её классу (button--book, view--torrent и т.д.)
    function btnId(b) {
        var saved = b.attr('data-fsc-base');
        if (saved) return saved;

        var id = '';
        var cls = String(b.attr('class') || '').split(/\s+/);

        for (var i = 0; i < cls.length; i++) {
            if (/^(button--|view--)/.test(cls[i]) && cls[i] !== 'button--priority') {
                id = cls[i];
                break;
            }
        }

        if (!id) id = 'btn_' + ($.trim(b.text()) || 'unnamed');

        b.attr('data-fsc-base', id);
        return id;
    }

    function btnLabel(b) {
        var s = b.find('span').first();
        return $.trim(s.length ? s.text() : b.text()) || 'Кнопка';
    }

    function currentIds(body) {
        var ids = [];
        body.find('.full-start-new__buttons').first().children('.full-start__button').each(function () {
            var id = $(this).attr('data-fsc-id');
            if (id) ids.push(id);
        });
        return ids;
    }

    // ---------- иконки кнопок ----------

    function ico(inner) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
    }

    var ICONS = [
        { name: 'Плей', svg: ico('<polygon points="6 4 20 12 6 20 6 4"/>') },
        { name: 'Онлайн', svg: ico('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>') },
        { name: 'Фильм', svg: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4l2 5M14 4l2 5"/>') },
        { name: 'Загрузка', svg: ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>') },
        { name: 'Закладка', svg: ico('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>') },
        { name: 'Сердце', svg: ico('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>') },
        { name: 'Звезда', svg: ico('<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/>') },
        { name: 'Поиск', svg: ico('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>') },
        { name: 'Часы', svg: ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
        { name: 'Поделиться', svg: ico('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>') },
        { name: 'Инфо', svg: ico('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>') },
        { name: 'Настройки', svg: ico('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>') },
        { name: 'Ещё', svg: ico('<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>') },
        { name: 'Глаз', svg: ico('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>') },
        { name: 'Огонь', svg: ico('<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/>') },
        { name: 'Молния', svg: ico('<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>') },
        { name: 'Корона', svg: ico('<path d="M3 18h18M4 18L3 7l5 4 4-6 4 6 5-4-1 11"/>') },
        { name: 'Кубок', svg: ico('<path d="M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M12 14v4M8 21h8"/>') },
        { name: 'Музыка', svg: ico('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>') },
        { name: 'Камера', svg: ico('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M22 7l-6 5 6 5V7z"/>') },
        { name: 'Глобус', svg: ico('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>') },
        { name: 'Колокол', svg: ico('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>') },
        { name: 'Замок', svg: ico('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>') },
        { name: 'Пользователь', svg: ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>') },
        { name: 'Дом', svg: ico('<path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z"/><path d="M9 22V12h6v10"/>') },
        { name: 'Папка', svg: ico('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>') },
        { name: 'Список', svg: ico('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>') },
        { name: 'Галочка', svg: ico('<path d="M5 12l5 5L20 7"/>') },
        { name: 'Плюс', svg: ico('<path d="M12 5v14M5 12h14"/>') }
    ];

    function findIcon(name) {
        for (var i = 0; i < ICONS.length; i++) {
            if (ICONS[i].name === name) return ICONS[i];
        }
        return null;
    }

    // ставим выбранную иконку или возвращаем родную
    function applyIcon(b, name) {
        var svg = b.find('svg').first();
        if (!svg.length) return;

        // запоминаем родную иконку, пока её не заменили
        if (b.data('fscIcon0') === undefined && !svg.attr('data-fsc-icon')) {
            b.data('fscIcon0', svg[0].outerHTML);
        }

        var icon = name ? findIcon(name) : null;

        if (icon) {
            if (svg.attr('data-fsc-icon') !== name) {
                var n = $(icon.svg);
                n.attr('data-fsc-icon', name);
                svg.replaceWith(n);
            }
        } else if (svg.attr('data-fsc-icon') && b.data('fscIcon0')) {
            svg.replaceWith($(b.data('fscIcon0')));
        }
    }

    function iconPicker(body, id, ctrl) {
        var grid = $('<div class="fsc-icon-grid"></div>');

        var reset = $('<div class="fsc-icon-item fsc-icon-reset selector">По умолчанию</div>');
        reset.on('hover:enter', function () {
            var icons = $.extend({}, store('fsc_btn_icons', {}));
            delete icons[id];
            Lampa.Storage.set('fsc_btn_icons', icons);

            Lampa.Modal.close();
            setTimeout(function () { saveAndApply(body, ctrl); }, 100);
        });
        grid.append(reset);

        ICONS.forEach(function (icon) {
            var item = $('<div class="fsc-icon-item selector" title="' + icon.name + '"></div>').append(icon.svg);

            item.on('hover:enter', function () {
                var icons = $.extend({}, store('fsc_btn_icons', {}));
                icons[id] = icon.name;
                Lampa.Storage.set('fsc_btn_icons', icons);

                Lampa.Modal.close();
                setTimeout(function () { saveAndApply(body, ctrl); }, 100);
            });

            grid.append(item);
        });

        Lampa.Modal.open({
            title: 'Выберите иконку',
            html: grid,
            size: 'medium',
            scroll_to_center: true,
            onBack: function () {
                Lampa.Modal.close();
                backTo(ctrl);
            }
        });
    }

    // применяем сохранённый порядок, скрытие и названия
    function applyButtons(body) {
        try {
            if (!opt('fsc_btn_editor', true)) return;

            var box = body.find('.full-start-new__buttons').first();
            if (!box.length) return;

            var order = store('fsc_btn_order', []);
            var hide = store('fsc_btn_hide', []);
            var titles = store('fsc_btn_titles', {});

            var items = {};
            var ids = [];

            box.children('.full-start__button').each(function () {
                var b = $(this);
                var id = b.attr('data-fsc-id');

                if (!id) {
                    var base = btnId(b);
                    var n = 1;
                    id = base;
                    while (items[id]) {
                        n++;
                        id = base + '_' + n;
                    }
                    b.attr('data-fsc-id', id);
                }

                items[id] = b;
                ids.push(id);
            });

            var result = [];
            order.forEach(function (id) {
                if (items[id] && result.indexOf(id) === -1) result.push(id);
            });
            ids.forEach(function (id) {
                if (result.indexOf(id) === -1) result.push(id);
            });
            result.forEach(function (id) { box.append(items[id]); });

            ids.forEach(function (id) {
                var b = items[id];
                b.toggleClass('fsc-btn-hide', hide.indexOf(id) !== -1);
                applyIcon(b, store('fsc_btn_icons', {})[id]);

                if (titles[id]) {
                    var sp = b.find('span').first();
                    if (sp.length) sp.text(titles[id]);
                    else b.append($('<span></span>').text(titles[id]));
                } else if (b.hasClass('button--options') && !b.find('span').length && opt('fsc_labels', true)) {
                    b.append('<span>Ещё</span>');
                }
            });

            box.children('.full-start__button')
                .off('hover:long.fsc')
                .on('hover:long.fsc', function () {
                    editButton(body, $(this).attr('data-fsc-id'));
                });
        } catch (err) {
            console.log('fullscreen_card: buttons error', err);
        }
    }

    function backTo(ctrl) {
        try { Lampa.Controller.toggle(ctrl); } catch (e) {}
    }

    function saveAndApply(body, ctrl) {
        applyButtons(body);
        backTo(ctrl);
    }

    function restoreHidden(body, ctrl) {
        var hide = store('fsc_btn_hide', []).slice();
        var box = body.find('.full-start-new__buttons').first();

        var list = hide.map(function (hid) {
            var b = box.children('[data-fsc-id="' + hid + '"]').first();
            return { title: b.length ? btnLabel(b) : hid, id: hid };
        });
        list.push({ title: 'Вернуть все', id: '*' });

        Lampa.Select.show({
            title: 'Скрытые кнопки',
            items: list,
            onSelect: function (item) {
                var left = (item.id === '*') ? [] : hide.filter(function (x) { return x !== item.id; });
                Lampa.Storage.set('fsc_btn_hide', left);
                saveAndApply(body, ctrl);
            },
            onBack: function () { backTo(ctrl); }
        });
    }

    function editButton(body, id) {
        if (!id) return;

        var ctrl = 'content';
        try {
            var en = Lampa.Controller.enabled();
            if (en && en.name) ctrl = en.name;
        } catch (e) {}

        var box = body.find('.full-start-new__buttons').first();
        var btn = box.children('[data-fsc-id="' + id + '"]').first();
        var label = btnLabel(btn);

        var hide = store('fsc_btn_hide', []).slice();
        var titles = $.extend({}, store('fsc_btn_titles', {}));

        function move(dir) {
            var all = currentIds(body);
            var i = all.indexOf(id);
            var j = i + dir;

            // пропускаем скрытые кнопки
            while (j >= 0 && j < all.length && hide.indexOf(all[j]) !== -1) j += dir;
            if (i === -1 || j < 0 || j >= all.length) return backTo(ctrl);

            var tmp = all[i];
            all[i] = all[j];
            all[j] = tmp;

            Lampa.Storage.set('fsc_btn_order', all);
            saveAndApply(body, ctrl);
        }

        var list = [
            {
                title: 'Скрыть кнопку',
                onSelect: function () {
                    hide.push(id);
                    Lampa.Storage.set('fsc_btn_hide', hide);
                    saveAndApply(body, ctrl);
                }
            },
            { title: 'Сдвинуть влево', onSelect: function () { move(-1); } },
            { title: 'Сдвинуть вправо', onSelect: function () { move(1); } },
            {
                title: 'Переименовать',
                onSelect: function () {
                    Lampa.Input.edit({
                        free: true,
                        title: 'Название кнопки',
                        nosave: true,
                        value: label,
                        onBack: function () { backTo(ctrl); }
                    }, function (val) {
                        val = $.trim(val || '');
                        if (val) {
                            titles[id] = val;
                            Lampa.Storage.set('fsc_btn_titles', titles);
                        }
                        saveAndApply(body, ctrl);
                    });
                }
            }
        ];

        list.push({
            title: 'Сменить иконку',
            onSelect: function () { iconPicker(body, id, ctrl); }
        });

        if (hide.length) {
            list.push({
                title: 'Вернуть скрытые кнопки (' + hide.length + ')',
                onSelect: function () { restoreHidden(body, ctrl); }
            });
        }

        list.push({
            title: 'Сбросить все изменения',
            onSelect: function () {
                Lampa.Storage.set('fsc_btn_order', []);
                Lampa.Storage.set('fsc_btn_hide', []);
                Lampa.Storage.set('fsc_btn_titles', {});
                Lampa.Storage.set('fsc_btn_icons', {});
                try { Lampa.Noty.show('Сброшено. Откройте карточку заново, чтобы вернуть прежний порядок и названия'); } catch (e) {}
                saveAndApply(body, ctrl);
            }
        });

        Lampa.Select.show({
            title: 'Кнопка: ' + label,
            items: list,
            onBack: function () { backTo(ctrl); }
        });
    }

    var btnObserver = null;

    // Другие плагины добавляют свои кнопки с задержкой. Следим за блоком кнопок
    // несколько секунд и сразу убираем лишнее, чтобы они не мелькали на экране.
    function watchButtons(body) {
        try {
            if (btnObserver) {
                btnObserver.disconnect();
                btnObserver = null;
            }

            if (!window.MutationObserver) return;

            var root = body && body[0];
            if (!root) return;

            var obs = new MutationObserver(function () {
                obs.disconnect();

                try {
                    tuneButtons(body);
                    applyButtons(body);
                } catch (err) {}

                setTimeout(function () {
                    if (btnObserver === obs) obs.observe(root, { childList: true, subtree: true });
                }, 0);
            });

            obs.observe(root, { childList: true, subtree: true });
            btnObserver = obs;

            setTimeout(function () {
                obs.disconnect();
                if (btnObserver === obs) btnObserver = null;
            }, 8000);
        } catch (err) {}
    }

    function uiStyle(e, render) {
        try {
            var body = e.body || render;
            var movie = e.data && e.data.movie;

            // оригинальное название над основным
            body.find('.fsc-orig').remove();

            if (opt('fsc_orig_title', true) && movie) {
                var t = movie.title || movie.name;
                var o = movie.original_title || movie.original_name;

                if (t && o && t !== o) {
                    body.find('.full-start-new__title').first().before(
                        $('<div class="full-start-new__title-original fsc-orig"></div>').text(o)
                    );
                }
            }

            tuneButtons(body);
            applyButtons(body);
            watchButtons(body);
            // на всякий случай ещё раз чуть позже
            setTimeout(function () {
                tuneButtons(body);
                applyButtons(body);
            }, 700);
        } catch (err) {
            console.log('fullscreen_card: uiStyle error', err);
        }
    }

    // выход из приложения без вопроса "Выйти?"
    function installQuickExit() {
        try {
            if (!Lampa.Select || Lampa.Select._fsc_quick_exit) return;

            var original = Lampa.Select.show;
            var exiting = false;

            Lampa.Select.show = function (object) {
                if (opt('fsc_quick_exit', false) && object && object.items && typeof object.onSelect === 'function') {
                    var item = null;

                    for (var i = 0; i < object.items.length; i++) {
                        if (object.items[i].out === true) {
                            item = object.items[i];
                            break;
                        }
                    }

                    if (item) {
                        if (exiting) return;
                        exiting = true;

                        object.onSelect(item);

                        setTimeout(function () { exiting = false; }, 1000);
                        return;
                    }
                }

                return original.apply(this, arguments);
            };

            Lampa.Select._fsc_quick_exit = true;
        } catch (e) {}
    }

    function start() {
        addStyles();
        installQuickExit();
        addSettings();
        apply();

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'start' && e.type !== 'complite') return;

            apply();
            scheduleCardFix();

            if (e.type === 'complite') {
                var render = (e.object && e.object.activity && e.object.activity.render)
                    ? e.object.activity.render()
                    : $('body');

                tagYear(render);
                // данные могут дорисоваться чуть позже
                setTimeout(function () { tagYear(render); }, 700);

                uiStyle(e, render);
                startTrailer(e);
            }
        });

        // при запуске плеера убираем фоновый трейлер
        try {
            Lampa.Player.listener.follow('start', stopTrailer);
        } catch (e) {}

        // при переходе на другую страницу сразу убираем видео и правки фона
        try {
            Lampa.Listener.follow('activity', function (ev) {
                var comp = ev && (ev.component || (ev.object && ev.object.component));
                var type = ev && ev.type;

                if (comp && comp !== 'full' && (type === 'start' || type === 'create' || type === 'destroy' || type === 'archive')) {
                    stopTrailer();
                    restoreCardFix();
                }
            });
        } catch (err) {}

        // нажатие "Назад": прячем видео мгновенно, ещё до смены страницы
        document.addEventListener('keydown', function (ev) {
            var k = ev.keyCode;
            var back = k === 27 || k === 8 || k === 461 || k === 10009 || k === 4 ||
                ev.key === 'Escape' || ev.key === 'GoBack' || ev.key === 'BrowserBack';

            if (!back) return;

            var layer = $('#' + LAYER_ID);
            if (!layer.length) return;

            layer.css('visibility', 'hidden');

            setTimeout(function () {
                var l = $('#' + LAYER_ID);
                if (!l.length) return;

                var act = Lampa.Activity.active();
                if (act && act.component === 'full') l.css('visibility', '');
                else stopTrailer();
            }, 300);
        }, true);

        // страховка: если событие смены страницы не пришло, проверяем сами
        setInterval(function () {
            try {
                var act = Lampa.Activity.active();
                if (act && act.component === 'full') return;

                $('body').removeClass('fsc-card-bg');
                if (document.getElementById(LAYER_ID)) stopTrailer();
                if (cardFix.els.length || cardFix.props.length) restoreCardFix();
            } catch (err) {}
        }, 250);

        try {
            Lampa.Storage.listener.follow('change', function (e) {
                if (e && e.name && String(e.name).indexOf('fsc_') === 0) apply();
            });
        } catch (e) {}
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();

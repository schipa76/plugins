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

    // короткие подсказки на экране о том, что делает трейлер (можно выключить в настройках)
    function dbg(msg) {
        try {
            if (opt('trailer_bg_debug', true)) Lampa.Noty.show('Трейлер: ' + msg);
        } catch (e) {}
    }

    function apply() {
        $('body')
            .toggleClass('fsc-nofposter', !!opt('fsc_hide_poster', true))
            .toggleClass('fsc-bottom', !!opt('fsc_bottom', true))
            .toggleClass('fsc-layout', !!opt('fsc_layout', true))
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
            '.trailer-bg__frame video{width:100%;height:100%;object-fit:cover;background:#000;}' +

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
        var found = pickYouTube(data && data.videos && data.videos.results);
        if (found) return cb(found);

        var type = method || ((card.first_air_date && !card.title) ? 'tv' : 'movie');

        try {
            var url = Lampa.TMDB.api(type + '/' + card.id + '/videos?api_key=' + Lampa.TMDB.key() + '&language=en-US');
            fetch(url)
                .then(function (r) { return r.json(); })
                .then(function (json) { cb(pickYouTube(json && json.results)); })
                .catch(function () { cb(null); });
        } catch (e) {
            cb(null);
        }
    }

    // ---------- Rutube: поиск трейлера по названию ----------

    function loadRutube(card, cb) {
        var title = card.title || card.name || card.original_title || card.original_name || '';
        if (!title) return cb(null);

        var date = card.release_date || card.first_air_date || '';
        var year = date ? String(date).slice(0, 4) : '';
        var query = title + ' ' + year + ' трейлер';
        var url = 'https://rutube.ru/api/search/video/?format=json&query=' + encodeURIComponent(query);
        var low = title.toLowerCase();

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var list = (json && json.results) || [];
                var best = null;

                dbg('Rutube нашёл видео: ' + list.length + (list[0] ? ', первое: ' + String(list[0].title).slice(0, 40) : ''));

                for (var i = 0; i < list.length; i++) {
                    var it = list[i];
                    var t = String(it.title || '').toLowerCase();
                    var dur = parseInt(it.duration, 10) || 0;

                    var isTrailer = t.indexOf('трейлер') !== -1 || t.indexOf('trailer') !== -1 || t.indexOf('тизер') !== -1;
                    var hasTitle = t.indexOf(low) !== -1;
                    var okLen = dur >= 20 && dur <= 330;

                    if (isTrailer && hasTitle && okLen) {
                        best = it;
                        break;
                    }
                }

                if (!best) {
                    dbg('Rutube: подходящего трейлера среди результатов нет');
                    return cb(null);
                }

                var id = best.id || String(best.video_url || '').split('/').filter(Boolean).pop();
                cb(id || null);
            })
            .catch(function (err) {
                dbg('Rutube: поиск не сработал (' + err + ')');
                cb(null);
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
            }, source === 'rutube' ? 3500 : 2500);
        });
    }

    // ---------- Rutube без рекламы: прямой поток в обычном <video> ----------

    function removeLayer() {
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
        fetch('https://rutube.ru/api/play/options/' + id + '/?no_404=true&referer&pver=v2')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var b = json && json.video_balancer;
                var url = (b && (b.m3u8 || b['default'])) || null;
                if (!url) dbg('Rutube: ссылка на поток не получена');
                cb(url);
            })
            .catch(function (err) {
                dbg('Rutube: запрос потока не сработал (' + err + ')');
                cb(null);
            });
    }

    function showVideo(url, id, my) {
        var sound = opt('trailer_bg_sound', false);

        var layer = $(
            '<div id="' + LAYER_ID + '" class="trailer-bg">' +
                '<div class="trailer-bg__frame">' +
                    '<video playsinline loop autoplay' + (sound ? '' : ' muted') + '></video>' +
                '</div>' +
            '</div>'
        );

        var bg = $('.background').first();
        if (bg.length) bg.after(layer);
        else $('body').prepend(layer);

        var video = layer.find('video')[0];
        var failed = false;
        var guard = null;

        function fail() {
            if (failed) return;
            failed = true;
            clearTimeout(guard);
            dbg('прямой поток не запустился, открываю плеер Rutube');
            removeLayer();
            // прямой поток не получился - запасной вариант: плеер Rutube (может показать рекламу)
            if (my === token) showIframe('rutube', id);
        }

        video.muted = !sound;
        video.addEventListener('error', fail);
        video.addEventListener('playing', function () {
            clearTimeout(guard);
            dbg('играет (Rutube, прямой поток)');
            layer.addClass('trailer-bg--ready');
        });

        // если за 10 секунд ничего не заиграло - считаем, что не вышло
        guard = setTimeout(fail, 10000);

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
                if (url) showVideo(url, id, my);
                else showIframe('rutube', id);
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
        }, 800);
    }

    function startTrailer(e) {
        stopTrailer();
        if (!opt('trailer_bg_enable', true)) return;

        var my = ++token;
        var card = e.data && e.data.movie;
        if (!card || !card.id) return;

        var delay = parseInt(opt('trailer_bg_delay', '3'), 10) || 3;
        var method = e.object && e.object.method;

        timer = setTimeout(function () {
            resolveSource(function (source) {
                if (my !== token) return;

                function done(id) {
                    // трейлера нет - остаётся обычный фон
                    if (!id) dbg('не найден, остаётся обычный фон');
                    if (!id || my !== token) return;
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
                param: { name: 'fsc_main_buttons', type: 'trigger', 'default': false },
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
                param: { name: 'trailer_bg_debug', type: 'trigger', 'default': true },
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
            if (!opt('fsc_main_buttons', false)) return;

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
            // другие плагины могут добавить свои кнопки чуть позже
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

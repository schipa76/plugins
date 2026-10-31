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

    function apply() {
        $('body')
            .toggleClass('fsc-nofposter', !!opt('fsc_hide_poster', true))
            .toggleClass('fsc-bottom', !!opt('fsc_bottom', true))
            .toggleClass('fsc-layout', !!opt('fsc_layout', true));
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
                'right:2em;' +
                'bottom:1em;' +
                'margin:0 !important;' +
                'order:7 !important;' +
            '}' +

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
        img.onload = function () { finish(true); };
        img.onerror = function () { finish(false); };
        img.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg?_=' + Date.now();
    }

    function resolveSource(cb) {
        var s = String(opt('trailer_bg_source', 'auto'));
        if (s === 'youtube' || s === 'rutube') return cb(s);
        checkYouTube(function (ok) { cb(ok ? 'youtube' : 'rutube'); });
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

                if (!best) return cb(null);

                var id = best.id || String(best.video_url || '').split('/').filter(Boolean).pop();
                cb(id || null);
            })
            .catch(function () { cb(null); });
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
                cb((b && (b.m3u8 || b['default'])) || null);
            })
            .catch(function () { cb(null); });
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
            removeLayer();
            // прямой поток не получился - запасной вариант: плеер Rutube (может показать рекламу)
            if (my === token) showIframe('rutube', id);
        }

        video.muted = !sound;
        video.addEventListener('error', fail);
        video.addEventListener('playing', function () {
            clearTimeout(guard);
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

    function start() {
        addStyles();
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

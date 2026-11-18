(function () {
    'use strict';

    // Плагин для Lampa: страница фильма как в Cardify.
    //  - убирает карточку-постер слева;
    //  - контент внизу экрана, фон на весь экран, без затемнения;
    //  - порядок: название -> слоган -> год и страна -> время и жанр -> кнопки,
    //    рейтинги, возрастной ценз и статус - справа внизу;
    //  - трейлер фоном (только Rutube). Если трейлера нет, остаётся обычный фон.
    // Настройки: Настройки -> "Страница фильма".

    if (window.fullscreen_card_plugin) return;
    window.fullscreen_card_plugin = true;

    var LAYER_ID = 'trailer-bg-layer';
    var timer = null;
    var watcher = null;
    var token = 0;

    // true - вернуть в меню настроек все пункты (как было раньше)
    var SHOW_ADVANCED = false;

    // Значения пунктов, которые убраны из меню. Они больше не зависят от сохранённых настроек.
    // При SHOW_ADVANCED = true этот список не используется.
    var FIXED = {
        fsc_hide_poster: true,
        fsc_bottom: true,
        fsc_layout: true,
        fsc_orig_title: true,
        fsc_labels: true,
        fsc_main_buttons: true,
        fsc_hide_source: true,
        fsc_blue_progress: true,
        fsc_torrent_layout: true,
        fsc_btn_editor: true,
        fsc_quick_exit: false,
        fsc_fix_backdrop: true,
        fsc_card_year: false,
        trailer_bg_source: 'rutube',
        trailer_bg_quality: '1080',
        trailer_bg_zoom: 'auto',
        trailer_bg_rutube_direct: true,
        trailer_bg_hide_backdrop: true,
        trailer_bg_debug: false
    };

    function opt(name, def) {
        if (!SHOW_ADVANCED) {
            // цвет цифр оценок включается тем же пунктом, что и логотипы
            if (name === 'fsc_rate_colors') name = 'fsc_rate_logos';
            if (FIXED.hasOwnProperty(name)) return FIXED[name];
        }

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
            .toggleClass('fsc-rates', !!opt('fsc_rate_logos', true))
            .toggleClass('fsc-labels', !!opt('fsc_labels', true))
            .toggleClass('fsc-nosource', !!opt('fsc_hide_source', true))
            .toggleClass('fsc-blue', !!opt('fsc_blue_progress', true))
            .toggleClass('fsc-torrent', !!opt('fsc_torrent_layout', true));

        try {
            Ring.apply();
        } catch (e) {}
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
            'body.fsc-rates .full-start__rate .source--name{display:inline-block !important;}' +

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
            '.fsc-bg-now{transition:none !important;}' +
            // фон карточки: свою картинку карточки прячем, показываем общий фон Lampa на весь экран
            'body.fsc-card-bg .full-start__background{opacity:0 !important;transition:none !important;}' +
            'body.fsc-card-bg .background{opacity:1 !important;visibility:visible !important;}' +

            // свой слой с картинкой фона: лежит над общим фоном Lampa, поэтому его затемнение не видно
            '#fsc-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;opacity:1;}' +
            '#fsc-backdrop.fsc-backdrop--on{opacity:1;}' +
            '#fsc-backdrop img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%;}' +
            '#fsc-backdrop{transition:filter .25s ease;}' +
            '#fsc-backdrop.fsc-soft{filter:brightness(var(--fsc-soft-b,.9));}' +

            // свой фон списков (главная и каталоги): две картинки, меняются мгновенно, без наложения
            '#fsc-mainbg{position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;background:#000;}' +
            '#fsc-mainbg img{position:absolute;top:0;left:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%;opacity:0;}' +
            '#fsc-mainbg .fsc-mainbg__dim{position:absolute;top:0;left:0;width:100%;height:100%;background:#000;opacity:0;}' +
            '.fsc-nofilter{filter:none !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}' +
            '.fsc-nocolor{background:none !important;background-color:transparent !important;}' +

            // рамка активного торрента, файла и серии: своя, сплошная, как у блока "Нет истории просмотра".
            // Родные рамки Lampa (сам элемент, ::before, ::after) гасятся, анимации и переходы выключены,
            // поэтому цвет не мигает и не бывает полупрозрачным. Цвет задаёт настройка (--fsc-ring).
            ['torrent-item', 'torrent-file', 'torrent-serial'].map(function (t) {
                var f = 'body.fsc-ring .' + t + '.focus';

                // в окне "Файлы" список обрезается по краям, поэтому у файлов и серий рамка рисуется внутри плашки
                var off = t === 'torrent-item' ? '.3em' : '-.3em';

                return f + '{box-shadow:none !important;border-color:transparent !important;' +
                    'outline:.3em solid var(--fsc-ring) !important;outline-offset:' + off + ' !important;animation:none !important;' +
                    'transition:box-shadow 0s,border-color 0s,outline 0s,outline-offset 0s,opacity 0s !important;}' +
                    f + '::before,' + f + '::after{box-shadow:none !important;border-color:transparent !important;' +
                    'outline-color:transparent !important;animation:none !important;transition:none !important;}';
            }).join('') +


            // номер серии лежит внутри рамки, а не торчит из угла плашки
            '.fsc-serial-badge{top:.3em !important;left:.3em !important;right:auto !important;bottom:auto !important;margin:0 !important;transform:none !important;}' +

            // иконка пункта меню, которая при наведении сливается с фоном: инвертируется (см. UiFix)
            '.fsc-ico-inv{filter:invert(1) !important;transition:none !important;}' +

            // цвета у торрентов: раздают, качают, битрейт и размер
            '.torrent-item__seeds span{color:#ffd9a3 !important;background-color:rgba(255,160,50,.2) !important;border:1px solid #e0a050 !important;}' +
            '.torrent-item__grabs span{color:#a9d0ff !important;background-color:rgba(60,130,246,.22) !important;border:1px solid #4a8df0 !important;}' +
            '.torrent-item__bitrate span,.torrent-item__size{color:#a5f3f5 !important;background-color:rgba(40,200,210,.2) !important;border:1px solid #3ccfd6 !important;}' +

            // Иконки пунктов настроек (в том числе плагинов) рисуются цветом currentColor: на выбранном пункте он
            // тёмный, а Lampa потом сама инвертирует иконку, и она становится светлой на светлой плашке.
            // Фиксируем белый цвет, тогда инверсия Lampa даёт тёмную иконку, как у родных пунктов.
            '.settings-folder__icon,.settings-folder__icon svg{color:#fff !important;}' +

            // у карточек в списках своя плашка рейтинга: родную плашку Lampa под ней не показываем
            '.fsc-has-rate .card__vote{display:none !important;}' +

            // вкладка Shots в настройках Lampa скрыта
            '.settings-folder[data-component="shots"],.settings-folder[data-component="cub_shots"]{display:none !important;}' +
            '.fsc-nograd{background-image:none !important;}' +
            '.fsc-nomask{-webkit-mask-image:none !important;mask-image:none !important;}' +
            '.fsc-nobefore::before{background:none !important;background-image:none !important;}' +
            '.fsc-noafter::after{background:none !important;background-image:none !important;}' +
            // лишние кнопки скрываются сразу, ещё до того как их уберёт скрипт
            'body.fsc-main-btns .full-start__button:not(.view--online):not(.view--torrent):not(.button--book){display:none !important;}' +
            // пока скрипт не расставил кнопки, блок спрятан (иначе на секунду мелькают лишние);
            // запасной таймер 1.5 с покажет блок в любом случае
            'body.fsc-main-btns .full-start-new__buttons:not(.fsc-btn-ready),' +
            'body.fsc-main-btns .full-start__buttons:not(.fsc-btn-ready),' +
            'body.fsc-main-btns .buttons--container:not(.fsc-btn-ready){visibility:hidden;animation:fsc-btn-show 0s linear 1.5s forwards;}' +
            '@keyframes fsc-btn-show{to{visibility:visible;}}' +
            '.fsc-bg-clear{background-image:none !important;}' +

            '</style>'
        );
    }

    // =====================================================================
    //  ЧАСТЬ 2. Трейлер на фоне
    // =====================================================================

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

    // способ запроса, который сработал в прошлый раз: пробуем его первым, чтобы не ждать остальные
    var goodVia = null;

    function httpGet(url, asText, cb, timeout) {
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

        // прокси остаётся последним, остальные: сначала тот, что работал
        if (goodVia) {
            for (var gi = 0; gi < tries.length; gi++) {
                if (tries[gi].name === goodVia && gi > 0 && tries[gi].name !== 'прокси') {
                    tries.unshift(tries.splice(gi, 1)[0]);
                    break;
                }
            }
        }

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

                if (good) {
                    goodVia = t.name;
                    return cb(null, value, t.name);
                }

                errors.push(t.name + ': ' + (err ? errText(err) : 'пустой ответ'));
                next(i + 1);
            }

            var guard = setTimeout(function () { finish(null, 'таймаут'); }, timeout || 8000);

            try {
                t.run(function (d) { finish(d); }, function (e) { finish(null, e || 'ошибка'); });
            } catch (e) {
                finish(null, e);
            }
        }

        next(0);
    }

    function httpJson(url, cb, timeout) { httpGet(url, false, cb, timeout); }
    function httpText(url, cb, timeout) { httpGet(url, true, cb, timeout); }

    // приводим название к простому виду: без регистра, знаков и буквы "ё"
    function norm(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^a-zа-я0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^ | $/g, '');
    }

    // Время добавления ролика на Rutube (0, если даты нет в ответе)
    function tsOf(it) {
        var raw = (it && (it.publication_ts || it.created_ts || it.last_update_ts)) || '';
        var t = Date.parse(String(raw).replace(' ', 'T'));
        return isNaN(t) ? 0 : t;
    }

    // Из подходящих роликов выбираем самый новый: у свежего ролика выше шанс на хорошее качество.
    // Если в названии есть год фильма, сначала берём ролики с этим годом, чтобы не взять трейлер
    // другого фильма с таким же названием. Если дат нет, остаётся первый по порядку Rutube.
    function pickRutube(cands, year) {
        if (!cands.length) return null;
        if (!opt('trailer_bg_newest', true)) return cands[0];

        var pool = cands;

        if (year) {
            var withYear = cands.filter(function (it) {
                return norm(it.title).indexOf(year) !== -1;
            });
            if (withYear.length) pool = withYear;
        }

        var best = pool[0];
        var bestTs = tsOf(best);

        for (var i = 1; i < pool.length; i++) {
            var ts = tsOf(pool[i]);

            if (ts > bestTs) {
                best = pool[i];
                bestTs = ts;
            }
        }

        return best;
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
                var cands = [];

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

                    if (isTrailer && hasTitle && okLen) cands.push(it);
                }

                best = pickRutube(cands, year);

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
        }, 5000);
    }

    // ---------- слой с видео ----------

    function buildSrc(source, id, sound) {
        return 'https://rutube.ru/play/embed/' + id + '/?autoplay=true&skinColor=000000';
    }

    // Место для слоя трейлера: после своей картинки фона, а если её нет - после общего фона Lampa.
    // Так видео всегда лежит над картинкой, а интерфейс над видео.
    function insertLayer(layer) {
        var anchor = $('#fsc-backdrop');
        if (!anchor.length) anchor = $('#fsc-mainbg');
        if (!anchor.length) anchor = $('.background').first();

        if (anchor.length) anchor.after(layer);
        else $('body').prepend(layer);
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
        insertLayer(layer);

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
            $(hiddenBackdrops).removeClass('fsc-bg-hidden fsc-bg-clear fsc-bg-now');
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
            var backEl = document.getElementById('fsc-backdrop');
            var mainEl = document.getElementById('fsc-mainbg');

            $('body').find('img, div, section, span').each(function () {
                var el = this;

                if (layerEl && (layerEl === el || layerEl.contains(el) || el.contains(layerEl))) return;
                if (backEl && (backEl === el || backEl.contains(el) || el.contains(backEl))) return;
                if (mainEl && (mainEl === el || mainEl.contains(el) || el.contains(mainEl))) return;

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

    // Переход с карточки на страницы торрентов и онлайна: состояние карточки не сбрасываем, только прячем
    // свой слой фона. Так при возврате родная картинка Lampa (со сдвигом) не успевает промелькнуть.
    var softLeft = false;
    var softReturnAt = 0;
    // Названия страниц онлайна у разных плагинов разные, поэтому список "мягких" страниц не перечисляем:
    // мягко уходим на любую страницу, кроме основных разделов Lampa (там состояние карточки сбрасываем).
    var HARD_PAGES = /^(main|category|category_full|catalog|favorite|bookmarks|mytorrents|settings|search|person|actor|company|collections|collection|feed|timetable|relise|subscribes|last|mytorrents|tv|live|cub)/i;

    function isSoftPage(comp) {
        comp = String(comp || '');
        return !!comp && comp !== 'full' && !HARD_PAGES.test(comp);
    }

    function softLeave(keep) {
        softLeft = true;

        // stopTrailer вернул родные картинки фона карточки: прячем их снова, иначе при возврате они мелькнут
        if (keep && keep.length) {
            hiddenBackdrops = keep;
            $(keep).addClass('fsc-bg-hidden fsc-bg-clear fsc-bg-now');
        }

        cardFixTimers.forEach(function (t) { clearTimeout(t); });
        cardFixTimers = [];

        // Свой слой с картинкой остаётся на экране (это тот же фильм), только слегка притемняется, как фон
        // на страницах торрентов и онлайна. Ни один слой не прячется, поэтому при возврате нет промежутка,
        // когда виден другой фон: меняется только яркость.
        var bd = $('#fsc-backdrop');

        if (bd.length) {
            bd[0].style.setProperty('--fsc-soft-b', String(MainBg.brightness()));
            bd.addClass('fsc-soft');
        }
    }

    function softReturn() {
        softLeft = false;
        softReturnAt = Date.now();

        var bd = $('#fsc-backdrop');

        if (bd.length) {
            bd.removeClass('fsc-soft');
            runCardFixTimers();
        } else {
            resumeCard();
        }
    }

    // прозрачность цвета: 'rgba(0, 0, 0, 0.5)' -> 0.5, 'rgb(...)' -> 1, 'transparent' -> 0
    function alphaOf(c) {
        if (!c || c === 'transparent') return 0;

        var m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return 0;

        var parts = m[1].split(',');
        return parts.length > 3 ? parseFloat(parts[3]) : 1;
    }

    function describeEl(el) {
        var raw = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : el.className;
        var c = String(raw || '').split(/\s+/).filter(function (x) {
            return x && x.indexOf('fsc-') !== 0;
        }).slice(0, 2).join('.');

        return el.tagName.toLowerCase() + (c ? '.' + c : '');
    }

    function restoreCardFix() {
        softLeft = false;
        cardFixTimers.forEach(function (t) { clearTimeout(t); });
        cardFixTimers = [];

        try {
            $('body').removeClass('fsc-card-bg');
            $('#fsc-backdrop').remove();
            $(cardFix.els).removeClass('fsc-bd-fix fsc-nograd fsc-nobefore fsc-noafter fsc-nomask fsc-nofilter fsc-nocolor');

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
            var backEl = document.getElementById('fsc-backdrop');
            var mainEl = document.getElementById('fsc-mainbg');
            var touched = [];

            $('body').find('img, div, section, span').each(function () {
                var el = this;

                if (layerEl && (layerEl === el || layerEl.contains(el) || el.contains(layerEl))) return;
                if (backEl && (backEl === el || backEl.contains(el) || el.contains(backEl))) return;
                if (mainEl && (mainEl === el || mainEl.contains(el) || el.contains(mainEl))) return;

                var r = el.getBoundingClientRect();
                if (r.width < w * 0.35 || r.height < h * 0.5) return;

                // меню, настройки и окна не трогаем: иначе у них пропадает инверсия иконок при наведении
                if (el.closest && el.closest('.menu, .settings, .selectbox, .modal, .head, .navigation-bar')) return;
                if (el.querySelector && el.querySelector('.menu__item, .settings-folder')) return;

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
                // (градиентом или полупрозрачным цветом)
                ['::before', '::after'].forEach(function (ps) {
                    var pcs = window.getComputedStyle(el, ps);
                    var pbi = pcs.backgroundImage || '';
                    var pa = alphaOf(pcs.backgroundColor);
                    var has = pcs.content && pcs.content !== 'none' && pcs.content !== 'normal';

                    if (pbi.indexOf('gradient') !== -1 || (has && pa > 0.05)) {
                        $(el).addClass(ps === '::before' ? 'fsc-nobefore' : 'fsc-noafter');
                        cardFix.els.push(el);
                        flags += ps === '::before' ? 'b' : 'a';
                    }
                });

                // затемнение фильтром (яркость, размытие подложки)
                var flt = cs.filter || '';
                var bflt = cs.webkitBackdropFilter || cs.backdropFilter || '';
                if ((flt && flt !== 'none') || (bflt && bflt !== 'none')) {
                    $(el).addClass('fsc-nofilter');
                    cardFix.els.push(el);
                    flags += 'F';
                }

                // пустой элемент с полупрозрачным цветом поверх экрана - это и есть затемнение
                var ca = alphaOf(cs.backgroundColor);
                if (ca > 0.05 && ca < 1 && el.children.length === 0 && !$.trim(el.textContent || '')) {
                    $(el).addClass('fsc-nocolor');
                    cardFix.els.push(el);
                    flags += 'C';
                }

                // прозрачность картинки только отмечаем в подсказке: менять её опасно
                var opv = parseFloat(cs.opacity);
                if (opv > 0.02 && opv < 0.97) flags += 'O' + opv.toFixed(2);

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

    // Рисуем картинку фона сами: на весь экран, по центру, без затемнения и фильтров.
    // Она лежит поверх общего фона Lampa, так что любое затемнение Lampa под ней не видно.
    // конец адреса картинки (имя файла): по нему узнаём ту же картинку при другом размере
    function imgTail(u) {
        return String(u || '').split('?')[0].split('/').pop();
    }

    function ensureBackdropLayer(src) {
        var cur = $('#fsc-backdrop');
        if (cur.length && cur.attr('data-src') === src) return;

        cur.remove();

        var layer = $('<div id="fsc-backdrop"><img alt=""></div>');
        layer.attr('data-src', src);
        layer.find('img').attr('src', src);

        // картинка карточки должна лежать над фоном списков, а не под ним
        var bg = $('#fsc-mainbg');
        if (!bg.length) bg = $('.background').first();

        if (bg.length) bg.after(layer);
        else $('body').prepend(layer);
    }

    // Адрес картинки фона по данным фильма: так слой можно показать в самый первый момент,
    // не дожидаясь, пока Lampa нарисует свою картинку (она чуть темнее).
    function backdropUrl(card) {
        try {
            if (!card) return '';

            if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.cardImgBackground === 'function') {
                var u = Lampa.Utils.cardImgBackground(card);
                if (u) return u;
            }

            if (card.backdrop_path && window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
                return Lampa.TMDB.image('t/p/w1280' + card.backdrop_path);
            }
        } catch (e) {}

        return '';
    }

    function quickBackdrop(e) {
        try {
            if (!opt('fsc_fix_backdrop', true)) return;

            var card = (e && e.data && e.data.movie) || (e && e.object && (e.object.card || e.object.movie));

            if (!card) {
                var act = Lampa.Activity.active();
                if (act && act.component === 'full') {
                    card = act.card || act.movie || (act.object && (act.object.card || act.object.movie));
                }
            }

            var src = backdropUrl(card);
            if (src) ensureBackdropLayer(src);
        } catch (err) {}
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

            if (src) {
                var cur = $('#fsc-backdrop');

                // слой уже есть и показывает ту же картинку: не трогаем, чтобы не мигало
                if (!cur.length || imgTail(cur.attr('data-src')) !== imgTail(src)) ensureBackdropLayer(src);
            }

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
    function runCardFixTimers() {
        [0, 250, 700, 1300, 2200, 3500, 5000].forEach(function (ms) {
            cardFixTimers.push(setTimeout(function () {
                syncCardBackground();
                fixCardBackdrop();
            }, ms));
        });
    }

    // открытие карточки: сбрасываем прошлые правки и сразу показываем основную картинку
    function beginCardFix(e) {
        restoreCardFix();
        if (!opt('fsc_fix_backdrop', true)) return;

        $('body').addClass('fsc-card-bg');
        quickBackdrop(e);
        runCardFixTimers();
    }

    // Возврат на карточку (например, со страницы торрентов): события "start" у карточки нет,
    // поэтому свой слой фона и правила нужно вернуть самим, иначе на секунду видна
    // родная картинка Lampa со сдвигом и затемнением
    function resumeCard() {
        try {
            if (!opt('fsc_fix_backdrop', true)) return;

            restoreCardFix();
            $('body').addClass('fsc-card-bg');
            quickBackdrop(null);
            runCardFixTimers();
        } catch (e) {}
    }

    // карточка загрузилась: ничего не сбрасываем (иначе картинка моргнёт), только дополняем
    function continueCardFix(e) {
        if (!opt('fsc_fix_backdrop', true)) return;

        $('body').addClass('fsc-card-bg');
        if (!$('#fsc-backdrop').length) quickBackdrop(e);
        runCardFixTimers();
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
        }, 5000);
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
        }, 4000);
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
        // Rutube не отдаёт кадры для анализа (CORS), а проба стоила лишних секунд перед стартом:
        // доступ к кадру запрашиваем, только если он точно был (в этом запуске приложения)
        var cors = (opts.cors === undefined) ? (zoomMode === 'auto' && corsState === true) : opts.cors;

        var layer = $(
            '<div id="' + LAYER_ID + '" class="trailer-bg">' +
                '<div class="trailer-bg__frame">' +
                    '<video playsinline loop autoplay poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"' + (sound ? '' : ' muted') + '></video>' +
                '</div>' +
            '</div>'
        );

        insertLayer(layer);

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
                return showVideo(url, id, my, { cors: false, alt: opts.alt, revealAt: opts.revealAt });
            }

            if (opts.alt) {
                dbg('выбранное качество не запустилось, беру обычный поток');
                return showVideo(opts.alt, id, my, { cors: false, revealAt: opts.revealAt });
            }

            // прямой поток не получился - запасной вариант: плеер Rutube (может показать рекламу)
            dbg('прямой поток не запустился, открываю плеер Rutube');
            showIframe('rutube', id);
        }

        video.muted = !sound;
        video.addEventListener('error', fail);

        // Видео начинает грузиться чуть раньше, чем нужно (без звука), и ждёт спрятанным.
        // Показываем его в назначенный момент: пауза до трейлера не растёт на время загрузки.
        var revealed = false;
        var revealTimer = null;

        video.addEventListener('playing', function () {
            clearTimeout(guard);

            if (revealed) return;

            var wait = (opts.revealAt || 0) - Date.now();

            if (wait > 80) {
                // уже играет, но показывать рано: ставим на паузу, буфер продолжает наполняться
                try { video.pause(); } catch (e) {}

                clearTimeout(revealTimer);
                revealTimer = setTimeout(function () {
                    if (my !== token || !layer.parent().length) return;

                    var p = video.play();
                    if (p && p.catch) p.catch(function () {});
                }, wait);

                return;
            }

            revealed = true;
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
            var hls = new window.Hls({ startFragPrefetch: true, maxBufferLength: 15, backBufferLength: 5 });
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

    // id трейлера на Rutube для уже открытых карточек (повторное открытие без поиска)
    var idCache = {};

    // Всё, что нужно для запуска, готовится заранее: поиск ролика, ссылка на поток, выбор качества.
    // cb({ id, url, alt }) или cb(null), если трейлера нет
    function prepareTrailer(card, my, cb) {
        var key = String(card.id) + ((card.name && !card.title) ? 't' : 'm');

        function withId(id) {
            if (my !== token) return;
            if (!id) return cb(null);

            idCache[key] = id;

            if (!opt('trailer_bg_rutube_direct', true)) return cb({ id: id });

            rutubeStream(id, function (url) {
                if (my !== token) return;
                if (!url) return cb({ id: id });

                bestStream(url, function (best, alt) {
                    if (my !== token) return;
                    cb({ id: id, url: best, alt: alt });
                });
            });
        }

        if (idCache[key]) return withId(idCache[key]);
        loadRutube(card, withId);
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
        var sound = !!opt('trailer_bg_sound', false);

        // Момент, когда трейлер должен появиться на экране. Поиск и ссылка на поток готовятся
        // сразу, а само видео без звука начинает грузиться на 2 секунды раньше показа.
        var revealAt = Date.now() + delay * 1000;
        var armed = false;
        var launched = false;
        var prepared; // undefined - ещё готовится, null - трейлера нет

        function launch() {
            if (launched || my !== token || !armed || prepared === undefined) return;
            launched = true;

            // трейлера нет - остаётся обычный фон
            if (!prepared) return dbg('не найден, остаётся обычный фон');

            dbg('нашёл, запускаю');
            watch();

            if (prepared.url) showVideo(prepared.url, prepared.id, my, { alt: prepared.alt, revealAt: sound ? 0 : revealAt });
            else showIframe('rutube', prepared.id);
        }

        var armDelay = sound ? delay * 1000 : Math.max(0, delay * 1000 - 2000);

        timer = setTimeout(function () {
            armed = true;
            launch();
        }, armDelay);

        prepareTrailer(card, my, function (p) {
            prepared = p;
            launch();
        });
    }

    // =====================================================================
    //  Настройки и запуск
    // =====================================================================

    function addSettings() {
        try {
            var queued = [];
            var queueParam = function (cfg) { queued.push(cfg); };

            Lampa.SettingsApi.addComponent({
                component: 'fullscreen_card',
                name: 'Страница фильма',
                icon: '<svg class="fsc-set-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 15h18" stroke="currentColor" stroke-width="2"/></svg>'
            });

            Lampa.SettingsApi.addComponent({
                component: 'fsc_trailers',
                name: 'Трейлеры',
                icon: '<svg class="fsc-set-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor"/></svg>'
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_hide_poster', type: 'trigger', 'default': true },
                field: {
                    name: 'Убрать постер в карточке',
                    description: 'Скрывает карточку-постер слева на странице фильма'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_bottom', type: 'trigger', 'default': true },
                field: {
                    name: 'Контент внизу экрана',
                    description: 'Название, кнопки и рейтинги внизу, фон на весь экран'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_layout', type: 'trigger', 'default': true },
                field: {
                    name: 'Расположение как в Cardify',
                    description: 'Год и страна под названием, рейтинги справа внизу'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_orig_title', type: 'trigger', 'default': true },
                field: {
                    name: 'Оригинальное название',
                    description: 'Показывать название на языке оригинала над основным'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_labels', type: 'trigger', 'default': true },
                field: {
                    name: 'Подписи на всех кнопках',
                    description: 'Текст у кнопок карточки виден всегда, а не только у выбранной'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_main_buttons', type: 'trigger', 'default': true },
                field: {
                    name: 'Только основные кнопки',
                    description: 'Оставить Онлайн, Торренты и Закладки, остальные кнопки убрать'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_hide_source', type: 'trigger', 'default': true },
                field: { name: 'Скрыть названия источников' }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_blue_progress', type: 'trigger', 'default': true },
                field: { name: 'Синяя полоска прогресса просмотра' }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_torrent_layout', type: 'trigger', 'default': true },
                field: {
                    name: 'Компактный список торрентов',
                    description: 'Детали раздачи в две строки'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_rate_logos', type: 'trigger', 'default': true },
                field: {
                    name: 'Цветные оценки с логотипами',
                    description: 'На странице фильма: значки вместо названий источников и цвет цифры по оценке'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_rate_colors', type: 'trigger', 'default': true },
                field: {
                    name: 'Цветные цифры оценок',
                    description: 'Цвет цифры зависит от оценки: красный, оранжевый, жёлтый, синий, зелёный'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_card_rating', type: 'trigger', 'default': true },
                field: {
                    name: 'Цветной рейтинг на карточках',
                    description: 'Плашка с оценкой на постерах в списках: зелёная, жёлтая или красная'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_card_kp', type: 'trigger', 'default': true },
                field: {
                    name: 'Рейтинг Кинопоиска на карточках',
                    description: 'Ищется в интернете и заменяет оценку TMDB. Если выключить, везде будет оценка TMDB'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_card_year', type: 'trigger', 'default': false },
                field: {
                    name: 'Год выпуска на карточках',
                    description: 'Плашка с годом слева внизу постера'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_btn_editor', type: 'trigger', 'default': true },
                field: {
                    name: 'Редактор кнопок',
                    description: 'Долгое нажатие на кнопку в карточке: скрыть, сдвинуть, переименовать'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_quick_exit', type: 'trigger', 'default': false },
                field: {
                    name: 'Выход без вопроса',
                    description: 'Не спрашивать подтверждение при выходе из приложения'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_enable', type: 'trigger', 'default': true },
                field: {
                    name: 'Трейлер на фоне',
                    description: 'Если трейлера нет, остаётся обычный фон'
                }
            });

            queueParam({
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

            queueParam({
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

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_fix_backdrop', type: 'trigger', 'default': true },
                field: {
                    name: 'Фон карточки без сдвига и затемнения',
                    description: 'Картинка остаётся по центру, затемнение слева убирается'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_hide_backdrop', type: 'trigger', 'default': true },
                field: {
                    name: 'Скрывать картинку фона при трейлере',
                    description: 'Пока играет трейлер, убирается неподвижная картинка фильма поверх видео'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_debug', type: 'trigger', 'default': false },
                field: {
                    name: 'Подсказки о запуске трейлера',
                    description: 'Короткие сообщения на экране: что нашлось и почему трейлер не играет'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_rutube_direct', type: 'trigger', 'default': true },
                field: {
                    name: 'Rutube без рекламы',
                    description: 'Играет прямой поток вместо плеера Rutube. Если не получилось, откроется обычный плеер'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'trailer_bg_sound', type: 'trigger', 'default': false },
                field: {
                    name: 'Трейлер со звуком',
                    description: 'Автозапуск со звуком может блокироваться системой'
                }
            });

            queueParam({
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
            queueParam({
                component: 'fullscreen_card',
                param: {
                    name: 'fsc_bg_bright',
                    type: 'select',
                    values: { '0.6': 'Темнее', '0.75': 'Средняя', '0.9': 'Светлая', '1': 'Самая светлая' },
                    'default': '0.9'
                },
                field: {
                    name: 'Яркость фона',
                    description: 'Яркость картинки на заднем плане главного экрана и списков'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: { name: 'fsc_fast_bg', type: 'trigger', 'default': true },
                field: {
                    name: 'Быстрая смена фона на главной',
                    description: 'Фон меняется сразу и без наложения картинок, фоны соседних постеров грузятся заранее'
                }
            });

            queueParam({
                component: 'fullscreen_card',
                param: {
                    name: 'fsc_ring_color',
                    type: 'select',
                    values: {
                        'white': 'Белый',
                        'green': 'Зелёный',
                        'yellow': 'Жёлтый',
                        'orange': 'Оранжевый',
                        'red': 'Красный',
                        'blue': 'Голубой',
                        'orig': 'Как в Lampa'
                    },
                    'default': 'white'
                },
                field: {
                    name: 'Цвет рамки выбранного торрента',
                    description: 'Рамка вокруг активного торрента, файла и серии в списках торрентов'
                }
            });

            queueParam({
                component: 'fsc_trailers',
                param: { name: 'trailer_bg_newest', type: 'trigger', 'default': true },
                field: {
                    name: 'Самый новый трейлер',
                    description: 'Если на Rutube несколько трейлеров к фильму, берётся добавленный последним: у него обычно лучше качество'
                }
            });

            // В меню остаются только нужные пункты: у каждой вкладки свой список и порядок
            var ORDER_MAIN = [
                'fsc_rate_logos',
                'fsc_card_rating',
                'fsc_card_kp',
                'fsc_fast_bg',
                'fsc_bg_bright',
                'fsc_ring_color'
            ];

            var ORDER_TRAILERS = [
                'trailer_bg_enable',
                'trailer_bg_sound',
                'trailer_bg_delay',
                'trailer_bg_newest'
            ];

            // все пункты про трейлеры (в том числе скрытые в обычном режиме) живут во вкладке "Трейлеры"
            var list = queued.map(function (cfg, i) {
                var name = cfg.param.name;
                var isTrailer = name.indexOf('trailer_bg_') === 0;
                var order = isTrailer ? ORDER_TRAILERS : ORDER_MAIN;
                var pos = order.indexOf(name);

                cfg.component = isTrailer ? 'fsc_trailers' : 'fullscreen_card';

                return { cfg: cfg, key: pos === -1 ? 1000 + i : pos, visible: pos !== -1 };
            }).sort(function (x, y) { return x.key - y.key; });

            list.forEach(function (it) {
                if (it.visible || SHOW_ADVANCED) Lampa.SettingsApi.addParam(it.cfg);
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

            // лишние кнопки убираем в любом блоке карточки, не только в основном
            body.find('.full-start__button').not(keep).remove();

            ['.view--online', '.view--torrent', '.button--book'].forEach(function (sel) {
                var b = body.find(sel).first();
                if (b.length) box.append(b);
            });

            // нужные кнопки на месте: показываем блок
            if (keep.length) {
                body.find('.full-start-new__buttons, .full-start__buttons, .buttons--container').addClass('fsc-btn-ready');
            }
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

    // круг размером с круг кнопки "Торренты" и треугольник, вырезанный внутри него
    var PLAY_CIRCLE = 'Плей в круге';

    var ICONS = [
        { name: PLAY_CIRCLE, svg: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path fill-rule="evenodd" d="M12 .8a11.2 11.2 0 1 0 0 22.4A11.2 11.2 0 0 0 12 .8zM9.2 7.2v9.6L17.4 12 9.2 7.2z"/></svg>' },
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
                // у кнопки "Смотреть" по умолчанию треугольник в круге, как у кнопки "Торренты"
                applyIcon(b, store('fsc_btn_icons', {})[id] || (/^view--online/.test(id) ? PLAY_CIRCLE : ''));

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

    // =====================================================================
    //  ЧАСТЬ 5. Оценки: логотипы и цвета на странице фильма, цветной рейтинг на карточках.
    //  Перенесено из прошлого плагина rating-quality.js. Классы плашек теперь с префиксом fsc-,
    //  всё включается настройками, а сетевые запросы идут через общий помощник (сначала
    //  сетевой модуль Lampa, который у тебя обходит блокировку CORS).
    // =====================================================================

    var Ratings = (function () {
        // Необязательный ключ с https://kinopoiskapiunofficial.tech (запасной поиск по названию).
        // Без него id Кинопоиска ищется бесплатно: в данных карточки и в Wikidata.
        var KP_API_KEY = '';

        var KP_SEARCH = 'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=';
        var STORE = 'rq_kp_cache2';
        var TTL = 7 * 24 * 3600 * 1000;

        var mem = {};
        var queue = [];
        var active = 0;

        // ---------- Иконки ----------

        function svgUri(svg) {
            return 'data:image/svg+xml,' + encodeURIComponent(svg);
        }

        var ICON_KP = svgUri(
            "<svg width='300' height='300' viewBox='0 0 300 300' fill='none' xmlns='http://www.w3.org/2000/svg'>" +
            "<mask id='m' style='mask-type:alpha' maskUnits='userSpaceOnUse' x='0' y='0' width='300' height='300'>" +
            "<circle cx='150' cy='150' r='150' fill='white'/></mask>" +
            "<g mask='url(#m)'><circle cx='150' cy='150' r='150' fill='black'/>" +
            "<path d='M300 45L145.26 127.827L225.9 45H181.2L126.3 121.203V45H89.9999V255H126.3V178.92L181.2 255H225.9" +
            "L147.354 174.777L300 255V216L160.776 160.146L300 169.5V130.5L161.658 139.494L300 84V45Z' fill='url(#g)'/></g>" +
            "<defs><radialGradient id='g' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse' " +
            "gradientTransform='translate(89.9999 45) rotate(45) scale(296.985)'>" +
            "<stop offset='0.5' stop-color='#FF5500'/><stop offset='1' stop-color='#BBFF00'/></radialGradient></defs></svg>"
        );

        var ICON_TMDB = svgUri(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150"><defs>' +
            '<linearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#90cea1"/>' +
            '<stop offset="56%" stop-color="#3cbec9"/><stop offset="100%" stop-color="#00b3e5"/></linearGradient>' +
            '<style>.t{font-weight:bold;fill:url(#grad);text-anchor:start;dominant-baseline:middle;font-size:70px}</style></defs>' +
            '<text class="t" x="0" y="50" textLength="150" lengthAdjust="spacingAndGlyphs">TM</text>' +
            '<text class="t" x="0" y="120" textLength="150" lengthAdjust="spacingAndGlyphs">DB</text></svg>'
        );

        var ICON_IMDB = svgUri(
            "<svg fill='#ffcc00' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><path d='M 0 7 L 0 25 L 32 25 L 32 7 Z " +
            "M 2 9 L 30 9 L 30 23 L 2 23 Z M 5 11.6875 L 5 20.3125 L 7 20.3125 L 7 11.6875 Z M 8.09375 11.6875 " +
            "L 8.09375 20.3125 L 10 20.3125 L 10 15.5 L 10.90625 20.3125 L 12.1875 20.3125 L 13 15.5 L 13 20.3125 " +
            "L 14.8125 20.3125 L 14.8125 11.6875 L 12 11.6875 L 11.5 15.8125 L 10.8125 11.6875 Z M 15.90625 11.6875 " +
            "L 15.90625 20.1875 L 18.3125 20.1875 C 19.613281 20.1875 20.101563 19.988281 20.5 19.6875 " +
            "C 20.898438 19.488281 21.09375 19 21.09375 18.5 L 21.09375 13.3125 C 21.09375 12.710938 20.898438 12.199219 20.5 12 " +
            "C 20 11.800781 19.8125 11.6875 18.3125 11.6875 Z M 22.09375 11.8125 L 22.09375 20.3125 L 23.90625 20.3125 " +
            "C 23.90625 20.3125 23.992188 19.710938 24.09375 19.8125 C 24.292969 19.8125 25.101563 20.1875 25.5 20.1875 " +
            "C 26 20.1875 26.199219 20.195313 26.5 20.09375 C 26.898438 19.894531 27 19.613281 27 19.3125 L 27 14.3125 " +
            "C 27 13.613281 26.289063 13.09375 25.6875 13.09375 C 25.085938 13.09375 24.511719 13.488281 24.3125 13.6875 " +
            "L 24.3125 11.8125 Z M 18 13 C 18.398438 13 18.8125 13.007813 18.8125 13.40625 L 18.8125 18.40625 " +
            "C 18.8125 18.804688 18.300781 18.8125 18 18.8125 Z M 24.59375 14 C 24.695313 14 24.8125 14.105469 24.8125 14.40625 " +
            "L 24.8125 18.6875 C 24.8125 18.886719 24.792969 19.09375 24.59375 19.09375 C 24.492188 19.09375 24.40625 18.988281 24.40625 18.6875 " +
            "L 24.40625 14.40625 C 24.40625 14.207031 24.394531 14 24.59375 14 Z'/></svg>"
        );

        var ICON_STAR = svgUri(
            "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='#ffd700' stroke='#ffd700' stroke-width='1'>" +
            "<path d='M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z'/></svg>"
        );

        var ICON_CUB = svgUri(
            "<svg width='110' height='104' viewBox='0 0 110 104' fill='none' xmlns='http://www.w3.org/2000/svg'>" +
            "<path d='M81.6744 103.11C98.5682 93.7234 110 75.6967 110 55C110 24.6243 85.3757 0 55 0C24.6243 0 0 24.6243 0 55" +
            "C0 75.6967 11.4318 93.7234 28.3255 103.11C14.8869 94.3724 6 79.224 6 62C6 34.938 27.938 13 55 13C82.062 13 104 34.938 104 62" +
            "C104 79.224 95.1131 94.3725 81.6744 103.11Z' fill='white'/>" +
            "<path d='M92.9546 80.0076C95.5485 74.5501 97 68.4446 97 62C97 38.804 78.196 20 55 20C31.804 20 13 38.804 13 62" +
            "C13 68.4446 14.4515 74.5501 17.0454 80.0076C16.3618 77.1161 16 74.1003 16 71C16 49.4609 33.4609 32 55 32" +
            "C76.5391 32 94 49.4609 94 71C94 74.1003 93.6382 77.1161 92.9546 80.0076Z' fill='white'/>" +
            "<path d='M55 89C69.3594 89 81 77.3594 81 63C81 57.9297 79.5486 53.1983 77.0387 49.1987C82.579 54.7989 86 62.5 86 71" +
            "C86 88.1208 72.1208 102 55 102C37.8792 102 24 88.1208 24 71C24 62.5 27.421 54.7989 32.9613 49.1987" +
            "C30.4514 53.1983 29 57.9297 29 63C29 77.3594 40.6406 89 55 89Z' fill='white'/>" +
            "<path d='M73 63C73 72.9411 64.9411 81 55 81C45.0589 81 37 72.9411 37 63C37 53.0589 45.0589 45 55 45" +
            "C64.9411 45 73 53.0589 73 63Z' fill='white'/></svg>"
        );

        // ---------- Стили ----------

        function addStyle() {
            if (document.getElementById('fsc-rq-style')) return;

            var g = 'body.fsc-rates ';

            var icon = function (sel, uri) {
                return g + sel + '{background-image:url("' + uri + '")}';
            };

            var s = document.createElement('style');
            s.id = 'fsc-rq-style';
            s.textContent =
                // плашки на карточках
                '.fsc-rq-rate,.fsc-rq-year{position:absolute;bottom:0.5em;z-index:5;padding:0.15em 0.6em;' +
                'border-radius:2em;font-size:1.13em;font-weight:bold;line-height:1.4;white-space:nowrap;' +
                'box-shadow:0 0.1em 0.3em rgba(0,0,0,.4)}' +
                '.fsc-rq-rate{right:0.5em}' +
                '.fsc-rq-year{left:0.5em;background:rgba(0,0,0,.75);color:#fff}' +
                '.fsc-rq-kp{height:1.15em;width:1.15em;vertical-align:middle;margin-right:0.3em}' +

                // рейтинги на странице фильма: вместо названий источников значки
                g + '.full-start__rate .source--name,' + g + '.rate--kp>div:last-child,' + g + '.rate--imdb>div:last-child{' +
                'font-size:0;color:transparent;display:inline-block !important;width:20px;height:20px;' +
                'background-repeat:no-repeat;background-position:center;background-size:contain;margin-left:6px}' +
                '@media (min-width:481px){' + g + '.full-start__rate .source--name,' + g + '.rate--kp>div:last-child,' + g + '.rate--imdb>div:last-child{' +
                'width:28px;height:28px}}' +
                icon('.rate--tmdb .source--name', ICON_TMDB) +
                icon('.rate--imdb>div:last-child,' + g + '.rate--imdb .source--name', ICON_IMDB) +
                icon('.rate--kp>div:last-child,' + g + '.rate--kp .source--name', ICON_KP) +
                icon('.rate--lampa .source--name,' + g + '.rate--bylampa .source--name,' + g + '.rate--bylampa_full .source--name', ICON_STAR) +
                icon('.rate--cub .source--name', ICON_CUB);

            document.head.appendChild(s);
        }

        // Цвета цифр на странице фильма, как в color_vote
        function ratingColor(r) {
            if (r <= 3) return '#e74c3c';
            if (r <= 5) return '#e67e22';
            if (r <= 6.5) return '#f1c40f';
            if (r < 8) return '#3498db';
            return '#2ecc71';
        }

        // Цвет плашки рейтинга на карточке
        function pillStyle(r) {
            if (r >= 7) return { bg: '#4caf50', fg: '#fff' };
            if (r >= 5) return { bg: '#fdc92f', fg: '#1a1a1a' };
            return { bg: '#e53935', fg: '#fff' };
        }

        function colorPage() {
            if (!opt('fsc_rate_colors', true)) return;

            var nodes = document.querySelectorAll('.full-start__rate > div, .info__rate > span');

            for (var i = 0; i < nodes.length; i++) {
                var v = parseFloat(nodes[i].textContent.trim());
                if (v > 0 && v <= 10) nodes[i].style.color = ratingColor(v);
            }
        }

        function getData(el) {
            return el.card_data || $(el).data('card') || null;
        }

        function getYear(d) {
            var date = d.release_date || d.first_air_date || '';
            var y = parseInt(String(date).slice(0, 4), 10);
            if (y) return y;
            return d.year ? parseInt(d.year, 10) || null : null;
        }

        // ---------- Кэш ----------

        function kpKey(d) {
            return ((d.name || d.first_air_date) ? 't' : 'm') + d.id;
        }

        function getCached(key) {
            if (key in mem) return mem[key];

            try {
                var store = Lampa.Storage.cache(STORE, 1000, {});
                var e = store[key];
                if (e && Date.now() - e.t < TTL) {
                    mem[key] = e.v;
                    return e.v;
                }
            } catch (err) {}

            return undefined;
        }

        function putCached(key, v) {
            mem[key] = v;

            try {
                var store = Lampa.Storage.cache(STORE, 1000, {});
                store[key] = { v: v, t: Date.now() };
                Lampa.Storage.set(STORE, store);
            } catch (err) {}
        }

        // ---------- Рейтинг Кинопоиска ----------

        function kpIdOf(d) {
            return d.kinopoisk_id || d.kp_id || d.kinopoiskId || d.filmId || null;
        }

        function pickFilm(films, d, year) {
            var names = [d.title, d.name, d.original_title, d.original_name].map(norm).filter(Boolean);

            var matches = films.filter(function (f) {
                var n = [norm(f.nameRu), norm(f.nameEn)];
                return names.some(function (x) { return n.indexOf(x) >= 0; });
            });

            if (!matches.length) return null;

            if (year) {
                var byYear = matches.filter(function (f) {
                    var fy = parseInt(f.year, 10);
                    return fy && Math.abs(fy - year) <= 1;
                });
                return byYear.length ? byYear[0] : null;
            }

            return matches[0];
        }

        // Поиск по названию (нужен ключ)
        function fetchKpSearch(d, key, cb) {
            var title = d.title || d.name || d.original_title || d.original_name;
            if (!title) return cb(null, 'NOTITLE');

            var net = new Lampa.Reguest();
            net.timeout(15000);

            net.silent(KP_SEARCH + encodeURIComponent(title), function (json) {
                var film = pickFilm((json && json.films) || [], d, getYear(d));
                var raw = film ? String(film.rating || '') : '';
                var v = /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : 0;

                putCached(key, v);
                cb(v || null, v ? null : 'SRCHNO');
            }, function () {
                cb(null, 'SRCHERR');
            }, false, {
                headers: { 'X-API-KEY': KP_API_KEY }
            });
        }

        // Оценка по id Кинопоиска: открытый адрес, ключ не нужен
        function fetchKpById(id, key, cb) {
            httpText('https://rating.kinopoisk.ru/' + id + '.xml', function (err, text) {
                if (err) return cb(null, 'XMLERR');

                var m = /<kp_rating[^>]*>\s*([\d.]+)\s*<\/kp_rating>/.exec(String(text));
                var v = m ? parseFloat(m[1]) : 0;

                if (v) putCached(key, v);
                cb(v || null, v ? null : 'XMLNO');
            }, 10000);
        }

        // Бесплатный поиск id Кинопоиска через Wikidata по id TMDB (карточки собираем в один запрос)
        var wdPending = [];
        var wdTimer = null;

        function resolveWikidata(d, key, cb) {
            wdPending.push({ d: d, key: key, cb: cb });
            if (!wdTimer) wdTimer = setTimeout(flushWikidata, 400);
        }

        function flushWikidata() {
            wdTimer = null;

            var items = wdPending.splice(0, 40);
            if (wdPending.length) wdTimer = setTimeout(flushWikidata, 1500);
            if (!items.length) return;

            var movies = [];
            var shows = [];

            items.forEach(function (it) {
                var q = '"' + it.d.id + '"';
                if (it.key.charAt(0) === 't') shows.push(q);
                else movies.push(q);
            });

            // P4947 - TMDb movie ID, P4983 - TMDb TV series ID, P2603 - Kinopoisk film ID
            var parts = [];
            if (movies.length) parts.push('{ VALUES ?tmdb { ' + movies.join(' ') + ' } ?i wdt:P4947 ?tmdb . BIND("m" AS ?t) }');
            if (shows.length) parts.push('{ VALUES ?tmdb { ' + shows.join(' ') + ' } ?i wdt:P4983 ?tmdb . BIND("t" AS ?t) }');

            var sparql = 'SELECT ?tmdb ?t ?kp WHERE { ' + parts.join(' UNION ') + ' ?i wdt:P2603 ?kp . }';
            var url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);

            httpJson(url, function (err, json) {
                // Непонятный ответ не кэшируем, чтобы не запомнить ошибку как "id нет"
                if (err) {
                    items.forEach(function (it) { it.cb(null, 'WDERR'); });
                    return;
                }

                if (!json || !json.results || !json.results.bindings) {
                    items.forEach(function (it) { it.cb(null, 'WDBAD'); });
                    return;
                }

                var map = {};

                json.results.bindings.forEach(function (b) {
                    var k = b.t.value + b.tmdb.value;
                    if (!map[k]) map[k] = parseInt(b.kp.value, 10) || 0;
                });

                items.forEach(function (it) {
                    var kid = map[it.key] || 0;
                    putCached('i' + it.key, kid);
                    it.cb(kid || null, kid ? null : 'NOID');
                });
            }, 20000);
        }

        function pump() {
            while (active < 2 && queue.length) {
                var job = queue.shift();
                active++;

                job(function () {
                    active--;
                    setTimeout(pump, 150);
                });
            }
        }

        // cb(оценка или null, код причины)
        function requestKp(d, cb) {
            var key = kpKey(d);

            var cached = getCached(key);
            if (cached !== undefined) return cb(cached || null, cached ? null : 'C0');

            var id = kpIdOf(d);
            var cid = getCached('i' + key);
            if (!id && cid) id = cid;

            function runById(kid) {
                queue.push(function (done) {
                    fetchKpById(kid, key, function (v, why) {
                        cb(v, why);
                        done();
                    });
                });
                pump();
            }

            function runSearch(why) {
                if (!KP_API_KEY) return cb(null, why || 'NOKEY');

                queue.push(function (done) {
                    fetchKpSearch(d, key, function (v, w) {
                        cb(v, w);
                        done();
                    });
                });
                pump();
            }

            if (id) return runById(id);

            if (cid === undefined) {
                return resolveWikidata(d, key, function (found, why) {
                    if (found) runById(found);
                    else runSearch(why);
                });
            }

            runSearch('NOID');
        }

        // ---------- Плашки на карточках ----------

        function decorate(el) {
            if (el.__rq) return;

            // у карточки долго нет данных - больше не проверяем, чтобы просмотр не замедлялся
            if (el.__rqn > 8) return;

            // старый плагин rating-quality уже повесил свои плашки: не дублируем
            if (el.querySelector('.rq-rate, .rq-year')) return;

            var wantRate = opt('fsc_card_rating', true);
            var wantYear = opt('fsc_card_year', false);
            if (!wantRate && !wantYear) return;

            var d = getData(el);

            if (!d) {
                el.__rqn = (el.__rqn || 0) + 1;
                return;
            }

            el.__rq = true;

            var view = el.querySelector('.card__view') || el;
            if (getComputedStyle(view).position === 'static') view.style.position = 'relative';

            // Год: полупрозрачная плашка слева внизу
            if (wantYear) {
                var y = getYear(d);

                if (y) {
                    var yearEl = document.createElement('div');
                    yearEl.className = 'fsc-rq-year';
                    yearEl.textContent = y;
                    view.appendChild(yearEl);
                }
            }

            if (!wantRate) return;

            // Рейтинг: цветная плашка справа внизу
            var rate = null;

            function setRate(source, value) {
                if (!rate) {
                    rate = document.createElement('div');
                    rate.className = 'fsc-rq-rate';
                    view.appendChild(rate);

                    // родная плашка рейтинга Lampa выглядывала из-под нашей
                    el.classList.add('fsc-has-rate');
                }

                var c = pillStyle(value);
                rate.style.background = c.bg;
                rate.style.color = c.fg;
                rate.textContent = '';

                if (source === 'kp') {
                    var logo = document.createElement('img');
                    logo.className = 'fsc-rq-kp';
                    logo.src = ICON_KP;

                    logo.onerror = function () {
                        if (logo.parentNode) logo.parentNode.replaceChild(document.createTextNode('КП '), logo);
                    };

                    rate.appendChild(logo);
                } else {
                    rate.appendChild(document.createTextNode('★ '));
                }

                rate.appendChild(document.createTextNode(value.toFixed(1)));
            }

            var r = parseFloat(d.vote_average);
            if (r > 0) setRate('tmdb', r);

            // рейтинг Кинопоиска ищется отдельно и заменяет оценку TMDB, когда найдётся
            if (d.id && opt('fsc_card_kp', true)) {
                requestKp(d, function (v) {
                    if (v) setRate('kp', v);
                });
            }
        }

        function scan() {
            var cards = document.querySelectorAll('.card');
            for (var i = 0; i < cards.length; i++) decorate(cards[i]);

            colorPage();
        }

        var scheduled = false;

        function schedule() {
            if (scheduled) return;
            scheduled = true;

            setTimeout(function () {
                scheduled = false;
                scan();
            }, 200);
        }

        var started = false;

        function init() {
            if (started) return;
            started = true;

            addStyle();
            scan();

            if (window.MutationObserver) {
                new MutationObserver(schedule).observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }

        return {
            start: init,
            scan: scan,
            decorate: decorate,
            ratingColor: ratingColor,
            pillStyle: pillStyle,
            getYear: getYear,
            pickFilm: pickFilm
        };
    })();

    // =====================================================================
    //  ЧАСТЬ 6. Быстрая смена фона на главном экране
    //  1) заранее скачиваем фоны соседних постеров, чтобы при переключении они были в кэше;
    //  Смену самого фона делает модуль MainBg ниже.
    // =====================================================================

    var FastBg = (function () {
        var done = {};       // адреса, которые уже запрашивали
        var doneCount = 0;
        var pending = [];    // очередь на загрузку
        var running = 0;
        var lastFocus = null;
        var changeTimer = null;
        var started = false;

        var PARALLEL = 1;    // сколько картинок качаем одновременно
        var MAX_REMEMBER = 200;
        var inflight = [];   // картинки, которые качаются прямо сейчас
        var idleTimer = null;

        function pump() {
            // пока грузится картинка, которую нужно показать, предзагрузку не начинаем
            if (typeof MainBg !== 'undefined' && MainBg.loading && MainBg.loading()) {
                clearTimeout(idleTimer);
                idleTimer = setTimeout(pump, 150);
                return;
            }

            while (running < PARALLEL && pending.length) {
                var url = pending.shift();

                if (done[url]) continue;

                done[url] = 1;
                doneCount++;

                // чтобы список не рос бесконечно
                if (doneCount > MAX_REMEMBER) {
                    done = {};
                    doneCount = 0;
                }

                running++;

                var img = new Image();
                img._u = url;
                inflight.push(img);

                img.onload = img.onerror = function () {
                    var i = inflight.indexOf(this);
                    if (i !== -1) inflight.splice(i, 1);

                    running--;
                    pump();
                };

                img.src = url;
            }
        }

        // фокус ушёл дальше: недокачанные предзагрузки отменяем, иначе очередь растёт и
        // нужная картинка ждёт позади ненужных (так фон со временем начинал тормозить)
        function abortAll() {
            pending = [];

            inflight.forEach(function (im) {
                im.onload = im.onerror = null;

                try { im.src = ''; } catch (e) {}
                delete done[im._u];
            });

            inflight = [];
            running = 0;
        }

        function cardData(el) {
            return el.card_data || $(el).data('card') || null;
        }

        // Постеры одного ряда: ищем ближайший блок, где лежит несколько карточек
        function rowCards(cur) {
            var node = cur.parentNode;

            for (var level = 0; node && level < 3; level++, node = node.parentNode) {
                var list = [];

                for (var i = 0; i < node.children.length; i++) {
                    var ch = node.children[i];
                    if (ch.classList && ch.classList.contains('card')) list.push(ch);
                }

                if (list.length > 1 && list.indexOf(cur) !== -1) return list;
            }

            return [];
        }

        // Ближайшие постеры: сначала следующие вперёд, потом назад
        function neighbors(cur) {
            var list = rowCards(cur);
            var idx = list.indexOf(cur);
            if (idx === -1) return [];

            var out = [];

            [1, 2, -1, 3].forEach(function (d) {
                var c = list[idx + d];
                if (c) out.push(c);
            });

            return out;
        }

        function onFocusChange() {
            var cur = document.querySelector('.card.focus');

            if (!cur || cur === lastFocus) return;
            lastFocus = cur;

            if (!opt('fsc_fast_bg', true)) return;

            // старые задачи уже не нужны: фокус ушёл дальше
            abortAll();
            clearTimeout(idleTimer);

            // качаем соседей, только когда листание остановилось
            idleTimer = setTimeout(function () {
                neighbors(cur).forEach(function (c) {
                    var url = MainBg.sharp(backdropUrl(cardData(c)));
                    if (url && !done[url] && pending.indexOf(url) === -1) pending.push(url);
                });

                pump();
            }, 220);
        }

        function start() {
            if (started) return;
            started = true;

            setInterval(onFocusChange, 250);
        }

        return {
            start: start,
            focusChanged: onFocusChange,
            neighbors: neighbors
        };
    })();

    // =====================================================================
    //  ЧАСТЬ 7. Свой фон списков: мгновенная смена без наложения и настраиваемая яркость
    //  Lampa меняет фон плавным переходом: новая картинка проявляется поверх старой, и на секунду
    //  видны обе. Здесь фон рисуем сами: две картинки, новая показывается только когда полностью
    //  загрузилась, и сразу целиком. Яркость задаётся настройкой. Короткая пауза 40 мс нужна только
    //  для того, чтобы при зажатой стрелке не грузить каждую картинку.
    // =====================================================================

    var MainBg = (function () {
        var ID = 'fsc-mainbg';
        var imgs = [];
        var dim = null;
        var front = 0;
        var current = '';
        var token = 0;
        var timer = null;
        var started = false;
        var hideTimer = null; // отложенное скрытие: Lampa на секунду просит "пустой" фон при смене страниц
        var loader = null;    // загрузка новой картинки (при смене отменяем прошлую, чтобы очередь не росла)
        var loading = false;

        // Lampa на странице торрентов и в некоторых списках даёт маленькую размытую картинку (w200 и т.п.).
        // Берём ту же картинку в полном размере: фон получается резким, как на странице фильма.
        function sharp(url) {
            return String(url || '').replace(/\/t\/p\/w(?:92|154|185|200|300|342|500)\//, '/t/p/original/');
        }

        // 'full' - страница фильма (фон без затемнения), 'torrents' - торренты (чуть размыт и затемнён)
        function screen() {
            try {
                var act = Lampa.Activity.active();
                if (!act) return '';
                if (act.component === 'torrents') return 'torrents';
                if (act.component === 'full') return 'full';
            } catch (e) {}

            return '';
        }

        function abortLoad() {
            if (loader) {
                loader.onload = loader.onerror = null;

                try { loader.src = ''; } catch (e) {}
                loader = null;
            }

            loading = false;
        }

        // яркость фона: 1 - как есть, меньше - темнее
        function brightness() {
            var v = parseFloat(opt('fsc_bg_bright', '0.9'));
            if (!(v > 0)) v = 0.9;
            return Math.min(1, Math.max(0.3, v));
        }

        function ensure() {
            var el = document.getElementById(ID);

            if (!el) {
                el = document.createElement('div');
                el.id = ID;

                var a = document.createElement('img');
                var b = document.createElement('img');
                a.alt = '';
                b.alt = '';

                var d = document.createElement('div');
                d.className = 'fsc-mainbg__dim';

                el.appendChild(a);
                el.appendChild(b);
                el.appendChild(d);

                // пока нет готовой картинки, слой скрыт: иначе чёрный слой закрыл бы родной фон Lampa
                el.style.display = 'none';

                // сразу над общим фоном Lampa и под всем остальным
                var bg = document.querySelector('.background');
                if (bg && bg.parentNode) bg.parentNode.insertBefore(el, bg.nextSibling);
                else document.body.insertBefore(el, document.body.firstChild);

                front = 0;
                current = '';
            }

            imgs = [el.children[0], el.children[1]];
            dim = el.children[2];
            var scr = screen();

            // на странице фильма фон закрывает свой слой без затемнения, поэтому яркость здесь не меняем:
            // иначе при возврате на карточку светлые участки на долю секунды становятся ярче
            dim.style.opacity = String(1 - brightness());

            el.classList.remove('fsc-soft');

            return el;
        }

        function hide() {
            token++;
            current = '';
            abortLoad();

            var el = document.getElementById(ID);
            if (el) el.style.display = 'none';
        }

        function show(url) {
            clearTimeout(hideTimer);

            if (!url) return hide();

            // та же картинка в другом размере (Lampa на возврате просит свой адрес): не меняем,
            // иначе на мгновение меняется резкость
            if (current && url !== current && imgTail(url) === imgTail(current) && imgTail(url)) url = current;

            if (url === current) {
                var cur = document.getElementById(ID);

                if (cur) {
                    cur.style.display = '';
                    ensure();
                }

                return;
            }

            var el = ensure();
            var my = ++token;
            var back = imgs[1 - front];

            // прошлая незавершённая загрузка уже не нужна: отменяем, чтобы она не занимала канал
            abortLoad();

            // грузим отдельным объектом: видимые картинки не трогаем, пока новая не готова
            var mine = new Image();
            loader = mine;
            loading = true;

            mine.onload = function () {
                if (my !== token) return; // уже просят другую картинку

                loading = false;
                if (loader === mine) loader = null;

                back.src = url;

                var go = function () {
                    if (my !== token) return;

                    var old = imgs[front];

                    // новая картинка включается целиком, старая выключается: наложения нет
                    back.style.opacity = '1';
                    old.style.opacity = '0';

                    front = 1 - front;
                    current = url;
                    el.style.display = '';

                    // скрытую картинку освобождаем: иначе в памяти копятся большие кадры и список тормозит
                    setTimeout(function () {
                        if (old !== imgs[front]) old.removeAttribute('src');
                    }, 400);
                };

                if (typeof back.decode === 'function') back.decode().then(go, go);
                else go();
            };

            mine.onerror = function () {
                if (loader === mine) {
                    loader = null;
                    loading = false;
                }
            };

            mine.src = url;
        }

        function install() {
            try {
                var bg = window.Lampa && Lampa.Background;

                if (!bg || bg._fsc_main || typeof bg.change !== 'function' || typeof bg.immediately !== 'function') return;

                var origChange = bg.change;
                var origImmediately = bg.immediately;

                bg.change = function (url) {
                    // выключено - работает как в Lampa
                    if (!opt('fsc_fast_bg', true)) {
                        hide();
                        return origChange.apply(this, arguments);
                    }

                    // фон убирают: ждём, не придёт ли сразу новая картинка (при возврате на карточку
                    // иначе на мгновение открывается родной фон Lampa)
                    if (!url) {
                        clearTimeout(timer);
                        clearTimeout(hideTimer);
                        hideTimer = setTimeout(hide, 300);
                        return origChange.apply(this, arguments);
                    }

                    var big = sharp(url);

                    clearTimeout(timer);
                    timer = setTimeout(function () { show(big); }, 40);
                };

                bg.immediately = function (url) {
                    if (!opt('fsc_fast_bg', true)) {
                        hide();
                        return origImmediately.apply(this, arguments);
                    }

                    if (!url) {
                        clearTimeout(timer);
                        clearTimeout(hideTimer);
                        hideTimer = setTimeout(hide, 300);
                        return origImmediately.apply(this, arguments);
                    }

                    var big = sharp(url);

                    clearTimeout(timer);
                    show(big);

                    // родной фон Lampa тоже обновляем, чтобы её состояние не расходилось с нашим
                    var args = Array.prototype.slice.call(arguments);
                    args[0] = big;

                    return origImmediately.apply(this, args);
                };

                bg._fsc_main = true;
            } catch (e) {}
        }

        function start() {
            if (started) return;
            started = true;
            install();
        }

        // фон страницы торрентов: та же картинка, что на странице фильма (на случай, если Lampa
        // поставила свою размытую картинку в обход Background)
        function ensureTorrents() {
            try {
                var act = Lampa.Activity.active();
                if (!act || act.component !== 'torrents') return;

                var movie = act.movie || act.card || (act.object && (act.object.movie || act.object.card));
                var url = sharp(backdropUrl(movie));
                if (!url) return;

                if (url !== current && !loading) show(url);

                // применяем размытие и затемнение страницы торрентов
                if (document.getElementById(ID)) ensure();
            } catch (e) {}
        }

        return {
            start: start,
            install: install,
            show: show,
            hide: hide,
            brightness: brightness,
            sharp: sharp,
            loading: function () { return loading; },
            ensureTorrents: ensureTorrents
        };
    })();

    // =====================================================================
    //  ЧАСТЬ 8. Цвет рамки активного торрента и файла
    //  Рамка может быть нарисована границей, обводкой или тенью, и заранее неизвестно, чем именно.
    //  Границу и обводку перекрашивает стиль выше, а если рамка сделана тенью, тень
    //  перекрашивается здесь на время, пока элемент в фокусе (потом возвращается как было).
    // =====================================================================

    var Ring = (function () {
        var COLORS = {
            white: '#ffffff',
            green: '#4cd964',
            yellow: '#ffd54a',
            orange: '#ff9f43',
            red: '#ff5252',
            blue: '#4fc3f7'
        };

        var started = false;

        // выбранный цвет; пустая строка - "как в Lampa", рамку не трогаем
        function chosen() {
            return COLORS[String(opt('fsc_ring_color', 'white'))] || '';
        }

        // цвет рамки как переменная на body: по ней работают правила из addStyles
        function apply() {
            var hex = chosen();
            var b = document.body;
            if (!b || !b.style) return;

            b.classList.remove('fsc-ringfix');

            if (hex) {
                b.style.setProperty('--fsc-ring', hex);
                b.classList.add('fsc-ring');
            } else {
                b.style.removeProperty('--fsc-ring');
                b.classList.remove('fsc-ring');
            }
        }

        function start() {
            if (started) return;
            started = true;

            apply();
        }

        return { start: start, apply: apply, chosen: chosen };
    })();

    // =====================================================================
    //  Мелкие правки интерфейса: номер серии внутри рамки, инверсия иконок меню
    // =====================================================================

    var UiFix = (function () {
        var started = false;
        var lastMenu = null;
        var menuTimers = [];
        var MENU_SEL = '.menu__item.focus, .settings-folder.focus, .menu .selector.focus, .settings .selector.focus';
        var ICO_SEL = '.menu__ico, .settings-folder__icon, [class*="__ico"]';
        var NAME_SEL = '.settings-folder__name, .menu__text, [class*="__name"], [class*="__text"]';

        // Подсказка на экране: что плагин видит у выбранного пункта меню (чтобы разобраться, если иконка не инвертируется).
        // Чтобы отключить, поставьте false.
        var MENU_DIAG = true;
        var diagAt = 0;
        var SHAPES = 'path,rect,circle,polygon,line,polyline,ellipse';

        // ---------- номер серии ----------

        function fixSerials() {
            var list = document.querySelectorAll('.torrent-serial:not([data-fsc-nb="1"])');

            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                var tries = parseInt(it.getAttribute('data-fsc-nbt') || '0', 10) + 1;
                var found = false;
                var kids = it.querySelectorAll('*');

                for (var j = 0; j < kids.length; j++) {
                    var k = kids[j];
                    if (k.children.length) continue;

                    var t = String(k.textContent || '').replace(/\s+/g, '');
                    if (!/^\d{1,4}$/.test(t)) continue;
                    if (window.getComputedStyle(k).position !== 'absolute') continue;

                    k.classList.add('fsc-serial-badge');
                    found = true;
                    break;
                }

                it.setAttribute('data-fsc-nbt', String(tries));
                if (found || tries > 12) it.setAttribute('data-fsc-nb', '1');
            }
        }

        // ---------- инверсия иконок меню ----------

        function parseColor(c) {
            var m = /rgba?\(([^)]+)\)/.exec(c || '');
            if (!m) return null;

            var p = m[1].split(',').map(function (x) { return parseFloat(x); });
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        }

        function lum(c) {
            return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        }

        function bgLum(el) {
            var cur = el;

            while (cur && cur.nodeType === 1) {
                var c = parseColor(window.getComputedStyle(cur).backgroundColor);
                if (c && c.a >= 0.5) return lum(c);
                cur = cur.parentNode;
            }

            return 0;
        }

        function iconColor(ico) {
            var shapes = ico.querySelectorAll(SHAPES);

            for (var i = 0; i < shapes.length; i++) {
                var cs = window.getComputedStyle(shapes[i]);
                var f = cs.fill !== 'none' ? parseColor(cs.fill) : null;
                if (f && f.a > 0.3) return f;

                var st = cs.stroke !== 'none' ? parseColor(cs.stroke) : null;
                if (st && st.a > 0.3) return st;
            }

            return null;
        }

        // иконка без видимых фигур (картинка, <use>, маска): берём цвет самого блока иконки
        function iconColorFallback(ico) {
            if (ico.querySelector('img')) return { r: 255, g: 255, b: 255, a: 1 };

            var cs = window.getComputedStyle(ico);
            var mask = cs.webkitMaskImage || cs.maskImage || '';
            var bg = parseColor(cs.backgroundColor);

            if (mask && mask !== 'none' && bg && bg.a > 0.3) return bg;

            return parseColor(cs.color);
        }

        // уже есть инверсия от темы: на самой иконке, на картинке внутри неё или выше, до пункта меню
        function themeInverted(ico, item) {
            var inner = ico.querySelector('svg, img');

            if (inner && (window.getComputedStyle(inner).filter || '').indexOf('invert') !== -1) return true;

            var cur = ico;

            while (cur && cur.nodeType === 1) {
                var f = window.getComputedStyle(cur).filter || '';
                if (f.indexOf('invert') !== -1) return true;
                if (cur === item) break;
                cur = cur.parentNode;
            }

            return false;
        }

        // яркость цвета текста пункта: у выбранного пункта тема красит текст в тёмный, иконка должна быть такого же тона
        function textLum(item) {
            var t = item.querySelector(NAME_SEL) || item;
            var c = parseColor(window.getComputedStyle(t).color);

            return c ? lum(c) : null;
        }

        function diag(msg) {
            if (!MENU_DIAG || Date.now() - diagAt < 6000) return;
            diagAt = Date.now();

            try { Lampa.Noty.show('Иконка меню: ' + msg); } catch (e) {}
        }

        // Иконка по тону не совпадает с текстом выбранного пункта (светлая иконка на светлой плашке) - инвертируем.
        // Если тема уже инвертирует сама, это учитывается, двойной инверсии не будет.
        function evalMenu(item) {
            try {
                var ico = item.querySelector(ICO_SEL);

                if (!ico) {
                    if (item.matches && item.matches('.menu__item, .settings-folder')) diag('иконка не найдена (' + describeEl(item) + ')');
                    return;
                }

                ico.classList.remove('fsc-ico-inv');
                ico.style.removeProperty('filter');
                ico.style.setProperty('transition', 'none', 'important');

                var c = iconColor(ico);
                var viaFallback = false;

                if (!c) {
                    c = iconColorFallback(ico);
                    viaFallback = true;
                }

                if (!c) return diag('цвет иконки не определён: ' + String(ico.innerHTML || '').slice(0, 90));

                var L = lum(c);
                var inv = themeInverted(ico, item);
                if (inv) L = 1 - L;

                var T = textLum(item);
                var need = T !== null ? Math.abs(L - T) > 0.5 : Math.abs(L - bgLum(item)) < 0.35;

                if (need) {
                    ico.classList.add('fsc-ico-inv');
                    ico.style.setProperty('filter', 'invert(1)', 'important');
                }

                diag(describeEl(item) + (viaFallback ? ' (иконка без фигур)' : '') + ': иконка ' + L.toFixed(2) + ', текст ' + (T === null ? '?' : T.toFixed(2)) +
                    ', тема ' + (inv ? 'инвертирует' : 'нет') + ' -> ' + (need ? 'инвертирую' : 'не трогаю'));
            } catch (e) {}
        }

        function clearMenu(item) {
            try {
                var ico = item && item.querySelector(ICO_SEL);

                if (ico) {
                    ico.classList.remove('fsc-ico-inv');
                    ico.style.removeProperty('filter');
                }
            } catch (e) {}
        }

        function tickMenu() {
            var cur = document.querySelector(MENU_SEL);
            if (cur === lastMenu) return;

            menuTimers.forEach(clearTimeout);
            menuTimers = [];

            clearMenu(lastMenu);
            lastMenu = cur;
            if (!cur) return;

            // фон пункта может появляться с анимацией, поэтому проверяем несколько раз
            [0, 120, 350, 700].forEach(function (ms) {
                menuTimers.push(setTimeout(function () {
                    if (lastMenu === cur) evalMenu(cur);
                }, ms));
            });
        }

        function start() {
            if (started) return;
            started = true;

            setInterval(function () {
                fixSerials();
                tickMenu();
            }, 120);
        }

        return { start: start };
    })();

    // =====================================================================
    //  ЧАСТЬ 9. Убираем вкладку Shots из настроек Lampa
    // =====================================================================

    var SettingsClean = (function () {
        var started = false;
        var timer = null;

        function clean() {
            try {
                var folders = document.querySelectorAll('.settings-folder');

                for (var i = 0; i < folders.length; i++) {
                    var f = folders[i];
                    var comp = String(f.getAttribute('data-component') || '');
                    var nameEl = f.querySelector('.settings-folder__name');
                    var name = String((nameEl ? nameEl.textContent : f.textContent) || '').replace(/^\s+|\s+$/g, '');

                    var isShots = /shots/i.test(comp) || (/\bshots\b/i.test(name) && name.length < 40);

                    if (isShots && f.parentNode) f.parentNode.removeChild(f);
                }
            } catch (e) {}
        }

        function later() {
            clearTimeout(timer);
            timer = setTimeout(clean, 100);
        }

        function start() {
            if (started) return;
            started = true;

            // сразу после открытия настроек, пока Lampa не собрала список для пульта
            try {
                if (Lampa.Settings && Lampa.Settings.listener) {
                    Lampa.Settings.listener.follow('open', function () {
                        clean();
                        setTimeout(clean, 0);
                    });
                }
            } catch (e) {}

            // запасной путь, если события нет
            if (window.MutationObserver) {
                new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
            }
        }

        return { start: start, clean: clean };
    })();

    function start() {
        addStyles();
        installQuickExit();
        addSettings();
        apply();

        try {
            Ratings.start();
        } catch (err) {
            console.log('fullscreen_card: ratings error', err);
        }

        try {
            FastBg.start();
            MainBg.start();
        } catch (err) {
            console.log('fullscreen_card: fast background error', err);
        }

        try {
            Ring.start();
            UiFix.start();
        } catch (err) {
            console.log('fullscreen_card: ring error', err);
        }

        try {
            SettingsClean.start();
        } catch (err) {
            console.log('fullscreen_card: settings cleanup error', err);
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'start' && e.type !== 'complite') return;

            apply();

            if (e.type === 'start') beginCardFix(e);
            else continueCardFix(e);

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
                    var soft = isSoftPage(comp) && document.body.classList.contains('fsc-card-bg');

                    // Закрывающаяся страница торрентов/онлайна шлёт свои события уже после возврата на карточку:
                    // тогда слой фона снова притемнялся на долю секунды. Такие события игнорируем.
                    if (soft && (type === 'destroy' || type === 'archive' || Date.now() - softReturnAt < 1200)) return;

                    var keepBg = hiddenBackdrops.slice();

                    stopTrailer();

                    if (soft) softLeave(keepBg);
                    else restoreCardFix();
                }

                // вернулись на карточку: сразу возвращаем свой фон
                if (comp === 'full' && type === 'start') {
                    if (softLeft) softReturn();
                    else if (!document.body.classList.contains('fsc-card-bg')) resumeCard();
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

                if (act && act.component === 'full') {
                    if (softLeft) softReturn();
                    else if (!document.body.classList.contains('fsc-card-bg')) resumeCard();
                    return;
                }

                // между страницами Lampa на мгновение может не отдавать активную: ничего не сбрасываем
                if (softLeft && !act) return;

                // страницы торрентов и онлайна: состояние карточки сохраняем до возврата
                if (softLeft && act && isSoftPage(act.component)) {
                    if (document.getElementById(LAYER_ID)) stopTrailer();
                    if (act.component === 'torrents') MainBg.ensureTorrents();
                    return;
                }

                // страница торрентов: фон как на странице фильма
                if (act && act.component === 'torrents') MainBg.ensureTorrents();

                $('body').removeClass('fsc-card-bg');
                $('#fsc-backdrop').remove();
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

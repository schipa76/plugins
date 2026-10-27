(function () {
    'use strict';

    if (window.__lampa_rq_plugin) return;
    window.__lampa_rq_plugin = true;

    // Необязательный ключ с https://kinopoiskapiunofficial.tech (запасной поиск по названию).
    // Без него id Кинопоиска ищется бесплатно: в данных карточки и в Wikidata.
    var KP_API_KEY = '';

    // Отладка: к году на карточке добавляется код, показывающий, на каком шаге остановился поиск КП.
    // Когда всё заработает, поставьте false.
    var DEBUG = true;

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
        if (document.getElementById('rq-style')) return;

        var icon = function (sel, uri) {
            return sel + '{background-image:url("' + uri + '")}';
        };

        var s = document.createElement('style');
        s.id = 'rq-style';
        s.textContent =
            // плашки на карточках
            '.rq-rate,.rq-year{position:absolute;bottom:0.5em;z-index:5;padding:0.15em 0.6em;' +
            'border-radius:2em;font-size:1.13em;font-weight:bold;line-height:1.4;white-space:nowrap;' +
            'box-shadow:0 0.1em 0.3em rgba(0,0,0,.4)}' +
            '.rq-rate{right:0.5em}' +
            '.rq-year{left:0.5em;background:rgba(0,0,0,.75);color:#fff}' +
            '.rq-kp{height:1.15em;width:1.15em;vertical-align:middle;margin-right:0.3em}' +

            // рейтинги на странице фильма: вместо названий источников значки
            '.full-start__rate .source--name,.rate--kp>div:last-child,.rate--imdb>div:last-child{' +
            'font-size:0;color:transparent;display:inline-block;width:20px;height:20px;' +
            'background-repeat:no-repeat;background-position:center;background-size:contain;margin-left:6px}' +
            '@media (min-width:481px){.full-start__rate .source--name,.rate--kp>div:last-child,.rate--imdb>div:last-child{' +
            'width:28px;height:28px}}' +
            icon('.rate--tmdb .source--name', ICON_TMDB) +
            icon('.rate--imdb>div:last-child,.rate--imdb .source--name', ICON_IMDB) +
            icon('.rate--kp>div:last-child,.rate--kp .source--name', ICON_KP) +
            icon('.rate--lampa .source--name,.rate--bylampa .source--name,.rate--bylampa_full .source--name', ICON_STAR) +
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

    function norm(s) {
        return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
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
        var net = new Lampa.Reguest();
        net.timeout(10000);

        net.silent('https://rating.kinopoisk.ru/' + id + '.xml', function (text) {
            var m = /<kp_rating[^>]*>\s*([\d.]+)\s*<\/kp_rating>/.exec(String(text));
            var v = m ? parseFloat(m[1]) : 0;

            if (v) putCached(key, v);
            cb(v || null, v ? null : 'XMLNO');
        }, function () {
            cb(null, 'XMLERR');
        }, false, {
            dataType: 'text'
        });
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

        var net = new Lampa.Reguest();
        net.timeout(20000);

        net.silent(url, function (json) {
            try {
                if (typeof json === 'string') json = JSON.parse(json);
            } catch (e) {
                json = null;
            }

            // Непонятный ответ не кэшируем, чтобы не запомнить ошибку как "id нет"
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
        }, function () {
            items.forEach(function (it) { it.cb(null, 'WDERR'); });
        });
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

        var d = getData(el);
        if (!d) return;
        el.__rq = true;

        var view = el.querySelector('.card__view') || el;
        if (getComputedStyle(view).position === 'static') view.style.position = 'relative';

        // Год: полупрозрачная плашка слева внизу
        var y = getYear(d);
        var yearEl = null;

        if (y) {
            yearEl = document.createElement('div');
            yearEl.className = 'rq-year';
            yearEl.textContent = y;
            view.appendChild(yearEl);
        }

        function note(code) {
            if (DEBUG && yearEl && code) yearEl.textContent = y + ' ' + code;
        }

        // Рейтинг: цветная плашка справа внизу
        var rate = null;

        function setRate(source, value) {
            if (!rate) {
                rate = document.createElement('div');
                rate.className = 'rq-rate';
                view.appendChild(rate);
            }

            var c = pillStyle(value);
            rate.style.background = c.bg;
            rate.style.color = c.fg;
            rate.textContent = '';

            if (source === 'kp') {
                var logo = document.createElement('img');
                logo.className = 'rq-kp';
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

        if (d.id) {
            requestKp(d, function (v, why) {
                if (v) {
                    setRate('kp', v);
                    note('KP');
                } else {
                    note(why);
                }
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

    function start() {
        addStyle();
        scan();

        new MutationObserver(schedule).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();

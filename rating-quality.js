(function () {
    'use strict';

    if (window.__lampa_rq_plugin) return;
    window.__lampa_rq_plugin = true;

    // КЛЮЧ НЕ ОБЯЗАТЕЛЕН. id Кинопоиска ищется бесплатно: сначала в данных карточки, затем в Wikidata
    // по id TMDB. Ключ с https://kinopoiskapiunofficial.tech нужен только как запасной поиск по названию.
    var KP_API_KEY = '';

    var KP_SEARCH = 'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=';
    var STORE = 'rq_kp_cache';
    var TTL = 7 * 24 * 3600 * 1000; // кэш на неделю, чтобы экономить лимит запросов

    // Логотип Кинопоиска (чёрный круг с буквой K)
    var KP_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
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

    var mem = {};
    var queue = [];
    var active = 0;

    function addStyle() {
        if (document.getElementById('rq-style')) return;

        var s = document.createElement('style');
        s.id = 'rq-style';
        s.textContent =
            '.rq-rate,.rq-year{position:absolute;bottom:0.5em;z-index:5;padding:0.15em 0.6em;' +
            'border-radius:2em;font-size:1.13em;font-weight:bold;line-height:1.4;white-space:nowrap;' +
            'background:rgba(0,0,0,.8);color:#fff;box-shadow:0 0.1em 0.3em rgba(0,0,0,.4)}' +
            '.rq-rate{right:0.5em}' +
            '.rq-year{left:0.5em}' +
            '.rq-kp{height:1.15em;width:1.15em;vertical-align:middle;margin-right:0.3em}';
        document.head.appendChild(s);
    }

    // Цвета оценок, как в плагине color_vote
    function ratingColor(r) {
        if (r <= 3) return '#e74c3c';
        if (r <= 5) return '#e67e22';
        if (r <= 6.5) return '#f1c40f';
        if (r < 8) return '#3498db';
        return '#2ecc71';
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

    // Цветные оценки на странице фильма (как в color_vote)
    function colorPage() {
        var nodes = document.querySelectorAll('.full-start__rate > div, .info__rate > span');

        for (var i = 0; i < nodes.length; i++) {
            var v = parseFloat(nodes[i].textContent.trim());
            if (v > 0 && v <= 10) nodes[i].style.color = ratingColor(v);
        }
    }

    // ---------- Рейтинг Кинопоиска ----------

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

    function norm(s) {
        return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
    }

    // Ищем в результатах Кинопоиска тот же фильм: совпадение названия и года (допуск 1 год)
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

    function fetchKp(d, key, cb) {
        var title = d.title || d.name || d.original_title || d.original_name;
        if (!title) return cb(null);

        var net = new Lampa.Reguest();
        net.timeout(15000);

        net.silent(KP_SEARCH + encodeURIComponent(title), function (json) {
            var film = pickFilm((json && json.films) || [], d, getYear(d));
            var raw = film ? String(film.rating || '') : '';

            // Для ещё не вышедших фильмов API отдаёт проценты ожидания - пропускаем
            var v = /^\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : 0;

            putCached(key, v);
            cb(v || null);
        }, function () {
            cb(null);
        }, false, {
            headers: { 'X-API-KEY': KP_API_KEY }
        });
    }

    function kpIdOf(d) {
        return d.kinopoisk_id || d.kp_id || d.kinopoiskId || d.filmId || null;
    }

    // Открытый адрес Кинопоиска, ключ не нужен
    function fetchKpById(id, key, cb) {
        var net = new Lampa.Reguest();
        net.timeout(10000);

        net.silent('https://rating.kinopoisk.ru/' + id + '.xml', function (text) {
            var m = /<kp_rating[^>]*>\s*([\d.]+)\s*<\/kp_rating>/.exec(String(text));
            var v = m ? parseFloat(m[1]) : 0;

            putCached(key, v);
            cb(v || null);
        }, function () {
            cb(null);
        }, false, {
            dataType: 'text'
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

    // ---------- Бесплатный поиск id Кинопоиска через Wikidata (по id TMDB) ----------

    var wdPending = [];
    var wdTimer = null;

    function resolveWikidata(d, key, cb) {
        wdPending.push({ d: d, key: key, cb: cb });
        if (!wdTimer) wdTimer = setTimeout(flushWikidata, 400);
    }

    // Все карточки, появившиеся за короткое время, спрашиваем одним запросом
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

            var rows = (json && json.results && json.results.bindings) || [];
            var map = {};

            rows.forEach(function (b) {
                var k = b.t.value + b.tmdb.value;
                if (!map[k]) map[k] = parseInt(b.kp.value, 10) || 0;
            });

            items.forEach(function (it) {
                var kid = map[it.key] || 0;
                putCached('i' + it.key, kid);
                it.cb(kid || null);
            });
        }, function () {
            items.forEach(function (it) { it.cb(null); });
        });
    }

    function requestKp(d, cb) {
        var key = kpKey(d);

        var cached = getCached(key);
        if (cached !== undefined) return cb(cached || null);

        var id = kpIdOf(d);
        var cid = getCached('i' + key);
        if (!id && cid) id = cid;

        function runById(kid) {
            queue.push(function (done) {
                fetchKpById(kid, key, function (v) {
                    cb(v);
                    done();
                });
            });
            pump();
        }

        // Запасной вариант: поиск по названию, только если задан ключ
        function runSearch() {
            if (!KP_API_KEY) return;

            queue.push(function (done) {
                fetchKp(d, key, function (v) {
                    cb(v);
                    done();
                });
            });
            pump();
        }

        if (id) return runById(id);

        if (cid === undefined) {
            return resolveWikidata(d, key, function (found) {
                if (found) runById(found);
                else runSearch();
            });
        }

        runSearch();
    }

    // ---------- Плашки на карточках ----------

    function decorate(el) {
        if (el.__rq) return;

        var d = getData(el);
        if (!d) return;
        el.__rq = true;

        var view = el.querySelector('.card__view') || el;
        if (getComputedStyle(view).position === 'static') view.style.position = 'relative';

        // Рейтинг: справа внизу, белая звезда или «КП» и цветная цифра
        var rate = null;

        function setRate(source, value) {
            if (!rate) {
                rate = document.createElement('div');
                rate.className = 'rq-rate';
                view.appendChild(rate);
            }

            rate.textContent = '';

            if (source === 'kp') {
                var logo = document.createElement('img');
                logo.className = 'rq-kp';
                logo.src = KP_LOGO;

                // Если логотип не загрузился, показываем текст «КП»
                logo.onerror = function () {
                    if (logo.parentNode) logo.parentNode.replaceChild(document.createTextNode('КП '), logo);
                };

                rate.appendChild(logo);
            } else {
                rate.appendChild(document.createTextNode('★ '));
            }

            var num = document.createElement('span');
            num.style.color = ratingColor(value);
            num.textContent = value.toFixed(1);
            rate.appendChild(num);
        }

        var r = parseFloat(d.vote_average);
        if (r > 0) setRate('tmdb', r);

        if (d.id) {
            requestKp(d, function (v) {
                if (v) setRate('kp', v);
            });
        }

        // Год: отдельная плашка слева внизу
        var y = getYear(d);
        if (y) {
            var year = document.createElement('div');
            year.className = 'rq-year';
            year.textContent = y;
            view.appendChild(year);
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

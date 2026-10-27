(function () {
    'use strict';

    if (window.__lampa_rq_plugin) return;
    window.__lampa_rq_plugin = true;

    // Отладка: вместо пустого качества показывает код причины
    var DEBUG = false;

    var qCache = {};

    function addStyle() {
        if (document.getElementById('rq-style')) return;

        var s = document.createElement('style');
        s.id = 'rq-style';
        s.textContent =
            '.rq-rate,.rq-qual,.rq-year{padding:0.15em 0.6em;border-radius:2em;font-size:1.13em;' +
            'font-weight:bold;line-height:1.4;white-space:nowrap;box-shadow:0 0.1em 0.3em rgba(0,0,0,.4)}' +
            '.rq-rate{position:absolute;right:0.5em;bottom:0.5em;z-index:5}' +
            '.rq-left{position:absolute;left:0.5em;bottom:0.5em;z-index:5;display:flex;' +
            'flex-direction:column;align-items:flex-start;gap:0.3em}' +
            '.rq-qual{background:rgba(0,0,0,.75);color:#3b82f6}' +
            '.rq-year{background:rgba(0,0,0,.75);color:#fff}';
        document.head.appendChild(s);
    }

    // Цвет плашки рейтинга: 7+ зелёная, 5-7 жёлтая, ниже 5 красная
    function ratingStyle(r) {
        if (r >= 7) return { bg: '#4caf50', fg: '#fff' };
        if (r >= 5) return { bg: '#fdc92f', fg: '#1a1a1a' };
        return { bg: '#e53935', fg: '#fff' };
    }

    // Цвета плашки качества: фон и цвет текста
    var QUALITY_COLORS = {
        '4K': { bg: '#4caf50', fg: '#fff' },
        'FHD': { bg: '#2196f3', fg: '#fff' },
        'HD': { bg: '#fdc92f', fg: '#1a1a1a' },
        'WEB': { bg: '#fb8c00', fg: '#fff' },
        'TS': { bg: '#e53935', fg: '#fff' }
    };

    function qualityColor(q) {
        return QUALITY_COLORS[q] || { bg: '#607d8b', fg: '#fff' };
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

    function normQuality(q) {
        if (!q) return null;
        if (typeof q === 'object') q = q.title || q.name || '';

        q = String(q).toUpperCase().trim();
        if (!q) return null;
        if (q.indexOf('4K') >= 0 || q.indexOf('UHD') >= 0 || q.indexOf('2160') >= 0) return '4K';
        if (q.indexOf('1080') >= 0) return 'FHD';
        if (q.indexOf('720') >= 0) return 'HD';
        return q;
    }

    // Качество, которое уже есть в данных или на самой карточке
    function realQuality(el, d) {
        var q = normQuality(d.quality || d.release_quality || d.quality_name);
        if (q) return q;

        var n = el.querySelector('.card__quality');
        return n ? normQuality(n.textContent) : null;
    }

    // Оценка по датам релиза в TMDB (через прокси самой Lampa), только для фильмов:
    // дисковый релиз после 2016 года -> 4K, цифровой -> WEB, старый дисковый или ТВ -> HD, только кино -> TS
    var UHD_START = Date.UTC(2016, 0, 1);

    function calcQuality(json) {
        var now = Date.now();
        var uhd = false;
        var web = false;
        var hd = false;
        var theatre = null;

        (json && json.results || []).forEach(function (country) {
            (country.release_dates || []).forEach(function (rd) {
                var t = new Date(rd.release_date).getTime();
                if (!t || t > now) return;

                if (rd.type === 5) {
                    if (t >= UHD_START) uhd = true;
                    else hd = true;
                } else if (rd.type === 4) web = true;
                else if (rd.type === 6) hd = true;
                else if (rd.type === 2 || rd.type === 3) {
                    if (theatre === null || t < theatre) theatre = t;
                }
            });
        });

        if (uhd) return '4K';
        if (web) return 'WEB';
        if (hd) return 'HD';
        if (theatre !== null) return (now - theatre > 180 * 86400000) ? 'HD' : 'TS';
        return null;
    }

    function estimateQuality(d, cb) {
        if (!d.id) return cb(DEBUG ? 'NOID' : null);
        if (d.name || d.first_air_date) return cb(DEBUG ? 'TV' : null);

        var key = 'm' + d.id;
        if (key in qCache) return cb(qCache[key]);

        try {
            var net = new Lampa.Reguest();
            var tmdbKey = (Lampa.TMDB && typeof Lampa.TMDB.key === 'function') ? Lampa.TMDB.key() : '';
            var url = Lampa.TMDB.api('movie/' + d.id + '/release_dates?api_key=' + tmdbKey);

            net.silent(url, function (json) {
                var q = calcQuality(json);
                qCache[key] = q || (DEBUG ? 'N/A' : null);
                cb(qCache[key]);
            }, function () {
                cb(DEBUG ? 'ERR' : null);
            });
        } catch (e) {
            cb(DEBUG ? 'EXC' : null);
        }
    }

    function decorate(el) {
        if (el.__rq) return;

        var d = getData(el);
        if (!d) return;
        el.__rq = true;

        var view = el.querySelector('.card__view') || el;
        if (getComputedStyle(view).position === 'static') view.style.position = 'relative';

        // Рейтинг: цветная плашка справа внизу
        var r = parseFloat(d.vote_average);
        if (r > 0) {
            var c = ratingStyle(r);
            var rate = document.createElement('div');
            rate.className = 'rq-rate';
            rate.style.background = c.bg;
            rate.style.color = c.fg;
            rate.textContent = '★ ' + r.toFixed(1);
            view.appendChild(rate);
        }

        // Слева внизу: плашка качества (над ней) и плашка года
        var left = document.createElement('div');
        left.className = 'rq-left';

        var qual = document.createElement('div');
        qual.className = 'rq-qual';
        qual.style.display = 'none';
        left.appendChild(qual);

        var y = getYear(d);
        if (y) {
            var year = document.createElement('div');
            year.className = 'rq-year';
            year.textContent = y;
            left.appendChild(year);
        }

        view.appendChild(left);

        function setQuality(q) {
            if (!q) return;
            qual.textContent = q;
            var qc = qualityColor(q);
            qual.style.background = qc.bg;
            qual.style.color = qc.fg;
            qual.style.display = '';
        }

        var real = realQuality(el, d);
        if (real) setQuality(real);
        else {
            var answered = false;

            if (DEBUG) setQuality('…');

            setTimeout(function () {
                if (!answered && DEBUG) setQuality('TMO');
            }, 6000);

            estimateQuality(d, function (q) {
                answered = true;
                setQuality(q);
            });
        }
    }

    function scan() {
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) decorate(cards[i]);
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

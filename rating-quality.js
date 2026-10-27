(function () {
    'use strict';

    if (window.__lampa_rq_plugin) return;
    window.__lampa_rq_plugin = true;

    var qCache = {};

    function addStyle() {
        if (document.getElementById('rq-style')) return;

        var s = document.createElement('style');
        s.id = 'rq-style';
        s.textContent =
            '.rq-badge{position:absolute;left:0.4em;bottom:0.4em;z-index:5;display:flex;gap:0.4em;' +
            'align-items:center;padding:0.2em 0.5em;border-radius:0.3em;background:rgba(0,0,0,.75);' +
            'color:#fff;font-size:1.13em;font-weight:bold;white-space:nowrap}' +
            '.rq-badge .rq-q{color:#3b82f6}';
        document.head.appendChild(s);
    }

    // Цвет рейтинга: чем выше, тем зеленее
    function ratingColor(r) {
        if (r >= 8) return '#22c55e';
        if (r >= 7) return '#84cc16';
        if (r >= 6) return '#eab308';
        if (r >= 5) return '#f97316';
        return '#ef4444';
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

    // Оценка по датам релиза в TMDB (через прокси самой Lampa), только для фильмов
    function calcQuality(json) {
        var now = Date.now();
        var home = false;
        var theatre = null;

        (json && json.results || []).forEach(function (country) {
            (country.release_dates || []).forEach(function (rd) {
                var t = new Date(rd.release_date).getTime();
                if (!t || t > now) return;

                if (rd.type === 4 || rd.type === 5 || rd.type === 6) home = true;
                else if (rd.type === 2 || rd.type === 3) {
                    if (theatre === null || t < theatre) theatre = t;
                }
            });
        });

        if (home) return 'HD';
        if (theatre !== null) return (now - theatre > 180 * 86400000) ? 'HD' : 'TS';
        return null;
    }

    function estimateQuality(d, cb) {
        if (!d.id || d.name || d.first_air_date) return cb(null);

        var key = 'm' + d.id;
        if (key in qCache) return cb(qCache[key]);

        try {
            var net = new Lampa.Reguest();

            net.silent(Lampa.TMDB.api('movie/' + d.id + '/release_dates'), function (json) {
                qCache[key] = calcQuality(json);
                cb(qCache[key]);
            }, function () {
                cb(null);
            });
        } catch (e) {
            cb(null);
        }
    }

    function decorate(el) {
        if (el.__rq) return;

        var d = getData(el);
        if (!d) return;
        el.__rq = true;

        var r = parseFloat(d.vote_average);
        var y = getYear(d);

        var badge = document.createElement('div');
        badge.className = 'rq-badge';
        badge.style.display = 'none';

        var qWrap = document.createElement('span');
        qWrap.style.display = 'none';
        qWrap.innerHTML = '<span class="rq-q"></span> <span>•</span>';
        badge.appendChild(qWrap);

        var rest = [];
        if (r > 0) rest.push('<span style="color:' + ratingColor(r) + '">★ ' + r.toFixed(1) + '</span>');
        if (y) rest.push('<span>' + y + '</span>');

        var restWrap = document.createElement('span');
        restWrap.innerHTML = rest.join(' <span>•</span> ');
        badge.appendChild(restWrap);

        if (rest.length) badge.style.display = 'flex';

        function setQuality(q) {
            if (!q) return;
            qWrap.querySelector('.rq-q').textContent = q;
            qWrap.style.display = '';
            badge.style.display = 'flex';
        }

        var view = el.querySelector('.card__view') || el;
        if (getComputedStyle(view).position === 'static') view.style.position = 'relative';
        view.appendChild(badge);

        var real = realQuality(el, d);
        if (real) setQuality(real);
        else estimateQuality(d, setQuality);
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

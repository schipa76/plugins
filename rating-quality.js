(function () {
    'use strict';

    if (window.__lampa_rq_plugin) return;
    window.__lampa_rq_plugin = true;

    function addStyle() {
        if (document.getElementById('rq-style')) return;

        var s = document.createElement('style');
        s.id = 'rq-style';
        s.textContent =
            '.rq-badge{position:absolute;left:0.4em;bottom:0.4em;z-index:5;display:flex;gap:0.4em;' +
            'align-items:center;padding:0.2em 0.5em;border-radius:0.3em;background:rgba(0,0,0,.75);' +
            'color:#fff;font-size:0.85em;font-weight:bold;white-space:nowrap}' +
            '.rq-badge .rq-star{color:#22c55e}' +
            '.rq-badge .rq-q{color:#3b82f6}';
        document.head.appendChild(s);
    }

    // Данные фильма берём из самой карточки, без запросов в TMDB
    function getData(el) {
        return el.card_data || $(el).data('card') || null;
    }

    function getYear(d) {
        var date = d.release_date || d.first_air_date || '';
        var y = parseInt(String(date).slice(0, 4), 10);
        if (y) return y;
        return d.year ? parseInt(d.year, 10) || null : null;
    }

    // Качество показываем только если оно реально есть в данных
    function getQuality(d) {
        var q = d.quality;
        if (!q) return null;
        if (typeof q === 'object') q = q.title || q.name || '';

        q = String(q).toUpperCase();
        if (!q) return null;
        if (q.indexOf('4K') >= 0 || q.indexOf('UHD') >= 0 || q.indexOf('2160') >= 0) return '4K';
        if (q.indexOf('1080') >= 0) return 'FHD';
        if (q.indexOf('720') >= 0) return 'HD';
        return q;
    }

    function decorate(el) {
        if (el.__rq) return;

        var d = getData(el);
        if (!d) return;
        el.__rq = true;

        var parts = [];
        var q = getQuality(d);
        var r = parseFloat(d.vote_average);
        var y = getYear(d);

        if (q) parts.push('<span class="rq-q">' + q + '</span>');
        if (r > 0) parts.push('<span><span class="rq-star">★</span> ' + r.toFixed(1) + '</span>');
        if (y) parts.push('<span>' + y + '</span>');
        if (!parts.length) return;

        var view = el.querySelector('.card__view') || el;
        if (getComputedStyle(view).position === 'static') view.style.position = 'relative';

        var badge = document.createElement('div');
        badge.className = 'rq-badge';
        badge.innerHTML = parts.join('<span>•</span>');
        view.appendChild(badge);
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

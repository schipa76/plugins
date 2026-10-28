/*!
 * Мои рейтинги — аккуратные плашки рейтингов в карточке фильма.
 *
 * Берёт рейтинги, которые Lampa уже показывает (TMDB, IMDb, Кинопоиск, CUB),
 * и оформляет их: тёмная плашка, число окрашено по оценке, справа логотип сервиса.
 * Плашки «16+» и «Выпущено» получают тонкую белую рамку.
 *
 * Цвет числа: до 4 — красный, 4–6.9 — жёлтый, 7–7.9 — синий, от 8 — зелёный.
 * Пустые рейтинги (0 или «—») скрываются.
 *
 * Работает со стандартной разметкой Lampa (.full-start__rate). Если другой плагин
 * интерфейса рисует рейтинги по-своему, отключите его или этот плагин.
 */
(function () {
    'use strict';

    if (window.my_ratings_plugin) return;
    window.my_ratings_plugin = true;

    /* ---------- логотипы (простые SVG, зашиты в файл) ---------- */
    var LOGOS = {
        tmdb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40">' +
            '<text x="32" y="17" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="19" fill="#3fd6c4">TM</text>' +
            '<text x="32" y="37" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="19" fill="#3fd6c4">DB</text></svg>',
        imdb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32">' +
            '<rect x="2" y="2" width="60" height="28" rx="5" fill="none" stroke="#f5c518" stroke-width="3"/>' +
            '<text x="32" y="23" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="17" fill="#f5c518">IMDb</text></svg>',
        kp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb300"/><stop offset="1" stop-color="#ff5500"/></linearGradient></defs>' +
            '<circle cx="20" cy="20" r="20" fill="#111"/>' +
            '<rect x="10" y="8" width="5" height="24" fill="url(#g)"/>' +
            '<polygon points="15,20 28,8 31,11 18,22" fill="url(#g)"/>' +
            '<polygon points="15,20 31,31 28,34 15,24" fill="url(#g)"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
            '<path fill="#ffd83a" d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5l-6.3 3.7 1.5-7.1L1.8 9.2l7.2-.8z"/></svg>'
    };

    // какой логотип у какого источника (по классу rate--xxx)
    var SOURCE = { tmdb: 'tmdb', imdb: 'imdb', kp: 'kp', kinopoisk: 'kp', cub: 'star', lampa: 'star' };

    function dataUri(svg) {
        return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ---------- стили ---------- */
    function addStyles() {
        if (document.getElementById('my-ratings-css')) return;

        var css = '' +
            '.full-start__rate.mr-rate{display:-webkit-inline-flex!important;display:inline-flex!important;-webkit-align-items:center;align-items:center;' +
                'margin:0 .7em 0 0!important;padding:.18em!important;border:0!important;border-radius:.6em!important;' +
                'background:rgba(28,28,32,.78)!important;font-size:1.15em;line-height:1}' +
            '.full-start__rate.hide,.full-start__rate.mr-off{display:none!important}' +
            '.full-start__rate.mr-rate>div{background:none;margin:0;border:0}' +
            '.full-start__rate.mr-rate>.mr-num{padding:.32em .55em!important;border-radius:.45em!important;' +
                'background:rgba(74,74,84,.55)!important;font-weight:700!important;font-size:1em!important;color:#fff}' +
            '.mr-c-red{color:#ff5a5a!important}' +
            '.mr-c-yellow{color:#ffd23f!important}' +
            '.mr-c-blue{color:#4fc3f7!important}' +
            '.mr-c-green{color:#4cd964!important}' +
            '.full-start__rate.mr-rate>.mr-logo{display:block;height:1.5em;margin:0 .5em 0 .55em!important;padding:0!important;' +
                'background-repeat:no-repeat;background-position:center;background-size:contain;' +
                'text-indent:-9999px;overflow:hidden;white-space:nowrap;color:transparent}' +
            '.mr-logo--tmdb{width:2.4em}' +
            '.mr-logo--imdb{width:3em}' +
            '.mr-logo--kp{width:1.5em}' +
            '.mr-logo--star{width:1.5em}' +
            '.mr-logo--tmdb{background-image:' + dataUri(LOGOS.tmdb) + '}' +
            '.mr-logo--imdb{background-image:' + dataUri(LOGOS.imdb) + '}' +
            '.mr-logo--kp{background-image:' + dataUri(LOGOS.kp) + '}' +
            '.mr-logo--star{background-image:' + dataUri(LOGOS.star) + '}' +
            '.full-start__pg,.full-start__status{background:transparent!important;border:.1em solid rgba(255,255,255,.9)!important;' +
                'border-radius:.35em!important;padding:.2em .6em!important;font-weight:600!important;color:#fff!important}';

        var style = document.createElement('style');
        style.id = 'my-ratings-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ---------- оформление плашек ---------- */
    function sourceOf(el) {
        var m = String(el.className || '').match(/rate--([a-z0-9_]+)/);
        return m ? m[1] : '';
    }

    function colorClass(v) {
        if (!(v > 0)) return '';
        if (v < 4) return 'mr-c-red';
        if (v < 7) return 'mr-c-yellow';
        if (v < 8) return 'mr-c-blue';
        return 'mr-c-green';
    }

    function decorate(root, movie) {
        if (!root || !root.querySelectorAll) return;

        var list = root.querySelectorAll('.full-start__rate');

        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            var src = sourceOf(el);
            var logo = SOURCE[src];
            if (!logo) continue;   // незнакомый источник — не трогаем

            // Lampa могла перерисовать плашку — тогда наша разметка пропала
            if (el.getAttribute('data-mr') && !el.querySelector('.mr-num')) el.removeAttribute('data-mr');

            if (!el.getAttribute('data-mr')) {
                var first = el.children[0];
                var val = first ? first.textContent : '';
                el.innerHTML = '<div class="mr-num">' + esc(val) + '</div><div class="mr-logo mr-logo--' + logo + '"></div>';
                el.className += ' mr-rate';
                el.setAttribute('data-mr', '1');
            }

            var num = el.querySelector('.mr-num');
            var text = String(num.textContent || '').replace(',', '.').replace(/[^0-9.]/g, '');

            // у TMDB берём оценку из данных карточки, если Lampa ещё не заполнила
            if (src === 'tmdb' && !(parseFloat(text) > 0) && movie && movie.vote_average > 0) {
                text = (Math.round(movie.vote_average * 10) / 10).toFixed(1);
                num.textContent = text;
            }

            var v = parseFloat(text);
            num.className = 'mr-num ' + colorClass(v);

            if (v > 0) el.className = el.className.replace(/\s*\bmr-off\b/g, '');
            else if (el.className.indexOf('mr-off') < 0) el.className += ' mr-off';
        }
    }

    /* ---------- подписка на открытие карточки ---------- */
    var observer = null;
    var stopTimer = null;

    function watch(root, movie) {
        if (observer) { observer.disconnect(); observer = null; }
        if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }

        decorate(root, movie);

        // IMDb и Кинопоиск Lampa подгружает позже — перерисовываем по мере появления
        if (!window.MutationObserver) return;

        var pending = null;
        observer = new MutationObserver(function () {
            if (pending) return;
            pending = setTimeout(function () {
                pending = null;
                decorate(root, movie);
            }, 60);
        });
        observer.observe(root, { childList: true, subtree: true, characterData: true });

        stopTimer = setTimeout(function () {
            if (observer) { observer.disconnect(); observer = null; }
        }, 30000);
    }

    function start() {
        addStyles();

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;
            try {
                var render = e.object.activity.render();
                var root = render && render[0] ? render[0] : render;
                watch(root, e.data && e.data.movie);
            } catch (err) {}
        });
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }

    window.my_ratings = { version: '1.0.0' };
})();

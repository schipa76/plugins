(function () {
    'use strict';

    if (window.__lampa_noads_plugin) return;
    window.__lampa_noads_plugin = true;

    // Селекторы рекламных блоков (названия классов могут отличаться в разных версиях Lampa)
    var SELECTORS = [
        '.ad-bot',
        '.ad-server',
        '.ad-video',
        '.ad-preroll',
        '[class*="ad-preroll"]'
    ];

    function addStyle() {
        if (document.getElementById('noads-style')) return;

        var style = document.createElement('style');
        style.id = 'noads-style';
        style.textContent = SELECTORS.join(',') + '{display:none!important;visibility:hidden!important;}';
        document.head.appendChild(style);
    }

    function clean() {
        SELECTORS.forEach(function (sel) {
            var nodes = document.querySelectorAll(sel);

            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];

                // Если есть кнопка «Пропустить» — нажимаем
                var skip = el.querySelector('[class*="skip"], [class*="close"]');
                if (skip && typeof skip.click === 'function') skip.click();

                if (el.parentNode) el.parentNode.removeChild(el);
            }
        });
    }

    var scheduled = false;

    function scheduleClean() {
        if (scheduled) return;
        scheduled = true;

        requestAnimationFrame(function () {
            scheduled = false;
            clean();
        });
    }

    function start() {
        addStyle();
        clean();

        new MutationObserver(scheduleClean).observe(document.body, {
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

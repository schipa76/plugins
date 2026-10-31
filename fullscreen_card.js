(function () {
    'use strict';

    // Плагин для Lampa: оформление страницы фильма как в Cardify.
    // 1) убирает карточку-постер слева;
    // 2) прижимает название, кнопки и рейтинги к низу экрана, фон остаётся на весь экран.
    // Настройки: Настройки -> "Страница фильма".

    if (window.fullscreen_card_plugin) return;
    window.fullscreen_card_plugin = true;

    function opt(name, def) {
        try {
            var v = Lampa.Storage.field(name);
            return (v === undefined || v === null || v === '') ? def : v;
        } catch (e) {
            return def;
        }
    }

    function apply() {
        $('body')
            .toggleClass('fsc-nofposter', !!opt('fsc_hide_poster', true))
            .toggleClass('fsc-bottom', !!opt('fsc_bottom', true));
    }

    function addStyles() {
        $('head').append(
            '<style id="fsc-style">' +

            // --- убираем постер (новый и старый вид карточки) ---
            'body.fsc-nofposter .full-start-new__left,' +
            'body.fsc-nofposter .full-start__left,' +
            'body.fsc-nofposter .full-start-new__poster,' +
            'body.fsc-nofposter .full-start__poster{display:none !important;}' +

            // после удаления постера правый блок занимает всё место
            'body.fsc-nofposter .full-start-new__right,' +
            'body.fsc-nofposter .full-start__right{margin-left:0 !important;padding-left:0 !important;}' +

            // --- контент внизу экрана, как в Cardify ---
            'body.fsc-bottom .full-start-new__body,' +
            'body.fsc-bottom .full-start__body{' +
                'min-height:calc(100vh - 8em);' +
                'align-items:flex-end !important;' +
                'background:linear-gradient(90deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 45%,rgba(0,0,0,0) 75%);' +
            '}' +

            '</style>'
        );
    }

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
        } catch (e) {
            console.log('fullscreen_card: settings error', e);
        }
    }

    function start() {
        addStyles();
        addSettings();
        apply();

        // применяем настройки при каждом открытии карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'start' || e.type === 'complite') apply();
        });

        // и сразу при смене настроек
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

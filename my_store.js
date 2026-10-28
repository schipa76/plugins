/*!
 * Мои плагины — каталог плагинов для Lampa с установкой в одно нажатие.
 * Добавляет в левое меню пункт «Мои плагины»: разделы, карточки, кнопки
 * Установить / Выключить / Включить / Удалить и «Подробнее».
 *
 * Как редактировать каталог: найдите массив CATALOG ниже и добавляйте
 * свои плагины по образцу (name, author, descr, link, notes).
 *
 * Как использовать: выложите файл на любой https-хостинг (GitHub Pages и т.п.),
 * в Lampa: Настройки → Расширения → Добавить плагин → вставьте ссылку на этот файл.
 */
(function () {
    'use strict';

    if (window.my_store_plugin) return;
    window.my_store_plugin = true;

    var NAME = 'Мои плагины';
    var COMPONENT = 'my_store';

    // Необязательно: ссылка на внешний каталог (.js, который делает window.my_store_data = {sections:[...]}).
    // Если пусто или не загрузился — используется встроенный CATALOG ниже.
    var REMOTE_URL = '';

    /* ---------- каталог ---------- */
    var CATALOG = [
        {
            id: 'online', title: 'Онлайн', color: '#6366f1', items: [
                { name: 'Трейлеры с Rutube', author: '@tvigl', descr: 'Если не воспроизводятся трейлеры с YouTube — трейлеры грузятся с Rutube.', link: 'https://tvigl.github.io/plugins/rutube.js' },
                { name: 'Управление онлайн-источниками', author: '@tvigl', descr: 'Сортировка источников по качеству или алфавиту, скрытие неактивных.', link: 'https://tvigl.github.io/plugins/source_sort.js' },
                { name: 'Top Bar — смена плеера в шапке', author: '@tvigl', descr: 'Кнопка в шапке для быстрого переключения встроенного и внешнего плеера.', link: 'https://tvigl.github.io/plugins/top_bar.js' },
                { name: 'Lampac Source Filter', author: '@levende', descr: 'Скрывает ненужных провайдеров в списке источников.', link: 'https://levende.github.io/lampa-plugins/lampac-src-filter.js', notes: ['Для серверов Lampac'] },
                { name: 'Anti DMCA', author: '@levende', descr: 'Убирает или заменяет заблокированные по DMCA источники в выдаче.', link: 'https://levende.github.io/lampa-plugins/anti-dmca.js' }
            ]
        },
        {
            id: 'ui', title: 'Оформление', color: '#ec4899', items: [
                { name: 'Цветной рейтинг на карточках', author: '@tvigl', descr: 'Окрашивает рейтинг по оценке: красный, оранжевый, синий, зелёный.', link: 'https://tvigl.github.io/plugins/vote_colour.js' },
                { name: 'Логотипы фильмов вместо названий', author: '@tvigl', descr: 'Заменяет текстовое название на официальный логотип из TMDB.', link: 'https://tvigl.github.io/plugins/logo.js' },
                { name: 'Метки максимального качества', author: '@tvigl', descr: 'Показывает на карточке лучшее качество: 4K, FHD, HD, SD (данные JacRed).', link: 'https://tvigl.github.io/plugins/quality.js' },
                { name: 'Сезон и серия на карточках', author: '@tvigl', descr: 'Метка прогресса сезона на карточке сериала. Данные из TMDB.', link: 'https://tvigl.github.io/plugins/seasons.js' },
                { name: 'Интерфейс в стиле Apple TV', author: '@tvigl', descr: 'Карточки ближе к Apple TV: логотипы, постеры до 4K, плавные анимации.', link: 'https://tvigl.github.io/plugins/appleTV.js' },
                { name: 'Настройка значков в шапке', author: '@tvigl', descr: 'Скрывает лишние значки в шапке: поиск, профиль, время и т.д.', link: 'https://tvigl.github.io/plugins/head_filter.js' },
                { name: 'Кнопка «Выход» в меню', author: '@tvigl', descr: 'Пункт «Выход» в главном меню для быстрого закрытия приложения.', link: 'https://tvigl.github.io/plugins/exit.js' }
            ]
        },
        {
            id: 'collections', title: 'Подборки', color: '#f97316', items: [
                { name: 'Подборки TMDB mod', author: '@tvigl', descr: 'Готовые подборки на главной: премьеры, топ недели, хиты стримингов.', link: 'https://tvigl.github.io/plugins/tmdb_mod.js' },
                { name: 'Подборки от LNUM', author: '@levende', descr: 'Каталог фильмов и сериалов LNUM прямо в меню Lampa.', link: 'https://levende.github.io/lampa-plugins/lnum.js' },
                { name: 'Студии', author: '@tvigl', descr: 'Подборки крупных студий и стримингов в боковом меню.', link: 'https://tvigl.github.io/plugins/studios.js' }
            ]
        },
        {
            id: 'torrents', title: 'Торренты', color: '#22c55e', items: [
                { name: 'Цветная подсветка раздач', author: '@tvigl', descr: 'Подсвечивает раздачи по числу сидов и битрейту.', link: 'https://tvigl.github.io/plugins/torrents_styles.js' },
                { name: 'Продолжить просмотр с торрентов', author: '@arst113', descr: 'Запоминает, где вы остановились при просмотре через торрент.', link: 'https://arst113.github.io/log/ContinueWatching.js' },
                { name: 'Каталог парсеров', author: '@ko31k', descr: 'Список парсеров для торрентов. После установки: Настройки → Парсер.', link: 'https://ko31k.github.io/LMP/plugins/Parsers.js' },
                { name: 'TsTracks — дорожки из TorrServer', author: '@lampame', descr: 'Информация об аудиодорожках и субтитрах от TorrServer, удобный выбор дорожки.', link: 'https://lampame.github.io/main/tstracks.js' }
            ]
        },
        {
            id: 'other', title: 'Разное', color: '#94a3b8', items: [
                { name: 'Своё «Избранное»', author: '@levende', descr: 'Свои папки избранного: «Хочу посмотреть», «Сериалы» и любые другие.', link: 'https://levende.github.io/lampa-plugins/custom-favs.js' },
                { name: 'Отключить Shots', author: '@tvigl', descr: 'Убирает Shots из бокового меню и из кнопки просмотра.', link: 'https://tvigl.github.io/plugins/shots.js' },
                { name: 'Wiki о фильме', author: '@tvigl', descr: 'Пункт в карточке фильма с подробным описанием из Wikipedia.', link: 'https://tvigl.github.io/plugins/WikiFind.js' },
                { name: 'Поиск с подсказками', author: '@nikitagk22', descr: 'Подсказки в поиске после 3 введённых символов.', link: 'https://nikitagk22.github.io/suggest.js' }
            ]
        }
    ];

    /* ---------- утилиты ---------- */
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function sameUrl(a, b) {
        var norm = function (u) {
            return String(u || '').split('?')[0].replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
        };
        return norm(a) === norm(b);
    }

    function installed(link) {
        var list = (Lampa.Plugins && Lampa.Plugins.get) ? Lampa.Plugins.get() : [];
        for (var i = 0; i < list.length; i++) {
            if (sameUrl(list[i].url, link)) return list[i];
        }
        return null;
    }

    function noty(text) {
        if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
    }

    function askReload(back) {
        Lampa.Modal.open({
            title: '',
            align: 'center',
            zIndex: 300,
            html: $('<div class="about">Чтобы изменения вступили в силу, Lampa нужно перезапустить. Перезапустить сейчас?</div>'),
            buttons: [
                { name: 'Позже', onSelect: function () { Lampa.Modal.close(); if (back) back(); } },
                { name: 'Перезапустить', onSelect: function () { window.location.reload(); } }
            ],
            onBack: function () { Lampa.Modal.close(); if (back) back(); }
        });
    }

    function countAll(sections) {
        var n = 0;
        sections.forEach(function (s) { n += s.items.length; });
        return n;
    }

    /* ---------- загрузка каталога ---------- */
    function loadCatalog(done) {
        if (!REMOTE_URL) return done(CATALOG);

        var finished = false;
        var timer = setTimeout(function () { finish(false); }, 10000);
        var finish = function (ok) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            var data = window.my_store_data;
            done(ok && data && data.sections && data.sections.length ? data.sections : CATALOG);
        };

        window.my_store_data = null;
        var script = document.createElement('script');
        script.charset = 'utf-8';
        script.onload = function () { finish(true); };
        script.onerror = function () { finish(false); };
        script.src = REMOTE_URL + (REMOTE_URL.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Math.floor(Date.now() / 3600000);
        document.head.appendChild(script);
    }

    /* ---------- стили ---------- */
    function addStyles() {
        if (document.getElementById('my-store-css')) return;
        var css = '' +
            '.mys{padding:0 1.5em 3em}' +
            '.mys-hero{margin:.5em 0 1.4em;padding:1.5em 1.8em;border-radius:1.2em;' +
                'background:#312e81;background:linear-gradient(120deg,#4338ca 0%,#7c3aed 50%,#db2777 100%)}' +
            '.mys-hero__title{font-size:2em;line-height:1.1;font-weight:800;color:#fff}' +
            '.mys-hero__text{margin-top:.4em;max-width:40em;line-height:1.45;color:rgba(255,255,255,.85)}' +
            '.mys-pill{display:inline-block;margin:.9em .5em 0 0;padding:.35em .8em;border-radius:2em;background:rgba(255,255,255,.16);color:#fff;font-size:.85em;font-weight:600}' +
            '.mys-tabs{margin:0 0 1.2em}' +
            '.mys-tab{display:inline-block;margin:0 .5em .6em 0;padding:.55em 1.1em;border-radius:2em;background:rgba(255,255,255,.07);' +
                'color:rgba(255,255,255,.8);font-size:.95em;font-weight:600;border:.12em solid transparent}' +
            '.mys-tab span{opacity:.55;margin-left:.35em;font-weight:500}' +
            '.mys-tab.active{background:#fff;color:#111827}' +
            '.mys-tab.focus{border-color:#fff;background:rgba(255,255,255,.22);color:#fff}' +
            '.mys-tab.active.focus{background:#fff;color:#111827}' +
            '.mys-section{margin:.4em 0 .8em;font-size:1.3em;font-weight:800;color:#fff}' +
            '.mys-section i{display:inline-block;width:.55em;height:.55em;margin-right:.45em;border-radius:50%;vertical-align:middle}' +
            '.mys-grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin:0 -.6em 1.4em}' +
            '.mys-card{width:25%;padding:.6em;box-sizing:border-box;-webkit-box-sizing:border-box}' +
            '.mys-card__in{position:relative;height:100%;border-radius:1em;overflow:hidden;background:#24262b;border:.15em solid rgba(255,255,255,.04);' +
                '-webkit-transition:-webkit-transform .15s;transition:transform .15s}' +
            '.mys-card.focus .mys-card__in{-webkit-transform:scale(1.04);transform:scale(1.04);border-color:#fff;box-shadow:0 .6em 2em rgba(0,0,0,.55)}' +
            '.mys-card__img{position:relative;padding-bottom:42%}' +
            '.mys-card__letter{position:absolute;left:0;top:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:flex;' +
                '-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;' +
                'font-size:2.8em;font-weight:800;color:rgba(255,255,255,.92)}' +
            '.mys-card__state{position:absolute;right:.6em;top:.6em;padding:.2em .6em;border-radius:.4em;font-size:.72em;font-weight:700;display:none}' +
            '.mys-card__state.on{display:block;background:#16a34a;color:#fff}' +
            '.mys-card__state.off{display:block;background:#4b5563;color:#e5e7eb}' +
            '.mys-card__body{padding:.8em .9em 1em}' +
            '.mys-card__name{font-size:1.05em;line-height:1.25;font-weight:700;color:#fff;max-height:2.5em;overflow:hidden}' +
            '.mys-card__descr{margin-top:.45em;font-size:.82em;line-height:1.4;color:rgba(255,255,255,.6);max-height:4.2em;overflow:hidden}' +
            '.mys-card__foot{margin-top:.6em;font-size:.75em;color:rgba(255,255,255,.4)}' +
            '.mys-card__note{margin-left:.4em;color:#fbbf24}' +
            '.mys-info__text{font-size:1em;line-height:1.55;color:rgba(255,255,255,.85);white-space:pre-line}' +
            '.mys-info__note{display:inline-block;margin:.8em .5em 0 0;padding:.3em .7em;border-radius:.5em;background:rgba(251,191,36,.15);color:#fbbf24;font-size:.85em;font-weight:600}' +
            '.mys-info__meta{margin-top:1em;font-size:.85em;color:rgba(255,255,255,.5);word-break:break-all}' +
            '@media screen and (max-width:1100px){.mys-card{width:33.333%}}' +
            '@media screen and (max-width:767px){.mys{padding:0 .8em 3em}.mys-card{width:50%}.mys-hero{padding:1.2em}.mys-hero__title{font-size:1.6em}}' +
            '@media screen and (max-width:420px){.mys-card{width:100%}}';
        var style = document.createElement('style');
        style.id = 'my-store-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ---------- экран каталога ---------- */
    function StoreComponent(object) {
        var self = this;
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 300 });
        var html = $('<div class="mys"></div>');
        var sections = null;
        var filter = 'all';
        var last = null;
        var cards = [];

        this.create = function () {
            this.activity.loader(true);
            addStyles();
            loadCatalog(function (data) {
                sections = data;
                self.build();
                self.activity.loader(false);
                self.activity.toggle();
            });
            return this.render();
        };

        this.countInstalled = function () {
            var n = 0;
            sections.forEach(function (s) {
                s.items.forEach(function (p) { if (installed(p.link)) n++; });
            });
            return n;
        };

        this.build = function () {
            html.empty();

            html.append('<div class="mys-hero">' +
                '<div class="mys-hero__title">' + esc(NAME) + '</div>' +
                '<div class="mys-hero__text">Выберите плагин и нажмите «Установить». После установки или удаления Lampa предложит перезапуск.</div>' +
                '<span class="mys-pill"><b>' + countAll(sections) + '</b> плагинов</span>' +
                '<span class="mys-pill mys-pill--installed">Установлено: <b>0</b></span>' +
                '</div>');

            var tabs = $('<div class="mys-tabs"></div>');
            var tabList = [{ id: 'all', title: 'Все', count: countAll(sections) }].concat(sections.map(function (s) {
                return { id: s.id, title: s.title, count: s.items.length };
            }));

            tabList.forEach(function (t) {
                var tab = $('<div class="mys-tab selector' + (t.id === filter ? ' active' : '') + '">' + esc(t.title) + '<span>' + esc(t.count) + '</span></div>');
                tab.on('hover:enter', function () {
                    filter = t.id;
                    tabs.find('.mys-tab').removeClass('active');
                    tab.addClass('active');
                    self.renderGrid();
                    self.refreshController(tab);
                });
                tab.on('hover:focus', function () { last = tab[0]; scroll.update(tab, true); });
                tabs.append(tab);
            });
            html.append(tabs);

            html.append('<div class="mys-list"></div>');
            this.renderGrid();

            scroll.minus();
            scroll.append(html);
            this.updateStats();
        };

        this.renderGrid = function () {
            var list = html.find('.mys-list').empty();
            cards = [];

            sections.forEach(function (section) {
                if (filter !== 'all' && filter !== section.id) return;
                if (!section.items.length) return;

                list.append('<div class="mys-section"><i style="background:' + esc(section.color) + '"></i>' + esc(section.title) + '</div>');

                var grid = $('<div class="mys-grid"></div>');
                section.items.forEach(function (plug) { grid.append(self.card(plug, section)); });
                list.append(grid);
            });
        };

        this.card = function (plug, section) {
            var letter = esc((plug.name || '?').replace(/^[^A-Za-zА-Яа-яЁё0-9]+/, '').charAt(0).toUpperCase());
            var note = plug.notes && plug.notes.length
                ? '<span class="mys-card__note">⚠ ' + esc(plug.notes.length > 1 ? 'есть условия' : plug.notes[0]) + '</span>' : '';

            var el = $('<div class="mys-card selector">' +
                '<div class="mys-card__in">' +
                    '<div class="mys-card__img" style="background:' + esc(section.color) + '">' +
                        '<div class="mys-card__letter">' + letter + '</div>' +
                        '<div class="mys-card__state"></div>' +
                    '</div>' +
                    '<div class="mys-card__body">' +
                        '<div class="mys-card__name">' + esc(plug.name) + '</div>' +
                        '<div class="mys-card__descr">' + esc(plug.descr) + '</div>' +
                        '<div class="mys-card__foot">' + esc(plug.author || '') + note + '</div>' +
                    '</div>' +
                '</div></div>');

            el.on('hover:focus', function () { last = el[0]; scroll.update(el, true); });
            el.on('hover:enter', function () { self.menu(plug); });

            cards.push({ plug: plug, el: el });
            this.updateCard(plug, el);
            return el;
        };

        this.updateCard = function (plug, el) {
            var obj = installed(plug.link);
            var state = el.find('.mys-card__state').removeClass('on off');
            if (obj && obj.status) state.addClass('on').text('✓ Установлен');
            else if (obj) state.addClass('off').text('Выключен');
            else state.text('');
        };

        this.updateStats = function () {
            if (!sections) return;
            html.find('.mys-pill--installed b').text(this.countInstalled());
            cards.forEach(function (c) { self.updateCard(c.plug, c.el); });
        };

        this.menu = function (plug) {
            var obj = installed(plug.link);
            var items = [];

            if (!obj) items.push({ title: 'Установить', action: 'install' });
            else if (obj.status) items.push({ title: 'Выключить', action: 'disable' });
            else items.push({ title: 'Включить', action: 'enable' });

            items.push({ title: 'Подробнее', action: 'info' });
            if (obj) items.push({ title: 'Удалить', action: 'remove' });

            Lampa.Select.show({
                title: plug.name,
                items: items,
                onBack: function () { Lampa.Controller.toggle('content'); },
                onSelect: function (a) {
                    var back = function () { Lampa.Controller.toggle('content'); };

                    if (a.action === 'install') {
                        Lampa.Plugins.add({ url: plug.link, status: 1, name: plug.name, author: plug.author || '' });
                        noty('Плагин «' + plug.name + '» установлен');
                        self.updateStats();
                        askReload(back);
                    } else if (a.action === 'enable') {
                        obj.status = 1;
                        Lampa.Plugins.save();
                        noty('Плагин «' + plug.name + '» включён');
                        self.updateStats();
                        askReload(back);
                    } else if (a.action === 'disable') {
                        obj.status = 0;
                        Lampa.Plugins.save();
                        self.updateStats();
                        askReload(back);
                    } else if (a.action === 'remove') {
                        Lampa.Plugins.remove(obj);
                        self.updateStats();
                        askReload(back);
                    } else if (a.action === 'info') {
                        self.info(plug);
                    }
                }
            });
        };

        this.info = function (plug) {
            var box = $('<div class="mys-info"></div>');
            box.append('<div class="mys-info__text">' + esc(plug.about || plug.descr) + '</div>');
            if (plug.notes && plug.notes.length) {
                box.append('<div>' + plug.notes.map(function (n) {
                    return '<span class="mys-info__note">' + esc(n) + '</span>';
                }).join('') + '</div>');
            }
            box.append('<div class="mys-info__meta"><b>Автор:</b> ' + esc(plug.author || '—') + '<br><b>Ссылка:</b> ' + esc(plug.link) + '</div>');

            Lampa.Modal.open({
                title: plug.name,
                html: box,
                size: 'medium',
                onBack: function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });
        };

        this.refreshController = function (focusEl) {
            Lampa.Controller.collectionSet(scroll.render());
            Lampa.Controller.collectionFocus(focusEl ? (focusEl[0] || focusEl) : false, scroll.render());
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () { Navigator.move('right'); },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () { Navigator.move('down'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
            if (sections) this.updateStats();
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return scroll.render(); };
        this.destroy = function () {
            scroll.destroy();
            html.remove();
            cards = [];
        };
    }

    /* ---------- открыть каталог ---------- */
    function open() {
        Lampa.Activity.push({ url: '', title: NAME, component: COMPONENT, page: 1 });
    }

    /* ---------- пункт в меню ---------- */
    var ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<path d="M4 7.5 12 12l8-4.5M12 12v9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

    function addMenu() {
        if ($('.menu [data-action="my_store"]').length) return;

        if (Lampa.Menu && Lampa.Menu.addButton) {
            var btn = Lampa.Menu.addButton(ICON, NAME, open);
            if (btn && btn.attr) btn.attr('data-action', 'my_store');
        } else {
            var item = $('<li class="menu__item selector" data-action="my_store"><div class="menu__ico">' + ICON + '</div><div class="menu__text">' + NAME + '</div></li>');
            item.on('hover:enter', open);
            $('.menu .menu__list').eq(0).append(item);
        }
    }

    function start() {
        Lampa.Component.add(COMPONENT, StoreComponent);
        addMenu();
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }

    window.my_store = { open: open };
})();

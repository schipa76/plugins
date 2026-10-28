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

    // Папка, где лежит этот файл: по ней находятся «свои» плагины (поле file в каталоге).
    var BASE_URL = (function () {
        try {
            var src = document.currentScript && document.currentScript.src;
            if (!src) {
                var list = document.getElementsByTagName('script');
                for (var i = list.length - 1; i >= 0; i--) {
                    if ((list[i].src || '').indexOf('my_store') >= 0) { src = list[i].src; break; }
                }
            }
            if (src) return src.split('?')[0].replace(/[^\/]*$/, '');
        } catch (e) {}
        return '';
    })();

    /* ---------- каталог ---------- */
    var CATALOG = [
        {
            id: 'mine', title: 'Мои', color: '#38bdf8', items: [
                { name: 'Мои рейтинги — плашки в карточке', author: 'Свой', descr: 'Тёмные плашки рейтингов TMDB, IMDb, Кинопоиск с логотипами; число окрашено по оценке; рамка у «16+» и «Выпущено».', file: 'my_ratings.js', notes: ['Файл должен лежать рядом с my_store.js'] },
                { name: 'Showy — убрать рекламу Pro', author: 'Свой', descr: 'Скрывает промо-баннер Showy Pro и рекламные окна этого плагина.', file: 'showy_noads.js', notes: ['Файл должен лежать рядом с my_store.js'] }
            ]
        },
        {
            id: "online", title: "Онлайн", color: "#6366f1", items: [
                { name: "Трейлеры с Rutube", author: "@tvigl", descr: "Если не воспроизводятся трейлеры с YouTube — они будут грузиться с Rutube.", link: "https://tvigl.github.io/plugins/rutube.js" },
                { name: "Управление онлайн-источниками", author: "@tvigl", descr: "Сортировка источников по качеству или алфавиту, скрытие неактивных.", link: "https://tvigl.github.io/plugins/source_sort.js" },
                { name: "Top Bar — смена плеера в шапке", author: "@tvigl", descr: "Кнопка в шапке для быстрого переключения встроенного и внешнего плеера.", link: "https://tvigl.github.io/plugins/top_bar.js" },
                { name: "Автопилот — одна кнопка «Смотреть»", author: "hub.alcopa.cc", descr: "Сам собирает источники, выбирает озвучку и переключается на другой источник, если один упал.", link: "https://hub.alcopa.cc/dl/alc_auto/v2.1.44/plugin.js", notes: ["Нужен свой Lampac / Alpac или онлайн-плагин на его основе"] },
                { name: "Пропуск заставки и титров", author: "hub.alcopa.cc", descr: "Позволяет пропускать заставки и титры в новом плеере Lampa.", link: "https://hub.alcopa.cc/dl/skip_segments/v1.0.2/plugin.js" },
                { name: "OpenSubtitles — субтитры в плеере", author: "hub.alcopa.cc", descr: "Добавляет субтитры OpenSubtitles в меню субтитров плеера.", link: "https://hub.alcopa.cc/dl/opensubs_menu/v1.2.9/plugin.js" },
                { name: "Anti DMCA — обход блокировок DMCA", author: "@levende", descr: "Убирает или заменяет заблокированные по DMCA источники в выдаче.", link: "https://levende.github.io/lampa-plugins/anti-dmca.js" },
                { name: "Lampac Source Filter", author: "@levende", descr: "Скрывает ненужных провайдеров в списке источников.", link: "https://levende.github.io/lampa-plugins/lampac-src-filter.js", notes: ["Для серверов Lampac"] },
                { name: "Balancer Sanitizer", author: "@levende", descr: "Очищает адреса балансеров от лишних параметров.", link: "https://levende.github.io/lampa-plugins/balancer-sanitizer.js" },
            ]
        },
        {
            id: "ui", title: "Оформление", color: "#ec4899", items: [
                { name: "Рейтинги IMDb, TMDB, Metacritic и Rotten Tomatoes", author: "@tvigl", descr: "Собирает рейтинги с нескольких площадок и считает итоговую оценку по весам; показывает «Оскары» и возрастные ограничения.", link: "https://tvigl.github.io/plugins/rating_omdb.js" },
                { name: "Цветной рейтинг на карточках", author: "@tvigl", descr: "Окрашивает рейтинг по оценке: красный, оранжевый, синий, зелёный.", link: "https://tvigl.github.io/plugins/vote_colour.js" },
                { name: "Подборки стримингов: Netflix, Prime, Apple TV+, HBO, Hulu, Disney+", author: "@tvigl", descr: "Пункты в боковом меню для быстрого доступа к контенту популярных сервисов. Данные из TMDB.", link: "https://tvigl.github.io/plugins/collections.js" },
                { name: "Стилизованные кнопки: Онлайн, Торрент, Трейлеры", author: "@tvigl", descr: "Выстраивает кнопки в карточке в порядке: онлайн, торренты, трейлеры, остальное.", link: "https://tvigl.github.io/plugins/3buttons.js", notes: ["Скорее всего работает только на Lampac"] },
                { name: "Цветные кнопки и «Очистить кэш» в шапке", author: "@tvigl", descr: "Кнопка очистки кэша в шапке, цветные иконки кнопок, анимация нажатия.", link: "https://tvigl.github.io/plugins/cache.js" },
                { name: "Кнопка «Выход» в меню", author: "@tvigl", descr: "Пункт «Выход» в главном меню для быстрого закрытия приложения.", link: "https://tvigl.github.io/plugins/exit.js" },
                { name: "Логотипы фильмов вместо названий", author: "@tvigl", descr: "Заменяет текстовое название на официальный логотип из TMDB. Настройка: Настройки → Интерфейс.", link: "https://tvigl.github.io/plugins/logo.js" },
                { name: "Метки максимального качества на карточках", author: "@tvigl", descr: "Показывает лучшее доступное качество: 4K, FHD, HD, SD (данные JacRed). Результат кэшируется на 24 часа.", link: "https://tvigl.github.io/plugins/quality.js" },
                { name: "Сезон и серия на карточках сериалов", author: "@tvigl", descr: "Метка прогресса сезона в углу карточки. Данные из TMDB, можно указать свой ключ.", link: "https://tvigl.github.io/plugins/seasons.js" },
                { name: "Убрать кнопку «Трейлеры» из карточек", author: "@tvigl", descr: "Скрывает кнопку «Трейлер», оставляя только источники для просмотра.", link: "https://tvigl.github.io/plugins/notrailers.js" },
                { name: "Рейтинг в карточке от Макса", author: "@tvigl", descr: "Комбайн: общий рейтинг, качество раздач, награды и возрастные ограничения.", link: "https://tvigl.github.io/plugins/maxsm_ratings.js", notes: ["Ключи TMDB и Кинопоиска ограничены"] },
                { name: "Анимация загрузки (25 вариантов)", author: "@tvigl", descr: "Выбор анимации загрузки из 25 вариантов.", link: "https://tvigl.github.io/plugins/aloader.js" },
                { name: "Рейтинг в правом верхнем углу карточки", author: "@tvigl", descr: "Переносит рейтинг в угол постера на размытом фоне и окрашивает его по оценке.", link: "https://tvigl.github.io/plugins/ratingup.js" },
                { name: "Качество внутри карточек", author: "@tvigl", descr: "Показывает 4K / FHD / HD / SD по данным JacRed и помечает экранки красной меткой.", link: "https://tvigl.github.io/plugins/surs_quality.js" },
                { name: "Балансеры в фильтре", author: "@tvigl", descr: "Пункт «Вернуться к фильтрации источников» для быстрой смены балансера.", link: "https://tvigl.github.io/plugins/src-filter.js" },
                { name: "Интерфейс в стиле Apple TV", author: "@tvigl", descr: "Логотипы вместо названий, постеры до 4K, плавные анимации. Лучше смотрится на больших экранах.", link: "https://tvigl.github.io/plugins/appleTV.js" },
                { name: "Управление кнопками на странице фильма", author: "@mylampa1", descr: "Порядок кнопок, скрытие и показ, папки для группировки.", link: "https://mylampa1.github.io/buttons.js" },
                { name: "Настройка значков в шапке", author: "@tvigl", descr: "Скрывает лишние значки: поиск, настройки, профиль, время и т.д.", link: "https://tvigl.github.io/plugins/head_filter.js" },
                { name: "Стильный рейтинг", author: "@maxsmeller", descr: "Цветные метки на постерах, рейтинг звёздами или иконками сервисов.", link: "https://maxsmeller.github.io/lampa-plugins/rat.js", notes: ["Нужны API-ключи OMDb и Кинопоиска"] },
                { name: "Flixio — оформление главной и карточки", author: "Flixio", descr: "Новая тема: полностью переоформляет главную и карточку фильма.", link: "https://tvigl.github.io/plugins/Flixio.js" },
                { name: "Рейтинг с гибкими настройками", author: "@amikdn", descr: "Рейтинг на карточках и в полной новости; позицию и размер можно менять.", link: "https://amikdn.github.io/rate.js", notes: ["Для Кинопоиска нужен API-ключ"] },
                { name: "Новые релизы", author: "@tvigl", descr: "Баннер с новыми релизами на главной.", link: "https://tvigl.github.io/plugins/new_released.js" },
                { name: "Стриминги на главной", author: "@tvigl", descr: "Показывает стриминговые площадки на главной странице.", link: "https://tvigl.github.io/plugins/streamings.js" },
                { name: "Качество, рейтинг и год на карточке", author: "@tvigl", descr: "Качество, рейтинг и год выпуска прямо на карточке.", link: "https://tvigl.github.io/plugins/rating-quality.js" },
                { name: "Favorite Refresh — свежие постеры в Избранном", author: "@anclaver", descr: "Обновляет постеры и названия в Избранном свежими данными.", link: "https://anclaver.github.io/Lampa/plugins/favoriteRefresh.js" },
                { name: "UI Badge — информативные метки на карточках", author: "@anclaver", descr: "Тип, длительность, прогресс просмотра, качество и рейтинг с цветной индикацией.", link: "https://anclaver.github.io/Lampa/plugins/interfaceBadge.js" },
                { name: "UI Style — улучшения страницы фильма", author: "@anclaver", descr: "Оригинальное название, кнопки Онлайн и Торрент первыми, без подтверждения при выходе.", link: "https://anclaver.github.io/Lampa/plugins/interfaceStyle.js" },
                { name: "Закусь TV — Lampa в стиле Apple TV", author: "hub.alcopa.cc", descr: "Главная с большим баннером, карточка с логотипом и списком серий, торренты списком.", link: "https://hub.alcopa.cc/dl/snack_tv/v0.8.11/plugin.js", notes: ["Работает и на обычной Lampa"] },
                { name: "AVGRating — рейтинги с 11 сайтов", author: "@cevamnelampaplagin", descr: "Рейтинги с 11 сайтов, награды и средняя оценка.", link: "https://cevamnelampaplagin.github.io/tytnemanichogodobrogo/avgrating.js" },
                { name: "Cardify+ — живой фон в карточке", author: "@ko31k", descr: "Динамический фон карточки: трейлер без звука или слайд-шоу из постеров.", link: "https://ko31k.github.io/LMP/plugins/cardify+.js" },
                { name: "Interface+ — комплексное улучшение интерфейса", author: "@ko31k", descr: "Темы, инфо-панель, цветные рейтинги и метки, обновлённый блок торрентов.", link: "https://ko31k.github.io/LMP/plugins/interface+.js" },
                { name: "Networks — кнопки стримингов и студий", author: "@ko31k", descr: "Кнопки стримингов и студий-производителей в карточке (мод плагина @levende).", link: "https://ko31k.github.io/LMP/plugins/Networks.js" },
                { name: "TV Status Color — цветной статус сериала", author: "@levende", descr: "Окрашивает статус сериала: завершён, выходит или ожидается.", link: "https://levende.github.io/lampa-plugins/tv-status-color.js" },
                { name: "Yarik's Design — редизайн карточек", author: "@yarikrazor-star", descr: "Горизонтальные карточки, настраиваемые метки, несколько рейтингов.", link: "https://yarikrazor-star.github.io/lmp/ydes.js", notes: ["Для доп. рейтингов нужен ключ MDBList"] },
                { name: "Buttons+ — редактор кнопок в карточке", author: "@ko31k", descr: "Порядок, скрытие, иконки или текст, свои папки, более 60 иконок.", link: "https://ko31k.github.io/LMP/plugins/buttons+.js" },
                { name: "RTG+ — рейтинги и награды", author: "@ko31k", descr: "Рейтинги и награды (Оскар, Эмми) в карточке и на постере.", link: "https://ko31k.github.io/LMP/plugins/rtg.js", notes: ["Нужны API-ключи OMDb и MDBList"] },
                { name: "SeasonsInfo — последний сезон и прогресс серий", author: "@ko31k", descr: "Последний актуальный сезон и прогресс выхода серий на карточках.", link: "https://ko31k.github.io/LMP/plugins/SeasonsInfo.js", notes: ["Нужен API-ключ TMDb"] }
            ]
        },
        {
            id: "themes", title: "Темы", color: "#14b8a6", items: [
                { name: "Тема от @DrXAOS", author: "@DrXAOS", descr: "Цветовые палитры (Cyberpunk, Matrix, Retro Wave, Ice Blue), эффект матового стекла и свечение.", link: "https://tvigl.github.io/plugins/drxaos_themes.js" },
                { name: "Тема AppleTV", author: "@llowmikee", descr: "Тема в духе Apple TV: новая главная, расширенные карточки, много настроек.", link: "https://llowmikee.github.io/AppleTVAGNativeNG/appletv_agnative.js" },
                { name: "Netflix — главная в стиле Netflix", author: "@adambenhassen", descr: "Главная страница Lampa в стиле Netflix.", link: "https://adambenhassen.github.io/netflix.js" }
            ]
        },
        {
            id: "collections", title: "Подборки", color: "#f97316", items: [
                { name: "Подборки от SURS", author: "@aviamovie", descr: "Переосмысленный главный экран: персональные блоки, умная фильтрация.", link: "https://aviamovie.github.io/surs.js" },
                { name: "Подборки TMDB mod", author: "@tvigl", descr: "Расширенный TMDB: премьеры, топ недели, хиты Netflix, Originals российских сервисов.", link: "https://tvigl.github.io/plugins/tmdb_mod.js" },
                { name: "Подборки от LNUM", author: "@levende", descr: "Каталог фильмов и сериалов LNUM в меню Lampa.", link: "https://levende.github.io/lampa-plugins/lnum.js" },
                { name: "Подборки от Levende", author: "@levende", descr: "Тематические подборки: «Лучшие 100», «Хиты по жанрам» и другие.", link: "https://levende.github.io/lampa-plugins/prisma_collections.js?v=2" },
                { name: "Подборки от NUMParser", author: "num.jac-red.ru", descr: "Тематические подборки фильмов и сериалов.", link: "https://num.jac-red.ru/plugin/nmprs.js" },
                { name: "Дополнительный каталог MovieTV", author: "@rugaroo888", descr: "Дополнительный каталог с настройками, можно сделать стартовой страницей.", link: "https://rugaroo888.github.io/movietv-plugin/MovieTV.js" },
                { name: "Студии (оригинал, UA)", author: "@syvyj", descr: "Подборки крупных студий в боковом меню: Netflix, Disney, Apple и др.", link: "https://syvyj.github.io/studios_4lampa/studios.js" },
                { name: "Студии (UA / RU / EN / PL)", author: "@tvigl", descr: "Те же подборки студий, с поддержкой нескольких языков.", link: "https://tvigl.github.io/plugins/studios.js" },
                { name: "Источники", author: "@tvigl", descr: "Новый пункт меню: Чарты, Стриминги, TV США, TV Мир, Украина, Россия.", link: "https://tvigl.github.io/plugins/sources.js" },
                { name: "Random Scheduled — случайный фильм из «Позже»", author: "@levende", descr: "Выбирает случайный фильм или сериал из запланированного.", link: "https://levende.github.io/lampa-plugins/random-scheduled.js" },
                { name: "Siaivo Dorama — раздел дорам", author: "cdn.jsdelivr.net", descr: "Отдельная категория дорам в боковом меню.", link: "https://cdn.jsdelivr.net/gh/Lamp1ch-chmuk/dorami-Siaivo@main/d.js" }
            ]
        },
        {
            id: "torrents", title: "Торренты", color: "#22c55e", items: [
                { name: "Цветная подсветка торрент-раздач", author: "@tvigl", descr: "Подсвечивает раздачи по числу сидов и битрейту, переводит подписи на украинский.", link: "https://tvigl.github.io/plugins/torrents_styles.js" },
                { name: "Продолжить просмотр с торрентов", author: "@arst113", descr: "Запоминает, где вы остановились при просмотре через торрент.", link: "https://arst113.github.io/log/ContinueWatching.js" },
                { name: "EasyTorrent — умный подбор раздач", author: "@darkestclouds", descr: "Изучает ваши предпочтения и рекомендует подходящие раздачи.", link: "https://darkestclouds.github.io/plugins/easytorrent/easytorrent.min.js", notes: ["Экспериментальный"] },
                { name: "Каталог парсеров", author: "@ko31k", descr: "Список парсеров для торрентов. После установки: Настройки → Парсер.", link: "https://ko31k.github.io/LMP/plugins/Parsers.js" },
                { name: "Кнопка «Торренты» рядом с Play", author: "hub.alcopa.cc", descr: "Кнопка «Торренты» рядом с Play в карточке фильма.", link: "https://hub.alcopa.cc/dl/torrent_button/v1.0.0/plugin.js" },
            ]
        },
        {
            id: "other", title: "Разное", color: "#94a3b8", items: [
                { name: "Автопоказ трейлеров в карточке (Cardify)", author: "@tvigl", descr: "Видео запускается прямо в карточке, есть управление, субтитры и внешние плееры.", link: "https://tvigl.github.io/plugins/cardify.js" },
                { name: "Убрать нумерацию «123» на главной", author: "@tvigl", descr: "Убирает нумерацию 1, 2, 3 с карточек на главной.", link: "https://tvigl.github.io/plugins/123.js" },
                { name: "Своё «Избранное»", author: "@levende", descr: "Свои папки избранного: «Хочу посмотреть», «Сериалы» и любые другие.", link: "https://levende.github.io/lampa-plugins/custom-favs.js" },
                { name: "AI-поиск №1", author: "@fovway", descr: "Описываете словами, что хотите посмотреть, а ИИ подбирает варианты.", link: "https://fovway.github.io/lampacJS/ai_search/ai_search.js", notes: ["Нужен ключ OpenRouter"] },
                { name: "Снег №1", author: "@tvigl", descr: "Падающие снежинки и мерцающие гирлянды.", link: "https://tvigl.github.io/plugins/new_year1.js" },
                { name: "Снег №2", author: "@tvigl", descr: "Мягкий снег, оседающий на карточках; настраивается интенсивность.", link: "https://tvigl.github.io/plugins/new_year2.js" },
                { name: "Снег №3", author: "@nemiroff", descr: "Просто падающий снег.", link: "https://nemiroff.github.io/lampa/snow.js" },
                { name: "Гирлянда", author: "@tvigl", descr: "Простая гирлянда в шапке.", link: "https://tvigl.github.io/plugins/new_year3.js" },
                { name: "Дождь со звуком", author: "@weritos666", descr: "Реалистичный дождь с фоновым звуком, можно использовать как заставку.", link: "https://weritos666.github.io/rain_realistic_sound.js", notes: ["Вес ~1,4 МБ", "На ТВ эффекты урезаны"] },
                { name: "Туман", author: "@mulumuu", descr: "Эффект тумана.", link: "https://mulumuu.github.io/mulumuu.githib.io/Vanta.js" },
                { name: "Меню для телефонов", author: "@tvigl", descr: "В горизонтальном режиме переносит иконки меню в кнопки.", link: "https://tvigl.github.io/plugins/phone_menu.js" },
                { name: "Отключить Shots", author: "@tvigl", descr: "Убирает Shots из бокового меню и из кнопки просмотра.", link: "https://tvigl.github.io/plugins/shots.js" },
                { name: "Дорамы", author: "@tvigl", descr: "Пункт «Дорамы» в левом боковом меню.", link: "https://tvigl.github.io/plugins/dorama.js" },
                { name: "Wiki о фильме", author: "@tvigl", descr: "Пункт в карточке фильма с подробным описанием.", link: "https://tvigl.github.io/plugins/WikiFind.js" },
                { name: "Загрузка при старте в стиле «Матрица»", author: "@pavelpikta", descr: "Анимация при запуске Lampa в стиле «Матрицы».", link: "https://tvigl.github.io/plugins/lampa-loader.js" },
                { name: "Поиск с подсказками", author: "@nikitagk22", descr: "Подсказки в поиске после 3 введённых символов.", link: "https://nikitagk22.github.io/suggest.js", notes: ["Проверено на Lampac NG", "На Alcopac не проверено"] },
                { name: "Фильтр ленты — убрать лишнее с главной", author: "hub.alcopa.cc", descr: "Убирает кино выбранных стран, эротику, карточки без постера, малоизвестное.", link: "https://hub.alcopa.cc/dl/feed_filter/v1.0.0/plugin.js" },
                { name: "Favorite Plus — свои категории в Избранном", author: "@anclaver", descr: "Создание, переименование и удаление категорий Избранного.", link: "https://anclaver.github.io/Lampa/plugins/favoritePlus.js" },
                { name: "Profiles — профили без CUB", author: "@levende", descr: "Независимые профили со своими настройками, интеграция с Lampac.", link: "https://levende.github.io/lampa-plugins/profiles.js" },
                { name: "Bookmarks Sync — синхронизация закладок с CUB", author: "@levende", descr: "Синхронизирует закладки и историю с CUB.", link: "https://levende.github.io/lampa-plugins/bookmarks-sync.js", notes: ["Заменяет локальные закладки данными из CUB"] },
                { name: "History Filter — чистка истории просмотров", author: "@levende", descr: "Фильтрует и удаляет элементы истории по разным критериям.", link: "https://levende.github.io/lampa-plugins/history-filter.js" },
                { name: "Trash Filter — фильтр мусора в поиске", author: "@levende", descr: "Убирает из поиска некачественный и мусорный контент.", link: "https://levende.github.io/lampa-plugins/trash-filter.js" },
                { name: "LParty — совместный просмотр с друзьями", author: "@nrsua", descr: "Синхронный просмотр с друзьями на разных устройствах.", link: "https://nrsua.github.io/lampa-nrs/lparty.js" },
                { name: "VoBoost — громкость выше 100%", author: "@nrsua", descr: "Поднимает громкость выше 100% для тихих видео.", link: "https://nrsua.github.io/lampa-nrs/voboost.js", notes: ["Только во встроенном плеере"] },
                { name: "pipfs — видео в окне", author: "@cevamnelampaplagin", descr: "Картинка в картинке во встроенном плеере, поддерживает субтитры.", link: "https://cevamnelampaplagin.github.io/sharewithothers/pipfs.js" },
                { name: "Ytranslate — перевод на украинский", author: "@yarikrazor-star", descr: "Переводит на украинский названия, описания и слоганы.", link: "https://yarikrazor-star.github.io/lmp/ytranslate.js" },
                { name: "Radio — более 50 радиостанций", author: "@ne3nayskas", descr: "Раздел «Радио» с украинскими и мировыми станциями.", link: "https://ne3nayskas.github.io/plugins/radio.js" }
            ]
        }
    ];

    /* ---------- утилиты ---------- */
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // '#6366f1' -> '99,102,241' (для rgba(var(--c), …) в стилях)
    function rgbOf(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
        var n = parseInt(h, 16);
        if (h.length !== 6 || isNaN(n)) return '148,163,184';
        return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
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

    // Плагины с полем file получают ссылку рядом с этим файлом; если папку определить не удалось — пропускаются
    function resolveLinks(data) {
        var out = [];
        data.forEach(function (s) {
            var items = [];
            s.items.forEach(function (p) {
                if (!p.file) { items.push(p); return; }
                if (!BASE_URL) return;
                var q = {};
                for (var k in p) q[k] = p[k];
                q.link = BASE_URL + p.file;
                items.push(q);
            });
            out.push({ id: s.id, title: s.title, color: s.color, items: items });
        });
        return out;
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
            '.mys-card{width:20%;padding:.45em;box-sizing:border-box;-webkit-box-sizing:border-box}' +
            '.mys-card__in{position:relative;height:100%;border-radius:1em;overflow:hidden;background:#24262b;border:.15em solid rgba(255,255,255,.04);' +
                '-webkit-transition:-webkit-transform .15s;transition:transform .15s}' +
            '.mys-card.focus .mys-card__in{-webkit-transform:scale(1.04);transform:scale(1.04);border-color:#fff;box-shadow:0 .6em 2em rgba(0,0,0,.55)}' +
            '.mys-card__state{display:none;margin-bottom:.5em;padding:.2em .6em;border-radius:.4em;font-size:.72em;font-weight:700}' +
            '.mys-card__state.on{display:inline-block;background:#16a34a;color:#fff}' +
            '.mys-card__state.off{display:inline-block;background:#4b5563;color:#e5e7eb}' +
            '.mys-card__body{padding:.8em .8em .9em}' +
            '.mys-card__name{font-size:1.05em;line-height:1.25;font-weight:700;color:#fff;max-height:2.5em;overflow:hidden}' +
            '.mys-card__descr{margin-top:.45em;font-size:.82em;line-height:1.4;color:rgba(255,255,255,.72);max-height:4.2em;overflow:hidden}' +
            '.mys-card__foot{margin-top:.6em;font-size:.75em;color:rgba(255,255,255,.55)}' +
            '.mys-card__note{margin-left:.4em;color:#fbbf24}' +
            '@supports (--c:0){' +
                '.mys-card__in{background:linear-gradient(150deg,rgba(var(--c),.42) 0%,rgba(var(--c),.15) 55%,rgba(18,20,26,.5) 100%);' +
                    'border-color:rgba(var(--c),.55);box-shadow:0 .3em 1.2em rgba(var(--c),.22)}' +
                '.mys-card.focus .mys-card__in{border-color:#fff;box-shadow:0 .5em 2em rgba(var(--c),.7)}' +
                '.mys-card__author{display:inline-block;padding:.1em .6em;border-radius:1em;background:rgba(var(--c),.32);color:#fff}' +
                '.mys-section i{box-shadow:0 0 .9em rgba(var(--c),.95)}' +
                '.mys-tab.tinted{background:rgba(var(--c),.2);border-color:rgba(var(--c),.45);color:#fff}' +
                '.mys-tab.tinted.focus{border-color:#fff;background:rgba(var(--c),.5);color:#fff}' +
                '.mys-tab.tinted.active{background:rgba(var(--c),.88);border-color:rgba(var(--c),1);color:#fff}' +
                '.mys-tab.tinted.active.focus{border-color:#fff}' +
            '}' +
            '.mys-info__text{font-size:1em;line-height:1.55;color:rgba(255,255,255,.85);white-space:pre-line}' +
            '.mys-info__note{display:inline-block;margin:.8em .5em 0 0;padding:.3em .7em;border-radius:.5em;background:rgba(251,191,36,.15);color:#fbbf24;font-size:.85em;font-weight:600}' +
            '.mys-info__meta{margin-top:1em;font-size:.85em;color:rgba(255,255,255,.5);word-break:break-all}' +
            '@media screen and (max-width:1400px){.mys-card{width:25%}}' +
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
                sections = resolveLinks(data);
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
                return { id: s.id, title: s.title, count: s.items.length, color: s.color };
            }));

            tabList.forEach(function (t) {
                var tab = $('<div class="mys-tab selector' + (t.id === filter ? ' active' : '') + (t.color ? ' tinted" style="--c:' + rgbOf(t.color) : '') + '">' + esc(t.title) + '<span>' + esc(t.count) + '</span></div>');
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

                list.append('<div class="mys-section" style="--c:' + rgbOf(section.color) + '"><i style="background:' + esc(section.color) + '"></i>' + esc(section.title) + '</div>');

                var grid = $('<div class="mys-grid"></div>');
                section.items.forEach(function (plug) { grid.append(self.card(plug, section)); });
                list.append(grid);
            });
        };

        this.card = function (plug, section) {
            var note = plug.notes && plug.notes.length
                ? '<span class="mys-card__note">⚠ ' + esc(plug.notes.length > 1 ? 'есть условия' : plug.notes[0]) + '</span>' : '';

            var el = $('<div class="mys-card selector" style="--c:' + rgbOf(section.color) + '">' +
                '<div class="mys-card__in">' +
                    '<div class="mys-card__body">' +
                        '<div class="mys-card__state"></div>' +
                        '<div class="mys-card__name">' + esc(plug.name) + '</div>' +
                        '<div class="mys-card__descr">' + esc(plug.descr) + '</div>' +
                        '<div class="mys-card__foot"><span class="mys-card__author">' + esc(plug.author || '') + '</span>' + note + '</div>' +
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

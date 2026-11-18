(function () {
  'use strict';

  // ===== 1. Метаданные и константы =====
  var MANIFEST = {
    type: 'other',
    version: '1.4.4',
    name: 'КиноРулетка',
    description: 'Случайный выбор фильма или сериала с фильтрами, пресетами и историей',
    component: 'cinemaroulette'
  };

  var PREFIX = 'cinemaroulette_';
  var COMPONENT = 'cinemaroulette';
  var COMPONENT_HISTORY = 'cinemaroulette_history';
  var SETTINGS_COMPONENT = 'cinemaroulette_settings';
  var HISTORY_LIMIT = 50;
  var SPIN_TICKS = 20;              // всего тиков рулетки
  var SPIN_BASE = 80;               // базовый интервал, мс
  var SPIN_SLOW = [80, 160, 260];   // последние 3 тика: замедление 80→160→260
  var RESULT_DELAY = 250;           // пауза перед показом результата
  var POOL_TIMEOUT = 8000;          // максимум ожидания каталога
  var DAY = 86400000;

  var LANG = {
    title: 'КиноРулетка',
    kicker: 'Сегодня в зале',
    kickerHistory: 'Архив сеансов',
    kickerEmpty: 'Сеанс не найден',
    kickerHistoryEmpty: 'Зал пока пуст',
    menu: 'Рулетка',
    spin: 'Крутить',
    spinning: 'Крутим…',
    loading: 'Загрузка…',
    presets: 'Пресеты',
    genres: 'Жанры',
    filters: 'Фильтры',
    type: 'Тип',
    yearFrom: 'Год от',
    yearTo: 'Год до',
    rating: 'Рейтинг',
    duration: 'Длительность',
    surprise: 'Сюрприз',
    any: 'Любой',
    anyF: 'Любая',
    all: 'Все',
    typeMovie: 'Фильм',
    typeTv: 'Сериал',
    typeMovies: 'Фильмы',
    typeTvs: 'Сериалы',
    on: 'Вкл',
    off: 'Выкл',
    from: 'от ',
    upTo: 'до ',
    min: 'мин',
    reset: 'Сбросить',
    resetFilters: 'Сбросить фильтры',
    history: 'История',
    historyTitle: 'История рулетки',
    historyEmpty: 'История пока пуста',
    historyEmptyText: 'Крутните рулетку — результаты появятся здесь.',
    toRoulette: 'К рулетке',
    clear: 'Очистить',
    cleared: 'История очищена',
    watch: 'Смотреть',
    again: 'Ещё раз',
    favorite: 'В избранное',
    favAdded: 'Добавлено в закладки',
    favExists: 'Уже в закладках',
    open: 'Открыть',
    surpriseTitle: 'Фильм-сюрприз',
    surpriseHint: 'Название и постер скрыты — нажмите «Открыть»',
    empty: 'Ничего не найдено — ослабьте фильтры',
    emptyTitle: 'Попробуйте ослабить фильтры',
    emptyText: 'Под текущие условия не подошёл ни один вариант.',
    allSeen: 'Всё подходящее уже выпадало — разрешаем повторы',
    noId: 'Не удалось открыть карточку',
    disabled: 'КиноРулетка выключена в настройках',
    poolLoading: 'Загружаем каталог…',
    poolCount: 'В пуле: ',
    poolMatch: ' · подходит: ',
    items: 'Записей: ',
    setEnabled: 'Включить плагин',
    setEnabledDesc: 'Полностью включает или выключает КиноРулетку',
    setMenu: 'Кнопка в меню',
    setMenuDesc: 'Показывать пункт «Рулетка» в главном меню',
    setRepeat: 'Исключать повторы',
    setRepeatDesc: 'Не предлагать то, что уже выпадало за период',
    setSurprise: 'Сюрприз-режим по умолчанию',
    setSurpriseDesc: 'Скрывать название и постер до нажатия «Открыть»',
    setReset: 'Сбросить историю',
    setResetDesc: 'Удалить все сохранённые результаты',
    setOpen: 'Открыть рулетку',
    rep7: '7 дней',
    rep30: '30 дней',
    repAlways: 'Всегда',
    repOff: 'Не исключать'
  };

  var GENRES = [
    { id: 28, name: 'Боевик' }, { id: 12, name: 'Приключения' }, { id: 16, name: 'Мультфильм' },
    { id: 35, name: 'Комедия' }, { id: 80, name: 'Криминал' }, { id: 99, name: 'Документальный' },
    { id: 18, name: 'Драма' }, { id: 10751, name: 'Семейный' }, { id: 14, name: 'Фэнтези' },
    { id: 36, name: 'История' }, { id: 27, name: 'Ужасы' }, { id: 10402, name: 'Музыка' },
    { id: 9648, name: 'Детектив' }, { id: 10749, name: 'Мелодрама' }, { id: 878, name: 'Фантастика' },
    { id: 53, name: 'Триллер' }, { id: 10752, name: 'Военный' }, { id: 37, name: 'Вестерн' }
  ];
  // Жанры сериалов TMDB → жанры фильмов
  var TV_GENRE_MAP = { 10759: [28, 12], 10765: [878, 14], 10762: [10751, 16], 10768: [10752], 10766: [18], 10763: [99] };
  var GENRE_NAMES = {};
  (function () { for (var i = 0; i < GENRES.length; i++) GENRE_NAMES[GENRES[i].id] = GENRES[i].name; })();

  var PRESETS = [
    { id: 'background', title: 'Фоном', f: { genres: [35, 16, 10402], type: 'tv', rating: 6 } },
    { id: 'evening', title: 'На один вечер', f: { type: 'movie', rating: 7, duration: 150 } },
    { id: 'think', title: 'Хочу подумать', f: { genres: [18, 9648, 878, 99], rating: 7.5 } },
    { id: 'family', title: 'Семейное', f: { genres: [10751, 16, 12], rating: 6 } },
    { id: 'short', title: 'Не дольше 100 минут', f: { type: 'movie', duration: 100 } }
  ];

  var CUR_YEAR = new Date().getFullYear();
  var OPTIONS = {
    type: [{ v: 'all', t: LANG.all }, { v: 'movie', t: LANG.typeMovies }, { v: 'tv', t: LANG.typeTvs }],
    yearFrom: [0, 1970, 1980, 1990, 2000, 2010, 2015, 2020, 2023],
    yearTo: [0, 1990, 2000, 2010, 2015, 2020, 2023, CUR_YEAR],
    rating: [0, 5, 6, 6.5, 7, 7.5, 8],
    duration: [0, 90, 100, 120, 150, 180]
  };
  (function () {
    function wrap(list, fmt) {
      var out = [], seen = {};
      for (var i = 0; i < list.length; i++) {
        if (seen[list[i]]) continue;
        seen[list[i]] = 1;
        out.push({ v: list[i], t: fmt(list[i]) });
      }
      return out;
    }
    OPTIONS.yearFrom = wrap(OPTIONS.yearFrom, function (v) { return v ? LANG.from + v : LANG.any; });
    OPTIONS.yearTo = wrap(OPTIONS.yearTo, function (v) { return v ? LANG.upTo + v : LANG.any; });
    OPTIONS.rating = wrap(OPTIONS.rating, function (v) { return v ? LANG.from + v : LANG.any; });
    OPTIONS.duration = wrap(OPTIONS.duration, function (v) { return v ? LANG.upTo + v + ' ' + LANG.min : LANG.anyF; });
  })();

  var ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21"/></svg>';

  // ===== 2. CSS (инжект один раз) =====
  // Используем шрифт интерфейса LAMPA.
  function injectStyles() {
    if (window.__cinemaroulette_css__) return;
    window.__cinemaroulette_css__ = true;
    var css = [
      '/* ====== Палитра «Океан»: глубокий синий + лазурь и бирюза ====== */',
      ':root {',
      '  --cr-bg: #0b2340; --cr-bg-2: #0e2a4a; --cr-surface: rgba(255,255,255,0.05); --cr-surface-2: rgba(255,255,255,0.09);',
      '  --cr-solid: #13304f; --cr-text: #f2f7fc; --cr-text-2: #a8bfd6; --cr-ink: #04182b;',
      '  --cr-c1: #4f8ef7; --cr-c2: #38bdf8; --cr-c3: #67e8f9; --cr-mint: #86efac;',
      '  --cr-grad: linear-gradient(110deg, #4f8ef7 0%, #38bdf8 50%, #67e8f9 100%);',
      '  --cr-grad-soft: linear-gradient(110deg, rgba(79,142,247,0.22), rgba(103,232,249,0.14));',
      '  --cr-line: rgba(255,255,255,0.10); --cr-line-2: rgba(255,255,255,0.18);',
      '  --cr-fs: 15px; --cr-fs-s: 13px; --cr-fs-l: 11px; --cr-fs-h: 20px; --cr-fs-xl: 34px;',
      '  --cr-poster: 220px; --cr-ring: 2px;',
      '  --cr-font: inherit;',
      '  --cr-display: inherit;',
      '}',
      '/* ====== Экран ====== */',
      '.cr-scroll { height: 100%; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;',
      '  background: #202020; }',
      '.cr-scroll::-webkit-scrollbar { display: none; }',
      '.cr-screen { color: var(--cr-text); font-family: var(--cr-font); font-weight: 400; font-size: var(--cr-fs); line-height: 1.5;',
      '  min-height: 100%; padding: 24px 0 96px; box-sizing: border-box; font-variant-numeric: tabular-nums; }',
      '.cr-screen * { box-sizing: border-box; }',
      '.cr-wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }',
      '/* ====== Шапка с градиентной рамкой ====== */',
      '.cr-marquee { position: relative; overflow: hidden; padding: 32px 36px; margin-bottom: 8px; border-radius: 32px; border: 2px solid transparent;',
      '  background: linear-gradient(135deg, #12335a, #0d2848) padding-box, var(--cr-grad) border-box;',
      '  box-shadow: 0 20px 48px rgba(0,0,0,0.35), 0 0 48px rgba(56,189,248,0.12); }',
      '.cr-marquee:before, .cr-marquee:after { content: ""; position: absolute; border-radius: 50%; pointer-events: none; transition: opacity 0.3s ease; }',
      '.cr-marquee:before { width: 360px; height: 360px; right: -90px; top: -200px; opacity: 0.55;',
      '  background: radial-gradient(circle, rgba(56,189,248,0.55), rgba(79,142,247,0.18) 45%, rgba(79,142,247,0) 70%); }',
      '.cr-marquee:after { width: 260px; height: 260px; left: 32%; bottom: -190px; opacity: 0.45;',
      '  background: radial-gradient(circle, rgba(103,232,249,0.45), rgba(103,232,249,0) 70%); }',
      '.cr-marquee.cr-lit:before, .cr-marquee.cr-lit:after { animation: cr-lit 1.2s ease-out 1; }',
      '@keyframes cr-lit { 0% { opacity: 0.3; } 35% { opacity: 1; } 100% { opacity: 0.55; } }',
      '.cr-marquee__inner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }',
      '.cr-head__text { min-width: 0; margin-right: 16px; }',
      '.cr-kicker { display: inline-block; padding: 4px 14px; border-radius: 999px; background: rgba(103,232,249,0.12); border: 1px solid rgba(103,232,249,0.35);',
      '  font-size: var(--cr-fs-l); font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cr-c3); }',
      '.cr-title { font-family: var(--cr-display); font-size: var(--cr-fs-xl); font-weight: 400; line-height: 1.35; padding: 0 0 0.15em; overflow: visible; margin: 12px 0 10px; letter-spacing: -0.01em; color: var(--cr-c3); }',
      '@supports ((-webkit-background-clip: text) or (background-clip: text)) {',
      '  .cr-title { background: var(--cr-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }',
      '}',
      '.cr-sub { font-size: var(--cr-fs-s); color: var(--cr-text-2); }',
      '.cr-label { display: flex; align-items: center; font-size: var(--cr-fs-l); font-weight: 400; letter-spacing: 0.16em;',
      '  text-transform: uppercase; color: var(--cr-text-2); margin: 24px 0 8px; }',
      '.cr-label:before { content: ""; width: 10px; height: 10px; margin-right: 10px; border-radius: 50%; background: var(--cr-grad); box-shadow: 0 0 10px rgba(56,189,248,0.6); }',
      '.cr-label:after { content: ""; flex: 1; height: 1px; margin-left: 16px; background: linear-gradient(90deg, var(--cr-line-2), rgba(255,255,255,0)); }',
      '/* ====== Ряды и овальные чипы ====== */',
      '.cr-row { display: flex; flex-wrap: wrap; padding: 8px 8px 0; margin: 0 -8px; }',
      '.cr-row::-webkit-scrollbar { display: none; }',
      '.cr-chip { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 40px; padding: 8px 18px; margin: 0 8px 8px 0;',
      '  border-radius: 999px; border: 1px solid var(--cr-line-2); background: var(--cr-surface); color: var(--cr-text); font-size: var(--cr-fs-s); font-weight: 400; line-height: 1.2;',
      '  white-space: nowrap; cursor: pointer; user-select: none; outline: 2px solid transparent; outline-offset: 0;',
      '  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }',
      '.cr-chip:hover { border-color: rgba(103,232,249,0.55); }',
      '.cr-chip.cr-on { background: var(--cr-grad); border-color: transparent; color: var(--cr-ink); font-weight: 400; box-shadow: 0 6px 18px rgba(56,160,248,0.30); }',
      '.cr-chip--preset { padding: 8px 22px; font-weight: 400; background: var(--cr-grad-soft); border-color: rgba(56,189,248,0.35); }',
      '.cr-chip--preset:before { content: ""; width: 8px; height: 8px; margin-right: 10px; border-radius: 50%; background: var(--cr-c2); }',
      '.cr-chip--preset.cr-on:before { background: var(--cr-ink); }',
      '/* ====== Овальные фильтры ====== */',
      '.cr-select { flex-shrink: 0; display: inline-flex; flex-direction: column; justify-content: center; min-width: 140px; min-height: 56px;',
      '  padding: 8px 26px; margin: 0 8px 8px 0; border-radius: 999px; background: var(--cr-surface); border: 1px solid var(--cr-line-2);',
      '  cursor: pointer; user-select: none; outline: 2px solid transparent; outline-offset: 0;',
      '  transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease; }',
      '.cr-select:hover { border-color: rgba(103,232,249,0.5); }',
      '.cr-select__k { font-size: var(--cr-fs-l); font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cr-text-2); line-height: 1.3; }',
      '.cr-select__v { font-size: var(--cr-fs-s); font-weight: 400; white-space: nowrap; color: var(--cr-text); margin-top: 2px; }',
      '.cr-select.cr-on { border-color: rgba(56,189,248,0.6); background: var(--cr-grad-soft); }',
      '.cr-select.cr-on .cr-select__v { color: var(--cr-c3); }',
      '/* ====== Кнопки-капсулы ====== */',
      '.cr-actions { display: flex; flex-wrap: wrap; align-items: center; margin-top: 24px; }',
      '.cr-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 12px 26px; margin: 0 10px 10px 0;',
      '  border-radius: 999px; border: 1px solid transparent; background: var(--cr-grad); color: var(--cr-ink); font-size: var(--cr-fs);',
      '  font-weight: 400; line-height: 1.2; white-space: nowrap; cursor: pointer; user-select: none; outline: 2px solid transparent; outline-offset: 0;',
      '  box-shadow: 0 10px 26px rgba(56,160,248,0.30); transition: box-shadow 0.2s ease, transform 0.15s ease, opacity 0.2s ease, background 0.2s ease; }',
      '.cr-btn:hover, .cr-btn.focus { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(56,160,248,0.45); }',
      '.cr-btn:active { transform: translateY(0); }',
      '.cr-btn--spin { min-width: 220px; padding-left: 36px; padding-right: 36px; letter-spacing: 0.08em; text-transform: uppercase; }',
      '.cr-btn--spin:before { content: ""; width: 0; height: 0; margin-right: 12px; border-style: solid; border-width: 7px 0 7px 11px;',
      '  border-color: transparent transparent transparent var(--cr-ink); }',
      '.cr-btn--ghost { background: var(--cr-surface); border-color: var(--cr-line-2); color: var(--cr-text); font-weight: 400; box-shadow: none; }',
      '.cr-btn--ghost:hover, .cr-btn--ghost.focus { background: var(--cr-surface-2); border-color: rgba(103,232,249,0.6); box-shadow: 0 8px 22px rgba(0,0,0,0.25); }',
      '.cr-btn.cr-disabled { opacity: 0.55; cursor: default; transform: none; }',
      '/* ====== Фокус с пульта ====== */',
      '.cr-btn.focus, .cr-chip.focus, .cr-select.focus, .cr-hist__item.focus { outline: var(--cr-ring) solid #fff; outline-offset: 3px; }',
      '.cr-chip.focus, .cr-select.focus { transform: translateY(-2px); }',
      '.cr-chip.focus { border-color: rgba(255,255,255,0.5); }',
      '/* ====== Вращение ====== */',
      '.cr-stage { margin-top: 16px; }',
      '.cr-reel { position: relative; overflow: hidden; display: flex; align-items: center; padding: 18px 32px 18px 18px; border-radius: 36px; border: 2px solid transparent;',
      '  background: linear-gradient(135deg, #12335a, #0d2848) padding-box, var(--cr-grad) border-box;',
      '  box-shadow: 0 0 40px rgba(56,189,248,0.22); transition: opacity 0.12s ease-out, transform 0.12s ease-out; }',
      '.cr-reel.cr-flash { opacity: 0.6; transform: scale(0.985); transition: none; }',
      '.cr-reel__poster { width: 80px; height: 120px; flex-shrink: 0; margin-right: 24px; border-radius: 18px;',
      '  background: var(--cr-solid) center / cover no-repeat; box-shadow: 0 0 0 3px rgba(103,232,249,0.35); }',
      '.cr-reel__body { flex: 1; min-width: 0; }',
      '.cr-reel__title { font-family: var(--cr-display); font-size: var(--cr-fs-h); font-weight: 400; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.cr-reel__meta { font-size: var(--cr-fs-s); color: var(--cr-text-2); margin-top: 8px; }',
      '/* ====== Карточка результата ====== */',
      '.cr-ticket { position: relative; overflow: hidden; border-radius: 32px; border: 2px solid transparent;',
      '  background: linear-gradient(160deg, #12335a, #0c2442) padding-box, var(--cr-grad) border-box;',
      '  box-shadow: 0 24px 56px rgba(0,0,0,0.40), 0 0 56px rgba(56,160,248,0.14); }',
      '.cr-appear { animation: cr-appear 0.3s ease-out both; }',
      '@keyframes cr-appear { from { opacity: 0; transform: translateY(10px) scale(0.99); } to { opacity: 1; transform: translateY(0) scale(1); } }',
      '.cr-card { display: flex; align-items: flex-start; padding: 26px; }',
      '.cr-poster { width: var(--cr-poster); flex-shrink: 0; margin-right: 28px; }',
      '.cr-poster__box { position: relative; padding-top: 150%; border-radius: 24px; overflow: hidden; background: var(--cr-grad-soft), var(--cr-solid);',
      '  box-shadow: 0 14px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08); }',
      '.cr-poster__box--hidden { background: repeating-linear-gradient(135deg, rgba(56,189,248,0.16) 0, rgba(56,189,248,0.16) 14px, rgba(0,0,0,0) 14px, rgba(0,0,0,0) 28px), var(--cr-solid); }',
      '.cr-poster__ph, .cr-poster__img { position: absolute; left: 0; top: 0; right: 0; bottom: 0; }',
      '.cr-poster__ph { display: flex; align-items: center; justify-content: center; font-family: var(--cr-display); font-size: 60px; font-weight: 400; color: var(--cr-c3); }',
      '.cr-poster__img { background: center / cover no-repeat; }',
      '.cr-info { flex: 1; min-width: 0; }',
      '.cr-card__title { font-family: var(--cr-display); font-size: calc(var(--cr-fs-h) * 1.3); font-weight: 400; line-height: 1.2; margin: 4px 0 10px; letter-spacing: -0.01em; }',
      '.cr-meta { font-size: var(--cr-fs-s); color: var(--cr-text-2); margin-bottom: 14px; }',
      '.cr-rate { display: inline-block; padding: 0 12px; border-radius: 999px; background: rgba(134,239,172,0.12); border: 1px solid rgba(134,239,172,0.45); color: var(--cr-mint);',
      '  font-weight: 400; line-height: 24px; }',
      '.cr-tags { margin-bottom: 8px; }',
      '.cr-tag { display: inline-block; padding: 0 14px; margin: 0 8px 8px 0; border-radius: 999px; background: var(--cr-grad-soft); border: 1px solid rgba(56,189,248,0.35); color: var(--cr-c3);',
      '  font-size: var(--cr-fs-l); font-weight: 400; letter-spacing: 0.06em; text-transform: uppercase; line-height: 26px; }',
      '.cr-desc { font-size: var(--cr-fs); line-height: 1.6; color: var(--cr-text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 6;',
      '  -webkit-box-orient: vertical; max-height: 9.6em; }',
      '.cr-note { font-size: var(--cr-fs-s); color: #ff9aa2; margin-top: 8px; font-weight: 400; }',
      '.cr-stub { display: flex; flex-wrap: wrap; align-items: center; padding: 0 26px 18px; }',
      '.cr-stub__cell { display: inline-flex; align-items: baseline; padding: 6px 18px; margin: 0 8px 8px 0; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid var(--cr-line); }',
      '.cr-stub__k { font-size: var(--cr-fs-l); font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cr-text-2); margin-right: 8px; }',
      '.cr-stub__v { font-size: var(--cr-fs); font-weight: 400; color: var(--cr-c3); }',
      '.cr-barcode { display: none; }',
      '/* ====== Подсказка (пустой пул) ====== */',
      '.cr-hint { padding: 40px 24px; text-align: center; border-radius: 32px; background: var(--cr-surface); border: 2px dashed rgba(255,95,109,0.45); }',
      '.cr-hint .cr-kicker { color: #ff9aa2; background: rgba(255,95,109,0.12); border-color: rgba(255,95,109,0.4); }',
      '.cr-hint__title { font-family: var(--cr-display); font-size: var(--cr-fs-h); font-weight: 400; margin: 14px 0 8px; }',
      '.cr-hint__text { color: var(--cr-text-2); font-size: var(--cr-fs-s); }',
      '.cr-hint .cr-actions { justify-content: center; margin-top: 18px; }',
      '/* ====== История — капсулы ====== */',
      '.cr-hist { margin-top: 16px; }',
      '.cr-hist__item { display: flex; align-items: center; padding: 8px 10px 8px 8px; margin-bottom: 10px; border-radius: 999px; background: var(--cr-surface);',
      '  border: 1px solid var(--cr-line); cursor: pointer; outline: 2px solid transparent; outline-offset: 0;',
      '  transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease; }',
      '.cr-hist__item:hover, .cr-hist__item.focus { background: var(--cr-surface-2); border-color: rgba(103,232,249,0.5); }',
      '.cr-hist__poster { width: 48px; height: 72px; flex-shrink: 0; margin-right: 16px; border-radius: 999px; background: var(--cr-grad-soft), var(--cr-solid); background-position: center; background-size: cover; background-repeat: no-repeat; }',
      '.cr-hist__body { flex: 1; min-width: 0; }',
      '.cr-hist__title { font-family: var(--cr-display); font-size: var(--cr-fs); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.cr-hist__meta { font-size: var(--cr-fs-s); color: var(--cr-text-2); margin-top: 2px; }',
      '.cr-hist__date { flex-shrink: 0; padding: 6px 16px; margin-left: 16px; border-radius: 999px; background: var(--cr-grad-soft); border: 1px solid rgba(56,189,248,0.3);',
      '  font-size: var(--cr-fs-l); font-weight: 400; color: var(--cr-c3); white-space: nowrap; }',
      '/* ====== Планшет ====== */',
      '@media (max-width: 960px) { :root { --cr-poster: 180px; --cr-fs-xl: 32px; } }',
      '/* ====== Мобильные ====== */',
      '@media (max-width: 480px) {',
      '  :root { --cr-fs-xl: 24px; }',
      '  .cr-wrap { padding: 0 16px; }',
      '  .cr-marquee { padding: 24px 22px; border-radius: 28px; }',
      '  .cr-marquee__inner { flex-direction: column; align-items: flex-start; }',
      '  .cr-marquee__inner .cr-btn { margin-top: 14px; }',
      '  .cr-row { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; margin: 0 -16px; padding: 8px 16px 0; }',
      '  .cr-card { flex-direction: column; align-items: stretch; padding: 18px; }',
      '  .cr-poster { width: 64%; max-width: 240px; margin: 0 auto 16px; }',
      '  .cr-actions .cr-btn { flex: 1 1 auto; }',
      '  .cr-chip, .cr-select { min-height: 44px; }',
      '  .cr-reel { padding: 12px 20px 12px 12px; } .cr-reel__poster { width: 56px; height: 84px; margin-right: 16px; }',
      '  .cr-stub { padding: 0 18px 12px; }',
      '  .cr-hist__date { display: none; }',
      '}',
      '/* ====== TV: крупнее ×1.3, заметнее фокус ====== */',
      '@media (min-width: 1200px) {',
      '  :root { --cr-fs: 17px; --cr-fs-s: 15px; --cr-fs-l: 12px; --cr-fs-h: 24px; --cr-fs-xl: 42px; --cr-poster: 230px; --cr-ring: 3px; }',
      '  .cr-wrap { max-width: 1240px; padding: 0 32px; }',
      '  .cr-marquee { padding: 40px 48px; border-radius: 40px; }',
      '  .cr-card { padding: 34px; } .cr-stub { padding: 0 34px 24px; }',
      '  .cr-btn { padding: 14px 30px; min-height: 52px; }',
      '  .cr-chip { padding: 8px 22px; min-height: 44px; } .cr-chip--preset { padding: 8px 26px; }',
      '  .cr-select { min-height: 64px; min-width: 160px; padding: 8px 28px; }',
      '  .cr-reel__poster { width: 104px; height: 156px; }',
      '  .cr-hist__poster { width: 60px; height: 90px; }',
      '}',
      '/* ====== Уменьшенная анимация ====== */',
      '@media (prefers-reduced-motion: reduce) {',
      '  .cr-screen *, .cr-screen *:before, .cr-screen *:after { transition: none !important; animation: none !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.setAttribute('data-cr', 'cinemaroulette');
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  // ===== 3. Утилиты =====
  function L(name) {
    return (window.Lampa && window.Lampa[name]) ? window.Lampa[name] : null;
  }

  function store(key, val) {
    var S = L('Storage');
    try {
      if (S && S.set) S.set(PREFIX + key, val);
      else window.localStorage.setItem(PREFIX + key, JSON.stringify(val));
    } catch (e) { /* хранилище недоступно */ }
  }

  function load(key, def) {
    var S = L('Storage'), v;
    try {
      if (S && S.get) v = S.get(PREFIX + key, def);
      else {
        var raw = window.localStorage.getItem(PREFIX + key);
        v = raw === null ? def : JSON.parse(raw);
      }
    } catch (e) { v = def; }
    if (v === undefined || v === null || v === '') return def;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (typeof v === 'string' && def !== null && typeof def === 'object') {
      try { v = JSON.parse(v); } catch (e2) { return def; }
    }
    return v;
  }

  function lampaGet(key, def) {
    var S = L('Storage');
    try { return S && S.get ? S.get(key, def) : def; } catch (e) { return def; }
  }

  function noty(msg) {
    var N = L('Noty');
    if (N && N.show) N.show(msg); else console.log('[Cinemaroulette] ' + msg);
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  function now() { return new Date().getTime(); }

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function posterUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    try {
      var A = L('Api'), T = L('TMDB');
      if (A && typeof A.img === 'function') return A.img(path, 'w300');
      if (T && typeof T.image === 'function') return T.image('t/p/w300' + path);
    } catch (e) { /* нет доступа к картинкам */ }
    return '';
  }

  function bgStyle(url) {
    return url ? ' style="background-image:url(\'' + escapeHtml(url) + '\')"' : '';
  }

  // Приводим карточку любой формы к единому виду
  function normalize(raw, hint) {
    if (!raw || typeof raw !== 'object') return null;
    var title = raw.title || raw.name || raw.original_title || raw.original_name;
    if (!title) return null;
    var date = raw.release_date || raw.first_air_date || raw.year || '';
    var type = hint || raw.media_type || raw.type || '';
    if (type !== 'tv' && type !== 'movie') type = (raw.first_air_date || raw.number_of_seasons || (raw.name && !raw.title)) ? 'tv' : 'movie';
    var ids = [], src = raw.genre_ids || raw.genres || [], i, g;
    for (i = 0; i < src.length; i++) {
      g = typeof src[i] === 'object' ? parseInt(src[i].id, 10) : parseInt(src[i], 10);
      if (!g) continue;
      if (TV_GENRE_MAP[g]) ids = ids.concat(TV_GENRE_MAP[g]); else ids.push(g);
    }
    var runtime = parseInt(raw.runtime, 10) || (raw.episode_run_time && parseInt(raw.episode_run_time[0], 10)) || 0;
    return {
      key: type + ':' + (raw.id || title),
      id: raw.id || 0,
      title: String(title),
      year: parseInt(String(date).slice(0, 4), 10) || 0,
      type: type,
      rating: parseFloat(raw.vote_average) || 0,
      runtime: runtime,
      genres: ids,
      overview: raw.overview || '',
      poster: raw.poster_path || raw.poster || raw.img || '',
      raw: raw
    };
  }

  // Мягкая фильтрация: нет поля → фильтр игнорируется
  function matchFilters(item, f) {
    if (!item || !f) return false;
    if (f.genres && f.genres.length && item.genres.length) {
      var hit = false;
      for (var i = 0; i < f.genres.length; i++) if (item.genres.indexOf(f.genres[i]) >= 0) { hit = true; break; }
      if (!hit) return false;
    }
    if (f.type && f.type !== 'all' && item.type && item.type !== f.type) return false;
    if (f.yearFrom && item.year && item.year < f.yearFrom) return false;
    if (f.yearTo && item.year && item.year > f.yearTo) return false;
    if (f.rating && item.rating && item.rating < f.rating) return false;
    if (f.duration && item.runtime && item.runtime > f.duration) return false;
    return true;
  }

  function defaultFilters() {
    return { genres: [], type: 'all', yearFrom: 0, yearTo: 0, rating: 0, duration: 0, preset: '', surprise: load('surprise', false) === true };
  }

  function loadFilters() {
    var f = defaultFilters(), s = load('filters', null), k;
    if (s && typeof s === 'object') for (k in f) if (k !== 'surprise' && s.hasOwnProperty(k)) f[k] = s[k];
    if (!(isArray(f.genres))) f.genres = [];
    return f;
  }

  function saveFilters(f) {
    store('filters', { genres: f.genres, type: f.type, yearFrom: f.yearFrom, yearTo: f.yearTo, rating: f.rating, duration: f.duration, preset: f.preset });
  }

  function optionLabel(key, val) {
    if (key === 'surprise') return val ? LANG.on : LANG.off;
    var list = OPTIONS[key] || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].v) === String(val)) return list[i].t;
    return list.length ? list[0].t : '';
  }

  function metaHtml(item) {
    var p = [];
    if (item.year) p.push(String(item.year));
    if (item.type) p.push(item.type === 'tv' ? LANG.typeTv : LANG.typeMovie);
    if (item.rating) p.push('<span class="cr-rate">★ ' + Number(item.rating).toFixed(1) + '</span>');
    if (item.runtime) p.push(item.runtime + ' ' + LANG.min);
    return p.join(' · ');
  }

  function genreNames(item) {
    var out = [], seen = {};
    for (var i = 0; i < item.genres.length; i++) {
      var n = GENRE_NAMES[item.genres[i]];
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
    }
    return out;
  }

  // --- История ---
  function loadHistory() {
    var h = load('history', []);
    return isArray(h) ? h : [];
  }

  function trimCard(item) {
    var raw = item.raw || {}, card = {}, keys = ['id', 'title', 'name', 'original_title', 'original_name', 'poster_path',
      'backdrop_path', 'release_date', 'first_air_date', 'vote_average', 'genre_ids', 'media_type', 'source',
      'number_of_seasons', 'runtime', 'poster', 'img', 'url'];
    for (var i = 0; i < keys.length; i++) if (raw[keys[i]] !== undefined) card[keys[i]] = raw[keys[i]];
    card.overview = String(raw.overview || '').slice(0, 400);
    if (!card.genre_ids) card.genre_ids = item.genres;
    if (!card.media_type) card.media_type = item.type;
    return card;
  }

  function addHistory(item) {
    var list = loadHistory(), out = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].key !== item.key) out.push(list[i]);
    out.unshift({ key: item.key, ts: now(), title: item.title, year: item.year, type: item.type, rating: item.rating, poster: item.poster, card: trimCard(item) });
    store('history', out.slice(0, HISTORY_LIMIT));
  }

  function excludedKeys() {
    var period = String(load('repeat', '7')), map = {};
    if (period === 'off') return map;
    var limit = period === 'always' ? 0 : now() - (parseInt(period, 10) || 7) * DAY;
    var list = loadHistory();
    for (var i = 0; i < list.length; i++) if (list[i] && (!limit || list[i].ts >= limit)) map[list[i].key] = 1;
    return map;
  }

  function formatDate(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // --- Пул кандидатов ---
  var POOL = { map: {}, list: [], loading: false, loaded: false, waiters: [] };

  function poolAdd(arr, hint) {
    if (!arr || !arr.length) return;
    for (var i = 0; i < arr.length; i++) {
      var it = normalize(arr[i], hint);
      if (it && !POOL.map[it.key]) { POOL.map[it.key] = it; POOL.list.push(it); }
    }
  }

  function collectLocal() {
    var F = L('Favorite'), types = ['book', 'like', 'wath', 'history', 'look', 'viewed', 'scheduled', 'continued'], i, k;
    if (F && typeof F.get === 'function') {
      for (i = 0; i < types.length; i++) {
        try { poolAdd(F.get({ type: types[i] })); } catch (e) { /* тип не поддерживается */ }
      }
    }
    var fav = lampaGet('favorite', {});
    if (fav && typeof fav === 'object') for (k in fav) if (isArray(fav[k])) poolAdd(fav[k]);
    var favs = lampaGet('favorites', []);
    if (isArray(favs)) poolAdd(favs);
    var hist = lampaGet('history', []);
    if (isArray(hist)) poolAdd(hist);
  }

  function requestList(url, page, ok, fail) {
    var A = L('Api'), params = { url: url, page: page, source: 'tmdb' };
    try {
      var srcs = A && A.sources, cur = String(lampaGet('source', 'tmdb'));
      var src = srcs && ((srcs.tmdb && typeof srcs.tmdb.list === 'function' && srcs.tmdb) ||
        (srcs[cur] && typeof srcs[cur].list === 'function' && srcs[cur]));
      if (src) { src.list(params, ok, fail); return true; }
      if (A && typeof A.list === 'function') { A.list(params, ok, fail); return true; }
    } catch (e) { /* API источника недоступно */ }
    return false;
  }

  function loadPool(cb) {
    collectLocal();
    if (POOL.loaded) { cb(POOL.list); return; }
    POOL.waiters.push(cb);
    if (POOL.loading) return;
    POOL.loading = true;
    var jobs = [
      { url: 'movie/popular', page: 1, type: 'movie' }, { url: 'movie/popular', page: 2, type: 'movie' },
      { url: 'movie/top_rated', page: 1, type: 'movie' }, { url: 'movie/top_rated', page: 2, type: 'movie' },
      { url: 'tv/popular', page: 1, type: 'tv' }, { url: 'tv/popular', page: 2, type: 'tv' },
      { url: 'tv/top_rated', page: 1, type: 'tv' }, { url: 'tv/top_rated', page: 2, type: 'tv' }
    ];
    var left = jobs.length, finished = false, timer = null, remote = 0;
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      POOL.loading = false;
      POOL.loaded = remote > 0; // каталог пуст — попробуем снова при следующем запуске
      var w = POOL.waiters;
      POOL.waiters = [];
      for (var i = 0; i < w.length; i++) { try { w[i](POOL.list); } catch (e) { console.log('[Cinemaroulette]', e); } }
    }
    function makeJob(job) {
      var done = false;
      function settle() { if (done) return; done = true; left--; if (left <= 0) finish(); }
      var started = requestList(job.url, job.page, function (data) {
        var arr = data && data.results ? data.results : (isArray(data) ? data : []);
        if (finished) return; // ответ пришёл после таймаута
        remote += arr.length;
        poolAdd(arr, job.type);
        settle();
      }, settle);
      if (!started) settle();
    }
    timer = setTimeout(finish, POOL_TIMEOUT);
    for (var j = 0; j < jobs.length; j++) makeJob(jobs[j]);
  }

  // --- Фоновая догрузка пула: больше страниц, тренды и жанровые подборки ---
  var GROW = { started: false, listeners: [] };

  function growJobs() {
    var jobs = [], i, p;
    function range(url, from, to, type) { for (p = from; p <= to; p++) jobs.push({ url: url, page: p, type: type }); }
    range('trending/all/week', 1, 3, null);
    range('movie/now_playing', 1, 2, 'movie');
    range('movie/popular', 3, 10, 'movie');
    range('movie/top_rated', 3, 15, 'movie');
    range('tv/popular', 3, 8, 'tv');
    range('tv/top_rated', 3, 10, 'tv');
    for (i = 0; i < GENRES.length; i++) {
      range('discover/movie?with_genres=' + GENRES[i].id + '&sort_by=vote_count.desc', 1, 2, 'movie');
    }
    return jobs;
  }

  function growNotify() {
    for (var i = 0; i < GROW.listeners.length; i++) { try { GROW.listeners[i](POOL.list); } catch (e) { /* слушатель упал */ } }
  }

  function growPool() {
    if (GROW.started || !POOL.loaded) return;
    GROW.started = true;
    var queue = growJobs(), active = 0, fails = 0, LIMIT = 3, notifyTimer = null;
    function scheduleNotify() {
      if (notifyTimer) return;
      notifyTimer = setTimeout(function () { notifyTimer = null; growNotify(); }, 400);
    }
    function next() {
      if (fails >= 6) queue = []; // источник не отвечает — не мучаем сеть
      while (active < LIMIT && queue.length) run(queue.shift());
      if (!active && !queue.length) scheduleNotify();
    }
    function run(job) {
      var done = false, t = null;
      active++;
      function settle(ok) {
        if (done) return;
        done = true; clearTimeout(t); active--;
        fails = ok ? 0 : fails + 1;
        next();
      }
      t = setTimeout(function () { settle(false); }, POOL_TIMEOUT);
      var started = requestList(job.url, job.page, function (data) {
        if (done) return;
        var arr = data && data.results ? data.results : (isArray(data) ? data : []);
        poolAdd(arr, job.type || undefined);
        scheduleNotify();
        settle(arr.length > 0);
      }, function () { settle(false); });
      if (!started) settle(false);
    }
    next();
  }

  // --- Действия с карточкой ---
  function openCard(card) {
    var A = L('Activity'), P = L('Player');
    if (!card) { noty(LANG.noId); return; }
    if (card.url && P && typeof P.play === 'function') {
      try { P.play({ url: card.url, title: card.title || card.name }); return; } catch (e) { /* откроем карточку */ }
    }
    if (!card.id || !A) { noty(LANG.noId); return; }
    var tv = card.media_type === 'tv' || !!card.first_air_date || !!card.number_of_seasons;
    A.push({ url: '', title: card.title || card.name, component: 'full', id: card.id, method: tv ? 'tv' : 'movie', card: card, source: card.source || 'tmdb' });
  }

  function addFavorite(item) {
    var F = L('Favorite'), card = item.raw || {};
    try {
      if (F && typeof F.add === 'function') {
        if (typeof F.check === 'function' && F.check(card) && F.check(card).book) { noty(LANG.favExists); return; }
        F.add('book', card);
        noty(LANG.favAdded);
        return;
      }
    } catch (e) { /* используем своё хранилище */ }
    var own = load('favorites', []);
    if (!(isArray(own))) own = [];
    for (var i = 0; i < own.length; i++) if (own[i].key === item.key) { noty(LANG.favExists); return; }
    own.unshift({ key: item.key, ts: now(), card: trimCard(item) });
    store('favorites', own.slice(0, 200));
    noty(LANG.favAdded);
  }

  // ===== 4. Шаблоны =====
  var TPL = {
    cr_screen: '<div class="cr-screen"><div class="cr-wrap">' +
      '<div class="cr-marquee"><div class="cr-marquee__inner"><div class="cr-head__text"><div class="cr-kicker">{kicker}</div>' +
      '<div class="cr-title">{title}</div><div class="cr-sub cr-pool">{status}</div></div>' +
      '<div class="cr-btn cr-btn--ghost selector" data-act="history">{history}</div></div></div>' +
      '<div class="cr-label">{presetsLabel}</div><div class="cr-row">{presets}</div>' +
      '<div class="cr-label">{genresLabel}</div><div class="cr-row">{genres}</div>' +
      '<div class="cr-label">{filtersLabel}</div><div class="cr-row">{selects}</div>' +
      '<div class="cr-actions"><div class="cr-btn cr-btn--spin selector" data-act="spin">{spin}</div>' +
      '<div class="cr-btn cr-btn--ghost selector" data-act="reset">{reset}</div></div>' +
      '<div class="cr-stage"></div></div></div>',
    cr_chip: '<div class="cr-chip selector{cls}" data-act="{act}" data-val="{val}">{text}</div>',
    cr_select: '<div class="cr-select selector" data-act="select" data-val="{key}"><span class="cr-select__k">{label}</span><span class="cr-select__v">{value}</span></div>',
    cr_reel: '<div class="cr-reel"><div class="cr-reel__poster"></div><div class="cr-reel__body"><div class="cr-reel__title"></div><div class="cr-reel__meta"></div></div></div>',
    cr_result: '<div class="cr-ticket cr-appear"><div class="cr-card"><div class="cr-poster">{poster}</div><div class="cr-info">' +
      '<div class="cr-card__title">{title}</div><div class="cr-meta">{meta}</div><div class="cr-tags">{tags}</div>' +
      '<div class="cr-desc">{overview}</div>{note}<div class="cr-actions">{buttons}</div></div></div>' +
      '</div>',
    cr_hint: '<div class="cr-hint cr-appear"><div class="cr-kicker">{kicker}</div><div class="cr-hint__title{cls}">{title}</div><div class="cr-hint__text">{text}</div>' +
      '<div class="cr-actions"><div class="cr-btn selector" data-act="{act}">{button}</div></div></div>',
    cr_history: '<div class="cr-screen"><div class="cr-wrap"><div class="cr-marquee"><div class="cr-marquee__inner"><div class="cr-head__text">' +
      '<div class="cr-kicker">{kicker}</div><div class="cr-title">{title}</div><div class="cr-sub cr-count">{count}</div></div>' +
      '<div class="cr-btn cr-btn--ghost selector" data-act="clear">{clear}</div></div></div><div class="cr-hist">{items}</div></div></div>',
    cr_history_item: '<div class="cr-hist__item selector" data-act="open" data-val="{index}"><div class="cr-hist__poster"{style}></div>' +
      '<div class="cr-hist__body"><div class="cr-hist__title">{title}</div><div class="cr-hist__meta">{meta}</div></div>' +
      '<div class="cr-hist__date">{date}</div></div>'
  };

  function tpl(name, data) {
    data = data || {};
    return String(TPL[name] || '').replace(/\{(\w+)\}/g, function (m, k) {
      return data[k] !== undefined && data[k] !== null ? String(data[k]) : '';
    });
  }

  function registerTemplates() {
    var T = L('Template');
    if (!T || typeof T.add !== 'function') return;
    for (var k in TPL) if (TPL.hasOwnProperty(k)) { try { T.add(k, TPL[k]); } catch (e) { /* уже есть */ } }
  }

  // ===== 5. Экраны =====
  function openRoulette() {
    var A = L('Activity');
    if (load('enabled', true) === false) { noty(LANG.disabled); return; }
    if (A) A.push({ url: '', title: LANG.title, component: COMPONENT, page: 1 });
  }

  function openHistory() {
    var A = L('Activity');
    if (A) A.push({ url: '', title: LANG.historyTitle, component: COMPONENT_HISTORY, page: 1 });
  }

  function renderResult(item, surprise) {
    var tags = genreNames(item), tagsHtml = '', i;
    for (i = 0; i < tags.length; i++) tagsHtml += '<span class="cr-tag">' + escapeHtml(tags[i]) + '</span>';
    var url = posterUrl(item.poster), poster;
    if (surprise) poster = '<div class="cr-poster__box cr-poster__box--hidden"><span class="cr-poster__ph">?</span></div>';
    else poster = '<div class="cr-poster__box"><span class="cr-poster__ph">' + escapeHtml(item.title.charAt(0)) + '</span>' +
      (url ? '<div class="cr-poster__img"' + bgStyle(url) + '></div>' : '') + '</div>';
    var buttons = surprise
      ? '<div class="cr-btn selector" data-act="reveal">' + LANG.open + '</div><div class="cr-btn cr-btn--ghost selector" data-act="again">' + LANG.again + '</div>'
      : '<div class="cr-btn selector" data-act="watch">' + LANG.watch + '</div><div class="cr-btn cr-btn--ghost selector" data-act="again">' + LANG.again + '</div>' +
        '<div class="cr-btn cr-btn--ghost selector" data-act="fav">' + LANG.favorite + '</div>';
    return tpl('cr_result', {
      poster: poster,
      title: escapeHtml(surprise ? LANG.surpriseTitle : item.title),
      meta: metaHtml(item),
      tags: tagsHtml,
      overview: escapeHtml(item.overview),
      note: surprise ? '<div class="cr-note">' + LANG.surpriseHint + '</div>' : '',
      buttons: buttons
    });
  }

  // Общая навигация по пульту для обоих экранов
  function navMove(dir) {
    var N = L('Navigator') || window.Navigator;
    if (N && typeof N.canmove === 'function' && N.canmove(dir)) { N.move(dir); return true; }
    return false;
  }

  // Своя навигация по геометрии: ближайший ряд в направлении, в нём — ближайший по горизонтали.
  // Встроенный Navigator не переходит между элементами, которые не стоят строго друг над другом.
  function geoMove(ctx, dir) {
    var C = L('Controller'), $ = window.$, box = ctx.renderEl && ctx.renderEl[0], cur = ctx.lastFocus;
    if (!C || !box || !cur || !cur.getBoundingClientRect || !$.contains(box, cur)) return false;
    var c = cur.getBoundingClientRect(), cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2;
    var best = null, bestA = 0, bestB = 0, nodes = box.querySelectorAll('.selector'), i, n, r, a, b, x, y;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n === cur) continue;
      r = n.getBoundingClientRect();
      if (!r.width && !r.height) continue; // скрыт
      x = (r.left + r.right) / 2; y = (r.top + r.bottom) / 2;
      if (dir === 'down' || dir === 'up') {
        a = dir === 'down' ? r.top - c.bottom : c.top - r.bottom;
        if (a < -6) continue;                 // не ниже/выше текущего
        a = Math.round(Math.max(0, a) / 12);  // элементы одного ряда считаем равноудалёнными
        b = Math.abs(x - cx);
        if (n.getAttribute('data-act') === 'spin') b = -1; // в ряду кнопок первой выбираем «Крутить»
      } else {
        if (r.bottom <= c.top + 4 || r.top >= c.bottom - 4) continue; // только тот же ряд
        a = dir === 'right' ? r.left - c.right : c.left - r.right;
        if (a < -6) continue;
        b = Math.abs(y - cy);
      }
      if (!best || a < bestA || (a === bestA && b < bestB)) { best = n; bestA = a; bestB = b; }
    }
    if (!best) return false;
    try { C.collectionFocus(best, ctx.renderEl); } catch (e) { return false; }
    ctx.lastFocus = best;
    return true;
  }

  function moveFocus(ctx, dir) {
    if (geoMove(ctx, dir)) return true;
    return navMove(dir);
  }

  // Собственный прокручиваемый контейнер: не зависит от версии Lampa.Scroll
  function createShell(ctx) {
    var $ = window.$;
    ctx.renderEl = $('<div class="cr-scroll"></div>').append(ctx.body);
    ctx.onResize = function () { fitHeight(ctx); };
    window.addEventListener('resize', ctx.onResize);
  }

  // Высота контейнера = от его верхней границы до низа окна
  function fitHeight(ctx) {
    var el = ctx.renderEl && ctx.renderEl[0];
    if (!el) return;
    var top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight - 200) top = 0;
    el.style.height = Math.max(200, window.innerHeight - top) + 'px';
  }

  // Режим ввода: при мыши/касании не прокручиваем экран за курсором
  var INPUT = { keys: true, bound: false };
  function trackInput() {
    if (INPUT.bound || !window.addEventListener) return;
    INPUT.bound = true;
    window.addEventListener('keydown', function () { INPUT.keys = true; }, true);
    window.addEventListener('mousemove', function () { INPUT.keys = false; }, true);
    window.addEventListener('touchstart', function () { INPUT.keys = false; }, true);
  }

  // Прокрутка к элементу в фокусе: держим его в верхней четверти экрана
  function scrollToEl(ctx, node, force) {
    var box = ctx.renderEl && ctx.renderEl[0];
    if (!force && !INPUT.keys) return;
    if (!box || !node || !node.getBoundingClientRect) return;
    var r = node.getBoundingClientRect(), b = box.getBoundingClientRect();
    // Внутри карточки результата / подсказки показываем блок целиком, а не только кнопку
    var blk = window.$(node).closest('.cr-ticket, .cr-hint')[0];
    if (blk) {
      var k = blk.getBoundingClientRect(), pad = 16;
      if (k.top - b.top >= pad && k.bottom <= b.bottom - pad) return; // уже виден полностью
      var t = box.scrollTop + (k.top - b.top) - pad;                   // верх блока к верху экрана
      if (k.height + pad * 2 <= box.clientHeight) t = box.scrollTop + (k.bottom - b.bottom) + pad; // влезает — ровно до низа
      if (r.bottom - (t - box.scrollTop) > b.bottom - pad) t = box.scrollTop + (r.bottom - b.bottom) + pad; // кнопка не ниже экрана
      box.scrollTop = Math.max(0, t);
      return;
    }
    var margin = Math.round(box.clientHeight * 0.25);
    if (r.top - b.top < margin || r.bottom > b.bottom - margin) {
      var target = box.scrollTop + (r.top - b.top) - margin;
      box.scrollTop = Math.max(0, target);
    }
  }

  function controllerStart(ctx) {
    var C = L('Controller'), A = L('Activity');
    ctx.active = true;
    fitHeight(ctx);
    setTimeout(function () { fitHeight(ctx); }, 300);
    if (!C) return;
    C.add('content', {
      toggle: function () { C.collectionSet(ctx.renderEl); C.collectionFocus(ctx.lastFocus || false, ctx.renderEl); },
      left: function () { if (!moveFocus(ctx, 'left')) C.toggle('menu'); },
      right: function () { moveFocus(ctx, 'right'); },
      up: function () { if (!moveFocus(ctx, 'up')) C.toggle('head'); },
      down: function () { moveFocus(ctx, 'down'); },
      back: function () { if (A) A.backward(); }
    });
    C.toggle('content');
  }

  function controllerRefresh(ctx, focusEl) {
    var C = L('Controller');
    if (!ctx.active || !C) return;
    if (focusEl) ctx.lastFocus = focusEl;
    try { C.collectionSet(ctx.renderEl); C.collectionFocus(ctx.lastFocus || false, ctx.renderEl); } catch (e) { /* нет фокуса */ }
    if (focusEl) scrollToEl(ctx, focusEl, true); // программный фокус — всегда показываем элемент
  }

  function bindAll(ctx, root, handler) {
    var $ = window.$;
    root.find('.selector').each(function () {
      var el = $(this);
      if (el.data('crb')) return;
      el.data('crb', 1);
      el.on('hover:focus', function () {
        ctx.lastFocus = this;
        scrollToEl(ctx, this);
      });
      el.on('hover:enter', function () { handler(el.attr('data-act'), el.attr('data-val'), el); });
    });
  }

  function RouletteComponent() {
    var self = this, $ = window.$;
    var ctx = { body: null, renderEl: null, lastFocus: false, active: false, onResize: null };
    var filters = loadFilters(), stage = null, spinBtn = null;
    var spinning = false, destroyed = false, cancelSpin = null, current = null;

    function buildHtml() {
      var presets = '', genres = '', selects = '', i, keys = ['type', 'yearFrom', 'yearTo', 'rating', 'duration', 'surprise'];
      for (i = 0; i < PRESETS.length; i++) presets += tpl('cr_chip', { cls: ' cr-chip--preset', act: 'preset', val: PRESETS[i].id, text: escapeHtml(PRESETS[i].title) });
      for (i = 0; i < GENRES.length; i++) genres += tpl('cr_chip', { cls: '', act: 'genre', val: GENRES[i].id, text: escapeHtml(GENRES[i].name) });
      for (i = 0; i < keys.length; i++) selects += tpl('cr_select', { key: keys[i], label: LANG[keys[i]], value: '' });
      return tpl('cr_screen', {
        kicker: LANG.kicker, title: LANG.title, status: LANG.poolLoading, history: LANG.history, presetsLabel: LANG.presets, presets: presets,
        genresLabel: LANG.genres, genres: genres, filtersLabel: LANG.filters, selects: selects, spin: LANG.spin, reset: LANG.reset
      });
    }

    function onGrow() { if (!destroyed) updateStatus(); }
    function updateStatus() {
      if (!ctx.body) return;
      var total = POOL.list.length, match = 0;
      for (var i = 0; i < total; i++) if (matchFilters(POOL.list[i], filters)) match++;
      ctx.body.find('.cr-pool').text(POOL.loading && !total ? LANG.poolLoading : LANG.poolCount + total + LANG.poolMatch + match);
    }

    function updateFilterUI() {
      var def = defaultFilters();
      ctx.body.find('[data-act="preset"]').each(function () { $(this).toggleClass('cr-on', $(this).attr('data-val') === filters.preset); });
      ctx.body.find('[data-act="genre"]').each(function () {
        $(this).toggleClass('cr-on', filters.genres.indexOf(parseInt($(this).attr('data-val'), 10)) >= 0);
      });
      ctx.body.find('[data-act="select"]').each(function () {
        var key = $(this).attr('data-val');
        $(this).find('.cr-select__v').text(optionLabel(key, filters[key]));
        $(this).toggleClass('cr-on', key === 'surprise' ? !!filters.surprise : String(filters[key]) !== String(def[key]));
      });
      updateStatus();
    }

    function changed() { saveFilters(filters); updateFilterUI(); }

    function applyPreset(id) {
      var keepSurprise = filters.surprise, prev = filters.preset, p = null, i, k;
      for (i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) p = PRESETS[i];
      filters = defaultFilters();
      filters.surprise = keepSurprise;
      if (p && id !== prev) { // повторное нажатие на активный пресет — сброс
        for (k in p.f) if (p.f.hasOwnProperty(k)) filters[k] = isArray(p.f[k]) ? p.f[k].slice() : p.f[k];
        filters.preset = id;
      }
      changed();
    }

    function toggleGenre(id) {
      var pos = filters.genres.indexOf(id);
      if (pos >= 0) filters.genres.splice(pos, 1); else filters.genres.push(id);
      filters.preset = '';
      changed();
    }

    function openSelect(key) {
      var S = L('Select'), C = L('Controller'), opts = OPTIONS[key] || [], items = [], i;
      if (key === 'surprise') { filters.surprise = !filters.surprise; updateFilterUI(); return; }
      if (!S || typeof S.show !== 'function') {
        for (i = 0; i < opts.length; i++) if (String(opts[i].v) === String(filters[key])) break;
        filters[key] = opts[(i + 1) % opts.length].v;
        filters.preset = '';
        changed();
        return;
      }
      for (i = 0; i < opts.length; i++) items.push({ title: opts[i].t, value: opts[i].v, selected: String(opts[i].v) === String(filters[key]) });
      S.show({
        title: LANG[key], items: items,
        onSelect: function (a) { filters[key] = a.value; filters.preset = ''; changed(); if (C) C.toggle('content'); },
        onBack: function () { if (C) C.toggle('content'); }
      });
    }

    function resetFilters() {
      if (spinning) return;
      var keepSurprise = filters.surprise;
      filters = defaultFilters();
      filters.surprise = keepSurprise;
      changed();
      stage.empty();
      controllerRefresh(ctx, spinBtn[0]);
    }

    function setStage(markup, focusFirst) {
      stage.html(markup);
      bindAll(ctx, stage, onAction);
      if (focusFirst) controllerRefresh(ctx, stage.find('.selector')[0]);
    }

    function setSpinning(on, label) {
      spinning = on;
      spinBtn.toggleClass('cr-disabled', on).text(label || (on ? LANG.spinning : LANG.spin));
    }

    function onTick(item) {
      var reel = stage.find('.cr-reel');
      if (!reel.length) { stage.html(tpl('cr_reel')); reel = stage.find('.cr-reel'); }
      var hide = filters.surprise, names = genreNames(item);
      reel.find('.cr-reel__title').text(hide ? (names.length ? names.join(', ') : LANG.surpriseTitle) : item.title);
      reel.find('.cr-reel__meta').html(metaHtml(item));
      var url = hide ? '' : posterUrl(item.poster);
      reel.find('.cr-reel__poster').css('background-image', url ? 'url("' + url + '")' : 'none');
      // короткая вспышка: opacity 0.6→1, scale 0.98→1 за 120 мс
      reel.addClass('cr-flash');
      var force = reel[0].offsetWidth;
      reel.removeClass('cr-flash');
      return force;
    }

    function doSpin() {
      if (spinning) return;
      setSpinning(true, POOL.loaded ? LANG.spinning : LANG.loading);
      controllerRefresh(ctx, spinBtn[0]);
      loadPool(function (list) {
        if (destroyed) return;
        updateStatus();
        var filtered = [], fresh = [], ex = excludedKeys(), i;
        for (i = 0; i < list.length; i++) if (matchFilters(list[i], filters)) filtered.push(list[i]);
        if (!filtered.length) {
          setSpinning(false);
          noty(LANG.empty);
          setStage(tpl('cr_hint', { kicker: LANG.kickerEmpty, cls: '', title: LANG.emptyTitle, text: LANG.emptyText, act: 'reset', button: LANG.resetFilters }), true);
          return;
        }
        for (i = 0; i < filtered.length; i++) if (!ex[filtered[i].key]) fresh.push(filtered[i]);
        if (!fresh.length) { noty(LANG.allSeen); fresh = filtered; }
        setSpinning(true, LANG.spinning);
        cancelSpin = spin(fresh, function (winner) {
          cancelSpin = null;
          if (destroyed) return;
          setSpinning(false);
          addHistory(winner);
          current = winner;
          setStage(renderResult(winner, filters.surprise), true);
          var mq = ctx.body.find('.cr-marquee');
          mq.removeClass('cr-lit');
          if (mq[0]) mq[0].getBoundingClientRect();
          mq.addClass('cr-lit');
        }, onTick);
      });
    }

    function onAction(act, val) {
      if (act === 'history') openHistory();
      else if (act === 'preset') applyPreset(val);
      else if (act === 'genre') toggleGenre(parseInt(val, 10));
      else if (act === 'select') openSelect(val);
      else if (act === 'spin' || act === 'again') doSpin();
      else if (act === 'reset') resetFilters();
      else if (act === 'watch' && current) openCard(current.raw);
      else if (act === 'fav' && current) addFavorite(current);
      else if (act === 'reveal' && current) setStage(renderResult(current, false), true);
    }

    this.create = function () {
      ctx.body = $(buildHtml());
      stage = ctx.body.find('.cr-stage');
      spinBtn = ctx.body.find('[data-act="spin"]');
      createShell(ctx);
      bindAll(ctx, ctx.body, onAction);
      updateFilterUI();
      loadPool(function () { if (!destroyed) updateStatus(); growPool(); });
      GROW.listeners.push(onGrow);
      if (self.activity && self.activity.loader) self.activity.loader(false);
      return self.render();
    };
    this.start = function () { controllerStart(ctx); };
    this.pause = function () { ctx.active = false; };
    this.stop = function () { ctx.active = false; };
    this.render = function () { return ctx.renderEl; };
    this.destroy = function () {
      destroyed = true;
      for (var gi = GROW.listeners.length - 1; gi >= 0; gi--) if (GROW.listeners[gi] === onGrow) GROW.listeners.splice(gi, 1);
      ctx.active = false;
      if (cancelSpin) cancelSpin();
      if (ctx.onResize) window.removeEventListener('resize', ctx.onResize);
      if (ctx.renderEl && ctx.renderEl.remove) ctx.renderEl.remove();
      ctx.body = null;
    };
  }

  function HistoryComponent() {
    var self = this, $ = window.$;
    var ctx = { body: null, renderEl: null, lastFocus: false, active: false, onResize: null };
    var list = [];

    function itemsHtml() {
      if (!list.length) return tpl('cr_hint', { kicker: LANG.kickerHistoryEmpty, cls: '', title: LANG.historyEmpty, text: LANG.historyEmptyText, act: 'roulette', button: LANG.toRoulette });
      var out = '';
      for (var i = 0; i < list.length; i++) {
        var h = list[i];
        out += tpl('cr_history_item', {
          index: i, style: bgStyle(posterUrl(h.poster)), title: escapeHtml(h.title),
          meta: metaHtml({ year: h.year, type: h.type, rating: h.rating, runtime: 0 }), date: formatDate(h.ts)
        });
      }
      return out;
    }

    function fill() {
      list = loadHistory();
      ctx.body.find('.cr-count').text(LANG.items + list.length);
      ctx.body.find('.cr-hist').html(itemsHtml());
      bindAll(ctx, ctx.body, onAction);
    }

    function onAction(act, val) {
      if (act === 'open') { var h = list[parseInt(val, 10)]; if (h) openCard(h.card); }
      else if (act === 'clear') {
        store('history', []);
        noty(LANG.cleared);
        fill();
        controllerRefresh(ctx, ctx.body.find('[data-act="clear"]')[0]);
      } else if (act === 'roulette') openRoulette();
    }

    this.create = function () {
      ctx.body = $(tpl('cr_history', { kicker: LANG.kickerHistory, title: LANG.historyTitle, count: '', clear: LANG.clear, items: '' }));
      createShell(ctx);
      fill();
      if (self.activity && self.activity.loader) self.activity.loader(false);
      return self.render();
    };
    this.start = function () {
      var fresh = loadHistory();
      if (fresh.length !== list.length || (fresh[0] && list[0] && fresh[0].ts !== list[0].ts)) { fill(); ctx.lastFocus = false; }
      controllerStart(ctx);
    };
    this.pause = function () { ctx.active = false; };
    this.stop = function () { ctx.active = false; };
    this.render = function () { return ctx.renderEl; };
    this.destroy = function () {
      ctx.active = false;
      if (ctx.onResize) window.removeEventListener('resize', ctx.onResize);
      if (ctx.renderEl && ctx.renderEl.remove) ctx.renderEl.remove();
      ctx.body = null;
    };
  }

  // ===== 6. Логика рулетки =====
  // Возвращает функцию отмены. onTick(item) — показ очередного кадра, done(winner) — итог.
  function spin(pool, done, onTick) {
    var winner = pickRandom(pool), total = reducedMotion() ? 1 : SPIN_TICKS;
    var tick = 0, timer = null, stopped = false, last = null;

    function other() {
      if (pool.length < 2) return pool[0];
      var it = pickRandom(pool), guard = 0;
      while (it === last && guard++ < 5) it = pickRandom(pool);
      return it;
    }

    function delayBefore(n) {
      var slowStart = total - SPIN_SLOW.length; // номер тика, после которого начинается замедление
      return n > slowStart ? SPIN_SLOW[n - slowStart - 1] : SPIN_BASE;
    }

    function step() {
      if (stopped) return;
      tick++;
      var isLast = tick >= total;
      last = isLast ? winner : other();
      try { onTick(last, tick, total); } catch (e) { /* кадр не отрисовался */ }
      if (isLast) {
        timer = setTimeout(function () { if (!stopped) done(winner); }, RESULT_DELAY);
        return;
      }
      timer = setTimeout(step, delayBefore(tick + 1));
    }

    step();
    return function () { stopped = true; clearTimeout(timer); };
  }

  // ===== 7. Интеграция =====
  function findMenuItems() {
    var $ = window.$;
    if (!$) return [];
    return $('.menu .menu__item').filter(function () {
      return $(this).hasClass('cr-menu-item') || String($(this).find('.menu__text').text()).replace(/^\s+|\s+$/g, '') === LANG.menu;
    });
  }

  function addMenuButton() {
    var $ = window.$, M = L('Menu');
    if (!$ || findMenuItems().length) return;
    if (M && typeof M.addButton === 'function') {
      try { M.addButton(ICON, LANG.menu, openRoulette); if (findMenuItems().length) return; } catch (e) { /* fallback */ }
    } else if (M && typeof M.add === 'function') {
      try { M.add({ title: LANG.menu, icon: ICON, action: openRoulette }); if (findMenuItems().length) return; } catch (e2) { /* fallback */ }
    }
    var list = $('.menu .menu__list').eq(0);
    if (!list.length) return;
    var item = $('<li class="menu__item selector cr-menu-item" data-action="' + COMPONENT + '"><div class="menu__ico">' + ICON +
      '</div><div class="menu__text">' + escapeHtml(LANG.menu) + '</div></li>');
    item.on('hover:enter', openRoulette);
    list.append(item);
  }

  function syncMenu() {
    if (load('enabled', true) !== false && load('menu', true) !== false) addMenuButton();
    else { var items = findMenuItems(); if (items.remove) items.remove(); }
  }

  function registerSettings() {
    var SA = L('SettingsApi');
    if (!SA || typeof SA.addComponent !== 'function' || typeof SA.addParam !== 'function') return;
    try {
      SA.addComponent({ component: SETTINGS_COMPONENT, name: LANG.title, icon: ICON });
      SA.addParam({ component: SETTINGS_COMPONENT, param: { name: PREFIX + 'enabled', type: 'trigger', 'default': true },
        field: { name: LANG.setEnabled, description: LANG.setEnabledDesc }, onChange: function () { setTimeout(syncMenu, 0); } });
      SA.addParam({ component: SETTINGS_COMPONENT, param: { name: PREFIX + 'menu', type: 'trigger', 'default': true },
        field: { name: LANG.setMenu, description: LANG.setMenuDesc }, onChange: function () { setTimeout(syncMenu, 0); } });
      SA.addParam({ component: SETTINGS_COMPONENT,
        param: { name: PREFIX + 'repeat', type: 'select', 'default': '7', values: { '7': LANG.rep7, '30': LANG.rep30, 'always': LANG.repAlways, 'off': LANG.repOff } },
        field: { name: LANG.setRepeat, description: LANG.setRepeatDesc } });
      SA.addParam({ component: SETTINGS_COMPONENT, param: { name: PREFIX + 'surprise', type: 'trigger', 'default': false },
        field: { name: LANG.setSurprise, description: LANG.setSurpriseDesc } });
      SA.addParam({ component: SETTINGS_COMPONENT, param: { name: PREFIX + 'open', type: 'button' },
        field: { name: LANG.setOpen }, onChange: function () {
          var C = L('Controller');
          try { if (C) C.toggle('content'); } catch (e) { /* настройки закроются сами */ }
          setTimeout(openRoulette, 50);
        } });
      SA.addParam({ component: SETTINGS_COMPONENT, param: { name: PREFIX + 'reset', type: 'button' },
        field: { name: LANG.setReset, description: LANG.setResetDesc }, onChange: function () { store('history', []); noty(LANG.cleared); } });
    } catch (e) { console.log('[Cinemaroulette] settings error', e); }
  }

  function init() {
    if (window.__cinemaroulette_inited__) return;
    if (!window.$) { console.log('[Cinemaroulette] jQuery не найден, плагин не запущен'); return; }
    window.__cinemaroulette_inited__ = true;
    injectStyles();
    trackInput();
    registerTemplates();
    var C = L('Component');
    if (C && typeof C.add === 'function') {
      C.add(COMPONENT, RouletteComponent);
      C.add(COMPONENT_HISTORY, HistoryComponent);
    }
    registerSettings();
    syncMenu();
    window.cinemaroulette = { open: openRoulette, history: openHistory, version: MANIFEST.version };
  }

  // ===== 8. Точка входа =====
  if (window.Lampa && Lampa.Listener) {
    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') init();
    });
  }

  console.log('[Cinemaroulette] loaded');
})();

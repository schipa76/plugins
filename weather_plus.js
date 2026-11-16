/*
 * Погода+ для Lampa  (weather_plus.js)  v1.0
 * Данные: Open-Meteo (бесплатно, без ключа). Ничего регистрировать не нужно.
 *
 * Что есть:
 *  - пункт «Погода+» в левом меню и (по желанию) виджет с температурой в шапке
 *  - цветной фон под текущую погоду и время суток, анимация дождя / снега / звёзд
 *  - сейчас: температура, «ощущается», макс/мин, совет по одежде и погоде
 *  - плитки: ветер (компас), влажность, давление и его тренд, осадки, УФ-индекс,
 *    качество воздуха, видимость / облачность / точка росы, солнце и фаза Луны
 *  - почасовой прогноз на 24 часа, прогноз на 7 дней (ОК на дне — подробности)
 *  - выбор города: авто по IP, поиск по названию, популярные, недавние
 */
(function () {
    'use strict';

    if (window.weather_plus_loaded) return;
    window.weather_plus_loaded = true;

    var LS = {
        city: 'weather_plus_city',
        recent: 'weather_plus_recent',
        cache: 'weather_plus_cache',
        ip: 'weather_plus_ip'
    };
    var CACHE_TTL = 10 * 60 * 1000;

    var POPULAR = [
        ['Москва', 55.7558, 37.6173, 'Europe/Moscow'], ['Санкт-Петербург', 59.9343, 30.3351, 'Europe/Moscow'],
        ['Новосибирск', 55.0084, 82.9357, 'Asia/Novosibirsk'], ['Екатеринбург', 56.8389, 60.6057, 'Asia/Yekaterinburg'],
        ['Казань', 55.7887, 49.1221, 'Europe/Moscow'], ['Нижний Новгород', 56.2965, 43.9361, 'Europe/Moscow'],
        ['Самара', 53.1959, 50.1002, 'Europe/Samara'], ['Ростов-на-Дону', 47.2357, 39.7015, 'Europe/Moscow'],
        ['Краснодар', 45.0355, 38.9753, 'Europe/Moscow'], ['Сочи', 43.6028, 39.7342, 'Europe/Moscow'],
        ['Уфа', 54.7388, 55.9721, 'Asia/Yekaterinburg'], ['Красноярск', 56.0153, 92.8932, 'Asia/Krasnoyarsk'],
        ['Владивосток', 43.1155, 131.8855, 'Asia/Vladivostok'], ['Калининград', 54.7104, 20.4522, 'Europe/Kaliningrad'],
        ['Минск', 53.9006, 27.5590, 'Europe/Minsk'], ['Алматы', 43.2220, 76.8512, 'Asia/Almaty']
    ];

    /* ------------------------------------------------------------------ */
    /*  Утилиты                                                            */
    /* ------------------------------------------------------------------ */

    function lsGet(k, d) {
        try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    }
    function lsSet(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { }
    }
    function opt(name, def) {
        var v;
        try { v = Lampa.Storage.get(name, ''); } catch (e) { v = ''; }
        if (v === '' || v === undefined || v === null) return def;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return v;
    }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function fmtT(t) {
        var r = Math.round(t);
        return (r < 0 ? '\u2212' : '') + Math.abs(r) + '\u00B0';
    }
    function fmtWind(ms) {
        if (opt('weather_plus_wind', 'ms') === 'kmh') return { v: Math.round(ms * 3.6), u: 'км/ч' };
        return { v: ms < 10 ? (Math.round(ms * 10) / 10).toFixed(1) : Math.round(ms), u: 'м/с' };
    }
    function fmtPress(hpa) {
        if (opt('weather_plus_press', 'mm') === 'hpa') return { v: Math.round(hpa), u: 'гПа' };
        return { v: Math.round(hpa * 0.750062), u: 'мм рт. ст.' };
    }
    function tcol(t) {
        var h = 240 - ((clamp(t, -25, 45) + 25) / 70) * 240;
        return 'hsl(' + Math.round(h) + ',85%,62%)';
    }

    var WD_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    var MON = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
    var DIRS = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ', 'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];

    function dirName(deg) { return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }
    function dateParts(s) { var p = s.substring(0, 10).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
    function dateObj(s) { var p = dateParts(s); return new Date(p.y, p.m - 1, p.d); }
    function toMin(s) { return (+s.substring(11, 13)) * 60 + (+s.substring(14, 16)); }
    function hm(s) { return s ? s.substring(11, 16) : '—'; }
    function durText(min) { return Math.floor(min / 60) + ' ч ' + pad(Math.round(min % 60)) + ' мин'; }

    /* ------------------------------------------------------------------ */
    /*  Коды погоды                                                        */
    /* ------------------------------------------------------------------ */

    var WMO = {
        0: ['Ясно', 'clear'], 1: ['Преимущественно ясно', 'partly'], 2: ['Переменная облачность', 'partly'], 3: ['Пасмурно', 'cloud'],
        45: ['Туман', 'fog'], 48: ['Изморозь', 'fog'],
        51: ['Лёгкая морось', 'drizzle'], 53: ['Морось', 'drizzle'], 55: ['Сильная морось', 'drizzle'],
        56: ['Ледяная морось', 'drizzle'], 57: ['Сильная ледяная морось', 'drizzle'],
        61: ['Небольшой дождь', 'rain'], 63: ['Дождь', 'rain'], 65: ['Сильный дождь', 'rain'],
        66: ['Ледяной дождь', 'rain'], 67: ['Сильный ледяной дождь', 'rain'],
        71: ['Небольшой снег', 'snow'], 73: ['Снег', 'snow'], 75: ['Сильный снег', 'snow'], 77: ['Снежные зёрна', 'snow'],
        80: ['Небольшой ливень', 'shower'], 81: ['Ливень', 'shower'], 82: ['Сильный ливень', 'shower'],
        85: ['Снегопад', 'snow'], 86: ['Сильный снегопад', 'snow'],
        95: ['Гроза', 'thunder'], 96: ['Гроза с градом', 'thunder'], 99: ['Сильная гроза с градом', 'thunder']
    };
    function wmo(c) { return WMO[c] || ['—', 'cloud']; }

    /* ------------------------------------------------------------------ */
    /*  Иконки (SVG)                                                       */
    /* ------------------------------------------------------------------ */

    function cloud(fill, dx, dy, sc) {
        return '<path transform="translate(' + dx + ' ' + dy + ') scale(' + sc + ')" fill="' + fill +
            '" d="M20 46h26a10 10 0 0 0 1.5-19.9A14 14 0 0 0 20.4 30 8.5 8.5 0 0 0 20 46z"/>';
    }
    function sun(cx, cy, r) {
        var rays = '';
        for (var i = 0; i < 8; i++) {
            var a = i * Math.PI / 4;
            rays += '<line x1="' + (cx + (r + 3) * Math.cos(a)).toFixed(1) + '" y1="' + (cy + (r + 3) * Math.sin(a)).toFixed(1) +
                '" x2="' + (cx + (r + 7) * Math.cos(a)).toFixed(1) + '" y2="' + (cy + (r + 7) * Math.sin(a)).toFixed(1) + '"/>';
        }
        return '<g class="wp-spin" style="transform-origin:' + cx + 'px ' + cy + 'px"><g stroke="#FFB300" stroke-width="3" stroke-linecap="round">' +
            rays + '</g></g><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FFCA28"/>';
    }
    function moon(tx, ty, sc) {
        return '<path transform="translate(' + tx + ' ' + ty + ') scale(' + sc + ')" fill="#E8EEFF" d="M38 10a22 22 0 1 0 16 36 18 18 0 0 1-16-36z"/>';
    }

    function icon(kind, day) {
        var g = '';
        var LIGHT = '#F1F5FA', GREY = '#9FB0C6', DARK = '#7F90A8';
        switch (kind) {
            case 'clear':
                g = day ? sun(32, 32, 13) :
                    moon(0, 0, 1) + '<circle cx="14" cy="16" r="1.3" fill="#fff"/><circle cx="50" cy="10" r="1.1" fill="#fff"/><circle cx="56" cy="30" r="1.2" fill="#fff"/>';
                break;
            case 'partly':
                g = (day ? sun(25, 25, 10) : moon(-10, -10, .75)) + '<g class="wp-float">' + cloud(LIGHT, 6, 10, .92) + '</g>';
                break;
            case 'cloud':
                g = '<g class="wp-float">' + cloud(GREY, 14, 2, .8) + '</g>' + cloud(LIGHT, 0, 4, 1);
                break;
            case 'fog':
                g = cloud('#CFD8DC', 0, -8, 1) +
                    '<g stroke="#B0BEC5" stroke-width="3" stroke-linecap="round"><path d="M14 42h34"/><path d="M20 49h32"/><path d="M14 56h26"/></g>';
                break;
            case 'drizzle':
                g = cloud(GREY, 0, -6, 1) +
                    '<g stroke="#81D4FA" stroke-width="2.4" stroke-linecap="round"><path d="M24 44l-2 5"/><path d="M32 46l-2 5"/><path d="M40 44l-2 5"/></g>';
                break;
            case 'rain':
                g = cloud(DARK, 0, -6, 1) +
                    '<g stroke="#4FC3F7" stroke-width="3" stroke-linecap="round"><path d="M23 44l-3 9"/><path d="M32 44l-3 9"/><path d="M41 44l-3 9"/><path d="M27 54l-2 6"/><path d="M36 54l-2 6"/></g>';
                break;
            case 'shower':
                g = cloud('#6F7F96', 0, -6, 1) +
                    '<g stroke="#29B6F6" stroke-width="3.2" stroke-linecap="round"><path d="M21 44l-3 10"/><path d="M29 44l-3 10"/><path d="M37 44l-3 10"/><path d="M45 44l-3 10"/><path d="M25 55l-2 6"/><path d="M33 55l-2 6"/></g>';
                break;
            case 'snow':
                g = cloud('#B6C4D6', 0, -6, 1) +
                    '<g fill="#fff" stroke="#BBDEFB" stroke-width=".8"><circle cx="22" cy="48" r="2.6"/><circle cx="32" cy="54" r="2.6"/><circle cx="42" cy="48" r="2.6"/><circle cx="27" cy="59" r="2.2"/><circle cx="37" cy="60" r="2.2"/></g>';
                break;
            case 'thunder':
                g = cloud('#5E6B82', 0, -6, 1) +
                    '<polygon points="34,38 24,53 31,53 27,63 41,45 34,45 39,38" fill="#FFD600" stroke="#FFA000" stroke-width=".8" stroke-linejoin="round"/>' +
                    '<g stroke="#4FC3F7" stroke-width="2.6" stroke-linecap="round"><path d="M17 44l-2 6"/><path d="M47 44l-2 6"/></g>';
                break;
            default:
                g = cloud(LIGHT, 0, 4, 1);
        }
        return '<svg viewBox="0 0 64 64" class="wp-ico">' + g + '</svg>';
    }

    /* ------------------------------------------------------------------ */
    /*  Темы фона                                                          */
    /* ------------------------------------------------------------------ */

    function theme(kind, day) {
        if (!day) {
            if (kind === 'clear') return 'linear-gradient(160deg,#080d24 0%,#1a2a60 55%,#3b2f7a 100%)';
            if (kind === 'thunder') return 'linear-gradient(160deg,#100c22 0%,#2c2150 55%,#4a2f66 100%)';
            if (kind === 'snow') return 'linear-gradient(160deg,#1a2540 0%,#34507a 55%,#5d7ba3 100%)';
            if (kind === 'rain' || kind === 'shower' || kind === 'drizzle') return 'linear-gradient(160deg,#0b1626 0%,#16304a 55%,#235068 100%)';
            if (kind === 'fog') return 'linear-gradient(160deg,#1f2630 0%,#3a4552 55%,#566370 100%)';
            return 'linear-gradient(160deg,#101728 0%,#232f4a 55%,#3a4a68 100%)';
        }
        switch (kind) {
            case 'clear': return 'linear-gradient(160deg,#1565c0 0%,#2196f3 45%,#ffb347 100%)';
            case 'partly': return 'linear-gradient(160deg,#2b6cb0 0%,#5f9fd8 55%,#b8c6db 100%)';
            case 'cloud': return 'linear-gradient(160deg,#455a73 0%,#6b7f99 55%,#95a5b8 100%)';
            case 'drizzle':
            case 'rain':
            case 'shower': return 'linear-gradient(160deg,#1c2f4a 0%,#2d4d6e 55%,#3f6f86 100%)';
            case 'snow': return 'linear-gradient(160deg,#5b7a9d 0%,#9db8d6 55%,#dce8f4 100%)';
            case 'thunder': return 'linear-gradient(160deg,#1a1530 0%,#3a2a5c 55%,#5a3d73 100%)';
            case 'fog': return 'linear-gradient(160deg,#55616d 0%,#7d8995 55%,#a3adb7 100%)';
        }
        return 'linear-gradient(160deg,#2b6cb0 0%,#5f9fd8 55%,#b8c6db 100%)';
    }

    function fxHtml(kind, day) {
        var out = '', i, n;
        function rnd(a, b) { return a + Math.random() * (b - a); }
        if (kind === 'rain' || kind === 'shower' || kind === 'thunder' || kind === 'drizzle') {
            n = kind === 'drizzle' ? 14 : (kind === 'rain' ? 26 : 34);
            for (i = 0; i < n; i++) {
                out += '<i class="wp-fx-rain" style="left:' + rnd(0, 100).toFixed(1) + '%;animation-duration:' + rnd(.7, 1.3).toFixed(2) +
                    's;animation-delay:-' + rnd(0, 2).toFixed(2) + 's;opacity:' + rnd(.35, .8).toFixed(2) + '"></i>';
            }
            if (kind === 'thunder') out += '<i class="wp-fx-flash"></i>';
        } else if (kind === 'snow') {
            for (i = 0; i < 30; i++) {
                var s = rnd(.35, .9).toFixed(2);
                out += '<i class="wp-fx-snow" style="left:' + rnd(0, 100).toFixed(1) + '%;width:' + s + 'em;height:' + s + 'em;animation-duration:' +
                    rnd(7, 14).toFixed(1) + 's;animation-delay:-' + rnd(0, 12).toFixed(1) + 's"></i>';
            }
        } else if (kind === 'clear' && !day) {
            for (i = 0; i < 28; i++) {
                out += '<i class="wp-fx-star" style="left:' + rnd(0, 100).toFixed(1) + '%;top:' + rnd(0, 70).toFixed(1) + '%;animation-delay:-' +
                    rnd(0, 4).toFixed(1) + 's;animation-duration:' + rnd(2, 5).toFixed(1) + 's"></i>';
            }
        } else if (kind === 'fog') {
            for (i = 0; i < 3; i++) out += '<i class="wp-fx-fog" style="top:' + (20 + i * 25) + '%;animation-duration:' + (26 + i * 9) + 's;animation-delay:-' + (i * 8) + 's"></i>';
        } else if (kind === 'clear' && day) {
            out += '<i class="wp-fx-glow"></i>';
        }
        return out;
    }

    /* ------------------------------------------------------------------ */
    /*  Сеть                                                               */
    /* ------------------------------------------------------------------ */

    var DBG = [];
    function dbg(msg) { DBG.push(msg); if (DBG.length > 12) DBG.shift(); }

    // Запрос сразу тремя способами (родной сетевой модуль Lampa, ajax Lampa, fetch):
    // побеждает первый, у кого пришёл нормальный JSON. Всегда завершается по таймауту.
    function http(url, timeout) {
        timeout = timeout || 12000;
        var short = url.replace(/^https?:\/\//, '').split('?')[0];
        return new Promise(function (resolve, reject) {
            var settled = false, fails = 0, errs = [], channels = [], tm;

            function good(j, via) {
                if (settled) return;
                if (typeof j === 'string') {
                    try { j = JSON.parse(j); } catch (e) { return bad(via + ': не JSON'); }
                }
                if (!j || typeof j !== 'object') return bad(via + ': пусто');
                settled = true; clearTimeout(tm);
                dbg('OK ' + short + ' (' + via + ')');
                resolve(j);
            }
            function bad(msg) {
                errs.push(msg);
                fails++;
                if (!settled && fails >= channels.length) {
                    settled = true; clearTimeout(tm);
                    dbg('FAIL ' + short + ': ' + errs.join(', '));
                    reject(new Error(short + ' — ' + errs.join(', ')));
                }
            }

            if (window.Lampa && Lampa.Reguest) {
                channels.push(function () {
                    var n = new Lampa.Reguest();
                    if (typeof n.native !== 'function') throw new Error('нет native');
                    n.native(url, function (j) { good(j, 'native'); }, function () { bad('native: ошибка'); }, false, { dataType: 'json', timeout: timeout });
                });
                channels.push(function () {
                    var n = new Lampa.Reguest();
                    n.silent(url, function (j) { good(j, 'ajax'); }, function () { bad('ajax: ошибка'); }, false, { dataType: 'json', timeout: timeout });
                });
            }
            channels.push(function () {
                fetch(url).then(function (r) { return r.json(); }).then(function (j) { good(j, 'fetch'); })
                    .catch(function (e) { bad('fetch: ' + (e && e.message ? e.message : 'ошибка')); });
            });

            tm = setTimeout(function () {
                if (settled) return;
                settled = true;
                dbg('TIMEOUT ' + short);
                reject(new Error(short + ' — нет ответа за ' + Math.round(timeout / 1000) + ' с'));
            }, timeout);

            channels.forEach(function (run) {
                try { run(); } catch (e) { bad(e && e.message ? e.message : 'ошибка'); }
            });
        });
    }

    // первый успешный из нескольких промисов
    function firstOf(list) {
        return new Promise(function (resolve, reject) {
            var left = list.length, done = false;
            list.forEach(function (p) {
                p.then(function (v) { if (!done) { done = true; resolve(v); } })
                    .catch(function (e) { left--; if (left === 0 && !done) reject(e); });
            });
        });
    }

    function detectByIp() {
        var cached = lsGet(LS.ip, null);
        if (cached && Date.now() - cached.t < 24 * 3600 * 1000) return Promise.resolve(cached.loc);

        function save(loc) { lsSet(LS.ip, { t: Date.now(), loc: loc }); return loc; }
        return firstOf([
            http('https://ipwho.is/?lang=ru', 6000).then(function (j) {
                if (j && j.success !== false && j.latitude) return { name: j.city || j.region || 'Мой город', lat: +j.latitude, lon: +j.longitude, tz: j.timezone && j.timezone.id, auto: true };
                throw new Error('ipwho');
            }),
            http('https://ipapi.co/json/', 6000).then(function (j) {
                if (j && j.latitude) return { name: j.city || 'Мой город', lat: +j.latitude, lon: +j.longitude, tz: j.timezone, auto: true };
                throw new Error('ipapi');
            }),
            http('https://get.geojs.io/v1/ip/geo.json', 6000).then(function (j) {
                if (j && j.latitude) return { name: j.city || 'Мой город', lat: +j.latitude, lon: +j.longitude, tz: j.timezone, auto: true };
                throw new Error('geojs');
            })
        ]).then(save).catch(function () {
            return { name: 'Москва', lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow', auto: true, fallback: true };
        });
    }

    function getLocation() {
        var saved = lsGet(LS.city, null);
        if (saved && saved.lat) return Promise.resolve(saved);
        return detectByIp();
    }

    function geocode(name) {
        return http('https://geocoding-api.open-meteo.com/v1/search?count=10&language=ru&format=json&name=' + encodeURIComponent(name), 10000)
            .then(function (j) { return (j && j.results) || []; });
    }

    /* --- источники погоды: Open-Meteo напрямую -> MET Norway -> Open-Meteo через прокси --- */

    var SRC_KEY = 'weather_plus_src';
    var PROXIES = [
        function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); },
        function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
        function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); }
    ];

    function omUrls(loc) {
        var base = 'latitude=' + loc.lat + '&longitude=' + loc.lon + '&timezone=auto&wind_speed_unit=ms';
        return {
            a: 'https://api.open-meteo.com/v1/forecast?' + base + '&forecast_hours=26' +
                '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
                '&hourly=temperature_2m,precipitation_probability,weather_code,is_day,pressure_msl,visibility,dew_point_2m,uv_index',
            b: 'https://api.open-meteo.com/v1/forecast?' + base + '&forecast_days=7' +
                '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,daylight_duration'
        };
    }
    function omMerge(r) {
        var wj = r[0], dj = r[1];
        if (!wj || !wj.current || !wj.hourly) throw new Error('пустой ответ погоды');
        if (!dj || !dj.daily) throw new Error('пустой ответ прогноза по дням');
        wj.daily = dj.daily;
        return wj;
    }

    var PROV = {
        om: {
            name: 'Open-Meteo',
            fetch: function (loc) {
                var u = omUrls(loc);
                return Promise.all([http(u.a, 8000), http(u.b, 8000)]).then(omMerge);
            }
        },
        met: {
            name: 'MET Norway (yr.no)',
            fetch: function (loc, uvP) {
                var url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + loc.lat.toFixed(4) + '&lon=' + loc.lon.toFixed(4);
                return http(url, 10000).then(function (j) {
                    if (!j || !j.properties || !j.properties.timeseries) throw new Error('пустой ответ');
                    return uvP.then(function (uv) { return metToOm(j, loc, uv); });
                });
            }
        },
        omp: {
            name: 'Open-Meteo (через прокси)',
            fetch: function (loc) {
                var u = omUrls(loc);
                function viaProxy(url) {
                    return firstOf(PROXIES.map(function (px) {
                        return http(px(url), 10000).then(function (j) {
                            if (!j || (!j.current && !j.daily)) throw new Error('плохой ответ прокси');
                            return j;
                        });
                    }));
                }
                return Promise.all([viaProxy(u.a), viaProxy(u.b)]).then(omMerge);
            }
        }
    };

    function srcOrder() {
        var order = ['om', 'met', 'omp'];
        var r = lsGet(SRC_KEY, null);
        if (r && Date.now() - r.t < 6 * 3600 * 1000 && order.indexOf(r.id) > 0) {
            order.splice(order.indexOf(r.id), 1);
            order.unshift(r.id);
        }
        return order;
    }

    function tryProviders(loc, uvP, stage) {
        var order = srcOrder(), i = 0, errs = [];
        function next() {
            if (i >= order.length) return Promise.reject(new Error(errs.join(' | ')));
            var id = order[i++];
            if (stage) stage('Источник погоды: ' + PROV[id].name + '…');
            return PROV[id].fetch(loc, uvP).then(function (w) {
                lsSet(SRC_KEY, { id: id, t: Date.now() });
                return { w: w, src: id };
            }).catch(function (e) {
                errs.push(PROV[id].name + ': ' + (e && e.message ? e.message : 'ошибка'));
                dbg('SRC ' + id + ' fail');
                return next();
            });
        }
        return next();
    }

    function loadWeather(loc, force, stage) {
        var key = loc.lat.toFixed(2) + ',' + loc.lon.toFixed(2);
        var cache = lsGet(LS.cache, null);
        if (!force && cache && cache.key === key && Date.now() - cache.t < CACHE_TTL) return Promise.resolve(cache.data);

        var aUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + loc.lat + '&longitude=' + loc.lon + '&timezone=auto&current=european_aqi,pm2_5,pm10';
        var uvUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + loc.lat + '&longitude=' + loc.lon + '&timezone=auto&hourly=uv_index&forecast_days=7';
        var aqP = http(aUrl, 5000).catch(function () { return null; });
        var uvP = http(uvUrl, 6000).catch(function () { return null; });

        return tryProviders(loc, uvP, stage).then(function (r) {
            return aqP.then(function (aj) {
                var data = { w: r.w, aq: aj && aj.current ? aj.current : null, src: r.src, t: Date.now() };
                lsSet(LS.cache, { key: key, t: Date.now(), data: data });
                return data;
            });
        }).catch(function (err) {
            if (cache && cache.key === key && cache.data) { cache.data.stale = true; return cache.data; }
            throw err;
        });
    }

    /* --- MET Norway -> формат Open-Meteo --- */

    var dtfCache = {};
    function localParts(ms, tz) {
        try {
            if (tz) {
                var f = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
                var parts = f.formatToParts(new Date(ms)), o = {};
                for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
                var h = +o.hour; if (h === 24) h = 0;
                return { y: +o.year, m: +o.month, d: +o.day, h: h, mi: +o.minute };
            }
        } catch (e) { }
        var d = new Date(ms);
        return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
    }

    function sunTimes(lat, lon, y, m, d) {
        var rad = Math.PI / 180;
        var doy = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
        var g = 2 * Math.PI / 365 * (doy - 1);
        var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
        var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
        var c = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
        var ha = Math.acos(clamp(c, -1, 1)) / rad;
        var base = Date.UTC(y, m - 1, d);
        return { rise: base + (720 - 4 * (lon + ha) - eq) * 60000, set: base + (720 - 4 * (lon - ha) - eq) * 60000 };
    }

    function symCode(sym) {
        if (!sym) return 3;
        var base = sym.replace(/_(day|night|polartwilight)$/, '');
        var thunder = base.indexOf('thunder') >= 0;
        base = base.replace('andthunder', '');
        var map = {
            clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
            lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
            lightsleet: 66, sleet: 67, heavysleet: 67, lightsleetshowers: 80, sleetshowers: 81, heavysleetshowers: 82,
            lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86
        };
        if (thunder) return 95;
        var c = map[base];
        return c === undefined ? 3 : c;
    }
    function codeSev(c) {
        if (c >= 95) return 6;
        if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return 5;
        if (c >= 61) return 4;
        if (c >= 51) return 3;
        if (c >= 45) return 2;
        return 0;
    }

    function metToOm(j, loc, uv) {
        var ts = j.properties.timeseries, tz = loc.tz, now = Date.now(), lat = loc.lat, lon = loc.lon;
        var sunCache = {};
        function lp(ms) { return localParts(ms, tz); }
        function dayKey(p) { return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
        function isoP(p) { return dayKey(p) + 'T' + pad(p.h) + ':' + pad(p.mi); }
        function sunOf(p) {
            var k = dayKey(p);
            return sunCache[k] || (sunCache[k] = sunTimes(lat, lon, p.y, p.m, p.d));
        }
        function dew(t, rh) {
            var a = 17.62, b = 243.12, gm = Math.log(Math.max(rh, 1) / 100) + a * t / (b + t);
            return b * gm / (a - gm);
        }
        function feels(t, rh, ws) {
            var e = rh / 100 * 6.105 * Math.exp(17.27 * t / (237.7 + t));
            return t + 0.33 * e - 0.70 * ws - 4.0;
        }

        var uvMap = {}, i;
        if (uv && uv.hourly && uv.hourly.time) {
            for (i = 0; i < uv.hourly.time.length; i++) uvMap[uv.hourly.time[i].substring(0, 13)] = uv.hourly.uv_index[i];
        }

        var E = [];
        for (i = 0; i < ts.length; i++) {
            var e = ts[i], ms = Date.parse(e.time);
            if (isNaN(ms) || !e.data || !e.data.instant) continue;
            var det = e.data.instant.details || {};
            var n1 = e.data.next_1_hours, n6 = e.data.next_6_hours, n12 = e.data.next_12_hours;
            var sym = (n1 && n1.summary && n1.summary.symbol_code) || (n6 && n6.summary && n6.summary.symbol_code) || (n12 && n12.summary && n12.summary.symbol_code);
            var amount = 0;
            if (n1 && n1.details && n1.details.precipitation_amount !== undefined) amount = n1.details.precipitation_amount;
            else if (n6 && n6.details && n6.details.precipitation_amount !== undefined) amount = n6.details.precipitation_amount;
            var p = lp(ms), sn = sunOf(p);
            E.push({
                ms: ms, p: p, t: det.air_temperature, rh: det.relative_humidity, pr: det.air_pressure_at_sea_level,
                cl: det.cloud_area_fraction, ws: det.wind_speed, wd: det.wind_from_direction,
                code: symCode(sym), day: (ms >= sn.rise && ms < sn.set) ? 1 : 0, amount: amount || 0, hourly: !!n1
            });
        }
        if (!E.length) throw new Error('пустой прогноз');

        var f = 0;
        for (i = 0; i < E.length; i++) if (E[i].ms <= now) f = i;
        var c0 = E[f], nowP = lp(now), sn0 = sunOf(nowP);

        var cur = {
            time: isoP(nowP), temperature_2m: c0.t, relative_humidity_2m: c0.rh,
            apparent_temperature: feels(c0.t, c0.rh, c0.ws), is_day: (now >= sn0.rise && now < sn0.set) ? 1 : 0,
            precipitation: c0.hourly ? c0.amount : 0, weather_code: c0.code, cloud_cover: c0.cl,
            pressure_msl: c0.pr, wind_speed_10m: c0.ws, wind_direction_10m: c0.wd, wind_gusts_10m: null
        };

        var H = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], is_day: [], pressure_msl: [], visibility: [], dew_point_2m: [], uv_index: [] };
        for (i = f; i < E.length && H.time.length < 26; i++) {
            var q = E[i];
            if (i > f && q.ms - E[i - 1].ms > 3600000 + 1000) break;
            var hk = isoP(q.p).substring(0, 13);
            H.time.push(hk + ':00');
            H.temperature_2m.push(q.t);
            H.precipitation_probability.push(null);
            H.weather_code.push(q.code);
            H.is_day.push(q.day);
            H.pressure_msl.push(q.pr);
            H.visibility.push(null);
            H.dew_point_2m.push(dew(q.t, q.rh));
            H.uv_index.push(uvMap[hk] !== undefined ? uvMap[hk] : null);
        }

        var D = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [], uv_index_max: [], precipitation_sum: [], precipitation_probability_max: [], wind_speed_10m_max: [], wind_gusts_10m_max: [], daylight_duration: [] };
        for (var di = 0; di < 7; di++) {
            var dd = new Date(Date.UTC(nowP.y, nowP.m - 1, nowP.d + di));
            var y = dd.getUTCFullYear(), m = dd.getUTCMonth() + 1, d = dd.getUTCDate();
            var key = y + '-' + pad(m) + '-' + pad(d);
            var items = E.filter(function (x) { return dayKey(x.p) === key; });
            if (!items.length) break;
            var tmin = 99, tmax = -99, psum = 0, wmax = 0, best = null, near = null, k;
            for (k = 0; k < items.length; k++) {
                var it = items[k];
                tmin = Math.min(tmin, it.t); tmax = Math.max(tmax, it.t);
                psum += it.amount; wmax = Math.max(wmax, it.ws || 0);
                if (it.p.h >= 7 && it.p.h <= 21 && (!best || codeSev(it.code) > codeSev(best.code))) best = it;
                if (!near || Math.abs(it.p.h - 13) < Math.abs(near.p.h - 13)) near = it;
            }
            var code = best && codeSev(best.code) >= 3 ? best.code : near.code;
            var uvMaxD = null;
            for (var hkey in uvMap) {
                if (hkey.substring(0, 10) === key && uvMap[hkey] !== null && (uvMaxD === null || uvMap[hkey] > uvMaxD)) uvMaxD = uvMap[hkey];
            }
            var sd = sunTimes(lat, lon, y, m, d);
            D.time.push(key); D.weather_code.push(code);
            D.temperature_2m_max.push(tmax); D.temperature_2m_min.push(tmin);
            D.sunrise.push(isoP(lp(sd.rise))); D.sunset.push(isoP(lp(sd.set)));
            D.uv_index_max.push(uvMaxD); D.precipitation_sum.push(psum);
            D.precipitation_probability_max.push(null);
            D.wind_speed_10m_max.push(wmax); D.wind_gusts_10m_max.push(null);
            D.daylight_duration.push((sd.set - sd.rise) / 1000);
        }
        if (!D.time.length || H.time.length < 3) throw new Error('мало данных в прогнозе');
        return { current: cur, hourly: H, daily: D };
    }

    function getData(force, stage) {
        if (stage) stage('Определяю город…');
        return getLocation().then(function (loc) {
            if (stage) stage('Загружаю погоду для: ' + loc.name + '…');
            return loadWeather(loc, force, stage).then(function (data) { return { loc: loc, data: data }; });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Расчёты                                                            */
    /* ------------------------------------------------------------------ */

    function hourIndex(times, now) {
        var key = now.substring(0, 13);
        for (var i = 0; i < times.length; i++) if (times[i].substring(0, 13) === key) return i;
        return 0;
    }

    function moonPhase(dateStr) {
        var p = dateParts(dateStr);
        var jd = Date.UTC(p.y, p.m - 1, p.d, 12) / 86400000 + 2440587.5;
        var f = (((jd - 2451550.1) / 29.530588853) % 1 + 1) % 1;
        var ill = Math.round((1 - Math.cos(2 * Math.PI * f)) / 2 * 100);
        var name;
        if (f < .03 || f > .97) name = 'Новолуние';
        else if (f < .22) name = 'Растущий серп';
        else if (f < .28) name = 'Первая четверть';
        else if (f < .47) name = 'Растущая Луна';
        else if (f < .53) name = 'Полнолуние';
        else if (f < .72) name = 'Убывающая Луна';
        else if (f < .78) name = 'Последняя четверть';
        else name = 'Убывающий серп';
        return { name: name, ill: ill };
    }

    function uvInfo(u) {
        if (u < 3) return ['Низкий', '#4caf50'];
        if (u < 6) return ['Умеренный', '#ffc107'];
        if (u < 8) return ['Высокий', '#ff9800'];
        if (u < 11) return ['Очень высокий', '#f44336'];
        return ['Экстремальный', '#b455d6'];
    }
    function aqiInfo(a) {
        if (a <= 20) return ['Отличное', '#4caf50'];
        if (a <= 40) return ['Хорошее', '#8bc34a'];
        if (a <= 60) return ['Умеренное', '#ffc107'];
        if (a <= 80) return ['Плохое', '#ff9800'];
        if (a <= 100) return ['Очень плохое', '#f44336'];
        return ['Опасное', '#b455d6'];
    }
    function windInfo(ms) {
        if (ms < .5) return 'Штиль';
        if (ms < 3.4) return 'Слабый';
        if (ms < 8) return 'Умеренный';
        if (ms < 13.9) return 'Сильный';
        if (ms < 20.8) return 'Очень сильный';
        return 'Шторм';
    }
    function humInfo(h) {
        if (h < 30) return 'Сухо';
        if (h < 60) return 'Комфортно';
        if (h < 80) return 'Влажно';
        return 'Очень влажно';
    }
    function cloudInfo(c) {
        if (c < 15) return 'Ясно';
        if (c < 50) return 'Малооблачно';
        if (c < 85) return 'Облачно';
        return 'Пасмурно';
    }

    function adviceList(c, d, uvNow, aqi, vis, kind) {
        var out = [], f = c.apparent_temperature;
        if (f <= -20) out.push(['Очень холодно — тёплая куртка, шапка, перчатки', '#64b5f6']);
        else if (f <= -10) out.push(['Мороз — одевайтесь тепло', '#64b5f6']);
        else if (f <= 0) out.push(['Около нуля — зимняя куртка', '#81d4fa']);
        else if (f < 10) out.push(['Прохладно — куртка не помешает', '#80cbc4']);
        else if (f < 18) out.push(['Свежо — лёгкая куртка или свитер', '#a5d6a7']);
        else if (f < 26) out.push(['Комфортная погода', '#c5e1a5']);
        else if (f < 32) out.push(['Тепло — лёгкая одежда', '#ffe082']);
        else out.push(['Жара — пейте больше воды, держитесь в тени', '#ffab91']);

        var dk = wmo(d.weather_code[0])[1];
        var pp = d.precipitation_probability_max[0];
        if (pp === null || pp === undefined) pp = (dk === 'rain' || dk === 'shower' || dk === 'thunder') ? 60 : ((dk === 'snow' || dk === 'drizzle') ? 50 : 0);
        if (kind === 'thunder' || dk === 'thunder') out.push(['Гроза — лучше остаться в помещении', '#ce93d8']);
        else if (pp >= 50 && dk === 'snow') out.push(['Ожидается снег — осторожно на дорогах', '#b3e5fc']);
        else if (pp >= 50) out.push(['Возьмите зонт — осадки вероятны (' + pp + '%)', '#4fc3f7']);
        else if (pp >= 30) out.push(['Возможны осадки (' + pp + '%)', '#90caf9']);

        if (c.wind_speed_10m >= 10) out.push(['Сильный ветер — до ' + (function (w) { return w.v + ' ' + w.u; })(fmtWind(c.wind_gusts_10m || c.wind_speed_10m)), '#fff59d']);
        if (uvNow >= 6) out.push(['Высокий УФ — нужен солнцезащитный крем', '#ffcc80']);
        if (aqi !== null && aqi > 80) out.push(['Плохой воздух — ограничьте прогулки', '#ef9a9a']);
        if (vis !== null && vis < 1000) out.push(['Плохая видимость — осторожнее за рулём', '#cfd8dc']);
        return out.slice(0, 4);
    }

    /* ------------------------------------------------------------------ */
    /*  Построение страницы                                                */
    /* ------------------------------------------------------------------ */

    var SVG_PIN = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
    var SVG_REF = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
    var SVG_DROP = '<svg viewBox="0 0 24 24"><path fill="#4fc3f7" d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/></svg>';

    function tile(color, title, body, extraCls) {
        return '<div class="wp-cell"><div class="wp-tile wp-f selector ' + (extraCls || '') + '" style="--c:' + color + '">' +
            '<div class="wp-tile__t"><i></i>' + title + '</div>' + body + '</div></div>';
    }
    function kv(k, v) { return '<div class="wp-kv"><span>' + k + '</span><b>' + v + '</b></div>'; }

    function sunArc(c, d) {
        var sr = d.sunrise[0], ss = d.sunset[0];
        var now = toMin(c.time), a = toMin(sr), b = toMin(ss);
        var p = (now - a) / (b - a);
        var inDay = p >= 0 && p <= 1;
        var pc = clamp(p, 0, 1);
        var x = 100 - 90 * Math.cos(Math.PI * pc), y = 92 - 84 * Math.sin(Math.PI * pc);
        var dot = inDay ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="#FFCA28" stroke="#fff" stroke-width="2"/>' :
            '<circle cx="' + (p < 0 ? 10 : 190) + '" cy="92" r="5" fill="#9fa8da"/>';
        return '<svg viewBox="0 0 200 100" class="wp-arc">' +
            '<path d="M10 92 A90 84 0 0 1 190 92" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>' +
            '<path pathLength="100" d="M10 92 A90 84 0 0 1 190 92" fill="none" stroke="#FFB74D" stroke-width="4" stroke-linecap="round" stroke-dasharray="' +
            (pc * 100).toFixed(1) + ' 100"/>' + dot + '</svg>';
    }

    function build(loc, pack) {
        var w = pack.w, aq = pack.aq;
        var c = w.current, H = w.hourly, D = w.daily;
        var idx = hourIndex(H.time, c.time);
        var info = wmo(c.weather_code), kind = info[1], day = c.is_day === 1;
        var today = c.time.substring(0, 10);

        var vis = H.visibility && H.visibility[idx] !== null ? H.visibility[idx] : null;
        var dew = H.dew_point_2m ? H.dew_point_2m[idx] : null;
        var uvRaw = H.uv_index ? H.uv_index[idx] : D.uv_index_max[0];
        var uvKnown = uvRaw !== null && uvRaw !== undefined;
        var uvNow = uvKnown ? uvRaw : 0;
        var aqi = aq && aq.european_aqi !== null && aq.european_aqi !== undefined ? aq.european_aqi : null;

        var out = '';

        /* верхняя панель */
        var upd = new Date(pack.t);
        out += '<div class="wp-top">' +
            '<div class="wp-btn wp-f selector" data-act="city">' + SVG_PIN + '<b>' + loc.name + '</b><small>' + (loc.auto ? 'авто · ' : '') + 'сменить</small></div>' +
            '<div class="wp-btn wp-f selector" data-act="refresh">' + SVG_REF + '<span>Обновить</span></div>' +
            '<div class="wp-upd">' + (loc.fallback ? 'Город не определился — показана Москва, выберите свой · ' : '') + (pack.stale ? 'Нет связи, показаны старые данные · ' : '') + 'Обновлено в ' + pad(upd.getHours()) + ':' + pad(upd.getMinutes()) + ' · ' + (PROV[pack.src] ? PROV[pack.src].name : 'Open-Meteo') + '</div>' +
            '</div>';

        /* главный блок */
        var adv = adviceList(c, D, uvNow, aqi, vis, kind);
        var advHtml = '';
        for (var a = 0; a < adv.length; a++) advHtml += '<div class="wp-chip" style="--c:' + adv[a][1] + '"><i></i>' + adv[a][0] + '</div>';

        out += '<div class="wp-hero wp-f selector">' +
            '<div class="wp-hero__ico">' + icon(kind, day) + '</div>' +
            '<div class="wp-hero__main">' +
            '<div class="wp-hero__temp">' + fmtT(c.temperature_2m).replace('\u00B0', '') + '<i>\u00B0</i></div>' +
            '<div class="wp-hero__desc">' + info[0] + '</div>' +
            '<div class="wp-hero__feels">Ощущается как <b style="color:' + tcol(c.apparent_temperature) + '">' + fmtT(c.apparent_temperature) + '</b></div>' +
            '<div class="wp-hero__rng"><span style="color:' + tcol(D.temperature_2m_max[0]) + '">\u25B2 ' + fmtT(D.temperature_2m_max[0]) + '</span>' +
            '<span style="color:' + tcol(D.temperature_2m_min[0]) + '">\u25BC ' + fmtT(D.temperature_2m_min[0]) + '</span></div>' +
            '</div>' +
            '<div class="wp-hero__side">' + advHtml + '</div>' +
            '</div>';

        /* плитки */
        var tiles = '';

        // Ветер
        var wnd = fmtWind(c.wind_speed_10m), gust = c.wind_gusts_10m ? fmtWind(c.wind_gusts_10m) : null;
        tiles += tile('#4fc3f7', 'Ветер',
            '<div class="wp-row"><div><div class="wp-val">' + wnd.v + '<small>' + wnd.u + '</small></div>' +
            '<div class="wp-sub">' + windInfo(c.wind_speed_10m) + ' · ' + dirName(c.wind_direction_10m) + '</div>' +
            (gust ? '<div class="wp-sub">Порывы до ' + gust.v + ' ' + gust.u + '</div>' : '') + '</div>' +
            '<svg viewBox="0 0 64 64" class="wp-compass"><circle cx="32" cy="32" r="28" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>' +
            '<text x="32" y="12" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">С</text>' +
            '<text x="32" y="60" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">Ю</text>' +
            '<text x="57" y="35" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">В</text>' +
            '<text x="7" y="35" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)">З</text>' +
            '<g style="transform:rotate(' + (c.wind_direction_10m + 180) + 'deg);transform-origin:32px 32px">' +
            '<path d="M32 14L40 40L32 35L24 40Z" fill="#4fc3f7" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></g></svg></div>');

        // Влажность
        tiles += tile('#26c6da', 'Влажность',
            '<div class="wp-val">' + Math.round(c.relative_humidity_2m) + '<small>%</small></div>' +
            '<div class="wp-sub">' + humInfo(c.relative_humidity_2m) + '</div>' +
            '<div class="wp-bar"><i style="width:' + clamp(c.relative_humidity_2m, 0, 100) + '%"></i></div>');

        // Давление
        var pr = fmtPress(c.pressure_msl);
        var trend = '', pNow = H.pressure_msl ? H.pressure_msl[idx] : null, pLater = H.pressure_msl ? H.pressure_msl[idx + 3] : null;
        if (pNow !== null && pLater !== null && pLater !== undefined) {
            var dp = pLater - pNow;
            trend = Math.abs(dp) < 1 ? 'Стабильное' : (dp > 0 ? '\u2197 Растёт' : '\u2198 Падает');
        }
        var mm = c.pressure_msl * 0.750062;
        var pLabel = mm < 750 ? 'Пониженное' : (mm > 770 ? 'Повышенное' : 'Нормальное');
        tiles += tile('#ab8cff', 'Давление',
            '<div class="wp-val">' + pr.v + '<small>' + pr.u + '</small></div>' +
            '<div class="wp-sub">' + pLabel + '</div>' +
            (trend ? '<div class="wp-sub">Ближайшие 3 ч: ' + trend + '</div>' : ''));

        // Осадки
        var psum = D.precipitation_sum[0] || 0, pmaxRaw = D.precipitation_probability_max[0], hasPop = pmaxRaw !== null && pmaxRaw !== undefined, pmax = pmaxRaw || 0;
        tiles += tile('#42a5f5', 'Осадки сегодня',
            '<div class="wp-val">' + (psum > 0 ? (Math.round(psum * 10) / 10) + '<small>мм</small>' : 'Нет') + '</div>' +
            '<div class="wp-sub">' + (hasPop ? 'Вероятность до ' + pmax + '%' : 'Вероятность неизвестна') + (c.precipitation > 0 ? ' · сейчас ' + c.precipitation + ' мм' : '') + '</div>' +
            (hasPop ? '<div class="wp-bar"><i style="width:' + clamp(pmax, 0, 100) + '%"></i></div>' : ''));

        // УФ
        var uvI = uvInfo(uvNow), uvMax = D.uv_index_max[0] || 0;
        tiles += !uvKnown ? tile('#9e9e9e', 'УФ-индекс', '<div class="wp-val">—</div><div class="wp-sub">Нет данных</div>') : tile(uvI[1], 'УФ-индекс',
            '<div class="wp-val">' + (Math.round(uvNow * 10) / 10) + '</div>' +
            '<div class="wp-sub" style="color:' + uvI[1] + '">' + uvI[0] + ' · макс. сегодня ' + Math.round(uvMax) + '</div>' +
            '<div class="wp-scale"><i style="left:' + clamp(uvNow / 11 * 100, 0, 100) + '%"></i></div>');

        // Воздух
        if (aqi !== null) {
            var aI = aqiInfo(aqi);
            tiles += tile(aI[1], 'Качество воздуха',
                '<div class="wp-val">' + Math.round(aqi) + '<small>AQI</small></div>' +
                '<div class="wp-sub" style="color:' + aI[1] + '">' + aI[0] + '</div>' +
                '<div class="wp-sub">PM2.5: ' + Math.round(aq.pm2_5) + ' · PM10: ' + Math.round(aq.pm10) + ' мкг/м\u00B3</div>' +
                '<div class="wp-scale"><i style="left:' + clamp(aqi / 120 * 100, 0, 100) + '%"></i></div>');
        } else {
            tiles += tile('#9e9e9e', 'Качество воздуха', '<div class="wp-val">—</div><div class="wp-sub">Нет данных для этого места</div>');
        }

        // Атмосфера
        tiles += tile('#ffb74d', 'Атмосфера',
            kv('Видимость', vis !== null ? (vis >= 10000 ? '10+ км' : (vis / 1000).toFixed(1) + ' км') : '—') +
            kv('Облачность', Math.round(c.cloud_cover) + '% · ' + cloudInfo(c.cloud_cover)) +
            kv('Точка росы', dew !== null && dew !== undefined ? fmtT(dew) : '—') +
            kv('Ощущается', fmtT(c.apparent_temperature)));

        // Солнце и Луна
        var mp = moonPhase(today);
        var dl = D.daylight_duration && D.daylight_duration[0] ? D.daylight_duration[0] / 60 : (toMin(D.sunset[0]) - toMin(D.sunrise[0]));
        tiles += tile('#ffca28', 'Солнце и Луна',
            sunArc(c, D) +
            '<div class="wp-sun"><span>\u2191 ' + hm(D.sunrise[0]) + '</span><span>' + durText(dl) + '</span><span>\u2193 ' + hm(D.sunset[0]) + '</span></div>' +
            '<div class="wp-sub">Луна: ' + mp.name + ' · ' + mp.ill + '%</div>');

        out += '<div class="wp-tiles">' + tiles + '</div>';

        /* почасовой */
        var hrs = [], tmin = 99, tmax = -99, i;
        for (i = idx; i < idx + 24 && i < H.time.length; i++) {
            hrs.push(i);
            tmin = Math.min(tmin, H.temperature_2m[i]);
            tmax = Math.max(tmax, H.temperature_2m[i]);
        }
        var hh = '';
        for (i = 0; i < hrs.length; i++) {
            var k = hrs[i], t = H.temperature_2m[k], pp = H.precipitation_probability ? H.precipitation_probability[k] : 0;
            var hk = wmo(H.weather_code[k])[1];
            var bh = 18 + 82 * (t - tmin) / ((tmax - tmin) || 1);
            hh += '<div class="wp-hr wp-f selector">' +
                '<div class="wp-hr__t">' + (i === 0 ? 'Сейчас' : H.time[k].substring(11, 16)) + '</div>' +
                icon(hk, H.is_day[k] === 1) +
                '<div class="wp-hr__bar"><i style="height:' + bh.toFixed(0) + '%;background:' + tcol(t) + '"></i></div>' +
                '<div class="wp-hr__temp" style="color:' + tcol(t) + '">' + fmtT(t) + '</div>' +
                '<div class="wp-hr__p">' + (pp >= 10 ? SVG_DROP + pp + '%' : '&nbsp;') + '</div></div>';
        }
        out += '<div class="wp-h2">Почасовой прогноз</div><div class="wp-hours">' + hh + '</div>';

        /* 7 дней */
        var wmin = 99, wmax = -99;
        for (i = 0; i < D.time.length; i++) {
            wmin = Math.min(wmin, D.temperature_2m_min[i]);
            wmax = Math.max(wmax, D.temperature_2m_max[i]);
        }
        var dd = '';
        for (i = 0; i < D.time.length; i++) {
            var dt = dateObj(D.time[i]), dp2 = dateParts(D.time[i]);
            var nm = i === 0 ? 'Сегодня' : (i === 1 ? 'Завтра' : WD_FULL[dt.getDay()]);
            var mn = D.temperature_2m_min[i], mx = D.temperature_2m_max[i];
            var left = (mn - wmin) / ((wmax - wmin) || 1) * 100, wid = Math.max(6, (mx - mn) / ((wmax - wmin) || 1) * 100);
            var dinfo = wmo(D.weather_code[i]);
            var pr2 = D.precipitation_probability_max[i] || 0;
            dd += '<div class="wp-day wp-f selector" data-i="' + i + '">' +
                '<div class="wp-day__name">' + nm + '<small>' + dp2.d + ' ' + MON[dp2.m - 1] + '</small></div>' +
                icon(dinfo[1], true) +
                '<div class="wp-day__desc">' + dinfo[0] + '</div>' +
                '<div class="wp-day__p">' + (pr2 >= 10 ? SVG_DROP + pr2 + '%' : '') + '</div>' +
                '<div class="wp-day__min" style="color:' + tcol(mn) + '">' + fmtT(mn) + '</div>' +
                '<div class="wp-day__rng"><i style="left:' + left.toFixed(1) + '%;width:' + wid.toFixed(1) + '%;background:linear-gradient(90deg,' + tcol(mn) + ',' + tcol(mx) + ')"></i></div>' +
                '<div class="wp-day__max" style="color:' + tcol(mx) + '">' + fmtT(mx) + '</div></div>';
        }
        out += '<div class="wp-h2">Прогноз на 7 дней</div><div class="wp-days">' + dd + '</div>';
        out += '<div class="wp-foot">Погода+ · данные ' + (pack.src === 'met' ? 'MET Norway (api.met.no), УФ и воздух — Open-Meteo' : 'Open-Meteo.com') + '</div>';

        return { html: out, theme: theme(kind, day), fx: fxHtml(kind, day) };
    }

    function dayDetails(D, i) {
        var dt = dateObj(D.time[i]), p = dateParts(D.time[i]);
        var info = wmo(D.weather_code[i]);
        var w = fmtWind(D.wind_speed_10m_max[i] || 0), g = D.wind_gusts_10m_max[i] ? fmtWind(D.wind_gusts_10m_max[i]) : null;
        var uvRaw = D.uv_index_max[i], uv = uvRaw || 0, pop = D.precipitation_probability_max[i];
        var dl = D.daylight_duration && D.daylight_duration[i] ? D.daylight_duration[i] / 60 : (toMin(D.sunset[i]) - toMin(D.sunrise[i]));
        var mp = moonPhase(D.time[i]);
        return {
            title: WD_FULL[dt.getDay()] + ', ' + p.d + ' ' + MON[p.m - 1],
            items: [
                { title: info[0], subtitle: 'Днём ' + fmtT(D.temperature_2m_max[i]) + ', ночью ' + fmtT(D.temperature_2m_min[i]) },
                { title: 'Осадки: ' + (Math.round((D.precipitation_sum[i] || 0) * 10) / 10) + ' мм', subtitle: pop === null || pop === undefined ? 'Вероятность неизвестна' : 'Вероятность до ' + pop + '%' },
                { title: 'Ветер до ' + w.v + ' ' + w.u, subtitle: g ? 'Порывы до ' + g.v + ' ' + g.u : '' },
                { title: 'УФ-индекс: ' + (uvRaw === null || uvRaw === undefined ? '—' : Math.round(uv)), subtitle: uvRaw === null || uvRaw === undefined ? '' : uvInfo(uv)[0] },
                { title: '\u2191 ' + hm(D.sunrise[i]) + '   \u2193 ' + hm(D.sunset[i]), subtitle: 'Световой день ' + durText(dl) },
                { title: 'Луна: ' + mp.name, subtitle: 'Освещённость ' + mp.ill + '%' }
            ]
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Выбор города                                                       */
    /* ------------------------------------------------------------------ */

    function saveCity(c) {
        lsSet(LS.city, c);
        var rec = lsGet(LS.recent, []).filter(function (x) { return x.name !== c.name || Math.abs(x.lat - c.lat) > .05; });
        rec.unshift({ name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, sub: c.sub || '' });
        lsSet(LS.recent, rec.slice(0, 6));
        lsSet(LS.cache, null);
        syncCitySel();
    }

    function searchCity(back, done) {
        try {
            Lampa.Input.edit({ free: true, title: 'Название города', nosave: true, value: '' }, function (val) {
                val = (val || '').trim();
                if (!val) { back(); return; }
                geocode(val).then(function (list) {
                    if (!list.length) { Lampa.Noty.show('Город не найден: ' + val); back(); return; }
                    var items = list.map(function (r) {
                        return { title: r.name, subtitle: [r.admin1, r.country].filter(Boolean).join(', '), r: r };
                    });
                    Lampa.Select.show({
                        title: 'Результаты поиска',
                        items: items,
                        onSelect: function (a) {
                            var c = { name: a.r.name, lat: a.r.latitude, lon: a.r.longitude, tz: a.r.timezone, sub: a.subtitle };
                            saveCity(c);
                            done();
                        },
                        onBack: back
                    });
                }).catch(function () { Lampa.Noty.show('Не удалось выполнить поиск'); back(); });
            });
        } catch (e) {
            Lampa.Noty.show('Не удалось открыть ввод');
            back();
        }
    }

    function cityMenu(back, done) {
        var items = [
            { title: 'Определить автоматически', subtitle: 'по IP-адресу', act: 'auto' },
            { title: 'Найти город…', subtitle: 'ввести название', act: 'search' }
        ];
        var used = {};
        lsGet(LS.recent, []).forEach(function (c) {
            used[c.name] = 1;
            items.push({ title: c.name, subtitle: c.sub || 'Недавний', city: c });
        });
        POPULAR.forEach(function (p) {
            if (used[p[0]]) return;
            items.push({ title: p[0], subtitle: 'Популярный', city: { name: p[0], lat: p[1], lon: p[2], tz: p[3] } });
        });
        Lampa.Select.show({
            title: 'Город',
            items: items,
            onSelect: function (a) {
                if (a.act === 'auto') { lsSet(LS.city, null); lsSet(LS.ip, null); lsSet(LS.cache, null); syncCitySel(); done(); }
                else if (a.act === 'search') { searchCity(back, done); }
                else { saveCity(a.city); done(); }
            },
            onBack: back
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Стили                                                              */
    /* ------------------------------------------------------------------ */

    function injectStyle() {
        if (document.getElementById('weather-plus-style')) return;
        var css = [
            '.wp{position:relative;height:100%;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.25)}',
            '.wp-bg{position:absolute;left:0;top:0;right:0;bottom:0;background:#1c2f4a;opacity:var(--wp-a,.7)}',
            '.wp-fx{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none}',
            '.wp-bg:after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(60% 50% at 85% 0%,rgba(255,255,255,.18),transparent 70%)}',
            '.wp .scroll{position:relative;z-index:1}',
            '.wp-body{padding:1em 3.2em 3em 3.2em}',
            '.wp-f{transition:box-shadow .12s}',
            '.wp-f.focus{box-shadow:0 0 0 .25em #fff}',

            /* верх */
            '.wp-top{display:flex;align-items:center;margin-bottom:1em}',
            '.wp-btn{display:flex;align-items:center;background:rgba(255,255,255,.16);border-radius:2em;padding:.55em 1.2em;margin-right:.9em;font-size:1.1em}',
            '.wp-btn svg{width:1.3em;height:1.3em;margin-right:.5em}',
            '.wp-btn b{font-weight:600}',
            '.wp-btn small{margin-left:.7em;opacity:.65;font-size:.8em}',
            '.wp-upd{margin-left:auto;opacity:.6;font-size:.85em}',

            /* главный блок */
            '.wp-hero{display:flex;align-items:center;border-radius:1.6em;padding:1.2em 2em;background:rgba(255,255,255,.12);margin-bottom:.6em}',
            '.wp-hero__ico{width:11em;height:11em;flex-shrink:0}',
            '.wp-hero__ico svg{width:100%;height:100%;filter:drop-shadow(0 .4em .6em rgba(0,0,0,.25))}',
            '.wp-hero__main{margin-left:1.6em}',
            '.wp-hero__temp{font-size:7em;font-weight:200;line-height:1;white-space:nowrap}',
            '.wp-hero__temp i{font-style:normal;font-weight:300;opacity:.85}',
            '.wp-hero__desc{font-size:1.9em;font-weight:500;margin-top:.15em}',
            '.wp-hero__feels{font-size:1.15em;opacity:.9;margin-top:.35em}',
            '.wp-hero__feels b{font-weight:600}',
            '.wp-hero__rng{font-size:1.25em;font-weight:600;margin-top:.3em}',
            '.wp-hero__rng span{margin-right:1.1em}',
            '.wp-hero__side{margin-left:auto;padding-left:2em;max-width:42%}',
            '.wp-chip{display:flex;align-items:center;background:rgba(0,0,0,.2);border-radius:1.4em;padding:.5em 1em;margin:.35em 0;font-size:1.05em}',
            '.wp-chip i{width:.7em;height:.7em;border-radius:50%;background:var(--c);flex-shrink:0;margin-right:.7em;box-shadow:0 0 .6em var(--c)}',

            /* плитки */
            '.wp-tiles{display:flex;flex-wrap:wrap;margin:0 -.5em}',
            '.wp-cell{width:25%;box-sizing:border-box;padding:.5em;display:flex}',
            '.wp-tile{flex:1;box-sizing:border-box;border-radius:1.2em;padding:1em 1.2em;min-height:11em;background:rgba(255,255,255,.13);position:relative;overflow:hidden}',
            '.wp-tile:before{content:"";position:absolute;left:0;top:0;right:0;height:.3em;background:var(--c);opacity:.85}',
            '.wp-tile__t{display:flex;align-items:center;font-size:.85em;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:.6em}',
            '.wp-tile__t i{width:.65em;height:.65em;border-radius:50%;background:var(--c);margin-right:.6em;box-shadow:0 0 .5em var(--c)}',
            '.wp-val{font-size:2.5em;font-weight:300;line-height:1.1}',
            '.wp-val small{font-size:.38em;font-weight:400;margin-left:.35em;opacity:.75}',
            '.wp-sub{font-size:.95em;opacity:.85;margin-top:.25em}',
            '.wp-row{display:flex;align-items:center;justify-content:space-between}',
            '.wp-compass{width:5.6em;height:5.6em;flex-shrink:0}',
            '.wp-bar{height:.5em;border-radius:.3em;background:rgba(255,255,255,.2);overflow:hidden;margin-top:.8em}',
            '.wp-bar i{display:block;height:100%;border-radius:.3em;background:var(--c)}',
            '.wp-scale{position:relative;height:.5em;border-radius:.3em;margin-top:.9em;background:linear-gradient(90deg,#4caf50,#ffc107 40%,#ff9800 60%,#f44336 80%,#b455d6)}',
            '.wp-scale i{position:absolute;top:-.25em;width:1em;height:1em;border-radius:50%;background:#fff;margin-left:-.5em;box-shadow:0 0 .4em rgba(0,0,0,.5)}',
            '.wp-kv{display:flex;justify-content:space-between;padding:.32em 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:.98em}',
            '.wp-kv:last-child{border-bottom:0}',
            '.wp-kv span{opacity:.75}',
            '.wp-arc{width:100%;height:5.2em;display:block}',
            '.wp-sun{display:flex;justify-content:space-between;font-size:.95em;margin-top:.1em}',

            /* заголовки */
            '.wp-h2{font-size:1.4em;font-weight:500;margin:1.1em 0 .5em .2em}',

            /* часы */
            '.wp-hours{display:flex;flex-wrap:wrap;margin:0 -.3em}',
            '.wp-hr{box-sizing:border-box;width:calc(8.3333% - .6em);margin:.3em;border-radius:1em;background:rgba(255,255,255,.12);padding:.6em .2em .5em;text-align:center}',
            '.wp-hr__t{font-size:.9em;opacity:.85}',
            '.wp-hr .wp-ico{width:2.6em;height:2.6em;margin:.2em auto}',
            '.wp-hr__bar{height:2.6em;width:.7em;margin:.2em auto;border-radius:.35em;background:rgba(255,255,255,.12);position:relative;overflow:hidden}',
            '.wp-hr__bar i{position:absolute;left:0;right:0;bottom:0;border-radius:.35em}',
            '.wp-hr__temp{font-size:1.2em;font-weight:600}',
            '.wp-hr__p{font-size:.8em;opacity:.9;height:1.3em;display:flex;align-items:center;justify-content:center}',
            '.wp-hr__p svg,.wp-day__p svg{width:.9em;height:.9em;margin-right:.2em}',

            /* дни */
            '.wp-day{display:flex;align-items:center;border-radius:1em;background:rgba(255,255,255,.12);padding:.45em 1.4em;margin:.4em 0}',
            '.wp-day__name{width:10em;font-size:1.15em;font-weight:500}',
            '.wp-day__name small{display:block;font-size:.72em;font-weight:400;opacity:.65}',
            '.wp-day .wp-ico{width:2.8em;height:2.8em;flex-shrink:0}',
            '.wp-day__desc{width:13em;margin-left:1em;opacity:.9}',
            '.wp-day__p{width:4.5em;display:flex;align-items:center;font-size:.95em}',
            '.wp-day__min,.wp-day__max{width:3em;font-size:1.2em;font-weight:600;text-align:right}',
            '.wp-day__max{text-align:left}',
            '.wp-day__rng{flex:1;height:.55em;border-radius:.3em;background:rgba(255,255,255,.15);position:relative;margin:0 1em}',
            '.wp-day__rng i{position:absolute;top:0;bottom:0;border-radius:.3em}',
            '.wp-foot{text-align:center;opacity:.45;font-size:.8em;margin-top:1.6em}',

            /* загрузка / ошибка */
            '.wp-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;font-size:1.3em;opacity:.9}',
            '.wp-loading i{width:3em;height:3em;border-radius:50%;border:.28em solid rgba(255,255,255,.25);border-top-color:#fff;margin-bottom:1em;animation:wpspin 1s linear infinite}',
            '.wp-err{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;font-size:1.3em;text-align:center}',
            '.wp-dbg{max-width:80%;font-size:.6em;opacity:.7;margin-top:.8em;line-height:1.4;word-break:break-all}',
            '.wp-err .wp-btn{margin:1.2em 0 0 0}',

            /* иконки */
            '.wp-ico{display:block}',
            '.wp-hero .wp-spin{animation:wpspin 28s linear infinite}',
            '.wp-hero .wp-float{animation:wpfloat 6s ease-in-out infinite}',

            /* частицы */
            '.wp-fx-rain{position:absolute;top:-12vh;width:2px;height:7vh;background:linear-gradient(rgba(190,225,255,0),rgba(190,225,255,.9));animation:wprain 1s linear infinite;will-change:transform}',
            '.wp-fx-snow{position:absolute;top:-4vh;border-radius:50%;background:#fff;opacity:.85;animation:wpsnow 9s linear infinite;will-change:transform}',
            '.wp-fx-star{position:absolute;width:.22em;height:.22em;border-radius:50%;background:#fff;animation:wptwinkle 3s ease-in-out infinite}',
            '.wp-fx-fog{position:absolute;left:-30%;width:160%;height:22%;background:radial-gradient(ellipse at center,rgba(255,255,255,.2),transparent 70%);animation:wpdrift 30s linear infinite}',
            '.wp-fx-glow{position:absolute;right:-10%;top:-20%;width:60%;height:70%;background:radial-gradient(circle,rgba(255,235,150,.45),transparent 65%);animation:wppulse 6s ease-in-out infinite}',
            '.wp-fx-flash{position:absolute;left:0;top:0;right:0;bottom:0;background:#fff;opacity:0;animation:wpflash 7s linear infinite}',

            '@keyframes wpspin{to{transform:rotate(360deg)}}',
            '@keyframes wpfloat{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}',
            '@keyframes wprain{to{transform:translate3d(-4vh,125vh,0)}}',
            '@keyframes wpsnow{0%{transform:translate3d(0,0,0)}50%{transform:translate3d(3vh,55vh,0)}100%{transform:translate3d(-2vh,110vh,0)}}',
            '@keyframes wptwinkle{0%,100%{opacity:.15}50%{opacity:1}}',
            '@keyframes wpdrift{to{transform:translate3d(30%,0,0)}}',
            '@keyframes wppulse{0%,100%{opacity:.7}50%{opacity:1}}',
            '@keyframes wpflash{0%,92%,96%,100%{opacity:0}93%{opacity:.35}94%{opacity:.05}95%{opacity:.25}}',

            /* виджет в шапке */
            '.wp-head{display:flex;align-items:center;width:auto!important;height:auto!important;padding:.2em .7em!important;white-space:nowrap}',
            '.wp-head svg{width:1.8em;height:1.8em;margin-right:.35em}',
            '.wp-head span{font-weight:600;font-size:1.1em}'
        ].join('\n');
        var st = document.createElement('style');
        st.id = 'weather-plus-style';
        st.textContent = css;
        document.head.appendChild(st);
    }

    /* ------------------------------------------------------------------ */
    /*  Компонент страницы                                                 */
    /* ------------------------------------------------------------------ */

    function bgAlpha() {
        var v = parseInt(opt('weather_plus_bgalpha', '70'), 10);
        if (isNaN(v)) v = 70;
        return clamp(v, 20, 100) / 100;
    }

    function WeatherPage(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
        var html = $('<div class="wp"></div>');
        var bg = $('<div class="wp-bg"></div>');
        var fx = $('<div class="wp-fx"></div>');
        var body = $('<div class="wp-body"></div>');
        var self = this;
        var last = null;
        var dead = false;
        var current = null;

        function isActive() {
            try { return Lampa.Activity.active() && Lampa.Activity.active().activity === self.activity; } catch (e) { return false; }
        }
        function refocus() {
            if (dead || !isActive()) return;
            Lampa.Controller.toggle('content');
        }
        function backToContent() {
            if (dead) return;
            Lampa.Controller.toggle('content');
        }
        function showLoading() {
            body.html('<div class="wp-loading"><i></i><div class="wp-stage">Загружаю погоду…</div></div>');
        }
        function stage(t) { body.find('.wp-stage').text(t); }
        function showError(msg) {
            body.html('<div class="wp-err"><div>Не удалось получить погоду</div><div class="wp-dbg">' + (msg || '') + '<br>' + DBG.join('<br>') + '</div>' +
                '<div class="wp-btn wp-f selector" data-act="refresh">' + SVG_REF + '<span>Повторить</span></div>' +
                '<div class="wp-btn wp-f selector" data-act="city" style="margin-top:.8em">' + SVG_PIN + '<span>Выбрать город</span></div></div>');
            bindItems();
            last = null;
            finish();
        }
        function finish() {
            try { self.activity.loader(false); self.activity.toggle(); } catch (e) { }
            refocus();
        }

        function bindItems() {
            body.find('.selector').on('hover:focus', function (e) {
                last = e.target;
                scroll.update($(e.target), true);
            });
            body.find('[data-act="city"]').on('hover:enter', function () {
                cityMenu(backToContent, function () { self.load(true); });
            });
            body.find('[data-act="refresh"]').on('hover:enter', function () {
                lsSet(LS.cache, null);
                self.load(true);
            });
            body.find('.wp-day').on('hover:enter', function () {
                if (!current) return;
                var det = dayDetails(current.data.w.daily, +$(this).data('i'));
                Lampa.Select.show({
                    title: det.title,
                    items: det.items,
                    onSelect: backToContent,
                    onBack: backToContent
                });
            });
        }

        this.load = function (force) {
            showLoading();
            last = null;
            getData(force, stage).then(function (res) {
                if (dead) return;
                current = res;
                var b = build(res.loc, res.data);
                bg.css('background', b.theme);
                fx.html(opt('weather_plus_anim', true) ? b.fx : '');
                body.html(b.html);
                bindItems();
                finish();
                updateHeadFrom(res);
            }).catch(function (e) {
                if (dead) return;
                showError(e && e.message ? e.message : '');
            });
        };

        this.create = function () {
            injectStyle();
            try { html[0].style.setProperty('--wp-a', bgAlpha()); } catch (e) { }
            html.append(bg);
            html.append(fx);
            html.append(scroll.render());
            scroll.append(body);
            this.load(false);
            // сразу убираем системный индикатор Lampa: показываем свой и даём работать кнопке «Назад»
            setTimeout(function () {
                if (dead) return;
                try { self.activity.loader(false); self.activity.toggle(); } catch (e) { }
            }, 0);
            return this.render();
        };

        this.render = function () { return html; };

        this.start = function () {
            if (!isActive()) return;
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
                down: function () {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () { };
        this.stop = function () { };
        this.destroy = function () {
            dead = true;
            scroll.destroy();
            html.remove();
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Виджет в шапке                                                     */
    /* ------------------------------------------------------------------ */

    var headEl = null, headTries = 0;

    function openPage() {
        Lampa.Activity.push({ url: '', title: 'Погода+', component: 'weather_plus', page: 1 });
    }

    function mountHead() {
        if (headEl && $.contains(document.body, headEl[0])) return true;
        var tm = $('.head__time').first();
        var host = $('.head__actions').first();
        if (!tm.length && !host.length) return false;
        headEl = $('<div class="head__action selector wp-head"></div>');
        headEl.on('hover:enter', openPage);
        if (tm.length) tm.before(headEl);
        else host.prepend(headEl);
        return true;
    }

    function updateHeadFrom(res) {
        if (!opt('weather_plus_head', true)) {
            if (headEl) { headEl.remove(); headEl = null; }
            return;
        }
        try {
            if (!mountHead()) {
                // шапка могла ещё не отрисоваться — пробуем позже
                if (headTries++ < 12) setTimeout(function () { updateHeadFrom(res); }, 2500);
                return;
            }
            var c = res.data.w.current, k = wmo(c.weather_code)[1];
            headEl.html(icon(k, c.is_day === 1) + '<span>' + fmtT(c.temperature_2m) + '</span>');
        } catch (e) { dbg('head: ' + (e && e.message)); }
    }

    function updateHead(force) {
        if (!opt('weather_plus_head', true)) {
            if (headEl) { headEl.remove(); headEl = null; }
            return;
        }
        getData(!!force).then(updateHeadFrom).catch(function (e) { dbg('head load: ' + (e && e.message)); });
    }

    /* ------------------------------------------------------------------ */
    /*  Меню и настройки                                                   */
    /* ------------------------------------------------------------------ */

    var SVG_MENU = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.36 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"/></svg>';

    function addMenu() {
        if ($('.menu [data-action="weather_plus"]').length) return;
        var btn = $('<li class="menu__item selector" data-action="weather_plus">' +
            '<div class="menu__ico">' + SVG_MENU + '</div>' +
            '<div class="menu__text">Погода+</div></li>');
        btn.on('hover:enter', openPage);
        $('.menu .menu__list').eq(0).append(btn);
    }

    function settingsBack() {
        try { Lampa.Controller.toggle('settings_component'); } catch (e) { }
    }

    function onCityPicked() {
        syncCitySel();
        updateHead(true);
    }

    function onCitySetting(v) {
        if (v === undefined || v === null) v = Lampa.Storage.get('weather_plus_city_sel', 'auto');
        if (v === 'auto') {
            lsSet(LS.city, null); lsSet(LS.ip, null); lsSet(LS.cache, null);
            updateHead(true);
        } else if (v === 'search') {
            searchCity(settingsBack, onCityPicked);
        } else if (v === 'custom') {
            var sv = lsGet(LS.city, null);
            if (!sv || isPopular(sv)) searchCity(settingsBack, onCityPicked);
        } else if (/^p\d+$/.test(v)) {
            var p = POPULAR[+v.substring(1)];
            if (p) { saveCity({ name: p[0], lat: p[1], lon: p[2], tz: p[3] }); updateHead(true); }
        }
    }

    function isPopular(c) {
        for (var i = 0; i < POPULAR.length; i++) if (POPULAR[i][0] === c.name) return i;
        return false;
    }

    function syncCitySel() {
        try {
            var c = lsGet(LS.city, null), val = 'auto';
            if (c && c.lat) {
                var pi = isPopular(c);
                val = pi === false ? 'custom' : 'p' + pi;
            }
            Lampa.Storage.set('weather_plus_city_sel', val);
        } catch (e) { }
    }

    function addSettings() {
        try {
            if (!Lampa.SettingsApi) return;
            Lampa.SettingsApi.addComponent({ component: 'weather_plus', name: 'Погода+', icon: SVG_MENU });

            var cityValues = { auto: 'Автоматически (по IP)', search: 'Найти по названию…', custom: 'Свой город (из поиска)' };
            POPULAR.forEach(function (p, i) { cityValues['p' + i] = p[0]; });

            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_city_sel', type: 'select', values: cityValues, 'default': 'auto' },
                field: { name: 'Город', description: 'Выберите из списка или найдите свой через «Найти по названию…»' },
                onChange: onCitySetting
            });
            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_head', type: 'trigger', 'default': true },
                field: { name: 'Температура в шапке', description: 'Показывать погоду рядом с часами' },
                onChange: function () { updateHead(false); }
            });
            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_bgalpha', type: 'select', values: { '100': 'Нет', '85': 'Слабая', '70': 'Средняя', '55': 'Сильная', '40': 'Очень сильная' }, 'default': '70' },
                field: { name: 'Прозрачность фона', description: 'Насколько просвечивает фон Lampa. Применится при следующем открытии страницы' }
            });
            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_anim', type: 'trigger', 'default': true },
                field: { name: 'Анимация фона', description: 'Дождь, снег, звёзды. Отключите, если тормозит' }
            });
            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_wind', type: 'select', values: { ms: 'м/с', kmh: 'км/ч' }, 'default': 'ms' },
                field: { name: 'Скорость ветра', description: 'Единицы измерения' }
            });
            Lampa.SettingsApi.addParam({
                component: 'weather_plus',
                param: { name: 'weather_plus_press', type: 'select', values: { mm: 'мм рт. ст.', hpa: 'гПа' }, 'default': 'mm' },
                field: { name: 'Давление', description: 'Единицы измерения' }
            });
        } catch (e) { dbg('settings: ' + (e && e.message)); }
    }

    function init() {
        Lampa.Component.add('weather_plus', WeatherPage);
        injectStyle();
        addMenu();
        addSettings();
        setTimeout(function () { updateHead(false); }, 1500);
        setInterval(function () { updateHead(true); }, 15 * 60 * 1000);
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();

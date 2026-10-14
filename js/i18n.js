/*
 * Terjemahan antarmuka. Kunci yang sama untuk setiap bahasa;
 * {nama} di dalam teks diganti dengan nilai variabel.
 */
(function (root) {
  'use strict';

  const DICT = {
    id: {
      'locale': 'id-ID',
      'app.title': 'Peta Sholat',
      'app.subtitle': 'Garis waktu sholat yang menyapu bumi',
      'app.description': 'Garis-garis waktu sholat yang menyapu permukaan bumi.',
      'map.aria': 'Peta garis waktu sholat',
      'panel.collapse': 'Lipat panel',
      'lang.aria': 'Bahasa',

      'time.date': 'Tanggal',
      'time.now': 'Sekarang',
      'time.prevMonth': 'Bulan sebelumnya',
      'time.nextMonth': 'Bulan berikutnya',
      'time.slider': 'Jam dalam hari',
      'time.playPause': 'Putar/jeda',
      'time.play': '▶ Putar',
      'time.pause': '❚❚ Jeda',
      'time.speed': 'Kecepatan',
      'speed.1': 'Waktu nyata',
      'speed.60': '1 menit / detik',
      'speed.600': '10 menit / detik',
      'speed.3600': '1 jam / detik',
      'speed.14400': '4 jam / detik',
      'clock.utc': '{time} UTC · deklinasi matahari {dec}°',

      'calc.method': 'Metode',
      'calc.asr': 'Ashar',
      'asr.1': "Syafi'i, Maliki, Hanbali (bayangan 1×)",
      'asr.2': 'Hanafi (bayangan 2×)',
      'calc.highLat': 'Lintang tinggi',
      'calc.ihtiyat': 'Ihtiyat +2 menit',

      'method.kemenag': 'Kemenag RI',
      'method.jakim': 'JAKIM (Malaysia)',
      'method.mwl': 'Muslim World League',
      'method.isna': 'ISNA (Amerika Utara)',
      'method.egypt': 'Otoritas Survei Umum Mesir',
      'method.karachi': 'Univ. of Islamic Sciences, Karachi',
      'method.makkah': 'Umm al-Qura (Makkah)',

      'highLat.none': 'Tampilkan apa adanya',
      'highLat.aqrab': 'Aqrab al-bilad (rujukan lintang 45°)',
      'highLat.midnight': 'Tengah malam (Isya & Subuh)',
      'highLat.seventh': 'Sepertujuh malam (Isya & Subuh)',
      'highLat.angle': 'Berbasis sudut (Isya & Subuh)',

      'view.projection': 'Proyeksi',
      'view.globe': 'Globe',
      'view.flat': 'Peta datar',
      'view.zones': 'Warnai zona waktu',
      'view.showTerbit': 'Tampilkan garis Terbit',
      'view.lockSun': 'Kunci kamera ke matahari',
      'locate.button': '📍 Lokasi saya',
      'locate.searching': 'Mencari lokasi…',
      'locate.unsupported': 'Lokasi tidak didukung',
      'locate.unavailable': 'Lokasi tidak tersedia',
      'hint': 'Seret untuk memutar, gulir/cubit untuk zoom, klik titik mana saja untuk melihat jadwalnya.',

      'prayer.subuh': 'Subuh',
      'prayer.terbit': 'Terbit',
      'prayer.syuruq': 'Syuruq–Dhuha',
      'prayer.zuhur': 'Zuhur',
      'prayer.ashar': 'Ashar',
      'prayer.maghrib': 'Maghrib',
      'prayer.isya': 'Isya',

      'legend.subuh': 'Matahari {deg}° di bawah ufuk timur (fajar shadiq)',
      'legend.terbit': 'Matahari terbit, akhir waktu Subuh (garis putus-putus)',
      'legend.zuhur': 'Matahari melintasi meridian (tengah hari)',
      'legend.ashar': 'Bayangan = {k}× tinggi benda + bayangan saat Zuhur',
      'legend.maghrib': 'Matahari terbenam',
      'legend.isyaMinutes': '{min} menit setelah Maghrib',
      'legend.isyaAngle': 'Matahari {deg}° di bawah ufuk barat (syafaq hilang)',
      'legend.abnormal': 'Di luar siklus normal',
      'legend.abnormalDesc': 'Awal atau akhir waktu ini tidak terjadi hari ini (senja tak hilang, matahari tak terbit/terbenam).',
      'legend.note': 'Warna area = waktu sholat yang sedang berlangsung di sana. Area pucat setelah garis Terbit = Syuruq–Dhuha (bukan waktu sholat wajib).',
      'legend.ruleNone': 'Titik bulat di ujung garis = tempat peristiwa itu berhenti terjadi (lintang tinggi).',
      'legend.ruleOther': 'Garis putus-putus samar = waktu hasil aturan lintang tinggi ({rule}), bukan posisi matahari langsung. Titik bulat = ujung peristiwa astronomis.',

      'info.title': 'Titik terpilih',
      'info.close': 'Tutup',
      'info.syuruq': 'Di luar waktu sholat wajib (Syuruq–Dhuha)',
      'info.now': 'Sedang waktu <b>{prayer}</b>',
      'info.abnormal': '(di luar siklus normal)',
      'info.local': 'Lokal',
      'info.note': 'Jam ditampilkan menurut zona waktu perangkat Anda dan UTC.',
      'info.missing': '“—” berarti matahari tidak mencapai posisi tersebut hari ini (lintang tinggi).',
      'info.derived': '<sup>*</sup>Hasil aturan {rule}.',
      'coord.N': 'LU',
      'coord.S': 'LS',
      'coord.E': 'BT',
      'coord.W': 'BB',
    },

    en: {
      'locale': 'en-GB',
      'app.title': 'Prayer Map',
      'app.subtitle': 'Prayer-time lines sweeping across the Earth',
      'app.description': 'Prayer-time lines sweeping across the surface of the Earth.',
      'map.aria': 'Map of prayer-time lines',
      'panel.collapse': 'Collapse panel',
      'lang.aria': 'Language',

      'time.date': 'Date',
      'time.now': 'Now',
      'time.prevMonth': 'Previous month',
      'time.nextMonth': 'Next month',
      'time.slider': 'Time of day',
      'time.playPause': 'Play/pause',
      'time.play': '▶ Play',
      'time.pause': '❚❚ Pause',
      'time.speed': 'Speed',
      'speed.1': 'Real time',
      'speed.60': '1 minute / second',
      'speed.600': '10 minutes / second',
      'speed.3600': '1 hour / second',
      'speed.14400': '4 hours / second',
      'clock.utc': '{time} UTC · solar declination {dec}°',

      'calc.method': 'Method',
      'calc.asr': 'Asr',
      'asr.1': "Shafi'i, Maliki, Hanbali (shadow 1×)",
      'asr.2': 'Hanafi (shadow 2×)',
      'calc.highLat': 'High latitudes',
      'calc.ihtiyat': 'Ihtiyat +2 minutes',

      'method.kemenag': 'Kemenag (Indonesia)',
      'method.jakim': 'JAKIM (Malaysia)',
      'method.mwl': 'Muslim World League',
      'method.isna': 'ISNA (North America)',
      'method.egypt': 'Egyptian General Authority of Survey',
      'method.karachi': 'Univ. of Islamic Sciences, Karachi',
      'method.makkah': 'Umm al-Qura (Makkah)',

      'highLat.none': 'Show as is',
      'highLat.aqrab': 'Aqrab al-bilad (45° reference)',
      'highLat.midnight': 'Middle of the night (Isha & Fajr)',
      'highLat.seventh': 'One-seventh of the night (Isha & Fajr)',
      'highLat.angle': 'Angle-based (Isha & Fajr)',

      'view.projection': 'Projection',
      'view.globe': 'Globe',
      'view.flat': 'Flat map',
      'view.zones': 'Color prayer zones',
      'view.showTerbit': 'Show Sunrise line',
      'view.lockSun': 'Lock camera to the sun',
      'locate.button': '📍 My location',
      'locate.searching': 'Finding location…',
      'locate.unsupported': 'Location not supported',
      'locate.unavailable': 'Location unavailable',
      'hint': 'Drag to rotate, scroll/pinch to zoom, click anywhere to see its timetable.',

      'prayer.subuh': 'Fajr',
      'prayer.terbit': 'Sunrise',
      'prayer.syuruq': 'Shuruq–Duha',
      'prayer.zuhur': 'Dhuhr',
      'prayer.ashar': 'Asr',
      'prayer.maghrib': 'Maghrib',
      'prayer.isya': 'Isha',

      'legend.subuh': 'Sun {deg}° below the eastern horizon (true dawn)',
      'legend.terbit': 'Sunrise, end of Fajr time (dashed line)',
      'legend.zuhur': 'Sun crosses the meridian (solar noon)',
      'legend.ashar': 'Shadow = {k}× object height + noon shadow',
      'legend.maghrib': 'Sunset',
      'legend.isyaMinutes': '{min} minutes after Maghrib',
      'legend.isyaAngle': 'Sun {deg}° below the western horizon (twilight gone)',
      'legend.abnormal': 'Outside the normal cycle',
      'legend.abnormalDesc': 'This time does not start or end today (twilight persists, or the sun does not rise/set).',
      'legend.note': 'Area color = the prayer time currently in effect there. The pale area after the Sunrise line = Shuruq–Duha (not an obligatory prayer time).',
      'legend.ruleNone': 'Round dot at a line end = where that event stops occurring (high latitudes).',
      'legend.ruleOther': 'Faint dashed lines = times from the high-latitude rule ({rule}), not the actual sun position. Round dots = ends of the astronomical events.',

      'info.title': 'Selected point',
      'info.close': 'Close',
      'info.syuruq': 'Outside obligatory prayer times (Shuruq–Duha)',
      'info.now': 'Now: <b>{prayer}</b>',
      'info.abnormal': '(outside the normal cycle)',
      'info.local': 'Local',
      'info.note': 'Times are shown in your device time zone and UTC.',
      'info.missing': '“—” means the sun does not reach that position today (high latitude).',
      'info.derived': '<sup>*</sup>From the {rule} rule.',
      'coord.N': 'N',
      'coord.S': 'S',
      'coord.E': 'E',
      'coord.W': 'W',
    },
  };

  const LANGS = { id: 'ID', en: 'EN' };
  let lang = 'id';
  try {
    const saved = localStorage.getItem('peta-sholat.lang');
    if (saved && DICT[saved]) lang = saved;
  } catch (e) { /* penyimpanan tidak tersedia */ }

  function t(key, vars) {
    let s = DICT[lang][key];
    if (s === undefined) s = DICT.id[key] !== undefined ? DICT.id[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }

  function setLang(l) {
    if (!DICT[l]) return;
    lang = l;
    try { localStorage.setItem('peta-sholat.lang', l); } catch (e) { /* abaikan */ }
  }

  // Terapkan terjemahan ke elemen bertanda data-i18n / data-i18n-aria / data-i18n-title.
  function applyStatic(doc) {
    doc.documentElement.lang = lang;
    doc.title = t('app.title');
    const meta = doc.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('app.description'));
    doc.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    doc.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    doc.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
  }

  root.I18n = { t, setLang, applyStatic, LANGS, get lang() { return lang; } };
})(this);

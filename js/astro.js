/*
 * Astronomi waktu sholat.
 *
 * Ide dasarnya: semua waktu sholat ditentukan oleh "sudut jam lokal" (LHA)
 * matahari, yaitu seberapa jauh matahari dari meridian di suatu titik.
 *   LHA = GHA + bujur
 * GHA (Greenwich Hour Angle) hanya bergantung pada waktu. Jadi pada satu
 * instan t, sebuah waktu sholat yang jatuh pada sudut jam H(lintang) terjadi
 * di bujur = H(lintang) - GHA(t). Menyambung titik-titik itu untuk semua
 * lintang menghasilkan "garis sholat".
 */
(function (root) {
  'use strict';

  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const MIN_DEG = 0.25; // 1 menit waktu = 0,25 derajat rotasi bumi
  const SUNRISE_ALT = -0.833; // refraksi + semidiameter matahari

  function norm180(x) {
    return ((((x + 180) % 360) + 360) % 360) - 180;
  }

  // Posisi matahari (algoritme ringkas Astronomical Almanac, akurat ~1 menit).
  function sun(ms) {
    const n = ms / 86400000 + 2440587.5 - 2451545.0;
    const L = 280.46 + 0.9856474 * n;
    const g = (357.528 + 0.9856003 * n) * RAD;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
    const eps = (23.439 - 0.0000004 * n) * RAD;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * DEG;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * DEG;
    const gmst = 280.46061837 + 360.98564736629 * n;
    return {
      dec: dec,
      gha: norm180(gmst - ra),
      eot: norm180(L - ra) * 4, // equation of time, menit
    };
  }

  // Sudut jam (0..180) saat matahari berada pada ketinggian `alt`.
  // 0   => matahari tidak pernah mencapai ketinggian itu
  // 180 => matahari selalu di atas ketinggian itu
  function hourAngle(lat, dec, alt) {
    const f =
      (Math.sin(alt * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) /
      (Math.cos(lat * RAD) * Math.cos(dec * RAD));
    if (f >= 1) return 0;
    if (f <= -1) return 180;
    return Math.acos(f) * DEG;
  }

  // Ketinggian matahari saat bayangan = k x tinggi benda + bayangan tengah hari.
  function asrAltitude(lat, dec, k) {
    // Matahari tidak terbit di tengah hari (malam kutub): tidak ada bayangan, tidak ada Ashar.
    if (Math.abs(lat - dec) >= 90) return 90;
    return Math.atan(1 / (k + Math.tan(Math.abs(lat - dec) * RAD))) * DEG;
  }

  const METHODS = {
    kemenag: { name: 'Kemenag RI', fajr: 20, isha: 18, ihtiyat: 2 },
    jakim: { name: 'JAKIM (Malaysia)', fajr: 20, isha: 18, ihtiyat: 2 },
    mwl: { name: 'Muslim World League', fajr: 18, isha: 17, ihtiyat: 0 },
    isna: { name: 'ISNA (Amerika Utara)', fajr: 15, isha: 15, ihtiyat: 0 },
    egypt: { name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5, ihtiyat: 0 },
    karachi: { name: 'Univ. of Islamic Sciences, Karachi', fajr: 18, isha: 18, ihtiyat: 0 },
    makkah: { name: 'Umm al-Qura (Makkah)', fajr: 18.5, ishaMinutes: 90, ihtiyat: 0 },
  };

  const ok = (h) => h > 0 && h < 180;

  /*
   * Batas-batas waktu dalam LHA (derajat, -180..180) untuk satu lintang,
   * murni dari posisi matahari (tanpa aturan lintang tinggi).
   * cfg: { fajr, isha | ishaMinutes, asr (1 Syafi'i / 2 Hanafi), ihtiyat (menit) }
   * Nilai `has*` menandakan apakah peristiwa itu benar-benar terjadi
   * (di lintang tinggi bisa tidak terjadi).
   */
  function rawBoundaries(lat, dec, cfg) {
    const i = (cfg.ihtiyat || 0) * MIN_DEG;
    const hS = hourAngle(lat, dec, -cfg.fajr);
    const hR = hourAngle(lat, dec, SUNRISE_ALT);
    const hA = hourAngle(lat, dec, asrAltitude(lat, dec, cfg.asr));
    let I, hasI;
    if (cfg.ishaMinutes) {
      hasI = ok(hR) && hR + i + cfg.ishaMinutes * MIN_DEG < 180;
      I = ok(hR) ? Math.min(180, hR + i + cfg.ishaMinutes * MIN_DEG) : hR;
    } else {
      const hI = hourAngle(lat, dec, -cfg.isha);
      hasI = ok(hI);
      I = hasI ? hI + i : hI;
    }
    return {
      S: ok(hS) ? -hS + i : -hS, // mulai Subuh
      R: -hR, // terbit (akhir Subuh)
      Z: i, // Zuhur
      A: ok(hA) ? hA + i : hA, // Ashar
      M: ok(hR) ? hR + i : hR, // Maghrib
      I: I, // Isya
      hasS: ok(hS),
      hasR: ok(hR),
      hasA: ok(hA),
      hasM: ok(hR),
      hasI: hasI,
      // Penanda waktu hasil aturan lintang tinggi (bukan posisi matahari langsung).
      proxy: false, // aqrab al-bilad: memakai batas dari lintang lain
      adjS: false,
      adjA: false,
      adjI: false,
    };
  }

  const isNormal = (b) => b.hasS && b.hasR && b.hasA && b.hasM && b.hasI;

  /*
   * Aturan lintang tinggi:
   *   none     – apa adanya; waktu yang tidak terjadi dibiarkan kosong
   *   aqrab    – aqrab al-bilad: waktu yang tidak terjadi diambil dari lintang
   *              45° (belahan yang sama). Saat matahari tidak terbit/terbenam
   *              (malam/siang kutub), semua waktu diambil dari lintang 45°.
   *   midnight – Isya/Subuh paling jauh tengah malam
   *   seventh  – Isya/Subuh paling jauh 1/7 malam dari Maghrib/Terbit
   *   angle    – Isya/Subuh paling jauh (sudut/60) malam dari Maghrib/Terbit
   */
  const HIGH_LAT_RULES = {
    none: 'Tampilkan apa adanya',
    aqrab: 'Aqrab al-bilad (rujukan lintang 45°)',
    midnight: 'Tengah malam (Isya & Subuh)',
    seventh: 'Sepertujuh malam (Isya & Subuh)',
    angle: 'Berbasis sudut (Isya & Subuh)',
  };
  const AQRAB_LAT = 45;

  // Batas-batas waktu setelah aturan lintang tinggi diterapkan.
  function boundaries(lat, dec, cfg) {
    const rule = cfg.highLat || 'none';
    if (rule === 'aqrab') {
      const b = rawBoundaries(lat, dec, cfg);
      if (isNormal(b) || Math.abs(lat) <= AQRAB_LAT) return b;
      const r = rawBoundaries(lat >= 0 ? AQRAB_LAT : -AQRAB_LAT, dec, cfg);
      if (!b.hasR) {
        r.proxy = true;
        return r;
      }
      // Hanya waktu yang hilang yang diganti; urutan waktu tetap dijaga.
      if (!b.hasS) { b.S = Math.min(r.S, b.R); b.hasS = true; b.adjS = true; }
      if (!b.hasI) { b.I = Math.max(r.I, b.M); b.hasI = true; b.adjI = true; }
      if (!b.hasA) { b.A = Math.min(Math.max(r.A, b.Z), b.M); b.hasA = true; b.adjA = true; }
      return b;
    }
    const b = rawBoundaries(lat, dec, cfg);
    if (rule === 'none' || !b.hasR) return b;
    // Aturan pecahan malam butuh matahari terbit & terbenam.
    const hR = -b.R;
    const night = 360 - 2 * hR;
    const i = (cfg.ihtiyat || 0) * MIN_DEG;
    const pI = rule === 'midnight' ? 0.5 : rule === 'seventh' ? 1 / 7 : (cfg.isha || 18) / 60;
    const pS = rule === 'midnight' ? 0.5 : rule === 'seventh' ? 1 / 7 : cfg.fajr / 60;
    const maxI = Math.min(180, b.M + pI * night);
    if (!b.hasI || b.I > maxI) {
      b.I = maxI;
      b.hasI = true;
      b.adjI = true;
    }
    const minS = Math.max(-180, -hR - pS * night + i);
    if (!b.hasS || b.S < minS) {
      b.S = minS;
      b.hasS = true;
      b.adjS = true;
    }
    return b;
  }

  // Indeks zona: 0 Isya, 1 Subuh, 2 Syuruq/Dhuha, 3 Zuhur, 4 Ashar, 5 Maghrib
  const ZONES = ['isya', 'subuh', 'syuruq', 'zuhur', 'ashar', 'maghrib'];

  function zoneIndex(L, b) {
    if (L < b.S) return 0;
    if (L < b.R) return 1;
    if (L < b.Z) return 2;
    if (L < b.A) return 3;
    if (L < b.M) return 4;
    if (L < b.I) return 5;
    return 0;
  }

  // Zona dianggap "di luar siklus normal" bila peristiwa awal atau akhirnya
  // tidak terjadi (misalnya Maghrib yang tidak pernah diakhiri Isya).
  function abnormalMask(b) {
    let m = 0;
    if (!b.hasI || !b.hasS) m |= 1 << 0; // isya: I -> S
    if (!b.hasS || !b.hasR) m |= 1 << 1; // subuh: S -> R
    if (!b.hasR) m |= 1 << 2; // syuruq: R -> Z
    if (!b.hasA) m |= 1 << 3; // zuhur: Z -> A
    if (!b.hasA || !b.hasM) m |= 1 << 4; // ashar: A -> M
    if (!b.hasM || !b.hasI) m |= 1 << 5; // maghrib: M -> I
    return m;
  }

  function classify(lat, lon, ms, cfg) {
    const s = sun(ms);
    const b = boundaries(lat, s.dec, cfg);
    const z = zoneIndex(norm180(s.gha + lon), b);
    return { zone: ZONES[z], abnormal: (abnormalMask(b) & (1 << z)) !== 0 };
  }

  function zoneAt(lat, lon, ms, cfg) {
    return classify(lat, lon, ms, cfg).zone;
  }

  // Jadwal sholat satu hari (hari matahari lokal yang memuat instan `ms`).
  function schedule(lat, lon, ms, cfg) {
    const lonMs = lon * 240000; // 1 derajat bujur = 4 menit
    const dayStart = Math.floor((ms + lonMs) / 86400000) * 86400000 - lonMs;
    const noon = dayStart + 43200000;
    function solve(key, hasKey) {
      let t = noon;
      for (let k = 0; k < 5; k++) {
        const s = sun(t);
        const b = boundaries(lat, s.dec, cfg);
        if (hasKey && !b[hasKey]) return null;
        const d = norm180(b[key] - norm180(s.gha + lon));
        t += (d / 360.9856) * 86400000;
      }
      return t;
    }
    const bn = boundaries(lat, sun(noon).dec, cfg);
    return {
      subuh: solve('S', 'hasS'),
      terbit: solve('R', 'hasR'),
      zuhur: solve('Z', null),
      ashar: solve('A', 'hasA'),
      maghrib: solve('M', 'hasM'),
      isya: solve('I', 'hasI'),
      // Waktu mana saja yang berasal dari aturan lintang tinggi.
      derived: {
        subuh: bn.proxy || bn.adjS,
        terbit: bn.proxy,
        ashar: bn.proxy || bn.adjA,
        maghrib: bn.proxy,
        isya: bn.proxy || bn.adjI,
      },
    };
  }

  const api = {
    RAD, DEG, norm180, sun, hourAngle, asrAltitude, rawBoundaries, boundaries, isNormal,
    zoneIndex, abnormalMask, classify, zoneAt, schedule, METHODS, ZONES, HIGH_LAT_RULES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Astro = api;
})(this);

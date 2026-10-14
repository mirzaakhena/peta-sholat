(function () {
  'use strict';

  const A = window.Astro;
  const T = window.I18n;
  const t = T.t;
  const $ = (id) => document.getElementById(id);

  // ---------- Konfigurasi visual ----------
  const PRAYERS = {
    subuh: { line: '#a597ff', fill: [118, 100, 220, 110] },
    terbit: { line: '#ffe7a3', fill: null, dashed: true },
    syuruq: { line: '#ffe7a3', fill: [255, 231, 163, 26] },
    zuhur: { line: '#ffd34d', fill: [245, 190, 60, 95] },
    ashar: { line: '#ff9a3c', fill: [240, 125, 45, 100] },
    maghrib: { line: '#ff5c7a', fill: [214, 60, 95, 110] },
    isya: { line: '#6f8cff', fill: [30, 36, 120, 125] },
  };
  const label = (k) => t('prayer.' + k);
  // Urutan sesuai Astro.ZONES: isya, subuh, syuruq, zuhur, ashar, maghrib
  const ZONE_RGBA = new Uint32Array(
    A.ZONES.map((z) => {
      const [r, g, b, a] = PRAYERS[z].fill;
      return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    })
  );
  const LINES = [
    { key: 'subuh', b: 'S', has: 'hasS' },
    { key: 'terbit', b: 'R', has: 'hasR' },
    { key: 'zuhur', b: 'Z', has: null },
    { key: 'ashar', b: 'A', has: 'hasA' },
    { key: 'maghrib', b: 'M', has: 'hasM' },
    { key: 'isya', b: 'I', has: 'hasI' },
  ];

  // ---------- State ----------
  const S = {
    t: Date.now(),
    playing: true,
    speed: 1,
    method: 'kemenag',
    proj: 'globe',
    zones: true,
    showTerbit: true,
    lockSun: false,
    sunOffset: 0,
    rot: [-110, 5], // pusat tampilan: bujur 110 BT, lintang 5 LS
    panY: 0,
    zoom: 1,
    interacting: false,
    pin: null,
  };
  let dirty = true;
  let lastProj = null;

  // ---------- Data peta ----------
  const world = window.WORLD_110M;
  const land = topojson.feature(world, world.objects.land);
  const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
  const graticule = d3.geoGraticule10();
  const equator = { type: 'LineString', coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]] };

  // ---------- Canvas ----------
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const panel = $('panel');
  let W = 0, H = 0, DPR = 1, stars = null;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    stars = makeStars();
    dirty = true;
  }

  function makeStars() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(c.width * 0.6, c.height * 0.4, 0, c.width * 0.6, c.height * 0.4, Math.max(c.width, c.height));
    grad.addColorStop(0, '#0d1428');
    grad.addColorStop(1, '#04060d');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    const n = Math.round((c.width * c.height) / 9000);
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.5 + 0.1).toFixed(2)})`;
      const r = Math.random() * 1.1 * DPR;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, r, r);
    }
    return c;
  }

  function isMobile() {
    return W <= 720;
  }

  function viewBox() {
    // Area yang tidak tertutup panel.
    if (!isMobile()) {
      const left = panel.getBoundingClientRect().right + 8;
      return { x: left, y: 0, w: W - left, h: H };
    }
    const top = panel.getBoundingClientRect().top;
    return { x: 0, y: 0, w: W, h: top };
  }

  function makeProjection(rot0) {
    const v = viewBox();
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    if (S.proj === 'globe') {
      return d3.geoOrthographic()
        .clipAngle(90)
        .precision(0.3)
        .translate([cx, cy])
        .scale(Math.min(v.w, v.h) * 0.43 * S.zoom)
        .rotate([rot0, S.rot[1], 0]);
    }
    const scale = Math.min((v.w - 24) / (2 * Math.PI), (v.h - 24) / Math.PI) * S.zoom;
    const maxPan = Math.max(0, (Math.PI / 2) * scale - v.h / 2 + 12);
    S.panY = Math.max(-maxPan, Math.min(maxPan, S.panY));
    return d3.geoEquirectangular()
      .precision(0.3)
      .translate([cx, cy + S.panY])
      .scale(scale)
      .rotate([rot0, 0, 0]);
  }

  function insideMap(proj, px, py) {
    const [tx, ty] = proj.translate(), sc = proj.scale();
    if (S.proj === 'globe') return (px - tx) ** 2 + (py - ty) ** 2 <= sc * sc;
    return Math.abs(px - tx) <= Math.PI * sc && Math.abs(py - ty) <= (Math.PI / 2) * sc;
  }

  // ---------- Raster zona ----------
  // Grid lintang/bujur per piksel dihitung dengan rotasi bujur = 0, sehingga
  // memutar globe ke kiri/kanan (atau animasi waktu) tidak perlu menghitung ulang.
  const grid = { key: '', w: 0, h: 0, lon: null, lat: null, cvs: document.createElement('canvas'), img: null, u32: null };

  function ensureGrid(rs) {
    const base = makeProjection(0);
    const key = [S.proj, S.rot[1].toFixed(3), base.scale().toFixed(3), base.translate().map((v) => v.toFixed(1)).join(), W, H, rs].join('|');
    if (key === grid.key) return;
    const w = Math.ceil(W * rs), h = Math.ceil(H * rs);
    const lon = new Float32Array(w * h), lat = new Float32Array(w * h);
    for (let y = 0, i = 0; y < h; y++) {
      const py = (y + 0.5) / rs;
      for (let x = 0; x < w; x++, i++) {
        const px = (x + 0.5) / rs;
        if (!insideMap(base, px, py)) { lon[i] = NaN; continue; }
        const p = base.invert([px, py]);
        if (!p || !isFinite(p[0])) { lon[i] = NaN; continue; }
        lon[i] = p[0];
        lat[i] = p[1];
      }
    }
    grid.cvs.width = w;
    grid.cvs.height = h;
    grid.img = grid.cvs.getContext('2d').createImageData(w, h);
    grid.u32 = new Uint32Array(grid.img.data.buffer);
    Object.assign(grid, { key, w, h, lon, lat });
  }

  const ROWS = 721; // lintang per 0,25 derajat
  const TB = { S: new Float32Array(ROWS), R: new Float32Array(ROWS), Z: new Float32Array(ROWS), A: new Float32Array(ROWS), M: new Float32Array(ROWS), I: new Float32Array(ROWS), ab: new Uint8Array(ROWS) };
  // Arsiran diagonal untuk zona di luar siklus normal.
  const HATCH_ON = ((150 << 24) | (205 << 16) | (180 << 8) | 165) >>> 0;
  const HATCH_OFF = ((40 << 24) | (205 << 16) | (180 << 8) | 165) >>> 0;

  function drawZones(proj, path, sun, cfg) {
    const rs = S.interacting ? 0.25 : 0.5;
    ensureGrid(rs);
    for (let r = 0; r < ROWS; r++) {
      const lat = Math.max(-89.9, Math.min(89.9, -90 + r * 0.25));
      const b = A.boundaries(lat, sun.dec, cfg);
      TB.S[r] = b.S; TB.R[r] = b.R; TB.Z[r] = b.Z; TB.A[r] = b.A; TB.M[r] = b.M; TB.I[r] = b.I;
      TB.ab[r] = A.abnormalMask(b);
    }
    const { lon, lat, u32, w } = grid;
    const off = sun.gha - S.rot[0];
    const hatchPeriod = Math.max(4, Math.round(16 * (S.interacting ? 0.25 : 0.5)));
    for (let i = 0; i < u32.length; i++) {
      const lo = lon[i];
      if (lo !== lo) { u32[i] = 0; continue; }
      let L = off + lo;
      L -= 360 * Math.floor((L + 180) / 360);
      const r = ((lat[i] + 90) * 4 + 0.5) | 0;
      let z;
      if (L < TB.S[r]) z = 0;
      else if (L < TB.R[r]) z = 1;
      else if (L < TB.Z[r]) z = 2;
      else if (L < TB.A[r]) z = 3;
      else if (L < TB.M[r]) z = 4;
      else if (L < TB.I[r]) z = 5;
      else z = 0;
      if (TB.ab[r] & (1 << z)) {
        const x = i % w, y = (i / w) | 0;
        u32[i] = (x + y) % hatchPeriod < hatchPeriod * 0.35 ? HATCH_ON : HATCH_OFF;
      } else u32[i] = ZONE_RGBA[z];
    }
    grid.cvs.getContext('2d').putImageData(grid.img, 0, 0);
    ctx.save();
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(grid.cvs, 0, 0, W, H);
    ctx.restore();
  }

  // ---------- Garis sholat ----------
  // Apakah posisi garis berasal dari aturan lintang tinggi.
  const DERIVED = {
    subuh: (b) => b.proxy || b.adjS,
    terbit: (b) => b.proxy,
    zuhur: () => false,
    ashar: (b) => b.proxy || b.adjA,
    maghrib: (b) => b.proxy,
    isya: (b) => b.proxy || b.adjI,
  };
  const lineState = (v) => (v === null ? 0 : v.d ? 2 : 1);

  /*
   * Setiap garis dipecah menjadi segmen: {pts, derived, startEnd, endEnd}.
   * startEnd/endEnd = ujung segmen adalah titik tempat peristiwa sholat itu
   * berhenti terjadi secara astronomis (diberi penanda bulat di peta).
   */
  function buildLines(sun, cfg) {
    const out = {};
    for (const l of LINES) {
      const f = (lat) => {
        const b = A.boundaries(lat, sun.dec, cfg);
        if (l.has && !b[l.has]) return null;
        return { lon: A.norm180(b[l.b] - sun.gha), d: DERIVED[l.key](b) };
      };
      const lonOf = (lat) => { const v = f(lat); return v ? v.lon : null; };
      const segs = [];
      let cur = null;
      let prevLat = null, prevV = null;
      for (let lat = -89.5; lat <= 89.5001; lat += 0.5) {
        const v = f(lat);
        if (prevLat !== null && lineState(v) !== lineState(prevV)) {
          // Cari lintang peralihan dengan bisection.
          let la = prevLat, lb = lat;
          const sa = lineState(prevV);
          for (let k = 0; k < 16; k++) {
            const mid = (la + lb) / 2;
            if (lineState(f(mid)) === sa) la = mid;
            else lb = mid;
          }
          if (cur) {
            const e = [f(la).lon, la];
            refine(lonOf, cur.pts[cur.pts.length - 1], e, cur.pts, 0);
            cur.pts.push(e);
            cur.endEnd = !cur.derived;
            if (cur.pts.length > 1) segs.push(cur);
            cur = null;
          }
          if (v) {
            const e = f(lb);
            cur = { pts: [[e.lon, lb]], derived: v.d, startEnd: !v.d, endEnd: false };
          }
        } else if (!cur && v) {
          cur = { pts: [], derived: v.d, startEnd: false, endEnd: false };
        }
        if (v) {
          const p = [v.lon, lat];
          if (cur.pts.length) refine(lonOf, cur.pts[cur.pts.length - 1], p, cur.pts, 0);
          cur.pts.push(p);
        }
        prevLat = lat;
        prevV = v;
      }
      if (cur && cur.pts.length > 1) segs.push(cur);
      out[l.key] = segs;
    }
    return out;
  }

  // Sisipkan titik antara a dan b bila bujurnya berselisih jauh, agar garis
  // tidak digambar sebagai busur lingkaran besar yang menyimpang.
  function refine(f, a, b, seg, depth) {
    if (depth >= 10 || Math.abs(A.norm180(b[0] - a[0])) <= 1.5) return;
    const lat = (a[1] + b[1]) / 2;
    const lon = f(lat);
    if (lon === null) return;
    const m = [lon, lat];
    refine(f, a, m, seg, depth + 1);
    seg.push(m);
    refine(f, m, b, seg, depth + 1);
  }

  function onFrontSide(proj, pt) {
    if (S.proj !== 'globe') return true;
    const r = proj.rotate();
    return d3.geoDistance(pt, [-r[0], -r[1]]) < Math.PI / 2;
  }

  function visiblePoint(proj, pt, padRight) {
    if (S.proj === 'globe') {
      const r = proj.rotate();
      if (d3.geoDistance(pt, [-r[0], -r[1]]) > 1.35) return null;
    }
    const p = proj(pt);
    if (!p || p[0] < 8 || p[1] < 8 || p[0] > W - 8 - (padRight || 0) || p[1] > H - 8) return null;
    const v = viewBox();
    if (p[0] < v.x || p[1] > v.y + v.h) return null;
    if (S.proj === 'flat' && !insideMap(proj, p[0] + (padRight || 0), p[1])) return null;
    return p;
  }

  function drawLines(proj, path, lines) {
    const shown = LINES.filter((l) => l.key !== 'terbit' || S.showTerbit);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const l of shown) {
      const st = PRAYERS[l.key];
      for (const derived of [false, true]) {
        const coords = lines[l.key].filter((g) => g.derived === derived).map((g) => g.pts);
        if (!coords.length) continue;
        ctx.beginPath();
        path({ type: 'MultiLineString', coordinates: coords });
        ctx.setLineDash([]);
        ctx.globalAlpha = derived ? 0.6 : 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = st.dashed ? 3 : 4.5;
        ctx.stroke();
        ctx.globalAlpha = derived ? 0.85 : 1;
        ctx.setLineDash(derived ? (st.dashed ? [1, 6] : [8, 6]) : st.dashed ? [5, 5] : []);
        ctx.strokeStyle = st.line;
        ctx.lineWidth = st.dashed ? 1.4 : 2.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.setLineDash([]);

    // Penanda ujung: di sini peristiwa sholat berhenti terjadi secara astronomis.
    for (const l of shown) {
      for (const g of lines[l.key]) {
        const ends = [];
        if (g.startEnd) ends.push(g.pts[0]);
        if (g.endEnd) ends.push(g.pts[g.pts.length - 1]);
        for (const pt of ends) {
          if (!onFrontSide(proj, pt)) continue;
          const p = proj(pt);
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4, 0, 2 * Math.PI);
          ctx.fillStyle = PRAYERS[l.key].line;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Label: titik garis yang terlihat, sedekat mungkin dengan lintang pusat tampilan.
    const centerLat = S.proj === 'globe' ? -S.rot[1] : 0;
    const placed = [];
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    for (const l of shown) {
      const pts = lines[l.key].flatMap((g) => g.pts).sort((a, b) => Math.abs(a[1] - centerLat) - Math.abs(b[1] - centerLat));
      const lw = ctx.measureText(label(l.key)).width + 22;
      let p = null;
      for (const pt of pts) {
        const q = visiblePoint(proj, pt, lw);
        if (!q) continue;
        if (placed.some((o) => Math.abs(o[0] - q[0]) < 70 && Math.abs(o[1] - q[1]) < 22)) continue;
        p = q;
        break;
      }
      if (!p) continue;
      placed.push(p);
      const text = label(l.key);
      const tw = ctx.measureText(text).width;
      const x = p[0] + 7, y = p[1] - 9;
      ctx.fillStyle = 'rgba(8,12,24,0.82)';
      roundRect(x, y, tw + 12, 18, 9);
      ctx.fill();
      ctx.strokeStyle = PRAYERS[l.key].line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = PRAYERS[l.key].line;
      ctx.fillText(text, x + 6, y + 13);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSun(proj, sun) {
    const pt = [A.norm180(-sun.gha), sun.dec];
    if (S.proj === 'globe') {
      const r = proj.rotate();
      if (d3.geoDistance(pt, [-r[0], -r[1]]) > Math.PI / 2) return;
    }
    const p = proj(pt);
    if (!p) return;
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 26);
    g.addColorStop(0, 'rgba(255,240,180,0.9)');
    g.addColorStop(0.35, 'rgba(255,210,90,0.45)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 26, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff6d6';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  function drawPin(proj) {
    if (!S.pin) return;
    const pt = [S.pin.lon, S.pin.lat];
    if (S.proj === 'globe') {
      const r = proj.rotate();
      if (d3.geoDistance(pt, [-r[0], -r[1]]) > Math.PI / 2) return;
    }
    const p = proj(pt);
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 7, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---------- Render ----------
  function getCfg() {
    return Object.assign({}, A.METHODS[S.method], {
      asr: +$('asr').value,
      ihtiyat: $('ihtiyat').checked ? 2 : 0,
      highLat: $('highLat').value,
    });
  }

  function render() {
    const sun = A.sun(S.t);
    const cfg = getCfg();
    if (S.lockSun) S.rot[0] = A.norm180(sun.gha + S.sunOffset);
    const proj = makeProjection(S.rot[0]);
    lastProj = proj;
    const path = d3.geoPath(proj, ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stars, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (S.proj === 'globe') {
      const [tx, ty] = proj.translate(), sc = proj.scale();
      const glow = ctx.createRadialGradient(tx, ty, sc * 0.95, tx, ty, sc * 1.12);
      glow.addColorStop(0, 'rgba(90,140,255,0.35)');
      glow.addColorStop(1, 'rgba(90,140,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tx, ty, sc * 1.12, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = '#0c1a36';
    ctx.fill();

    ctx.beginPath();
    path(land);
    ctx.fillStyle = '#2b3a55';
    ctx.fill();

    if (S.zones) drawZones(proj, path, sun, cfg);

    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.beginPath();
    path(equator);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();

    ctx.beginPath();
    path(borders);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.strokeStyle = 'rgba(160,190,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawLines(proj, path, buildLines(sun, cfg));
    drawSun(proj, sun);
    drawPin(proj);

    updateClock(sun);
    updateInfo(cfg);
  }

  // ---------- UI: jam & kontrol ----------
  let fmtTime, fmtDate, fmtTz, fmtHM, fmtHMutc;
  function makeFormatters() {
    const loc = t('locale');
    fmtTime = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    fmtDate = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    fmtTz = new Intl.DateTimeFormat(loc, { timeZoneName: 'short' });
    fmtHM = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
    fmtHMutc = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  }
  makeFormatters();

  function tzName(ms) {
    const part = fmtTz.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName');
    return part ? part.value : '';
  }

  function localMidnight(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function ymd(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  let sliderActive = false;
  function updateClock(sun) {
    const d = new Date(S.t);
    $('timeLocal').textContent = `${fmtTime.format(d)} ${tzName(S.t)}`;
    $('dateLocal').textContent = fmtDate.format(d);
    $('timeUtc').textContent = t('clock.utc', { time: fmtHMutc.format(d), dec: sun.dec.toFixed(2) });
    if (!sliderActive) $('slider').value = Math.floor((S.t - localMidnight(S.t)) / 60000);
    if (document.activeElement !== $('date')) $('date').value = ymd(S.t);
  }

  function setPlaying(p) {
    S.playing = p;
    $('playBtn').textContent = p ? t('time.pause') : t('time.play');
  }

  function buildLegend() {
    const m = A.METHODS[S.method];
    const asr = +$('asr').value;
    const items = [
      ['subuh', t('legend.subuh', { deg: m.fajr })],
      ['terbit', t('legend.terbit')],
      ['zuhur', t('legend.zuhur')],
      ['ashar', t('legend.ashar', { k: asr })],
      ['maghrib', t('legend.maghrib')],
      ['isya', m.ishaMinutes ? t('legend.isyaMinutes', { min: m.ishaMinutes }) : t('legend.isyaAngle', { deg: m.isha })],
    ];
    const html = items.map(([k, desc]) => {
      const p = PRAYERS[k];
      const fill = k === 'terbit' ? PRAYERS.syuruq.fill : p.fill;
      const bg = `rgba(${fill[0]},${fill[1]},${fill[2]},${Math.max(0.25, fill[3] / 255).toFixed(2)})`;
      return `<div class="item"><span class="sw${p.dashed ? ' dashed' : ''}" style="background:${bg};--line:${p.line}"></span>` +
        `<div><b style="color:${p.line}">${label(k)}</b><div class="desc">${desc}</div></div></div>`;
    }).join('');
    const rule = $('highLat').value;
    const ruleNote = rule === 'none'
      ? t('legend.ruleNone')
      : t('legend.ruleOther', { rule: t('highLat.' + rule) });
    $('legend').innerHTML = html +
      `<div class="item"><span class="sw hatch"></span><div><b>${t('legend.abnormal')}</b>` +
      `<div class="desc">${t('legend.abnormalDesc')}</div></div></div>` +
      `<div class="desc small muted">${t('legend.note')} ${ruleNote}</div>`;
  }

  // ---------- Panel info titik ----------
  const info = $('info');
  info.innerHTML = '<div class="top"><b data-i18n="info.title"></b><button class="close" data-i18n-aria="info.close">×</button></div><div class="content"></div>';
  info.querySelector('.close').addEventListener('click', () => { S.pin = null; info.hidden = true; dirty = true; });
  const infoContent = info.querySelector('.content');

  function fmtCoord(lat, lon) {
    return `${Math.abs(lat).toFixed(2)}° ${t(lat >= 0 ? 'coord.N' : 'coord.S')}, ${Math.abs(lon).toFixed(2)}° ${t(lon >= 0 ? 'coord.E' : 'coord.W')}`;
  }

  function updateInfo(cfg) {
    if (!S.pin) { info.hidden = true; return; }
    info.hidden = false;
    const { lat, lon } = S.pin;
    const { zone, abnormal } = A.classify(lat, lon, S.t, cfg);
    const sch = A.schedule(lat, lon, S.t, cfg);
    const curRow = zone === 'syuruq' ? 'terbit' : zone;
    let status = zone === 'syuruq'
      ? t('info.syuruq')
      : t('info.now', { prayer: label(zone) });
    if (abnormal) status += ` <span class="muted">${t('info.abnormal')}</span>`;
    const rows = ['subuh', 'terbit', 'zuhur', 'ashar', 'maghrib', 'isya'].map((k) => {
      const t = sch[k];
      const a = t ? fmtHM.format(new Date(t)) : '—';
      const b = t ? fmtHMutc.format(new Date(t)) : '—';
      const mark = t && sch.derived[k] ? '<sup>*</sup>' : '';
      return `<tr class="${k === curRow ? 'cur' : ''}"><td>${label(k)}${mark}</td><td>${a}</td><td>${b}</td></tr>`;
    }).join('');
    const missing = !sch.subuh || !sch.isya || !sch.ashar || !sch.maghrib;
    const anyDerived = Object.keys(sch.derived).some((k) => sch.derived[k] && sch[k]);
    infoContent.innerHTML =
      `<div class="coord">${fmtCoord(lat, lon)}</div>` +
      `<div class="now"><span class="dot" style="background:${PRAYERS[zone].line}"></span><span>${status}</span></div>` +
      `<table><tr><th></th><th>${tzName(S.t) || t('info.local')}</th><th>UTC</th></tr>${rows}</table>` +
      `<div class="note">${t('info.note')}${missing ? ' ' + t('info.missing') : ''}${anyDerived ? ' ' + t('info.derived', { rule: t('highLat.' + cfg.highLat) }) : ''}</div>`;
  }

  // ---------- Interaksi ----------
  let prevT = null;
  const zoom = d3.zoom()
    .scaleExtent([0.6, 14])
    .clickDistance(5)
    .on('start', (ev) => { prevT = ev.transform; S.interacting = true; })
    .on('zoom', (ev) => {
      const t = ev.transform;
      if (prevT && t.k === prevT.k && lastProj) {
        const k = 180 / Math.PI / lastProj.scale();
        const dx = (t.x - prevT.x) * k, dy = (t.y - prevT.y) * k;
        if (S.lockSun) S.sunOffset += dx;
        else S.rot[0] += dx;
        if (S.proj === 'globe') S.rot[1] = Math.max(-89, Math.min(89, S.rot[1] - dy));
        else S.panY += t.y - prevT.y;
      }
      S.zoom = t.k;
      prevT = t;
      dirty = true;
    })
    .on('end', () => { S.interacting = false; dirty = true; });
  d3.select(canvas).call(zoom).on('dblclick.zoom', null);

  canvas.addEventListener('click', (e) => {
    if (!lastProj || !insideMap(lastProj, e.clientX, e.clientY)) return;
    const p = lastProj.invert([e.clientX, e.clientY]);
    if (!p || !isFinite(p[0])) return;
    S.pin = { lat: p[1], lon: A.norm180(p[0]) };
    dirty = true;
  });

  const methodSel = $('method');
  const highLatSel = $('highLat');
  function fillSelects() {
    const hl = highLatSel.value || 'none';
    methodSel.innerHTML = Object.keys(A.METHODS).map((k) => `<option value="${k}">${t('method.' + k)}</option>`).join('');
    methodSel.value = S.method;
    highLatSel.innerHTML = Object.keys(A.HIGH_LAT_RULES).map((k) => `<option value="${k}">${t('highLat.' + k)}</option>`).join('');
    highLatSel.value = hl;
  }
  fillSelects();
  $('ihtiyat').checked = A.METHODS[S.method].ihtiyat > 0;
  methodSel.addEventListener('change', () => {
    S.method = methodSel.value;
    $('ihtiyat').checked = A.METHODS[S.method].ihtiyat > 0;
    buildLegend();
    dirty = true;
  });
  $('asr').addEventListener('change', () => { buildLegend(); dirty = true; });
  highLatSel.addEventListener('change', () => { buildLegend(); dirty = true; });
  $('ihtiyat').addEventListener('change', () => { dirty = true; });
  $('zones').addEventListener('change', (e) => { S.zones = e.target.checked; dirty = true; });
  $('showTerbit').addEventListener('change', (e) => { S.showTerbit = e.target.checked; dirty = true; });
  $('lockSun').addEventListener('change', (e) => {
    S.lockSun = e.target.checked;
    if (S.lockSun) S.sunOffset = A.norm180(S.rot[0] - A.sun(S.t).gha);
    dirty = true;
  });

  document.querySelectorAll('#projSwitch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      S.proj = btn.dataset.proj;
      document.querySelectorAll('#projSwitch button').forEach((b) => b.classList.toggle('on', b === btn));
      S.panY = 0;
      S.zoom = 1;
      d3.select(canvas).call(zoom.transform, d3.zoomIdentity);
      dirty = true;
    });
  });

  $('playBtn').addEventListener('click', () => setPlaying(!S.playing));
  $('speed').addEventListener('change', (e) => { S.speed = +e.target.value; setPlaying(true); });
  // Pindah ke tanggal yang sama di bulan lain, jam tetap. Tanggal 31 Januari
  // menjadi 28/29 Februari, dst.
  function shiftMonth(delta) {
    const d = new Date(S.t);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    S.t = d.getTime();
    dirty = true;
  }
  $('prevMonth').addEventListener('click', () => shiftMonth(-1));
  $('nextMonth').addEventListener('click', () => shiftMonth(1));

  $('nowBtn').addEventListener('click', () => {
    S.t = Date.now();
    S.speed = 1;
    $('speed').value = '1';
    setPlaying(true);
    dirty = true;
  });

  const slider = $('slider');
  slider.addEventListener('pointerdown', () => { sliderActive = true; });
  slider.addEventListener('pointerup', () => { sliderActive = false; });
  slider.addEventListener('input', () => {
    setPlaying(false);
    S.t = localMidnight(S.t) + slider.value * 60000;
    dirty = true;
  });

  $('date').addEventListener('change', (e) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (!y) return;
    const tod = S.t - localMidnight(S.t);
    S.t = new Date(y, m - 1, d).getTime() + tod;
    dirty = true;
  });

  $('locate').addEventListener('click', () => {
    const btn = $('locate');
    if (!navigator.geolocation) { btn.textContent = t('locate.unsupported'); return; }
    btn.textContent = t('locate.searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        S.pin = { lat, lon };
        S.lockSun = false;
        $('lockSun').checked = false;
        S.rot = [-lon, S.proj === 'globe' ? -lat : 0];
        btn.textContent = t('locate.button');
        dirty = true;
      },
      () => { btn.textContent = t('locate.unavailable'); setTimeout(() => { btn.textContent = t('locate.button'); }, 2500); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });

  function applyLang() {
    T.applyStatic(document);
    document.querySelectorAll('#langSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.lang === T.lang));
    makeFormatters();
    fillSelects();
    setPlaying(S.playing);
    buildLegend();
    dirty = true;
  }
  document.querySelectorAll('#langSwitch button').forEach((btn) => {
    btn.addEventListener('click', () => { T.setLang(btn.dataset.lang); applyLang(); });
  });

  $('togglePanel').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    dirty = true;
  });

  window.addEventListener('resize', resize);

  // ---------- Loop ----------
  let lastFrame = performance.now();
  let lastDrawnT = null;
  function frame(now) {
    const dt = Math.min(now - lastFrame, 250);
    lastFrame = now;
    if (S.playing) S.t += dt * S.speed;
    // Waktu nyata cukup digambar ulang sekali per detik.
    const minStep = S.speed === 1 ? 1000 : 0;
    if (dirty || lastDrawnT === null || Math.abs(S.t - lastDrawnT) > minStep) {
      render();
      lastDrawnT = S.t;
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  resize();
  applyLang();
  requestAnimationFrame(frame);
})();

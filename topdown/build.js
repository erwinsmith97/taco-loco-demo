/* "Build a taco" — pinned scroll animation at the top of the page.
   Adapted from the Harborline demo (clients/demo-construction/site/build.js).
   One sticky stage. Scroll progress drives a timeline of moves and holds; each hold is a stop with its
   own words. The canvas draws WebP frames (frames/desktop or frames/mobile, one frame per file), always
   the nearest one already loaded, so it is never blank. The first frame is a normal <img> in the HTML,
   so the first screen never waits for this script. */
(() => {
  const root = document.querySelector('[data-build]');
  if (!root) return;

  const COUNT = +root.dataset.count || 121;   // frames per set (Seedance 2.0 clip, 5 s at 24 per second); a test page can set its own
  const STOPS = root.dataset.stopFrames ? root.dataset.stopFrames.split(",").map(Number) : [0, 46, 80, 112, 120];     // tortilla, meat in, pico + cheese in, salsa on, finished: matches the .beat blocks
  const HOLD = 1.1;                        // scroll weight of a pause at each stop
  const CREEP = 2;                         // frames the picture still drifts during a pause, so it never halts dead
  const MOVE = 1 / 9;                      // scroll weight per frame of movement
  const FOLLOW = 16;                       // how fast the picture catches up with the scroll (per second)

  const canvas = root.querySelector('.build__canvas');
  const ctx = canvas.getContext('2d');
  const beats = [...root.querySelectorAll('.beat')];
  const bar = root.querySelector('.build__progress span');
  const hint = root.querySelector('.build__hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  if (reduce || saveData) {                // finished taco, all words, no animation
    root.classList.add('is-static');
    return;
  }

  /* ---------- timeline: hold, move, hold, move ... hold ---------- */
  const segs = [];
  const holdSpan = (i) => {
    const f = STOPS[i];
    if (i === 0) return [f, f + CREEP];
    if (i === STOPS.length - 1) return [f - CREEP, f];
    return [f - CREEP / 2, f + CREEP / 2];
  };
  STOPS.forEach((_, i) => {
    const [a, b] = holdSpan(i);
    segs.push({ from: a, to: b, w: HOLD, stop: i });
    if (i < STOPS.length - 1) { const n = holdSpan(i + 1)[0]; segs.push({ from: b, to: n, w: (n - b) * MOVE }); }
  });
  const total = segs.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  segs.forEach((s) => { s.start = acc / total; acc += s.w; s.end = acc / total; });
  function locate(p) {
    const s = segs.find((x) => p <= x.end) || segs[segs.length - 1];
    const t = s.end > s.start ? (p - s.start) / (s.end - s.start) : 0;
    return s.from + (s.to - s.from) * Math.min(1, Math.max(0, t));
  }
  const stopAt = STOPS.map((_, i) => { const s = segs.find((x) => x.stop === i); return (s.start + s.end) / 2; });
  root.dataset.stops = stopAt.map((x) => x.toFixed(4)).join(',');   // read by the test script

  /* ---------- frames ---------- */
  const phone = matchMedia('(max-width: 720px), (orientation: portrait)');   // upright tablets use the phone layout too
  let set = phone.matches ? 'mobile' : 'desktop';
  const imgs = { desktop: [], mobile: [] };
  const DIR = root.dataset.frames || "frames";   // folder holding desktop/ and mobile/
  const src = (i) => `${DIR}/${set}/f${String(i + 1).padStart(3, '0')}.webp`;
  function load(i, priority) {
    const list = imgs[set];
    if (list[i]) return;
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) img.fetchPriority = priority;
    img.onload = () => { img.ready = true; if (Math.abs(i - current) < 8) draw(true); };
    img.src = src(i); img.index = i;
    list[i] = img;
  }
  const frame = (i) => { const img = i >= 0 && i < COUNT && imgs[set][i]; return img && img.ready ? img : null; };
  let restStarted = false;
  function loadFirst() {                    // pass 1: the stops and one frame in 12
    STOPS.forEach((i) => load(i, 'high'));
    for (let i = 0; i < COUNT; i += 12) load(i, 'high');
  }
  function loadAll() {
    loadFirst();
    if (restStarted) return;
    restStarted = true;
    let i = 0;
    const next = () => {                    // pass 2: the rest, a few at a time
      for (let n = 0; n < 6 && i < COUNT; i++) { if (!imgs[set][i]) { load(i, 'low'); n++; } }
      if (i < COUNT) setTimeout(next, 40);
    };
    next();
  }
  function nearestReady(f) {
    for (let d = 0; d < COUNT; d++) { const a = frame(f - d) || frame(f + d); if (a) return a; }
    return null;
  }

  /* ---------- drawing ---------- */
  let current = 0, target = 0, drawn = -1, w = 0, h = 0;
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn = -1; draw(true);
  }
  // Phone: the square frames already have the whole taco centred (made from the clip by following it), so
  // they just fill the box. Desktop: the frame follows the taco too: the food's centre (CX, measured per
  // frame; the taco slides right in the clip) is kept in the middle of the space right of the words.
  const BG = '#120d09';
  const CX = [0.51, 0.51, 0.511, 0.512, 0.514, 0.516, 0.518, 0.521, 0.525, 0.529, 0.533, 0.538, 0.544, 0.549,
    0.555, 0.561, 0.567, 0.573, 0.578, 0.584, 0.589, 0.593, 0.597, 0.601, 0.605, 0.608, 0.61, 0.613, 0.615,
    0.617, 0.619, 0.621, 0.622, 0.624, 0.625, 0.627, 0.628, 0.629, 0.63, 0.631, 0.632, 0.633, 0.633, 0.634,
    0.635, 0.635, 0.636, 0.636, 0.636];       // frames after these stay at 0.637
  const follow = root.dataset.follow !== "off";   // a clip whose food stays put sets data-follow="off"
  const cxAt = (f) => (!follow ? 0.5 : f < CX.length ? CX[f] : 0.637);
  function paint(img, f) {
    const fw = img.naturalWidth, fh = img.naturalHeight;
    if (set === 'mobile') {
      const s = Math.max(w / fw, h / fh);
      ctx.drawImage(img, (w - fw * s) / 2, (h - fh * s) / 2, fw * s, fh * s);
      return;
    }
    // L = right edge of the words column (same sums as .build__beats in styles.css). The food reaches at
    // most 31% of the frame's width either side of its centre (tortilla at the start, lime at the end).
    const L = Math.max(24, w * 0.06) + Math.min(520, w * 0.42) + 16;
    const mid = (L + w) / 2;
    const dw = Math.min((h * 0.86 / fh) * fw, ((w - L) / 2 - 24) / 0.31), s = dw / fw, dh = fh * s;
    const dx = mid - cxAt(f) * dw, dy = (h - dh) / 2 + 16;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
    const fade = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, BG); g.addColorStop(1, 'rgba(18,13,9,0)'); return g; };
    ctx.fillStyle = fade(dx, 0, dx + dw * 0.18, 0); ctx.fillRect(dx, 0, dw * 0.18, h);
    ctx.fillStyle = fade(0, dy, 0, dy + dh * 0.12); ctx.fillRect(0, dy, w, dh * 0.12);
    ctx.fillStyle = fade(0, dy + dh, 0, dy + dh * 0.88); ctx.fillRect(0, dy + dh * 0.88, w, dh * 0.12 + 1);
  }
  function draw(force) {
    const f = Math.round(current);
    if (!force && f === drawn) return;
    const img = frame(f) || nearestReady(f);
    if (!img) return;
    paint(img, img.index);
    drawn = f;
    root.classList.add('is-live');
  }

  /* ---------- scroll ---------- */
  let active = -2;                         // forces the first update() to set tabIndex on every beat
  function progress() {
    const r = root.getBoundingClientRect();
    const run = r.height - innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
  }
  function update() {
    ticking = false;
    const p = progress();
    target = locate(p);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    if (bar) bar.style.transform = `scaleX(${p})`;
    if (hint) hint.classList.toggle('is-gone', p > 0.01);
    let best = 0;                           // the words belong to the stop whose pause is nearest
    stopAt.forEach((sp, i) => { if (Math.abs(sp - p) < Math.abs(stopAt[best] - p)) best = i; });
    const near = Math.abs(stopAt[best] - p) < (HOLD / total) * 1.8;
    const want = near ? best : -1;
    if (want !== active) {
      beats.forEach((b, i) => {
        const on = i === want;
        b.classList.toggle('is-on', on);
        b.querySelectorAll('a, button').forEach((el) => { el.tabIndex = on ? 0 : -1; });
      });
      active = want;
    }
  }
  let running = false, last = 0;
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const gap = target - current;
    current = Math.abs(gap) < 0.02 ? target : current + gap * (1 - Math.exp(-FOLLOW * dt));
    draw(false);
    if (current !== target) requestAnimationFrame(tick);
    else running = false;
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (!restStarted) loadAll();
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', () => { size(); update(); });
  phone.addEventListener('change', () => { set = phone.matches ? 'mobile' : 'desktop'; restStarted = false; loadAll(); drawn = -1; size(); update(); });

  size();
  update();
  const start = () => { loadFirst(); };    // the rest loads once the visitor starts scrolling
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();

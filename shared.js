// Canvas, palette, easing and drawing helpers shared by the ActivityWatch videos.
// Pages load this with a classic <script> (ES modules don't load over file://), then call start().
const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- palette ----------
const C = {
  bg: '#0a0d12',
  bg2: '#121a24',
  text: '#f3f6fa',
  dim: '#8b98a9',
  faint: 'rgba(255,255,255,0.07)',
  accent: '#2ee6a6',
  coding: '#4f8cff',
  web: '#ffb020',
  comms: '#b06cff',
  media: '#ff5c7a',
  design: '#22d3c5',
  afk: '#2a3340',
};
const SANS = '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif';
const ROUND = '"Varela Round", "Inter", -apple-system, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", Menlo, monospace';

// ---------- math ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeInExpo = t => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1;

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- drawing helpers ----------
function rrect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Text that slides up out of a mask. p: 0..1
function revealText(str, x, y, size, color, p, { weight = 800, align = 'center', font = SANS, spacing = 0 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (spacing) ctx.letterSpacing = spacing + 'px';
  const m = ctx.measureText(str);
  const w = m.width;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.beginPath();
  ctx.rect(x0 - 40, y - size * 1.05, w + 80, size * 1.35);
  ctx.clip();
  const e = easeOutExpo(p);
  ctx.fillStyle = color;
  ctx.globalAlpha *= clamp(p * 3);
  ctx.fillText(str, x, y + (1 - e) * size * 1.2);
  ctx.restore();
}

// Text whose characters pop in one by one
function staggerText(str, x, y, size, color, t0, t, { weight = 800, font = SANS, step = 0.035, dur = 0.5, align = 'left' } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  const total = ctx.measureText(str).width;
  let cx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const cw = ctx.measureText(str.slice(0, i + 1)).width - ctx.measureText(str.slice(0, i)).width;
    const p = prog(t, t0 + i * step, t0 + i * step + dur);
    if (p > 0) {
      const e = easeOutBack(p, 2.2);
      ctx.save();
      ctx.globalAlpha *= clamp(p * 2.5);
      ctx.translate(cx + cw / 2, y);
      ctx.scale(1, e);
      ctx.translate(0, (1 - p) * 30);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    cx += cw;
  }
  ctx.restore();
}

function chip(x, y, label, color, scale = 1, alpha = 1, { size = 30, labelAlpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `600 ${size}px ${SANS}`;
  const tw = ctx.measureText(label).width;
  const h = size * 2, w = tw + size * 2.6;
  rrect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(22,30,42,0.92)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color + '66';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-w / 2 + size * 1.05, 0, size * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha *= labelAlpha;
  ctx.fillStyle = C.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, -w / 2 + size * 1.7, 2);
  ctx.restore();
}

function fmtDur(mins) {
  mins = Math.round(mins);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// ---------- logo ----------
// Recreated from the ActivityWatch logo (512px source grid, centred at 256)
function drawLogo(cx, cy, R, t0, t, { color = C.text, letters = '#9aa6b4', hand = C.accent } = {}) {
  const s = R / 245;
  const P = (x, y) => [cx + (x - 256) * s, cy + (y - 256) * s];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ring
  const pr = easeInOutCubic(prog(t, t0, t0 + 0.7));
  if (pr > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, 234 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pr);
    ctx.lineWidth = 24 * s;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // polyline stroke-draw helper
  const drawPath = (pts, p, width, col) => {
    if (p <= 0) return;
    const segs = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); segs.push(l); len += l; }
    let remain = len * p;
    ctx.beginPath();
    const a = P(...pts[0]);
    ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < pts.length && remain > 0; i++) {
      const f = Math.min(1, remain / segs[i-1]);
      const q = P(lerp(pts[i-1][0], pts[i][0], f), lerp(pts[i-1][1], pts[i][1], f));
      ctx.lineTo(q[0], q[1]);
      remain -= segs[i-1];
    }
    ctx.lineWidth = width * s;
    ctx.strokeStyle = col;
    ctx.stroke();
  };

  const pa = easeOutCubic(prog(t, t0 + 0.35, t0 + 0.95));
  drawPath([[96, 250], [174, 80], [252, 250]], pa, 27, letters);
  drawPath([[136, 196], [214, 196]], easeOutCubic(prog(t, t0 + 0.7, t0 + 1.0)), 27, letters);
  const pw = easeOutCubic(prog(t, t0 + 0.55, t0 + 1.15));
  drawPath([[262, 262], [306, 385], [348, 262], [392, 385], [444, 258]], pw, 27, letters);

  // clock hand: spins in fast, settles on logo angle
  const ph = prog(t, t0 + 0.15, t0 + 1.35);
  if (ph > 0) {
    const finalAng = Math.atan2(165 - 385, 338 - 112);
    const ang = finalAng - (1 - easeOutCubic(ph)) * Math.PI * 5;
    const L1 = Math.hypot(338 - 256, 165 - 256) * s, L2 = Math.hypot(256 - 112, 385 - 256) * s;
    const grow = easeOutBack(clamp(ph * 3), 1.4);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(ang) * L2 * grow, cy - Math.sin(ang) * L2 * grow);
    ctx.lineTo(cx + Math.cos(ang) * L1 * grow, cy + Math.sin(ang) * L1 * grow);
    ctx.lineWidth = 15 * s;
    ctx.strokeStyle = hand;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 24 * s * grow, 0, Math.PI * 2);
    ctx.fillStyle = hand;
    ctx.fill();
  }
  ctx.restore();
}

// ---------- icons ----------
function lockIcon(cx, cy, size, p, closed) {
  if (p <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  const s = easeOutBack(p, 2.5) * size / 100;
  ctx.scale(s, s);
  // shackle
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.accent;
  const lift = (1 - closed) * 26;
  ctx.beginPath();
  ctx.moveTo(-32, -10 - lift);
  ctx.lineTo(-32, -40 - lift);
  ctx.arc(0, -40 - lift, 32, Math.PI, 0);
  ctx.lineTo(32, -10 - lift * (closed < 1 ? 1.8 : 1));
  ctx.stroke();
  // body
  rrect(-54, -12, 108, 86, 18);
  ctx.fillStyle = C.accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 22, 11, 0, Math.PI * 2);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.fillRect(-5, 22, 10, 26);
  ctx.restore();
}

function cloudIcon(cx, cy, s, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(-40, 10, 34, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(-6, -22, 44, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(42, 4, 38, Math.PI * 1.4, Math.PI * 0.5);
  ctx.closePath();
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.dim;
  ctx.stroke();
  ctx.restore();
}

// ---------- finish ----------
// Light vignette + film grain, fading in from black at the start
const grain = (() => {
  const g = document.createElement('canvas'); g.width = 256; g.height = 256;
  const gx = g.getContext('2d'); const id = gx.createImageData(256, 256); const r = rng(3);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 5; }
  gx.putImageData(id, 0, 0); return g;
})();
function finish(t) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const f = Math.floor(t * 30);
  ctx.save();
  ctx.translate(-(f * 37 % 256), -(f * 91 % 256));
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
  const fade = 1 - prog(t, 0, 0.25);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}

// Camera shake from impulses [[time, strength], ...]
function shake(t, impacts) {
  let dx = 0, dy = 0;
  for (const [ti, s] of impacts) {
    const d = t - ti;
    if (d < 0 || d > 0.4) continue;
    const a = s * Math.exp(-d * 12);
    dx += Math.sin(d * 90) * a; dy += Math.cos(d * 70) * a;
  }
  return [dx, dy];
}

// Exposes the page to render.js (which drives time itself via ?capture), otherwise plays it in a loop.
function start(render, duration, fonts) {
  window.render = render;
  window.DURATION = duration;
  window.ready = document.fonts.ready.then(() => Promise.all(fonts.map(f => document.fonts.load(f))));
  if (!new URLSearchParams(location.search).has('capture')) {
    const t0 = performance.now();
    (function loop(now) {
      render(((now - t0) / 1000) % duration);
      requestAnimationFrame(loop);
    })(t0);
  }
}

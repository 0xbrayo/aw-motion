// A tour of the real aw-webui, in the theme set by the page that loads this (THEME = 'light' | 'dark'). Every screen is a screenshot of upstream aw-webui (capture-webui.js) showing the
// fictional demo data from demo-data.js; the camera, cursor, spotlights and captions only point at what is there.
// World coordinates are the page's CSS pixels (1920 wide); webui/marks.json has the measured element rects.
const DURATION = 49.3;
// Cut to the score (real-music.js): 112 BPM, 23 bars. bt(bar, beat) is when that beat lands.
const BEAT = 60 / 112;
const bt = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

// ---------- the pages ----------
const PAGE = {
  'activity-day': 'localhost:5600/#/activity/macbook/day/2026-09-25/view/',
  'activity-browser': 'localhost:5600/#/activity/macbook/day/2026-09-25/view/browser',
  timeline: 'localhost:5600/#/timeline',
  settings: 'localhost:5600/#/settings',
  'settings-categorization': 'localhost:5600/#/settings/categorization',
  buckets: 'localhost:5600/#/buckets',
};
const DIR = THEME === 'dark' ? 'webui-dark' : 'webui';
const IMG = {};
const loaded = Promise.all(Object.keys(PAGE).map(name => new Promise((res, rej) => {
  const im = new Image();
  im.onload = res; im.onerror = rej;
  im.src = `${DIR}/${name}.png`;
  IMG[name] = im;
})));
const CHROME = 46;          // browser toolbar height, above the page (world y < 0)
const PAGE_H = 1300;        // tallest capture; shorter pages sit on the page background
// Sampled from the captures, plus a browser toolbar to match
const UI = THEME === 'dark'
  ? { page: '#0f131a', bar: '#24282f', barLine: '#353a42', url: '#15181e', urlText: '#b9c1cc', edge: 'rgba(255,255,255,0.14)', dim: 0.6 }
  : { page: '#f7fafc', bar: '#e4e8ee', barLine: '#cfd5dd', url: '#ffffff', urlText: '#4a5360', edge: 'rgba(255,255,255,0)', dim: 0.45 };
// Dark mode draws the Activity tabs 10px taller, pushing the cards below them down 2px
const DY = THEME === 'dark' ? 2 : 0;

// Measured in capture-webui.js (CSS px of the 1920-wide page)
const R = {
  topApps: [400, 315 + DY, 746, 349],        // Top Applications + Top Window Titles
  barchart: [1147, 315 + DY, 373, 349],
  catRow: [400, 664 + DY, 1120, 384],        // Top Categories, Category Tree, Category Sunburst
  tabs: [400, 262, 1120, 60],
  browserTab: [615, 281, 62, 19 + DY * 5],
  browserRow: [400, 315 + DY, 1120, 349],
  navTimeline: [137, 16, 96, 24],
  navSettings: [1798, 16, 95, 24],
  navRawData: [1673, 16, 103, 24],
  sideCategorization: [415, 223, 220, 40],
  vis: [25, 256, 1870, 199],
  afkRow: [26, 257, 1868, 46],
  visDay: [770, 256, 1120, 199],        // 08:30–22:00 of the demo day
  categories: [660, 425, 860, 560],
  bucketCard: [415, 131, 1090, 231],
  bucketRows: [424, 228, 1072, 126],
  exportCard: [415, 589, 1090, 230],
  exportBtn: [981, 754, 246, 38],
};
const center = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const union = (...rs) => {
  const x0 = Math.min(...rs.map(r => r[0])), y0 = Math.min(...rs.map(r => r[1]));
  const x1 = Math.max(...rs.map(r => r[0] + r[2])), y1 = Math.max(...rs.map(r => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};

// ---------- script ----------
const WHOLE = [0, -CHROME, 1920, PAGE_H + CHROME];
const UI_IN = bt(2), UI_OUT = bt(19, 3);
// Which page is showing from when (a quick fade, like a route change)
const PAGES = [
  [0, 'activity-day'],
  [bt(8, 0.3), 'activity-browser'],
  [bt(10, 2.3), 'timeline'],
  [bt(13, 1.3), 'settings'],
  [bt(14, 1.3), 'settings-categorization'],
  [bt(17, 0.3), 'buckets'],
];
// Camera: [start, arrive, rect to frame]
const CAM = [
  [0, 0, WHOLE],
  [bt(2, 3), bt(3, 2), R.topApps],
  [bt(4, 3), bt(5, 1), R.barchart],
  [bt(6, 1), bt(6, 3), R.catRow],
  [bt(7, 2), bt(8), union(R.tabs, R.browserRow)],
  [bt(8, 1), bt(8, 3), R.browserRow],
  [bt(9, 3), bt(10, 1), [0, -CHROME, 1920, 700]],
  [bt(10, 3), bt(11, 1), union(R.vis, [25, 90, 10, 10])],
  [bt(11, 2), bt(12), R.visDay],
  [bt(12, 3), bt(13), [960, -CHROME, 960, 520]],
  [bt(13, 2), bt(14), [300, 60, 1300, 700]],
  [bt(14, 2), bt(15), R.categories],
  [bt(16, 1), bt(16, 3), [960, -CHROME, 960, 520]],
  [bt(17, 1), bt(17, 3), R.bucketCard],
  [bt(18, 2), bt(18, 3.5), R.exportCard],
  [bt(19, 2), bt(19, 3.5), WHOLE],
];
// Spotlights: [in, out, rect]
const SPOTS = [
  [bt(3, 2), bt(4, 3), R.topApps],
  [bt(5, 1), bt(6, 1), R.barchart],
  [bt(6, 3), bt(7, 2), R.catRow],
  [bt(8, 3), bt(9, 3), R.browserRow],
  [bt(11, 1), bt(11, 3), R.vis],
  [bt(12), bt(12, 3), R.afkRow],
  [bt(15), bt(16, 1), R.categories],
  [bt(17, 3), bt(18, 2), R.bucketRows],
  [bt(18, 3.5), bt(19, 2), R.exportBtn],
];
// Captions: [in, out, where in the UI, what it shows]
const CAPS = [
  [bt(2, 2), bt(3, 1.5), 'Activity', 'Your day, from the web UI'],
  [bt(3, 2), bt(5, 0.5), 'Activity · Summary', 'Apps and window titles, logged automatically'],
  [bt(5, 1), bt(6, 0.5), 'Activity · Summary', 'Active time, hour by hour'],
  [bt(6, 3), bt(7, 3), 'Activity · Summary', 'Grouped into categories by your rules'],
  [bt(8, 3), bt(9, 3.5), 'Activity · Browser', 'Add the browser extension for sites and tabs'],
  [bt(11, 1), bt(12, 3), 'Timeline', 'Every event on a timeline, AFK time included'],
  [bt(15), bt(16, 2), 'Settings · Categorization', 'Categories are regex rules you can edit'],
  [bt(17, 3), bt(18, 2.5), 'Raw Data · Buckets', 'One bucket per watcher, stored on your machine'],
  [bt(18, 3.5), bt(19, 3), 'Raw Data · Buckets', 'Export all of it as JSON'],
];
// Cursor: [arrive, target rect, click?]
const CURSOR = [
  [bt(7, 1), [1300, 520, 1, 1], false],
  [bt(7, 3.5), R.browserTab, true],
  [bt(10, 2), R.navTimeline, true],
  [bt(13, 1), R.navSettings, true],
  [bt(14, 1), R.sideCategorization, true],
  [bt(17), R.navRawData, true],
  [bt(17, 3), [1300, 560, 1, 1], false],
];
const CURSOR_SHOW = [bt(7), bt(18)];

// ---------- camera ----------
// Frames a world rect above the caption band, zoom capped so the 2x captures stay sharp.
function fitCam(r) {
  const [cx, cy] = center(r);
  const z = Math.min((W - 160) / r[2], (H - 250) / r[3], 1.9);
  return { cx, cy: cy + 50 / z, z };
}
function camera(t) {
  let cam = fitCam(CAM[0][2]);
  for (let i = 1; i < CAM.length; i++) {
    const [a, b, r] = CAM[i];
    if (t <= a) break;
    const next = fitCam(r), p = easeInOutCubic(prog(t, a, b));
    cam = { cx: lerp(cam.cx, next.cx, p), cy: lerp(cam.cy, next.cy, p), z: Math.exp(lerp(Math.log(cam.z), Math.log(next.z), p)) };
  }
  return cam;
}
function applyCam(cam) {
  ctx.translate(W / 2, H / 2 - 40);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.cx, -cam.cy);
}
const toScreen = (cam, x, y) => [W / 2 + (x - cam.cx) * cam.z, H / 2 - 40 + (y - cam.cy) * cam.z];

// ---------- the browser window ----------
function pageAt(t) {
  let cur = PAGES[0][1], prev = null, since = -1;
  for (const [at, name] of PAGES) if (t >= at) { prev = cur; cur = name; since = at; }
  return { cur, prev, fade: since < 0 ? 1 : easeOutCubic(prog(t, since, since + 0.25)) };
}
function drawPage(name, alpha) {
  const im = IMG[name];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, 0, 0, 1920, im.height / 2);
  ctx.restore();
}
function browserWindow(t, cam) {
  const { cur, prev, fade } = pageAt(t);
  ctx.save();
  // shadow + frame
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  rrect(0, -CHROME, 1920, PAGE_H + CHROME, 14);
  ctx.fillStyle = UI.page;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(0, -CHROME, 1920, PAGE_H + CHROME, 14);
  ctx.clip();
  if (prev && fade < 1) drawPage(prev, 1);
  drawPage(cur, prev ? fade : 1);
  // toolbar
  ctx.fillStyle = UI.bar;
  ctx.fillRect(0, -CHROME, 1920, CHROME);
  ctx.fillStyle = UI.barLine;
  ctx.fillRect(0, -1, 1920, 1);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(24 + i * 22, -CHROME / 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  rrect(560, -CHROME + 9, 800, CHROME - 18, 8);
  ctx.fillStyle = UI.url;
  ctx.fill();
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = UI.urlText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PAGE[cur], 960, -CHROME / 2 + 1);
  ctx.restore();
  // a hairline so a dark window still separates from the dark backdrop
  rrect(0, -CHROME, 1920, PAGE_H + CHROME, 14);
  ctx.lineWidth = 1.5 / cam.z;
  ctx.strokeStyle = UI.edge;
  ctx.stroke();
}

// Dims everything but one element, with an accent outline that draws itself on.
function spotlights(t) {
  for (const [a, b, r] of SPOTS) {
    const p = prog(t, a, a + 0.35) * (1 - prog(t, b - 0.3, b));
    if (p <= 0) continue;
    const pad = 8, [x, y, w, h] = [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4000, -4000, 10000, 10000);
    ctx.roundRect(x, y, w, h, 10); // not rrect(): that starts a new path
    ctx.fillStyle = `rgba(8,12,18,${UI.dim * p})`;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.save();
    const d = easeOutCubic(prog(t, a, a + 0.6));
    ctx.setLineDash([(w + h) * 2 * d, 99999]);
    rrect(x, y, w, h, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.accent;
    ctx.globalAlpha = p;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- cursor ----------
function cursorAt(t) {
  let [x, y] = center(CURSOR[0][1]);
  let press = 0, ripple = null;
  for (let i = 1; i < CURSOR.length; i++) {
    const [arrive, r, click] = CURSOR[i];
    const [nx, ny] = center(r);
    const p = easeInOutCubic(prog(t, arrive - 0.75, arrive));
    x = lerp(x, nx, p);
    y = lerp(y, ny, p);
    if (click) {
      const d = t - arrive - 0.05;
      if (d > 0 && d < 0.25) press = Math.sin(d / 0.25 * Math.PI);
      if (d > 0 && d < 0.6) ripple = [nx, ny, d / 0.6];
    }
  }
  return { x, y, press, ripple };
}
function drawCursor(t, cam) {
  const a = prog(t, CURSOR_SHOW[0], CURSOR_SHOW[0] + 0.3) * (1 - prog(t, CURSOR_SHOW[1] - 0.3, CURSOR_SHOW[1]));
  if (a <= 0) return;
  const c = cursorAt(t);
  const [sx, sy] = toScreen(cam, c.x, c.y);
  ctx.save();
  ctx.globalAlpha = a;
  if (c.ripple) {
    const [rx, ry] = toScreen(cam, c.ripple[0], c.ripple[1]);
    ctx.beginPath();
    ctx.arc(rx, ry, 14 + 46 * easeOutCubic(c.ripple[2]), 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(46,230,166,${0.9 * (1 - c.ripple[2])})`;
    ctx.stroke();
  }
  ctx.translate(sx, sy);
  const s = 1.5 * (1 - 0.15 * c.press);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 24);
  ctx.lineTo(6, 18.5);
  ctx.lineTo(10.5, 28);
  ctx.lineTo(14.5, 26.2);
  ctx.lineTo(10.2, 17);
  ctx.lineTo(17.5, 17);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
}

// ---------- captions ----------
function captions(t, uiA) {
  // band under the captions so they read over any screen
  if (uiA > 0) {
    const g = ctx.createLinearGradient(0, H - 330, 0, H);
    g.addColorStop(0, 'rgba(10,13,18,0)');
    g.addColorStop(0.55, `rgba(10,13,18,${0.88 * uiA})`);
    g.addColorStop(1, `rgba(10,13,18,${0.96 * uiA})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 330, W, 330);
  }
  for (const [a, b, where, text] of CAPS) {
    if (t < a || t > b) continue;
    const out = 1 - prog(t, b - 0.3, b);
    ctx.save();
    ctx.globalAlpha = out;
    const kp = easeOutCubic(prog(t, a, a + 0.4));
    ctx.font = `700 24px ${MONO}`;
    ctx.letterSpacing = '3px';
    const label = where.toUpperCase(), lw = ctx.measureText(label).width;
    ctx.globalAlpha *= kp;
    ctx.beginPath();
    ctx.arc(W / 2 - lw / 2 - 22, H - 142, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2 + 4 * (1 - kp), H - 134);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = out;
    revealText(text, W / 2, H - 62, 56, C.text, prog(t, a + 0.08, a + 0.7), { weight: 700 });
    ctx.restore();
  }
  // honest footnote while the UI is on screen
  if (uiA > 0) {
    ctx.save();
    ctx.globalAlpha = uiA * 0.8;
    ctx.font = `500 20px ${SANS}`;
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'right';
    ctx.fillText('Real aw-webui screens · demo data', W - 40, H - 30);
    ctx.restore();
  }
}

// ---------- intro / outro ----------
function backdrop(t) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.75);
  g.addColorStop(0, '#16202c');
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function intro(t) {
  if (t > bt(3)) return;
  const out = easeInCubic(prog(t, bt(1, 3), bt(2, 1)));
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 + out * 0.3, 1 + out * 0.3);
  ctx.translate(-W / 2, -H / 2);
  const gp = prog(t, 0.2, 1.2);
  const g = ctx.createRadialGradient(W / 2, H / 2 - 90, 0, W / 2, H / 2 - 90, 420);
  g.addColorStop(0, `rgba(46,230,166,${0.14 * gp})`);
  g.addColorStop(1, 'rgba(46,230,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawLogo(W / 2, H / 2 - 110, 150, 0.2, t);
  staggerText('ActivityWatch', W / 2, H / 2 + 150, 110, C.text, 0.9, t, { font: ROUND, weight: 400, step: 0.03, dur: 0.45, align: 'center' });
  revealText('A quick tour of the web UI', W / 2, H / 2 + 230, 44, C.dim, prog(t, bt(1), bt(1, 2)), { weight: 600 });
  ctx.restore();
}
function outro(t) {
  const t0 = bt(20);
  if (t < t0) return;
  const lx = 600, ly = H / 2 - 20, Rl = 170;
  const gp = prog(t, t0, t0 + 1);
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 460);
  g.addColorStop(0, `rgba(46,230,166,${0.14 * gp})`);
  g.addColorStop(1, 'rgba(46,230,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawLogo(lx, ly, Rl, t0, t);
  staggerText('ActivityWatch', 830, H / 2 - 40, 120, C.text, t0 + 0.6, t, { font: ROUND, weight: 400, step: 0.03, dur: 0.45 });
  revealText('Free & open-source time tracking', 836, H / 2 + 40, 46, C.dim, prog(t, bt(21), bt(21, 1.5)), { align: 'left', weight: 600 });
  const up = prog(t, bt(21, 2), bt(22));
  if (up > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(up * 2);
    ctx.font = `700 38px ${SANS}`;
    const label = 'activitywatch.net', tw = ctx.measureText(label).width, e = easeOutBack(up, 2);
    const bx = 836, by = H / 2 + 80;
    rrect(bx, by + (1 - e) * 20, (tw + 60) * e, 66, 33);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha *= clamp((up - 0.4) * 3);
    ctx.fillText(label, bx + 30, by + 35 + (1 - e) * 20);
    ctx.restore();
  }
}

// ---------- frame ----------
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';
  backdrop(t);
  intro(t);
  const inP = easeOutCubic(prog(t, UI_IN, bt(2, 3)));
  const outP = easeInCubic(prog(t, UI_OUT, bt(20, 0.5)));
  const uiA = clamp(inP * 1.5) * (1 - outP);
  const cam = camera(t);
  if (uiA > 0) {
    ctx.save();
    ctx.globalAlpha = uiA;
    // the window rises in, and falls away at the end
    ctx.translate(0, (1 - inP) * 380 + outP * 260);
    ctx.translate(W / 2, H / 2);
    const s = (0.9 + 0.1 * inP) * (1 - 0.15 * outP);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
    ctx.save();
    applyCam(cam);
    browserWindow(t, cam);
    spotlights(t);
    ctx.restore();
    drawCursor(t, cam);
    ctx.restore();
  }
  captions(t, uiA);
  outro(t);
  finish(t);
}

start(render, DURATION, ['700 40px Inter', '600 40px Inter', '500 40px Inter', '400 40px "Varela Round"', '700 40px "JetBrains Mono"']);
window.ready = window.ready.then(() => loaded);

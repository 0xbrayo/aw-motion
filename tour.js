// The long ActivityWatch tour: a real 30 fps recording of aw-webui (capture-tour.js) played inside a window frame,
// with a camera, spotlights, the logged cursor, captions and chapter tags laid over it.
// Every number in a caption is read from the recording's own DOM (tour/manifest.js); if one can't be read,
// the caption falls back to wording without it rather than guessing.
// Time is counted in beats of the soundtrack (tour-music.js, 112 BPM). "Rec beats" are beats into the recording.
const BEAT = 60 / 112, FPS = 30;
const INTRO = 16;                       // beats of cold open before the recording starts
const PAYOFF = 12, OUTRO = 16;          // beats after it
const CHROME = 40;                      // window title bar above the page (world y < 0)

let M, REC_BEATS, END, DURATION;
const vt = recBeat => (INTRO + recBeat) * BEAT;       // rec beat -> video seconds
const bt = beat => beat * BEAT;                        // video beat -> video seconds

// ---------- the recording ----------
const cache = new Map();
function frameImage(i) {
  if (cache.has(i)) return cache.get(i);
  const p = new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = `tour/frames/${String(i).padStart(5, '0')}.jpg`;
  });
  cache.set(i, p);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return p;
}
const recFrame = t => clamp(Math.round((t - bt(INTRO)) * FPS), 0, M.frames.length - 1);

// ---------- reading the recording's own numbers ----------
const short = d => d ? d.replace(/^(\d+h \d+m) \d+s$/, '$1').replace(/^(\d+m) \d+s$/, '$1') : null;
const tip = (text, key) => { const m = text && text.match(new RegExp(key + '\\s+([^\\n]+)')); return m ? m[1].trim() : null; };
const hm = s => s ? s.slice(0, 5) : null;
const cap = (tpl, fallback) => tpl.includes('null') || tpl.includes('undefined') ? fallback : tpl;

// ---------- geometry ----------
const center = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const union = (...rs) => {
  rs = rs.filter(Boolean);
  const x0 = Math.min(...rs.map(r => r[0])), y0 = Math.min(...rs.map(r => r[1]));
  const x1 = Math.max(...rs.map(r => r[0] + r[2])), y1 = Math.max(...rs.map(r => r[1] + r[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};
const grow = (r, px, py = px) => [r[0] - px, r[1] - py, r[2] + px * 2, r[3] + py * 2];

let CAM, SPOTS, CAPS, CHAPTERS, WHIPS;
function script() {
  const K = M.marks, T = M.texts;
  const WHOLE = [0, -CHROME, 1920, 1300 + CHROME];
  const TITLE = [400, 70, 760, 92];
  const row1 = union(K.topApps, K.topTitles, K.barchart);
  const row2 = union(K.topCats, K.catTree, K.sunburst);
  const cats = T.catValues || {}, after = T.catValuesAfter || {};
  const lunchStart = hm(tip(T.lunchTip, 'Start')), lunchStop = hm(tip(T.lunchTip, 'Stop'));
  const eveTitle = tip(T.eveningTip, 'Title'), eveStart = hm(tip(T.eveningTip, 'Start'));
  const designTime = short(T.designHover && (T.designHover.match(/Design\n([^\n]+)/) || [])[1]);

  // [start, arrive, rect] in rec beats
  CAM = [
    [0, 0, WHOLE],
    [1.5, 3.5, TITLE],
    [6, 8, union(K.topApps, K.topTitles)],
    [13, 15, K.barchart],
    [19, 21, row2],
    [30, 32, grow(K.sunburst, 20)],
    [39, 42, union([400, 60, 1120, 10], row1)],
    [62, 65, union(K.toolbar, K.filtersPanel)],
    [74, 76, [0, -CHROME, 1100, 520]],
    [78, 81, [0, 60, 1000, 260]],
    [91, 94, grow(K.vis, 10, 30)],
    [104, 106, union(grow(K.lunch, 260, 20), K.lunchTip)],
    [114, 116, union(grow(K.evening, 220, 20), K.eveningTip)],
    [123, 126, grow(K.vis, 10, 30)],
    [142, 144, [820, -CHROME, 1100, 520]],
    [146, 149, [330, 60, 1260, 640]],
    [153, 156, grow(K.catList, 20)],
    [161, 164, grow(union(K.workRow, [K.workRow[0], K.workRow[1] - 60, 10, 10]), 20, 60)],
    [165, 168, grow(K.modal, 20)],
    [186, 188, grow(union(K.unsaved, K.designRow), 20)],
    [197, 199, [0, -CHROME, 1100, 520]],
    [201, 203, union([400, 60, 1120, 10], K.toolbar)],
    [211, 214, row2],
    [226, 228, [820, -CHROME, 1100, 520]],
    [230, 233, grow(K.bucketCard, 30)],
    [241, 243, [380, 60, 1160, 420]],
    [253, 256, grow(K.events || [400, 400, 1120, 500], 20)],
    [264, 266, [820, -CHROME, 1100, 520]],
    [270, 272, grow(K.exportCard ? union(K.exportCard, K.exportBtn) : K.exportBtn, 40)],
  ];
  // [in, out, rect] in rec beats
  SPOTS = [
    [3.5, 6, TITLE],
    [8, 13, union(K.topApps, K.topTitles)],
    [15, 19, K.barchart],
    [26, 30, K.catTreeOpen || K.catTree],
    [34, 39, K.sunburst],
    [67, 72, K.filtersPanel],
    [84, 91, [0, 60, 1000, 170]],
    [107, 113, K.lunch],
    [117, 123, K.evening],
    [156, 161, K.catList],
    [168, 184, K.modal],
    [188, 196, union(K.unsaved, K.designRow)],
    [216, 225, K.sunburst],
    [234, 239, K.bucketRows],
    [256, 263, K.events],
    [274, 280, K.exportBtn],
  ];
  // [in, out, kicker, text] in rec beats
  CAPS = [
    [3.5, 7, 'Activity · Summary', cap(`Friday: ${short(T.timeActive)} active`, 'One Friday, recorded automatically')],
    [8, 13, 'Activity · Summary', 'Apps and window titles, logged automatically'],
    [15, 19, 'Activity · Summary', 'Hour by hour, evening YouTube included'],
    [21, 30, 'Activity · Summary', cap(`${short(cats.Work)} of work, ${short(cats.Comms)} of comms, ${short(cats.Media)} of media`, 'Everything sorted into categories')],
    [34, 40, 'Activity · Summary', cap(`…and ${short(cats.Uncategorized)} no rule matches yet`, '…and some time no rule matches yet')],
    [44, 51, 'Activity · 7 days', cap(`The last 7 days: ${short(T.week && T.week.active)}`, 'Any week')],
    [52, 60, 'Activity · 30 days', cap(`The last 30 days: ${short(T.month && T.month.active)}`, 'Any month')],
    [67, 73, 'Activity · Filters', 'Exclude AFK time, or show just one category'],
    [83, 91, 'Timeline', 'Pick any date range'],
    [95, 104, 'Timeline', 'Every event of the day, row by row'],
    [108, 114, 'Timeline', cap(`Away ${lunchStart}–${lunchStop}. Lunch, probably.`, 'Hover any block for the details')],
    [118, 124, 'Timeline', cap(`${eveStart}: ${eveTitle}`, 'Hover any block for the details')],
    [128, 141, 'Timeline', 'Scroll to zoom in on any part of the day'],
    [156, 162, 'Settings · Categorization', 'Categories are plain regex rules'],
    [168, 186, 'Settings · Categorization', 'Add one: Work › Design, matching “Figma”'],
    [188, 197, 'Settings · Categorization', 'Save, and it applies to your whole history'],
    [214, 220, 'Activity · Summary', cap(`Same Friday. Uncategorized: ${short(cats.Uncategorized)} → ${short(after.Uncategorized) || 'none'}`, 'Same Friday, re-sorted')],
    [220, 226, 'Activity · Summary', cap(`Figma now counts as Work › Design: ${designTime}`, 'Figma now counts as Work › Design')],
    [233, 239, 'Raw Data · Buckets', 'One bucket per watcher, stored on your machine'],
    [245, 253, 'Raw Data · Bucket', 'Open any bucket, pick any range'],
    [256, 264, 'Raw Data · Bucket', 'Every event, exactly as recorded'],
    [274, 280, 'Raw Data · Buckets', 'Export all of it as JSON'],
  ];
  // [rec beat, number, name]
  CHAPTERS = [[0, '01', 'Activity'], [77, '02', 'Timeline'], [145, '03', 'Categories'], [229, '04', 'Your data']];
  // route changes that get a whip: rec frame of the click
  const navClicks = [77, 145, 200, 229, 241, 267].map(b => Math.round(b * BEAT * FPS));
  WHIPS = M.clicks.filter(c => navClicks.some(n => Math.abs(n - c) < 20)).map(c => c / FPS + bt(INTRO));
}

// ---------- camera ----------
function fitCam(r) {
  const [cx, cy] = center(r);
  const z = Math.min((W - 180) / r[2], (H - 280) / r[3], 1.85);
  return { cx, cy: cy + 60 / z, z };
}
function camera(t) {
  const rb = t / BEAT - INTRO;
  let cam = fitCam(CAM[0][2]);
  for (let i = 1; i < CAM.length; i++) {
    const [a, b, r] = CAM[i];
    if (rb <= a) break;
    const next = fitCam(r), p = easeInOutCubic(prog(rb, a, b));
    cam = { cx: lerp(cam.cx, next.cx, p), cy: lerp(cam.cy, next.cy, p), z: Math.exp(lerp(Math.log(cam.z), Math.log(next.z), p)) };
  }
  // whip: a quick pull-back and push-in on route changes
  let blur = 0;
  for (const w of WHIPS) {
    const p = prog(t, w - 0.05, w + 0.45);
    if (p > 0 && p < 1) { const s = Math.sin(p * Math.PI); cam.z *= 1 - 0.1 * s; blur = Math.max(blur, s); }
  }
  // a slow drift keeps holds alive
  cam.z *= 1 + 0.004 * Math.sin(t * 0.7);
  return { ...cam, blur };
}
const toScreen = (cam, x, y) => [W / 2 + (x - cam.cx) * cam.z, H / 2 - 50 + (y - cam.cy) * cam.z];
function applyCam(cam) {
  ctx.translate(W / 2, H / 2 - 50);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.cx, -cam.cy);
}

// ---------- the window ----------
function windowFrame(img, cam) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 30;
  rrect(0, -CHROME, 1920, 1300 + CHROME, 14);
  ctx.fillStyle = '#0f131a';
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(0, -CHROME, 1920, 1300 + CHROME, 14);
  ctx.clip();
  ctx.drawImage(img, 0, 0, 1920, 1300);
  ctx.fillStyle = '#24282f';
  ctx.fillRect(0, -CHROME, 1920, CHROME);
  ctx.fillStyle = '#353a42';
  ctx.fillRect(0, -1, 1920, 1);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(24 + i * 22, -CHROME / 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  ctx.font = `600 16px ${SANS}`;
  ctx.fillStyle = '#aeb6c2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ActivityWatch', 960, -CHROME / 2 + 1);   // the page's <title>
  ctx.restore();
  rrect(0, -CHROME, 1920, 1300 + CHROME, 14);
  ctx.lineWidth = 1.5 / cam.z;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
}

function spotlights(t) {
  const rb = t / BEAT - INTRO;
  for (const [a, b, r] of SPOTS) {
    if (!r) continue;
    const p = prog(rb, a, a + 0.6) * (1 - prog(rb, b - 0.5, b));
    if (p <= 0) continue;
    const pad = 8, [x, y, w, h] = [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4000, -4000, 10000, 10000);
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = `rgba(6,9,14,${0.58 * p})`;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.save();
    const d = easeOutCubic(prog(rb, a, a + 1.2));
    ctx.setLineDash([(w + h) * 2 * d, 99999]);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.accent;
    ctx.globalAlpha = p;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- cursor ----------
function drawCursor(t, cam, f, alpha) {
  const c = M.cursor[f];
  if (!c || alpha <= 0) return;
  const [sx, sy] = toScreen(cam, c[0], c[1]);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const cf of M.clicks) {
    const d = (f - cf) / FPS;
    if (d < 0 || d > 0.6) continue;
    const [px, py] = M.cursor[cf];
    const [rx, ry] = toScreen(cam, px, py);
    ctx.beginPath();
    ctx.arc(rx, ry, 14 + 50 * easeOutCubic(d / 0.6), 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(46,230,166,${0.9 * (1 - d / 0.6)})`;
    ctx.stroke();
  }
  ctx.translate(sx, sy);
  const s = 1.55 * (c[2] ? 0.86 : 1);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 24); ctx.lineTo(6, 18.5); ctx.lineTo(10.5, 28);
  ctx.lineTo(14.5, 26.2); ctx.lineTo(10.2, 17); ctx.lineTo(17.5, 17); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
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

// ---------- captions, chapter tag, footnote ----------
function captions(t, uiA) {
  if (uiA > 0) {
    const g = ctx.createLinearGradient(0, H - 330, 0, H);
    g.addColorStop(0, 'rgba(10,13,18,0)');
    g.addColorStop(0.55, `rgba(10,13,18,${0.9 * uiA})`);
    g.addColorStop(1, `rgba(10,13,18,${0.97 * uiA})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 330, W, 330);
  }
  const rb = t / BEAT - INTRO;
  for (const [a, b, where, text] of CAPS) {
    if (rb < a || rb > b) continue;
    const ta = vt(a), out = 1 - prog(rb, b - 0.5, b);
    ctx.save();
    ctx.globalAlpha = out * easeOutCubic(prog(t, ta, ta + 0.4));
    ctx.font = `700 24px ${MONO}`;
    ctx.letterSpacing = '3px';
    const label = where.toUpperCase(), lw = ctx.measureText(label).width;
    ctx.beginPath();
    ctx.arc(W / 2 - lw / 2 - 22, H - 142, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, H - 134);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = out;
    revealText(text, W / 2, H - 62, 56, C.text, prog(t, ta + 0.08, ta + 0.7), { weight: 700 });
    ctx.restore();
  }
  if (uiA > 0) {
    ctx.save();
    ctx.globalAlpha = uiA * 0.8;
    ctx.font = `500 20px ${SANS}`;
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'right';
    ctx.fillText('Shown with sample data', W - 40, H - 30);
    ctx.restore();
  }
}
function chapterTag(t, uiA) {
  if (uiA <= 0) return;
  const rb = t / BEAT - INTRO;
  let cur = null;
  for (const c of CHAPTERS) if (rb >= c[0]) cur = c;
  if (!cur) return;
  // a short title card while the new page loads, then out of the way of the real UI
  const t0 = vt(cur[0]) + (cur[0] ? 0.25 : 0.6), since = t - t0;
  const p = easeOutExpo(prog(since, 0, 0.5)) * (1 - easeInCubic(prog(since, 1.6, 2.1)));
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = uiA * p;
  ctx.fillStyle = 'rgba(6,9,14,0.62)';
  ctx.fillRect(0, 0, W, H);
  const y = H / 2 - 40 + (1 - p) * 30;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 40px ${MONO}`;
  ctx.letterSpacing = '6px';
  ctx.fillStyle = C.accent;
  ctx.fillText(cur[1], W / 2, y - 80);
  ctx.letterSpacing = '0px';
  ctx.font = `800 120px ${SANS}`;
  ctx.fillStyle = C.text;
  ctx.fillText(cur[2], W / 2, y + 40);
  ctx.fillStyle = C.accent;
  const lw = 120 * easeOutCubic(prog(since, 0.1, 0.7));
  ctx.fillRect(W / 2 - lw / 2, y + 78, lw, 6);
  ctx.restore();
}

// ---------- cold open ----------
function backdrop() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.75);
  g.addColorStop(0, '#16202c');
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function coldOpen(t) {
  if (t > bt(INTRO)) return;
  const q = 'Where did your Friday go?';
  const out = easeInCubic(prog(t, bt(7), bt(8)));
  if (out < 1) {
    const n = Math.floor(clamp((t - bt(1)) / (bt(5) - bt(1))) * q.length);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.font = `800 96px ${SANS}`;
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const full = ctx.measureText(q).width, x = W / 2 - full / 2, y = H / 2 - 10 - out * 40;
    const shown = q.slice(0, n);
    ctx.fillText(shown, x, y);
    if (t > bt(1) - 0.3 && Math.floor(t * 2.4) % 2 === 0) {
      ctx.fillStyle = C.accent;
      ctx.fillRect(x + ctx.measureText(shown).width + 8, y - 48, 7, 96);
    }
    ctx.restore();
  }
  if (t > bt(8)) {
    const a = 1 - easeInCubic(prog(t, bt(13), bt(14.5)));
    ctx.save();
    ctx.globalAlpha = a;
    const gp = prog(t, bt(8), bt(9));
    const g = ctx.createRadialGradient(W / 2, H / 2 - 80, 0, W / 2, H / 2 - 80, 420);
    g.addColorStop(0, `rgba(46,230,166,${0.14 * gp})`);
    g.addColorStop(1, 'rgba(46,230,166,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawLogo(W / 2, H / 2 - 100, 130, bt(8), t);
    staggerText('ActivityWatch', W / 2, H / 2 + 140, 96, C.text, bt(9), t, { font: ROUND, weight: 400, step: 0.03, dur: 0.45, align: 'center' });
    revealText('The free and open-source automated time tracker', W / 2, H / 2 + 215, 44, C.dim, prog(t, bt(10), bt(11.5)), { weight: 600 });
    ctx.restore();
  }
}

// ---------- the payoff: the real exported file ----------
function payoff(t) {
  const t0 = bt(END), t1 = bt(END + PAYOFF);
  if (t < t0 - 0.6 || t > t1 + 0.1) return;
  const lines = M.texts.exportLines || [];
  const inP = easeOutExpo(prog(t, t0 - 0.6, t0 + 0.4)), outP = easeInCubic(prog(t, t1 - 0.6, t1));
  const w = 1180, lh = 34, h = 110 + Math.min(lines.length, 22) * lh;
  const x = W / 2 - w / 2, y = (H - 150) / 2 - h / 2 + (1 - inP) * 120 - outP * 60;
  ctx.save();
  ctx.globalAlpha = inP * (1 - outP);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  rrect(x, y, w, h, 16);
  ctx.fillStyle = '#12161d';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.fillStyle = '#1b2029';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 54, [16, 16, 0, 0]);
  ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + 28 + i * 22, y + 27, 7, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  ctx.font = `600 20px ${MONO}`;
  ctx.fillStyle = '#aeb6c2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(M.texts.exportFile || 'aw-buckets-export.json', x + w / 2, y + 28);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 24px ${MONO}`;
  const shown = Math.floor(prog(t, t0, t0 + 2.2) * lines.length);
  lines.slice(0, Math.min(shown, 22)).forEach((line, i) => {
    const ly = y + 96 + i * lh;
    // light syntax colouring: keys, strings, numbers/literals
    let cx = x + 40;
    const parts = line.match(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e-?\d+)?|true|false|null|[^"\d]+)/gi) || [line];
    for (const part of parts) {
      ctx.fillStyle = /":$|":\s*$/.test(part.trimEnd()) ? '#8ab4ff' : part.startsWith('"') ? '#2ee6a6' : /^-?\d|true|false|null/.test(part) ? '#ffb020' : '#c3cad3';
      ctx.fillText(part, cx, ly);
      cx += ctx.measureText(part).width;
    }
  });
  ctx.restore();
  const ca = inP * (1 - outP);
  if (ca > 0) {
    ctx.save();
    ctx.globalAlpha = ca;
    ctx.font = `700 24px ${MONO}`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = C.accent;
    ctx.textAlign = 'center';
    ctx.fillText('YOUR DATA', W / 2, H - 134);
    ctx.restore();
    revealText('Plain JSON, yours to keep', W / 2, H - 62, 56, C.text, prog(t, t0 + 0.3, t0 + 1), { weight: 700 });
  }
}

// ---------- outro ----------
function outro(t) {
  const t0 = bt(END + PAYOFF);
  if (t < t0) return;
  const lx = 600, ly = H / 2 - 20;
  const gp = prog(t, t0, t0 + 1);
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 460);
  g.addColorStop(0, `rgba(46,230,166,${0.14 * gp})`);
  g.addColorStop(1, 'rgba(46,230,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawLogo(lx, ly, 170, t0, t);
  staggerText('ActivityWatch', 830, H / 2 - 40, 120, C.text, t0 + 0.6, t, { font: ROUND, weight: 400, step: 0.03, dur: 0.45 });
  revealText('Free & open-source time tracking', 836, H / 2 + 40, 46, C.dim, prog(t, t0 + bt(4), t0 + bt(5.5)), { align: 'left', weight: 600 });
  const up = prog(t, t0 + bt(6), t0 + bt(8));
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
async function renderTour(t) {
  const f = recFrame(t);
  const img = await frameImage(M.frames[f]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';
  backdrop();
  coldOpen(t);
  const inP = easeOutCubic(prog(t, bt(INTRO - 2), bt(INTRO)));
  const outP = easeInCubic(prog(t, bt(END) - 0.6, bt(END) + 0.4));
  const uiA = clamp(inP * 1.5) * (1 - outP);
  if (uiA > 0) {
    const cam = camera(t);
    ctx.save();
    ctx.globalAlpha = uiA;
    ctx.translate(0, (1 - inP) * 420 - outP * 120);
    ctx.translate(W / 2, H / 2);
    const s = (0.88 + 0.12 * inP) * (1 - 0.1 * outP);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
    ctx.save();
    applyCam(cam);
    windowFrame(img, cam);
    spotlights(t);
    ctx.restore();
    drawCursor(t, cam, f, t > bt(INTRO) ? 1 : 0);
    ctx.restore();
  }
  captions(t, uiA);
  chapterTag(t, uiA);
  payoff(t);
  outro(t);
  finish(t);
}

// ---------- boot ----------
const manifestLoaded = new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = 'tour/manifest.js';
  s.onload = res;
  s.onerror = rej;
  document.head.appendChild(s);
});
window.DURATION = 180;
start(renderTour, 180, ['800 40px Inter', '700 40px Inter', '600 40px Inter', '500 40px Inter', '400 40px "Varela Round"', '700 40px "JetBrains Mono"', '500 40px "JetBrains Mono"']);
window.ready = Promise.all([window.ready, manifestLoaded]).then(() => {
  M = window.MANIFEST;
  REC_BEATS = M.frames.length / FPS / BEAT;
  END = Math.ceil((INTRO + REC_BEATS) / 4) * 4;       // the recording ends on a bar line
  DURATION = bt(END + PAYOFF + OUTRO) + 0.4;
  window.DURATION = DURATION;
  window.TOUR = { END, REC_BEATS, INTRO, PAYOFF, OUTRO };
  script();
  return frameImage(M.frames[0]);
});

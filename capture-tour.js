// Records the real aw-webui as a 30 fps "screen recording" for the long tour (tour.html).
// Before the app loads, the page gets a virtual clock: requestAnimationFrame, performance.now and Date.now only advance
// when a frame is captured, so aw-webui's own Chart.js / d3 / vis-timeline animations play smoothly however slow the
// screenshots are. Every click, hover, keystroke and scroll really happens in the page; the cursor path is logged per
// frame so tour.js can draw it exactly where the real mouse was.
// Choreography is written against the soundtrack's beat grid (112 BPM), so cuts and clicks land on the music.
// Usage: node capture-tour.js [http://localhost:5699]   (needs the demo server seeded by demo-data.js)
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:5699';
const OUT = 'tour';
const DAY = '2026-09-25';
const FPS = 30, BEAT = 60 / 112;
const VIEW = { width: 1920, height: 1300 };
const fAt = beat => Math.round(beat * BEAT * FPS);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Installed before any page script, so libraries that capture requestAnimationFrame at load time get this one.
function virtualClock() {
  const rRAF = window.requestAnimationFrame.bind(window);
  const rPerf = performance.now.bind(performance), rDate = Date.now;
  let vPerf = rPerf(), vDate = rDate(), id = 0;
  const queue = new Map();
  performance.now = () => vPerf;
  Date.now = () => vDate;
  window.requestAnimationFrame = cb => { queue.set(++id, cb); return id; };
  window.cancelAnimationFrame = i => queue.delete(i);
  window.__clock = {
    step(ms) {
      vPerf += ms; vDate += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) { try { cb(vPerf); } catch (e) { console.error(e); } }
      return new Promise(r => rRAF(() => r()));
    },
  };
}

// Deletes every server-side aw-webui setting, so the recording starts from defaults.
async function resetSettings() {
  const all = await (await fetch(BASE + '/api/0/settings')).json();
  for (const key of Object.keys(all)) await fetch(`${BASE}/api/0/settings/${key}`, { method: 'DELETE' });
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'download'), { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ ...VIEW, deviceScaleFactor: 2 });
  await page.emulateTimezone('Africa/Nairobi');
  // Dark theme via aw-webui's default "System" setting; reduced motion turns off Bootstrap's CSS fades, which run on
  // the compositor's real clock and can't be frame-stepped. Chart.js and d3 animations are unaffected.
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.evaluateOnNewDocument(virtualClock);
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(OUT, 'download') });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().endsWith('/api/0/info')) {
      const info = { hostname: 'macbook', version: 'v0.14.0 (rust)', testing: false, device_id: 'demo' };
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(info) });
    }
    req.continue();
  });
  page.on('pageerror', e => console.error('pageerror', e.message));

  // ---------- recorder ----------
  const M = { fps: FPS, bpm: 112, view: VIEW, frames: [], cursor: [], clicks: [], markers: {}, marks: {}, texts: {} };
  const seen = new Map();
  let files = 0, last = -1;
  const cur = { x: 1300, y: 700, down: 0 };
  const frameNo = () => M.frames.length;

  async function shot() {
    await page.evaluate(ms => window.__clock.step(ms), 1000 / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 90, optimizeForSpeed: true });
    const key = crypto.createHash('md5').update(buf).digest('hex');
    if (!seen.has(key)) {
      seen.set(key, files);
      fs.writeFileSync(path.join(OUT, 'frames', `${String(files).padStart(5, '0')}.jpg`), buf);
      files++;
    }
    last = seen.get(key);
    M.frames.push(last);
    M.cursor.push([Math.round(cur.x * 10) / 10, Math.round(cur.y * 10) / 10, cur.down]);
    if (M.frames.length % 30 === 0) process.stdout.write(`\rframe ${M.frames.length} (${files} unique)`);
  }
  // Capture every frame until a beat (for anything that moves).
  async function play(beat) { while (frameNo() < fAt(beat)) await shot(); }
  // Repeat the last frame until a beat, without advancing the page (only when the UI has settled).
  function hold(beat) {
    while (frameNo() < fAt(beat)) { M.frames.push(last); M.cursor.push([cur.x, cur.y, cur.down]); }
  }
  const marker = name => { M.markers[name] = frameNo(); };

  // ---------- finding real elements ----------
  // A rect (CSS px) for the innermost element whose own text is `text`, optionally widened to an ancestor.
  const rect = (text, { closest, within, nth = 0, exact = true } = {}) => page.evaluate((text, closest, within, nth, exact) => {
    const root = within ? [...document.querySelectorAll(within)].find(e => e.getClientRects().length) || document : document;
    const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const hits = [...root.querySelectorAll('*')].filter(e => {
      const t = own(e) || (e.childElementCount === 0 ? e.textContent.trim() : '');
      return (exact ? t === text : t.includes(text)) && e.getClientRects().length;
    });
    let el = hits[nth];
    if (!el) return null;
    if (closest) el = el.closest(closest) || el;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, text, closest, within, nth, exact);
  const rectOf = sel => page.evaluate(sel => {
    const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, sel);
  const must = (r, what) => { if (!r) throw new Error('not found: ' + what); return r; };
  // Retries for a few seconds: the UI may still be re-rendering after the previous click.
  async function need(fn, what) {
    for (let i = 0; i < 20; i++) { const r = await fn(); if (r) return r; await sleep(250); }
    throw new Error('not found: ' + what);
  }
  const center = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
  async function mark(name, r) { M.marks[name] = r.map(v => Math.round(v)); return r; }
  async function note(name, fn, ...args) { M.texts[name] = await page.evaluate(fn, ...args); return M.texts[name]; }

  // An interior point of the sunburst slice for a category (hit-tested on the real SVG path).
  const slicePoint = name => page.evaluate(name => {
    const p = [...document.querySelectorAll('svg path')].find(x => x.__data__ && x.__data__.data && x.__data__.data.name === name);
    if (!p) return null;
    const bb = p.getBBox(), m = p.getScreenCTM(), svg = p.ownerSVGElement;
    const pts = [];
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
      const pt = svg.createSVGPoint();
      pt.x = bb.x + bb.width * i / 12; pt.y = bb.y + bb.height * j / 12;
      if (p.isPointInFill(pt)) { const s = pt.matrixTransform(m); pts.push([s.x, s.y]); }
    }
    if (!pts.length) return null;
    // the sample closest to the middle of the slice's samples
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    return pts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
  }, name);

  // ---------- cursor ----------
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // Glide the real mouse to (x, y), arriving on a beat; every frame is captured so hover states are real.
  async function move([x, y], beat) {
    const n = Math.max(1, fAt(beat) - frameNo()), x0 = cur.x, y0 = cur.y;
    for (let i = 1; i <= n; i++) {
      const p = ease(i / n);
      cur.x = x0 + (x - x0) * p; cur.y = y0 + (y - y0) * p;
      await page.mouse.move(cur.x, cur.y);
      await shot();
    }
  }
  async function click({ count = 1 } = {}) {
    M.clicks.push(frameNo());
    cur.down = 1;
    await page.mouse.down({ clickCount: count });
    await shot();
    await page.mouse.up({ clickCount: count });
    cur.down = 0;
    for (let c = 2; c <= count; c++) { await page.mouse.down({ clickCount: c }); await page.mouse.up({ clickCount: c }); }
  }
  async function type(text, perChar = 2) {
    for (const ch of text) { await page.keyboard.type(ch); for (let i = 0; i < perChar; i++) await shot(); }
  }
  // Hours visible in the vis-timeline, from the spacing of its HH:mm axis labels (null when labels aren't HH:mm).
  const visHours = () => page.evaluate(() => {
    const vis = document.querySelector('.vis-timeline');
    const ls = [...document.querySelectorAll('.vis-time-axis .vis-text.vis-minor')]
      .map(e => [e.textContent.trim(), e.getBoundingClientRect().x]).filter(([t]) => /^\d\d:\d\d$/.test(t));
    if (!vis || ls.length < 2) return null;
    const mins = ([t]) => +t.slice(0, 2) * 60 + +t.slice(3);
    const perPx = (mins(ls[1]) - mins(ls[0])) / (ls[1][1] - ls[0][1]);
    return perPx > 0 ? vis.getBoundingClientRect().width * perPx / 60 : null;
  });
  // Scroll-zooms until about `hours` are visible, capturing every frame until `beat`. vis-timeline zooms a fixed
  // step per wheel event whatever its size, so the notches are paced like a person scrolling (5 a second).
  async function zoomTo(hours, beat) {
    while (frameNo() < fAt(beat)) {
      if (frameNo() % 6 === 0) {
        const h = await visHours();
        if (h === null || h > hours) await page.mouse.wheel({ deltaY: -12 });
      }
      await shot();
    }
  }
  // Waits in real time for aw-webui's queries, stepping the clock a little so rAF-driven work isn't stuck.
  async function settle(ms = 2500) {
    const end = Date.now() + ms;
    while (Date.now() < end) { await page.evaluate(() => window.__clock.step(0)); await sleep(100); }
  }
  const quiet = () => page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});

  // Real "Date range" mode of aw-webui's time interval input: click it, type the demo day into both dates, Apply.
  async function dateRange(beat) {
    await move(center(await need(() => rect('Date range'), 'date range')), beat);
    await click();
    await play(beat + 1);
    const order = await page.evaluate(() => new Intl.DateTimeFormat(navigator.language).formatToParts(new Date(2026, 8, 25))
      .filter(p => p.type !== 'literal').map(p => p.type));
    const digits = order.map(t => ({ day: '25', month: '09', year: '2026' })[t]).join('');
    const dates = await page.evaluate(() => [...document.querySelectorAll('input[type=date]')].filter(e => e.getClientRects().length)
      .map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    for (const [i, d] of dates.entries()) {
      await move([d[0] + 22, d[1] + d[3] / 2], beat + 2 + i * 3);
      await click();
      await type(digits, 1);
      await play(beat + 4 + i * 3);
    }
    await move(center(await need(() => rect('Apply'), 'apply')), beat + 9);
    await click();
    await play(beat + 10);
    await quiet();
  }

  // Hover a timeline block, capture until vis-timeline's tooltip shows, read it, then rest there until `rest`.
  async function hoverTip(point, arrive, name, rest) {
    await move(point, arrive);
    for (let i = 0; i < 45; i++) {
      await shot();
      if (await page.evaluate(() => !!document.querySelector('.vis-tooltip')?.innerText.trim())) break;
    }
    await shot();
    await note(name, () => document.querySelector('.vis-tooltip')?.innerText);
    await mark(name, (await rectOf('.vis-tooltip')) || [point[0], point[1], 1, 1]);
    hold(rest);
  }

  // ---------- setup ----------
  await resetSettings();
  await page.goto(BASE + '/#/home');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('initialTimestamp', String(Math.floor(Date.now() / 1000) - 90 * 86400));
    localStorage.setItem('userSatisfactionPollState', JSON.stringify({ isEnabled: false }));
  });

  try {
  // ======================= A. Activity · Summary =======================
  await page.goto(`${BASE}/#/activity/macbook/day/${DAY}/view/`, { waitUntil: 'networkidle0' });
  await quiet();
  await sleep(1500);
  await page.mouse.move(cur.x, cur.y);
  marker('summary');
  await note('timeActive', () => [...document.querySelectorAll('li')].find(l => l.textContent.includes('Time active'))?.querySelector('span')?.textContent.trim());
  await mark('header', await need(() => rect('Activity', { closest: 'h3' }), 'h3'));
  await mark('topApps', await need(() => rect('Top Applications', { closest: '.col-md-6' }), 'top apps'));
  await mark('topTitles', await need(() => rect('Top Window Titles', { closest: '.col-md-6' }), 'top titles'));
  await mark('barchart', await need(() => rect('Timeline (barchart)', { closest: '.col-md-6' }), 'barchart'));
  await mark('topCats', await need(() => rect('Top Categories', { closest: '.col-md-6' }), 'top cats'));
  await mark('catTree', await need(() => rect('Category Tree', { closest: '.col-md-6' }), 'cat tree'));
  await mark('sunburst', await need(() => rect('Category Sunburst', { closest: '.col-md-6' }), 'sunburst'));
  await mark('toolbar', await need(() => rectOf('.activity-toolbar'), 'toolbar'));
  await note('catValues', () => Object.fromEntries([...document.querySelectorAll('.category-row')].map(r =>
    [r.querySelector('.category-title').textContent.trim(), r.querySelector('.category-value').textContent.trim()])));
  await note('topApps', () => {
    const h = [...document.querySelectorAll('h5')].find(x => x.textContent.trim() === 'Top Applications');
    return h.closest('.col-md-6').innerText.split('\n').slice(1, 11);
  });
  await note('topTitles', () => {
    const h = [...document.querySelectorAll('h5')].find(x => x.textContent.trim() === 'Top Window Titles');
    return h.closest('.col-md-6').innerText.split('\n').slice(1, 11);
  });
  await play(8);                               // the page's charts animate in
  hold(24);                                    // camera explores apps, titles, barchart
  // Category Tree: expand Work
  const workRow = await need(() => rect('Work', { closest: '.category-row', within: '.category-row' }), 'work row');
  await move(center(workRow), 27);
  await click();
  await play(29);
  await mark('catTreeOpen', await need(() => rect('Category Tree', { closest: '.col-md-6' }), 'cat tree'));
  hold(31);
  // Sunburst: hover the Uncategorized slice
  const uncat = await need(() => slicePoint('Uncategorized'), 'uncategorized slice');
  await move(uncat, 34);
  await play(35);
  await note('uncatHover', () => document.querySelector('.explanation')?.innerText || [...document.querySelectorAll('div')].find(d => d.textContent.startsWith('Uncategorized') && d.childElementCount >= 2)?.innerText);
  hold(40);
  // Period: 7 days, then 30 days
  marker('periods');
  await move(center(await need(() => rect('7 days', { within: '.activity-toolbar' }), '7 days')), 43);
  await click();
  await play(44);
  await quiet();
  await play(50);
  await note('week', () => ({ title: document.querySelector('h3')?.innerText, active: [...document.querySelectorAll('li')].find(l => l.textContent.includes('Time active'))?.querySelector('span')?.textContent.trim() }));
  await move(center(await need(() => rect('30 days', { within: '.activity-toolbar' }), '30 days')), 51);
  await click();
  await play(52);
  await quiet();
  await play(58);
  await note('month', () => ({ title: document.querySelector('h3')?.innerText, active: [...document.querySelectorAll('li')].find(l => l.textContent.includes('Time active'))?.querySelector('span')?.textContent.trim() }));
  await move(center(await need(() => rect('day', { within: '.activity-toolbar' }), 'day')), 59);
  await click();
  await play(60);
  await quiet();
  await play(64);
  // Filters
  await move(center(await need(() => rect('Filters', { within: '.activity-toolbar', exact: false }), 'filters')), 65);
  await click();
  await play(67);
  await note('filters', () => {
    const t = [...document.querySelectorAll('.activity-toolbar ~ *, .card, .collapse.show, form')].find(e => e.offsetParent && /categor/i.test(e.innerText));
    return t ? t.innerText.slice(0, 400) : null;
  });
  await mark('filtersPanel', (await page.evaluate(() => {
    const el = [...document.querySelectorAll('.collapse.show, .card, .dropdown-menu.show')].find(e => e.offsetParent && /categor|afk/i.test(e.innerText));
    if (!el) return null;
    const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
  })) || [415, 200, 1090, 200]);
  hold(72);
  await move(center(await need(() => rect('Filters', { within: '.activity-toolbar', exact: false }), 'filters')), 73);
  await click();
  await play(74);

  // ======================= B. Timeline =======================
  await move(center(await need(() => rect('Timeline', { within: '.navbar' }), 'nav timeline')), 77);
  await click();
  marker('timeline');
  await play(78);
  await quiet();
  await play(80);
  await dateRange(82);
  await play(96);
  await mark('vis', await need(() => rectOf('.vis-timeline'), 'vis'));
  await note('visAxis', () => Object.fromEntries([...document.querySelectorAll('.vis-time-axis .vis-text.vis-minor')].map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().x)])));
  // Rows are listed in label order; items live in the matching foreground group.
  const items = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.vis-labelset .vis-label')].map(l => l.innerText.trim());
    const groups = [...document.querySelectorAll('.vis-foreground .vis-group')];
    return labels.map((label, i) => ({ label, items: [...(groups[i]?.querySelectorAll('.vis-item') || [])].map(it => {
      const r = it.getBoundingClientRect(); return { text: it.innerText.trim(), r: [r.x, r.y, r.width, r.height] };
    }) }));
  });
  M.texts.visRows = items.map(g => g.label);
  const axisX = h => M.texts.visAxis[h];
  const afkRow = items.find(g => g.label === 'afk');
  const lunch = afkRow.items.filter(it => it.text === 'afk' && it.r[0] > axisX('12:00') - 40 && it.r[0] < axisX('13:00'))
    .sort((a, b) => b.r[2] - a.r[2])[0];
  const winRow = items.find(g => g.label === 'window');
  const evening = winRow.items.filter(it => it.r[0] > axisX('20:00')).sort((a, b) => b.r[2] - a.r[2])[0];
  await mark('afkRow', [items.length ? afkRow.items[0].r[0] : 0, must(lunch, 'lunch afk').r[1], 1, lunch.r[3]]);
  await mark('lunch', lunch.r);
  await mark('evening', must(evening, 'evening window event').r);
  hold(104);
  // hover the lunch break, then the evening
  await hoverTip(center(lunch.r), 107, 'lunchTip', 114);
  await hoverTip(center(evening.r), 117, 'eveningTip', 124);
  // zoom into the early afternoon
  marker('zoom');
  const zx = axisX('14:00') + 40, zy = afkRow.items[0].r[1] + 60;
  await move([zx, zy], 127);
  await zoomTo(2.2, 135);
  await play(137);
  await note('zoomAxis', () => [...document.querySelectorAll('.vis-time-axis .vis-text.vis-minor')].map(e => e.textContent.trim()).slice(0, 12));
  M.texts.zoomHours = await visHours();
  hold(142);

  // ======================= C. Category rules =======================
  await move(center(await need(() => rect('Settings', { within: '.navbar' }), 'nav settings')), 145);
  await click();
  marker('settings');
  await play(147);
  await move(center(await need(() => rect('Categorization', { closest: 'a,button,li,.list-group-item' }), 'categorization')), 150);
  await click();
  await play(152);
  await quiet();
  await play(154);
  await mark('categories', await need(() => rect('Categories', { closest: 'div' }), 'categories heading'));
  await mark('catList', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.row.class')].filter(r => r.offsetParent);
    const a = rows[0].getBoundingClientRect(), b = rows[Math.min(rows.length - 1, 13)].getBoundingClientRect();
    return [a.x, a.y, a.width, b.bottom - a.y];
  }));
  const workPlus = await page.evaluate(() => {
    const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const row = [...document.querySelectorAll('.row.class')].find(r => [...r.querySelectorAll('span')].some(s => own(s) === 'Work'));
    const b = row.querySelector('.btn-outline-success').getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return { plus: [b.x, b.y, b.width, b.height], row: [rr.x, rr.y, rr.width, rr.height] };
  });
  await mark('workRow', workPlus.row);
  hold(162);
  marker('addRule');
  await move(center(workPlus.plus), 165);
  await click();
  await play(167);
  await mark('modal', await need(() => rectOf('.modal-content'), 'modal'));
  const nameInput = await need(() => page.evaluate(() => {
    const e = document.querySelector('.modal input.form-control'); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
  }), 'name input');
  const patternInput = await need(() => page.evaluate(() => {
    const g = [...document.querySelectorAll('.modal .input-group')].find(g => g.innerText.trim().startsWith('Pattern'));
    const r = g.querySelector('input').getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
  }), 'pattern input');
  await mark('nameInput', nameInput);
  await mark('patternInput', patternInput);
  hold(170);
  await move([nameInput[0] + 120, nameInput[1] + nameInput[3] / 2], 172);
  await click({ count: 3 });
  await type('Design', 2);
  await play(176);
  await move([patternInput[0] + 120, patternInput[1] + patternInput[3] / 2], 178);
  await click({ count: 3 });
  await type('Figma', 2);
  await play(182);
  await move(center(await need(() => rect('OK', { within: '.modal-footer' }), 'ok')), 185);
  await click();
  await play(187);
  await mark('unsaved', await need(() => rect('You have unsaved changes!', { closest: '.alert', exact: false }), 'unsaved alert'));
  await mark('designRow', await need(() => rect('Design', { closest: '.row.class' }), 'design row'));
  hold(190);
  await move(center(await need(() => rect('Save', { within: '.alert' }), 'save')), 193);
  await click();
  await play(195);
  await quiet();
  await play(197);

  // back to the same Friday, now re-categorized
  await move(center(await need(() => rect('Activity', { within: '.navbar' }), 'nav activity')), 200);
  await click();
  marker('recat');
  await play(202);
  await quiet();
  const back = Math.round((new Date(new Date().toDateString()) - new Date(2026, 8, 25)) / 864e5);
  const prev = await need(() => rectOf('[aria-label="Previous day"]'), 'prev day');
  M.texts.daysBack = back;
  if (back > 0 && back <= 4) {
    for (let i = 0; i < back; i++) {
      await move(center(prev), 204 + i * 2);
      await click();
      await play(205 + i * 2);
      await quiet();
    }
  } else if (back !== 0) {
    // too far to step through on camera: the same view, reached by URL
    await page.goto(`${BASE}/#/activity/macbook/day/${DAY}/view/`);
    await quiet();
  }
  await play(214);
  await note('catValuesAfter', () => Object.fromEntries([...document.querySelectorAll('.category-row')].map(r =>
    [r.querySelector('.category-title').textContent.trim(), r.querySelector('.category-value').textContent.trim()])));
  await note('topAppsAfter', () => {
    const h = [...document.querySelectorAll('h5')].find(x => x.textContent.trim() === 'Top Applications');
    return h.closest('.col-md-6').innerText.split('\n').slice(1, 11);
  });
  await note('titleAfter', () => document.querySelector('h3')?.innerText);
  const design = await slicePoint('Design');
  M.texts.designSlice = !!design;
  if (design) {
    await move(design, 218);
    await play(220);
    await note('designHover', () => [...document.querySelectorAll('div')].find(d => d.textContent.startsWith('Work') && d.textContent.includes('Design') && d.childElementCount >= 2 && d.childElementCount <= 5)?.innerText);
  }
  hold(226);

  // ======================= D. Your data =======================
  await move(center(await need(() => rect('Raw Data', { within: '.navbar' }), 'nav raw data')), 229);
  await click();
  marker('data');
  await play(231);
  await quiet();
  await play(233);
  await mark('bucketCard', await need(() => rectOf('.card'), 'bucket card'));
  await mark('bucketRows', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')].filter(r => /aw-watcher-(afk|window|web)/.test(r.innerText));
    const a = rows[0].getBoundingClientRect(), b = rows[rows.length - 1].getBoundingClientRect();
    return [a.x, a.y, a.width, b.bottom - a.y];
  }));
  await note('buckets', () => [...document.querySelectorAll('tr')].map(r => r.innerText.split('\t')[0].trim()).filter(t => t.startsWith('aw-')));
  hold(238);
  const openWin = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes('aw-watcher-window_macbook'));
    const b = [...row.querySelectorAll('a,button')].find(x => x.innerText.trim() === 'Open').getBoundingClientRect();
    return [b.x, b.y, b.width, b.height];
  });
  await move(center(openWin), 241);
  await click();
  marker('bucket');
  await play(243);
  await quiet();
  await dateRange(244);
  await play(258);
  await mark('bucketInfo', await need(() => rectOf('.container h3, h3'), 'bucket heading'));
  await mark('events', await need(() => page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent.trim() === 'Events');
    if (!h) return null;
    const card = h.closest('.card') || h.parentElement.parentElement;
    const r = card.getBoundingClientRect(); return [r.x, r.y, r.width, Math.min(r.height, 520)];
  }), 'events card'));
  await note('bucketEvents', () => [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /Showing \d+ events/.test(e.textContent))?.textContent.trim());
  hold(264);
  await move(center(await need(() => rect('Raw Data', { within: '.navbar' }), 'nav raw data')), 267);
  await click();
  await play(269);
  await quiet();
  await play(270);
  const exportBtn = await need(() => rect('Export all buckets as JSON', { closest: 'button' }), 'export button');
  await mark('exportBtn', exportBtn);
  await mark('exportCard', await need(() => rect('Import and export buckets', { closest: 'div' }), 'export heading'));
  await move(center(exportBtn), 273);
  await click();
  marker('export');
  await play(275);
  for (let i = 0; i < 100 && !fs.readdirSync(path.join(OUT, 'download')).some(f => f.endsWith('.json')); i++) await sleep(200);
  await play(280);
  marker('end');

  // the real exported file, for the closing shot
  const file = fs.readdirSync(path.join(OUT, 'download')).find(f => f.endsWith('.json'));
  if (file) {
    const data = JSON.parse(fs.readFileSync(path.join(OUT, 'download', file), 'utf8'));
    const win = data.buckets['aw-watcher-window_macbook'];
    const ev = win.events.find(e => e.data.app === 'Figma') || win.events[0];
    M.texts.exportFile = file;
    M.texts.exportLines = JSON.stringify({ buckets: { 'aw-watcher-window_macbook': {
      id: win.id, type: win.type, client: win.client, hostname: win.hostname, events: [ev, '…'] } } }, null, 2)
      .replace('"…"', '…').split('\n');
    M.texts.exportCounts = Object.fromEntries(Object.entries(data.buckets).map(([k, b]) => [k, b.events.length]));
  }

  } finally {
    // written even if a step fails, so a partial run can be reviewed
    M.uniqueFrames = files;
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(M));
    // tour.html runs from file://, where fetch() is blocked, so it loads this as a script
    fs.writeFileSync(path.join(OUT, 'manifest.js'), 'window.MANIFEST = ' + JSON.stringify(M) + ';\n');
  }
  console.log(`\n${M.frames.length} frames (${(M.frames.length / FPS).toFixed(1)}s), ${files} unique`);
  console.log(JSON.stringify({ markers: M.markers, texts: M.texts }, null, 1));
  // leave the demo server as a fresh install again
  await resetSettings();
  await browser.close();
})();

// Screenshots the real aw-webui (served by the demo aw-server from demo-data.js) for the "real UI" video.
// Only /api/0/info is rewritten, so the footer shows the demo hostname instead of the machine running the server.
// --dark captures with a dark OS color scheme (aw-webui's default "System" theme follows it) into webui-dark/.
// Usage: node capture-webui.js [http://localhost:5699] [--dark] [shotName ...]
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2] : 'http://localhost:5699';
const DARK = process.argv.includes('--dark');
const OUT = DARK ? 'webui-dark' : 'webui';
const only = process.argv.slice(2).filter(a => !a.startsWith('http') && !a.startsWith('--'));
const DAY = '2026-09-25';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// [name, hash route, optional async (page) => {} to run before the shot, optional {fullPage}]
// Headless loads can race the barchart query; pressing the page's own Refresh button redraws it.
const refresh = async page => {
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Refresh')?.click());
  await sleep(5000);
};

// Uses the Timeline page's own "Date range" mode to show the demo day.
const timelineDay = async page => {
  await page.evaluate(day => {
    [...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Date range').click();
  }, DAY);
  await sleep(500);
  await page.evaluate(day => {
    for (const el of document.querySelectorAll('input[type=date]')) { el.value = day; el.dispatchEvent(new Event('input')); }
  }, DAY);
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Apply').click());
  await sleep(5000);
};

// Records where named elements sit in each screenshot (CSS px), so the video can point at real UI.
// Each mark is text to find (exact match on the smallest element), optionally with a CSS selector the match is widened to.
const MARKS = {
  nav: [['Activity'], ['Timeline'], ['Stopwatch'], ['Raw Data'], ['Settings'], ['Tools']],
  activity: [['Summary'], ['Window'], ['Browser'], ['day'], ['Time active:', 'div'],
    ['Top Applications', '.p-3'], ['Top Window Titles', '.p-3'], ['Timeline (barchart)', '.p-3'],
    ['Top Categories', '.p-3'], ['Category Tree', '.p-3'], ['Category Sunburst', '.p-3'],
    ['Top Browser Domains', '.p-3'], ['Top Browser URLs', '.p-3'], ['Top Browser Titles', '.p-3']],
  timeline: [['afk'], ['web-chrome'], ['window'], ['Date range'], ['Filters: none', 'summary'], ['.vis-timeline']],
  settings: [['Categorization'], ['Categories'], ['Category set:', 'div'], ['Restore defaults']],
  buckets: [['Buckets'], ['aw-watcher-window_macbook', 'tr'], ['aw-watcher-afk_macbook', 'tr'], ['aw-watcher-web-chrome_macbook', 'tr'],
    ['Export all buckets as JSON', 'button'], ['Import and export buckets'], ['.card']],
};
async function measure(page, groups) {
  return page.evaluate(specs => {
    const out = {};
    const all = [...document.querySelectorAll('body *')];
    for (const [text, widen] of specs) {
      let el;
      if (text.startsWith('.') && !widen) el = document.querySelector(text);
      else {
        const hits = all.filter(e => e.textContent.trim() === text || (text.endsWith(':') && e.textContent.trim().startsWith(text) && e.children.length < 4));
        // The innermost match, first in document order.
        el = hits.find(h => !hits.some(o => o !== h && h.contains(o)));
        if (el && widen) el = el.closest(widen) || el;
      }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[text] = [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)];
    }
    return out;
  }, groups.flatMap(g => MARKS[g]));
}

const SHOTS = [
  ['home', '/home'],
  ['activity-day', `/activity/macbook/day/${DAY}/view/`, refresh, { height: 1300, marks: ['activity'] }],
  ['activity-window', `/activity/macbook/day/${DAY}/view/window`, refresh, { height: 1300, marks: ['activity'] }],
  ['activity-browser', `/activity/macbook/day/${DAY}/view/browser`, refresh, { height: 1300, marks: ['activity'] }],
  ['activity-week', `/activity/macbook/week/${DAY}/view/`, refresh, { height: 1300 }],
  ['timeline', '/timeline', timelineDay, { marks: ['timeline'] }],
  ['buckets', '/buckets', null, { marks: ['buckets'] }],
  ['stopwatch', '/stopwatch'],
  ['settings', '/settings', null, { height: 1300 }],
  ['settings-categorization', '/settings/categorization', null, { height: 1300, marks: ['settings'] }],
  ['trends', '/trends/macbook', null, { height: 1300 }],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.emulateTimezone('Africa/Nairobi');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }]);
  await page.setRequestInterception(true);
  page.on('request', async req => {
    if (req.url().endsWith('/api/0/info')) {
      const info = { hostname: 'macbook', version: 'v0.14.0 (rust)', testing: false, device_id: 'demo' };
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(info) });
    }
    req.continue();
  });
  // Dismiss first-run nags so they don't cover the UI.
  await page.goto(BASE + '/#/home');
  await page.evaluate(() => {
    localStorage.setItem('initialTimestamp', String(Math.floor(Date.now() / 1000) - 90 * 86400));
    localStorage.setItem('userSatisfactionPollState', JSON.stringify({ isEnabled: false }));
  });
  const marksFile = `${OUT}/marks.json`;
  const marks = fs.existsSync(marksFile) ? JSON.parse(fs.readFileSync(marksFile)) : {};
  for (const [name, route, before, opts = {}] of SHOTS) {
    if (only.length && !only.includes(name)) continue;
    // Tall viewport rather than fullPage screenshots: resizing mid-shot restarts Chart.js's grow-in animation.
    await page.setViewport({ width: 1920, height: opts.height || 1080, deviceScaleFactor: 2 });
    await page.goto(BASE + '/#' + route, { waitUntil: 'networkidle0' });
    await sleep(7000);
    if (before) await before(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    marks[name] = await measure(page, ['nav', ...(opts.marks || [])]);
    console.log('shot', name);
  }
  fs.writeFileSync(marksFile, JSON.stringify(marks, null, 1));
  await browser.close();
})();

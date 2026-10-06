// Renders a page frame-by-frame with headless Chrome and pipes the PNGs to ffmpeg, muxing its soundtrack WAV if present.
// Frames are drawn in parallel across several tabs (render(t) is stateless) and written to ffmpeg in order.
// Usage: node render.js [out.mp4] [--page index.html] [--audio music.wav] [--workers 4] [--fps 30] [--stills 1,4.5,8]
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const out = args.find(a => a.endsWith('.mp4')) || 'activitywatch-promo.mp4';
const pageFile = opt('--page', 'index.html');
const audio = path.resolve(__dirname, opt('--audio', 'music.wav'));
const workers = Number(opt('--workers', 4));
const fps = Number(opt('--fps', 30));
const stills = opt('--stills', null);

(async () => {
  const started = Date.now();
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--force-device-scale-factor=1', '--allow-file-access-from-files'],
  });
  // One tab per worker, each in its own browser context so it gets its own renderer process.
  const tabs = await Promise.all(Array.from({ length: stills ? 1 : workers }, async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('file://' + path.resolve(__dirname, pageFile) + '?capture', { waitUntil: 'networkidle0' });
    await page.evaluate(() => window.ready);
    return page;
  }));

  // render(t) may return a promise (pages that stream frames from disk)
  const grab = (page, t) => page.evaluate(async t => {
    await window.render(t);
    return document.getElementById('c').toDataURL('image/png').split(',')[1];
  }, t);

  if (stills) {
    const base = path.basename(pageFile, '.html');
    fs.mkdirSync('stills', { recursive: true });
    for (const s of stills.split(',').map(Number)) {
      fs.writeFileSync(`stills/${base}-t${s.toFixed(2)}.png`, Buffer.from(await grab(tabs[0], s), 'base64'));
    }
    await browser.close();
    return;
  }

  const duration = await tabs[0].evaluate(() => window.DURATION);
  const frames = Math.round(duration * fps);
  const audioIn = fs.existsSync(audio) ? ['-i', audio] : [];
  const audioOut = audioIn.length ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
  const ff = spawn(require('ffmpeg-static'), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...audioIn,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', ...audioOut, '-movflags', '+faststart', out],
    { stdio: ['pipe', 'ignore', 'inherit'] });

  // Keep two frames in flight per tab; frame f always goes to tab f % workers.
  const ahead = tabs.length * 2;
  const pending = new Map();
  const request = f => pending.set(f, grab(tabs[f % tabs.length], f / fps));
  for (let f = 0; f < Math.min(ahead, frames); f++) request(f);
  for (let f = 0; f < frames; f++) {
    const buf = Buffer.from(await pending.get(f), 'base64');
    pending.delete(f);
    if (f + ahead < frames) request(f + ahead);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 30 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  const secs = (Date.now() - started) / 1000;
  console.log(`\nwrote ${out}${audioIn.length ? ` with ${path.basename(audio)}` : ''} in ${secs.toFixed(1)}s (${(frames / secs).toFixed(1)} fps)`);
})();

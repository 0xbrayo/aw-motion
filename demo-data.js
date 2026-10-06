// Seeds an isolated aw-server with three weeks of fictional activity for host "macbook",
// so the real aw-webui can be screen-captured without exposing anyone's actual data.
// Titles are chosen to hit aw-webui's default category rules (Work/Programming/ActivityWatch, Comms/IM, Media/Music, ...).
// Usage: node demo-data.js [http://localhost:5699]
const API = (process.argv[2] || 'http://localhost:5699') + '/api/0';
const HOST = 'macbook';

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const r = rng(42);
const pick = a => a[Math.floor(r() * a.length)];
const between = (a, b) => a + r() * (b - a);

// Each activity: window app + titles, optional browser url.
const A = {
  code: { app: 'Code', titles: ['timeline.ts — aw-webui', 'Activity.vue — aw-webui', 'queries.ts — aw-webui', 'main.rs — aw-server-rust', 'README.md — aw-watcher-window'] },
  term: { app: 'iTerm2', titles: ['vim src/queries.ts', 'cargo test — aw-server-rust', 'npm run serve — aw-webui', 'git log --oneline'] },
  github: { app: 'Google Chrome', web: [
    ['https://github.com/ActivityWatch/aw-webui/pull/612', 'Improve timeline rendering · Pull Request #612 · ActivityWatch/aw-webui · GitHub'],
    ['https://github.com/ActivityWatch/activitywatch/issues', 'Issues · ActivityWatch/activitywatch · GitHub'],
    ['https://stackoverflow.com/questions/tagged/vue.js', "Newest 'vue.js' Questions - Stack Overflow"],
  ] },
  docs: { app: 'Google Chrome', web: [
    ['https://docs.google.com/document/d/q3-roadmap', 'Q3 roadmap - Google Docs'],
    ['https://docs.google.com/document/d/design-notes', 'Design notes - Google Docs'],
  ] },
  slack: { app: 'Slack', titles: ['Slack | #general | Acme', 'Slack | #dev | Acme', 'Slack | Huddle | Acme'] },
  mail: { app: 'Google Chrome', web: [['https://mail.google.com/mail/u/0/#inbox', 'Inbox (4) - Gmail']] },
  youtube: { app: 'Google Chrome', web: [
    ['https://www.youtube.com/watch?v=conf-talk', 'Building local-first software - YouTube'],
    ['https://www.youtube.com/watch?v=lofi', 'lofi beats to code to - YouTube'],
  ] },
  reddit: { app: 'Google Chrome', web: [['https://www.reddit.com/r/programming/', 'r/programming - reddit']] },
  spotify: { app: 'Spotify', titles: ['Spotify Premium', 'Focus Flow - Spotify'] },
  inkscape: { app: 'Inkscape', titles: ['logo-draft.svg - Inkscape'] },
  // No default category rule matches Figma, so it starts out Uncategorized (the tour fixes that on camera).
  figma: { app: 'Figma', titles: ['Dashboard redesign – Figma', 'Onboarding flow – Figma'] },
  finder: { app: 'Finder', titles: ['Downloads', 'Documents'] },
};

// Workday blocks: [startHour, endHour, weighted activity mix]. Gaps between blocks are AFK.
const workday = [
  [8.9, 9.4, { slack: 4, mail: 3, github: 2 }],
  [9.4, 11.1, { code: 8, term: 4, github: 3, slack: 1 }],
  [11.2, 12.4, { figma: 6, docs: 3, slack: 2, inkscape: 1 }],
  [13.2, 13.9, { slack: 5, mail: 2, reddit: 1 }],
  [13.9, 16.2, { code: 8, term: 3, github: 3, spotify: 1, finder: 1 }],
  [16.4, 17.6, { github: 4, code: 3, figma: 3, slack: 2 }],
  [20.2, 21.3, { youtube: 5, reddit: 3, spotify: 1 }],
];
const weekend = [
  [10.5, 11.4, { reddit: 3, youtube: 3, mail: 1 }],
  [15.0, 16.1, { code: 4, github: 3, youtube: 2 }],
];

function weighted(mix) {
  const tot = Object.values(mix).reduce((a, b) => a + b, 0);
  let x = r() * tot;
  for (const [k, w] of Object.entries(mix)) { if ((x -= w) <= 0) return k; }
  return Object.keys(mix)[0];
}

const window = [], afk = [], web = [];
// Fixed dates (not "today") so the story told on screen stays true whenever this is re-run.
const today = new Date(2026, 8, 27);
for (let d = 21; d >= 1; d--) {
  const day = new Date(today.getTime() - d * 864e5);
  const dow = day.getDay();
  const blocks = dow === 0 || dow === 6 ? weekend : workday;
  let lastEnd = null;
  for (const [h0, h1, mix] of blocks) {
    let t = day.getTime() + (h0 + between(-0.15, 0.15)) * 36e5;
    const end = day.getTime() + (h1 + between(-0.15, 0.15)) * 36e5;
    if (lastEnd !== null) afk.push({ timestamp: new Date(lastEnd).toISOString(), duration: (t - lastEnd) / 1e3, data: { status: 'afk' } });
    afk.push({ timestamp: new Date(t).toISOString(), duration: (end - t) / 1e3, data: { status: 'not-afk' } });
    lastEnd = end;
    while (t < end) {
      const key = weighted(mix);
      const a = A[key];
      const long = key === 'code' || key === 'youtube' || key === 'docs' || key === 'figma';
      const dur = Math.min(end - t, between(long ? 180 : 40, long ? 1500 : 480) * 1e3);
      const ts = new Date(t).toISOString();
      if (a.web) {
        const [url, title] = pick(a.web);
        window.push({ timestamp: ts, duration: dur / 1e3, data: { app: a.app, title } });
        web.push({ timestamp: ts, duration: dur / 1e3, data: { url, title, audible: key === 'youtube', incognito: false, tabCount: 7 } });
      } else {
        window.push({ timestamp: ts, duration: dur / 1e3, data: { app: a.app, title: pick(a.titles) } });
      }
      t += dur + between(1, 4) * 1e3;
    }
  }
}

async function call(method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!res.ok && res.status !== 304) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
}

(async () => {
  const buckets = [
    ['aw-watcher-window_' + HOST, 'currentwindow', 'aw-watcher-window', window],
    ['aw-watcher-afk_' + HOST, 'afkstatus', 'aw-watcher-afk', afk],
    ['aw-watcher-web-chrome_' + HOST, 'web.tab.current', 'aw-client-web', web],
  ];
  for (const [id, type, client, events] of buckets) {
    await fetch(API + '/buckets/' + id, { method: 'DELETE' }).catch(() => {});
    await call('POST', '/buckets/' + id, { client, type, hostname: HOST });
    for (let i = 0; i < events.length; i += 500) await call('POST', `/buckets/${id}/events`, events.slice(i, i + 500));
    console.log(`${id}: ${events.length} events`);
  }
})();

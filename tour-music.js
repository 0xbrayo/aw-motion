// Soundtrack for tour.html: 112 BPM in D major, cut to the recording in tour/manifest.json.
// Timing mirrors tour.js (16-beat cold open, the recording, a 12-beat JSON payoff, a 16-beat outro), and every real
// click in the recording gets a click sound on its exact frame.
// Chapters: cold open · Activity · Timeline · Categories (breakdown while the rule is typed, drop on the re-sort) · Your data.
// Usage: node tour-music.js [tour-music.wav]
const fs = require('fs');
const { SR, clamp, reverse, session } = require('./synth');

const out = process.argv[2] || 'tour-music.wav';
const M = JSON.parse(fs.readFileSync('tour/manifest.json', 'utf8'));
const BEAT = 60 / 112, FPS = 30;
const INTRO = 16, PAYOFF = 12, OUTRO = 16;
const REC_BEATS = M.frames.length / FPS / BEAT;
const END = Math.ceil((INTRO + REC_BEATS) / 4) * 4;
const DURATION = (END + PAYOFF + OUTRO) * BEAT + 0.4;
const bt = (bar, beat = 0) => (bar * 4 + beat) * BEAT;   // video bars
const rt = recBeat => (INTRO + recBeat) * BEAT;         // rec beats -> seconds
const rbar = recBeat => (INTRO + recBeat) / 4;          // rec beat -> video bar
const frameT = f => INTRO * BEAT + f / FPS;

const {
  rand, B, place, duckAt, gap, mixdown,
  kick, snare, hat, crash, tick, blip, bell, pluck, bass, saws, whoosh, riser, impact,
} = session({ duration: DURATION, seed: 2509 });

// ---------- harmony ----------
const CH = {
  D: [54, 57, 61, 64], Bm: [54, 57, 61, 62], G: [54, 57, 59, 62], A: [55, 57, 61, 64], Em: [55, 59, 62, 66],
  Dbig: [38, 50, 54, 57, 61, 64, 69],
};
const ROOT = { D: 38, Bm: 35, G: 31, A: 33, Em: 40 };
const MOTIF = { D: [78, 76, 73], Bm: [74, 73, 69], G: [74, 71, 69], A: [73, 76, 81], Em: [74, 71, 67] };

const K = (t, g = 1, o) => { place(kick(o), t, { to: B.drums, gain: 0.66 * g }); duckAt(t, 0.6 * Math.min(1, g), 0.26); };
const CLAP = (t, g = 1) => { place(snare({ tone: 220, body: 0.2 }), t, { to: B.drums, gain: 0.34 * g, rev: 0.35, pan: 0.05 }); duckAt(t, 0.15 * g, 0.16); };
const HAT = (t, g = 1, open = false) => place(hat({ open }), t, { to: B.drums, gain: 0.24 * g, pan: open ? -0.25 : 0.22 });
const pad = (notes, t0, len, o, gain, rev = 0.2) => place(saws(notes, len, o), t0, { to: B.duck, gain, rev });
const low = (m, t0, len, gain = 0.28, o) => place(bass(m, len, o), t0, { to: B.duck, gain });
const ding = (m, t, gain = 0.08, pan = 0, decay = 0.6) => place(bell(m, { decay }), t, { gain, pan, rev: 0.35, dly: 0.2 });

function groove(bar, name, o = {}) {
  const {
    kicks = true, claps = true, hats = true, shaker = false, bassline = true, keys = true,
    padGain = 0.2, cutoff = 3000, lead = false, arp = false, hatGain = 1,
  } = o;
  const at = k => bt(bar, k / 4);
  if (kicks) for (let b = 0; b < 4; b++) K(bt(bar, b), b === 0 ? 1 : 0.85);
  if (claps) { CLAP(bt(bar, 1)); CLAP(bt(bar, 3)); }
  if (hats) for (let b = 0; b < 4; b++) HAT(bt(bar, b + 0.5), hatGain, b === 3);
  if (shaker) for (let k = 1; k < 16; k += 2) place(hat(), at(k), { to: B.drums, gain: 0.05 * hatGain, pan: -0.3 });
  if (bassline) [0, 3, 6, 10, 14].forEach((k, i) => low(ROOT[name] + (i === 4 ? 12 : 0), at(k), BEAT * (i === 2 ? 0.9 : 0.45), 0.27));
  else low(ROOT[name], bt(bar), BEAT * 4 - 0.02, 0.22, { rel: 0.1 });
  if (padGain) pad(CH[name], bt(bar), BEAT * 4, { a: 0.05, d: 0.5, s: 0.8, rel: 0.25, cutoff: () => cutoff, detune: 18 }, padGain);
  if (keys) for (const k of [2, 7, 10]) {
    pad(CH[name].map(m => m + 12), at(k), 0.12, { a: 0.002, d: 0.18, s: 0, rel: 0.08, voices: 4, detune: 10, cutoff: t => Math.min(cutoff * 1.4, 700 + 4000 * Math.exp(-t / 0.06)) }, 0.28, 0.3);
  }
  if (lead) MOTIF[name].forEach((m, i) => {
    const t = bt(bar, [0, 1.5, 3][i]);
    place(pluck(m, { decay: 0.25, bright: 3000 }), t, { to: B.duck, gain: 0.17, pan: -0.1, dly: 0.35, rev: 0.2 });
    ding(m + 12, t, 0.045, 0.25, 0.5);
  });
  if (arp) for (let k = 0; k < 16; k++) {
    const tones = CH[name].map(m => m + 12), m = tones[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]];
    place(pluck(m, { decay: 0.1, bright: 2600 }), at(k), { to: B.duck, gain: 0.065 * (k % 4 === 0 ? 1 : 0.7), pan: k % 2 ? 0.35 : -0.35, dly: 0.15 });
  }
}
const fill = (bar, from = 12, g = 0.55) => {
  for (let k = from; k < 16; k++) place(snare({ tone: 170 + 6 * k }), bt(bar, k / 4), { to: B.drums, gain: 0.4 * g * (0.5 + 0.5 * (k - from) / (16 - from)), rev: 0.25 });
};
// A chapter change: riser into a crash on the downbeat.
const lift = (bar, g = 1) => {
  place(riser(BEAT * 4, { m0: 52, f1: 9000 }), bt(bar - 1), { gain: 0.2 * g, rev: 0.1 });
  place(crash({ decay: 1.0 }), bt(bar), { gain: 0.17 * g, rev: 0.15 });
};
// Plays a chord loop across bars [from, to) with per-bar options.
function section(from, to, loop, opts = () => ({})) {
  for (let bar = Math.floor(from); bar < to; bar++) groove(bar, loop[(bar - Math.floor(from)) % loop.length], opts(bar - Math.floor(from), bar));
}

// ---------- cold open (bars 0–4) ----------
pad(CH.Bm, 0, bt(2) + 0.3, { a: 1.5, s: 1, rel: 1.2, cutoff: t => 420 + 300 * Math.sin(t * 0.8) ** 2, detune: 14 }, 0.26, 0.4);
// "Where did your Friday go?" types in over beats 1–5: a key tick per character
{
  const q = 'Where did your Friday go?';
  for (let i = 1; i <= q.length; i++) {
    const t = bt(0, 1) + (bt(0, 5) - bt(0, 1)) * i / q.length;
    if (q[i - 1] !== ' ') place(tick(1.8 + 0.25 * rand()), t - 0.01, { gain: 0.14, pan: -0.2 + 0.4 * rand(), rev: 0.1 });
  }
}
ding(69, bt(1, 2), 0.05, 0, 1.2);
// logo (drawLogo from bt(2)): the hand spins in, one tick per 30°
for (let s = Math.round((bt(2) + 0.15) * SR), last = 0; s <= (bt(2) + 1.35) * SR; s += 8) {
  const ph = clamp((s / SR - bt(2) - 0.15) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.04 + 0.08 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
pad(CH.D, bt(2), bt(4) - bt(2) + 0.3, { a: 0.4, s: 1, rel: 0.6, cutoff: t => 600 + 1500 * clamp(t / 3), detune: 18 }, 0.26, 0.35);
low(38, bt(2), bt(4) - bt(2), 0.2, { rel: 0.3 });
for (let i = 0; i < 13; i++) place(blip(76 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)), bt(2, 1) + i * 0.03, { gain: 0.025, pan: -0.5 + i / 13, rev: 0.3 });
[69, 73, 76, 78].forEach((m, i) => ding(m + 12, bt(2, 2) + i * BEAT / 2, 0.04, -0.3 + i * 0.2, 0.7));
place(riser(bt(4) - bt(3), { m0: 50, f1: 8000, tone: 0.2 }), bt(3), { gain: 0.24, rev: 0.1 });
place(whoosh(bt(4) - bt(3, 2), { f0: 300, f1: 3500, peak: 0.6, pan0: 0, pan1: 0 }), bt(3, 2), { gain: 0.16, rev: 0.2 }); // the window rises
gap(bt(3, 3.75), bt(4));

// ---------- 01 Activity (rec 0–77) ----------
const A0 = rbar(0), T0 = rbar(77), C0 = rbar(145), D0 = rbar(229), E0 = END / 4;
K(bt(A0), 1.15);
place(crash({ decay: 1.1, bright: 0.8 }), bt(A0), { gain: 0.2, rev: 0.2 });
section(A0, T0, ['D', 'Bm', 'G', 'A'], i => ({
  claps: i >= 1, keys: i >= 1, shaker: i >= 3, lead: i >= 6 && i % 8 >= 4, cutoff: Math.min(3000, 1400 + i * 300),
}));
fill(T0 - 1, 12, 0.5);

// ---------- 02 Timeline (rec 77–145) ----------
lift(T0);
section(T0, C0, ['Bm', 'G', 'D', 'A'], i => ({ shaker: true, arp: true, lead: i >= 4 && i % 4 >= 2, claps: i !== 0 }));
fill(C0 - 1, 12, 0.5);

// ---------- 03 Categories (rec 145–229) ----------
// in: the settings page; breakdown while the rule is added and saved; drop when the same Friday comes back re-sorted
lift(C0, 0.8);
const addBar = Math.floor(rbar(162)), saveBar = Math.floor(rbar(197)), dropBar = Math.round(rbar(212));
section(C0, addBar, ['G', 'A', 'D', 'Bm'], () => ({ shaker: true }));
section(addBar, saveBar, ['G', 'A', 'Em', 'A'], (i) => ({
  kicks: false, claps: false, bassline: false, keys: i % 2 === 0, hatGain: 0.45, cutoff: 1100 + i * 120, padGain: 0.24,
}));
section(saveBar, dropBar, ['G', 'A'], (i) => ({ claps: false, keys: false, cutoff: 1800, hatGain: 0.6, shaker: true }));
place(riser(bt(dropBar) - bt(dropBar - 2), { m0: 52, f1: 10000 }), bt(dropBar - 2), { gain: 0.3, rev: 0.1 });
fill(dropBar - 1, 8, 0.7);
place(reverse(crash({ len: 1.2, decay: 0.55 })), bt(dropBar) - 1.2, { gain: 0.2 });
gap(bt(dropBar - 1, 3.75), bt(dropBar));
K(bt(dropBar), 1.25, { punch: 1.1 });
place(impact({ size: 1.0 }), bt(dropBar), { gain: 0.22, rev: 0.15 });
place(crash({ len: 2.4, decay: 1.1 }), bt(dropBar), { gain: 0.26, rev: 0.12 });
section(dropBar, D0, ['D', 'Bm', 'G', 'A'], () => ({ lead: true, arp: true, shaker: true }));
fill(D0 - 1, 12, 0.5);

// ---------- 04 Your data (rec 229–end) ----------
lift(D0, 0.8);
section(D0, E0 - 1, ['D', 'A', 'Bm', 'G'], (i) => ({ shaker: true, arp: i >= 2, lead: i >= 4 }));
groove(E0 - 1, 'A', { claps: false, cutoff: 2000, padGain: 0.14 });
place(riser(BEAT * 4, { m0: 52, f1: 10000 }), bt(E0 - 1), { gain: 0.26, rev: 0.1 });
place(reverse(crash({ len: 1.0, decay: 0.5 })), bt(E0) - 1.0, { gain: 0.18 });
gap(bt(E0 - 1, 3.75), bt(E0));

// ---------- payoff: the exported file (3 bars) ----------
K(bt(E0), 1.1);
place(impact({ size: 0.9 }), bt(E0), { gain: 0.2, rev: 0.2 });
place(crash({ len: 2.4, decay: 1.2, bright: 0.7 }), bt(E0), { gain: 0.2, rev: 0.25 });
for (let i = 0; i < 22; i++) place(tick(1.6 + 0.2 * (i % 3)), bt(E0) + 2.2 * i / 22, { gain: 0.06, pan: 0.3, rev: 0.1 }); // lines appear
section(E0, E0 + PAYOFF / 4, ['G', 'A', 'Bm'], () => ({ kicks: false, claps: false, bassline: false, hatGain: 0.5, padGain: 0.22, cutoff: 1500 }));
place(riser(BEAT * 4, { m0: 55, f1: 8000 }), bt(E0 + PAYOFF / 4 - 1), { gain: 0.22 });
gap(bt(E0 + PAYOFF / 4 - 1, 3.75), bt(E0 + PAYOFF / 4));

// ---------- outro: the logo, resolved on D ----------
const O0 = E0 + PAYOFF / 4;
K(bt(O0), 1.25, { punch: 1.1, decay: 0.32 });
place(impact({ size: 1.1 }), bt(O0), { gain: 0.24, rev: 0.15 });
place(crash({ len: 3, decay: 1.4, bright: 0.8 }), bt(O0), { gain: 0.24, rev: 0.25 });
pad(CH.Dbig, bt(O0), DURATION - bt(O0), { a: 0.005, d: 1.5, s: 0.55, rel: 1.2, cutoff: t => 1400 + 4200 * Math.exp(-t / 1.4), detune: 26 }, 0.28, 0.35);
low(38, bt(O0), DURATION - bt(O0) - 0.4, 0.26, { rel: 0.8 });
for (let s = Math.round((bt(O0) + 0.15) * SR), last = 0; s <= (bt(O0) + 1.35) * SR; s += 8) {
  const ph = clamp((s / SR - bt(O0) - 0.15) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.04 + 0.08 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
groove(O0, 'D', { claps: false, padGain: 0, hatGain: 0.7 });
groove(O0 + 1, 'G', { kicks: false, claps: false, bassline: false, padGain: 0, hatGain: 0.5 });
[62, 66, 69, 73, 76, 78, 81, 85].forEach((m, k) => ding(m + 12, bt(O0 + 1, k * 0.25), 0.05, -0.5 + k * 0.14, 0.9));
ding(86, bt(O0 + 1, 2.5), 0.09, 0, 1.4); ding(90, bt(O0 + 1, 2.5), 0.07, 0, 1.4);
pad(CH.D.map(m => m + 12), bt(O0 + 2), DURATION - bt(O0 + 2), { a: 0.4, s: 1, rel: 1.2, cutoff: () => 1800, detune: 20 }, 0.12, 0.45);

// ---------- the recording's own events ----------
// every real click, on its frame
M.clicks.forEach((f, i) => {
  const t = frameT(f);
  place(tick(2.2), t, { gain: 0.2, pan: 0.2, rev: 0.08 });
  place(tick(1.7), t + 0.06, { gain: 0.1, pan: 0.2 });
});
// keystrokes: the date fields (one frame per digit) and the rule's name and pattern (two frames per letter)
M.clicks.forEach(f => {
  const b = f / FPS / BEAT;
  const near = (x, w = 1.2) => Math.abs(b - x) < w;
  let n = 0, step = 1;
  if ([84, 87, 246, 249].some(x => near(x))) n = 8;
  if (near(172)) { n = 6; step = 2; }
  if (near(178)) { n = 5; step = 2; }
  for (let k = 0; k < n; k++) place(tick(1.9 + 0.3 * rand()), frameT(f + 1 + k * step), { gain: 0.1, pan: 0.35, rev: 0.05 });
});
// route changes: a whoosh with the whip
[77, 145, 200, 229, 241, 267].forEach(x => {
  const f = M.clicks.find(c => Math.abs(c / FPS / BEAT - x) < 1);
  if (f !== undefined) place(whoosh(0.45, { f0: 800, f1: 5000, peak: 0.35, q: 1.6, pan0: -0.5, pan1: 0.5 }), frameT(f) - 0.05, { gain: 0.1, rev: 0.2 });
});
// captions / spotlights land with a soft chime (same beats as tour.js)
[3.5, 8, 15, 21, 34, 44, 52, 67, 83, 95, 108, 118, 128, 156, 168, 188, 214, 220, 233, 245, 256, 274].forEach((x, i) => {
  const t = rt(x);
  place(blip(81 + [0, 4, 7, 9, 12][i % 5], { decay: 0.05 }), t, { gain: 0.04, pan: (i % 3 - 1) * 0.4, rev: 0.25 });
  ding(88 + [0, 2, 4][i % 3], t + 0.08, 0.03, 0.3, 0.6);
});

mixdown(out, {
  delay: BEAT * 0.75,
  drive: 0.5,
  fadeOut: 2.4,
  sections: [[0, bt(4)], [bt(A0), bt(T0)], [bt(T0), bt(C0)], [bt(C0), bt(D0)], [bt(D0), bt(E0)], [bt(E0), DURATION]],
});
console.log(`duration ${DURATION.toFixed(2)}s, recording ${REC_BEATS.toFixed(1)} beats, END bar ${E0}`);

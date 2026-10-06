// Soundtrack for the web UI tour (real.js, both themes): 112 BPM, 23 bars, on the same bar grid as the page.
// A mellow I–vi–IV–V loop in D; cursor clicks, spotlights and route changes each get a sound on their cue.
// Usage: node real-music.js [real-music.wav]
const { SR, clamp, reverse, session } = require('./synth');

const out = process.argv[2] || 'real-music.wav';
const DURATION = 49.3;
const BEAT = 60 / 112;
const bt = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

const {
  rand, B, place, duckAt, gap, mixdown,
  kick, snare, hat, crash, tick, blip, bell, pluck, bass, saws, whoosh, riser, impact,
} = session({ duration: DURATION, seed: 5600 });

// ---------- harmony (D major, rootless 9th voicings) ----------
const CH = {
  D: [54, 57, 61, 64], Bm: [54, 57, 61, 62], G: [54, 57, 59, 62], A: [55, 57, 61, 64],
  Dbig: [38, 50, 54, 57, 61, 64, 69],
};
const ROOT = { D: 38, Bm: 35, G: 31, A: 33, Dbig: 38 };
const LOOP = ['D', 'Bm', 'G', 'A'];
const MOTIF = { D: [78, 76, 73], Bm: [74, 73, 69], G: [74, 71, 69], A: [73, 76, 81] };

const K = (t, g = 1, o) => { place(kick(o), t, { to: B.drums, gain: 0.66 * g }); duckAt(t, 0.6 * Math.min(1, g), 0.26); };
const CLAP = (t, g = 1) => { place(snare({ tone: 220, body: 0.2 }), t, { to: B.drums, gain: 0.34 * g, rev: 0.35, pan: 0.05 }); duckAt(t, 0.15 * g, 0.16); };
const HAT = (t, g = 1, open = false) => place(hat({ open }), t, { to: B.drums, gain: 0.24 * g, pan: open ? -0.25 : 0.22 });
const pad = (notes, t0, len, o, gain, rev = 0.2) => place(saws(notes, len, o), t0, { to: B.duck, gain, rev });
const low = (m, t0, len, gain = 0.28, o) => place(bass(m, len, o), t0, { to: B.duck, gain });
const ding = (m, t, gain = 0.08, pan = 0, decay = 0.6) => place(bell(m, { decay }), t, { gain, pan, rev: 0.35, dly: 0.2 });

// One bar of the groove; opts switch layers on and off per section.
function groove(bar, o = {}) {
  const {
    kicks = true, claps = true, hats = true, shaker = false, bassline = true, keys = true,
    padGain = 0.2, cutoff = 3000, lead = false, arp = false, hatGain = 1,
  } = o;
  const name = o.chord || LOOP[bar % 4], at = k => bt(bar, k / 4);
  if (kicks) for (let b = 0; b < 4; b++) K(bt(bar, b), b === 0 ? 1 : 0.85);
  if (claps) { CLAP(bt(bar, 1)); CLAP(bt(bar, 3)); }
  if (hats) for (let b = 0; b < 4; b++) HAT(bt(bar, b + 0.5), hatGain, b === 3);
  if (shaker) for (let k = 1; k < 16; k += 2) place(hat(), at(k), { to: B.drums, gain: 0.05 * hatGain, pan: -0.3 });
  if (bassline) [0, 3, 6, 10, 14].forEach((k, i) => low(ROOT[name] + (i === 4 ? 12 : 0), at(k), BEAT * (i === 2 ? 0.9 : 0.45), 0.27));
  else low(ROOT[name], bt(bar), BEAT * 4 - 0.02, 0.24, { rel: 0.1 });
  if (padGain) pad(CH[name], bt(bar), BEAT * 4, { a: 0.05, d: 0.5, s: 0.8, rel: 0.25, cutoff: () => cutoff, detune: 18 }, padGain);
  if (keys) for (const k of [2, 7, 10]) {
    pad(CH[name].map(m => m + 12), at(k), 0.12, { a: 0.002, d: 0.18, s: 0, rel: 0.08, voices: 4, detune: 10, cutoff: t => Math.min(cutoff * 1.4, 700 + 4000 * Math.exp(-t / 0.06)) }, 0.28, 0.3);
  }
  if (lead) MOTIF[name].forEach((m, i) => {
    const t = bt(bar, [0, 1.5, 3][i]);
    place(pluck(m, { decay: 0.25, bright: 3000 }), t, { to: B.duck, gain: 0.18, pan: -0.1, dly: 0.35, rev: 0.2 });
    ding(m + 12, t, 0.05, 0.25, 0.5);
  });
  if (arp) for (let k = 0; k < 16; k++) {
    const tones = CH[name].map(m => m + 12), m = tones[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]];
    place(pluck(m, { decay: 0.1, bright: 2600 }), at(k), { to: B.duck, gain: 0.07 * (k % 4 === 0 ? 1 : 0.7), pan: k % 2 ? 0.35 : -0.35, dly: 0.15 });
  }
}
const fill = (bar, from = 12, g = 0.6) => {
  for (let k = from; k < 16; k++) place(snare({ tone: 170 + 6 * k }), bt(bar, k / 4), { to: B.drums, gain: 0.4 * g * (0.5 + 0.5 * (k - from) / (16 - from)), rev: 0.25 });
};

// ---------- intro (bars 0–2): the logo draws, the wordmark pops in ----------
pad(CH.D, 0, bt(2) + 0.3, { a: 1.2, s: 1, rel: 1.0, cutoff: t => 500 + 900 * clamp(t / 3), detune: 16 }, 0.3, 0.35);
low(38, bt(1), bt(2) - bt(1), 0.2, { rel: 0.4 });
// the clock hand spins in (drawLogo from t0 = 0.2): one tick per 30°
for (let s = Math.round(0.35 * SR), last = 0; s <= 1.55 * SR; s += 8) {
  const ph = clamp((s / SR - 0.35) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.04 + 0.08 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
ding(81, 1.5, 0.08, 0, 1.0);
for (let i = 0; i < 13; i++) place(blip(76 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)), 0.9 + i * 0.03, { gain: 0.025, pan: -0.5 + i / 13, rev: 0.3 }); // wordmark
[69, 73, 76, 78].forEach((m, i) => ding(m + 12, bt(1, i * 0.5), 0.04, -0.3 + i * 0.2, 0.7));                                 // subtitle
place(riser(bt(2) - bt(1, 2), { m0: 50, f1: 7000, tone: 0.2 }), bt(1, 2), { gain: 0.2, rev: 0.1 });
place(whoosh(bt(2, 3) - bt(1, 3), { f0: 300, f1: 3500, peak: 0.55, pan0: 0, pan1: 0 }), bt(1, 3), { gain: 0.16, rev: 0.2 }); // the window rises

// ---------- the tour (bars 2–20) ----------
K(bt(2), 1.1);
place(crash({ decay: 1.0, bright: 0.7 }), bt(2), { gain: 0.16, rev: 0.2 });
groove(2, { claps: false, keys: false, cutoff: 1400 });
groove(3, { claps: false, cutoff: 1800 });
groove(4, { cutoff: 2400 });
groove(5, { shaker: true, cutoff: 2800 });
groove(6, { shaker: true, lead: true });
groove(7, { shaker: true, lead: true });
fill(7, 13, 0.45);
place(crash({ decay: 0.9 }), bt(8), { gain: 0.16 });
groove(8, { shaker: true, arp: true });
groove(9, { shaker: true, arp: true });
// Timeline: drums step back while the camera pans the day
groove(10, { claps: false, shaker: true, arp: true, cutoff: 2200 });
groove(11, { shaker: true, arp: true, lead: true });
groove(12, { shaker: true, arp: true, lead: true });
fill(12, 14, 0.4);
// Settings: a filtered breather, then back in for the rules
groove(13, { kicks: false, claps: false, bassline: false, keys: false, hatGain: 0.5, cutoff: 1100, padGain: 0.24 });
place(riser(BEAT * 4, { m0: 55, f1: 6000, tone: 0.15 }), bt(13), { gain: 0.16 });
place(crash({ decay: 0.9 }), bt(14), { gain: 0.16 });
groove(14, { shaker: true, arp: true });
groove(15, { shaker: true, arp: true, lead: true });
groove(16, { shaker: true, lead: true });
fill(16, 12, 0.5);
// Raw Data: full band to the finish
place(crash(), bt(17), { gain: 0.18, rev: 0.1 });
groove(17, { shaker: true, arp: true, lead: true });
groove(18, { shaker: true, arp: true, lead: true });
groove(19, { shaker: true, claps: false, cutoff: 2000, padGain: 0.16 });
place(riser(BEAT * 4, { m0: 52, f1: 10000 }), bt(19), { gain: 0.28, rev: 0.1 });
place(reverse(crash({ len: 1.2, decay: 0.55 })), bt(20) - 1.2, { gain: 0.2 });
place(whoosh(bt(20, 0.5) - bt(19, 3), { f0: 3000, f1: 300, peak: 0.3, down: true, pan0: 0.3, pan1: -0.3 }), bt(19, 3), { gain: 0.22, rev: 0.2 }); // window falls away
gap(bt(19, 3.75), bt(20));

// cues from real.js: cursor clicks, route changes and spotlights
const CLICKS = [bt(7, 3.5), bt(10, 2), bt(13, 1), bt(14, 1), bt(17)];
CLICKS.forEach((t, i) => {
  place(tick(2.2), t + 0.05, { gain: 0.22, pan: 0.2, rev: 0.1 });
  place(tick(1.7), t + 0.11, { gain: 0.12, pan: 0.2 });
  place(whoosh(0.35, { f0: 1500, f1: 5000, peak: 0.35, q: 1.8, pan0: -0.3, pan1: 0.3 }), t + 0.12, { gain: 0.06, rev: 0.2 });
  ding([81, 83, 85, 86, 88][i], t + 0.3, 0.05, 0.3, 0.5);
});
const SPOTS = [bt(3, 2), bt(5, 1), bt(6, 3), bt(8, 3), bt(11, 1), bt(12), bt(15), bt(17, 3), bt(18, 3.5)];
SPOTS.forEach((t, i) => {
  const name = LOOP[Math.floor(t / bt(1)) % 4];
  place(blip(CH[name][i % 4] + 24, { decay: 0.05 }), t, { gain: 0.05, pan: (i % 3 - 1) * 0.4, rev: 0.25 });
  ding(CH[name][3] + 24, t + 0.08, 0.035, 0.3, 0.6);
});

// ---------- outro (bars 20–23): the logo, resolved on D ----------
K(bt(20), 1.25, { punch: 1.1, decay: 0.32 });
place(impact({ size: 1.1 }), bt(20), { gain: 0.24, rev: 0.15 });
place(crash({ len: 3, decay: 1.4, bright: 0.8 }), bt(20), { gain: 0.24, rev: 0.25 });
pad(CH.Dbig, bt(20), DURATION - bt(20), { a: 0.005, d: 1.5, s: 0.55, rel: 1.2, cutoff: t => 1400 + 4200 * Math.exp(-t / 1.4), detune: 26 }, 0.28, 0.35);
low(38, bt(20), DURATION - bt(20) - 0.4, 0.26, { rel: 0.8 });
// the hand spins in again (drawLogo from t0 = bt(20))
for (let s = Math.round((bt(20) + 0.15) * SR), last = 0; s <= (bt(20) + 1.35) * SR; s += 8) {
  const ph = clamp((s / SR - bt(20) - 0.15) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.04 + 0.08 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
for (let i = 0; i < 13; i++) place(blip(78 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)), bt(20) + 0.6 + i * 0.03, { gain: 0.025, pan: -0.5 + i / 13, rev: 0.3 });
groove(20, { chord: 'D', claps: false, keys: true, padGain: 0, hatGain: 0.7 });
groove(21, { chord: 'G', kicks: false, claps: false, bassline: false, padGain: 0, hatGain: 0.5 });
[62, 66, 69, 73, 76, 78, 81, 85].forEach((m, k) => ding(m + 12, bt(21, k * 0.25), 0.05, -0.5 + k * 0.14, 0.9));         // tagline
ding(86, bt(21, 2.5), 0.09, 0, 1.4); ding(90, bt(21, 2.5), 0.07, 0, 1.4);                                                 // activitywatch.net
pad(CH.D.map(m => m + 12), bt(22), DURATION - bt(22), { a: 0.4, s: 1, rel: 1.2, cutoff: () => 1800, detune: 20 }, 0.12, 0.45);

mixdown(out, {
  delay: BEAT * 0.75,
  drive: 0.5,
  fadeOut: 2.2,
  sections: [[0, bt(2)], [bt(2), bt(8)], [bt(8), bt(13)], [bt(13), bt(17)], [bt(17), bt(20)], [bt(20), DURATION]],
});

// Soundtrack for day.html (the one-minute film): 128 BPM, 32 bars, on the same bar grid as the page.
// The day loops IV–V–iii–vi in A major and only resolves to the tonic when the logo lands.
// Usage: node day-music.js [day-music.wav]
const { SR, clamp, reverse, session } = require('./synth');

const out = process.argv[2] || 'day-music.wav';
const BEAT = 60 / 128;
const bt = (bar, beat = 0) => (bar * 4 + beat) * BEAT;
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = (x, s) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const prog = (t, a, b) => clamp((t - a) / (b - a));

const {
  rand, B, place, duckAt, gap, mixdown,
  kick, snare, hat, crash, tick, blip, bell, pluck, bass, saws, whoosh, riser, impact, clunk, zap,
} = session({ duration: 60, seed: 86400 });

// ---------- harmony (A major, rootless voicings) ----------
const CH = {
  D: [57, 61, 64, 66], E: [59, 64, 66, 68], Csm: [59, 61, 64, 68], Fsm: [57, 61, 64, 68],
  Bm: [57, 61, 62, 66], Esus: [59, 64, 66, 69], A: [61, 64, 68, 71], Abig: [45, 57, 61, 64, 68, 71, 76],
};
const ROOT = { D: 38, E: 40, Csm: 37, Fsm: 42, Bm: 35, Esus: 40, A: 33, Abig: 33 };
const LOOP = ['D', 'E', 'Csm', 'Fsm'];
// the day's hook: three notes per bar on a 3-3-2 rhythm (8th-note slots 0, 3, 6)
const MOTIF = { D: [85, 81, 76], E: [83, 80, 78], Csm: [80, 76, 73], Fsm: [81, 85, 88] };

const K = (t, g = 1, o) => { place(kick(o), t, { to: B.drums, gain: 0.72 * g }); duckAt(t, 0.68 * Math.min(1, g), 0.24); };
const CLAP = (t, g = 1) => { place(snare({ tone: 230, body: 0.25 }), t, { to: B.drums, gain: 0.42 * g, rev: 0.3, pan: 0.05 }); duckAt(t, 0.2 * g, 0.16); };
const SN = (t, g = 1, o) => { place(snare(o), t, { to: B.drums, gain: 0.45 * g, rev: 0.25 }); duckAt(t, 0.25 * g, 0.16); };
const HAT = (t, g = 1, open = false) => place(hat({ open }), t, { to: B.drums, gain: 0.29 * g, pan: open ? -0.25 : 0.22 });
const pad = (notes, t0, len, o, gain, rev = 0.15) => place(saws(notes, len, o), t0, { to: B.duck, gain, rev });
const low = (m, t0, len, gain = 0.28, o) => place(bass(m, len, o), t0, { to: B.duck, gain });
const ding = (m, t, gain = 0.08, pan = 0, decay = 0.6) => place(bell(m, { decay }), t, { gain, pan, rev: 0.35, dly: 0.2 });

// One bar of the house groove; opts switch layers on and off per section.
function groove(bar, o = {}) {
  const {
    kicks = true, claps = true, hats = true, shaker = false, busy = false, open = false,
    bassline = true, stabs = true, padGain = 0.22, cutoff = 5200, lead = false, arp = false, hatGain = 1,
  } = o;
  const name = o.chord || LOOP[bar % 4], at = k => bt(bar, k / 4);
  if (kicks) for (let b = 0; b < 4; b++) K(bt(bar, b), b === 0 ? 1.05 : 0.95);
  if (claps) { CLAP(bt(bar, 1)); CLAP(bt(bar, 3)); }
  if (hats) for (let b = 0; b < 4; b++) HAT(bt(bar, b + 0.5), hatGain, open && b % 2 === 1);
  if (shaker) for (let k = 0; k < 16; k++) if (k % 2) place(hat(), at(k), { to: B.drums, gain: 0.06 * hatGain, pan: -0.3 });
  if (busy) for (const k of [1, 3, 7, 9, 11, 15]) place(tick(1.6), at(k), { to: B.drums, gain: 0.06, pan: 0.4 });
  if (bassline) [2, 6, 10, 14].forEach((k, i) => low(ROOT[name] + (i === 3 ? 7 : 0), at(k), BEAT * 0.42, 0.28));
  else low(ROOT[name], bt(bar), BEAT * 4 - 0.02, 0.26, { rel: 0.1 });
  if (padGain) pad(CH[name], bt(bar), BEAT * 4, { a: 0.03, d: 0.4, s: 0.8, rel: 0.2, cutoff: () => Math.min(cutoff, 3200), detune: 22 }, padGain);
  if (stabs) for (const k of [3, 6, 11, 14]) {
    pad(CH[name].map(m => m + 12), at(k), 0.1, { a: 0.002, d: 0.14, s: 0, rel: 0.06, voices: 5, detune: 14, cutoff: t => Math.min(cutoff, 900 + 5200 * Math.exp(-t / 0.05)) }, 0.36, 0.2);
  }
  if (lead) MOTIF[name].forEach((m, i) => {
    const t = bt(bar, [0, 1.5, 3][i]);
    place(pluck(m, { decay: 0.22, bright: 3600 }), t, { to: B.duck, gain: 0.22, pan: -0.1, dly: 0.3, rev: 0.15 });
    ding(m + 12, t, 0.07, 0.25, 0.45);
  });
  if (arp) for (let k = 0; k < 16; k++) {
    const tones = CH[name].map(m => m + 12), m = tones[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]];
    place(pluck(m, { decay: 0.1, bright: 3000 }), at(k), { to: B.duck, gain: 0.09 * (k % 4 === 0 ? 1 : 0.7), pan: k % 2 ? 0.35 : -0.35, dly: 0.15 });
  }
}

const fill = (bar, from = 12, g = 0.7) => { for (let k = from; k < 16; k++) SN(bt(bar, k / 4), g * (0.5 + 0.5 * (k - from) / (16 - from)), { tone: 180 + 6 * k }); };

// ---------- 1. hook (bars 0–4): 86,400 seconds tick away ----------
pad(CH.Fsm, 0, bt(4) + 0.4, { a: 1.6, s: 1, rel: 1.2, cutoff: t => 420 + 380 * Math.sin(t * 0.8) ** 2, detune: 16 }, 0.3, 0.3);
low(30, bt(1), bt(3) - bt(1), 0.22, { rel: 0.4 });
for (let b = 1; b < 8; b++) place(tick(b % 2 ? 1 : 0.82), bt(0, b), { gain: 0.26, pan: b % 2 ? -0.2 : 0.2, rev: 0.12 });
// digits spin into place: one click per digit passing, a clack when each lands (same easing as day.html)
[8, 6, 4, 0, 0].forEach((digit, k) => {
  const land = bt(0, 2) + k * BEAT / 2, spins = 8 + k * 3;
  let last = digit + spins;
  for (let s = Math.round((land - 0.55) * SR); s <= land * SR; s += 16) {
    const c = digit + (1 - easeOutCubic(prog(s / SR, land - 0.55, land))) * spins;
    if (Math.floor(c) !== last) place(tick(1.35), s / SR, { gain: 0.05, pan: -0.4 + k * 0.2 });
    last = Math.floor(c);
  }
  place(tick(0.62), land, { gain: 0.42, pan: -0.4 + k * 0.2, rev: 0.15 });
  place(kick({ tune: 70, punch: 0.4, decay: 0.08, len: 0.2 }), land, { gain: 0.25 });
});
// four real seconds, then the whole day drains: one rattle click per thousand seconds
for (let i = 0; i < 4; i++) { place(tick(0.7), bt(2) + i * BEAT / 2, { gain: 0.4, pan: 0.1, rev: 0.15 }); ding(81 - i * 2, bt(2) + i * BEAT / 2, 0.03); }
{
  let last = 86;
  for (let s = Math.round(bt(2, 2) * SR); s <= bt(3) * SR; s += 8) {
    const S = 86396 * (1 - easeInOutCubic(prog(s / SR, bt(2, 2), bt(3)))), th = Math.floor(S / 1000);
    if (th !== last) place(tick(1.2), s / SR, { gain: 0.1, pan: 0.15 * Math.sin(th) });
    last = th;
  }
}
place(riser(bt(3) - bt(2, 2), { f0: 400, f1: 7000, m0: 50, tone: 0.2 }), bt(2, 2), { gain: 0.22 });
// 00,000
K(bt(3), 1.2, { tune: 42, decay: 0.35 });
place(impact({ size: 1.2 }), bt(3), { gain: 0.3, rev: 0.2 });
place(clunk(), bt(3), { gain: 0.22, rev: 0.3 });
place(crash({ decay: 1.4, bright: 0.6 }), bt(3), { gain: 0.14, rev: 0.3 });
// "Where do they go?" — the zeros scatter into stardust
for (let i = 0; i < 44; i++) {
  const t = bt(3, 1) + Math.pow(rand(), 1.6) * 1.5;
  place(bell([88, 90, 93, 95, 97, 100, 102][Math.floor(rand() * 7)], { decay: 0.3, index: 0.8 }), t, { gain: 0.02 + rand() * 0.025, pan: rand() * 1.6 - 0.8, rev: 0.5 });
}
place(whoosh(1.4, { f0: 2500, f1: 9000, peak: 0.3, q: 2, pan0: -0.5, pan1: 0.5 }), bt(3, 1), { gain: 0.12, rev: 0.3 });

// ---------- 2. dawn (bars 4–8): sunrise, the laptop opens, ActivityWatch starts ----------
LOOP.forEach((name, i) => {
  const bar = 4 + i, t0 = bt(bar);
  pad(CH[name], t0, BEAT * 4, { a: i ? 0.2 : 1.2, s: 1, rel: 0.25, cutoff: t => 500 * Math.pow(7, clamp((t0 + t - bt(4)) / (bt(8) - bt(4)))), detune: 18 }, 0.28, 0.3);
  if (bar >= 6) low(ROOT[name], t0, BEAT * 4 - 0.02, 0.22, { rel: 0.1 });
  if (bar >= 5) for (let k = 0; k < 8; k++) {
    const tones = CH[name].map(m => m + 12);
    place(pluck(tones[[0, 2, 1, 3, 2, 0, 3, 1][k]], { decay: 0.18, bright: 2200 }), bt(bar, k / 2), { to: B.duck, gain: 0.07 + 0.02 * (bar - 5), pan: k % 2 ? 0.3 : -0.3, dly: 0.3, rev: 0.2 });
  }
});
[0, 2].forEach(b => K(bt(6, b), 0.5, { decay: 0.15 }));
for (let b = 0; b < 4; b++) { K(bt(7, b), 0.65); HAT(bt(7, b + 0.5), 0.6); }
place(whoosh(bt(5, 2) - bt(4, 2), { f0: 250, f1: 2000, peak: 0.8, q: 1.4, pan0: 0, pan1: 0 }), bt(4, 2), { gain: 0.1, rev: 0.2 }); // lid opens
ding(76, bt(5, 2), 0.06); ding(81, bt(5, 2) + 0.06, 0.05);                                                                // screen on
for (let k = 1; k <= 7; k++) place(tick(1.9 + 0.1 * (k % 3)), bt(5, 3) + 0.35 * k / 7, { gain: 0.07, pan: 0.1 });            // "$ aw-qt"
[76, 81, 85, 88].forEach((m, i) => {                                                                                        // watchers start
  const t = [bt(6), bt(6, 2), bt(7), bt(7, 2)][i];
  ding(m, t, 0.1, -0.3 + i * 0.2, 0.7);
  place(blip(m - 12), t, { gain: 0.08, pan: -0.3 + i * 0.2, rev: 0.2 });
});
ding(93, bt(7, 1.5), 0.05, 0.3, 0.8);
place(riser(BEAT * 4, { m0: 52, f1: 9000 }), bt(7), { gain: 0.26, rev: 0.1 });
place(reverse(crash({ len: 1.2, decay: 0.55 })), bt(8) - 1.2, { gain: 0.2 });
place(whoosh(bt(8) - bt(7, 2.5), { f0: 300, f1: 6000, peak: 0.92, pan0: -0.2, pan1: 0.2 }), bt(7, 2.5), { gain: 0.3, rev: 0.15 });
gap(bt(7, 3.75), bt(8));

// ---------- 3. the day (bars 8–20), 08:00 → 22:00 ----------
place(crash(), bt(8), { gain: 0.24, rev: 0.1 });
groove(8, { stabs: true });
groove(9, { shaker: true });
groove(10, { shaker: true });
groove(11, { shaker: true });
fill(11, 13, 0.55);
// lunch: the drums step out
groove(12, { kicks: false, claps: false, hats: false, shaker: true, bassline: false, stabs: false, padGain: 0.22, cutoff: 1400 });
place(riser(BEAT * 2, { m0: 57, f1: 6000, tone: 0.15 }), bt(12, 2), { gain: 0.18 });
// meeting marathon: busier percussion
place(crash({ decay: 0.8 }), bt(13), { gain: 0.16 });
groove(13, { busy: true, shaker: true });
// flow state: everything in, plus the hook
place(crash(), bt(14), { gain: 0.2, rev: 0.1 });
groove(14, { lead: true, arp: true, open: true, shaker: true });
groove(15, { lead: true, arp: true, open: true, shaker: true });
groove(16, { shaker: true });
fill(16, 14, 0.5);
// dinner: offline
groove(17, { kicks: false, claps: false, hats: false, bassline: false, stabs: false, padGain: 0.24, cutoff: 900 });
// evening: filtered, late-night
groove(18, { claps: false, cutoff: 1500, hatGain: 0.6, padGain: 0.12 });
groove(19, { claps: false, cutoff: 1100, hatGain: 0.4, padGain: 0.12, kicks: false, stabs: false });
[0, 1].forEach(b => K(bt(19, b), 0.7));
// a soft blip on every app switch, a bell on every callout (both land on the 8th-note grid)
{
  const STEPS = [3, 2, 2, 6, 1, 3, 1, 5, 3, 1, 3, 1, 7, 1, 3, 1, 4, 1, 12, 1, 2, 3, 2, 2, 1, 8, 6, 2, 3, 2, 4];
  const CALLOUT = new Set([3, 7, 12, 14, 18, 25, 26]);
  let step = 0;
  STEPS.forEach((n, i) => {
    const t = bt(8) + step * BEAT / 2, name = LOOP[Math.floor(8 + step / 8) % 4];
    if (i > 0) place(blip(CH[name][i % 4] + 12, { decay: 0.04 }), t, { gain: 0.045, pan: (i % 5) / 2.5 - 0.8, rev: 0.2 });
    if (CALLOUT.has(i)) ding(CH[name][3] + 24, t + 0.05, 0.05, 0.4, 0.5);
    step += n;
  });
}
// asleep: the day winds down into the insights drop
place(riser(BEAT * 2, { m0: 52, f1: 10000 }), bt(19, 2), { gain: 0.32, rev: 0.1 });
fill(19, 8, 0.75);
place(reverse(crash({ len: 1.0, decay: 0.5 })), bt(20) - 1.0, { gain: 0.22 });
gap(bt(19, 3.75), bt(20));

// ---------- 4. insights (bars 20–24): the drop ----------
K(bt(20), 1.25, { punch: 1.2 });
place(impact({ size: 1.1 }), bt(20), { gain: 0.24, rev: 0.1 });
place(crash({ len: 2.4, decay: 1.1 }), bt(20), { gain: 0.3, rev: 0.12 });
for (let bar = 20; bar < 24; bar++) {
  groove(bar, { lead: true, arp: bar >= 21, open: true, shaker: true, padGain: 0.2 });
  pad(CH[LOOP[bar % 4]].map(m => m + 12), bt(bar), BEAT * 4, { voices: 5, a: 0.02, d: 0.5, s: 0.6, rel: 0.2, cutoff: () => 6500, detune: 20 }, 0.1);
}
place(whoosh(bt(21, 2) - bt(20, 2), { f0: 600, f1: 5000, peak: 0.6, q: 1.6, pan0: -0.8, pan1: 0.8 }), bt(20, 2), { gain: 0.12, rev: 0.2 }); // sunburst sweeps
[76, 81, 85, 88].forEach((m, i) => ding(m, bt(21, i), 0.09, 0.2 + i * 0.15, 0.5));                                                        // stat cards
[93, 97, 100, 105].forEach((m, i) => ding(m, bt(22, 2) + i * 0.06, 0.05, 0.3, 0.7));                                                    // focus highlight
fill(23, 12, 0.6);
place(whoosh(1.0, { f0: 5000, f1: 300, peak: 0.2, down: true, pan0: 0.4, pan1: -0.4 }), bt(23, 3), { gain: 0.26, rev: 0.2 });

// ---------- 5. private by design (bars 24–26) ----------
pad(CH.D, bt(24), BEAT * 4, { a: 0.3, s: 1, rel: 0.3, cutoff: () => 900, detune: 18 }, 0.3, 0.35);
pad(CH.Bm, bt(25), BEAT * 4, { a: 0.1, s: 1, rel: 0.3, cutoff: t => 900 + 600 * t, detune: 18 }, 0.3, 0.35);
low(38, bt(24), BEAT * 4 - 0.02, 0.26, { rel: 0.1 });
low(35, bt(25), BEAT * 4 - 0.02, 0.26, { rel: 0.1 });
// the dome closes over the laptop
place(riser(0.5, { f0: 300, f1: 5000, m0: 60, tone: 0.3 }), bt(24, 2) - 0.5, { gain: 0.22 });
K(bt(24, 2), 1.1, { tune: 44, decay: 0.35 });
place(impact({ size: 1.3 }), bt(24, 2), { gain: 0.3, rev: 0.25 });
pad(CH.D.map(m => m + 12), bt(24, 2), 1.4, { a: 0.005, d: 0.8, s: 0.2, rel: 0.5, voices: 5, cutoff: t => 1200 + 5000 * Math.exp(-t / 0.3), detune: 26 }, 0.16, 0.4);
for (const at of [bt(24, 3), bt(25, 0.5), bt(25, 2)]) {                                                                                 // blocked requests
  place(zap(), at - 0.2, { gain: 0.14, pan: at === bt(24, 3) ? -0.5 : 0.5, rev: 0.2 });
  place(bell(98, { decay: 0.25, ratio: 2.76, index: 2 }), at, { gain: 0.08, pan: at === bt(24, 3) ? -0.3 : 0.3, rev: 0.3 });
  place(hat(), at, { gain: 0.12 });
}
place(whoosh(0.8, { f0: 400, f1: 4000, peak: 0.85, pan0: 0.3, pan1: -0.3 }), bt(26) - 0.8, { gain: 0.18, rev: 0.2 });

// ---------- 6. open source (bars 26–28): rebuild into the logo ----------
for (let bar = 26; bar < 28; bar++) {
  groove(bar, { chord: bar === 26 ? 'Esus' : 'E', claps: bar === 27, stabs: false, arp: true, padGain: 0.18, cutoff: bar === 26 ? 2200 : 4000 });
}
ding(81, bt(26), 0.08, -0.4);                                                                                         // hub
for (let i = 0; i < 6; i++) ding([76, 78, 81, 83, 85, 88][i], bt(26, 1) + i * BEAT / 2, 0.07, -0.6 + i * 0.12, 0.4); // watchers join
for (let k = 0; k < 36; k += 2) place(tick(1.9 + 0.15 * (k % 3)), bt(26, 2) + 0.9 * k / 36, { gain: 0.05, pan: 0.5 });  // typing the curl
for (let i = 1; i < 6; i++) place(tick(1.5), bt(26, 2) + 1.0 + i * BEAT / 4, { gain: 0.06, pan: 0.5 });              // JSON lines
for (let i = 0; i < 5; i++) place(blip([69, 71, 73, 76, 78][i] + 12), bt(27) + i * BEAT / 2, { gain: 0.07, pan: -0.5 + i * 0.25, rev: 0.2 }); // chips
fill(27, 8, 0.8);
place(riser(BEAT * 4, { m0: 52, f1: 10000 }), bt(27), { gain: 0.34, rev: 0.1 });
place(reverse(crash({ len: 1.2, decay: 0.55 })), bt(28) - 1.2, { gain: 0.26 });
place(whoosh(bt(28, 0.5) - bt(27, 3), { f0: 300, f1: 7000, peak: 0.7, pan0: -0.3, pan1: 0.3 }), bt(27, 3), { gain: 0.4, rev: 0.2 }); // iris wipe
gap(bt(27, 3.75), bt(28));

// ---------- 7. logo (bars 28–32): home at last ----------
K(bt(28), 1.35, { punch: 1.2, decay: 0.32 });
place(impact({ size: 1.4 }), bt(28), { gain: 0.28, rev: 0.1 });
place(crash({ len: 2.4, decay: 1.2 }), bt(28), { gain: 0.32, rev: 0.15 });
pad(CH.Abig, bt(28), BEAT * 8, { a: 0.004, d: 1.2, s: 0.65, rel: 0.3, cutoff: t => 1800 + 5000 * Math.exp(-t / 1.2), detune: 28 }, 0.3, 0.2);
groove(28, { chord: 'A', stabs: true, padGain: 0 });
groove(29, { chord: 'D', stabs: true, padGain: 0.14 });
// the hand spins in: one tick per 30° (same easing as drawLogo)
for (let s = Math.round((bt(28) + 0.15) * SR), last = 0; s <= (bt(28) + 1.35) * SR; s += 8) {
  const ph = clamp((s / SR - bt(28) - 0.15) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.05 + 0.1 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
for (let i = 0; i < 13; i++) place(blip(81 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5)), bt(29, 1.5) + i * 0.03 + 0.03, { gain: 0.03, pan: -0.5 + i / 13, rev: 0.3 }); // wordmark
// "Your time. Your data." — the band drops out and the tonic rings
K(bt(30), 1.1, { decay: 0.4 });
place(crash({ len: 3, decay: 1.6, bright: 0.8 }), bt(30), { gain: 0.24, rev: 0.25 });
pad(CH.A.concat([76, 80]), bt(30), BEAT * 8, { a: 0.01, d: 1.5, s: 0.55, rel: 0.6, cutoff: t => 1500 + 3500 * Math.exp(-t / 1.5), detune: 24 }, 0.3, 0.35);
low(33, bt(30), BEAT * 8 - 0.3, 0.26, { rel: 0.5 });
[69, 73, 76, 80, 81, 85, 88, 92].forEach((m, k) => ding(m + 12, bt(30, 0.5 + k * 0.25), 0.06, -0.5 + k * 0.14, 0.9));
ding(88, bt(30, 3), 0.1, 0, 1.2); ding(93, bt(30, 3), 0.08, 0, 1.2);                                                    // activitywatch.net

mixdown(out, {
  delay: BEAT * 0.75,
  drive: 0.54,
  fadeOut: 1.4,
  sections: [[0, bt(4)], [bt(4), bt(8)], [bt(8), bt(20)], [bt(20), bt(24)], [bt(24), bt(26)], [bt(26), bt(28)], [bt(28), 60]],
});

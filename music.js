// Soundtrack for index.html (the 15s promo), locked to its scene timings.
// Usage: node music.js [music.wav]
const { SR, clamp, reverse, session } = require('./synth');

const out = process.argv[2] || 'music.wav';

// Bar lines land on the first drop (3.1s) and the logo hit (12.8s), six bars apart: ≈148.5 BPM.
const BEAT = (12.8 - 3.1) / 24;
const BAR = BEAT * 4;
const at = (bar, beat = 0) => 3.1 + bar * BAR + beat * BEAT;

const {
  rand, B, place, duckAt, gap, mixdown,
  kick, snare, hat, crash, tick, blip, bell, pluck, bass, saws, whoosh, riser, impact, clunk, denied,
} = session({ duration: 15, seed: 1508 });

// ---------- arrangement (A major) ----------
const CH = {
  Dmaj7: [57, 62, 66, 69, 73], D: [57, 62, 66, 69], E: [59, 64, 68, 71], Esus: [59, 64, 69, 71],
  Fsm: [57, 61, 66, 69], A: [57, 61, 64, 69], Bm: [59, 62, 66, 71], Abig: [45, 57, 61, 64, 69, 73, 76],
};
const ROOT = { D: 38, E: 40, Fsm: 42, A: 33 };

const K = (t, g = 1, o) => { place(kick(o), t, { to: B.drums, gain: 0.8 * g }); duckAt(t, 0.72 * Math.min(1, g)); };
const S = (t, g = 1, o) => { place(snare(o), t, { to: B.drums, gain: 0.55 * g, rev: 0.3 }); duckAt(t, 0.35 * g, 0.2); };
const H = (t, g = 1, open = false) => place(hat({ open }), t, { to: B.drums, gain: 0.3 * g, pan: open ? -0.2 : 0.2 });
const pad = (notes, t0, len, o, gain) => place(saws(notes, len, o), t0, { to: B.duck, gain, rev: 0.12 });
const low = (m, t0, len, gain = 0.3, o) => place(bass(m, len, o), t0, { to: B.duck, gain });
const sweep = (t0, from, to, a, b) => t => from * Math.pow(to / from, clamp((t0 + t - a) / (b - a)));

// 1. Intro, "Where did your day go?" (0–3.1s): clock ticks over a pad whose filter slowly opens
pad(CH.Dmaj7, 0, at(-1) + 0.02, { a: 0.8, s: 1, rel: 0.15, cutoff: sweep(0, 380, 3800, 0, 3), detune: 18 }, 0.36);
pad(CH.Esus, at(-1), BEAT * 2, { a: 0.03, s: 1, rel: 0.06, cutoff: sweep(at(-1), 380, 3800, 0, 3), detune: 18 }, 0.36);
pad(CH.E, at(-1, 2), 3.0 - at(-1, 2), { a: 0.02, s: 1, rel: 0.02, cutoff: sweep(at(-1, 2), 380, 3800, 0, 3), detune: 22 }, 0.38);
[1, 2, 3].map(b => at(-2, b))
  .concat([0, 0.5, 1, 1.5].map(b => at(-1, b)), [0, 1, 2, 3, 4, 5, 6].map(k => at(-1, 2 + k / 4)))
  .forEach((t, i) => place(tick(i % 2 ? 0.8 : 1), t, { gain: 0.3 + 0.12 * t, pan: i % 2 ? 0.25 : -0.25, rev: 0.1 }));
// the twelve app chips popping in, panned to where they sit on screen
[300, 1560, 180, 1720, 360, 1540, 760, 1180, 640, 1250, 120, 1800].forEach((x, i) =>
  place(blip([64, 66, 69, 71, 73, 76, 78, 81, 83, 85, 88, 90][i]), 0.11 + i * 0.07, { gain: 0.14, pan: (x / 960 - 1) * 0.8, rev: 0.25, dly: 0.1 }));
// chips get pulled into the timeline
place(riser(1.6, { m0: 52 }), 1.5, { gain: 0.3, rev: 0.1 });
place(reverse(crash({ len: 1.3, decay: 0.6 })), 3.1 - 1.3, { gain: 0.22 });
place(whoosh(0.8, { f0: 350, f1: 4500, peak: 0.85, pan0: -0.6, pan1: 0.2 }), 2.3, { gain: 0.3, rev: 0.15 });
gap(3.0, 3.1);

// 2. Drop, timeline + donut (3.1–9.57s): half-time drums, pumping chords, 16th arp
place(impact({ size: 0.8 }), 3.1, { gain: 0.22 });
place(crash(), 3.1, { gain: 0.26, rev: 0.1 });
const PROG = ['Fsm', 'D', 'A', 'E'];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3], ACC = [1, 0.55, 0.7, 1, 0.55, 0.7, 1, 0.6];
for (let bar = 0; bar < 4; bar++) {
  const st = k => at(bar, k / 4);
  K(st(0), bar === 0 ? 1.2 : 1);
  if (bar % 2) K(st(7), 0.75);
  K(st(10), 0.85);
  S(st(8));
  for (let k = 0; k < 16; k += 2) H(st(k), k % 4 === 2 ? 1 : 0.55, bar >= 2 && (k === 6 || k === 14));
  if (bar === 1) { H(st(13), 0.5); H(st(15), 0.6); [13, 14, 15].forEach((k, j) => S(st(k), 0.4 + j * 0.2)); }
  if (bar === 3) [12, 13, 14, 15].forEach((k, j) => S(st(k), 0.35 + j * 0.18));
  for (let h = 0; h < 2; h++) {
    const name = PROG[(bar % 2) * 2 + h], t0 = at(bar, h * 2), len = BEAT * 2;
    pad(CH[name], t0, len, { d: 0.35, s: 0.7, rel: 0.08, cutoff: t => 2400 + 4200 * Math.exp(-t / 0.22), detune: 26 }, 0.42);
    if (bar >= 2) pad(CH[name].map(m => m + 12), t0, len, { voices: 3, d: 0.3, s: 0.6, rel: 0.08, cutoff: () => 7000, detune: 12 }, 0.16);
    low(ROOT[name], t0, len - 0.012);
    for (let k = 0; k < 8; k++) {
      if (bar === 3 && h === 1 && k >= 4) break; // leave the fill some air
      place(pluck(CH[name][ARP[k]] + 12), t0 + k * BEAT / 4, { to: B.duck, gain: 0.22 * ACC[k], pan: k % 2 ? 0.3 : -0.3, dly: 0.22, rev: 0.1 });
    }
    if (bar >= 2) [0, 3, 6].forEach(k =>
      place(bell(CH[name][ARP[k]] + 24, { decay: 0.35 }), t0 + k * BEAT / 4, { gain: 0.07, pan: k ? 0.5 : -0.5, rev: 0.3, dly: 0.25 }));
  }
}
// timeline bursts into particles that stream into the donut (left of frame)
place(reverse(crash({ len: 0.9, decay: 0.45 })), at(2) - 0.9, { gain: 0.16 });
place(crash({ decay: 0.7 }), at(2), { gain: 0.2 });
place(whoosh(0.55, { f0: 900, f1: 6000, peak: 0.35, pan0: 0.1, pan1: -0.5 }), 6.18, { gain: 0.22, rev: 0.2 });
for (let k = 0; k < 30; k++) {
  place(bell([88, 90, 93, 95, 97, 100][Math.floor(rand() * 6)], { decay: 0.25, index: 1 }), 6.35 + rand() * 1.15,
    { gain: 0.035 + rand() * 0.02, pan: -0.8 + rand() * 0.8, rev: 0.4 });
}

// 3. Breakdown, "Private by design." (9.57–12.8s)
K(at(4), 0.9);
place(impact({ size: 0.6 }), at(4), { gain: 0.18 });
place(crash({ decay: 1.1, bright: 0.7 }), at(4), { gain: 0.16, rev: 0.2 });
place(whoosh(1.0, { f0: 250, f1: 5000, peak: 0.2, down: true, pan0: 0.4, pan1: -0.4 }), at(4) - 0.2, { gain: 0.3, rev: 0.2 });
pad(CH.Dmaj7, at(4), BAR, { a: 0.08, s: 1, rel: 0.1, cutoff: t => 700 + 250 * Math.sin(t * 3), detune: 20 }, 0.42);
low(38, at(4), BAR - 0.02, 0.28, { rel: 0.1 });
const build = sweep(0, 900, 6300, at(5), 12.65);
pad(CH.Bm, at(5), BEAT * 2, { a: 0.02, s: 1, rel: 0.05, cutoff: t => build(at(5) + t) }, 0.4);
pad(CH.Esus, at(5, 2), BEAT, { a: 0.01, s: 1, rel: 0.03, cutoff: t => build(at(5, 2) + t) }, 0.4);
pad(CH.E, at(5, 3), BEAT * 0.75, { a: 0.01, s: 1, rel: 0.01, cutoff: t => build(at(5, 3) + t) }, 0.42);
low(35, at(5), BEAT * 2);
low(40, at(5, 2), BEAT * 1.75, 0.3, { rel: 0.01 });
// data tries to leave for the cloud, gets blocked, and the padlock snaps shut
[[10.55, 76, 0.3], [10.72, 81, 0.45], [10.89, 85, 0.6]].forEach(([t, m, p]) => place(blip(m), t, { gain: 0.12, pan: p, rev: 0.2, dly: 0.15 }));
place(denied(), 11.02, { gain: 0.18, pan: 0.4, rev: 0.15 });
place(clunk(), 11.33, { gain: 0.55, pan: -0.3, rev: 0.25 });
place(whoosh(0.6, { f0: 500, f1: 3500, peak: 0.15, down: true, pan0: -0.3, pan1: -0.1 }), 11.42, { gain: 0.12, rev: 0.2 });
// snare roll and riser into the logo wipe
const roll = [4, 6, 8, 9, 10, 11, 12, 12.5, 13, 13.5, 14, 14.5];
roll.forEach((k, j) => S(at(5, k / 4), 0.25 + 0.6 * j / (roll.length - 1), { tone: 170 + 8 * j }));
place(riser(12.8 - 11.4, { m0: 52, f1: 10000 }), 11.4, { gain: 0.35, rev: 0.1 });
place(reverse(crash({ len: 1.2, decay: 0.55 })), 12.8 - 1.2, { gain: 0.25 });
place(whoosh(0.55, { f0: 300, f1: 7000, peak: 0.9, pan0: -0.3, pan1: 0.3 }), 12.3, { gain: 0.45, rev: 0.2 });
gap(at(5, 3.75), 12.8);

// 4. Logo (12.8–15s): big hit resolving to the tonic, sparkle while it draws, ratchet as the hand spins in
K(12.8, 1.3, { punch: 1.2, decay: 0.32 });
place(impact({ size: 1.4 }), 12.8, { gain: 0.28, rev: 0.1 });
place(crash({ len: 2.2, decay: 1.2 }), 12.8, { gain: 0.32, rev: 0.15 });
pad(CH.Abig, 12.8, 2.0, { a: 0.004, d: 1.2, s: 0.7, rel: 0.4, cutoff: t => 1500 + 5500 * Math.exp(-t / 0.9), detune: 28 }, 0.42);
low(33, 12.8, 1.9, 0.3, { rel: 0.3 });
[81, 85, 88, 93, 97, 100, 105].forEach((m, k) =>
  place(bell(m, { decay: 0.6 }), at(6, 0.5 + k * 0.25), { gain: 0.07, pan: -0.5 + k * 0.16, rev: 0.35, dly: 0.2 }));
// one tick per 30° of the logo's clock hand (same easing as drawLogo in index.html)
for (let s = Math.round(12.75 * SR), last = 0; s <= 13.95 * SR; s += 8) {
  const ph = clamp((s / SR - 12.75) / 1.2), notch = Math.floor((1 - Math.pow(1 - ph, 3)) * 30);
  if (notch !== last) place(tick(1.45), s / SR, { gain: 0.06 + 0.12 * ph, pan: 0.15 * Math.sin(notch), rev: 0.15 });
  last = notch;
}
place(bell(88, { decay: 1.1 }), 14.08, { gain: 0.1, rev: 0.4, dly: 0.2 });
place(bell(93, { decay: 1.1 }), 14.08, { gain: 0.08, rev: 0.4, dly: 0.2 });

mixdown(out, {
  delay: BEAT * 0.75,
  sections: [[0, 3.1], [3.1, 6.33], [6.33, 9.57], [9.57, 12.8], [12.8, 15]],
});

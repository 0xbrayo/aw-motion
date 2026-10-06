// Synth engine shared by the soundtracks: instruments, effects, buses and mixdown.
// Everything is seeded, so a score renders identically every time.
const fs = require('fs');

const SR = 48000;
const TAU = Math.PI * 2;

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const panL = p => Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2;
const panR = p => Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2;
const fade = (t, len, f = 0.01) => clamp((len - t) / f);

// ---------- DSP building blocks ----------
// Topology-preserving state-variable filter (stays stable under fast cutoff sweeps).
class SVF {
  constructor(fc = 1000, q = 0.707) { this.ic1 = 0; this.ic2 = 0; this.set(fc, q); }
  set(fc, q) {
    const g = Math.tan(Math.PI * clamp(fc, 20, SR * 0.45) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1 * this.k; // unity-peak band-pass
    this.hp = v0 - this.k * v1 - v2;
    return (this.lp = v2);
  }
}

// PolyBLEP residual for band-limited saws.
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

function adsr(t, len, a, d, s, r) {
  const lvl = x => x < a ? x / a : x < a + d ? 1 - (1 - s) * (x - a) / d : s;
  if (t <= len) return lvl(t);
  return lvl(len) * Math.pow(clamp(1 - (t - len) / r), 2);
}

const reverse = ([l, r]) => [l.slice().reverse(), r.slice().reverse()];

// Look-ahead peak limiter: the gain is fully down before each peak arrives, so nothing overshoots.
function limit(L, R, ceiling, la = 0.005, rel = 0.15) {
  const n = L.length, look = Math.round(la * SR), g = new Float32Array(n), h = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); g[i] = p > ceiling ? ceiling / p : 1; }
  for (let i = 0; i < n; i++) { let m = 1; for (let j = i; j <= i + look && j < n; j++) if (g[j] < m) m = g[j]; h[i] = m; }
  const c = 1 - Math.exp(-1 / (rel * SR));
  let acc = look + 1, cur = 1, minG = 1, busy = 0;
  for (let i = 0; i < n; i++) {
    acc += h[i] - (i - look - 1 >= 0 ? h[i - look - 1] : 1);
    cur = Math.min(acc / (look + 1), cur + (1 - cur) * c);
    L[i] *= cur; R[i] *= cur;
    minG = Math.min(minG, cur);
    if (cur < 0.891) busy++;
  }
  return [minG, busy / n];
}

// One render: allocates the buses for `duration` seconds and returns the instruments bound to a seeded RNG.
function session({ duration, seed }) {
  const N = Math.round(duration * SR);
  const rand = rng(seed);
  const noise = () => rand() * 2 - 1;

  // ---------- instruments ----------
  function kick({ tune = 50, punch = 1, decay = 0.2, len = 0.45 } = {}) {
    const n = Math.round(len * SR), o = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (tune + 140 * punch * Math.exp(-t / 0.028) + 320 * Math.exp(-t / 0.0035)) / SR;
      const env = clamp(t / 0.001) * (t < 0.04 ? 1 : Math.exp(-(t - 0.04) / decay)) * fade(t, len, 0.03);
      const click = noise() * Math.exp(-t / 0.0009) * 0.4;
      o[i] = Math.tanh(1.7 * (Math.sin(TAU * ph) * env + click)) / Math.tanh(1.7);
    }
    return o;
  }

  // Snare body + three-burst clap + noise tail.
  function snare({ tone = 190, len = 0.55, body = 0.7 } = {}) {
    const n = Math.round(len * SR), o = new Float32Array(n);
    const band = new SVF(1700, 0.9), air = new SVF(6500, 0.7);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (tone + 90 * Math.exp(-t / 0.01)) / SR;
      const x = noise();
      band.run(x); air.run(x);
      let clap = 0;
      for (const s of [0, 0.0095, 0.0195]) if (t >= s) clap = Math.max(clap, Math.exp(-(t - s) / 0.0038));
      const tail = t >= 0.028 ? Math.exp(-(t - 0.028) / 0.14) : 0;
      o[i] = (Math.sin(TAU * ph) * Math.exp(-t / 0.065) * body
        + band.bp * (clap * 2.2 + tail * 1.5)
        + air.hp * Math.exp(-t / 0.08) * 0.3) * fade(t, len, 0.05);
    }
    return o;
  }

  const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]; // 808 cymbal oscillator ratios
  function hat({ open = false } = {}) {
    const len = open ? 0.5 : 0.12, decay = open ? 0.18 : 0.028;
    const n = Math.round(len * SR), o = new Float32Array(n);
    const hp = new SVF(7200, 0.8), bp = new SVF(10500, 1.3);
    const ph = METAL.map(() => rand());
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let m = 0;
      for (let k = 0; k < 6; k++) { ph[k] = (ph[k] + METAL[k] * 1.9 / SR) % 1; m += ph[k] < 0.5 ? 1 : -1; }
      hp.run(noise() * 0.7 + m / 6 * 0.5);
      bp.run(hp.hp);
      o[i] = (hp.hp * 0.7 + bp.bp * 0.6) * clamp(t / 0.0005) * Math.exp(-t / decay) * fade(t, len);
    }
    return o;
  }

  function crash({ len = 2.4, decay = 0.9, bright = 1 } = {}) {
    const n = Math.round(len * SR), o = [new Float32Array(n), new Float32Array(n)];
    const f = [new SVF(4200 * bright, 0.7), new SVF(4400 * bright, 0.7)];
    const ph = METAL.map(() => rand());
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let m = 0;
      for (let k = 0; k < 6; k++) { ph[k] = (ph[k] + METAL[k] * 3.1 / SR) % 1; m += ph[k] < 0.5 ? 1 : -1; }
      const env = clamp(t / 0.002) * (Math.exp(-t / decay) * 0.8 + Math.exp(-t / 0.05) * 0.5) * fade(t, len, 0.2);
      for (let c = 0; c < 2; c++) { f[c].run(noise() * 0.8 + m / 6 * 0.3); o[c][i] = f[c].hp * env; }
    }
    return o;
  }

  // Clock tick: a resonant click with a small wooden body.
  function tick(pitch = 1) {
    const len = 0.07, n = Math.round(len * SR), o = new Float32Array(n);
    const bp = new SVF(3400 * pitch, 2.5);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      bp.run(noise());
      o[i] = (bp.bp * Math.exp(-t / 0.004) * 1.6
        + Math.sin(TAU * 2300 * pitch * t) * Math.exp(-t / 0.009) * 0.35
        + Math.sin(TAU * 1150 * pitch * t) * Math.exp(-t / 0.016) * 0.3) * fade(t, len);
    }
    return o;
  }

  // UI pop: a sine that bends up into pitch.
  function blip(m, { decay = 0.055, len = 0.22 } = {}) {
    const f0 = mtof(m), n = Math.round(len * SR), o = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += f0 * (1 - 0.28 * Math.exp(-t / 0.012)) / SR;
      o[i] = (Math.sin(TAU * ph) + 0.25 * Math.sin(2 * TAU * ph)) * clamp(t / 0.002) * Math.exp(-t / decay) * fade(t, len);
    }
    return o;
  }

  // Two-operator FM bell.
  function bell(m, { decay = 0.8, ratio = 3.5, index = 1.6 } = {}) {
    const f = mtof(m), len = decay * 4, n = Math.round(len * SR), o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const mod = index * Math.exp(-t / 0.18) * Math.sin(TAU * f * ratio * t);
      o[i] = Math.sin(TAU * f * t + mod) * clamp(t / 0.0015) * Math.exp(-t / decay) * fade(t, len, 0.05);
    }
    return o;
  }

  function pluck(m, { decay = 0.15, bright = 4200, q = 1.6 } = {}) {
    const f = mtof(m), dt = f / SR, dt2 = f * 1.006 / SR, len = decay * 3.5;
    const n = Math.round(len * SR), o = new Float32Array(n), flt = new SVF(bright, q);
    let p1 = rand(), p2 = rand();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      p1 += dt; if (p1 >= 1) p1 -= 1;
      p2 += dt2; if (p2 >= 1) p2 -= 1;
      let p3 = p2 + 0.5; if (p3 >= 1) p3 -= 1;
      const saw = 2 * p1 - 1 - blep(p1, dt);
      const sq = (2 * p2 - 1 - blep(p2, dt2)) - (2 * p3 - 1 - blep(p3, dt2));
      if ((i & 7) === 0) flt.set(350 + bright * Math.exp(-t / 0.045), q);
      o[i] = flt.run(saw * 0.6 + sq * 0.3) * clamp(t / 0.0015) * Math.exp(-t / decay) * fade(t, len, 0.03);
    }
    return o;
  }

  // Sine sub plus a filtered saw so the bass still reads on laptop and phone speakers.
  function bass(m, len, { rel = 0.05 } = {}) {
    const f = mtof(m), dt = f * 1.003 / SR, n = Math.round((len + rel) * SR), o = new Float32Array(n);
    const flt = new SVF(700, 0.8);
    let ps = 0, pw = rand();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ps += f / SR; if (ps >= 1) ps -= 1;
      pw += dt; if (pw >= 1) pw -= 1;
      const grit = flt.run(2 * pw - 1 - blep(pw, dt));
      o[i] = Math.tanh(1.6 * (Math.sin(TAU * ps) * 0.8 + grit * 0.85)) / Math.tanh(1.6) * adsr(t, len, 0.005, 0.15, 0.85, rel);
    }
    return o;
  }

  // Detuned supersaw chord through a swept low-pass.
  function saws(notes, len, { a = 0.006, d = 0.3, s = 0.8, rel = 0.1, cutoff = () => 5000, q = 0.8, voices = 7, detune = 24, width = 0.9 } = {}) {
    const n = Math.round((len + rel) * SR), L = new Float32Array(n), R = new Float32Array(n);
    const osc = [];
    for (const m of notes) for (let v = 0; v < voices; v++) {
      const x = voices > 1 ? v / (voices - 1) * 2 - 1 : 0;
      const side = (v < voices / 2) === (v % 2 === 0) ? -1 : 1;
      const pan = x === 0 ? 0 : side * width * (0.35 + 0.65 * Math.abs(x));
      osc.push({ dt: mtof(m) * Math.pow(2, x * detune / 1200) / SR, ph: rand(), gl: panL(pan), gr: panR(pan) });
    }
    const norm = 1 / Math.sqrt(osc.length), fl = new SVF(), fr = new SVF();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let l = 0, r = 0;
      for (const o of osc) {
        o.ph += o.dt; if (o.ph >= 1) o.ph -= 1;
        const v = 2 * o.ph - 1 - blep(o.ph, o.dt);
        l += v * o.gl; r += v * o.gr;
      }
      if ((i & 15) === 0) { const c = cutoff(t); fl.set(c, q); fr.set(c, q); }
      const env = adsr(t, len, a, d, s, rel) * norm;
      L[i] = fl.run(l) * env; R[i] = fr.run(r) * env;
    }
    return [L, R];
  }

  function whoosh(len, { f0 = 400, f1 = 5000, peak = 0.75, q = 1.1, pan0 = -0.6, pan1 = 0.6, down = false } = {}) {
    const n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n);
    const a = new SVF(), b = new SVF();
    for (let i = 0; i < n; i++) {
      const u = i / n, fc = f0 * Math.pow(f1 / f0, down ? 1 - u : u);
      if ((i & 15) === 0) { a.set(fc, q); b.set(fc * 2.1, q * 1.3); }
      const x = noise();
      a.run(x); b.run(x);
      const env = u < peak ? Math.pow(u / peak, 2) : Math.pow(1 - (u - peak) / (1 - peak), 1.6);
      const s = (a.bp + b.bp * 0.5) * env, p = pan0 + (pan1 - pan0) * u;
      L[i] = s * panL(p); R[i] = s * panR(p);
    }
    return [L, R];
  }

  // Noise sweep plus a saw stack gliding up two octaves.
  function riser(len, { f0 = 220, f1 = 9000, m0 = 52, tone = 0.3 } = {}) {
    const n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n);
    const nl = new SVF(), nr = new SVF(), tl = new SVF();
    const ph = [rand(), rand(), rand()], det = [-0.12, 0, 0.12];
    for (let i = 0; i < n; i++) {
      const u = i / n, t = i / SR;
      if ((i & 15) === 0) { const fc = f0 * Math.pow(f1 / f0, u * u); nl.set(fc, 1.4); nr.set(fc * 1.06, 1.4); tl.set(500 + 7000 * u * u, 0.9); }
      nl.run(noise()); nr.run(noise());
      let saw = 0;
      for (let k = 0; k < 3; k++) { ph[k] = (ph[k] + mtof(m0 + det[k] + 24 * u * u) / SR) % 1; saw += 2 * ph[k] - 1; }
      tl.run(saw / 3);
      const env = Math.pow(u, 2.2) * fade(t, len, 0.004);
      L[i] = (nl.bp + tl.lp * tone) * env; R[i] = (nr.bp + tl.lp * tone) * env;
    }
    return [L, R];
  }

  // Sub boom + low thud for scene hits.
  function impact({ size = 1, len = 2.6 } = {}) {
    const n = Math.round(len * SR), o = new Float32Array(n), lp = new SVF(220, 0.7);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (30 + 70 * Math.exp(-t / 0.08)) / SR;
      const boom = Math.sin(TAU * ph) * clamp(t / 0.002) * Math.exp(-t / (0.55 * size));
      const thud = lp.run(noise()) * Math.exp(-t / 0.07) * 3;
      o[i] = Math.tanh(1.4 * (boom + thud)) / Math.tanh(1.4) * fade(t, len, 0.3);
    }
    return o;
  }

  // Padlock shackle snapping shut: thump, metal ring, and a second latch click.
  function clunk() {
    const len = 0.5, n = Math.round(len * SR), o = new Float32Array(n), hp = new SVF(2500, 0.7);
    const partials = [[1480, 0.05, 0.35], [2650, 0.035, 0.28], [3920, 0.025, 0.2], [5310, 0.016, 0.12]];
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, t2 = t - 0.045;
      ph += (65 + 120 * Math.exp(-t / 0.018)) / SR;
      let metal = 0;
      for (const [f, d, a] of partials) {
        metal += Math.sin(TAU * f * t) * Math.exp(-t / d) * a;
        if (t2 > 0) metal += Math.sin(TAU * f * 1.07 * t2) * Math.exp(-t2 / d) * a * 0.5;
      }
      hp.run(noise());
      const click = hp.hp * (Math.exp(-t / 0.002) + (t2 > 0 ? Math.exp(-t2 / 0.0015) * 0.5 : 0));
      o[i] = (Math.sin(TAU * ph) * Math.exp(-t / 0.08) * 0.9 + metal + click * 0.6) * fade(t, len, 0.05);
    }
    return o;
  }

  // Soft two-note "blocked" cue for the red ✕.
  function denied() {
    const len = 0.3, n = Math.round(len * SR), o = new Float32Array(n), flt = new SVF(2000, 0.8);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, second = t >= 0.09, tn = second ? t - 0.09 : t;
      const dt = mtof(second ? 73 : 76) / SR;
      p = (p + dt) % 1;
      const p2 = (p + 0.5) % 1;
      const sq = (2 * p - 1 - blep(p, dt)) - (2 * p2 - 1 - blep(p2, dt));
      const gate = second || t < 0.085 ? 1 : clamp((0.09 - t) / 0.005);
      o[i] = flt.run(sq * 0.5) * clamp(tn / 0.002) * Math.exp(-tn / (second ? 0.07 : 0.04)) * gate * fade(t, len, 0.02);
    }
    return o;
  }

  // Laser-ish zap: a fast downward FM chirp with a noisy edge.
  function zap({ len = 0.22, f0 = 1800, f1 = 180 } = {}) {
    const n = Math.round(len * SR), o = new Float32Array(n), hp = new SVF(3000, 0.7);
    let ph = 0, pm = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = t / len, f = f0 * Math.pow(f1 / f0, Math.pow(u, 0.6));
      ph += f / SR; pm += f * 1.5 / SR;
      hp.run(noise());
      const mod = 2.5 * Math.exp(-t / 0.05) * Math.sin(TAU * pm);
      o[i] = (Math.sin(TAU * ph + mod) * 0.8 + hp.hp * Math.exp(-t / 0.01) * 0.4) * clamp(t / 0.002) * Math.pow(1 - u, 1.5);
    }
    return o;
  }

  // ---------- effects ----------
  // Freeverb (Jezar's tunings, rescaled to 48k) with pre-delay and a low cut on the input.
  function reverb(inL, inR, { room = 0.84, damp = 0.3, pre = 0.018 } = {}) {
    const k = SR / 44100;
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
    const line = len => ({ b: new Float32Array(Math.round(len * k)), i: 0, s: 0 });
    const chans = [0, 23].map(off => ({ c: combs.map(l => line(l + off)), a: aps.map(l => line(l + off)) }));
    const fb = room * 0.28 + 0.7, d1 = damp * 0.4, d2 = 1 - d1;
    const hp = new SVF(300, 0.7), pd = Math.round(pre * SR);
    const o = [new Float32Array(N), new Float32Array(N)];
    for (let n = 0; n < N; n++) {
      let x = 0;
      if (n >= pd) { hp.run(inL[n - pd] + inR[n - pd]); x = hp.hp * 0.015; }
      for (let ch = 0; ch < 2; ch++) {
        let y = 0;
        for (const c of chans[ch].c) {
          const v = c.b[c.i];
          c.s = v * d2 + c.s * d1;
          c.b[c.i] = x + c.s * fb;
          if (++c.i === c.b.length) c.i = 0;
          y += v;
        }
        for (const a of chans[ch].a) {
          const v = a.b[a.i];
          a.b[a.i] = y + v * 0.5;
          if (++a.i === a.b.length) a.i = 0;
          y = v - y;
        }
        o[ch][n] = y;
      }
    }
    return o;
  }

  function pingpong(inL, inR, time, fb) {
    const d = Math.round(time * SR), bl = new Float32Array(d), br = new Float32Array(d);
    const hp = new SVF(350, 0.6), lpA = new SVF(3600, 0.6), lpB = new SVF(3600, 0.6);
    const o = [new Float32Array(N), new Float32Array(N)];
    for (let n = 0, i = 0; n < N; n++) {
      const yl = bl[i], yr = br[i];
      hp.run((inL[n] + inR[n]) * 0.5);
      bl[i] = lpA.run(hp.hp + yr * fb);
      br[i] = lpB.run(yl * fb);
      o[0][n] = yl; o[1][n] = yr;
      if (++i === d) i = 0;
    }
    return o;
  }

  // ---------- buses ----------
  const bus = () => [new Float32Array(N), new Float32Array(N)];
  const B = { drums: bus(), duck: bus(), fx: bus(), rev: bus(), dly: bus() };

  function place(sig, t0, { to = B.fx, gain = 1, pan = 0, rev = 0, dly = 0 } = {}) {
    const [l, r] = sig instanceof Float32Array ? [sig, sig] : sig;
    const gl = gain * panL(pan), gr = gain * panR(pan), s0 = Math.round(t0 * SR);
    for (let i = Math.max(0, -s0); i < l.length && s0 + i < N; i++) {
      const j = s0 + i, vl = l[i] * gl, vr = r[i] * gr;
      to[0][j] += vl; to[1][j] += vr;
      if (rev) { B.rev[0][j] += vl * rev; B.rev[1][j] += vr * rev; }
      if (dly) { B.dly[0][j] += vl * dly; B.dly[1][j] += vr * dly; }
    }
  }

  // Sidechain: the duck bus (chords, bass, arp) pumps against kicks and snares.
  const sc = new Float32Array(N).fill(1);
  function duckAt(t, depth, rel = 0.27) {
    const s0 = Math.round(t * SR), n = Math.round(rel * SR), att = 0.004 * SR;
    for (let i = 0; i < n; i++) {
      const j = s0 + i;
      if (j < 0 || j >= N) continue;
      const u = i / n, smooth = u * u * (3 - 2 * u);
      sc[j] = Math.min(sc[j], 1 - depth * Math.min(1, i / att) * (1 - smooth));
    }
  }

  // Short silences right before the drops.
  const gate = new Float32Array(N).fill(1);
  function gap(t0, t1) {
    const a = Math.round(t0 * SR), b = Math.round(t1 * SR), fIn = Math.round(0.004 * SR), fOut = Math.round(0.001 * SR);
    for (let i = Math.max(0, a - fIn); i < Math.min(N, b + fOut); i++) {
      gate[i] = Math.min(gate[i], i < a ? (a - i) / fIn : i >= b ? (i - b) / fOut : 0);
    }
  }

  // Sums the buses (sidechain + gates applied), adds reverb/delay returns, limits, fades the tail and writes 16-bit WAV.
  function mixdown(out, { delay, drive = 0.5, ceil = -1.5, rev = 0.9, dly = 0.35, fadeOut = 0.45, sections = [] }) {
    const rv = reverb(B.rev[0], B.rev[1]);
    const dl = pingpong(B.dly[0], B.dly[1], delay, 0.38);
    const L = new Float32Array(N), R = new Float32Array(N);
    const hl = new SVF(28, 0.7), hr = new SVF(28, 0.7), al = new SVF(4500, 0.7), ar = new SVF(4500, 0.7);
    for (let i = 0; i < N; i++) {
      const g = gate[i], d = sc[i] * g;
      hl.run(B.drums[0][i] * g + B.duck[0][i] * d + B.fx[0][i] + rv[0][i] * rev + dl[0][i] * dly);
      hr.run(B.drums[1][i] * g + B.duck[1][i] * d + B.fx[1][i] + rv[1][i] * rev + dl[1][i] * dly);
      al.run(hl.hp); ar.run(hr.hp); // +2.5 dB of air above ~4.5 kHz
      L[i] = (hl.hp + 0.33 * al.hp) * drive; R[i] = (hr.hp + 0.33 * ar.hp) * drive;
    }
    const [minG, busy] = limit(L, R, Math.pow(10, ceil / 20));
    const f0 = duration - fadeOut;
    for (let i = Math.round(f0 * SR); i < N; i++) {
      const g = 0.5 + 0.5 * Math.cos(Math.PI * clamp((i / SR - f0) / fadeOut));
      L[i] *= g; R[i] *= g;
    }

    // 16-bit PCM with TPDF dither
    const data = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) {
      data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767 + rand() - rand()))), i * 4);
      data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767 + rand() - rand()))), i * 4 + 2);
    }
    const hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
    hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
    hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
    fs.writeFileSync(out, Buffer.concat([hdr, data]));

    const db = x => (20 * Math.log10(x + 1e-9)).toFixed(1);
    const rms = (a, b, s0 = 0, s1 = N) => { let s = 0; for (let i = s0; i < s1; i++) s += a[i] * a[i] + b[i] * b[i]; return Math.sqrt(s / (2 * (s1 - s0))); };
    for (const [k, [a, b]] of Object.entries({ drums: B.drums, duck: B.duck, fx: B.fx, reverb: rv, delay: dl })) console.log(`${k.padEnd(7)} rms ${db(rms(a, b))} dBFS`);
    for (const [a, b] of sections) {
      console.log(`${a.toFixed(2).padStart(5)}–${b.toFixed(2).padEnd(5)} rms ${db(rms(L, R, Math.round(a * SR), Math.round(b * SR)))} dBFS`);
    }
    console.log(`limiter: max ${db(minG)} dB, >1 dB reduction ${(busy * 100).toFixed(1)}% of the time; wrote ${out}`);
  }

  return {
    N, rand, noise, B, place, duckAt, gap, mixdown,
    kick, snare, hat, crash, tick, blip, bell, pluck, bass, saws, whoosh, riser, impact, clunk, denied, zap,
  };
}

module.exports = { SR, clamp, mtof, reverse, session };

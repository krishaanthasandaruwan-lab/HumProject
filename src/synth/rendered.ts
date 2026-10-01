// Voices rendered sample by sample, once per pitch, then cached: piano (inharmonic partials on two
// slightly detuned strings), guitar and finger bass (Karplus–Strong plucked strings), bells and
// marimba (modal partials). Pure functions of (sample rate, frequency) — no sample files.

export interface RenderedSpec {
  render: (sr: number, hz: number) => Float32Array<ArrayBuffer>;
  release: number; // fade after note-off (s)
  gain: number;
  /** Keeps ringing after note-off (struck instruments). */
  ring?: boolean;
  /** Softer notes are darker (a velocity-controlled low-pass). */
  dynamicTone?: boolean;
  /** Played instead while the real voice is still being rendered. */
  stand_in: string;
}

const clampDur = (s: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, s));

function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

function normalize(y: Float32Array<ArrayBuffer>, peak = 0.8): Float32Array<ArrayBuffer> {
  let m = 0;
  for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]));
  if (m > 0) for (let i = 0; i < y.length; i++) y[i] *= peak / m;
  return y;
}

/** Sum of exponentially decaying sine partials (ratio, amplitude, T60 seconds), with a short attack. */
function modal(sr: number, hz: number, dur: number, partials: [number, number, number][], attack = 0.001, detuneCents = 0): Float32Array<ArrayBuffer> {
  const n = Math.round(dur * sr);
  const y = new Float32Array(n);
  for (const [ratio, amp, t60] of partials) {
    for (const det of detuneCents ? [-detuneCents, detuneCents] : [0]) {
      const f = hz * ratio * Math.pow(2, det / 1200);
      if (f >= sr * 0.45) continue;
      const w = (2 * Math.PI * f) / sr;
      const c = Math.cos(w);
      const s = Math.sin(w);
      const decay = Math.exp(-6.9 / (t60 * sr));
      let re = 1;
      let im = 0;
      let env = amp / (detuneCents ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const r2 = re * c - im * s;
        im = re * s + im * c;
        re = r2;
        y[i] += env * im;
        env *= decay;
      }
    }
  }
  const a = Math.max(1, Math.round(attack * sr));
  for (let i = 0; i < Math.min(a, n); i++) y[i] *= i / a;
  return y;
}

export function renderPiano(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const t60 = clampDur(3 * Math.pow(261.6 / hz, 0.5), 0.7, 5);
  const B = 0.00025; // string stiffness: upper partials run slightly sharp
  const partials: [number, number, number][] = [];
  for (let p = 1; p <= 14 && p * hz < 9000; p++) {
    const hammer = Math.abs(Math.sin((Math.PI * p) / 7)) + 0.15; // struck at 1/7 of the string
    partials.push([p * Math.sqrt(1 + B * p * p), (hammer * Math.pow(p, -1.15)) / 1.15, t60 / (1 + 0.4 * (p - 1))]);
  }
  const y = modal(sr, hz, clampDur(t60 * 0.8, 1, 2.4), partials, 0.0015, 0.8);
  const thump = noise(Math.round(hz));
  let lp = 0;
  for (let i = 0; i < Math.round(0.012 * sr); i++) {
    lp += 0.08 * (thump() - lp);
    y[i] += lp * 0.25 * (1 - i / (0.012 * sr));
  }
  return normalize(y);
}

/** Karplus–Strong: a noise burst circulating in a damped delay line one period long. */
export function renderPluck(sr: number, hz: number, t60 = 2.2, bright = 0.6, dur = 1.6): Float32Array<ArrayBuffer> {
  const n = Math.round(dur * sr);
  const y = new Float32Array(n);
  const period = sr / hz;
  const delay = period - 0.5; // the 2-tap average adds half a sample
  const g = Math.pow(10, -3 / (t60 * hz));
  const rnd = noise(Math.round(hz * 7));
  // Excitation: one period of low-passed noise with its DC removed (DC would circulate forever).
  const burst = Math.max(2, Math.round(period));
  const e = new Float32Array(burst);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < burst; i++) {
    lp += bright * (rnd() - lp);
    e[i] = lp;
    mean += lp / burst;
  }
  for (let i = 0; i < burst; i++) e[i] -= mean;
  const at = (x: number): number => {
    const k = Math.floor(x);
    const fr = x - k;
    return y[k] * (1 - fr) + (k + 1 < n ? y[k + 1] * fr : 0);
  };
  for (let i = 0; i < n; i++) {
    let v = i < burst ? e[i] : 0;
    const back = i - delay;
    if (back >= 1) v += g * 0.5 * (at(back) + at(back - 1));
    y[i] = v;
  }
  for (let i = 0; i < n; i++) y[i] *= Math.min(1, (n - i) / (0.05 * sr));
  return normalize(y);
}

/** Music-box / celesta bell: a strong fundamental and octave keep it in tune; the inharmonic shimmer dies fast. */
export function renderBell(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const s = Math.pow(523 / hz, 0.3);
  return normalize(modal(sr, hz, 2, [[1, 1, 2.2 * s], [2.005, 0.42, 1.3 * s], [3, 0.18, 0.8 * s], [4.16, 0.12, 0.35 * s], [5.43, 0.07, 0.2 * s]]));
}

export function renderMarimba(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const y = modal(sr, hz, 1.1, [[1, 1, 0.9 * Math.pow(261.6 / hz, 0.4)], [3.93, 0.35, 0.25], [9.2, 0.12, 0.08]], 0.0008);
  const tick = noise(Math.round(hz * 3));
  for (let i = 0; i < Math.round(0.003 * sr); i++) y[i] += tick() * 0.15 * (1 - i / (0.003 * sr));
  return normalize(y);
}

/** Kalimba: a metal tine — a pure fundamental, one high inharmonic ping and a tiny click. */
export function renderKalimba(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const s = Math.pow(440 / hz, 0.3);
  const y = modal(sr, hz, 1.6, [[1, 1, 1.4 * s], [5.4, 0.22, 0.14], [8.9, 0.06, 0.05]], 0.001);
  const tick = noise(Math.round(hz * 5));
  for (let i = 0; i < Math.round(0.002 * sr); i++) y[i] += tick() * 0.1 * (1 - i / (0.002 * sr));
  return normalize(y);
}

/** Vibraphone: bars with a long ring and the motor's slow tremolo. */
export function renderVibes(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const y = modal(sr, hz, 2.4, [[1, 1, 2.6], [4, 0.28, 0.8], [10, 0.05, 0.2]], 0.001);
  for (let i = 0; i < y.length; i++) y[i] *= 1 - 0.22 * (0.5 - 0.5 * Math.cos((2 * Math.PI * 5.2 * i) / sr));
  return normalize(y);
}

/** Steel drum: a bright, nearly harmonic ring that fades quickly. */
export function renderSteel(sr: number, hz: number): Float32Array<ArrayBuffer> {
  return normalize(modal(sr, hz, 1.4, [[1, 1, 1.1], [2, 0.55, 0.8], [3, 0.25, 0.45], [4.04, 0.18, 0.25], [5.1, 0.07, 0.15]], 0.002));
}

/** Music box: a high comb tooth, clear and short. */
export function renderMusicBox(sr: number, hz: number): Float32Array<ArrayBuffer> {
  return normalize(modal(sr, hz, 1.5, [[1, 1, 1.5], [3, 0.3, 0.4], [6.3, 0.1, 0.12]], 0.0008));
}

export const RENDERED: Record<string, RenderedSpec> = {
  piano: { render: renderPiano, release: 0.18, gain: 0.5, dynamicTone: true, stand_in: 'keys' },
  pluck: { render: (sr, hz) => renderPluck(sr, hz, 2.2, 0.6), release: 0.12, gain: 0.8, stand_in: 'keys' },
  fingerbass: { render: (sr, hz) => renderPluck(sr, hz, 2.6, 0.25, 1.4), release: 0.08, gain: 0.9, stand_in: 'bass' },
  bell: { render: renderBell, release: 0.6, gain: 0.33, ring: true, stand_in: 'keys' },
  marimba: { render: renderMarimba, release: 0.3, gain: 0.54, ring: true, stand_in: 'keys' },
  harp: { render: (sr, hz) => renderPluck(sr, hz, 3.2, 0.85, 2.2), release: 0.4, gain: 0.76, ring: true, stand_in: 'keys' },
  ukulele: { render: (sr, hz) => renderPluck(sr, hz, 1.2, 0.75, 1.1), release: 0.1, gain: 0.95, stand_in: 'keys' },
  upright: { render: (sr, hz) => renderPluck(sr, hz, 1.8, 0.16, 1.3), release: 0.08, gain: 0.95, stand_in: 'bass' },
  kalimba: { render: renderKalimba, release: 0.4, gain: 0.4, ring: true, stand_in: 'keys' },
  vibes: { render: renderVibes, release: 0.5, gain: 0.36, ring: true, stand_in: 'keys' },
  steel: { render: renderSteel, release: 0.3, gain: 0.48, ring: true, stand_in: 'keys' },
  musicbox: { render: renderMusicBox, release: 0.4, gain: 0.34, ring: true, stand_in: 'keys' },
};

export const isRendered = (id: string): boolean => id in RENDERED;

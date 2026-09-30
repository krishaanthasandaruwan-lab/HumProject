// Synthetic test signals: clicks, sine bursts, filtered noise, hums.
export const SR = 48000;

export function rng(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

export function silence(seconds: number, sr = SR): Float32Array {
  return new Float32Array(Math.round(seconds * sr));
}

export function addNoise(x: Float32Array, level: number, seed = 7): Float32Array {
  const r = rng(seed);
  for (let i = 0; i < x.length; i++) x[i] += r() * level;
  return x;
}

/** Adds `x` at time t, with a 5 ms fade-out so sounds end smoothly like real ones. */
export function mixAt(out: Float32Array, x: Float32Array, t: number, gain = 1, sr = SR): void {
  const s = Math.round(t * sr);
  const fade = Math.min(x.length, Math.round(0.005 * sr));
  for (let i = 0; i < x.length && s + i < out.length; i++) {
    const g = i >= x.length - fade && x.length > 3 ? (x.length - i) / fade : 1;
    if (s + i >= 0) out[s + i] += x[i] * gain * g;
  }
}

export function click(amp = 0.9): Float32Array {
  return new Float32Array([amp, -amp * 0.5, amp * 0.25]);
}

export function sineBurst(hz: number, seconds: number, decay = 0.05, amp = 0.8, sr = SR): Float32Array {
  const n = Math.round(seconds * sr);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr) * Math.exp(-i / sr / decay);
  return y;
}

/** Kick-like "B": pitch drop 150 -> 60 Hz. */
export function kickB(amp = 0.8, sr = SR): Float32Array {
  const n = Math.round(0.14 * sr);
  const y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * (60 + 90 * Math.exp(-t / 0.03))) / sr;
    y[i] = amp * Math.sin(ph) * Math.exp(-t / 0.05);
  }
  return y;
}

function onePoleHP(x: Float32Array, fc: number, sr = SR): Float32Array {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  const y = new Float32Array(x.length);
  let px = 0;
  let py = 0;
  for (let i = 0; i < x.length; i++) {
    py = a * (py + x[i] - px);
    px = x[i];
    y[i] = py;
  }
  return y;
}

function onePoleLP(x: Float32Array, fc: number, sr = SR): Float32Array {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  const y = new Float32Array(x.length);
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    p = (1 - a) * x[i] + a * p;
    y[i] = p;
  }
  return y;
}

export function noiseBurst(seconds: number, decay: number, seed = 3, sr = SR): Float32Array {
  const r = rng(seed);
  const n = Math.round(seconds * sr);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = r() * Math.exp(-i / sr / decay);
  return y;
}

/** Hat-like "ts": noise high-passed twice at 6.5 kHz. */
export function hatTs(amp = 1.4, seed = 5): Float32Array {
  const y = onePoleHP(onePoleHP(noiseBurst(0.07, 0.025, seed), 6500), 6500);
  for (let i = 0; i < y.length; i++) y[i] *= amp;
  return y;
}

/** Snare-like "K"/"psh": noise band-limited to roughly 1–4 kHz. */
export function snareK(amp = 2.2, seed = 9): Float32Array {
  const hp = onePoleHP(onePoleHP(noiseBurst(0.13, 0.045, seed), 1000), 1000);
  const y = onePoleLP(onePoleLP(onePoleLP(hp, 4000), 4000), 4000);
  for (let i = 0; i < y.length; i++) y[i] *= amp;
  return y;
}

/** Voiced hum with harmonics and gentle vibrato. */
export function hum(midi: number, seconds: number, amp = 0.3, sr = SR): Float32Array {
  const n = Math.round(seconds * sr);
  const y = new Float32Array(n);
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * f0 * (1 + 0.003 * Math.sin(2 * Math.PI * 5 * t))) / sr;
    const env = Math.min(1, t / 0.02) * Math.min(1, (seconds - t) / 0.03);
    y[i] = amp * env * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph));
  }
  return y;
}

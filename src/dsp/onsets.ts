// Spectral-flux onset detection: 1024-sample Hann frames, hop 256, adaptive median threshold,
// ≥70 ms between onsets, then a waveform-envelope refinement for sub-hop timing accuracy.
import { FrameAnalyzer } from './fft';

export interface Onset {
  time: number; // seconds from the start of the signal
  strength: number; // normalised flux peak
  rms: number; // RMS over the 60 ms after the onset — used as velocity
}

export interface OnsetOptions {
  frameSize?: number;
  hop?: number;
  medianRadius?: number;
  k?: number;
  delta?: number;
  minGapMs?: number;
}

function median(values: Float32Array, lo: number, hi: number, scratch: number[]): number {
  scratch.length = 0;
  for (let i = lo; i <= hi; i++) scratch.push(values[i]);
  scratch.sort((a, b) => a - b);
  return scratch[scratch.length >> 1];
}

export function rmsAt(signal: ArrayLike<number>, start: number, length: number): number {
  let sum = 0;
  let n = 0;
  const s0 = Math.max(0, start);
  const s1 = Math.min(signal.length, start + length);
  for (let i = s0; i < s1; i++) {
    sum += signal[i] * signal[i];
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/** Log-spaced bands (3 per octave from 50 Hz) as [firstBin, lastBin] pairs, each ≥ 1 bin wide. */
function bandEdges(frameSize: number, sr: number): [number, number][] {
  const binHz = sr / frameSize;
  const maxBin = frameSize / 2;
  const bands: [number, number][] = [];
  let lo = Math.max(1, Math.round(50 / binHz));
  for (let i = 1; lo <= maxBin; i++) {
    const hi = Math.min(maxBin, Math.max(lo, Math.round((50 * Math.pow(2, i / 3)) / binHz) - 1));
    bands.push([lo, hi]);
    lo = hi + 1;
  }
  return bands;
}

/**
 * Spectral flux per hop (frames centred on i·hop): positive log-magnitude increases summed over
 * log-spaced bands, so a low "B" kick counts as much as a broadband snare or a bright hat.
 */
export function spectralFlux(signal: ArrayLike<number>, sr: number, frameSize = 1024, hop = 256): Float32Array {
  const frames = Math.max(1, Math.ceil(signal.length / hop));
  const an = new FrameAnalyzer(frameSize);
  const mag = new Float32Array(an.bins);
  const bands = bandEdges(frameSize, sr);
  const prev = new Float32Array(bands.length);
  const flux = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    an.magnitudes(signal, i * hop - frameSize / 2, mag);
    let f = 0;
    for (let b = 0; b < bands.length; b++) {
      const [lo, hi] = bands[b];
      let sum = 0;
      for (let k = lo; k <= hi; k++) sum += mag[k];
      const m = Math.log1p(1000 * (sum / (hi - lo + 1)));
      const d = m - prev[b];
      if (d > 0) f += d;
      prev[b] = m;
    }
    flux[i] = i === 0 ? 0 : f;
  }
  return flux;
}

/**
 * Sub-hop attack time near `center`: in 1 ms envelope blocks, find the steepest rise above the
 * running minimum, then the first block that gets half-way from that minimum to the rise's peak.
 */
function refine(signal: ArrayLike<number>, center: number, sr: number): number {
  const block = Math.max(8, Math.round(sr / 1000));
  const from = Math.max(0, center - Math.round(0.02 * sr));
  const to = Math.min(signal.length, center + Math.round(0.008 * sr));
  const env: number[] = [];
  for (let s = from; s < to; s += block) {
    let m = 0;
    for (let i = s; i < Math.min(to, s + block); i++) m = Math.max(m, Math.abs(signal[i]));
    env.push(m);
  }
  if (env.length < 2) return center;
  let best = -Infinity;
  let peak = 0;
  let floorIdx = 0;
  let bestFloor = 0;
  let runMin = 0;
  for (let i = 1; i < env.length; i++) {
    if (env[i - 1] < env[runMin]) runMin = i - 1;
    const rise = env[i] - env[runMin];
    if (rise > best) {
      best = rise;
      peak = i;
      bestFloor = runMin;
    }
  }
  if (best <= 0) return center;
  floorIdx = bestFloor;
  const thr = env[floorIdx] + 0.5 * (env[peak] - env[floorIdx]);
  for (let i = floorIdx; i <= peak; i++) {
    if (env[i] < thr) continue;
    const s0 = from + i * block;
    for (let s = s0; s < Math.min(to, s0 + block); s++) if (Math.abs(signal[s]) >= thr) return s;
    return s0;
  }
  return center;
}

export function detectOnsets(signal: Float32Array, sr: number, opts: OnsetOptions = {}): Onset[] {
  const frameSize = opts.frameSize ?? 1024;
  const hop = opts.hop ?? 256;
  const radius = opts.medianRadius ?? 8;
  const k = opts.k ?? 1.5;
  const delta = opts.delta ?? 0.06;
  const minGap = ((opts.minGapMs ?? 70) / 1000) * sr;
  const flux = spectralFlux(signal, sr, frameSize, hop);
  const n = flux.length;
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, flux[i]);
  if (max <= 0) return [];
  for (let i = 0; i < n; i++) flux[i] /= max;

  // Absolute gate: ignore flux peaks whose sound never rises clearly above the noise floor.
  const velWin = Math.round(0.06 * sr);
  const riseWin = Math.round(0.03 * sr);
  const frameRms = new Float32Array(n);
  for (let i = 0; i < n; i++) frameRms[i] = rmsAt(signal, i * hop, hop);
  const sorted = Array.from(frameRms).sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const gate = Math.max(0.004, noise * 3);

  const out: Onset[] = [];
  const scratch: number[] = [];
  let lastSample = -Infinity;
  for (let i = 1; i < n - 1; i++) {
    const f = flux[i];
    if (f < flux[i - 1] || f < flux[i + 1]) continue;
    const thr = median(flux, Math.max(0, i - radius), Math.min(n - 1, i + radius), scratch) * k + delta;
    if (f <= thr) continue;
    const at = refine(signal, i * hop, sr);
    const loud = rmsAt(signal, at, velWin);
    if (loud < gate) continue;
    // A real onset makes things louder; a sound being cut off (a click into silence) does not.
    if (rmsAt(signal, at, riseWin) < 1.1 * rmsAt(signal, at - riseWin, riseWin)) continue;
    if (at - lastSample < minGap) {
      const last = out[out.length - 1];
      if (last && f > last.strength) {
        out[out.length - 1] = { time: at / sr, strength: f, rms: loud };
        lastSample = at;
      }
      continue;
    }
    out.push({ time: at / sr, strength: f, rms: loud });
    lastSample = at;
  }
  return out;
}

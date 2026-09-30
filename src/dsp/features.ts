// Per-hit feature vector from a 60 ms window: RMS, spectral centroid, flatness, ZCR,
// share of energy <200 Hz and >5 kHz, and MFCC 1–8 (Meyda for the spectral parts).
import Meyda from 'meyda';
import { hann, nextPow2 } from './fft';

export { F, FEATURE_DIM, FEATURE_NAMES } from './featureIndex';

type MeydaState = typeof Meyda & { melFilterBank?: unknown; barkScale?: unknown; chromaFilterBank?: unknown };
let configured = '';

function configureMeyda(size: number, sr: number): void {
  const key = `${size}@${sr}`;
  if (configured === key) return;
  const m = Meyda as MeydaState;
  m.bufferSize = size;
  m.sampleRate = sr;
  m.windowingFunction = 'rect'; // we window the real (unpadded) 60 ms ourselves
  m.numberOfMFCCCoefficients = 13;
  m.melBands = 26;
  // Meyda caches filter banks and does not always rebuild them when size/rate change.
  m.melFilterBank = undefined;
  m.barkScale = undefined;
  m.chromaFilterBank = undefined;
  configured = key;
}

/** Feature vector for the sound starting at `time` seconds. */
export function extractFeatures(signal: Float32Array, sr: number, time: number, windowMs = 60): number[] {
  const len = Math.max(64, Math.round((windowMs / 1000) * sr));
  const start = Math.max(0, Math.round(time * sr));
  const size = nextPow2(len);
  const win = hann(len);
  const buf = new Float32Array(size);
  let sq = 0;
  let zc = 0;
  let prev = 0;
  let seed = 1234567;
  for (let i = 0; i < len; i++) {
    const s = start + i;
    const v = s < signal.length ? signal[s] : 0;
    sq += v * v;
    if (i > 0 && (v >= 0) !== (prev >= 0)) zc++;
    prev = v;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    buf[i] = v * win[i] + ((seed / 4294967296) - 0.5) * 1e-7; // tiny dither keeps log() finite
  }
  const rms = Math.sqrt(sq / len);
  configureMeyda(size, sr);
  const f = Meyda.extract(['spectralCentroid', 'spectralFlatness', 'mfcc', 'powerSpectrum'], buf);
  const power = (f?.powerSpectrum ?? new Float32Array(size / 2)) as Float32Array;
  const binHz = sr / size;
  let total = 0;
  let low = 0;
  let high = 0;
  for (let k = 1; k < power.length; k++) {
    const hz = k * binHz;
    total += power[k];
    if (hz < 200) low += power[k];
    else if (hz > 5000) high += power[k];
  }
  total = Math.max(total, 1e-20);
  const centroidHz = (f?.spectralCentroid ?? 0) * binHz;
  const mfcc = f?.mfcc ?? [];
  const out = [
    20 * Math.log10(Math.max(rms, 1e-6)),
    centroidHz / 1000,
    Number.isFinite(f?.spectralFlatness) ? (f?.spectralFlatness as number) : 0,
    zc / len,
    low / total,
    high / total,
  ];
  for (let i = 1; i <= 8; i++) out.push(Number.isFinite(mfcc[i]) ? mfcc[i] : 0);
  return out;
}

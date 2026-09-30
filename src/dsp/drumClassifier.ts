// Beatbox sound -> drum. Rules work out of the box; a 20-second personal calibration
// (5 × each sound) trains a z-scored, weighted k-NN (k = 3) that is far more accurate.
import { DRUM_TYPES, type DrumType } from '../model/project';
import { F } from './featureIndex';

export interface Labeled {
  x: number[];
  y: DrumType;
}

export interface Profile {
  version: 1;
  mean: number[];
  std: number[];
  samples: Labeled[];
  createdAt: number;
}

export interface Prediction {
  type: DrumType;
  confidence: number; // 0..1
}

/** Per-feature weights: loudness matters little; the >5 kHz share separates snare from hat. */
export const WEIGHTS = [0.3, 1.2, 1, 1, 1.2, 1.6, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8];

const sig = (z: number): number => 1 / (1 + Math.exp(-z));

/** kick: low centroid + lots of <200 Hz; hat: high centroid, ZCR and >5 kHz; snare: the rest. */
export function classifyRule(x: number[]): Prediction {
  const c = x[F.centroid] * 1000;
  const low = x[F.low];
  const high = x[F.high];
  const zcr = x[F.zcr];
  const kick = sig((1400 - c) / 300) * sig((low - 0.2) / 0.07);
  const hat = sig((c - 5000) / 700) * sig((high - 0.5) / 0.08) * sig((zcr - 0.18) / 0.04);
  const snare = Math.max(0.05, 1 - Math.max(kick, hat));
  const scores: Record<DrumType, number> = { kick, snare, hat };
  let type: DrumType = 'snare';
  for (const t of DRUM_TYPES) if (scores[t] > scores[type]) type = t;
  return { type, confidence: scores[type] / (kick + snare + hat) };
}

export function buildProfile(samples: Labeled[]): Profile {
  const dim = samples[0]?.x.length ?? 0;
  const mean = new Array<number>(dim).fill(0);
  const std = new Array<number>(dim).fill(0);
  for (const s of samples) for (let d = 0; d < dim; d++) mean[d] += s.x[d] / samples.length;
  for (const s of samples) for (let d = 0; d < dim; d++) std[d] += (s.x[d] - mean[d]) ** 2 / samples.length;
  for (let d = 0; d < dim; d++) std[d] = Math.max(Math.sqrt(std[d]), 1e-3 * Math.abs(mean[d]) + 1e-6);
  return { version: 1, mean, std, samples: samples.map((s) => ({ x: [...s.x], y: s.y })), createdAt: Date.now() };
}

function distance(p: Profile, a: number[], b: number[]): number {
  let sum = 0;
  for (let d = 0; d < a.length; d++) {
    const z = (a[d] - b[d]) / p.std[d];
    sum += (WEIGHTS[d] ?? 1) * z * z;
  }
  return Math.sqrt(sum);
}

export function classifyKnn(p: Profile, x: number[], k = 3, skip = -1): Prediction {
  const near = p.samples
    .map((s, i) => ({ y: s.y, d: i === skip ? Infinity : distance(p, x, s.x) }))
    .filter((n) => Number.isFinite(n.d))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  if (near.length === 0) return classifyRule(x);
  const votes: Record<DrumType, number> = { kick: 0, snare: 0, hat: 0 };
  for (const n of near) votes[n.y] += 1 / (n.d + 1e-3);
  let type = near[0].y;
  for (const t of DRUM_TYPES) if (votes[t] > votes[type]) type = t;
  const total = votes.kick + votes.snare + votes.hat;
  return { type, confidence: total > 0 ? votes[type] / total : 0 };
}

/** Uses the personal profile when it covers all three sounds, otherwise the rules. */
export function classify(x: number[], profile?: Profile | null): Prediction {
  if (profile && DRUM_TYPES.every((t) => profile.samples.some((s) => s.y === t))) return classifyKnn(profile, x);
  return classifyRule(x);
}

/** Leave-one-out accuracy of the k-NN on the calibration samples (the "confidence meter"). */
export function looAccuracy(samples: Labeled[], k = 3): number {
  if (samples.length < 2) return 0;
  const p = buildProfile(samples);
  let ok = 0;
  samples.forEach((s, i) => {
    if (classifyKnn(p, s.x, k, i).type === s.y) ok++;
  });
  return ok / samples.length;
}

import { describe, expect, it } from 'vitest';
import { buildProfile, classify, classifyKnn, classifyRule, looAccuracy, type Labeled } from '../src/dsp/drumClassifier';
import { FEATURE_DIM, extractFeatures } from '../src/dsp/features';
import type { DrumType } from '../src/model/project';
import { SR, addNoise, hatTs, kickB, mixAt, noiseBurst, rng, silence, sineBurst, snareK } from './signals';

function featuresOf(sound: Float32Array): number[] {
  const x = addNoise(silence(0.3), 0.001);
  mixAt(x, sound, 0.05);
  return extractFeatures(x, SR, 0.05);
}

function highpassedNoise(): Float32Array {
  return hatTs(1.2, 21);
}

describe('features', () => {
  it('produces a finite 14-dim vector', () => {
    const f = featuresOf(kickB());
    expect(f).toHaveLength(FEATURE_DIM);
    f.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it('separates low and high sounds by centroid and band ratios', () => {
    const low = featuresOf(sineBurst(80, 0.15));
    const high = featuresOf(highpassedNoise());
    expect(low[1]).toBeLessThan(0.5); // centroid kHz
    expect(low[4]).toBeGreaterThan(0.6); // <200 Hz share
    expect(high[1]).toBeGreaterThan(5);
    expect(high[5]).toBeGreaterThan(0.6); // >5 kHz share
  });
});

describe('rule-based classifier', () => {
  it('classifies a low sine burst as kick', () => {
    expect(classifyRule(featuresOf(sineBurst(80, 0.15))).type).toBe('kick');
    expect(classifyRule(featuresOf(kickB())).type).toBe('kick');
  });

  it('classifies a high-passed noise burst as hat', () => {
    expect(classifyRule(featuresOf(highpassedNoise())).type).toBe('hat');
  });

  it('classifies band-limited mid noise as snare', () => {
    expect(classifyRule(featuresOf(snareK())).type).toBe('snare');
    expect(classifyRule(featuresOf(noiseBurst(0.12, 0.04))).type).not.toBe('kick');
  });
});

describe('personal k-NN', () => {
  const centers: Record<DrumType, number[]> = {
    kick: Array.from({ length: FEATURE_DIM }, (_, d) => (d % 3 === 0 ? 5 : 0)),
    snare: Array.from({ length: FEATURE_DIM }, (_, d) => (d % 3 === 1 ? 5 : 0)),
    hat: Array.from({ length: FEATURE_DIM }, (_, d) => (d % 3 === 2 ? 5 : 0)),
  };
  const r = rng(99);
  const sample = (y: DrumType): Labeled => ({ y, x: centers[y].map((c) => c + r() * 1.2) });

  it('classifies 3 separated clusters correctly', () => {
    const train: Labeled[] = [];
    for (const y of ['kick', 'snare', 'hat'] as DrumType[]) for (let i = 0; i < 5; i++) train.push(sample(y));
    const profile = buildProfile(train);
    let correct = 0;
    let total = 0;
    for (const y of ['kick', 'snare', 'hat'] as DrumType[]) {
      for (let i = 0; i < 30; i++) {
        total++;
        if (classifyKnn(profile, sample(y).x).type === y) correct++;
      }
    }
    expect(correct / total).toBe(1);
    expect(looAccuracy(train)).toBe(1);
  });

  it('learns a user whose "kick" is not what the rules expect', () => {
    // This user's kick is a clicky mid sound; rules would call it a snare.
    const x = (s: Float32Array): number[] => featuresOf(s);
    const train: Labeled[] = [];
    for (let i = 0; i < 5; i++) {
      train.push({ y: 'kick', x: x(sineBurst(900 + i * 20, 0.08, 0.02)) });
      train.push({ y: 'snare', x: x(snareK(1.6, 30 + i)) });
      train.push({ y: 'hat', x: x(hatTs(1.4, 50 + i)) });
    }
    const profile = buildProfile(train);
    expect(classifyRule(x(sineBurst(930, 0.08, 0.02))).type).not.toBe('kick');
    expect(classify(x(sineBurst(930, 0.08, 0.02)), profile).type).toBe('kick');
    expect(classify(x(hatTs(1.4, 77)), profile).type).toBe('hat');
    expect(classify(x(snareK(1.6, 88)), profile).type).toBe('snare');
  });
});

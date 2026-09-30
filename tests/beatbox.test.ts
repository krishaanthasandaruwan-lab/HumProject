import { describe, expect, it } from 'vitest';
import { analyzeBeatbox, analyzeCalibration } from '../src/dsp/analyze';
import { buildProfile, type Labeled } from '../src/dsp/drumClassifier';
import type { DrumType } from '../src/model/project';
import { SR, addNoise, hatTs, kickB, mixAt, rng, silence, snareK } from './signals';

const SOUND: Record<DrumType, (seed: number) => Float32Array> = {
  kick: () => kickB(0.8),
  snare: (s) => snareK(2.2, s),
  hat: (s) => hatTs(1.2, s),
};

/** A performance: `pattern` repeated over the loop, one entry per 16th ('.' = rest). */
function perform(pattern: string, bpm: number, bars: number, jitterMs = 0, preroll = 0.15) {
  const map: Record<string, DrumType> = { B: 'kick', K: 'snare', t: 'hat' };
  const sd = 60 / bpm / 4;
  const steps = bars * 16;
  const audio = addNoise(silence(preroll + steps * sd + 0.3), 0.002);
  const r = rng(5);
  const expected: string[] = [];
  for (let s = 0; s < steps; s++) {
    const c = pattern[s % pattern.length];
    if (!map[c]) continue;
    const t = preroll + s * sd + (r() * jitterMs) / 1000;
    mixAt(audio, SOUND[map[c]](s + 1), t);
    expected.push(`${s}${map[c]}`);
  }
  return { audio, expected, preroll };
}

describe('beatbox -> drums pipeline', () => {
  it('turns "B-ts-K-ts" 8ths into the right drum loop (rules only)', () => {
    const { audio, expected, preroll } = perform('B.t.K.t.', 90, 2);
    const res = analyzeBeatbox({ audio, sampleRate: SR, preroll, bpm: 90, bars: 2, swing: 0 });
    expect(res.hits.map((h) => `${h.step}${h.type}`)).toEqual(expected);
  });

  it('survives ±25 ms human timing jitter and 16th-note hats at 100 BPM', () => {
    const { audio, expected, preroll } = perform('BtttKtttBtBtKttt', 100, 2, 25);
    const res = analyzeBeatbox({ audio, sampleRate: SR, preroll, bpm: 100, bars: 2, swing: 0 });
    const got = res.hits.map((h) => `${h.step}${h.type}`);
    const correct = got.filter((g) => expected.includes(g)).length;
    expect(correct / expected.length).toBeGreaterThanOrEqual(0.95);
    expect(got.length).toBeLessThanOrEqual(expected.length + 1);
  });

  it('catches a hit sung slightly before the loop starts (on beat 1)', () => {
    const preroll = 0.15;
    const audio = addNoise(silence(preroll + 3), 0.002);
    mixAt(audio, kickB(), preroll - 0.03);
    const res = analyzeBeatbox({ audio, sampleRate: SR, preroll, bpm: 90, bars: 2, swing: 0 });
    expect(res.hits.map((h) => `${h.step}${h.type}`)).toEqual(['0kick']);
    expect(res.hits[0].offset).toBeLessThan(0);
  });

  it('uses the personal profile from a calibration take', () => {
    // Calibration: 5 cues per sound, answered 60–120 ms late.
    const samples: Labeled[] = [];
    for (const y of ['kick', 'snare', 'hat'] as DrumType[]) {
      const cues = [0.8, 1.55, 2.3, 3.05, 3.8];
      const audio = addNoise(silence(4.6), 0.002);
      cues.forEach((c, i) => mixAt(audio, SOUND[y](i + 40), c + 0.06 + i * 0.015));
      const hits = analyzeCalibration({ audio, sampleRate: SR, cues });
      expect(hits).toHaveLength(5);
      hits.forEach((h) => samples.push({ x: h.x, y }));
    }
    const profile = buildProfile(samples);
    const { audio, expected, preroll } = perform('B.t.K.t.', 90, 1, 10);
    const res = analyzeBeatbox({ audio, sampleRate: SR, preroll, bpm: 90, bars: 1, swing: 0, profile });
    expect(res.hits.map((h) => `${h.step}${h.type}`)).toEqual(expected);
  });
});

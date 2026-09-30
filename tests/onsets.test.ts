import { describe, expect, it } from 'vitest';
import { detectOnsets } from '../src/dsp/onsets';
import { SR, addNoise, click, hatTs, kickB, mixAt, noiseBurst, silence, snareK } from './signals';

describe('onset detection', () => {
  it('finds clicks at known times within 10 ms', () => {
    const times = [0.25, 0.61, 1.0, 1.37, 1.52, 2.0, 2.33];
    const x = addNoise(silence(2.6), 0.001);
    for (const t of times) mixAt(x, click(), t);
    const found = detectOnsets(x, SR).map((o) => o.time);
    expect(found).toHaveLength(times.length);
    found.forEach((t, i) => expect(Math.abs(t - times[i])).toBeLessThan(0.01));
  });

  it('finds beatbox-like hits with mixed loudness within 10 ms', () => {
    const times = [0.2, 0.533, 0.866, 1.2, 1.533, 1.866];
    const sounds = [kickB(), hatTs(0.5), snareK(), hatTs(0.5), kickB(0.5), snareK(0.8)];
    const x = addNoise(silence(2.3), 0.002);
    times.forEach((t, i) => mixAt(x, sounds[i], t));
    const found = detectOnsets(x, SR);
    expect(found.map((o) => o.time)).toHaveLength(times.length);
    found.forEach((o, i) => expect(Math.abs(o.time - times[i])).toBeLessThan(0.01));
  });

  it('keeps at least 70 ms between onsets', () => {
    const x = silence(1);
    mixAt(x, noiseBurst(0.03, 0.01), 0.3);
    mixAt(x, noiseBurst(0.03, 0.01, 11), 0.34);
    const found = detectOnsets(x, SR);
    expect(found).toHaveLength(1);
  });

  it('reports nothing for silence or steady noise', () => {
    expect(detectOnsets(silence(1), SR)).toHaveLength(0);
    expect(detectOnsets(addNoise(silence(2), 0.002), SR)).toHaveLength(0);
  });

  it('uses louder hits for larger RMS', () => {
    const x = silence(1.2);
    mixAt(x, kickB(0.9), 0.2);
    mixAt(x, kickB(0.2), 0.7);
    const [a, b] = detectOnsets(x, SR);
    expect(a.rms).toBeGreaterThan(b.rms * 3);
  });
});

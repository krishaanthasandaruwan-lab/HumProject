import { describe, expect, it } from 'vitest';
import { hitsToGrid, quantizePos, velocityFromRms } from '../src/dsp/quantize';

describe('quantize', () => {
  it('snaps to the nearest 16th and keeps the residual', () => {
    expect(quantizePos(3.2)).toEqual({ step: 3, offset: expect.closeTo(0.2, 6) });
    expect(quantizePos(3.7).step).toBe(4);
    expect(quantizePos(-0.3).step).toBe(0);
  });

  it('snaps to a swung grid', () => {
    // odd steps sit 0.3 late: 1.25 is closer to 1.3 than to 1.0
    const q = quantizePos(1.25, 0.3);
    expect(q.step).toBe(1);
    expect(q.offset).toBeCloseTo(-0.05);
  });

  it('maps RMS to 0.4..1 velocity', () => {
    expect(velocityFromRms(0.5, 0.5)).toBe(1);
    expect(velocityFromRms(0.0001, 0.5)).toBe(0.4);
    const mid = velocityFromRms(0.1, 0.5);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(1);
  });

  it('keeps the louder of two same-drum hits on one step and drops out-of-loop hits', () => {
    const spb = 60 / 120 / 4; // 0.125 s per 16th at 120 BPM
    const hits = hitsToGrid(
      [
        { time: 0.01, type: 'kick', rms: 0.2 },
        { time: 0.04, type: 'kick', rms: 0.5 },
        { time: 0.02, type: 'hat', rms: 0.1 },
        { time: 2 * spb, type: 'snare', rms: 0.3 },
        { time: 40 * spb, type: 'snare', rms: 0.3 },
      ],
      120, 32,
    );
    expect(hits.map((h) => `${h.step}${h.type}`)).toEqual(['0hat', '0kick', '2snare']);
    expect(hits.find((h) => h.type === 'kick')?.velocity).toBe(1);
  });
});

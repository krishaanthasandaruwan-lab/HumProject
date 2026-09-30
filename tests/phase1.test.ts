import { describe, expect, it } from 'vitest';
import { WORKLET_SRC, stitch } from '../src/audio/recorder';
import workletFile from '../public/recorder-worklet.js?raw';
import { phaseAt, planTake } from '../src/audio/metronome';

describe('recorder worklet', () => {
  it('ships the same code as a file and as the inline fallback', () => {
    expect(workletFile.trim()).toBe(WORKLET_SRC.trim());
  });
});

describe('recorder stitching', () => {
  it('places chunks by frame stamp and zero-fills gaps', () => {
    const chunks = [
      { frame: 100, data: new Float32Array([1, 2, 3, 4]) },
      { frame: 110, data: new Float32Array([5, 6]) },
    ];
    const out = stitch(chunks, 102, 10);
    expect(Array.from(out)).toEqual([3, 4, 0, 0, 0, 0, 0, 0, 5, 6]);
  });

  it('returns silence when nothing overlaps', () => {
    expect(Array.from(stitch([{ frame: 0, data: new Float32Array([1]) }], 50, 3))).toEqual([0, 0, 0]);
  });
});

describe('take plan', () => {
  it('schedules a 1-bar count-in followed by bars × 4 beats', () => {
    const p = planTake(10, 120, 4);
    expect(p.beatDur).toBeCloseTo(0.5);
    expect(p.recStart - p.start).toBeCloseTo(2); // 4 beats at 120 BPM
    expect(p.recEnd - p.recStart).toBeCloseTo(8); // 16 beats
  });

  it('reports count-in and recording phases', () => {
    const p = planTake(0, 60, 2, 4, 0);
    expect(phaseAt(p, 1.5)).toEqual({ phase: 'countin', beat: 1 });
    const rec = phaseAt(p, 4 + 5.2);
    expect(rec.phase).toBe('rec');
    if (rec.phase === 'rec') {
      expect(rec.bar).toBe(1);
      expect(rec.beat).toBe(1);
    }
    expect(phaseAt(p, 100).phase).toBe('done');
  });
});

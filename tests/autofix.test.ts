import { describe, expect, it } from 'vitest';
import { fixDrums, fixNotes, timingBias } from '../src/model/autofix';
import type { DrumHit, DrumType, Note } from '../src/model/project';
import { quantizePos } from '../src/dsp/quantize';

const BAR: [number, DrumType][] = [[0, 'kick'], [2, 'hat'], [4, 'snare'], [6, 'hat'], [8, 'kick'], [10, 'hat'], [12, 'snare'], [14, 'hat']];
const pattern = (bars: number, bar = BAR): DrumHit[] =>
  Array.from({ length: bars }, (_, b) => bar.map(([s, type]) => ({ step: b * 16 + s, type, velocity: type === 'hat' ? 0.6 : 0.9 }))).flat();
const shape = (hits: DrumHit[]): string[] => hits.map((h) => `${h.step}${h.type[0]}`).sort();

describe('auto-fix drums', () => {
  it('makes every bar follow the pattern most bars agree on', () => {
    const hits = pattern(4)
      .filter((h) => !(h.step === 22 && h.type === 'hat')) // bar 2: a hat went missing
      .map((h) => (h.step === 32 ? { ...h, type: 'snare' as DrumType } : h)) // bar 3: kick heard as a snare
      .concat([{ step: 61, type: 'hat', velocity: 0.45 }]); // bar 4: a stray breath
    const { hits: fixed, report } = fixDrums(hits, 4, 0);
    expect(shape(fixed)).toEqual(shape(pattern(4)));
    expect(report.changes).toBe(4);
    expect(report.period).toBe(1);
    expect(report.shiftSteps).toBe(0);
  });

  it('keeps a two-bar pattern and only fixes the bar that strays from it', () => {
    const alt: [number, DrumType][] = [[0, 'kick'], [2, 'hat'], [4, 'snare'], [6, 'kick'], [10, 'kick'], [12, 'snare'], [14, 'hat'], [15, 'hat']];
    const two = (b: number): [number, DrumType][] => (b % 2 === 0 ? BAR : alt);
    const clean = Array.from({ length: 4 }, (_, b) => pattern(1, two(b)).map((h) => ({ ...h, step: h.step + b * 16 }))).flat();
    const messy = clean.filter((h) => h.step !== 46); // bar 3 (alt) lost its kick on step 14
    const { hits, report } = fixDrums(messy, 4, 0);
    expect(report.period).toBe(2);
    expect(shape(hits)).toEqual(shape(clean));
  });

  it('pulls consistently late hits back onto their beats (latency off by ~half a step)', () => {
    let seed = 3;
    const jitter = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.2;
    const intended = pattern(2);
    const late = intended.map((h) => {
      const q = quantizePos(h.step + 0.45 + jitter());
      return { ...h, step: q.step % 32, offset: q.offset };
    });
    expect(shape(late)).not.toEqual(shape(intended)); // some hits flipped to the next step
    const { hits, report } = fixDrums(late, 2, 0);
    expect(report.shiftSteps).toBeGreaterThan(0.3);
    expect(shape(hits)).toEqual(shape(intended));
  });

  it('leaves loose but unbiased timing alone', () => {
    const offs = [0.2, -0.25, 0.1, -0.1, 0.3, -0.3, 0.05, -0.15];
    expect(timingBias(offs.map((offset) => ({ offset })))).toBe(0);
  });

  it('reports nothing to do for a clean loop', () => {
    expect(fixDrums(pattern(4), 4, 0).report.changes).toBe(0);
  });
});

const note = (start: number, length: number, midi: number): Note => ({ start, length, midi, velocity: 0.8, raw: midi });

describe('auto-fix melody', () => {
  it('fixes an octave slip, a glitch note and a split note', () => {
    const notes = [
      note(0, 4, 60), note(4, 4, 62), note(8, 4, 76), note(12, 4, 65), // 76: should be 64
      note(16, 3, 67), note(19, 1, 59), note(20, 4, 69), // 59: a scoop glitch
      note(24, 4, 67), note(28, 1, 67), // split re-attack
    ];
    const { notes: out, report } = fixNotes(notes, 2, 0);
    expect(out.map((n) => [n.start, n.length, n.midi])).toEqual([
      [0, 4, 60], [4, 4, 62], [8, 4, 64], [12, 4, 65], [16, 4, 67], [20, 4, 69], [24, 5, 67],
    ]);
    expect(report.changes).toBe(3);
  });

  it('does not touch a clean melody', () => {
    const clean = [note(0, 4, 60), note(4, 2, 64), note(6, 2, 67), note(8, 8, 72)];
    const { notes, report } = fixNotes(clean, 1, 0);
    expect(report.changes).toBe(0);
    expect(notes).toEqual(clean);
  });
});

describe('fill a short take to the song length', () => {
  it('repeats a 6-bar hum into an 8-bar song, from the top', () => {
    const notes = Array.from({ length: 6 }, (_, b) => ({ start: b * 16, length: 8, midi: 60 + b, velocity: 0.8 }));
    const r = fixNotes(notes, 8, 0);
    expect(r.report.filled).toBe(2);
    expect(r.notes.filter((n) => n.start >= 96).map((n) => [n.start, n.midi])).toEqual([[96, 60], [112, 61]]);
  });
  it('repeats a 3-bar beat until 8 bars are full, then keeps the pattern', () => {
    const hits = [0, 1, 2].flatMap((b) => [{ step: b * 16, type: 'kick' as const, velocity: 0.9 }, { step: b * 16 + 8, type: 'snare' as const, velocity: 0.9 }]);
    const r = fixDrums(hits, 8, 0);
    expect(r.report.filled).toBe(5);
    for (let b = 0; b < 8; b++) {
      expect(r.hits.some((h) => h.step === b * 16 && h.type === 'kick')).toBe(true);
      expect(r.hits.some((h) => h.step === b * 16 + 8 && h.type === 'snare')).toBe(true);
    }
  });
  it('leaves a full take alone', () => {
    const notes = Array.from({ length: 4 }, (_, b) => ({ start: b * 16, length: 16, midi: 62, velocity: 0.8 }));
    expect(fixNotes(notes, 4, 0).report.filled).toBe(0);
  });
});

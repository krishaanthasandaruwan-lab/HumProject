import { describe, expect, it } from 'vitest';
import { loudnessDips, retune, segmentNotes, tuningOffset, type RawNote } from '../src/dsp/notes';
import type { PitchFrame } from '../src/dsp/pitch';

const note = (pitch: number, start: number, len = 0.4): RawNote => ({ start, end: start + len, pitch, rms: 0.1 });

describe('singer tuning', () => {
  it('hears a singer who is 40 cents flat on every note', () => {
    const notes = [60, 62, 64, 65, 67].map((m, i) => note(m - 0.4 + (i % 2 ? 0.06 : -0.05), i * 0.5));
    expect(tuningOffset(notes)).toBeCloseTo(-0.4, 1);
    expect(retune(notes).map((n) => Math.round(n.pitch))).toEqual([60, 62, 64, 65, 67]);
  });
  it('leaves an in-tune singer alone, and a singer all over the place too', () => {
    const tuned = [60, 64, 67].map((m, i) => note(m + 0.03, i));
    expect(retune(tuned)).toBe(tuned);
    const messy = [60.1, 62.35, 63.6, 65.85].map((m, i) => note(m, i));
    expect(Math.abs(tuningOffset(messy))).toBeLessThan(0.06);
  });
});

describe('the same note hummed again', () => {
  it('splits "hm-hm" at the dip in loudness', () => {
    const hop = 256 / 48000;
    const frames: PitchFrame[] = Array.from({ length: 120 }, (_, i) => {
      const dip = i >= 58 && i <= 62;
      return { time: i * hop, midi: 60, clarity: 0.95, rms: dip ? 0.02 + Math.abs(i - 60) * 0.01 : 0.1 };
    });
    expect(loudnessDips(frames, hop).has(60)).toBe(true);
    const notes = segmentNotes(frames, hop);
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => Math.round(n.pitch))).toEqual([60, 60]);
  });
  it('does not split a steady note with vibrato in its loudness', () => {
    const hop = 256 / 48000;
    const frames: PitchFrame[] = Array.from({ length: 160 }, (_, i) => ({ time: i * hop, midi: 62, clarity: 0.95, rms: 0.1 * (1 + 0.15 * Math.sin(i / 3)) }));
    expect(segmentNotes(frames, hop)).toHaveLength(1);
  });
});

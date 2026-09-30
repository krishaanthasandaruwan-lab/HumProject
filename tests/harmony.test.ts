import { describe, expect, it } from 'vitest';
import { bassFromChords, chooseChords, chordName, diatonicTriads, voiceChords } from '../src/dsp/harmony';
import type { Note } from '../src/model/project';

const C = { tonic: 0, mode: 'major' as const };
const Am = { tonic: 9, mode: 'minor' as const };
const n = (start: number, length: number, midi: number): Note => ({ start, length, midi, velocity: 1 });

describe('auto-chords', () => {
  it('builds the diatonic triads', () => {
    expect(diatonicTriads(C).map(chordName)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    expect(diatonicTriads(Am).map(chordName)).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
  });

  it('follows the melody when it clearly outlines chords', () => {
    // bar 1: C E G, bar 2: B D G, bar 3: A C E, bar 4: F A C
    const melody = [
      n(0, 4, 60), n(4, 4, 64), n(8, 8, 67),
      n(16, 4, 71), n(20, 4, 74), n(24, 8, 67),
      n(32, 4, 69), n(36, 4, 72), n(40, 8, 76),
      n(48, 4, 65), n(52, 4, 69), n(56, 8, 72),
    ];
    expect(chooseChords(melody, C, 4).map(chordName)).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('falls back to a classic progression where there is no melody', () => {
    expect(chooseChords([], C, 4).map(chordName)).toEqual(['C', 'G', 'Am', 'F']);
    expect(chooseChords([], Am, 4).map(chordName)).toEqual(['Am', 'F', 'C', 'G']);
  });

  it('voices chords smoothly in a mid register', () => {
    const notes = voiceChords(chooseChords([], C, 4), 'pad');
    expect(notes).toHaveLength(12);
    notes.forEach((x) => { expect(x.midi).toBeGreaterThanOrEqual(53); expect(x.midi).toBeLessThanOrEqual(79); });
    const bar = (b: number): number[] => notes.filter((x) => x.start === b * 16).map((x) => x.midi);
    for (let b = 1; b < 4; b++) {
      const move = bar(b).reduce((s, m, i) => s + Math.abs(m - bar(b - 1)[i]), 0);
      expect(move).toBeLessThanOrEqual(6);
    }
  });

  it('writes a root bass that follows the kicks', () => {
    const chords = chooseChords([], Am, 2);
    const bass = bassFromChords(chords, [0, 7, 10, 16, 26]);
    expect(bass.map((b) => [b.start, b.midi])).toEqual([[0, 33], [7, 33], [10, 33], [16, 41], [26, 41]]);
  });
});

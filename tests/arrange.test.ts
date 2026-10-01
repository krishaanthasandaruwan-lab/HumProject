import { describe, expect, it } from 'vitest';
import { scaleOf } from '../src/dsp/key';
import { arrange, chordPart, drumPattern, placeMelody } from '../src/model/autoArrange';
import { getStyle, pickStyles, STYLES } from '../src/model/styles';
import type { Key, Note } from '../src/model/project';
import { getInstrument, getKit } from '../src/synth/kits';
import { chooseChords } from '../src/dsp/harmony';

const C: Key = { tonic: 0, mode: 'major' };
const A_MINOR: Key = { tonic: 9, mode: 'minor' };
const tune = (bars: number): Note[] =>
  Array.from({ length: bars }, (_, b) => [[0, 4, 48], [4, 4, 50], [8, 2, 52], [10, 6, 55]].map(([s, l, m]) => ({ start: b * 16 + s, length: l, midi: m, velocity: 0.8, raw: m }))).flat();

describe('style picking', () => {
  it('suggests styles that fit the tempo and the mood', () => {
    expect(pickStyles(80, A_MINOR).map((s) => s.id)).toEqual(expect.arrayContaining(['trap', 'chill', 'cinema']));
    expect(pickStyles(125, C).map((s) => s.id)).toEqual(expect.arrayContaining(['pop', 'dance', 'band']));
    expect(pickStyles(100, C)).toHaveLength(3);
  });

  it('only uses sounds that exist', () => {
    for (const s of STYLES) {
      expect(getKit(s.kit).id).toBe(s.kit);
      for (const id of [s.bass.preset, s.chords.preset, s.lead.preset]) expect(getInstrument(id).id).toBe(id);
      for (const bar of [s.groove, { ...s.groove, ...s.fill }]) for (const line of Object.values(bar)) expect(line).toMatch(/^[xo.-]{16}$/);
    }
  });
});

describe('arrange', () => {
  for (const style of STYLES) {
    it(`${style.name}: a full, in-key loop around the melody`, () => {
      const voice = { audio: new Float32Array(48000), rate: 48000, anchors: [0, 0, 1, 64] };
      const p = arrange({ notes: tune(4), bpm: 96, bars: 4, key: C, voice }, style, 'Test');
      expect(p.tracks.map((t) => t.kind)).toEqual(['drums', 'bass', 'lead', 'chords']);
      expect(p.swing).toBe(style.swing);
      const scale = new Set(scaleOf(C));
      for (const t of p.tracks) {
        for (const h of t.hits ?? []) expect(h.step).toBeLessThan(64);
        for (const n of t.notes ?? []) {
          expect(n.start + n.length).toBeLessThanOrEqual(64);
          expect(scale.has(((n.midi % 12) + 12) % 12)).toBe(true);
        }
      }
      expect(p.tracks[0].hits!.length).toBeGreaterThan(8);
      expect(p.tracks[3].labels).toHaveLength(4);
      const lead = p.tracks[2];
      const mids = lead.notes!.map((n) => n.midi).sort((a, b) => a - b);
      expect(Math.abs(mids[mids.length >> 1] - style.lead.center)).toBeLessThanOrEqual(6);
      expect(lead.voice).toEqual({ on: true, tune: true, level: 0.8 });
      expect(lead.anchors).toEqual(voice.anchors);
    });
  }

  it('plays the drum fill only on the last bar of longer loops', () => {
    const pop = getStyle('pop');
    const four = drumPattern(pop, 4).filter((h) => h.type === 'snare').map((h) => h.step);
    expect(four).toEqual([4, 12, 20, 28, 36, 44, 52, 60, 61, 62, 63].filter((s) => s !== 61));
    expect(drumPattern(pop, 2).filter((h) => h.type === 'snare').map((h) => h.step)).toEqual([4, 12, 20, 28]);
  });

  it('adds diatonic sevenths for the lo-fi sound', () => {
    const chords = chooseChords(tune(2), C, 2);
    const notes = chordPart(chords, C, 'sustain', true);
    expect(notes.filter((n) => n.start === 0)).toHaveLength(4);
    const scale = new Set(scaleOf(C));
    for (const n of notes) expect(scale.has(n.midi % 12)).toBe(true);
  });

  it('moves a low hum up to the lead register by whole octaves', () => {
    const moved = placeMelody(tune(1), 72);
    expect(moved.map((n) => n.midi)).toEqual([72, 74, 76, 79]);
    expect(moved[0].raw).toBe(72);
  });
});

import { describe, expect, it } from 'vitest';
import { scaleOf } from '../src/dsp/key';
import { arrange, chordPart, drumPattern, placeMelody } from '../src/model/autoArrange';
import { getStyle, STYLES } from '../src/model/styles';
import { clampBpm, moreVariants, pickVariants } from '../src/model/variety';
import type { Key, Note } from '../src/model/project';
import { getInstrument, getKit } from '../src/synth/kits';
import { chooseChords } from '../src/dsp/harmony';

const C: Key = { tonic: 0, mode: 'major' };
const A_MINOR: Key = { tonic: 9, mode: 'minor' };
const tune = (bars: number): Note[] =>
  Array.from({ length: bars }, (_, b) => [[0, 4, 48], [4, 4, 50], [8, 2, 52], [10, 6, 55]].map(([s, l, m]) => ({ start: b * 16 + s, length: l, midi: m, velocity: 0.8, raw: m }))).flat();

describe('three different songs', () => {
  it('offers as hummed, slower and faster, in three different styles', () => {
    for (const [bpm, key] of [[80, A_MINOR], [100, C], [125, C], [62, A_MINOR], [158, C]] as const) {
      const v = pickVariants(bpm, key);
      expect(v.map((x) => x.feel)).toEqual(['hummed', 'slower', 'faster']);
      expect(new Set(v.map((x) => x.style.id)).size).toBe(3);
      expect(v[1].bpm).toBeLessThan(v[0].bpm);
      expect(v[2].bpm).toBeGreaterThan(v[0].bpm);
      for (const x of v) expect(x.bpm).toBe(clampBpm(x.bpm));
    }
  });

  it('leans slow songs calm and fast songs lively, and fits the mood', () => {
    const v = pickVariants(90, A_MINOR);
    expect(['chill', 'cinema', 'band']).toContain(v[1].style.id);
    expect(['dance', 'pop', 'trap']).toContain(v[2].style.id);
  });

  it('puts the music you like first', () => {
    expect(pickVariants(100, C, ['cinema']).map((x) => x.style.id)).toContain('cinema');
    expect(pickVariants(100, C, ['trap'])[0].style.id).toBe('trap');
  });

  it('"More" brings the styles not shown yet', () => {
    const shown = pickVariants(100, C);
    const more = moreVariants(100, C, [], shown);
    expect(more).toHaveLength(3);
    const before = new Set(shown.map((x) => x.style.id));
    for (const m of more) expect(before.has(m.style.id)).toBe(false);
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
      const silent = Object.values(style.groove).every((line) => !/[xo-]/.test(line)); // Ambient: no drums
      if (!silent) expect(p.tracks[0].hits!.length).toBeGreaterThan(8);
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

describe('up to 100 songs from one hum', () => {
  it('keeps offering new ones, never the same twice, other styles first', () => {
    const shown = pickVariants(96, A_MINOR, ['jazz']);
    const firstMore = moreVariants(96, A_MINOR, ['jazz'], shown);
    expect(new Set(firstMore.map((v) => v.style.id)).size).toBe(3);
    while (shown.length < 100) {
      const next = moreVariants(96, A_MINOR, ['jazz'], shown);
      if (!next.length) break;
      shown.push(...next);
    }
    expect(shown.length).toBe(100);
    const keys = shown.map((v) => `${v.style.id}:${v.bpm}:${v.lead ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(shown.map((v) => v.style.id)).size).toBe(STYLES.length);
    expect(moreVariants(96, A_MINOR, [], shown)).toHaveLength(0);
  });
  it('every style arranges into playable parts', () => {
    for (const s of STYLES) {
      const p = arrange({ notes: tune(4), bpm: 100, bars: 4, key: A_MINOR }, s, s.name);
      expect(p.tracks.find((t) => t.kind === 'chords')?.notes?.length, s.id).toBeGreaterThan(0);
      expect(p.tracks.find((t) => t.kind === 'bass')?.notes?.length, s.id).toBeGreaterThan(0);
      for (const id of [s.lead.preset, ...(s.alts ?? [])]) expect(getInstrument(id).id, `${s.id} ${id}`).toBe(id);
    }
  });
});

import { expect, it } from 'vitest';
import { cloneProject, loopDuration, newProject, newTrack } from '../src/model/project';
import { appendBarSet, barSetSize, extendSong, maxSongBars, removeBarSet } from '../src/model/songLength';
import { arrange } from '../src/model/autoArrange';
import { pickVariants, moreVariants } from '../src/model/variety';
import { getStyle } from '../src/model/styles';

it.each([60, 90, 120, 160])('extends to at most five minutes at %s BPM', (bpm) => {
  const p = newProject('Song', bpm, 4);
  const lead = newTrack('lead');
  lead.notes = [{ start: 48, length: 20, midi: 57, velocity: 0.8, raw: 57.2, offset: 0.12 }];
  lead.rawVoice = new Float32Array([0.1, -0.2]); lead.rawRate = 48000;
  lead.anchors = [0, 0, 1, 64]; lead.voice = { on: true, tune: false, level: 0.8, original: true };
  p.tracks.push(lead);
  const before = cloneProject(p);
  extendSong(p, maxSongBars(bpm), true);
  expect(loopDuration(p)).toBeLessThanOrEqual(300);
  expect(loopDuration(p)).toBeGreaterThan(300 - 240 / bpm - 0.001);
  expect(lead.notes[0]).toEqual(before.tracks[0].notes![0]);
  expect(lead.rawVoice).toEqual(before.tracks[0].rawVoice);
  expect(lead.anchors).toEqual(before.tracks[0].anchors);
  expect(lead.voice).toEqual(before.tracks[0].voice);
  expect(lead.notes.slice(1).every((n) => n.start + n.length <= p.bars * 16)).toBe(true);
});
it('empty extensions preserve every note, hit and hidden bar without duplicates', () => {
  const p = newProject('Song', 120, 4);
  const drums = newTrack('drums'); drums.hits = [{ step: 0, type: 'kick', velocity: 1 }, { step: 64, type: 'kick', velocity: 0.7 }]; p.tracks = [drums];
  const before = drums.hits.slice();
  extendSong(p, 8, false); expect(drums.hits).toEqual(before);
  p.bars = 4; extendSong(p, 8, true);
  expect(drums.hits.filter((h) => h.step === 64)).toEqual([before[1]]);
});
it('rejects invalid or overlong requests without changing the song', () => {
  for (const bars of [3, 4.5, NaN, 151]) {
    const p = newProject('Song', 120, 4), before = cloneProject(p);
    expect(() => extendSong(p, bars, true)).toThrow(); expect(p).toEqual(before);
  }
});
it.each([2, 4, 8] as const)('appends and removes whole %s-bar sets while preserving the original', (size) => {
  const p = newProject('Song', 120, size);
  const drums = newTrack('drums');
  drums.hits = Array.from({ length: size }, (_, b) => ({ step: b * 16, type: 'kick' as const, velocity: (b + 1) / size }));
  const lead = newTrack('lead');
  lead.notes = Array.from({ length: size }, (_, b) => ({ start: b * 16, length: 4, midi: 60 + b, velocity: 0.8 }));
  lead.labels = Array.from({ length: size }, (_, b) => `Chord ${b}`);
  lead.rawVoice = new Float32Array([0.1, -0.2]); lead.rawRate = 48000;
  lead.anchors = [0, 0, 1, size * 16]; lead.voice = { on: true, tune: false, level: 0.8, original: true };
  p.tracks = [drums, lead];
  const saved = cloneProject(p, false);
  appendBarSet(p); appendBarSet(p);
  expect(p.bars).toBe(size * 3);
  expect(barSetSize(p)).toBe(size);
  expect(drums.hits.map((h) => h.velocity)).toEqual([...saved.tracks[0].hits!, ...saved.tracks[0].hits!, ...saved.tracks[0].hits!].map((h) => h.velocity));
  expect(lead.notes.map((n) => n.midi)).toEqual([...saved.tracks[1].notes!, ...saved.tracks[1].notes!, ...saved.tracks[1].notes!].map((n) => n.midi));
  expect(lead.labels.slice(size, size * 2)).toEqual(saved.tracks[1].labels);
  removeBarSet(p); expect(p.bars).toBe(size * 2);
  removeBarSet(p); expect(p.bars).toBe(size);
  expect(drums.hits).toEqual(saved.tracks[0].hits);
  expect(lead.notes).toEqual(saved.tracks[1].notes);
  expect(lead.rawVoice).toBe(saved.tracks[1].rawVoice);
  expect(lead.anchors).toEqual(saved.tracks[1].anchors);
  expect(lead.voice).toEqual(saved.tracks[1].voice);
  expect(() => removeBarSet(p)).toThrow();
});
it('never appends a partial set at the five-minute limit', () => {
  const p = newProject('Song', 120, 144); p.barSet = 8;
  const saved = cloneProject(p);
  expect(() => appendBarSet(p)).toThrow(); expect(p).toEqual(saved);
  p.bars = 136; appendBarSet(p);
  expect(p.bars).toBe(144); expect(loopDuration(p)).toBeLessThanOrEqual(300);
});
it('removes the last partial legacy set and its notes, without damaging hidden recordings', () => {
  const p = newProject('Song', 120, 20);
  const t = newTrack('lead');
  t.notes = [{ start: 252, length: 20, midi: 60, velocity: 1 }, { start: 256, length: 8, midi: 62, velocity: 1 }, { start: 400, length: 8, midi: 64, velocity: 1 }];
  p.tracks = [t]; removeBarSet(p);
  expect(p.bars).toBe(16);
  expect(t.notes).toEqual([{ start: 252, length: 4, midi: 60, velocity: 1 }, { start: 400, length: 8, midi: 64, velocity: 1 }]);
  appendBarSet(p);
  expect(p.bars).toBe(24);
  expect(t.notes.some((n) => n.start === 256 && n.midi === 62)).toBe(false);
});
it('the first arrangement keeps the original voice and sung register', () => {
  const take = { notes: [{ start: 0, length: 4, midi: 60, raw: 57.3, velocity: 0.8 }], bpm: 100, bars: 4, key: { tonic: 0, mode: 'major' as const }, voice: { audio: new Float32Array([0.1, -0.2]), rate: 48000, anchors: [0, 0, 1, 4] } };
  const v = pickVariants(take.bpm, take.key)[0];
  const p = arrange(take, v.style, 'Original', true);
  expect(p.bpm).toBe(take.bpm);
  expect(p.tracks[2].voice).toMatchObject({ tune: false, original: true });
  expect(p.tracks[2].rawVoice).toBe(take.voice.audio);
  expect(p.tracks[2].notes![0].midi).toBe(57);
  expect(take.notes[0].midi).toBe(60);
  expect(arrange(take, getStyle('pop'), 'Other').tracks[2].voice?.tune).toBe(true);
});
it('More continues to offer original-tempo versions without duplicates', () => {
  const shown = pickVariants(100, undefined);
  for (let n = 0; n < 12; n++) shown.push(...moreVariants(100, undefined, [], shown));
  expect(shown.slice(3).some((v) => v.feel === 'hummed' && v.bpm === 100)).toBe(true);
  const keys = shown.map((v) => `${v.style.id}:${v.bpm}:${v.lead ?? ''}`);
  expect(new Set(keys).size).toBe(keys.length);
});

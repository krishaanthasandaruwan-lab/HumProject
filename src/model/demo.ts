// A built-in demo song so every instrument can be heard before recording anything.
import { newProject, newTrack, type Note, type Project } from './project';

function notes(list: [number, number, number][], velocity = 0.85): Note[] {
  return list.map(([start, length, midi]) => ({ start, length, midi, velocity }));
}

export function demoProject(): Project {
  const p = newProject('Demo — Night Bus', 90, 4);
  p.key = { tonic: 9, mode: 'minor' };
  const drums = newTrack('drums', 'boombap');
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    for (const s of [0, 7, 10]) drums.hits!.push({ step: o + s, type: 'kick', velocity: s === 0 ? 1 : 0.8 });
    for (const s of [4, 12]) drums.hits!.push({ step: o + s, type: 'snare', velocity: 0.95 });
    for (let s = 0; s < 16; s += 2) drums.hits!.push({ step: o + s, type: 'hat', velocity: s % 4 === 0 ? 0.7 : 0.5 });
  }
  const roots = [33, 29, 36, 31]; // A F C G
  const bass = newTrack('bass');
  bass.notes = roots.flatMap((r, b) => notes([[b * 16, 6, r], [b * 16 + 7, 3, r], [b * 16 + 10, 5, r]]));
  const chords = newTrack('chords', 'pad');
  const voicings = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
  chords.notes = voicings.flatMap((v, b) => v.map((m) => ({ start: b * 16, length: 16, midi: m, velocity: 0.7 })));
  chords.generated = true;
  const lead = newTrack('lead');
  lead.notes = notes([
    [0, 4, 76], [4, 2, 74], [6, 2, 72], [8, 6, 69],
    [16, 2, 69], [18, 2, 72], [20, 4, 74], [24, 2, 72], [26, 4, 69],
    [32, 4, 76], [36, 4, 79], [40, 2, 76], [42, 4, 74],
    [48, 4, 72], [52, 2, 74], [54, 2, 71], [56, 6, 74],
  ]);
  p.tracks = [drums, bass, lead, chords];
  return p;
}

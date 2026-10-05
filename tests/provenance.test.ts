import { describe, expect, it } from 'vitest';
import { addChords } from '../src/model/arrange';
import { addTrack, cloneProject, inheritTrack, MAX_TRACKS, newProject, newTrack } from '../src/model/project';
import { lockedIn } from '../src/pro/exports';
import { INSTRUMENTS } from '../src/synth/kits';
describe('paid feature provenance', () => {
  it('keeps a picked Pro sound across re-recording and inherited sounds', () => {
    const source = { ...newTrack('lead', INSTRUMENTS.find((i) => i.pro)!.id), picked: true, volume: 0.4, muted: true };
    const replacement = newTrack('lead', source.preset);
    inheritTrack(source, replacement);
    const song = newProject(); song.tracks = [replacement];
    expect(replacement).toMatchObject({ picked: true, volume: 0.4, muted: true });
    expect(lockedIn(song)).not.toEqual([]);
    const free = newTrack('lead', 'sine'); inheritTrack(source, free);
    expect(free.picked).toBeUndefined();
  });
  it('keeps picked chord and bass sounds after regenerating chords', () => {
    const p = newProject();
    p.tracks = [
      { ...newTrack('lead', 'sine'), notes: [{ start: 0, length: 8, midi: 60, velocity: 1 }] },
      { ...newTrack('chords', 'cello'), picked: true },
      { ...newTrack('bass', 'cello'), picked: true, generated: true },
    ];
    addChords(p);
    expect(p.tracks.find((t) => t.kind === 'chords')?.picked).toBe(true);
    expect(p.tracks.find((t) => t.kind === 'bass')?.picked).toBe(true);
  });
  it('detects an enabled voice effect without trusting a missing marker', () => {
    const p = newProject(); p.tracks = [{ ...newTrack('lead'), voice: { on: true, tune: true, level: 1, fx: true } }];
    expect(lockedIn(p)).toContain('the voice effect');
  });
  it('duplicates notes and audio without requiring structuredClone on iOS 15', () => {
    const p = newProject(); p.tracks = [{ ...newTrack('lead'), rawVoice: new Float32Array([0.1, 0.2]), notes: [{ start: 0, length: 4, midi: 60, velocity: 1 }] }];
    const copy = cloneProject(p);
    copy.tracks[0].notes![0].midi = 72; copy.tracks[0].rawVoice![0] = 1;
    expect(p.tracks[0].notes![0].midi).toBe(60);
    expect(p.tracks[0].rawVoice![0]).toBeCloseTo(0.1);
  });
  it('rejects extra parts before mutating a full project', () => {
    const p = newProject(); p.tracks = Array.from({ length: MAX_TRACKS }, () => newTrack('lead'));
    expect(() => addTrack(p, newTrack('drums'))).toThrow('16 parts');
    expect(() => addChords(p)).toThrow('Delete a part');
    expect(p.tracks).toHaveLength(MAX_TRACKS);
    expect(p.key).toBeUndefined();
  });
});

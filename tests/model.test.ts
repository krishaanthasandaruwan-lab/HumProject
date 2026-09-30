import { describe, expect, it } from 'vitest';
import { loopDuration, newProject, newTrack, putTrack, stepDur, swingOffset, totalSteps, trackGain } from '../src/model/project';
import { demoProject } from '../src/model/demo';

describe('project model', () => {
  it('computes loop timing from BPM and bars', () => {
    const p = newProject('x', 120, 2);
    expect(totalSteps(p)).toBe(32);
    expect(stepDur(120)).toBeCloseTo(0.125);
    expect(loopDuration(p)).toBeCloseTo(4);
  });

  it('keeps one track per kind and returns the replaced one', () => {
    const p = newProject();
    const a = newTrack('drums');
    const b = newTrack('drums');
    expect(putTrack(p, a)).toBeUndefined();
    putTrack(p, newTrack('bass'));
    expect(putTrack(p, b)).toBe(a);
    expect(p.tracks.map((t) => t.kind)).toEqual(['drums', 'bass']);
  });

  it('applies mute and solo', () => {
    const p = demoProject();
    const [drums, bass] = p.tracks;
    expect(trackGain(p, drums)).toBeGreaterThan(0);
    bass.solo = true;
    expect(trackGain(p, drums)).toBe(0);
    expect(trackGain(p, bass)).toBe(bass.volume);
    bass.muted = true;
    expect(trackGain(p, bass)).toBe(0);
  });

  it('swings only the odd 16ths', () => {
    expect(swingOffset(0, 0.2)).toBe(0);
    expect(swingOffset(1, 0.2)).toBe(0.2);
    expect(swingOffset(6, 0.2)).toBe(0);
  });
});

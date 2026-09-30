import { describe, expect, it } from 'vitest';
import { analyzeMelody } from '../src/dsp/analyze';
import { detectKey, keyName, snapToScale } from '../src/dsp/key';
import { notesToGrid, segmentNotes, transposeToRange } from '../src/dsp/notes';
import { fixOctaves, medianSmooth, trackPitch } from '../src/dsp/pitch';
import { refreshKey } from '../src/model/music';
import { newProject, newTrack } from '../src/model/project';
import { SR, addNoise, hum, mixAt, silence } from './signals';

const HOP = 256 / SR;

function sine(hz: number, seconds: number, amp = 0.4): Float32Array {
  const y = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < y.length; i++) y[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return y;
}

function medianMidi(x: Float32Array): number {
  const v = trackPitch(x, SR).filter((f) => f.midi !== null).map((f) => f.midi as number).sort((a, b) => a - b);
  return v[v.length >> 1];
}

describe('pitch tracking', () => {
  it('tracks a 220 Hz sine as MIDI 57', () => {
    const m = medianMidi(sine(220, 0.5));
    expect(Math.round(m)).toBe(57);
    expect(Math.abs(m - 57)).toBeLessThan(0.1);
  });

  it('tracks a hummed note with harmonics', () => {
    expect(Math.round(medianMidi(hum(60, 0.5)))).toBe(60);
    expect(Math.round(medianMidi(hum(45, 0.5)))).toBe(45);
  });

  it('reports silence and noise as unvoiced', () => {
    expect(trackPitch(addNoise(silence(0.5), 0.003), SR).every((f) => f.midi === null)).toBe(true);
  });

  it('folds an isolated octave jump back', () => {
    const frames = [60, 60, 72, 60, 60, 60].map((m, i) => ({ time: i * HOP, midi: m, clarity: 1, rms: 0.1 }));
    expect(fixOctaves(frames).map((f) => f.midi)).toEqual([60, 60, 60, 60, 60, 60]);
  });
});

describe('note segmentation', () => {
  it('splits on silence and drops blips', () => {
    const x = addNoise(silence(1.4), 0.001);
    mixAt(x, hum(60, 0.3), 0.1);
    mixAt(x, hum(62, 0.3), 0.5);
    mixAt(x, hum(64, 0.05), 0.9); // too short: dropped
    mixAt(x, hum(67, 0.3), 1.0);
    const notes = segmentNotes(medianSmooth(trackPitch(x, SR)), HOP);
    expect(notes.map((n) => Math.round(n.pitch))).toEqual([60, 62, 67]);
    expect(Math.abs(notes[1].start - 0.5)).toBeLessThan(0.04);
  });

  it('splits a legato pitch change', () => {
    const x = silence(0.8);
    mixAt(x, hum(60, 0.3), 0.1);
    mixAt(x, hum(64, 0.3), 0.4);
    const notes = segmentNotes(medianSmooth(trackPitch(x, SR)), HOP);
    expect(notes.map((n) => Math.round(n.pitch))).toEqual([60, 64]);
  });

  it('quantizes notes to the grid and transposes bass into 28–52', () => {
    const sd = 60 / 120 / 4;
    const grid = notesToGrid([{ start: 0.01, end: 4 * sd, pitch: 55.2, rms: 0.1 }, { start: 4.1 * sd, end: 6 * sd, pitch: 57, rms: 0.05 }], 120, 32);
    expect(grid.map((n) => [n.start, n.length, n.midi])).toEqual([[0, 4, 55], [4, 2, 57]]);
    expect(transposeToRange(grid).map((n) => n.midi)).toEqual([43, 45]);
  });
});

describe('key detection and scale snap', () => {
  it('detects a C major scale as C major', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72].map((midi) => ({ midi, length: 4 }));
    expect(keyName(detectKey(scale)!.key)).toBe('C major');
  });

  it('detects an A minor tune as A minor', () => {
    const tune = [[69, 8], [72, 4], [76, 4], [74, 4], [72, 2], [71, 2], [69, 8], [64, 4], [69, 8]].map(([midi, length]) => ({ midi, length }));
    expect(keyName(detectKey(tune)!.key)).toBe('A minor');
  });

  it('snaps a 50-cent-sharp note into the scale', () => {
    const cMajor = { tonic: 0, mode: 'major' as const };
    expect(snapToScale(60.5, cMajor)).toBe(60); // C +50c -> C (C# is not in C major)
    expect(snapToScale(66.5, cMajor)).toBe(67); // F# +50c -> G
    expect(snapToScale(61.4, cMajor)).toBe(62);
  });

  it('snaps a hummed sharp note end to end, and can be switched off', () => {
    const x = silence(1.2);
    mixAt(x, hum(60.5, 0.4), 0.2); // C4 + 50 cents
    const res = analyzeMelody({ audio: x, sampleRate: SR, preroll: 0, bpm: 120, bars: 2, swing: 0, mode: 'lead' });
    expect(res.notes).toHaveLength(1);
    const p = newProject();
    p.key = { tonic: 0, mode: 'major' };
    const lead = newTrack('lead');
    // add scale context so the detected key stays C major
    lead.notes = [...res.notes, ...[62, 64, 65, 67, 72].map((m, i) => ({ start: 8 + i * 2, length: 2, midi: m, velocity: 1, raw: m }))];
    p.tracks.push(lead);
    refreshKey(p, true);
    expect(keyName(p.key!)).toBe('C major');
    expect(lead.notes[0].midi).toBe(60);
    refreshKey(p, false);
    expect(lead.notes[0].midi).toBe(61); // plain rounding of 60.5 without snap
  });
});

describe('hum -> melody pipeline', () => {
  it('turns a hummed tune into notes on the right steps', () => {
    const bpm = 100;
    const sd = 60 / bpm / 4;
    const preroll = 0.15;
    const tune = [[0, 4, 60], [4, 2, 62], [6, 2, 64], [8, 8, 67], [16, 4, 64], [20, 4, 62], [24, 8, 60]];
    const x = addNoise(silence(preroll + 32 * sd + 0.3), 0.001);
    for (const [s, len, m] of tune) mixAt(x, hum(m, len * sd - 0.04), preroll + s * sd);
    const res = analyzeMelody({ audio: x, sampleRate: SR, preroll, bpm, bars: 2, swing: 0, mode: 'lead' });
    expect(res.notes.map((n) => [n.start, n.midi])).toEqual(tune.map(([s, , m]) => [s, m]));
    const bass = analyzeMelody({ audio: x, sampleRate: SR, preroll, bpm, bars: 2, swing: 0, mode: 'bass' });
    bass.notes.forEach((n) => expect(n.midi).toBeGreaterThanOrEqual(28));
    bass.notes.forEach((n) => expect(n.midi).toBeLessThanOrEqual(52));
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeFree } from '../src/dsp/free';
import { hatTs, hum, kickB, mixAt, SR, silence, snareK } from './signals';

const TUNE: [number, number, number][] = [[0, 4, 60], [4, 4, 62], [8, 2, 64], [10, 6, 67]]; // step, length, midi per bar
const MELODY = [0, 1, 2, 3].flatMap((b) => TUNE.map(([s, l, m]) => [b * 16 + s, l, b === 3 && s === 10 ? 72 : m] as [number, number, number]));

function hummed(bpm: number, start: number): Float32Array {
  const sd = 60 / bpm / 4;
  const x = silence(start + 4 * 16 * sd + 1.5);
  for (const [s, l, m] of MELODY) mixAt(x, hum(m, l * sd - 0.05), start + s * sd);
  return x;
}

const BEAT: [number, 'k' | 's' | 'h'][] = [[0, 'k'], [2, 'h'], [4, 's'], [6, 'h'], [8, 'k'], [10, 'h'], [12, 's'], [14, 'h']];
function beatboxed(bpm: number, start: number, bars = 2): Float32Array {
  const sd = 60 / bpm / 4;
  const x = silence(start + bars * 16 * sd + 1);
  for (let b = 0; b < bars; b++) {
    for (const [s, d] of BEAT) mixAt(x, d === 'k' ? kickB() : d === 's' ? snareK() : hatTs(), start + (b * 16 + s) * sd);
  }
  return x;
}

describe('free-tempo hum (no metronome)', () => {
  it('finds the tempo, the bars, the key and every note', () => {
    const r = analyzeFree({ audio: hummed(100, 0.6), sampleRate: SR, kind: 'lead' });
    expect(Math.abs(r.bpm - 100)).toBeLessThan(3);
    expect(r.bars).toBe(4);
    expect(r.key).toEqual({ tonic: 0, mode: 'major' });
    expect(r.notes.map((n) => [n.start, n.length, n.midi])).toEqual(MELODY);
    expect(Math.abs(r.loopStart - 0.6)).toBeLessThan(0.05);
  });

  it('anchors each sung note to its place on the grid', () => {
    const r = analyzeFree({ audio: hummed(100, 0.6), sampleRate: SR, kind: 'lead' });
    expect(r.anchors.length).toBe(2 * (r.notes.length + 1));
    r.notes.forEach((n, k) => {
      expect(r.anchors[2 * k + 1]).toBe(n.start);
      expect(Math.abs(r.anchors[2 * k] - n.start * 0.15)).toBeLessThan(0.04); // sung at 100 BPM, 0.15 s per 16th
    });
  });
});

describe('import with beat matching', () => {
  it('places a beatbox file at its own tempo', () => {
    const r = analyzeFree({ audio: beatboxed(92, 0.35), sampleRate: SR, kind: 'drums' });
    expect(Math.abs(r.bpm - 92)).toBeLessThan(2.5);
    expect(r.bars).toBe(2);
    const want = [0, 1].flatMap((b) => BEAT.map(([s, d]) => `${b * 16 + s}${d}`));
    expect(r.hits.map((h) => `${h.step}${h.type[0]}`)).toEqual(want);
  });

  it('fits a file into the current song: steps stay put, tempo and length are the song’s', () => {
    const r = analyzeFree({ audio: beatboxed(92, 0.35), sampleRate: SR, kind: 'drums', bpm: 120, bars: 4 });
    expect(r.bpm).toBe(120);
    expect(r.bars).toBe(4);
    expect(r.hits.filter((h) => h.type === 'kick').map((h) => h.step)).toEqual([0, 8, 16, 24]);
  });
});

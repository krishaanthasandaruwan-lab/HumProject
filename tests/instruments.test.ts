import { describe, expect, it } from 'vitest';
import { trackPitch } from '../src/dsp/pitch';
import { RENDERED } from '../src/synth/rendered';
import { mtof } from '../src/synth/fx';
import { INSTRUMENTS, KITS, instrumentsFor } from '../src/synth/kits';
import { OSC_VOICES } from '../src/synth/voices';

const SR = 48000;
const rms = (x: Float32Array, a: number, b: number): number => {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, b - a));
};

describe('rendered instruments', () => {
  const cases: [string, number[]][] = [
    ['piano', [48, 60, 72, 84]],
    ['pluck', [45, 57, 64, 76]],
    ['fingerbass', [33, 40, 45]],
    ['bell', [67, 72, 79]],
    ['marimba', [55, 64, 72]],
  ];
  for (const [id, notes] of cases) {
    it(`${id}: in tune, finite, decaying`, () => {
      for (const midi of notes) {
        const y = RENDERED[id].render(SR, mtof(midi));
        expect(y.every(Number.isFinite)).toBe(true);
        const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        expect(peak).toBeCloseTo(0.8, 2);
        const n = y.length;
        expect(rms(y, Math.round(n * 0.8), n)).toBeLessThan(rms(y, 0, Math.round(n * 0.2)) * 0.5);
        const frames = trackPitch(y.subarray(Math.round(0.02 * SR), Math.round(0.35 * SR)), SR, { minHz: 40 });
        const v = frames.filter((f) => f.midi !== null).map((f) => f.midi as number).sort((a, b) => a - b);
        expect(v.length, `${id} ${midi} voiced frames`).toBeGreaterThan(3);
        expect(Math.abs(v[v.length >> 1] - midi), `${id} ${midi}`).toBeLessThan(0.3);
      }
    });
  }
});

describe('instrument catalog', () => {
  it('has a voice for every instrument and sensible choices for every card', () => {
    const builtIn = ['bass', 'lead', 'keys', 'pad'];
    for (const inst of INSTRUMENTS) {
      expect(builtIn.includes(inst.id) || inst.id in OSC_VOICES || inst.id in RENDERED, inst.id).toBe(true);
    }
    expect(instrumentsFor('bass')[0].id).toBe('bass');
    expect(instrumentsFor('chords').map((i) => i.id)).toContain('piano');
    expect(INSTRUMENTS.filter((i) => !i.pro).length).toBeGreaterThanOrEqual(8);
    expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(INSTRUMENTS.length);
    expect(KITS.length).toBe(8);
    expect(KITS.filter((k) => !k.pro).map((k) => k.id)).toEqual(['808', 'boombap']);
  });
});

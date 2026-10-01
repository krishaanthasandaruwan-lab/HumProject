import { describe, expect, it } from 'vitest';
import { analyzeBeatbox, analyzeMelody } from '../src/dsp/analyze';
import { declick, removeTones } from '../src/dsp/declick';
import { detectOnsets } from '../src/dsp/onsets';
import { CLICK_HZ } from '../src/audio/metronome';
import type { DrumType } from '../src/model/project';
import { SR, addNoise, hatTs, hum, kickB, mixAt, rng, silence, snareK } from './signals';

const TONES = [CLICK_HZ.accent, CLICK_HZ.beat];

/** The metronome click as it reaches the mic: 1 ms rise, 60 ms decay (see audio/metronome.ts). */
function leakedClick(accent: boolean, amp: number): Float32Array {
  const y = new Float32Array(Math.round(0.07 * SR));
  const hz = accent ? CLICK_HZ.accent : CLICK_HZ.beat;
  for (let i = 0; i < y.length; i++) {
    const t = i / SR;
    const env = t < 0.001 ? t / 0.001 : Math.exp((Math.log(1e-4) * (t - 0.001)) / 0.059);
    y[i] = amp * env * Math.sin(2 * Math.PI * hz * t);
  }
  return y;
}

const SOUND: Record<DrumType, (seed: number) => Float32Array> = {
  kick: () => kickB(0.8),
  snare: (s) => snareK(2.2, s),
  hat: (s) => hatTs(1.2, s),
};

/** `pattern` (B/K/t per 16th, '.' = rest) over the loop, with the click on every beat. */
function performWithClick(pattern: string, leak: number, bpm = 90, bars = 2) {
  const map: Record<string, DrumType> = { B: 'kick', K: 'snare', t: 'hat' };
  const sd = 60 / bpm / 4;
  const preroll = 0.15;
  const audio = addNoise(silence(preroll + bars * 16 * sd + 0.3), 0.002);
  const r = rng(11);
  const expected: string[] = [];
  for (let s = 0; s < bars * 16; s++) {
    if (s % 4 === 0) mixAt(audio, leakedClick(s % 16 === 0, leak), preroll + s * sd);
    const c = pattern[s % pattern.length];
    if (!map[c]) continue;
    mixAt(audio, SOUND[map[c]](s + 1), preroll + s * sd + (r() * 20) / 1000);
    expected.push(`${s}${map[c]}`);
  }
  const hits = (x: Float32Array) =>
    analyzeBeatbox({ audio: x, sampleRate: SR, preroll, bpm, bars, swing: 0 }).hits.map((h) => `${h.step}${h.type}`);
  return { audio, expected, hits };
}

describe('metronome leak (no headphones)', () => {
  it('reads a click on an empty beat as a hit — that is the bug', () => {
    const { audio, expected, hits } = performWithClick('B.......K.......', 0.1);
    expect(hits(audio).length).toBeGreaterThan(expected.length);
  });

  it('takes the click out, quiet or as loud as the kick', () => {
    for (const leak of [0.05, 0.2, 0.8]) {
      const { audio, expected, hits } = performWithClick('B..B..K...B.K...', leak);
      expect(hits(declick({ audio, sampleRate: SR, tones: TONES }))).toEqual(expected);
    }
  });

  it('keeps hats and snares that land right on a loud click', () => {
    for (const pattern of ['t.t.t.t.', 'K...K...K...K...']) {
      const { audio, expected, hits } = performWithClick(pattern, 0.8);
      expect(hits(declick({ audio, sampleRate: SR, tones: TONES }))).toEqual(expected);
    }
  });

  it('still hears a sound that comes just after a loud click', () => {
    const audio = addNoise(silence(1.5), 0.002);
    mixAt(audio, leakedClick(true, 0.8), 0.5);
    mixAt(audio, kickB(0.8), 0.545);
    const onsets = detectOnsets(declick({ audio, sampleRate: SR, tones: TONES }), SR);
    expect(onsets).toHaveLength(1);
    expect(onsets[0].time).toBeCloseTo(0.545, 2);
  });

  it('leaves a hummed tune alone', () => {
    const bpm = 100;
    const sd = 60 / bpm / 4;
    const preroll = 0.15;
    const tune = [[0, 4, 60], [4, 2, 62], [6, 2, 64], [8, 8, 67], [16, 4, 64], [20, 4, 62], [24, 8, 60]];
    const x = addNoise(silence(preroll + 32 * sd + 0.3), 0.001);
    for (const [s, len, m] of tune) mixAt(x, hum(m, len * sd - 0.04), preroll + s * sd);
    for (let b = 0; b < 8; b++) mixAt(x, leakedClick(b % 4 === 0, 0.3), preroll + b * 4 * sd);
    const res = analyzeMelody({ audio: declick({ audio: x, sampleRate: SR, tones: TONES }), sampleRate: SR, preroll, bpm, bars: 2, swing: 0, mode: 'lead' });
    expect(res.notes.map((n) => [n.start, n.midi])).toEqual(tune.map(([s, , m]) => [s, m]));
  });

  it('does not move anything in time (zero-phase notches)', () => {
    const x = addNoise(silence(1), 0.002);
    mixAt(x, snareK(), 0.4);
    const before = detectOnsets(x, SR)[0].time;
    const after = detectOnsets(removeTones(x, SR, TONES), SR)[0].time;
    expect(Math.abs(after - before)).toBeLessThan(0.001);
  });
});

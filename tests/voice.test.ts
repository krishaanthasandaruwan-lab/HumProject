import { describe, expect, it } from 'vitest';
import { trackPitch } from '../src/dsp/pitch';
import { anchorPairs, processVoice, warp } from '../src/dsp/voice';
import { hum, mixAt, SR, silence } from './signals';

/** Median detected pitch (MIDI) between t0 and t1. */
function pitchBetween(x: Float32Array, t0: number, t1: number): number {
  const v = trackPitch(x, SR).filter((f) => f.midi !== null && f.time > t0 && f.time < t1).map((f) => f.midi as number);
  v.sort((a, b) => a - b);
  return v[v.length >> 1];
}

const rms = (x: Float32Array, a: number, b: number): number => {
  let s = 0;
  for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.round((b - a) * SR));
};

/** A hum `cents` sharp of `midi`, 1.5 s long, with silence around it. */
function sharpHum(midi: number, cents: number): Float32Array {
  const x = silence(1.9);
  mixAt(x, hum(midi + cents / 100, 1.5), 0.2);
  return x;
}

const base = { sampleRate: SR, anchors: [] as number[], amount: 1, glide: 0.02 };

describe('auto-tune (PSOLA)', () => {
  it('pulls a sharp note onto its target pitch and keeps the level', () => {
    const x = sharpHum(57, 40);
    expect(pitchBetween(x, 0.5, 1.5)).toBeCloseTo(57.4, 1);
    const y = processVoice({ ...base, audio: x, length: x.length, targets: [{ start: 0, end: 2, midi: 57 }] });
    expect(y.length).toBe(x.length);
    expect(y.every(Number.isFinite)).toBe(true);
    expect(Math.abs(pitchBetween(y, 0.5, 1.5) - 57)).toBeLessThan(0.1);
    const ratio = rms(y, 0.4, 1.5) / rms(x, 0.4, 1.5);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('tunes to the target in the octave you sang, not the octave the note is written in', () => {
    const x = sharpHum(57, 35);
    const y = processVoice({ ...base, audio: x, length: x.length, targets: [{ start: 0, end: 2, midi: 69 }] });
    expect(Math.abs(pitchBetween(y, 0.5, 1.5) - 57)).toBeLessThan(0.1);
  });

  it('snaps to the nearest note of the key where there is no target note', () => {
    const x = sharpHum(61, 40); // C♯4 + 40 cents: in C major the nearest scale note is D
    const y = processVoice({ ...base, audio: x, length: x.length, targets: [], key: { tonic: 0, mode: 'major' } });
    expect(Math.abs(pitchBetween(y, 0.5, 1.5) - 62)).toBeLessThan(0.12);
  });

  it('leaves the pitch alone at amount 0', () => {
    const x = sharpHum(57, 40);
    const y = processVoice({ ...base, amount: 0, audio: x, length: x.length, targets: [{ start: 0, end: 2, midi: 57 }] });
    expect(pitchBetween(y, 0.5, 1.5)).toBeCloseTo(57.4, 1);
  });
});

describe('beat match (time warp)', () => {
  it('moves a late note onto the beat', () => {
    const x = silence(1.6);
    mixAt(x, hum(57, 0.5), 0.1);
    mixAt(x, hum(60, 0.5), 0.8);
    // The second note should start 100 ms earlier, at 0.70 s.
    const y = processVoice({ ...base, amount: 0, audio: x, length: x.length, targets: [], anchors: [0.1, 0.1, 0.8, 0.7, 1.3, 1.2] });
    const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    let onset = -1;
    for (let i = Math.round(0.62 * SR); i < y.length; i++) {
      if (Math.abs(y[i]) > 0.3 * peak) {
        onset = i / SR;
        break;
      }
    }
    expect(Math.abs(onset - 0.7)).toBeLessThan(0.015);
    expect(pitchBetween(y, 0.8, 1.1)).toBeCloseTo(60, 0);
  });

  it('maps times through anchor points and drops ones that go backwards', () => {
    const pts = anchorPairs([0, 0, 1, 0.9, 0.5, 2, 2, 2.1]);
    expect(pts).toEqual([[0, 0], [1, 0.9], [2, 2.1]]);
    expect(warp(pts, 0.5)).toBeCloseTo(0.45);
    expect(warp(pts, 3)).toBeCloseTo(3.1);
    expect(warp([], 1.23)).toBe(1.23);
  });
});

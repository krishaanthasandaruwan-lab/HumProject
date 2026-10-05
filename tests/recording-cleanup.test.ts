import { expect, it } from 'vitest';
import { cleanVoice } from '../src/dsp/cleanVoice';
import { processVoice } from '../src/dsp/voice';
import { trackPitch } from '../src/dsp/pitch';
import { SR, hum } from './signals';

const power = (x: Float32Array, hz: number): number => {
  let re = 0, im = 0;
  const first = SR, length = x.length - first;
  for (let k = first; k < x.length; k++) {
    re += x[k] * Math.cos(2 * Math.PI * hz * k / SR);
    im += x[k] * Math.sin(2 * Math.PI * hz * k / SR);
  }
  return Math.hypot(re, im) / length;
};
it.each([50, 60])('reduces persistent %s Hz electrical hum while retaining a sung 220 Hz note', (hz) => {
  const x = new Float32Array(SR * 4);
  for (let k = 0; k < x.length; k++) x[k] = 0.2 * Math.sin(2 * Math.PI * 220 * k / SR) + 0.05 * Math.sin(2 * Math.PI * hz * k / SR) + 0.08;
  const original = x.slice();
  const y = cleanVoice({ audio: x, sampleRate: SR });
  expect(power(y, hz) / power(x, hz)).toBeLessThan(0.05);
  expect(power(y, 220) / power(x, 220)).toBeGreaterThan(0.98);
  expect(Math.abs(y.slice(SR).reduce((a, b) => a + b, 0) / (y.length - SR))).toBeLessThan(1e-4);
  expect(x).toEqual(original);
  expect(y.length).toBe(x.length);
});
it.each([36, 45, 57, 69])('keeps the pitch and loudness of clean MIDI %s singing', (midi) => {
  const x = hum(midi, 3);
  const y = cleanVoice({ audio: x, sampleRate: SR });
  const pitches = trackPitch(y, SR).filter((f) => f.midi !== null && f.time > 0.5).map((f) => f.midi!).sort((a, b) => a - b);
  expect(pitches[pitches.length >> 1]).toBeCloseTo(midi, 1);
  const energy = (a: Float32Array): number => a.slice(SR).reduce((s, v) => s + v * v, 0);
  expect(Math.sqrt(energy(y) / energy(x))).toBeGreaterThan(0.93);
});
it('keeps an unprocessed voice sample-for-sample with silent padding', () => {
  const x = hum(57.34, 1);
  const y = processVoice({ audio: x, sampleRate: SR, length: SR * 3, anchors: [0, 0, 1, 1], targets: [], amount: 0, glide: 0.05 });
  expect(y.subarray(0, x.length)).toEqual(x);
  expect(y.subarray(x.length).every((v) => v === 0)).toBe(true);
});
it('does not repeat the last voiced grain into a longer processed song', () => {
  const x = new Float32Array(SR);
  for (let k = 0; k < x.length; k++) x[k] = 0.3 * Math.sin(2 * Math.PI * 220 * k / SR);
  const y = processVoice({ audio: x, sampleRate: SR, length: SR * 4, anchors: [], targets: [{ start: 0, end: 4, midi: 57 }], amount: 1, glide: 0.05 });
  expect(y.subarray(Math.round(SR * 1.1)).every((v) => v === 0)).toBe(true);
});

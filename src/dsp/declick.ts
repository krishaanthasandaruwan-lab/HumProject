// Takes recorded without headphones also catch the metronome from the speaker, and a beat with
// only the click on it reads as a drum hit — in some bars and not others, depending on how loud
// the leak is. The click is two pure tones, so zero-phase notches take nearly all of it out
// without moving anything in time. What they can't take out is its first few milliseconds; on a
// loud leak those still look like an onset, so clicks heard on their own get blanked as well.
import { detectOnsets, rmsAt } from './onsets';

/** Two-pole notch (RBJ cookbook) run forwards and then backwards: zero phase, twice the depth. */
function notchZeroPhase(x: Float32Array, hz: number, q: number, sampleRate: number): void {
  const w = (2 * Math.PI * hz) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = 1 / a0;
  const b1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  const pass = (from: number, to: number, dir: number): void => {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = from; i !== to; i += dir) {
      const y = b0 * x[i] + b1 * x1 + b0 * x2 - b1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i];
      y2 = y1;
      y1 = y;
      x[i] = y;
    }
  };
  pass(0, x.length, 1);
  pass(x.length - 1, -1, -1);
}

/** A copy of `audio` with the given tones notched out. */
export function removeTones(audio: Float32Array, sampleRate: number, tones: readonly number[], q = 5): Float32Array<ArrayBuffer> {
  const out = new Float32Array(audio);
  for (const hz of tones) if (hz < sampleRate / 2) notchZeroPhase(out, hz, q, sampleRate);
  return out;
}

/**
 * Share of the 5–35 ms after an onset that the notches took out. A click on its own measures
 * ≥ 0.99; a beatbox sound on top of a click stays below 0.95 even when the click is 2.5× louder.
 */
function toneShare(raw: Float32Array, clean: Float32Array, sampleRate: number, t: number): number {
  const s = Math.round((t + 0.005) * sampleRate);
  const n = Math.round(0.03 * sampleRate);
  const all = rmsAt(raw, s, n);
  return all > 0 ? 1 - (rmsAt(clean, s, n) / all) ** 2 : 0;
}

const CLICK_ALONE = 0.95;

/** Fade to silence over [t − 6 ms, t + 8 ms] with 2 ms raised-cosine ramps. */
function blank(x: Float32Array, sampleRate: number, t: number): void {
  const ramp = 0.002 * sampleRate;
  const a = Math.round((t - 0.006) * sampleRate);
  const b = Math.round((t + 0.008) * sampleRate);
  for (let i = Math.max(0, a); i < Math.min(x.length, b); i++) {
    const edge = Math.min(i - a, b - 1 - i);
    x[i] *= edge >= ramp ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * edge) / ramp);
  }
}

/** The take without the metronome's `tones` (Hz) in it. */
export function declick(i: { audio: Float32Array; sampleRate: number; tones: readonly number[] }): Float32Array<ArrayBuffer> {
  const clean = removeTones(i.audio, i.sampleRate, i.tones);
  for (const o of detectOnsets(clean, i.sampleRate)) {
    if (toneShare(i.audio, clean, i.sampleRate, o.time) >= CLICK_ALONE) blank(clean, i.sampleRate, o.time);
  }
  return clean;
}

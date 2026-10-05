// "Your voice, in tune and on the beat": TD-PSOLA. Pitch marks sit one period apart in voiced
// parts (fixed 5 ms marks elsewhere). Each grain (two periods, Hann window) is re-spaced at the
// corrected period — auto-tune — and placed at its warped time — beat match — then overlap-added.
// Formants stay put, so it still sounds like you.
import type { Key } from '../model/project';
import { snapToScale } from './key';
import { fixOctaves, medianSmooth, trackPitch } from './pitch';

export interface TuneTarget {
  start: number; // output seconds
  end: number;
  midi: number;
}

export interface VoiceFxInput {
  audio: Float32Array;
  sampleRate: number;
  /** Notes to tune to, in output time. Between notes the pitch snaps to the key's scale. */
  targets: TuneTarget[];
  key?: Key;
  /** Flat [inputSec, outputSec, …] pairs (ascending in both); empty = timing unchanged. */
  anchors: number[];
  /** Output length in samples. */
  length: number;
  /** 0 = pitch untouched … 1 = fully corrected. */
  amount: number;
  /** Retune glide (s): 0 = hard snap ("robot"), ~0.06 = natural. */
  glide: number;
}

interface Mark {
  pos: number; // input sample
  half: number; // grain half-width (samples)
  shift: number; // semitones
}

/** Piecewise-linear map through (x, y) points, slope 1 outside them. */
export function warp(points: [number, number][], x: number): number {
  const n = points.length;
  if (n === 0) return x;
  if (x <= points[0][0]) return points[0][1] + (x - points[0][0]);
  if (x >= points[n - 1][0]) return points[n - 1][1] + (x - points[n - 1][0]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = points[lo];
  const [x1, y1] = points[hi];
  return x1 > x0 ? y0 + ((x - x0) * (y1 - y0)) / (x1 - x0) : y0;
}

/** Anchor pairs, keeping only those that move forward in both input and output time. */
export function anchorPairs(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const last = out[out.length - 1];
    if (!last || (flat[i] > last[0] + 1e-4 && flat[i + 1] > last[1] + 1e-4)) out.push([flat[i], flat[i + 1]]);
  }
  return out;
}

export function processVoice(i: VoiceFxInput): Float32Array<ArrayBuffer> {
  const x = i.audio;
  const sr = i.sampleRate;
  const hop = 256;
  const fwd = anchorPairs(i.anchors);
  if (i.amount === 0 && fwd.every(([a, b]) => Math.abs(a - b) < 1e-6)) {
    const unchanged = new Float32Array(i.length);
    unchanged.set(x.subarray(0, i.length));
    return unchanged;
  }
  const back = fwd.map(([a, b]) => [b, a] as [number, number]);
  const frames = fixOctaves(medianSmooth(trackPitch(x, sr, { hop, maxHz: 1100 })));

  // Semitone correction per frame, glided within each voiced run.
  const alpha = i.glide > 0 ? 1 - Math.exp(-hop / sr / i.glide) : 1;
  const shift = new Float32Array(frames.length);
  let prevVoiced = false;
  let cur = 0;
  frames.forEach((f, k) => {
    if (f.midi === null) {
      prevVoiced = false;
      return;
    }
    const tOut = warp(fwd, f.time);
    const note = i.targets.find((n) => tOut >= n.start && tOut < n.end);
    const goal = note ? note.midi + 12 * Math.round((f.midi - note.midi) / 12) : i.key ? snapToScale(f.midi, i.key) : f.midi;
    const want = Math.max(-3, Math.min(3, (goal - f.midi) * i.amount));
    cur = prevVoiced ? cur + alpha * (want - cur) : want;
    shift[k] = cur;
    prevVoiced = true;
  });

  // Analysis marks: pitch-synchronous peaks in voiced runs, every 5 ms elsewhere.
  const marks: Mark[] = [];
  const unvoiced = Math.round(0.005 * sr);
  const frameAt = (s: number): number => Math.max(0, Math.min(frames.length - 1, Math.round((s - 1024) / hop)));
  const periodAt = (s: number): number => {
    const m = frames[frameAt(s)]?.midi;
    return m === null || m === undefined ? 0 : Math.round(sr / (440 * Math.pow(2, (m - 69) / 12)));
  };
  const argmax = (lo: number, hi: number): number => {
    let p = Math.max(0, lo);
    for (let k = p; k <= Math.min(x.length - 1, hi); k++) if (x[k] > x[p]) p = k;
    return p;
  };
  let s = 0;
  while (s < x.length) {
    let period = periodAt(s);
    if (!period) {
      marks.push({ pos: s, half: unvoiced, shift: 0 });
      s += unvoiced;
      continue;
    }
    // A voiced run: one mark per period, each on the waveform peak near where it is expected.
    let peak = argmax(s, s + period - 1);
    for (;;) {
      marks.push({ pos: peak, half: period, shift: shift[frameAt(peak)] });
      const next = peak + period;
      const p2 = next < x.length ? periodAt(next) : 0;
      if (!p2) {
        s = next;
        break;
      }
      period = p2;
      peak = argmax(Math.round(next - 0.2 * period), Math.round(next + 0.2 * period));
    }
  }

  // Synthesis: walk the output, take the grain nearest the warped input time, overlap-add.
  const y = new Float32Array(i.length);
  const w = new Float32Array(i.length);
  let j = 0;
  let out = 0;
  while (out < i.length && marks.length) {
    const tin = warp(back, out / sr) * sr;
    if (tin >= x.length) break; // padding is silence, not the last grain repeating as a buzz
    if (tin < 0) { out += unvoiced; continue; }
    while (j + 1 < marks.length && Math.abs(marks[j + 1].pos - tin) <= Math.abs(marks[j].pos - tin)) j++;
    while (j > 0 && Math.abs(marks[j - 1].pos - tin) < Math.abs(marks[j].pos - tin)) j--;
    const m = marks[j];
    const centre = Math.round(out);
    for (let k = -m.half; k <= m.half; k++) {
      const src = m.pos + k;
      const dst = centre + k;
      if (src < 0 || src >= x.length || dst < 0 || dst >= y.length) continue;
      const win = 0.5 * (1 + Math.cos((Math.PI * k) / m.half));
      y[dst] += x[src] * win;
      w[dst] += win;
    }
    out += m.half / Math.pow(2, m.shift / 12);
  }
  for (let k = 0; k < y.length; k++) y[k] = w[k] > 1e-3 ? y[k] / Math.max(w[k], 0.5) : 0;
  return y;
}

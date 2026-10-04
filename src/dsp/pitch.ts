// Frame-wise pitch tracking with pitchy (McLeod pitch method): 2048-sample frames, hop 256,
// voiced only when clarity > 0.9 and RMS is above the noise floor. Then 5-frame median smoothing
// and octave-error folding.
import { PitchDetector } from 'pitchy';
import { rmsAt } from './onsets';

export interface PitchFrame {
  time: number; // centre of the frame, seconds
  midi: number | null; // fractional MIDI, null = unvoiced
  clarity: number;
  rms: number;
}

export interface PitchOptions {
  frameSize?: number;
  hop?: number;
  minClarity?: number;
  minHz?: number;
  maxHz?: number;
}

export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

/** Clarity a frame needs to count as sung when turning a hum into notes. Real voices are breathier than
 * clean tones: on 40 real singers (vocadito) 0.75 hears 13% more of the notes than 0.9, with no more
 * wrong ones, and the hum benchmark is unchanged. */
export const HUM_CLARITY = 0.75;

export function trackPitch(signal: Float32Array, sr: number, o: PitchOptions = {}): PitchFrame[] {
  const size = o.frameSize ?? 2048;
  const hop = o.hop ?? 256;
  const minClarity = o.minClarity ?? 0.9;
  const minHz = o.minHz ?? 60;
  const maxHz = o.maxHz ?? 2600;
  const count = signal.length >= size ? Math.floor((signal.length - size) / hop) + 1 : 0;
  const levels = new Float32Array(count);
  for (let i = 0; i < count; i++) levels[i] = rmsAt(signal, i * hop, size);
  const sorted = Array.from(levels).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
  // The quietest frames estimate the noise floor — unless the whole take is voiced, so cap it.
  const gate = Math.max(0.004, Math.min(floor * 2.5, 0.03));
  const det = PitchDetector.forFloat32Array(size);
  const out: PitchFrame[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * hop;
    const time = (start + size / 2) / sr;
    let midi: number | null = null;
    let clarity = 0;
    if (levels[i] > gate) {
      const [hz, c] = det.findPitch(signal.subarray(start, start + size), sr);
      clarity = c;
      if (c > minClarity && hz >= minHz && hz <= maxHz) midi = hzToMidi(hz);
    }
    out.push({ time, midi, clarity, rms: levels[i] });
  }
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median over ±radius voiced neighbours (5 frames by default). */
export function medianSmooth(frames: PitchFrame[], radius = 2): PitchFrame[] {
  return frames.map((f, i) => {
    if (f.midi === null) return f;
    const vals: number[] = [];
    for (let j = Math.max(0, i - radius); j <= Math.min(frames.length - 1, i + radius); j++) {
      const m = frames[j].midi;
      if (m !== null) vals.push(m);
    }
    return { ...f, midi: median(vals) };
  });
}

/** Within each voiced run, fold frames that sit an octave away from the run's median back. */
export function fixOctaves(frames: PitchFrame[]): PitchFrame[] {
  const out = frames.map((f) => ({ ...f }));
  let i = 0;
  while (i < out.length) {
    if (out[i].midi === null) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j].midi !== null) j++;
    const med = median(out.slice(i, j).map((f) => f.midi as number));
    for (let k = i; k < j; k++) {
      const d = (out[k].midi as number) - med;
      if (Math.abs(Math.abs(d) - 12) < 1) out[k].midi = (out[k].midi as number) - Math.sign(d) * 12;
    }
    i = j;
  }
  return out;
}

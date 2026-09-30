// Krumhansl–Schmuckler key finding + scale snapping.
import type { Key } from '../model/project';

export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

const pc = (midi: number): number => ((Math.round(midi) % 12) + 12) % 12;

/** Pitch-class histogram weighted by note duration. */
export function pitchClassHistogram(notes: { midi: number; length: number }[]): number[] {
  const h = new Array<number>(12).fill(0);
  for (const n of notes) h[pc(n.midi)] += Math.max(0, n.length);
  return h;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Best of the 24 major/minor keys, or null when there is nothing to go on. */
export function detectKey(notes: { midi: number; length: number }[]): { key: Key; score: number } | null {
  const hist = pitchClassHistogram(notes);
  if (hist.every((v) => v === 0)) return null;
  let best: { key: Key; score: number } = { key: { tonic: 0, mode: 'major' }, score: -Infinity };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const prof = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE;
      const rotated = hist.map((_, i) => prof[(i - tonic + 12) % 12]);
      const score = pearson(hist, rotated);
      if (score > best.score) best = { key: { tonic, mode }, score };
    }
  }
  return best;
}

/** The 7 pitch classes of the key (natural minor for minor keys). */
export function scaleOf(key: Key): number[] {
  return (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => (key.tonic + s) % 12);
}

/** Nearest in-scale MIDI note to a (fractional) pitch. Exact ties go to the lower note. */
export function snapToScale(pitch: number, key: Key): number {
  const scale = new Set(scaleOf(key));
  let best = Math.round(pitch);
  let bestD = Infinity;
  for (let m = Math.floor(pitch) - 2; m <= Math.ceil(pitch) + 2; m++) {
    if (!scale.has(((m % 12) + 12) % 12)) continue;
    const d = Math.abs(m - pitch);
    if (d < bestD - 1e-9) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

export function keyName(key: Key): string {
  return `${NOTE_NAMES[key.tonic]} ${key.mode}`;
}

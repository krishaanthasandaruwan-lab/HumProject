// Pitch track -> notes: split on silence or on a pitch move > 0.8 semitones lasting ≥ 50 ms,
// drop notes < 80 ms, pitch = median over the note, then quantize onto the 16th grid.
import { stepDur, type Note } from '../model/project';
import type { PitchFrame } from './pitch';
import { quantizePos, velocityFromRms, type StepMap } from './quantize';

export interface RawNote {
  start: number; // seconds
  end: number;
  pitch: number; // fractional MIDI (median)
  rms: number;
}

export interface SegmentOptions {
  changeSemis?: number;
  changeSec?: number;
  gapSec?: number;
  minNoteSec?: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function segmentNotes(frames: PitchFrame[], hopSec: number, o: SegmentOptions = {}): RawNote[] {
  const changeSemis = o.changeSemis ?? 0.8;
  const changeSec = o.changeSec ?? 0.05;
  const gapSec = o.gapSec ?? 0.03;
  const minNote = o.minNoteSec ?? 0.08;
  const notes: RawNote[] = [];
  let cur: PitchFrame[] = [];
  let pending: PitchFrame[] = [];
  let gap = 0;

  const close = (): void => {
    if (cur.length) {
      const start = cur[0].time - hopSec / 2;
      const end = cur[cur.length - 1].time + hopSec / 2;
      if (end - start >= minNote) {
        const rms = cur.reduce((s, f) => s + f.rms, 0) / cur.length;
        notes.push({ start, end, pitch: median(cur.map((f) => f.midi as number)), rms });
      }
    }
    cur = [];
  };

  for (const f of frames) {
    if (f.midi === null) {
      gap += hopSec;
      if (gap >= gapSec) {
        close();
        pending = [];
      }
      continue;
    }
    gap = 0;
    if (cur.length === 0) {
      cur.push(f);
      continue;
    }
    const ref = median(cur.slice(-40).map((x) => x.midi as number));
    if (Math.abs(f.midi - ref) > changeSemis) {
      pending.push(f);
      const moved = median(pending.map((x) => x.midi as number));
      if (pending.length * hopSec >= changeSec && Math.abs(moved - ref) > changeSemis) {
        const next = pending;
        pending = [];
        close();
        cur = next;
      }
    } else {
      cur.push(...pending, f);
      pending = [];
    }
  }
  close();
  return notes;
}

/** Monophonic notes on the 16th grid (start quantized with swing, end to the nearest 16th). */
export function notesToGrid(raw: RawNote[], bpm: number, steps: number, swing = 0, toSteps?: StepMap): Note[] {
  const sd = stepDur(bpm);
  const at = toSteps ?? ((t: number): number => t / sd);
  const maxRms = raw.reduce((m, n) => Math.max(m, n.rms), 0);
  const notes: Note[] = [];
  for (const r of raw) {
    const q = quantizePos(at(r.start), swing);
    const endStep = at(r.end);
    if (q.step >= steps || endStep <= 0) continue;
    const start = Math.max(0, q.step);
    const length = Math.min(steps - start, Math.max(1, Math.round(endStep) - start));
    const v = velocityFromRms(r.rms, maxRms);
    notes.push({
      start, length, midi: Math.round(r.pitch),
      velocity: 0.6 + (0.4 * (v - 0.4)) / 0.6,
      offset: q.step >= 0 ? q.offset : 0,
      raw: r.pitch,
    });
  }
  notes.sort((a, b) => a.start - b.start || b.length - a.length);
  const out: Note[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (prev && prev.start === n.start) continue;
    if (prev && prev.start + prev.length > n.start) prev.length = n.start - prev.start;
    out.push(n);
  }
  return out;
}

/** Bass mode: move the line by octaves into MIDI lo..hi (28–52), folding outliers. */
export function transposeToRange(notes: Note[], lo = 28, hi = 52): Note[] {
  if (notes.length === 0) return notes;
  const med = median(notes.map((n) => n.raw ?? n.midi));
  const shift = -12 * Math.round((med - (lo + hi) / 2) / 12);
  return notes.map((n) => {
    let midi = n.midi + shift;
    let raw = (n.raw ?? n.midi) + shift;
    while (midi < lo) { midi += 12; raw += 12; }
    while (midi > hi) { midi -= 12; raw -= 12; }
    return { ...n, midi, raw };
  });
}

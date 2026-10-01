// Pitch track -> notes: split on silence, on a dip in loudness (the same note hummed again), or on a
// pitch move > 0.8 semitones lasting ≥ 50 ms; drop notes < 80 ms. A note's pitch is the median of its
// settled part (after the scoop up into it). Then quantize onto the 16th grid.
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

/** Frames where the loudness dips to under half of what comes just before and just after it: where
 * the same note is hummed again ("hm-hm") without a full stop. */
export function loudnessDips(frames: PitchFrame[], hopSec: number, windowSec = 0.06, ratio = 0.5): Set<number> {
  const k = Math.max(2, Math.round(windowSec / hopSec));
  const dips = new Set<number>();
  for (let i = 1; i + 1 < frames.length; i++) {
    const r = frames[i].rms;
    if (r > frames[i - 1].rms || r > frames[i + 1].rms) continue;
    let before = 0;
    let after = 0;
    for (let j = Math.max(0, i - k); j < i; j++) before = Math.max(before, frames[j].rms);
    for (let j = i + 1; j <= Math.min(frames.length - 1, i + k); j++) after = Math.max(after, frames[j].rms);
    if (r < ratio * before && r < ratio * after) dips.add(i);
  }
  return dips;
}

/** Median pitch of a note's settled part: skip the scoop at the start and the fall at the end. */
function settledPitch(cur: PitchFrame[]): number {
  const n = cur.length;
  const part = n >= 8 ? cur.slice(Math.floor(n * 0.3), Math.ceil(n * 0.9)) : cur;
  return median(part.map((f) => f.midi as number));
}

export function segmentNotes(frames: PitchFrame[], hopSec: number, o: SegmentOptions = {}): RawNote[] {
  const changeSemis = o.changeSemis ?? 0.8;
  const changeSec = o.changeSec ?? 0.05;
  const gapSec = o.gapSec ?? 0.03;
  const minNote = o.minNoteSec ?? 0.08;
  const notes: RawNote[] = [];
  const dips = loudnessDips(frames, hopSec);
  let cur: PitchFrame[] = [];
  let pending: PitchFrame[] = [];
  let gap = 0;

  const close = (): void => {
    if (cur.length) {
      const start = cur[0].time - hopSec / 2;
      const end = cur[cur.length - 1].time + hopSec / 2;
      if (end - start >= minNote) {
        const rms = cur.reduce((s, f) => s + f.rms, 0) / cur.length;
        notes.push({ start, end, pitch: settledPitch(cur), rms });
      }
    }
    cur = [];
  };

  for (let fi = 0; fi < frames.length; fi++) {
    const f = frames[fi];
    if (dips.has(fi) && cur.length) {
      close();
      pending = [];
    }
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

/** How far off-key the singer is overall (semitones, -0.5..0.5): the duration-weighted circular mean of
 * every note's distance from the nearest semitone. 0 with fewer than 3 notes, or when they don't agree. */
export function tuningOffset(notes: RawNote[]): number {
  if (notes.length < 3) return 0;
  let x = 0;
  let y = 0;
  let w = 0;
  for (const n of notes) {
    const d = n.end - n.start;
    x += d * Math.cos(2 * Math.PI * n.pitch);
    y += d * Math.sin(2 * Math.PI * n.pitch);
    w += d;
  }
  if (w === 0 || Math.hypot(x, y) / w < 0.3) return 0;
  return Math.atan2(y, x) / (2 * Math.PI);
}

/** Notes moved by the singer's own tuning, so a consistently flat or sharp hum lands on the right notes. */
export function retune(notes: RawNote[]): RawNote[] {
  const off = tuningOffset(notes);
  return Math.abs(off) < 0.06 ? notes : notes.map((n) => ({ ...n, pitch: n.pitch - off }));
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

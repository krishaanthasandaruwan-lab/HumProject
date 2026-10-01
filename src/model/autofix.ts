// "✨ Auto-fix": make a recorded part agree with itself. It only runs when the user taps the
// button, and it can be undone.
//  1. Timing — if every hit is late (or early) by about the same amount, usually a latency setting
//     that is off, shift them all so they stop flipping between neighbouring steps.
//  2. Drums — find the repeating pattern (1, 2 or 4 bars) by majority vote; every bar follows it.
//  3. Melody — fold octave slips back, drop tiny glitch notes, re-join notes split in two.
//  0. Before all that, a take that stops early (6 bars in an 8-bar song) is filled out by repeating
//     what was recorded, from the top.
import { quantizePos } from '../dsp/quantize';
import { STEPS_PER_BAR, swingOffset, type DrumHit, type DrumType, type Note } from './project';

export interface FixReport {
  changes: number; // hits / notes added, removed, moved or re-pitched
  shiftSteps: number; // timing correction applied to everything (steps; 0 = none)
  period: number; // drums: pattern length in bars
  filled: number; // empty bars at the end that were filled by repeating the take
}

/** How many bars from the top hold something (the last bar with a note or hit in it, + 1). */
export function usedBars(starts: number[]): number {
  return starts.length ? Math.floor(Math.max(...starts) / STEPS_PER_BAR) + 1 : 0;
}

/** Fill the empty bars at the end by repeating the recorded bars from the top. */
function fill<T>(items: T[], bars: number, startOf: (x: T) => number, moveTo: (x: T, start: number) => T): { items: T[]; filled: number } {
  const used = usedBars(items.map(startOf));
  if (used === 0 || used >= bars) return { items, filled: 0 };
  const out = [...items];
  for (let at = used; at < bars; at += used) {
    const span = Math.min(used, bars - at) * STEPS_PER_BAR;
    for (const x of items) if (startOf(x) < span) out.push(moveTo(x, startOf(x) + at * STEPS_PER_BAR));
  }
  return { items: out, filled: bars - used };
}

export function fillHits(hits: DrumHit[], bars: number): { hits: DrumHit[]; filled: number } {
  const r = fill(hits, bars, (h) => h.step, (h, step) => ({ ...h, step }));
  return { hits: r.items, filled: r.filled };
}

export function fillNotes(notes: Note[], bars: number): { notes: Note[]; filled: number } {
  const end = bars * STEPS_PER_BAR;
  const r = fill(notes, bars, (n) => n.start, (n, start) => ({ ...n, start, length: Math.max(1, Math.min(n.length, end - start)) }));
  return { notes: r.items, filled: r.filled };
}

const TAU = 2 * Math.PI;

/** Systematic lateness (+) / earliness (−) in steps, or 0 when the timing is merely loose. */
export function timingBias(items: { offset?: number }[]): number {
  if (items.length < 4) return 0;
  let c = 0;
  let s = 0;
  for (const it of items) {
    c += Math.cos(TAU * (it.offset ?? 0));
    s += Math.sin(TAU * (it.offset ?? 0));
  }
  const strength = Math.hypot(c, s) / items.length;
  const mean = Math.atan2(s, c) / TAU;
  return strength > 0.5 && Math.abs(mean) >= 0.15 ? mean : 0;
}

/** Re-quantize a step + offset after removing `bias`; wraps around the loop. */
function requantize(step: number, offset: number, bias: number, swing: number, total: number): { step: number; offset: number } {
  const q = quantizePos(step + swingOffset(step, swing) + offset - bias, swing);
  return { step: ((q.step % total) + total) % total, offset: q.offset };
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};

export function fixDrums(recorded: DrumHit[], bars: number, swing: number): { hits: DrumHit[]; report: FixReport } {
  const total = bars * STEPS_PER_BAR;
  const { hits, filled } = fillHits(recorded, bars);
  const bias = timingBias(hits);
  let moved = 0;
  const timed = hits.map((h) => {
    if (!bias) return { ...h };
    const q = requantize(h.step, h.offset ?? 0, bias, swing, total);
    if (q.step !== h.step) moved++;
    return { ...h, step: q.step, offset: q.offset };
  });

  // Majority vote per (position in the pattern, drum); pick the shortest period that explains it.
  const disagreements = (period: number): number => {
    const groups = bars / period;
    const counts = new Map<string, number>();
    for (const h of timed) {
      const k = `${h.step % (period * STEPS_PER_BAR)}:${h.type}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let d = 0;
    for (const c of counts.values()) d += Math.min(c, groups - c);
    return d;
  };
  let period = 1;
  for (const p of [2, 4]) {
    if (bars / p >= 2 && disagreements(p) < 0.6 * disagreements(period)) period = p;
  }
  const len = period * STEPS_PER_BAR;
  const groups = bars / period;
  const slots = new Map<string, { pos: number; type: DrumType; hits: DrumHit[] }>();
  for (const h of timed) {
    const k = `${h.step % len}:${h.type}`;
    const slot = slots.get(k) ?? { pos: h.step % len, type: h.type, hits: [] };
    slot.hits.push(h);
    slots.set(k, slot);
  }
  const out: DrumHit[] = [];
  let changes = moved + (hits.length - recorded.length);
  for (const slot of slots.values()) {
    const share = new Set(slot.hits.map((h) => Math.floor(h.step / len))).size / groups;
    const vel = median(slot.hits.map((h) => h.velocity));
    const keep = share > 0.5 || (share === 0.5 && vel >= 0.6);
    for (let g = 0; g < groups; g++) {
      const mine = slot.hits.filter((h) => Math.floor(h.step / len) === g);
      const have = mine[0];
      changes += Math.max(0, mine.length - 1); // two hits shifted onto one step: keep one
      if (keep && have) out.push({ ...have, velocity: (have.velocity + vel) / 2 });
      else if (keep) {
        out.push({ step: g * len + slot.pos, type: slot.type, velocity: vel, offset: median(slot.hits.map((h) => h.offset ?? 0)) });
        changes++;
      } else if (have) changes++;
    }
  }
  out.sort((a, b) => a.step - b.step || a.type.localeCompare(b.type));
  return { hits: out, report: { changes, shiftSteps: bias, period, filled } };
}

export function fixNotes(recorded: Note[], bars: number, swing: number): { notes: Note[]; report: FixReport } {
  const total = bars * STEPS_PER_BAR;
  const { notes, filled } = fillNotes(recorded, bars);
  const bias = timingBias(notes);
  let changes = notes.length - recorded.length;
  let out = notes.map((n) => {
    if (!bias) return { ...n };
    const q = requantize(n.start, n.offset ?? 0, bias, swing, total);
    if (q.step !== n.start) changes++;
    return { ...n, start: q.step, offset: q.offset, length: Math.max(1, Math.min(n.length, total - q.step)) };
  });
  out.sort((a, b) => a.start - b.start);

  // Octave slips: a note an octave away from both neighbours (within a bar) comes back.
  const near = (a: Note | undefined, b: Note): boolean => !!a && Math.abs(a.start - b.start) <= STEPS_PER_BAR;
  out.forEach((n, i) => {
    const around = [out[i - 1], out[i + 1]].filter((m) => near(m, n)) as Note[];
    if (!around.length || !around.every((m) => Math.abs(n.midi - m.midi) >= 10)) return;
    for (const d of [-12, 12]) {
      if (around.every((m) => Math.abs(n.midi + d - m.midi) <= 5)) {
        n.midi += d;
        if (n.raw !== undefined) n.raw += d;
        changes++;
        return;
      }
    }
  });

  // Glitches: a single-step note squeezed between two notes it does not belong to.
  const kept: Note[] = [];
  out.forEach((n, i) => {
    const prev = kept[kept.length - 1];
    const next = out[i + 1];
    const touching = prev && next && prev.start + prev.length >= n.start && n.start + n.length >= next.start;
    if (n.length === 1 && touching && Math.abs(n.midi - prev.midi) >= 3 && Math.abs(n.midi - next.midi) >= 3) {
      prev.length = next.start - prev.start;
      changes++;
      return;
    }
    // Splits: the same pitch re-attacked straight away for a moment (a breath or a wobble).
    if (prev && prev.midi === n.midi && prev.start + prev.length === n.start && n.length <= 2) {
      prev.length += n.length;
      changes++;
      return;
    }
    kept.push(n);
  });
  out = kept;
  return { notes: out, report: { changes, shiftSteps: bias, period: 1, filled } };
}

import { STEPS_PER_BAR, type Project } from './project';

export const MAX_SONG_SECONDS = 300;
export const maxSongBars = (bpm: number): number => Math.min(200, Math.floor(MAX_SONG_SECONDS * bpm / 240));

/** Saved songs without a set size keep their short loop size, or use eight-bar pages. */
export const barSetSize = (p: Pick<Project, 'bars' | 'barSet'>): 2 | 4 | 8 =>
  p.barSet === 2 || p.barSet === 4 || p.barSet === 8 ? p.barSet : p.bars === 2 || p.bars === 4 ? p.bars : 8;

/** Extend without changing existing parts or recordings. Copy a whole loop when requested. */
export function extendSong(p: Project, bars: number, repeat: boolean, repeatBars = 4): void {
  if (!Number.isInteger(bars) || bars < p.bars || bars > maxSongBars(p.bpm)) throw new Error('Choose a longer song, up to five minutes.');
  if (!Number.isInteger(repeatBars) || repeatBars < 1) throw new Error('Choose a whole bar set.');
  const oldEnd = p.bars * STEPS_PER_BAR;
  const end = bars * STEPS_PER_BAR;
  const spanBars = Math.min(repeatBars, p.bars);
  const span = spanBars * STEPS_PER_BAR;
  const start = oldEnd - span;
  if (repeat) for (const t of p.tracks) {
    const hits = (t.hits ?? []).filter((h) => h.step >= start && h.step < oldEnd);
    const notes = (t.notes ?? []).filter((n) => n.start >= start && n.start < oldEnd);
    const hitKeys = new Set((t.hits ?? []).map((h) => `${h.step}:${h.type}`));
    const noteKeys = new Set((t.notes ?? []).map((n) => `${n.start}:${n.midi}`));
    for (let at = oldEnd; at < end; at += span) {
      for (const h of hits) {
        const step = at + h.step - start;
        if (step < end && !hitKeys.has(`${step}:${h.type}`)) (t.hits ??= []).push({ ...h, step });
      }
      for (const n of notes) {
        const noteStart = at + n.start - start;
        if (noteStart < end && !noteKeys.has(`${noteStart}:${n.midi}`)) (t.notes ??= []).push({ ...n, start: noteStart, length: Math.min(n.length, end - noteStart) });
      }
    }
    if (t.labels?.length) for (let b = p.bars; b < bars; b++) t.labels[b] ??= t.labels[p.bars - spanBars + (b - p.bars) % spanBars];
  }
  p.bars = bars;
}

/** One + tap adds one matching set at the end, up to five minutes. */
export function appendBarSet(p: Project): void {
  const size = barSetSize(p);
  extendSong(p, p.bars + size, true, size);
  p.barSet = size;
}

/** Delete the final visible set; keep at least the first loop and every original recording. */
export function removeBarSet(p: Project): void {
  const size = barSetSize(p);
  if (p.bars <= size) throw new Error('Keep the first bar set.');
  const bars = Math.max(size, (Math.ceil(p.bars / size) - 1) * size);
  const end = bars * STEPS_PER_BAR;
  const oldEnd = p.bars * STEPS_PER_BAR;
  for (const t of p.tracks) {
    if (t.hits) t.hits = t.hits.filter((h) => h.step < end || h.step >= oldEnd);
    if (t.notes) t.notes = t.notes.filter((n) => n.start < end || n.start >= oldEnd)
      .map((n) => n.start < end ? { ...n, length: Math.min(n.length, end - n.start) } : n);
    if (t.labels) for (let b = bars; b < p.bars; b++) delete t.labels[b];
  }
  p.bars = bars;
  p.barSet = size;
}

// Project-level music helpers that run on the main thread (cheap, no DSP libraries).
import { detectKey, snapToScale } from '../dsp/key';
import type { Note, Project } from './project';

const isMelodic = (kind: string): boolean => kind === 'bass' || kind === 'lead';

/** Re-detect the key from the hummed parts, then (re)snap every unedited hummed note. */
export function refreshKey(p: Project, snap: boolean): void {
  const notes: Note[] = p.tracks.filter((t) => isMelodic(t.kind) && !t.generated).flatMap((t) => t.notes ?? []);
  const found = detectKey(notes.map((n) => ({ midi: n.raw !== undefined ? Math.round(n.raw) : n.midi, length: n.length })));
  if (found) p.key = found.key;
  if (!p.key) return;
  for (const t of p.tracks) {
    if (!isMelodic(t.kind) || t.generated) continue;
    for (const n of t.notes ?? []) {
      if (n.raw !== undefined) n.midi = snap ? snapToScale(n.raw, p.key) : Math.round(n.raw);
    }
  }
}

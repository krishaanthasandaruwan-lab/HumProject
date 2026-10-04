// The editor for one part: the drum grid for drums, the same grid with a row per note for the tuned
// parts (noteGrid.ts, chord names on the bars), and the "My voice" controls for 'voice'. Used by the part
// editor screen and the Tracks screen.
import { auditionDrum, auditionNote } from '../app';
import { trackById, TRACK_META, type Track } from '../model/project';
import { edit, getProject } from '../state';
import { h } from './dom';
import { drumGrid } from './grid';
import { noteGrid } from './noteGrid';
import { voicePanel } from './voicePanel';

export interface PartEditor {
  el: HTMLElement;
  /** Draw it again from the song (after Fix, Undo or a sound change). */
  rebuild(): void;
  setPlayhead(step: number): void;
}

/** `id`: a track id, or 'voice'. */
export function partEditor(id: string): PartEditor {
  const el = h('div', { class: 'part-editor' });
  const p = getProject;
  const track = (): Track | undefined => (id === 'voice' ? undefined : trackById(p(), id));
  let playhead: (step: number) => void = () => undefined;

  function rebuild(): void {
    playhead = () => undefined;
    if (id === 'voice') {
      el.replaceChildren(voicePanel());
      return;
    }
    const kind = track()?.kind;
    if (!kind) {
      el.replaceChildren();
      return;
    }
    if (kind === 'drums') {
      const grid = drumGrid({
        hits: () => track()?.hits ?? [],
        bars: () => p().bars,
        edit: (fn) => edit(() => fn((track()!.hits ??= []))),
        audition: (type, v) => auditionDrum(type, track()?.preset ?? '808', v),
      });
      playhead = (s) => grid.setPlayhead(s);
      el.replaceChildren(grid.el, h('p', { class: 'small muted' }, 'Tap to add · tap again to change · hold to delete'));
      return;
    }
    const grid = noteGrid({
      notes: () => track()?.notes ?? [],
      bars: () => p().bars,
      keyOf: () => p().key,
      edit: (fn) => edit(() => fn((track()!.notes ??= []))),
      audition: (m) => auditionNote(track()?.preset ?? TRACK_META[kind].preset, m),
      poly: kind === 'chords',
      home: kind === 'bass' ? 36 : kind === 'chords' ? 55 : 60,
      labels: () => track()?.labels ?? [],
    });
    playhead = (s) => grid.setPlayhead(s);
    el.replaceChildren(grid.el, h('p', { class: 'small muted' }, 'Tap to add a note · tap a note to take it out'));
  }

  rebuild();
  return { el, rebuild, setPlayhead: (s) => playhead(s) };
}

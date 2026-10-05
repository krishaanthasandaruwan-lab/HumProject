// Notes in the drum grid's look (bass, melody, chords): one block per bar, a row per pitch in the song's
// key (lowest at the bottom), 16 cells. A note fills its cells; a red edge marks where it starts.
// Tap an empty cell to add a note there, tap a note to take it out.
import { NOTE_NAMES, scaleOf } from '../dsp/key';
import { STEPS_PER_BAR, type Key, type Note } from '../model/project';
import { h } from './dom';
import { gridKeyboard } from './gridKeyboard';

export interface NoteGridOptions {
  notes: () => Note[];
  bars: () => number;
  keyOf: () => Key | undefined;
  edit: (fn: (notes: Note[]) => void) => void;
  audition: (midi: number) => void;
  /** Several notes may sound at once (chords). */
  poly: boolean;
  /** Where an empty part starts (bass sits low). */
  home: number;
  /** Chord names per bar, shown on the bar. */
  labels?: () => string[];
}

export interface NoteGridApi {
  el: HTMLElement;
  render(): void;
  setPlayhead(step: number): void;
}

const pcOf = (m: number): number => ((m % 12) + 12) % 12;
export const noteName = (m: number): string => `${NOTE_NAMES[pcOf(m)]}${Math.floor(m / 12) - 1}`;

/** The pitches to show: the song's key from a little below the lowest note to a little above the highest. */
export function gridPitches(notes: Note[], key: Key | undefined, home: number): number[] {
  const used = notes.map((n) => n.midi);
  const lo = (used.length ? Math.min(...used) : home) - 2;
  const hi = (used.length ? Math.max(...used) : home + 12) + 2;
  const scale = key ? new Set(scaleOf(key)) : null;
  const out: number[] = [];
  for (let m = hi; m >= lo; m--) if (!scale || scale.has(pcOf(m)) || used.includes(m)) out.push(m);
  return out;
}

export function noteGrid(o: NoteGridOptions): NoteGridApi {
  const el = h('div', { class: 'grid ngrid', role: 'group', 'aria-label': 'Notes' });
  gridKeyboard(el);
  let cells: HTMLElement[][] = []; // [step][row]
  let pitches: number[] = [];
  let head = -1;

  function render(): void {
    el.replaceChildren();
    cells = [];
    head = -1;
    pitches = gridPitches(o.notes(), o.keyOf(), o.home);
    const bars = o.bars();
    const labels = o.labels?.() ?? [];
    for (let b = 0; b < bars; b++) {
      const rows = pitches.map((m, r) => {
        const row = h('div', { class: `grid-row${pcOf(m) === o.keyOf()?.tonic ? ' tonic' : ''}` }, h('span', { class: 'grid-lbl' }, noteName(m)));
        for (let s = 0; s < STEPS_PER_BAR; s++) {
          const step = b * STEPS_PER_BAR + s;
          const c = h('button', { type: 'button', tabindex: step === 0 && r === 0 ? 0 : -1, class: `cell${s % 4 === 0 ? ' beat' : ''}`, 'data-step': step, 'data-row': r, 'aria-label': `${noteName(m)}, bar ${b + 1}, step ${s + 1}`, 'aria-pressed': 'false' });
          row.appendChild(c);
          (cells[step] ??= [])[r] = c;
        }
        return row;
      });
      el.appendChild(h('div', { class: 'grid-bar' },
        h('div', { class: 'grid-bar-no label' }, `Bar ${b + 1} of ${bars}`, labels[b] ? h('span', { class: 'grid-chord' }, labels[b]) : null),
        rows));
    }
    paint();
  }

  function paint(): void {
    for (const col of cells) for (const c of col) { c.classList.remove('on', 'start'); c.setAttribute('aria-pressed', 'false'); }
    for (const n of o.notes()) {
      const r = pitches.indexOf(n.midi);
      if (r < 0) continue;
      for (let s = n.start; s < n.start + n.length; s++) {
        const c = cells[s]?.[r];
        if (!c) continue;
        c.classList.add('on');
        c.setAttribute('aria-pressed', 'true');
        if (s === n.start) c.classList.add('start');
      }
    }
  }

  function setPlayhead(step: number): void {
    if (step === head) return;
    cells[head]?.forEach((c) => c.classList.remove('ph'));
    head = step;
    cells[head]?.forEach((c) => c.classList.add('ph'));
  }

  function tap(step: number, row: number): void {
    const midi = pitches[row];
    const total = o.bars() * STEPS_PER_BAR;
    o.edit((notes) => {
      const hit = notes.findIndex((n) => n.midi === midi && step >= n.start && step < n.start + n.length);
      if (hit >= 0) {
        notes.splice(hit, 1);
        return;
      }
      // A new note: two steps (a whole beat for chords), up to the next note it would run into.
      let length = Math.min(o.poly ? 4 : 2, total - step);
      for (const n of notes) {
        const same = o.poly ? n.midi === midi : true;
        if (same && n.start > step) length = Math.min(length, n.start - step);
      }
      if (!o.poly) {
        // One voice: a note already sounding here stops where the new one starts.
        for (let i = notes.length - 1; i >= 0; i--) {
          const n = notes[i];
          if (step >= n.start && step < n.start + n.length) {
            if (n.start === step) notes.splice(i, 1);
            else n.length = step - n.start;
          }
        }
      }
      notes.push({ start: step, length: Math.max(1, length), midi, velocity: 0.85 });
      notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
      o.audition(midi);
    });
    paint();
  }

  el.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.cell');
    if (c) tap(Number(c.dataset.step), Number(c.dataset.row));
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  render();
  return { el, render, setPlayhead };
}

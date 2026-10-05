// 16-steps-per-bar drum grid. Tap an empty cell to add that drum; tap a lit cell to cycle
// kick → snare → hat → empty (fixes misheard beatbox hits). Long-press deletes.
import { DRUM_TYPES, type DrumHit, type DrumType } from '../model/project';
import { h } from './dom';
import { gridKeyboard } from './gridKeyboard';

const CYCLE: (DrumType | null)[] = ['kick', 'snare', 'hat', null];
const LABELS: Record<DrumType, string> = { kick: 'K', snare: 'S', hat: 'H' };
const NAMES: Record<DrumType, string> = { kick: 'Kick', snare: 'Snare', hat: 'Hat' };

export interface GridOptions {
  hits: () => DrumHit[];
  bars: () => number;
  edit: (fn: (hits: DrumHit[]) => void) => void;
  audition: (type: DrumType, velocity: number) => void;
}

export interface GridApi {
  el: HTMLElement;
  render(): void;
  paint(): void;
  setPlayhead(step: number): void;
}

export function drumGrid(o: GridOptions): GridApi {
  const el = h('div', { class: 'grid', role: 'group', 'aria-label': 'Drum grid' });
  gridKeyboard(el);
  let cells: HTMLElement[][] = []; // [step][row]
  let head = -1;
  let pressTimer = 0;
  let longPressed = false;

  function render(): void {
    el.replaceChildren();
    cells = [];
    head = -1;
    const bars = o.bars();
    for (let b = 0; b < bars; b++) {
      const rows = DRUM_TYPES.map((type, r) => {
        const row = h('div', { class: 'grid-row' }, h('span', { class: 'grid-lbl', title: NAMES[type] }, LABELS[type]));
        for (let s = 0; s < 16; s++) {
          const step = b * 16 + s;
          const c = h('button', { type: 'button', tabindex: step === 0 && r === 0 ? 0 : -1, class: `cell${s % 4 === 0 ? ' beat' : ''}`, 'data-step': step, 'data-row': r, 'aria-label': `${NAMES[type]}, bar ${b + 1}, step ${s + 1}`, 'aria-pressed': 'false' });
          row.appendChild(c);
          (cells[step] ??= [])[r] = c;
        }
        return row;
      });
      el.appendChild(h('div', { class: 'grid-bar' }, h('div', { class: 'grid-bar-no label' }, `Bar ${b + 1} of ${bars}`), rows));
    }
    paint();
  }

  function paint(): void {
    for (const col of cells) for (const c of col) {
      c.classList.remove('on', 'kick', 'snare', 'hat');
      c.style.removeProperty('--v');
      c.setAttribute('aria-pressed', 'false');
    }
    for (const hit of o.hits()) {
      const c = cells[hit.step]?.[DRUM_TYPES.indexOf(hit.type)];
      if (!c) continue;
      c.classList.add('on', hit.type);
      c.setAttribute('aria-pressed', 'true');
      c.style.setProperty('--v', String(0.45 + 0.55 * hit.velocity));
    }
  }

  function setPlayhead(step: number): void {
    if (step === head) return;
    cells[head]?.forEach((c) => c.classList.remove('ph'));
    head = step;
    cells[head]?.forEach((c) => c.classList.add('ph'));
  }

  function target(e: Event): { step: number; row: number } | null {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.cell');
    if (!c) return null;
    return { step: Number(c.dataset.step), row: Number(c.dataset.row) };
  }

  function tap(step: number, row: number): void {
    const type = DRUM_TYPES[row];
    o.edit((hits) => {
      const i = hits.findIndex((x) => x.step === step && x.type === type);
      if (i < 0) {
        hits.push({ step, type, velocity: 0.9 });
        o.audition(type, 0.9);
        return;
      }
      const next = CYCLE[CYCLE.indexOf(type) + 1];
      if (next === null || hits.some((x) => x.step === step && x.type === next)) {
        hits.splice(i, 1);
      } else {
        hits[i] = { ...hits[i], type: next };
        o.audition(next, hits[i].velocity);
      }
    });
    paint();
  }

  function remove(step: number, row: number): void {
    const type = DRUM_TYPES[row];
    o.edit((hits) => {
      const i = hits.findIndex((x) => x.step === step && x.type === type);
      if (i >= 0) hits.splice(i, 1);
    });
    paint();
    navigator.vibrate?.(12);
  }

  el.addEventListener('pointerdown', (e) => {
    const t = target(e);
    if (!t) return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      longPressed = true;
      remove(t.step, t.row);
    }, 450);
  });
  const cancel = (): void => clearTimeout(pressTimer);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerup', () => {
    clearTimeout(pressTimer);
  });
  el.addEventListener('click', (e) => {
    const t = target(e);
    if (!t) return;
    if (longPressed) { longPressed = false; return; }
    tap(t.step, t.row);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const t = target(e);
    if (t) { e.preventDefault(); remove(t.step, t.row); }
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  render();
  return { el, render, paint, setPlayhead };
}

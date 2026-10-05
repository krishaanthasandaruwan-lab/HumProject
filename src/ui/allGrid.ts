// "All" on the Tracks screen: the whole song in the drum grid's look — per bar, one row per part (an icon
// for its label) and 16 cells. Drums light where they hit (kick ink, snare red, hat a dot); tuned parts
// fill their notes, with the red edge where a note starts. Tap a row to open that part.
import { STEPS_PER_BAR, type Project, type Track } from '../model/project';
import { h } from './dom';
import { icon } from './icons';
import { PARTS, partLabel } from './parts';

export interface AllGridApi {
  el: HTMLElement;
  render(): void;
  setPlayhead(step: number): void;
}

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;

export function allGrid(o: { project: () => Project; open: (id: string) => void }): AllGridApi {
  const el = h('div', { class: 'grid agrid', role: 'group', 'aria-label': 'All parts' });
  let cells: HTMLElement[][] = [];
  let head = -1;

  function render(): void {
    el.replaceChildren();
    cells = [];
    head = -1;
    const p = o.project();
    const parts = p.tracks.filter(hasContent);
    for (let b = 0; b < p.bars; b++) {
      const rows = parts.map((t, r) => {
        const name = partLabel(p, t);
        const row = h('div', { class: `grid-row${t.muted ? ' muted' : ''}`, 'data-id': t.id, title: name, role: 'group', 'aria-label': `${name}, bar ${b + 1}` },
          h('button', { type: 'button', class: 'grid-lbl', 'aria-label': `Open ${name}`, onClick: () => o.open(t.id) }, icon(PARTS[t.kind].icon, 14)));
        for (let s = 0; s < STEPS_PER_BAR; s++) {
          const step = b * STEPS_PER_BAR + s;
          const c = h('div', { class: `cell${s % 4 === 0 ? ' beat' : ''}`, 'aria-hidden': 'true' });
          row.appendChild(c);
          (cells[step] ??= [])[r] = c;
        }
        return row;
      });
      el.appendChild(h('div', { class: 'grid-bar' }, h('div', { class: 'grid-bar-no label' }, `Bar ${b + 1} of ${p.bars}`), rows));
    }
    parts.forEach((t, r) => {
      if (t.kind === 'drums') {
        for (const hit of t.hits ?? []) {
          const c = cells[hit.step]?.[r];
          if (!c) continue;
          // Snare over kick over hat when they share a step.
          const rank = { hat: 1, kick: 2, snare: 3 }[hit.type];
          if (rank > Number(c.dataset.rank ?? 0)) {
            c.dataset.rank = String(rank);
            c.className = c.className.replace(/ (kick|snare|hat)/g, '');
            c.classList.add('on', hit.type);
          }
        }
      } else {
        for (const n of t.notes ?? []) {
          for (let s = n.start; s < n.start + n.length; s++) {
            const c = cells[s]?.[r];
            if (!c) continue;
            c.classList.add('on', 'tone');
            if (s === n.start) c.classList.add('start');
          }
        }
      }
    });
  }

  function setPlayhead(step: number): void {
    if (step === head) return;
    cells[head]?.forEach((c) => c.classList.remove('ph'));
    head = step;
    cells[head]?.forEach((c) => c.classList.add('ph'));
  }

  el.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.grid-row');
    if (row?.dataset.id && !(e.target as HTMLElement).closest('button')) o.open(row.dataset.id);
  });

  render();
  return { el, render, setPlayhead };
}

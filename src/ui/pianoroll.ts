// Piano roll: drag a note up/down to change its pitch; tap to select, then delete or nudge.
import { NOTE_NAMES, scaleOf } from '../dsp/key';
import type { Key, Note } from '../model/project';
import { h } from './dom';
import { fitCanvas } from './waveform';

export interface RollOptions {
  notes: () => Note[];
  steps: () => number;
  keyOf: () => Key | undefined;
  color: string;
  edit: (fn: (notes: Note[]) => void) => void;
  audition: (midi: number) => void;
}

export interface RollApi {
  el: HTMLElement;
  render(): void;
  setPlayhead(step: number): void;
}

const ROW = 11;
const isBlack = (m: number): boolean => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

export function pianoRoll(o: RollOptions): RollApi {
  const scroller = h('div', { class: 'roll-scroll' });
  const inner = h('div', { class: 'roll-inner' });
  const bg = h('canvas', { class: 'roll-bg' });
  const head = h('div', { class: 'roll-head' });
  const label = h('span', { class: 'small muted grow' });
  const tools = h('div', { class: 'roll-tools hidden' },
    label,
    h('button', { class: 'icon', 'aria-label': 'Pitch down', onClick: () => nudge(-1) }, '▼'),
    h('button', { class: 'icon', 'aria-label': 'Pitch up', onClick: () => nudge(1) }, '▲'),
    h('button', { 'aria-label': 'Delete note', onClick: () => remove() }, '🗑 Delete'));
  inner.append(bg, head);
  scroller.append(inner);
  const el = h('div', { class: 'roll' }, scroller, tools);
  let lo = 48;
  let hi = 72;
  let stepW = 6;
  let selected: Note | null = null;

  function computeRange(): void {
    const ns = o.notes();
    if (ns.length === 0) {
      lo = 48;
      hi = 72;
      return;
    }
    lo = Math.min(...ns.map((n) => n.midi)) - 3;
    hi = Math.max(...ns.map((n) => n.midi)) + 3;
    while (hi - lo < 16) {
      lo--;
      hi++;
    }
  }

  function drawBackground(width: number, height: number, steps: number): void {
    bg.style.width = `${width}px`;
    bg.style.height = `${height}px`;
    const g = bg.getContext('2d');
    if (!g) return;
    const { dpr } = fitCanvas(bg);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const key = o.keyOf();
    const scale = key ? new Set(scaleOf(key)) : null;
    for (let m = lo; m <= hi; m++) {
      const y = (hi - m) * ROW;
      const inScale = scale?.has(((m % 12) + 12) % 12);
      g.fillStyle = isBlack(m) ? '#171a24' : '#1d2130';
      if (scale && inScale) g.fillStyle = isBlack(m) ? '#1f2433' : '#252a3b';
      g.fillRect(0, y, width, ROW);
      if (((m % 12) + 12) % 12 === 0) {
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.font = '8px system-ui';
        g.fillText(`C${Math.floor(m / 12) - 1}`, 2, y + ROW - 2);
      }
    }
    for (let s = 0; s <= steps; s += 4) {
      g.fillStyle = s % 16 === 0 ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.07)';
      g.fillRect(Math.round(s * stepW), 0, 1, height);
    }
  }

  function place(d: HTMLElement, n: Note): void {
    d.style.left = `${n.start * stepW}px`;
    d.style.width = `${Math.max(4, n.length * stepW - 1)}px`;
    d.style.top = `${(hi - n.midi) * ROW + 1}px`;
    d.style.height = `${ROW - 2}px`;
  }

  function render(): void {
    computeRange();
    const steps = o.steps();
    const avail = scroller.clientWidth || el.clientWidth || 320;
    const width = Math.max(avail, steps * 5);
    stepW = width / steps;
    const height = (hi - lo + 1) * ROW;
    inner.style.width = `${width}px`;
    inner.style.height = `${height}px`;
    drawBackground(width, height, steps);
    inner.querySelectorAll('.note').forEach((n) => n.remove());
    for (const n of o.notes()) {
      if (n.start >= steps) continue;
      const d = h('div', { class: `note${n === selected ? ' sel' : ''}`, style: `--c:${o.color}` });
      place(d, n);
      d.addEventListener('pointerdown', (e) => drag(e, n, d));
      inner.appendChild(d);
    }
    tools.classList.toggle('hidden', !selected || !o.notes().includes(selected));
    if (selected) label.textContent = `${NOTE_NAMES[((selected.midi % 12) + 12) % 12]}${Math.floor(selected.midi / 12) - 1}`;
  }

  function drag(e: PointerEvent, n: Note, d: HTMLElement): void {
    e.preventDefault();
    d.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const m0 = n.midi;
    let moved = false;
    const move = (ev: PointerEvent): void => {
      const m = Math.max(21, Math.min(108, m0 + Math.round((y0 - ev.clientY) / ROW)));
      if (m === n.midi) return;
      moved = true;
      o.edit(() => {
        n.midi = m;
        n.raw = undefined; // a manual edit wins over auto-snap
      });
      if (m < lo || m > hi) render();
      else place(d, n);
      o.audition(m);
    };
    const up = (): void => {
      d.removeEventListener('pointermove', move);
      d.removeEventListener('pointerup', up);
      d.removeEventListener('pointercancel', up);
      if (!moved) {
        selected = selected === n ? null : n;
        o.audition(n.midi);
      } else {
        selected = n;
      }
      render();
    };
    d.addEventListener('pointermove', move);
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
  }

  function nudge(dir: number): void {
    const n = selected;
    if (!n) return;
    o.edit(() => {
      n.midi = Math.max(21, Math.min(108, n.midi + dir));
      n.raw = undefined;
    });
    o.audition(n.midi);
    render();
  }

  function remove(): void {
    const n = selected;
    if (!n) return;
    o.edit((notes) => {
      const i = notes.indexOf(n);
      if (i >= 0) notes.splice(i, 1);
    });
    selected = null;
    render();
  }

  function setPlayhead(step: number): void {
    head.style.display = step < 0 ? 'none' : 'block';
    if (step >= 0) head.style.transform = `translateX(${step * stepW}px)`;
  }

  requestAnimationFrame(render);
  return { el, render, setPlayhead };
}

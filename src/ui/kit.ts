// Component builders (design spec C6): one place that knows each component's markup.
import { h, type Child } from './dom';
import { icon, type IconName } from './icons';
import { ILLUSTRATIONS, type Illustration } from './illustrations';

type Click = (e: MouseEvent) => void;

/** Main button ("arrow bar"): red label block + ink arrow square. One per screen. */
export function mainBtn(label: Child, onClick?: Click, o: { icon?: IconName; disabled?: boolean } = {}): HTMLButtonElement {
  return h('button', { type: 'button', class: 'btn', onClick, disabled: o.disabled },
    h('span', { class: 'btn-label' }, label),
    h('span', { class: 'btn-arrow', 'aria-hidden': 'true' }, icon(o.icon ?? 'next')));
}

export function setLabel(btn: HTMLButtonElement, label: string): void {
  const el = btn.querySelector('.btn-label');
  if (el) el.textContent = label;
}

/** Two-choice bar: [white alt][red main + arrow]. */
export function pairBtn(alt: string, onAlt: Click, main: string, onMain: Click): { el: HTMLElement; alt: HTMLButtonElement; main: HTMLButtonElement } {
  const a = h('button', { type: 'button', class: 'alt', onClick: onAlt }, alt);
  const m = h('button', { type: 'button', class: 'main', onClick: onMain },
    h('span', null, main), h('span', { class: 'btn-arrow', 'aria-hidden': 'true' }, icon('next')));
  return { el: h('div', { class: 'btn-pair' }, a, m), alt: a, main: m };
}

/** Secondary button: white, 2px ink border, no shadow. */
export function btn2(label: Child, onClick?: Click, iconName?: IconName): HTMLButtonElement {
  return h('button', { type: 'button', class: 'btn-2nd', onClick }, iconName ? icon(iconName, 20) : null, label);
}

export function iconBtn(name: IconName, label: string, onClick?: Click, o: { ghost?: boolean; size?: number } = {}): HTMLButtonElement {
  return h('button', { type: 'button', class: `icon-btn${o.ghost ? ' ghost' : ''}`, 'aria-label': label, onClick }, icon(name, o.size ?? 20));
}

export const backBtn = (onClick: Click, label = 'Back'): HTMLButtonElement => iconBtn('back', label, onClick);

export function link(label: Child, onClick?: Click, red = false): HTMLButtonElement {
  return h('button', { type: 'button', class: `link${red ? ' red' : ''}`, onClick }, label);
}

/** Chip: label style, 1.5px ink border. `pressed` makes it a toggle; `attn` is the red Fix look. */
export function chip(label: Child, onClick?: Click, o: { icon?: IconName; pressed?: boolean; attn?: boolean; tip?: boolean; lock?: boolean } = {}): HTMLElement {
  const cls = `chip${o.attn ? ' attn' : ''}${o.tip ? ' tip' : ''}`;
  const kids = [o.icon ? icon(o.icon, 16) : null, label, o.lock ? h('span', { class: 'lockb', 'aria-label': 'Pro' }, icon('lock', 12)) : null];
  if (!onClick) return h('span', { class: cls }, kids);
  return h('button', { type: 'button', class: cls, 'aria-pressed': o.pressed === undefined ? null : String(o.pressed), onClick }, kids);
}

export function setPressed(el: Element, on: boolean): void {
  el.setAttribute('aria-pressed', String(on));
}

/** iOS-style switch (red when on). */
export function toggle(checked: boolean, onChange: (on: boolean) => void, label: string): HTMLInputElement {
  const el = h('input', { type: 'checkbox', class: 'toggle', role: 'switch', checked, 'aria-label': label });
  el.addEventListener('change', () => onChange(el.checked));
  return el;
}

/** Slider with a square knob; the filled part is red. */
export function range(min: number, max: number, step: number, value: number, onInput: (v: number) => void, label: string): HTMLInputElement {
  const el = h('input', { type: 'range', class: 'range', min, max, step, value: String(value), 'aria-label': label });
  const fill = (): void => el.style.setProperty('--v', `${((Number(el.value) - min) / (max - min)) * 100}%`);
  el.addEventListener('input', () => { fill(); onInput(Number(el.value)); });
  fill();
  return el;
}

/** − value + with a small unit under the number. */
export function stepper(get: () => number, set: (v: number) => void, unit: string, label: string): { el: HTMLElement; refresh: () => void } {
  const val = h('div', { class: 'val', 'aria-live': 'polite' });
  const refresh = (): void => val.replaceChildren(String(Math.round(get())), h('small', null, unit));
  refresh();
  const step = (d: number): void => { set(Math.round(get()) + d); refresh(); };
  return {
    el: h('div', { class: 'stepper' },
      iconBtn('minus', `${label} down`, () => step(-1)), val, iconBtn('add', `${label} up`, () => step(1))),
    refresh,
  };
}

/** H1 title block: lines in Anton caps; one line may sit on the red highlight block. */
export function titleBlock(lines: string[], o: { hl?: number; sub?: Child; deco?: 'deco' | 'grille'; size?: 'h1' | 'h2' } = {}): HTMLElement {
  const words: Child[] = [];
  lines.forEach((line, i) => {
    if (i) words.push(h('br'));
    words.push(i === o.hl ? h('span', { class: 'hl' }, line) : line);
  });
  return h('div', { class: 'titleblock' },
    h('h1', { class: o.size ?? 'h1' }, words),
    o.sub ? h('p', { class: 'body' }, o.sub) : null,
    o.deco ? h('div', { class: o.deco, 'aria-hidden': 'true' }) : null);
}

/** An illustration from public/illustrations, at its size in points (decoration: alt=""). */
export function art(name: Illustration, scale = 1, cls = ''): HTMLImageElement {
  const [w, hgt] = ILLUSTRATIONS[name];
  return h('img', {
    class: `art ${cls}`.trim(), src: `illustrations/${name}.webp`, alt: '', decoding: 'async',
    width: Math.round(w * scale), height: Math.round(hgt * scale),
  });
}

/** The small logo: red square with five ink bars. */
export function mark(): HTMLElement {
  return h('span', { class: 'mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i'));
}

/** A row in a grouped settings list: title, optional subtitle, and a control or chevron at the end. */
export function listRow(title: string, end: Child, o: { sub?: string; onClick?: Click } = {}): HTMLElement {
  const kids = [h('b', null, title), h('span', { class: 'end' }, end), o.sub ? h('small', null, o.sub) : null];
  return o.onClick ? h('button', { type: 'button', class: 'lrow', onClick: o.onClick }, kids) : h('div', { class: 'lrow' }, kids);
}

/** Labelled group of list rows (Settings, sheets). */
export function group(label: string, ...rows: Child[]): HTMLElement {
  return h('section', { class: 'group' }, h('h2', { class: 'label' }, label), h('div', { class: 'listbox' }, rows));
}

// Tiny DOM helpers — no framework. Toasts, sheets and the two small dialogs (rename, confirm delete).
import { icon } from './icons';

export type Child = Node | string | number | false | null | undefined | Child[];
export type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.className = String(v);
      } else if (k === 'style') {
        el.setAttribute('style', String(v));
      } else if (k === 'value' || k === 'checked') {
        (el as unknown as Record<string, unknown>)[k] = v;
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** Replace an element's children (falsy children are skipped). */
export function fill(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

/** Segmented control (mist track, ink active segment). Returns the element and a setter. */
export function segmented<T extends string | number>(
  options: { value: T; label: string; locked?: boolean }[],
  active: T,
  onChange: (v: T) => void,
  name = '',
): { el: HTMLDivElement; set: (v: T) => void } {
  const buttons = options.map((o) =>
    h('button', { type: 'button', 'aria-pressed': String(o.value === active), onClick: () => onChange(o.value) }, o.label,
      o.locked ? h('span', { class: 'sr-only' }, ' (Pro)') : null));
  const set = (v: T): void => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === v)));
  return { el: h('div', { class: 'seg', role: 'group', 'aria-label': name || null }, buttons), set };
}

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
type ToastAction = { label: string; run: () => void };

/** Ink toast, one line, above the bottom bar. `action` adds red UNDO-style buttons (one or two). */
export function toast(msg: string, action?: ToastAction | ToastAction[], ms = 3000): void {
  toastEl?.remove();
  clearTimeout(toastTimer);
  const lifted = !!document.querySelector('.actionbar:not(.hidden), .part-actions');
  const actions = action ? (Array.isArray(action) ? action : [action]) : [];
  const el = h('div', { class: `toast${lifted ? ' lifted' : ''}${actions.length > 1 ? ' two' : ''}`, role: 'status' }, h('span', null, msg));
  for (const a of actions) el.appendChild(h('button', { type: 'button', onClick: () => { a.run(); el.remove(); } }, a.label));
  document.body.appendChild(el);
  toastEl = el;
  toastTimer = window.setTimeout(() => el.remove(), actions.length ? ms + 2000 : ms);
}

/** Bottom sheet: paper, grabber, H2 title, content. Returns a close function. */
export function sheet(content: HTMLElement, onClose?: () => void, title?: string): () => void {
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 200);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title ?? null },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    title ? h('div', { class: 'sheet-top' }, h('h2', { class: 'h2' }, title),
      h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'Close', onClick: () => close() }, icon('close', 22))) : null,
    content);
  const wrap = h('div', { class: 'sheet-wrap', onClick: (e: Event) => { if (e.target === wrap) close(); } }, box);
  dragToClose(box, close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  return close;
}

/** Swipe the grabber area down to dismiss. */
function dragToClose(box: HTMLElement, close: () => void): void {
  let y0 = -1;
  box.addEventListener('pointerdown', (e) => {
    const top = box.getBoundingClientRect().top;
    if (box.scrollTop > 0 || e.clientY - top > 56) return;
    y0 = e.clientY;
  });
  box.addEventListener('pointermove', (e) => {
    if (y0 < 0) return;
    const dy = Math.max(0, e.clientY - y0);
    box.style.transform = `translateY(${dy}px)`;
  });
  const end = (e: PointerEvent): void => {
    if (y0 < 0) return;
    const dy = e.clientY - y0;
    y0 = -1;
    box.style.transform = '';
    if (dy > 90) close();
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Text prompt in a bottom sheet (rename). Resolves null when dismissed. */
export function ask(title: string, value: string, ok = 'Save', label = 'Name'): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const id = `f${Math.random().toString(36).slice(2, 8)}`;
    const input = h('input', { id, type: 'text', class: 'field', value, maxlength: 60, autocomplete: 'off' });
    const finish = (v: string | null): void => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const form = h('form', { class: 'stack' },
      h('label', { class: 'label', for: id }, label), input,
      h('button', { type: 'submit', class: 'btn' }, h('span', { class: 'btn-label' }, ok), h('span', { class: 'btn-arrow', 'aria-hidden': 'true' }, icon('done'))),
      h('button', { type: 'button', class: 'btn-2nd', onClick: () => finish(null) }, 'Cancel'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(input.value.trim() || null);
    });
    const close = sheet(form, () => { if (!done) { done = true; resolve(null); } }, title);
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

/** Small confirm sheet: the red button first, then Cancel. Only for deleting. */
export function confirmSheet(message: string, ok: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean): void => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const close = sheet(h('div', { class: 'stack' },
      h('button', { type: 'button', class: danger ? 'btn-del' : 'btn-2nd', onClick: () => finish(true) }, ok),
      h('button', { type: 'button', class: 'btn-2nd', onClick: () => finish(false) }, 'Cancel')),
    () => { if (!done) { done = true; resolve(false); } }, message);
  });
}

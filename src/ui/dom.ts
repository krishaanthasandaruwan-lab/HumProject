// Tiny DOM helpers — no framework.
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

/** Segmented control. Returns the element and a setter for the active value. */
export function segmented<T extends string | number>(
  options: { value: T; label: string; locked?: boolean }[],
  active: T,
  onChange: (v: T) => void,
): { el: HTMLDivElement; set: (v: T) => void } {
  const buttons = options.map((o) =>
    h('button', { type: 'button', class: o.value === active ? 'on' : '', onClick: () => onChange(o.value) }, o.label, o.locked ? ' 🔒' : ''),
  );
  const set = (v: T): void => buttons.forEach((b, i) => b.classList.toggle('on', options[i].value === v));
  return { el: h('div', { class: 'seg' }, buttons), set };
}

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
export function toast(msg: string, action?: { label: string; run: () => void }, ms = 2800): void {
  toastEl?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, msg));
  if (action) {
    el.appendChild(h('button', { class: 'link', onClick: () => { action.run(); el.remove(); } }, action.label));
  }
  document.body.appendChild(el);
  toastEl = el;
  toastTimer = window.setTimeout(() => el.remove(), action ? ms + 2200 : ms);
}

/** Bottom sheet modal. Returns a close function. */
export function sheet(content: HTMLElement, onClose?: () => void): () => void {
  const close = (): void => { wrap.remove(); onClose?.(); };
  const wrap = h('div', { class: 'sheet-wrap', onClick: (e: Event) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet' }, h('div', { class: 'sheet-grip' }), content));
  document.body.appendChild(wrap);
  return close;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Text prompt in a bottom sheet. Resolves null when dismissed. */
export function ask(title: string, value: string, ok = 'Save'): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input', { type: 'text', value, maxlength: 60 });
    const finish = (v: string | null): void => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const form = h('form', { class: 'stack' }, h('h2', null, title), input,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'grow', onClick: () => finish(null) }, 'Cancel'),
        h('button', { type: 'submit', class: 'primary grow' }, ok)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      finish(v || null);
    });
    const close = sheet(form, () => { if (!done) { done = true; resolve(null); } });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

/** Yes/no in a bottom sheet. */
export function confirmSheet(message: string, ok: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean): void => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const close = sheet(h('div', { class: 'stack' }, h('h2', null, message),
      h('div', { class: 'row' },
        h('button', { class: 'grow', onClick: () => finish(false) }, 'Cancel'),
        h('button', { class: `grow ${danger ? 'danger' : 'primary'}`, onClick: () => finish(true) }, ok))),
    () => { if (!done) { done = true; resolve(false); } });
  });
}

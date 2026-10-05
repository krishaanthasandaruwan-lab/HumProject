// Modal keyboard/VoiceOver containment, including iOS 15 before native inert support.
const stack: { box: HTMLElement; wrap: HTMLElement }[] = [];
const originals = new Map<HTMLElement, { aria: string | null; inert: boolean }>();
const controls = (box: HTMLElement): HTMLElement[] => [...box.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
  .filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0);
function backgrounds(): void {
  for (const [el, original] of originals) {
    if (original.aria === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', original.aria);
    el.toggleAttribute('inert', original.inert);
  }
  originals.clear();
  const top = stack[stack.length - 1];
  if (!top) return;
  for (const el of [...document.body.children]) {
    if (!(el instanceof HTMLElement) || el === top.wrap || el.tagName === 'SCRIPT') continue;
    originals.set(el, { aria: el.getAttribute('aria-hidden'), inert: el.hasAttribute('inert') });
    el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', '');
  }
}
export function containModal(box: HTMLElement, wrap: HTMLElement, close: () => void): () => void {
  const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const entry = { box, wrap };
  stack.push(entry);
  box.tabIndex = -1;
  (controls(box)[0] ?? box).focus();
  backgrounds();
  const key = (event: KeyboardEvent): void => {
    if (stack[stack.length - 1] !== entry) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const items = controls(box);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length || (event.shiftKey ? at <= 0 : at < 0 || at === items.length - 1)) {
      event.preventDefault();
      (event.shiftKey ? items[items.length - 1] : items[0] ?? box)?.focus();
    }
  };
  const focus = (event: FocusEvent): void => {
    if (stack[stack.length - 1] === entry && !box.contains(event.target as Node)) (controls(box)[0] ?? box).focus();
  };
  document.addEventListener('keydown', key, true);
  document.addEventListener('focusin', focus);
  window.addEventListener('humm:navigate', close);
  return () => {
    document.removeEventListener('keydown', key, true);
    document.removeEventListener('focusin', focus);
    window.removeEventListener('humm:navigate', close);
    stack.splice(stack.indexOf(entry), 1);
    backgrounds();
    const previous = stack[stack.length - 1];
    if (origin?.isConnected && (!previous || previous.box.contains(origin))) origin.focus();
    else previous?.box.focus();
  };
}

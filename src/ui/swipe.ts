// Swipe left to delete: a short swipe shows a red Delete button behind the row, a long one deletes
// right away. Vertical scrolling still works (the row only takes sideways moves), and a swipe never
// counts as a tap on the row.
import { h } from './dom';
import { icon } from './icons';

const REVEAL = 88;

export function swipeToDelete(row: HTMLElement, onDelete: () => void, label: string): HTMLElement {
  const del = h('button', { type: 'button', class: 'swipe-del', 'aria-label': label, tabindex: '-1', onClick: () => onDelete() }, icon('delete', 20), h('span', null, 'Delete'));
  const wrap = h('div', { class: 'swipe' }, del, row);
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let base = 0;
  let mode: 'idle' | 'maybe' | 'swipe' | 'scroll' = 'idle';
  let swiped = false;

  const place = (x: number, animate: boolean): void => {
    row.style.transition = animate ? 'transform 200ms cubic-bezier(.2,.8,.2,1)' : 'none';
    row.style.transform = x ? `translateX(${x}px)` : '';
    wrap.classList.toggle('open', x < 0);
  };
  row.style.touchAction = 'pan-y';
  row.addEventListener('pointerdown', (e) => {
    // A slider in the row (volume) slides; it never swipes the row away.
    if ((e.target as HTMLElement).closest('input')) {
      mode = 'idle';
      return;
    }
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
    mode = 'maybe';
    swiped = false;
  });
  row.addEventListener('pointermove', (e) => {
    if (mode === 'idle' || mode === 'scroll') return;
    const mx = e.clientX - x0;
    const my = e.clientY - y0;
    if (mode === 'maybe') {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { mode = 'scroll'; return; }
      if (Math.abs(mx) < 10) return;
      mode = 'swipe';
      row.setPointerCapture(e.pointerId);
    }
    dx = Math.min(0, base + mx);
    place(dx, false);
  });
  const end = (): void => {
    if (mode === 'swipe') {
      swiped = true;
      if (dx < -row.offsetWidth * 0.55) {
        place(-row.offsetWidth, true);
        setTimeout(onDelete, 180);
      } else {
        base = dx < -REVEAL / 2 ? -REVEAL : 0;
        place(base, true);
      }
    }
    mode = 'idle';
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  // A swipe is not a tap on the row; a tap while the button shows just closes it.
  row.addEventListener('click', (e) => {
    if (!swiped && !base) return;
    e.stopPropagation();
    e.preventDefault();
    if (!swiped) { base = 0; place(0, true); }
    swiped = false;
  }, true);
  return wrap;
}

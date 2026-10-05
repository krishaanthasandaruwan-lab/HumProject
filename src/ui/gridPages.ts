import { h } from './dom';
import { iconBtn } from './kit';

/** Page by whole bar sets. Reuse the controls so an arrow never opens a keyboard. */
export function gridPages(bars: () => number, render: () => void, size: () => number = () => 8) {
  let start = 0;
  let playingPage = -1;
  const bounds = (): [number, number] => {
    start = Math.max(0, Math.min(start, Math.floor((bars() - 1) / size()) * size()));
    return [start, Math.min(bars(), start + size())];
  };
  const show = (bar: number): void => { start = Math.floor(bar / size()) * size(); bounds(); };
  const move = (delta: number, button: HTMLButtonElement): void => {
    show(start + delta * size());
    render();
    control();
    (button.disabled ? button === next ? previous : next : button).focus({ preventScroll: true });
  };
  const previous = iconBtn('back', 'Previous bar set', () => move(-1, previous));
  const next = iconBtn('next', 'Next bar set', () => move(1, next));
  const label = h('span', { class: 'label', 'aria-live': 'polite' });
  const nav = h('nav', { class: 'grid-pages', 'aria-label': 'Song bar sets' }, previous, label, next);
  function control(always = false): HTMLElement | null {
    const [first, last] = bounds();
    previous.disabled = first === 0;
    next.disabled = last === bars();
    label.textContent = `Set ${first / size() + 1}/${Math.ceil(bars() / size())} · Bars ${first + 1}–${last}`;
    return always || bars() > size() ? nav : null;
  }
  return {
    bounds, control, show,
    follow(step: number) {
      const next = step < 0 ? -1 : Math.floor(step / (size() * 16)) * size();
      // Browsing while playing stays put until playback enters another set (or restarts).
      if (next === playingPage) return false;
      playingPage = next;
      if (next < 0 || next === start) return false;
      show(next);
      return true;
    },
  };
}

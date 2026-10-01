// "What music do you like?": asked once on first launch (and changeable in Settings). The answer
// shapes which three songs HUMM offers after a hum (model/variety.ts).
import '../styles/taste.css';
import { navigate } from '../router';
import { settings, updateSettings } from '../settings';
import { h, sheet } from './dom';
import { icon } from './icons';
import { link, mainBtn, titleBlock } from './kit';
import { styleIcon } from './parts';

export const TASTES: { id: string; label: string }[] = [
  { id: 'chill', label: 'Chill' }, { id: 'pop', label: 'Pop' }, { id: 'trap', label: 'Hip-hop' },
  { id: 'dance', label: 'Dance' }, { id: 'band', label: 'Band' }, { id: 'cinema', label: 'Cinematic' },
];

export function tasteSummary(): string {
  const likes = settings().likes;
  return likes.length ? TASTES.filter((t) => likes.includes(t.id)).map((t) => t.label).join(', ') : 'Anything';
}

/** Six square tiles, any number selected. */
function tasteGrid(): { el: HTMLElement; picked: () => string[] } {
  const on = new Set(settings().likes);
  const tiles = TASTES.map((t) => {
    const b = h('button', { type: 'button', class: 'taste', 'aria-pressed': String(on.has(t.id)) },
      icon(styleIcon(t.id), 28), h('span', { class: 'label' }, t.label));
    b.addEventListener('click', () => {
      if (on.has(t.id)) on.delete(t.id);
      else on.add(t.id);
      b.setAttribute('aria-pressed', String(on.has(t.id)));
    });
    return b;
  });
  return { el: h('div', { class: 'taste-grid', role: 'group', 'aria-label': 'Music I like' }, tiles), picked: () => TASTES.map((t) => t.id).filter((id) => on.has(id)) };
}

export function openTaste(onDone?: () => void): void {
  const grid = tasteGrid();
  const close = sheet(h('div', { class: 'stack' },
    h('p', { class: 'body muted' }, 'Pick any. Your three songs lean this way.'),
    grid.el,
    mainBtn('Done', () => {
      updateSettings({ likes: grid.picked(), tasteAsked: true });
      close();
      onDone?.();
    }, { icon: 'done' })),
  undefined, 'Music I like');
}

/** First launch: one question before the mic. */
export function mountWelcome(root: HTMLElement): () => void {
  const grid = tasteGrid();
  const done = (likes: string[]): void => {
    updateSettings({ likes, tasteAsked: true });
    navigate('hum');
  };
  root.append(h('div', { class: 'screen welcome' },
    h('header', { class: 'top' }, h('span'), link('Skip', () => done([]))),
    titleBlock(['What music', 'do you like?'], { hl: 1, sub: 'Pick any. HUMM makes your songs this way.' }),
    grid.el,
    h('div', { class: 'action' }, mainBtn('Next', () => done(grid.picked())))));
  return () => undefined;
}

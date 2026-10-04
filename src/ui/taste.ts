// "What music do you like?": asked once on first launch (and changeable in Settings). The answer
// shapes which three songs HUMM offers after a hum (model/variety.ts).
import '../styles/taste.css';
import { canSignIn } from '../account';
import { navigate } from '../router';
import { settings, updateSettings } from '../settings';
import { h, sheet } from './dom';
import { icon } from './icons';
import { link, mainBtn, titleBlock } from './kit';
import { styleIcon } from './parts';
import { afterTaste } from './signin';

export const TASTES: { id: string; label: string }[] = [
  { id: 'pop', label: 'Pop' }, { id: 'trap', label: 'Hip-hop' }, { id: 'rnb', label: 'R&B' }, { id: 'chill', label: 'Chill' },
  { id: 'dance', label: 'Dance' }, { id: 'edm', label: 'EDM' }, { id: 'rock', label: 'Rock' }, { id: 'band', label: 'Band' },
  { id: 'afro', label: 'Afrobeat' }, { id: 'reggaeton', label: 'Reggaeton' }, { id: 'reggae', label: 'Reggae' }, { id: 'funk', label: 'Funk' },
  { id: 'jazz', label: 'Jazz' }, { id: 'ballad', label: 'Ballads' }, { id: 'folk', label: 'Folk' }, { id: 'cinema', label: 'Cinematic' },
  { id: 'drill', label: 'Drill' }, { id: 'garage', label: 'Garage' }, { id: 'synthwave', label: 'Synthwave' }, { id: 'ambient', label: 'Ambient' },
];

export function tasteSummary(): string {
  const likes = settings().likes;
  return likes.length ? TASTES.filter((t) => likes.includes(t.id)).map((t) => t.label).join(', ') : 'Anything';
}

/** One square tile per style, any number selected. */
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
    navigate(afterTaste(canSignIn(), settings().signInAsked));
  };
  root.append(h('div', { class: 'screen welcome' },
    h('header', { class: 'top' }, h('span'), link('Skip', () => done([]))),
    titleBlock(['What music', 'do you like?'], { hl: 1, sub: 'Pick any. HUMM makes your songs this way.' }),
    grid.el,
    h('div', { class: 'action' }, mainBtn('Next', () => done(grid.picked())))));
  return () => undefined;
}

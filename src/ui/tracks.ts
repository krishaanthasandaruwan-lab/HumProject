// The Tracks screen: every part across the whole song, always in landscape. In the apps the screen is
// locked to landscape while it is open; elsewhere (or if the lock isn't possible) a phone held upright
// shows the page turned a quarter. The Studio stays the simple main screen.
import '../styles/timeline.css';
import { Capacitor } from '@capacitor/core';
import { player } from '../app';
import { keyName } from '../dsp/key';
import { totalSteps } from '../model/project';
import { navigate } from '../router';
import { getProject } from '../state';
import { h } from './dom';
import { backBtn } from './kit';
import { timeline } from './timeline';
import { playSquare } from './transport';

type Orientation = typeof import('@capacitor/screen-orientation');
const orientation = (): Promise<Orientation | null> =>
  Capacitor.isNativePlatform() ? import('@capacitor/screen-orientation').catch(() => null) : Promise.resolve(null);

export function mountTracks(root: HTMLElement): () => void {
  const p = getProject();
  if (!p.tracks.length) {
    navigate('studio');
    return () => undefined;
  }
  let alive = true;
  let raf = 0;
  const play = playSquare();
  const table = timeline(() => undefined);
  const meta = [`${Math.round(p.bpm)} BPM`, p.key ? keyName(p.key) : null, `${p.bars} bars`].filter(Boolean).join(' · ');
  const loading = h('div', { class: 'tracks-loading', role: 'status' }, h('div', { class: 'spinner' }), h('span', { class: 'sr-only' }, 'Loading tracks'));
  const screen = h('div', { class: 'screen tracks fixed' },
    h('header', { class: 'top' },
      backBtn(() => navigate('studio'), 'Studio'),
      h('div', { class: 'tracks-title' }, h('h1', { class: 'h3' }, p.name), h('p', { class: 'label muted' }, meta)),
      play.el),
    loading);
  root.append(screen);

  // Landscape only: lock the app's screen where we can; otherwise turn the page on a phone held upright.
  const upright = matchMedia('(orientation: portrait) and (max-width: 600px)');
  const turn = (): void => {
    screen.classList.toggle('turned', upright.matches);
    document.body.classList.toggle('ui-turned', upright.matches); // sheets and messages turn with the page
  };
  turn();
  upright.addEventListener('change', turn);
  void orientation().then((o) => (alive ? o?.ScreenOrientation.lock({ orientation: 'landscape' }) : undefined)).catch(() => undefined);

  // Show the spinner first, then draw the table (one canvas per part) on the next frame.
  requestAnimationFrame(() => setTimeout(() => {
    if (!alive) return;
    loading.replaceWith(table.el);
    table.refresh();
  }, 0));

  const frame = (): void => {
    play.sync();
    const step = player.currentStep();
    table.setPlayhead(step < 0 ? -1 : step % totalSteps(getProject()));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    upright.removeEventListener('change', turn);
    document.body.classList.remove('ui-turned');
    table.dispose();
    void orientation().then((o) => o?.ScreenOrientation.unlock()).catch(() => undefined);
  };
}

// The tracks table, full screen (opened from the Studio's Tracks button): every part across the bars,
// for people who want to see the whole song at once. The Studio stays the simple main screen.
import '../styles/timeline.css';
import { player } from '../app';
import { keyName } from '../dsp/key';
import { totalSteps } from '../model/project';
import { navigate } from '../router';
import { getProject } from '../state';
import { h } from './dom';
import { backBtn } from './kit';
import { timeline } from './timeline';
import { playSquare } from './transport';

export function mountTracks(root: HTMLElement): () => void {
  const p = getProject();
  if (!p.tracks.length) {
    navigate('studio');
    return () => undefined;
  }
  const play = playSquare();
  const table = timeline(() => undefined);
  const meta = [`${Math.round(p.bpm)} BPM`, p.key ? keyName(p.key) : null, `${p.bars} bars`].filter(Boolean).join(' · ');
  root.append(h('div', { class: 'screen tracks fixed' },
    h('header', { class: 'top' },
      backBtn(() => navigate('studio'), 'Studio'),
      h('div', { class: 'tracks-title' }, h('h1', { class: 'h3' }, p.name), h('p', { class: 'label muted' }, meta)),
      play.el),
    table.el));
  requestAnimationFrame(() => table.refresh());

  let raf = 0;
  const frame = (): void => {
    play.sync();
    const step = player.currentStep();
    table.setPlayhead(step < 0 ? -1 : step % totalSteps(getProject()), player.playing);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    table.dispose();
  };
}

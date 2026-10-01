// 04 · Studio: hear the song, change it, finish it. Song name on top, the tracks timeline in the
// middle, and the bar (Record · Mix · Play · Song · Share) at the bottom — or on the right when
// the phone is held sideways.
import '../styles/studio.css';
import '../styles/timeline.css';
import { player } from '../app';
import { keyName } from '../dsp/key';
import { demoProject } from '../model/demo';
import { totalSteps, type TrackKind } from '../model/project';
import { navigate, type Params } from '../router';
import { edit, getProject, setProject } from '../state';
import { ask, h, toast } from './dom';
import { openExport } from './export';
import { icon, type IconName } from './icons';
import { art, backBtn, btn2, iconBtn, link, mainBtn } from './kit';
import { openMixer } from './mixer';
import { openSongSheet } from './songSheet';
import { timeline } from './timeline';
import { playSquare, togglePlay } from './transport';

export function mountStudio(root: HTMLElement, params: Params): () => void {
  const p = getProject;
  let raf = 0;
  let alive = true;

  const name = h('span', { class: 'nm' });
  const title = h('button', { type: 'button', class: 'songname', 'aria-label': 'Rename song', onClick: () => void rename() }, name, icon('rename', 16));
  const meta = h('p', { class: 'studio-meta label' });
  const tracks = timeline(() => undefined);
  const body = h('div', { class: 'studio-body' });
  const play = playSquare();
  const slot = (ic: IconName, label: string, go: () => void): HTMLButtonElement =>
    h('button', { type: 'button', class: 'slot', onClick: go }, icon(ic, 24), h('span', { class: 'caption' }, label));
  const bar = h('nav', { class: 'actionbar', 'aria-label': 'Song' },
    slot('record', 'Record', () => navigate('record', { kind: nextKind() })),
    slot('mix', 'Mix', () => openMixer(() => refresh())),
    h('div', { class: 'slot' }, play.el, h('span', { class: 'caption' }, 'Play')),
    slot('settings', 'Song', () => openSongSheet(() => refresh())),
    slot('share', 'Share', () => { player.stop(); openExport(); }));

  root.classList.add('with-bar');
  root.append(h('div', { class: 'screen studio fixed' },
    h('header', { class: 'top' },
      backBtn(() => navigate('projects'), 'My songs'),
      title,
      iconBtn('settings', 'Settings', () => navigate('settings', { back: 'studio' }), { ghost: true })),
    meta, body));
  document.body.append(bar);
  refresh();
  if (params.focus) requestAnimationFrame(() => tracks.focus(params.focus));

  function refresh(): void {
    name.textContent = p().name;
    const k = p().key;
    meta.textContent = [`${Math.round(p().bpm)} BPM`, k ? keyName(k) : null, `${p().bars} bars`].filter(Boolean).join(' · ');
    if (tracks.empty()) {
      bar.classList.add('hidden');
      body.replaceChildren(h('div', { class: 'studio-empty' },
        art('ill-11-live'),
        h('p', { class: 'body' }, 'Your mouth is the whole band'),
        mainBtn('Record', () => navigate('record', { kind: 'drums' }), { icon: 'record' }),
        btn2('Hear a demo', () => loadDemo(), 'headphones'),
        link('Import', () => navigate('record', { kind: 'lead', import: '1' }))));
      return;
    }
    bar.classList.remove('hidden');
    body.replaceChildren(tracks.el);
    tracks.refresh();
  }

  const nextKind = (): TrackKind =>
    (['drums', 'bass', 'lead'] as TrackKind[]).find((k) => !p().tracks.some((t) => t.kind === k && ((t.hits?.length ?? 0) + (t.notes?.length ?? 0)) > 0)) ?? 'drums';

  async function rename(): Promise<void> {
    const n = await ask('Rename song', p().name);
    if (!n || !alive) return;
    edit((pp) => { pp.name = n; });
    name.textContent = n;
  }

  function loadDemo(): void {
    player.stop();
    setProject(demoProject());
    refresh();
    void togglePlay();
    toast('Demo loaded');
  }

  function frame(): void {
    play.sync();
    const step = player.currentStep();
    tracks.setPlayhead(step < 0 ? -1 : step % totalSteps(p()), player.playing);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    player.stop();
    tracks.dispose();
    bar.remove();
    root.classList.remove('with-bar');
  };
}

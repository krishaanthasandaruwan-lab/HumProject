// 04 · Studio: hear the song, change it, finish it. Song name, song chips, the song map, the parts list
// and the bottom bar (Mix · Record · Play · Add · Share).
import '../styles/studio.css';
import { player } from '../app';
import { keyName } from '../dsp/key';
import { demoProject } from '../model/demo';
import { STEPS_PER_BAR, totalSteps, type TrackKind } from '../model/project';
import { navigate } from '../router';
import { edit, getProject, setProject } from '../state';
import { ask, h, toast } from './dom';
import { openExport } from './export';
import { icon, type IconName } from './icons';
import { art, backBtn, btn2, chip, iconBtn, link, mainBtn } from './kit';
import { openAddPart } from './addPart';
import { openMixer } from './mixer';
import { partList } from './partRows';
import { openSongSheet } from './songSheet';
import { playSquare, togglePlay } from './transport';

export function mountStudio(root: HTMLElement): () => void {
  const p = getProject;
  let raf = 0;
  let alive = true;

  const name = h('span');
  const renderName = (): void => { name.textContent = p().name; };
  const title = h('button', { type: 'button', class: 'songname h2', 'aria-label': 'Rename song', onClick: () => void rename() }, name, icon('rename', 18));
  const songChips = h('div', { class: 'chips' });
  const map = h('div', { class: 'songmap', 'aria-hidden': 'true' });
  const playhead = h('span', { class: 'playhead' });
  const parts = partList(() => renderMap());
  const body = h('div', { class: 'studio-body' });
  const play = playSquare();
  const slot = (ic: IconName, label: string, go: () => void): HTMLButtonElement =>
    h('button', { type: 'button', class: 'slot', onClick: go }, icon(ic, 24), h('span', { class: 'caption' }, label));
  const bar = h('nav', { class: 'actionbar', 'aria-label': 'Song actions' },
    slot('record', 'Record', () => navigate('record', { kind: nextKind() })),
    slot('mix', 'Mix', () => openMixer(() => refresh())),
    h('div', { class: 'slot' }, play.el, h('span', { class: 'caption' }, 'Play')),
    slot('add', 'Add', () => openAddPart(() => refresh())),
    slot('share', 'Share', () => { player.stop(); openExport(); }));

  root.classList.add('with-bar');
  root.append(h('div', { class: 'screen studio' },
    h('header', { class: 'top' },
      backBtn(() => navigate('projects'), 'My songs'),
      iconBtn('settings', 'Settings', () => navigate('settings', { back: 'studio' }), { ghost: true })),
    title, songChips, body));
  document.body.append(bar);
  refresh();

  function refresh(): void {
    renderName();
    const k = p().key;
    const open = (): void => openSongSheet(() => refresh());
    songChips.replaceChildren(
      chip(`${Math.round(p().bpm)} BPM`, open),
      chip(k ? keyName(k) : 'Key: auto', open),
      chip(`${p().bars} bars`, open));
    parts.refresh();
    if (parts.empty()) {
      bar.classList.add('hidden');
      body.replaceChildren(h('div', { class: 'studio-empty' },
        art('ill-11-live'),
        h('p', { class: 'body' }, 'Your mouth is the whole band'),
        mainBtn('Record', () => navigate('record', { kind: 'drums' }), { icon: 'record' }),
        btn2('Hear a demo', () => loadDemo(), 'headphones'),
        link('Import', () => navigate('record', { kind: 'lead', import: '1' }))));
    } else {
      bar.classList.remove('hidden');
      renderMap();
      body.replaceChildren(map, parts.el);
    }
  }

  function renderMap(): void {
    const bars = p().bars;
    map.replaceChildren(...Array.from({ length: bars }, (_, i) => h('span', { class: 'blk' }, String(i + 1))), playhead);
  }

  const nextKind = (): TrackKind =>
    (['drums', 'bass', 'lead'] as TrackKind[]).find((k) => !p().tracks.some((t) => t.kind === k && ((t.hits?.length ?? 0) + (t.notes?.length ?? 0)) > 0)) ?? 'drums';

  async function rename(): Promise<void> {
    const n = await ask('Rename song', p().name);
    if (!n || !alive) return;
    edit((pp) => { pp.name = n; });
    renderName();
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
    playhead.style.display = step < 0 ? 'none' : 'block';
    if (step >= 0) playhead.style.left = `${(step / totalSteps(p())) * 100}%`;
    const barNo = step < 0 ? -1 : Math.floor(step / STEPS_PER_BAR);
    map.querySelectorAll('.blk').forEach((b, i) => b.classList.toggle('now', i === barNo));
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    player.stop();
    bar.remove();
    root.classList.remove('with-bar');
  };
}

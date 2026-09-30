// Studio: transport (play, tempo, bars, key) and one card per track.
import '../styles/studio.css';
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { keyName } from '../dsp/key';
import { demoProject } from '../model/demo';
import { getTrack, type TrackKind } from '../model/project';
import { navigate, type Params } from '../router';
import { edit, getProject, setProject } from '../state';
import { append, h, segmented, toast } from './dom';
import { drumsCard, melodicCard, type TrackCard } from './tracks';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));

export function mountStudio(root: HTMLElement, params: Params): () => void {
  const p = getProject;
  let raf = 0;

  const playBtn = h('button', { class: 'play', 'aria-label': 'Play', onClick: () => void togglePlay() }, '▶');
  const bpmVal = h('div', { class: 'val' }, String(p().bpm));
  const setBpm = (v: number): void => {
    edit((pp) => { pp.bpm = clampBpm(v); });
    bpmVal.textContent = String(p().bpm);
  };
  const barsSeg = segmented<2 | 4 | 8>(
    [{ value: 2, label: '2' }, { value: 4, label: '4' }, { value: 8, label: '8' }],
    p().bars,
    (v) => {
      edit((pp) => { pp.bars = v; });
      barsSeg.set(v);
      cards.forEach((c) => c.refresh());
    },
  );
  const keyChip = h('span', { class: 'chip' });
  const renderMeta = (): void => {
    const k = p().key;
    keyChip.replaceChildren('Key ', h('b', null, k ? keyName(k) : 'auto'));
  };
  renderMeta();

  const cards: TrackCard[] = [drumsCard(), melodicCard('bass'), melodicCard('lead')];
  const cardKinds: TrackKind[] = ['drums', 'bass', 'lead'];
  const isEmpty = !p().tracks.some((t) => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0);
  const nextKind = (): TrackKind => (['drums', 'bass', 'lead'] as TrackKind[]).find((k) => !getTrack(p(), k)?.hits?.length && !getTrack(p(), k)?.notes?.length) ?? 'drums';

  append(root, [
    h('header', { class: 'topbar' },
      h('h1', null, p().name),
      h('button', { class: 'icon ghost', 'aria-label': 'Settings', onClick: () => navigate('settings') }, '⚙︎')),
    h('div', { class: 'card' },
      h('div', { class: 'transport' },
        playBtn,
        h('div', { class: 'grow' },
          h('div', { class: 'stepper' },
            h('button', { class: 'icon', 'aria-label': 'Slower', onClick: () => setBpm(p().bpm - 1) }, '−'),
            h('div', null, bpmVal, h('div', { class: 'bpm-lbl' }, 'BPM')),
            h('button', { class: 'icon', 'aria-label': 'Faster', onClick: () => setBpm(p().bpm + 1) }, '+'))),
        h('div', { style: 'width:120px' }, barsSeg.el, h('div', { class: 'bpm-lbl', style: 'margin-top:4px' }, 'bars'))),
      h('div', { class: 'meta-row' }, keyChip)),
    isEmpty
      ? h('div', { class: 'card empty' },
        h('div', { class: 'big-emoji' }, '🎤'),
        h('p', null, h('b', null, 'Your mouth is the whole band.')),
        h('p', { class: 'muted small' }, 'Beatbox the drums, hum the bass, whistle the melody. Or hear the demo first.'),
        h('button', { onClick: () => loadDemo() }, '🎧 Load the demo song'))
      : null,
    cards.map((c) => c.el),
    h('div', { class: 'actionbar' },
      h('button', { class: 'rec big', onClick: () => navigate('record', { kind: nextKind() }) }, '🎙  Record')),
  ]);

  if (params.focus) {
    const i = cardKinds.indexOf(params.focus as TrackKind);
    if (i >= 0) requestAnimationFrame(() => cards[i].el.scrollIntoView({ block: 'center' }));
  }

  function loadDemo(): void {
    player.stop();
    setProject(demoProject());
    navigate('studio');
    toast('Demo loaded — press play');
  }

  async function togglePlay(): Promise<void> {
    await unlockAudio();
    if (player.playing) player.stop();
    else player.start();
  }

  function frame(): void {
    playBtn.classList.toggle('on', player.playing);
    playBtn.textContent = player.playing ? '■' : '▶';
    const step = player.currentStep();
    cards.forEach((c) => c.setPlayhead(step));
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    player.stop();
  };
}

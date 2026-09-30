// Studio: transport, tempo/bars, and one card per track (Phase 2: the drum grid).
import '../styles/studio.css';
import { auditionDrum, player } from '../app';
import { unlockAudio } from '../audio/context';
import { demoProject } from '../model/demo';
import { getTrack, newTrack, putTrack, type DrumHit, type Track } from '../model/project';
import { navigate } from '../router';
import { edit, getProject, setProject } from '../state';
import { KITS } from '../synth/kits';
import { h, segmented, toast } from './dom';
import { drumGrid } from './grid';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));

export function mountStudio(root: HTMLElement): () => void {
  const p = getProject;
  let raf = 0;

  const drums = (): Track | undefined => getTrack(p(), 'drums');
  const ensureDrums = (): Track => {
    let t = drums();
    if (!t) {
      t = newTrack('drums');
      putTrack(p(), t);
    }
    return t;
  };

  // --- transport ---
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
      grid.render();
    },
  );

  // --- drums ---
  const grid = drumGrid({
    hits: () => drums()?.hits ?? [],
    bars: () => p().bars,
    edit: (fn: (hits: DrumHit[]) => void) => edit(() => fn((ensureDrums().hits ??= []))),
    audition: (type, v) => auditionDrum(type, drums()?.preset ?? '808', v),
  });
  const kitButtons = KITS.map((k) =>
    h('button', {
      type: 'button',
      class: (drums()?.preset ?? '808') === k.id ? 'on' : '',
      onClick: () => {
        edit(() => { ensureDrums().preset = k.id; });
        kitButtons.forEach((b, i) => b.classList.toggle('on', KITS[i].id === k.id));
        auditionDrum('kick', k.id);
      },
    }, k.name),
  );

  const title = h('h1', null, p().name);
  root.append(
    h('header', { class: 'topbar' }, title),
    h('div', { class: 'card' },
      h('div', { class: 'transport' },
        playBtn,
        h('div', { class: 'grow' },
          h('div', { class: 'stepper' },
            h('button', { class: 'icon', 'aria-label': 'Slower', onClick: () => setBpm(p().bpm - 1) }, '−'),
            h('div', null, bpmVal, h('div', { class: 'bpm-lbl' }, 'BPM')),
            h('button', { class: 'icon', 'aria-label': 'Faster', onClick: () => setBpm(p().bpm + 1) }, '+'))),
        h('div', { style: 'width:120px' }, barsSeg.el, h('div', { class: 'bpm-lbl', style: 'margin-top:4px' }, 'bars'))),
    ),
    h('section', { class: 'card' },
      h('div', { class: 'track-head' }, h('h2', null, h('span', { class: 'swatch', style: 'background:var(--drums)' }), 'Drums')),
      h('div', { class: 'presets' }, kitButtons),
      grid.el,
      h('p', { class: 'hint' }, 'Tap to add · tap a lit cell to change kick → snare → hat → off · hold to delete'),
    ),
    h('div', { class: 'card empty' },
      h('div', { class: 'big-emoji' }, '🎧'),
      h('p', { class: 'muted' }, 'New here? Hear what MouthBand can do.'),
      h('button', { onClick: () => loadDemo() }, 'Load the demo song'),
    ),
    h('div', { class: 'actionbar' },
      h('button', { class: 'rec big', onClick: () => navigate('record') }, '🎙  Record'),
    ),
  );

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
    grid.setPlayhead(player.currentStep());
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    player.stop();
  };
}

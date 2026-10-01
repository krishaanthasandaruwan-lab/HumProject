// 03 · Pick your sound: the melody you just hummed, arranged three ways. Tap one to hear it and keep
// the one you like — it becomes a normal song you can edit in the studio.
import { keyName } from '../dsp/key';
import { prepareProject } from '../audio/prepare';
import { unlockAudio } from '../audio/context';
import { Player } from '../audio/scheduler';
import { arrange, type HumTake } from '../model/autoArrange';
import type { Project } from '../model/project';
import { pickStyles } from '../model/styles';
import { navigate } from '../router';
import { flushSave, setProject } from '../state';
import { h, toast } from './dom';
import { icon } from './icons';
import { chip, iconBtn, pairBtn, setPressed, titleBlock } from './kit';
import { PARTS, styleIcon } from './parts';
import { roomForAnother } from './projects';

let take: HumTake | null = null;

export function setHumTake(t: HumTake): void {
  take = t;
}

export function mountChoices(root: HTMLElement): () => void {
  const t = take;
  if (!t) {
    navigate('hum');
    return () => undefined;
  }
  const styles = pickStyles(t.bpm, t.key);
  const date = new Date().toLocaleDateString();
  const projects: Project[] = styles.map((s) => arrange(t, s, `${s.name} · ${date}`));
  let current = 0;
  let alive = true;
  let voiceOn = true;
  const player = new Player(() => projects[current]);

  const squares = (p: Project): HTMLElement => h('span', { class: 'partsq', 'aria-hidden': 'true' },
    (['drums', 'bass', 'chords', 'lead'] as const).map((k) => h('i', { class: p.tracks.some((x) => x.kind === k && ((x.notes?.length ?? 0) + (x.hits?.length ?? 0)) > 0) ? 'on' : '' })),
    t.voice ? h('i', { class: 'voice' }) : null);
  const cards = styles.map((s, i) =>
    h('button', { type: 'button', class: 'card-bold choice', 'aria-current': 'false', onClick: () => play(i) },
      h('span', { class: 'tile48' }, icon(styleIcon(s.id), 24)),
      h('span', null, h('b', { class: 'h3' }, s.name), squares(projects[i])),
      h('span', { class: 'eqbars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
  const syncVoiceSquares = (): void => cards.forEach((c) => c.querySelector('.partsq .voice')?.classList.toggle('on', voiceOn));
  const voiceChip = t.voice ? chip(PARTS.voice.label, () => {
    voiceOn = !voiceOn;
    setPressed(voiceChip as HTMLElement, voiceOn);
    for (const p of projects) {
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) lead.voice.on = voiceOn;
    }
    syncVoiceSquares();
    if (player.playing) play(current);
  }, { icon: 'voice', pressed: true }) : null;
  syncVoiceSquares();
  const status = h('p', { class: 'small muted choices-status', 'aria-live': 'polite' }, 'Building…');
  const bar = pairBtn('Hum again', () => navigate('hum'), 'Use this', () => void use());
  bar.main.disabled = true;

  root.append(h('div', { class: 'screen choices' },
    h('header', { class: 'top' }, iconBtn('again', 'Hum again', () => navigate('hum')), null),
    titleBlock(['Pick your', 'sound'], { sub: `${t.key ? keyName(t.key) : ''} · ${Math.round(t.bpm)} BPM`, deco: 'deco' }),
    h('div', { class: 'choice-list' }, cards),
    h('div', { class: 'chips' }, voiceChip, status),
    h('div', { class: 'action' }, bar.el)));

  function play(i: number): void {
    current = i;
    cards.forEach((c, k) => c.setAttribute('aria-current', String(k === i)));
    void unlockAudio().then(() => {
      if (!alive) return;
      player.start();
      status.textContent = '';
    });
  }

  async function use(): Promise<void> {
    if (!(await roomForAnother())) return;
    player.stop();
    await flushSave();
    setProject(projects[current]);
    take = null;
    navigate('studio');
    toast('Saved to My songs');
  }

  void Promise.all(projects.map((p) => prepareProject(p).catch(() => undefined))).then(() => {
    if (!alive) return;
    bar.main.disabled = false;
    play(0);
  });

  let raf = 0;
  const tick = (): void => {
    const on = player.playing;
    cards.forEach((c, k) => c.classList.toggle('playing', on && k === current));
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    player.stop();
  };
}

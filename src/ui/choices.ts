// "Pick your sound": the melody you just hummed, arranged three ways. Tap one to hear it, keep
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
  const player = new Player(() => projects[current]);

  const voiceBox = h('input', { type: 'checkbox', checked: true });
  voiceBox.addEventListener('change', () => {
    for (const p of projects) {
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) lead.voice.on = voiceBox.checked;
    }
    if (player.playing) play(current);
  });
  const cards = styles.map((s, i) =>
    h('button', { class: 'choice', onClick: () => play(i) },
      h('span', { class: 'choice-em' }, s.emoji),
      h('span', { class: 'choice-text' }, h('b', null, s.name), h('span', { class: 'small muted' }, s.blurb)),
      h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
  const status = h('p', { class: 'small muted center' }, 'Arranging your song…');
  const keep = h('button', { class: 'primary big wide', disabled: true, onClick: () => void use() }, 'Use this song');

  root.append(h('div', { class: 'choices' },
    h('header', { class: 'topbar' },
      h('button', { class: 'icon ghost', 'aria-label': 'Hum again', onClick: () => navigate('hum') }, '←'),
      h('h1', null, 'Pick your sound')),
    h('p', { class: 'muted choices-meta' }, `${keyName(t.key)} · ${Math.round(t.bpm)} BPM · ${t.bars} bars`),
    h('div', { class: 'choice-list' }, cards),
    t.voice ? h('label', { class: 'check' }, voiceBox, '🎤 Add my voice (auto-tuned)') : null,
    status,
    keep,
    h('div', { class: 'center' }, h('button', { class: 'link', onClick: () => navigate('hum') }, 'Hum again'))));

  function play(i: number): void {
    current = i;
    cards.forEach((c, k) => c.classList.toggle('on', k === i));
    void unlockAudio().then(() => {
      if (!alive) return;
      player.start();
      status.textContent = `Playing “${styles[i].name}” — tap another to compare.`;
    });
  }

  async function use(): Promise<void> {
    if (!(await roomForAnother())) return;
    player.stop();
    await flushSave();
    setProject(projects[current]);
    take = null;
    navigate('studio');
    toast('Saved to My songs — now make it yours ✨');
  }

  void Promise.all(projects.map((p) => prepareProject(p).catch(() => undefined))).then(() => {
    if (!alive) return;
    keep.disabled = false;
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

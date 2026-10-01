// 03 · Pick your sound: the melody you just hummed as three clearly different songs — as hummed,
// slower and faster, each in a style that suits it (model/variety.ts). Tap one to hear it and keep
// the one you like. "More" (free) keeps offering new ones, up to 100. A heart keeps a version in
// My songs (as a favorite) without leaving the screen.
import { keyName } from '../dsp/key';
import { prepareProject } from '../audio/prepare';
import { unlockAudio } from '../audio/context';
import { Player } from '../audio/scheduler';
import { arrange, type HumTake } from '../model/autoArrange';
import { uid, type Project } from '../model/project';
import { MAX_VARIANTS, moreVariants, pickVariants, type Variant } from '../model/variety';
import { navigate } from '../router';
import { settings } from '../settings';
import { nextSongName } from '../songName';
import { flushSave, setProject } from '../state';
import { saveProject, trashProject } from '../storage';
import { getInstrument } from '../synth/kits';
import { h, toast } from './dom';
import { icon } from './icons';
import { chip, iconBtn, pairBtn, setPressed, titleBlock } from './kit';
import { PARTS, styleIcon } from './parts';
import { roomForAnother } from './projects';

let take: HumTake | null = null;

export function setHumTake(t: HumTake): void {
  take = t;
}

const FEEL: Record<Variant['feel'], string> = { hummed: 'As hummed', slower: 'Slower', faster: 'Faster', more: '' };

export function mountChoices(root: HTMLElement): () => void {
  const t = take;
  if (!t) {
    navigate('hum');
    return () => undefined;
  }
  const likes = settings().likes;
  const variants: Variant[] = [];
  const projects: Project[] = [];
  const cards: HTMLButtonElement[] = [];
  const kept = new Set<number>(); // versions hearted (saved to My songs)
  let current = 0;
  let alive = true;
  let voiceOn = true;
  const player = new Player(() => projects[current]);
  const list = h('div', { class: 'choice-list' });

  const squares = (p: Project): HTMLElement => h('span', { class: 'partsq', 'aria-hidden': 'true' },
    (['drums', 'bass', 'chords', 'lead'] as const).map((k) => h('i', { class: p.tracks.some((x) => x.kind === k && ((x.notes?.length ?? 0) + (x.hits?.length ?? 0)) > 0) ? 'on' : '' })),
    t.voice ? h('i', { class: `voice${voiceOn ? ' on' : ''}` }) : null);

  function add(vs: Variant[]): Promise<void> {
    const start = projects.length;
    for (const v of vs) {
      const style = v.lead ? { ...v.style, lead: { ...v.style.lead, preset: v.lead } } : v.style;
      const p = arrange({ ...t!, bpm: v.bpm }, style, v.style.name);
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) lead.voice.on = voiceOn;
      const i = projects.length;
      variants.push(v);
      projects.push(p);
      const card = h('button', { type: 'button', class: 'card-bold choice', 'aria-current': 'false', onClick: () => play(i) },
        h('span', { class: 'tile48' }, icon(styleIcon(v.style.id), 24)),
        h('span', null,
          h('b', { class: 'h3' }, v.style.name),
          h('small', { class: 'label muted' }, [v.lead ? getInstrument(v.lead).name : '', FEEL[v.feel], `${v.bpm} BPM`].filter(Boolean).join(' · ')),
          squares(p)),
        h('span', { class: 'eqbars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
      const heart = h('button', { type: 'button', class: 'icon-btn ghost heart', 'aria-pressed': 'false', 'aria-label': `Keep ${v.style.name} in My songs`, onClick: () => void toggleKeep(i, heart) }, icon('heart', 24));
      cards.push(card);
      list.append(h('div', { class: 'choice-wrap' }, card, heart));
    }
    return Promise.all(projects.slice(start).map((p) => prepareProject(p).catch(() => undefined))).then(() => undefined);
  }

  const voiceChip = t.voice ? chip(PARTS.voice.label, () => {
    voiceOn = !voiceOn;
    setPressed(voiceChip as HTMLElement, voiceOn);
    for (const p of projects) {
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) lead.voice.on = voiceOn;
    }
    cards.forEach((c) => c.querySelector('.partsq .voice')?.classList.toggle('on', voiceOn));
    if (player.playing) play(current);
  }, { icon: 'voice', pressed: true }) : null;
  const moreChip = chip('More', () => void more(), { icon: 'add' }) as HTMLButtonElement;
  const status = h('p', { class: 'small muted choices-status', 'aria-live': 'polite' }, 'Building…');
  const bar = pairBtn('Hum again', () => navigate('hum'), 'Use this', () => void use());
  bar.main.disabled = true;

  root.append(h('div', { class: 'screen choices' },
    h('header', { class: 'top' }, iconBtn('again', 'Hum again', () => navigate('hum')), null),
    titleBlock(['Pick your', 'sound'], { sub: t.key ? keyName(t.key) : undefined, deco: 'deco' }),
    list,
    h('div', { class: 'chips' }, voiceChip, moreChip, status),
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

  async function more(): Promise<void> {
    moreChip.disabled = true;
    const next = moreVariants(t!.bpm, t!.key, likes, variants);
    const first = projects.length;
    await add(next);
    if (!alive) return;
    moreChip.disabled = false;
    if (!next.length || variants.length >= MAX_VARIANTS) moreChip.remove();
    if (next.length) {
      play(first);
      cards[first]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /** Heart: keep this version in My songs (a favorite); un-heart moves it to Recently deleted. */
  async function toggleKeep(i: number, btn: HTMLButtonElement): Promise<void> {
    const p = projects[i];
    if (kept.has(i)) {
      kept.delete(i);
      btn.setAttribute('aria-pressed', 'false');
      await trashProject(p.id);
      p.id = uid(); // a later "Use this" makes a fresh song, not a clash with the deleted one
      toast('Moved to Recently deleted');
      return;
    }
    if (!(await roomForAnother())) return;
    p.name = await nextSongName();
    p.favorite = true;
    p.updatedAt = Date.now();
    await saveProject(p);
    kept.add(i);
    btn.setAttribute('aria-pressed', 'true');
    navigator.vibrate?.(10);
    toast(`${p.name} kept in My songs`);
  }

  async function use(): Promise<void> {
    if (!kept.has(current) && !(await roomForAnother())) return;
    player.stop();
    await flushSave();
    if (!kept.has(current)) projects[current].name = await nextSongName();
    setProject(projects[current]);
    take = null;
    navigate('studio');
    toast('Saved to My songs');
  }

  void add(pickVariants(t.bpm, t.key, likes)).then(() => {
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

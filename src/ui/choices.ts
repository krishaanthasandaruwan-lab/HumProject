// 03 · Pick your sound: the melody you just hummed as three clearly different songs — as hummed,
// slower and faster, each in a style that suits it (model/variety.ts). Tap one to hear it and keep
// the one you like. "More" keeps offering new ones, up to 100, all free to pick and keep; the first 3 are
// free to export, the extra ones carry a lock (exporting them needs Pro, pro/exports.ts). A heart keeps
// a version in My songs (a favorite).
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
import { isPro } from '../pro/pro';
import { FREE_VERSIONS, markTool, unmarkTool } from '../pro/exports';
import { flushSave, setProject } from '../state';
import { saveProject, trashProject } from '../storage';
import { getInstrument } from '../synth/kits';
import { h, toast } from './dom';
import { icon, type IconName } from './icons';
import { chip, iconBtn, pairBtn, range, setPressed, titleBlock } from './kit';
import { PARTS, styleIcon } from './parts';
import { proNotice } from './proNotice';

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
  let voiceLevel = 0.8; // your voice's volume, the same in every version
  let voiceFx = false; // the voice effect (Pro): only on your voice, never on the instruments
  let bandLevel = 1; // the instruments' volume (× each part's own level), the same in every version
  const baseVolume = new WeakMap<Project['tracks'][number], number>();
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
      for (const tr of p.tracks) baseVolume.set(tr, tr.volume);
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) lead.voice = { ...lead.voice, on: voiceOn, fx: voiceFx };
      applyLevels(p);
      const i = projects.length;
      if (i >= FREE_VERSIONS) p.proTools = ['more']; // an extra version: free to use, Pro to export
      if (voiceFx && !isPro()) markTool(p, 'fx');
      variants.push(v);
      projects.push(p);
      const card = h('button', { type: 'button', class: 'card-bold choice', 'aria-current': 'false', onClick: () => play(i) },
        h('span', { class: 'tile48' }, icon(styleIcon(v.style.id), 24), locked(i) ? h('span', { class: 'lockb', 'aria-label': 'Pro' }, icon('lock', 12)) : null),
        h('span', null,
          h('b', { class: 'h3' }, v.style.name),
          h('small', { class: 'label muted' }, [v.lead ? getInstrument(v.lead).name : '', FEEL[v.feel], `${v.bpm} BPM`].filter(Boolean).join(' · ')),
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

  /** Your voice in every version: its volume, and the voice effect. */
  const eachVoice = (fn: (v: NonNullable<Project['tracks'][number]['voice']>, p: Project) => void): void => {
    for (const p of projects) {
      const lead = p.tracks.find((x) => x.kind === 'lead');
      if (lead?.voice) fn(lead.voice, p);
    }
  };

  /** Instruments at bandLevel × their own level; your voice at voiceLevel whatever the band does. The voice
   * plays through the melody part's bus (which follows that part's volume), so it is raised by as much
   * as the band is turned down. The player follows these live. */
  function applyLevels(p: Project): void {
    for (const tr of p.tracks) tr.volume = (baseVolume.get(tr) ?? tr.volume) * bandLevel;
    const lead = p.tracks.find((x) => x.kind === 'lead');
    if (lead?.voice) lead.voice.level = voiceLevel / bandLevel;
  }
  const mixRow = (ic: IconName, label: string, slider: HTMLInputElement, end: HTMLElement | null = null): HTMLElement =>
    h('div', { class: 'mixline' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 18)), h('span', { class: 'label' }, label), slider, end);
  const voiceSlider = range(0, 1.5, 0.01, voiceLevel, (v) => {
    voiceLevel = v;
    projects.forEach(applyLevels);
  }, 'My voice volume');
  const bandSlider = range(0.1, 1, 0.01, bandLevel, (v) => {
    bandLevel = v;
    projects.forEach(applyLevels);
  }, 'Instruments volume');
  const setFx = (on: boolean): void => {
    voiceFx = on;
    setPressed(fxChip as HTMLElement, on);
    eachVoice((voice, p) => {
      voice.fx = on;
      if (on && !isPro()) markTool(p, 'fx');
      else unmarkTool(p, 'fx');
    });
  };
  const fxChip = t.voice
    ? chip('Effect', () => {
      setFx(!voiceFx);
      if (voiceFx && !isPro()) proNotice('Voice effect is Pro · export needs Pro', () => setFx(false));
    }, { icon: 'sparkles', pressed: false, lock: !isPro() })
    : null;
  // Your voice and the instruments, balanced once here for every version (the Studio's Mix has the rest).
  const mix = h('div', { class: 'choice-mix' },
    t.voice ? mixRow('voice', 'My voice', voiceSlider, fxChip) : null,
    mixRow('melody', 'Instruments', bandSlider));
  const moreChip = chip('More', () => void more(), { icon: 'add' }) as HTMLButtonElement;
  const status = h('p', { class: 'small muted choices-status playing', 'aria-live': 'polite' },
    h('span', { class: 'eqbars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), 'Building your songs…');
  const bar = pairBtn('Hum again', () => navigate('hum'), 'Use this', () => void use());
  bar.main.disabled = true;
  bar.main.classList.add('busy');

  root.append(h('div', { class: 'screen choices' },
    h('header', { class: 'top' }, iconBtn('again', 'Hum again', () => navigate('hum')), null),
    titleBlock(['Pick your', 'sound'], { sub: t.key ? keyName(t.key) : undefined, deco: 'deco' }),
    list,
    h('div', { class: 'chips' }, voiceChip, moreChip, status),
    h('div', { class: 'action' }, mix, bar.el)));

  function play(i: number): void {
    current = i;
    cards.forEach((c, k) => c.setAttribute('aria-current', String(k === i)));
    void unlockAudio().then(() => {
      if (!alive) return;
      player.start();
      status.replaceChildren();
      status.classList.remove('playing');
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

  /** Extra versions show a lock: free to pick, play and edit; exporting them needs Pro. */
  const locked = (i: number): boolean => i >= FREE_VERSIONS && !isPro();

  /** Heart: keep this version in My songs (a favorite); un-heart moves it to Recently deleted. */
  async function toggleKeep(i: number, btn: HTMLButtonElement): Promise<void> {
    const p = projects[i];
    if (kept.has(i)) {
      kept.delete(i);
      btn.setAttribute('aria-pressed', 'false');
      await trashProject(p.id);
      p.id = uid(); // a later "Use this" makes a fresh song, not a clash with the deleted one
      return;
    }
    p.name = await nextSongName();
    p.favorite = true;
    p.updatedAt = Date.now();
    await saveProject(p);
    kept.add(i);
    btn.setAttribute('aria-pressed', 'true');
    navigator.vibrate?.(10);
  }

  async function use(): Promise<void> {
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
    bar.main.classList.remove('busy');
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

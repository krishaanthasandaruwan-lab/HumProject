// 06 · Sounds: swap a part's instrument, or the drum kit. Locked sounds still play a taste, then open Pro.
import { auditionDrum, auditionNote } from '../app';
import { prepareProject } from '../audio/prepare';
import { getTrack, TRACK_META, type TrackKind } from '../model/project';
import { instrumentLocked, kitLocked } from '../pro/pro';
import { edit, getProject } from '../state';
import { getInstrument, getKit, instrumentsFor, KITS } from '../synth/kits';
import { h, sheet } from './dom';
import { icon } from './icons';
import { mainBtn } from './kit';
import { openPaywall } from './paywall';
import { PARTS } from './parts';

/** The name of the sound a part plays now (for the sound chip). */
export function soundName(kind: TrackKind): string {
  const preset = getTrack(getProject(), kind)?.preset ?? TRACK_META[kind].preset;
  return kind === 'drums' ? getKit(preset).name : getInstrument(preset).name;
}

export function openSounds(kind: TrackKind, onChange?: () => void): void {
  const drums = kind === 'drums';
  const current = (): string => getTrack(getProject(), kind)?.preset ?? TRACK_META[kind].preset;
  const items = drums
    ? KITS.map((k) => ({ id: k.id, name: k.name, locked: kitLocked(k.id) }))
    : instrumentsFor(kind === 'bass' ? 'bass' : kind === 'chords' ? 'chords' : 'lead').map((i) => ({ id: i.id, name: i.name, locked: instrumentLocked(i.id) }));
  if (!items.some((i) => i.id === current())) items.unshift({ id: current(), name: soundName(kind), locked: false });

  const taste = (id: string): void => {
    if (drums) auditionDrum('kick', id);
    else auditionNote(id, kind === 'bass' ? 40 : 64);
  };
  const tiles = items.map((it) =>
    h('button', { type: 'button', class: 'snd', 'aria-pressed': String(it.id === current()), onClick: () => pick(it.id, it.locked, it.name) },
      h('span', null, it.name),
      it.locked ? h('span', { class: 'lockb', 'aria-label': 'Pro' }, icon('lock', 12)) : null));
  const sync = (): void => tiles.forEach((t, i) => t.setAttribute('aria-pressed', String(items[i].id === current())));

  function pick(id: string, locked: boolean, name: string): void {
    taste(id);
    if (locked) {
      openPaywall(drums ? `The ${name} kit is part of Pro.` : `${name} is part of Pro.`);
      return;
    }
    edit((p) => {
      const t = getTrack(p, kind);
      if (t) t.preset = id;
    });
    sync();
    onChange?.();
    if (!drums) void prepareProject(getProject()).catch(() => undefined);
  }

  const close = sheet(h('div', { class: 'stack' },
    h('div', { class: 'snd-grid' }, tiles),
    mainBtn('Done', () => close(), { icon: 'done' })),
  undefined, drums ? 'Drum kit' : `${PARTS[kind].label} sound`);
}

// 06 · Sounds: swap a part's instrument, or the drum kit. Locked (Pro) sounds can be used too; a song with
// one the person picked needs Pro to export.
import { auditionDrum, auditionNote } from '../app';
import { prepareProject } from '../audio/prepare';
import { trackById, TRACK_META, type Track } from '../model/project';
import { instrumentLocked, kitLocked } from '../pro/pro';
import { edit, getProject } from '../state';
import { getInstrument, getKit, instrumentsFor, KITS } from '../synth/kits';
import { h, sheet } from './dom';
import { proNotice } from './proNotice';
import { icon } from './icons';
import { mainBtn } from './kit';
import { partLabel } from './parts';

/** The name of the sound a part plays now (for the sound chip). */
export function soundName(t: Track): string {
  return t.kind === 'drums' ? getKit(t.preset).name : getInstrument(t.preset).name;
}

export function openSounds(id: string, onChange?: () => void): void {
  const track = (): Track | undefined => trackById(getProject(), id);
  const t0 = track();
  if (!t0) return;
  const kind = t0.kind;
  const drums = kind === 'drums';
  const current = (): string => track()?.preset ?? TRACK_META[kind].preset;
  const items = drums
    ? KITS.map((k) => ({ id: k.id, name: k.name, locked: kitLocked(k.id) }))
    : instrumentsFor(kind === 'bass' ? 'bass' : kind === 'chords' ? 'chords' : 'lead').map((i) => ({ id: i.id, name: i.name, locked: instrumentLocked(i.id) }));
  if (!items.some((i) => i.id === current())) items.unshift({ id: current(), name: soundName(t0), locked: false });

  const taste = (id: string): void => {
    if (drums) auditionDrum('kick', id);
    else auditionNote(id, kind === 'bass' ? 40 : 64);
  };
  const tiles = items.map((it) =>
    h('button', { type: 'button', class: 'snd', 'aria-pressed': String(it.id === current()), onClick: () => pick(it.id, it.locked, it.name) },
      h('span', null, it.name),
      it.locked ? h('span', { class: 'lockb', 'aria-label': 'Plus' }, icon('lock', 12)) : null));
  const sync = (): void => tiles.forEach((t, i) => t.setAttribute('aria-pressed', String(items[i].id === current())));

  /** Any sound can be used; a locked (Pro) one makes the song need Pro to export (pro/exports.ts). */
  function pick(id: string, locked: boolean, name: string): void {
    taste(id);
    const t = track();
    if (!t || t.preset === id) return;
    const before = { preset: t.preset, picked: t.picked };
    edit(() => {
      t.preset = id;
      t.picked = true;
    });
    sync();
    onChange?.();
    if (!drums) void prepareProject(getProject()).catch(() => undefined);
    if (locked) {
      proNotice(`${name} is Plus · export needs Plus`, () => {
        edit(() => {
          t.preset = before.preset;
          t.picked = before.picked;
        });
        sync();
        onChange?.();
      });
    }
  }

  const close = sheet(h('div', { class: 'stack' },
    h('div', { class: 'snd-grid' }, tiles),
    mainBtn('Done', () => close(), { icon: 'done' })),
  undefined, drums ? 'Drum kit' : `${partLabel(getProject(), t0)} sound`);
}

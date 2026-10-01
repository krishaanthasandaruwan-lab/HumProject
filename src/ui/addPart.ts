// 07 · Add a part: a ready-made part fitted to the song, a new recording, or a recording from a file.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { prepareQuickly } from '../audio/prepare';
import { addChords } from '../model/arrange';
import { getTrack } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { h, sheet, toast } from './dom';
import { icon, type IconName } from './icons';
import { chip } from './kit';
import { PARTS } from './parts';

function card(ic: IconName, title: string, sub: string, go: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'card-list', onClick: go },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 20)),
    h('span', null, h('b', null, title), h('small', null, sub)),
    icon('open', 20));
}

/** Harmonize the melody with chords (and a root bass when none was hummed), with Undo. */
export function makeChords(onChange: () => void): void {
  let res: ReturnType<typeof addChords> | undefined;
  edit((p) => { res = addChords(p); });
  if (!res) return;
  const done = res;
  onChange();
  toast(`${done.names.join(' – ')}${done.addedBass ? ' + bass' : ''}`, {
    label: 'Undo',
    run: () => {
      edit((p) => done.undo(p));
      onChange();
    },
  });
  void unlockAudio().then(async () => {
    await prepareQuickly(getProject());
    if (!player.playing) player.start();
  });
}

export function openAddPart(onChange: () => void): void {
  const p = getProject();
  const has = !!getTrack(p, 'chords')?.notes?.length;
  const tune = p.tracks.some((t) => (t.kind === 'lead' || t.kind === 'bass') && t.notes?.length);
  const go = (fn: () => void): void => { close(); fn(); };
  const close = sheet(h('div', { class: 'stack' },
    h('h3', { class: 'label muted' }, 'Make one'),
    h('div', { class: 'chips' },
      chip(PARTS.chords.label, tune ? () => go(() => makeChords(onChange)) : undefined, { icon: has ? 'done' : 'chords' })),
    tune ? null : h('p', { class: 'small muted' }, 'Hum a melody first, then HUMM can add chords.'),
    h('div', { class: 'stack' },
      card('record', 'Record', 'Beatbox the drums or hum a part', () => go(() => navigate('record', { kind: nextKind() }))),
      card('import', 'Import a recording', 'A voice memo or a video', () => go(() => navigate('record', { kind: nextKind(), import: '1' }))))),
  undefined, 'Add a part');
}

function nextKind(): string {
  const p = getProject();
  return (['drums', 'bass', 'lead'] as const).find((k) => !getTrack(p, k)?.hits?.length && !getTrack(p, k)?.notes?.length) ?? 'drums';
}

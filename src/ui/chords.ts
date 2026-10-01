// Chords made from the melody (and a root bass when none was hummed), with Undo.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { prepareQuickly } from '../audio/prepare';
import { addChords } from '../model/arrange';
import { edit, getProject } from '../state';
import { toast } from './dom';

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

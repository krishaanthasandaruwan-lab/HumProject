// "✨ Add chords": harmonize the melody with a chords track, and add a root bass when
// the user has not hummed one.
import { bassFromChords, chooseChords, chordName, voiceChords } from '../dsp/harmony';
import { detectKey } from '../dsp/key';
import { getTrack, newTrack, putTrack, type Key, type Project, type Track } from './project';

export interface ChordsResult {
  names: string[];
  addedBass: boolean;
  /** Restores the tracks that were replaced. */
  undo: (p: Project) => void;
}

function inherit(from: Track | undefined, to: Track): void {
  if (!from) return;
  to.volume = from.volume;
  to.muted = from.muted;
  to.solo = from.solo;
}

export function addChords(p: Project): ChordsResult {
  const lead = getTrack(p, 'lead');
  const bass = getTrack(p, 'bass');
  const hummedBass = bass && !bass.generated && (bass.notes?.length ?? 0) > 0 ? bass : undefined;
  const melody = (lead?.notes?.length ? lead.notes : hummedBass?.notes) ?? [];
  const key: Key = p.key ?? detectKey(melody)?.key ?? { tonic: 9, mode: 'minor' };
  p.key = key;
  const chords = chooseChords(melody, key, p.bars);

  const prevChords = getTrack(p, 'chords');
  const preset = prevChords?.preset ?? 'pad';
  const chordTrack = newTrack('chords', preset);
  chordTrack.generated = true;
  chordTrack.notes = voiceChords(chords, preset === 'keys' ? 'keys' : 'pad');
  chordTrack.labels = chords.map(chordName);
  inherit(prevChords, chordTrack);
  putTrack(p, chordTrack);

  let bassTrack: Track | undefined;
  if (!hummedBass) {
    const kicks = (getTrack(p, 'drums')?.hits ?? []).filter((h) => h.type === 'kick').map((h) => h.step);
    bassTrack = newTrack('bass', bass?.preset ?? 'bass');
    bassTrack.generated = true;
    bassTrack.notes = bassFromChords(chords, kicks);
    inherit(bass, bassTrack);
    putTrack(p, bassTrack);
  }

  return {
    names: chordTrack.labels,
    addedBass: !!bassTrack,
    undo: (q) => {
      q.tracks = q.tracks.filter((t) => t.id !== chordTrack.id && t.id !== bassTrack?.id);
      if (prevChords) putTrack(q, prevChords);
      if (bassTrack && bass) putTrack(q, bass);
    },
  };
}

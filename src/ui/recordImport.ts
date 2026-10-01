// Import a recording into the song being edited: decode it, beat-match it (fitting this song's
// tempo, or setting it when the song is still empty), and build the track. record.ts commits it.
import { decodeAudioFile, pickAudioFile, sliceSeconds } from '../audio/importAudio';
import { runDsp } from '../dsp/client';
import { refreshKey } from '../model/music';
import { getTrack, newTrack, stepDur, swingOffset, type Note, type Project, type Track } from '../model/project';
import { getProfile } from '../profile';
import { settings } from '../settings';
import { edit, getProject } from '../state';

export type ImportKind = 'drums' | 'bass' | 'lead';

export interface Imported {
  track: Track;
  message: string;
  after?: (p: Project) => void;
}

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;

/** Where each note was sung in a take (seconds) → its grid step; lets your voice join the mix on the beat. */
export function voiceAnchors(notes: Note[], bpm: number, bars: number, swing: number): number[] {
  const sd = stepDur(bpm);
  const out: number[] = [];
  for (const n of notes) out.push((n.start + swingOffset(n.start, swing) + (n.offset ?? 0)) * sd, n.start);
  out.push(bars * 16 * sd, bars * 16);
  return out;
}

export async function importRecording(k: ImportKind, progress: (busy: boolean, text?: string) => void): Promise<Imported | null> {
  const file = await pickAudioFile();
  if (!file) return null;
  progress(true, 'Opening your recording…');
  try {
    const { audio, sampleRate } = await decodeAudioFile(file);
    progress(true, 'Finding the beat…');
    const p = getProject();
    const others = p.tracks.some((t) => t.kind !== k && hasContent(t));
    const r = await runDsp('free', { audio, sampleRate, kind: k, profile: getProfile(), ...(others ? { bpm: p.bpm, bars: p.bars } : {}) });
    if (!r.hits.length && !r.notes.length) {
      progress(false, k === 'drums' ? 'I could not hear any beatbox hits in that file.' : 'I could not find a clear melody in that file.');
      return null;
    }
    const track = newTrack(k, getTrack(p, k)?.preset);
    track.rawVoice = sliceSeconds(audio, sampleRate, r.loopStart, r.loopEnd);
    track.rawRate = sampleRate;
    if (k === 'drums') track.hits = r.hits;
    else {
      track.notes = r.notes;
      track.anchors = r.anchors;
    }
    if (!others) {
      edit((pp) => {
        pp.bpm = r.bpm;
        pp.bars = r.bars;
      });
    }
    const count = k === 'drums' ? `${r.hits.length} hits` : `${r.notes.length} notes`;
    progress(false, '');
    return {
      track,
      message: `📂 Imported ${count}${others ? '' : ` · ${Math.round(r.bpm)} BPM`}`,
      after: k === 'drums' ? undefined : (pp) => refreshKey(pp, settings().snapToScale),
    };
  } catch (err) {
    progress(false, (err as Error).message);
    return null;
  }
}

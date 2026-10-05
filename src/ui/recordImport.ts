// Import a recording into the song being edited: decode it, beat-match it (fitting this song's
// tempo, or setting it when the song is still empty), and build the track. record.ts commits it.
import { decodeAudioFile, sliceSeconds } from '../audio/importAudio';
import { boostQuiet } from '../dsp/level';
import { runDsp } from '../dsp/client';
import { refreshKey } from '../model/music';
import { getTrack, inheritTrack, newTrack, stepDur, swingOffset, type Note, type Project, type Track } from '../model/project';
import { getProfile } from '../profile';
import { settings } from '../settings';
import { getProject } from '../state';
import { chooseImport } from './importSheet';
import { maxSeconds } from './limits';

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

/** `replaceId`: the part being re-recorded (its own audio doesn't count as "the rest of the song"). */
export async function importRecording(k: ImportKind, progress: (busy: boolean, text?: string) => void, replaceId?: string, signal?: AbortSignal): Promise<Imported | null> {
  const p = getProject();
  const file = await chooseImport(signal);
  if (!file || signal?.aborted) return null;
  progress(true, 'Opening your recording…');
  try {
    const decoded = await decodeAudioFile(file, maxSeconds(), signal);
    const { sampleRate } = decoded;
    const audio = k === 'drums' ? decoded.audio : boostQuiet(decoded.audio, sampleRate); // soft humming counts too
    progress(true, 'Finding the beat…');
    if (getProject().id !== p.id) return null;
    const others = p.tracks.some((t) => t.id !== replaceId && hasContent(t));
    const r = await runDsp('free', { audio, sampleRate, kind: k, profile: getProfile(), ...(others ? { bpm: p.bpm, bars: p.bars } : {}) }, { signal });
    if (!r.hits.length && !r.notes.length) {
      progress(false, k === 'drums' ? 'Didn’t hear any beatbox hits in that file.' : 'Didn’t catch a clear tune in that file.');
      return null;
    }
    if (getProject().id !== p.id) return null;
    const source = (replaceId ? p.tracks.find((t) => t.id === replaceId) : undefined) ?? getTrack(p, k);
    const track = newTrack(k, source?.preset);
    inheritTrack(source, track);
    track.rawVoice = sliceSeconds(audio, sampleRate, r.loopStart, r.loopEnd);
    track.rawRate = sampleRate;
    if (k === 'drums') track.hits = r.hits;
    else {
      track.notes = r.notes;
      track.anchors = r.anchors;
    }
    const count = k === 'drums' ? `${r.hits.length} hits` : `${r.notes.length} notes`;
    progress(false, '');
    return {
      track,
      message: `Imported ${count}${others ? '' : ` · ${Math.round(r.bpm)} BPM`}`,
      after: (pp) => {
        if (!others) { pp.bpm = r.bpm; pp.bars = r.bars; }
        if (k !== 'drums') refreshKey(pp, settings().snapToScale);
      },
    };
  } catch (err) {
    if (!signal?.aborted) progress(false, (err as Error).message);
    return null;
  }
}

// After a take: take the metronome back out, turn the audio into hits or notes, then put the new track
// into the song (with Undo) and go back to the Studio.
import { loopAudio, type Take } from '../audio/take';
import { runDsp } from '../dsp/client';
import { boostQuiet } from '../dsp/level';
import { refreshKey } from '../model/music';
import { getTrack, newTrack, putTrack, type Project, type Track, type TrackKind } from '../model/project';
import { getProfile } from '../profile';
import { navigate } from '../router';
import { settings } from '../settings';
import { edit, getProject } from '../state';
import { toast } from './dom';
import { voiceAnchors } from './recordImport';

export type TakeResult =
  | { ok: true; track: Track; message: string; after?: (p: Project) => void }
  | { ok: false; message: string };

export async function processTake(heard: Take, k: TrackKind): Promise<TakeResult> {
  // Without headphones the click is in the take too; left in, it reads as extra hits.
  const clean = heard.clickTones.length
    ? { ...heard, audio: await runDsp('declick', { audio: heard.audio, sampleRate: heard.sampleRate, tones: heard.clickTones }) }
    : heard;
  // Soft humming counts too (beatbox keeps its own levels: loudness tells kick from hat).
  const take = k === 'drums' ? clean : { ...clean, audio: boostQuiet(clean.audio, clean.sampleRate) };
  const p = getProject();
  const common = { audio: take.audio, sampleRate: take.sampleRate, preroll: take.preroll, bpm: p.bpm, bars: p.bars, swing: p.swing };
  const track = newTrack(k, getTrack(p, k)?.preset);
  track.rawVoice = loopAudio(take);
  track.rawRate = take.sampleRate;
  if (k === 'drums') {
    const res = await runDsp('beatbox', { ...common, profile: getProfile() });
    if (res.hits.length === 0) return { ok: false, message: 'Didn’t hear any hits. Try again a little louder, closer to the phone.' };
    track.hits = res.hits;
    return { ok: true, track, message: `${res.hits.length} hits added` };
  }
  const res = await runDsp('melody', { ...common, mode: k === 'bass' ? 'bass' : 'lead' });
  if (res.notes.length === 0) {
    return { ok: false, message: res.voiced < 0.05 ? 'Didn’t hear any humming. Try again a bit louder.' : 'Didn’t catch clear notes. Hum steadier notes with short breaks.' };
  }
  track.notes = res.notes;
  track.anchors = voiceAnchors(res.notes, p.bpm, p.bars, p.swing);
  return { ok: true, track, message: `${res.notes.length} notes added`, after: (pp) => refreshKey(pp, settings().snapToScale) };
}

/** Put the track into the song, go back to the Studio, and offer Undo. */
export function commit(track: Track, message: string, after?: (p: Project) => void): void {
  let old: Track | undefined;
  edit((p) => {
    const prev = getTrack(p, track.kind);
    if (prev) {
      // A re-take keeps the mixer settings of the part it replaces.
      track.volume = prev.volume;
      track.muted = prev.muted;
      track.solo = prev.solo;
    }
    old = putTrack(p, track);
    after?.(p);
  });
  navigator.vibrate?.(10);
  navigate('studio', { focus: track.kind });
  toast(message, {
    label: 'Undo',
    run: () => {
      edit((p) => {
        if (old) putTrack(p, old);
        else p.tracks = p.tracks.filter((t) => t.id !== track.id);
        after?.(p);
      });
      navigate('studio');
    },
  });
}

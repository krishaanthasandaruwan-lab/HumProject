// Your voice as a layer in the mix: the raw recording warped onto the grid (beat match) and, with
// auto-tune on, pitch-corrected to the track's notes — so it follows piano-roll edits and tempo
// changes. Processed in the DSP worker and cached per track until something it depends on changes.
import { runDsp } from '../dsp/client';
import { loopDuration, stepDur, swingOffset, type Project, type Track } from '../model/project';
import { monoBuffer } from './context';

interface Entry {
  sig: string;
  buffer: AudioBuffer | null;
  job: Promise<void> | null;
}

const cache = new Map<string, Entry>();
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
function trimCache(): void {
  let bytes = [...cache.values()].reduce((n, e) => n + (e.buffer?.length ?? 0) * 4, 0);
  for (const [id, e] of cache) {
    if (cache.size <= 8 && bytes <= MAX_CACHE_BYTES) break;
    if (e.job) continue;
    bytes -= (e.buffer?.length ?? 0) * 4;
    cache.delete(id);
  }
}

export const voiceOn = (t: Track): boolean => !!(t.voice?.on && t.rawVoice?.length && t.rawRate && t.anchors?.length);

function signature(p: Project, t: Track): string {
  return JSON.stringify([p.bpm, p.bars, p.swing, p.key, t.voice?.tune, t.anchors, t.rawVoice?.length,
    (t.notes ?? []).map((n) => [n.start, n.length, n.midi])]);
}

/** The processed voice if it is ready for the project as it is now (else starts processing it). */
/** Forget the processed voice layers (they are made again when needed). */
export function clearVoiceCache(): void {
  cache.clear();
}

export function voiceBuffer(p: Project, t: Track): AudioBuffer | null {
  if (!voiceOn(t)) return null;
  const e = cache.get(t.id);
  if (e?.buffer && e.sig === signature(p, t)) { cache.delete(t.id); cache.set(t.id, e); return e.buffer; }
  void prepareVoice(p, t).catch(() => undefined);
  return null;
}

export function prepareVoice(p: Project, t: Track, signal?: AbortSignal): Promise<void> {
  if (!voiceOn(t)) return Promise.resolve();
  const sig = signature(p, t);
  const old = cache.get(t.id);
  if (old?.sig === sig) { cache.delete(t.id); cache.set(t.id, old); return old.job ?? Promise.resolve(); }
  const sd = stepDur(p.bpm);
  const at = (step: number): number => (step + swingOffset(step, p.swing)) * sd;
  const src = t.anchors as number[];
  const anchors: number[] = [];
  for (let i = 0; i + 1 < src.length; i += 2) anchors.push(src[i], at(src[i + 1]));
  const targets = (t.notes ?? []).map((n) => ({ start: at(n.start), end: at(n.start) + n.length * sd, midi: n.midi }));
  const rate = t.rawRate as number;
  const length = Math.round(loopDuration(p) * rate);
  if (length * 4 > MAX_CACHE_BYTES) return Promise.reject(new Error('This voice layer is too long. Shorten the song or increase its tempo.'));
  const entry: Entry = { sig, buffer: null, job: null };
  cache.set(t.id, entry);
  entry.job = runDsp('voice', {
    audio: t.rawVoice as Float32Array, sampleRate: rate, targets, key: p.key, anchors,
    length, amount: t.voice?.tune ? 1 : 0, glide: 0.05,
  }, { signal })
    .then((data) => {
      if (cache.get(t.id) === entry) entry.buffer = monoBuffer(data, rate);
    })
    .catch((err) => {
      if (cache.get(t.id) === entry) cache.delete(t.id);
      throw err;
    })
    .finally(() => {
      entry.job = null;
      trimCache();
    });
  return entry.job;
}

export async function prepareVoices(p: Project, signal?: AbortSignal): Promise<void> {
  const tracks = p.tracks.filter(voiceOn);
  if (tracks.length > 8 || tracks.reduce((bytes, t) => bytes + loopDuration(p) * (t.rawRate ?? 48000) * 4, 0) > MAX_CACHE_BYTES) {
    throw new Error('The voice layers need too much memory. Shorten the song or turn off some voice layers.');
  }
  for (const track of tracks) await prepareVoice(p, track, signal);
}

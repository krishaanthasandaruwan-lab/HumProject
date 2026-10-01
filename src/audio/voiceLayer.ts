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

export const voiceOn = (t: Track): boolean => !!(t.voice?.on && t.rawVoice?.length && t.rawRate && t.anchors?.length);

function signature(p: Project, t: Track): string {
  return JSON.stringify([p.bpm, p.bars, p.swing, p.key, t.voice?.tune, t.anchors, t.rawVoice?.length,
    (t.notes ?? []).map((n) => [n.start, n.length, n.midi])]);
}

/** The processed voice if it is ready for the project as it is now (else starts processing it). */
export function voiceBuffer(p: Project, t: Track): AudioBuffer | null {
  if (!voiceOn(t)) return null;
  const e = cache.get(t.id);
  if (e?.buffer && e.sig === signature(p, t)) return e.buffer;
  void prepareVoice(p, t);
  return null;
}

export function prepareVoice(p: Project, t: Track): Promise<void> {
  if (!voiceOn(t)) return Promise.resolve();
  const sig = signature(p, t);
  const old = cache.get(t.id);
  if (old?.sig === sig) return old.job ?? Promise.resolve();
  const sd = stepDur(p.bpm);
  const at = (step: number): number => (step + swingOffset(step, p.swing)) * sd;
  const src = t.anchors as number[];
  const anchors: number[] = [];
  for (let i = 0; i + 1 < src.length; i += 2) anchors.push(src[i], at(src[i + 1]));
  const targets = (t.notes ?? []).map((n) => ({ start: at(n.start), end: at(n.start) + n.length * sd, midi: n.midi }));
  const rate = t.rawRate as number;
  const entry: Entry = { sig, buffer: null, job: null };
  cache.set(t.id, entry);
  entry.job = runDsp('voice', {
    audio: t.rawVoice as Float32Array, sampleRate: rate, targets, key: p.key, anchors,
    length: Math.round(loopDuration(p) * rate), amount: t.voice?.tune ? 1 : 0, glide: 0.05,
  })
    .then((data) => {
      if (cache.get(t.id) === entry) entry.buffer = monoBuffer(data, rate);
    })
    .catch((err) => console.warn('Voice layer failed', err))
    .finally(() => {
      entry.job = null;
    });
  return entry.job;
}

export async function prepareVoices(p: Project): Promise<void> {
  await Promise.all(p.tracks.filter(voiceOn).map((t) => prepareVoice(p, t)));
}

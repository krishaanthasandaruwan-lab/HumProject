// A more human hum for accuracy tests: the singer is a little off-key overall, each note lands a bit
// sharp or flat, scoops up into it, wobbles (vibrato), sometimes slides into the next note without a
// break, and the timing drifts. Returns the audio and the notes that were meant.
import { rng, SR } from './signals';

export interface HumNote { midi: number; beats: number }
export interface HumStyle {
  detune?: number; // cents, whole take (singer off-key)
  jitter?: number; // cents, per note
  vibrato?: number; // cents depth
  scoop?: number; // cents below the note at its start
  legato?: number; // 0..1 chance of sliding into the next note with no break
  timing?: number; // seconds of random timing error per note
  level?: number; // peak amplitude
  noise?: number; // room noise amplitude
}

export function humTake(notes: HumNote[], bpm: number, o: HumStyle = {}, seed = 1): { audio: Float32Array; sr: number; meant: number[] } {
  const r = rng(seed);
  const beat = 60 / bpm;
  const lead = 0.6;
  const total = lead + notes.reduce((s, n) => s + n.beats, 0) * beat + 1.2;
  const audio = new Float32Array(Math.round(total * SR));
  const level = o.level ?? 0.25;
  const detune = (o.detune ?? 0) / 100;
  // Plan each note: start, end, pitch (semitones), and whether it glides from the previous one.
  let t = lead;
  const plan = notes.map((n, i) => {
    const start = t + (i ? r() * (o.timing ?? 0) : 0);
    t += n.beats * beat;
    // Nobody slides into the same note: a repeated note is hummed again with a short break ("hm-hm").
    const same = i > 0 && notes[i - 1].midi === n.midi;
    const legato = i > 0 && !same && Math.abs(r()) < (o.legato ?? 0);
    const pitch = n.midi + detune + (r() * (o.jitter ?? 0)) / 100;
    const gap = same && Math.abs(r()) < (o.legato ?? 0) ? 0.03 : 0.06 + Math.abs(r()) * 0.08;
    return { start, end: t - (legato ? 0 : gap), pitch, legato };
  });
  for (let i = 0; i < plan.length; i++) if (plan[i + 1]?.legato) plan[i].end = plan[i + 1].start;
  let phase = 0;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const s0 = Math.round(p.start * SR);
    const s1 = Math.min(audio.length, Math.round(p.end * SR));
    const from = p.legato ? plan[i - 1].pitch : p.pitch - (o.scoop ?? 0) / 100;
    const glide = p.legato ? 0.05 : 0.045;
    if (!p.legato) phase = 0;
    for (let s = s0; s < s1; s++) {
      const u = (s - s0) / SR;
      const left = (s1 - s) / SR;
      const vib = u > 0.15 ? ((o.vibrato ?? 0) / 100) * Math.sin(2 * Math.PI * 5.6 * u) : 0;
      const midi = p.pitch + (from - p.pitch) * Math.exp(-u / glide) + vib;
      phase += (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / SR;
      const attack = p.legato ? 1 : Math.min(1, u / 0.03);
      const release = plan[i + 1]?.legato ? 1 : Math.min(1, left / 0.04);
      const env = attack * release * level;
      audio[s] += env * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase) + 0.12 * Math.sin(4 * phase));
    }
  }
  const nz = o.noise ?? 0.002;
  for (let s = 0; s < audio.length; s++) audio[s] += r() * nz;
  return { audio, sr: SR, meant: notes.map((n) => n.midi) };
}

/** Note error rate: edits (missed, extra or wrong notes) needed to turn `got` into `meant`, per meant note. */
export function noteErrorRate(meant: number[], got: number[]): number {
  const d = Array.from({ length: meant.length + 1 }, (_, i) => [i, ...Array(got.length).fill(0)] as number[]);
  for (let j = 1; j <= got.length; j++) d[0][j] = j;
  for (let i = 1; i <= meant.length; i++) {
    for (let j = 1; j <= got.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (meant[i - 1] === got[j - 1] ? 0 : 1));
    }
  }
  return d[meant.length][got.length] / meant.length;
}

/** Same, but a whole-tune shift by a semitone is fine (a singer 50 cents off is equally "a bit sharp"
 * or "a bit flat": either way it is their tune, in a neighbouring key). */
export function tuneErrorRate(meant: number[], got: number[]): number {
  return Math.min(...[-1, 0, 1].map((k) => noteErrorRate(meant, got.map((m) => m + k))));
}

// Humming accuracy: human-like hums (humSynth.ts) through the real hum → notes pipeline.
import { analyzeFree } from '../src/dsp/free';
import { boostQuiet } from '../src/dsp/level';
import { humTake, tuneErrorRate, type HumNote, type HumStyle } from './humSynth';
import { rng } from './signals';

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

export function randomTune(seed: number): { notes: HumNote[]; bpm: number } {
  const r = rng(seed);
  const tonic = 55 + Math.floor(Math.abs(r()) * 10);
  const scale = Math.abs(r()) < 0.5 ? SCALES.major : SCALES.minor;
  const bpm = 80 + Math.round(Math.abs(r()) * 50);
  const notes: HumNote[] = [];
  let deg = 0;
  for (let i = 0; i < 16; i++) {
    deg = Math.max(-3, Math.min(9, deg + Math.round(r() * 2.5)));
    const oct = Math.floor(deg / 7);
    const midi = tonic + 12 * oct + scale[((deg % 7) + 7) % 7];
    const beats = [0.5, 1, 1, 1, 1.5, 2][Math.floor(Math.abs(r()) * 6)];
    notes.push({ midi, beats });
  }
  return { notes, bpm };
}

export const CONDITIONS: Record<string, HumStyle> = {
  clean: { jitter: 8, vibrato: 10, scoop: 30, legato: 0.1, timing: 0.02 },
  offkey: { detune: -42, jitter: 18, vibrato: 25, scoop: 90, legato: 0.2, timing: 0.04 },
  sharp: { detune: 38, jitter: 18, vibrato: 25, scoop: 70, legato: 0.2, timing: 0.04 },
  legato: { detune: 15, jitter: 15, vibrato: 30, scoop: 60, legato: 0.6, timing: 0.03 },
  soft: { detune: -20, jitter: 15, vibrato: 20, scoop: 60, legato: 0.3, timing: 0.04, level: 0.006, noise: 0.0012 },
};

export function bench(runs = 12, first = 0): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, style] of Object.entries(CONDITIONS)) {
    let err = 0;
    for (let k = 0; k < runs; k++) {
      const tune = randomTune(100 + first + k);
      const take = humTake(tune.notes, tune.bpm, style, 7 + first + k);
      const r = analyzeFree({ audio: boostQuiet(take.audio, take.sr), sampleRate: take.sr, kind: 'lead' });
      err += tuneErrorRate(take.meant, r.notes.map((n) => n.midi));
    }
    out[name] = +(err / runs).toFixed(3);
  }
  return out;
}

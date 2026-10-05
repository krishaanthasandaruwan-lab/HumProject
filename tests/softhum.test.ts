// Very soft humming (just above the room) must still turn into a song: the boost lifts it, and a second,
// more sensitive listen catches what the first one misses.
import { describe, expect, it } from 'vitest';
import { analyzeFree } from '../src/dsp/free';
import { boostQuiet } from '../src/dsp/level';
import { CONDITIONS, randomTune } from './humBench';
import { humTake, tuneErrorRate } from './humSynth';

describe('very soft humming', () => {
  for (const [level, noise] of [[0.002, 0.0006], [0.0012, 0.0005]]) {
    it(`is heard at level ${level} over room noise ${noise}`, () => {
      let normal = 0;
      let sensitive = 0;
      let err = 0;
      for (let k = 0; k < 3; k++) {
        const tune = randomTune(160 + k);
        const take = humTake(tune.notes, tune.bpm, { ...CONDITIONS.soft, level, noise }, 70 + k);
        const audio = boostQuiet(take.audio, take.sr);
        const a = analyzeFree({ audio, sampleRate: take.sr, kind: 'lead' });
        const b = analyzeFree({ audio, sampleRate: take.sr, kind: 'lead', sensitive: true });
        normal += a.notes.length;
        sensitive += b.notes.length;
        const best = b.notes.length > a.notes.length && b.key ? b : a;
        err += tuneErrorRate(take.meant, best.notes.map((n) => n.midi));
      }
      console.log(`level ${level} noise ${noise}: notes normal ${normal / 3}, sensitive ${sensitive / 3}, error ${(err / 3).toFixed(3)}`);
      expect(Math.max(normal, sensitive) / 3).toBeGreaterThan(10);
      expect(err / 3).toBeLessThan(0.35);
    }, 15_000); // six full DSP analyses; allow slower CI/phone-development hosts without changing accuracy checks
  }
});

// Onset times -> 16th-note grid with swing, strength (via stored residual) and RMS velocity.
import { stepDur, type DrumHit, type DrumType } from '../model/project';

export interface Quantized {
  step: number;
  /** pos − grid position, in steps; playback applies it × (1 − strength). */
  offset: number;
}

/** Nearest grid step to `pos` (in 16ths) where odd steps sit `swing` late. */
export function quantizePos(pos: number, swing = 0): Quantized {
  const base = Math.floor(pos);
  let best: Quantized = { step: base, offset: Infinity };
  for (let k = base - 1; k <= base + 2; k++) {
    const g = k + (((k % 2) + 2) % 2 === 1 ? swing : 0);
    const off = pos - g;
    if (Math.abs(off) < Math.abs(best.offset)) best = { step: k, offset: off };
  }
  return best;
}

export const secondsToSteps = (t: number, bpm: number): number => t / stepDur(bpm);

/** RMS -> velocity 0.4..1.0 over a 24 dB range below the loudest hit. */
export function velocityFromRms(rms: number, maxRms: number): number {
  if (maxRms <= 0) return 0.8;
  const db = 20 * Math.log10(Math.max(rms, 1e-9) / maxRms);
  return Math.min(1, Math.max(0.4, 0.4 + 0.6 * (1 + db / 24)));
}

export interface TimedHit {
  time: number; // seconds from loop start
  type: DrumType;
  rms: number;
}

/** Quantize hits into the loop; same step + same drum -> keep the louder one. */
export function hitsToGrid(hits: TimedHit[], bpm: number, steps: number, swing = 0): DrumHit[] {
  const maxRms = hits.reduce((m, h) => Math.max(m, h.rms), 0);
  const best = new Map<string, { hit: DrumHit; rms: number }>();
  for (const h of hits) {
    const q = quantizePos(secondsToSteps(h.time, bpm), swing);
    if (q.step < 0 || q.step >= steps) continue;
    const key = `${q.step}:${h.type}`;
    const prev = best.get(key);
    if (!prev || h.rms > prev.rms) {
      best.set(key, {
        hit: { step: q.step, type: h.type, velocity: velocityFromRms(h.rms, maxRms), offset: q.offset },
        rms: h.rms,
      });
    }
  }
  return [...best.values()].map((b) => b.hit).sort((a, b) => a.step - b.step || a.type.localeCompare(b.type));
}

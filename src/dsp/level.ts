// Loudness helpers that make soft humming count, on any phone and in any room.

/** Lift a quiet take so analysis (and the voice layer) hears soft humming: the loudest tenth of
 * 20 ms frames lands near -20 dBFS. Never turns a take down; at most +30 dB; peaks stay below 0.98. */
export function boostQuiet(audio: Float32Array, sampleRate: number): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(sampleRate * 0.02));
  const frames: number[] = [];
  let peak = 0;
  for (let s = 0; s + n <= audio.length; s += n) {
    let e = 0;
    for (let i = s; i < s + n; i++) {
      e += audio[i] * audio[i];
      peak = Math.max(peak, Math.abs(audio[i]));
    }
    frames.push(Math.sqrt(e / n));
  }
  const out = new Float32Array(audio);
  if (!frames.length || peak === 0) return out;
  frames.sort((a, b) => a - b);
  const loud = frames[Math.floor(frames.length * 0.9)];
  const gain = Math.min(31.6, 0.1 / Math.max(loud, 1e-6), 0.98 / peak);
  if (gain <= 1.05) return out;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

/** Live "is someone humming?" for the mic screen: follows the room's noise floor and the loudest
 * humming so far, so a soft hummer on a quiet phone mic still counts. */
export class LevelGate {
  private floor = -1;
  private peak = 0;

  update(level: number, dt: number): { loud: boolean; meter: number } {
    if (this.floor < 0) this.floor = level;
    else if (level < this.floor) this.floor += (level - this.floor) * Math.min(1, dt * 8); // falls fast
    else this.floor += (level - this.floor) * Math.min(1, dt * 0.08); // rises slowly
    this.peak = Math.max(level, this.peak * Math.exp(-dt / 10));
    const threshold = Math.max(0.0012, this.floor * 2.2, this.peak * 0.1);
    return { loud: level > threshold, meter: Math.min(1, level / Math.max(0.004, this.peak)) };
  }
}

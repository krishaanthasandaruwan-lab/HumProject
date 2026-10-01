// Melodic voices. The original four live here — bass (saw + LPF env), lead (square + vibrato),
// keys (2-op FM), pad (3 detuned saws); more oscillator voices are in voices.ts and the
// sample-by-sample rendered ones (piano, guitar, bells…) in rendered.ts.
import { adsr, osc, run } from './env';
import { mtof } from './fx';
import { cachedBuffer } from './renderCache';
import { RENDERED, type RenderedSpec } from './rendered';
import { OSC_VOICES } from './voices';
import { OSC_VOICES_2 } from './voices2';

function bass(ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number): void {
  const saw = osc(ctx, 'sawtooth', f);
  const sub = osc(ctx, 'square', f / 2);
  const subG = ctx.createGain();
  subG.gain.value = 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(300 + 1700 * vel, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.28);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.42 * vel, 0.004, 0.2, 0.7, 0.06);
  saw.connect(lp);
  sub.connect(subG).connect(lp);
  lp.connect(g).connect(out);
  run([saw, sub], t, end);
}

function lead(ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number): void {
  const sq = osc(ctx, 'square', f);
  const lfo = osc(ctx, 'sine', 5.6);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(22, t + 0.35); // delayed vibrato, ±22 cents
  lfo.connect(depth).connect(sq.detune);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  lp.Q.value = 1.2;
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.16 * vel, 0.012, 0.12, 0.8, 0.12);
  sq.connect(lp).connect(g).connect(out);
  run([sq, lfo], t, end);
}

function keys(ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number): void {
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f); // 1:1 ratio, bright attack that mellows as the index decays
  const index = ctx.createGain();
  index.gain.setValueAtTime(f * (1.2 + 2 * vel), t);
  index.gain.exponentialRampToValueAtTime(f * 0.12, t + 1.1);
  mod.connect(index).connect(car.frequency);
  const g = ctx.createGain();
  const hold = Math.min(dur, 2.5);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.24 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.075 * vel, t + 0.004 + Math.max(0.05, hold));
  g.gain.setValueAtTime(0.075 * vel, t + 0.004 + Math.max(0.05, hold));
  g.gain.linearRampToValueAtTime(0, t + hold + 0.3);
  car.connect(g).connect(out);
  run([car, mod], t, t + hold + 0.3);
}

function pad(ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.linearRampToValueAtTime(2200, t + 0.6);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.11 * vel, 0.35, 0.4, 0.85, 0.7);
  const oscs = [-9, 0, 9].map((d) => osc(ctx, 'sawtooth', f, d));
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
}

const VOICES: Record<string, typeof bass> = { bass, lead, keys, pad, ...OSC_VOICES, ...OSC_VOICES_2 };

/** A pre-rendered note: the buffer, faded out after note-off unless the instrument rings on. */
function playBuffer(ctx: BaseAudioContext, out: AudioNode, spec: RenderedSpec, buf: AudioBuffer, t: number, dur: number, vel: number): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const level = spec.gain * (0.35 + 0.65 * vel);
  g.gain.setValueAtTime(level, t);
  let head: AudioNode = src;
  if (spec.dynamicTone) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(ctx.sampleRate * 0.45, 1800 + 9000 * vel * vel);
    src.connect(lp);
    head = lp;
  }
  head.connect(g).connect(out);
  src.start(t);
  const off = t + Math.max(0.05, dur);
  if (!spec.ring && off < t + buf.duration) {
    g.gain.setValueAtTime(level, off);
    g.gain.linearRampToValueAtTime(0, off + spec.release);
    src.stop(off + spec.release + 0.02);
  }
}

export function playNote(
  ctx: BaseAudioContext, out: AudioNode, id: string, midi: number, t: number, dur: number, vel: number,
): void {
  const v = Math.max(0.05, Math.min(1, vel));
  const spec = RENDERED[id];
  if (spec) {
    const buf = cachedBuffer(id, midi);
    if (buf) return playBuffer(ctx, out, spec, buf, t, dur, v);
    id = spec.stand_in; // not rendered yet: a similar oscillator voice for now
  }
  const voice = VOICES[id] ?? lead;
  voice(ctx, out, mtof(midi), t, dur, v);
}

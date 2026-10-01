// Building blocks shared by the oscillator voices: envelopes, oscillators, vibrato.

/** Piecewise-linear ADSR. Returns the time the voice is silent. */
export function adsr(p: AudioParam, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number): number {
  const rel = t + Math.max(dur, 0.02);
  p.setValueAtTime(0, t);
  let v: number;
  if (rel <= t + a) {
    v = peak * ((rel - t) / a);
    p.linearRampToValueAtTime(v, rel);
  } else {
    p.linearRampToValueAtTime(peak, t + a);
    if (rel <= t + a + d) {
      v = peak - (peak - peak * s) * ((rel - t - a) / d);
      p.linearRampToValueAtTime(v, rel);
    } else {
      v = peak * s;
      p.linearRampToValueAtTime(v, t + a + d);
      p.setValueAtTime(v, rel);
    }
  }
  p.linearRampToValueAtTime(0, rel + r);
  return rel + r;
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  return o;
}

export function run(nodes: AudioScheduledSourceNode[], t: number, end: number): void {
  for (const n of nodes) {
    n.start(t);
    n.stop(end + 0.05);
  }
}

/** Delayed vibrato on the given detune params: an LFO fading in after `delay`. Returns the LFO. */
export function vibrato(ctx: BaseAudioContext, targets: AudioParam[], t: number, rate: number, cents: number, delay: number): OscillatorNode {
  const lfo = osc(ctx, 'sine', rate);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.setValueAtTime(0, t + delay);
  depth.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
  lfo.connect(depth);
  for (const p of targets) depth.connect(p);
  return lfo;
}

/** Pitch scoop into the note: detune starts `cents` off and settles over `time`. */
export function scoop(targets: AudioParam[], t: number, cents: number, time: number): void {
  for (const p of targets) {
    const base = p.value;
    p.setValueAtTime(base + cents, t);
    p.linearRampToValueAtTime(base, t + time);
  }
}

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** Cached PeriodicWave per context (cosine terms in `real`, sine terms in `imag`). */
export function periodicWave(ctx: BaseAudioContext, id: string, make: () => { real: number[]; imag: number[] }): PeriodicWave {
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(id);
  if (!w) {
    const { real, imag } = make();
    w = ctx.createPeriodicWave(Float32Array.from(real), Float32Array.from(imag));
    m.set(id, w);
  }
  return w;
}

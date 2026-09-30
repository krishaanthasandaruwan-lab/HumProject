// Shared per-context resources: noise, reverb impulse, bit-crush curve.
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const irCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 1 s of white noise (deterministic seed so renders are repeatable). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = (s / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

/** Noise source starting at a random point of the shared noise buffer. */
export function noiseSource(ctx: BaseAudioContext, t: number, dur: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(t, Math.random() * 0.9);
  src.stop(t + dur);
  return src;
}

/** Generated stereo impulse response: exponentially decaying noise. */
export function reverbIR(ctx: BaseAudioContext, seconds = 2.4, decay = 3.2): AudioBuffer {
  let b = irCache.get(ctx);
  if (!b) {
    const n = Math.round(seconds * ctx.sampleRate);
    b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let s = 777 + c * 999;
      for (let i = 0; i < n; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const env = Math.pow(1 - i / n, decay);
        d[i] = ((s / 4294967296) * 2 - 1) * env * (i < 0.004 * ctx.sampleRate ? 0.2 : 1);
      }
    }
    irCache.set(ctx, b);
  }
  return b;
}

/** Staircase transfer curve: quantizes amplitude to `bits` bits (lo-fi). */
export function crushCurve(bits: number, size = 4096): Float32Array<ArrayBuffer> {
  const steps = Math.pow(2, bits - 1);
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  return c;
}

/** Soft saturation curve for kick drive. */
export function driveCurve(amount: number, size = 2048): Float32Array<ArrayBuffer> {
  const k = 1 + amount * 8;
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

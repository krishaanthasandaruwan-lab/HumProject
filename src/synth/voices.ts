// More oscillator voices: strings, flute, brass, organ, choir, supersaw, 8-bit, 808 and sub bass.
// Each schedules its own nodes and stops them; levels are matched to the original four voices.
import { adsr, osc, periodicWave, run, scoop, vibrato } from './env';
import { driveCurve, noiseSource } from './fx';

type Voice = (ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number) => void;

function lowpass(ctx: BaseAudioContext, hz: number, q = 0.7): BiquadFilterNode {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(hz, ctx.sampleRate * 0.45);
  lp.Q.value = q;
  return lp;
}

const strings: Voice = (ctx, out, f, t, dur, vel) => {
  const lp = lowpass(ctx, 1500 + 2000 * vel);
  lp.frequency.setValueAtTime(lp.frequency.value * 0.55, t);
  lp.frequency.linearRampToValueAtTime(lp.frequency.value, t + 0.5);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.065 * vel, 0.2, 0.3, 0.9, 0.45);
  const oscs = [-11, -4, 4, 11].map((d) => osc(ctx, 'sawtooth', f, d));
  const lfo = vibrato(ctx, oscs.map((o) => o.detune), t, 5.3, 9, 0.3);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run([...oscs, lfo], t, end);
};

const flute: Voice = (ctx, out, f, t, dur, vel) => {
  const tone = osc(ctx, 'triangle', f);
  const over = osc(ctx, 'sine', f * 2);
  const overG = ctx.createGain();
  overG.gain.value = 0.12;
  scoop([tone.detune, over.detune], t, -35, 0.07);
  const lfo = vibrato(ctx, [tone.detune, over.detune], t, 5, 14, 0.25);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.24 * vel, 0.06, 0.1, 0.85, 0.12);
  tone.connect(g);
  over.connect(overG).connect(g);
  // Breath: band-passed noise, strongest at the attack.
  const breath = noiseSource(ctx, t, end - t + 0.05);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(8000, f * 2.2);
  bp.Q.value = 1.4;
  const bg = ctx.createGain();
  adsr(bg.gain, t, dur, 0.05 * vel, 0.03, 0.12, 0.3, 0.1);
  breath.connect(bp).connect(bg).connect(out);
  g.connect(out);
  run([tone, over, lfo], t, end);
};

const brass: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [-6, 6].map((d) => osc(ctx, 'sawtooth', f, d));
  scoop(oscs.map((o) => o.detune), t, -22, 0.05);
  const lp = lowpass(ctx, f * 1.5, 1.4);
  const open = Math.min(9000, f * (4 + 6 * vel));
  lp.frequency.setValueAtTime(f * 1.5, t);
  lp.frequency.linearRampToValueAtTime(open, t + 0.06);
  lp.frequency.exponentialRampToValueAtTime(Math.min(open, f * 3.2), t + 0.45);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.13 * vel, 0.035, 0.2, 0.8, 0.1);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

const organ: Voice = (ctx, out, f, t, dur) => {
  const wave = periodicWave(ctx, 'organ', () => {
    const imag = new Array<number>(9).fill(0);
    [[1, 1], [2, 0.8], [3, 0.6], [4, 0.5], [6, 0.3], [8, 0.25]].forEach(([h, a]) => { imag[h] = a; });
    return { real: new Array<number>(9).fill(0), imag };
  });
  const oscs = [0, 7].map((d) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = f;
    o.detune.value = d;
    return o;
  });
  const lfo = vibrato(ctx, oscs.map((o) => o.detune), t, 6.4, 6, 0);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.075, 0.006, 0.05, 1, 0.06);
  for (const o of oscs) o.connect(g);
  g.connect(out);
  run([...oscs, lfo], t, end);
};

const choir: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [-7, 7].map((d) => osc(ctx, 'sawtooth', f, d));
  const lfo = vibrato(ctx, oscs.map((o) => o.detune), t, 5, 12, 0.2);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.55 * vel, 0.25, 0.3, 0.9, 0.5);
  // "Aah": three formant band-passes.
  for (const [hz, gain, q] of [[800, 1, 8], [1150, 0.5, 9], [2900, 0.25, 11]]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = gain;
    for (const o of oscs) o.connect(bp);
    bp.connect(fg).connect(g);
  }
  g.connect(out);
  run([...oscs, lfo], t, end);
};

const supersaw: Voice = (ctx, out, f, t, dur, vel) => {
  const lp = lowpass(ctx, 1200 + 4800 * vel, 0.8);
  lp.frequency.setValueAtTime(lp.frequency.value, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(800, lp.frequency.value * 0.5), t + 0.3);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.045 * vel, 0.008, 0.25, 0.8, 0.18);
  const oscs = [-23, -14, -7, 0, 7, 14, 23].map((d) => osc(ctx, 'sawtooth', f, d));
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

const chip: Voice = (ctx, out, f, t, dur, vel) => {
  const wave = periodicWave(ctx, 'pulse25', () => {
    const real = [0];
    for (let n = 1; n <= 32; n++) real.push((2 / (n * Math.PI)) * Math.sin(Math.PI * n * 0.25));
    return { real, imag: new Array<number>(real.length).fill(0) };
  });
  const o = ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.value = f;
  const lfo = vibrato(ctx, [o.detune], t, 6, 18, 0.15);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.16 * vel, 0.002, 0.05, 0.7, 0.03);
  o.connect(g).connect(out);
  run([o, lfo], t, end);
};

const driven = new WeakMap<BaseAudioContext, Float32Array<ArrayBuffer>>();

const bass808: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sine', f);
  o.frequency.setValueAtTime(f * Math.pow(2, 3 / 12), t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.6 * vel, 0.004, 0.6, 0.6, 0.12);
  // Saturation adds the harmonics that make an 808 audible on a phone speaker.
  const sh = ctx.createWaveShaper();
  let curve = driven.get(ctx);
  if (!curve) driven.set(ctx, (curve = driveCurve(0.5)));
  sh.curve = curve;
  const trim = ctx.createGain();
  trim.gain.value = 0.75;
  o.connect(g).connect(sh).connect(trim).connect(out);
  run([o], t, end);
};

const sub: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sine', f);
  const o2 = osc(ctx, 'sine', f * 2);
  const g2 = ctx.createGain();
  g2.gain.value = 0.22;
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.45 * vel, 0.006, 0.15, 0.85, 0.07);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(out);
  run([o, o2], t, end);
};

export const OSC_VOICES: Record<string, Voice> = { strings, flute, brass, organ, choir, supersaw, chip, bass808, sub };

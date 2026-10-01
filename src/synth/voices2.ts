// Still more oscillator voices: acid, wobble and reese bass; clarinet, sax, violin, accordion, pan
// flute, whistle, harmonica; synth brass and a poly synth. Same contract as voices.ts.
import { adsr, osc, periodicWave, run, scoop, vibrato } from './env';
import { noiseSource } from './fx';

type Voice = (ctx: BaseAudioContext, out: AudioNode, f: number, t: number, dur: number, vel: number) => void;

function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = Math.min(hz, ctx.sampleRate * 0.45);
  b.Q.value = q;
  return b;
}

/** Odd harmonics only (a clarinet's hollow tone). */
const hollow = (ctx: BaseAudioContext): PeriodicWave => periodicWave(ctx, 'hollow', () => {
  const imag = new Array<number>(16).fill(0);
  for (let h = 1; h < 16; h += 2) imag[h] = 1 / h;
  return { real: new Array<number>(16).fill(0), imag };
});

function waveOsc(ctx: BaseAudioContext, wave: PeriodicWave, f: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.value = f;
  o.detune.value = detune;
  return o;
}

const acid: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sawtooth', f);
  const lp = filter(ctx, 'lowpass', 300, 12);
  lp.frequency.setValueAtTime(300 + 2600 * vel, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.22);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.405 * vel, 0.003, 0.15, 0.6, 0.04);
  o.connect(lp).connect(g).connect(out);
  run([o], t, end);
};

const wobble: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [osc(ctx, 'sawtooth', f, -8), osc(ctx, 'square', f, 8)];
  const lp = filter(ctx, 'lowpass', 600, 6);
  const lfo = osc(ctx, 'sine', 3);
  const depth = ctx.createGain();
  depth.gain.value = 500;
  lfo.connect(depth).connect(lp.frequency);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.195 * vel, 0.01, 0.1, 0.9, 0.06);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run([...oscs, lfo], t, end);
};

const reese: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [-14, 0, 14].map((d) => osc(ctx, 'sawtooth', f, d));
  const lp = filter(ctx, 'lowpass', 900, 1.2);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.23 * vel, 0.01, 0.2, 0.85, 0.08);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

const clarinet: Voice = (ctx, out, f, t, dur, vel) => {
  const o = waveOsc(ctx, hollow(ctx), f);
  const lfo = vibrato(ctx, [o.detune], t, 5, 8, 0.35);
  const lp = filter(ctx, 'lowpass', 2400 + 1600 * vel);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.121 * vel, 0.04, 0.1, 0.9, 0.08);
  o.connect(lp).connect(g).connect(out);
  run([o, lfo], t, end);
};

const sax: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sawtooth', f);
  scoop([o.detune], t, -60, 0.08);
  const lfo = vibrato(ctx, [o.detune], t, 5.4, 16, 0.3);
  const bp = filter(ctx, 'bandpass', Math.min(2600, f * 3), 0.9);
  const lp = filter(ctx, 'lowpass', 3500 + 2500 * vel, 1);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.375 * vel, 0.03, 0.15, 0.85, 0.08);
  o.connect(bp).connect(lp).connect(g).connect(out);
  run([o, lfo], t, end);
};

const violin: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sawtooth', f);
  const lfo = vibrato(ctx, [o.detune], t, 5.8, 18, 0.25);
  const body = filter(ctx, 'peaking', 2800, 1.5);
  body.gain.value = 6;
  const lp = filter(ctx, 'lowpass', 5000 + 2000 * vel);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.176 * vel, 0.09, 0.2, 0.9, 0.18);
  o.connect(body).connect(lp).connect(g).connect(out);
  run([o, lfo], t, end);
};

const accordion: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [-9, 9].map((d) => osc(ctx, 'square', f, d));
  const lp = filter(ctx, 'lowpass', 2600, 1);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.085 * vel, 0.03, 0.1, 0.9, 0.06);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

const panflute: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sine', f);
  const lfo = vibrato(ctx, [o.detune], t, 4.6, 10, 0.3);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.156 * vel, 0.07, 0.1, 0.8, 0.15);
  o.connect(g).connect(out);
  const breath = noiseSource(ctx, t, end - t + 0.05);
  const bp = filter(ctx, 'bandpass', Math.min(9000, f * 3), 2);
  const bg = ctx.createGain();
  adsr(bg.gain, t, dur, 0.08 * vel, 0.05, 0.2, 0.25, 0.1);
  breath.connect(bp).connect(bg).connect(out);
  run([o, lfo], t, end);
};

const whistle: Voice = (ctx, out, f, t, dur, vel) => {
  const o = osc(ctx, 'sine', f * 2);
  scoop([o.detune], t, -40, 0.06);
  const lfo = vibrato(ctx, [o.detune], t, 5.8, 14, 0.2);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.149 * vel, 0.03, 0.1, 0.85, 0.08);
  o.connect(g).connect(out);
  run([o, lfo], t, end);
};

const harmonica: Voice = (ctx, out, f, t, dur, vel) => {
  const o = waveOsc(ctx, hollow(ctx), f);
  const o2 = osc(ctx, 'sawtooth', f, 6);
  const mix = ctx.createGain();
  mix.gain.value = 0.35;
  const bp = filter(ctx, 'bandpass', Math.min(3000, f * 2.5), 0.8);
  // Tremolo inside the envelope: the level swings between 70% and 100% of the note, never on its own.
  const trem = osc(ctx, 'sine', 6);
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0.15;
  const tremGain = ctx.createGain();
  tremGain.gain.value = 0.85;
  trem.connect(tremDepth).connect(tremGain.gain);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.24 * vel, 0.02, 0.1, 0.85, 0.06);
  o.connect(bp);
  o2.connect(mix).connect(bp);
  bp.connect(tremGain).connect(g).connect(out);
  run([o, o2, trem], t, end);
};

const synthbrass: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [-10, 10].map((d) => osc(ctx, 'sawtooth', f, d));
  const lp = filter(ctx, 'lowpass', 600, 2);
  lp.frequency.setValueAtTime(600, t);
  lp.frequency.linearRampToValueAtTime(2200 + 3000 * vel, t + 0.08);
  lp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.13 * vel, 0.02, 0.3, 0.75, 0.12);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

const polysynth: Voice = (ctx, out, f, t, dur, vel) => {
  const oscs = [osc(ctx, 'sawtooth', f, -6), osc(ctx, 'square', f, 6), osc(ctx, 'sawtooth', f * 2, 0)];
  const lp = filter(ctx, 'lowpass', 2000, 3);
  lp.frequency.setValueAtTime(5000 * vel + 800, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
  const g = ctx.createGain();
  const end = adsr(g.gain, t, dur, 0.11 * vel, 0.004, 0.3, 0.55, 0.2);
  for (const o of oscs) o.connect(lp);
  lp.connect(g).connect(out);
  run(oscs, t, end);
};

export const OSC_VOICES_2: Record<string, Voice> = {
  acid, wobble, reese, clarinet, sax, violin, accordion, panflute, whistle, harmonica, synthbrass, polysynth,
};

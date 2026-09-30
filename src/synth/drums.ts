// Synthesized drum voices — no samples. Every voice schedules its own nodes and stops them.
import { driveCurve, noiseSource } from './fx';

export interface KickParams { startHz: number; endHz: number; pitchTime: number; decay: number; click: number; drive: number; gain: number }
export interface SnareParams { bandHz: number; q: number; decay: number; toneHz: number; toneDecay: number; noise: number; tone: number; clap: number; gain: number }
export interface HatParams { hpHz: number; decay: number; openDecay: number; gain: number; ring?: number }

const FLOOR = 0.0001;

/** Percussive envelope: fast exponential attack, exponential decay. */
function perc(g: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  g.setValueAtTime(FLOOR, t);
  g.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), t + attack);
  g.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
}

const driveCache = new Map<number, Float32Array<ArrayBuffer>>();
function cachedDrive(amount: number): Float32Array<ArrayBuffer> {
  const k = Math.round(amount * 20) / 20;
  let c = driveCache.get(k);
  if (!c) driveCache.set(k, (c = driveCurve(k)));
  return c;
}

/** Sine with a pitch drop (150→45 Hz style), fast decay and a click on the attack. */
export function playKick(ctx: BaseAudioContext, out: AudioNode, t: number, vel: number, p: KickParams): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(p.startHz, t);
  osc.frequency.exponentialRampToValueAtTime(p.endHz, t + p.pitchTime);
  const g = ctx.createGain();
  perc(g.gain, t, vel * p.gain, 0.002, p.decay);
  osc.connect(g);
  if (p.drive > 0) {
    const sh = ctx.createWaveShaper();
    sh.curve = cachedDrive(p.drive);
    const trim = ctx.createGain();
    trim.gain.value = 1 / (1 + p.drive * 0.8);
    g.connect(sh).connect(trim).connect(out);
  } else {
    g.connect(out);
  }
  osc.start(t);
  osc.stop(t + p.decay + 0.05);
  if (p.click > 0) {
    const n = noiseSource(ctx, t, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const cg = ctx.createGain();
    perc(cg.gain, t, vel * p.click * 0.5, 0.0005, 0.01);
    n.connect(hp).connect(cg).connect(out);
  }
}

/** Band-passed noise (1.8 kHz) + a triangle body (~180 Hz), optional clap layer. */
export function playSnare(ctx: BaseAudioContext, out: AudioNode, t: number, vel: number, p: SnareParams): void {
  if (p.noise > 0) {
    const n = noiseSource(ctx, t, p.decay + 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.bandHz;
    bp.Q.value = p.q;
    const g = ctx.createGain();
    perc(g.gain, t, vel * p.noise * p.gain, 0.001, p.decay);
    n.connect(bp).connect(g).connect(out);
  }
  if (p.tone > 0) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(p.toneHz * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(p.toneHz, t + 0.03);
    const g = ctx.createGain();
    perc(g.gain, t, vel * p.tone * p.gain, 0.001, p.toneDecay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + p.toneDecay + 0.05);
  }
  if (p.clap > 0) playClap(ctx, out, t, vel * p.clap * p.gain);
}

/** High-passed noise (7 kHz), 0.05 s closed / 0.3 s open, optional metallic ring. */
export function playHat(ctx: BaseAudioContext, out: AudioNode, t: number, vel: number, p: HatParams, open = false): void {
  const d = open ? p.openDecay : p.decay;
  const n = noiseSource(ctx, t, d + 0.05);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = p.hpHz;
  const g = ctx.createGain();
  perc(g.gain, t, vel * p.gain, 0.0008, d);
  n.connect(hp).connect(g).connect(out);
  if (p.ring) {
    // 808-style: detuned square partials through a band-pass.
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 10000;
    bp.Q.value = 0.8;
    const rg = ctx.createGain();
    perc(rg.gain, t, vel * p.gain * p.ring * 0.5, 0.0008, d * 0.9);
    bp.connect(rg).connect(out);
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 40 * r * 10;
      o.connect(bp);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }
}

/** Three quick noise bursts then a tail. */
export function playClap(ctx: BaseAudioContext, out: AudioNode, t: number, level: number): void {
  const n = noiseSource(ctx, t, 0.3);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1300;
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(FLOOR, t);
  for (let i = 0; i < 3; i++) {
    const ti = t + i * 0.011;
    g.gain.setValueAtTime(level * 1.6, ti);
    g.gain.exponentialRampToValueAtTime(level * 0.3, ti + 0.009);
  }
  const tail = t + 0.033;
  g.gain.setValueAtTime(level * 1.4, tail);
  g.gain.exponentialRampToValueAtTime(FLOOR, tail + 0.2);
  n.connect(bp).connect(g).connect(out);
}

/** Pitched sine tom. */
export function playTom(ctx: BaseAudioContext, out: AudioNode, t: number, vel: number, hz = 110): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(hz * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.07);
  const g = ctx.createGain();
  perc(g.gain, t, vel * 0.8, 0.002, 0.35);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
}

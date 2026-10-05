// Offline rendering: the full-band mix (OfflineAudioContext) and the raw-voice mix.
import { STEPS_PER_BAR, stepDur, totalSteps, trackGain, type Project } from '../model/project';
import { MASTER_GAIN, makeLimiter } from './context';
import { createBus, scheduleStep, type TrackBus } from './engine';
import { prepareProject } from './prepare';

export interface RenderOptions {
  sampleRate?: number;
  bars?: number; // bars per pass (defaults to the whole loop)
  loops?: number;
  tail?: number; // seconds of release after the last pass
}

type OfflineCtor = typeof OfflineAudioContext;
const Offline = (): OfflineCtor =>
  window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: OfflineCtor }).webkitOfflineAudioContext;

export async function renderMix(p: Project, o: RenderOptions = {}): Promise<AudioBuffer> {
  await prepareProject(p); // rendered instruments + voice layers must be ready for the bounce
  const sr = o.sampleRate ?? 44100;
  const steps = Math.min(totalSteps(p), (o.bars ?? p.bars) * STEPS_PER_BAR);
  const loops = o.loops ?? 1;
  const tail = o.tail ?? 1.2;
  const sd = stepDur(p.bpm);
  const Ctx = Offline();
  const frames = Math.ceil((loops * steps * sd + tail) * sr);
  if (!Number.isFinite(frames) || frames <= 0 || frames * 8 > 128 * 1024 * 1024) throw new Error('This song is too long to export. Shorten it or increase its tempo.');
  const ctx = new Ctx(2, frames, sr);
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(makeLimiter(ctx)).connect(ctx.destination);
  const buses = new Map<string, TrackBus>();
  for (const t of p.tracks) buses.set(t.id, createBus(ctx, t, master, trackGain(p, t)));
  const loopSteps = totalSteps(p);
  for (let n = 0; n < loops * steps; n++) scheduleStep(ctx, p, buses, n % loopSteps, n * sd);
  return ctx.startRendering();
}

export function hasVoice(p: Project): boolean {
  return p.tracks.some((t) => t.rawVoice && t.rawVoice.length > 0 && t.rawRate);
}

/** All recorded voice layers mixed (looped, resampled), peak-normalised — "what I recorded". */
export function voiceMix(p: Project, bars: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const len = Math.round(bars * STEPS_PER_BAR * stepDur(p.bpm) * sampleRate);
  const out = new Float32Array(len);
  for (const t of p.tracks) {
    const src = t.rawVoice;
    if (!src || !src.length || !t.rawRate || t.muted) continue;
    const ratio = t.rawRate / sampleRate;
    for (let i = 0; i < len; i++) {
      const x = i * ratio;
      const i0 = Math.floor(x) % src.length;
      const frac = x - Math.floor(x);
      out[i] += src[i0] * (1 - frac) + src[(i0 + 1) % src.length] * frac;
    }
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? Math.min(6, 0.9 / peak) : 1;
  const fade = Math.min(len, Math.round(0.01 * sampleRate));
  for (let i = 0; i < len; i++) {
    const edge = Math.min(1, i / fade, (len - 1 - i) / fade);
    out[i] *= gain * edge;
  }
  return out;
}

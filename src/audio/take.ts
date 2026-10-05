// One recording pass: count-in, click, capture, latency compensation.
import { getMaster, outputLatency, setAudioSession } from './context';
import { CLICK_HZ, Metronome, planTake, type TakePlan } from './metronome';
import { MicRecorder } from './recorder';

export interface Take {
  /** Mono audio from (loop start − preroll) to (loop end + tail). */
  audio: Float32Array<ArrayBuffer>;
  sampleRate: number;
  preroll: number;
  tail: number;
  /** Round-trip latency that was compensated (seconds). */
  latency: number;
  /** The click's tones if it played during the take (without headphones they leak into the mic). */
  clickTones: number[];
}

export interface TakeOptions {
  bpm: number;
  bars: number;
  clickDuringTake: boolean;
  manualLatencyMs: number;
  prerollSec?: number;
  tailSec?: number;
  /** Called once the count-in is scheduled — use it to start the band / animate the UI. */
  onPlan?: (plan: TakePlan, mic: MicRecorder) => void;
  signal?: AbortSignal;
  maxSeconds?: number;
}

function waitForTime(ctx: BaseAudioContext, t: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + Math.max(0, t - ctx.currentTime) * 1000 + 5000;
    const tick = (): void => {
      if (signal?.aborted || document.visibilityState === 'hidden') reject(new DOMException('Recording cancelled', 'AbortError'));
      else if (performance.now() > deadline) reject(new Error('Recording was interrupted. Please try again.'));
      else if (ctx.currentTime >= t) resolve();
      else setTimeout(tick, 25);
    };
    tick();
  });
}

/** The loop-length part of a take (drops pre-roll and tail). */
export function loopAudio(take: Take): Float32Array<ArrayBuffer> {
  const s = Math.round(take.preroll * take.sampleRate);
  const e = take.audio.length - Math.round(take.tail * take.sampleRate);
  return take.audio.slice(s, Math.max(s, e));
}

export async function captureTake(o: TakeOptions): Promise<Take> {
  const preroll = o.prerollSec ?? 0.15;
  const tail = o.tailSec ?? 0.2;
  setAudioSession('play-and-record');
  let mic: MicRecorder | null = null;
  const metro = new Metronome();
  try {
    mic = await MicRecorder.open(o.signal);
    const ctx = mic.ctx;
    const plan = planTake(ctx.currentTime, o.bpm, o.bars, 4, 0.3);
    plan.recEnd = Math.min(plan.recEnd, plan.recStart + (o.maxSeconds ?? 180));
    metro.schedule(ctx, getMaster(), plan, o.clickDuringTake);
    o.onPlan?.(plan, mic);
    // What you hear is late by the output latency, and what you sing reaches us late by the
    // input latency — so the take is cut that much later than the clock says.
    const latency = Math.max(-0.2, outputLatency() + mic.inputLatency() + o.manualLatencyMs / 1000);
    await waitForTime(ctx, plan.recEnd + latency + tail + 0.06, o.signal);
    await mic.stop();
    const audio = mic.extract(plan.recStart + latency - preroll, plan.recEnd + latency + tail);
    const clickTones = o.clickDuringTake ? [CLICK_HZ.accent, CLICK_HZ.beat] : [];
    return { audio, sampleRate: ctx.sampleRate, preroll, tail, latency, clickTones };
  } finally {
    metro.stop();
    mic?.close();
    setAudioSession('playback');
  }
}

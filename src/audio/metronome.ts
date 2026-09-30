// Count-in + click track, scheduled sample-accurately on the audio clock.

export interface TakePlan {
  start: number; // context time of the first count-in click
  recStart: number; // context time of the first recorded beat
  recEnd: number;
  beatDur: number;
  beatsPerBar: number;
  countInBeats: number;
  recBeats: number;
}

export function planTake(now: number, bpm: number, bars: number, beatsPerBar = 4, lead = 0.25): TakePlan {
  const beatDur = 60 / bpm;
  const start = now + lead;
  const countInBeats = beatsPerBar;
  const recStart = start + countInBeats * beatDur;
  const recBeats = bars * beatsPerBar;
  return { start, recStart, recEnd: recStart + recBeats * beatDur, beatDur, beatsPerBar, countInBeats, recBeats };
}

export type TakePhase =
  | { phase: 'wait' }
  | { phase: 'countin'; beat: number }
  | { phase: 'rec'; beat: number; bar: number; progress: number }
  | { phase: 'done' };

export function phaseAt(plan: TakePlan, t: number): TakePhase {
  if (t < plan.start) return { phase: 'wait' };
  if (t < plan.recStart) return { phase: 'countin', beat: Math.floor((t - plan.start) / plan.beatDur) };
  if (t < plan.recEnd) {
    const b = Math.floor((t - plan.recStart) / plan.beatDur);
    return {
      phase: 'rec',
      beat: b % plan.beatsPerBar,
      bar: Math.floor(b / plan.beatsPerBar),
      progress: (t - plan.recStart) / (plan.recEnd - plan.recStart),
    };
  }
  return { phase: 'done' };
}

export function click(ctx: BaseAudioContext, dest: AudioNode, t: number, accent: boolean, volume = 0.45): OscillatorNode {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.07);
  return osc;
}

export class Metronome {
  private nodes: OscillatorNode[] = [];

  schedule(ctx: BaseAudioContext, dest: AudioNode, plan: TakePlan, clickDuringTake: boolean, volume = 0.45): void {
    for (let i = 0; i < plan.countInBeats; i++) {
      this.nodes.push(click(ctx, dest, plan.start + i * plan.beatDur, i % plan.beatsPerBar === 0, volume));
    }
    if (!clickDuringTake) return;
    for (let i = 0; i < plan.recBeats; i++) {
      this.nodes.push(click(ctx, dest, plan.recStart + i * plan.beatDur, i % plan.beatsPerBar === 0, volume * 0.75));
    }
  }

  stop(): void {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes = [];
  }
}

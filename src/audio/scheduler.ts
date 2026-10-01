// Lookahead loop scheduler: a 25 ms timer schedules every step that starts in the next 100 ms
// on the audio clock, so timing never drifts even if the UI thread stutters.
import { loopDuration, stepDur, totalSteps, trackGain, type Project } from '../model/project';
import { getCtx, getMaster, outputLatency } from './context';
import { createBus, scheduleStep, type TrackBus } from './engine';
import { prepareProject } from './prepare';

const TICK_MS = 25;
const AHEAD = 0.1;
const LEAD = 0.05; // extra headroom for hits played slightly ahead of the grid

export class Player {
  playing = false;
  private timer = 0;
  private anchorTime = 0;
  private anchorStep = 0;
  private anchorBpm = 90;
  private nextStep = 0;
  private buses = new Map<string, TrackBus>();

  constructor(private readonly project: () => Project, private readonly dest: () => AudioNode = getMaster) {}

  /** Start looping; step 0 sounds at `at` (audio clock), default: right away. */
  start(at?: number): void {
    if (this.playing) this.stop();
    const ctx = getCtx();
    const p = this.project();
    void prepareProject(p).catch(() => undefined); // usually ready already; stand-ins cover the gap
    this.anchorTime = at ?? ctx.currentTime + 0.06;
    this.anchorStep = 0;
    this.anchorBpm = p.bpm;
    this.nextStep = 0;
    this.playing = true;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const now = getCtx().currentTime;
    for (const b of this.buses.values()) {
      b.out.gain.cancelScheduledValues(now);
      b.out.gain.setTargetAtTime(0, now, 0.012);
      setTimeout(() => b.dispose(), 250);
    }
    this.buses.clear();
  }

  /** Loop-relative step that is audible right now, or -1. */
  currentStep(): number {
    if (!this.playing) return -1;
    const t = getCtx().currentTime - outputLatency();
    if (t < this.anchorTime) return -1;
    const n = this.anchorStep + Math.floor((t - this.anchorTime) / stepDur(this.anchorBpm));
    return n % totalSteps(this.project());
  }

  /** Audio-clock time at which the loop (step 0) started most recently. */
  loopStartTime(): number {
    const p = this.project();
    const now = getCtx().currentTime;
    const n = this.anchorStep + Math.floor((now - this.anchorTime) / stepDur(this.anchorBpm));
    const loopIndex = Math.floor(n / totalSteps(p));
    return this.stepTime(loopIndex * totalSteps(p));
  }

  get loopSeconds(): number {
    return loopDuration(this.project());
  }

  private stepTime(n: number): number {
    return this.anchorTime + (n - this.anchorStep) * stepDur(this.anchorBpm);
  }

  private tick(): void {
    const ctx = getCtx();
    const p = this.project();
    if (p.bpm !== this.anchorBpm) {
      // Re-anchor so a tempo change takes effect from the next step without a jump.
      this.anchorTime = this.stepTime(this.nextStep);
      this.anchorStep = this.nextStep;
      this.anchorBpm = p.bpm;
    }
    this.syncBuses(p, ctx.currentTime);
    const steps = totalSteps(p);
    const horizon = ctx.currentTime + AHEAD;
    while (this.stepTime(this.nextStep) - LEAD < horizon) {
      const t = this.stepTime(this.nextStep);
      if (t >= ctx.currentTime - 0.02) scheduleStep(ctx, p, this.buses, this.nextStep % steps, t);
      this.nextStep++;
    }
  }

  /** Keep one bus per track; rebuild when the preset changes; follow volume/mute/solo. */
  private syncBuses(p: Project, now: number): void {
    const ctx = getCtx();
    const live = new Set<string>();
    for (const t of p.tracks) {
      live.add(t.id);
      const g = trackGain(p, t);
      let bus = this.buses.get(t.id);
      if (bus && bus.preset !== t.preset) {
        const old = bus;
        old.out.gain.setTargetAtTime(0, now, 0.02);
        setTimeout(() => old.dispose(), 400);
        bus = undefined;
      }
      if (!bus) {
        bus = createBus(ctx, t, this.dest(), g);
        this.buses.set(t.id, bus);
      } else if (bus.gain !== g) {
        bus.out.gain.setTargetAtTime(g, now, 0.02);
        bus.gain = g;
      }
    }
    for (const [id, bus] of this.buses) {
      if (!live.has(id)) {
        bus.out.gain.setTargetAtTime(0, now, 0.02);
        setTimeout(() => bus.dispose(), 400);
        this.buses.delete(id);
      }
    }
  }
}

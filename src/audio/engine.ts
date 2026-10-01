// Shared by the live scheduler and the offline renderer: per-track buses + per-step event scheduling.
import { stepDur, swingOffset, trackGain, type Project, type Track, type TrackKind } from '../model/project';
import { crushCurve, reverbIR } from '../synth/fx';
import { playNote } from '../synth/instruments';
import { getInstrument, getKit, playDrum } from '../synth/kits';
import { voiceBuffer, voiceOn } from './voiceLayer';

export interface TrackBus {
  trackId: string;
  kind: TrackKind;
  preset: string;
  input: GainNode;
  out: GainNode;
  gain: number;
  dispose(): void;
}

/** voice -> input -> [kit / reverb FX] -> out (volume, mute, solo) -> dest */
export function createBus(ctx: BaseAudioContext, track: Track, dest: AudioNode, gain: number): TrackBus {
  const input = ctx.createGain();
  const out = ctx.createGain();
  out.gain.value = gain;
  const nodes: AudioNode[] = [input, out];
  if (track.kind === 'drums') {
    const kit = getKit(track.preset);
    if (kit.lofi) {
      const crush = ctx.createWaveShaper();
      crush.curve = crushCurve(kit.lofi.bits);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kit.lofi.lowpass;
      input.connect(crush).connect(lp).connect(out);
      nodes.push(crush, lp);
    } else {
      input.connect(out);
    }
  } else {
    input.connect(out);
    const inst = getInstrument(track.preset);
    if (inst.reverb > 0) {
      const conv = ctx.createConvolver();
      conv.buffer = reverbIR(ctx);
      const wet = ctx.createGain();
      wet.gain.value = inst.reverb;
      input.connect(conv).connect(wet).connect(out);
      nodes.push(conv, wet);
    }
  }
  out.connect(dest);
  return {
    trackId: track.id, kind: track.kind, preset: track.preset, input, out, gain,
    dispose: () => nodes.forEach((n) => n.disconnect()),
  };
}

/** Schedule everything that starts on `step` (loop-relative) at audio time `t` (the grid time of that step). */
export function scheduleStep(ctx: BaseAudioContext, p: Project, buses: Map<string, TrackBus>, step: number, t: number): void {
  const sd = stepDur(p.bpm);
  const loose = 1 - p.quantize;
  const tStep = t + swingOffset(step, p.swing) * sd;
  for (const track of p.tracks) {
    const bus = buses.get(track.id);
    if (!bus || trackGain(p, track) <= 0) continue;
    if (track.kind === 'drums') {
      const kit = getKit(track.preset);
      for (const hit of track.hits ?? []) {
        if (hit.step !== step) continue;
        playDrum(ctx, bus.input, hit.type, kit, Math.max(0, tStep + (hit.offset ?? 0) * loose * sd), hit.velocity);
      }
    } else {
      if (track.voice && voiceOn(track)) {
        // Your own (beat-matched, maybe auto-tuned) voice: one loop-long buffer per pass.
        const buf = step === 0 ? voiceBuffer(p, track) : null;
        if (buf) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = track.voice.level;
          src.connect(g).connect(bus.input);
          src.start(Math.max(0, tStep));
        }
        if (track.voice.only) continue; // the voice replaces the instrument
      }
      for (const n of track.notes ?? []) {
        if (n.start !== step) continue;
        const start = Math.max(0, tStep + (n.offset ?? 0) * loose * sd);
        playNote(ctx, bus.input, track.preset, n.midi, start, n.length * sd * 0.97, n.velocity);
      }
    }
  }
}

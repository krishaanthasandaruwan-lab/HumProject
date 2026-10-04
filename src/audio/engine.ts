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
  /** Your own voice comes in here: its level, then (with the voice effect on) the sweetener. */
  voice: GainNode;
  /** The voice effect is in this bus. */
  fx: boolean;
  out: GainNode;
  gain: number;
  dispose(): void;
}

/** The voice effect: rumble and mud out, a little presence and air, gentle compression and a soft room —
 * your voice, nicer to listen to. */
function voiceSweetener(ctx: BaseAudioContext, from: AudioNode, to: AudioNode, wetTo: AudioNode, nodes: AudioNode[]): void {
  const filter = (type: BiquadFilterType, hz: number, gain = 0, q = 0.7): BiquadFilterNode => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.gain.value = gain;
    f.Q.value = q;
    return f;
  };
  const hp = filter('highpass', 100);
  const mud = filter('peaking', 280, -2.5, 1);
  const presence = filter('peaking', 3200, 2.5, 0.9);
  const air = filter('highshelf', 9000, 3);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  comp.attack.value = 0.006;
  comp.release.value = 0.16;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.5;
  from.connect(hp).connect(mud).connect(presence).connect(air).connect(comp).connect(makeup).connect(to);
  const room = ctx.createConvolver();
  room.buffer = reverbIR(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  makeup.connect(room).connect(wet).connect(wetTo);
  nodes.push(hp, mud, presence, air, comp, makeup, room, wet);
}

/** instrument -> input -> [kit / reverb FX] -> out (volume, mute, solo) -> dest;
 *  voice -> voice (level) -> [sweetener] -> input */
export function createBus(ctx: BaseAudioContext, track: Track, dest: AudioNode, gain: number): TrackBus {
  const input = ctx.createGain();
  const out = ctx.createGain();
  out.gain.value = gain;
  const voice = ctx.createGain();
  voice.gain.value = track.voice?.level ?? 0.8;
  const fx = !!track.voice?.fx;
  const nodes: AudioNode[] = [input, out, voice];
  if (fx) voiceSweetener(ctx, voice, input, out, nodes);
  else voice.connect(input);
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
    trackId: track.id, kind: track.kind, preset: track.preset, input, voice, fx, out, gain,
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
          src.connect(bus.voice); // its level (and the voice effect) live on the bus
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

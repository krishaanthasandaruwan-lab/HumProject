// Drum kits are parameter sets for the synth voices; instrument presets name the melodic voices.
import type { DrumType } from '../model/project';
import { playHat, playKick, playSnare, type HatParams, type KickParams, type SnareParams } from './drums';

export interface DrumKit {
  id: string;
  name: string;
  pro: boolean;
  kick: KickParams;
  snare: SnareParams;
  hat: HatParams;
  /** Lo-fi insert on the drum bus: bit-crush + low-pass. */
  lofi?: { bits: number; lowpass: number };
}

export const KITS: readonly DrumKit[] = [
  {
    id: '808', name: '808', pro: false,
    kick: { startHz: 130, endHz: 42, pitchTime: 0.14, decay: 0.9, click: 0.3, drive: 0.25, gain: 1 },
    snare: { bandHz: 2000, q: 0.8, decay: 0.2, toneHz: 200, toneDecay: 0.08, noise: 1.4, tone: 0.3, clap: 0.8, gain: 0.8 },
    hat: { hpHz: 7500, decay: 0.05, openDecay: 0.3, gain: 0.36, ring: 0.5 },
  },
  {
    id: 'boombap', name: 'Boom-Bap', pro: false,
    kick: { startHz: 150, endHz: 48, pitchTime: 0.1, decay: 0.38, click: 0.55, drive: 0.55, gain: 1 },
    snare: { bandHz: 1800, q: 0.9, decay: 0.18, toneHz: 180, toneDecay: 0.1, noise: 1.6, tone: 0.6, clap: 0, gain: 0.9 },
    hat: { hpHz: 7000, decay: 0.05, openDecay: 0.3, gain: 0.4 },
  },
  {
    id: 'lofi', name: 'Lo-fi', pro: true,
    kick: { startHz: 140, endHz: 50, pitchTime: 0.1, decay: 0.34, click: 0.25, drive: 0.35, gain: 0.95 },
    snare: { bandHz: 1600, q: 0.8, decay: 0.16, toneHz: 185, toneDecay: 0.09, noise: 1.7, tone: 0.55, clap: 0.2, gain: 0.85 },
    hat: { hpHz: 6500, decay: 0.04, openDecay: 0.25, gain: 0.35 },
    lofi: { bits: 6, lowpass: 3400 },
  },
  {
    id: 'techno', name: 'Techno', pro: true,
    kick: { startHz: 170, endHz: 46, pitchTime: 0.08, decay: 0.5, click: 0.8, drive: 0.85, gain: 1 },
    snare: { bandHz: 1500, q: 1, decay: 0.22, toneHz: 210, toneDecay: 0.06, noise: 1.2, tone: 0.2, clap: 1, gain: 1.05 },
    hat: { hpHz: 9000, decay: 0.06, openDecay: 0.35, gain: 0.4, ring: 0.7 },
  },
];

export function getKit(id: string): DrumKit {
  return KITS.find((k) => k.id === id) ?? KITS[0];
}

export function playDrum(ctx: BaseAudioContext, out: AudioNode, type: DrumType, kit: DrumKit, t: number, vel: number): void {
  if (type === 'kick') playKick(ctx, out, t, vel, kit.kick);
  else if (type === 'snare') playSnare(ctx, out, t, vel, kit.snare);
  else playHat(ctx, out, t, vel, kit.hat);
}

export type InstrumentId = 'bass' | 'lead' | 'keys' | 'pad';

export interface InstrumentPreset {
  id: InstrumentId;
  name: string;
  /** Reverb send level on the track bus. */
  reverb: number;
}

export const INSTRUMENTS: readonly InstrumentPreset[] = [
  { id: 'bass', name: 'Bass', reverb: 0 },
  { id: 'lead', name: 'Lead', reverb: 0.18 },
  { id: 'keys', name: 'Keys', reverb: 0.22 },
  { id: 'pad', name: 'Pad', reverb: 0.45 },
];

export function getInstrument(id: string): InstrumentPreset {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}

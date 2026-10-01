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
  {
    id: 'trap', name: 'Trap', pro: true,
    kick: { startHz: 110, endHz: 38, pitchTime: 0.25, decay: 1.2, click: 0.15, drive: 0.4, gain: 1 },
    snare: { bandHz: 1800, q: 0.7, decay: 0.16, toneHz: 220, toneDecay: 0.05, noise: 0.9, tone: 0.15, clap: 1.2, gain: 0.85 },
    hat: { hpHz: 8500, decay: 0.035, openDecay: 0.25, gain: 0.32, ring: 0.6 },
  },
  {
    id: 'house', name: 'House', pro: true,
    kick: { startHz: 160, endHz: 50, pitchTime: 0.06, decay: 0.45, click: 0.6, drive: 0.5, gain: 1 },
    snare: { bandHz: 1500, q: 0.9, decay: 0.2, toneHz: 200, toneDecay: 0.05, noise: 0.8, tone: 0.1, clap: 1.1, gain: 0.9 },
    hat: { hpHz: 8000, decay: 0.045, openDecay: 0.3, gain: 0.38, ring: 0.3 },
  },
  {
    id: 'acoustic', name: 'Acoustic', pro: true,
    kick: { startHz: 120, endHz: 55, pitchTime: 0.05, decay: 0.3, click: 0.7, drive: 0.15, gain: 1 },
    snare: { bandHz: 2500, q: 0.5, decay: 0.24, toneHz: 190, toneDecay: 0.12, noise: 2, tone: 0.8, clap: 0, gain: 0.6 },
    hat: { hpHz: 6000, decay: 0.06, openDecay: 0.4, gain: 0.42 },
  },
  {
    id: 'retro', name: 'Retro 80s', pro: true,
    kick: { startHz: 140, endHz: 52, pitchTime: 0.09, decay: 0.42, click: 0.4, drive: 0.3, gain: 1 },
    snare: { bandHz: 1700, q: 0.6, decay: 0.35, toneHz: 175, toneDecay: 0.14, noise: 1.8, tone: 0.7, clap: 0.4, gain: 0.7 },
    hat: { hpHz: 7500, decay: 0.05, openDecay: 0.3, gain: 0.36, ring: 0.4 },
  },
  {
    id: 'rock', name: 'Rock', pro: true,
    kick: { startHz: 130, endHz: 52, pitchTime: 0.06, decay: 0.35, click: 0.8, drive: 0.4, gain: 0.8 },
    snare: { bandHz: 2200, q: 0.6, decay: 0.28, toneHz: 200, toneDecay: 0.1, noise: 2, tone: 0.75, clap: 0, gain: 0.6 },
    hat: { hpHz: 6500, decay: 0.07, openDecay: 0.45, gain: 0.44 },
  },
  {
    id: 'jazz', name: 'Jazz Brush', pro: true,
    kick: { startHz: 110, endHz: 58, pitchTime: 0.05, decay: 0.28, click: 0.3, drive: 0.05, gain: 1.1 },
    snare: { bandHz: 3200, q: 0.4, decay: 0.32, toneHz: 210, toneDecay: 0.05, noise: 2.2, tone: 0.2, clap: 0, gain: 0.55 },
    hat: { hpHz: 5500, decay: 0.09, openDecay: 0.5, gain: 0.52, ring: 0.8 },
  },
  {
    id: 'drill', name: 'Drill', pro: true,
    kick: { startHz: 100, endHz: 36, pitchTime: 0.3, decay: 1.4, click: 0.1, drive: 0.5, gain: 0.8 },
    snare: { bandHz: 2000, q: 0.8, decay: 0.14, toneHz: 240, toneDecay: 0.04, noise: 0.8, tone: 0.1, clap: 1.3, gain: 0.68 },
    hat: { hpHz: 9500, decay: 0.03, openDecay: 0.2, gain: 0.24, ring: 0.7 },
  },
  {
    id: 'reggaeton', name: 'Reggaeton', pro: true,
    kick: { startHz: 140, endHz: 45, pitchTime: 0.12, decay: 0.6, click: 0.4, drive: 0.45, gain: 1 },
    snare: { bandHz: 1900, q: 1, decay: 0.15, toneHz: 230, toneDecay: 0.05, noise: 1, tone: 0.3, clap: 1, gain: 0.85 },
    hat: { hpHz: 8000, decay: 0.04, openDecay: 0.25, gain: 0.34 },
  },
  {
    id: 'afro', name: 'Afrobeat', pro: true,
    kick: { startHz: 125, endHz: 55, pitchTime: 0.07, decay: 0.32, click: 0.6, drive: 0.2, gain: 1 },
    snare: { bandHz: 2600, q: 1.2, decay: 0.12, toneHz: 320, toneDecay: 0.08, noise: 1, tone: 0.9, clap: 0.3, gain: 0.7 },
    hat: { hpHz: 7000, decay: 0.05, openDecay: 0.3, gain: 0.4, ring: 0.4 },
  },
  {
    id: 'funk', name: 'Funk', pro: true,
    kick: { startHz: 135, endHz: 54, pitchTime: 0.05, decay: 0.3, click: 0.75, drive: 0.25, gain: 1 },
    snare: { bandHz: 2400, q: 0.7, decay: 0.2, toneHz: 220, toneDecay: 0.09, noise: 1.8, tone: 0.65, clap: 0.1, gain: 0.75 },
    hat: { hpHz: 7500, decay: 0.045, openDecay: 0.35, gain: 0.42 },
  },
  {
    id: 'electro', name: 'Electro', pro: true,
    kick: { startHz: 180, endHz: 44, pitchTime: 0.1, decay: 0.55, click: 0.7, drive: 0.9, gain: 1 },
    snare: { bandHz: 1300, q: 1.4, decay: 0.25, toneHz: 180, toneDecay: 0.08, noise: 1.1, tone: 0.5, clap: 0.9, gain: 0.95 },
    hat: { hpHz: 10000, decay: 0.05, openDecay: 0.28, gain: 0.36, ring: 0.9 },
  },
  {
    id: 'garage', name: 'UK Garage', pro: true,
    kick: { startHz: 150, endHz: 48, pitchTime: 0.08, decay: 0.42, click: 0.55, drive: 0.4, gain: 1 },
    snare: { bandHz: 1700, q: 0.9, decay: 0.17, toneHz: 210, toneDecay: 0.05, noise: 0.9, tone: 0.2, clap: 1.1, gain: 0.85 },
    hat: { hpHz: 8800, decay: 0.035, openDecay: 0.22, gain: 0.34, ring: 0.5 },
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

export type InstrumentRole = 'bass' | 'lead' | 'chords';

export interface InstrumentPreset {
  id: string;
  name: string;
  /** Reverb send level on the track bus. */
  reverb: number;
  pro: boolean;
  /** Which track cards offer it (first = what it is best at). */
  roles: InstrumentRole[];
  /** General MIDI program for MIDI export. */
  gm: number;
}

const I = (id: string, name: string, reverb: number, pro: boolean, roles: InstrumentRole[], gm: number): InstrumentPreset =>
  ({ id, name, reverb, pro, roles, gm });

export const INSTRUMENTS: readonly InstrumentPreset[] = [
  I('bass', 'Synth Bass', 0, false, ['bass'], 38),
  I('bass808', '808 Bass', 0, false, ['bass'], 38),
  I('sub', 'Sub Bass', 0, true, ['bass'], 38),
  I('fingerbass', 'Finger Bass', 0.05, true, ['bass'], 33),
  I('lead', 'Square Lead', 0.18, false, ['lead', 'bass'], 80),
  I('piano', 'Piano', 0.2, false, ['chords', 'lead'], 0),
  I('keys', 'E-Piano', 0.22, false, ['chords', 'lead'], 4),
  I('pad', 'Pad', 0.45, false, ['chords', 'lead'], 88),
  I('pluck', 'Guitar', 0.18, false, ['lead', 'chords', 'bass'], 25),
  I('bell', 'Bells', 0.3, false, ['lead', 'chords'], 9),
  I('marimba', 'Marimba', 0.2, true, ['lead', 'chords', 'bass'], 12),
  I('strings', 'Strings', 0.4, true, ['chords', 'lead'], 48),
  I('choir', 'Choir', 0.45, true, ['chords', 'lead'], 52),
  I('organ', 'Organ', 0.15, true, ['chords', 'lead'], 16),
  I('flute', 'Flute', 0.3, true, ['lead'], 73),
  I('brass', 'Brass', 0.2, true, ['lead', 'chords'], 61),
  I('supersaw', 'Supersaw', 0.25, true, ['lead', 'chords'], 81),
  I('chip', '8-bit', 0.1, true, ['lead', 'bass'], 80),
  I('kalimba', 'Kalimba', 0.25, false, ['lead', 'chords'], 108),
  I('ukulele', 'Ukulele', 0.15, false, ['chords', 'lead'], 24),
  I('whistle', 'Whistle', 0.25, false, ['lead'], 78),
  I('polysynth', 'Poly Synth', 0.2, false, ['chords', 'lead'], 90),
  I('harp', 'Harp', 0.35, true, ['chords', 'lead'], 46),
  I('vibes', 'Vibraphone', 0.3, true, ['lead', 'chords'], 11),
  I('steel', 'Steel Drum', 0.25, true, ['lead'], 114),
  I('musicbox', 'Music Box', 0.35, true, ['lead', 'chords'], 10),
  I('upright', 'Upright Bass', 0.08, true, ['bass'], 32),
  I('acid', 'Acid Bass', 0, true, ['bass'], 38),
  I('wobble', 'Wobble Bass', 0, true, ['bass'], 38),
  I('reese', 'Reese Bass', 0, true, ['bass'], 38),
  I('clarinet', 'Clarinet', 0.25, true, ['lead'], 71),
  I('sax', 'Sax', 0.22, true, ['lead'], 65),
  I('violin', 'Violin', 0.35, true, ['lead'], 40),
  I('accordion', 'Accordion', 0.15, true, ['chords', 'lead'], 21),
  I('panflute', 'Pan Flute', 0.35, true, ['lead'], 75),
  I('harmonica', 'Harmonica', 0.15, true, ['lead'], 22),
  I('synthbrass', 'Synth Brass', 0.2, true, ['chords', 'lead'], 62),
];

export function getInstrument(id: string): InstrumentPreset {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}

/** Instruments for a track card, best fits first. */
export function instrumentsFor(role: InstrumentRole): InstrumentPreset[] {
  return INSTRUMENTS.filter((i) => i.roles.includes(role)).sort((a, b) => a.roles.indexOf(role) - b.roles.indexOf(role));
}

// Arrangement styles for "hum → song". Drum bars are written as 16-character strings:
// x = accent, o = normal, - = soft (ghost), . = rest. The last bar of the loop uses the fill.
import type { Key } from './project';

export type BassRhythm = 'kick' | 'eighths' | 'offbeat' | 'sustain' | 'long';
export type ChordRhythm = 'sustain' | 'comp' | 'quarters' | 'stabs' | 'strum' | 'arp';

export interface DrumBar {
  kick: string;
  snare: string;
  hat: string;
}

export interface Style {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  bpm: [number, number]; // where it sounds most natural
  mood: Key['mode'] | 'any';
  kit: string;
  swing: number;
  groove: DrumBar;
  fill?: Partial<DrumBar>;
  bass: { preset: string; rhythm: BassRhythm };
  chords: { preset: string; rhythm: ChordRhythm; sevenths?: boolean };
  lead: { preset: string; center: number }; // the melody moves by octaves to sit around `center`
  mix: { drums: number; bass: number; chords: number; lead: number };
}

export const STYLES: readonly Style[] = [
  {
    id: 'chill', name: 'Lo-fi Chill', emoji: '🌙', blurb: 'Dusty drums · E-piano · warm sub',
    bpm: [70, 100], mood: 'any', kit: 'lofi', swing: 0.12,
    groove: { kick: 'x......o..x.....', snare: '....x.......x...', hat: 'o-o-o-o-o-o-o-o-' },
    fill: { kick: 'x......o..x...o.', snare: '....x.......x.-x' },
    bass: { preset: 'sub', rhythm: 'kick' },
    chords: { preset: 'keys', rhythm: 'comp', sevenths: true },
    lead: { preset: 'flute', center: 72 },
    mix: { drums: 0.8, bass: 0.8, chords: 0.6, lead: 0.8 },
  },
  {
    id: 'pop', name: 'Bright Pop', emoji: '☀️', blurb: 'Punchy kit · piano · guitar lead',
    bpm: [90, 130], mood: 'major', kit: 'acoustic', swing: 0,
    groove: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
    fill: { snare: '....x.......x.xo' },
    bass: { preset: 'bass', rhythm: 'eighths' },
    chords: { preset: 'piano', rhythm: 'quarters' },
    lead: { preset: 'pluck', center: 67 },
    mix: { drums: 0.85, bass: 0.7, chords: 0.6, lead: 0.85 },
  },
  {
    id: 'trap', name: 'Trap', emoji: '🔥', blurb: '808s · rolling hats · bells',
    bpm: [70, 105], mood: 'minor', kit: 'trap', swing: 0,
    groove: { kick: 'x......x..x.....', snare: '........x.......', hat: 'xoxoxoxoxoxoxoxo' },
    fill: { hat: 'xoxoxoxoxoxoxxxx', snare: '........x.....o.' },
    bass: { preset: 'bass808', rhythm: 'long' },
    chords: { preset: 'pad', rhythm: 'sustain' },
    lead: { preset: 'bell', center: 76 },
    mix: { drums: 0.85, bass: 0.85, chords: 0.45, lead: 0.75 },
  },
  {
    id: 'dance', name: 'Dance', emoji: '🪩', blurb: 'Four-on-the-floor · piano stabs · supersaw',
    bpm: [110, 140], mood: 'any', kit: 'house', swing: 0,
    groove: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    fill: { snare: '....x.......x.oo' },
    bass: { preset: 'bass', rhythm: 'offbeat' },
    chords: { preset: 'piano', rhythm: 'stabs' },
    lead: { preset: 'supersaw', center: 72 },
    mix: { drums: 0.85, bass: 0.75, chords: 0.55, lead: 0.7 },
  },
  {
    id: 'band', name: 'Acoustic Band', emoji: '🎸', blurb: 'Live kit · strummed guitar · piano',
    bpm: [80, 130], mood: 'major', kit: 'acoustic', swing: 0,
    groove: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    fill: { snare: '....x.......xo-o' },
    bass: { preset: 'fingerbass', rhythm: 'kick' },
    chords: { preset: 'pluck', rhythm: 'strum' },
    lead: { preset: 'piano', center: 72 },
    mix: { drums: 0.8, bass: 0.8, chords: 0.6, lead: 0.8 },
  },
  {
    id: 'cinema', name: 'Cinematic', emoji: '🎻', blurb: 'Strings · deep sub · soft piano',
    bpm: [70, 110], mood: 'minor', kit: '808', swing: 0,
    groove: { kick: 'x.......x.......', snare: '................', hat: '--o---o---o---o-' },
    bass: { preset: 'sub', rhythm: 'sustain' },
    chords: { preset: 'strings', rhythm: 'sustain' },
    lead: { preset: 'piano', center: 72 },
    mix: { drums: 0.5, bass: 0.75, chords: 0.65, lead: 0.85 },
  },
];

export function getStyle(id: string): Style {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

/** The `count` styles that suit this tempo and key best (tempo fit first, then mood). */
export function pickStyles(bpm: number, key: Key | undefined, count = 3): Style[] {
  const score = (s: Style): number => {
    const [lo, hi] = s.bpm;
    const tempo = bpm < lo ? Math.exp(-(lo - bpm) / 12) : bpm > hi ? Math.exp(-(bpm - hi) / 12) : 1;
    const mood = s.mood === 'any' ? 0.15 : key && s.mood === key.mode ? 0.3 : -0.1;
    return tempo + mood;
  };
  return [...STYLES].sort((a, b) => score(b) - score(a)).slice(0, count);
}

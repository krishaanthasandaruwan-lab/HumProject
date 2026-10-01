// "Hum → song": one hummed melody becomes a full arrangement in a given style — drums, bass and
// chords around it, with the melody on the style's lead instrument (and your own voice, beat-matched
// and auto-tuned, as an optional layer). Chords come from the same Viterbi harmonizer as
// "✨ Add chords"; the drum, bass and chord rhythms come from the style.
import { bassFromChords, chooseChords, chordName, voiceChords, type Chord } from '../dsp/harmony';
import { scaleOf } from '../dsp/key';
import { newProject, newTrack, STEPS_PER_BAR, type DrumHit, type DrumType, type Key, type Note, type Project } from './project';
import type { BassRhythm, ChordRhythm, DrumBar, Style } from './styles';

export interface HumTake {
  notes: Note[];
  bpm: number;
  bars: number;
  key: Key;
  /** The recording itself, from bar 1, with [input s, grid step] anchors for beat matching. */
  voice?: { audio: Float32Array; rate: number; anchors: number[] };
}

const VEL: Record<string, number> = { x: 1, o: 0.78, '-': 0.5 };

export function drumPattern(style: Style, bars: number): DrumHit[] {
  const hits: DrumHit[] = [];
  for (let b = 0; b < bars; b++) {
    // A fill closes every 8 bars (and the last bar of a loop of 4 or more).
    const fill = bars >= 4 && (b === bars - 1 || b % 8 === 7);
    const bar: DrumBar = fill && style.fill ? { ...style.groove, ...style.fill } : style.groove;
    for (const type of ['kick', 'snare', 'hat'] as DrumType[]) {
      [...bar[type]].forEach((c, s) => {
        if (VEL[c]) hits.push({ step: b * STEPS_PER_BAR + s, type, velocity: VEL[c] });
      });
    }
  }
  return hits.sort((a, b) => a.step - b.step || a.type.localeCompare(b.type));
}

export function bassLine(chords: Chord[], rhythm: BassRhythm, kicks: number[]): Note[] {
  if (rhythm === 'kick') return bassFromChords(chords, kicks);
  const out: Note[] = [];
  chords.forEach((c, bar) => {
    const root = 33 + ((c.root - 9 + 12) % 12); // A1..G♯2
    const b0 = bar * STEPS_PER_BAR;
    const add = (s: number, length: number, velocity: number, midi = root): void => { out.push({ start: b0 + s, length, midi, velocity }); };
    if (rhythm === 'eighths') for (let s = 0; s < 16; s += 2) add(s, 2, s % 4 === 0 ? 0.9 : 0.7);
    else if (rhythm === 'offbeat') [2, 6, 10, 14].forEach((s) => add(s, 2, 0.85, s === 6 || s === 14 ? root + 12 : root));
    else if (rhythm === 'sustain') add(0, 16, 0.85);
    else {
      // 'long' (808): one note per kick, held until the next kick.
      const inBar = kicks.filter((k) => k >= b0 && k < b0 + 16).map((k) => k - b0);
      const starts = [...new Set([0, ...inBar])].sort((a, b) => a - b);
      starts.forEach((s, i) => add(s, (starts[i + 1] ?? 16) - s, s === 0 ? 1 : 0.85));
    }
  });
  return out;
}

const RHYTHMS: Record<Exclude<ChordRhythm, 'arp'>, [number, number, number][]> = {
  sustain: [[0, 16, 0.7]],
  comp: [[0, 6, 0.75], [7, 3, 0.6], [10, 6, 0.65]],
  quarters: [[0, 3, 0.8], [4, 3, 0.65], [8, 3, 0.7], [12, 3, 0.65]],
  stabs: [[0, 2, 0.8], [3, 2, 0.7], [6, 2, 0.75], [10, 2, 0.75], [14, 2, 0.7]],
  strum: [[0, 3, 0.8], [3, 3, 0.6], [6, 2, 0.65], [8, 3, 0.75], [11, 3, 0.6], [14, 2, 0.65]],
};

export function chordPart(chords: Chord[], key: Key, rhythm: ChordRhythm, sevenths = false): Note[] {
  const voiced = voiceChords(chords, 'pad');
  const scale = scaleOf(key);
  const out: Note[] = [];
  chords.forEach((c, bar) => {
    const b0 = bar * STEPS_PER_BAR;
    const tones = voiced.filter((n) => n.start === b0).map((n) => n.midi).sort((a, b) => a - b);
    if (sevenths) {
      const pc = scale[(c.degree + 6) % 7];
      let m = tones[0] + 1;
      while (((m % 12) + 12) % 12 !== pc || tones.includes(m)) m++;
      tones.push(m);
      tones.sort((a, b) => a - b);
    }
    if (rhythm === 'arp') {
      const seq = [...tones, tones[1] + 12];
      for (let s = 0; s < 16; s += 2) out.push({ start: b0 + s, length: 2, midi: seq[(s / 2) % seq.length], velocity: s % 4 === 0 ? 0.75 : 0.6 });
      return;
    }
    for (const [s, length, velocity] of RHYTHMS[rhythm]) for (const midi of tones) out.push({ start: b0 + s, length, midi, velocity });
  });
  return out;
}

/** Move the whole melody by octaves so its middle sits near `center`. */
export function placeMelody(notes: Note[], center: number): Note[] {
  if (!notes.length) return [];
  const sorted = notes.map((n) => n.midi).sort((a, b) => a - b);
  const shift = 12 * Math.round((center - sorted[sorted.length >> 1]) / 12);
  return notes.map((n) => ({ ...n, midi: n.midi + shift, raw: n.raw === undefined ? undefined : n.raw + shift }));
}

export function arrange(take: HumTake, style: Style, name: string): Project {
  const p = newProject(name, take.bpm, take.bars);
  p.key = take.key;
  p.swing = style.swing;
  const drums = newTrack('drums', style.kit);
  drums.hits = drumPattern(style, take.bars);
  drums.generated = true;
  drums.volume = style.mix.drums;

  const chords = chooseChords(take.notes, take.key, take.bars);
  const kicks = drums.hits.filter((h) => h.type === 'kick').map((h) => h.step);
  const bass = newTrack('bass', style.bass.preset);
  bass.notes = bassLine(chords, style.bass.rhythm, kicks);
  bass.generated = true;
  bass.volume = style.mix.bass;

  const pad = newTrack('chords', style.chords.preset);
  pad.notes = chordPart(chords, take.key, style.chords.rhythm, style.chords.sevenths);
  pad.labels = chords.map(chordName);
  pad.generated = true;
  pad.volume = style.mix.chords;

  const lead = newTrack('lead', style.lead.preset);
  lead.notes = placeMelody(take.notes, style.lead.center);
  lead.volume = style.mix.lead;
  if (take.voice) {
    lead.rawVoice = take.voice.audio;
    lead.rawRate = take.voice.rate;
    lead.anchors = take.voice.anchors;
    lead.voice = { on: true, tune: true, level: 0.8 };
  }
  p.tracks = [drums, bass, lead, pad];
  return p;
}

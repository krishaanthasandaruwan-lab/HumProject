// Project data model. Positions are in 16th-note steps; one bar = 16 steps.
export type DrumType = 'kick' | 'snare' | 'hat';
export const DRUM_TYPES: readonly DrumType[] = ['kick', 'snare', 'hat'];

export interface DrumHit {
  step: number; // 16th index within the loop
  type: DrumType;
  velocity: number; // 0..1
  /** Timing residual vs. the grid in steps (applied × (1 − quantize strength)). */
  offset?: number;
}

export interface Note {
  start: number; // in 16ths
  length: number; // in 16ths
  midi: number;
  velocity: number;
  offset?: number;
  /** Unrounded detected pitch, kept so scale-snap can be toggled. */
  raw?: number;
}

export type TrackKind = 'drums' | 'bass' | 'lead' | 'chords';

export interface Track {
  id: string;
  kind: TrackKind;
  preset: string;
  hits?: DrumHit[];
  notes?: Note[];
  rawVoice?: Float32Array; // the original recording, for the before/after video
  rawRate?: number;
  volume: number;
  muted: boolean;
  solo?: boolean;
  generated?: boolean; // made by auto-chords rather than recorded
  labels?: string[]; // chord names per bar (chords track)
  /** Your own voice as a layer in the mix: beat-matched onto the grid, optionally auto-tuned. */
  voice?: { on: boolean; tune: boolean; level: number; only?: boolean };
  /** Flat [seconds into rawVoice, grid step] pairs: where each note was sung → where it belongs. */
  anchors?: number[];
}

export interface Key {
  tonic: number; // pitch class 0-11, 0 = C
  mode: 'major' | 'minor';
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  /** Song length: 2, 4 or 8 bars for a loop; a hummed song can be any multiple of 4 up to MAX_BARS. */
  bars: number;
  key?: Key;
  swing: number; // 0–0.3 of a 16th
  quantize: number; // strength 0..1 (1 = hard on the grid)
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export const STEPS_PER_BAR = 16;
export const MAX_BARS = 96;

/** The song length that holds `steps` sixteenths: 2, 4 or 8 bars, then whole groups of 4 bars. */
export function songBars(steps: number): number {
  const b = steps / STEPS_PER_BAR;
  if (b <= 2.15) return 2;
  if (b <= 4.15) return 4;
  if (b <= 8.15) return 8;
  return Math.min(MAX_BARS, 4 * Math.ceil((b - 0.15) / 4));
}

export const TRACK_META: Record<TrackKind, { label: string; emoji: string; color: string; preset: string }> = {
  drums: { label: 'Drums', emoji: '🥁', color: 'var(--drums)', preset: '808' },
  bass: { label: 'Bass', emoji: '🎸', color: 'var(--bass)', preset: 'bass' },
  lead: { label: 'Lead', emoji: '🎹', color: 'var(--lead)', preset: 'lead' },
  chords: { label: 'Chords', emoji: '✨', color: 'var(--chords)', preset: 'pad' },
};

export const TRACK_ORDER: readonly TrackKind[] = ['drums', 'bass', 'lead', 'chords'];

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newProject(name = 'New song', bpm = 90, bars = 4): Project {
  const now = Date.now();
  return { id: uid(), name, bpm, bars, swing: 0, quantize: 1, tracks: [], createdAt: now, updatedAt: now };
}

export function newTrack(kind: TrackKind, preset = TRACK_META[kind].preset): Track {
  const t: Track = { id: uid(), kind, preset, volume: kind === 'chords' ? 0.7 : 0.85, muted: false };
  if (kind === 'drums') t.hits = [];
  else t.notes = [];
  return t;
}

export const totalSteps = (p: Pick<Project, 'bars'>): number => p.bars * STEPS_PER_BAR;
export const stepDur = (bpm: number): number => 60 / bpm / 4;
export const loopDuration = (p: Pick<Project, 'bars' | 'bpm'>): number => totalSteps(p) * stepDur(p.bpm);

export function getTrack(p: Project, kind: TrackKind): Track | undefined {
  return p.tracks.find((t) => t.kind === kind);
}

/** One track per kind: replaces the existing one (returns it, for undo). */
export function putTrack(p: Project, track: Track): Track | undefined {
  const i = p.tracks.findIndex((t) => t.kind === track.kind);
  if (i < 0) {
    p.tracks.push(track);
    p.tracks.sort((a, b) => TRACK_ORDER.indexOf(a.kind) - TRACK_ORDER.indexOf(b.kind));
    return undefined;
  }
  const old = p.tracks[i];
  p.tracks[i] = track;
  return old;
}

/** Effective gain after volume, mute and solo. */
export function trackGain(p: Project, t: Track): number {
  const anySolo = p.tracks.some((x) => x.solo);
  if (t.muted || (anySolo && !t.solo)) return 0;
  return t.volume;
}

/** Swing delays every odd 16th by `swing` steps. */
export function swingOffset(step: number, swing: number): number {
  return Math.round(step) % 2 === 1 ? swing : 0;
}

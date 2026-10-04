// High-level, pure analysis pipelines (run inside the DSP worker).
import type { DrumHit, DrumType, Note } from '../model/project';
import { classify, type Profile } from './drumClassifier';
import { extractFeatures } from './features';
import { detectOnsets } from './onsets';
import { notesToGrid, retune, segmentNotes, transposeToRange } from './notes';
import { fixOctaves, HUM_CLARITY, medianSmooth, trackPitch } from './pitch';
import { hitsToGrid } from './quantize';

export interface BeatboxInput {
  audio: Float32Array;
  sampleRate: number;
  /** Seconds of audio before the loop start (lets hits right on beat 1 be caught). */
  preroll: number;
  bpm: number;
  bars: number;
  swing: number;
  profile?: Profile | null;
}

export interface HeardHit {
  time: number; // seconds from loop start
  type: DrumType;
  confidence: number;
  rms: number;
}

export interface BeatboxResult {
  hits: DrumHit[];
  heard: HeardHit[];
}

export function analyzeBeatbox(i: BeatboxInput): BeatboxResult {
  const onsets = detectOnsets(i.audio, i.sampleRate);
  const heard: HeardHit[] = onsets.map((o) => {
    const p = classify(extractFeatures(i.audio, i.sampleRate, o.time), i.profile);
    return { time: o.time - i.preroll, type: p.type, confidence: p.confidence, rms: o.rms };
  });
  return { hits: hitsToGrid(heard, i.bpm, i.bars * 16, i.swing), heard };
}

export interface CalibrationInput {
  audio: Float32Array;
  sampleRate: number;
  /** Seconds into `audio` at which each "say it now" cue was shown. */
  cues: number[];
}

export interface CalibrationHit {
  cue: number;
  time: number;
  x: number[];
}

/** For every cue, take the strongest onset near it (−0.3 s … +0.45 s) and its features. */
export function analyzeCalibration(i: CalibrationInput): CalibrationHit[] {
  const onsets = detectOnsets(i.audio, i.sampleRate);
  const out: CalibrationHit[] = [];
  i.cues.forEach((cue, idx) => {
    const near = onsets.filter((o) => o.time > cue - 0.3 && o.time < cue + 0.45);
    if (near.length === 0) return;
    const best = near.reduce((a, b) => (b.rms > a.rms ? b : a));
    out.push({ cue: idx, time: best.time, x: extractFeatures(i.audio, i.sampleRate, best.time) });
  });
  return out;
}

export interface MelodyInput {
  audio: Float32Array;
  sampleRate: number;
  preroll: number;
  bpm: number;
  bars: number;
  swing: number;
  mode: 'bass' | 'lead';
}

export interface MelodyResult {
  notes: Note[];
  voiced: number; // share of voiced frames, to tell "silence" from "no clear pitch"
}

export function analyzeMelody(i: MelodyInput): MelodyResult {
  const hop = 256;
  const raw = trackPitch(i.audio, i.sampleRate, { hop, maxHz: i.mode === 'bass' ? 900 : 2600, minClarity: HUM_CLARITY });
  const frames = fixOctaves(medianSmooth(raw));
  const segs = retune(segmentNotes(frames, hop / i.sampleRate)).map((n) => ({ ...n, start: n.start - i.preroll, end: n.end - i.preroll }));
  let notes = notesToGrid(segs, i.bpm, i.bars * 16, i.swing);
  if (i.mode === 'bass') notes = transposeToRange(notes, 28, 52);
  const voiced = frames.length ? frames.filter((f) => f.midi !== null).length / frames.length : 0;
  return { notes, voiced };
}

// Free-tempo analysis: a hum recorded with no metronome, or an imported file. Beat matching finds
// the tempo, the beats and bar 1; notes / hits are then placed on the 16th grid through that beat
// map (so a performer who drifts still lands on the right steps). Voice anchors record where each
// note was sung, so the voice itself can later be warped onto the same grid.
import { STEPS_PER_BAR, type DrumHit, type Key, type Note } from '../model/project';
import { classify, type Profile } from './drumClassifier';
import { extractFeatures } from './features';
import { detectKey, snapToScale } from './key';
import { notesToGrid, segmentNotes, transposeToRange, type RawNote } from './notes';
import { detectOnsets } from './onsets';
import { fixOctaves, medianSmooth, trackPitch } from './pitch';
import { hitsToGrid } from './quantize';
import { beatMatch, makeStepMap, makeTimeMap, type TimedEvent } from './tempo';

export interface FreeInput {
  audio: Float32Array;
  sampleRate: number;
  kind: 'drums' | 'bass' | 'lead';
  /** Fit into this song's tempo / length (importing next to existing parts); otherwise detect them. */
  bpm?: number;
  bars?: 2 | 4 | 8;
  profile?: Profile | null;
}

export interface FreeResult {
  bpm: number;
  bars: 2 | 4 | 8;
  notes: Note[];
  hits: DrumHit[];
  key?: Key;
  /** Where bar 1 starts and the loop ends in the input (seconds). */
  loopStart: number;
  loopEnd: number;
  /** Flat [input seconds from loopStart, grid step] pairs: where each note was sung → where it sits. */
  anchors: number[];
  confidence: number;
  voiced: number;
}

const barsFor = (steps: number): 2 | 4 | 8 => (steps <= 2.15 * STEPS_PER_BAR ? 2 : steps <= 4.15 * STEPS_PER_BAR ? 4 : 8);

/** Onset events for beat matching: note starts (weighted by length) plus the louder onsets. */
function melodicEvents(segs: RawNote[], audio: Float32Array, sr: number): TimedEvent[] {
  const maxRms = Math.max(1e-9, ...segs.map((s) => s.rms));
  const events: TimedEvent[] = segs.map((s) => ({ time: s.start, weight: Math.sqrt(Math.min(1, s.end - s.start)) * Math.sqrt(s.rms / maxRms) }));
  for (const o of detectOnsets(audio, sr)) {
    if (!events.some((e) => Math.abs(e.time - o.time) < 0.06)) events.push({ time: o.time, weight: 0.4 * o.strength });
  }
  return events.sort((a, b) => a.time - b.time);
}

export function analyzeFree(i: FreeInput): FreeResult {
  const sr = i.sampleRate;
  const duration = i.audio.length / sr;
  let events: TimedEvent[];
  let segs: RawNote[] = [];
  let heard: { time: number; type: DrumHit['type']; rms: number }[] = [];
  let voiced = 0;
  if (i.kind === 'drums') {
    const onsets = detectOnsets(i.audio, sr);
    heard = onsets.map((o) => ({ time: o.time, type: classify(extractFeatures(i.audio, sr, o.time), i.profile).type, rms: o.rms }));
    events = onsets.map((o) => ({ time: o.time, weight: o.strength }));
  } else {
    const hop = 256;
    const frames = fixOctaves(medianSmooth(trackPitch(i.audio, sr, { hop, maxHz: i.kind === 'bass' ? 900 : 2600 })));
    voiced = frames.length ? frames.filter((f) => f.midi !== null).length / frames.length : 0;
    segs = segmentNotes(frames, hop / sr);
    events = melodicEvents(segs, i.audio, sr);
  }

  const grid = beatMatch(events, duration);
  const toSteps = makeStepMap(grid);
  const toTime = makeTimeMap(grid);
  const bpm = i.bpm ?? grid.bpm;
  const lastEnd = i.kind === 'drums' ? Math.max(0, ...heard.map((h) => h.time)) + 0.05 : Math.max(0, ...segs.map((s) => s.end));
  const bars = i.bars ?? barsFor(Math.max(1, toSteps(lastEnd)));
  const steps = bars * STEPS_PER_BAR;
  const loopStart = toTime(0);
  const loopEnd = toTime(steps);

  if (i.kind === 'drums') {
    const hits = hitsToGrid(heard, bpm, steps, 0, toSteps);
    return { bpm, bars, notes: [], hits, loopStart, loopEnd, anchors: [], confidence: grid.confidence, voiced };
  }

  let notes = notesToGrid(segs, bpm, steps, 0, toSteps);
  if (i.kind === 'bass') notes = transposeToRange(notes, 28, 52);
  const found = detectKey(notes.map((n) => ({ midi: Math.round(n.raw ?? n.midi), length: n.length })));
  const key = found?.key;
  if (key) for (const n of notes) n.midi = snapToScale(n.raw ?? n.midi, key);
  // Anchor every note: where it was sung (input) → where it now sits on the grid (output).
  const anchors: number[] = [];
  for (const n of notes) {
    const sung = segs.find((s) => Math.abs(toSteps(s.start) - (n.start + (n.offset ?? 0))) < 0.01);
    if (sung) anchors.push(sung.start - loopStart, n.start);
  }
  anchors.push(loopEnd - loopStart, steps);
  return { bpm, bars, notes, hits: [], key, loopStart, loopEnd, anchors, confidence: grid.confidence, voiced };
}

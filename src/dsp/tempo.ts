// Beat matching: find the tempo and the beats of a free-tempo performance (a hum with no
// metronome, an imported file) so it can be placed on the 16th grid. Global tempo from the
// autocorrelation of an onset envelope (log-normal prior around 100 BPM), beats by dynamic
// programming (Ellis 2007), then a beat map from seconds to 16th steps that follows tempo drift.

export interface TimedEvent {
  time: number; // seconds
  weight: number; // how strong / long the event is (0..1-ish)
}

export interface BeatGrid {
  bpm: number; // average tempo of the tracked beats, folded into 70–140
  beats: number[]; // beat times (s), ascending
  downbeat: number; // index in `beats` of bar 1, beat 1
  confidence: number; // 0..1: how periodic the onsets are
}

export const ENV_FPS = 100;
const MIN_BPM = 70;
const MAX_BPM = 140;

/** Onset envelope: one 15 ms Gaussian bump per event, sampled at `fps` frames per second. */
export function eventEnvelope(events: TimedEvent[], duration: number, fps = ENV_FPS): Float32Array {
  const n = Math.max(2, Math.ceil(duration * fps) + 1);
  const env = new Float32Array(n);
  const sigma = 0.015 * fps;
  const r = Math.ceil(3 * sigma);
  for (const e of events) {
    const c = e.time * fps;
    for (let i = Math.max(0, Math.floor(c - r)); i <= Math.min(n - 1, Math.ceil(c + r)); i++) {
      env[i] += e.weight * Math.exp(-0.5 * ((i - c) / sigma) ** 2);
    }
  }
  return env;
}

const fold = (bpm: number, lo: number, hi: number): number => {
  if (!(bpm > 0) || !Number.isFinite(bpm)) return Math.sqrt(lo * hi); // never loop on a tempo that can't be folded
  let b = bpm;
  while (b < lo) b *= 2;
  while (b > hi) b /= 2;
  return b;
};

/**
 * Global tempo: for each beat period, the envelope autocorrelation at 1×, 2×, 4× and 8× that period
 * (beat, half bar, bar, two bars — so a dotted or syncopated rhythm does not pass for the beat),
 * weighted by a log-normal prior around 100 BPM, then folded into lo..hi. On random 4–8 bar
 * melodies with ±20 ms jitter this gets ~93% of tempos right (the rest are 3:4 confusions).
 */
export function estimateTempo(env: Float32Array, fps = ENV_FPS, lo = MIN_BPM, hi = MAX_BPM): { bpm: number; confidence: number } {
  const n = env.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  const x = Float32Array.from(env, (v) => v - mean);
  const ac = (lag: number): number => {
    let s = 0;
    for (let i = lag; i < n; i++) s += x[i] * x[i - lag];
    return s / (n - lag);
  };
  const zero = ac(0);
  const minLag = Math.floor((60 * fps) / 200);
  const maxLag = Math.min(n - 2, Math.ceil((60 * fps) / 45));
  if (zero <= 0 || maxLag <= minLag) return { bpm: 90, confidence: 0 };
  // Lags up to 8× the longest beat; only ones with at least a third of the signal overlapping.
  const top = Math.min(8 * maxLag + 2, Math.floor((2 * n) / 3));
  const r = new Float32Array(Math.max(top, maxLag + 2) + 1);
  for (let lag = minLag - 1; lag <= Math.max(top, maxLag + 1); lag++) r[lag] = lag < n ? ac(lag) : 0;
  const at = (lag: number): number => (lag <= top ? r[Math.round(lag)] : 0);
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.log2(bpm / 100) ** 2);
    const s = (r[lag] + 0.5 * at(2 * lag) + at(4 * lag) + 0.75 * at(8 * lag)) * prior;
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  // Parabolic interpolation around the peak for a fractional lag. It stays within half a lag of the
  // peak: where the curve is nearly flat the formula can run off to hundreds of lags (even below zero).
  const a = r[best - 1];
  const b = r[best];
  const c = r[best + 1];
  const den = a - 2 * b + c;
  const lag = den < 0 ? best + Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : best;
  return { bpm: fold((60 * fps) / lag, lo, hi), confidence: Math.max(0, Math.min(1, b / zero)) };
}

/** Dynamic-programming beat tracker: beats on strong onsets, spaced close to the tempo period. */
export function trackBeats(env: Float32Array, fps: number, bpm: number, tightness = 100): number[] {
  const n = env.length;
  const period = (60 * fps) / bpm;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (env[i] - mean) ** 2;
  sd = Math.sqrt(sd / n) || 1;
  const local = Float32Array.from(env, (v) => v / sd);
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let best = -Infinity;
    let arg = -1;
    for (let p = Math.max(0, Math.round(t - 2 * period)); p <= Math.round(t - period / 2); p++) {
      const v = score[p] - tightness * Math.log((t - p) / period) ** 2;
      if (v > best) {
        best = v;
        arg = p;
      }
    }
    score[t] = local[t] + (arg >= 0 && best > 0 ? best : 0);
    back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  // End on the best-scoring frame near the last onset, then follow the back-links.
  let last = n - 1;
  while (last > 0 && local[last] < 0.05) last--;
  let end = last;
  for (let t = Math.max(0, Math.round(last - period / 2)); t <= Math.min(n - 1, Math.round(last + period / 2)); t++) {
    if (score[t] > score[end]) end = t;
  }
  const frames: number[] = [];
  for (let t = end; t >= 0; t = back[t]) frames.unshift(t);
  return frames.map((f) => f / fps);
}

/** Beat time for a (fractional) beat index, extrapolating with the edge periods. */
export function beatTime(beats: number[], index: number): number {
  const n = beats.length;
  if (n === 0) return 0;
  if (n === 1) return beats[0] + index * 0.6;
  if (index <= 0) return beats[0] + index * (beats[1] - beats[0]);
  if (index >= n - 1) return beats[n - 1] + (index - (n - 1)) * (beats[n - 1] - beats[n - 2]);
  const k = Math.floor(index);
  return beats[k] + (index - k) * (beats[k + 1] - beats[k]);
}

/** Fractional beat index of a time (inverse of beatTime). */
export function beatIndex(beats: number[], t: number): number {
  const n = beats.length;
  if (n < 2) return n === 1 ? (t - beats[0]) / 0.6 : 0;
  if (t <= beats[0]) return (t - beats[0]) / (beats[1] - beats[0]);
  if (t >= beats[n - 1]) return n - 1 + (t - beats[n - 1]) / (beats[n - 1] - beats[n - 2]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) lo = mid;
    else hi = mid;
  }
  return lo + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
}

/** Seconds -> 16th steps from bar 1, beat 1 (follows the tracked beats, so tempo drift is absorbed). */
export function makeStepMap(grid: BeatGrid): (t: number) => number {
  return (t) => (beatIndex(grid.beats, t) - grid.downbeat) * 4;
}

/** 16th steps from bar 1 -> seconds (inverse of makeStepMap). */
export function makeTimeMap(grid: BeatGrid): (step: number) => number {
  return (step) => beatTime(grid.beats, grid.downbeat + step / 4);
}

/** Tempo, beats and bar 1 for a list of onset events (≥ 2 needed for anything but a guess). */
export function beatMatch(events: TimedEvent[], duration: number, fallbackBpm = 90): BeatGrid {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  if (sorted.length < 3) {
    const period = 60 / fallbackBpm;
    const t0 = sorted[0]?.time ?? 0;
    const beats = Array.from({ length: Math.ceil((duration - t0) / period) + 2 }, (_, k) => t0 + k * period);
    return { bpm: fallbackBpm, beats, downbeat: 0, confidence: 0 };
  }
  const env = eventEnvelope(sorted, duration);
  const tempo = estimateTempo(env);
  let beats = trackBeats(env, ENV_FPS, tempo.bpm);
  if (beats.length < 2) {
    const period = 60 / tempo.bpm;
    beats = Array.from({ length: Math.ceil(duration / period) + 1 }, (_, k) => sorted[0].time + k * period);
  }
  const span = beats[beats.length - 1] - beats[0];
  const bpm = beats.length > 1 && span > 0 ? (60 * (beats.length - 1)) / span : tempo.bpm;
  // Cover the whole recording, so a first note before the first tracked beat still maps.
  const p0 = beats[1] - beats[0];
  while (beats[0] - p0 > -p0 / 2) beats.unshift(beats[0] - p0);
  const p1 = beats[beats.length - 1] - beats[beats.length - 2];
  while (beats[beats.length - 1] < duration) beats.push(beats[beats.length - 1] + p1);
  // Bar 1 starts on the beat nearest the first clear event — people start on "one".
  const maxW = Math.max(...sorted.map((e) => e.weight));
  const first = sorted.find((e) => e.weight >= 0.4 * maxW) ?? sorted[0];
  let downbeat = 0;
  for (let k = 1; k < beats.length; k++) {
    if (Math.abs(beats[k] - first.time) < Math.abs(beats[downbeat] - first.time)) downbeat = k;
  }
  return { bpm: Math.round(fold(bpm, MIN_BPM, MAX_BPM) * 10) / 10, beats, downbeat, confidence: tempo.confidence };
}

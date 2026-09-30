// Auto-chords: score the 7 diatonic triads per bar by how much melody falls on chord tones,
// add bonuses for common progressions and a small repeat penalty, choose with Viterbi.
import type { Key, Note } from '../model/project';
import { NOTE_NAMES, scaleOf } from './key';

export interface Chord {
  degree: number; // 0..6 within the key
  root: number; // pitch class
  quality: 'maj' | 'min' | 'dim';
  tones: number[]; // pitch classes: root, third, fifth
}

const pc = (m: number): number => ((Math.round(m) % 12) + 12) % 12;

export function diatonicTriads(key: Key): Chord[] {
  const sc = scaleOf(key);
  return sc.map((root, degree) => {
    const third = sc[(degree + 2) % 7];
    const fifth = sc[(degree + 4) % 7];
    const i3 = (third - root + 12) % 12;
    const i5 = (fifth - root + 12) % 12;
    const quality = i3 === 4 ? 'maj' : i5 === 6 ? 'dim' : 'min';
    return { degree, root, quality, tones: [root, third, fifth] };
  });
}

export function chordName(c: Chord): string {
  return NOTE_NAMES[c.root] + (c.quality === 'min' ? 'm' : c.quality === 'dim' ? '°' : '');
}

/** Share (0..1) of the bar's melody duration that lands on chord tones; downbeat notes count 1.5×. */
export function barFit(melody: Note[], bar: number, chord: Chord, stepsPerBar = 16): number {
  const b0 = bar * stepsPerBar;
  const b1 = b0 + stepsPerBar;
  let on = 0;
  let total = 0;
  for (const n of melody) {
    const s = Math.max(n.start, b0);
    const e = Math.min(n.start + n.length, b1);
    if (e <= s) continue;
    const w = (e - s) * (s === b0 || n.start <= b0 ? 1.5 : 1);
    total += w;
    if (chord.tones.includes(pc(n.midi))) on += w;
  }
  return total > 0 ? on / total : 0;
}

// Progressions as degree cycles in the key's own mode: I–V–vi–IV (and its rotation vi–IV–I–V), i–VI–III–VII.
const FLOWS: Record<Key['mode'], number[][]> = { major: [[0, 4, 5, 3]], minor: [[0, 5, 2, 6]] };
const MOVES: Record<Key['mode'], [number, number, number][]> = {
  major: [[4, 0, 0.15], [3, 4, 0.2], [1, 4, 0.2], [0, 3, 0.15], [0, 5, 0.15], [3, 0, 0.12], [5, 1, 0.1]],
  minor: [[4, 0, 0.2], [3, 4, 0.15], [0, 3, 0.15], [5, 6, 0.15], [2, 5, 0.1], [3, 0, 0.1]],
};
const PRIOR: Record<Key['mode'], number[]> = {
  major: [0.2, 0, -0.05, 0.12, 0.15, 0.12, -0.5],
  minor: [0.2, -0.5, 0.1, 0.12, 0.05, 0.12, 0.1],
};

export function transitions(mode: Key['mode']): number[][] {
  const t = Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => (i === j ? -0.15 : 0)));
  for (const flow of FLOWS[mode]) flow.forEach((d, k) => { t[d][flow[(k + 1) % flow.length]] += 0.35; });
  for (const [a, b, bonus] of MOVES[mode]) t[a][b] += bonus;
  return t;
}

/** One chord per bar, best path by dynamic programming (Viterbi). */
export function chooseChords(melody: Note[], key: Key, bars: number, stepsPerBar = 16): Chord[] {
  const triads = diatonicTriads(key);
  const prior = PRIOR[key.mode];
  const trans = transitions(key.mode);
  let prev = triads.map((c, j) => barFit(melody, 0, c, stepsPerBar) + prior[j] + (j === 0 ? 0.25 : 0));
  const back: number[][] = [];
  for (let b = 1; b < bars; b++) {
    const cur: number[] = [];
    const bp: number[] = [];
    for (let j = 0; j < 7; j++) {
      let best = -Infinity;
      let arg = 0;
      for (let i = 0; i < 7; i++) {
        const v = prev[i] + trans[i][j];
        if (v > best) { best = v; arg = i; }
      }
      cur.push(best + barFit(melody, b, triads[j], stepsPerBar) + prior[j]);
      bp.push(arg);
    }
    back.push(bp);
    prev = cur;
  }
  let last = prev.indexOf(Math.max(...prev));
  const path = [last];
  for (let b = bars - 2; b >= 0; b--) {
    last = back[b][last];
    path.unshift(last);
  }
  return path.map((j) => triads[j]);
}

/** Close-position triads with smooth voice leading, around middle C. */
export function voiceChords(chords: Chord[], style: 'pad' | 'keys', stepsPerBar = 16): Note[] {
  const rhythm = style === 'pad' ? [[0, stepsPerBar]] : [[0, 6], [6, 4], [10, 6]];
  const out: Note[] = [];
  let prev: number[] | null = null;
  chords.forEach((c, bar) => {
    const cands: number[][] = [];
    for (let inv = 0; inv < 3; inv++) {
      const order = [0, 1, 2].map((k) => c.tones[(inv + k) % 3]);
      let lowest = order[0] + 48;
      while (lowest < 53) lowest += 12;
      const v = [lowest];
      for (let k = 1; k < 3; k++) {
        let m = order[k] + 48;
        while (m <= v[k - 1]) m += 12;
        v.push(m);
      }
      cands.push(v);
    }
    const cost = (v: number[]): number => prev
      ? v.reduce((s, m, i) => s + Math.abs(m - (prev as number[])[i]), 0)
      : Math.abs(v.reduce((s, m) => s + m, 0) / 3 - 62);
    const best = cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    prev = best;
    for (const [s, len] of rhythm) {
      for (const midi of best) out.push({ start: bar * stepsPerBar + s, length: len, midi, velocity: style === 'pad' ? 0.7 : 0.75 });
    }
  });
  return out;
}

/** Root-note bass that follows the kick drum (or beats 1 and 3 without drums). */
export function bassFromChords(chords: Chord[], kickSteps: number[], stepsPerBar = 16): Note[] {
  const out: Note[] = [];
  chords.forEach((c, bar) => {
    const root = 33 + ((c.root - 9 + 12) % 12); // A1..G#2
    const b0 = bar * stepsPerBar;
    const inBar = kickSteps.filter((s) => s >= b0 && s < b0 + stepsPerBar).map((s) => s - b0);
    const starts = [...new Set([0, ...(inBar.length ? inBar : [8])])].sort((a, b) => a - b);
    starts.forEach((s, i) => {
      const next = starts[i + 1] ?? stepsPerBar;
      out.push({ start: b0 + s, length: Math.max(1, Math.min(8, next - s)), midi: root, velocity: s === 0 ? 0.95 : 0.8 });
    });
  });
  return out;
}

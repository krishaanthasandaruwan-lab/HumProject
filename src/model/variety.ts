// Three clearly different songs from one hum: as hummed, slower and faster, each in the style that
// suits that tempo, the key and what the person said they like. "More" offers the remaining styles.
import type { Key } from './project';
import { STYLES, type Style } from './styles';

export type Feel = 'hummed' | 'slower' | 'faster' | 'more';
export interface Variant { style: Style; bpm: number; feel: Feel }

export const MIN_BPM = 60;
export const MAX_BPM = 160;
export const clampBpm = (v: number): number => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
const CALM = new Set(['chill', 'cinema', 'band']);
const LIVELY = new Set(['dance', 'pop', 'trap']);

function tempoFit(s: Style, bpm: number): number {
  const [lo, hi] = s.bpm;
  return bpm < lo ? Math.exp(-(lo - bpm) / 12) : bpm > hi ? Math.exp(-(bpm - hi) / 12) : 1;
}

function score(s: Style, bpm: number, key: Key | undefined, likes: readonly string[], feel: Feel): number {
  const mood = s.mood === 'any' ? 0.15 : key && s.mood === key.mode ? 0.3 : -0.1;
  const like = likes.includes(s.id) ? 0.6 : 0;
  const lean = feel === 'slower' && CALM.has(s.id) ? 0.25 : feel === 'faster' && LIVELY.has(s.id) ? 0.25 : 0;
  return tempoFit(s, bpm) + mood + like + lean;
}

function best(bpm: number, key: Key | undefined, likes: readonly string[], feel: Feel, taken: Set<string>): Style {
  const free = STYLES.filter((s) => !taken.has(s.id));
  return free.reduce((a, b) => (score(b, bpm, key, likes, feel) > score(a, bpm, key, likes, feel) ? b : a));
}

/** The three songs offered after a hum: as hummed, slower, faster — three different styles. */
export function pickVariants(bpm: number, key: Key | undefined, likes: readonly string[] = []): Variant[] {
  const hummed = clampBpm(bpm);
  const slower = clampBpm(Math.min(bpm * 0.8, hummed - 8));
  const faster = clampBpm(Math.max(bpm * 1.25, hummed + 8));
  const taken = new Set<string>();
  const out: Variant[] = [];
  for (const [feel, tempo] of [['hummed', hummed], ['slower', slower], ['faster', faster]] as [Feel, number][]) {
    const style = best(tempo, key, likes, feel, taken);
    taken.add(style.id);
    out.push({ style, bpm: tempo, feel });
  }
  return out;
}

/** The styles not offered yet, each at the tempo nearest the hum that suits it. */
export function moreVariants(bpm: number, key: Key | undefined, likes: readonly string[], shown: readonly Variant[]): Variant[] {
  const taken = new Set(shown.map((v) => v.style.id));
  return STYLES.filter((s) => !taken.has(s.id))
    .map((style) => ({ style, bpm: clampBpm(Math.min(style.bpm[1], Math.max(style.bpm[0], bpm))), feel: 'more' as const }))
    .sort((a, b) => score(b.style, b.bpm, key, likes, 'more') - score(a.style, a.bpm, key, likes, 'more'));
}

// Three clearly different songs from one hum: as hummed, slower and faster, each in the style that
// suits that tempo, the key and what the person said they like. "More" keeps going — other styles
// first, then other tempos, then other lead instruments — up to MAX_VARIANTS.
import type { Key } from './project';
import { STYLES, type Style } from './styles';

export type Feel = 'hummed' | 'slower' | 'faster' | 'more';
export interface Variant { style: Style; bpm: number; feel: Feel; /** Another lead instrument than the style's own. */ lead?: string }

export const MAX_VARIANTS = 100;
const variantKey = (v: Variant): string => `${v.style.id}:${v.bpm}:${v.lead ?? ''}`;

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

/** The next `count` songs to offer: styles not heard yet first, then the same styles at other tempos,
 * then with other lead instruments. Never repeats one already shown; stops at MAX_VARIANTS. */
export function moreVariants(bpm: number, key: Key | undefined, likes: readonly string[], shown: readonly Variant[], count = 3): Variant[] {
  const seen = new Set(shown.map(variantKey));
  const seenStyles = new Set(shown.map((v) => v.style.id));
  const room = Math.max(0, MAX_VARIANTS - shown.length);
  const cands: { v: Variant; s: number }[] = [];
  for (const style of STYLES) {
    const natural = clampBpm(Math.min(style.bpm[1], Math.max(style.bpm[0], bpm)));
    const tempos: [Feel, number][] = [['more', natural], ['slower', clampBpm(bpm * 0.8)], ['faster', clampBpm(bpm * 1.25)], ['hummed', clampBpm(bpm)]];
    const leads = [undefined, ...(style.alts ?? [])];
    tempos.forEach(([feel, tempo], ti) => {
      if (ti > 0 && tempoFit(style, tempo) < 0.35) return; // keep each style where it sounds right
      leads.forEach((lead, li) => {
        const v: Variant = { style, bpm: tempo, feel, lead };
        if (!seen.has(variantKey(v))) cands.push({ v, s: score(style, tempo, key, likes, feel) - 0.4 * ti - 0.9 * li });
      });
    });
  }
  // One at a time, so a batch spreads over styles nobody has heard yet.
  const out: Variant[] = [];
  while (out.length < Math.min(count, room) && cands.length) {
    let best = 0;
    let bestScore = -Infinity;
    cands.forEach((c, i) => {
      const s = c.s + (seenStyles.has(c.v.style.id) ? 0 : 1.5);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    const [pick] = cands.splice(best, 1);
    out.push(pick.v);
    seenStyles.add(pick.v.style.id);
  }
  return out;
}

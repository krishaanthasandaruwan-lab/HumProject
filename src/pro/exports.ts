// Who can export what. Every hum gives 3 free versions; the extra ones from More carry a lock. Anything
// with a lock — an extra version, a Pro sound the person picked, Tracks, Fix — can be played and edited
// for free, but a song that uses one needs Pro to export. Pro sounds that came with a version don't count.
import type { Project, ProTool } from '../model/project';
import { getInstrument, getKit } from '../synth/kits';
import { isPro } from './pro';

/** Versions of a hum that are free to export; the rest carry a lock. */
export const FREE_VERSIONS = 3;

const TOOL_NAMES: Record<ProTool, string> = { more: 'a version from More', tracks: 'Tracks', fix: 'Fix', fx: 'the voice effect' };

/** The locked things in this song: an extra version, Pro sounds the person picked, Pro tools they used. */
export function lockedIn(p: Project): string[] {
  const out = new Set<string>();
  if (p.proTools?.includes('more')) out.add(TOOL_NAMES.more);
  for (const t of p.tracks) {
    if (!t.picked) continue;
    const sound = t.kind === 'drums' ? getKit(t.preset) : getInstrument(t.preset);
    if (sound.pro) out.add(sound.name);
  }
  for (const tool of ['tracks', 'fix', 'fx'] as const) if (p.proTools?.includes(tool)) out.add(TOOL_NAMES[tool]);
  return [...out];
}

export interface LockedItem {
  name: string;
  why: string;
  /** The part it belongs to, when there is one. */
  track?: Project['tracks'][number];
}

/** The locked things in this song, one by one, for the "Pro features in this song" list. */
export function lockedItems(p: Project): LockedItem[] {
  const out: LockedItem[] = [];
  if (p.proTools?.includes('more')) out.push({ name: 'Extra version', why: 'One of the extra versions of your hum, from More' });
  for (const t of p.tracks) {
    if (!t.picked) continue;
    const sound = t.kind === 'drums' ? getKit(t.preset) : getInstrument(t.preset);
    if (sound.pro) out.push({ name: sound.name, why: t.kind === 'drums' ? 'A Pro drum kit you picked' : 'A Pro sound you picked', track: t });
  }
  if (p.proTools?.includes('tracks')) out.push({ name: 'Tracks', why: 'Notes or beats changed on the Tracks screen' });
  if (p.proTools?.includes('fix')) out.push({ name: 'Fix', why: 'Fix used on a part' });
  if (p.proTools?.includes('fx')) out.push({ name: 'Voice effect', why: 'The effect on My voice' });
  return out;
}

const words = (items: string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export type ExportCheck = { ok: true } | { ok: false; reason: string };

/** May this song be exported now? */
export function canExport(p: Project): ExportCheck {
  if (isPro()) return { ok: true };
  const locked = lockedIn(p);
  return locked.length ? { ok: false, reason: `Pro is needed to export this song: it uses ${words(locked)}.` } : { ok: true };
}

/** Mark a Pro tool as used on a song (returns false when it already was). */
export function markTool(p: Project, tool: ProTool): boolean {
  if (p.proTools?.includes(tool)) return false;
  p.proTools = [...(p.proTools ?? []), tool];
  return true;
}

export function unmarkTool(p: Project, tool: ProTool): void {
  p.proTools = (p.proTools ?? []).filter((t) => t !== tool);
}

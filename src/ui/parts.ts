// What each part is called and which icon shows it (design spec B6). Parts are told apart by icon and
// name, never by colour.
import { kindNumber, type Project, type Track, type TrackKind } from '../model/project';
import type { IconName } from './icons';

export type PartId = TrackKind | 'voice';

export const PARTS: Record<PartId, { label: string; icon: IconName; verb: string }> = {
  drums: { label: 'Drums', icon: 'drums', verb: 'Beatbox' },
  bass: { label: 'Bass', icon: 'bass', verb: 'Hum low' },
  lead: { label: 'Melody', icon: 'melody', verb: 'Hum' },
  chords: { label: 'Chords', icon: 'chords', verb: '' },
  voice: { label: 'My voice', icon: 'voice', verb: '' },
};

/** "Drums", or "Drums 2" when there is more than one drum part. */
export function partLabel(p: Project, t: Track): string {
  const n = kindNumber(p, t);
  return n ? `${PARTS[t.kind].label} ${n}` : PARTS[t.kind].label;
}

const STYLE_ICONS: Record<string, IconName> = {
  chill: 'lofi', pop: 'pop', trap: 'trap', dance: 'dance', band: 'band', cinema: 'cinema', rnb: 'rnb', rock: 'rock', reggae: 'reggae',
  afro: 'afro', reggaeton: 'reggaeton', funk: 'funk', jazz: 'jazz', ballad: 'ballad', edm: 'edm', drill: 'drill', garage: 'garage',
  synthwave: 'synthwave', folk: 'folk', ambient: 'ambient',
};

export function styleIcon(id: string): IconName {
  return STYLE_ICONS[id] ?? 'melody';
}

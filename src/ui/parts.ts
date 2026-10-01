// What each part is called and which icon shows it (design spec B6). Parts are told apart by icon and
// name, never by colour.
import type { TrackKind } from '../model/project';
import type { IconName } from './icons';

export type PartId = TrackKind | 'voice';

export const PARTS: Record<PartId, { label: string; icon: IconName; verb: string }> = {
  drums: { label: 'Drums', icon: 'drums', verb: 'Beatbox' },
  bass: { label: 'Bass', icon: 'bass', verb: 'Hum low' },
  lead: { label: 'Melody', icon: 'melody', verb: 'Hum' },
  chords: { label: 'Chords', icon: 'chords', verb: '' },
  voice: { label: 'My voice', icon: 'voice', verb: '' },
};

const STYLE_ICONS: Record<string, IconName> = { chill: 'lofi', pop: 'pop', trap: 'trap', dance: 'dance', band: 'band', cinema: 'cinema' };

export function styleIcon(id: string): IconName {
  return STYLE_ICONS[id] ?? 'melody';
}

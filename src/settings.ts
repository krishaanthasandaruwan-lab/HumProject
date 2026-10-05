// Per-device settings, persisted in IndexedDB (idb-keyval).
import { get, set } from 'idb-keyval';
import type { Theme } from './theme';

export interface Settings {
  theme: Theme;
  /** Manual latency correction in ms, added to the auto-measured round trip. */
  latencyMs: number;
  clickDuringTake: boolean;
  bandDuringTake: boolean;
  snapToScale: boolean;
  lastBpm: number;
  lastBars: 2 | 4 | 8;
  lastProjectId?: string;
  /** Style ids the person likes (asked once on first launch); shapes the three songs offered. */
  likes: string[];
  /** The "what music do you like" question was shown. */
  tasteAsked: boolean;
  /** The sign-in screen was shown (once, after the music question). */
  signInAsked: boolean;
  /** "Don't show again" on the "… is Pro · export needs Pro" notes. */
  proNoticeOff: boolean;
}

const DEFAULTS: Settings = {
  theme: 'system',
  latencyMs: 0,
  clickDuringTake: true,
  bandDuringTake: true,
  snapToScale: true,
  lastBpm: 90,
  lastBars: 4,
  likes: [],
  tasteAsked: false,
  signInAsked: false,
  proNoticeOff: false,
};

let current: Settings = { ...DEFAULTS };
let revision = 0;
const mirroredTheme = (): Theme | undefined => {
  try {
    const value = localStorage.getItem('humm-theme');
    if (value === 'system' || value === 'light' || value === 'dark') return value;
  } catch { /* localStorage is optional */ }
};
current.theme = mirroredTheme() ?? current.theme;

export async function loadSettings(): Promise<Settings> {
  const started = revision;
  try {
    const saved = await get<Partial<Settings>>('settings');
    if (saved && started === revision) {
      current = { ...DEFAULTS, ...saved };
      if (!['system', 'light', 'dark'].includes(current.theme)) current.theme = 'system';
      current.theme = mirroredTheme() ?? current.theme;
    }
  } catch {
    /* private mode / blocked storage: defaults are fine */
  }
  return current;
}

export function settings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  revision++;
  current = { ...current, ...patch };
  set('settings', current).catch(() => window.dispatchEvent(new Event('humm:settings-error')));
}

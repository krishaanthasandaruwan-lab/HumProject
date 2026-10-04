// Per-device settings, persisted in IndexedDB (idb-keyval).
import { get, set } from 'idb-keyval';

export interface Settings {
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

export async function loadSettings(): Promise<Settings> {
  try {
    const saved = await get<Partial<Settings>>('settings');
    if (saved) current = { ...DEFAULTS, ...saved };
  } catch {
    /* private mode / blocked storage: defaults are fine */
  }
  return current;
}

export function settings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  set('settings', current).catch(() => undefined);
}

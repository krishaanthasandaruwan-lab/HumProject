// Free vs Pro. Free: watermark on videos, 2 drum kits, 12 instruments, 3 saved songs, 1-minute hums.
// Pro ($0.99 once): no watermark, all kits and instruments, WAV + MIDI export, unlimited songs.
import { get, set } from 'idb-keyval';
import { getInstrument, getKit } from '../synth/kits';

/** Build-time switch for test builds: VITE_DEV_PRO=true (npm run ios:sync:pro). Starts with Pro on. */
export const DEV_PRO = import.meta.env.VITE_DEV_PRO === 'true';
/** Dev server and test builds get a Pro on/off switch in Settings; store builds never contain it. */
export const TESTER_BUILD = import.meta.env.DEV || DEV_PRO;

export const FREE_SONG_LIMIT = 3;
const DEV_TOGGLE_KEY = 'mb-dev-pro';

let owned = false;
const listeners = new Set<() => void>();

function devToggle(): boolean {
  if (!TESTER_BUILD) return false;
  try {
    const v = localStorage.getItem(DEV_TOGGLE_KEY);
    return v === null ? DEV_PRO : v === '1';
  } catch {
    return DEV_PRO;
  }
}

export function isPro(): boolean {
  return owned || devToggle();
}

export async function loadPro(): Promise<void> {
  try {
    owned = (await get<boolean>('pro-owned')) === true;
  } catch {
    owned = false;
  }
}

/** Called by billing with the store's answer (the store is the source of truth). */
export function setOwned(value: boolean): void {
  if (owned === value) return;
  owned = value;
  set('pro-owned', value).catch(() => undefined);
  listeners.forEach((f) => f());
}

export function setDevPro(on: boolean): void {
  try {
    localStorage.setItem(DEV_TOGGLE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f());
}

export function onProChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const kitLocked = (id: string): boolean => !isPro() && getKit(id).pro;
export const instrumentLocked = (id: string): boolean => !isPro() && getInstrument(id).pro;

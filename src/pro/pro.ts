// Free vs Pro. Free: watermark on videos, 2 drum kits, 8 instruments, 3 saved songs.
// Pro ($0.99 once): no watermark, all kits and instruments, WAV + MIDI export, unlimited songs.
import { get, set } from 'idb-keyval';
import { getInstrument, getKit } from '../synth/kits';

/** Build-time switch for test builds: VITE_DEV_PRO=true. */
export const DEV_PRO = import.meta.env.VITE_DEV_PRO === 'true';

export const FREE_SONG_LIMIT = 3;
const DEV_TOGGLE_KEY = 'mb-dev-pro';

let owned = false;
const listeners = new Set<() => void>();

function devToggle(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(DEV_TOGGLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isPro(): boolean {
  return DEV_PRO || owned || devToggle();
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

// Free vs Pro. Everything can be used for free, and any number of songs kept; locked things (extra
// versions of a hum, Pro sounds, Tracks, Fix, the voice effect) make a song need Pro to export
// (pro/exports.ts). Free hums last up to a minute, and free videos carry the "Made with HUMM" mark.
// Pro ($0.99 once): exports every song (no mark), MIDI files, 3-minute hums.
import { del } from 'idb-keyval';
import { getInstrument, getKit } from '../synth/kits';

/** Build-time switch for test builds: VITE_DEV_PRO=true (npm run ios:sync:pro). Starts with Pro on. */
export const DEV_PRO = import.meta.env.MODE === 'testing' && import.meta.env.VITE_DEV_PRO === 'true';
/** Dev server and test builds get a Pro on/off switch in Settings; store builds never contain it. */
export const TESTER_BUILD = import.meta.env.DEV || import.meta.env.MODE === 'testing';
const DEV_TOGGLE_KEY = 'mb-dev-pro';
const TESTER_KEY = 'mb-tester-pro';

/** Store purchases are set up (RevenueCat keys in the build). From then on Pro comes from the store
 * only, and the tester code below stops working by itself. */
export const STORE_READY = !!(import.meta.env.VITE_REVENUECAT_IOS_KEY || import.meta.env.VITE_REVENUECAT_ANDROID_KEY);
/** Fingerprint of the tester code (the code itself is not in the app). */
const TESTER_PRINT = 'ed5172e8de5a0fcb';

function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const testerUnlocked = (): boolean => {
  if (!TESTER_BUILD || STORE_READY) return false;
  try {
    return localStorage.getItem(TESTER_KEY) === '1';
  } catch {
    return false;
  }
};

/** Tester code: unlocks Pro on this phone for testing, until the store is set up. */
export function redeemTesterCode(code: string): boolean {
  if (!TESTER_BUILD || STORE_READY) return false;
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (fnv(c, 2166136261) + fnv([...c].reverse().join(''), 0x9747b28c) !== TESTER_PRINT) return false;
  try {
    localStorage.setItem(TESTER_KEY, '1');
  } catch {
    return false;
  }
  listeners.forEach((f) => f());
  return true;
}

export function testerPro(): boolean {
  return testerUnlocked();
}

export function endTesterPro(): void {
  try {
    localStorage.removeItem(TESTER_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f());
}

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
  return owned || devToggle() || testerUnlocked();
}

export async function loadPro(): Promise<void> {
  // The native SDK caches signed CustomerInfo for offline access. A writable boolean is not a receipt.
  owned = false;
  await del('pro-owned').catch(() => undefined);
}

/** Called by billing with the store's answer (the store is the source of truth). */
export function setOwned(value: boolean): void {
  if (owned === value) return;
  owned = value;
  listeners.forEach((f) => f());
}

export function setDevPro(on: boolean): void {
  if (!TESTER_BUILD) return;
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

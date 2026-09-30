// The personal beatbox profile (k-NN training set), stored in IndexedDB.
import { del, get, set } from 'idb-keyval';
import type { Profile } from './dsp/drumClassifier';

const KEY = 'drum-profile';
let current: Profile | null = null;

export async function loadProfile(): Promise<Profile | null> {
  try {
    current = (await get<Profile>(KEY)) ?? null;
  } catch {
    current = null;
  }
  return current;
}

export function getProfile(): Profile | null {
  return current;
}

export async function saveProfile(p: Profile): Promise<void> {
  current = p;
  await set(KEY, p).catch(() => undefined);
}

export async function clearProfile(): Promise<void> {
  current = null;
  await del(KEY).catch(() => undefined);
}

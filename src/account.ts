// First release is account-free; only removal of an identity saved by a previous test build remains.
import { secureStore } from './native/humm';

export interface Account {
  /** Apple's stable id for this person in HUMM. */
  user: string;
  name?: string;
  email?: string;
  since: number;
}

const KEY = 'account';
let current: Account | null = null;
const listeners = new Set<() => void>();

export const account = (): Account | null => current;
/** First release is account-free. Reintroducing Apple sign-in requires account deletion/revocation. */
export const canSignIn = (): boolean => false;

export function onAccountChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

async function store(a: Account | null): Promise<void> {
  await (a ? secureStore.set(KEY, JSON.stringify(a)) : secureStore.remove(KEY));
  current = a;
  listeners.forEach((f) => f());
}

export async function loadAccount(): Promise<void> {
  try {
    const raw = await secureStore.get(KEY);
    current = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    current = null;
  }
}

/** Sign out: forget the Apple identity on this phone. Songs are not touched. */
export function signOut(): Promise<void> {
  return store(null);
}

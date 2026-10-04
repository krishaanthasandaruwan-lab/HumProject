// Who is using HUMM: an optional Sign in with Apple identity. It is kept in the iPhone's Keychain, so it
// stays on the phone (nothing is sent anywhere) and survives the app being deleted and installed again.
import { appleCredentialState, hasNative, secureStore, signInWithApple } from './native/humm';

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
/** Sign in with Apple exists here (the iPhone and iPad app). */
export const canSignIn = (): boolean => hasNative();

export function onAccountChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

async function store(a: Account | null): Promise<void> {
  current = a;
  await (a ? secureStore.set(KEY, JSON.stringify(a)) : secureStore.remove(KEY)).catch(() => undefined);
  listeners.forEach((f) => f());
}

export async function loadAccount(): Promise<void> {
  try {
    const raw = await secureStore.get(KEY);
    current = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    current = null;
  }
  // Someone who stopped using Sign in with Apple for HUMM (iOS Settings › Apple ID) is signed out here too.
  if (current && hasNative()) {
    const state = await appleCredentialState(current.user).catch(() => 'unknown');
    if (state === 'revoked' || state === 'notFound') await store(null);
  }
}

export type SignInResult = 'ok' | 'cancelled' | 'failed';

export async function signIn(): Promise<SignInResult> {
  try {
    const u = await signInWithApple();
    // Apple sends the name and email only the first time; keep what we had on later sign-ins.
    const same = current?.user === u.user ? current : null;
    const name = [u.givenName, u.familyName].filter(Boolean).join(' ') || same?.name;
    await store({ user: u.user, name, email: u.email ?? same?.email, since: same?.since ?? Date.now() });
    return 'ok';
  } catch (err) {
    return (err as { code?: string }).code === 'cancelled' ? 'cancelled' : 'failed';
  }
}

/** Sign out: forget the Apple identity on this phone. Songs are not touched. */
export function signOut(): Promise<void> {
  return store(null);
}

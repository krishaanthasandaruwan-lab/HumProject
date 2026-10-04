// HUMM's own native plugin (ios/App/App/HummNative.swift): Sign in with Apple and a Keychain store.
// Where it isn't there (the web, Android) the store falls back to localStorage and sign-in is unavailable.
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AppleUser {
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
}

interface HummNativePlugin {
  signInWithApple(): Promise<AppleUser>;
  appleCredentialState(o: { user: string }): Promise<{ state: 'authorized' | 'revoked' | 'notFound' | 'unknown' }>;
  keychainGet(o: { key: string }): Promise<{ value: string | null }>;
  keychainSet(o: { key: string; value: string }): Promise<void>;
  keychainRemove(o: { key: string }): Promise<void>;
}

const native = registerPlugin<HummNativePlugin>('HummNative');

/** The native plugin is in this build (the iPhone / iPad app). */
export const hasNative = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('HummNative');

export const signInWithApple = (): Promise<AppleUser> => native.signInWithApple();
export const appleCredentialState = (user: string): Promise<string> => native.appleCredentialState({ user }).then((r) => r.state);

const LOCAL = 'mb-secure:';

/** Small values that should outlive a reinstall: the Keychain in the app, localStorage elsewhere. */
export const secureStore = {
  async get(key: string): Promise<string | null> {
    if (hasNative()) return (await native.keychainGet({ key })).value;
    try {
      return localStorage.getItem(LOCAL + key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (hasNative()) return native.keychainSet({ key, value });
    try {
      localStorage.setItem(LOCAL + key, value);
    } catch {
      /* private mode: kept for this session only */
    }
  },
  async remove(key: string): Promise<void> {
    if (hasNative()) return native.keychainRemove({ key });
    try {
      localStorage.removeItem(LOCAL + key);
    } catch {
      /* ignore */
    }
  },
};

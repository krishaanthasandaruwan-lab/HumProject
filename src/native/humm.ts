// Native appearance, accessibility text size and a Keychain store for legacy test identities.
import { Capacitor, registerPlugin } from '@capacitor/core';

interface HummNativePlugin {
  setAppearance(o: { theme: 'system' | 'light' | 'dark' }): Promise<void>;
  textScale(): Promise<{ scale: number }>;
  keychainGet(o: { key: string }): Promise<{ value: string | null }>;
  keychainSet(o: { key: string; value: string }): Promise<void>;
  keychainRemove(o: { key: string }): Promise<void>;
}

const native = registerPlugin<HummNativePlugin>('HummNative');

/** The native plugin is in this build (the iPhone / iPad app). */
export const hasNative = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('HummNative');
export const setNativeAppearance = (theme: 'system' | 'light' | 'dark'): Promise<void> => native.setAppearance({ theme });

export function installNativeTextScale(): void {
  if (!hasNative()) return;
  const apply = (): void => { void native.textScale().then(({ scale }) => {
    if (!Number.isFinite(scale) || scale <= 0) return;
    document.documentElement.style.fontSize = `${16 * scale}px`;
    window.dispatchEvent(new Event('resize'));
  }).catch(() => undefined); };
  window.addEventListener('humm:text-scale', apply);
  apply();
}

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
    localStorage.setItem(LOCAL + key, value);
  },
  async remove(key: string): Promise<void> {
    if (hasNative()) return native.keychainRemove({ key });
    localStorage.removeItem(LOCAL + key);
  },
};

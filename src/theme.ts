import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { settings, updateSettings } from './settings';
import { hasNative, setNativeAppearance } from './native/humm';
export type Theme = 'system' | 'light' | 'dark';
const system = matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(): void {
  const choice = settings().theme;
  const dark = choice === 'dark' || (choice === 'system' && system.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111111' : '#F6F4EF');
  try { localStorage.setItem('humm-theme', choice); } catch { /* IndexedDB remains the preference store */ }
  if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
  if (hasNative()) void setNativeAppearance(choice).catch(() => undefined);
  window.dispatchEvent(new Event('humm:theme-change'));
}
export function setTheme(theme: Theme): void { updateSettings({ theme }); applyTheme(); }
system.addEventListener('change', applyTheme);

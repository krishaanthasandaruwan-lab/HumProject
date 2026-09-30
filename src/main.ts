// App shell: styles, audio unlock, settings, screen router, PWA registration.
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { installUnlock } from './audio/context';
import { loadSettings } from './settings';
import { navigate, registerScreen } from './router';
import { mountRecord } from './ui/record';

registerScreen('record', mountRecord);

async function boot(): Promise<void> {
  installUnlock();
  await loadSettings();
  navigate('record');
  if (import.meta.env.PROD) registerSW({ immediate: true });
}

void boot();

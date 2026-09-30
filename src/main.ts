// App shell: styles, audio unlock, settings, project, screen router, PWA registration.
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { installUnlock, setAudioSession } from './audio/context';
import { navigate, registerScreen } from './router';
import { loadSettings } from './settings';
import { openInitialProject } from './state';
import { mountRecord } from './ui/record';
import { mountStudio } from './ui/studio';

registerScreen('studio', mountStudio);
registerScreen('record', mountRecord);

async function boot(): Promise<void> {
  installUnlock();
  setAudioSession('playback'); // iOS: play through the speaker even when the ring switch is on silent
  await loadSettings();
  await openInitialProject();
  navigate('studio');
  if (import.meta.env.PROD) registerSW({ immediate: true });
}

void boot();

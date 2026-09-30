// App shell: styles, audio unlock, settings, project, screen router, PWA registration.
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { installUnlock, setAudioSession } from './audio/context';
import { navigate, registerScreen } from './router';
import { loadSettings } from './settings';
import { openInitialProject } from './state';
import { mountRecord } from './ui/record';
import { mountStudio } from './ui/studio';
import { mountCalibrate } from './ui/calibrate';
import { mountSettings } from './ui/settings';
import { mountProjects } from './ui/projects';
import { loadProfile } from './profile';

registerScreen('studio', mountStudio);
registerScreen('record', mountRecord);
registerScreen('calibrate', mountCalibrate);
registerScreen('settings', mountSettings);
registerScreen('projects', mountProjects);

async function boot(): Promise<void> {
  installUnlock();
  setAudioSession('playback'); // iOS: play through the speaker even when the ring switch is on silent
  await loadSettings();
  await Promise.all([openInitialProject(), loadProfile()]);
  navigate('studio');
  if (import.meta.env.PROD) registerSW({ immediate: true });
}

void boot();

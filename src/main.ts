// App shell: styles, audio unlock, settings, project, screen router, PWA registration.
import './styles/base.css';
import './styles/extra.css';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { installUnlock, setAudioSession } from './audio/context';
import { navigate, registerScreen } from './router';
import { openInitialProject } from './state';
import { mountRecord } from './ui/record';
import { mountStudio } from './ui/studio';
import { mountCalibrate } from './ui/calibrate';
import { mountSettings } from './ui/settings';
import { mountProjects } from './ui/projects';
import { mountHum } from './ui/hum';
import { mountChoices } from './ui/choices';
import { loadPro } from './pro/pro';
import { initBilling } from './pro/billing';
import { loadSettings, settings } from './settings';
import { loadProfile } from './profile';

registerScreen('studio', mountStudio);
registerScreen('record', mountRecord);
registerScreen('calibrate', mountCalibrate);
registerScreen('settings', mountSettings);
registerScreen('projects', mountProjects);
registerScreen('hum', mountHum);
registerScreen('choices', mountChoices);

const SPLASH_MS = 1100;

/** Fade the logo splash out once the app is ready (and has been on screen for a moment). */
function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, Math.max(0, SPLASH_MS - performance.now()));
}

async function boot(): Promise<void> {
  installUnlock();
  setAudioSession('playback'); // iOS: play through the speaker even when the ring switch is on silent
  await loadSettings();
  await Promise.all([openInitialProject(), loadProfile(), loadPro()]);
  navigate(settings().startWithMic ? 'hum' : 'studio');
  hideSplash();
  void initBilling();
  // The iPhone and Android apps ship their files inside the app; the service worker is for the web PWA only.
  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) registerSW({ immediate: true });
}

void boot();

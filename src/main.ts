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
import { mountOnboarding } from './ui/onboarding';
import { loadPro } from './pro/pro';
import { initBilling } from './pro/billing';
import { loadSettings, settings } from './settings';
import { loadProfile } from './profile';

registerScreen('studio', mountStudio);
registerScreen('record', mountRecord);
registerScreen('calibrate', mountCalibrate);
registerScreen('settings', mountSettings);
registerScreen('projects', mountProjects);
registerScreen('onboarding', mountOnboarding);

async function boot(): Promise<void> {
  installUnlock();
  setAudioSession('playback'); // iOS: play through the speaker even when the ring switch is on silent
  await loadSettings();
  await Promise.all([openInitialProject(), loadProfile(), loadPro()]);
  navigate(settings().onboarded ? 'studio' : 'onboarding');
  void initBilling();
  // The Android app ships its files inside the APK; the service worker is for the web PWA only.
  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) registerSW({ immediate: true });
}

void boot();

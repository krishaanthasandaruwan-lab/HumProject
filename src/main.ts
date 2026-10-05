// App shell: styles, audio unlock, settings, project, screen router, PWA registration.
// Fonts ship inside the app (offline): Anton for titles, Barlow Condensed for labels and buttons, Barlow for text.
// Latin and Latin Extended only (accented names too); no Cyrillic or Vietnamese files in the app.
import '@fontsource/anton/latin-400.css';
import '@fontsource/anton/latin-ext-400.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-ext-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-ext-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-ext-600.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/overlay.css';
import './styles/sheets.css';
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
import { mountPart } from './ui/part';
import { mountTracks } from './ui/tracks';
import { mountWelcome } from './ui/taste';
import { afterTaste, mountSignIn } from './ui/signin';
import { canSignIn, loadAccount } from './account';
import { loadPro } from './pro/pro';
import { initBilling } from './pro/billing';
import { loadSettings, settings } from './settings';
import { loadProfile } from './profile';
import { applyTheme } from './theme';
import { listTrash } from './storage';
import { installSaveStatus } from './ui/saveStatus';
import { pruneSharedFiles } from './cache';
import { installNativeTextScale } from './native/humm';
// Last, so the sideways layouts win over each screen's own styles.
import './styles/landscape.css';

registerScreen('studio', mountStudio);
registerScreen('record', mountRecord);
registerScreen('calibrate', mountCalibrate);
registerScreen('settings', mountSettings);
registerScreen('projects', mountProjects);
registerScreen('hum', mountHum);
registerScreen('choices', mountChoices);
registerScreen('part', mountPart);
registerScreen('tracks', mountTracks);
registerScreen('welcome', mountWelcome);
registerScreen('signin', mountSignIn);

/** Storage that never answers (a stuck IndexedDB) must not keep the app on a blank screen forever. */
const atMost = <T,>(ms: number, job: Promise<T>): Promise<T | void> =>
  Promise.race([job, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

async function boot(): Promise<void> {
  installUnlock();
  installSaveStatus();
  installNativeTextScale();
  setAudioSession('playback'); // iOS: play through the speaker even when the ring switch is on silent
  await atMost(4000, loadSettings().then(() => applyTheme()));
  applyTheme();
  await atMost(4000, Promise.allSettled([openInitialProject(), loadProfile(), loadPro(), loadAccount()]));
  // The mic is home. First launch asks what music they like; this release has no account service.
  const s = settings();
  navigate(s.tasteAsked ? afterTaste(canSignIn(), s.signInAsked) : 'welcome');
  void initBilling();
  void listTrash().catch(() => undefined);
  void pruneSharedFiles().catch(() => undefined);
  // The iPhone and Android apps ship their files inside the app; the service worker is for the web PWA only.
  if (import.meta.env.PROD && !Capacitor.isNativePlatform()) registerSW({ immediate: true });
}

void boot();

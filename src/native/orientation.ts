// Landscape lock for the screens that only work sideways (the Tracks screen, and a part opened from it).
// Each screen holds the lock while it is open; letting go waits one tick, so going from one of them to
// the other never drops back to portrait (with the phone's rotation lock on, iOS would snap straight back).
import { Capacitor } from '@capacitor/core';

type Orientation = typeof import('@capacitor/screen-orientation');
const plugin = (): Promise<Orientation | null> =>
  Capacitor.isNativePlatform() ? import('@capacitor/screen-orientation').catch(() => null) : Promise.resolve(null);

let holders = 0;
let locked = false;
let releaseTimer = 0;

/** Lock the app to landscape until the returned function is called. */
export function holdLandscape(): () => void {
  holders++;
  clearTimeout(releaseTimer);
  if (!locked) {
    locked = true;
    void plugin().then((o) => o?.ScreenOrientation.lock({ orientation: 'landscape' })).catch(() => undefined);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      if (holders > 0 || !locked) return;
      locked = false;
      void plugin().then((o) => o?.ScreenOrientation.unlock()).catch(() => undefined);
    }, 0);
  };
}

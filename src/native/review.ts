// "Rate HUMM": the system's own rating prompt in the apps (App Store / Google Play in-app review).
// The web version opens the store page instead.
import { Capacitor } from '@capacitor/core';
import { storeUrl } from '../pro/billing';

export async function rateApp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { InAppReview } = await import('@capacitor-community/in-app-review');
      await InAppReview.requestReview();
      return;
    } catch {
      /* fall through to the store page */
    }
  }
  window.open(storeUrl(), '_blank', 'noopener');
}

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** "true" builds the app with every Pro feature unlocked (testing). */
  readonly VITE_DEV_PRO?: string;
  /** RevenueCat public SDK key for Google Play ("goog_…"). */
  readonly VITE_REVENUECAT_ANDROID_KEY?: string;
  /** RevenueCat public SDK key for the App Store ("appl_…"). */
  readonly VITE_REVENUECAT_IOS_KEY?: string;
  /** App Store listing, once the app exists (https://apps.apple.com/app/id…). */
  readonly VITE_APP_STORE_URL?: string;
  /** RevenueCat entitlement identifier, default "pro". */
  readonly VITE_PRO_ENTITLEMENT?: string;
  /** Where the web version sends people who want Pro. */
  readonly VITE_PLAY_STORE_URL?: string;
}

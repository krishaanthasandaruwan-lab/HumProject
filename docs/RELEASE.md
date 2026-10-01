# Releasing HUMM (App Store and Google Play)

Everything in the code is ready for review. These are the steps only you can do, in order.

## 1. Decide two things before the first upload (they can't change later)

- **Bundle ID / application ID.** It is `com.krishanthasandaruwan.humm` today (hidden from users). If you want
  `com.krishanthasandaruwan.humm` or similar, say so before the first upload; after that it is fixed forever.
- **App name.** "HUMM: Hum to Song" must be free in App Store Connect and Play Console. Check it there first.

## 2. Purchases (RevenueCat)

1. App Store Connect: create the app, then a **Non-Consumable** in-app purchase `humm_pro`, $0.99.
2. Play Console: create the app, then an in-app product `humm_pro`, $0.99.
3. RevenueCat: entitlement `pro`, offering `default` with both products.
4. Put the two public SDK keys in `.env.local` (`VITE_REVENUECAT_IOS_KEY`, `VITE_REVENUECAT_ANDROID_KEY`).
   Details: `STORE_LISTING.md`.

## 3. A privacy policy web address

Both stores require a **public URL** for the privacy policy, even though HUMM shows the policy inside
the app. The text is ready (Settings › Privacy, and `STORE_LISTING.md`). Put it on any public page you
control (a free GitHub Pages site, Notion, Google Sites) and paste that link in both consoles.

## 4. Build and upload — iPhone and iPad

1. `npm run ios:sync` (store build: no test switches inside).
2. `npm run ios:open`. In Xcode: the **App** target › Signing & Capabilities › your team (already set).
3. Version 1.0, build 1 for the first upload; raise the build number for every new upload.
4. Product › Archive › Distribute App › App Store Connect › Upload.
5. In App Store Connect: test with **TestFlight** first (purchases use sandbox accounts there).

App Store Connect form:
- **Screenshots**: iPhone 6.9" (1320 × 2868) **and iPad 13" (2064 × 2752)**, because HUMM now runs on iPad.
- **App Privacy**: Purchase History, used for App Functionality, not linked to identity, no tracking.
  Everything else: Data Not Collected. (Matches `ios/App/App/PrivacyInfo.xcprivacy`.)
- **Age rating**: 4+. **Category**: Music.
- **Export compliance**: already answered in the app (no non-exempt encryption).
- **Review notes**: copy them from `STORE_LISTING.md`.

## 5. Build and upload — Android

1. `npm run android:sync`, then in Android Studio: Build › Generate Signed App Bundle (create an upload
   key once and keep it safe — losing it means you can't update the app).
2. Play Console: internal testing track first. Data safety: no data collected; purchases handled by Google.
3. Target API 36 is already set (required for new apps from 31 August 2026).

## 6. Testing Pro on your own phone before release

- Any build without store keys: Settings › Pro › **Tester code**. The code unlocks Pro on that phone
  only. It stops working automatically once the RevenueCat keys are in the build (step 2), so the store
  version never accepts it.

- iPhone: `npm run ios:pro` (builds with Pro on, opens Xcode), then Run. Settings shows a "Test build:
  Pro on" switch to flip between free and Pro. **Never upload this build**: run `npm run ios:sync`
  before archiving.
- Android: `npm run android:sync:pro`, then Run in Android Studio.

## Security checklist (done in code)

- [x] No network use except the purchase check; no analytics, ads or accounts
- [x] Content-Security-Policy in production builds; no remote scripts, fonts or images
- [x] No `eval` / `innerHTML`; user text only set as text; export file names cleaned
- [x] Minified, no source maps; web inspection off in the apps
- [x] Pro state comes from the store (RevenueCat), re-checked at launch and on every store change
- [x] iOS privacy manifest; microphone and photo-library permission texts
- [x] Android WebView debugging off; no cleartext traffic
- [ ] Your upload keys and RevenueCat keys stay out of git (`.env.local` and keystores are ignored)

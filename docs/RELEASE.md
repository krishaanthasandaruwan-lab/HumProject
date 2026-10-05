# Releasing HUMM on iOS

Updated 5 October 2026. All remediation remains local; nothing has been pushed or uploaded.
See [AUDIT_REMEDIATION.md](AUDIT_REMEDIATION.md) for evidence and remaining acceptance checks.
Compilation and automated QA do not replace a signed TestFlight purchase/device acceptance run.

## Owner configuration

Copy `.env.example` to the ignored `.env.local` and supply real values for:

| Variable | Value needed |
|---|---|
| `VITE_DEV_PRO` | `false` |
| `VITE_REVENUECAT_IOS_KEY` | Real App Store public SDK key, beginning `appl_` |
| `VITE_PRO_ENTITLEMENT` | `pro`, or the configured entitlement |
| `VITE_PRO_PRODUCT_ID` | `humm_pro`, or the configured non-consumable |
| `VITE_PRIVACY_POLICY_URL` | Working public HTTPS policy page |
| `VITE_SUPPORT_EMAIL` | Real support email |
| `VITE_APP_STORE_URL` | App Store listing URL when available |

`npm run release:check` and `npm run build:release` reject missing owner details, obvious placeholder
keys and developer Pro flags. They validate configuration syntax; store setup, website availability
and signing require separate checks. Regular development builds can run without live store setup.
Xcode Archive also rejects assets not produced by a validated `release` build, so directly archiving
a development/testing sync cannot bypass these configuration checks.

- Join/select a paid Apple Developer Program team in Xcode. Confirm bundle ID
  `com.krishanthasandaruwan.humm` before the first submission.
- Create the app in App Store Connect. Complete agreements, tax and banking as applicable.
- Create non-consumable product `humm_pro`, with localized name, description, price and review image.
  The intended US price is $0.99; confirm it in the store. The app displays the actual localized price.
- In RevenueCat, attach that product to entitlement `pro` and a Lifetime package in the current
  offering. Add required store credentials in the dashboard and the public SDK key to the app.
- Confirm anonymous-user restore/transfer behavior for reinstall and a second device.
- Publish a privacy-policy page and support contact; test over cellular while signed out. The app
  links them from Settings once configured.
- This release creates no account and offers no Apple sign-in. Do not enable that capability.
  Reintroducing accounts requires a separate deletion/revocation design.

## Local checks and archive

Use Node 24 for the release checker, which directly imports its shared TypeScript validator.

```bash
npm ci
npm run typecheck
npm test
npm audit
npm run release:check
npm run build:release
npx cap sync ios
```

Apple currently requires Xcode 26 or later with the iOS 26 SDK or later for uploads. Installed
Xcode/iOS SDK 27 satisfies that minimum. Recheck [Apple's requirements](https://developer.apple.com/news/upcoming-requirements/)
on submission day. A current SDK can still target the project's minimum iOS 15.

`npm run ios:release` validates effective configuration, builds release assets, syncs iOS and creates
an archive using your paid signing team. **It does not upload by default.** Alternatively archive in
Xcode after these checks. Raise the build number for every upload.

Only when you intend to upload, run `npm run ios:release -- --upload` or use Xcode's upload action.
No signed archive/upload was performed during this remediation.

## Required TestFlight acceptance on the exact candidate

- Buy, cancel, error, Ask to Buy/pending, restore, restart, reinstall and second-device restore.
- Correct lifetime product and localized price; missing offerings must show unavailable.
- Verified paid access offline; never-paid offline stays free; failed verification cannot grant Pro.
- Refund/revocation then foreground/restart. An open Share sheet and already rendered video must
  obey refreshed permission. Offline refund visibility follows the store/SDK cache.
- Free first three generated arrangements, including automatically assigned Pro sounds; unlimited
  songs and free individual Part editing. MIDI and picked Pro sounds/Tracks/Fix/Effect require Pro.
- 60-second free and 180-second paid capture/import limits, including Studio Record and Redo.
- Microphone denial, delayed permission, rapid taps, navigation, lock/background, calls/Siri and
  speaker/headset/Bluetooth routes; no capture indicator or surprise playback after leaving.
- Corrupt/empty/large/multichannel imports, cancelled pickers and iCloud files; bounded memory and
  no commit to another song. Start with WAV, M4A, MP3 and MOV/MP4.
- Persistence after immediate background/termination, low storage, duplicate, trash, restore and Undo.
- Native WAV/video share and Save to Files/Photos, iPad popovers and missing share destinations.
- Light/Dark/System, theme after restart, large text, VoiceOver/Switch Control, keyboard grids/sheets,
  iPad window resizing and both landscape directions.

Use [PHONE_QA.csv](PHONE_QA.csv) to record model, OS, build/channel, expected/actual, screenshot/log
and pass/fail. Minimum iOS support and real audio performance remain physical-device gates.

## App Store Connect submission

- Use current release-candidate screenshots. Accepted examples: iPhone 6.9-inch 1320×2868; iPad
  13-inch 2064×2752 or 2048×2732; landscape equivalents are accepted. iPad shots are required because
  the app supports iPad. Six shots are a marketing choice, not an Apple minimum. See
  [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
- Complete the current age-rating questionnaire and select Music. Decide Kids Category separately.
- App Privacy: Purchase History for **App Functionality and Analytics**. With anonymous RevenueCat
  IDs and no identifying integrations, not linked to identity and not used for advertising tracking.
  Audio/songs stay on-device. Reconcile final aggregate manifests/dashboard integrations with
  [RevenueCat's guide](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy).
- Complete EU trader/non-trader declarations and verified contacts where applicable.
- Confirm commercial rights to artwork, fonts and icons; retaining files does not establish ownership.
- Confirm `ITSAppUsesNonExemptEncryption=NO` still fits the final app.
- Submit the first IAP with the app version; use notes from [STORE_LISTING.md](../STORE_LISTING.md).
- Choose Family Sharing deliberately; if enabled, test family restore/revocation.

Apple's [review guidelines](https://developer.apple.com/app-store/review/guidelines/) require accurate
metadata, working purchases and accessible privacy-policy links. Complete owner configuration,
signing and device acceptance before treating this as an upload-ready candidate.

## Development Pro testing

`npm run ios:pro` / `npm run ios:sync:pro` builds in explicit `testing` mode. Only development/testing
builds accept tester/developer switches. Production ignores those flags even without store keys.
Never upload a testing bundle; rebuild in `release` mode and sync before archiving. Release rejects
`VITE_DEV_PRO=true`, including shell and dotenv overrides.

## Android

Shared TypeScript fixes apply to Android, but this remediation verifies iOS first. Android signing,
Play billing/data-safety declarations, permissions and native QA require their own pass. iOS/browser
evidence does not certify an Android release.

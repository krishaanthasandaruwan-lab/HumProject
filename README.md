# HUMM 🎤 → 🥁🎸🎹

**Hum a melody — get a song. Beatbox the drums. Hum the bassline.**
Open the app, tap the mic and hum anything with no metronome: HUMM finds the beat and the key and plays it back as three different songs (as hummed, slower, faster — up to 100 with "More", in 20 styles), with your own voice auto-tuned on top if you like. Every mic tap starts a new project. Build on it part by part: beatbox the drums, hum the bass and the lead, add chords. Export the song as audio, or as a *"what I recorded → what came out"* video for TikTok and Reels.

It is a Vite + TypeScript app with no UI framework and no server. All audio analysis and synthesis runs on the device — no AI service, no uploads. It is wrapped with Capacitor for the App Store (iPhone, iPad) and Google Play.

Docs:
- [docs/HISTORY.md](docs/HISTORY.md) — everything that was built and decided, in order, and how to continue. **Start here if you are new to the project (person or AI).**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code fits together.
- [docs/RELEASE.md](docs/RELEASE.md) — the store release steps.
- [STORE_LISTING.md](STORE_LISTING.md) — historical listing draft; superseded by the separate current App Store submission document.
- [BUILD_PLAN.md](BUILD_PLAN.md) — the original "MouthBand" spec the app started from (historical).
- [design/DESIGN_SPEC.md](design/DESIGN_SPEC.md) — screens, look and images.

## Quick start

Node 22.12+ is required (Vitest 5 and Capacitor 8). On the development Mac, Node 24 LTS lives in `~/.local/node` (on the PATH through `~/.zshrc`).

```bash
npm ci               # install exactly what package-lock.json says
npm run dev          # https://localhost:5173 (self-signed certificate; accept the warning)
npm test             # unit tests on synthetic signals
npm run typecheck
npm run build        # production web build in dist/
```

### Test on your phone

```bash
npm run dev:phone    # same as: npm run dev -- --host
```

Open the `Network:` URL on a phone on the same Wi-Fi, accept the certificate warning, allow the microphone, and wear headphones so the speaker doesn't leak into the mic. To run the real iPhone app, see "iPhone" below.

## What to try

1. **Hum → song.** First launch asks what music you like, then offers Sign in with Apple once (skippable). The mic screen says "Tap the mic to start a new project". Hum for at least 10 seconds (the mic won't stop sooner; it stops by itself after ~4 s of real silence, or when you tap). Soft humming counts: quiet takes are lifted and, if needed, listened to a second time more sensitively. "Existing projects" (top right) opens your songs.
2. **Pick your sound.** Three versions play — the first three of every hum are free to export; "More" adds up to 100, and the extra ones carry a lock (free to play and edit, Pro to export). Above the buttons: **My voice** volume and **Effect** (Pro: soft reverb and polish on your voice only), and **Instruments** volume (the band, without changing your voice). **Use this** opens the song in the Studio; a song can't go back to this screen — record more later from Record.
3. **Studio.** Parts list (tap to edit, hold to solo, swipe to remove), sound chips, Fix, mute. Bottom bar: Record · Mix · Play · Tracks · Share.
4. **Drums.** Record › Drums: 1-bar count-in, then say *B ts K ts* in time. The hits land on the drum grid; tap a cell to cycle kick → snare → hat → off, hold to delete.
5. **Bass / melody / chords.** Shown in the same grid look as the drums: one block per bar, a row per note of the key, chord names on the bars. Tap an empty cell to add a note, tap a note to take it out.
6. **Tracks (landscape only).** Parts down a fixed rail on the left (Drums, Bass, Melody, Chords, My voice, All), the picked part's grid on the right; "All" shows every part bar by bar. Parts light up on their notes while playing.
7. **✨ Fix.** Makes the bars of a take agree (missed hats, flipped steps, systematic lateness, melody glitches). Always with Undo.
8. **Import.** A voice memo or video, beat-matched into the song.
9. **Share.** Audio (WAV), the before → after video in 1080 × 1920, and MIDI (Pro). A song that uses something locked shows "Pro features in this song" with the exact list.
10. **My songs.** Rename, duplicate, heart, delete; Recently deleted keeps songs 30 days and has **Delete all**.

## Free, Plus and Pro

First-release plans: **Plus $1.99/month** and **Pro $4.99/month** (US base prices).
Pro has a **3-month Apple introductory free trial for eligible subscribers**. The app shows the store's localized price and checks eligibility; there is no $9.99 offer or one-time purchase.

| Feature | Free | Plus | Pro |
|---|---|---|---|
| Home microphone | 10–60 seconds | 10–60 seconds | 10–60 seconds |
| Saved songs | Unlimited | Unlimited | Unlimited |
| First three versions per hum | Audio / watermarked 1080p video | Audio / unmarked video | Audio / unmarked video |
| Extra versions, picked premium sounds, voice effect | Preview; paid export | Export | Export |
| Tracks and Fix edits | Preview; Pro export | Preview; Pro export | Export |
| MIDI | — | — | Export |
| Studio recordings / imports | 60 seconds | 90 seconds | 180 seconds |
| Tracks arrangement | Up to five minutes in every tier; export depends on edits | Same | Same |

Automatically assigned premium sounds in the first three generated versions stay free to export. Tracks uses 2/4/8-bar sets, arrow navigation, + to append a set and − to remove the last set with Undo. Editing and playback remain available to preview before subscribing. Export checks run again before delivery; Plus never grants Pro production exports. Rules live in `src/pro/exports.ts`.

- Test switches/codes work only in development or explicit `testing` builds; production ignores local unlock flags. Never submit a testing build.
- StoreKit purchases use RevenueCat signed entitlement verification. Restore and Manage subscriptions are in Settings and the paywall.
- Paid subscription products, real SDK configuration, a public policy and a support mailbox must be set up before `npm run build:release` and archiving. The developer account and these owner details are pending as of 5 October 2026.

## iPhone (Capacitor 8)

Needs a Mac with Xcode 26+ and an Apple account. The team in the project is a free Personal Team (`HYKLC6A296`); the App Store, TestFlight, in-app purchase and Sign in with Apple need the paid Apple Developer Program.

```bash
npm run ios:sync      # build web + copy into ios/
npm run ios:open      # open in Xcode, pick the phone, Run ▶
npm run ios:sim       # command-line compile check for the simulator (no signing)
npm run ios:pro       # test build with Pro on — never upload
```

From the command line (phone connected and unlocked; find the id with `xcrun devicectl list devices`):

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'id=<DEVICE-ID>' \
  -derivedDataPath ../ios-build -clonedSourcePackagesDirPath ../ios-build/spm -packageCachePath ../ios-build/spm-cache \
  -disablePackageRepositoryCache -allowProvisioningUpdates build
xcrun devicectl device install app --device <DEVICE-ID> ../ios-build/Build/Products/Debug-iphoneos/App.app
xcrun devicectl device process launch --terminate-existing --device <DEVICE-ID> com.krishanthasandaruwan.humm
```

- **Free Personal Team limits:** at most 3 apps installed this way per phone, and they stop opening after 7 days (run again).
- **Accounts:** optional sign-in is skipped for the first release. App.entitlements has no Sign in with Apple capability. Earlier local test identities can be removed in Settings.
- **Native code:** `ios/App/App/HummNative.swift` (appearance and legacy Keychain identity cleanup), registered by `MainViewController` in `SceneDelegate.swift`.
- **Microphone, audio session, sharing, icons, privacy manifest:** as before — `NSMicrophoneUsageDescription`, recording/playback audio-session handling, share sheet, `ios/App/App/PrivacyInfo.xcprivacy`. App icons: the "Hm" mark in Ink on Stage Red, from `design/icon/hm-reference.jpg` — `node scripts/make-icon-mark.mjs && node scripts/make-icons.mjs` (web, iOS, Android). There is no splash screen: the app opens on plain paper, then the mic.
- **Release:** `HUMM_BUILD_NUMBER=1 npm run ios:release` or Xcode › Archive. Steps: [docs/RELEASE.md](docs/RELEASE.md).

## Android (Capacitor 8)

Needs Android Studio (SDK 36) and JDK 21 (not installed on the current dev Mac). Sign in with Apple is hidden on Android; the app otherwise works the same.

```bash
npm run android:sync
npm run android:open
npm run android:apk   # -> android/app/build/outputs/apk/debug/app-debug.apk
```

## How it works

| Stage | File | Method |
|---|---|---|
| Recording | `audio/recorder.ts`, `take.ts` | AudioWorklet capture with frame stamps, voice processing off, latency compensated, 150 ms pre-roll. |
| Hum length | `ui/hum.ts`, `dsp/level.ts` | At least 10 s; stops by itself only after ~4 s of real silence (`LevelGate.silent`). |
| Soft voices | `dsp/level.ts` | Quiet takes lifted up to +40 dB; a second, more sensitive analysis (`sensitive: true`) if the first hears fewer than 4 notes. |
| Metronome leak | `dsp/declick.ts` | Click tones notched out (zero phase), lone clicks blanked. |
| Onsets | `dsp/onsets.ts` | Spectral flux on log bands, adaptive threshold, 70 ms gap, envelope refinement. |
| Drums | `features.ts`, `drumClassifier.ts` | 60 ms features + MFCC; rules, or personal k-NN after calibration (the calibration screen exists but is not linked at the moment). |
| Pitch | `pitch.ts`, `notes.ts` | Pitchy (McLeod). Hum analysis uses clarity ≥ 0.75 (`HUM_CLARITY`; tested on 40 real singers), median smoothing, octave folding, segmentation, singer-tuning removal. |
| Key | `key.ts` | Krumhansl–Schmuckler, scale snap (switchable). |
| Beat match | `tempo.ts`, `free.ts` | Onset-envelope autocorrelation (log-normal prior around 100 BPM), Ellis DP beat tracker, beat map. |
| Chords | `harmony.ts` | Chord-tone fit per bar, progression bonuses, Viterbi. |
| Voice layer | `voice.ts`, `audio/voiceLayer.ts` | TD-PSOLA: beat-matched and auto-tuned voice. |
| Voice level / Effect | `audio/engine.ts` | Per-part voice gain (live); Effect = high-pass, de-mud, presence, air, compressor, soft room. |
| Fix | `model/autofix.ts` | Timing bias, majority vote per step, melody cleanup. |
| Hum → song | `model/styles*.ts`, `autoArrange.ts`, `variety.ts` | 20 styles; three versions (as hummed, slower, faster), More up to 100. |
| Synth | `src/synth/*` | 16 kits, 37 instruments, all synthesized. |
| Playback | `scheduler.ts`, `engine.ts` | 25 ms lookahead, 100 ms ahead on the audio clock. |
| Export | `render.ts`, `export.ts`, `wav.ts`, `midi.ts`, `ui/videoScene.ts` | Offline render to WAV; SMF format 1; canvas + MediaRecorder video at 1080 × 1920, 8 Mbps. |
| Free / Plus / Pro | `pro/pro.ts`, `pro/exports.ts`, `pro/billing.ts` | Who may export what; RevenueCat. |
| Account | `account.ts`, `native/humm.ts` | Sign in with Apple, kept in the Keychain on the phone. |

Heavy DSP runs in a Web Worker (`dsp/worker.ts`).

## Project layout

```
src/
  main.ts router.ts state.ts storage.ts settings.ts profile.ts share.ts app.ts cache.ts songName.ts account.ts
  audio/   context recorder take metronome scheduler engine render export wav midi importAudio voiceLayer prepare
  dsp/     fft onsets features featureIndex drumClassifier quantize pitch notes level key harmony tempo free voice declick analyze api worker client
  synth/   fx env drums kits instruments voices voices2 rendered renderCache
  model/   project music arrange demo autofix styles styles2 autoArrange variety
  pro/     pro exports billing
  native/  humm (native plugin bridge) orientation (landscape lock) review
  ui/      hum choices taste signin studio partRows tracks trackRail partEditor grid noteGrid allGrid part soundsSheet
           songSheet mixer record recordProcess recordImport importSheet limits swipe chords calibrate export videoScene
           projects trash settings paywall proNotice about dom kit icons parts fix transport waveform
           (unused, safe to delete: timeline.ts, laneDraw.ts, pianoroll.ts, styles/timeline.css)
  styles/  base ui overlay sheets landscape hum taste signin studio part record calibrate tracks
tests/     DSP, model, export, rules tests on synthetic signals (23 files)
scripts/   make-icon-mark.mjs, make-icons.mjs, make-illustrations.py, ios-release.sh
ios/       Capacitor iOS project (Swift Package Manager) + HummNative.swift
android/   Capacitor Android project
```
# HumProject
# HumProject

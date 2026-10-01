# MouthBand 🎤 → 🥁🎸🎹

**Hum a melody — get a song. Beatbox the drums. Hum the bassline.**
Open the app, hum anything with no metronome: MouthBand finds the beat and the key and plays it back as a full arrangement in three styles to choose from, with your own voice auto-tuned on top if you like. Or build a song part by part: beatbox the drums, hum the bass and the lead, add chords. It exports a *"what I recorded → what came out"* video for TikTok and Reels.

It is a Vite + TypeScript PWA with no framework and no server. All audio analysis and synthesis runs on the device — no AI service, no uploads. It is wrapped with Capacitor for the App Store (iPhone) and Google Play. The original spec is in [BUILD_PLAN.md](BUILD_PLAN.md).

## Quick start

```bash
npm install
npm run dev          # https://localhost:5173 (self-signed certificate; accept the warning)
npm test             # unit tests on synthetic signals
npm run typecheck
npm run build        # production PWA in dist/
```

### Test on your phone

The microphone needs HTTPS on phones, so the dev server uses a self-signed certificate.

```bash
npm run dev:phone    # same as: npm run dev -- --host
```

1. Put the phone on the same Wi-Fi and open the `Network:` URL that Vite prints (for example `https://192.168.1.20:5173`).
2. Accept the certificate warning. On Chrome, tap "Advanced" and then "Proceed". On Safari, tap "Show details" and then "visit this website".
3. Allow the microphone. **Wear headphones** so the speaker doesn't leak into the mic.
4. On iPhone, turn off the silent switch the first time. MouthBand also asks iOS for "playback" audio, which ignores the switch on iOS 16.4+.

## What to try

1. **Hum → song.** The logo, then straight to the mic. Tap, hum a tune (it stops by itself after a pause), and pick one of three arrangements (Lo-fi Chill, Bright Pop, Trap, Dance, Acoustic Band or Cinematic — whichever suit your tempo and key). **🎤 Add my voice** layers your own voice on top, auto-tuned to the notes and moved onto the beat. **Use this song** opens it in the studio. **Skip** goes straight to the studio; **📂 Use a recording instead** takes a voice memo or video.
2. **Drums.** Tap **🎙 Beatbox**. You get a 1-bar count-in, then say *B ts K ts* in time. The hits land on the drum grid. Tap a lit cell to cycle kick → snare → hat → off, or hold a cell to delete it.
3. **Calibration.** Tap **🎯 Calibrate** on the record screen: say *B*, *K* and *ts* five times each. The confidence meter shows how well your sounds separate, and a live tester lets you check it.
4. **Bass / lead.** Tap **🎙 Hum** on the Bass or Lead card. The notes appear in a piano roll, and the key is detected and snapped. Drag a note up or down, or tap it to delete. Under the instrument chips, **🎤 My voice in the song** adds your recording to the mix (with **Auto-tune** and **Voice only**); it follows your piano-roll edits and tempo changes.
5. **✨ Fix.** Every recorded part has a Fix button. It glows when bars disagree (a missed hat, a kick heard as a snare, hits that keep flipping to the next step because the latency is off). Tapping it makes the bars follow the pattern most of them agree on, pulls systematically late or early timing back, and cleans up melody glitches. Nothing changes until you tap it, and the toast has Undo.
6. **Import.** On the record screen, **📂 Import a recording** brings in an audio or video file as drums, bass or lead. It is beat-matched: it fits your song's tempo, or sets it when the song is empty.
7. **Chords.** Tap **✨ Add chords**. It picks one chord per bar, adds a root bass if you didn't hum one, and starts playback.
8. **Mixer.** 🎚 gives you volume, mute and solo per track, plus swing, quantize strength and the key.
9. **Share.** 📤 makes the before → after vertical video (MP4 where supported, otherwise WebM), with WAV and MIDI export. Saved songs are under **‹ My songs** (rename, duplicate, delete).

## Free vs Pro

| | Free | Pro ($0.99 once) |
|---|---|---|
| Loops | unlimited | unlimited |
| Drum kits | 808, Boom-Bap | all 8 (+ Lo-fi, Techno, Trap, House, Acoustic, Retro 80s) |
| Instruments | 8 (synth bass, 808 bass, square lead, piano, E-piano, pad, guitar, bells) | all 18 (+ sub & finger bass, strings, choir, organ, flute, brass, marimba, supersaw, 8-bit) |
| Hum → song, auto-tune, beat match, Fix, import | ✓ | ✓ |
| Video watermark | "Made with MouthBand" | none |
| WAV + MIDI export | — | ✓ |
| Saved songs | 3 | unlimited |

- **Test builds.** `VITE_DEV_PRO=true npm run build` unlocks everything (the `DEV_PRO` flag).
- **Dev server.** In `npm run dev`, Settings has a "pretend I bought Pro" switch.
- **Purchases** only exist in the apps, through RevenueCat (App Store on iPhone, Google Play Billing on Android). The web version links to the store listings.
- The three hum → song choices may use Pro sounds; the song keeps them, but picking a locked sound yourself opens the paywall.

## iPhone (Capacitor 8)

Requirements are a Mac with Xcode 26 (iOS 26 SDK) and an Apple Developer account for running on a phone and for the App Store. The app is iPhone-only, portrait (it runs on iPad in iPhone mode), iOS 15+.

```bash
cp .env.example .env.local        # add VITE_REVENUECAT_IOS_KEY (see STORE_LISTING.md)
npm run ios:sync                  # build web + copy into ios/
npm run ios:open                  # open in Xcode: Signing & Capabilities → pick your Team, then Run ▶ on your iPhone
npm run ios:sim                   # command-line compile check for the simulator (no signing)
```

- **Microphone.** `NSMicrophoneUsageDescription` is in `Info.plist`. Capacitor grants WebKit's own capture request, so iOS asks only once.
- **Audio.** `AppDelegate` sets the `.playback` session (sound with the silent switch on); the web code switches to play-and-record only while the mic is listening.
- **Sharing.** The share sheet does the saving ("Save Video" needs `NSPhotoLibraryAddUsageDescription`, which is set; "Save to Files" needs nothing).
- **Icons and the launch screen** come from `node scripts/make-icons.mjs` (an opaque 1024 icon — the App Store rejects alpha — and the launch logo at exactly the web splash's size, so the hand-over doesn't jump).
- **Build caches.** `ios:sim` keeps DerivedData and Swift packages in `../ios-build`, outside the repo. Xcode's own builds use `~/Library/Developer/Xcode/DerivedData` (a few GB).
- **Release.** In Xcode: Product → Archive → Distribute App → App Store Connect. The listing, privacy answers and the in-app purchase are in [STORE_LISTING.md](STORE_LISTING.md).

## Android (Capacitor 8)

Requirements are Android Studio (SDK 36) and about 3 GB of free disk space for Gradle's caches.

Capacitor 8 compiles with **JDK 21**. The project pins Gradle's daemon to JDK 21 and downloads one automatically if missing (`android/gradle/gradle-daemon-jvm.properties` and the foojay resolver in `android/settings.gradle`). The Gradle version Capacitor ships (8.14) cannot run on Java 25. If Android Studio reports an incompatible Gradle JDK, go to Settings → Build → Gradle → Gradle JDK and pick a JDK 21.

```bash
cp .env.example .env.local        # add your RevenueCat key (see STORE_LISTING.md)
npm run android:sync              # build web + copy into android/
npm run android:open              # open in Android Studio, then Run ▶ on a device
# or a debug APK from the command line:
npm run android:apk              # -> android/app/build/outputs/apk/debug/app-debug.apk
```

- **Permissions.** `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` are in the manifest. Capacitor's WebView client turns `getUserMedia` into the Android runtime permission prompt.
- **Sharing.** Android's WebView has neither Web Share nor blob downloads, so the app writes the file to the cache and opens the native share sheet with `@capacitor/share` and `@capacitor/filesystem`.
- **Icons and splash** are generated by `node scripts/make-icons.mjs`. Re-run it after `cap add android`.
- **Release.** In Android Studio, use Build → Generate Signed App Bundle. Then upload the `.aab` to Play Console. The listing, privacy policy and product setup are in [STORE_LISTING.md](STORE_LISTING.md).

## How it works

| Stage | File | Method |
|---|---|---|
| Recording | `src/audio/recorder.ts`, `take.ts` | AudioWorklet capture with frame stamps, voice processing off. Output + input latency plus a manual offset are compensated. There is a 150 ms pre-roll so hits on beat 1 are caught. |
| Onsets | `src/dsp/onsets.ts` | Spectral flux on log-spaced bands (1024/256, Hann), median×1.5+δ threshold, 70 ms gap, envelope refinement. |
| Drum classification | `features.ts`, `drumClassifier.ts` | 60 ms features (RMS, centroid, flatness, ZCR, <200 Hz and >5 kHz shares, MFCC 1–8 via Meyda). Rules by default; a personal z-scored weighted k-NN (k=3) after calibration. |
| Quantize | `quantize.ts` | Swung 16th grid. The residual is stored, so the strength slider works live. Velocity comes from RMS. |
| Pitch | `pitch.ts`, `notes.ts` | Pitchy (McLeod), clarity > 0.9, 5-frame median, octave folding, segmentation, bass folded into MIDI 28–52. |
| Key and snap | `key.ts` | Krumhansl–Schmuckler over 24 keys. Snapping works from the unrounded pitch, so it can be switched off. |
| Chords | `harmony.ts` | Chord-tone fit per bar, progression bonuses and Viterbi. Voice-led pad or keys, and a root bass that follows the kick. |
| Beat match | `tempo.ts`, `free.ts` | For free-tempo hums and imports: tempo from the onset envelope's autocorrelation at beat, half-bar, bar and two-bar lags (log-normal prior around 100 BPM), beats by dynamic programming (Ellis 2007), then a beat map so notes land on the right steps even when you drift. |
| Auto-tune + voice layer | `voice.ts`, `audio/voiceLayer.ts` | TD-PSOLA: grains one pitch period apart are re-spaced to the target notes' periods (auto-tune) and placed at their beat-matched times, in one pass. Formants stay, so it still sounds like you. |
| Fix | `model/autofix.ts` | Circular mean of the timing residuals (systematic lateness), majority vote per step over 1-, 2- or 4-bar periods, melody octave/glitch/split cleanup. |
| Hum → song | `model/styles.ts`, `autoArrange.ts` | Six styles (drum grooves with fills, bass and chord rhythms, lead instrument and register), the same Viterbi chords as "Add chords", the three best for your tempo and key. |
| Synth | `src/synth/*` | Every sound is synthesized: 8 drum kits and 18 instruments — oscillator voices, plus piano (inharmonic partials), guitar and finger bass (Karplus–Strong), bells and marimba rendered note by note in the worker — with a generated-IR reverb. |
| Playback | `scheduler.ts`, `engine.ts` | 25 ms lookahead timer scheduling 100 ms ahead on the audio clock. |
| Export | `render.ts`, `export.ts`, `wav.ts`, `midi.ts`, `ui/videoScene.ts` | OfflineAudioContext to WAV; a hand-written SMF format 1; canvas captureStream plus MediaStreamDestination through MediaRecorder. |

Heavy DSP runs in a Web Worker (`src/dsp/worker.ts`), so the UI never blocks.

## Project layout

```
src/
  main.ts  router.ts  state.ts  storage.ts  settings.ts  profile.ts  share.ts  app.ts
  audio/   context recorder take metronome scheduler engine render export wav midi importAudio voiceLayer prepare
  dsp/     fft onsets features featureIndex drumClassifier quantize pitch notes key harmony tempo free voice analyze api worker client
  synth/   fx env drums kits instruments voices rendered renderCache
  model/   project music arrange demo autofix styles autoArrange
  pro/     pro billing
  ui/      hum choices studio tracks fixButton voiceRow grid pianoroll record recordImport calibrate mixer export videoScene projects settings paywall dom waveform
  styles/  base hum record studio calibrate extra
tests/     DSP, model and export tests on synthetic signals
scripts/   make-icons.mjs
android/   Capacitor Android project
ios/       Capacitor iOS project (Swift Package Manager)
```

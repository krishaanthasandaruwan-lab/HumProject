# HUMM — architecture

HUMM turns humming, singing, whistling and beatboxing into songs, entirely on the phone. It is a
TypeScript web app (Vite, no UI framework) wrapped as an iPhone/iPad and Android app with Capacitor 8.

## Layers

| Layer | Folder | Job | Depends on |
|---|---|---|---|
| Screens | `src/ui` | One function per screen (`mountX(root, params)`), sheets, the component kit. The Studio is the simple main screen (parts list); `tracks.ts` is the full-screen tracks table for detail | everything below |
| Styles | `src/styles` | Tokens (`base.css`), components (`ui.css`), per-screen CSS; `landscape.css` last | — |
| State | `src/state.ts`, `src/settings.ts`, `src/storage.ts`, `src/songName.ts` | The open song, autosave, settings, songs + Recently deleted in IndexedDB | model |
| Model | `src/model` | Song data (`project.ts`), arrangement styles, auto-arrange, variety, Fix | — |
| Audio | `src/audio` | AudioContext, mic capture (AudioWorklet), lookahead scheduler, render/export | synth, model |
| Synth | `src/synth` | 37 instruments and 16 drum kits, all synthesized (no samples) | — |
| DSP | `src/dsp` | Pitch, notes, onsets, tempo/beat matching, key, harmony, voice tuning, declick — in a Web Worker | model types |
| Store | `src/pro`, `src/native` | Pro (RevenueCat), the in-app review prompt | Capacitor plugins |

Screens never touch IndexedDB or the DSP worker directly except through `state`, `storage` and
`dsp/client`. DSP code is pure (arrays in, arrays out), which is why it is unit-tested on synthetic
signals (`tests/`).

## Main flows

1. **Hum → song.** `ui/hum.ts` records (AudioWorklet) → `dsp/level.boostQuiet` → worker `free`
   analysis (`dsp/free.ts`: pitch track → notes, singer tuning removed, beat match, key) →
   `model/variety.ts` picks three versions (as hummed / slower / faster, by taste) → `model/autoArrange.ts`
   builds each song → `ui/choices.ts` plays them with its own `Player`.
2. **Record a part.** `ui/record.ts` → `audio/take.ts` (count-in, click, latency) → `ui/recordProcess.ts`
   (declick, analysis) → a new track is added (`addTrack`), or a re-take replaces one (`replaceTrack`).
3. **Play.** `audio/scheduler.ts` schedules 100 ms ahead on the audio clock; one bus per track id.
   Rendered instruments are prepared in the worker (`synth/renderCache.ts`), oscillator voices play live.
4. **Share.** `audio/export.ts` renders offline; `ui/videoScene.ts` draws the 9:16 video frame by frame.

## Data

A song (`Project`) is `bpm`, `bars` (2, 4, 8 or a multiple of 4 up to 96), `key`, `swing`, `quantize`
and `tracks[]`. A track has a `kind` (drums / bass / lead / chords), a `preset`, `hits` or `notes` on
the 16th grid, mixer state, and for hummed parts the raw take (`rawVoice`) with `anchors` that map
where each note was sung to where it sits. Any number of tracks per kind ("Drums 2").

Songs live in IndexedDB (`project:<id>` + an index). Hearted songs (`favorite`) are listed first; a heart on
a generated version saves it straight to My songs. Deleted songs move to `trash:<id>` for 30 days.
An empty new song is not saved until something is in it.

## Security and privacy

- **No network** except the store purchase check (RevenueCat, native SDK). No accounts, analytics or ads.
- **Content-Security-Policy** in production builds (`vite.config.ts`): only the app's own files; no remote
  scripts, styles, fonts or frames; `object-src 'none'`, `base-uri 'none'`.
- **No HTML injection paths**: the UI is built with `h()` (DOM APIs); user text (song names) is only ever
  set as text. No `eval`, `new Function` or `innerHTML`.
- **File names** for exports are cleaned (`share.safeName`).
- **Pro**: the store (via RevenueCat) is the source of truth; it is re-checked at launch and whenever the
  store reports a change, and only cached for offline use. Test builds (`VITE_DEV_PRO`) have a Pro switch.
  Until store purchases are configured (no RevenueCat keys in the build), a **tester code** in Settings
  unlocks Pro on one phone; the app only keeps a fingerprint of the code, and the code stops working by
  itself once the keys are in the build (`STORE_READY` in `pro/pro.ts`).
- **Release builds** are minified with no source maps. Web inspection is off in the apps (Android
  `webContentsDebuggingEnabled: false`; on iOS `CAPACITOR_DEBUG` is not set, so the web view is not inspectable).
- **iOS privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`): no tracking; Purchase History for app
  functionality; UserDefaults and file-timestamp API reasons.

What this cannot do: a web-based app ships its JavaScript inside the app bundle. On a jailbroken or
rooted phone someone can read it or patch the Pro check. Minifying makes that slower, not impossible.
Real protection for paid features needs a server that hands out the paid content; HUMM has no server by
design (privacy), so the realistic goal is "not worth the effort" for a $0.99 unlock.

## Quality

- `npm run typecheck`, `npm test` (137 tests: DSP on synthetic signals, model, export, humming accuracy),
  `npm run build`, `npm run ios:sim` (compile only) and `cd android && ./gradlew assembleDebug`.
- `tests/humBench.ts`: humming accuracy on human-like hums (off-key, scoops, vibrato, legato, soft);
  `BENCH=1 npx vitest run tests/humBench.test.ts` prints the note error rate per kind of singer.
- Every screen was checked in portrait (393×852), landscape (852×393) and iPad (820×1180) by an automated
  pass (headless Chrome, fake mic): no page scroll, nothing off-screen, touch targets ≥ 44 pt, no console
  errors, no CSP violations.

## Known limits

- The voice layer stretches your take to the song's tempo; very different tempos (the "slower" and
  "faster" versions) can sound processed.
- Split a song (stems) is designed (`design/DESIGN_SPEC.md`, screens 12–14) but not built.
- Dark mode is planned for a later update.

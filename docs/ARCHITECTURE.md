# HUMM — architecture

HUMM turns humming, singing, whistling and beatboxing into songs, entirely on the phone. It is a
TypeScript web app (Vite, no UI framework) wrapped as an iPhone/iPad and Android app with Capacitor 8.
For the story of how it got here and what was decided, see [HISTORY.md](HISTORY.md).

## Layers

| Layer | Folder | Job | Depends on |
|---|---|---|---|
| Screens | `src/ui` | One function per screen (`mountX(root, params)`), sheets, the component kit. Studio is the simple main screen; Tracks is the landscape-only editor (rail + grid). | everything below |
| Styles | `src/styles` | Tokens (`base.css`), components (`ui.css`), per-screen CSS; `landscape.css` last | — |
| State | `src/state.ts`, `settings.ts`, `storage.ts`, `songName.ts`, `account.ts` | The open song, serialized autosave, atomic song/trash indexes, settings, removal of legacy test identity | model, native |
| Model | `src/model` | Song data (`project.ts`), styles, auto-arrange, variety, Fix | — |
| Audio | `src/audio` | AudioContext, mic capture (AudioWorklet), lookahead scheduler, buses (voice level + Effect), render/export | synth, model |
| Synth | `src/synth` | 37 instruments and 16 drum kits, all synthesized (no samples) | — |
| DSP | `src/dsp` | Pitch, notes, onsets, tempo, key, harmony, voice tuning, declick, loudness — in a Web Worker | model types |
| Store rules | `src/pro` | `pro.ts` (Pro state, tester code), `exports.ts` (what may be exported), `billing.ts` (RevenueCat) | Capacitor plugins |
| Native | `src/native`, `ios/App/App/HummNative.swift`, `HummMedia.swift` | Appearance/Dynamic Type, legacy Keychain store, bounded media importer, landscape lock, in-app review | Capacitor |

Screens never touch IndexedDB or the DSP worker directly except through `state`, `storage` and
`dsp/client`. DSP code is pure (arrays in, arrays out) and unit-tested on synthetic signals (`tests/`).

## Main flows

1. **Start.** `main.ts` → first launch: `welcome` (music taste) → `hum`. This release offers no account creation or Apple sign-in.
2. **Hum → song.** `ui/hum.ts` records (≥ 10 s, stops on real silence) → `dsp/level.boostQuiet` → worker
   `free` (`dsp/free.ts`: pitch → notes, singer tuning removed, beat match, key); if fewer than 4 notes,
   a second `free` pass with `sensitive: true` → `model/variety.ts` (three versions, More up to 100) →
   `model/autoArrange.ts` → `ui/choices.ts` (plays them; voice/instrument volume and voice Effect for all
   versions; versions ≥ 3 get `proTools: ['more']`) → **Use this** saves the song and opens the Studio.
3. **Record a part.** `ui/record.ts` → `audio/take.ts` → `ui/recordProcess.ts` → `addTrack`/`replaceTrack`.
4. **Edit.** `ui/partEditor.ts` is shared by the part screen and Tracks: `grid.ts` (drums), `noteGrid.ts`
   (bass/melody/chords as a step grid), `voicePanel.ts` (My voice). Tracks adds `trackRail.ts` and `allGrid.ts`.
5. **Play.** `audio/scheduler.ts` schedules 100 ms ahead; one bus per track (`engine.ts`). The voice layer
   enters a bus through its own gain (`voice.level`, followed live) and, with `voice.fx`, the sweetener chain.
6. **Share.** `pro/authorize.ts` refreshes verified access, then `pro/exports.canExport(p)` decides. Exportable: WAV, and the 1080 × 1920 video
   (`ui/videoScene.ts` drawn at scale 1.5, MediaRecorder 8 Mbps). Not exportable: Audio / Make video show a
   lock and "Pro features in this song" lists `lockedItems(p)`.

## Data

A song (`Project`) is `bpm`, `bars` (2, 4, 8 or a multiple of 4 up to 96), `key`, `swing`, `quantize`,
`tracks[]`, `favorite?` and `proTools?` (`'more' | 'tracks' | 'fix' | 'fx'`). A track has a `kind`, a
`preset`, `picked?` (the person chose this sound), `hits` or `notes` on the 16th grid, mixer state, and
for hummed parts the raw take (`rawVoice`, `anchors`) and `voice` (`on`, `tune`, `level`, `only`, `fx`).

Songs live in IndexedDB (`project:<id>` + an index); no limit on how many. Deleted songs move to
`trash:<id>` for 30 days, purged on a subsequent launch/list operation (restore, delete, Delete all).
Record/index changes use one transaction; boot repairs legacy orphaned project-index entries.
Settings include theme, taste, `proNoticeOff`, latency and snap. A legacy test Apple ID can be removed
from the Keychain (`secureStore`, key `account`); no new identity is created.

## Free vs Pro (code)

`pro/exports.ts`: `FREE_VERSIONS = 3`; `lockedIn` / `lockedItems` list an extra version, Pro sounds with
`picked`, and the `proTools` used; `canExport` is ok for Pro or when nothing is locked; `markTool` /
`unmarkTool` are called by Fix (`ui/fix.ts`), Tracks (first change to notes/hits there), the voice Effect
(`ui/choices.ts`) — each with Undo, via `ui/proNotice.ts` ("Don't show again"). MIDI and 3-minute hums
use `isPro()`. Tool/picked-sound provenance is independent of ownership. Undo restores musical
data before removing a marker. Export guards run again before sharing already rendered output.

## Security and privacy

- **Local audio**: no audio/song uploads, server accounts, ads or advertising identifiers. RevenueCat
  uses purchase history/anonymous identifiers for receipt verification and purchase reporting.
- **Content-Security-Policy** in production builds (`vite.config.ts`).
- **No HTML injection paths**: UI built with `h()`; user text only set as text.
- **Pro** requires an active configured product with verified RevenueCat entitlements. The SDK manages
  its signed offline cache; a local owned boolean grants nothing. Tester controls only run in
  development/explicit testing builds. Release gates reject missing owner config and test flags.
- **Release builds** minified, no source maps; web inspection off in the apps.
- **iOS privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`).

A modified app/jailbroken device can patch local checks, and free preview audio can be captured.
Offline caches cannot discover a new refund without communication. These are documented product
limits; local-only operation and the approved free-preview rules remain unchanged.

- iOS imports use system pickers and a mono 48 kHz AVAssetReader range, capped at 60/180 seconds.
  The web/Android fallback checks encoded size/duration before full Web Audio decode; its PCM cap
  is checked after allocation, so it is not a strict pre-allocation memory guarantee.
- DSP uses a bundled classic production worker with cancellation/deadlines. Voice layers and rendered
  instruments each have a 64 MiB cache budget; voices also have an eight-entry limit. Only the selected
  generated arrangement is prepared; instrument preparation uses batches of 16.
- Share files use a dedicated namespace, chunked bridge writes, one-day expiry and a 128 MiB budget;
  songs are separate. Video previews release Blob URLs and recording resources on close/failure.
- `theme.ts`/`public/theme-init.js` implement System/Light/Dark. Paper/ink change; #F0443A and artwork
  stay unchanged. Native launch/status colors follow the preference; text uses native Dynamic Type.

## Quality

- `npm run typecheck`, `npm test`, `npm run build`,
  `npm run ios:sim`.
- `tests/humBench.ts`: humming accuracy on human-like hums; `tests/softhum.test.ts`: very soft humming;
  `tests/free.test.ts` includes the hum that once froze the beat finder; `tests/exports.test.ts`: export rules.
- Hum-to-notes was also measured on 40 real singers (vocadito dataset): F1 0.69 → 0.74 after lowering the
  clarity threshold; an on-device AI model (Basic Pitch) scored lower (0.53–0.60) and is not used. See HISTORY.md.

## Known limits

- The voice layer stretches your take to the song's tempo; very different tempos can sound processed.
- The calibration screen ("Teach my sounds") exists but nothing links to it.
- Split a song (stems) and live hum are designed but not built. Dark mode is implemented.
- Screen-recording protection and an audio "Made with HUMM" voice tag were discussed, not built.
- Unused files that can be deleted: `ui/timeline.ts`, `ui/laneDraw.ts`, `ui/pianoroll.ts`, `styles/timeline.css`.

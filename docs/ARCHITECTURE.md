# HUMM — architecture

HUMM turns humming, singing, whistling and beatboxing into songs, entirely on the phone. It is a
TypeScript web app (Vite, no UI framework) wrapped as an iPhone/iPad and Android app with Capacitor 8.
For the story of how it got here and what was decided, see [HISTORY.md](HISTORY.md).

## Layers

| Layer | Folder | Job | Depends on |
|---|---|---|---|
| Screens | `src/ui` | One function per screen (`mountX(root, params)`), sheets, the component kit. Studio is the simple main screen; Tracks is the landscape-only editor (rail + grid). | everything below |
| Styles | `src/styles` | Tokens (`base.css`), components (`ui.css`), per-screen CSS; `landscape.css` last | — |
| State | `src/state.ts`, `settings.ts`, `storage.ts`, `songName.ts`, `account.ts` | The open song, autosave, settings, songs + Recently deleted in IndexedDB, the signed-in Apple ID | model, native |
| Model | `src/model` | Song data (`project.ts`), styles, auto-arrange, variety, Fix | — |
| Audio | `src/audio` | AudioContext, mic capture (AudioWorklet), lookahead scheduler, buses (voice level + Effect), render/export | synth, model |
| Synth | `src/synth` | 37 instruments and 16 drum kits, all synthesized (no samples) | — |
| DSP | `src/dsp` | Pitch, notes, onsets, tempo, key, harmony, voice tuning, declick, loudness — in a Web Worker | model types |
| Store rules | `src/pro` | `pro.ts` (Pro state, tester code), `exports.ts` (what may be exported), `billing.ts` (RevenueCat) | Capacitor plugins |
| Native | `src/native`, `ios/App/App/HummNative.swift` | Sign in with Apple, Keychain store, landscape lock, in-app review | Capacitor |

Screens never touch IndexedDB or the DSP worker directly except through `state`, `storage` and
`dsp/client`. DSP code is pure (arrays in, arrays out) and unit-tested on synthetic signals (`tests/`).

## Main flows

1. **Start.** `main.ts` → first launch: `welcome` (music taste) → `signin` once (iPhone only) → `hum`.
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
6. **Share.** `pro/exports.canExport(p)` decides. Exportable: WAV, and the 1080 × 1920 video
   (`ui/videoScene.ts` drawn at scale 1.5, MediaRecorder 8 Mbps). Not exportable: Audio / Make video show a
   lock and "Pro features in this song" lists `lockedItems(p)`.

## Data

A song (`Project`) is `bpm`, `bars` (2, 4, 8 or a multiple of 4 up to 96), `key`, `swing`, `quantize`,
`tracks[]`, `favorite?` and `proTools?` (`'more' | 'tracks' | 'fix' | 'fx'`). A track has a `kind`, a
`preset`, `picked?` (the person chose this sound), `hits` or `notes` on the 16th grid, mixer state, and
for hummed parts the raw take (`rawVoice`, `anchors`) and `voice` (`on`, `tune`, `level`, `only`, `fx`).

Songs live in IndexedDB (`project:<id>` + an index); no limit on how many. Deleted songs move to
`trash:<id>` for 30 days (Recently deleted: restore, delete, Delete all). Settings: taste, `signInAsked`,
`proNoticeOff`, latency, snap. The Apple ID is in the Keychain (`secureStore`, key `account`).

## Free vs Pro (code)

`pro/exports.ts`: `FREE_VERSIONS = 3`; `lockedIn` / `lockedItems` list an extra version, Pro sounds with
`picked`, and the `proTools` used; `canExport` is ok for Pro or when nothing is locked; `markTool` /
`unmarkTool` are called by Fix (`ui/fix.ts`), Tracks (first change to notes/hits there), the voice Effect
(`ui/choices.ts`) — each with Undo, via `ui/proNotice.ts` ("Don't show again"). MIDI and 3-minute hums
check `isPro()` directly.

## Security and privacy

- **No network** except the store purchase check (RevenueCat). No accounts on a server, analytics or ads.
  Sign in with Apple stays on the phone (Keychain) — nothing is sent, so App Privacy is unchanged.
- **Content-Security-Policy** in production builds (`vite.config.ts`).
- **No HTML injection paths**: UI built with `h()`; user text only set as text.
- **Pro** comes from the store; the tester code works only while no RevenueCat keys are in the build.
- **Release builds** minified, no source maps; web inspection off in the apps.
- **iOS privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`).

A web-based app ships its JavaScript inside the bundle; on a jailbroken phone the Pro check can be
patched. The realistic goal is "not worth the effort" for a $0.99 unlock.

## Quality

- `npm run typecheck`, `npm test` (23 files, 145 tests + 1 benchmark skipped), `npm run build`,
  `npm run ios:sim`.
- `tests/humBench.ts`: humming accuracy on human-like hums; `tests/softhum.test.ts`: very soft humming;
  `tests/free.test.ts` includes the hum that once froze the beat finder; `tests/exports.test.ts`: export rules.
- Hum-to-notes was also measured on 40 real singers (vocadito dataset): F1 0.69 → 0.74 after lowering the
  clarity threshold; an on-device AI model (Basic Pitch) scored lower (0.53–0.60) and is not used. See HISTORY.md.

## Known limits

- The voice layer stretches your take to the song's tempo; very different tempos can sound processed.
- The calibration screen ("Teach my sounds") exists but nothing links to it.
- Split a song (stems), live hum and dark mode are designed but not built.
- Screen-recording protection and an audio "Made with HUMM" voice tag were discussed, not built.
- Unused files that can be deleted: `ui/timeline.ts`, `ui/laneDraw.ts`, `ui/pianoroll.ts`, `styles/timeline.css`.

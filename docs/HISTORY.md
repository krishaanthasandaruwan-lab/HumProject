> Current plan — 5 October 2026: the owner changed the first-release billing plan to Free, Plus ($1.99/month) and Pro ($4.99/month), with a 3-month Pro introductory free trial for eligible Apple subscribers. Earlier one-time-price descriptions below are historical. See README.md and RELEASE.md for current rules. Home recording remains 10–60 seconds; five-minute arrangements are only in Tracks. Account, store products and website are pending. No upload or GitHub push has occurred in this packaging task.

# HUMM — project history and handover

Read this first if you are picking the project up (person or AI). It records what was built, in what
order, what was decided and why, what was tried and dropped, and what is still open. Code facts are in
[ARCHITECTURE.md](ARCHITECTURE.md); setup and features in the [README](../README.md).

## The product in one paragraph

HUMM is an iPhone app (also iPad, Android and web) that turns a hummed melody into full songs, on the
phone, with no server. You tap the mic and hum (10 seconds to 1 minute); HUMM finds the tempo, key and
notes and offers three arranged versions (as hummed, slower, faster; "More" gives up to 100, in 20
styles), with your own voice auto-tuned on top. You keep one, then build on it in the Studio: beatbox
drums, hum bass and melody, add chords, Fix, mix, and export audio or a before → after video. It is free
to use; Pro ($0.99 once) is about exporting (see "Free vs Pro" below).

## Timeline

### 1 October 2026 — built from the "MouthBand" spec (git history)

The app was generated from [BUILD_PLAN.md](../BUILD_PLAN.md) in seven phases (audio foundations; synth
and sequencer; beatbox → drums; hum → melody and bass; auto-chords and mixer; export and share;
monetization and Android), then extended the same day: beat matching, auto-tuned voice layer, Fix,
more instruments and kits, the style arranger, a hum-first flow (splash → mic → three arrangements),
import, iOS (Capacitor, Swift Package Manager), RevenueCat purchases, the store listing, the metronome
leak fix, the design spec and the paper / ink / Stage Red look.

Branches `claude/update-2` … `claude/update-5`: renamed to HUMM, longer and softer hums, three
different songs, better note detection, a tracks timeline, several parts per kind, iPad, 37 instruments,
16 kits, 20 styles, up to 100 versions, security and App Store readiness, hearts, tester code,
landscape-only Tracks, swipe to delete, Clear cache. `claude/release-1` (2 Oct 01:06): App Store ID,
free/Pro rules, release script, screenshots. Remote: `github.com/krishaanthasandaruwan-lab/humm`.

### 4 October 2026 — this session (branch `claude/update-6`, not committed yet)

In order:

1. **Mac was reset.** Node 24 LTS installed to `~/.local/node` (no sudo; PATH via `~/.zshrc`),
   `npm ci`, Xcode license accepted by the owner, iOS builds and the physical iPhone working again.
2. **First fixes.**
   - A hum is at least 10 seconds: tapping the mic earlier no longer stops it ("Hum at least 10 seconds").
   - Landscape mic screen: room between the mic rings and the hint.
   - Tracks no longer flips to portrait (`src/native/orientation.ts` holds the landscape lock).
3. **Landscape layouts** (rail + stage idea): Studio (song on the left, parts on the right), part
   editor (title and buttons in a left rail, grid on the right), bigger mic title, the heart on Pick
   your sound no longer overlaps.
4. **Tracks redesigned.** The lanes table was removed. A fixed rail (Drums, Bass, Melody, Chords, My
   voice, All) on the left, the picked part's editor on the right; icons flash on their notes while
   playing; "All" shows every part bar by bar. Bass, melody and chords use a step grid in the drum
   grid's look (`ui/noteGrid.ts`) instead of the piano roll — also on the part editor screen.
5. **"AI" for hearing hums — tested and not used.**
   - The owner asked for AI on the phone only (no server, no external API) to pick up hums from
     different voices correctly.
   - Spotify's Basic Pitch (Apache-2.0, also shipped as a Core ML model) was measured against the app's
     detector on 40 real singers from the vocadito dataset (CC-BY-4.0). Score: note F1, with a match
     within 70 ms and half a semitone.
   - Results: app 0.688, Basic Pitch 0.53–0.60, and a hybrid where the model only marks note starts 0.684.
   - What helped instead: the pitch clarity threshold for hums went 0.9 → 0.75 (`HUM_CLARITY`), which
     gave F1 0.741 with the humming benchmark unchanged.
   - The test harness lived in a temporary scratch folder, not in the repo.
6. **Bug fixed: some hums froze the app.** The tempo estimator's parabolic interpolation could push
   the beat period below zero, and `fold()` then looped forever ("Finding the beat…" never ended).
   The shift is now clamped to ±0.5 and `fold()` guards bad input. A regression test was added.
7. **Sign in with Apple.**
   - Offered once after the music question; skippable; Settings › Account to sign in or out.
   - The Apple ID is stored only in the phone's Keychain. There is no server.
   - Native code is in `ios/App/App/HummNative.swift` (Sign in with Apple + Keychain), registered by
     `MainViewController`.
   - The entitlement is in the Release configuration only, because a free Personal Team can't sign it.
8. **Free vs Pro reworked.** It took several rounds with the owner; the final rule:
   - Everything is usable for free. Exporting is what needs Pro when the song uses something locked.
   - The first 3 versions of every hum are free; versions from More carry a lock.
   - The person adding any of these locks the song's export: a Pro sound they pick themselves, a change
     to notes or hits in Tracks, Fix, or the voice Effect. Pro sounds that came with a generated version
     don't count.
   - Exportable songs export audio and a 1080 × 1920 video. MIDI and 3-minute hums are Pro.
   - The free limit of 3 saved songs was removed (it blocked "Use this" on free versions), along with
     the "N of 3 free songs" text.
   - A lifetime per-phone export counter was built briefly and then dropped ("keep it simple").
9. **Share sheet.** For a locked song, Audio and Make video carry a lock, and "Pro features in this
   song (N)" lists each locked item and where it is, with Unlock Pro.
10. **Soft humming.**
    - Recording only stops by itself after about 4 seconds of real silence; soft humming no longer
      counts as quiet.
    - Quiet takes are lifted up to +40 dB.
    - If the first analysis hears fewer than 4 notes, a second, more sensitive pass runs.
    - New test: `tests/softhum.test.ts`.
11. **Mic screen.**
    - "Tap the mic to start a new project" stays about 10 seconds, then the other hints rotate.
    - "Skip" became "Existing projects", which opens the song list.
    - Every mic tap is a new project.
12. **Voice controls on Pick your sound.**
    - My voice volume (0–1.5) and **Effect** (Pro): high-pass, de-mud, presence, air, compression and a
      soft room, on the voice only.
    - **Instruments** volume: scales the band. The voice is compensated so it keeps its own level.
    - These sit above Hum again / Use this; in landscape, on the My voice / More line.
    - They were first put on the Studio rows; the owner moved them here, and the Studio rows are as before.
    - Engine: each bus has its own voice gain, so level changes are live; with the Effect on, the bus is rebuilt.
13. **Smaller items.**
    - Recently deleted has "Delete all".
    - "… is Pro · export needs Pro" notes have Undo and "Don't show again" (`settings.proNoticeOff`).
    - Lock badges show on Fix, the Tracks button and Pro sounds.
    - Docs were updated (this file, README, ARCHITECTURE, RELEASE, STORE_LISTING).
14. **New app icon.** The owner's "Hm" brush-letter reference (`design/icon/hm-reference.jpg`, black
    on orange) redrawn in the app's two colours: Ink #111111 on Stage Red #F0443A.
    - `scripts/make-icon-mark.mjs` cleans the JPEG into a crisp mask (`design/icon/hm-mark.pgm`).
    - `scripts/make-icons.mjs` draws every web, iOS and Android icon from it, optically centred and
      sized for each platform's safe zone. The iOS icon is opaque.
    - The splash screen (bar logo flying into the mic) was removed at the owner's request, as it no
      longer matched the icon. iOS and Android launch on plain paper, then the mic screen appears.

State at the end of the session: typecheck clean, 23 test files / 145 tests pass (1 benchmark skipped),
production build and iOS device build work, the app runs on the owner's iPhone 16 Pro.

## Decisions and why

- **No server, no external AI.** Privacy ("your audio never leaves your phone") and no running costs.
  Any "AI" must run on the device; the off-the-shelf model was measured and lost, so it isn't shipped.
- **Pro is about exporting, not using.** People try everything; the lock shows what's Pro; export asks
  for Pro and explains exactly why.
- **Keep the existing look.** Paper, ink, Stage Red, Anton/Barlow, hard shadows, square corners. New UI
  reuses the drum grid and card language rather than adding new styles.
- **The owner approves cross-cutting changes.** When a requested change would affect other features,
  explain first and wait for approval. Keep everything else as is ("other tools are tested and fine-tuned").

## Not built yet / open

- Screen-recording protection: iOS can't block recording; the option discussed was to blank the screen
  and mute while `UIScreen.isCaptured`.
- A spoken "Made with HUMM" tag in previews: needs a voice clip (the owner records one, or the
  iPhone's own voice); Mac system voices may not be used commercially.
- A Settings switch to bring the Pro notes back after "Don't show again".
- The calibration screen exists but isn't linked; split a song (stems) and live hum are
  designed (`design/DESIGN_SPEC.md`) but not built.
- Android: JDK 21 and the Android SDK aren't installed on the current Mac.
- Store: join the paid Apple Developer Program, RevenueCat keys, public privacy-policy URL, real
  support email, App Store screenshots of the new screens. See [RELEASE.md](RELEASE.md).
- Clean-up: delete `src/ui/timeline.ts`, `src/ui/laneDraw.ts`, `src/ui/pianoroll.ts`,
  `src/styles/timeline.css` (unused).

## How to continue

```bash
export PATH="$HOME/.local/node/bin:$PATH"     # if npm isn't found
cd mouthband
npm ci && npm run typecheck && npm test && npm run build
npm run ios:sync                               # then Xcode, or the devicectl commands in the README
```

Gotchas met on this Mac:
- If `git` or `python3` say the Xcode license isn't accepted, run `sudo xcodebuild -license` in Terminal.
- The free Apple team allows only 3 side-loaded apps per phone, and they expire after 7 days.
- Vitest prints `console.log` output only when a test finishes.
- A shell loop that waits with `pgrep -f "<name>"` also matches itself.
- Headless Chrome screenshots of the dev server are a good way to check layouts: emulate 393 × 852 and
  852 × 393, and set `--safe-area-inset-*` on `:root` to imitate the iPhone's notch.

## People and preferences

- The owner, Krishan Sandaruwan, often dictates by voice. Read for intent, and confirm the reading
  when it's unclear.
- Show results on the real phone when possible. Keep messages short and concrete.
- Don't add credits or attribution text to the app or docs.

## 4–5 October 2026 — audit remediation

The owner authorized fixing audit findings while preserving musical logic, layout and artwork,
adding dark mode with the same orange accent, and keeping work local without pushing to GitHub.
They will add privacy/support/store configuration later and chose to skip optional Apple sign-in.

- Hardened entitlement verification and production unlock controls, export checks and paid provenance.
  Restore/pending purchases and prices now reflect store outcomes.
- Fixed project-bound Undo, atomic/serialized persistence, failed-save recovery, microphone
  single-flight/cleanup, stale import/navigation callbacks and capture limits.
- Added bounded iOS media imports, DSP cancellation/deadlines, lazy/bounded preparation/cache,
  video cleanup, original-recording sharing choice and temporary-file retention limits.
- Added accessible grids/keyboard navigation, nested-sheet focus, scrollable Tracks rail,
  iPad portrait fallback, theme preferences and native appearance/Dynamic Type.
- Removed first-release account creation/capability; kept old test identity removal. Updated
  privacy disclosures, release gates and the development dependency advisory.

See [AUDIT_REMEDIATION.md](AUDIT_REMEDIATION.md) for final evidence and remaining owner/device gates.
No GitHub push, signed archive, App Store upload or purchase was made.

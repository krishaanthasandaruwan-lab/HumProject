# MouthBand — Your mouth is the whole band

> **Beatbox the drums. Hum the bassline. Whistle the melody.**
> MouthBand turns your voice into real drums, bass, lead and chords, automatically in key and on the beat.
> Then it exports a **"what I recorded → what came out"** video, made for TikTok and Reels.

## Why this idea is different

- **Huge audience.** Billions of people hum, whistle and beatbox. Almost none can play an instrument or use a music production app. MouthBand makes *anyone* a music producer in 30 seconds.
- **Grows by itself.** Every export is a before-and-after video, which is the most shareable format on social media. The free version adds a *"Made with MouthBand"* watermark, so every share advertises the app.
- **Not a crowded market.** Voice-to-instrument tools exist, but they're pro desktop plugins costing $100+ (for example Vochlea Dubler) or research demos. No simple, fun, $1 mobile app does **beatbox + hum → full song** in one place.
- **"Learns your mouth" in 20 seconds.** A calibration step trains a tiny personal classifier on *your* kick, snare and hi-hat sounds. That's what makes it feel like magic instead of a gimmick.
- **No server and no AI API costs.** All the signal processing runs on the device, so each $0.99 is profit after the store's cut.
- **Serious engineering:** real-time audio, onset detection, spectral features, k-NN classification, pitch tracking, key detection, auto-harmonization, a sound synthesizer, a loop sequencer, and audio+video export.

**How it makes money:**
- **Free:** create unlimited loops, but exports carry the watermark and there are 2 sound kits.
- **$0.99 once:** no watermark, all kits, WAV and MIDI export, unlimited saved projects.

---

## 0. How to use this with Claude Code

1. Install Node 20+. Make a folder `mouthband/`, save this file as `BUILD_PLAN.md`, and run `git init`.
2. Start Claude Code in that folder and paste the Kickoff Prompt below.
3. Test on your **phone** early: run `npm run dev -- --host` and open the local-network URL. The mic needs HTTPS on phones, so use the `@vitejs/plugin-basic-ssl` plugin.
4. After each phase: `Phase N works. Commit and start Phase N+1.`
5. **To save your limit:**
   - Run `/compact` after each phase.
   - Paste exact errors.
   - No stretch goals until Phase 7 is done.
   - Wear headphones while testing so the speaker doesn't leak into the mic.

### Kickoff Prompt

```
Read BUILD_PLAN.md fully. We are building MouthBand exactly as specified:
a Vite + TypeScript PWA using the Web Audio API. Work phase by phase. After each
phase: run it, run tests, fix type errors, tell me how to test it on my phone,
then STOP and wait for "next". No libraries beyond the plan without asking.
Start with Phase 1.
```

---

## 1. Tech stack (fixed)

| Part | Choice |
|---|---|
| App | **Vite + TypeScript, no framework**, PWA (`vite-plugin-pwa`), mobile-first CSS |
| Audio | **Web Audio API** + AudioWorklet (recording), OfflineAudioContext (rendering) |
| Features | `meyda` (spectral centroid, flatness, ZCR, RMS, MFCC) |
| Pitch | `pitchy` (McLeod pitch method) |
| Storage | IndexedDB via `idb-keyval` (projects, calibration profile) |
| Tests | `vitest`, using **synthetic signals** (sine waves, clicks, noise) |
| Store build (Phase 7) | **Capacitor** to wrap it for Android and Google Play, with $0.99 in-app purchase |

**All instruments are synthesized in code.** There are no sample files, so there are no licensing problems.

```
mouthband/
  src/
    main.ts               app shell, screen router
    audio/
      context.ts          shared AudioContext, unlock on first tap
      recorder.ts         mic -> Float32Array (AudioWorklet)
      metronome.ts        count-in + click, BPM
      scheduler.ts        lookahead loop scheduler (25ms tick, 100ms ahead)
      export.ts           OfflineAudioContext -> WAV; canvas+audio -> video
    dsp/
      onsets.ts           spectral-flux onset detection
      features.ts         per-hit feature vectors (meyda)
      drumClassifier.ts   rule-based + personal k-NN
      pitch.ts            frame pitch track (pitchy)
      notes.ts            pitch track -> notes (segment, quantize)
      key.ts              Krumhansl-Schmuckler key detection + scale snap
      harmony.ts          auto-chords under melody
      quantize.ts         grid, swing, strength
    synth/
      drums.ts            kick / snare / hat / clap / tom synth voices
      instruments.ts      bass, lead, keys, pad voices
      kits.ts             4 drum kits + 4 instrument presets
    model/
      project.ts          Project, Track, Note, DrumHit types
    ui/
      record.ts  calibrate.ts  grid.ts  pianoroll.ts  mixer.ts  export.ts  paywall.ts
  tests/
  BUILD_PLAN.md
```

---

## 2. Data model

```ts
type DrumType = "kick" | "snare" | "hat";
interface DrumHit { step: number; type: DrumType; velocity: number }        // step = 16th index
interface Note    { start: number; length: number; midi: number; velocity: number } // in 16ths
interface Track {
  id: string;
  kind: "drums" | "bass" | "lead" | "chords";
  preset: string;
  hits?: DrumHit[];
  notes?: Note[];
  rawVoice?: Float32Array;          // the original recording, kept for the before/after video
  volume: number;
  muted: boolean;
}
interface Project {
  id: string; name: string;
  bpm: number; bars: 2 | 4 | 8;
  key?: { tonic: number; mode: "major" | "minor" };
  swing: number;                    // 0–0.3
  tracks: Track[];
  createdAt: number;
}
```

---

## 3. Core algorithms

### 3.1 Recording (recorder.ts)
- Call `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`. **This is critical.** The phone's default voice processing destroys beatbox transients.
- Metronome count-in of 1 bar, then record exactly `bars × 4` beats at the chosen BPM (default 90).
- Measure the output latency (`ctx.outputLatency + ctx.baseLatency`) and shift the recording by it so hits line up with the grid. Add a manual latency slider in Settings as a fallback.

### 3.2 Onset detection (onsets.ts)
- Frame size 1024, hop 256, Hann window, FFT magnitudes.
- **Spectral flux:** the sum of positive magnitude differences between consecutive frames.
- **Adaptive threshold:** `median(flux over ±8 frames) × 1.5 + δ`. Pick a peak above the threshold, then enforce at least **70 ms** before the next one.
- Output the onset times in seconds, plus the RMS of each onset as its velocity.

### 3.3 Beatbox → drums (features.ts + drumClassifier.ts)
- For each onset, take a **60 ms window** and compute: RMS, spectral centroid, spectral flatness, zero-crossing rate, the ratio of energy below 200 Hz, the ratio of energy above 5 kHz, and MFCC 1–8.
- **Rule-based default** (works without calibration):
  - **kick** ("B", "boom"): low centroid, high share of energy below 200 Hz.
  - **hat** ("ts", "t"): high centroid, high ZCR, high share above 5 kHz.
  - **snare** ("K", "psh"): anything else. It's broadband, with high flatness.
- **Personal calibration (the magic):** the user makes each sound 5 times, following on-screen prompts. That gives 15 labeled feature vectors. Z-score normalize them and classify with **k-NN (k=3)**. Save the profile in IndexedDB. This improves accuracy a lot.
- **Quantize** onsets to the 16th-note grid, with *strength* (0–100%) and *swing* sliders. Map velocity from RMS to 0.4–1.0.
- If two hits land on the same step with the same drum type, keep the louder one.

### 3.4 Hum / whistle → melody (pitch.ts + notes.ts)
- Pitch track with `pitchy`: frame 2048, hop 256, voiced only when clarity > 0.9 and RMS > the noise floor. Convert Hz to MIDI with `69 + 12·log2(f/440)`.
- Smooth with a median filter over 5 frames.
- **Segment into notes:** start a new note on silence, or when pitch moves more than 0.8 semitones for at least 50 ms. Drop notes shorter than 80 ms.
- Each note's pitch = the median MIDI over the note, rounded.
- **Bass mode:** transpose the notes down to the MIDI 28–52 range.

### 3.5 Key detection and scale snap (key.ts)
- Build a **pitch-class histogram weighted by note duration**. Correlate it with the Krumhansl-Schmuckler major and minor profiles for all 12 tonics and pick the best of the 24.
- **Snap:** move each note to the nearest pitch in that scale. This is gentle auto-tune for off-key hummers. It can be switched off.

### 3.6 Auto-chords (harmony.ts): the "full band" moment
- For each bar, score the 7 diatonic triads by how much melody-note duration falls on chord tones.
- Add a bonus for common progressions (I–V–vi–IV, vi–IV–I–V, i–VI–III–VII) and a small penalty for repeating the same chord.
- Choose chords with a simple dynamic-programming (Viterbi-style) pass over the bars.
- Output chord notes as a "chords" track (pad or keys), with the root note optionally added to the bass track when the user hasn't hummed a bass part.

### 3.7 Synthesis (synth/)
- **Kick:** sine wave with pitch dropping 150→45 Hz over 0.12 s, plus a fast volume decay and a click on the attack.
- **Snare:** white noise through a bandpass at 1.8 kHz, plus a 180 Hz triangle wave, with a 0.18 s decay.
- **Hat:** noise through a highpass at 7 kHz, with a 0.05 s decay. Open hat = 0.3 s.
- **Kits** are parameter sets: *808*, *Boom-Bap*, *Lo-fi* (bitcrush plus lowpass), *Techno*.
- **Instruments:**
  - **Bass:** sawtooth into a lowpass filter with an envelope.
  - **Lead:** square wave with vibrato.
  - **Keys:** FM synthesis, 2 operators.
  - **Pad:** 3 detuned sawtooths with a slow attack and a simple reverb (a ConvolverNode with a generated impulse response).
- **Scheduler:** a lookahead loop (tick every 25 ms, schedule 100 ms ahead) that loops the whole project.

### 3.8 Export (export.ts)
- **WAV:** render the mix in an OfflineAudioContext, then encode 16-bit PCM WAV.
- **Before → after video:** render a 9:16 canvas animation.
  - The first N bars show the raw voice recording with a waveform and "🎤 What I recorded".
  - The next N bars show the full band with animated pads lighting up on each hit and "🔥 What MouthBand made".
  - Capture `canvas.captureStream(30)` plus a MediaStreamDestination for audio, and record with `MediaRecorder`. Use mp4 when supported (Safari) or webm otherwise.
  - Free version: a "Made with MouthBand" watermark.
- Share with the Web Share API (`navigator.share({files})`), with a download link as fallback.
- **MIDI export (paid):** write a Standard MIDI File format 1 by hand (about 80 lines of code).

---

## 4. Phases and time budget (about 5h)

### Phase 1 — Audio foundations (25 min)
- Vite + TS + PWA + HTTPS dev server, mobile layout, and an audio "unlock" on the first tap.
- Mic recording with voice processing off, playback, and a live waveform.
- Metronome with count-in, a BPM selector (70–140), and bar count (2, 4 or 8).
- **Done when:** on your phone you can record 4 bars with a click and play them back.

### Phase 2 — Synth and sequencer engine (35 min)
- `drums.ts`, `kits.ts`, `instruments.ts`, `scheduler.ts`, and the project model.
- A 16-step drum grid you can tap to program, which loops without drift.
- **Done when:** a hand-programmed beat loops smoothly and you can switch between the 4 kits.

### Phase 3 — Beatbox → drums (70 min)
- `onsets.ts`, `features.ts`, `drumClassifier.ts` (rules, calibration and k-NN), and `quantize.ts`.
- **Calibration screen:** "Say **B** ×5 → **K** ×5 → **ts** ×5", with a live confidence meter.
- Record a beatbox, see it appear on the drum grid, and fix mistakes by tapping a cell to cycle kick, snare, hat and empty.
- **Tests:**
  - Clicks placed at known times are detected within 10 ms.
  - A synthetic low sine burst is classified as kick, and a highpassed noise burst as hat.
  - k-NN on 3 separated clusters classifies correctly.
- **Done when:** your "B-ts-K-ts" beatbox becomes a correct drum loop after calibration.

### Phase 4 — Hum → melody and bass (60 min)
- `pitch.ts`, `notes.ts`, `key.ts`, and an editable piano-roll view (drag a note up or down, delete it).
- The Record screen gets a track picker: **Drums (beatbox) · Bass (hum) · Lead (hum or whistle)**.
- **Tests:**
  - A 220 Hz sine wave is tracked as MIDI 57.
  - A C-major scale sequence is detected as C major.
  - A 50-cent-sharp note snaps into the scale.
- **Done when:** a hummed tune plays back in tune as a synth lead over your beat.

### Phase 5 — Auto-chords and mixer (30 min)
- `harmony.ts` plus a **"✨ Add chords"** button that generates a pad track from the melody.
- A mixer with volume, mute and solo per track, swing, quantize strength, and a key display.
- **Done when:** beatbox + hum + one tap sounds like a real song.

### Phase 6 — Export and share (35 min)
- WAV export, the **before → after vertical video** with watermark, and the Web Share API.
- Projects list saved in IndexedDB (rename, duplicate, delete).
- **Done when:** you can share a video straight to WhatsApp or TikTok from your phone.

### Phase 7 — Monetization, onboarding and store build (25 min)
- A `isPro` flag. Free = watermark and 2 kits; Pro = everything plus MIDI and WAV.
- Paywall headline: *"Remove watermark & unlock all sounds — $0.99 once. No subscription."*
- 3-card onboarding: "Beatbox → Drums", "Hum → Melody", "Share your song".
- Capacitor Android wrap:
  - `npx cap add android`, plus the `RECORD_AUDIO` permission and WebView mic permission handling.
  - Google Play Billing through a Capacitor purchases plugin (for example RevenueCat's), behind the `isPro` flag.
  - A `DEV_PRO` flag for testing.
- Write `STORE_LISTING.md`: name, subtitle, keywords, descriptions, 5 screenshot captions, and a privacy policy stating "audio never leaves your device".

**Buffer: 20 min.**

---

## 5. Stretch goals (after the 5h)

- **Real-time mode:** hear the drums *while* you beatbox, using onset detection inside the AudioWorklet. Needs a low-latency native audio setup.
- **Auto-tempo:** estimate BPM from free-form beatboxing (autocorrelation of the onset curve), so no metronome is needed.
- **Duet and remix:** open someone's shared loop and add your own layer on top.
- **Genre styles:** "make it reggaeton / drill / baila / lo-fi", which changes the kit, adds fills, and switches the chord style.
- **Daily challenge:** "Hum this 4-note hook and make a beat." Keeps people coming back and builds community.

---

## 6. Rules for Claude (paste if it drifts)

```
- Follow BUILD_PLAN.md. No servers, no analytics, no network calls (except purchases).
- All DSP functions are pure (Float32Array in -> data out) and unit-tested with synthetic signals.
- Never run heavy DSP on the UI thread in a way that blocks >50ms: chunk + yield.
- All instruments are synthesized — no sample files.
- Keep files < 300 lines. Run `npx tsc --noEmit` and `npx vitest run` after each phase.
```

## 7. Common problems

| Problem | Fix |
|---|---|
| Kicks aren't detected, everything is quiet | Voice processing is on. Check that all three constraints are `false`. On iOS, set `ctx` to run at 48 kHz. |
| Hits land late on the grid | Latency compensation is missing. Subtract `outputLatency + baseLatency` and add the manual slider. |
| Snare and hat get confused | Do the calibration. Raise the >5 kHz band weight. Use k=3 with z-score normalization. |
| Hummed notes jump octaves | Clamp to the expected range, apply the median filter, and fix octave jumps (if the jump is ≈12 semitones versus the previous note, fold it back). |
| No audio on iPhone | AudioContext must be created or resumed inside a tap handler. Also turn off the silent switch. |
| Video export has no sound | Connect the master bus to *both* `ctx.destination` and a `MediaStreamAudioDestinationNode`, and merge its track into the canvas stream. |

---

## 8. Launch plan (virality is the business)

1. **Free web version first.** Deploy it to Vercel or Netlify as a PWA, with no store needed. Watermarked exports spread the name.
2. **Google Play app** with the $0.99 unlock (one-time $25 developer fee). Check that Play merchant payouts are supported in your country. iOS comes later.
3. **Content engine:** 30 days of daily Reels/TikToks/Shorts in the format *"I beatboxed this in the bus → MouthBand turned it into this."* Use local genres (baila, Bollywood, Afrobeats hooks) to reach huge markets that aren't well served.
4. **Creator seeding:** send the Pro version free to 50 small beatboxers and music TikTokers.
5. **Localize** the store listing into 10 languages.
6. **First goal: 1,000 paying users.** Read every review and improve the classifier and the fun factor.

## 9. Final checklist

- [ ] Record with count-in, latency compensated
- [ ] Beatbox → drums with calibration (k-NN) and a correctable grid
- [ ] Hum/whistle → bass and lead with key detection and scale snap
- [ ] Auto-chords, mixer, 4 kits, 4 instruments
- [ ] Before → after vertical video, WAV, share
- [ ] Free vs $0.99 Pro, onboarding, Android build, STORE_LISTING.md

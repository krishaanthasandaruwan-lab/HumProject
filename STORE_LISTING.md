# HUMM — Store listing

Copy-paste material for the App Store (iPhone) and Google Play.

Updated 5 October 2026. Verify store pricing, live privacy/support details and current screenshots
before publishing. iOS is the first release target; Android declarations need a separate review.

## Name and tagline

| Field | Text | Limit |
|---|---|---|
| App Store name | **HUMM: Hum to Song** | 22 / 30 |
| App Store subtitle | **Hum it, beatbox it, get a band** | 30 / 30 |
| Play title | **HUMM: Hum to Song & Beats** | 30 / 30 |
| Play short description | **Hum a tune or beatbox a beat — get a full song with drums, bass and chords.** | 75 / 80 |
| Category | Music (App Store) · Music & Audio (Play) | |
| Price | Free, with a one-time non-consumable ("HUMM Pro"); intended US price $0.99, confirm in store | |
| Age rating | 4+ (App Store) · Everyone (Play) | |

## Keywords (App Store, 100 characters)

```
hum to song,beatbox,beat maker,vocal tune,melody maker,music maker,song maker,drum machine,loop
```

"Auto-Tune" is a registered trademark (Antares), so it stays out of the keywords and the listing; the app's own "Auto-tune" switch is just a feature label.
Play Store has no keyword field. Work these phrases into the full description instead: *hum to song, beatbox app, beat maker, voice to instrument, music maker, make a song, TikTok music*.

## Promotional text (App Store, 170 characters, can change without review)

New: hum anything and get three full arrangements to pick from — with your own voice in tune and on the beat. No studio, no theory, no uploads.

## Full description (both stores, under 4,000 characters)

Hum a melody. Get a song.

HUMM listens to you hum, sing or whistle — no metronome, no setup — finds the beat and the key, and plays it back as a full band: drums, bass, chords and your melody on a real instrument. Pick from three styles, keep the one you love, and share it.

No instruments. No music theory. No studio. Just your mouth and 30 seconds.

HUM → SONG
🎤 Open the app and hum. HUMM finds your tempo and key by itself.
🎧 Three arrangements to choose from — Lo-fi Chill, Bright Pop, Trap, Dance, Acoustic Band or Cinematic, whichever suit your tune.
🎙 Add your own voice on top, pulled in tune and onto the beat.

🎚 Turn your voice up over the band — or the band down — before you keep a version.

BUILD IT PART BY PART
🥁 Beatbox → Drums: say "B", "K" and "ts" and HUMM hears a kick, a snare and a hi-hat, right on the beat.
🎸 Hum → Bass and 🎹 Hum → Melody, snapped into the right key, shown in a simple step grid.
✨ One tap → Chords that fit your melody.
✨ Fix: one tap makes every bar of a take agree — a missed hat, a slipped beat, a wobbly note. Always undoable.
📂 Import a voice memo or a video and HUMM beat-matches it into your song.
↔️ Turn your phone sideways for Tracks: every part, bar by bar.

SOUNDS
• 16 drum kits, from 808 and Boom-Bap to Rock, Jazz Brush, Drill, Reggaeton, Afrobeat and UK Garage.
• 37 instruments: piano, guitar, harp, ukulele, kalimba, steel drum, sax, violin, harmonica, strings, choir, synths and seven kinds of bass.
• 20 styles: Pop, Hip-hop, R&B, Afrobeat, Reggaeton, Rock, Jazz, EDM, Lo-fi, Cinematic and more — up to 100 versions of every hum.
• Tempo, 2/4/8-bar loops, swing, quantize strength, and a mixer with mute and solo.

SHARE
🎵 Export your song as audio, or as a "what I recorded → what came out" video in 1080p, made for TikTok, Reels, Shorts and WhatsApp.

PRIVATE BY DESIGN
All listening, analysis and sound-making happens on your device. Audio and songs stay there until you choose to share a copy. No account or sign-in, no ads, no advertising tracking. Purchase services verify Pro and provide purchase reporting.

FREE vs PRO
Free: hum as much as you like, keep every song, and export the first three versions of every hum as audio or video (with a small "Made with HUMM" mark). Try everything else too — every sound, Tracks, Fix, the voice effect and up to 100 versions; they carry a lock and need Pro to export.
Pro, one purchase — no subscription: export every song with any sound or tool, no watermark, MIDI files and 3-minute recordings. The purchase screen shows your store's localized price.

Tip: wear headphones while recording so the speaker doesn't leak into the mic.

## Screenshot captions (6)

1. **Hum a tune. Get a song.** The hum screen while listening (the waveform under the big mic).
2. **Pick your sound.** The three choices with one playing.
3. **Your voice, in tune and on the beat.** Pick your sound with the My voice and Instruments sliders.
4. **Beatbox it. Get real drums.** The drum grid after a beatbox take.
5. **One tap fixes every bar.** The ✨ Fix button glowing, with the "Fixed 4 hits" toast.
6. **Share the before → after.** The export sheet with the vertical video.

App Store: use accepted 6.9-inch iPhone sizes such as 1320×2868 and 13-inch iPad sizes such as
2064×2752 or 2048×2732, with landscape equivalents where needed. Capture the current candidate in
both themes; iPad shots are required because the app supports iPad. Six shots are a marketing choice.
Check [Apple's specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
before upload. Existing pre-remediation images are historical QA evidence, not final store assets.

## In-app purchase and RevenueCat setup

**App Store (iPhone)**
1. In App Store Connect, create the app (bundle ID `com.krishanthasandaruwan.humm`).
2. In **Monetization → In-App Purchases**, add a **Non-Consumable** with product ID **`humm_pro`**, reference name "HUMM Pro", price **$0.99**. Add a display name, description and a review screenshot (the paywall).
3. Sign the Paid Applications agreement (Business section) — purchases do not work without it.

**Google Play (Android)**
1. In Play Console, go to **Monetize → Products → In-app products**. Create **`humm_pro`**, "HUMM Pro", **$0.99**, a one-time non-consumable purchase.

**RevenueCat (both)**
1. Create a project; add the iOS app (`com.krishanthasandaruwan.humm`, with an App Store Connect in-app purchase key) and the Android app (`com.krishanthasandaruwan.humm`, with the Play service credentials).
2. Create entitlement **`pro`** and attach both `humm_pro` products.
3. Create offering **`default`** with a **Lifetime** package containing the two products; mark it Current.
4. Put public SDK keys in ignored `.env.local`. Also set the real privacy URL/support email, entitlement
   and product ID as described in [docs/RELEASE.md](docs/RELEASE.md). For the iOS upload candidate run
   `npm run release:check`, `npm run build:release`, then `npx cap sync ios` before archiving.

The app requires an active configured product and verified RevenueCat entitlement. Local owned/tester
flags do not grant production Pro. Restore is in Settings and the paywall when the native store is
configured; unavailable/error/pending responses are distinguished from successful ownership.

## App Review notes (App Store)

> HUMM turns microphone recordings into music. Analysis and synthesis run on the device; no audio or
> songs are uploaded. Tap the mic and hum for at least 10 seconds, choose an arrangement and tap Use
> this. No account/sign-in is required or offered. The first three arrangements export free, including
> their automatically assigned sounds. Unlimited saved songs and individual Part edits are free.
> User-picked Pro sounds, More versions, Tracks edits, Fix and the voice effect require Pro to export.
> MIDI and three-minute recordings are Pro. Free videos carry a visual Made with HUMM mark; WAV has
> no spoken watermark. Share explains whether the original recording is included and lets users turn
> it off. Pro is the humm_pro non-consumable, available from Settings or Share. Restore is provided.
> Purchases use StoreKit through RevenueCat; use the sandbox purchase flow for review.

Export compliance: `ITSAppUsesNonExemptEncryption` is already set to NO in Info.plist.

## Privacy policy

*Draft updated 5 October 2026 — publish with your real support contact and public URL.*

**Audio and songs are processed locally. Store services process purchase information.**

- **Microphone.** HUMM uses the microphone only while you record, hum or run the calibration. The recording is analysed on your device and stored on your device inside the app, together with your songs. It is never uploaded.
- **Imported files** are read on your device only.
- **Accounts.** This release has no account creation or sign-in. An identity saved by an earlier test
  build is local only and can be removed in Settings; it does not sync songs.
- **Storage and deletion.** Songs/settings are stored in app-local storage. Recently deleted songs
  expire after 30 days and are purged the next time HUMM opens or lists that folder, or immediately
  with Delete forever. Temporary share files expire during app use after a day and have a size budget.
  Uninstall removes local songs/settings; backups may restore them. Keychain test identities and store
  purchase records can survive reinstall. Shared copies are controlled by their destination.
- **No ads or advertising tracking.** HUMM has no advertising identifiers or audio analytics. Store
  purchase services use the network and provide purchase reporting.
- **Purchases.** Apple/Google handles payment. RevenueCat processes purchase history, an anonymous
  app user ID and technical purchase data to verify Pro and provide purchase reporting. It receives
  no audio or songs. See [RevenueCat's policy](https://www.revenuecat.com/privacy).
- **Sharing.** Videos and audio files are only shared when you choose to share them, using your phone's share sheet.
- **Children.** Audio remains local. Purchases follow the store's parental controls. Choose the age
  rating/category and publish any territory-specific disclosures before release.
- **Contact.** Add your real support email before publishing; the app uses `VITE_SUPPORT_EMAIL`.

## App Privacy (App Store "nutrition label")

- **Purchases → Purchase History**: collected by RevenueCat for **App Functionality and Analytics**
  (verification and purchase reporting); **not linked** with the current anonymous setup;
  **not used for advertising tracking**.
- Everything else: **Data Not Collected** (audio stays on the device).
- Check [RevenueCat's current guide](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
  and the aggregate archive manifests before submitting. Custom identifiable user IDs or advertising
  integrations would require different answers.

## Data safety form (Play Console)

Android is not certified by this iOS pass. Review the current Play form and RevenueCat setup before
claiming no data collection/sharing. Audio is local; purchase data is processed externally. Check
app-functionality/analytics purposes, provider sharing exceptions, HTTPS, retention and deletion
against the exact Android build and current Play requirements.

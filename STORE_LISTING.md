# HUMM — Store listing

Copy-paste material for the App Store (iPhone) and Google Play.

## Name and tagline

| Field | Text | Limit |
|---|---|---|
| App Store name | **HUMM: Hum to Song** | 22 / 30 |
| App Store subtitle | **Hum it, beatbox it, get a band** | 30 / 30 |
| Play title | **HUMM: Hum to Song & Beats** | 30 / 30 |
| Play short description | **Hum a tune or beatbox a beat — get a full song with drums, bass and chords.** | 75 / 80 |
| Category | Music (App Store) · Music & Audio (Play) | |
| Price | Free, with a one-time $0.99 in-app purchase ("HUMM Pro") | |
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
Your audio never leaves your phone. All listening, analysis and sound-making happens on the device. Optional Sign in with Apple stays on your phone too. No ads, no tracking.

FREE vs PRO
Free: hum as much as you like, keep every song, and export the first three versions of every hum as audio or video (with a small "Made with HUMM" mark). Try everything else too — every sound, Tracks, Fix, the voice effect and up to 100 versions; they carry a lock and need Pro to export.
Pro, $0.99 once — no subscription: export every song with any sound or tool, no watermark, MIDI files and 3-minute hums.

Tip: wear headphones while recording so the speaker doesn't leak into the mic.

## Screenshot captions (6)

1. **Hum a tune. Get a song.** The hum screen while listening (the waveform under the big mic).
2. **Pick your sound.** The three choices with one playing.
3. **Your voice, in tune and on the beat.** Pick your sound with the My voice and Instruments sliders.
4. **Beatbox it. Get real drums.** The drum grid after a beatbox take.
5. **One tap fixes every bar.** The ✨ Fix button glowing, with the "Fixed 4 hits" toast.
6. **Share the before → after.** The export sheet with the vertical video.

Sizes: App Store needs 6.9" iPhone shots (1320×2868 or 1290×2796); Play needs at least 1080×1920. Use the dark background and bold white caption text across the top third.

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
4. Put the public SDK keys in `.env.local` — `VITE_REVENUECAT_IOS_KEY` (`appl_…`) and `VITE_REVENUECAT_ANDROID_KEY` (`goog_…`) — then rebuild: `npm run ios:sync` / `npm run android:sync`.

The app reads `customerInfo.entitlements.active.pro`. "Restore purchase" is in Settings and on the paywall (Apple requires it).

## App Review notes (App Store)

> HUMM records the user's humming and beatboxing with the microphone and turns it into music. All analysis and synthesis run on the device; nothing is uploaded. To try it: tap the mic and hum for at least 10 seconds, then pick one of the three arrangements and tap Use this. Sign in with Apple is optional (Skip) and the identity is only stored on the device. HUMM Pro ($0.99 non-consumable) can be bought from Settings → Unlock Pro, or from Share when a song uses a locked feature (e.g. pick an extra version with More, then Share); use a sandbox account.

Export compliance: `ITSAppUsesNonExemptEncryption` is already set to NO in Info.plist.

## Privacy policy

*Effective 1 October 2026*

**HUMM does not collect personal data. Audio never leaves your device.**

- **Microphone.** HUMM uses the microphone only while you record, hum or run the calibration. The recording is analysed on your device and stored on your device inside the app, together with your songs. It is never uploaded.
- **Imported files** are read on your device only.
- **Sign in with Apple** is optional. If you use it, your Apple user ID (and, the first time, the name and email Apple shares) are stored only on your device, in its Keychain. They are not sent to us or anyone else. Settings → Sign out removes them.
- **Your songs and settings** are stored locally in the app's own storage on your device. Uninstalling the app deletes them.
- **No accounts, no ads, no analytics, no tracking.** HUMM makes no network requests except for purchases.
- **Purchases.** If you buy HUMM Pro, the payment is handled by Apple (App Store) or Google (Play). HUMM uses RevenueCat to confirm the purchase. RevenueCat receives the purchase receipt and a random anonymous app user ID. It does not receive any audio or songs. See RevenueCat's privacy policy at https://www.revenuecat.com/privacy.
- **Sharing.** Videos and audio files are only shared when you choose to share them, using your phone's share sheet.
- **Children.** HUMM is suitable for everyone and does not knowingly collect data from anyone.
- **Contact.** Questions: *your-support-email@example.com* (replace before publishing).

## App Privacy (App Store "nutrition label")

- **Purchases → Purchase History**: collected by RevenueCat for **App Functionality** (unlocking Pro); **not linked** to the user's identity; **not used for tracking**.
- Everything else: **Data Not Collected** (audio stays on the device).
- Check RevenueCat's current "Apple App Privacy" guide before submitting, in case its SDK's answers have changed.

## Data safety form (Play Console)

- Data collected: **None**. Audio is processed on the device only.
- Data shared: **None**. Purchase history goes to the payment processor, which is exempt under Play's "service provider" rules.
- Encryption in transit: yes (HTTPS for purchase verification).
- Data deletion: all data lives on the device and is deleted when the app is uninstalled.

# MouthBand — Store listing

Copy-paste material for Google Play (and later the App Store).

## Name and tagline

| Field | Text | Limit |
|---|---|---|
| App name (Play title) | **MouthBand: Beatbox to Music** | 27 / 30 |
| Subtitle (App Store) | **Your mouth is the whole band** | 28 / 30 |
| Short description (Play) | **Beatbox the drums, hum the bass, whistle the tune — get a full song in seconds.** | 79 / 80 |
| Category | Music & Audio | |
| Price | Free, with a one-time $0.99 in-app purchase ("MouthBand Pro") | |
| Content rating | Everyone | |

## Keywords (App Store, 100 characters)

```
beatbox,beat maker,hum to music,voice to instrument,drum machine,song maker,melody,music maker,loop
```

Play Store has no keyword field. Work these phrases into the full description instead: *beatbox app, beat maker, hum to song, voice to drums, music maker, make a song, TikTok music*.

## Full description (Play, under 4,000 characters)

Beatbox the drums. Hum the bassline. Whistle the melody. MouthBand turns your voice into a full band: real drums, bass, lead and chords, automatically in key and on the beat.

No instruments. No music theory. No studio. Just your mouth and 30 seconds.

HOW IT WORKS
🥁 Beatbox → Drums: say "B", "K" and "ts" and MouthBand hears a kick, a snare and a hi-hat, then snaps them to the beat.
🎸 Hum → Bass: hum a low line and it becomes a punchy synth bass.
🎹 Hum or whistle → Melody: your tune comes back as a lead synth, gently auto-tuned into the right key.
✨ One tap → Chords: MouthBand finds the key of your melody and writes chords that fit.
🎬 Share: export a "what I recorded → what came out" video made for TikTok, Reels, Shorts and WhatsApp.

IT LEARNS YOUR MOUTH
Everyone beatboxes differently. A 20-second calibration teaches MouthBand your own kick, snare and hi-hat sounds, so it recognises them far more accurately.

MADE FOR PLAYING AROUND
• Fix anything: tap a drum hit to change it, drag a note to a new pitch.
• 4 drum kits: 808, Boom-Bap, Lo-fi and Techno.
• 4 instruments: bass, lead, keys and pad.
• Tempo 70–140 BPM, 2, 4 or 8-bar loops, swing, quantize strength, and a mixer with mute and solo.
• Save your songs and come back to them any time.

PRIVATE BY DESIGN
Your audio never leaves your device. All listening, analysis and sound-making happens on your phone. There is no account, no ads and no tracking.

FREE vs PRO
Free: unlimited loops, 2 drum kits, 3 saved songs, and videos with a small "Made with MouthBand" watermark.
Pro, $0.99 once with no subscription: no watermark, all 4 kits, WAV + MIDI export for your DAW, and unlimited saved songs.

Tip: wear headphones while recording so the speaker doesn't leak into the mic.

## Screenshot captions (5)

1. **Beatbox it. Get real drums.** Show the drum grid right after a beatbox take.
2. **Hum a tune. It comes back in key.** Show the lead piano roll with the key chip.
3. **One tap: ✨ chords that fit.** Show the chords card with chord names and the auto bass.
4. **It learns YOUR sounds.** Show the calibration screen with the confidence meter.
5. **Share the before → after.** Show the export sheet with the vertical video.

Suggested size: 1080×1920 portrait. Use a dark background and bold white caption text across the top third.

## In-app product and RevenueCat setup

1. In Play Console, go to **Monetize → Products → In-app products**. Create a product with ID **`mouthband_pro`**, named "MouthBand Pro", priced **$0.99**. It is a one-time, non-consumable purchase.
2. In RevenueCat, create a project and add the Android app (`com.mouthband.app`). Link the Play service credentials.
3. In RevenueCat, create entitlement **`pro`** and attach `mouthband_pro` to it.
4. In RevenueCat, create offering **`default`**. Add a **Lifetime** package containing `mouthband_pro`, then mark the offering Current.
5. Put the public Google SDK key (`goog_…`) in `.env.local` as `VITE_REVENUECAT_ANDROID_KEY`, then rebuild: `npm run android:sync`.

The app reads `customerInfo.entitlements.active.pro`. The "Restore purchase" button is in Settings and on the paywall.

## Privacy policy

*Effective 1 October 2026*

**MouthBand does not collect personal data. Audio never leaves your device.**

- **Microphone.** MouthBand uses the microphone only while you record a take or run the calibration. The recording is analysed on your device and stored on your device inside the app, together with your songs. It is never uploaded.
- **Your songs and settings** are stored locally in the app's own storage on your device. Uninstalling the app deletes them.
- **No accounts, no ads, no analytics, no tracking.** MouthBand makes no network requests except for purchases.
- **Purchases.** If you buy MouthBand Pro, the payment is handled by Google Play. MouthBand uses RevenueCat to confirm the purchase. RevenueCat receives the purchase receipt and a random anonymous app user ID. It does not receive any audio or songs. See RevenueCat's privacy policy at https://www.revenuecat.com/privacy.
- **Sharing.** Videos and audio files are only shared when you choose to share them, using your phone's share sheet.
- **Children.** MouthBand is suitable for everyone and does not knowingly collect data from anyone.
- **Contact.** Questions: *your-support-email@example.com* (replace before publishing).

## Data safety form (Play Console)

- Data collected: **None**. Audio is processed on the device only.
- Data shared: **None**. Purchase history goes to the payment processor, which is exempt under Play's "service provider" rules.
- Encryption in transit: yes (HTTPS for purchase verification).
- Data deletion: all data lives on the device and is deleted when the app is uninstalled.

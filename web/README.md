# HUMM marketing website

Four linked pages, using HUMM's paper/black/Stage Red palette and locally bundled Anton, Barlow, and Barlow Condensed fonts. Includes actual app screenshots, restrained phone depth movement, a musical waveform-to-notes reveal, screenshot transitions, a real three-track humming demo, and a playable full-width upside-down piano footer. One App Store action appears in the shared header. Mobile navigation uses an accessible Menu button.

## Run

From this folder:

```sh
npm run dev
```

Open http://localhost:5180. Microphone capture requires HTTPS on a hosted website or localhost during development. The website runs without a backend. Contact details stay blank.

```sh
npm run build
npm run preview
```

The production build is in `dist/`; preview is http://localhost:4180. Publish the contents of `dist/` to a static host with HTTPS. This work does not publish the website.

The source reuses Vite/TypeScript and audio modules from the parent app repository. Run `npm ci` at the repository root first, then run the website commands in `web/`. No new dependencies. The built `dist/` folder is standalone.

## Edit

- App Store URL and contact email: `src/site.ts`. Both are blank. Until the store URL is supplied, App Store buttons open an honest coming-soon message with a link to the working demo.
- Homepage and demo: `index.html`.
- Product details: `features.html`; selecting an explanation changes the real screenshot.
- Membership details: `plans.html`, including launch pricing, export rules, recording limits and FAQs.
- Workflow comparison: `why-humm.html`, with links to official competitor documentation. Prices and product claims should be reviewed before publishing.
- Existing palette and home layout: `src/style.css`. Added pages and responsive navigation: `src/pages.css`. Shared navigation, dialog, reveals and bounded scroll motion: `src/common.ts`.
- Screenshots: `public/screens/`. `hum-current.png` was captured from the connected iPhone 16 Pro on 6 October 2026; the other screens are the app's existing screenshots. Keep the same filenames to replace them later.
- Original concepts: `design/`. Current brief, generated section concepts, prompts and verification: `design/refresh/`. The refinement preserves the established HUMM identity, with motion/layout inspiration from the four supplied sites; Magic Receipt’s first hero was excluded.

## Try now

Tap the microphone, allow access, and hum different notes for at least ten seconds. Tap again to finish; twenty seconds is the maximum, with automatic stopping after quiet. The existing app processes the audio locally and creates exactly three parts: drums, bass, and melody. Pick sounds, mute parts, play/stop, or start over. No save, export, account, uploads, analytics, or network audio service. Recording and playback stop when the page becomes hidden. Refreshing discards the arrangement.

## Footer piano

Tap/click any key. When the footer is visible, A S D F G H J K play the natural notes and W E T Y U play the accidentals. Native Enter/Space activation works on focused keys. Octave controls change the range; mute silences the piano independently of the demo. On small screens fewer keys preserve usable touch sizes. Black keys attach to the bottom edge, as requested. Piano playback is paused during microphone recording/processing to avoid leaking into the take.

## Check

Run the preview first, then:

```sh
npm test
```

This dependency-free browser check uses installed Google Chrome and CDP. Set `CHROME_BIN` if Chrome is elsewhere. It tests all four pages, internal links, responsive layouts, mobile menu and Escape handling, screenshot tabs and product disclosures, dialog dismissal, live reduced motion, piano controls, microphone denial/cancellation, and a synthetic pitched recording through the real worklet/DSP/arrangement engine. This checks the recording pipeline; it is not a test of every person's voice or every phone browser. Screenshots and the result report go into a temporary directory. `HUMM_QA_URL` selects another server, and `HUMM_QA_OUTPUT` selects an output folder.

The Browser/IAB tool was unavailable in this session, so the installed Chrome browser was controlled directly through CDP. Visual inspection compares the retained concepts with browser screenshots at 1536×1024 and mobile sizes.

## Credits

Anton, Barlow, and Barlow Condensed: SIL Open Font License. Pitchy: MIT. FFT support from fft.js: MIT. Notices are included in `public/licenses/`. Existing HUMM source, brand assets, and screenshots belong to this project.

## Launch configuration

The app is not yet linked to a live App Store listing. Planned US monthly prices are Plus $1.99 and Pro $4.99; the website clearly labels these as planned. The three-month Pro trial is described as planned and eligibility-dependent. Set the actual store URL/contact email in `src/site.ts` and review the copy against the configured App Store products before publishing. No payment or signup is collected on the website.

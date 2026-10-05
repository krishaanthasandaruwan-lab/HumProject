# HUMM website verification

Reviewed 5 October 2026. The supplied MouthBand HTML and the current HUMM app established the design system and product claims. The website lives in `web/`; the native app was not modified.

## Evidence and method

The four built-in Imagegen concepts are [hero](hero-concept.png), [features](features-concept.png), [demo](demo-concept.png), and [footer](footer-concept.png). Each is 1536×1024. The [brief](BRIEF.md) records the prompt set, palette, layout, permitted copy, and source-driven differences.

Browser/IAB tools were unavailable. The installed Google Chrome browser was controlled directly with CDP instead, without adding a browser automation dependency. Production screenshots were captured with `Page.captureScreenshot`. Each section was captured at the concepts' native 1536×1024 dimensions. `view_image` was used on all four concepts and their latest section screenshots in the same review pass, plus mobile and full-page renders.

Final review images: [desktop page](rendered/page-desktop.png), [mobile page](rendered/page-mobile.png), [desktop hero](rendered/hero-desktop.png), [features](rendered/the-app-desktop.png), [ready demo](rendered/try-now-desktop.png), [generated song](rendered/demo-result-desktop.png), [footer](rendered/get-humm-desktop.png), [mobile hero](rendered/hero-mobile.png), [mobile demo](rendered/demo-mobile.png), and [mobile footer](rendered/footer-mobile.png). These are retained design-review deliverables; intermediate QA captures are not shipped in the public site.

## Fidelity ledger

| Comparison | Concept evidence | Render evidence | Resolution |
| --- | --- | --- | --- |
| Copy and navigation | Hero's HUMM, The app, Try now, Get HUMM, headline and two CTA labels | `hero-desktop.png`; automated hero-copy diff | Locked above-the-fold copy passes. Fixed a missing space at the mobile paragraph's line break. No invented hero eyebrow or extra navigation. |
| First viewport and layout | Open split hero, phones on the right, action buttons below copy | `hero-desktop.png`, `page-desktop.png` | Reduced phone widths to preserve their real aspect ratios and keep the first section clear. No overlapping next-section content remains. |
| Type hierarchy and controls | Condensed display type; readable body; strong labels and buttons | Hero, feature, demo and footer captures | Uses the app's exact local Anton, Barlow and Barlow Condensed faces. Imagegen's approximate letter shapes and sizes are intentionally replaced with the app fonts and responsive type sizes. Fixed red-highlight boxes overlapping adjacent lines. Control typography is explicit. |
| Palette and surface treatment | Paper hero/demo, black features, Stage Red footer | All four section captures | Exact source tokens: #F6F4EF, #111111, #F0443A, #FFFFFF, #5E5B57 and #D9D6CF. No gradients, tinted screenshots, extra accent colors or generic decorative cards. |
| Product assets and framing | Two hero phones, three feature phones, HUMM brand | Hero/features captures and `public/screens/` | Uses a fresh connected-iPhone capture and genuine existing app screens rather than generated UI approximations. Resampled the iPhone image by width to avoid a soft low-resolution preview. Phone screens retain their original aspect ratio. |
| Containers, spacing and borders | Open hero/feature band, one bordered white studio, square actions | `page-desktop.png`, demo and footer captures | Shared 2px outlines, hard offset shadows and consistent gutters. The feature band is taller than its concept to include every verified app feature and show uncropped real screens; this is a deliberate content requirement. |
| Icons and buttons | Simple outline controls and arrow/Apple CTA marks | Hero/demo/footer captures | Consistent scalable SVGs, stroke widths and aligned icon boxes. Native buttons and selects have focus states and usable touch targets. |
| Demo states and actual behavior | Mic, drums/bass/melody, sound selectors, play and reset | Ready and generated-song captures | Empty 0/3 rows remain empty until real audio is analyzed. The concept's illustrative notes are not fabricated results. Added mic cancellation and honest permission/error states as required for actual recording. No save/export control. |
| Feature coverage | Hum → build → share sequence | `page-desktop.png`, screenshot tabs | Actual features from the app source are present. Taste tab and compact capability rail cover additional current features. Planned live hum and song splitting are omitted. |
| Footer and keyboard | Red CTA, blank contact, full-width keyboard with black keys anchored below | Footer desktop/mobile captures | Keyboard fills the viewport and plays actual notes. Added octave and independent mute controls for usability. Smaller screens show fewer keys so touch targets stay usable. App Store URL and contact value remain blank. |
| Responsive behavior and motion | Shared section rhythm and restrained movement | Mobile captures; browser checks | Stacked mobile sections, readable line breaks, no horizontal overflow from 320px to 1536px. Reveals, phone arrivals, screenshot transitions, waveform, note progress and key feedback work. Reduced-motion preference removes movement. |

The implementation was faithfully verified against the locked design and app reference with the intentional differences above. No unplanned material visual mismatches remain. This is not a claim that generated font approximations and real app screenshots are pixel-identical.

## Functional results

TypeScript and the production Vite build pass. All **59 browser checks pass**, with no uncaught browser errors; see [the result report](rendered/results.json). Tested widths/heights: 320×568, 375×812, 393×852, 440×956, 768×1024, 1024×768, and 1536×1024.

The core flow was exercised through the actual audio engine: a synthesized pitched melody entered the real microphone worklet, was analyzed locally, and produced exactly three nonempty tracks. Playback advanced on the audio clock; sound changes, mute, stop, and reset worked. The microphone was released after recording, after denial, and after cancelling a delayed permission request. Nothing was saved. The full-width upside-down piano played through computer-keyboard input, released keys correctly, changed octaves, and toggled its independent mute state.

Remaining limits: Chrome's recording pipeline was tested with controlled pitched input, not every person's voice or every Safari/iPhone browser. A hosted deployment needs HTTPS for microphone access. App Store buttons show a coming-soon dialog until a real listing URL is added in `src/site.ts`; contact details are intentionally blank. The website has not been published.

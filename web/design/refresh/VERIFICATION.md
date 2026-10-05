# Website verification — 6 October 2026

Production build and TypeScript check passed. The final installed-Chrome run passed 102 checks with no uncaught browser errors. Browser/IAB was unavailable, so Chrome was controlled directly through CDP, without adding test dependencies.

## Checked

- All four production HTML pages load directly, their internal links resolve, and the current navigation item is marked.
- Home layouts: 320×568, 375×812, 393×852, 440×956, 768×1024, 1024×768, 1536×1024. Additional pages: 320, 393, 768, 1024 and 1536px widths. No horizontal page overflow or clipped headings/controls. Wide comparison tables deliberately scroll within their own labeled regions.
- Mobile menu opens, announces its state, closes with Escape and returns focus. Product disclosures change real screenshots. FAQ answers expand. Store dialog dismisses with Escape.
- One App Store action per page. A live listing has not been supplied; the button opens the existing coming-soon message. No invented contact address or purchase endpoint.
- Motion follows reduced-motion changes live. Phone scrolling displacement is bounded to 12px and disabled on small screens. Reveals and state transitions are brief; no looping decorative animation or scroll trapping.
- Synthetic pitched audio passed through the actual microphone worklet, DSP and arrangement engine to create three nonempty tracks. Permission denial, late permission cancellation, microphone cleanup, playback clock, sound selection, muting, stopping and reset passed.
- Piano keyboard input, key release, octave changes, mute and full-width layout passed. The demo offers no saving/exporting and does not persist recordings.

## Visual comparison

Used view_image to inspect all four generated section concepts and the final Chrome screenshots in the same review pass. Desktop captures were 1536×1024, the concepts' native dimensions; mobile captures were 393×852. Original home composition and current user instructions take precedence over generated styling variations.

| Comparison point | Evidence and outcome |
|---|---|
| Brand palette | Exact existing paper, ink and Stage Red CSS tokens retained. Black text on red highlights preserves the app identity and contrast; generated white/red text variations were intentionally rejected. |
| Typography | Existing bundled Anton, Barlow and Barlow Condensed retained for headlines, body and controls. Type scales follow the original site's hierarchy rather than imitating imperfect generated letterforms. |
| Composition | Existing split hero, dark phone band, microphone demo and piano footer retained. New benefits use a waveform-to-notes illustration and three open columns. Product page uses two phones beside native disclosures. |
| Screenshots | Generated phone UI was intentionally replaced with genuine project screenshots. A fresh iPhone 16 Pro Home screenshot was captured on 6 October. No generated concept image is served as a product asset. |
| Copy | Automated above-the-fold copy check passes the updated brief: three page links, one App Store action and one Try now hero action. Extra duplicate download actions removed as requested. |
| Spacing and containers | Open layouts, understated rules and existing phone frames maintained. Pricing uses restrained open columns and simple bullets in place of the concept's extra decorative icons. |
| Mobile | Fixed joined words caused by hidden desktop line breaks. Confirmed readable stacking, working navigation and clear hints for horizontally scrolling tables. |
| Interaction | Real screenshot transitions and musical reveals match the brief. Reduced-motion states, piano and microphone flow remain functional. |

The implementation was visually verified against the concept set with the recorded adjustments that preserve HUMM's established theme and the user's request for restraint. No material unresolved layout defects were found in the checked Chrome views. This is not a claim of pixel identity to generated images or testing every browser/device.

Concept files: benefits-concept.png, features-concept.png, plans-concept.png, comparison-concept.png. Built-in Image Gen produced the concepts; PROMPTS.md records the prompt set. No further image generation was performed after the user asked to stop. Temporary QA captures and browser profiles were removed after inspection; the runnable checks remain in tests/qa.mjs.

## Release details still supplied by the owner

Set the real App Store URL and support email in src/site.ts. Review planned $1.99/$4.99 US monthly pricing and the eligibility-dependent three-month Pro trial against the eventual store configuration before publishing. The site labels these as planned. The comparison cites official Voice Memos, GarageBand and Suno pages and describes starting workflows, not a universal ranking.

The website build is in web/dist. No app source changes, new dependencies, deployment or Git push were made for this task. A pre-change website backup remains outside the project at /private/tmp/humm-web-refresh-2026-10-06/baseline.

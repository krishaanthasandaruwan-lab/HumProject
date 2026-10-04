# Working on HUMM

Read `docs/HISTORY.md` first (what was built and decided, what's open), then `docs/ARCHITECTURE.md`.

- Node 22.12+ (on the dev Mac: `export PATH="$HOME/.local/node/bin:$PATH"`). Check with
  `npm run typecheck`, `npm test`, `npm run build`; iOS with `npm run ios:sync`.
- No server and no network calls (except store purchases). DSP stays pure and unit-tested.
- Keep the existing look (paper / ink / Stage Red, Anton + Barlow). Files under ~300 lines.
- Free vs Pro rules live in `src/pro/exports.ts`; change them only when the owner asks.
- Before a change that affects other features, explain it and wait for the owner's approval.

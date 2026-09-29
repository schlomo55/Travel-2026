# Run 4 — dark only + hardening (Track A; brief of 2026-09-28)

Base: branch `horizon` at afdcce5 (Runs 1–3c committed). Read PROGRESS.md (all runs, accepted deviations), FEATURES.md,
the plan `C:\Users\schlo\.claude\plans\horizon-build-2026-09.md` §0 (rules) + Run 4.

**A parallel track is running.** The Map tab (Run 5) is being built by another builder in a SEPARATE worktree,
`C:\Source\China-map` (branch `horizon-map`) — never read from or write to that folder. Both branches will be merged
later, so keep this run's diff FOCUSED: no new tabs, no change to the route table in `logic/routes.ts` /
`router.svelte.ts` beyond what an item below needs, no re-ordering or re-organising of `i18n/strings.ts` (add keys,
delete dead ones, don't move sections), no file renames/moves, no mass reformatting.

## 4a Remove the light theme (owner: "we dont need Daylight" … "remove it")
The app becomes dark only. Delete the `[data-theme='light']` token block and every light-only rule (app.css + the
components that carry `:global([data-theme='light'])` rules: NavBar, DayView, NowHome, Pass, PocketHome, WalletCards,
Sheet, TripMap…), the Settings theme control, the light branch of `logic/theme.ts` and the `index.html` boot script (no
attribute, no stored theme needed; keep the `theme-color` meta = the dark sky). A stored `theme: 'light'` from an old
install is simply ignored (dark). `check-contrast.mjs` → ONE palette. The design system is already dark only: replace
`docs/design/horizon/system/tokens.json` (+ README.md) with the dark-only v4 files from
`C:\Users\schlo\AppData\Local\Temp\claude\C--Source-China\e650bdf9-53e7-4193-ba8a-b5dee11d0d3c\scratchpad\ds2\project\`
(read-only source) and make the contrast gate match it. Rehearsal: drop the light checks, add one proving a stored
'light' setting still renders dark. Update `theme.test.ts`. Report the CSS KB saved. The `-light` boards are history.

## 4b Hardening
- **a11y floor, every screen:** each control has an accessible name; a visible focus ring; touch targets ≥ 44 px;
  headings in order; nothing conveyed by colour alone; Calm motion / reduced motion / Route animations off honoured
  everywhere (no smooth scroll, no loops). Check at 412 AND 384 px (the S23's real CSS width).
- **Performance (S23 proxy: headless Chrome, 4× CPU throttle):** measure cold start (script eval, first paint of Now)
  and Journey's Play; animations pause when the app is hidden (`visibilitychange`) or off-screen; no long task > 200 ms
  after first paint that can be avoided. Report before/after numbers.
- **Back-button layers:** every sheet/overlay uses `router.pushLayer()`; Android back closes the top layer first.
  **Add unit tests for the router** (history index stamping, `backOr`, `backPast`, the veto path) — Run 3c left them
  covered only by the rehearsal.
- **Native build:** no service worker on Capacitor (keep that branch intact). Android splash: if it is still
  `#000000`, set it to the Horizon sky `#0B0C16` (only if it is a colour-resource change; report).

## 4c Rehearsal + docs
- Rehearsal ≥ today's 147 checks (minus the light ones), plus checks for the new a11y/perf guarantees you add.
- `docs/design/HORIZON.md` — the implementer's reference (tokens, components, motion roles FLOW/COMET/INK/RELAY,
  "white = for other eyes", IA, lazy screens, the two-number bundle rule); update `docs/ARCHITECTURE.md`; remove
  "Daylight" from FEATURES.md/docs where it describes the current app.

## Rules (same as every run)
GIT: read-only git only (status/diff/log/show) in `C:\Source\China-horizon`; NEVER a git command that changes anything;
restore dist/ by rebuilding. Work ONLY inside `C:\Source\China-horizon`. No adb, no Gradle/APK builds. Zero new runtime
network. No trip data in the bundle. Never write the owner's name or any passport number; never read `~/.ltd-private/*`.
Don't touch `sources/`, `seed/`, `legacy/`, `app/scripts/china/`, `app/scripts/privacy/`, `app/scripts/check-dist-clean.ts`.
Gates green with real numbers: `npm run check`, `npm test`, `npm run build` (contrast · check:dist · bundle: start-up
≤ 200 KB gz, all app JS ≤ 260 KB gz), `npm run verify:china`, `REHEARSAL_PORT=4177 npm run rehearsal` (rebuild dist
first). Update PROGRESS.md ("Run 4": each item → change (file:line), tests, numbers). Stop cleanly at a part boundary if
context runs low.

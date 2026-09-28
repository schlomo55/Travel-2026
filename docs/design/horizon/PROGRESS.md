# Horizon build — progress

Plan: `horizon-build-2026-09.md` (§3). Worktree `C:\Source\China-horizon`, branch `horizon`.
Nothing is committed by the builder; the main session commits with the owner's OK.

## Run 1 — Foundation, shell, Pocket, Find, Trips, Settings · DONE (2026-09-28)

Every part landed and every gate is green on the final build. No rehearsal
check is skipped.

| Part | What was built |
|---|---|
| 1a Tokens | `src/app.css` rewritten from `system/tokens.json`: night sky default, Daylight under `[data-theme='light']`, both palettes of all 47 colour tokens, composites (opal, horizon line, route gradient, sky glow, scenes), type scale, spacing, radius, shadow, motion. A marked LEGACY BRIDGE re-points the Lantern token names so bridged screens re-skin. `theme.ts` (THEME_COLOR = each theme's sky), the `index.html` boot script, the manifest and `theme.test.ts` moved together. |
| 1b Fonts | `src/horizon-fonts.css`: Unbounded, Figtree (normal + italic), Martian Mono (weight + width axes), latin woff2 only, precached. 4 files, 130.48 kB, replacing 30 files / 540.86 kB. |
| 1c Gates | `scripts/check-contrast.mjs` rewritten: tokens.json drift check (with the one documented override), `var()` resolution, both palettes, derived grounds, identity hues, dangling-`var()` check. New `scripts/check-bundle.mjs` (200 KB gz JS budget, prints the table), chained into `npm run build`. |
| 1d Shell | `logic/routes.ts` (pure grammar + the alias table for every old tab id and sub-path, 23 tests), router rewritten on it (canonical rewrite, `backOr`, `goPocket`, anchors); NavBar (Now · Journey · Pocket + Find), app bar, sub-header; TripShell switching places; Now bridge (The day / To do) and Journey bridge (overview + every stop). Motion classes (`logic/motion.ts`, 5 tests). |
| 1e Pocket | Pocket home (today's code first, driver chips, wallet tickets, money, visa, emergency, documents, phrases, converter, health, good to know, clocks, notes, packing), the pass (real code in fours, copy, Counter mode, find email, manage, maps, booking link, stations or the reason there are none), Counter mode (full screen, white, wake lock), the white driver card, Travel / Stays / Experiences lists, Cards, Money (budget tiles as filters, committed ledger, log, rates, by day, detail, burn, CSV), Documents, Visa, Emergency, Driver list + "Maps in China", Phrases, Converter, Health, Good to know, Notes, Clocks, edit sheets. `logic/pass.ts` (22 tests), `logic/pocket.ts` (10 tests). |
| 1f Find | `logic/find.ts` (normalised AND-token index over bookings, driver/phrase cards, runbook steps, stops, spots, tasks, info cards, emergency, wallet cards, documents, the note; warnings first with the "instead" from exact joins; 21 tests incl. the real seed) and the Find screen. |
| 1g Trips + Settings | Trips shelf (the trip as a constellation from real coordinates — `logic/constellation.ts`, 6 tests — else cover photo, else ridges; Day X of Y, tonight, days to go; doors; backup card; across every trip; menu with export-first two-tap delete), wizard, import sheet, Backup screen, Drive card, Settings (Appearance with Route animations, Weather with the last-fetch diagnostic, Backup, This trip, Preview a date, Storage, About). |
| 1h Rehearsal | `scripts/e2e/rehearsal.mjs` migrated: seed read from this worktree; refuses a server serving another build; every check re-pointed at the new places; wallet/booking checks walk each booking's pass; every data-fact assertion kept; new checks for the alias table, the stats landing, the nav, the driver card and Counter mode layers, today's code, Find's warning, the shelf constellation, the Route animations switch, the Pocket's offline chip. 113/113. |
| Docs | `FEATURES.md` (every Lantern feature → its Horizon home → its run), this file, targeted `ARCHITECTURE.md` updates (fonts, design system, shell, budget). |

### Gates at the end of Run 1

| Gate | Result |
|---|---|
| `npm run check` | 559 files, 0 errors, 0 warnings (+ scripts `tsc`) |
| `npm test` | 538 passed in 31 files (was 450 in 25) |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, 101 pairs × 2 palettes, 0 failures · vite build · check:dist 14 files, 14 patterns, no personal data · bundle **198.12 kB gz** (193.48 KiB), 1.88 kB under 200 |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `npm run rehearsal` | **113/113** with the network hard off |

## Next — Run 2 (Map engine + Now)

2a map engine in `src/lib/map/` (build on `logic/constellation.ts`: same projection, add legs by
state, labels + the Yunnan-cluster rule, city scale) · 2b motion components on the classes in
`logic/motion.ts` · 2c Now home · 2d travel day, ordinary day, To do · 2e rehearsal for Now.
Replace `routes/Now.svelte`'s bridge (Today + Tasks) and **delete** the Lantern code it replaces.

## Known issues (carried forward)

1. **Bundle headroom is 1.88 kB.** The Lantern screens Runs 2–3 replace (Today ~1.2k lines,
   Tasks, Itinerary, StopDetail, RouteMap) ship beside the new code. Each run must delete what it
   replaces; route-level splitting is the fallback (ARCHITECTURE.md §11 explains why it was
   avoided so far).
2. Bridged screens keep Lantern details until their run: emoji in Today (⚡ offline chip, 🛂),
   the guide's paper furniture (typewriter/script faces are gone; chapter titles are now the
   display face), Itinerary's `.cs-booked` and photo-band chips in Daylight (pre-existing
   contrast debt, Run 3).
3. The latin subsets do not carry → (U+2192), ≈ (U+2248) or ₪ (U+20AA); they fall back to the
   system face, cleanly.
4. The Android splash/icon background is still `#000000` (`npm run android:assets`); the web
   manifest and theme colour are the Horizon sky. Regenerate the native assets when the APK is
   next built for review (no Gradle/APK builds in Run 1).
5. Weather: the plan says "≤2/day"; the code refreshes a forecast once it is six hours old
   (`logic/weather.ts` STALE_AFTER_MS), so Settings says "at most every six hours". Behaviour
   unchanged — flagged for the main session.
6. The shelf constellation labels the first, tonight's and the last stop without collision
   avoidance; Run 2's label rules (the Yunnan cluster) should replace this.
7. `Settings.activeTripId` is only written at create/import (pre-existing); Settings' "This trip"
   therefore prefers the trip on the road today.

## Deviations from the boards (with reasons)

- `--ok-ink` in Daylight is `#186a42`, not the tokens.json value, which failed 4.5:1 on Daylight
  cards (documented override in `check-contrast.mjs`); Daylight chrome (nav, Find field, inputs)
  uses the card colour, as the Daylight boards draw it.
- Board sizes off the type scale are mapped onto it: 19 px → 18 (card title), 32 px → 34 (city
  title), sub-header titles 18 px (Unbounded's floor) where the pass board draws 16.
- Visa lives in the Pocket (the boards' tile and status pill go there), not in Journey as the
  plan text says; Journey keeps route, coverage and statistics.
- The Pocket home carries tiles the board does not draw (the wide Money tile, Health, Good to
  know, Clocks, Notes) so every Lantern feature keeps a home; it also shows a quiet offline chip
  (Info had one). Packing opens To do › Packing on Now.
- The shelf's "Start a new trip" door opens the in-app wizard, so its hint says what the wizard
  does rather than the board's "Fill the trip brief — Claude builds it"; the brief route is named
  inside the wizard. Trips with fewer than two located stops show the cover photo or ridges.
- Settings: the board's Drive "Set up" button is a link to the Backup screen labelled How /
  Set up / Open by state (nothing may pretend to connect); the weather line states the real
  six-hour cadence; Preview a date, Storage and the version stay (existing features).
- Header stars on the shelf are still (the motion rules allow only routes, the you-are-here
  pulse, the sun and the opal edge to move).

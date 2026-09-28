# Horizon build — progress

Plan: `horizon-build-2026-09.md` (§3). Worktree `C:\Source\China-horizon`, branch `horizon`.
Nothing is committed by the builder; the main session commits with the owner's OK.

## Run 2 — Map engine + Now · DONE (2026-09-28)

Every part landed and every gate is green on the final build. No rehearsal check is skipped.

| Part | What was built |
|---|---|
| 2a Map engine | `logic/projection.ts` — real coordinates, north up, one scale for both axes, fit to a box (with deeper top/bottom margins for a header or a legend), a minimum span so a city is never blown up, and a grid whose labels are real latitudes (9 tests). `logic/constellation.ts` rewritten on it — stars done / here / ahead, legs done / today / ahead and **not booked** (from the caller's coverage), YOU (the start of today's leg until the day's line says you arrived, else tonight's stop), TONIGHT, the one **live** leg (today's, else the next), each leg's arc, midpoint and calm arrowhead, and **labels with collision avoidance and the Yunnan-cluster rule** (stars closer than 26 px share one label in trip order, a long name keeps its last word: "LIJIANG · GORGE · DALI"; you and tonight are never folded into it, but when the two are too close to name apart they share one label — "LIJIANG · YOU / GORGE · TONIGHT" on Dec 18; Tel Aviv at both ends of a trip is named once), and `chipSpot()` for today's leg chip: beside the leg's midpoint, right of it as the board draws it, else the nearest place within 60 px that covers no name and no star, else no chip (27 tests, incl. the real China and Israel seeds, and every day of the China trip on all four maps the app draws: no two labels overlap, none leaves its box). `logic/citymap.ts` — the city-scale API for Run 3: pins only from stored coordinates (a place belongs to the nearest stop within 80 km), everything unlocated in a **"No pin yet"** list, a card and a ticket at one coordinate merged into one pin, straight-line km from the centre, and the ways out as **bearings to the real neighbouring stops** (Zhangjiajie West has no coordinate — its train points at Chongqing, which has) (9 tests). `lib/map/TripMap.svelte` draws it for Now, the shelf and Journey. |
| 2b Motion | `src/lib/motion/`: **Flow** (`FlowPath.svelte`: dashes 7 7 on the live leg, the only loop; its still state is a solid leg with an arrowhead), **Ink** (`ink.ts` + `.ink`/`.bloom` CSS: the road so far paints itself once, one brush at one speed — `inkPace` — and stars bloom as it reaches them; remembered per trip · day · legs done in `localStorage['ltd:ink']`, so a second open of the same day is already painted and arriving inks again; a tap skips it; a runbook segment finished with Done inks once), **Comet** (`Comet.svelte`: head + tail + arrival flash, once; on Now a tap on the map flies the live leg; one one-shot at a time — a Comet ends Ink), **Relay** (`relay.ts` action + `relayPlan()` clock + `.relay`/`.relay-leg` CSS: lights in order, pauses on amber and longer on red, ends on a count — built for Journey, Run 3 wires it). Calm motion, reduce-motion and Route animations off give every motion its end state; `html.app-hidden` pauses all of it. Pure clocks in `logic/motion.ts` (`inkDue`, `inkKey`, `inkPace`, `relayPlan`; 8 tests). |
| 2c Now home | `routes/Now.svelte` decides the day once (runbook, ticks, the line, tonight, the next commitment, the to-do plan, the weather) and routes home / day / To do; `lib/components/now/NowHome.svelte` (f-now): the constellation with the road so far inked, today's leg Flowing with its booking on a chip (→ the day; the chip never covers a name), the you-are-here ping, tonight's star (→ the city); Now's header (the date, "Day 21 of 37 · 13:02", the weather, the visa pill); the **Concierge** sentence (`logic/concierge.ts`, 12 tests — the board's own "Next: the train to Qinghe — not booked yet. Be in Qinghe by about 14:30." at step 2); the tiles **NEXT** (the one opal card, the sun on its arc — real time only, `logic/glance.ts`, 7 tests — the countdown, the route, the status → the pass) · **TONIGHT** (photo, bed, status → the city; the words sit on a scrim the contrast gate measures against a white photo) · **VISA** (ring, exit date, entry day) · **DRIVER CARD** (the card for where the current step goes, else the first of today's places that has one, else no tile → the white card, a layer) · **TO DO** (the first open thing, how many earlier are still open). No NOW tile. Snow over the map when the forecast says snow; the offline chip on the sheet. |
| 2d Day + To do | `logic/metroline.ts` (27 tests): the travel day **generated from its bookings** — last night's bed → every end of every leg (a leg that lands from yesterday joins where it lands; one place is one station) → tonight's bed (or a bed nobody booked, or a night aboard); flights as arcs; the gap two legs leave is a dashed **transfer** that points at **"see step N"**; the runbook joined by exact words (flight number, the leg's own label, both ends; a transfer takes the step between its neighbours that names most of its ends); a time lifted only where a step ties it to the place ("into Qinghe by ~14:30", "be at PKX by ~16:45", "Pullman ≈21:30", "check out of Element by 12:00"); where you are from ticks, the real clock (real today only) and "anything after it is done"; the rows and the Focus card as view-models. `DayView.svelte` (f-travelday + f-day): header, the ‹ date · Day X of Y › stepper (the centre opens the long-jump sheet; a swipe steps; all drive `?d=`), the weather chip; a travel day = the runbook's progress bar, the metro line, ONE **Focus** card pinned above the nav (its driver card + **Done**, a write via `data/checks.ts`) and every step tickable by its text; any other day = the day line with the free blocks and the stop's own options (+ / in the day; `timeline.ts`, `options.ts`, `picks.ts`), the rain / too-tired row, "All N options", Anytime, your picks; then Places today, tonight's bed (four states), and the to-dos on this day. `logic/todo.ts` (9 tests) + `Todo.svelte` (f-todo): to-dos, alarms and the bookings still to buy **folded into days**, everything past in **Earlier**, "N coming up", ticks as writes, the .ics export, edit sheets; `Lists.svelte`: Packing and Checklists with the **sun arc** as progress, templates. |
| 2e Rehearsal | `scripts/e2e/rehearsal.mjs` migrated: every Now fact re-pointed at the screen that now holds it (the day's runbook, plan, places and bed at `now/day`; the tiles at `now`); every data-fact assertion kept (the only assertions changed are UI shape — the "＋" glyph became an icon button with a name, "ACTION LIST" and the Lantern FAB are gone, the visa number is the tile's 18 px ring, the booking reference moved from the hero to the pass the NEXT tile opens, where it is still asserted as a 16-digit copyable button). New: Now's map, sentence and tiles on Dec 11; the driver tile as a layer; the travel day's line from the bookings; Done as a write that moves you and the board's own sentence at step 2, undone from the list; Ink once a day; Comet on a tap; Route animations off stills Flow but not the pulse; To do folded into days with a tick both ways; the Journey's rings on the new map. The driver tile is today's or none (Dec 6 Sanlitun, no tile on Dec 13). The type ladder and the a11y sweeps cover the day and To do. **125/125 with the network hard off** (Run 1 ended at 113). |
| Docs | `FEATURES.md` (every Now feature → its Horizon home, Built), this file, `ARCHITECTURE.md` (budget, minifier). |

### What was deleted (Run 2 replaces it)

`routes/Today.svelte` (1,866 lines), `routes/Tasks.svelte` (730), the Now bridge (`routes/Now.svelte`,
rewritten), `components/ui/ProgressRing.svelte` (→ the sun arc), `components/horizon/ShelfMap.svelte` (→
`lib/map/TripMap.svelte`), `components/RouteMap.svelte` + `logic/routemap.ts` (the Lantern route
diagram on Journey → the constellation with Relay's rings; its 15 geometry tests in `stats.test.ts`
retired with it), and the strings nobody reads any more (`nowbridge`, most of `today`/`lists`, the
empty states for tasks, alarms and templates, the emoji in "Places today", "Night in transit",
"In the day" and "Template saved").

### Gates at the end of Run 2

| Gate | Result |
|---|---|
| `npm run check` | 575 files, 0 errors, 0 warnings (+ scripts `tsc`) |
| `npm test` | **623 passed in 37 files** (Run 1: 538 in 31; +100 new, −15 retired with `routemap.ts`) |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, 112 pairs × 2 palettes, 0 failures · vite build (terser) · check:dist 32 files, 14 patterns, no personal data · bundle **192.66 KB gz, 7.34 KB under 200** |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `npm run rehearsal` | **125/125** with the network hard off (on the final build) |

### The bundle

`npm run check:bundle` on the final build (KB, decimal, as Vite prints them):

| File | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` (the app) | 600.64 | **185.88** |
| `assets/web-*.js` (Capacitor, lazy) | 8.74 | 2.90 |
| `assets/workbox-window.prod.es5-*.js` | 5.67 | 2.27 |
| `assets/index-*.js` (Capacitor, lazy) | 1.33 | 0.70 |
| `assets/web-*.js` | 0.38 | 0.26 |
| `assets/index-*.js` | 0.36 | 0.24 |
| `assets/index-*.js` | 0.34 | 0.23 |
| `assets/web-*.js` | 0.19 | 0.17 |
| **Total · 8 files** | 617.64 | **192.66** of 200.00 |

Not counted (the service worker runs off the main thread): `sw.js` 1.11, `workbox-*.js` 5.17.
CSS 181.06 raw / 30.48 gz (Run 1: 29.34). Fonts 130.48 KB on disk (unchanged).
Run 1 ended at 198.12 (app chunk 191.18) with esbuild.

**The build now minifies with terser, not esbuild** (`vite.config.ts`). The gate is unchanged —
200 KB of gzipped JavaScript the page loads, measured the same way — but on this codebase terser's
output gzips about 8 % smaller: the final Run 2 code, built once more with `--minify esbuild` into a
scratch folder and measured the gate's way, is **209.43 KB — 9.43 KB over**; with terser (two
compress passes, nothing unsafe) the same code is **192.66 KB**. terser is not a new dependency and `package.json` / `package-lock.json` are
untouched: terser 5.49.0 is already locked at `node_modules/terser` (pulled in by
`@rollup/plugin-terser`, which workbox-build uses; vite lists it as its optional minifier). If the
main session wants that independent of workbox, declaring it as a devDependency is the one-line
follow-up. The main session should know this was the lever: the deletions alone were not enough.

## Next — Run 3 (Journey + City)

3a Journey: Replay on the constellation (`lib/map/TripMap.svelte` + `logic/constellation.ts`; the
Comet is ready for the playhead), the visa bar (`counters.ts`), and the stop list with the **Relay**
sweep (`lib/motion/relay.ts` + `relayPlan()` + `.relay` CSS; the map's rings are already its end
state). 3b City: `logic/citymap.ts` is the API (pins, "No pin yet", exits as bearings), plus the
guide as a long read. Delete Itinerary, StopDetail and JourneyOverview as they are replaced.

## Known issues (carried forward)

1. **Bundle headroom is 7.34 kB** with terser (see above). Run 3 replaces Itinerary, StopDetail and
   JourneyOverview — delete them as the new screens land.
2. Bridged screens keep Lantern details until their run: the guide's paper furniture, Itinerary's
   `.cs-booked` and photo-band chips in Daylight (pre-existing contrast debt, Run 3).
3. The latin subsets do not carry → (U+2192), ≈ (U+2248) or ₪ (U+20AA); they fall back to the
   system face, cleanly.
4. The Android splash/icon background is still `#000000` (`npm run android:assets`); regenerate
   the native assets when the APK is next built for review.
5. Weather: the plan says "≤2/day"; the code refreshes a forecast once it is six hours old
   (`logic/weather.ts` STALE_AFTER_MS), so Settings says "at most every six hours". Unchanged.
6. `Settings.activeTripId` is only written at create/import (pre-existing).
7. The map's latitude labels give way to a stop's name on the same line and are not written under
   Now's header or the sheet's lip (on China's Dec 11 map 40°N gives way to CHONGLI · YOU, and the
   CA 8609 chip sits over 35°N — a grid label, not a name). Today's leg chip gives way where the
   names crowd: on the China trip it shows on Dec 11, 14, 16 and 21 and not on Dec 5, 9 (the
   Beijing corner) or 18–20 (Yunnan); the leg still Flows, and the sentence and the NEXT tile say
   it. A chip with a leader line to a free corner would bring it back; that is a design call.
8. Task and alarm titles that carry emoji in the trip file (⏰, 🛂…) print them as written — data,
   not interface.
9. A travel day's runbook steps are not in time order in the trip file (Dec 11 lists "eat at PKX"
   after the flight); "where you are" therefore uses ticks, the real clock and "anything after it
   is done", and the Focus card follows the first step not ticked.

## Deviations from the boards (with reasons)

**Run 2**

- **f-now**: no "Edit tiles" button — nothing in the app can rearrange tiles, and a control that
  pretends is worse than none. The header carries the sun mark (the only way back to all trips) and
  the weather; the date/day line shows the clock only on the real today.
- **f-now**: the NEXT countdown reads "5h 13m" as drawn; on a previewed day it counts from that day's
  00:00 and the sun waits at the start of its arc (no progress is claimed the clock has not made).
  The TONIGHT tile shows the bed and its status, not the board's "≈21:30" (that time lives on the
  day, lifted from the runbook). The DRIVER CARD tile shows the card for where the current step
  goes (太子城站 at the start of Dec 11, asserted by the rehearsal), else the first of today's
  places that has a card — the board's moment (北京大兴国际机场) is later in the day. A day whose
  places name no card (Dec 12, 13, 17, 20, 22–25) draws no driver tile rather than the trip's
  first card; every card stays one tap away in Pocket › Show the driver.
- **f-now**: the TONIGHT tile's scrim is not the board's gradient. The board's (18 % at a third of
  the way down, 35 % past half) left a three-line bed name on as little as 26 % night sky — about
  1.6:1 on a bright photo. It now keeps ≥ 62 % under the words and ≥ 80 % under the status, with
  the photo clear in the band between; `check-contrast.mjs` gates both over a white photo.
- **f-now**: today's leg chip sits right of the leg's midpoint as drawn only where that covers no
  name; otherwise it moves to the nearest free place within 60 px, or is not drawn (see Known
  issue 7). When YOU and TONIGHT are too close to name apart they share one two-line label.
- **f-travelday**: the stepper ‹ date · Day X of Y › (with the long jump) is the same on both day
  kinds, replacing the board's single "Sat 12 ›" link; the header's visa pill is left to Now and the
  Pocket. Each leg has its own row on the line (label, status, clocks — one tap to its pass) rather
  than the board's inline "HSR to Qinghe · ~1 h" under the station. A transfer says "Transfer · see
  step N" (+ verify) — the board's "Metro or taxi ~1.5 h" is in no booking; the step it points to
  says how. The status word is the app's own ("Pending", not "Not booked"). The full runbook list
  sits under the line (every step must stay visible and tickable).
- **f-day**: the board's Dinner and Sunset rows are not a data shape — the day line draws the plan's
  own lines (timed ones as stations, the rest under Anytime), the free blocks and your picks.
- **f-todo**: alarms tick (they are "in the phone calendar" once ticked, as in Lantern) and the .ics
  export stays; the Packing card links to To do › Packing (Run 1 placed packing there) and says
  "N items · M packed" rather than "lives in Pocket"; a Checklists card sits beside it.
- **Journey**: its route diagram is now the constellation with Relay's end-state rings (brought
  forward from Run 3 so the Lantern RouteMap could be deleted; the rows and Replay stay Run 3).
- Sizes on the type ladder: the travel day's title and the driver tile's Chinese are 20 px
  (`--fs-code-lg`) where the boards draw 21 — the scale has no 21.

**Run 1**

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

## Run 1 — Foundation, shell, Pocket, Find, Trips, Settings · DONE (2026-09-28)

| Part | What was built |
|---|---|
| 1a Tokens | `src/app.css` rewritten from `system/tokens.json`: night sky default, Daylight under `[data-theme='light']`, both palettes of all 47 colour tokens, composites (opal, horizon line, route gradient, sky glow, scenes), type scale, spacing, radius, shadow, motion. A marked LEGACY BRIDGE re-points the Lantern token names so bridged screens re-skin. `theme.ts` (THEME_COLOR = each theme's sky), the `index.html` boot script, the manifest and `theme.test.ts` moved together. |
| 1b Fonts | `src/horizon-fonts.css`: Unbounded, Figtree (normal + italic), Martian Mono (weight + width axes), latin woff2 only, precached. 4 files, 130.48 kB, replacing 30 files / 540.86 kB. |
| 1c Gates | `scripts/check-contrast.mjs` rewritten: tokens.json drift check (with the one documented override), `var()` resolution, both palettes, derived grounds, identity hues, dangling-`var()` check. New `scripts/check-bundle.mjs` (200 KB gz JS budget, prints the table), chained into `npm run build`. |
| 1d Shell | `logic/routes.ts` (pure grammar + the alias table for every old tab id and sub-path, 23 tests), router rewritten on it (canonical rewrite, `backOr`, `goPocket`, anchors); NavBar (Now · Journey · Pocket + Find), app bar, sub-header; TripShell switching places; Now bridge (The day / To do) and Journey bridge (overview + every stop). Motion classes (`logic/motion.ts`, 5 tests). |
| 1e Pocket | Pocket home, the pass, Counter mode, the white driver card, Travel / Stays / Experiences lists, Cards, Money, Documents, Visa, Emergency, Driver list + "Maps in China", Phrases, Converter, Health, Good to know, Notes, Clocks, edit sheets. `logic/pass.ts` (22 tests), `logic/pocket.ts` (10 tests). |
| 1f Find | `logic/find.ts` (21 tests incl. the real seed) and the Find screen. |
| 1g Trips + Settings | Trips shelf, wizard, import sheet, Backup screen, Drive card, Settings (with Route animations). |
| 1h Rehearsal | `scripts/e2e/rehearsal.mjs` migrated for the shell, Pocket, Find, Trips and Settings. 113/113. |

Gates at the end of Run 1: `check` 559 files / 0 errors · `test` 538 in 31 files · build: contrast
101 pairs × 2 palettes / 0 failures, check:dist clean, bundle **198.12 kB gz** (esbuild), 1.88 kB
under 200 · `verify:china` 121 critical values + 84 structural facts · `rehearsal` 113/113.

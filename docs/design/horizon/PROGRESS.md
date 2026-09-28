# Horizon build — progress

Plan: `horizon-build-2026-09.md` (§3). Worktree `C:\Source\China-horizon`, branch `horizon`.
Nothing is committed by the builder; the main session commits with the owner's OK.

## Run 3c — the code review's fixes + the bundle restructure (FIX-3C.md) · DONE (2026-09-28)

Part A first (the planner's decision), then the 22 findings of the Opus review of Runs 3 + 3b in
the review's order — every one fixed; none needed a change to an approved screen design. Pure logic
moved into `src/lib/logic` with vitest tests; every HIGH and MEDIUM fix and the four walks item 22
names have a rehearsal check. Verified in the built app at 412 px **and 384 px (the S23)** wherever a
layout changed — which found a few more defects of the same kinds (below). No trip fact was invented;
seed, sources, legacy and the china/privacy scripts were not touched.

### A. The bundle restructure — what starts the app, and what everything weighs

**The rule** (`scripts/check-bundle.mjs`, rewritten; the header explains it): two numbers, two budgets,
both printed as tables on every build.

1. **Initial load ≤ 200 KB gzipped** — the JavaScript a cold start must load and parse before the
   first screen draws: the **entry chunk plus every chunk it imports statically**, transitively (the
   set the page modulepreloads). Read from Vite's own manifest (`build.manifest: true` in
   `vite.config.ts` → `dist/.vite/manifest.json`): the chunk marked `isEntry`, then its `imports`
   edges; `dynamicImports` edges are lazy.
2. **All app JS ≤ 260 KB gzipped** — every `*.js` under `dist/assets`, lazy chunks included (and any
   file the manifest does not name), so bloat cannot hide in a lazy chunk.

The service worker (`sw.js`, `workbox-*.js`) is still printed and counted in neither. Decimal KB, zlib
default level, as before; exit 1 over either budget, 2 with no `dist/` or no manifest. Run 5's map
engine will get a budget of its own. The manifest is file names only — no trip data (check:dist scans
it: 41 files), and `.json` is outside the service worker's precache glob.

**Lazy since Run 3c** — the screens opened a few times a trip: **Settings** and **Backup** (routes,
`App.svelte:21-22`, `:100`), the **trip wizard** and the **import sheet** (sheet bodies,
`TripsHome.svelte:38-39`, `:316`, `:328`; `Backup.svelte:34`, `:210`). `lib/state/lazy.ts` `once()`
keeps each import's promise, so a second opening draws at once ({#await} skips its pending block for
a settled promise); a chunk that could not be read is asked for again next time. The chunks are the
app's own files (the APK's assets, the service worker's precache), so no network is involved. The
quiet loading state is `.lazywait` (`app.css`): invisible for its first 300 ms — a local file loads
before then — then "Opening…"; a failure says so (`S.misc.openFailed`). The router/back-layer
contract is unchanged: a sheet's `Sheet` mounts (and pushes its layer) at once and the lazy body
arrives inside it; the sheet's first field is still focused when the body arrives
(`Sheet.svelte:43`, a MutationObserver — verified on the wizard). **Kept in the entry chunk**, by
measurement: Now, Journey, the city and the guide (one component, read daily on the road), Pocket,
Find, the shell and the shelf — the initial load has 13.92 KB of headroom with all of them.

| | Before (Run 3b, one number) | Lazy split only | End of Run 3c |
|---|---:|---:|---:|
| Initial load (entry + static imports) | 192.92 | 184.27 | **186.08** of 200 |
| All app JS | 199.70 of 200 | 204.69 | **206.49** of 260 |
| Entry CSS (gz) | 31.25 | 29.62 | 29.62 |

The four lazy chunks weigh 13.62 KB gz between them and took 8.65 KB off the entry: separately
gzipped chunks compress less well than one, so the total rose by 4.99 KB — the price of splitting,
paid in the budget that is not felt at start-up. The 22 fixes added 1.81 KB to the entry. Nothing in
the minifier settings changed.

`npm run check:bundle` on the final build (KB):

| Initial load | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` (entry) | 583.80 | **186.08** |
| **Initial · 1 file** (the entry imports no shared chunk) | 583.80 | **186.08** of 200.00 |

| All app JS | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` (entry) | 583.80 | 186.08 |
| `assets/Backup-*.js` (lazy) | 11.47 | 3.96 |
| `assets/ImportSheet-*.js` (lazy) | 9.86 | 3.83 |
| `assets/Settings-*.js` (lazy) | 10.73 | 3.62 |
| `assets/web-*.js` (Capacitor filesystem, lazy) | 8.74 | 2.90 |
| `assets/workbox-window.prod.es5-*.js` (lazy) | 5.65 | 2.27 |
| `assets/TripWizard-*.js` (lazy) | 5.03 | 2.21 |
| `assets/index-*.js` (Capacitor filesystem, lazy) | 1.33 | 0.70 |
| `assets/web-*.js` (Capacitor share, lazy) | 0.38 | 0.26 |
| `assets/index-*.js` (Capacitor app-launcher, lazy) | 0.36 | 0.24 |
| `assets/index-*.js` (Capacitor share, lazy) | 0.34 | 0.24 |
| `assets/web-*.js` (Capacitor app-launcher, lazy) | 0.19 | 0.17 |
| **Total · 12 files** | 637.87 | **206.49** of 260.00 |

Not counted: `sw.js` 1.22, `workbox-*.js` 5.17. CSS: the entry's 29.62 gz + four lazy sheets
(Backup 1.00, ImportSheet 0.84, Settings 0.96, TripWizard 0.64). Fonts unchanged (130.48 KB).

### B–D. The findings

| # | Finding | What changed (file:line) | Proof |
|---|---|---|---|
| 1 HIGH | Deleting a stop from its guide ended on "Stop not found" with the sheet's back handler stuck | `del` no longer navigates (`routes/Stop.svelte:336`); the sheet closes first — its entry and handler go — then `closeSheet` (`:330`) calls the router's new **`backPast(gone, fallback)`** (`state/router.svelte.ts:127`): step back past every entry of the deleted stop (its guide, its city), never past the start of the session, then show the Journey (as landed, in place of the last dead entry, or on top). For that the router now knows **each entry's place in the session** (`history.state.i`, stamped as entries are made — `:71`; layers too), so `backOr` (`:115`) is exact as well (it counted hash changes, backward ones included). `TripShell.svelte:195` draws no "Stop not found" while a sheet is open (`router.depth`, now state) or while the app steps back (`router.leaving`) | Rehearsal "City guide · deleting its stop lands on the Journey": a throwaway stop, Pocket → Journey → city → guide → edit → delete → on the Journey, no sheet, the stop gone, **one back press → the Pocket** |
| 2 MED | Hong Kong guide: "price not recorded" beside EY 871, whose fare is in the trip file (the flights in and home share one, on the International Flights stop; Money counts it) | A flight with no fare of its own shows **no price line** (`Stop.svelte:239`); beds and tickets unchanged | Rehearsal "City guide · Hong Kong, no false 'price not recorded'" (EY 871 no price line, MU 733 keeps $293) |
| 3 MED | "Back to today" did nothing while Play ran (the next frame put the playhead back) | Play, Pause, the scrubber, ‹ › and Back to today are **one state machine**, `logic/replay.ts` `playback()` (`:129`) — home / playing / paused / parked; every control is an event, so a frame can never overrule one. `Journey.svelte:192` holds the state, `send()` drives it, `:301` is Back to today | 5 vitest tests (`replay.test.ts` › "Play, Pause, the scrubber and Back to today"); rehearsal "Replay · Back to today while playing" |
| 4 MED | The city's chips and "+N" handed the guide its chapter before the view changed; the city consumed it and a 160 ms timer did the scroll | The anchor effect (`Stop.svelte:296`) takes a pending chapter **only on the guide**, then waits for `tick()` and for the element to exist (up to 20 frames) — no delay | Rehearsal "City · a chip opens the guide at its chapter" (Booked, and "+N" → Places, each at the top) |
| 5 MED | `warnAt` took one word after NOT ("NOT Beijing South" → "NOT Beijing"); "NOT BOOKED YET" would have been a warning | `metroline.ts:229`: every Title-case word in a row, `NOT \p{Lu}\p{Ll}[\p{L}-]*( \p{Lu}\p{Ll}[\p{L}-]*)*`; shouted words are statuses | 1 new test, 7 cases, 3 of them negatives (`metroline.test.ts`); rehearsal "Travel days · every NOT names a place, whole" (7 travel days, Dec 11 still "NOT Capital") |
| 6 LOW | The Relay rings unmounted during Play and replayed their sweep delays after it (amber/red dark for up to ~8 s) | The rings stay mounted and are hidden with a class: `TripMap` `quiet` prop (`TripMap.svelte:39`, `:175`, `.flag.quiet { visibility: hidden }` `:237` — an animation cannot overrule visibility); `Journey.svelte:317` | Rehearsal "Replay · the rings right after Play" (same elements, lit 120 ms after Pause) |
| 7 LOW | `counterWord`: "Visa-free 240h" → "h", "Transit 144-hour" → "hour" | `counters.ts:40`: the last whole word when it is letters only, else the first word | 1 test (4 cases) |
| 8 LOW | The way in is dated on the trip's first day: on 22 Nov it read "done" with CA 8683 still ahead, and an unbooked leg that day dropped out of "N legs to book" | `routecheck.ts:126`: a move is today from its first leg's date to its last's, and behind you only after its last | 2 tests (the China way in and home; a synthetic two-day move with a pending second leg, counted on day 2) |
| 9 LOW | When the last stop ends after the trip does (Israel, template), the flights home vanished | `connectors.ts:203`: the window home opens at min(last stop's end, trip end) | 1 test on both seeds (the flight home found, "Booked") |
| 10 LOW | `fallbackOf`: "· **Fallback:** the 07:45 nonstop" left "****" in the callout; a bold run over the whole line was torn in two | `guide.ts:156`: a label that is its own emphasis run ("**Fallback:**", "**Fallback**:") leaves the text bare; a clause inside a run or a bracket that opened before it is not split out (`timeline.ts` `balancedBefore`, now exported) | 1 test (5 cases) |
| 11 LOW | Opening hours became fixed points; a clock range left a free block inside it; "Leave no later than" dangled; the test pinned the whole seed's clock table | `timeline.ts`: `HOURS` (`:68`) — a lead-in with until/till/open(s)/close(s)/shut(s)/last is a place's hours; `RANGE` (`:55`) — "10:00 – 12:00" is a start **and** an end (`until`, `untilMinutes`), and `planFixedPoints` (`:347`) holds the span (past midnight → next day); `DANGLING` (`:72`) gains than/for/on/to. The table test became **invariants over every day of all three seeds** (the clock is the file's own words, never an hours lead-in, emphasis balanced, day ordered, blocks inside 08–22 and ≥ 60 min) **+ three named days** (Dec 12 morning, Nov 23 pickup, Dec 10 release) | 3 new tests + 4 seed tests; every China day's timed clocks are unchanged (checked against Run 3b's table) |
| 12 LOW | "2n lake" → "two in the lake"; "2n the park" → "the the" | `guide.ts:246` + `IN_THE` (`:237`): compose only a name ("two in Kyoto") or a kind of place on the list (park, city, town, old town, village, mountains, hills, valley, desert, countryside, forest, centre); the file's own "the" is never doubled; anything else — "2n lake", "2n by the lake", "1n in Kyoto" — stays as written. `S.guide.split` no longer adds "the" | 5 new cases |
| 13 LOW | Status words hand-rolled in three places (a walk-in read "Pending" on a Journey leg, a walk-in pin line painted amber, `ST` duplicated `chipOf`) | One `chipOf(status)` in `logic/stamps.ts:39` (re-exported by metroline): the route check's legs (`Journey.svelte:425`), the guide's Booked rows (`Stop.svelte:379`, `ST` deleted), the pin lines' tone (`Stop.svelte:158`, a neutral `.ln` class so a walk-in keeps its line break) — and a fourth copy found on Now's NEXT tile (`NowHome.svelte:262`) | The existing chip checks |
| 14 LOW | A pin holding two tickets said a generic "ticket pending" | `citymap.ts:324`: where a pin holds more than one booking, the line names the one it speaks for by its own title ("Tianmen Mountain pending", "HK Phil booked"); a lone ticket still says "ticket" | 1 new test; the Pullman case updated |
| 15 LOW | Every unattached flight document showed on every flight pass | `pass.ts:155`: a document whose name carries flight numbers is those flights' alone | 1 test (two flight documents + the manifest) |
| 16 LOW | `shortPlaceName` dropped "Airport" anywhere once any code appeared ("Airport Express (AEL)" → "Express (AEL)"; bare "Airport" → "") | `places.ts:129`: the code is looked for in the kept part (not the aside); only the airport words that END the name go (before its code, terminal or " · "); never shortened to nothing | 1 test (8 cases) |
| 17 LOW | Stop order vs date order (city exits, "stop N of M" and Journey's count by `order`; the rest by date) | One helper, `day.ts:25` `realStops()` (date, then order), in citymap, routecheck, replay, connectors, constellation, geoStats, `data/weather.ts`, `Stop.svelte:94`, `Journey.svelte:92` | Existing tests (the seeds' orders agree) |
| 18 LOW | A11y: the Replay section was labelled "Route check"; the city map (`role="img"`) hid the pins' booking lines and the way-on status; ↻ stayed enabled but did nothing under Calm motion / Route animations off / reduce-motion; Play's name was wrong after a pause or a drag | `Journey.svelte:306` "Replay the trip"; the map is `aria-hidden` for the eye and a **screen-reader list** follows it (`Stop.svelte:566`) — every pin with its words and its line, the way on with its status, including labels the layout left off; ↻ is **not offered** where routes may not move (`Stop.svelte:531`, new `state/motion.svelte.ts`, fed by `App.svelte:48-49`), and the first-open replay waits until the settings are read (found while verifying: under Calm motion a static comet showed for 4 s a hop); Play's name from `playAction()` (`replay.ts:153`): "Replay my trip from 21 Nov" / "Resume the replay" / "Play from 24 Nov" | Rehearsal "City · under Calm motion" (no ↻, nothing flies, the map read out); "Replay · Back to today while playing" (the names) |
| 19 LOW | Stars' `aria-label` on a plain span; back-to-top glided under reduced motion/Calm; the close button said "back to the map" when opened from Find/Now; back from a pass reopened the guide at the top | `role="img"` (`Stop.svelte:496`); `behavior: motion.calm ? 'auto' : 'smooth'` (`:516`); the guide keeps, **in its own history entry**, where it was opened from (`from`, `:262`) — the close button says "…back to the map / Now / the Journey / the Pocket / Find" (`:390`, `S.guide.closeTo`) — and where it was left for a pass (`y`, saved on the way out `:282`, restored on the way back `:267`) | Verified in the built app: 1,700 px → pass → back → 1,700 px; opened from Find the button says "back to Find" and returns there; rehearsal "City · under Calm motion" (back-to-top at 0 after 60 ms) |
| 20 LOW | Duplicates | `mdlite.ts:51` `plainWords()` replaces guide's `blockTitle` body, metroline's `plain` and concierge's `bare`; `booked.ts:70` `isLive()` replaces the copies in guide, metroline, coverage and commitment; `realStops()` (item 17); `chipOf` (item 13); citymap's `legWord` → metroline `legLabel`; metroline's two regex escapes → one `esc` (`:207`); `dates.ts:58` `fmtDowDay()` for the three `fmtDow(…).split(' ').slice(0, 2)` | Covered by the suites above |
| 21 LOW | Tests | `citymap.ts:425` `cityKeepOut()` + `:414` `wayOnLine()` — the screen and its test read the same keep-out rectangles; the missing cases (fallback with only the label bold, multi-word NOT, "240h", article/preposition in split words, two flight documents, multi-day arrival); the Play state machine | **717 tests** (695 → 717) |
| 22 LOW | Rehearsal | The four walks: Back to today while playing · the rings right after Play · deleting a stop from its guide · the city under Calm motion — plus the HIGH/MEDIUM ones above | 7 new checks |

**Found while verifying (same kinds of defect)**

- **The Replay's dates touched at 384 px** — "21 Dec" ran into "27 Dec" (Known issue 12 said below
  ~370 px). `replay.ts:200` `scrubMarks(n, trackPx)` drops a date that would touch the last one, given
  the track's own width (`Journey.svelte:169`, read once — portrait-only): 412 px keeps all five
  dates with their 4 px gap, 384 px shows 21 Nov · 1 Dec · 11 Dec · 27 Dec. 1 test.
- **Under Calm motion the city's first-open replay** was decided before the settings were read (the
  `calm` class arrives with them), so a static comet sat on each hop for 4 s. It now waits for
  `motion.known` (`Stop.svelte:176`).
- A walk-in's pin line would have lost its line break: the `pre-line` rule was keyed to the ok/warn
  tone classes; now a neutral `.ln` class carries it (`Stop.svelte:919`).
- FEATURES.md had the pass and Counter mode rows run together on one line — split.

**Rehearsal**: 7 new checks (listed in item 22 and the table) — **147/147**, network hard off.
Three harness changes came with them (`scripts/e2e/rehearsal.mjs`): a check whose page leaves its
document mid-check is now that check's FAIL row, with the check named on stderr, instead of a crash
that printed no table; `js(x, await, gesture)` can run a walk with a tap's user activation — Chrome
marks history entries made without one as skippable and, once a tab's history is full (50 entries;
this walk makes far more), prunes the oldest skippable entry first, which silently removed the
delete walk's own city and guide entries and sent its back steps out of the document; and the Calm
motion switch waits for lazy Settings and for `<html>` to follow.
The Pocket, city, guide and Journey were re-shot at 412 and 384 px (the city under Calm motion
without its ↻, the Hong Kong Booked chapter without the price line, the Journey's dates, Settings,
Backup, the wizard and the import sheet arriving lazily): nothing else moved.

### Gates at the end of Run 3c

| Gate | Result |
|---|---|
| `npm run check` | 583 files, 0 errors, 0 warnings (+ scripts `tsc`) — Run 3b: 581 |
| `npm test` | **717 passed in 41 files** (Run 3b: 695) |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, 113 pairs × 2 palettes, 0 failures · vite build (terser, settings unchanged; precache 34 entries, 993.17 KiB — the lazy chunks are in it) · check:dist 41 files, no personal data, both passport identifiers absent, 14 patterns · **bundle: initial load 186.08 KB gz of 200 (13.92 under), all app JS 206.49 KB gz of 260 (53.51 under)** — both tables above |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `REHEARSAL_PORT=4177 npm run rehearsal` | **147/147** with the network hard off, on the final build (the dist it walked is byte-identical to the one `npm run build` left) |

## Run 3b — fidelity fixes (FIX-3B.md) · DONE (2026-09-28)

The ten findings of the design review of 2026-09-28, fixed at their root, each with vitest tests where
it is logic and a rehearsal check for every HIGH and MEDIUM one. Verified in the built app at 412 px
(the boards) **and at 384 px — the S23 Ultra's width** — which surfaced a few more defects of the same
kinds (listed under "Found while verifying"). No trip fact was invented; seed, sources and the china
and privacy scripts were not touched.

| # | Finding | What changed |
|---|---|---|
| 1 HIGH | Dec 12 drew "14 h free · 08:00–22:00 · nothing timed yet today" | `logic/timeline.ts`: a clock reading (`CLOCK`: HH:MM or 6am, the file's `~`/`≈` kept) is read in two shapes — **leading** (`LEADING`, now also behind the item's emoji: "🚐 **11:00 — …") or **closing a lead-in** of one to four letter-only words right before the item's first separator ` · `, ` — `, ` – `, `: ` (`LEAD_IN`: "First entry ~07:30 · …", "Sunset ~17:45 — …"). Never a clock: a duration ("(~2h)", "~40 min"), a price, a lead-in holding a digit ("3U8011 20:20 →"), five words or more, a clock after the first separator, a comma as separator ("Heading down by ~13:30, …" — the Great Wall walk stays unbroken), a lead-in ending "until/till". The lead-in stays as the title ("First entry" / "Golden Whip Stream valley walk"); where it would dangle ("Dinner at", "by") the clock stays in the words. `timeMinutes` reads `~`/`≈`. Dec 12 now: **~07:30 First entry · 9 h 45 m free 08:00–17:45 "after First entry" · ~17:45 Sunset**. 7 tests incl. the real Dec 12 lines and a whole-seed table test (every day's timed clocks, below). The old app had the same bug. |
| 2 HIGH | The Wulingyuan pin read "Sat 12 · Pending" on the night the booked Pullman is the bed | `logic/citymap.ts` `pinText(pin, cards, bookings, now)` picks the one booking a pin speaks for — a stay held at the pin first (with its own status), else the next from today, else the last — and writes **its line, naming it**: "Sat 12 / ticket pending", "Mon 14 · 08:00 / ticket pending", "Fri 11 · 18:15 / CA 8609 booked", "Fri 11 → Sun 13 / stay booked". Beds never carry a coordinate in the trip file, so the Pullman is "No pin yet" and no pin's line can be read as its status (the guide's Booked chapter shows it Booked). Two short rows, so labels still fit beside their pins at 384 px. Beijing's PKX pin now speaks for CA 8609 (Dec 11) from Nov 23 on, not CA 8683 (Nov 22). 3 tests. |
| 3 MEDIUM | "NOT Capital" missing from the travel-day line | `logic/metroline.ts` `warnAt()` lifts the trip file's own capital **NOT + name** from the step joined to a station, only within a few words after one of the station's tokens ("Cross to Daxing (PKX) — NOT Capital (PEK)" → "NOT Capital"); carried on the row (`MetroRow.warn`) and the Focus card (`Focus.warn`), drawn in warn amber after the by-time: "by ~16:45 · **NOT Capital**". No other station on any travel day gets one. 3 tests; contrast pair `warn-ink` on `sky` added. |
| 4 MEDIUM | Long names cut mid-word (driver chips, pass header, Counter mode) | `logic/places.ts` `shortPlaceName(name, coded?)`: the words before " — ", "Terminal 2" → "T2", "Railway Station" → "Station", and "International/Intl/Airport" dropped where the code is shown ("Beijing Daxing International Airport (PKX)" → "Beijing Daxing (PKX)"), else "International Airport" → "Intl". Whole words only; the full name stays the accessible name. Used on the Pocket chips, the pass's ends ("Beijing Daxing" / "Zhangjiajie Hehua · T2" under PKX · DYG, the full names in the pass's `aria-label`) and Counter mode's route ("Beijing Daxing (PKX)" / "→ Zhangjiajie Hehua · T2 (DYG)", two lines). The pass's names moved to their own row so the date never sits between them; below 370 px the date goes under the names. The code subtitles on the pass and in Counter mode break a word only when it cannot fit a line (`overflow-wrap: anywhere`, was `break-all`: "ve / rify", "C / A1953"). 5 tests. |
| 5 MEDIUM | The fallbacks lost their callout in the guide | `logic/guide.ts` `fallbackOf()` splits a Getting-there line at its own "fallback(s):" — to the next ` · ` outside brackets and emphasis, or the end — into before / label / text / after, word for word; `components/journey/html.ts` `proseHtml(b, true)` sets the clause as `<div class="gd-fall" role="note">` with the file's word as its caps label ("FALLBACKS", "FALLBACK") and the verify flag still a flag. Zhangjiajie and Kunming have one; Beijing's "train fallback ~5h" names no clause and stays prose. 4 tests. |
| 6 LOW | The pill printed "MAINLAND VISA" and grew wide | `logic/counters.ts` `counterWord()` (the name's last word, else its first); `AppBar.svelte` shows "VISA 19/30", the full name in its `aria-label`. 1 test. |
| 7 LOW | No way from a flight pass to the flight manifest | `logic/pass.ts` `passDocs()` (replaces `attachedDocs`): a booking's own documents, and on a flight the vault's document tagged `ticket`, attached to no booking, whose name says flight; the pass labels it "E-ticket · Flight manifest (PDF)" (its own name, before its " — "). 2 tests. |
| 8 LOW | "The pass lacks the perforation notches" | They were there: the pass's own `background`, `box-shadow` and rise animation (a scoped rule) overpainted `.opal-edge`, so a lit pass had no edge for the notches to cut. `.pass.opal-edge` now layers the card over the opal border (rise + opal shimmer, `background-color` kept for Daylight); the notches bite the edge as the board draws it. |
| 9 LOW | The guide's intro line read like a template | `S.guide.standfirst` + `logic/guide.ts` `tailWords()`: "Three nights · Fri 11 → Mon 14 Dec · two in the park, one in the city" — the nights in words, the dates, the file's own "2n park + 1n city" read out; any other tail stays as written ("One night · Fri 18 → Sat 19 Dec · 2-day hike"). 1 test. |
| 10 | Verify: every city hop drawn "been" orange | **Correct, unchanged.** The reviewer's screenshot previews Dec 15, after the stay, when every hop is behind you. Within the stay the states differ as the board draws them: Dec 11 — DYG → Wulingyuan today (Flow), Wulingyuan → Tianmen ahead (dotted lilac), the way on dotted amber (not booked); Dec 12 — the first hop done (orange), the next one live. |

**Found while verifying (same classes of defect; all CSS except the city layout)**

- **The city is laid out in its own pixels** (`routes/Stop.svelte`): the map was computed at 412 px and
  scaled down, so on the S23 (384) the labels' text took ~7 % more room than planned and wrapped onto
  their own pins (PKX's line ran over its pin). The map is now as wide as the screen (read once as the
  city opens), 390 tall; `labelSize()` estimates per row with the face's measured widths (caps 9.2 px,
  line 5.2 px + 1.6 per digit, Chinese 13.5). Every city, 412 and 384 px: the same labels placed as
  before, none overlapping, none under the sheet, no line wrapping unplanned.
- **The Pocket and Journey pages were wider than the screen**: the Pocket's sunrise glow reached 80 px
  past both edges, and Journey's playhead (a track-wide box moved by transform) up to ~220 px — the
  pages panned sideways, and in the emulator the nav bar left the screen (the reviewer's Pocket and
  Journey screenshots have no nav). `overflow-x: clip` on `.pocket` and `.rp-scrub`.
- Words cut mid-way elsewhere: the day's bed row (its two map buttons squeezed "Pullman Zhangjiajie,
  Wulingyuan" into a column over its Booked stamp — they now sit under it); a station's Chinese name
  split inside it on the metro line (北京大兴国际机 / 场 — now moves whole); "Experien…" on the Pocket's
  ticket at 384 px (below 400 px: the ladder's 11 px and a little less padding); the route check's stop
  names and move labels and the Pocket's clock places (they wrap at their words); the Replay date at
  384 px (the number face's narrowest width).

**Rehearsal**: 8 new checks — Dec 11 · NOT Capital on the Daxing row; Dec 12 · the timed morning + its
free block; City guide · the fallback in its own callout (+ the standfirst); City guide · a fallback
mid-line stays in order (Kunming); City · the gate's line is its own ticket's (and the Pullman Booked in
the guide); Pocket · whole names at 412 px and at 384 px (chips uncut, full names as accessible names,
no wallet label cut, the pill "visa" named "Mainland visa: N/30"); Pass · edge, notches, ends, e-ticket,
desk route. "Pocket · visa clock + driver cards" now looks for "VISA" and "23/30" (the pill no longer
prints "MAINLAND VISA"; the full name is asserted in the new check). **140/140.**

### Every day of the China seed, before and after (timed plan lines, and the free blocks drawn)

The day screen draws the free blocks only on an ordinary day; a travel day draws its metro line, so a
travel day's timed lines change nothing on screen. Bold = changed. No day lost a timed line. The Israel
and template-example seeds: no day changed (their clocks sit in prose — "**Out by 07:00.** …", "Back
indoors 11:00–17:00." — which neither shape reads).

| Day | Kind | Timed before | Timed after | Free block before | Free block after |
|---|---|---|---|---|---|
| Sat 21 Nov | travel (line) | — | — | — | — |
| **Sun 22 Nov** | travel (line) | — | **08:45** ("Land PKX 08:45 · …") | — | — |
| **Mon 23 Nov** | day | — | **11:00** (🚐 the academy's pickup) | 08:00–22:00 | **08:00–11:00** |
| Tue 24 – Sat 28 Nov | day (Kunyu default) | 6am | 6am | — | — |
| Sun 29 Nov | day | 20:00 | 20:00 | 08:00–20:00 | 08:00–20:00 |
| Mon 30 Nov – Fri 4 Dec | day (Kunyu default) | 6am | 6am | — | — |
| Sat 5 Dec | travel (line) | — | — | — | — |
| Sun 6 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| Mon 7 Dec | day | 06:30 | 06:30 | — | — |
| Tue 8 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| Wed 9 Dec | travel (line) | — | — | — | — |
| **Thu 10 Dec** | day | — | **20:00** (🔴 the Jade Dragon release) | 08:00–22:00 | **08:00–20:00** |
| Fri 11 Dec | travel (line) | — | — | — | — |
| **Sat 12 Dec** | day | — | **~07:30, ~17:45** | 08:00–22:00 | **08:00–17:45** after First entry |
| Sun 13 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| Mon 14 Dec | travel (line) | — | — | — | — |
| Tue 15 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| **Wed 16 Dec** | travel (line) | — | **~18:00** ("Airport run ~18:00") | — | — |
| Thu 17 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| **Fri 18 Dec** | travel (line) | — | **18:00** ("Dark by 18:00 · …", clock kept in the words) | — | — |
| Sat 19 – Mon 21 Dec | travel (line) | — | — | — | — |
| Tue 22 Dec | day | — | — | 08:00–19:30 (the concert) | 08:00–19:30 |
| Wed 23 – Fri 25 Dec | day | — | — | 08:00–22:00 | 08:00–22:00 |
| Sat 26 Dec | travel (line) | 11:00 | 11:00 | — | — |
| Sun 27 Dec | travel (line) | — | — | — | — |

Asserted in `timeline.test.ts` › "the China seed, every day" (the timed column, all 37 days) — until Run 3c, which replaced that table with invariants over every day of all three seeds plus three named days (Dec 12, Nov 23, Dec 10), so a plan line edited on main no longer breaks `npm test`; the clocks above were re-checked and are unchanged.

### Gates at the end of Run 3b

| Gate | Result |
|---|---|
| `npm run check` | 581 files, 0 errors, 0 warnings (+ scripts `tsc`) |
| `npm test` | **695 passed in 41 files** (Run 3: 671 in 40) |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, **113 pairs** × 2 palettes, 0 failures · vite build (terser, settings unchanged) · check:dist 32 files, no personal data, the passport identifier absent, 14 patterns · bundle **199.70 KB gz, 0.30 KB under 200** |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `REHEARSAL_PORT=4177 npm run rehearsal` | **140/140** with the network hard off (on the final build) |

### The bundle

`npm run check:bundle` on the final build (KB, decimal):

| File | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` (the app) | 611.45 | **192.92** |
| `assets/web-*.js` (Capacitor, lazy) | 8.74 | 2.90 |
| `assets/workbox-window.prod.es5-*.js` | 5.65 | 2.27 |
| `assets/index-*.js` (Capacitor, lazy) | 1.33 | 0.70 |
| `assets/web-*.js` | 0.38 | 0.26 |
| `assets/index-*.js` | 0.36 | 0.24 |
| `assets/index-*.js` | 0.34 | 0.24 |
| `assets/web-*.js` | 0.19 | 0.17 |
| **Total · 8 files** | 628.43 | **199.70** of 200.00 |

Run 3b added 1.50 KB (198.20 → 199.70): the ten fixes ~1.39, the city's own-pixel layout and two-row
pin lines ~0.11. Measuring the width with `bind:clientWidth` cost 0.22 KB more (Svelte's
ResizeObserver) — the width is read once instead. Nothing in `vite.config.ts` or the gate changed. The
next real headroom is Run 4 (Daylight removed); small duplicates remain if needed (the regex-escape
helper in metroline ×2 / find / prices, the leading-emoji regex in guide / metroline / concierge,
`fmtDow(…).split(' ').slice(0, 2)` in three places — a few tens of bytes gz).

## Run 3 — Journey + City · DONE (2026-09-28)

Every part landed and every gate is green on the final build. No rehearsal check is skipped. The
light (Daylight) look of the new screens was not designed, by the owner's decision of 2026-09-28
("we don't need Daylight"; Run 4 removes it): they use the shared tokens only, and the contrast
gate still passes in both palettes.

| Part | What was built |
|---|---|
| 3a Journey | `routes/Journey.svelte` rewritten (f-journey): **Replay** above the **route check**, then the trip in numbers. `logic/replay.ts` (15 tests): the trip's days, the clock Play runs on (`replayClock`: a day a leg is walked holds 1.2 s while a Comet flies it, every other day passes in 170 ms; `playheadAt`), the scrubber's stop and move bars and its dates, the **visa window** from `counters.ts` (`visaWindow`: "starts 23 Nov" before the count, "19 / 30" on Dec 11, "29 / 30 · left 21 Dec" once you have left, "· over" past the limit; "Exit by 22 Dec", and the deadline ticked at the window's end) and where each day is spent (`whereOn`: the stop, "Chongli → Zhangjiajie" on a move day, "Flights in" / "Flights home"). The map is `TripMap` on the constellation for the playhead's day — the road so far inked, the day's leg Flowing while nothing plays, legs ahead dotted and amber where nothing is held, YOU and TONIGHT for that day — and the Comet paints the leg it flies (`trail`, `.comet-ink`). Play / Pause (rAF, never more than 100 ms a frame, so an app that was hidden does not jump), ‹ ›, a drag scrubber (a range input whose value text is the day), "Back to today", and "Today · 13:02" on the real today. **The route check** (`logic/routecheck.ts`, 9 tests): every stop (its beds) and every move (its legs) in trip order, from the journey in to the journey home; a bed chip ("Booked", "Walk-in", "N nights pending", "Bed missing · 22 Nov" — red while the night is ahead, amber once it is behind you) and a move chip ("Booked", "Part booked", "Not booked", "Nothing booked"); the counts are what is still to do from today; the rail is lit up to tonight and dotted after it. A stop row opens its city; a move row opens to its legs in travel order ("then", "or instead", the gap said in words), each leg a door to its pass. **Relay** (`lib/motion/relay.ts` + `relayPlan()`) lights the rows once — pausing on amber, longer on red — with the map's rings lit at their rows' moments, and ends on the count ("7 legs to book · 1 bed missing" on 1 Nov, "3 legs to book" on 15 Dec); calm motion, reduce-motion and Route animations off show the end state (`app.css` covers `.relay .rl`, `.relay-end` and `.comet-ink`). **The trip in numbers** (`#stats`) with the doorway to Pocket › Money. **Edit mode**: add a stop, add a day, the runbooks — one editor sheet. |
| 3b City | `routes/Stop.svelte` (f-city), `journey/:stopId`. `logic/citymap.ts` grew the stay walked hop by hop between the pins its days name and out by the bearing to the next stop (`stayRoute`), the pins' words (`pinText`: a driver card's Chinese and the first clause of its meaning; an airport by its code — "DYG airport", as the board writes it — with its whole Chinese name under it), their room and their places (`labelSize`, `layoutCity`: ten positions round a pin, never over another label, a pin, the way on, the scale bar or the guide sheet that laps the map), the scale bar and the city as a constellation for `TripMap` (`cityConstellation`); 19 tests. The screen: the header (city scale and dates, the name and its Chinese, ↻ to replay the stay), Trip · Today · City, the map (dot grid, "Real positions · north up", N, the scale bar, the pins' labels, the way on at the map's edge — its date, booked or not, and its legs), and the guide at half height: "City guide · stop 4 of 10", its title and budget, the dates, nights and the stop's own split, a chip per chapter (each opens the guide at that chapter), "No pin yet" (+N opens the guide's list) and **Read the guide**. The live hop Flows; on its first opening in a session the stay replays itself (a Comet per hop, in order), and ↻ replays it again. Pins only where the trip file stores a coordinate: Zhangjiajie West, Qinghe and the park spots have none and are named, never pinned. |
| 3b The guide | `journey/:stopId/guide` (f-guide) — the same component, an Edition long read that Android back closes onto the city (the nav bar steps aside while you read). `logic/guide.ts` (11 tests) decides the chapters and their order from the stop's own blocks — Getting there & money · The story · Booked · Day by day · the stop's other blocks · All the options · Places — what is booked here (beds, flights and tickets; what is still to buy), the **pull quote** (40–110 characters of the story's own words: never a number, a price or a verify, never a sentence that leans on the one before it) and the stay's dates and nights. `components/journey/html.ts` sets the prose once, as markup (md-lite escapes first; `flagVerify` turns every *(verify …)* into a flag). On the page: the photo hero with the city's name, a standfirst, numbered chapters (display heading and rule), the **drop cap**, and every StopDetail feature — the warning, the budget and the itemised costs, the map pill (+ copy address), the booked items with their prices → their passes, the plan at a glance, each day with its weather from the cache ("weather from …" when old), its places (with map buttons) and its bed, the options with their marks, every spot with its photo, stars, Chinese, verify flag and map button, the old header's ⇪ (copy the place's name and address — offline, no share sheet), back to the top; edit mode (toggled in the hero): edit or delete the stop (then back to Journey, with undo), add and edit a day, add or replace the photo. Find's place results open the guide at Places, and Now's "All N options" at the options. |
| 3c Rehearsal | `scripts/e2e/rehearsal.mjs` migrated: every data-fact assertion kept and re-pointed at the screen that now holds it — the ten hero photos and the ten stop pills on the guides; the connectors and the coverage chips on the route check; the booked items, the prices and the long read on the guides; the jump chips on the city sheet. New: Replay on Dec 11 (today, ›, the scrubber to day 1 and day 37 with the map and the visa moving, Play with a Comet that paints, Pause, Back to today; "19 / 30", "Exit by 22 Dec" and its tick); the Relay sweep on 1 Nov (21 rows in order, red on Kunyu, the rings lit with their rows, the count last: "7 legs to book · 1 bed missing"); the city (three pins named, Zhangjiajie West unpinned, Yuanjiajie under No pin yet, the way on "Mon 14 · Not booked", no two labels overlapping or under the sheet, the stay's replay, Read the guide and back); the drop cap, the pull quote and the verify flags; the Booked chapter; Find → a place → its guide at Places; every icon drawn. The type ladder and the a11y sweeps now include Journey, a city and a guide. Two rehearsal fixes: `REHEARSAL_PORT` (another checkout's preview held 4173 during this run; the default is unchanged), and a lone `\d` that the template literal had been eating in the Maps check. **132/132 with the network hard off** (Run 2 ended at 125). |
| Docs | `FEATURES.md` (every Journey row Built; nothing is bridged any more), this file, `ARCHITECTURE.md` (the budget and the build). |

### What was deleted (Run 3 replaces it)

`routes/Itinerary.svelte` (1,025 lines), `routes/StopDetail.svelte` (1,005) and
`components/JourneyOverview.svelte` (272), and what only they used: `notableNights()` in
`logic/coverage.ts`; the strings nobody reads any more (`S.tabs`, most of `S.plan` — its coverage
words, jump labels and section headings — `info.stopsSub`, `info.deepMoney`, `empty.route`,
`day.focusAria`); three icons nothing draws (globe, ticketline, grid). The day screen's own
"weather from …" code became the shared `weatherAge()` in `logic/weather.ts` (2 tests).
`coverageStamp()` stays, its words moved out of `strings.ts` into `coverage.ts`: no screen draws it
any more, but `scripts/trip-template/assert.ts` prints it (Known issue 10).

### Gates at the end of Run 3

| Gate | Result |
|---|---|
| `npm run check` | 580 files, 0 errors, 0 warnings (+ scripts `tsc`) |
| `npm test` | **671 passed in 40 files** (Run 2: 623 in 37) |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, 112 pairs × 2 palettes, 0 failures · vite build (terser) · check:dist 32 files, 14 patterns, no personal data · bundle **198.20 KB gz, 1.80 KB under 200** |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `npm run rehearsal` | **132/132** with the network hard off (on the final build) |

### The bundle

`npm run check:bundle` on the final build (KB, decimal, as Vite prints them):

| File | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` (the app) | 608.17 | **191.41** |
| `assets/web-*.js` (Capacitor, lazy) | 8.74 | 2.90 |
| `assets/workbox-window.prod.es5-*.js` | 5.65 | 2.27 |
| `assets/index-*.js` (Capacitor, lazy) | 1.33 | 0.70 |
| `assets/web-*.js` | 0.38 | 0.26 |
| `assets/index-*.js` | 0.36 | 0.24 |
| `assets/index-*.js` | 0.34 | 0.23 |
| `assets/web-*.js` | 0.19 | 0.17 |
| **Total · 8 files** | 625.16 | **198.20** of 200.00 |

Not counted (the service worker runs off the main thread): `sw.js` 1.12, `workbox-*.js` 5.17.
CSS 175.67 raw / 30.93 gz (Run 2: 181.06 / 30.48). Fonts 130.48 KB on disk (unchanged).

**The main session should know how it fits.** The gate is unchanged — the same script, the same
files, the same 200 KB — and nothing was split out. Run 3 replaced three screens with Replay, the
route check, the city and the guide, deleted what they replaced, and trimmed its own code (one
component per screen, shared helpers, icons as markup strings, strings pruned); **but the final
code built with Run 2's settings measures 201.07 KB — 1.07 over** (with esbuild, as in Run 1:
218.28). What closes the gap is how the same code is built (`vite.config.ts`, each change
commented there, nothing from terser's unsafe family, no property mangling):

- **terser**: five compress passes (Run 2: two) and `hoist_funs` (function declarations to the top
  of their scope, where the language already hoists them; ESM is strict), `ecma: 2020` output;
  measured on one build of the code: passes 3 → 199.79, passes 4 → 198.90, passes 5 +
  `hoist_funs` → 198.13 (8 passes: 198.12).
- **Scoped class names**: `_` + 4 characters of Svelte's own hash of a component's CSS instead of
  `svelte-` + 7, ~1,450 times in the templates (−0.88 KB with the Svelte version tag dropped,
  `discloseVersion: false`). No class the app writes starts with `_`, and `cssHash()` fails the
  build if two different stylesheets ever share one.
- **No modulepreload polyfill** — every browser this app ships to has `<link rel=modulepreload>`.

If the owner would rather not lean on build settings, the alternative is route-level splitting,
which the gate as written does not reward (it counts every chunk the page loads).

## Next — Run 4

The owner decided on 2026-09-28 that the app needs no Daylight: **Run 4 removes the light theme
entirely (dark only)** — `logic/theme.ts` and the boot script's theme branch, Settings' Appearance
switch, the Daylight palette in `app.css` (every `:root[data-theme='light']` rule, including those
in `TripMap`, `Comet`, the pass and the day screen), the second palette in `check-contrast.mjs` and
`system/tokens.json`, the rehearsal's Light section (its data facts — the pass reads, the guide
reads — stay as dark checks), `theme.test.ts`, and the `ltd:theme` key (ignored if found). Since
Run 3c the bundle gate measures the start-up JavaScript (186.08 of 200 KB) and the whole app
(206.49 of 260 KB) separately, so Run 4 is no longer the only headroom: more rarely used code can
load lazily (the edit forms — `SchemaForm` + `forms/specs.ts` — are the next candidate). Handed
over from Run 3, 3b and 3c:

- Run 3c ended with every gate green; its PROGRESS section lists each finding → change (file:line).
  Two follow-ups it names: the router's session index (`history.state.i`) and `backPast()` are
  covered by the rehearsal only (the router has no unit tests — it is history, not logic); and the
  city's screen-reader list reads every pin in the map's own order.

- Run 3b ended with every gate green (rehearsal 140/140). Its PROGRESS section lists what each fix
  changed, the before/after of every seed day's timeline, and three small follow-ups (Known issues
  14–16: brackets in `splitBody`, labels that do not yet avoid route lines, a flight number that
  can wrap at its own space).
- The city's labels are best effort (Known issue 11); a leader line to a free corner, or a
  shorter name per place in the trip file, would name the crowded ones.
- `scripts/trip-template/assert.ts` still prints the Run 2 coverage stamp (Known issue 10); its
  report could print the route check's own words (`routeCheck()`), which the phone now draws.
- Journey, the city and the guide were built dark-only in spirit; nothing in them needs Daylight
  work before it goes.

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

## Known issues (carried forward)

1. ~~Bundle headroom is 0.30 KB~~ — **since Run 3c the gate is two numbers**: the start-up
   JavaScript (entry + static imports) is 186.08 of 200 KB, all app JavaScript 206.49 of 260 KB
   (Settings, Backup, the wizard and the import sheet load lazily). The minifier settings of Run 3
   still apply; splitting cost 4.99 KB of total (separately gzipped chunks), none of it at start-up.
2. Nothing is bridged since Run 3. The new screens were not designed for Daylight (owner decision,
   2026-09-28 — Run 4 removes it); they use the shared tokens and pass the contrast gate in both
   palettes, and the rehearsal's Light checks still read the pass and the guide.
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
10. `scripts/trip-template/assert.ts` prints one `coverageStamp()` per segment and says its
    colours are "literally the ones the phone will draw". Since Run 3 no screen draws that stamp —
    the route check says the same facts in its own words — so the report's words are Run 2's
    ("⚠ bed missing", "2 pending"). The function is kept, tested and out of the bundle; the script
    was not edited (scripts are not this run's to change). Pointing the report at `routeCheck()`
    is a one-function follow-up.
11. The city's labels are best effort: ten positions are tried round each pin, and a label that
    would cover another label, a pin, the way on, the scale bar or the guide sheet is left off —
    the pin is still drawn and the place is still in the guide. On the China trip every pin is named
    in Zhangjiajie, Dali, Kunming, Hong Kong, Kunyu, Chongli and the gorge; left off on 15 Dec are
    Beijing's PEK airport (under the way-on note) and three pins within 10 px of each other at Houhai,
    Chongqing's Ciqikou (Jiefangbei and Hongya Cave take the corner) and Lijiang's Old Town (under
    the way-on note and the compass). A leader line to a free corner would name them; a design call.
12. ~~The Replay scrubber's dates may touch below ~370 px~~ — they touched at 384 px; since Run 3c
    `scrubMarks(n, trackPx)` drops a date that would touch the last one (the S23 shows four dates,
    412 px all five).
13. The rehearsal serves the build on `REHEARSAL_PORT` when it is set (default 4173, unchanged):
    during Run 3 the main checkout's own preview held 4173, so Run 3's walks ran on 4177.
14. (Run 3b) `splitBody()` can take a title/detail split inside brackets — Nov 23's 11:00 pickup
    reads "🚐 THEY COLLECT YOU AT THE HOTEL (confirmed in writing, 13 Aug" over the rest of the
    line (it read the same in Anytime before it was timed). Requiring brackets to be balanced at the
    split, as emphasis already is, would fix ten plan lines; `splitBody` also serves the concierge,
    options, the city pins and Now's tiles, so it was left for a run that re-checks those.
15. (Run 3b) The city map reads the screen's width once as it opens (the app is portrait-only); a
    window resized while a city is open keeps the old layout until it is reopened. Its labels still
    do not avoid the route lines (Known issue 11) — Tianmen's label starts on the live hop at
    412 px.
16. (Run 3b) The route check's move labels now wrap at their words; a flight number can wrap at its
    own space ("… + CA / 8683 → Kunyu Academy" at 384 px). The guide's spot rows' address-copy
    pills overflow the screen by 4 px at 384 px (pre-existing, found by the width scan).

## Deviations from the boards (with reasons)

**Run 3b**

- **f-day**: Dec 12's free block reads "9 h 45 m free · 08:00–17:45 · after First entry" where the
  board writes "After the ascent, until sunset": the ascent carries a duration ("~2h"), not a
  clock, so it stays under Anytime, and nothing states when it ends. The timed lines read as the file
  writes them — "~07:30 / First entry / Golden Whip Stream valley walk" (the board: "~07:30 · first
  entry" over the walk) and "~17:45 / Sunset / be off the steps in daylight" as an ordinary station,
  not the board's horizon row.
- **f-city**: a pin's booking line is two rows, when and then which booking with its status ("Sat 12
  / ticket pending", "Mon 14 · 08:00 / ticket pending") — the board's one-line "Mon 14 · 08:00 ·
  ticket pending" does not fit beside its pin at 384 px. The board's "Park gate · Pullman nearby /
  Tonight" is still not drawn: the Pullman has no stored coordinate, so no pin may speak for it.
- **f-guide**: the fallback callout's label is the file's own word, "FALLBACKS"; the board composes
  "If CA 8609 is cancelled · fog-prone" from the runbook, which the Getting-there line does not say.
  The standfirst keeps to the facts ("Three nights · Fri 11 → Mon 14 Dec · two in the park, one in
  the city"), not the board's "among the sandstone pillars of Wulingyuan".
- **f-pass**: the date stays between the codes (the names now have their own row, so it never
  wraps) and moves under the names only below 370 px; the ends read "Beijing Daxing" and
  "Zhangjiajie Hehua · T2" (the board: "Zhangjiajie") — the city is not separable from the
  airport's name in the data. The e-ticket row reads "E-ticket · Flight manifest (PDF)", the
  document's own name.
- **f-travelday**: "NOT Capital" is written as the step writes it (capitals), after "by ~16:45"; the
  board writes "Be there by ~16:45 · not Capital".

**Run 3**

- **f-journey**: the route check's counts are what is still to do **from today** — the board's
  "7 legs to book · 1 bed missing" is what the app says before the trip (asserted on 1 Nov); on
  Dec 11, with the Yantai night behind you, it says "5 legs to book". A move row is named by its
  legs and where they end ("HSR → Chongli", "HSR + CA 8609 → Zhangjiajie"), and a stop row carries
  the stop's own name ("Chongli — first-time ski") and no "leaving today" line; the bed chip says
  "Booked" where the board says "Beds booked". The visa line ends "Exit by 22 Dec" (the board adds
  "24:00"). Rows carry no edit button: stops are edited (and deleted) in their guide, runbooks and
  new stops and days on Journey in edit mode.
- **f-journey**: the visa window is one bar under the scrubber (lit to the playhead, the deadline
  ticked) with the value line under it, rather than a bar with its own "from" label.
- **f-city**: a pin's words are the trip file's — a driver card's first clause and its Chinese
  (airports by their code, "DYG airport", as the board writes them); the board's per-pin notes
  ("Park gate · Pullman nearby", "Huatian 450 m", "Land 20:30 tonight") and hop times ("~40 min")
  are not drawn, because nothing in the trip file states them — a booking's own date, time and
  status is shown instead. Labels that cannot be placed are left off (Known issue 11). The chip
  row carries every chapter of the guide, not the board's six.
- **f-guide**: the chapters follow the stop's own blocks (Day by day, Tips, More options, See & do…
  sit where the board shows five chapters); the jump chips live on the city's sheet, not at the top
  of the long read; the Lantern guide's "Is it booked?" detail is Journey's route check now. The
  hero carries three glass buttons the board does not draw: copy the place (the Lantern guide's ⇪),
  its map, and the edit toggle — the app bar steps aside while you read, so edit mode needs a way in.
- Every Daylight board (`*-light`) was set aside by the owner's decision of 2026-09-28.

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

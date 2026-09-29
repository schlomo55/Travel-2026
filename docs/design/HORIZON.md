# Horizon — the implementer's reference

*The design language of Living the dream since 2026-09-28: the app's own icon — a sun rising
behind mountains — as the whole visual system. A night-indigo sky, one warm sunrise accent, an
opal edge on the one thing that matters most, a luminous horizon line, low ridges at the foot of
the screen, and a sun that climbs an arc as the day, the countdown or the trip moves on.*

This file is the implementer's reference; it takes over the role `LANTERN.md` had (that file is
history now). Everything here lives in the code — `app/src/app.css`, `app/src/lib/`, the screens
in `app/src/routes/` — and every rule that can be proved is proved by a gate (§11).

**Sources of truth, in this order**

1. `docs/design/horizon/boards/f-*.dc.html` — the approved screens (dark), `f-motion` /
   `mx-motion` (motion), `horizon-look` (the look). Their data is a frozen example: the app
   draws the trip file's real data, never the mockup's. The `-light` boards are history (§1).
2. `docs/design/horizon/system/tokens.json` + `system/README.md` (+ `system/components/*`) — the
   design system, dark only (v4). `app.css` is its copy; `npm run check:contrast` fails the build
   if the copy drifts.
3. `docs/design/horizon/ROUND4.md` (IA, screens, motion roles), `horizon/HORIZON.md` (the
   design-phase recipes the boards were drawn with), `MAP3.md`.
4. `docs/design/horizon/FEATURES.md` — every feature of the Lantern app and where it lives now;
   `PROGRESS.md` — what each run built, and every deviation from a board, with its reason.

---

## 1. Dark only

The owner removed Daylight on 2026-09-28 ("we dont need Daylight" … "remove it"). There is one
palette, declared on `:root` in `app.css`, and nothing to choose: no `data-theme` attribute, no
boot script in `index.html`, no theme in Settings or in the settings record, no
`prefers-color-scheme`, no `light-dark()`. An older install may still hold `theme: 'light'` in its
settings record and `'light'` under `localStorage['ltd:theme']`; nothing reads either, so that
phone boots into the night like every other (the rehearsal proves it by storing both).

The status bar and the task switcher paint the sky itself (`#0b0c16`): `index.html`'s
`theme-color` meta, the web manifest (`vite.config.ts`) and `lib/logic/theme.ts THEME_COLOR`
carry it, and `theme.test.ts` proves all three equal `app.css`'s `--sky` — and that no source
file carries a light rule or reads a theme. `check-contrast.mjs` fails the build if a
`[data-theme]` rule or a second theme in `tokens.json` ever comes back.

## 2. Tokens (`app.css :root`, copied from `tokens.json`)

**Surfaces.** Screens paint `--sky`. Chrome that floats (nav, sheets, the Find field) uses
`--sky-2` (`--chrome`); cards and tiles `--card` with `--shadow-card`; raised controls on a card
`--card-2` (a field is `--field`). Hairlines are `--line` and never the only boundary of a
control; anything you can press is outlined in `--edge` (≥ 3:1 on every ground).

**Ink.** `--ink` for text and titles, `--ink-2` for second lines, `--faint` for captions and
caps labels — all ≥ 4.5:1 on sky, card and card-2.

**One accent.** `--sunrise` as text and strokes (the active nav item, links, key numbers, the
focus ring); `--sunrise-fill` as a fill (the primary button, the sun disc, you-are-here), always
with `--on-sunrise` text and `--glow-sunrise`; `--sunrise-soft` as a wash. `--lilac` is the quiet
second voice: what is planned and still ahead.

**Status** — a word AND a colour, always: `ok` booked · `warn` not booked / pending · `crit`
missing / a deadline · `lilac` planned. A chip is `*-ink` text on `*-soft` with a `*-line`
border (`.chip.ok|warn|crit|planned`, or `StatusChip`, which picks the word from the booking).

**Opal is an edge, and there is one.** `--opal-1…4` (`--opal` closes the loop) outline the ONE
most important card on a screen (`.opal-edge`: a padding-box fill over a border-box gradient,
with `--glow-opal`) and stroke the sun arc. Never a fill, never behind text.

**The map.** `--route-lit` (the road so far), `--route-today` (today's leg:
lit → today → future), `--route-future` (legs ahead, dotted), `--map-grid`, `--star`.
`--ridge-1…3` + `--ridge-edge` and `--horizon-glow` are decoration, never behind text.

**Photos** carry their own night scrims (`rgba(11,12,22,…)`); the words on them are
`--photo-ink` / `--photo-ok|warn|crit`, gated over a white photo at the scrim's thinnest stop.

**Type** (`--fs-*`, the only sizes): display `Unbounded` (≥ 18 px — wordmark 56, hero code 40,
city title 34, screen 28, screen title 22, card title 18); UI `Figtree` (body 16, row 15, label 14,
caption 13 — the smallest sentence —, chip 12, caps 11 — uppercase micro-labels only); numbers
`Martian Mono` at `font-stretch: 87.5%`, tabular (`.num`/`.mono`: countdown 28 — the loudest
number on a screen —, counter code 52, code 15 / 20, time 13). Chinese is `--font-zh`, the
phone's own face (CJK is not shipped). Fonts: latin woff2 only, precached
(`src/horizon-fonts.css`).

**Space, radius, shadow.** `--space-1…8` (4–32; 16 px gutters), `--radius-pill` (pressable
things, chips), `--radius-card` 28, `--radius-tile` 24, `--radius-photo` 32 (photos, sheet tops),
`--radius-inner` 18; the night lifts with light edges and glows (`--shadow-card`,
`--shadow-float`, `--glow-*`), not dark shadows.

**The legacy bridge** — six Lantern names that still have a reader, at Horizon values
(`--accent-h`, `--plan-card`, `--plan-edge`, `--glow-2`, `--glow-focus`, `--radius`). Run 4
removed the ~80 nobody read. A bridge name leaves with its last reader.

**Identity hues.** `--stop`, `--stop-soft`, `--stop-text` are composed on every element from
`--h` (a stop's own hue) or `--accent-h` (the open trip's): stay bars and route lines only, gated
at the worst hue of the wheel.

## 3. Components — where they live

| Part | Where | Notes |
|---|---|---|
| The shell | `App.svelte`, `routes/TripShell.svelte` | TripShell reads every table of the trip once, as live queries, and draws the place once all have answered (§10) |
| App bar, sub-header, nav | `lib/components/horizon/AppBar`, `SubHeader`, `NavBar` | Now · Journey · Map · Pocket + the round Find (the Map since Map 5c); the app bar's pill is the pinned counter's word ("VISA 19/30"), its whole name the accessible name |
| Sheets | `lib/components/ui/Sheet.svelte`, `EditSheet` + `forms/SchemaForm` | every sheet registers a layer (§5); its first field is focused |
| Chips and buttons | `app.css` `.chip`/`.stamp`, `.btn` (`.primary` — one per screen —, `.ghost`, `.danger`), `.iconbtn` (a 44 px circle) | |
| The map engine | `logic/projection.ts` → `logic/constellation.ts` / `logic/citymap.ts` → `lib/map/TripMap.svelte` | real coordinates only, north up; a place with none is listed under "No pin yet", never guessed |
| The Map tab (Map 5c) | `routes/Map.svelte` (lazy) → `components/map/*` (the place sheet, Guide me, the rail, the filters, the list, the pack import); the street map `lib/map/street/` (maplibre-gl + pmtiles + the night style — its own lazy chunk and budget); the pack `lib/map/pack.ts` (OPFS); you `lib/map/locate.svelte.ts`; the logic `logic/mapplaces.ts`, `logic/wayfind.ts`, `logic/declination.ts` | a place is drawn at `coord ?? pin` and nowhere else, its line is the trip's own, a distance is a straight line from your real position; the pack is imported on the phone and never ships; "Show on map" (`components/map/ShowOnMap`) only where the map draws the place |
| Now | `routes/Now.svelte` (decides the day once) → `components/now/NowHome`, `DayView`, `Todo`, `Lists` | the Concierge sentence `logic/concierge.ts`; the metro line `logic/metroline.ts` |
| Journey | `routes/Journey.svelte` | Replay `logic/replay.ts`; the route check `logic/routecheck.ts` |
| A city and its guide | `routes/Stop.svelte` | `logic/citymap.ts`, `logic/guide.ts`, `components/journey/html.ts` |
| Pocket | `routes/Pocket.svelte` → `components/pocket/*` | the pass `Pass.svelte` (`logic/pass.ts`) |
| White for other eyes | `components/pocket/CounterMode`, `DriverCard`, `components/horizon/PaperChip` | §4 |

## 4. White = for other eyes

Anything a stranger reads — Counter mode for the airline desk, the driver card for a taxi, the
driver-card chips in the Pocket — is `--counter-paper` with `--counter-ink` (`--counter-ink-2`
for the English line, `--counter-paper-2` for a quiet band): the only bright surfaces in the app,
on purpose. No nav, no map, no motion on anything that can be read, no accent but
`--counter-accent` (the mark and the focus ring on white). Full-screen modes are layers, not
routes: Android back closes them.

## 5. Information architecture

Three places and a search (ROUND4.md), a hash router (`lib/state/router.svelte.ts` on the pure
grammar `lib/logic/routes.ts`):

```
#/trips  #/settings  #/backup
#/trip/:id/now[/day | /todo[/packing|lists]]
#/trip/:id/journey[/:stopId[/guide]]
#/trip/:id/map[/:placeId[/go]]          (the place's sheet · Guide me)
#/trip/:id/pocket[/<section> | /<bookingId>]
#/trip/:id/find
```

Every old link resolves (`today → now`, `wallet → pocket`, …) and the address is rewritten in
place. `?d=YYYY-MM-DD` (before the hash) previews a date; a strip says so.

**Layers.** Every sheet and overlay (a Sheet, Counter mode, the driver card, the document viewer)
calls `router.pushLayer(close)`: a history entry of its own, so Android back closes the top layer
first, then leaves the screen. A `close` that returns false vetoes the back (a dirty form): the
entry is put back and the next back press asks again. Every entry carries its place in the
session (`history.state.i`), so a screen's ‹ (`backOr`) goes back only where the app has been, and
`backPast` leaves a screen whose subject is gone. **Close, then go or open** (Run 4b): closing is a
step back that lands later, so `await router.closeTopLayer()` before the next move — the router
also pushes nothing while its own step is on its way — and a delete that strands its screen moves
on from the sheet's `onclose` (a stop from its guide, a booking from its pass), deciding where to
go BEFORE it deletes: the delete can take its screen away, sheet and all, and the `onclose` then
runs as the sheet goes. `pushLayer` returns a release: an overlay calls it as it unmounts (the
Sheet does), so no layer outlives its sheet; a released layer's close still runs, once, but can no
longer veto. `src/tests/router.test.ts` proves all of it on an in-memory session history that keeps the
browser's order of events (45 tests).

## 6. Motion

Every route motion has one job (`system/README.md` § Motion); a moving route always means
something.

| Role | Job | When | Where |
|---|---|---|---|
| **FLOW** | live | always, on today's leg — the only route that loops (dashes 7 7); on the Map, Guide me's leg from you to the place | `lib/motion/FlowPath.svelte`, `.flow` |
| **COMET** | moving through time | once: Replay, a tap on a leg; a flash on arrival | `lib/motion/Comet.svelte`, `.comet-*` |
| **INK** | done | once: the road so far on the first open of a day (remembered per trip · day · legs done), a leg finished with Done | `lib/motion/ink.ts`, `.ink`, `.bloom` |
| **RELAY** | check | once, when Journey opens: rows light in order, pausing amber / red, ending on the count | `lib/motion/relay.ts`, `.relay` |

Besides routes only the you-are-here ping, the sun's breath and the opal edge may move. At most
one loop and one one-shot on a screen; words never move. The pure clocks are in
`logic/motion.ts` (`inkPace`, `relayPlan`, `motionClasses`), Play's state machine in
`logic/replay.ts`.

**The switches** — `App.svelte` paints them on `<html>` from the settings and the page:

- `calm` (Calm motion) and the phone's reduce-motion (`@media`) — every motion to its end state:
  Flow a solid line with an arrow, Comet the leg lit, Ink painted, Relay its final colours. No
  smooth scroll (`state/motion.svelte.ts` `motion.calm` for what CSS cannot reach), and a control
  whose only job is to move a route (the city's ↻) is not offered.
- `no-routes` (Route animations off) — the route motions stop at their end states; the ambient
  ones carry on.
- `app-hidden` (the app is not on screen) — every animation pauses, and resumes where it was.
- `data-offscreen` (Run 4, `lib/motion/offscreen.ts`) — a loop scrolled out of view pauses too:
  `use:offscreen` on the element that loops (the Flow path, the ping, the sun, an opal-edged
  card, the metro line's rails, snow). One IntersectionObserver for the app.

## 7. Lazy screens

Settings, Backup, the trip wizard and the import sheet load the first time they open
(`lib/state/lazy.ts` `once()` + `{#await}`): their chunks are the app's own files, so there is no
network; the promise is kept, so a second opening draws at once; "Opening…" appears only after
300 ms (`.lazywait`). Everything used on the road stays in the entry chunk. The next candidate, if
start-up ever needs the room, is the editors (`SchemaForm` + `forms/specs.ts`).

## 8. The bundle — three numbers

`npm run check:bundle` (last step of `build`, from Vite's manifest):

- **Initial load ≤ 200 KB gzipped** — the entry chunk and every chunk it imports statically:
  what a cold start must load and parse before the first screen draws.
- **All app JS ≤ 260 KB gzipped** — every `*.js` in `dist/assets` but the map engine's, lazy
  chunks included (the Map tab's own screen among them), so nothing hides in a lazy chunk.
- **The map engine ≤ 470 KB gzipped, its worker included** (Map 5c) — what
  `src/lib/map/street/` starts and nothing else reaches, plus the worker file it names: maplibre-gl,
  pmtiles, the basemap's layers and the glue. It loads only when the Map tab first opens.

The service worker is counted in none. A `.pmtiles` file in `dist/` (or the Android copy) fails
the gate: the owner's map pack is imported on the phone, never shipped. The minifier is terser
(five passes, nothing unsafe, short scoped class names — `vite.config.ts` says why). A module the
entry shares with a lazy chunk lands in the entry whole — which is why the "Show on map" doorways
read the small `logic/mapdrawn.ts`, not `logic/mapplaces.ts`.

## 9. The accessibility floor (Run 4)

On every screen and overlay, at 412 px (the boards) and 384 px (the S23 Ultra's real width) —
swept by the rehearsal:

- **Every control has a name** — the one Chrome's accessibility tree gives it; an icon button
  carries `aria-label`, a row's own edit button names its row ("Edit Check out…").
- **Every target is ≥ 44 × 44 px** — its box, or the hit area a `::before`/`::after` gives it
  (`.editbtn`, the map's leg chip). A link inside running text is exempt.
- **Focus is a ring the eye can find** — 2 px sunrise, 3 px out (`app.css`). Where a card,
  group or scroll box clips, the ring goes inside (`outline-offset: -4px`) or the scroll box
  keeps room for it (padding + `scroll-padding-inline`); an invisible file input's label wears
  the ring (`:focus-within`); the Find field is lit while it is typed into. A sideways scroller
  with focusable items takes `use:revealFocus` (`lib/components/ui/revealFocus.ts`): keyboard
  focus brings the item wholly into view — Chrome alone leaves a half-visible item where it is.
- **One h1 per screen, no level skipped** — a screen whose board has no title (Find) carries a
  visually hidden one; Now's is its date.
- **Nothing by colour alone** — a status is a word as well as a colour. The Journey map's amber
  "not booked" legs repeat what the route check right under it says in words.
- **Motion** — §6's switches, on every screen.

## 10. Performance (Run 4)

`node scripts/e2e/perf.mjs [--dist label=dir …]` measures the S23 proxy: headless Chrome at
384 px with the CPU slowed 4×, the built app served locally — a cold start of Now (Dec 11) from
a trace, Journey's Play frame by frame, and the main thread at rest. The rules it keeps:

- **One first render.** TripShell draws a place once every one of its 21 live queries has
  answered (or failed). Drawn as each table landed, Now said false things for a moment ("Tonight's
  bed is not booked yet", before the bookings had answered) and re-derived its whole day again
  and again.
- **Trip data is read raw.** `live()` keeps a query's answer in `$state.raw`: Dexie replaces it
  whole on every change and nothing writes into it in place (writes go to the database through
  `plain()`), so a deep proxy would only put a trap on every property the day's logic reads.
  Keep it that way — never mutate what a live query returned.
- **Read state, don't copy it.** `$state.snapshot()` is for handing state to something that
  cannot take a proxy (a Dexie write — ARCHITECTURE §0); a deep copy made only to read a few
  fields (the weather refresh's stops) is pure start-up cost.
- **Compile a pattern once.** A `RegExp` built per call — worse, one with Unicode property
  classes — costs about a millisecond; `logic/metroline.ts` caches its patterns by source and
  skips them where they cannot match.
- **Sort clock times with `compareClock`** (`logic/dates.ts`), never `localeCompare`: the first
  `localeCompare` builds ICU's collator, a visible slice of a cold start. Names still sort with
  `localeCompare`.
- **Loops stop where no one sees them** — hidden (`app-hidden`) or scrolled away
  (`data-offscreen`).
- **Play is a state machine** (`logic/replay.ts playback`); a frame never advances more than
  100 ms, so an app that was hidden does not jump.

## 11. Gates

`npm run check` (svelte-check + the scripts' tsc) · `npm test` (vitest: `src/lib/logic` and the
state modules, the router included) · `npm run build` = check · `check:contrast` (one palette:
tokens.json ⇄ app.css, every text/ground pair — the street map's words and the pins included —, no
dangling `var()`) · vite build · `check:dist` (no personal data in what ships) · `check:bundle` (§8,
three budgets, no map pack) · `npm run verify:china` (the seed against its sources) ·
`REHEARSAL_PORT=… npm run rehearsal` (the built app, offline, every screen — including §1's
stored-'light' boot, §6's switches, §9's floor at both widths, and the Map tab in WebGL through
SwiftShader with the committed test pack). The map pack itself is built by hand, dev-only network:
`npm run map:pack` (`app/scripts/maps/`); the compass's declination table `npm run map:declination`.

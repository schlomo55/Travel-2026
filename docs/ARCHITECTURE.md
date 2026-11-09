# Living the dream — architecture

*The technical companion to the product plan. Product decisions (name, modules, editing model,
design direction) are recorded in ABOUT.md history and the 2026-07-24 plan; this file is the
implementer's reference. The legacy one-file app was removed from the repository in Nov 2026.*

## 0. Stack (final)

**Svelte 5 (runes) + TypeScript + Vite + vite-plugin-pwa (Workbox) + Dexie (IndexedDB).**
Static output, zero runtime network dependencies — the app is whole with no network at all; the
few things it does online are optional and listed in §8 (since 7 Nov 2026 the street map's two,
§9b) —, deployed to Cloudflare Pages by **direct
upload** (`wrangler pages deploy dist --project-name=living-the-dream`) — never git-integration (privacy:
the repo stays disconnected from any build service). Built `dist/` is **committed** so a working
deployable exists even if the toolchain rots; `package-lock.json` + `.nvmrc` are the version pins.
Known-good fallback matrix if the newest line misbehaves: `vite ^6` + `@sveltejs/vite-plugin-svelte ^5`
+ `vite-plugin-pwa ^0.21` (verified-stable pairings on Node 22).

### Svelte 5 idioms — binding rules
- Reactivity **only** via runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`).
  **`svelte/store` imports are banned** (legacy pattern).
- Shared state lives in `.svelte.ts` modules exporting class instances with `$state` fields.
- Dexie `liveQuery` is bridged once in `lib/data/live.svelte.ts` (a class whose `.current` is
  `$state.raw` — since Horizon Run 4; Dexie replaces the answer whole on every change, so a deep
  proxy only slowed every read — subscribed inside `$effect`); all screens read through it, so any
  DB write re-renders everything — replacing the legacy "re-render the whole tab" calls. **Never
  mutate what a live query returned**: write to the database, and the new answer re-renders.
- Snippets (`{#snippet}`/`{@render}`) over legacy slots; callback props over `createEventDispatcher`.
- `npm run check` (svelte-check, `strict` + `noUncheckedIndexedAccess`) must stay green.
- **`$state.snapshot()` before any Dexie write of an object that lives in `$state`.**
  Svelte deep-proxies such objects and IndexedDB cannot structured-clone a Proxy —
  the symptom is `DataCloneError: … could not be cloned`. Building a fresh object
  from primitives (the trip wizard) or spreading (`{...item, done: true}`) is
  already plain and safe; passing a stored object straight through is not.

### Fonts
**Horizon (Run 1, 2026-09-28):** self-hosted via Fontsource (bundled → hashed → precached):
**Unbounded Variable** (display, ≥18 px), **Figtree Variable** (UI, normal + italic) and
**Martian Mono Variable** (numbers and codes, `font-stretch: 87.5%`, tabular), declared
latin-only and woff2-only in `src/horizon-fonts.css` — 4 files, 130.5 KB, replacing the Lantern
set (Fraunces, Instrument Sans, IBM Plex Mono, Special Elite, Caveat; 442.9 KB of woff2).
**CJK is deliberately not shipped** (4–15 MB): `.zh` text uses `var(--font-zh)` → system
`Noto Sans SC`, present on the owner's Android phone, offline by definition.

### Design system
`src/app.css` is the **Horizon** token system (`docs/design/horizon/system/tokens.json` +
`README.md`; Run 1, 2026-09-28) — **dark only since Run 4** (owner, 2026-09-28): one palette on
`:root`, no theme to choose, store or apply before paint; a `theme: 'light'` an older install
stored is ignored. The implementer's reference is **`docs/design/HORIZON.md`**. Sunrise is the one
action colour, the opal edge marks the one thing that matters now, white is for other eyes
(Counter mode, driver cards). A small LEGACY BRIDGE at the end of `:root` keeps the six Lantern
token names that still have a reader (Run 4 removed the rest). Motion roles (Flow · Comet · Ink ·
Relay) and the `calm` / `no-routes` / `app-hidden` classes: `logic/motion.ts` (the pure clocks)
and `src/lib/motion/` (the parts; Run 2) — plus, since Run 4, `data-offscreen` from
`lib/motion/offscreen.ts`: a loop scrolled out of view pauses. The map engine (Run 2): `logic/projection.ts` → `logic/constellation.ts` →
`lib/map/TripMap.svelte`; a coordinate is only ever one stored on a Stop, Spot, ShowCard or
Booking — never guessed. `npm run check:contrast` checks the token file against
`tokens.json` (one palette — a `[data-theme]` rule fails it), resolves every `var()`, measures the text/ground pairs and fails
the build on any drop below 4.5:1 (body) / 3:1 (large, interactive boundaries) or on a `var()`
that names no token. `npm run check:bundle` (inside `build`) gates two numbers since Run 3c:
the JavaScript a cold start loads (the entry chunk and its static imports, from Vite's manifest)
≤ 200 KB gzipped, and all app JavaScript, lazy chunks included, ≤ 290 KB (§11 › Bundle budget; 260 until 2026-09-29,
275 until 2026-10-18, 285 until 2026-11-07); the map engine (≤ 470 KB) and, since 2026-11-07, the map builder (≤ 12 KB,
§9b) are lazy chunks with budgets of their own.
Feature map (every Lantern feature → its Horizon home): `docs/design/horizon/FEATURES.md`.

## 1. Repo layout

```
Travel-2026/
├─ README.md / ABOUT.md          # rewritten at cutover; ABOUT kept as v1 rationale
├─ docs/ARCHITECTURE.md          # this file
├─ docs/DRIVE-SETUP.md           # the owner-only Google console steps for §7a Drive backup
├─ docs/NEW-TRIP.md              # the five-step loop that turns a brief into a trip seed (§6a)
├─ docs/TRIP-BRIEF-TEMPLATE.md   # the blank brief; docs/examples/ holds one filled in
├─ docs/design/HORIZON.md        # the design system in the code: the implementer's reference
├─ docs/design/horizon/          # the boards, the system (tokens.json), FEATURES, run briefs
├─ docs/design/LANTERN.md        # the previous design language (history since Horizon)
├─ seed/demo-2027.trip.json      # generated demo trip ("TEST — Demo China") — made up, never reaches dist/
└─ app/                          # the Living the dream PWA (npm project)
   ├─ scripts/build-demo-seed.ts    # demo-trip/* → seed/demo-2027.trip.json (npm run seed-build)
   ├─ scripts/verify-demo-seed.ts   # npm run verify:demo — the gate `npm run deploy` runs
   ├─ scripts/make-icons.ts         # icon-src/*.svg → public/icons/*.png (committed)
   ├─ src/
   │  ├─ main.ts  App.svelte  app.css (design tokens)
   │  ├─ routes/                 # one component per screen + editors/
   │  ├─ lib/model/              # types.ts, ids.ts, validate.ts
   │  ├─ lib/db/                 # db.ts (schema), migrate.ts
   │  ├─ lib/data/               # repos per entity + live.svelte.ts + drive.ts/driveConfig.ts
   │  ├─ lib/state/              # appState, tripContext, router, toast, undo (.svelte.ts)
   │  ├─ lib/logic/              # pure fns: dates, phase, counters, ics, csv, mdlite,
   │  │                          #   stats, backup, legacyImport, geo, weather,
   │  │                          #   prices, booked, drive, convert, health, zones,
   │  │                          #   projection, constellation, citymap, metroline,
   │  │                          #   concierge, todo, glance, motion (all unit-tested)
   │  ├─ lib/map/                # TripMap.svelte — draws a constellation (Now, shelf, Journey)
   │  ├─ lib/motion/             # Flow, Comet, Ink, Relay (the only moving parts)
   │  ├─ lib/i18n/strings.ts     # ALL UI strings, typed — single-language today, swappable
   │  └─ lib/components/         # ui/ forms/ cards/ horizon/ now/
   └─ dist/                      # committed build output
```

## 2. Conventions

- Ids: `crypto.randomUUID()` (`ids.ts` has an insecure-context fallback). **Seed ids are
  deterministic slugs** (`dm27-stop-shanghai`, `dm27-alarm-03`) — legacy tick import maps onto them
  and seed re-import is an idempotent upsert.
- Dates: `ISODate` = local-naive `YYYY-MM-DD` everywhere (a trip day is a wall-calendar concept).
  **Never `new Date('YYYY-MM-DD')`** (UTC-parse trap) — only `parseYmd` in `dates.ts`; unit-tested.
  Clocks use IANA zones via `Intl.DateTimeFormat` (offline, DST-correct). `.ics` stays floating-local.
- Money: integer minor units in the trip's home currency (`homeMinor`) + as-entered
  `amount/currency/rateToHome` snapshot — the legacy int-cents semantics, generalized.
  A booking's `priceNote` stays free text (`~$376`, `$17–40/n`, `$550–950 (5n)`) because that is
  how it was quoted; `logic/prices.ts` reads those strings into minor units and `logic/booked.ts`
  rolls them into the "Booked & committed" breakdown. **Anything the parser cannot read returns
  null**, is shown as *price not recorded*, and stays out of every total — a price is never
  guessed, averaged or inferred.
- Rich text: **md-lite** strings (`**b**`, `*i*`, `[label](url)`, newlines) rendered by
  `mdlite.ts`. Never raw HTML in the DB (imported files must not inject markup). The seed builder
  converts legacy `<b>`/`<a>`/entities to md-lite. **The fold** (9 Nov 2026): a line of its own
  reading `--- details ---` ends a text's short version; everything after it is folded under a
  **Details ▸** toggle (a native `<details>`), wherever that text is drawn — a booking note, a day's
  items, a stop's blocks, a task's detail. The plain-text projection drops the line, so search,
  titles and exports keep every word. A data convention, not a field: a trip file opts in line by
  line, and an old file renders exactly as before.
- All UI strings in `lib/i18n/strings.ts` (typed const) — English-only today by decision. One
  exception, for the start-up bundle: the Map's photo words (`lib/i18n/photos.ts`, Map 5f), which
  only the lazy Map tab and Settings read, so they load with those screens.

## 3. Data model (summary — `lib/model/types.ts` is authoritative)

Per-trip entities (all carry `tripId`): `ComplianceCounter` (generalized visa clock: startDate,
countStartsDayAfter, limitDays, hardDeadline, plannedEndDate, pinned → appbar pill) ·
`Stop` (kind `stop|transit`, hue, `[start,end)` occupancy, ContentBlocks + recoBlocks) ·
`DayPlan` (unique per date; planItems, bed, runbookId) · `DayDefault` (stop+weekday fallback —
generalizes kunyuDefault/kunyuSunday; resolution: DayPlan → DayDefault → none) ·
`Runbook` (steps; per-date ticks in `checkState` keyed `trip:run:runbook:date:idx`) ·
`Booking` (discriminated union flight/train/hotel/activity/other; status booked/pending/walkin/
cancelled; counter-facing `code/codeLabel/codeSub`, `meta[]` k/v chips, `gmailQuery`, `manageUrl`,
`alert`) · `WalletCard` (legacy docs: rows, optional editable `balance`) · `DocumentFile` metadata
+ `DocumentBlob` (same id, separate table so lists never deserialize megabytes) · `Task` (due,
priority, md-lite "why" detail, link) · `Alarm` (date+time, .ics export) · `PackingItem` ·
`Checklist` (generalizes the before-you-fly apps list) · `Expense` + `ExpenseCategory`
(`legacyKey` enables old-data import mapping) · `ShowCard` (kind phrase/place; native/meaning/
verify/pending/isKey — feeds the full-screen driver overlay) · `EmergencyContact` ·
`InfoCard` · `TripNote` · `DayPick` (see §3a).

**Optional fields added 2026-11-07** (QA fix list; every one optional, a file without them loads
as before, and `logic/backup.ts § normalizeBundle` drops any that is not a string — `script`
must be `'Hans'` or `'Hant'`):
- every **booking**: `native` — the place's name in the local script (a Chinese hotel name), and
  `phone` — its own number as written. With the existing `address` (LOCAL script) and `addressEn`
  (romanised) they make a stay's **driver card** (`logic/pocket.ts § stayCard`): `native` +
  `address` large, `addressEn` and `phone` small. An `address` in Latin letters only is read as the
  English one. No `native` → the Chinese half of a two-script title, else a Chinese `mapQuery`.
  A stay with neither a local name nor a local address has no card. `driverCards` lists the trip's
  place cards and every stay's card in trip order (first day in a plan · the stop the card lies in
  · beside the card before it; a stay at its check-in).
- every **ShowCard**: `pinyin` (under the Chinese on the full-screen card), `set` (the phrase list
  groups by it), `script: 'Hant'` (Traditional, `lang="zh-Hant"`, its own face; default
  Simplified), `region` (e.g. "HK", printed as a label), `phone`. A phrase may hold `___`, printed
  as written (a visible blank).
- every **Stop**: `metro` — the city has one; absent, the stop's own words decide
  (`logic/dayroute.ts § hasMetro`). A leg is offered the metro only where there is one, and on a
  day whose plan says hike/trek/trail its legs (≤ 12 km, no transport place at either end) walk
  and offer nothing else.
Global: `Settings` (activeTripId, lastBackupAt, lastMutationAt, backupNagDays, persisted,
weatherOnline, calmMotion, routeAnimations — no `theme` since Horizon Run 4: the app is dark only, and a stored one is ignored) ·
`PackingTemplate` · `MetaKV`.
`Trip` itself: dates, homeCurrency, `currencies[]` (code/symbol/rateToHome, editable),
`accentHue` (drives `--accent-h`), `clocks[]` (IANA), budgetTotalMinor, `driverSuffix`
(e.g. 请带我去这里 / "Please take me here"), archived, and the optional **`mapCoverage[]`** —
coverage-only points for the offline map pack (see §9b):

```json
"mapCoverage": [
  { "for": "<id of a spot, show card or booking>", "stopId": "<id of one of the trip's stops>",
    "label": "What the place is", "at": { "lat": 0.0, "lng": 0.0 } }
]
```
Each point only SIZES the pack's region (`lib/map/region.ts`) for a place the trip goes to that
has no verified position; it is never drawn, listed or opened. It is used only while the entity
named by `for` exists and has no position of its own, and only when `stopId` is one of the
trip's stops — pin the place and its point drops out by itself. A trip without the field gets
none. The app reads it from the trip record, so it travels in the trip file and in backups.

## 3a. Free-time blocks & `DayPick` (Gap B, 2026-08-12)

A day is not a flat list. The gaps between the things that already carry a clock become objects on
Home — "3 h 20 m free · 14:10–17:30" — each offering 2–4 of the trip's own researched options.
Two pure modules and one table:

- **`logic/timeline.ts § freeBlocks`** — `FixedPoint[] → FreeBlock[]`. A fixed point is a plan line
  that BEGINS with a clock (`planFixedPoints`) or a booking that states one
  (`logic/commitment.ts § bookingFixedPoints`: a move's `dep`→`arr`, an activity's `time`, a leg
  landing here from yesterday). A stay's check-in states no hour anywhere in this trip's data and
  is therefore not a point. Untimed prose never breaks a block. Blocks are derived at render time
  and **never stored**.
- **`logic/options.ts`** — reads a stop's `options` + `recoBlocks` lines into candidates. Every
  field is lifted verbatim out of the line itself: the price it quoted, the hours it stated, the
  `book ahead`, the `(verify)`, the `⭐`. Nothing is looked up, defaulted or averaged. The one
  derived number is a **great-circle** distance, drawn only where the candidate's spot AND the
  block's anchor both carry a coordinate, labelled `≈ 2.3 km from …` — never a travel time.
- **`DayPick`** (table `dayPicks`, schema v2) — the ONLY plan item the app itself writes. It is not
  a `DayPlan.planItems` entry, because a DayPlan is authored text, because re-importing the seed
  upserts every DayPlan, and because half the trip's days resolve through a `DayDefault` and have
  no row to write into. `origin: 'picked'` is the provenance marker; it rides in the backup
  envelope (`TripBundle.dayPicks`, optional — no trip FILE ever carries picks) and the round trip
  is tested in `src/tests/picks.test.ts`.

Three judgement calls, recorded here because nothing in a trip file decides them:

1. **The waking window is 08:00–22:00 and the floor is 60 minutes** (`DAY_OPEN`/`DAY_CLOSE`/
   `MIN_BLOCK`). At midnight-to-midnight every day would open with a six-hour block across the
   hours you are asleep in.
2. **The closing bound is asymmetric.** Between two fixed points the day itself proves the gap.
   *After* the last one, a block is drawn only where that point STATED an end — "19:30 HK Phil"
   says when the concert starts and nothing about when it finishes.
3. **A pick carries no time.** Stamping the block's start onto it would state a fact nobody wrote,
   and would split the block at its own opening edge so a second pick had nowhere to go. Picks land
   untimed, beside the trip file's own untimed prose.

Free blocks are not drawn on runbook days: there the checklist IS the day.

**A planned day is not a free one (QA fix list, 2026-11-07).** "12 h free · nothing timed yet
today" showed on a theme-park day, the wall hike and the races. The day screen now asks
`timeline.ts § dayBlocks`, which wraps `freeBlocks` with three rules: a plan line that says the
day is taken whole ("the whole day", "all day", "full-day") leaves no block; on a day that lists
untimed things to do (untimed plan lines, a ticket with no `time`) the OPENING block is not drawn
— the gaps between two clocks and after a leg that lands still are; and the day's alarms and
timed to-dos CUT blocks but never create one. What a block offers is narrowed too
(`options.ts § offeredOf`, read by `dayOffers`, so the Map's "Add to my day" agrees): only a block
that is a menu (no date, status mark, tips or budget in its heading), only a line that is an
option (no "Label:" name, no ✅/⏳/❌, no clock in its name), and nothing from a block whose lines
mostly fail.

## 4. Dexie schema v1 (`lib/db/db.ts`)

```
trips            'id, archived, start'
counters         'id, tripId'
stops            'id, tripId, [tripId+order]'
dayPlans         'id, &[tripId+date], tripId'
dayDefaults      'id, tripId'
runbooks         'id, tripId'
bookings         'id, tripId, [tripId+date], [tripId+kind]'
walletCards      'id, [tripId+order]'
documents        'id, tripId, bookingId, walletCardId, addedAt'
documentBlobs    'id'
tasks            'id, tripId, [tripId+due]'
alarms           'id, [tripId+date]'
packingItems     'id, tripId, [tripId+group]'
packingTemplates 'id'
checklists       'id, [tripId+order]'
expenses         'id, tripId, [tripId+date], [tripId+categoryId]'
categories       'id, [tripId+order]'
showCards        'id, [tripId+kind]'
emergency        'id, [tripId+order]'
infoCards        'id, [tripId+order]'
notes            'tripId'
checkState       'key, tripId'
settings         'id'
meta             'key'
```

**v2** (2026-08-12, additive only): `dayPicks 'id, tripId, [tripId+date]'` — see §3a.

Trip delete / per-trip export = `where('tripId')` sweeps in one `rw` transaction.
**Migrations**: additive `db.version(n)` blocks only, kept forever, idempotent upgrades,
fixture-vault tests via `fake-indexeddb`; `meta.lastOpenedAppVersion` turns a downgrade into an
honest error instead of a Dexie VersionError crash; the update toast nudges a backup first.
**Persistence**: `navigator.storage.persist()` on first gesture; result + `storage.estimate()`
surfaced on the Backup screen.

## 5. Shell

**Hash router**, hand-rolled (~100 lines, `lib/state/router.svelte.ts`): direct-upload Pages
needs no `_redirects`, Workbox `navigateFallback` stays trivial, Android back gets correct history.

**Horizon IA (Run 1, 2026-09-28)** — three places and a search (ROUND4.md):

```
#/            → activeTrip ? #/trip/:id/now : #/trips
#/trips  #/settings  #/backup
#/trip/:id/now[/todo[/packing|lists]]      Now: the day, To do
#/trip/:id/journey[/:stopId]               Journey: route, coverage, stats, every stop; a city
#/trip/:id/pocket[/<section>|/<bookingId>] Pocket: home, a list or tool, or a booking's pass
#/trip/:id/find                            Find
```

The grammar is pure (`lib/logic/routes.ts`, tested). **Every link ever written
still resolves**: `today → now`, `itinerary → journey`, `wallet → pocket`
(`wallet/<id>` → the pass, `wallet/spend` → `pocket/money`), `tasks → now/todo`,
`info → pocket`, `map`/`stats → journey` (scrolled to the section),
`docs → pocket/docs`; the address bar is rewritten to the new name with
`replaceState`, so back never meets an old one. `goTab()` still accepts the old
tab ids. Counter mode and the driver card are full-screen LAYERS (pushLayer), not
routes. Nav: Now · Journey · Pocket + the round Find (`components/horizon/NavBar`).

- Trip context: tripId from the URL; `tripContext.svelte.ts` caches a per-trip store of
  liveQueries — the place is drawn once every one of them has answered (Run 4: drawn with the
  first, it was drawn again as each other table landed); entering a trip sets `--accent-h`
  from `trip.accentHue`;
  `Settings.activeTripId` updated on navigation.
- **Sheets & Android back**: every editor/overlay pushes `history.pushState({layer:n})`
  (`router.pushLayer` — a Sheet, Counter mode, the driver card, the document viewer);
  `popstate` closes the top layer. Back = close sheet → leave screen → minimize at root. Dirty
  forms intercept the pop, re-push and ask to discard. Closing is a step back, and a step back
  lands later (it takes its target when it is called): `closeTopLayer()` resolves once the layer
  has really closed (false if a guard kept it), and while the router's own step is on its way
  it pushes nothing — `go`, `replace`, `backOr`, `backPast` and a new layer wait for it (Run 4b:
  a close followed at once by a go or a second sheet was undone by the late step). `pushLayer`
  returns a release that an overlay calls as it unmounts, so a sheet that goes without being
  closed takes its entry with it (its close still runs, once, but can no longer veto — so a delete
  that takes its own screen away decides where to go before it deletes). Unit-tested since Run 4
  (`src/tests/router.test.ts`, on an in-memory session history that keeps the browser's order
  of events).
- **Where an entry sits in the session (Run 3c)**: every history entry the app makes carries
  its index, `history.state.i` — stamped as it is made (a hash change, a layer), found again on
  back and forward — so "is anything of this app behind me?" is exact (`at > 0`). A screen's
  own ‹ (`backOr`) goes back only then, else up. `backPast(gone, fallback)` leaves a screen
  whose subject no longer exists: it steps back past every entry `gone` claims (never past the
  start of the session), then shows `fallback` — as landed, in place of the last dead entry, or
  on top. Deleting a stop from its own guide uses it: the sheet closes first (its entry and its
  back handler go), then the app steps back past the stop's guide and city to the Journey; the
  shell draws no "Stop not found" while a sheet is open (`router.depth`) or while it steps
  (`router.leaving`). The guide keeps, in its own entry, where it was opened from (`from` — its
  close button says where it goes) and where it was left for a pass (`y` — back restores it).
- **Lazy screens (Run 3c)**: Settings, Backup, the trip wizard and the import sheet are imported
  the first time they open (`lib/state/lazy.ts` `once()` + `{#await}`), so a cold start does not
  parse them. Their chunks are the app's own files (the APK's assets, the service worker's
  precache — `**/*.js` is globbed), so this costs no network; the promise is kept, so a second
  opening draws at once; a quiet "Opening…" appears only after 300 ms, and a chunk that cannot be
  read says so. A sheet's first field is still focused when a lazy body arrives (`Sheet.svelte`).
  Everything used on the road — Now, Journey, the city and the guide, Pocket, Find, the shelf —
  stays in the entry chunk.
- **`?d=YYYY-MM-DD` preview kept** (search param *before* the hash), plus an in-app picker
  (Settings) and a persistent "Previewing …" pill. All date-derived UI reads `appState.now`
  (`$state`), re-armed at local midnight +5 s and on `visibilitychange`.

**Forms**: schema-driven. `FieldSpec` union (text, multiline, mdlite, date, time, number, money,
select, toggle, stringList, kvPairs, hue, currencyPick, entityRef) + per-entity `FormSpec`
(groups, validate, to/fromEntity) rendered by one `SchemaForm` sheet. **An edit keeps every field
its form does not show** (Horizon Run 4): each `fromValues` starts from the record and lays the
form's fields over it — so a stop keeps its spots and options, a day its place links, a booking
its "or else" flag, its group, its stop and a rail leg's ends; changing a booking's kind drops only
the old kind's fields the new kind lacks (a train and a road leg keep their ends — Run 4b), and a
nested object (a flight's end, a card's row, a checklist item) keeps what else it carries. **A map
target follows the place it was built from** (Run 4b): change a flight's From airport, a place
card's native text, a stay's name or a ticket's venue and the coordinate, search and address built
from the old one go (the fields the form itself shows stay the owner's), and the button searches
the new name. `src/tests/specs.test.ts` saves every record of every seed through its
editor unchanged and gets the record back. Bespoke editors only where
structure earns it: flight-leg editor, expense quick-add, document upload, template apply, trip wizard.
Every control is ≥44 px and takes a gold focus halo from `app.css`; `toggle` fields render as the
shared `.switch`.

**Empty states**: `components/ui/EmptyState.svelte` draws every absence in the app — dashed border,
gold-ringed glyph, a Fraunces line, one sentence and (where the screen honestly has one) the button
that fills it. Copy lives in `strings.ts` under `S.empty`, one entry per surface.

**Undo**: destructive repo ops capture affected records and return `{label, undo()}` → toast with
UNDO (6 s). Trip deletion forces an export first.

## 6. Seed pipeline (demo trip)

The first trip's pipeline — `scripts/build-china-seed.ts`, which sliced the trip out of
`legacy/index.html` and the `sources/` documents, plus `scripts/china/` and `verify-china-parity.ts`
— was removed in Nov 2026 together with that trip's files: it only worked on them. The owner's
own trips are imported on the phone from private files, never from this repo.

Its replacement is a made-up trip: `scripts/build-demo-seed.ts` (`npm run seed-build`) builds
`seed/demo-2027.trip.json` — "TEST — Demo China", slug `dm27`, 2027-03-19 → 04-18, Hangzhou →
Shanghai → Suzhou → Huangshan → Chengdu → Yangshuo → Longji → Guilin → Hong Kong & Macau — from
`scripts/demo-trip/*` (`base.ts` says what it is; `assert.ts` is the gate that fails the build).
Every business is a "Sample …" and every booking code starts `DEMO`. Builds are deterministic
(§6a). `npm run verify:demo` (`scripts/verify-demo-seed.ts`) rebuilds it in memory, compares byte
for byte with the committed file and re-runs the assertions; it replaces `verify:china` in
`npm run deploy`. The tests and `npm run rehearsal` run on it. The generic pin rules that served
the first trip's coordinate pass moved to `scripts/maps/pins/`.

**The deployed bundle stays sterile**: no seed in `dist/`, no auto-offer. Empty vault offers
"Create a trip" / "Import a trip file"; a trip reaches the phone as a user-provided file.
Importing an existing trip id offers Replace (undoable via pre-captured snapshot) or Cancel.

### 6a. The generic trip pipeline (2026-08-26)

§6's first pipeline reverse-engineered a trip out of a one-file app and source documents, which
was the right shape exactly once (it is gone, see §6). Every trip starts
from a **brief** instead — `docs/TRIP-BRIEF-TEMPLATE.md`, filled in as prose — and is compiled by
a Claude session into the same `TripBundle` §6 emits. The loop the owner follows is
[NEW-TRIP.md](NEW-TRIP.md); this section is what a developer needs.

`app/scripts/trip-template/` is a **scaffold, not a trip**: no npm script builds it and nothing in
it reaches `seed/`. Copy the folder, change `SLUG`, work down the `FILL ME` markers. It splits one
file per brief section so a filled folder can be diffed against the brief it came from —
`base.ts` (slug, `SEED_TS`, dates, stop keys, the `id()` helper), `trip.ts` (§1 header), `stops.ts`
(§4 cities), `bookings.ts` (§2/§3/§5 — **where ✅/⏳ becomes data**), `days.ts`, `admin.ts`,
`cards.ts`, `bundle.ts`. The worked example is `trip-template/example/` (slug `tx00`, compiled from
`docs/examples/porto-lisbon-mini.brief.md`), entry `scripts/build-template-example-seed.ts`,
`npm run seed-build:template-example` → `seed/template-example.trip.json`.

**`assert.ts` is imported, not copied.** One gate for every template-built trip, parameterised by
slug — so a rule earned by one trip's mistake is inherited by all of them, at the cost that
changing it changes every trip's gate at once. Three of its rules carry the weight:

- **The id rule.** Dexie primary keys are global, not scoped per trip (§4), so an id shared with
  another trip raises no error on import — it silently **overwrites** that trip's record. Every id
  therefore starts with `${slug}-` and goes through `base.ts`'s `id()` helper, never typed by hand;
  `collectIds()` walks every collection *including the nested ones* — stop blocks, stop spots,
  checklist items, document metadata — and no foreign slug may appear anywhere in the serialized
  output. `KNOWN_SLUGS` (`cn26`, `il26`, `tx00`) **needs a line adding for every real trip you
  create**. A collection nobody walks is a collection nobody guards.
- **Coverage, answered by the app's own code.** Every night must be answered for — a held stay, a
  deliberate walk-in, a night aboard an overnight leg, or an explicit ⏳ placeholder. The check
  calls `buildCoverage()` / `coverageStamp()` from `src/lib/logic/coverage.ts` rather than
  restating the logic, as do `resolveDay()`, `currentStop()`, `tripDays()`, `toHomeMinor()` and
  `isBackup()` elsewhere in the file — so the seed and the app can never disagree about what a
  chip would say. A ⏳ OPEN line must compile to **both** a `status: 'pending'` booking *and* a
  `Task` with a `due`; a placeholder with no to-do behind it is refused.
- **The privacy scan**, `privacyValues`, empty by default — a new trip has nothing to leak yet.
  The hook exists because of the first trip (§6, and `scripts/check-dist-clean.ts`); anything
  passport-shaped is refused unconditionally, in every trip, whether or not it was declared.

**⏳ is amber and only ever amber.** `status: 'pending'` yields `state: 'pending'` in
`buildCoverage()`, and `toneOf()` escalates to `crit` on `'missing'` alone — so an unbought room
never turns red however close the date gets, while a night with *nothing* against it does. That
asymmetry is the whole point of the marker: it removes the temptation to write an unbooked bed in
as booked because green looks better than amber.

**Determinism**, as §6: no `Date.now()`, no argless `new Date()`, no randomness. Every timestamp
comes from the `SEED_TS` literal, so two runs are byte-identical and a rebuild's diff means the
*trip* changed. `assert.ts` flags any timestamp outside 2000–2100 as a heuristic backstop — it
catches a stray `Date.now()`, not a mistyped literal.

## 7. Backup / export — one envelope

```jsonc
{ "format": "livingthedream/backup", "formatVersion": 1, "kind": "vault" | "trip",
  "exportedAt": "...", "appVersion": "...",
  "settings": {...}, "packingTemplates": [...],          // vault only
  "trips": [{ "trip": {...}, ...all child arrays..., 
              "documents": [{ "meta": {...}, "dataBase64": "..." }] }] }
```

- Vault export: gzip via native `CompressionStream` → `livingthedream-vault-YYYYMMDD.json.gz`;
  plain `.json` also accepted on import (the seed stays readable in the repo).
  "Copy backup without documents" keeps the legacy paste-into-a-note habit.
  The name is built by `logic/backup.ts → backupFileName()` — one function, so the Backup screen
  can print the filename *before* you tap and the download can never disagree with the promise.
- Per-trip export; per-trip expenses CSV
  (`date,category,description,amount,currency,rate_to_home,home_amount,paid_with,refund`).
- **Legacy imports** (M5): (a) old-app fullExport `{app:'china2026', data:{…}}` — expenses,
  `task-*`/`pk-*`/`app-*` ticks, `alarm-<i>` by index, `run-<id>-<date>-<i>` → checkState,
  notes, giftBalance, packCustom; (b) bare legacy expense array (guide format) via `legacyKey`.
- Stale-backup nag: every mutation stamps `lastMutationAt`; nag when backup older than
  `backupNagDays` (default 7) *and* dirty; escalates to warn style during an active trip.
  Auto-safety export before any destructive import.

### 7a. Google Drive backup — opt-in, off by default (Lantern Run C, 2026-08-13)

The one failure a file in Downloads cannot survive is the phone not existing. Same envelope,
same bytes, gzipped, uploaded to Drive's **app-private folder**.

| | |
|---|---|
| Scope | `drive.appdata` **only** — the app can see the files it wrote and nothing else in the owner's Drive, and Google does not surface that folder in a file picker |
| Payload | the `livingthedream/backup` vault envelope, gzipped. Filenames `ltd-vault-<ISO>.json.gz`; last **10** kept, older pruned after each successful upload, and **only files this app named are ever deleted** |
| When | after the owner opts in, debounced ~20 s after a mutation, min 5 min apart, **online only**. Offline is a silent no-op — never a spinner, never an error (§RULES: offline is normal) |
| Restore | downloads a version and hands it to the **existing** `ImportSheet` staged preview. A restore is never applied blind |
| Tokens | Dexie `meta` (`drive.tokens`). `meta` is not part of the export envelope, so a backup can never carry the credentials that wrote it — asserted in `src/tests/drive.test.ts` |
| Auth | Google refuses OAuth in a WebView. **Native:** system browser + **PKCE** (S256) + custom-scheme redirect `com.livingthedream.travel:/oauth2redirect`, intent filter in `AndroidManifest.xml`. **PWA:** Google Identity Services token client (access token only, no refresh token — re-consent on the web is a tap) |

Split deliberately in two: `lib/logic/drive.ts` is **pure** (PKCE, expiry, pruning, filenames,
the state machine) and carries the proof burden, because the real login is a step only the owner
can take; `lib/data/drive.ts` owns `fetch` and Dexie.

**`mayReachDrive({state, online})` is the single gate — nothing calls `fetch` without it.** The
shipped config has `webClientId: null` and `androidClientId: null` (`lib/data/driveConfig.ts`),
so the state is `unconfigured` and there is no code path to a request at all. The rehearsal
asserts zero `googleapis.com` / `accounts.google.com` calls across the whole walk.

**The credential is owner-only and is not in this repo.** Google issues a client id to a person,
in a console, bound to the package name and the release keystore's SHA-1. Inventing one would be
a fact the app states without knowing it. Console steps, the keystore SHA-1, where to paste the
ids, the one remaining native wiring step, and the on-device test script: **`docs/DRIVE-SETUP.md`**.

## 7b. Small road tools (Lantern Run C, 2026-08-13)

Three additions, all built out of data the trip already carried. None of them adds a fact, and
each renders nothing at all where the data cannot support it.

- **Converter** (`lib/logic/convert.ts` → `ConverterCard.svelte`, on Info). Never fetches. A
  rate comes from one of three places, in this order of trust: **edited** (typed off the board,
  stored in `meta.convert.rates` with the date it was set), **expense** (the `rateToHome`
  snapshot on the newest expense in that currency, with that expense's date), or **trip** (the
  rate the trip file was built with, which has no date and is therefore labelled as an
  assumption rather than given one). Conversion goes via the home currency and returns `null`
  rather than `0` where it cannot be done — a converter that prints `0.00` is stating a price.
- **Health & insurance** (`lib/logic/health.ts` → `HealthCard.svelte`, on Info). Gathers the
  insurance wallet card, the 24-hour assistance line, the local emergency numbers and the trip's
  own medicine note onto one screen. Selectors match on **kind, tag and word** — never on
  an insurer's name or any other fact of one trip — so a second trip gets the section for free and
  a trip carrying none of it gets no section rather than an empty promise. The one nudge it
  makes ("is your insurance PDF on this phone?") fires only where there IS a policy and there is
  no document tagged `insurance`.
- **Two clocks** (`lib/logic/zones.ts` → `BookingCard.svelte`). **There is no airport table
  here and no zone is guessed.** The offset is derived from figures the documents already carry:
  `shift = (arrival + dayOffset) − departure − duration`, where `duration` is the airline's own
  printed flying time. A leg with no duration, or an approximate one (`~2 h`), or a shift under
  30 min, or one that is not a whole quarter-hour, produces **nothing**. On a trip with long-haul
  legs to a one-timezone country that yields exactly the international legs and leaves every
  domestic leg silent — which is correct.

## 8. Service worker (vite-plugin-pwa)

`registerType:'prompt'` (update = consented reload toast) · precache globs include `woff2` ·
`navigateFallback:'index.html'` · `ignoreURLParametersMatching:[/^d$/]` ·
`cleanupOutdatedCaches` · `maximumFileSizeToCacheInBytes: 15 MB` (default 2 MB silently drops
fonts). No runtime caching routes. The app makes exactly **four** kinds of runtime request, each
disclosed in plain words on the screen that owns it and each optional: the weather fetch
(open-meteo, toggleable, §weather), the opt-in Drive backup (§7a, `null` credential by
default), and — since 7 Nov 2026, in the Android app only — the street map's two (§9b): street
tiles the saved map pack does not hold, from the Protomaps API, only while the phone is online;
and a map pack built when the owner taps **Build map for this trip**. Offline the app makes
none at all; the rehearsal asserts it. There is no analytics and no crash reporting, and there
never will be. Everything else
is an outbound *link* (Gmail search, manage/booking URLs) with the VPN small-print.
User documents live in IDB, not the SW cache — the legacy "is the PDF really cached" UI is
obsolete by design. SW behavior is verified on `npm run preview` builds, never dev.
**The native app runs no service worker** (`main.ts`): the APK already carries every file, and
a worker there is a staler second copy that keeps serving the old build after an update — so on
Capacitor every worker is unregistered, every cache dropped and the update banner removed, and
only the browser registers one. `src/tests/native.test.ts` pins that branch (Run 4).

## 9. Route map & stats

- `routemap.ts`: pure `buildRouteMap(trip, stops, bookings)` → schematic SVG model. Vertical
  time spine (y linear in days, ~16–20 px/day), date rail with week ticks, stations at stop
  starts + hue-colored stay bars for duration, legs classified from bookings on the transition
  day (flight → dashed arc + plane glyph, train → solid double line, else single line), pinned
  counter's hardDeadline → red wall tick, `appState.now` → "you are here" marker. Deterministic,
  collision-free by construction at 480 px.
- `stats.ts`: pure fns over liveQuery arrays (personal scale — compute on render). Per-trip:
  total & per-category vs plan, per-day burn + naive projection, cash/card, refunds, largest;
  plus nights per stop, bookings by status, packing progress. Cross-trip: per-trip rows +
  aggregates, **no cross-currency conversion** (aggregate only within a shared home currency).
  Charts are small inline SVG — no chart library.

## 9a. Map links (`lib/logic/geo.ts`, `lib/platform/maps.ts`)

One button per place. What it opens is decided at BUILD time in
the trip's builder (the map-link and place tables of its seed); the app never looks a place up, so
the links add no runtime request (the rehearsal asserts it; the street map's own online paths
are §9b).

Precedence, highest first: a share link the owner pasted (`mapUrl`, http(s) only, opened verbatim)
→ a place NAME (`mapQuery` + `mapCity`) → a bare coordinate. A name beats a coordinate because each
map app then resolves it in its own data, which also sidesteps the GCJ-02 datum entirely.

Four rules that came from testing on the phone, not from reasoning — each has a test and each cost a
real failure to learn:

1. **Terms are joined with a SPACE, never a comma.** Amap treats everything after `q=` as one
   literal keyword: `geo:0,0?q=中国国家博物馆, 北京` → *Info not found*; the same with a space opens
   the museum. `geo.test.ts` decodes the `q` param and asserts no comma.
2. **The address is for the human, the name is for the machine.** `北京南站` + its street (南站幸福路)
   buried the station under road segments; name + city opened it with entrances and parking. The
   address ships on the driver card and joins the search only when an entry sets
   `addressInSearch` — today only the chains 东来顺 and 四季民福, where the street picks the branch.
3. **A coordinate pin carries no label.** Amap does not decode the `(name)` part and drew nothing
   at all, leaving a raw `%E2%80%94` in its search box. `geo:<lat>,<lng>?q=<lat>,<lng>` only.
4. **Hong Kong and Macau go straight to Google Maps** (`isHongKongOrMacau`). Amap centres the right
   street there but has no POI for e.g. Tai Kwun. The mainland keeps the `geo:` chooser, where Amap
   wins. Split by location, never by preference.

The first trip's checker (`verify:places`, removed with that trip in Nov 2026) re-checked every name against OpenStreetMap **and**
Wikidata; the rules it applied survive in `scripts/maps/pins/`: the answer must *be* the place (name agreement, not just distance — distance alone passed
"CHAO Sanlitun" while returning the Workers' Stadium) and must land near a hand-verified
coordinate. A name that fails ships **no button**; the reason is written into the manifest. A
Nominatim 429 exits 2 with "COULD NOT BE CHECKED — this is not a verdict", never exit 1.

## 9b. The street map: packs, the online map, "Build map for this trip" (7 Nov 2026)

**THE NETWORK RULE FOR MAPS (owner, 7 Nov 2026).** The app goes online for maps ONLY to (a) load
the street tiles the saved map pack does not have, while the phone is online, and (b) build a map
pack when the owner taps **Build map for this trip**. Nothing else changed. With no connection it
makes zero requests (`navigator.onLine` false → no fetch), and the offline rehearsal still
asserts "Map · nothing asked off this machine" over the whole walk. **On Android that needs
`ACCESS_NETWORK_STATE`** in the manifest (a normal permission, no prompt; added 7 Nov after the
review): without it the WebView cannot read the network's state and `navigator.onLine` stays
true in airplane mode — so the map would ask for tiles it cannot have, and the weather and Drive
checks would try too.

| | |
|---|---|
| The pack | one PMTiles v3 file in OPFS (`mappacks/map.pmtiles`, `lib/map/pack.ts`), read one File slice per tile. An import is a swap: copied to `.part`, checked whole, moved in — a failure keeps the old pack. A **built** pack lands through the same `.part`, the same lock (`holdPack`) and the same check and swap (`landPart`, refactored out of the importer unchanged) |
| The region | `lib/map/region.ts` — ONE copy for `npm run map:pack -- --trip <file>` (`scripts/maps/areas.ts` adapts a trip file to it; since 7 Nov the trip file is an argument) and the phone. Anchors (places at their verified position, stops, stations) cluster at 10 km and grow 2 km; the trip's own coverage-only points (`trip.mapCoverage`, §3) size boxes; and **every stop gets at least ±25 km** (`STOP_MIN_KM`, a 50 × 50 km square, longitude scaled at its latitude), merged like any box. Which stops: kind `stop` with a coordinate — the rule that already puts a stop on the map; the transit leg and a stop with no coordinate (Shanghai) get none, and the anchors dropped today (the international flights' departure airports) stay dropped. A stop left with no area of its own is named in the one that covers it ("Tel Aviv + Jerusalem") |
| Sizes (7 Nov build) | **A ten-stop trip with ~150 places: 20 boxes, ~24,000 km², a ~125 MB pack — a ~131 MB download in ~470 requests of ≤ 1 MB, after ~4 MB of index read to plan it** (before the squares: 33 boxes, 49.9 MB). **Israel test trip (8 stops, no places): 6 boxes, 20,249 km², 102.7 MB, 22,353 entries — 107.1 MB to download, 1.8 MB of index** (before: 8.2 MB) |
| Online tiles | `lib/map/street/online.ts` + the engine's `ltdtiles://` protocol (`street/index.ts`): per tile the pack; else, online, `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=…` (z0–15, the same v4 schema as the daily builds the style is written for); else not drawn, as before. **A tile not drawn is rejected (`TileMissed`), never answered empty**, so MapLibre keeps it errored rather than caching a loaded, empty tile, and `retryMissed()` asks for the missed tiles again **by id** — `map.refreshTiles('protomaps', tiles)`, which reloads them as 'expired' — when the phone's `online` event fires or the back-off ends. Not by resetting the source: `setTiles` (and `refreshTiles` with no ids) makes MapLibre 6.11 / 5.24 reload an errored tile as 'loading' on the worker it failed on, which `loadTile` takes for a load under way — it hangs, and nothing is asked (found in a real browser, 7 Nov). And since an errored tile asks for no repaint, the engine repaints when MapLibre reports one of ours errored — else a map whose every tile failed (no pack, offline) never fired `load` and was taken down as "could not start". Only a 404/204 from the API (an empty sea) is drawn empty. **Every request gets 8 s** (a hand-rolled `AbortSignal.any` + timeout, so any WebView has it); a timeout, no answer, a 429 or a 5xx backs off 30 s, doubling to 10 min, reset by a success (one burst counts once); a refused key (401/403) stops asking for 10 min at once — the mainland without a VPN, a hotel's login page, a revoked key or a rate limit never mean a request on every pan. With no pack the style drops its background layer, so where no tile comes the night ground shows as it always did |
| Where | only where the key may be used: a key built in **and** the page's origin is `https://localhost` (the Android app, `androidScheme: 'https'`) or `http://localhost:8080` (the dev server, which `vite.config.ts` pins to :8080 with `strictPort`) — the key's CORS allow-list. Anywhere else (the public PWA, `vite preview`, the rehearsal) the map's source is the pack's own `pmtiles://`, byte for byte as before: no badge, no request |
| The badge | the Map tab's foot says which source drew the tiles on screen as the map last came to rest — **Offline map** (the pack) or **Online** (any tile from the API) — from the visible tiles at the source's zoom (`shownFrom`). Online tiles drop "map data stored on this phone" from the attribution, and "No streets here" is not said where online tiles fill in |
| The key | the owner's, in `~/.ltd-private/protomaps.key` on the build machine (`scripts/privacy/map-key.ts`), **never in this public repo**. Built in as `__LTD_MAP_KEY__` only by **`npm run build:android`** (`vite build --mode android` → **`dist-android/`**, git-ignored, Capacitor's `webDir`) and by the dev server, which writes nothing. `npm run build` → `dist/` (committed, deployed as the PWA) never reads the file, and `check:dist` fails if the key is ever found in `dist/`. No key file: an Android build without online tiles, everything else the same. Tests never need it |

**BUILD MAP FOR THIS TRIP** (`lib/map/build/`; the button: `BuildMap.svelte` in Settings › Map
pack and in the Map tab's empty state, the sheet: `BuildConfirm.svelte`).

1. **Plan.** The current trip's region (above), the newest Protomaps daily build from
   `https://build-metadata.protomaps.dev/builds.json` (as `build-pack.ts`), then the extractor's
   dry run: the header and the leaf directories the region touches (a few MB, kept in memory so
   the build does not read them twice) give the new pack's size to the byte. Nothing is written.
2. **Confirm.** The sheet leads with the **download** — the tile data the plan asks for, its gaps
   included (~131 MB for a ten-stop trip) — then what the finished map takes on the phone (125.0 MB), and
   says working it out read a few MB already; then Wi-Fi or mobile data (no restriction — the
   owner's call), the areas, the build's date, and — when a pack is on the phone — that the new
   one **REPLACES it completely, its place photos with it** (a built pack has none yet).
3. **Build.** The writer first (below), then the room check — the rest of the pack × 1.02 free
   while the old one stands, and where the writer copies the file, room for that copy too —
   `navigator.storage.persist()`, then the tiles: z0–15, ≤ 5 % of the kept bytes wasted on gaps,
   **≤ 1 MB per request, four at once**, into the importer's `.part` under its lock.
4. **Land.** The whole `.part` checked and swapped in by `landPart`; stamped with the `ltd:` keys
   `build-pack.ts` writes (`ltd:pack` = `packName(title)`, e.g. "demo-2027-map", `ltd:trip`, `ltd:built`,
   `ltd:source` = "Protomaps daily build YYYYMMDD · OpenStreetMap", `ltd:areas`,
   `ltd:maxzoom` 15), so Settings reads it as it reads a workshop pack.

- **The extractor** (`build/extract.ts`) is `pmtiles extract --region` (go-pmtiles 1.31.2) ported
  to TypeScript: Hilbert ids, the region's tiles (boundary walk, run fill, ancestors), root →
  leaves → entries with runs trimmed, shared contents stored once, backward-offset "strays"
  fetched first, coalesced chunks, a bounded window of parallel requests. Bytes in through an
  abstract `getBytes`, out through a sink in file order — never assembled in memory. Checked: on
  the 7 Nov build its plan for the first trip equals the proven prototype's exactly; on the test pack its tile
  data and directories equal go-pmtiles'. It imports nothing from `pmtiles`, so the engine chunk
  stays the engine's.
- **The network is native** (`build/source.ts`): build.protomaps.com answers CORS only for
  Protomaps' own sites, so the WebView's fetch is refused; `CapacitorHttp` (already in
  `@capacitor/core`, no new dependency) is Android's HttpURLConnection on a thread pool. Every
  request: `Range`, `Accept-Encoding: identity`, and `If-Match` with the build's ETag once the
  first answer named it. Capacitor 7 reads each answer WHOLE in Java and base64s it across the
  bridge (≈ 15–20 MB of Java heap per 2 MB chunk — the review's measure), hence **1 MB chunks,
  four at once**. An answer is checked before it is used: a 206 must cover exactly the range asked
  for (`Content-Range`, no longer than asked). **A 200 to a Range request** — a proxy or captive
  network that ignored the range — stops the build at once (`RangeIgnored`: never retried, the
  build paused, the words say to try another network); the native layer will already have read
  that one answer whole, which JavaScript cannot stop. 404/410/412 are "the build is gone /
  changed": never retried.
- **Writing** — two writers behind a 1 MB buffer, **in place first**: a worker holding the
  `.part`'s synchronous access handle writes where the bytes go, and a commit is a `flush`, every
  8 MB. Where the worker has no such handle, `createWritable`: its writes go to a hidden copy of the
  whole file that replaces it only when the stream closes, so a commit is close + reopen with
  `keepExistingData` — a full copy each time — and it commits only every **32 MB** (≈ 4 copies for
  a ten-stop trip's ~125 MB, not ~15), and its room check counts that copy beside the file.
- **Resume** (`build/state.ts`, Dexie `meta` row `map.build` — `meta` is never exported). The
  `.part` is committed and THEN the checkpoint saved, with everything that decides the plan
  pinned: the build's date, URL and ETag, the region, the `ltd:` metadata, the extract options,
  the plan's key. **Only a committed checkpoint is ever saved** — after a Cancel or a failure the
  newest is saved only if the file closed cleanly — so "Carry on" never meets a `.part` shorter
  than its checkpoint (which would throw it all away). The plan's key holds the source, region,
  zooms, chunking, metadata and the tile index's counts, **not** the gzipped lengths of the root
  directory and metadata (a WebView updated between Cancel and Carry on may compress them to
  another length); a resume reads where the tile data starts from the `.part`'s own header, and
  the extractor checks the file is exactly as long as that says. Cancel, a lost connection, or
  the app killed: **Carry on** cuts the `.part` back to the checkpoint and fetches only the rest —
  byte-identical to an uninterrupted build (tested, for both writers). Gone from the server, changed, or a plan that no longer matches: said plainly,
  the half-built file dropped, start again. An import or Delete meanwhile removes the `.part`;
  the builder says so.
- **On the web** the button is replaced by one line: building needs the Android app.
- **The workshop** (`npm run map:pack -- --trip <file>`, every mode): the files are named after the
  pack (`app/.cache/maps/<pack>.pmtiles`, `<pack>-photos.pmtiles`); the committed test packs (`scripts/e2e/fixtures/bund-test*.pmtiles`, central Shanghai)
  are re-cut only when the trip's region covers the Bund box (or with `--test-only`, which refuses a trip
  that does not), always into a `.part` that is verified before it replaces the fixture; the
  places' photos are added only to the photo manifest's own trip's pack.
- **The places' photos (phase 2, 8 Nov 2026).** A photo region is position-free (its spans count from
  its own start), so it can follow any archive byte for byte. **A build carries them over**: when the
  pack being replaced carries photos whose index is this trip's, the plan declares them in the new
  archive's metadata (`ltd:photos` as they were; `Saved.carry` pins their offset, size and the old
  pack's size) and the build copies the region after the tiles — the archive committed and
  checkpointed first, so a kill mid-copy carries on from its end; a changed old pack before Carry
  on restarts the build. Another trip's photos do not come along, and the sheet says so. **"Add place
  photos from a pack file"** (Settings, beside Replace; `run.ts addPhotos`): the picked file read
  once, start to end — its metadata on the way, then its photo region — and the map rewritten
  around them: its header and root, its metadata declaring the photos, its leaves and tiles as they
  are, the photos; checked and swapped in as an import is. **Not done:** the app does not fetch photos
  itself — the workshop's photo manifest (`scripts/maps/photos/`) is made from the demo seed and
  hand choices, and the trip file carries no photo sources for the app to fetch from.
- **Which trip** (8 Nov 2026): a build under way or paused always names its own trip; the Map tab
  offers "Build map for this trip" also when the pack on the phone does not cover the trip on screen
  (a stop outside its bounds; app only); Settings builds for the trip it was opened from
  (`router.prev`), else the one last on the Map tab (`localStorage` `ltd:lastTrip`), else "this
  trip".

**Bundle.** The builder's work is a chunk of its own (`run-*.js`, ≈ 9.8 KB gz: the extractor
4.7, `run.ts` 2.3, the region 2.2, the native source 0.5) loaded on the first tap; the button,
its sheet, its state and its words add ≈ 3.2 KB to the chunk Settings and the Map share, the
badge 0.2 to the Map; the online tiles ≈ 0.8 KB to the engine. Measured first, all app JS came to 296.39 KB,
11.39 over its 285; **the owner's decision (7 Nov 2026): the map builder gets a budget of its
own, ≤ 12 KB gz** — everything `src/lib/map/build/` starts lazily and nothing else reaches,
counted out of the app's total exactly as the engine is (`scripts/check-bundle.mjs`, the fourth
table) — **and all app JS goes 285 → 290 KB** for the screens' part. Measured after (with the
review's fixes, 7 Nov): initial
load **198.83 KB** (≤ 200), all app JS **286.69 KB** (≤ 290), map engine **452.97 KB** (≤ 470),
map builder **10.28 KB** (≤ 12).

## 10. Deploy

One-time: `npx wrangler login` && `npx wrangler pages project create livingthedream`. Then
`npm run deploy`. Fallback (zero toolchain): drag `app/dist/` into the Cloudflare dashboard.
**New Pages project = new origin** — the legacy SW never collides with the new app; the legacy
URL is decommissioned deliberately after cutover. `wrangler` is a devDependency; auth
alternative: `CLOUDFLARE_API_TOKEN`.

## 11. Verification gates (M8 parity audit)

1. Seed audit: `npm run verify:demo` — the committed demo seed equals what its builder makes, and passes
   `scripts/demo-trip/assert.ts`. (Until Nov 2026 this was the re-verification of the first trip's seed against its source documents.)
2. `dist/` sterility grep (`scripts/check-dist-clean.ts`, inside `npm run build`): every built
   file and every seed is grepped for two kinds of pattern, both loaded by
   `scripts/privacy/forbidden.ts`:
   - **credential shapes**, written in the repo because they name no one — an IATA e-ticket
     (`\d{3}[- ]\d{10}`), a passport-shaped token, a grouped card or gift-card number, a
     booking PIN beside its label, a personal webmail address, a mobile number;
   - **the owner's real values** — names, PNRs, booking and order numbers, PINs, ticket
     references, loyalty and policy numbers — which are **not** in the repo at all, not even as
     patterns: a public list of "values that must never appear" is itself the leak. They are read
     from `~/.ltd-private/privacy/forbidden.json` (override `LTD_PRIVATE_FORBIDDEN_FILE`):
     `{ "patterns": [ { "label": "…", "regex": "…", "flags": "i" } | { "label": "…", "literal": "…" } ] }`.
     Only labels are ever printed. A 4-digit value (a PIN, a card's last four) belongs in that
     file next to its label (`\bPIN\b.{0,16}?\b(?:nnnn)\b`), never bare: at one in ten
     thousand bare digits collide with prices, years and hash fragments, and a gate that cries
     wolf gets switched off. Long opaque serials can be literal with `\b` on both ends.
   A missing private file makes that half report **SKIPPED** and the gate still passes on the
   shapes; a malformed one fails it. Both passport numbers are handled the same way, from
   `~/.ltd-private/{israeli,french}-passport.txt` (`scripts/privacy/private-ids.ts`). The demo,
   Israel and template seed assertions use the same loader.
3. Latest real phone backup imports cleanly.
4. Airplane-mode dress rehearsal: install → every screen → copy a code → driver card → add
   expense → export vault → reboot → airplane mode → reopen, all green.

### Where the gates stand (Lantern Run C, 2026-08-13)

| Gate | Command | Standing |
|---|---|---|
| Types | `npm run check` | 525 files, 0 errors |
| Unit | `npm test` | **450** in 25 files |
| Contrast | `npm run check:contrast` | **104 pairs × 2 palettes**, 0 failures |
| Sterility | `npm run check:dist` (inside `build`) | 32 files, 14 patterns, 0 hits |
| Rehearsal | `npm run rehearsal` | **106/106 with the network hard off** |
| Seed audit | `npm run verify:demo` | (was `verify:china`: 106 critical values + 74 structural facts) |

### Bundle budget (measured 2026-08-13, after Run C)

| Asset | Raw | Gzipped |
|---|---|---|
| `index-*.js` (the app) | 476.85 kB | **158.67 kB** |
| `web-*.js` + `index-*.js` (Capacitor plugin chunks, lazy) | 11.36 kB | 4.60 kB |
| `workbox-window` | 5.75 kB | 2.36 kB |
| **Total JS** | 493.96 kB | **165.63 kB** — against a **200 KB** budget |
| CSS | 124.40 kB | 21.71 kB |
| Precache (JS + CSS + fonts + icons) | — | 1116.51 KiB on disk |

Run C added ~4.3 KB gzipped (Drive + converter + health + zones + their strings). **No code
splitting was done, deliberately.** The budget is met with 34 KB of headroom; the only chunk
large enough to be worth splitting is the app itself, and splitting it would mean route-level
lazy loading — which on an offline-first app that precaches every route anyway buys nothing at
runtime and costs a route-loading state that can fail. The Capacitor plugins are already
dynamically imported (`platform/files.ts`, `platform/maps.ts`, `data/drive.ts`) so the web
bundle never carries them. Revisit only if the app chunk passes ~180 KB gzipped.

**Horizon Run 1 (2026-09-28)** — the budget is now a build gate (`npm run check:bundle`, last
step of `build`, decimal KB as Vite prints them): **198.12 kB gzipped JS** across 8 files
(app chunk 191.18 kB), **1.88 kB under 200**; CSS 29.34 kB gz; fonts 130.48 kB on disk (was
540.86 kB). The app chunk passed the ~180 KB mark above because the Lantern screens that Runs
2–3 replace (Today, Tasks, Itinerary, StopDetail, RouteMap) still ship beside the new Pocket,
Find and shell; each run must delete what it replaces, and splitting is the fallback if that is
not enough. Gates at the end of Run 1: `check` 559 files / 0 errors · `test` 538 in 31 files ·
contrast 101 pairs × 2 palettes / 0 failures · `check:dist` 14 files / 14 patterns / 0 hits ·
`verify:china` 121 critical values + 84 structural facts · `rehearsal` 113/113 offline.

**Horizon Run 2 (2026-09-28)** — Now, the map engine and the motion system landed and Today,
Tasks, RouteMap (+ `logic/routemap.ts`), ProgressRing and ShelfMap were deleted. Even so the
same code minified by esbuild measures **209.43 kB**, 9.43 kB over. **The build now minifies with terser**
(`vite.config.ts`: `minify: 'terser'`, two compress passes, no unsafe options; terser was already
installed with vite and workbox-build, so nothing new is shipped or installed). Its output gzips
about 8 % smaller on this codebase: **192.66 kB gzipped JS** across 8 files (app chunk
185.88 kB), **7.34 kB under 200**; CSS 30.48 kB gz; fonts unchanged. The gate itself is unchanged
(the same script, the same files, the same 200 KB). Splitting stays the fallback. Gates at the end of
Run 2: `check` 575 files / 0 errors / 0 warnings · `test` 623 in 37 files · contrast 112 pairs × 2
palettes / 0 failures · `check:dist` 32 files / 14 patterns / 0 hits · `verify:china` 121 critical
values + 84 structural facts · `rehearsal` 125/125 offline.

**Horizon Run 3 (2026-09-28)** — Journey (Replay + the route check), the city and the guide
landed; Itinerary, StopDetail and JourneyOverview were deleted. **198.20 kB gzipped JS** across 8
files (app chunk 191.41 kB), **1.80 kB under 200**; CSS 30.93 kB gz; fonts unchanged. The gate is
unchanged; the build is not. Built as in Run 2 (terser, two passes, Svelte's default class
names) the final Run 3 code measures **201.07 kB — 1.07 over** (esbuild: 218.28). `vite.config.ts`
now builds it with terser at five compress passes plus `hoist_funs` (function declarations moved
to the top of their scope — where JavaScript hoists them anyway; ESM is strict), `ecma: 2020`
output, no modulepreload polyfill, and **short scoped class names** (`_` + 4 characters of
Svelte's own CSS hash instead of `svelte-` + 7, with `cssHash()` failing the build if two
stylesheets ever share one; no class the app writes starts with `_`). Still nothing from terser's
unsafe family and no property mangling. Gates at the end of Run 3: `check` 580 files / 0 errors /
0 warnings · `test` 671 in 40 files · contrast 112 pairs × 2 palettes / 0 failures ·
`check:dist` 32 files / 14 patterns / 0 hits · `verify:china` 121 critical values + 84
structural facts · `rehearsal` 132/132 offline.

**Horizon Run 3c (2026-09-28) — two numbers, two budgets.** One number over every JS file made a
screen opened twice a trip weigh on start-up exactly like Now; the number the phone feels is the
JavaScript a cold start must load. `scripts/check-bundle.mjs` now reads Vite's manifest
(`build.manifest: true` → `dist/.vite/manifest.json`, file names only, not precached) and gates:

| Budget | What it counts | Limit | End of Run 3c |
|---|---|---|---|
| **Initial load** | the entry chunk + every chunk it imports statically, transitively (`isEntry`, then `imports` edges — the modulepreload set) | **200 KB gz** | **186.08 KB** (1 file) |
| **All app JS** | every `*.js` under `dist/assets`, lazy chunks included, and any file the manifest does not name | **275 KB gz** (260 until 2026-09-29, owner) | **206.49 KB** (12 files) |

The service worker is printed and counted in neither. Both tables print on every build; either
budget over fails it. Settings, Backup, the trip wizard and the import sheet are lazy (§5 › Lazy
screens): 13.62 KB gz between them, 8.65 KB off the entry; separately gzipped chunks compress less
well than one, so the total rose 4.99 KB — spent from the budget that is not felt at start-up. The
minifier settings above are unchanged. Run 5's map engine gets a budget of its own.

**Horizon Run 4 (2026-09-28) — dark only, and hardened.** Daylight is gone (the palette, every
light rule, the theme setting and the boot script): entry CSS 29.62 → 27.18 KB gz at 4a
(27.35 at the end of the run). Initial load 186.40 KB gz, all app JS
206.85 KB gz. `scripts/e2e/perf.mjs` measures the S23 proxy (headless Chrome, 384 px, CPU
4×): Now is drawn once and whole (TripShell waits for every table — drawn early it said "Tonight's
bed is not booked yet" for a moment), trip data is read raw rather than through deep proxies,
and a loop out of view pauses (the main thread at rest: 179 → 8.6 ms/s on Journey scrolled
away, 195 → 0.1 on the Pocket). Now is complete 937 → 764 ms, with no long task over 200 ms
after first paint (was one). The rehearsal sweeps the a11y floor over 30
screens and 8 overlays at 412 and 384 px (names from Chrome's accessibility tree, targets
≥ 44 px, rings drawn and not clipped, one h1 and no skipped level) and the motion switches on
every looping screen. Gates at the end of Run 4: `check` 588 files / 0 errors · `test` 788 in 44 files ·
contrast 86 pairs, one palette, 0 failures · `check:dist` clean · `verify:china` 121 critical
values + 84 structural facts · `rehearsal` 157/157 offline. `docs/design/HORIZON.md` is the
implementer's reference.

Two gates grew a floor rather than a feature in Run C, and are worth knowing about:

- **The Drive vow.** The rehearsal asserts zero `googleapis.com` / `accounts.google.com`
  requests across the entire offline walk, and that drawing the Drive card calls nobody. The
  whitelist is conditional by construction — `googleapis` would be permitted only in the
  `connected` state, which a rehearsal can never reach (§7a).
- **The a11y floor**, swept across seven screens rather than asserted per-screen, so a new icon
  button anywhere fails it: every `<button>` has an accessible name (`aria-label` / `title` /
  text — read from `textContent`, never `innerText`, which answers empty for anything currently
  collapsed), and every enabled control shows a focus ring. Since Horizon Run 4 the floor is
  swept over every screen and overlay at 412 and 384 px (§ Run 4 above; `docs/design/HORIZON.md`
  §9).
   `npm run rehearsal` walks the **built** app: it probes `localhost:4173` and starts
   `vite preview` itself when nothing answers, so the walk can never run against a dev server
   or against nothing. It **exits 2 without printing a table** — a broken harness is not a
   failing app — when there is no `dist/`, when the demo seed did not import, or when the
   offline shell does not come back from the precache. That last guard is the important one:
   with no worker answering, every navigation is Chrome's error page and the suite otherwise
   reports ~40 invented screen failures (plus two vacuous PASSes) for one missing server.
5. Legacy retired in Nov 2026 with the real trip's files; the app still imports a legacy backup (`legacyImport`).

## 12. Risk register (deltas from the legacy app)

| Risk | Mitigation |
|---|---|
| IndexedDB eviction | persist() + install + mutation-aware backup nag + auto-export before destructive ops |
| Export memory (big vaults) | blobs in separate table; 20 MB per-file soft warn; vault size shown; warn >~80 MB, offer per-trip export |
| Android back traps | hash router + pushState layer stack + dirty guard; tested M2/M8 |
| Schema evolution | additive versions, fixture upgrade tests, downgrade detection, pre-update backup nudge |
| PWA plugin gotchas | precache size limit raised, `?d=` ignored in cache matching, prompt-type updates, preview-build SW testing |
| Timezones | local-naive dates + banned `new Date(str)` + IANA clocks via Intl |
| Toolchain rot | committed dist + lockfile + .nvmrc + fallback version matrix + dashboard-upload path |
| Chrome Android PDFs | blob-URL opens hand off to the system viewer (offline-safe); images render in-app |
| The map key in a public repo | read from `~/.ltd-private/` only by the Android build (`dist-android/`, git-ignored) and the dev server; `check:dist` fails if it is in the committed `dist/` (§9b) |
| A map build cut short | resumable from its last committed checkpoint against the pinned build; a build that fails or never finishes leaves the old pack as it was (§9b) |

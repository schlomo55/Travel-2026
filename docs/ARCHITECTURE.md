# Living the dream — architecture

*The technical companion to the product plan. Product decisions (name, modules, editing model,
design direction) are recorded in ABOUT.md history and the 2026-07-24 plan; this file is the
implementer's reference. The legacy one-file app lives frozen in `legacy/` until cutover.*

## 0. Stack (final)

**Svelte 5 (runes) + TypeScript + Vite + vite-plugin-pwa (Workbox) + Dexie (IndexedDB).**
Static output, zero runtime network dependencies, deployed to Cloudflare Pages by **direct
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
`Noto Sans SC`, present on the S23 Ultra, offline by definition.

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
≤ 200 KB gzipped, and all app JavaScript, lazy chunks included, ≤ 260 KB (§11 › Bundle budget).
Feature map (every Lantern feature → its Horizon home): `docs/design/horizon/FEATURES.md`.

## 1. Repo layout

```
C:\Source\China\
├─ README.md / ABOUT.md          # rewritten at cutover; ABOUT kept as v1 rationale
├─ docs/ARCHITECTURE.md          # this file
├─ docs/DRIVE-SETUP.md           # the owner-only Google console steps for §7a Drive backup
├─ docs/NEW-TRIP.md              # the five-step loop that turns a brief into a trip seed (§6a)
├─ docs/TRIP-BRIEF-TEMPLATE.md   # the blank brief; docs/examples/ holds one filled in
├─ docs/design/HORIZON.md        # the design system in the code: the implementer's reference
├─ docs/design/horizon/          # the boards, the system (tokens.json), FEATURES, PROGRESS
├─ docs/design/LANTERN.md        # the previous design language (history since Horizon)
├─ legacy/                       # frozen one-file China app — deployable until cutover
├─ sources/china-2026/           # authority documents (guide v12, handoff, insurance, spec, PDF)
├─ seed/china-2026.trip.json     # generated trip file — PERSONAL DATA, never reaches dist/
└─ app/                          # the Living the dream PWA (npm project)
   ├─ scripts/build-china-seed.ts   # legacy DATA → seed, with parity assertions
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
  deterministic slugs** (`cn26-stop-kunyu`, `cn26-alarm-03`) — legacy tick import maps onto them
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
  converts legacy `<b>`/`<a>`/entities to md-lite.
- All UI strings in `lib/i18n/strings.ts` (typed const) — English-only today by decision.

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
Global: `Settings` (activeTripId, lastBackupAt, lastMutationAt, backupNagDays, persisted,
weatherOnline, calmMotion, routeAnimations — no `theme` since Horizon Run 4: the app is dark only, and a stored one is ignored) ·
`PackingTemplate` · `MetaKV`.
`Trip` itself: dates, homeCurrency, `currencies[]` (code/symbol/rateToHome, editable),
`accentHue` (drives `--accent-h`), `clocks[]` (IANA), budgetTotalMinor, `driverSuffix`
(e.g. 请带我去这里 / "Please take me here"), archived.

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

## 6. Seed pipeline (China 2026)

`scripts/build-china-seed.ts` (`npm run seed-build`):
1. Slice `var DATA = {…};` out of `../legacy/index.html`, evaluate in `node:vm` — zero manual
   transcription.
2. Transform to one trip file: deterministic ids, md-lite conversion, `trip.entry/exit/
   visaDeadline` → the pinned Mainland-visa ComplianceCounter, `flights` pseudo-stop →
   `kind:'transit'`, `days{}` → 26 DayPlans + 2 DayDefaults (Kunyu weekday/Sunday), `docs[]` →
   4 WalletCards, `hotels[]` → 11 HotelBookings, `cats` → 8 categories with `legacyKey`,
   flights PDF from `sources/` embedded as a base64 DocumentFile.
3. Assert counts (10+1 stops, 26 dayPlans, 8 runbooks, 7 flights, 11 hotels, 4 cards, 21 tasks,
   17 alarms, 30 packing items, 11 checklist items, 13 info cards, 9 emergency, 35 showCards,
   8 categories, 1 counter, 11 documents, 7 expenses) **and** that the Israeli passport number
   appears nowhere, then write `../seed/china-2026.trip.json`. `scripts/china/assert.ts` is
   authoritative; the numbers here are a summary and it is the one that fails the build.

**Bed facts the assertions defend** (all in `assert.ts` / `verify-china-parity.ts`, each earned by
a real mistake): **eleven of the twelve beds are booked, nothing is pending**, the twelfth is the
gorge walk-in, and none may silently revert · **every booked bed except the academy carries a
price AND a link to the site it was booked on** (the academy stay — `cn26-stay-11`, added 12 Aug —
is deliberately priceless, codeless and linkless: its ~$890/month was never confirmed in writing,
no platform holds it, and the assertions pin those absences from the other side) — an honest platform entry point (Trip.com's order list, Agoda's bookings
page, Booking.com's My Trips, the Royal Garden's own site) where no deep link to the reservation
was ever supplied, never a guessed order URL · a booked bed carries the confirmation number of the
order that is actually LIVE — Four Points was rebooked on 2026-07-27 and the superseded number and
its PIN must appear nowhere in the seed · a bed whose paperwork never stated a number carries none
rather than a plausible one — Element proved that rule from 27 to 29 Jul 2026 and then its Agoda
number arrived, so **every booked bed now carries one**, and Element's secondary line is a second
number rather than a PIN because Agoda sold a room allotted from booking.com and the property may
only recognise `5351254076` · every booked bed still carries its link · the price is quoted in the
currency the confirmation printed, and where a page printed both it is the currency the charge is
made in (Yue Tu ¥857.30 not US$126.55, Dali ¥324.00 not US$47.83 — both Booking.com displays at
≈6.774; the ibis is the other side of the same rule, quoted $25.73 because its Trip.com order
charged dollars and printed no yuan) · a bed with no stated cancellation deadline says "not
stated — ask" rather than reprinting research or a dead order's terms · **a bed that is paid but
not yet accepted says so** — the ibis Kunming order read "Confirming" on Trip.com from 27 to 29
Jul 2026, carried the `alert` flag and a chip in the platform's own word, and was never rounded
up to a plain tick, because it is the visa-exit night. **The property accepted on 29 Jul**, so the
assertions now defend the mirror of that rule: the bed reads CONFIRMED, no field on it still says
"Confirming", and it carries no `alert` — a warning left standing after it stops being true
teaches the reader to skip warnings. `alert` is currently unused and stays in the schema because
the state it describes can recur · exactly two beds are logged as paid, because exactly two have
been charged: Yue Tu's first night at reservation and the ibis in full.

**The deployed bundle stays sterile**: no seed in `dist/`, no auto-offer. Empty vault offers
"Create a trip" / "Import a trip file"; the seed reaches the phone as a user-provided file.
Importing an existing trip id offers Replace (undoable via pre-captured snapshot) or Cancel.

### 6a. The generic trip pipeline (2026-08-26)

§6 is China's pipeline and only China's: it reverse-engineers a trip out of `legacy/index.html`
and the `sources/` documents, which is the right shape exactly once. Every trip after it starts
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
  The hook exists because of China (§6, and `scripts/check-dist-clean.ts`); anything
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
  "Phoenix" or any other fact of this one trip — so a second trip gets the section for free and
  a trip carrying none of it gets no section rather than an empty promise. The one nudge it
  makes ("is your insurance PDF on this phone?") fires only where there IS a policy and there is
  no document tagged `insurance`.
- **Two clocks** (`lib/logic/zones.ts` → `BookingCard.svelte`). **There is no airport table
  here and no zone is guessed.** The offset is derived from figures the documents already carry:
  `shift = (arrival + dayOffset) − departure − duration`, where `duration` is the airline's own
  printed flying time. A leg with no duration, or an approximate one (`~2 h`), or a shift under
  30 min, or one that is not a whole quarter-hour, produces **nothing**. On China 2026 that
  yields exactly the four Etihad legs and leaves every domestic leg silent — which is correct,
  the mainland is one timezone.

## 8. Service worker (vite-plugin-pwa)

`registerType:'prompt'` (update = consented reload toast) · precache globs include `woff2` ·
`navigateFallback:'index.html'` · `ignoreURLParametersMatching:[/^d$/]` ·
`cleanupOutdatedCaches` · `maximumFileSizeToCacheInBytes: 15 MB` (default 2 MB silently drops
fonts). No runtime caching routes. The app makes exactly **two** kinds of runtime request, both
disclosed in plain words on the screen that owns them and both optional: the weather fetch
(open-meteo, toggleable, §weather) and the opt-in Drive backup (§7a, `null` credential by
default). There is no analytics and no crash reporting, and there never will be. Everything else
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
`scripts/china/map-links.ts` and `scripts/china/spots.ts`; the app never looks anything up, so
zero-runtime-network survives (the rehearsal asserts it).

Precedence, highest first: a share link the owner pasted (`mapUrl`, http(s) only, opened verbatim)
→ a place NAME (`mapQuery` + `mapCity`) → a bare coordinate. A name beats a coordinate because each
map app then resolves it in its own data, which also sidesteps the GCJ-02 datum entirely.

Four rules that came from testing on the S23, not from reasoning — each has a test and each cost a
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

`npm run verify:places` (dev-only, network) re-checks every name against OpenStreetMap **and**
Wikidata: the answer must *be* the place (name agreement, not just distance — distance alone passed
"CHAO Sanlitun" while returning the Workers' Stadium) and must land near a hand-verified
coordinate. A name that fails ships **no button**; the reason is written into the manifest. A
Nominatim 429 exits 2 with "COULD NOT BE CHECKED — this is not a verdict", never exit 1.

## 10. Deploy

One-time: `npx wrangler login` && `npx wrangler pages project create livingthedream`. Then
`npm run deploy`. Fallback (zero toolchain): drag `app/dist/` into the Cloudflare dashboard.
**New Pages project = new origin** — the legacy SW never collides with the new app; the legacy
URL is decommissioned deliberately after cutover. `wrangler` is a devDependency; auth
alternative: `CLOUDFLARE_API_TOKEN`.

## 11. Verification gates (M8 parity audit)

1. 57-critical-values re-verification of the seed against `sources/china-2026/*` (scripted).
2. `dist/` sterility grep:
   `8CR7MR|[redacted]|16537(15|16)\d{9}|cohTex87hq19CnTh|682760663|5942328968|6352597569|SALOMON`
   → zero hits; Israeli passport number absent from seed, dist, and repo-visible new code. The
   Trip.com pattern covers **nine** orders now — the three flights, Four Points' live order, its
   SUPERSEDED one, Blossom House, Huatian, Glenview and the ibis Kunming airport night, all
   starting `1653715`/`1653716`. None of the four added on 2026-07-27 needed an edit to the
   pattern; each was verified against it rather than assumed to match. That is what a family
   pattern buys — including for the dead order, which the app no longer prints anywhere and which
   stays guarded precisely because a retired credential is still a credential. `cohTex87hq19CnTh`
   is The Royal Garden's reservation number, booked DIRECT with the hotel: a direct booking mints
   an opaque token instead of an account-epoch serial, so there is no family shape to match and it
   is grepped literally, the way the airline PNRs are. `682760663` (Pullman, Agoda) and the two
   Booking.com confirmations (`5942328968` Yue Tu, `6352597569` Dali, grepped as one alternation)
   get the same literal treatment for the same reason: those platforms mint short serials with no
   family shape, and at nine and ten digits with `\b` on both ends a bare literal cannot collide —
   it cannot even match inside a longer digit run (measured). Only the **4-digit** values are
   grepped next to their own label — the booking PINs
   (`\bPIN\b.{0,16}?\b(?:9858|2786|3635|8706|2284)\b`) and the last four of the card held against
   Element Chongli (`\b(?:master ?card|visa|amex)\b.{0,16}?\b3321\b`) — because at one in ten
   thousand bare digits collide with prices, years and hash fragments, and a gate that cries wolf
   gets switched off. Every PIN ships only in a `codeSub` or a meta chip, always beside its own
   label, which is what makes the contextual form sufficient as well as necessary. 9858 is in that
   list although it is gone from the app: it belonged to the Four Points order that was replaced.
   The number a PIN unlocks is forbidden outright anyway. Full list:
   `scripts/check-dist-clean.ts`.
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
| Parity | `npm run verify:china` | 106 critical values + 74 structural facts |

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
| **All app JS** | every `*.js` under `dist/assets`, lazy chunks included, and any file the manifest does not name | **260 KB gz** | **206.49 KB** (12 files) |

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
   failing app — when there is no `dist/`, when the China seed did not import, or when the
   offline shell does not come back from the precache. That last guard is the important one:
   with no worker answering, every navigation is Chrome's error page and the suite otherwise
   reports ~40 invented screen failures (plus two vacuous PASSes) for one missing server.
5. Legacy retires only after user sign-off; `legacy/` stays in git forever.

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

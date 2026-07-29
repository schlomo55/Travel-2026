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
  `$state`, subscribed inside `$effect`); all screens read through it, so any DB write re-renders
  everything — replacing the legacy "re-render the whole tab" calls.
- Snippets (`{#snippet}`/`{@render}`) over legacy slots; callback props over `createEventDispatcher`.
- `npm run check` (svelte-check, `strict` + `noUncheckedIndexedAccess`) must stay green.
- **`$state.snapshot()` before any Dexie write of an object that lives in `$state`.**
  Svelte deep-proxies such objects and IndexedDB cannot structured-clone a Proxy —
  the symptom is `DataCloneError: … could not be cloned`. Building a fresh object
  from primitives (the trip wizard) or spreading (`{...item, done: true}`) is
  already plain and safe; passing a stored object straight through is not.

### Fonts
Self-hosted via Fontsource (bundled → hashed → precached): **Fraunces Variable** (display),
**Instrument Sans Variable** (UI), **IBM Plex Mono** 400/600 (codes), plus the two Lantern guide
faces — **Special Elite** (typewriter) and **Caveat Variable** (handwritten city titles), declared
latin-only and woff2-only in `src/lantern-fonts.css` (128 KB added; see `docs/design/LANTERN.md` §3).
**CJK is deliberately not shipped** (4–15 MB): `.zh` text uses `var(--font-zh)` → system
`Noto Sans SC`, present on the S23 Ultra, offline by definition.

### Design system
`src/app.css` is the **Lantern** token system — dark-only (no `light-dark()`, no theme switch),
glow-elevation instead of shadows, gold as the brand voice with neon reserved for progress.
Spec + do/don'ts + the generated contrast table: `docs/design/LANTERN.md`; visual target:
`docs/design/lantern-preview.html`. `npm run check:contrast` re-derives the table from `app.css`
and fails the build if any pair drops below 4.5:1 (body) / 3:1 (large, interactive boundaries).

## 1. Repo layout

```
C:\Source\China\
├─ README.md / ABOUT.md          # rewritten at cutover; ABOUT kept as v1 rationale
├─ docs/ARCHITECTURE.md          # this file
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
   │  ├─ lib/data/               # repos per entity + live.svelte.ts
   │  ├─ lib/state/              # appState, tripContext, router, toast, undo (.svelte.ts)
   │  ├─ lib/logic/              # pure fns: dates, phase, counters, ics, csv, mdlite,
   │  │                          #   stats, routemap, backup, legacyImport, geo, weather,
   │  │                          #   prices, booked (all unit-tested)
   │  ├─ lib/i18n/strings.ts     # ALL UI strings, typed — single-language today, swappable
   │  └─ lib/components/         # ui/ forms/ cards/
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
`InfoCard` · `TripNote`.
Global: `Settings` (activeTripId, lastBackupAt, lastMutationAt, backupNagDays, persisted,
weatherOnline, calmMotion — `theme` was removed with the light theme) ·
`PackingTemplate` · `MetaKV`.
`Trip` itself: dates, homeCurrency, `currencies[]` (code/symbol/rateToHome, editable),
`accentHue` (drives `--accent-h`), `clocks[]` (IANA), budgetTotalMinor, `driverSuffix`
(e.g. 请带我去这里 / "Please take me here"), archived.

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

Trip delete / per-trip export = `where('tripId')` sweeps in one `rw` transaction.
**Migrations**: additive `db.version(n)` blocks only, kept forever, idempotent upgrades,
fixture-vault tests via `fake-indexeddb`; `meta.lastOpenedAppVersion` turns a downgrade into an
honest error instead of a Dexie VersionError crash; the update toast nudges a backup first.
**Persistence**: `navigator.storage.persist()` on first gesture; result + `storage.estimate()`
surfaced on the Backup screen.

## 5. Shell

**Hash router**, hand-rolled (~100 lines, `lib/state/router.svelte.ts`): direct-upload Pages
needs no `_redirects`, Workbox `navigateFallback` stays trivial, Android back gets correct history.

```
#/            → activeTrip ? #/trip/:id/today : #/trips
#/trips  #/trips/new  #/settings  #/backup
#/trip/:id/(today|itinerary|wallet|wallet/spend|tasks|tasks/packing|tasks/lists|info)
#/trip/:id/itinerary/:stopId        → the city guide
#/trip/:id/(map|stats|docs)         → redirect to .../info   (Phase 1 IA merge)
```

The five tabs are **Home · Plans · Wallet · Lists · Info** (`TabName` keeps its
original identifiers — `today`, `itinerary`, `tasks` — because seed ids, the
`goTab` calls and the rehearsal all address them by those names; only the labels
in `strings.ts` changed). **Info is the hub**: it absorbed the route map (was on
top of Plans), the document vault (was the Wallet's "Files" segment) and the trip
statistics (was its own route). `parseHash` maps the three retired paths onto
`info` so every deep link ever written still resolves; the deep *money* statistics
went the other way, into Wallet → Money.

- Trip context: tripId from the URL; `tripContext.svelte.ts` caches a per-trip store of
  liveQueries; entering a trip route sets `--accent-h` + theme-color meta from `trip.accentHue`;
  `Settings.activeTripId` updated on navigation.
- **Sheets & Android back**: every editor/overlay pushes `history.pushState({layer:n})`;
  `popstate` closes the top layer. Back = close sheet → leave screen → minimize at root. Dirty
  forms intercept the pop, re-push and ask to discard.
- **`?d=YYYY-MM-DD` preview kept** (search param *before* the hash), plus an in-app picker
  (Settings) and a persistent "Previewing …" pill. All date-derived UI reads `appState.now`
  (`$state`), re-armed at local midnight +5 s and on `visibilitychange`.

**Forms**: schema-driven. `FieldSpec` union (text, multiline, mdlite, date, time, number, money,
select, toggle, stringList, kvPairs, hue, currencyPick, entityRef) + per-entity `FormSpec`
(groups, validate, to/fromEntity) rendered by one `SchemaForm` sheet. Bespoke editors only where
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
a real mistake): **ten of the eleven beds are booked, nothing is pending**, the eleventh is the
gorge walk-in, and none may silently revert · **every booked bed carries a price AND a link to the
site it was booked on** — an honest platform entry point (Trip.com's order list, Agoda's bookings
page, Booking.com's My Trips, the Royal Garden's own site) where no deep link to the reservation
was ever supplied, never a guessed order URL · a booked bed carries the confirmation number of the
order that is actually LIVE — Four Points was rebooked on 2026-07-27 and the superseded number and
its PIN must appear nowhere in the seed · a bed whose paperwork never stated a number carries none
rather than a plausible one (Element), and still carries its link · the price is quoted in the
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

## 8. Service worker (vite-plugin-pwa)

`registerType:'prompt'` (update = consented reload toast) · precache globs include `woff2` ·
`navigateFallback:'index.html'` · `ignoreURLParametersMatching:[/^d$/]` ·
`cleanupOutdatedCaches` · `maximumFileSizeToCacheInBytes: 15 MB` (default 2 MB silently drops
fonts). No runtime caching routes — the app makes zero runtime requests; the only network
touchpoints are outbound links (Gmail search, manage/booking URLs) with the VPN small-print.
User documents live in IDB, not the SW cache — the legacy "is the PDF really cached" UI is
obsolete by design. SW behavior is verified on `npm run preview` builds, never dev.

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

# Sojourn — architecture

*The technical companion to the product plan. Product decisions (name, modules, editing model,
design direction) are recorded in ABOUT.md history and the 2026-07-24 plan; this file is the
implementer's reference. The legacy one-file app lives frozen in `legacy/` until cutover.*

## 0. Stack (final)

**Svelte 5 (runes) + TypeScript + Vite + vite-plugin-pwa (Workbox) + Dexie (IndexedDB).**
Static output, zero runtime network dependencies, deployed to Cloudflare Pages by **direct
upload** (`wrangler pages deploy dist --project-name=sojourn`) — never git-integration (privacy:
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

### Fonts
Self-hosted via Fontsource (bundled → hashed → precached): **Fraunces Variable** (display),
**Instrument Sans Variable** (UI), **IBM Plex Mono** 400/600 (codes).
**CJK is deliberately not shipped** (4–15 MB): `.zh` text uses `var(--font-zh)` → system
`Noto Sans SC`, present on the S23 Ultra, offline by definition.

## 1. Repo layout

```
C:\Source\China\
├─ README.md / ABOUT.md          # rewritten at cutover; ABOUT kept as v1 rationale
├─ docs/ARCHITECTURE.md          # this file
├─ legacy/                       # frozen one-file China app — deployable until cutover
├─ sources/china-2026/           # authority documents (guide v12, handoff, insurance, spec, PDF)
├─ seed/china-2026.trip.json     # generated trip file — PERSONAL DATA, never reaches dist/
└─ app/                          # the Sojourn PWA (npm project)
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
   │  │                          #   stats, routemap, backup, legacyImport (all unit-tested)
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
Global: `Settings` (theme, activeTripId, lastBackupAt, lastMutationAt, backupNagDays, persisted) ·
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
#/trip/:id/(today|itinerary|wallet|wallet/spend|tasks|tasks/packing|tasks/lists|info|map|stats|docs)
```

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
3. Assert counts (10+1 stops, 26 dayPlans, 7 runbooks, 7 flights, 11 hotels, 4 cards, 18 tasks,
   15 alarms, 30 packing items, 11 checklist items, 12 info cards, 9 emergency, 32 showCards,
   8 categories, 1 counter, 1 document) **and** that the Israeli passport number appears nowhere,
   then write `../seed/china-2026.trip.json`.

**The deployed bundle stays sterile**: no seed in `dist/`, no auto-offer. Empty vault offers
"Create a trip" / "Import a trip file"; the seed reaches the phone as a user-provided file.
Importing an existing trip id offers Replace (undoable via pre-captured snapshot) or Cancel.

## 7. Backup / export — one envelope

```jsonc
{ "format": "sojourn/backup", "formatVersion": 1, "kind": "vault" | "trip",
  "exportedAt": "...", "appVersion": "...",
  "settings": {...}, "packingTemplates": [...],          // vault only
  "trips": [{ "trip": {...}, ...all child arrays..., 
              "documents": [{ "meta": {...}, "dataBase64": "..." }] }] }
```

- Vault export: gzip via native `CompressionStream` → `sojourn-vault-YYYYMMDD.json.gz`;
  plain `.json` also accepted on import (the seed stays readable in the repo).
  "Copy backup without documents" keeps the legacy paste-into-a-note habit.
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

## 10. Deploy

One-time: `npx wrangler login` && `npx wrangler pages project create sojourn`. Then
`npm run deploy`. Fallback (zero toolchain): drag `app/dist/` into the Cloudflare dashboard.
**New Pages project = new origin** — the legacy SW never collides with the new app; the legacy
URL is decommissioned deliberately after cutover. `wrangler` is a devDependency; auth
alternative: `CLOUDFLARE_API_TOKEN`.

## 11. Verification gates (M8 parity audit)

1. 57-critical-values re-verification of the seed against `sources/china-2026/*` (scripted).
2. `dist/` sterility grep: `8CR7MR|[redacted]|1653716\d+|SALOMON` → zero hits; Israeli passport
   number absent from seed, dist, and repo-visible new code.
3. Latest real phone backup imports cleanly.
4. Airplane-mode dress rehearsal: install → every screen → copy a code → driver card → add
   expense → export vault → reboot → airplane mode → reopen, all green.
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

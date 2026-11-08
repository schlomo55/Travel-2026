# Where this stands — 8 November 2026

*One page, kept current, so any session or person can pick this up cold. For what the app
IS see [OVERVIEW.md](OVERVIEW.md); how to use it, [README.md](README.md); how it is built,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); why it exists, [ABOUT.md](ABOUT.md).*

**This file is the app's engineering status.** A trip's own state — what is booked, what is
paid, what is still open — lives in that trip's data on the phone (and in its private trip
file), never in this public repository. Since Nov 2026 the repository carries no real trip at
all: `seed/` holds three made-up trips (the demo trip, the Israel test trip and the template
example), and the real trips' files are kept by the owner.

---

## The app, in numbers

| | |
|---|---|
| Tests | `npx vitest run` — every test reads a made-up trip; none needs a private file |
| Seeds | `npm run verify:demo` re-runs the demo trip's gate against the committed file |
| Contrast gate | **104 pairs in each of 2 palettes**, 0 failures (`npm run check:contrast`) |
| Bundle budgets | gzipped JS: initial load ≤ **200 KB** · all app JS ≤ **290 KB** · the map engine ≤ **470 KB** · the map builder ≤ **12 KB** (`scripts/check-bundle.mjs`) |
| Rehearsal | `npm run rehearsal` — the offline dress rehearsal, headless Chrome, network hard off, on the demo trip |

Installed on the phone as `com.livingthedream.travel`. A trip arrives as a file you import;
the app itself ships empty and a build gate proves it.

---

## 8 Nov 2026 — the repository goes public, with no real trip in it

- **The first trip left the repository**: its seed, its source documents, the legacy
  single-file app and the scripts that only served them. Every test, the rehearsal and
  `verify:demo` now run on the made-up demo trip (`seed/demo-2027.trip.json`).
- **The privacy gate keeps no real values in the repo.** `scripts/privacy/forbidden.ts` holds
  only generic credential shapes (an e-ticket number, a passport-shaped token, a card number,
  a booking PIN beside its label, …) and the loader for the owner's private list,
  `~/.ltd-private/privacy/forbidden.json`. Without that file the private-value check reports
  **SKIPPED** and the gate passes on the shapes alone — exactly like the passport checks.
- **The map region reads a trip's coverage-only points from the trip** (`trip.mapCoverage`,
  ARCHITECTURE §3) instead of a table in the code.
- **The map builder keeps the place photos** on a rebuild of the same trip, and says which trip
  it builds ("The map build for <trip> stopped at 55 % …"). Settings › Map pack › **Add place
  photos from a pack file** puts a photo pack's photos into the map on the phone, keeping its
  streets.
- **Not done: the app fetching photos itself** — the photo manifest is built in the workshop
  (`scripts/maps/photos/`) from a trip file plus hand choices, which are trip data and are not in
  this repository.

## 7 Nov 2026 — in-app map builder + online map

**What.**
- **Build map for this trip** — Settings › Map pack, and the Map tab while no pack is on the phone.
  In the Android app it cuts the current trip's region out of the newest Protomaps daily build of
  OpenStreetMap, shows the download size and asks, then downloads it (Wi-Fi or mobile data) into
  the phone as the new map pack. Cancel any time; **Carry on** later, also after the app was
  closed. In a browser the button is replaced by one line: it needs the app.
- **The map online** — per tile, the map pack first; a tile the pack does not have (outside its
  areas, or no pack at all) comes from the Protomaps API while the phone is online; with no
  connection nothing is asked and the map is what it always was. A small badge in the map's foot
  says **Offline map** or **Online**.

**The decisions.** 1 · online and offline automatically, pack first. 2 · online source: the
Protomaps hosted API, v4 tiles z0–15; the key stays out of this public repo (only in
`~/.ltd-private/protomaps.key` on the build machine) and its CORS list allows only the Android
app (`https://localhost`) and `http://localhost:8080`. 3 · the builder: the current trip's
region, the latest daily build, the size first, a confirm that warns it **replaces the current
pack completely**; native HTTP (build.protomaps.com refuses WebView CORS); written through the
importer's own `.part` → check → swap; resumable. 4 · the app goes online for maps ONLY for those
two things; offline, zero requests. **And: every stop gets at least ±25 km** (a 50 × 50 km
square) merged into the region — a trip of stops and no places otherwise had only 4 × 4 km round
each city. **Mobile data is fine.**

**What it costs** (7 Nov build, measured with the extractor): a ten-stop trip with ~150 places,
20 boxes, ~24,000 km², a ~125 MB map; the Israel test trip, 6 boxes, 20,249 km², 102.7 MB. The
confirm sheet leads with the download, then the size on the phone.

**How it is built** — docs/ARCHITECTURE.md §9b. `lib/map/region.ts` is the ONE region rule for
the app and `npm run map:pack`; `lib/map/build/` holds the extractor (`pmtiles extract --region`
in TypeScript), the native source, the resume state and the run; `lib/map/street/online.ts` the
online tiles. **The APK is built with `npm run build:android` (→ `dist-android/`)**; `npm run
build` → `dist/` stays keyless (committed, the PWA), and `check:dist` fails if the key is in it.
**`npm run map:pack` takes the trip file: `-- --trip <path>`**; it names the pack and its files
from the trip as the phone does, and re-cuts the committed Bund test pack only for a trip whose
region covers it. **`npm run dev` serves on http://localhost:8080**: the one dev origin the key
allows.

**The independent review (7 Nov), fixed the same day:** `ACCESS_NETWORK_STATE` in the Android
manifest (without it the WebView says online in airplane mode); an 8 s timeout per tile request,
a tile not drawn rejected rather than cached empty and asked for again when back online or the
back-off ends, and back-off (30 s doubling to 10 min) on timeouts, 429 and 5xx — 10 min at once
on 401/403; the builder writes in place through a worker's sync access handle first
(`createWritable` only as the fallback, saving every 32 MB); only committed checkpoints are
saved; 1 MB requests four at once; a 200 to a Range request stops the build; a resume reads the
file's own header; the dev server on :8080. A real-browser repro then caught that missed tiles
were never asked for again and that an offline map with no pack never started: MapLibre reloads
an errored tile through `setTiles` as 'loading' and it hangs; the tiles are now refreshed by id
(`map.refreshTiles`), and a missed tile triggers a repaint.

**The bundle budget.** The builder's work is its own lazy chunk (≈ 9.8 KB gz), loaded only on
the first tap of Build, with **a budget of its own, ≤ 12 KB**; **all app JS went 285 → 290 KB**
for the screens' part. The initial load (200) and the engine (470) are unchanged.

**Not verified on a device yet:** CapacitorHttp's binary answers (base64 through the bridge), its
Range/If-Match handling against build.protomaps.com, the WebView's OPFS writer, the API's CORS
for `https://localhost`, and a real 125 MB build over mobile data.

**The on-phone test** (an APK from `npm run build:android`, key file present): 1 · Map tab, no
pack, online → streets appear, the badge says **Online**; airplane mode → nothing breaks and no
request at all; back online → the empty squares fill in by themselves. 2 · Settings › **Build
map for this trip** → the sheet leads with the download size, then the size on the phone, the
areas, the REPLACES warning → **Not now** leaves everything as it was. 3 · **Build it** on
mobile data → at ~30 % **Cancel** → **Carry on** → it continues from there, not from 0. 4 · at
~60 % swipe the app away, reopen → Settings shows the paused build → **Carry on** → it lands.
5 · Map tab → **Offline map** inside the areas; well outside them while online → **Online**;
airplane mode there → empty beyond the pack, no request. 6 · Settings › Delete, then import the
photo pack file again.

---

## Lantern Run C (13 Aug 2026)

**Google Drive backup, opt-in.** The one thing a file in Downloads cannot do is survive the
phone itself. Scope is `drive.appdata` — the app sees only its own folder, never the owner's
Drive. Payload is the same `livingthedream/backup` bytes the Backup screen already saves,
gzipped, last 10 kept. Auto-backup is debounced and **only ever runs online**; offline it is
a silent no-op.

> **One owner-only step remains.** Google issues an OAuth client id to a *person*, in a
> console, and it cannot be scripted or invented. The app therefore ships with the credential
> `null` and the Backup card says *"Not connected — needs a one-time Google setup"* out loud:
> **[docs/DRIVE-SETUP.md](docs/DRIVE-SETUP.md)**. No test fakes a login, and the rehearsal
> proves the app makes no request to Google while it is not connected.

**Three small road tools**, all built from data a trip already carries: an **offline
converter** (rates from the trip, or from what you actually spent, or typed off the board —
each labelled with where it came from), a **health & insurance** section that gathers the
policy, the assistance line, the local numbers and the medicine note onto one screen, and
**two clocks** on any flight whose own printed flying time proves its ends keep different time.

---

## New trips (26 August 2026)

The multi-trip promise has a mechanism, and it is a form plus a scaffold, not a feature.
Three artifacts: **[docs/TRIP-BRIEF-TEMPLATE.md](docs/TRIP-BRIEF-TEMPLATE.md)**, a blank brief you
fill in as prose; **[docs/NEW-TRIP.md](docs/NEW-TRIP.md)**, the five-step loop — fill, compile,
import, book the open items with Claude, paste the confirmations back; and
`app/scripts/trip-template/`, the builder scaffold whose `assert.ts` is imported rather than
copied, so every trip compiled from a brief passes the same gate. The rule it all turns on:
**every flight and bed line starts `- ✅ BOOKED —` or `- ⏳ OPEN —`** — ✅ becomes a booking with
its reference, ⏳ becomes a `pending` placeholder plus a dated task. A worked example compiles to
`seed/template-example.trip.json` (`npm run seed-build:template-example`, slug `tx00`).

---

## Rules this repo actually enforces

Not aspirations — each one is a gate that fails the build.

- **Never invent a trip fact.** A trip's bookings, prices and addresses come from its own
  sources; where a fact does not exist yet the app shows ⏳ pending.
- **A wrong pin is worse than no pin.** A place gets a map position only when it was verified;
  the rest open by name.
- **Four runtime calls, all disclosed, all optional.** Weather (open-meteo, toggleable), the
  opt-in Drive backup, and the street map's two, in the Android app only: tiles the map pack
  lacks (Protomaps, online only) and **Build map for this trip** — nothing else, ever. No
  analytics, no crash reporting. The rehearsal proves it with the network hard off.
- **The Protomaps key never enters the repo.** Only `npm run build:android` (→ `dist-android/`,
  git-ignored) reads it; `check:dist` fails if it is in the committed `dist/`.
- **No personal data in the bundle or the seeds.** `check:dist` greps every built file and every
  seed for credential shapes and for the owner's private value list, and fails.
- **Nothing is "booked" unless it is.** The brief template refuses an ⏳ OPEN line that does not
  compile to both a placeholder and a dated task.

## Traps that cost real time

- **`encodeURIComponent` leaves `'` alone**, and a literal apostrophe kills a Google Maps
  link stone dead. Everything goes through `enc()`.
- **Amap echoes your query**, so "is the name on screen" matches your own question. Assert
  on the result card.
- **Wireless debugging: read the PAIRING port from mDNS**, not from the screenshot — it
  moves. Then `-s`, because pairing leaves two entries for one phone.
- **The APK is built from `dist-android/`, not `dist/`**: `npm run build:android`. A `dist/`
  copied into the Android project is an app without online tiles — and a key-bearing build in
  `dist/` would be committed to a public repo.
- **Building the APK needs JDK 21**; Gradle caches a daemon on whichever JVM started it, so
  `--stop` after changing `JAVA_HOME`.

---

## Working on it

```bash
cd app
npm run check && npm test && npm run verify:demo && npm run build
npm run preview & npm run rehearsal      # the offline dress rehearsal
```

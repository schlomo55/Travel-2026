# Map 5c — the Map tab (Track B2; brief of 2026-09-29)

Owner: "a map like Google Maps with the points, to navigate to them, with a short detail about the place or its kind —
hotel, spa, food". Approved design = boards `boards/map4-{map,place,go,filters}.dc.html` + `MAPS6.md` (pins, icon set,
colours, copy) + `MAPS5.md`. Owner decisions: offline street data ON THE PHONE (imported once), the map engine loaded ONLY
on the Map tab with its own budget, labels English + Chinese. Quality over speed; no deadline.

Base: `C:\Source\China-map`, branch `horizon-map` = the dark-only Horizon app (Runs 1–4b) + Map 5a data + main's newest
trip data (merged). Read first: `docs/design/HORIZON.md` (the implementer's reference), PROGRESS.md sections "Run 4b",
"Run 4", "Next — after Run 4", "Map 5a", "Merge of main"; `docs/design/horizon/MAP-DATA.md`; and the engine spike
`C:\Users\schlo\AppData\Local\Temp\claude\C--Source-China\e650bdf9-53e7-4193-ba8a-b5dee11d0d3c\scratchpad\mapspike\REPORT.md`
(read it whole). REUSE the spike's work (read-only source — copy what you need into the repo): the map module
`mapspike/proto/src/map/` (incl. `pack.ts`), the style `mapspike/style/horizon-night.style.json`, the scripts
`mapspike/scripts/{make-areas,extract,size-areas}.mjs`, `mapspike/tools/pmtiles.exe`.

## Horizon conventions (from PROGRESS "Next — after Run 4")
One palette in `app.css` (a new colour token goes in `:root` AND `docs/design/horizon/system/tokens.json`; the contrast
gate compares them) · `use:offscreen` on anything that loops · every sheet via `router.pushLayer()` and call the release
it returns on unmount · `await router.closeTopLayer()` before navigating or opening the next thing · motion roles
FLOW (live — the only loop) / COMET / INK / RELAY, and Calm motion / reduced motion / Route animations off → static
end states · add the Map URL to the rehearsal a11y sweep's `FLOOR_SCREENS` · check at 412 AND 384 px.

## Data (Map 5a)
- A place's position = `coord ?? pin` (`pin` is drawn only — never feed it to today's map buttons, city close-ups or
  option ranking). `category` ∈ food · spa · sight · show · hotel · transport · medical · shopping; `detail` = one line in
  the trip's own words — show verbatim, never compose. Places without a position appear in a "Opens by name — no pin
  yet" list, never as a guessed pin. Flights / trains / road legs: transport, no pin.
- Editors already keep unshown fields and drop stale map targets (`retarget()` in `forms/specs.ts`) — keep it that way.

## Build
1. **Map pack (data to the phone):** move the pack build into `app/scripts/maps/` (DEV-ONLY network — never part of
   `npm run build`); re-cut the areas from the VERIFIED positions (`coord ?? pin`) + stops/stations; extract ONE file
   `china-2026-map.pmtiles` at z15 into a git-ignored output folder (report its path and size; the main session copies it
   to Drive). Also commit a SMALL test pack (≤ 1 MB, e.g. z0–13 around Houhai) for the rehearsal.
2. **Import + storage:** a "Map pack" import (Map tab empty state + Settings "On this phone": size, build date, delete).
   File input with NO `accept` filter (an accept list crashes Capacitor's chooser) + PMTiles magic-byte and size check;
   write to OPFS with the spike's swap-in (a failed import keeps the old pack); `navigator.storage.persist()`; tiles read
   with `File.slice`. No pack → pins, YOU and rings on the blank night canvas + "Map pack not on this phone — import it".
3. **Engine (lazy):** maplibre-gl 6.11 (5.24 as the tested fallback if v6's module worker fails in the WebView) + pmtiles
   under `src/lib/map/street/`, imported ONLY by the Map route. The spike's night style, no glyphs URL (phone-drawn text),
   `lang: 'en'` bilingual labels, pins via `addImage` from the MAPS6 icon set, clusters, "© OpenStreetMap contributors ·
   map data stored on this phone". Rebuild on WebGL context loss / resume; stop rendering when hidden.
4. **The tab:** nav = Now · Journey · **Map** · Pocket + Find; route `#/trip/:id/map` (+ a place id for the sheet), with
   the router's aliases; "Show on map" from the guide, the pass, Find and Now wherever a place has a position. Top: "Find
   a place" search + category chips with counts. YOU: sunrise dot, heading cone, accuracy halo; show accuracy ("≈ 900 m"
   when an approximate grant makes distances meaningless). Radar rings 250 m · 500 m · 1 km + a "Rings" toggle. "Near you"
   rail at peek (nearest first; distance ONLY for real positions). Place sheet: category word, name + Chinese, the
   `detail` line, distance + bearing arrow, actions Navigate (primary) · Driver card · Open in Google Maps · Copy address ·
   Add to my day (reuse existing actions; if "Add to my day" has no existing mechanism, build the smallest honest version
   or leave it out and say so). **Guide me**: map fits you + target, FLOW line you → target, a compass card that turns with
   `deviceorientationabsolute` + a per-stop magnetic declination table computed OFFLINE at build time (a WMM model; no
   network), GPS course when walking, "straight line — follow streets on the map", buttons "Turn-by-turn in Amap" (GCJ-02
   via `logic/geo.ts`; works in mainland China without a VPN) · "Google Maps", and "Directions open in the maps app; this
   app never goes online for maps." Filters sheet: every category with icon, colour, count, show toggle; "Hotels: your
   beds only / all".
5. **Android:** add ACCESS_COARSE_LOCATION + ACCESS_FINE_LOCATION to the manifest; ask on first "Locate me"; denied → no
   YOU, no distances, everything else works.
6. **A11y:** the rail + a list view carry every place's name, category, detail and distance for screen readers; 44 px
   targets; focus goes to the sheet when it opens and back to the pin/row when it closes.

## Gates
Start-up JS ≤ 200 KB gz and all app JS ≤ 260 KB gz stay — the map engine chunk + its worker are EXCLUDED from both and get
a THIRD gate in `check-bundle.mjs`: map engine ≤ 470 KB gz incl. worker (spike: 305 + 143). The Map route's own code (not
the engine) counts in the app totals. Rehearsal (offline; WebGL via SwiftShader flags): the Map tab with the small test
pack — tab opens, pins by category, the place sheet, Guide me static under Calm, the no-pack state, the import rejects a
non-PMTiles file, nothing requested off localhost; check:dist clean (no trip data, NO pack in dist/); contrast for map text
and pins. Pure logic (distance/bearing, declination lookup, nearest-first, category counts, cluster labels, accuracy
wording) in `src/lib/logic` with vitest. Screens compared with the map4 boards at 412 and 384 px (screenshots in your report).

## Rules
GIT: read-only git only in `C:\Source\China-map`; NEVER a git command that changes anything; restore dist/ by rebuilding.
Work ONLY inside `C:\Source\China-map` (+ read-only use of the scratchpad `mapspike/`). No adb, no Gradle/APK builds.
Network: ONLY the dev-time pack build (Protomaps build / go-pmtiles) and, if a new place needs it, the verify:places
lookups (≥ 1 req/s per service, cached) — the app, the build and the tests never touch the network. Never write the owner's
name or any passport number; never read `~/.ltd-private/*`; don't touch `app/scripts/privacy/`,
`app/scripts/check-dist-clean.ts`. Keep `app/index.html` LF. Gates green with real numbers: `npm run check`, `npm test`,
`npm run build`, `npm run verify:china`, `REHEARSAL_PORT=4178 npm run rehearsal`. PROGRESS.md: a "Map 5c" section (each part
→ change file:line, tests, numbers, deviations from the boards). Stop cleanly at a part boundary if context runs low.

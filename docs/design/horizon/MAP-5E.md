# Map 5e — photos, "About" and links for the places (brief of 2026-09-29)

Owner, after seeing the Map on the phone: "it look great but i want to add … picture of the places that are pinned, with
link and descriptions". Answers: photos + texts **from the internet — free licences only** (Wikimedia Commons / Wikipedia
first; other free libraries for places without one; NEVER copyrighted sources such as Google, Tripadvisor, Dianping, and
NEVER AI images); a mockup first → the owner chose options **A, B, E, F** (+ A2) on the published page
https://claude.ai/artifact/3aznkPHjSmWETx7NzfctkT (source: scratchpad `photomock/index.html` + `photomock/img/` +
`photomock/raw/` — read it; it is the approved design). NOT chosen: C (list thumbnails), D (guide rows).

Base: `C:\Source\China-map`, branch `horizon-map` (Map 5c + 5d + the merge of main 3fe65ce). Read `docs/design/HORIZON.md`,
PROGRESS.md ("Map 5d", "Map 5c", "Map 5a"), `MAP-5C.md`, `MAP-DATA.md`.

## 1. Data (dev-time network only; never at runtime)
- For every PINNED place (`coord ?? pin`; 165 today): find ONE free photo, a short description and links.
  - First choice: the SAME Wikidata item that verified the pin in Map 5a (see `app/.cache/places/` and
    `app/scripts/china/pin-targets.ts` / `pins.ts`): its P18 image on Commons, its English Wikipedia article (REST summary →
    the first 1–3 sentences VERBATIM), its official website (P856).
  - For places without one: Commons categories for the item, then other free libraries (e.g. Openverse / Flickr CC). Accept
    only CC0, PD, CC BY, CC BY-SA (any version); record author, licence, source URL. A candidate from a search MUST be checked
    by looking at it (you can view images) — it must show THIS place (not a namesake, not a generic street); reject when in
    doubt. Wikidata's own P18 still gets a quick look (wrong or odd images exist).
  - Record per place: `photo` (file id, width/height, author, licence, source page URL), `about` (text + "From Wikipedia" +
    article URL + CC BY-SA), `links` (Wikipedia, official site). Keep the trip's own `detail` line untouched and on top.
- Process each photo: ~800 px long side WebP for the card (A) and Guide me (F), a ~160 px square thumbnail for the rail (B)
  and a ~96 px circular-crop-ready thumbnail for photo pins (E). Strip EXIF/GPS metadata. Report the total size.
- Politeness: Wikimedia/Openverse APIs with a descriptive User-Agent (no email or personal data), ≥ 1 request/s per service,
  everything cached in the git-ignored `app/.cache/`. Never send trip data other than place names/coordinates.
- Report: coverage per city and category (with photo / without), every rejected candidate and why.

## 2. Delivery: inside the map pack (one import)
The photos + their metadata travel WITH the map pack, so the owner still imports ONE file. Extend `app/scripts/maps/` so the
pack build writes a bundle (the map tiles + a photo archive + a JSON index keyed by place id); extend `lib/map/pack.ts` +
the importer to accept it (and still accept a plain `.pmtiles` from before). Store in OPFS next to the tiles; read photos
lazily (object URLs, revoked when unused). No photos in dist/, the APK or git (except a tiny test set for the rehearsal).
The trip file does NOT change for this step.

## 3. The app (the owner's choices — match the mockup)
- **A · place card, big photo:** 16:9 photo at the top of the sheet with the credit on it and a tap-to-full-screen view
  (pinch-zoom not required; close via ✕ and Android back through `router.pushLayer()`); then chip, name + Chinese, the trip's
  own line, **About · From Wikipedia** (the verbatim extract), a links row (Wikipedia · Official site when known · Google Maps ·
  Amap — reuse the existing map buttons and the territory rule), distance + Navigate as today.
- **A2 · no free photo:** the category-colour placeholder with its icon and "No free photo of this place".
- **B · "Near you" cards:** a photo on top of each card (placeholder colour for places without one).
- **E · photo pins:** at close zoom (decide the threshold with screenshots, e.g. ≥ z15) a place with a photo shows a small
  round photo in a category-colour ring instead of its icon; zoomed out → icons; clusters unchanged; selected state still
  clear; performance stays smooth (prefer map images/symbols over hundreds of DOM markers; measure).
- **F · Guide me:** a "Look for this" row with the photo, the name + Chinese and the credit.
- Credits page: Settings → "Photo credits" listing every photo's author, licence and source (licence compliance).
- Everything works offline; Wikipedia / official-site links open outside the app (they need internet; in mainland China
  only with a VPN or a roaming eSIM — say so quietly under the links).

## 4. Gates + checks
All existing gates green (start-up ≤ 200, all app ≤ 260, map engine ≤ 470 KB gz); a rehearsal row for each of A, A2, B, E, F
with the tiny test photo set; check:dist clean (no photos in dist); unit tests for the index, the lookup, the credit text,
the pin-photo zoom rule. Screenshots of A, A2, B, E, F at 412 and 384 px next to the mockup. PROGRESS.md: a "Map 5e" section
with the coverage table.

## Rules
GIT: read-only only; work only in `C:\Source\China-map` (+ read-only `scratchpad/photomock/`, `mapspike/`). No adb/APK.
Never write the owner's name or any passport number; never read `~/.ltd-private/*`. Keep `app/index.html` LF. Stop cleanly
at a part boundary if context runs low.

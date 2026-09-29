# Horizon build — progress

Plan: `horizon-build-2026-09.md` (§3). Worktree `C:\Source\China-horizon`, branch `horizon`.
Nothing is committed by the builder; the main session commits with the owner's OK.

## The switch — Horizon becomes the real LTD · DONE (2026-09-29)

The owner approved the final switch after testing Horizon + Map + photos + Reminders on the S23. On horizon-map after
the Reminders merge (051d7b3): applicationId `com.livingthedream.travel` (was the `.horizon` preview), app_name and
title_activity_main back to "LTD"; the launch screen wears Horizon's night sky #0B0C16 (res/values/splash.xml +
`windowSplashScreenBackground` for Android 12+; icon-src/splash.svg + scripts/make-android-assets.ts regenerate the
splash bitmaps on that colour; the launcher icon keeps its black plate). The long-press shortcuts are generated for the
real id. Verified on the release APK: package com.livingthedream.travel, label LTD, signer 25c7bbce… (the installed
LTD's), all permissions, 48 web files identical to dist, 0 passport hits, splash colour 0xff0b0c16. main is then
fast-forwarded to this commit (coordinated with china-0e). After installing over the real LTD the owner imports the
map pack once (the real app has its own storage), turns Reminders on in Settings, and deletes LTD Horizon.

## Map 5f — the fixes for the photos and the fold (FIX-5F.md) · DONE (2026-09-29)

Worktree `C:\Source\China-map`, branch `horizon-map`, on 6ddd9da (5e = cba4bb1 + main 4f919a5). All 17 items of
FIX-5F.md — the code review's 3 MEDIUM + 11 LOW and the design check's HIGH, MEDIUM and optional LOW — HIGH first.
Read-only git only (status, diff, log, show; `cat-file -e` to test a path at HEAD); no adb, no Gradle; nothing
touched outside the worktree; the scratchpad's `photomock/` and `fid5e/` only read; `app/scripts/privacy/`,
`check-dist-clean.ts`, the signing block and `app/index.html` untouched; the only network was none — the one title
item 3 needed was already in the Openverse cache, and the manifest and the pack were rebuilt with a new
`PHOTOS_OFFLINE=1` guard that stops a run rather than let it ask anything the cache cannot answer.

### Each item → the change

| # | Item | The change (file:line) | Proved by |
|---|---|---|---|
| 15 | HIGH · the nav hid the end of the place sheet (5e scrolled the whole sheet; its last ~90 px sat under the fixed nav on first view — at 412 the links chips cut, "Maps" beside the nav; at 384 the About cut) | The sheet is now a box whose words scroll in `.m-sheetbox`, and the box ENDS ABOVE THE NAV: the sheet's foot (`--nav-h` + the phone's bar) is its own ground, where the nav floats — nothing of a place is under the nav at any scroll position. The cap is 5e's. Its last 16 px fade (the rail's own "more" idiom), with `scroll-padding-bottom` so keyboard focus never lands in the fade. `routes/Map.svelte:1078-1083` (markup), CSS `:1879-1905`. Checked on every Map sheet: the place (with and without a photo), "Near you", the filters and the list (sheets above the nav, z 71), Guide me (no nav) | rehearsal "Map 5f · the nav never covers a sheet's end (412, 384)" — 12 views: Beihai and the Massage Hospital at their top and end, Near you, filters, list, Guide me, at 412 × 915 and 384 × 824; 8 px clear at both widths |
| 1 | MEDIUM · a second place opened part-way down (the scroll box stays as one place gives way to another) | A new place id resets the box to its top; the same place keeps its scroll (`boxFor`). `Map.svelte:586-602` | rehearsal "Map 5f · a second place opens at its top": Beihai scrolled to Navigate (and kept 1.2 s later), then the Drum Tower in the same sheet — at its top, its photo first |
| 2 | MEDIUM · the importer read deep offsets of the PICKED file (a Drive stream cannot seek) | The picked file gives its 127-byte header only (as 5d), then one sequential copy; the whole check (`checkWhole`: metadata, the declared photos, trailer, index) runs on the SAVED copy in OPFS, which can seek; a copy that fails it is deleted, the old pack kept. `lib/map/pack.ts:17-26` (why), `:436-442` (header only), `:466-470` (the copy checked whole) | `packimport.test.ts` +4: a `File` that serves only reads from its first byte and refuses — and counts — every other: the photo pack imports with 0 reads out of order, a plain pack too, one cut short in its photos is refused on its copy (deleted, the old pack kept), a trip file refused on its header before a byte is written; 5e's "cut short in its photos" test now expects the refusal on the copy (no `.part` left). Rehearsal "Map 5f · a pack that can only be read in order imports": Settings' own Replace, the picked file patched to refuse reads past its start — lands, 0 out-of-order reads |
| 3 | MEDIUM · the Flickr photo's credit title was its Openverse id | The manifest stores the title its author gave it, from the Openverse record already cached ("Dali - Cangshan"), for any photo not on Commons (`scripts/maps/photos/manifest.ts:129-132`, type `pack-photos.ts:23`, into the index `:102`); the index keeps it (`lib/logic/placephotos.ts:38-41`, `:154`); `photoTitle` names a photo by that title, else by its Commons file name, and never by an internal id — `''`, and the credits page then says "A photo on Flickr" (`placephotos.ts:212-225`, `components/map/PhotoCredits.svelte:56-62`, `i18n/photos.ts:39`). The pack rebuilt (below) | `photomanifest.test.ts` +1 (every photo not on Commons carries its own title; the Jade Belt Road's is "Dali - Cangshan"), `placephotos.test.ts` (the title through the index; none → `''`, never the id); screenshot `{412,384}-5f-credits-jade.png` |
| 4 | LOW · today's and tonight's tags covered the bottom of photo pins | The map now says which pins wear their photo as it comes to rest (`lib/map/street/index.ts:541-562`, `onDrawn(ids, at, photos)` `:105-109`); the tag hangs `tagBelow(v, photo)` under the pin: 20 under an icon (5c), 26 under a photo pin's rim with today's halo, 29 under tonight's ring (`logic/wayfind.ts:347-355`, `Map.svelte:429-457`) | `wayfind.test.ts` "today's and tonight's tags hang below what is really drawn"; `streetmap.test.ts` (which pins wear their photo at z15.5, none at z14.5); screenshots `{412,384}-5f-E-tonight.png` (↓29), `-E-today.png` (↓26) |
| 5 | LOW · the keep-off-the-pins geometry assumed icon pins | One geometry, from where the pin is painted: the photo pin's numbers live in `logic/placephotos.ts:247-256` (`PHOTO_R` 20, `PHOTO_RIM` 23.5, `PHOTO_TONIGHT` 27.25, `PHOTO_HALO` 29, `PHOTO_LABEL_EM` 2.5, `PHOTO_NAME_BELOW` 43), `street/pins.ts:14,148,155` paints with them; `pinBox` — the disc or the photo's rim and the name under it, as wide as the name and a line lower for one that wraps — `wayfind.ts:288-345`; `footPlace` and the ring labels use it (`:324`, `:365`); `data-at` carries it for the rehearsal (`street/index.ts:593`), whose foot check now uses it too (`rehearsal.mjs:4457`) | `wayfind.test.ts` +3: the foot keeps off a photo pin's round and lower name where an icon's would be clear; a pin's room; the chip case below |
| 6 | LOW · folding during a fling lost "keep the view" | Under a gesture the change waits for the move to end — once, with the last padding and any `keep` among them — and then goes through `api.setPadding(padding, keep)`; a rebuilt map drops a wait of the old one. `street/index.ts:804-818`, `:233-236`, `:491-493` | `streetmap.test.ts` "folding while a fling still glides…": nothing applied mid-fling; at its end one keep-jump to the new room's middle (5e applied the padding plainly and the map jumped) |
| 7 | LOW · the index accepted a CC BY photo with a blank author | A blank author only where the licence asks no credit (CC0, the public domain): `creditFree` `placephotos.ts:104-106`, `parseIndex` `:140-151` | `placephotos.test.ts`: CC BY / BY-SA with '' or '   ' dropped; CC0 and PD kept |
| 8 | LOW · the photo index was not matched to the trip | `indexForTrip` (`placephotos.ts:196-199`): the Map tab's photos only when the index names this trip (`Map.svelte:250-259`) — the Israel trip with the China pack: no photo, no empty "no free photo" box, no About, no photo pin | `placephotos.test.ts` "photos only for the trip the pack was built for"; rehearsal "Map 5f · the Israel trip with the China pack: no empty boxes" (the sample trip imported offline, walked at Ein Bokek — the one place it pins near the Dead Sea — then deleted through the shelf); screenshots `412-5f-israel-{rail,place}.png` |
| 9 | LOW · landscape overflow | **Decided: cap to the screen, no orientation lock** — Map 5d chose to handle rotation (the compass reads the screen's angle), the web manifest's `portrait` binds only an installed PWA, the full-screen photo and the paper modes gain from landscape, and a lock is an APK change this run cannot build or test. On a short screen (`max-height: 540px`): "Near you" stops under the search row, its head and chevron always on screen, its body scrolls (`Map.svelte:2006-2029`); the rail's photo band 64 px, its line one row (`Rail.svelte:187-201`); a place's sheet leaves 150 px for the top row and the pin, its photo a 26dvh band (`PlaceSheet.svelte:274-285`); Guide me stops under its header and scrolls (`GuideMe.svelte:218-227`) | at 915 × 412 (`map-shots --only 5f`): Near you 84→412, chevron at 109 (5e: 466 px tall, its top and chevron off the screen); folded 249→412; a place 150→412, words ending 8 px above the nav; Guide me 84→412 (it ran 62 px off the top). Screenshots `915x412-5f-{peek,peek-folded,place,go}.png` |
| 10 | LOW · the rail re-sorted right after "Show places" | The views the fold's keep-jump makes say so (`StreetView.kept`, `street/index.ts:66-70`, `:414-422`, `:823-829`); the Map tab does not settle the rail's centre on them — only a real camera move or a new fix sorts it (`Map.svelte:314-324`) | `streetmap.test.ts` "the view a fold makes says so (`kept`)…"; rehearsal "Map 5f · 'Around here' keeps its order as the places come back" (no position: 12 cards, the same order before, on and 1.5 s after the fold) |
| 11 | LOW · screen readers never heard the credit | `photoButtonName` (`placephotos.ts:207-210`): the card's photo and Guide me's "Look for this" are named with what a tap does AND the credit they wear (`PlaceSheet.svelte:104-105`, `GuideMe.svelte:100-101`); Settings › Photo credits names each link with its title, author and licence, and each text with its licence (`PhotoCredits.svelte:56-66`) | `placephotos.test.ts` "a photo button's name says what a tap does AND the credit"; the rehearsal's a11y floor names every control at both widths |
| 12 | LOW · the texts' licence was linked only when a photo shared it | `licencesUsed` counts the About texts too (by article, once) and links every licence — the photos' own deed, else its deed by name (`deedOf`) — `placephotos.ts:286-335`; the credits say "43 photos · 90 texts" (`i18n/photos.ts:35-37`, `PhotoCredits.svelte:41,45`) | `placephotos.test.ts` "links the About texts' licence too, whether or not a photo shares it" (+ the shape of the licence list updated); screenshot `{412,384}-5f-credits-top.png` |
| 13 | LOW · dead and test-only code | `scripts/maps/photos/_about.ts`, `_cands.ts`, `_first.ts`, `_list.ts`, `_search.ts` removed (dev scratch; nothing used them); the zoom rule has ONE source — `photoPinStep` builds the style's `step` for the pins' image and their names' offset (`street/index.ts:388,396`) and `photoPinAt` evaluates the same `step` (`placephotos.ts:233-245`), also for the screen (`street/index.ts:543`); `focusOf` and `liveUrls` gone; the logic's `photoPinImage` → `photoPinName` (and `parsePhotoPinName`), so `street/pins.ts photoPinImage` is the only one | `placephotos.test.ts` "the style's zoom rule and the screen's reading of it are one" (every quarter zoom 10–19); `streetmap.test.ts` "the style draws … with the one zoom rule" |
| 14 | LOW · `S.photos` and three glyphs in the start-up bundle | `S.photos` moved to `lib/i18n/photos.ts` (`SP`), read only by the lazy Map tab and Settings (`strings.ts:597-598`; `ARCHITECTURE.md` notes the one exception). **The three glyphs** (`expand`, `chevron-down`, `chevron-up` in `lib/map/icons.ts`) were already outside the start-up bundle — measured: they sit in the lazy `PackImport` chunk the Map tab and Settings share; the chevron paths the entry does carry are the Run 1 nav icons' own (`horizon/Icon.svelte`) | bundle gate: start-up 192.44 → **191.97 KB** gz |
| 16 | MEDIUM · an edge chip covered a photo pin's name (Central, z15.5, 412) | A chip keeps clear of every drawn pin AND its name, with the photo geometry of item 5 (`pinOn(q, chip, 4)`, `Map.svelte:780-781`); a step along its edge that finds no clear spot drops the chip. Found while checking it at 384 (the same in 5e's evidence): a chip stepped along the right edge kept its old x, and ran under the side controls — its distance and arrow hidden under Rings and the zoom; the step now re-places it beside or below the controls (`onEdge`, `:768-769`) and a chip never lies on them (`:771`, `:782`) | `wayfind.test.ts` "an edge chip keeps off a photo pin's name, which the old 17 px square missed" (the design check's own numbers); screenshots `{412,384}-5f-E-hk-z15_5.png` — at 412 PMQ is named and "Dragon's Back" gives way; at 384 no chip under the controls (none fits clear of you, the pins and the controls in that short band: they give way; folding "Near you" gives them room) |
| 17 | LOW (optional) · the viewer's empty bands read as "not loaded" | Done, cheaply: the photo and its caption are one group in the middle of the screen, the photo in a quiet frame (its radius and a hairline) — a wide photo no longer floats between two bands with its credit at the foot. `components/map/PhotoViewer.svelte:61-75`, CSS `:126-157` | screenshots `{412,384}-5f-viewer-{wide,tall}.png`; the rehearsal's A row (credit, file page, focus, back) unchanged |

### The pack, rebuilt (item 3)

`PHOTOS_OFFLINE=1 npx tsx scripts/maps/photos/manifest.ts` then `PHOTOS_OFFLINE=1 npm run map:pack -- --photos-only`,
the cache alone. `manifest.json`'s one change: `"title": "Dali - Cangshan"` on the Jade Belt Road.

| Pack | Path | Bytes | SHA-256 |
|---|---|---:|---|
| **The owner's, with photos** (to Drive, replacing 5e's) | `C:\Source\China-map\app\.cache\maps\china-2026-map-photos.pmtiles` | **65,831,139** (65.83 MB; 5e's 65,831,111) | **`51d72a995e19dfa040b479624eb470513940f67ec902f3eaa2a90433a31df826`** |
| The rehearsal's tiny set (committed) | `app/scripts/e2e/fixtures/houhai-test-photos.pmtiles` | 710,187 — byte-identical to 5e's | `eef50df2d0a317c31a60d1e6ce1e7845a99d2396ccfaf1a64c8264e94fbccfed` |

Read back with the app's own reader against 5e's pack (kept at `app/.cache/fix5f/china-2026-map-photos.5e.pmtiles`):
the tiles and directories past the metadata identical, all 372 images (123 photos × card, rail, pin) byte-identical,
the index different in exactly one entry (the Jade Belt Road's title; the metadata's declared photo bytes +26, the
archive's gzip'd metadata +2 bytes). 123 photos, 11.56 MB of images, as 5e.

### Tests

- **vitest: 1010 → 1028** — `placephotos` 21 → 25, `wayfind` 28 → 32, `streetmap` 4 → 9, `packimport` 11 → 15,
  `photomanifest` 10 → 11.
- **They fail without the fixes.** The new tests run against the 5e source (a copy of HEAD made with `git show`,
  `app/.cache/fix5f/head/`): **21 fail** there — every item's test (and the two whose expectations changed shape:
  the licence list's `texts`, the photo-pin names) — and all 93 pass on 5f.
- **Rehearsal rows, new: 5** (`scripts/e2e/rehearsal.mjs:5065-5316`, the "MAP 5F" section) — the four asked (a second
  place at its top; a pack that can only be read in order; the Israel trip without empty boxes; the nav never over a
  sheet's end at 412 and 384) and one for item 10 ("Around here" keeps its order). **Each fails on a 5e build**: the
  section cut out with what it stands on (`app/.cache/fix5f/mini5f.mjs`, made by `make-mini.mjs` from the rehearsal
  itself) and walked against the 5e copy built with `vite build`: "the Drum Tower opened 102 px down — where Beihai Park
  was scrolled to" · "the importer asked the picked file for 1 read(s) past its start" · "1 photo box(es) on 1 card(s)
  — the China pack's colours" · "the rail came back in another order" · "412 Beihai at its top: 3 under the nav
  (Links open outsi… | Show where you a…)"; the same five pass on the 5f build. The foot check (`__foot`) now uses
  the photo pin's geometry.
- Screenshots: `node scripts/e2e/map-shots.mjs --only 5f --out .cache/shots/map5f` (the owner's rebuilt pack; 31 in
  `app/.cache/shots/map5f/`: `{412,384}-5f-{A-top,A-end,A-navigate,B-second,A2,viewer-wide,viewer-tall,credits-top,credits-jade,E-hk-z15_5,E-tonight,E-today}`,
  `915x412-5f-{peek,peek-folded,place,go}`, `412-5f-israel-{rail,place}`); beside the approved mockup and 5e's
  evidence in `app/.cache/shots/map5f/compare/5f-{A-412,A-384,second-place,A2,viewer,E-412,E-384,credits,landscape,israel}.png`
  (`app/.cache/fix5f/compare.mjs`).

### Against the mockup, and what differs

The place card keeps the mockup's order and proportions at both widths (photo, chip and ✕, name and Chinese, the
trip's line, About, links, distance, Navigate, the two buttons); what 5f changes is where the words stop — above the
nav, which the mockup's frame does not draw. Where it differs, and why:
- The sheet's words fade over their last 16 px above the nav band (a hard cut through a line of the About at 384
  read as broken); the fade covers only the sheet's own padding once scrolled to the end.
- Edge chips give way rather than lie on a pin, its name or the side controls — at 384 in Central (Dec 23) both of
  5e's chips go (5e drew them with their ends under Rings and the zoom).
- Landscape is capped, not locked (item 9, above); on its side the phone shows a place's photo as a 26dvh band.
- The full-screen photo is framed and captioned in place (item 17) — the mockup has no full-screen frame.
- `i18n/photos.ts` is the one string module besides `strings.ts` (item 14; ARCHITECTURE.md says so).

### Gates at the end of Map 5f (from `C:\Source\China-map\app`, Git Bash, all re-run in order on the final tree)

| Gate | Result |
|---|---|
| `npm run check` | 675 files, 0 errors, 0 warnings (+ scripts `tsc`) — 674 at 5e (+ `i18n/photos.ts`) |
| `npm test` | **1028 passed in 58 files** — 1010 at 5e |
| `npm run build` | contrast 65 tokens, 135 pairs, 0 failures · precache 40 entries · check:dist 62 built files clean, both passport identifiers absent (11 repo files), 14 patterns · **bundle: start-up 191.97 / 200 · all app JS 249.70 / 260 · map engine 449.65 / 470 KB gz** (5e: 192.44 / 248.75 / 449.45) · "no map pack and no photo in dist/" |
| `npm run verify:china` | 136 critical values + 92 structural facts, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **204/204** with the network hard off, on a fresh build of the final tree (199 at 5e + the 5 new rows); no uncaught exception; the a11y floor over 100 screens and overlays at both widths (3,068 controls); Map · nothing asked off this machine: 598 requests, all local (the forecast apart) |

**Left, and why:** landscape is capped, not locked — should the owner prefer a lock, it is one attribute
(`android:screenOrientation="portrait"`) on the activity and an APK build, neither possible in this run. The photo
pins' cost where they crowd is still measured only in headless Chrome (5e). The rebuilt pack goes to Drive by the
main session (its SHA above); the 5e pack there has the Openverse id as the Jade Belt Road's title.

## Map 5e — photos, "About" and links for the places (MAP-5E.md) · DONE (2026-09-29)

Worktree `C:\Source\China-map`, branch `horizon-map`, on c450c61. The owner's choices from the mockup
(`scratchpad/photomock/`, published 3aznkPHjSmWETx7NzfctkT): **A** (the place card's photo, About, links), **A2** (no free
photo: the category's colour), **B** ("Near you" cards with a photo), **E** (photo pins at close zoom), **F** ("Look for
this" in Guide me); not C, not D. Built in four parts, the tree building between them; this section is written as each
lands. Read-only git only; no adb, no Gradle; nothing touched outside the worktree (and the read-only mockup);
`app/scripts/privacy/`, `check-dist-clean.ts`, `app/index.html` and the signing block untouched.

| Part | State |
|---|---|
| 1 · data: photos, About, links — every candidate looked at | done |
| 2 · the pack: the bundle, the build, the importer (old packs still import) | done |
| 3 · the UI: A, A2, B, E, F, Settings › Photo credits | done |
| + the owner's addition during the run: "Near you" folds away and back (the arrow) | done |
| 4 · gates, rehearsal rows, screenshots | done |

### Part 1 · the data — every photo looked at

**The places.** Every place the Map tab DRAWS (`coord ?? pin`, the same `mapPlaces` the tab uses): **148 places**
(157 pinned entities — nine tickets ride with the place at their point). The brief's "165 today" counted something
else; the seed draws 148. `app/scripts/maps/photos/places.ts` lists them with the Wikidata item Map 5a's evidence
verified each pin with (`pins.ts`: the item the OSM answer links to, or the one that confirmed a stored coordinate
within 1 km) — **113 places** have one.

**Where the photos came from, in this order** (`fetch.ts`, `extra.ts`): the item's own image (P18) → files in its
Commons category (P373) → files geotagged near the pin whose name or categories carry the place's name → a Commons
search by the place's names → Openverse (Flickr and other free libraries), licence-filtered to CC0 · PDM · BY · BY-SA.
Then a second, hand-written look for the places still without one (the names they go by, `extra.ts ASK`/`THIRD`).
**Every candidate was LOOKED AT** on contact sheets (`fetch.ts grid|sheets`, `app/.cache/photos/sheets/`: 12
first-look sheets of each place's leading candidate, 10 of up to five alternatives, 12 of the second look) before a
choice was made; each choice says what the photo shows (`choices.ts`, `shows`), each refusal why (167 recorded).

| Found by | photos |
|---|---:|
| the item's own image (P18) | 89 (+ the lakes' photo again, for the Houhai card) |
| the item's Commons category | 13 |
| a Commons search by name | 11 |
| geotagged near the pin, named for it | 9 |
| Openverse (Flickr) | 1 |

**Licences** — all on the owner's list, each checked twice (`rules.ts licenceOf` on Commons' machine-readable code;
`manifest.ts` refuses a choice whose licence is not on it), counted per photo (123): CC BY-SA 4.0 43 · CC BY-SA 3.0 34 ·
CC BY 2.0 14 · CC BY 3.0 8 · Public domain 6 · CC0 5 · CC BY-SA 2.0 4 · CC BY-SA 2.5 4 · CC BY 4.0 4 · CC BY 2.5 1 — the
same numbers Settings › Photo credits shows. Refused on licence: GFDL-only
(the Capital T3 item's own photo and two more), "Copyrighted free use" (a Nan Lian photo). Refused on credit: two item
photos whose file pages name no author ("no machine-readable author") and one whose author field is only a Flickr
link labelled "[2]" — a photo nobody can be credited for is not used (`rules.ts creditable`, tested).

**The results: 124 of 148 places with a photo (123 photos — the lakes' photo serves Shichahai and the Houhai card),
91 with an About, 27 with an official site.**

| City | places | with a photo | without | About | official site | food | spa | sight | show | shopping | hotel | transport | medical |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kunyu Academy | 6 | 4 | 2 | 3 | 1 | · | · | 4 / 6 | · | · | · | · | · |
| Beijing | 30 | 28 | 2 | 23 | 10 | 1 / 1 | 0 / 1 | 18 / 18 | 3 / 3 | 1 / 1 | · | 5 / 5 | 0 / 1 |
| Chongli | 4 | 3 | 1 | 1 | 0 | · | · | 2 / 3 | · | · | · | 1 / 1 | · |
| Zhangjiajie | 13 | 9 | 4 | 7 | 1 | · | · | 7 / 8 | · | · | 0 / 2 | 2 / 3 | · |
| Chongqing | 19 | 14 | 5 | 11 | 2 | · | 0 / 1 | 10 / 12 | 1 / 2 | · | 0 / 1 | 3 / 3 | · |
| Lijiang | 13 | 12 | 1 | 5 | 1 | 1 / 1 | · | 10 / 11 | · | · | · | 1 / 1 | · |
| Tiger Leaping Gorge | 3 | 1 | 2 | 1 | 0 | 0 / 1 | · | 1 / 1 | · | · | 0 / 1 | · | · |
| Dali | 13 | 9 | 4 | 2 | 1 | · | · | 9 / 11 | · | · | · | 0 / 2 | · |
| Kunming | 8 | 7 | 1 | 4 | 1 | 0 / 1 | · | 4 / 4 | · | 1 / 1 | · | 2 / 2 | · |
| Hong Kong (+ Macau) | 39 | 37 | 2 | 34 | 10 | 4 / 5 | · | 23 / 23 | 3 / 3 | · | 1 / 1 | 6 / 6 | 0 / 1 |
| **All** | 148 | **124** | 24 | 91 | 27 | 6 / 9 | 0 / 2 | 88 / 97 | 7 / 8 | 2 / 2 | 1 / 5 | 20 / 23 | 0 / 2 |

(category cells: with a photo / places)

**Without a photo (24), and why** — no free photo of the place itself, only of something else or of nothing:
Yangma Island (an untitled hazy coast 2 km off; Openverse's "island" hits were Island Peak in Nepal) · Yantai Museum
and the Dongba museum (only objects in cases) · Fulong (namesakes: a Tangshan street, 1928 Fu Lung banknotes) · the
Shili Gallery (Yangshuo's namesake, 600 km away) · Zhangjiajie West station (trains elsewhere) · One Tree platform ·
Eling Park (only the view FROM its tower) · Ronghui hot springs · the 1949 Grand Theatre · the Tea Horse and Halfway
guesthouses (a hillside where the house cannot be told; a sunset) · the Zhonghe and Ximatan cableways (Cangshan
cableways whose files do not say which of the three) · Zhoucheng (a Binchuan namesake) · Longkan Wharf (Hangzhou
carvings) · Wenlin Street (Sha Tin's 文林路) · Lung King Heen (only dishes) · the Massage Hospital · the Huguosi
hospital · the Shenzhen clinic · Pullman, Huatian (Changsha's namesake), Glenview. Each place says so on its card
(A2), and the refusals are listed one by one in `app/.cache/photos/report.md` and the committed `manifest.json`
(`rejected`, 167).

**Refused on a closer look (a sample; all 167 in the manifest):** Penglai's item photo (the pavilion a speck on a
headland), the Observatory's (a bust in the garden), Capital T3's (GFDL only; planes on the apron), Hollywood Road's
and Tung Chung's item photos (no author to credit), Lamma's (the island far off), the Dragon's Back's (the view down
onto Shek O), a Yat Lok chilli basket and menu, WinterFest crowd portraits, the Royal Garden's roof from a tower, the
Tianmen summit cave for the cableway card, and namesakes by the dozen (a 天门山 800 km away, a Wanlong 570 km away).

**About = Wikipedia's words, verbatim** (`rules.ts aboutText`, tested; `photomanifest.test.ts` proves every one is a
prefix of the article's own summary and ends at a sentence's end): the REST summary of the item's English article,
its first paragraph, one to three whole sentences within 380 characters — and never past Wikipedia's own missing space
(Hollywood Road's "vicinity.It" stops before it). Labelled "About · From Wikipedia", with the article and CC BY-SA 4.0.
**Fixed by hand, with reasons** (`choices.ts`): two items Map 5a's coordinate check had matched to a namesake inside
the place — the Lijiang Old Town card (Q130601985, the Wenchang Palace → Q618394) and Dali Ancient City (Q85852932, the
Catholic church → Q126678744); one About left out (Yuanjiajie's article is a redirect to the whole forest park); one
official site left out (the Big Buddha's is malformed, `…/.com`). Official sites: the item's P856, the English one
where it names two.

**Politeness.** Only at dev time, only Wikidata, Commons (+ its image server), English Wikipedia, Openverse and one
Flickr image: a User-Agent naming the tool and its purpose (no e-mail, nothing personal), one request in flight per
host and ≥ 1.1 s apart, a 429 obeyed (5 s from then on, Retry-After waited out — Commons asked for up to 35 s);
every answer cached by URL (`app/.cache/photos/`, git-ignored), so every step re-runs offline. Only place names,
coordinates, Wikidata ids and Commons titles were sent. One slip, owned: a first run of the lookup kept going for
~5 minutes after its task was stopped (the tool's stop did not reach the node child on Windows), so Commons briefly
had two of my queues at once; it was killed by PID and the next run shared the cache.

| What | Where |
|---|---|
| The drawn places and their Map 5a items | `app/scripts/maps/photos/places.ts` (`photoPlaces`, `map5aItem`) |
| The one door to the network (UA, per-host cadence, 429s, the cache) | `photos/net.ts` |
| The rules: licences, credit text, creditable authors, the verbatim sentence cut | `photos/rules.ts` (`licenceOf`, `plainText`, `creditable`, `sentenceEnds`, `aboutText`) |
| The lookups and the contact sheets | `photos/fetch.ts` (stages `items summaries files openverse thumbs sheets grid`), `photos/extra.ts` (the second look) |
| The choices — every verdict, what it shows, every refusal | `photos/choices.ts` (`CHOICES` 148, `ITEM_FIX`, `ABOUT_SKIP`, `OFFICIAL_SKIP`) |
| The manifest the pack is built from (committed) | `photos/manifest.ts` → `photos/manifest.json`; report `app/.cache/photos/report.md` |
| The crops, looked at out of the built pack | `photos/review.ts` → `app/.cache/photos/sheets/crops-*.jpg` (three focal points moved: Drum Tower, Three Pagodas, Big Buddha) |
| Tests | `src/tests/placephotos.test.ts` (20: licences, credits, the cut, the index, the lookup, the zoom rule), `photomanifest.test.ts` (10: every drawn place, every licence, every About verbatim) |

### Part 2 · the pack — one file, one import

**The format** (`lib/logic/placephotos.ts`, `lib/map/pack.ts`). The pack is still ONE file and still a PMTiles v3
archive: the archive, unchanged but for one metadata key, and then — past its last section, where no PMTiles
reader looks — every photo's three WebP images, the index (JSON, keyed by the Map tab's place id) and a 32-byte
trailer: `LTDPHOTO`, a version, the index's offset and length. Every offset counts from the end of the archive, so
stamping the metadata (which changes the archive's length) moves nothing the index says. The archive's metadata
declares the photos (`ltd:photos`: `{v, count, bytes}`), so the importer knows what must follow.
- **One swap, as before.** The file is checked whole before a byte is written (`checkWhole`: the header, then
  `readPhotos` — the file exactly archive + declared bytes, the trailer there, the index readable, every image inside
  the photo region), copied to `.part`, checked whole again, moved in. A copy cut short in its photos is refused
  exactly as one cut short in its tiles ("did not copy completely — the old one is still here"). An interrupted swap
  is finished on the next open only if the copy checks whole.
- **Old packs still import**, unchanged: a pack without the declaration has no photos, and every screen looks as it
  did (the rehearsal walks the plain test pack first, then the one with photos). The other way round works too: a
  Map 5d app importing the new pack reads its tiles and ignores what follows.
- **The index is trusted only as far as it checks** (`parseIndex`): a photo without its author, licence or page, or
  an image outside the photo region, is dropped; an About without its article is dropped. A place the pack LOOKED at
  with no photo says so (A2); a place it never looked at (added to the trip after the pack was built) shows nothing.
- **Read lazily** (`lib/map/photoUrls.ts`): each image is a slice of the pack File (no copy), shown through an object
  URL that is counted out and back and revoked 1.5 s after the last image showing it goes; the count is on
  `document.documentElement.dataset.photoUrls` for the rehearsal. The index is read once per pack and kept
  (`packPhotos`). Settings shows "· N photos" in the pack's line.

**The build** (`app/scripts/maps/build-pack.ts`; `photos/bundle.ts`, `photos/pack-photos.ts`):
`npm run map:pack` now ends with step 5 — the photos — and `npm run map:pack -- --photos-only` redoes just that from
the tiles already built. For each chosen photo, its source image (Commons' 1280 px rendering, or the original when
smaller; the source's own full image elsewhere) is fetched once (cached), then **card** 800 px on the long side
(uncropped), **rail** 536 × 216 (the "Near you" banner at 2×), **pin** 128 px square — the last two cropped round the
photo's focal point; orientation baked in, EXIF/GPS/XMP/ICC never written (checked on every image). The archive is
copied, its metadata stamped, `pmtiles verify` run on it as an archive, the photos appended, and **the whole file read
back by the app's own reader** (`describePack` + `readPhotos` in node) before it is renamed into place.

**The packs:**

| Pack | Path | Bytes | Photos |
|---|---|---:|---:|
| **The owner's, with photos** (to Drive) | `C:\Source\China-map\app\.cache\maps\china-2026-map-photos.pmtiles` | **65,831,111** (65.83 MB) | **123** (11.56 MB of images) |
| The tiles alone (as 5c/5d; kept, still imports) | `app/.cache/maps/china-2026-map.pmtiles` | 54,169,147 | — |
| The rehearsal's, with its tiny set (committed) | `app/scripts/e2e/fixtures/houhai-test-photos.pmtiles` | 710,187 | 4 (73,350 bytes: the lakes, the Drum and Bell Towers, Beihai; 420 px cards) |
| The plain test pack (unchanged, committed) | `app/scripts/e2e/fixtures/houhai-test.pmtiles` | 633,312 | — |

The owner's pack's SHA-256, to check the copy on Drive against:
`a1f030d0fb152b7f1e25b30db5f42d81134b575b5ad3f46bca1e007dca1e37ee`.

Nothing of it is in git but the tiny fixture, nothing in dist/: `check-bundle.mjs` now refuses a map pack by its
bytes whatever its name, a pack's photo trailer, and any WebP in dist/ or the Android copy ("✓ no map pack and no
photo in dist/").

**Tests:** `pack.test.ts` +4 (a pack from before declares none and imports as ever; the photo pack is exactly the
archive plus what it declares, the tiles the plain pack's; every image a WebP inside the region; cut by one byte, cut to
the archive, cut in half, the trailer's magic broken, the index broken → incomplete), `packimport.test.ts` +3 (one
file, one swap, the photos read back from the stand-in OPFS; cut short in its photos → refused before a byte is
written, the old pack kept; a plain pack over it takes the photos away), `mappack.test.ts` +1 (the photo fixture ≤ 1 MB,
PMTiles v3, the trailer).

### Part 3 · the UI — A, A2, B, E, F and the credits

The photos, the About, the pins' photos and the credits appear only with a photo pack on the phone; with a pack from
before (or none) there is no photo box, no About and no credits row (the rehearsal's first 5e row proves it). Two
changes every sheet shares: the links row (Google Maps moved into it from the button grid, Amap beside it where
Amap maps — the brief's "reuse the existing map buttons and the territory rule"), and the sheet's height cap
(below). The Map tab holds the pack's File and its index
(`routes/Map.svelte:249` `photoSrc`, `:274` `loadPhotos` — the index read once per pack by `packPhotos`); every image
is a slice of that File behind a counted object URL (`lib/components/map/PackPhoto.svelte`, `lib/map/photoUrls.ts`).

| Choice | What landed | Where |
|---|---|---|
| **A** · the place card | The photo on top, 16:9, cropped round its focal point (`fy`); the credit on a night chip bottom-left ("Photo: Shujianyang · CC BY-SA 4.0", `placephotos.ts:177 creditLine`) and the expand mark bottom-right; the whole photo one button → full screen | `components/map/PlaceSheet.svelte:101-107`, CSS `:252-300` |
| A · full screen | The card image uncropped under the place's name, its credit, "Resized and cropped for this app." and its file page (outside the app). A router layer: ✕, Escape and Android back close it; focus to ✕, and back to the photo after | `components/map/PhotoViewer.svelte` (new, z-index 100 — above the nav) |
| A · About | "About · From Wikipedia", Wikipedia's words verbatim (`lang="en"`), "Text · CC BY-SA 4.0" under them | `PlaceSheet.svelte:129-135`, CSS `:395-429` |
| A · links | Wikipedia ↗ · Official site ↗ (the only things that go online: `lib/platform/links.ts` — AppLauncher on the phone, a new tab on the web) · Google Maps · Amap (5c's territory rule: Amap only where Amap maps, Google where it opens); the quiet note under them when the row carries a web link | `PlaceSheet.svelte:137-157`, CSS `:430-464`; `platform/links.ts:9,25` |
| **A2** · no free photo | Where the pack LOOKED and found none: the category's colour (its glow over card-2), its disc and icon, "No free photo of this place". A place the pack never looked at (added after it was built) shows no box — "no free photo" would be a claim nobody checked | `PlaceSheet.svelte:108-112`, CSS `:301-325` |
| **B** · Near you | A 108 px banner on every card (the rail image, 536 × 216 at 2×); the category's colour and disc where there is none | `components/map/Rail.svelte:60-64`, CSS `:152-180`; `Map.svelte:1087-1088` |
| **E** · photo pins | From z15 (`placephotos.ts:199 PHOTO_PIN_ZOOM`) a place with a photo wears it: a round map IMAGE (`ph-<id>`, `-today`/`-tonight` carrying 5c's glow and ring), painted the first time a tile asks for it — v6's `setMissingStyleImageResolver`, v5's `styleimagemissing` + one relayout — from the pack's 128 px pin image at ≤ 3× (`PR_PHOTO`). One symbol layer as before: `icon-image` is a zoom step, so clusters, "you", the chosen place's marker and every pin below z15 are unchanged; the label steps down to clear the photo | `lib/map/street/index.ts:230-256` (paint, relayout), `:364-385` (the step), `:487-506` (the resolver), `:539-542` (`data-photos` for the rehearsal); `lib/map/street/pins.ts:120-170 photoPinImage`; `Map.svelte:264,268,315` |
| **F** · Look for this | In Guide me: the photo, "Look for this", the name · 中文, the credit; the row opens it full screen. No photo, no row | `components/map/GuideMe.svelte:98-106`, CSS `:259-313`; `Map.svelte:892-894` |
| Settings › Photo credits | The pack's line says "· 123 photos"; a row opens the credits: the licences used, each linked once with its count; then every photo place by place (city) — its file, author · licence, its page; and every About's article with "Text: Wikipedia, “…” · CC BY-SA 4.0". All links outside the app | `routes/Settings.svelte:289,295-305,351-352`; `components/map/PhotoCredits.svelte` (new) |
| Words, icon, contrast | `S.photos` (`i18n/strings.ts:595,598-632`); the `expand` glyph (`map/icons.ts:42`); 5 contrast pairs (the credit on a white photo through its chip, the no-photo words in the lightest category's glow, the About's label and words, the quiet note) — 135 pairs, all pass | `scripts/check-contrast.mjs:260-266,368-373` |

**Found in the screenshots and fixed:** the full-screen photo opened under the nav bar (both at z-index 60 → 100);
two separators lost their space ("Heaven· 天坛", "Park· Kunyu" — Svelte trims the white space that opens an element's
children; now `{' · '}` expressions); over a tall card with its photo the map band shrank to ~96 px under the top row
(the sheet is now capped at `100dvh − 210px`, `Map.svelte:1836`); and the chosen pin's name bubble sat on the one-line
"© OpenStreetMap contributors" chip (the fit keeps 56 px above the sheet with a pack, `:464`, and the bubble steps
aside while the band is under 320 px, `:865,1317` — the mockup's band shows the pin alone; the name is in the pill
above and on the card).

**E, measured** (`node scripts/e2e/map-shots.mjs --perf`: the built app in headless Chrome at 384 × 824, WebGL drawn in
software (SwiftShader), the CPU slowed 4×; the same 60-step circular drag three times per camera; the tiles-alone pack
against the photo bundle, swapped through Settings' own importer, tiles → photos twice per run, two runs = four
rounds; rAF intervals, which come in ~6 ms steps here). Per round, run 1 r1 · r2 · run 2 r1 · r2:

| Camera (photo pins in view) | pack | median ms | p95 ms | frames > 50 ms (3 drags) | worst ms |
|---|---|---|---|---|---|
| Houhai z15.5 (4) | tiles alone | 12.2 · 24.2 · 12.1 · 24.2 | 36.3 · 48.4 · 30.4 · 42.4 | 4 · 17 · 3 · 8 | 176 · 139 · 79 · 115 |
| | with photos | 12.2 · 12.2 · 18.2 · 12.1 | 30.3 · 30.4 · 36.4 · 30.3 | 1 · 2 · 3 · 2 | 55 · 79 · 67 · 61 |
| Houhai z16.5 (1) | tiles alone | 12.1 · 18.2 · 12.2 · 24.2 | 30.3 · 42.4 · 42.4 · 90.9 | 1 · 40 · 42 · 60 | 61 · 188 · 842 · 182 |
| | with photos | 12.1 · 12.1 · 12.1 · 12.2 | 30.3 · 30.3 · 36.4 · 36.4 | 1 · 1 · 4 · 4 | 61 · 55 · 73 · 61 |
| Central, Hong Kong z15.5 (5) | tiles alone | 24.1 · 18.3 · 24.2 · 24.2 | 36.4 · 42.4 · 36.4 · 36.3 | 2 · 6 · 5 · 2 | 91 · 97 · 133 · 79 |
| | with photos | 18.2 · 18.2 · 24.2 · 30.2 | 36.4 · 36.3 · 48.4 · 48.5 | 7 · 4 · 11 · 18 | 79 · 55 · 91 · 115 |

Read honestly: by Houhai the photo pins cost nothing measurable (the tiles-alone side's spikes are this machine's
own noise — other programs were running on it, and they came and went during the runs). **Where photo pins crowd
(Central, five in view) the photo side had more slow frames in three rounds of four (40 against 15 in all) and, in
the last round, a median one step higher** — the photo side being the pins and the rail's photos together; this
measure cannot tell the two apart. (Two slips of mine, both short: an image crop ran during run 1's second
tiles-alone Houhai z15.5 — its 17 is likely high — and a one-second script during the last Central photo measure — its
18 may be too.) That is a small cost, under a CPU slowed four times drawing WebGL in
software — on the phone the GPU draws the images; what remains is each photo's first paint (read from the pack,
decoded off the main thread, one 174 px canvas), once per map. Not measured on the S23 itself (no adb in this run):
worth a drag through Central on the phone.

**Screenshots** (`node scripts/e2e/map-shots.mjs --only 5e --out .cache/shots/map5e`, the owner's pack, the final
build): 34 in `app/.cache/shots/map5e/` —
`{412,384}-5e-{A,A-end,viewer,A-longcredit,F-longcredit,A2,B,peek-shown,peek-folded,E-z14_5,E-z15_5,E-z16_5,E-hk-z15_5,E-hk-z16_5,F,settings,credits}.png`
— and side by side with the approved mockup's frames in
`app/.cache/shots/map5e/compare/5e-{A,A2,B,E,F,viewer-credits,long-credit,fold}.png` (each with a `-half.jpg`).
Photo pins by zoom (the screenshots' `data-photos`, at 412 px): Houhai z14.5 → 0, z15.5 → 5, z16.5 → 1; Central,
Hong Kong z15.5 → 6, z16.5 → 3 (at 384 px: 0, 4, 1; 5, 3). The threshold stays the brief's z15: in the z15.5
screenshots the photos stand apart; at z14.5 places near Houhai still share a cluster (the "+2" by the Bell Tower).

**Where the app differs from the mockup, and why:**
- The credit on the photo is 12 px Inter, not the mockup's 9 px monospace — 12 is the app's floor for words, and the
  pair is contrast-gated on a white photo.
- "Text · CC BY-SA 4.0" under the About (the mockup has none): Wikipedia's words are CC BY-SA and their licence
  travels with them; the article is the row's Wikipedia link.
- The quiet note under the links is the brief's (the mockup's frame does not draw it).
- Photo pins keep 5c's halo labels, not the mockup's dark label boxes — one label style on the map, already
  contrast-gated.
- The pin image is 128 px (the brief said ~96): drawn 40 px across at up to 3×, 96 would be scaled up on the S23.
- The rail's photo is a 536 × 216 banner, as the mockup's B draws it (the brief said a 160 px square).
- Over a tall card the sheet stops 210 px below the top of the screen, so ~140 px of map stay under the top row (the
  mockup's frame shows ~100 px), and the chosen pin drops its name bubble there, as the mockup's pin has none.
- No pinch-zoom in the full-screen view (the brief).

**One count fixed while writing this up:** Settings › Photo credits counted the licences per credited PLACE (124 —
the lakes' photo twice) under a pack line that says 123 photos; `licencesUsed` now counts a shared photo once, as
`photoCount` does (`placephotos.ts:234`, tested).

**Credits are never cut** (found checking the longest one, Senado Square's — Commons' own 75 characters, "Андрей
Суриков / Andrey Surikov. Original uploader was Сура at ru.wikipedia"): the card's chip was clamped to two lines and
"Look for this" to one, so a long credit lost its licence. Both now wrap (`PlaceSheet.svelte` `.ps-credit`,
`GuideMe.svelte` `.gm-look3`); the full-screen view and Settings › Photo credits always wrapped. The screenshots
script checks the longest credit on the card and in Guide me at both widths (`{412,384}-5e-{A,F}-longcredit.png`).
Every one of the 123 credits was read again for stray HTML, links, footnote marks or empty names: none.

### Owner addition · the places' sheet folds away (the arrow)

The owner, during this run: "i want to be able to press on a arrow or something to make it disipear and a arrow to
reappear" — the "Near you" / "Around here" sheet at the foot of the Map tab.

- **The chevron** at the end of the sheet's head (`routes/Map.svelte`, `.m-peekbtn`): a real button, 44 px, named
  "Hide places", `aria-expanded` and `aria-controls="m-peekbody"` (the box the rail is in). Folded, the sheet is a
  slim bar — its title, how many places it holds (what the "All" chip counts, filters and all: "30 places") and the
  same button, now "Show places" with an up-chevron. It is ONE element in both states, so focus stays on it. The
  grab above the head folds and unfolds under a thumb too (a button kept out of the reading order: the chevron is
  the control).
- **The map takes the room back:** the sheet's real height is `bottom` (bound to its clientHeight), so the side
  controls, the foot box, the edge chips and the camera's padding all follow it. And nothing on the map jumps: the
  engine's `setPadding(p, keep)` makes the point already drawn at the new room's middle the centre
  (`lib/map/street/index.ts` `setPadding`, `lib/logic/wayfind.ts roomMiddle`) — the room given back is simply more
  map at the foot (the rehearsal checks every pin drawn where it was).
- **Remembered for the session** — module state (`lib/map/peek.svelte.ts`: leave the Map tab and come back, it is as
  you left it), written to localStorage as a convenience, every read and write guarded (blocked storage only
  forgets). Choosing a pin or a place still opens its sheet; closing it finds the bar.
- **Motion:** shown again, the rail rises into place (240 ms); under Calm motion or the phone's reduce-motion,
  app.css stills it — nothing slides.
- Tests: `src/tests/peek.test.ts` (6: what the phone remembers, a throwing storage, the session), `wayfind.test.ts`
  +1 (`roomMiddle`); a rehearsal row (below) and an a11y-floor overlay ("map · places folded", both widths);
  screenshots `{412,384}-5e-peek-shown.png` / `-peek-folded.png`.
- Where: `routes/Map.svelte:221` (the count), `:230-236` (`keepUntil`, `togglePeek`), `:476` (the padding, kept),
  `:1056-1099` (the sheet, its head, the chevron, the grab, `#m-peekbody`), CSS `:1858-1876` (the grab),
  `:1919-1948` (the chevron, the rise); `lib/map/peek.svelte.ts` (new); `lib/map/street/index.ts:126,761-789`
  (`setPadding(p, keep)`); `lib/logic/wayfind.ts:240` (`roomMiddle`); `lib/map/icons.ts` (`chevron-down`,
  `chevron-up`); `i18n/strings.ts:512-513`. Measured by the screenshots script: 466 px open → 163 px folded at both
  widths (303 px of map given back).

### Part 4 · the gates, the rehearsal rows, the screenshots

**The rehearsal's Map 5e rows** (`app/scripts/e2e/rehearsal.mjs`, after the plain test pack's rows; the test set is
`scripts/e2e/fixtures/houhai-test-photos.pmtiles`, and what the screens must say is read from the committed manifest):

| Row | What it proves |
|---|---|
| a pack from before: no photo, no About, the rail as it was | the plain pack: no photo box, no About, links Google Maps · Amap, the rail's cards as in 5d |
| the pack with photos replaces it: one file, one import | through Settings' own Replace: "· 4 photos" in the pack's row, OPFS holds exactly the file's bytes, the credits row appears |
| Settings › Photo credits: every photo credited | 5 credited places, Beihai's credit as the manifest has it, file pages · licence deeds · articles linked, back closes |
| A: the photo, its credit, About from Wikipedia, the links | the photo is a blob from the pack, the credit and the About verbatim, the trip's line above the About, links exactly Wikipedia · Google Maps · Amap and the quiet line; full screen: its credit, its file page, focus to ✕, Android back closes it and focus comes back to the photo |
| A2: no free photo — the colour, the icon, the words | the Massage Hospital: the placeholder, its icon, the words, no About; the Lama Temple (not in the test set): no box at all |
| B: a photo on each "Near you" card | the tiles still read from the bundle; every card has its box; ≥ 2 photos loaded, the colour where there is none; the photo decorative |
| E: photo pins close in, icons further out | step in to the first zoom past 15 (z15.5 here): ≥ 2 photo pins (painted images counted); as many steps out: 0, the icons back |
| F: Guide me — Look for this | the Drum Tower: the photo, "Drum Tower · 鼓楼", its credit, above the map apps; full screen and back; no row for the Massage Hospital |
| the places sheet folds away and back (the owner's arrow) | the chevron's name, `aria-expanded`, `aria-controls` and 44 px; folded: the rail gone, "Show places", "N places", focus still on the chevron, the sheet ≥ 120 px shorter and the map's foot as much lower, every pin drawn where it was; the fold held across leaving the tab; a place still opens and closes back to the bar; the grab unfolds it and the rail rises; under Calm motion nothing slides; it ends unfolded, as tall as before |
| photo URLs are handed back | the live object URLs on the Map tab → 0 after leaving it |

The accessibility floor gained two screens (a place with its photo; Guide me with its photo) and three overlays (the
photo full screen; Settings › Photo credits; "Near you" folded), at both widths.

**The first full run on the finished tree said 196/198** — both misses were the rows' own: "a pack from before"
opened the place by a page load and then pressed back, which left the page (it now opens the map, then the place
within it); and E stepped in three times, to z16.5, where only the lakes' own photo is left in view (it now stops at
the first zoom past 15 — the test set shows 4 photo pins there at 412 px, 3 at 384, checked on the test pack with
the screenshots script).

### Gates at the end of Map 5e (from `C:\Source\China-map\app`, Git Bash, on the final tree)

| Gate | Result |
|---|---|
| `npm run check` | 674 files, 0 errors, 0 warnings (+ scripts `tsc`) — 657 at 5d |
| `npm test` | **1010 passed in 58 files** — 964 in 55 at 5d (+ `placephotos` 21, `photomanifest` 10, `peek` 6, `pack` +4, `packimport` +3, `mappack` +1, `wayfind` +1) |
| `npm run build` | contrast 65 tokens, 135 pairs, 0 failures · precache 40 entries · check:dist 62 built files clean (dist and the Android assets copy of 13:53, which no step of this run touched), both passport identifiers absent (11 repo files), 14 patterns · **bundle: start-up 192.44 / 200 · all app JS 248.75 / 260 · map engine 449.45 / 470 KB gz** (5d: 191.93 / 242.24 / 448.84) · "no map pack and no photo in dist/" |
| `npm run verify:china` | 136 critical values + 92 structural facts, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **199/199** with the network hard off, on the final build (189 at 5d + the 10 new rows); no uncaught exception; the a11y floor over 100 screens and overlays at both widths (3,076 controls); Map · nothing asked off this machine: 285 requests, all local (the forecast apart) |

**Left, and why:** the photo pins' cost where they crowd was measured only in headless Chrome (above) — the S23 is
the real test, and this run had no adb. The 24 places without a photo stay without one until a free photo of the
place itself turns up (the manifest records what was looked at). The pack goes to Drive by the main session.

## Map 5d — the Map tab's fixes (FIX-5D.md) · DONE (2026-09-29)

Worktree `C:\Source\China-map`, branch `horizon-map`, on 8a8db44 (Map 5c). All 20 items of FIX-5D.md — the code
review's 3 HIGH, 4 MEDIUM, 10 LOW and the design review's 1 MEDIUM + 2 LOW — fixed, HIGH first, on what 5c built
(nothing rewritten). Every logic fix has a vitest test that fails without it (each checked by putting the old code
back in a temporary copy, running the suite, and restoring it); every flow the brief named has a rehearsal row that
fails on the 5c build (walked on the untouched 5c `dist/` before the first rebuild — below). Read-only git only; no
adb, no Gradle; nothing touched outside the worktree; `app/scripts/privacy/`, `check-dist-clean.ts` and
`app/index.html` untouched.

### HIGH

| # | Finding | What changed (file:line) | Proof |
|---|---|---|---|
| 1 | "Add to my day" wrote wrong data: on Dec 8 it was offered for 89 places — 70 in other cities (a Dec 8 pick with Kunyu's `stopId` then showed under Beijing's "Planned") — for the Temple of Heaven and Dong Lai Shun, which the day already has, and on travel days | **One rule, read by both screens**: `logic/options.ts:216` `dayOffers` (during the trip · not a travel day · the stop you are in · not a line the day already has, except the one you picked) and `:232` `offerFor`. The day screen's free blocks read it (`components/now/DayView.svelte:142` — its old inline pool and gate, verbatim); the Map's sheet reads it with Now's own travel test, `isTravelDay` (`routes/Map.svelte:589-617`), and writes the pick for the day's stop | `options.test.ts` +4: Dec 8 → 17 places, all Beijing, Beihai in, the Temple of Heaven, Dong Lai Shun and Kunyu's Yantai Hill out — and the old rule's 89 / 70 on record; the pool equals DayView's own; Dec 9 (a travel day), before and after the trip → none; a picked line stays on offer. Rehearsal **Map · Add to my day only for today's stop** |
| 2 | The compass was the W3C back-of-device vector: near flat, any roll swung it — facing north it said 56° (β 2 γ −3), 34° (β 15 γ −10), 350° (β 30 γ 5) | `logic/wayfind.ts:150` `headingFromOrientation(α, β, γ, screenAngle)`: near flat the **screen's drawn top edge** points the way — 360 − α, exactly, whatever the roll (a roll turns the phone about that edge) — turned by the screen's rotation; as the top edge lifts past 60° the **back** of the phone (the camera's way) takes over, fully at 80°, smoothly between (`UPRIGHT_FROM/AT` `:127`). **Screen rotation is handled, not locked**: the activity rotates (no `screenOrientation` in the manifest; the web manifest's `portrait` binds only the PWA), so the angle is read at each event — `screenAngleOf` `:191`, `map/locate.svelte.ts:71` | `wayfind.test.ts` +6: the review's three cases → < 0.5° (and the old formula's 56/34/350 on record); 360 − α for every α, β −40…55, γ −60…60; upright, the back — and an upright phone's roll is a turn; no jump from flat to upright; each of the four screen angles, landscape tilted and rolled; the angle's sources. Rehearsal: Guide me now turns the phone **near flat and rolled** (β 20 γ −8) and must read exactly "WSW · straight ahead" — 5c read "slightly left" |
| 3 | A stale fix was shown as current: leaving the tab or hiding the app kept `fix` and `state = 'on'`; `fix.at` was never read | `logic/wayfind.ts:100` `STALE_MS` (30 s), `:102` `staleFix`; `map/locate.svelte.ts:80` attach and `:169` resume → `forgetStale` `:88`: a fix older than 30 s found on coming back is dropped and the state is 'asking' until the watch brings a new one (a fix the running watch hands over is current, however long you stand still). No dot, no rings, no distances, no Guide me from it; "Finding where you are…" on the rail (`routes/Map.svelte:502`, the peek line), the place sheet and Guide me (`PlaceSheet.svelte`, `GuideMe.svelte`: their locate buttons wait) | `locate.test.ts` (new, 8): back a minute later → no fix, 'asking', then the fresh one; within 30 s it stands; hidden five minutes → the same; the running watch's fixes stay; never "Finding…" with no watch started (a phone that cannot remember it asked); (item 10's two). Rehearsal **Map · no stale YOU after leaving and coming back** |

### MEDIUM

| # | Finding | What changed | Proof |
|---|---|---|---|
| 4 | Guide me's first button ignored territory: 38 Hong Kong / Macau pins got "Find it in Amap — works in mainland China without a VPN", the Israel trip an Amap route to Israel | `logic/geo.ts:358` `guideApp` = the map buttons' own `isAmapTerritory`; `components/map/GuideMe.svelte:51`, `:84-111`: outside the mainland the first button is **"Turn-by-turn in Google Maps"** (no VPN line, no Amap), the driver card alone on its row; `S.mapTab.googleRoute` | `guidelinks.test.ts` +2: exactly the 38 Hong Kong / Macau pins get Google, every Beijing one Amap; by name, the words decide; every Israel pin Google. Rehearsal **Map · Guide me in Hong Kong: Google Maps first** (+ the a11y floor sweeps that panel at both widths) |
| 5 | "The map could not start" crashed the screen: a throwing `new maplibregl.Map()` still resolved, `street.map` was undefined, and the effects threw | `lib/map/street/index.ts:405` `build` **rejects** when the map cannot be made (and takes out the canvas box maplibre had already laid in, `:410`); `map` is nullable and **every method guards it** (`project` → NaN, `view` → the last view, the rest do nothing, `:654-735`); a rebuild after a lost context that fails is caught and reported once through `onError` (`:603`). `routes/Map.svelte:238` `lostMap`, `open` `:244-292`: `street` is set only on success; the designed fallback — the message, search, chips, the rail, the list and the sheets; no zoom, north or rings for a map that is not there (`:893`), no attribution | `streetmap.test.ts` (new, 4, on a stand-in engine): a throwing constructor rejects and leaves the container empty; a map that loads resolves; a failed rebuild tells the screen once and every method is safe after. Rehearsal **Map · a map that cannot start: the fallback, no crash** (WebGL taken away: 12 rail cards, 30 in the list, a sheet, 0 uncaught — 5c: 3 uncaught `project` / `getPadding`) |
| 6 | Scroll no longer reset on in-app navigation (the "Loading…" flash that did it went with 5c's `live.svelte.ts` fix): scrolled down, Journey opened at the old offset | **One rule for the whole app** — `lib/state/scroll.ts` (new), called by `App.svelte:27-34` on every change of address: a screen stepped forward to (link, tap, redirect) opens at its top; stepped back to, where it was left. The router says how each address was reached (`state/router.svelte.ts:84` `nav`, set `:132` and `:200`; `entry` `:276`); offsets kept per history entry as the page scrolls; the browser's own restoration off (`scrollRestoration = 'manual'` — it lands at `popstate`, before the screen is drawn, and clamps to the old screen's height). **Kept:** a city and its guide keep their own rule (`routes/Stop.svelte`, untouched: a city at its top; the guide back where it was after a pass, or at the chapter asked for). Pocket's own reset went (`routes/Pocket.svelte:116`): its list now comes back where it was, as every screen does | `router.test.ts` +7 on the in-memory session history: push / pop / replace / a plain link; Now → Journey top, back → Now's 900, forward → Journey's 300; Now → the day and back; back onto a screen still filling in; a redirect at the top; the app starting left alone; the city and guide untouched. Rehearsal **Scroll · forward at the top, back where it was** (the day 420 → Journey 0 → back 420; To do 0 → back; Travel 700 → a pass 0 → back 700; the guide 1324 → a pass → back) |
| 7 | Guide me's leg showed "x km" from a rough fix, and "0 km" under 50 m | `logic/wayfind.ts:71` `legText` (only where `meaningful`, via `distanceText`); `routes/Map.svelte:630`, `:772` | `wayfind.test.ts` +1 (from you: "1.9 km", "30 m" not "0 km", none from a ±900 m fix). Rehearsal: the Guide me row reads the leg ("1.9 km", and "10 m" to Houhai under you — 5c: "0 km") |
| 18 | The heading cone read round, not directional | `routes/Map.svelte:782-796`: the board's beam itself — an SVG 50° sector of 46 px, the sunrise from 0.55 at you to nothing at 48 px (#m4mCone), drawn under the dot (`:346` — markers in the board's order) | Screenshots (below) |

### LOW

| # | Finding | What changed | Proof |
|---|---|---|---|
| 8 | No engine-start timeout: a v6 module worker failing in the WebView = "Opening the map…" for ever | `lib/map/street/index.ts:125` `START_MS` = 15 s: a map that has not loaded rejects (`:557`) and is taken down → item 5's fallback | `streetmap.test.ts`: never loads → nothing at 14.999 s, rejected and removed at 15 s. Rehearsal: in the cannot-start row, `Worker` that never answers → the fallback after 15.2 s |
| 9 | The follow effect cancelled its own zoom: it wrote `following`, which it read, re-ran, and its `panTo` cut the `flyTo` short | `routes/Map.svelte:457-473`: the read and the write of `following` untracked | Rehearsal **Map · the first fix flies you all the way in** on a real fresh load: z13.50 (5c, probed on its build, three fresh loads: at rest on you at z13.00). (The row's first form sat in "pins by category", which navigates to the address already open — a fragment change that keeps the map as the rows before left it — and passed on 5c; it got a load of its own.) |
| 10 | `mapTab.unavailable` never shown: with location off, "Show where you are" did nothing | `map/locate.svelte.ts:111`: with no position to be had, the tap starts the watch over (a watch still running after an error did nothing); `routes/Map.svelte:477-502`: the tap is answered — "No position yet — the map works without it." / "Location is off for this app…" | `locate.test.ts` +2 (unavailable → the tap restarts; denied). Rehearsal: the stale-YOU row switches location off (CDP) → the toast |
| 11 | Pass "Show on map" skipped the `alternative` check | `logic/mapdrawn.ts:24` `bookingOnMap`, the one test `drawnIds` and the pass (`components/pocket/Pass.svelte:304`) both ask | `mapplaces.test.ts` +1: an either/or booking with a position has no doorway and no pin (the old pass rule offered one); every booking: the pass's answer = the map's |
| 12 | Import error text could be wrong (`swapIn` outside the try) and a second import could start mid-copy | `lib/map/pack.ts`: **one import at a time** (`:303`, 'busy'); a `PackError` says what is left on the phone (`kept`, `:50`); the swap in its own try — before the old pack is removed, "still here"; after, `notPlaced` (the next open finishes it, `finishSwap` `:186`) or `unreadable`; a first import never claims an old pack; `packFile` leaves a copy mid-import to its import (`:177`). `lib/map/packImport.svelte.ts` (new): the import is the app's, not the control's — progress and words survive leaving and coming back; `PackImport.svelte` reads it; new words in `S.mapTab` | `packimport.test.ts` (new, 8, on a stand-in OPFS): a second import refused, the first lands; the app-wide importer starts nothing twice; the tab opening mid-swap does not race it; a swap that took the old pack away does NOT say "still here" (and the next open finishes it); one that could not → says so; in place but unreadable; first vs later import; refused before a byte |
| 13 | The list's order under a rough fix: a non-transitive comparator | `logic/wayfind.ts:364` `byDistanceThenName` (measured rows nearest first, then the rest by name); `components/map/PlaceList.svelte:36` | `wayfind.test.ts` +1, with the old comparator's wrong order on record |
| 14 | Rounding: 995 m → "≈ 1000 m", 990 m accuracy → "≈ 1000 m", 99.95 km → "≈ 100.0 km" | `logic/wayfind.ts:59` `distanceText`, `:90` `accuracyText`: the unit changes at the ROUNDED value | `wayfind.test.ts` +1: "≈ 1.0 km", "≈ 1 km", "≈ 100 km", and the neighbours either side |
| 15 | The sheet's ‹ said "Back to the map" wherever it went | `logic/routes.ts:153` `backToOf`; `routes/Map.svelte:558-575`: the sheet's origin is kept in its own history entry on first open (the guide's way), so Guide me and back does not change it; `S.mapTab.backTo` (the guide, the city, the pass, Find, the day…) | `routes.test.ts` +2 |
| 16 | The rehearsal's network row could miss a worker's first requests | `scripts/e2e/rehearsal.mjs:114` `waitForDebuggerOnStart: true`; each target gets `Network.enable` and is resumed **in the same breath** — probed: a paused service worker does not answer `Network.enable` until it runs, so waiting for the answer left it paused for good (no worker installed, the offline walk dead) | The Map network row now counts the service worker's own requests too |
| 17 | Dead code | Gone: `clusterSpoken`, `clusterCategory` (and their assertions), `catOne`/`catMany` (only they read them), `clusterAria`, `youAria`, `SHOW_ALL`, `router.goMap`, `api.resize` (interface and body), Journey's `'route'` anchor branch (`routes/Journey.svelte:145`). `mapTab.unavailable` stays — item 10 uses it | `npm run check` |
| 19 | A ring's label under a cluster's badge ("250 m" under "+3") | `logic/wayfind.ts:289` `ringLabelBox`, `:300` `ringLabelCorner`: NE as the board draws it, else the first free of SE, NW, SW; chosen at each rest from the pins and clusters on screen (`lib/map/street/index.ts:485`), per-feature anchors (`:130`); and OpenStreetMap's own words now give way to the ring labels, as they do to the pins (`:303`) | `wayfind.test.ts` +4; screenshots |
| 20 | The scale + attribution box covered pins (Beihai Park, Jingshan Park) | `logic/wayfind.ts:324` `footPlace`: left as the board draws it, unless a pin or its name lies under it; then right, if clear of pins and of the side controls; else **one short line** — the scale and "© OpenStreetMap contributors", as over a sheet and Guide me (`routes/Map.svelte:716-734`, `:950`, `.m-foot.short` `:1678`). The camera padding already kept the box clear of what the map frames; it now reserves the whole box's height whichever form it wears, so a change of form never moves the map. The container says where its pins are (`data-at`, beside `data-cats`) | `wayfind.test.ts` +1; screenshots; the rehearsal's `__foot` check in two Map rows (the 5c build said nothing of its pins' places, so this check cannot be walked on it — its screenshot is the before) |

### The proof: the new rows on the 5c build, then on this one

Walked on the untouched 5c `dist/` (a trimmed copy of the rehearsal in the scratchpad — the setup and the Map
section), before the first rebuild: **of 5c's 15 Map rows the 14 this pass left alone PASS; every new or changed row FAILS**, each for its
bug — Guide me "WSW · slightly left" (rolled phone); Add to my day "the Temple of Heaven is offered: Dec 8 already
names it"; "YOU drawn from a fix a minute old"; Hong Kong "the first button reads Find it in Amap · Works in mainland
China…"; the map that cannot start "3 uncaught: TypeError: Cannot read properties of undefined (reading 'project')";
Scroll "Journey opened at 484 px, the day's offset"; and (a probe) the first fix at rest at z13.00. On this build the
same walk: 21/21 PASS, and the full rehearsal 189/189 (below). Two rows needed their harness fixed, not the app: the stale-YOU row waited
past the watch's `maximumAge` (5 s) before switching location off (a watch started sooner is legitimately handed
the browser's cached fix), and item 9's row got its own load (above).

### Visible

- **The heading cone** is the board's beam (a crisp 50° sector under the dot), not a soft round glow.
- **Guide me outside the mainland**: "Turn-by-turn in Google Maps" first, no Amap, no VPN line; the driver card alone on its row.
- **The map that cannot start**: its message over the night canvas, no zoom / north / rings buttons, no attribution; the rail, the list, search, chips and sheets work.
- **"Finding where you are…"** on the rail, a place's sheet and Guide me while a position is on its way (after a while away, or the first time); a tap with location off says so.
- **Scroll**: a screen stepped to opens at its top; back returns where you were — Pocket's lists included (they used to jump to the top on back).
- **Ring labels** on the free diagonal; **the map's foot** on the right or in one line when a pin lies under it; the leg chip's distance only where it stands; "≈ 1.0 km" not "≈ 1000 m"; the sheet's ‹ names where it goes; "Add to my day" only for today's stop.
- Behaviour, not looks: the compass near flat; the first fix brings you in to z13.5; one import at a time.

### Deviations (new, or 5c's revised)

- 5c's **13** revised: "Add to my day" now appears only where the day screen itself offers the place — during the trip, not on a travel day, a line of the stop you are in that the day does not already have.
- 5c's **16** stands (the rehearsal's phone is now rolled and near flat; true 262.6° is still "straight ahead" of 255.5°).
- **The map's foot** moves right or goes to one line to keep off a pin (the board draws it bottom-left only); in its short form "map data stored on this phone" is left out — the licence's own words stay.
- **Guide me outside the mainland** has no board: it is map4-go with Google first.

### Left, and why

- **On the phone** (no adb, no Gradle here): the compass near flat and upright and in landscape, the stale-fix wait after the app comes back, and v6's worker (the 15 s timeout now bounds it).
- **A pin under the rail's top edge** is still under the rail (the peek panel is opaque by design; the rail and the list carry every place).
- **Item 20's rehearsal check** guards the rule from now on; it could not be walked on 5c (no pin positions exposed) — the 5c / 5d screenshots are its before / after.

### Tests and their proof

- **964 tests in 55 files** (914 in 52 at 5c, +50): wayfind 14 → 28, router 45 → 52, options 20 → 24, routes 23 → 25,
  guidelinks 5 → 7, mapplaces 15 → 16; new files `locate.test.ts` (8), `streetmap.test.ts` (4, a stand-in engine —
  `vitest.config.ts` now resolves `#map-engine` as the build does), `packimport.test.ts` (8, a stand-in OPFS).
- **Each fix put back to its old code in a temporary copy, the suite run, the copy restored:** the stale-fix and
  restart rules out → 3 of `locate`'s tests fail, 'asking' for 'off' → the no-watch one; the W3C formula back → 4 heading tests fail; the day's old rule (a
  place's own stop, no day, no travel test) → all 4 offer tests fail; `build` resolving on a throw and no timeout
  → 2 of `streetmap`'s 4 fail, one method unguarded (`map!`) → the rebuild test fails; the scroll module without
  its forward reset → 3 fail, without its back restore → 3 fail; the import lock out → the second-import test fails.
- **The rehearsal's new rows**, each failing on the 5c build as above: Map · the first fix flies you all the way in ·
  Add to my day only for today's stop · no stale YOU after leaving and coming back · Guide me in Hong Kong: Google
  Maps first · a map that cannot start: the fallback, no crash · Scroll · forward at the top, back where it was; and
  in existing rows: Guide me's rolled phone and its leg, the foot check in two Map rows, the Hong Kong Guide me in
  the a11y floor (both widths).

### Screenshots (the built app, headless Chrome, WebGL via SwiftShader, every non-localhost request refused; Tue 8 Dec by Houhai ±25 m; the real 54 MB pack)

`app/.cache/shots/map5d/` (git-ignored; `node scripts/e2e/map-shots.mjs --out .cache/shots/map5d`, which now also
takes `map-out`, `map-heading`, `go-hongkong` and `fail`): `412-*` and `384-*` of the map, one step out, the
heading, a place, Guide me, Guide me in Hong Kong, the fallback, the filters, the list, a search and the guide's
places; beside the boards (map4-*, rendered 1:1) in `app/.cache/shots/map5d/compare/`; the foot at rest and one
step out at both widths `compare/foot-band.png`; 5c's foot beside 5d's `app/.cache/shots/foot-5c-vs-5d-412.png`;
the beam, board and real, `app/.cache/shots/map5d-cone-board-412.png` / `map5d-cone-real-412.png`. Read against the
boards: the beam is the board's; the Hong Kong panel is map4-go with Google first; nothing else changed its look.

### Gates at the end of Map 5d (from `C:\Source\China-map\app`, Git Bash, on the final tree)

| Gate | Result |
|---|---|
| `npm run check` | 657 files, 0 errors, 0 warnings (+ scripts `tsc`) — 652 at 5c |
| `npm test` | **964 passed in 55 files** — 914 in 52 at 5c |
| `npm run build` | contrast 65 tokens, 130 pairs, 0 failures · precache 40 entries · check:dist 29 files clean, both passport identifiers absent (11 repo files), 14 patterns · **bundle: start-up 191.93 / 200 · all app JS 242.24 / 260 · map engine 448.84 / 470 KB gz** (5c: 191.34 / 239.88 / 448.26) · no map pack in dist/ |
| `npm run verify:china` | 134 critical values + 90 structural facts, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **189/189** with the network hard off, on the final build (183 at 5c + the 6 new rows); 0 uncaught exceptions; the a11y floor over 90 screens and overlays at both widths (the Hong Kong Guide me added); Map · nothing asked off this machine: 231 requests, all local, the service worker's own now among them |

## Map 5c — the Map tab (MAP-5C.md) · DONE (2026-09-29)

Track B2, worktree `C:\Source\China-map`, branch `horizon-map` (from 52984db). Built in six parts, the tree
building between them; this section is written as each part lands.

| Part | State |
|---|---|
| 1 · the map pack (build + test pack) | done |
| 2 · import + storage | done |
| 3 · the engine + the style | done |
| 4 · the tab, the place sheet, the rail | done |
| 5 · Guide me, filters, Android, a11y | done (the a11y sweep's map screens in part 6) |
| 6 · gates, rehearsal, screenshots | done |

### Part 1 · the map pack

| What | Where |
|---|---|
| The places the Map tab draws, as data — spots, driver cards, beds and tickets at `coord ?? pin`; flights, trains and road legs are not places; several entities at one point are one place (`with`); names, the pin label, the category (the trip's, else the kind's), the verbatim `detail`, the city, the map TARGET from the entity's own fields (a coordinate only when it is `coord` — never `pin`), the white driver card; today / tonight; filters, counts, search | `app/src/lib/logic/mapplaces.ts` (`mapPlaces` `:209`) |
| The areas: anchors = every drawn place + every stop + every station and departure airport the trip stores; a located anchor belongs to the nearest stop within 80 km (the city close-up's rule), a spot to its own stop; single-linkage clusters (10 km) grown by 2 km, overlaps merged. Coverage-only points for the 20 places the trip goes to with NO verified position (Jinshanling, Kunyu forest park, the Muping night, YNT…) — they size a box and are never drawn; each drops out by itself the day its place gains a position | `app/scripts/maps/areas.ts` (`COVERAGE` `:67`, `anchorsOf` `:93`, `boxesOf` `:176`) |
| The build (dev-only network): areas → region → `pmtiles extract` of the Protomaps daily build with `--region --maxzoom=15` (only the region's tiles are read) → `verify` → renamed from `.part` → our `ltd:` metadata keys → the test pack | `app/scripts/maps/build-pack.ts`, `npm run map:pack` |
| The compass's declination table (WMM2025 via the `magvar` devDependency, epoch 2026.9, a 5° world grid, checked against the model at every stop of all three seeds — worst 0.07°) and its lookup | `app/scripts/maps/declination.ts` → `app/src/lib/logic/declination-grid.ts`; `app/src/lib/logic/declination.ts` |
| Tests: every anchor inside a box with its 2 km, no overlaps, every drawn place in the pack, one area per stop in trip order, only the Tel Aviv / Abu Dhabi departures left out, an approximate point only while its place has no position, the committed test pack ≤ 1 MB and PMTiles v3 | `app/src/tests/mappack.test.ts` (7) |

**The pack:** `C:\Source\China-map\app\.cache\maps\china-2026-map.pmtiles` — **54,169,147 bytes (54.17 MB)**,
5,444 tiles, z0–15, from the Protomaps build **20260928** (OpenStreetMap of 2026-09-28 04:00 UTC); 188 anchors →
33 boxes, **3,431 km²** (Kunyu 250 · Beijing 671 · Chongli 222 · Zhangjiajie 335 · Chongqing 297 · Lijiang 473 · the
Gorge 138 · Dali 261 · Kunming 224 · Hong Kong + Macau 560). The spike's pack was 62.78 MB over 5,605 km²: the
verified positions let the boxes follow where the places are. Git-ignored (`app/.cache/`), never in dist/.
**The test pack:** `app/scripts/e2e/fixtures/houhai-test.pmtiles` — **633,312 bytes**, z11–13, 10 tiles, bbox
116.345,39.915 → 116.425,39.962 (Houhai, the lakes, the Massage Hospital, Huguosi, Beihai, the Drum Tower, the Lama
Temple). Deviation: the brief's example said z0–13; one tile per zoom below 11 covers all of north China and those
eleven alone weigh 1.2 MB, so it is z11–13.

**Deviation — coverage-only points.** The brief says the areas come from the verified positions + stops/stations.
They do; but 20 places the trip goes to have no verified position (MAP-DATA.md), and a pack without Jinshanling's
wall, the Kunyu forest park, the Muping night or the YNT departure would be blank exactly where an offline map
matters. Each has an approximate point (the spike's own, general knowledge, 1–2 km) that only sizes a box — no pin,
no list row, no button, ever — and is keyed to its entity, so it disappears when the entity gains a position.

**Deviation — the declination table is a world grid, not per stop.** A 5° grid looked up anywhere (you walk, the
stop's centre does not) instead of one value per stop: it serves every trip the app will ever hold, and the check
is per stop — worst 0.07° against the model across China, Israel and the template.

### Part 2 · import + storage

| What | Where |
|---|---|
| The pack store: OPFS `mappacks/map.pmtiles`; the header read and checked (PMTiles v3 magic, vector tiles, every section inside the file — a cut-short download is refused before a byte is written), room checked (`storage.estimate`, the copy beside the old pack), copied to `.part` with progress (createWritable, or the spike's sync-access-handle worker on older WebViews), the copy re-checked, then swapped in (`move()`, else copy-over); an interrupted swap is finished on the next open; `storage.persist()` asked after a pack lands; the metadata's few fields (which pack, OpenStreetMap's date, when it was cut, its areas) read with DecompressionStream | `app/src/lib/map/pack.ts` (`readHeader` `:84`, `packFile` `:151`, `importPack` `:276`) |
| The import control: a label-wrapped `<input type=file>` with NO accept filter, progress, the reason when it refuses, the old pack kept | `app/src/lib/components/map/PackImport.svelte` |
| Settings › Map pack (On this phone): its name, size, OpenStreetMap date and areas; Replace; a two-tap Delete; or "No map pack on this phone" + Import | `app/src/routes/Settings.svelte` (the group `:275`) |
| Tests: the test pack's header and metadata; a JSON file, a v2 archive, raster tiles → not a map pack; 50 bytes → too small; cut to 60 % and by one byte → incomplete; the size wording | `app/src/tests/pack.test.ts` (6) |

### Part 3 · the engine and the style (lazy, its own budget)

| What | Where |
|---|---|
| The engine switch: maplibre-gl **6.11.2** (ESM; its worker bundled with `?worker&url` → `setWorkerUrl`), the tested fallback **5.24.0** behind `vite build --mode engine-v5` (`#map-engine` alias; `maplibre-gl-v5` npm alias); `worker.format: 'es'` | `app/src/lib/map/street/engine-v6.ts`, `engine-v5.ts`; `app/vite.config.ts` (the alias block); `app/tsconfig.json` (`paths`) |
| Phone-drawn letters: four FontFaces named for the style's stacks, on the SAME woff2 files the app ships (no new asset, no glyph URL); loaded before the first glyph | `app/src/lib/map/street/fonts.ts` (`loadMapFonts` `:33`) |
| The night style: the spike's Protomaps recolour; EVERY colour that carries words is a token read at run time (`--map-*`), each on the ground its halo is; OSM POIs neutral; no sprite, no glyphs; trails dashed and visible; traveller POIs 1.5 zoom earlier; no pack → no layer at all (the screen's own ground and grid show through) | `app/src/lib/map/street/style.ts` (`horizonStyle` `:163`) |
| The pins: MAPS6's disc, ring and glyph from the one icon set (`lib/map/icons.ts`, also the tab's SVG), today's still sunrise halo, tonight's gap-and-ring, clusters (the one category they hold, else mixed) with the "+N" badge drawn on demand | `app/src/lib/map/street/pins.ts` (`pinImage` `:86`, `clusterImage` `:93`); `app/src/lib/map/icons.ts` |
| The controller: pmtiles `FileSource` over the OPFS File (one slice per tile), clusters with per-category counts, the rings and their NE labels in Martian Mono, the accuracy halo in metres at every zoom, DOM markers placed for the route (you, the cone, the chosen pin, today's names), camera moves that jump under Calm / reduce-motion, symbols that never fade; **a lost WebGL context the WebView does not give back is rebuilt** on the next visible moment (camera, pins and markers kept); nothing renders while nothing changes, flights stop on hiding; `data-idle` on the container for the rehearsal | `app/src/lib/map/street/index.ts` (`openStreetMap` `:168`) |
| The third budget: the engine = the dynamic entry under `src/lib/map/street/` + what only it reaches + the worker it names; excluded from the two app budgets; a `.pmtiles` in dist/ (or the Android copy) fails the build | `app/scripts/check-bundle.mjs` |
| The map's colours as tokens (tokens.json + app.css, 18 new: 10 `map-*`, 8 `cat-*`) and 44 new contrast pairs: every map word on its ground, each category on the pin disc, a card and the sheet, and the sky's ink on each selected category | `docs/design/horizon/system/tokens.json`, `app/src/app.css` (`:root`), `app/scripts/check-contrast.mjs` (the Map tab block) |

### Part 4 · the tab, the place sheet, the rail

| What | Where |
|---|---|
| Routes: `map` is a place again — `#/trip/:id/map`, `/map/:place` (its sheet), `/map/:place/go` (Guide me); Lantern's old `map` link is the map (it was the Journey's route section); `router.mapHash`/`goMap` | `app/src/lib/logic/routes.ts`, `app/src/lib/state/router.svelte.ts` (`mapHash` `:231`); tests `routes.test.ts` |
| The nav: Now · Journey · **Map** · Pocket + Find (four items fit 69 px each at 384) | `app/src/lib/components/horizon/NavBar.svelte`; the glyph in `Icon.svelte` |
| The shell: the Map screen is a lazy chunk (`once`), no app bar, no nav during Guide me | `app/src/routes/TripShell.svelte` (`mapScreen` `:36`, `:163`, `:232`) |
| The screen: the places (all of the trip's on the map; the city in view drives the chips, rail and list), the search (every word, English or Chinese, trip-wide), the chips with counts (All + one per category present; a chip shows only its category), the side controls (Rings, zoom, north-up with its needle, Show where you are / Following), the scale and "© OpenStreetMap contributors · map data stored on this phone", the no-pack card with the import, the rail at peek, the list, the filters, the driver card; the camera (you at z13.5; a chosen place with you when you are within 8 km, else z15 on it; Guide me fits both; following pans), the padding under every panel and the attribution box; Add to my day = the day screen's own pick of the trip's option line (shown only where an option names the place, and only during the trip) | `app/src/routes/Map.svelte` (the engine `:90`, `open` `:229`, `imported` `:293`, `openPlace` `:471`, `candidate` `:523`, the line `:544`, the edge chips `:575`) |
| The place sheet (map4-place): category, today/tonight chip, ✕; name, Chinese, the verbatim line; ≈ distance + bearing arrow + "WSW of you · straight line" + the mini radar — or "show where you are" / how rough; Navigate; Driver card (white), Google Maps, Copy address (else the Chinese name), Add to my day; the bookings riding with the place, each to its pass. Focus goes into it on opening and back where it came from on closing | `app/src/lib/components/map/PlaceSheet.svelte`, `MiniRadar.svelte` |
| The rail (map4-map): nearest first from you in this city, else round the map's middle ("Around here"); a card = glyph, category word, Today, name + Chinese + line (one ≥ 44 px button, its line its description), distance + arrow when worth saying, Navigate; the last card opens the list | `app/src/lib/components/map/Rail.svelte` |
| The list (a11y): every place of the city by category with name, Chinese, category, line and distance, then "Opens by name — no pin yet" with its map button | `app/src/lib/components/map/PlaceList.svelte` |
| "Show on map" from the guide's places, the day's places, a pass (a bed or a ticket with a position) and Find's results — only where the Map tab draws the place (`drawnIds`) | `app/src/lib/components/map/ShowOnMap.svelte`; `routes/Stop.svelte`, `components/now/DayView.svelte`, `components/pocket/Pass.svelte`, `routes/Find.svelte` |
| Tests: places (coord ?? pin and nothing else, no movement is a place, no button opens a pin, one pin per point, the no-pin places, verbatim lines and categories, Beijing's counts, names, today/tonight, filters, search, the doorways' set) | `app/src/tests/mapplaces.test.ts` (15) |

### Part 5 · Guide me, filters, location, Android

| What | Where |
|---|---|
| Guide me (map4-go): the header (✕, Guide me, to X · category, Works offline) over the board's shade; the map fits you and the place; the FLOW line you → place (the app's `FlowPath`: the only loop, still with an arrowhead under Calm motion / Route animations off / reduce-motion, paused off-screen and when hidden) with its distance chip; the compass (the rose turns so the top is the way you face, the arrow at the place, the short way round); the distance, the 16-point direction and which way to turn; "Turn-by-turn in Amap" (a coordinate → Amap's route planner on GCJ-02; a place that opens by name → Amap's POI search: "Find it in Amap"), Google Maps directions, Show a driver, and "Directions open in the maps app; this app never goes online for maps." | `app/src/lib/components/map/GuideMe.svelte`, `Compass.svelte`; `app/src/lib/logic/geo.ts` (`amapRouteUrl`, `amapWebRouteUrl`, `googleDirectionsUrl`, `modeFor`); `app/src/lib/platform/maps.ts` (`openAmapRoute`, `openGoogleDirections`) |
| Location and heading: asked for only on the first "Show where you are"; remembered (`ltd:map:locate`) so it comes back without a tap; denied → no dot, no distances, a toast once; paused while hidden; the compass from `deviceorientationabsolute` (tilt-compensated), made true with the WMM table, the GPS course while walking (≥ 0.8 m/s); a rough fix says "≈ 900 m" and hides every distance under 3× it | `app/src/lib/map/locate.svelte.ts`; `app/src/lib/logic/wayfind.ts`; `app/src/lib/logic/declination.ts` |
| The filters (map4-filters): every category with glyph, colour, pins here (+ by name), names, a switch; Hotels shown: your beds / all hotels; the rings; Show N places; the status-colour note | `app/src/lib/components/map/FiltersSheet.svelte` |
| Android: ACCESS_COARSE_LOCATION + ACCESS_FINE_LOCATION (the WebView relays the page's request through Capacitor's BridgeWebChromeClient) | `app/android/app/src/main/AndroidManifest.xml` |
| Tests: MAPS5's own distances and bearings from Houhai, the 16 points and their words, the distance's wording, rough positions, turning, the phone's heading, steering, the scale bar, clusters, nearest-first (12); the table against WMM2025 at every stop of every seed (3); the Amap and Google hand-off (5) | `app/src/tests/wayfind.test.ts`, `declination.test.ts`, `guidelinks.test.ts` |

### Part 6 · gates, rehearsal, screenshots

**The rehearsal's first run with the Map rows: 178/183.** Five failures, each fixed at its cause:

| # | Row | Cause | Fix |
|---|---|---|---|
| 1 | Map · pins by category | the camera's padding, set as the rail measured itself, is a `jumpTo` — it cancelled the fly to you half way, so the zoom-out landed short of Houhai's food pin | `setPadding` waits for a move to end before it applies (`lib/map/street/index.ts`) |
| 2 | Map · a place: … focus back | the rail is drawn again as the sheet closes, so the card focus was to return to was gone | the card carries `data-place`; focus goes to the new card of the same place (`routes/Map.svelte`, `returnPlace`) |
| 3 | Map · Guide me | "WSW· straight ahead": Svelte trims the space before an `{#if}` block | one expression (`components/map/GuideMe.svelte`, `.gm-dir`) |
| 4 | Map · the list | the "Opens by name" heading is caps, and `innerText` returns it uppercased | the check reads it case-blind (the rehearsal) |
| 5 | A11y · focus rings not clipped, 384 guide `.totop` | the guide's place rows gained "Show on map" and ran up to 84 px past the screen: the layout viewport grew to 444 px and body's `overflow-x` clipped the fixed back-to-top ring | the row's actions go under its name: the Map-tab doorway beside the name, Open in Maps and Copy address on a line of their own (`routes/Stop.svelte`, `.sp-acts`) — which also ends Known issue 16's 4 px overflow of the address-copy pill at 384 |

**The second run: 181/183** — rows 1 and 2 again, and this time the causes were deeper (found with a probe
that held the map object, since removed):

| # | Cause | Fix |
|---|---|---|
| 1 | **A cluster made on demand was not drawn.** maplibre **6** asks a *resolver* for a missing image and waits for it; an image added in its `styleimagemissing` event — the v5 way, and ours — arrives after the tile that asked has been laid out, so that tile drew no cluster until it was laid out again. Round Houhai the cluster of the Drum Tower, the Bell Tower and Yaoji Chaogan (the only food pin in view, 300 m from you) was in the tile and not on the screen | `setMissingStyleImageResolver` where the engine has it (v6), the event where it does not (v5, which looks again straight after its event) — `lib/map/street/index.ts` (`paint`) |
| 2 | **Every route change destroyed the screen on show.** The trip's id reaches TripShell as a prop read off the router's route, a new object at every hash change; each of the shell's 21 live queries re-subscribed on it, `loaded` went false, the shell's one first render (`ready`) fell back to "Loading…" for a query's time, and the place's screen was destroyed and drawn anew — the Map tab rebuilt its WebGL map, lost its camera and the focus, each time a place opened or closed (and Now re-derived its whole day on every step to its day). Pre-existing since Run 1; found here because the map is the first screen that costs something to draw again | `lib/data/live.svelte.ts`: a query follows its deps by **value** (a `$derived` key) and runs untracked (Dexie runs it inside `subscribe()`), as its doc comment always said. Probe: no "Loading…" on Map → place → close → Guide me → back → Now → day; one map canvas throughout; focus back on the rail card |
| 3 | The fit of you + a place was framed in the padding the map had, not the one the sheet was about to give it, and refused outright ("Map cannot fit…") when a tall sheet left no room for its 56 px margin | `logic/wayfind.ts` `fitView` (pure, tested): the frame in the panels' newest padding with a margin that shrinks in a small box; every camera move carries the padding; a panel that settles mid-flight **re-aims** the move instead of the map jumping when it lands (`aim` in the controller) |
| 4 | Looked at while probing: the edge chip for Huguosi sat on you (a 190 px chip centred 80 px in from the edge); today's name tags hung under pins that were inside a cluster, and over the chosen place's sheet view | the chips hug the edge they point past (under the side controls on the right), 172 px at most, never on you or on each other (`routes/Map.svelte` `edges`); the tags only under a pin drawn on its own (`onDrawn`) and not while a place is open; with a place chosen the other pins stand at 70 % without their names, as map4-place draws them; OpenStreetMap's labels give way to the trip's pins (`icon-ignore-placement: false`) |

**The third run: 183/183.** Then the screenshots were read against the boards at 412 and 384 px, and what they
showed was fixed (the final run below is on the result):

| What the screenshots showed | Fix |
|---|---|
| The no-pack card sat under the chips, over you and your rings | it sits over the map's foot, just above the rail; the map frames you and the rings in the clear band above it; with no pack the foot is not drawn — nothing of OpenStreetMap is on screen then (`routes/Map.svelte`, `footSpace`, `.m-nopack`) |
| Today's pin was named twice (its tag and its label on the map) | the canvas label is left to the tag (`text-field` by `v`, `lib/map/street/index.ts`) |
| An edge chip could lie over a pin (and take its tap) | the chips keep off every pin and cluster the map last drew (`onDrawn` gives their points) |
| Guide me's destination name ran off the left edge | the fit leaves 88 px at the sides for a chosen pin's name (`fitView(…, [88, 56])`) |
| Two ✕ in the search field (the browser's own and ours) | the browser's is hidden (`.m-search input::-webkit-search-cancel-button`) |
| Typing a search moved the map at every letter (the results panel grew the top padding) and pushed the side controls under the rail | the frame keeps the height the bar and the chips had while a query is typed (`headH` → `topH`); the side controls step away under the results |
| Guide me had no attribution at all, and over a place's sheet at 384 the scale box sat on the chosen place's name | over a sheet and Guide me the map is a band: one line, "© OpenStreetMap contributors" (`.m-attr1`, `S.mapTab.attributionShort`); the scale and the long line stay on the map itself |
| The guide's place rows wrapped into three lines at 384 (doorway, Open in Maps, Copy address) | the Map-tab doorway sits beside the name; Open in Maps and Copy address on the line below, at the row's end (`routes/Stop.svelte`, `.sp-acts`) |
| A lone word on the last line of Guide me's footnote and of the filters' note at 384 | `text-wrap: balance` |

**The final run: 183/183** with the network hard off — the 168 rows before Map 5c + the 15 Map rows, the a11y sweep
over 88 screens and overlays (2,872 controls) at both widths with the Map, a place, Guide me, the filters, the list
and a search among them. The place row also checks that the map is the same map after its sheet opens and closes.

| Row | What it proves (the real result) |
|---|---|
| Map · the tab, from the nav | Now → the nav's Map → `#/trip/cn26/map`, the lazy screen and the engine drawn, Map the current place |
| Map · no pack: pins, you, rings on the night canvas | "Map pack not on this phone — import it", a file input with no accept filter; you on; `sight:8,food:1` drawn · rings 4 · 0 tiles read |
| Map · the import refuses a file that is not a pack | the seed JSON: "That file is not a map pack (PMTiles v3). Nothing changed", nothing in OPFS |
| Map · the test pack imports, the streets come from it | 633,312 bytes in OPFS (the file's size exactly) · tiles read from it |
| Map · pins by category, the chips count Beijing | sight · show · food · spa · medical drawn (food only inside a cluster — the second run's row 1); chips All 30 · Food 1 · Spa 1 · Sights 18 · Shows 3 · Shopping 1 · Transport 5 · Medical 1 |
| Map · you, the rings, the rail nearest first | ≈ 10 m N · ≈ 270 m ENE · ≈ 340 m ENE … ascending, each with its direction |
| Map · a place: its words, a straight line, focus in and back | Beijing Massage Hospital, 北京按摩医院, "Blind massage / tuina, not bone-setting", ≈ 1.9 km / "WSW of you · straight line"; Navigate, Driver card, Google Maps, Copy address; focus into the sheet and back to the rail card; one map throughout |
| Map · Guide me: the live leg, the compass, Amap | the leg flows (the one loop), 1.9 km, "WSW · straight ahead" facing west, the hand-off's words, no nav |
| Map · Guide me stands still under Calm motion | a solid leg with its arrowhead, 0 animations |
| Map · filters: every category, beds or all, rings | 8 categories · Show 30 places → Sights off → Show 12 places → back |
| Map · the list carries every place, and the unpinned | 30 places, each with its category and distance for a screen reader; 9 by name |
| Map · a lost WebGL context is built again | a new canvas, pins back |
| Map · Settings shows the pack on this phone | "China 2026 map · 633 KB · OpenStreetMap of 28 Sep 2026 · 10 areas", Delete, Replace |
| Show on map · from the guide, a pass, Find, the day | 23 in Beijing's guide (none for unpinned Jinshanling) → Beihai Park's sheet; the Forbidden City ticket → the Palace Museum, riding with it; Find "massage" → the Massage Hospital; Dec 8's Huguosi chip (none for unpinned Jiuhua) |
| Map · nothing asked off this machine | 121 requests, all local (the forecast's blocked call apart — Now's, not the map's) |

**The fallback, tested (maplibre 5.24).** `npx vite build --mode engine-v5` → check:dist clean (28 files) → bundle:
start-up 191.34 · all app JS 239.90 · **map engine 297.03 KB gz** (one UMD file whose worker is a blob of itself) →
the whole rehearsal on it. First **182/183**: maplibre 5 names every marker "Map marker" and makes it a button as it
is added (6 leaves the page's elements alone), so the decorative you-dot became a 20 px button — the a11y floor's
target row caught it at both widths. The controller now puts back what each element said about itself (`attach`,
`lib/map/street/index.ts`) → **183/183** on v5, the same rows as v6. Screenshots of v5 in
`app/.cache/shots/map5c-v5/` (the same fifteen; they match v6's). dist/ was then rebuilt with v6.

**Gates at the end of Map 5c** (from `C:\Source\China-map\app`, Git Bash):

| Gate | Result |
|---|---|
| `npm run check` | 652 files, 0 errors, 0 warnings (+ scripts `tsc`) — 598 before |
| `npm test` | **914 passed in 52 files** — 864 in 46 before (+ mappack 7, pack 6, mapplaces 15, wayfind 14, declination 3, guidelinks 5) |
| `npm run build` | contrast 65 tokens, 130 pairs, 0 failures (47 / 86 before) · precache 40 entries · check:dist 29 files clean, both passport identifiers absent (11 repo files), 14 patterns · **bundle: start-up 191.34 / 200 · all app JS 239.88 / 260 · map engine 448.26 / 470 KB gz** (305 + 143 in the spike) · no map pack in dist/ |
| `npm run verify:china` | 134 critical values + 90 structural facts, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **183/183** with the network hard off (168 before) |

**Screenshots** (the built app, headless Chrome, WebGL through SwiftShader, every non-localhost request refused;
Tue 8 Dec, you by the Houhai lakes ±25 m, facing west; the REAL pack, imported through the empty state's own input):
`app/.cache/shots/map5c/` — `412-nopack`, `412-map`, `412-place`, `412-go`, `412-filters`, `412-list`,
`412-search`, `412-guide-places`, and the same seven at 384 × 824 (`384-*`). `node scripts/e2e/map-shots.mjs`
takes them (`--dist` another build, `--pack` another pack, `--out` elsewhere).

### Deviations from the boards (map4-map, map4-place, map4-go, map4-filters)

**The map (map4-map)**
1. The streets are OpenStreetMap's (Protomaps' layers in the night palette), not the board's illustration; names come in English where OSM has one, else Chinese, often both ("Ande Road 安德路") — the owner's English + Chinese. The board's letter-spaced capitals are an illustration device.
2. The numbers are the trip's: All 30 · Food 1 · Spa 1 · Sights 18 · Shows 3 · Shopping 1 · Transport 5 · Medical 1 (the board: 38 · 3 · 3 · 17 · Hotels 2 · 5). **No Hotels chip and no "Tonight · Blossom House" pin**: neither Beijing bed has a verified position — Four Points opens by name, and Blossom House (`cn26-stay-01`) has no position AND no map target in the trip (no address, no search), so it is on no screen of the Map tab. A Map 5a data follow-up (so are the Kunyu academy, `cn26-stay-11`, and the Muping night, `cn26-stay-12`).
3. Today's place wears a still sunrise halo, not the board's breathing glow: a pulsing pin would keep the WebGL map drawing every frame. The ping round you (ambient, allowed) breathes as drawn.
4. "You" alone in its bubble (the board's "example position" is the board's caveat); a rough fix reads "You · ≈ 900 m".
5. Clusters are the trip's: a cluster of one category wears its glyph (the board's "+4" sights), a mixed one a quiet three-dot glyph the board does not show. A "+N" badge can sit on a ring's label where a cluster falls on the rings' NE diagonal.
6. The edge chips signpost **today's places and tonight's bed** past the edge (at most three; on Dec 8 "Huguosi TCM Hospital, 1.6 km W"), not any place (the board's Sanlitun is an area, and areas are not places in the trip). A long name is cut ("Huguosi …") to keep the chip to 172 px.
7. The foot says the brief's words, "© OpenStreetMap contributors · map data stored on this phone" (the board's "Illustration · real data …" is the board's caveat).
8. "Near you" carries a **List** button (the brief's list view for screen readers) beside "Exact distances first".
9. The rail is nearest first without exception: Houhai (10 m) leads, not the board's Huguosi (today, 1.6 km); today's card carries its "Today" chip wherever it falls.
10. Pin names are the place's own up to " · " or ", " — the board's hand-shortened "Yaoji · breakfast" is composed, and a place's words never are.

**A place (map4-place)**
11. The category chip is the category word ("Spa"): the board's "· massage" is no field of the trip.
12. No "Today: spa day" chip on the Massage Hospital: on the trip's Dec 8 it is not today's place (Huguosi is, and its sheet carries "Today ·" and the day's title).
13. Driver card, Google Maps and Copy address; **Add to my day** only where one of the day's options names the place, during the trip (the board draws all four).
14. The line is the trip's own, "Blind massage / tuina, not bone-setting" (the board's "— not bone-setting.").
15. A one-line "© OpenStreetMap contributors" over the band of map (the board has none; OSM's licence asks for it wherever its data is drawn).

**Guide me (map4-go)**
16. "WSW · straight ahead", not "slightly left": the screenshots' phone faces magnetic west (270°); made true with Beijing's −7.4° it faces 262.6°, 7° from the place's 255.5° — inside the ±10° the app calls straight ahead. The board's words assume true west.
17. The compass arrow is still: the board's `tipGlow` loop would be a second loop beside the leg's FLOW, the only one the motion rules allow on a route.
18. The one-line attribution above the panel (the board has none).
19. "to Beijing Massage Hospital · S…" is cut at 412 as the board's own geometry cuts it; the whole name is the panel's accessible name.

**The filters (map4-filters)**
20. No **Areas** row: areas (Houhai, Sanlitun) are not places in the trip — the eight categories are the whole list.
21. "+ N by name" beside a count: the places that open by name, never pinned.
22. The sheet covers the nav, as every Horizon sheet does (the board draws the nav below it).
23. The counts and names are the trip's (Hotels 0 + 1 by name, "Four Points …").

**No board:** the no-pack state, the list, the search results and the doorways ("Show on map": the Map glyph beside a
guide place's name, a labelled button on a pass, an icon on Find's rows and the day's chips) follow the tab's own parts.
**At 384 px** everything fits: the chips scroll under their fade, the rail shows one card and part of the next, and the
place sheet leaves a smaller band of map (the fit zooms out to keep you, the place and its name above the sheet).

### Left, and why

- **The phone.** No adb, no Gradle (the rules): the APK and the pack's copy to Drive are the main session's. On the S23 watch v6's module worker in the WebView (the tested fallback is one build flag away: `vite build --mode engine-v5`), `deviceorientationabsolute` (without it the compass says so and the arrow waits) and the GPS course while walking.
- **Blossom House, the Kunyu academy and the Muping night** have no position and no map target in the trip, so the Map tab cannot show them (item 2); verified positions are Map 5a's to add, never guessed here.
- **The shell fix is app-wide** (`live.svelte.ts`, the second run's row 2): no screen is destroyed and drawn again on a step within its place any more — Now's day, a pass, a city's guide included. All 183 rows pass with it; it is called out because it changes behaviour beyond the Map tab.

## Merge of main (data to 7bda563) · DONE (2026-09-29)

`git merge --no-ff --no-commit main` into `horizon-map`, run by the main session, which resolved
`assert.ts`, `coverage.test.ts` and (as a placeholder) the seed. main since ac770cd: **5e99c5f** (Yue Tu
reserves Jade Dragon at the Dec 10 release; the gorge bag rides the public bus, waits at Jane's),
**021c486** (every night and flight in China booked — the Muping night `cn26-stay-12`, CA1560
`cn26-flight-ca1560`; the school: pickup from 10:30 in the lobby, it registers you, the $100 is an
application fee), **35471be** ($2,000 in three envelopes, no ATM; the `cash-plan` task), and the privacy
commits. **No screen changed** — `dist/` rebuilt byte-identical to HEAD's. Read-only git only.

**The rehearsal (11 hunks).** Horizon's structure and selectors kept, main's facts asserted where Horizon
shows them, no old-DOM check brought back: (1) Nov 22 runbook on `now/day` — the lobby pickup from 10:30,
Jinjiang Inn Select; (2) tonight on Nov 22 is the booked Muping night (auto-merged `#/wallet/` target
corrected to `#/pocket/`); (3) the airborne night's comment; (4) to-dos 28 → **24**, main's history in the
comment; (5–6) route-check moves: 0 gaps, Dec 5 = CA 1560 "Booked"; (7–9) route-check stops: Kunyu
"Booked", the move into Beijing held, gorge and "3 legs to book" as before; (10) the Relay sweep on the
real trip (no red, no ring, "6 legs to book") **and main's "before 28 Sep" block ported** — the two
bookings set aside in IndexedDB: Nov 22's crit NO BOOKING ON FILE, Dec 14 Kunyu "Bed missing · 22 Nov"
amber + the "Nothing booked" move + Kunyu ringed alone + "4 legs to book", Nov 1 red with the longest
pause and "7 legs · 1 bed missing", then put back and read Booked again; (11) Journey rows = rings at 0,
the map says "all booked". Auto-merged and passing unchanged: Money ($6,535 committed; $992 / $5,216
chips; the Muping night $23 ¥164.00; CA 1560 $110), twelve beds, the Muping card, the 10:30 academy chip,
no map button on either new booking. Horizon-only checks moved to the new data: packing 30 → **34**;
Earlier 27 → **23**; the Replay rings walked on the pre-28 Sep trip (none are drawn on the real one; the
set-aside is one shared helper pair). New assertions for facts main never put on a screen: **Packing ·
$2,000 in envelopes, the bag at Jane's** (new row), the Dec 18 "Public bus" the bag rides, the Jade Dragon
pass's "RESERVED for Dec 17" with the release as fallback — none holds on the ac770cd data.

**Unit tests** (Horizon's, no conflict; main's `BOOKED_28_SEP` pattern): `routecheck` (6 legs / 0 beds
now, 7 / 1 red before; Dec 5 "CA 1560 → Beijing"), `metroline` (Nov 22 ends at the Muping bed; Dec 5 via
YNT and PEK; the holes on the pre-28 Sep trip), `timeline` (Nov 23's fixed point is 10:30), `todo` (24, 23 late).

**Seed and Map layer.** `npm run seed-build`: main's data exactly (equal to main's seed with the three
layer keys taken off; PDF and photos identical) + **925 layer lines, 0 removed**; `map layer: 211 places
categorised, 133 new pins inside their radius, 182 details verbatim` (Map 5a: 209 · 133 · 181). New or
changed entries: `cn26-stay-12` → `hotel`, "Earliest pickup 10:30, wait in the lobby" (the Nov 23 plan),
**no pin** (nothing verified is tied to Muping by the trip's words — `pin-targets.ts` `NOT_ASKED`);
`cn26-flight-ca1560` → `transport`, no line; `cn26-ticket-jade-dragon` → "Yue Tu's ¥550 tour is RESERVED
for Dec 17" (the old line left its note); `cn26-place-02` PEK → "The Dec 5 arrival (CA1560, 16:15)" (a
judgement call: its meaning now opens on that job). `MAP-DATA.md` regenerated (195 places, 16 movements).

| Gate | Result |
|---|---|
| `npm run check` | 598 files, 0 errors, 0 warnings (+ scripts `tsc`) — 596 at 8b9961a |
| `npm test` | **864 passed in 46 files** — 855 at 8b9961a |
| `npm run build` | contrast 47 tokens, 86 pairs, 0 failures · precache 34 entries, 983.45 KiB · check:dist 23 files clean, both passport identifiers absent (11 repo files), 14 patterns · bundle 187.17 / 200 and 207.63 / 260 KB gz · `dist/` unchanged |
| `npm run verify:china` | **134 critical values + 90 structural facts**, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **168/168** with the network hard off (163 + the four pre-28 Sep rows + the Packing cash row) |
| `npm run verify:places` | 750 answers from the cache, **0 over the network**; 126 of 159 pinned, `pins.ts` not rewritten; exit 1 on the known 大研纳西古乐会 flag (pre-existing) |

## Run 4b — the second review's fixes (FIX-4B.md) · DONE (2026-09-29)

The code review of Runs 3c + 4 found no HIGH defect and no data loss; its 3 MEDIUM and 5 LOW
findings — older bugs on the paths it traced — are all fixed, MEDIUM first. Built on Run 3c's
history stamping and `backPast` and on Run 4's editors (`...e` first); none of them rewritten.
Logic in the router and `forms/specs.ts` with vitest tests; every flow has a rehearsal check. **No
screen changed its look**: the entry CSS is byte-identical to Run 4's (`index-CBIQbnAq.css`,
155.21 KB raw / 27.35 gz) and no screen's markup changed but one condition (the pass's "Not on this phone"
card waits while a sheet is open or the app steps back — item 2); what changed is behaviour the fixes need (below,
"Visible"). No trip fact was touched; `sources/`, `seed/`, `legacy/`, `app/scripts/china/`,
`app/scripts/privacy/` and `check-dist-clean.ts` were not opened for writing (the seeds and
`scripts/china/transform.ts` were read, to see which map fields each editor's records carry and
where the build takes them from). No adb, no Gradle, read-only git only.

### MEDIUM

| # | Finding | What changed (file:line) | Proof |
|---|---|---|---|
| 1 | `closeTopLayer()` then another action raced the async `history.back()`: Edit trip's wizard closed as it opened, Create and Import landed on the shelf | **At the root, in the router** (`state/router.svelte.ts`). `closeTopLayer()` (`:247`) returns a promise, settled by the popstate of its own step once `onPop` has handled it (`stepBack`, `:260`): true when the layer is gone, false when its guard kept it or no step came within 1.5 s (`backPast`'s guard). A second call while one is on its way is the same close — one step, not two (a double tap on ✕). **And the router pushes nothing while its own step is on its way** (`step` `:85`, `whenStill` `:130`): `go` (`:135`), `backOr` (`:146`), `replace` (`:185`), `backPast` (`:165`) and a new layer (`pushLayer` `:230`) wait for it — so a site that forgets to await still lands right. The four sites await it: Edit trip (`routes/TripsHome.svelte:349` — the menu closes, then the wizard opens), Create (`routes/TripWizard.svelte:127`), Import and the old-app restore (`routes/ImportSheet.svelte:139`, `:110`); the close-only calls say so (`void`: TripsHome `:141`, `:147`, TripWizard `:99`, SchemaForm `:91`, `:111`) | The router tests (below). Rehearsal: **Import · lands on the trip it imported** (China 2026 · Now, no sheet, one back press → the shelf), **Create trip · lands on the new trip** (one back press → the shelf), **Edit trip · the wizard stays open and saves** (still open 1.5 s after the tap, holding the trip; Save writes the new title; no sheet's entry left behind); **Delete a trip** now starts from the shelf Create's back press returns to — it found the new card only because Create landed on the shelf |
| 2 | Deleting a booking from its own pass ended on "This booking is gone" (the pass's "Not on this phone") | `routes/Pocket.svelte:163-185`, Run 3c's stop delete applied to the pass: the delete marks the pass gone — before it deletes, and undone if the delete fails (`gone` `:163`, `:164`) — instead of rewriting the address from inside the sheet, which rewrote the SHEET's entry; the editors' `onclose` (`closeSheet` `:175`, all eight sheets `:357`) calls `router.backPast(isPass, list)` once the sheet has closed; the pass is matched through `parseHash`, whatever spelling its address has. The "Not on this phone" card is not drawn while a sheet is open or while the app steps back (`:338`, TripShell's rule for "Stop not found") | 4 router tests (from its list, from Now, opened cold, called before the close lands). Rehearsal **Pocket · deleting a booking from its pass lands on its list**: a throwaway booking written into the vault, Pocket → Travel → its pass → edit → delete → on Travel, no "Not on this phone", no sheet, gone from the vault; one back press → the Pocket |
| 3 | Editing a flight's airport kept the old airport's map target; retyping a driver card's Chinese kept the old place's address and coordinate | `lib/components/forms/specs.ts:38-68`, the rule and `retarget()`: when the field a record's map target was built from changes, the target goes — coord, pin, mapQuery, mapCity, mapUrl, address, addressEn, addressInSearch, all but the fields the form itself shows (the owner's own) — and a record that had one searches the new name, so its button opens the place it names now; unchanged, the target is kept exactly. Applied to a flight's From code (`:290` — the build borrows the From airport's target), a place card's native text (`:776` — its map link is its form's), a stay's name (`:396` — its address and link are its form's) and a ticket's venue, including a booking that stops or starts being a ticket (`:510`). **Not applied, on purpose:** a stop's map fields are its area — the Journey draws it there and the weather reads it; Chongli's search is 太子城, Zhangjiajie's 武陵源, not built from the title — so a renamed stop keeps them, as Run 4's test keeps its coordinate; a rail end's stations are drawn by name beside it on the pass (never silently wrong) and are verified places the form cannot make again, so they stay as Run 4 kept them | 11 tests in `specs.test.ts` › "the map target follows the place": CA 8609 PKX → PEK (the Daxing target gone, searches "Beijing Capital Intl", aircraft, group and chips kept); MU 733's address goes with its airport, and with no name typed it searches "CTU"; the same airport keeps its target (a new name, a new To, " pkx "); a flight with no target gets none; a place card retyped searches its new Chinese, keeps a link typed into its form, keeps everything when only the meaning changes; a phrase gets no search; a stay renamed (Huatian searches its new name; an address-only stay keeps its address and gains nothing); a ticket's new venue; ticket → other and other → ticket; a renamed stop keeps its target |

**Every other close-then-act site** (the sweep: every `closeTopLayer`, every `pushLayer`, every
sheet cleared by its flag, every `go`/`goTab`/`goPocket`/`replace`/`setPreview` reached from inside
a sheet or its callbacks):

- **Pocket's delete from a pass** — the address rewritten inside the delete, then the close (item 2).
- **The day's long jump** — the date written, then the sheet cleared by its flag: the `?d=` went onto
  the sheet's entry, and its layer stayed (item 7).
- Stop.svelte's stop delete (Run 3c) already moved on from `onclose`, after the close; it now
  decides where to go before it deletes, because its screen — sheet and all — goes as the delete
  commits ("Found while verifying"), and `backPast` also waits for a step still on its way.
- Nothing else: every other close (✕, the backdrop, Escape, a swipe, after a save, after a delete)
  does nothing after it; no sheet holds a link; no other sheet is cleared by its flag or opens another.

### LOW

| # | Finding | What changed (file:line) | Proof |
|---|---|---|---|
| 4 | Train ↔ other stripped a road leg's ends | `specs.ts:439` `keptFrom` drops only the old kind's fields the NEW kind lacks (a train made a road leg loses only its number); the train branch starts from the ends of a train or a road leg (`legOf` `:449`, `:535`); `toValues` fills From, To and the times from a road leg too (`:490`) — made a train, it shows its own ends, not blanks that a save would write | 2 tests (dec09 → road leg: ends, times, duration kept, number gone; the Dec 18 road leg → train: its ends, their "why", its duration) |
| 5 | `compareClock`: "~07:30" sorted after every time, even after '99:99' | `logic/dates.ts:51`: a leading `[~≈\s]` is stripped before the zero-pad | 1 test (7 cases) + 1 in `commitment.test.ts` (a "~07:30" leg is next, ahead of a leg with no clock and of a later one) |
| 6 | The guide jumped to its top after saving the stop | `routes/Stop.svelte:266`: the scroll effect is keyed on `$derived(stop.id)`, not the stop object a save replaces | Rehearsal **City guide · saving the stop keeps its place** (edit mode, scrolled to 1,800 px, two saves: within 60 px) |
| 7 | A Sheet closed by clearing its flag left a stale layer | The router: `pushLayer` returns a **release** (`:230`, `release` `:287`). If the released layer's entry is the one on screen the router steps off it — once, and not at all when back or ✕ already took it or its close is on its way; under a layer still open it is stepped past when that one closes (`:316`); gone before it could open, nothing is pushed. Its close still runs once, as its step lands — the owner's `onclose` may be what moves the app on — but a layer whose owner is gone can no longer veto (`onPop` `:309`; see "Found while verifying"). `ui/Sheet.svelte:47-61`: the effect runs once, untracked (a second run would be a second layer), and releases on unmount. Counter mode, the driver card and the document viewer hand theirs back too (`pocket/CounterMode.svelte:32`, `:45`; `pocket/DriverCard.svelte:62`, `:77`; `pocket/Documents.svelte:44`, `:90`). The day's long jump closes through the router, then writes the date on the day's own entry (`now/DayView.svelte:93`) | 9 router tests (a release steps off once, runs the close once, cannot be refused; no second step after back or ✕ or while closing; none after a link; a lower one stepped past; a layer gone before it opened; the stop delete whose screen goes first, both orders). Rehearsal **Day title · the long jump leaves no layer** (Now → the day → jump to Zhangjiajie: the `?d=` on the day's entry, no layer's entry, one back press → Now) |
| 8 | Nested objects rebuilt: a flight's `from`/`to`, a card's rows, a checklist's items | a flight's end is the form's code and name over the end it was (`flightEnd` `:327`) — its map fields go only when it is another airport (item 3); a card's rows ride through the form whole (`:578`, `:595`); a checklist item keeps what else it carries (`:733`) | 3 tests (a pin on both ends, on a row, on an item — kept edited or not; the To end's pin goes with its airport) |

### Found while verifying

**The first two builds broke Run 3c's stop delete** — the rehearsal caught both ("City guide ·
deleting its stop lands on the Journey" landed on the deleted stop's page, 162/163 each time; a
focused CDP walk with every history call logged showed why). Deleting a stop takes the guide's
whole screen away, sheet and all: TripShell unmounts `Stop` the moment the stop is gone, which is
when the delete commits — while `mutate`'s second write (`touchMutation`) is still on its way —
and the Sheet hands its layer back as it unmounts.

1. The first build skipped a gone layer's close — which is the sheet's `onclose`, which is what
   runs `backPast`. The rule became: a gone layer's close still runs, once, as its step lands; it
   just cannot veto (`router.svelte.ts:309`). Four router tests hold it (the close runs once; a
   gone layer cannot refuse; the stop delete with its screen gone before, and during, the close),
   and the first build's rule, put back as a mutant, fails four of them.
2. Then the `onclose` ran — before the delete had returned and set where to go. **A delete that
   strands its screen now decides the way out before it deletes** (`routes/Stop.svelte:354`; the
   pass the same, `Pocket.svelte:164`; undone if the delete fails), and the rule is written where
   the next sheet will meet it (`forms/SchemaForm.svelte:108`, `docs/design/HORIZON.md` › Layers).
   The walk logged: the one close, then `backPast` stepping guide → city → Journey.

### Tests and their proof

- **830 tests in 44 files** (Run 4: 788): router 21 → 45, editors 53 → 69, dates 11 → 12,
  commitment 26 → 27.
- **Against the pre-4b router** (`git show HEAD:app/src/lib/state/router.svelte.ts` — Run 4 left
  it unchanged — as a temporary copy, deleted after): 19 of the 24 new router tests fail, and one
  old one, whose contract changed (`closeTopLayer` now answers). The five that pass: the check that
  the in-memory history reproduces the race at all, and the router's side of the pass delete, whose
  bug was in `Pocket.svelte` (the rehearsal walks that).
- **Mutation checks** (each rule broken on purpose in a temporary copy, then the suite run, then
  the copy deleted): the router, 11 mutants, **10 killed** — the survivor is `backPast` waiting for
  a close still on its way, which is defensive: in the app it is only ever called from inside that
  close's own popstate, and in Chrome's order an early second step lands on the same entry anyway.
  The editors, 13 mutants — each fix of items 3, 4 and 8 undone — **13 killed**.
- **Rehearsal: 6 new checks** — Import · lands on the trip it imported; Day title · the long jump
  leaves no layer; Pocket · deleting a booking from its pass lands on its list; City guide · saving
  the stop keeps its place; Create trip · lands on the new trip; Edit trip · the wizard stays open
  and saves — and Delete a trip, rebuilt to start from where Create's back press leaves the shelf.
  One harness change came with them: while the app is online for its install the forecast service
  is blocked (`Network.setBlockedURLs`) — the import now lands on a trip screen, which refreshes its
  forecast, and the harness should not call a third-party service or cache what the offline walk
  never had before; the block is lifted before the network goes.

### Visible

Nothing is drawn differently. Behaviour that changed, all of it the fixes: Edit trip opens its
wizard (it closed as it opened); Create and Import land on the trip (they landed on the shelf); a
booking deleted from its own pass lands on its list (it ended on "Not on this phone"), and that card
is not flashed while the sheet closes; a map button after an edit of a flight's From airport, a
place card's Chinese, a stay's name or a ticket's venue searches the new name (it opened the old
place); the guide stays where it was after a save; after the day's long jump one back press
leaves the day. The long jump's sheet now goes and the new day appears in the same frame (the
close lands, then the date is written, in one task).

### Gates at the end of Run 4b

| Gate | Result |
|---|---|
| `npm run check` | 588 files, 0 errors, 0 warnings (+ scripts `tsc`) |
| `npm test` | **830 passed in 44 files** (Run 4: 788) |
| `npm run build` | check · contrast 47 tokens match tokens.json (one palette), 86 pairs, 0 failures · vite build (terser, settings unchanged; precache 34 entries, 983.45 KiB) · check:dist 50 built files clean, both passport identifiers absent, 14 patterns · **bundle: initial load 187.17 KB gz of 200 (12.83 under), all app JS 207.63 KB gz of 260 (52.37 under)** — Run 4: 186.40 / 206.85; the entry CSS unchanged, 155.21 KB raw / 27.35 gz |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `REHEARSAL_PORT=4177 npm run rehearsal` | **163/163** with the network hard off, on the final build (Run 4: 157 — every one of its rows still passes, compared row by row with Run 4's log, plus the 6 new) |

### Left, and why

- **A stop's and a rail end's map fields** are not dropped on a rename (item 3, the reasons there).
- **A link followed from inside a sheet** still leaves the sheet's entry under the new screen (one
  back press lands on the screen below it). Pre-existing, and no sheet holds a link today.
- **The `?d=` preview is app-wide while each entry keeps its own `?d=`**: back from the day to Now
  shows the jumped-to date while Now's address keeps its own. Pre-existing design, not a finding.
- **The old-app restore** (`ImportSheet` `applyLegacy`) has no rehearsal walk (it needs a backup
  of the old China app); it is the same awaited close as Import, which the rehearsal walks.

## Run 4 — dark only + hardening (RUN4.md) · DONE (2026-09-28)

Track A of the two parallel tracks (the Map is Track B, in `C:\Source\China-map`, never read or
written here). 4a → 4b → 4c in order. The diff stays focused: no new tab, no route added or
moved, `strings.ts` gained one key (`edit.item`) and lost four (`settings.theme`, `themeDark`, `themeLight`, `themeLine`), no
file renamed or moved, no mass reformatting. Pure logic stayed in `src/lib/logic` with vitest
tests; every new behaviour has a rehearsal check. Every changed screen was re-shot at 412 px and
at 384 px (the S23's real CSS width). No trip fact was touched; `sources/`, `seed/`, `legacy/`,
`app/scripts/china/`, `app/scripts/privacy/` and `check-dist-clean.ts` were not opened for
writing. No adb, no Gradle, no git command that changes anything.

### 4a. The light theme is gone

| Item | What changed (file:line) |
|---|---|
| The Daylight palette | `app.css`: the `:root[data-theme='light']` block (135 lines: 47 colour tokens, the composites, the daylight shadows, its bridge) deleted; the light identity-hue composition (`:root[data-theme='light'] *`), the date inputs' light `color-scheme`, the 1.5 px daylight opal edge, the dashed daylight warn chip and the daylight `.iconbtn` deleted. The header (`app.css:14`) says dark only; `:root` keeps `color-scheme: dark` |
| Light-only rules in components | deleted from `NavBar`, `DayView` (the metro chips on card paper), `NowHome` (sheet shadow, sun/count glow), `Pass` (code strip ×3), `PocketHome` (11 rules + the `.whitekey` swatch that only daylight showed — the element is gone too), `WalletCards` (×3), `Sheet` (backdrop, shadow), `TripMap`, `Comet`, `FlowPath`, `TripsHome`, `Find` (×3). Comments that described two themes (PaperChip, CounterMode, DriverList, MapButtons, Sheet, ink.ts) now describe one |
| Dead code the palette was hiding | ~80 legacy-bridge tokens nothing read (`app.css:250` keeps the six with readers: `--accent-h`, `--plan-card`, `--plan-edge`, `--glow-2`, `--glow-focus`, `--radius`), and the global classes no markup writes: `.type`/`.script`, `.u-fade`/`.u-stagger`/`.u-pulse` (+ `@keyframes h-pulse`), `.chip.done`, `.stamp.flat`, `.routeline`, `.btn.neon`/`.btn.lantern`, `h1.pagename`, `.countnum`, `.seg` (the theme radio). `app.css` 1,560 → 1,137 lines |
| Settings | the Theme row and its segmented control are gone (`routes/Settings.svelte`; the header comment `:6` says why); Appearance is Calm motion + Route animations |
| The mechanism | `App.svelte`: the theme effect deleted. `lib/logic/theme.ts` rewritten: `THEME_COLOR` (the sky) and `LEGACY_THEME_KEY` — nothing applies, stores or reads a theme. `index.html`: the boot script is gone, `color-scheme` is `dark`, `theme-color` stays the sky `#0b0c16`. `model/types.ts:572` — `Settings.theme` removed (a stored one is ignored); `data/repo.ts` default without it; `strings.ts` — `settings.theme/themeDark/themeLight/themeLine` deleted |
| The contrast gate | `scripts/check-contrast.mjs`: ONE palette — reads tokens.json v4 (`value` is one string), fails on a second theme in tokens.json or a `[data-theme]` rule in app.css, the identity hues composed once; the 31 bridge pairs of dead tokens replaced by the three live ones and the guide hero's photo ink. **47 tokens match tokens.json; 86 pairs, 0 failures** (Run 3c: 47 × 2, 113 pairs × 2) |
| The design system | `system/tokens.json`, `README.md`, `design-system.json` and `components/CounterMode/README.md` replaced by the dark-only v4 files from the scratchpad's `ds2/project` (read-only source; line endings made LF like the repo) |
| Tests | `src/tests/theme.test.ts` rewritten, 7 tests: one palette in app.css and `--sky` = `THEME_COLOR`; no source file carries a light rule or reads a theme; `index.html` runs no boot script, offers only the dark scheme and paints the sky; the manifest takes the sky; tokens.json has one theme and one value per colour (16 two-theme tests retired) |
| Rehearsal | the Light walk's 9 rows → 6: **"Night · a stored 'light' still boots dark"** (writes `theme: 'light'` into the settings record AND `ltd:theme` into localStorage, boots cold: no `data-theme` at DOMContentLoaded or after, the night sky, the status bar the sky, the page's `color-scheme` dark), the EY 888 pass's facts and night ink, the guide's headings, the day line's night glass, and "Settings · no theme to choose". The Light walk's Dec 11 and guide facts were already asserted by dark checks (supersets) |

**CSS saved** (4a build, before 4b added its few rules): entry CSS **166.16 → 154.22 KB raw
(−11.94), 29.62 → 27.18 KB gz (−2.44)**; all CSS 177.20 → 164.81 raw (−12.39), 33.05 → 30.53 gz
(−2.52). Start-up JS 186.08 → 185.84 KB gz; Settings' lazy chunk 3.62 → 3.35. At the end of Run 4
(4b's rings, paddings and the off-screen rule included): **entry CSS 155.21 KB raw / 27.35 KB gz
(−10.95 / −2.27 against Run 3c)**, all CSS 165.83 / 30.72 (−11.37 / −2.33); precache 34 entries,
981.38 KiB (3c: 993.17).

### 4b. Hardening

**The a11y floor, every screen.** Swept with Chrome's own accessibility tree (names), measured
hit areas (the control's box, or what an absolute `::before`/`::after` adds), real keyboard focus
(one Tab, then focus that scrolls the control into view) with the ring's clipping by every
`overflow` ancestor computed, and the heading outline — 30 screens and 8 overlays, at 412 and at 384 px.
The first sweep found (all fixed; the final sweep is clean at both widths):

| Found | Fixed (file:line) |
|---|---|
| Now's home had **no heading at all** | the date is its `h1`, with a hidden "Now:" (`components/horizon/AppBar.svelte:77`) — the board unchanged |
| Find had no `h1` | a visually hidden one, on the type scale (`routes/Find.svelte:192`) |
| Money went h1 → h3; a form's groups went h2 → h4 | the section heads are `h2` (`pocket/Money.svelte:341,363,375`, `pocket/Ledger.svelte:110`), a form group `h3` (`forms/SchemaForm.svelte:116`) — their own classes keep the look |
| The map's leg chip on Now: 159 × 32 | a 44 px hit area, drawn 32 as the board draws it (`now/NowHome.svelte:384`) |
| To do: "why this matters" 36 px; its "Open booking link ↗" 19 px (×9) | 44 px (`now/Todo.svelte:359`, `:368`) |
| The city's Trip · Today · City: 42 px | 44 px inside the same 52 px track (`routes/Stop.svelte:663`) |
| Focus rings invisible: the import sheet's file button (the ring was on the span, clipped by the label) and the guide's photo picker (an invisible input in a label that showed nothing) | the label no longer clips (`routes/ImportSheet.svelte:211`); the picker's label wears the ring (`routes/Stop.svelte:1102`) |
| Find's field: drawn lit at rest, so focus changed nothing a keyboard could see | lit while it is typed into — `:focus-within`, as the `--focus-halo` token's own comment says (`routes/Find.svelte:421`) |
| Rings cut away by a clipping box: the preview strip (edge to edge, top of page), Settings' rows (the group clips its corners), the shelf's scene, the guide's accordion days, Money's ledger summary | the ring goes inside, `outline-offset: -4px` (`App.svelte:121`, `routes/Settings.svelte:445`, `routes/TripsHome.svelte:457`, `routes/Stop.svelte:1377`, `pocket/Ledger.svelte:164`) |
| …and by a sideways scroll box: Now's tiles, the city's chapter chips, Find's scopes | 6 px of the scroll box above and below (margins give it back) and `scroll-padding-inline` (`now/NowHome.svelte:544`, `routes/Stop.svelte:777`, `routes/Find.svelte:467`) |
| **A focused item half outside its sideways scroller** — at 384 px a keyboard reached Now's VISA tile with most of it (and its ring) past the rail's edge; the same for two city chapter chips (412) and one (384) and Find's "Places" scope (384). Chrome counts a half-visible element as visible and does not scroll further | `lib/components/ui/revealFocus.ts` (new) on the three scrollers: keyboard focus inside brings the item wholly into view, at once, to the item's own snap position where the row snaps (Now's tiles — else the snap pulls it back); a wholly visible item and a tap never move the row. A rehearsal check walks Now's tiles with **real Tab presses** at 384 px. *Found late: the first ring sweep skipped these, because a tile's previous sibling losing its ring read as a neighbour's `:focus-within` ring — the sweep now blurs before it looks (rehearsal and scratch audit both).* |
| Row edit buttons all named "Edit" — the same name as the screen's edit-mode switch | named by their row: "Edit Check out…", "Edit Toothbrush" (`strings.ts` `edit.item`; `Todo`, `Lists` ×2, `DriverList`, `Phrases`, `Emergency`, `InfoCards`) |

Not changed, with reasons: Documents' 1 × 1 file input is `tabindex="-1"` + `aria-hidden` (its
buttons open it), so it is not a target; the modal overlays leave the page behind reachable by a
hardware keyboard's Tab (Chrome prunes it from the accessibility tree for `aria-modal`, which is
what TalkBack reads). **Nothing by colour alone:** every status is a word; the one colour-only
mark is the Journey map's amber "not booked" leg, and the route check directly under it says
"Not booked" in words for the same moves (Now's map draws no status colour at all) — so the
approved map was not redrawn. **Motion:** swept with `document.getAnimations()` on every screen
that loops — Calm motion and reduce-motion: nothing runs anywhere and nothing scrolls smoothly;
Route animations off: no route motion, only the ambient loops.

**Performance** — `scripts/e2e/perf.mjs` (new, reproducible): the S23 proxy is headless Chrome at
384 px with the CPU slowed 4×, the built app served locally, cold (no cache, no service worker).
The Run 3c build ("before") and the final build ("after"), interleaved, 5 runs each, medians:

**Cold start of Now (Dec 11)**

| | Before (Run 3c) | After (Run 4) |
|---|---:|---:|
| first contentful paint (ms) | 360 | 360 |
| Now first painted, whole or not (ms) | 567 | 764 |
| **Now complete — its last state painted (ms)** | **937** | **764** |
| states Now passes through (1 = drawn once, whole) | 7 | 1 |
| entry module compile / evaluation (ms) | 18.9 / 211 | 18.9 / 209 |
| main-thread scripting until Now is complete (ms) | 594 | 421 |
| main-thread rendering until Now is complete (ms) | 264 | 270 |
| long tasks after first paint (count) | 4 | 2 |
| longest task after first paint (ms) | 227 | 182 |
| **long tasks > 200 ms after first paint** | **1** | **0** |
| long-task time after first paint (ms) | 473 | 315 |
| settled — the last long task ends (ms) | 937 | 764 |

"Now first painted" is later on purpose: it is the frame Now appears in, and it now appears once,
complete. The old one appeared at 567 ms saying "Nothing is planned for today.", then "Tonight's
bed is not booked yet — Pullman Zhangjiajie" (it is booked), then half a sentence, and was right
at 937 ms; the new one is right the first time, at 764. The one long task left after first paint
is that first render (182 ms median). Earlier runs on a busier machine read the same way
(complete 1,074 → 930; long-task time 572 → 394).

**Journey · Play (Dec 11), pressed and left to run to its end** — unchanged, and smooth before
and after: ~15.6 s, ~938 frames, frame interval p50 and p95 17 ms, the slowest 17 ms, no frame
over 50 ms, no long task.

**At rest — main-thread busy time, ms per second, nothing touched**

| | Before | After |
|---|---:|---:|
| Journey scrolled to the bottom (its map and Flow out of view) | 179 | **8.6** |
| the Pocket scrolled to the bottom (the TODAY card's opal edge out of view) | 195 | **0.1** |
| Now at the top (its loops in view — the control) | 169 | 168 |

What changed, and why:

- **Loops stop where no one sees them** (`lib/motion/offscreen.ts`, new; `app.css:1130`): one
  IntersectionObserver marks a looping element `data-offscreen` while it is out of view, and CSS
  pauses its animations (`animation-play-state`, so nothing restarts). On the Flow path, the
  map's and the metro line's ping and rails, the sun mark, Now's sentence sun, the opal-edged
  cards (Now's NEXT, the Pocket's TODAY, the pass, the shelf's lead trip), the pass arc and snow.
  The hidden app already paused everything (`html.app-hidden`); the rehearsal now proves it.
- **Now is drawn once, whole** (`routes/TripShell.svelte:86`, `:123`): the shell waits for all 21 of the
  trip's tables. Drawn with the first of them, Now used to say false things for its first
  ~370 ms (4×): "Nothing is planned for today.", then **"Tonight's bed is not booked yet —
  Pullman Zhangjiajie"** (it is booked; the bookings had not answered), then half a sentence,
  then the truth — seven states in all. Now it appears once, complete, 173 ms before the old one
  reached its last state.
- **Trip data is read raw, not through deep proxies** (`lib/data/live.svelte.ts:21`,
  `$state.raw`): a query's answer is only ever replaced whole (Dexie hands over new arrays; every
  write goes to the database through `plain()`), so the proxies bought nothing but a trap on every
  property the day's logic reads. Checked before changing it: nothing in the app writes into live
  data in place.
- **No deep copy to read five fields** (`routes/TripShell.svelte:137`): the weather refresh took
  `$state.snapshot` of every stop — guide text and all — ~100 ms of a throttled cold start.
- **The metro line compiles its patterns once** (`logic/metroline.ts:215` `pattern()`), and skips
  them where they cannot match (a step with no clock, or no capital "NOT "): compiling a Unicode
  pattern costs ~1.2 ms, reusing one ~6 µs (measured in node, the same engine). The line's
  30 tests are unchanged.
- **No collator on a cold start** (`logic/dates.ts` `compareClock`, beside `compareIso`): six
  sorts compared clock times with `localeCompare` (the metro line's legs, the next commitment,
  To do's times, the route check's legs, the guide's two lists); the first `localeCompare` a page
  makes builds ICU's collator — ~25 ms (4×) inside Now's first render, the costliest single
  function left in it. Zero-padded `HH:MM` sorts by a plain comparison, identically (every one of
  the seeds' 64 times is zero-padded, and a time field writes that shape); an unpadded hour
  ("6:30") sorts as its padded self. Name sorts keep `localeCompare`, where collation matters.
  3 tests in `dates.test.ts` (including agreement with `localeCompare` on 216 times).
- **Play** was already smooth (every frame ~17 ms at 4×, none slower than 33 ms) and pauses with
  the app (a frame never advances more than 100 ms).

**Back-button layers.** Every sheet and overlay registers `router.pushLayer()` (a Sheet, Counter
mode, the driver card, the document viewer — audited: nothing else is a dialog or an overlay).
**The router has unit tests** — `src/tests/router.test.ts`, 21 tests on an in-memory session
history that keeps the HTML standard's order of events (a fragment navigation fires `popstate` at
once and queues `hashchange`; `back()` traverses in a later task): the session index stamped on
every entry and read back on back/forward (never restamped; an entry's own state kept), old names
rewritten in place, the `?d=` preview kept; `backOr` from a cold link, with history, back on the
first entry (the Run 3c bug), and after a sheet; layers stamped with their depth and place, back
closing the top one first, `closeTopLayer`, the veto (the layer, its entry and its place kept;
asked again next time), a link followed from inside a sheet; `backPast` over the delete walk,
onto an unrelated screen, cold on the guide (replaced), never past the session start, a step that
never comes (1.5 s), nothing gone. A mutation check (13 mutants of `router.svelte.ts` — each rule
the tests claim, broken on purpose in a temporary copy) killed 13 of 13. `router.svelte.ts` itself
is unchanged.

**Native.** `main.ts`'s Capacitor branch is untouched (no service worker, every cache dropped,
the update banner removed); `src/tests/native.test.ts` (3 tests) now pins it — the decision made
before mount, the branch's four steps, `registerSW` only in the browser, the banner's ids shared
with `index.html`. **The Android splash was not changed:** it is not a colour resource —
`AppTheme.NoActionBarLaunch` draws `@drawable/splash`, a bitmap at 25 densities generated by
`npm run android:assets` with `#000000` baked in (the only `#000000` colour resource,
`ic_launcher_background`, is the launcher icon's background, not the splash). Regenerating the
bitmaps with `#0B0C16` (edit the four colours in the `android:assets` script) — and, for the
Android 12+ system splash, a `windowSplashScreenBackground` colour on that theme — are for the
main session, which can build and look at an APK (Known issue 4).

### 4b+. An edit keeps what its form does not show (added to Run 4 by the coordinator)

**Found by the Map 5a builder:** saving a stop in the app deleted its spots and its options —
`stopSpec().fromValues` rebuilt the record from the fields the form shows plus a hand-picked
list. **The same flaw was in four more editors.** A new property test opens every record of all
three seeds in its editor and saves it unchanged; against the Run 3c editors it found:

| Editor | Lost on an unchanged save |
|---|---|
| stop | `spots` and `options` on 10 of the 11 China stops (every one that has them); the template's spots |
| day | `placeIds` on 24 of 27 China days — the "Places today" links |
| flight | `aircraft` (all 8 China flights); `stopId` (Israel, template) |
| stay | `stopId` (Israel, template) |
| train / activity / other | `groupLabel` (18), `alert` (8), **`alternative`** — the Nov 22 train, the "or else" of the Yantai flight, which keeps the route check from counting both —, a road leg's `from`/`to`/`duration`, `codeSub`, `priceNote`, `gmailQuery`; `stopId` |

**Fixed at the root** (`lib/components/forms/specs.ts`, the rule in its header): every
`fromValues` — all fifteen editors — starts from the record it edits (`...e`) and lays the form's
own fields over it, so any field the form has no input for survives, including ones a later trip
file adds (the Map track's place categories live inside `spots`). A field the form shows and the
user clears is still removed (written undefined; the database write drops it). The
train/activity/other editor can change a booking's kind: `keptFrom()` (`specs.ts`, above
`otherBookingSpec`) then drops only the old kind's own fields (`KIND_FIELDS` — a train's number
means nothing on an activity) and keeps everything shared. The hand-picked "carry it through the
edit" lists are gone; nothing else changed: the form's fields, its checks and its defaults are as
they were. Trips are edited with Dexie's `update` (a merge) and were never affected.

**Tests** — `src/tests/specs.test.ts`, 53: the unchanged-save property for every editor on every
seed (45 — a save still restamps `updatedAt`; a flight's alert toggle writes `false`, a stay's
blank Gmail search its title, a card's blank balance `null`), a field no form knows survives every
editor, renaming Zhangjiajie keeps its spots, options, blocks, budget, coordinate and photo, a
cleared field is removed, a new stop starts clean, a day keeps its place links, the Nov 22 train
stays the or-else with its group and ends, a road leg keeps its ends and duration, and a train
edited into an activity drops the train's fields and keeps the rest. **Run against the Run 3c
editors (a temporary copy read with `git show`), 19 of the 53 fail**; against the fix, 53 pass.
**Rehearsal** — "City guide · an edited stop keeps its options": the Zhangjiajie guide → edit
mode → Edit → the budget note changed → Save: the guide shows the same options and places, the
vault holds the same arrays, the note changed; then put back the same way (a second save, the same
proof).

### 4c. Rehearsal and docs

- **Rehearsal: 157/157 with the network hard off**, on the final build (Run 3c: 147; − 9 Light
  rows and + 6 night rows in 4a, + 12 in 4b, + 1 for the editor fix). New:
  the four a11y rows (names from the accessibility tree · targets ≥ 44 px · rings drawn and not
  clipped · one h1, no skipped level — each over 30 screens and 8 overlays, at 412 and at 384 px);
  Motion · Calm motion: nothing moves · reduce-motion: nothing moves · Route animations off:
  routes still, ambient loops breathe · a loop off the screen stands still (the Journey's Flow:
  paused, its `currentTime` frozen, running again in view) · the opal edge stops out of view ·
  the app hidden, everything paused (and back); Perf · Now is drawn once, whole; A11y · Tab
  brings each tile into view (384, real key presses); City guide · an edited stop keeps its
  options (4b+). Harness: `DOM`/`Accessibility` enabled for the name sweep.
- **Docs.** `docs/design/HORIZON.md` (new) — the implementer's reference: sources of truth, dark
  only, the tokens by role, where each component lives, white for other eyes, the IA and the
  layers, the four motion roles and their switches (with `data-offscreen`), lazy screens, the
  two-number bundle rule, the a11y floor, the performance rules, the gates. `LANTERN.md` carries a
  history banner. `docs/ARCHITECTURE.md` — dark only in §0, the repo layout, `Settings` without
  `theme`, the first render and the tested router in §5, the native branch in §8, Run 4 in §11.
  `FEATURES.md` — no row describes Daylight as current; the router tests, the off-screen pause
  and the a11y floor added.

### Gates at the end of Run 4

| Gate | Result |
|---|---|
| `npm run check` | 588 files, 0 errors, 0 warnings (+ scripts `tsc`) — Run 3c: 583 |
| `npm test` | **788 passed in 44 files** (Run 3c: 717 in 41): + 21 router, + 3 native, + 53 editors, + 3 clock order; the theme's 16 two-theme tests → 7 |
| `npm run build` | check · contrast **47 tokens match tokens.json (one palette), 86 pairs, 0 failures** · vite build (terser, settings unchanged; precache 34 entries, 981.38 KiB) · check:dist 50 built files (dist + the Android copy the last APK sync left) clean, both passport identifiers absent, 14 patterns · **bundle: initial load 186.40 KB gz of 200 (13.60 under), all app JS 206.85 KB gz of 260 (53.15 under)** |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `REHEARSAL_PORT=4177 npm run rehearsal` | **157/157** with the network hard off, on the final build |

### Left, and why

- The Android splash bitmaps are still `#000000` (above; Known issue 4).
- `app/scripts/e2e/perf.mjs` is run by hand (`node scripts/e2e/perf.mjs --dist before=… --dist
  after=…`); it is not wired into `npm` scripts, to keep `package.json` out of this run's diff.
- The plan's "second code review of Runs 3c + 4 before the APK" is the main session's step.

## Next — after Run 4

- **The main session:** the second code review of Runs 3c + 4 (done — Run 4b, above, fixed its
  findings), then a preview APK on the S23 (Runs 4 and 4b changed no native file). When it is next
  built, regenerate the splash bitmaps with the sky (`#0B0C16`) — Known issue 4.
- **Track B (the Map, `horizon-map`)** merges this `horizon` into its branch before building the
  Map tab's UI (plan §7), so 5c is built on the dark-only base: one palette in `app.css` (a new
  token goes in `:root` and in `system/tokens.json` — the contrast gate compares them, one value
  each), `use:offscreen` on anything that loops, `router.pushLayer()` for the place sheet, and the
  rehearsal's a11y sweep will include the Map tab once its URL is added to `FLOOR_SCREENS`.
- Still open from earlier runs: Known issues 10, 11, 14–16; the city's screen-reader list reads
  the pins in the map's own order.

## Map 5a — every place gets a verified pin, a category and one real line (MAP-5A.md) · DONE (2026-09-28)

Track B1, in parallel with Run 4. Worktree `C:\Source\China-map`, branch `horizon-map` (from horizon
afdcce5). **Data only** — no screen changed, and nothing in the app reads the new fields yet (Map tab =
step 5c). The audit, city by city and place by place, is `MAP-DATA.md` (generated from the data).

### What landed (file:line)

| Part | What | Where |
|---|---|---|
| Model | `PlaceCategory` (the eight) and three optional fields: `category`, `detail` (≤ 90 chars of the trip's own words), `pin` (WGS-84 — where the Map tab may *draw* the place; never a map target; only where `coord` is absent; the Map tab reads `coord ?? pin`) | `app/src/lib/model/types.ts:70–93` (the block), `:120` Spot, `:321` BookingBase, `:555` ShowCard |
| Lookups | `npm run verify:places`, the same dev-only script, extended: every answer cached on disk (`app/.cache/places`, git-ignored — `.gitignore:26`); the one-request-a-second rule enforced per service inside `get()` (`:252`, `:279`), and a service that answers 429 is slowed to one request per 5 s for the rest of the run, Retry-After honoured (Wikidata answered in bursts of ~10 then 429); Nominatim asked for five answers with every name, class, extent and its own Wikidata link (`:188`); Wikidata items read with all labels and aliases (`:311`) plus the items OSM objects link to, 50 to a request (`:630`); the pin pass (`:880`) and the stored-coordinate checks (`:995`); `PLACES_PINS=1` writes `pins.ts` and refuses to while any answer is missing (`:1058`). The button gate — its verdicts, addresses and exit codes — is unchanged | `app/scripts/verify-place-names.ts` |
| Rules | When an OSM answer may become a pin — seven rules, pure, unit-tested: the first of Nominatim's answers that IS the place (namesakes above it — a bus stop, a metro station, a motorway junction — skipped and named), name, radius, kind (`FITS` `:238`), no ambiguity (a road in pieces is one road), no contradiction (Wikidata's point on the answer's outline or within 0.5 km; a district point to point within 2 km), and past 25 km Wikidata must confirm | `app/scripts/china/pin-rules.ts:328` `decidePin` |
| Pin-only asks | The beds and the six driver cards without a coordinate, under the trip's own names, each anchored on an already-verified coordinate with a radius from the trip's own words (`PIN_ONLY` `:50`); tighter anchors where the trip's words give one — Macau on Senado Square, Sifang Square in Dayan, Huatian at the cableway (`PIN_ANCHORS` `:227`); five places held to their own kinds — the Macau ferry terminals are not the light-rail stop or bus terminus that share their names (`PIN_FITS` `:252`) | `app/scripts/china/pin-targets.ts` |
| The table | Generated: all 159 decisions with their evidence (OSM id, matched name, class, sources, km/limit, reason) and the 35 stored coordinates, measured | `app/scripts/china/pins.ts`; shape and writer `pins-format.ts:12`, `:43`, `:66` |
| Categories | The trip's words (`OVERRIDES` `:90`) → the tags of the PINNED answer (`categoryFromOsm` `:30`) → the entity's own kind; a driver card's own meaning (`CARD_KIND` `:57`) — never a button gate's first answer (后海's is its metro station) | `app/scripts/china/categories.ts` |
| Details | 181 lines picked by hand (`:26`), each proven verbatim against the entity's own text (`ownText` `:239`, `detailProblems` `:280`) | `app/scripts/china/details.ts` |
| Layer | Added last over the finished bundle, keys inserted after the entity's name so the seed's text diff is additions only (`addMapLayer` `:94`); the build's proof (`mapLayerProblems` `:155`) | `app/scripts/china/map-layer.ts`; hook `transform.ts:411`, `:1119`; `assert.ts:1162` |
| Pipeline fix | `readExtras` reads with `\n` line endings — a Windows checkout had been turning ten stops' paragraph breaks into `\r\n` on any rebuild | `app/scripts/china/inputs.ts:32` |
| Report | `MAP-DATA.md`, generated from the seed and `pins.ts` (`npx tsx scripts/map-data-report.ts`) | `app/scripts/map-data-report.ts` |
| Tests | `pinrules.test.ts` (17): CHAO Sanlitun, the bus stop, the petrol station, the estate, a namesake skipped, a hotel named after a temple, a road in pieces, a chain, the ferry terminal's own kinds, a contradiction (linked or named), a metro alias that cannot contradict, a lake's shore, a district point to point, far + one source, the category table. `mapdata.test.ts` (8): the build's proof; every pin inside its anchor's radius and exactly pins.ts's; the eight categories and every override applied; details verbatim; **only adds** (the trip built with and without the layer, field for field and in order); no map target changes; the seed on disk is the pipeline's own output; stored coordinates unchanged | `app/src/tests/` |
| Seed | Regenerated with `npm run seed-build`: 923 lines added, one removed — see "Found on the way" | `seed/china-2026.trip.json` |

### The numbers

**126 of 159 places the pass decided on are pinned** — 96 with two sources agreeing (OSM + Wikidata, mostly
the item the OSM object links to itself), 30 on one clean OSM answer inside the city; 33 by name only, each with
its reason. In the seed: **133 new pins** (121 spots, 5 beds, 7 tickets borrowing their spot's), every place
categorised (194 places + 15 movements), **181 details** (137 spots, 23 driver cards, 12 beds, 9 tickets).

| City | places | pinned (stored · new) | by name only | no pin, no button | food | spa | sight | show | hotel | transport | medical | shopping | with a detail |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kunyu Academy | 12 | 6 (0 · 6) | 4 | 2 | · | · | 10 | · | 2 | · | · | · | 10 |
| Beijing | 41 | 31 (7 · 24) | 8 | 2 | 3 | 4 | 22 | 3 | 2 | 5 | 1 | 1 | 40 |
| Chongli | 8 | 4 (1 · 3) | 2 | 2 | · | · | 6 | · | 1 | 1 | · | · | 8 |
| Zhangjiajie | 19 | 15 (5 · 10) | 3 | 1 | 1 | · | 13 | · | 2 | 3 | · | · | 18 |
| Chongqing | 21 | 20 (4 · 16) | 0 | 1 | 1 | 1 | 12 | 3 | 1 | 3 | · | · | 20 |
| Lijiang | 17 | 13 (2 · 11) | 3 | 1 | 2 | · | 12 | 1 | 1 | 1 | · | · | 16 |
| Tiger Leaping Gorge | 5 | 4 (1 · 3) | 1 | 0 | 1 | · | 3 | · | 1 | · | · | · | 5 |
| Dali | 15 | 13 (1 · 12) | 2 | 0 | 1 | · | 11 | · | 1 | 2 | · | · | 15 |
| Kunming | 11 | 8 (2 · 6) | 3 | 0 | 1 | · | 6 | · | 1 | 2 | · | 1 | 11 |
| Hong Kong (+ Macau) | 45 | 43 (1 · 42) | 2 | 0 | 6 | · | 23 | 4 | 1 | 10 | 1 | · | 38 |
| **All** | 194 | 157 (24 · 133) | 28 | 9 | 16 | 5 | 118 | 11 | 13 | 27 | 2 | 2 | 181 |

| Category | places | pinned | by name only | neither |
|---|---:|---:|---:|---:|
| food | 16 | 10 | 3 | 3 |
| spa | 5 | 2 | 2 | 1 |
| sight | 118 | 101 | 15 | 2 |
| show | 11 | 10 | 1 | 0 |
| hotel | 13 | 5 | 5 | 3 |
| transport | 27 | 25 | 2 | 0 |
| medical | 2 | 2 | 0 | 0 |
| shopping | 2 | 2 | 0 | 0 |

**Why the 33 got no pin** (all in MAP-DATA.md, with the OSM ids): OSM does not know the name (10 — six beds,
four driver cards); the right name on the wrong kind of thing (12 — bus stops, a bus station, motorway
junctions, a metro station, a courtyard house, a subdistrict, the ferry terminals' namesakes); past 25 km with one source (4 —
Changyu, **Jiuhua and Chunhuiyuan hot springs**, Blue Moon Valley); the sources disagree (3 — Chongli town and
Shangri-La, whose OSM points are district centres 7.7 and 12.7 km from their towns, and Huanglong Cave, whose
own Wikidata item sits 26.5 km away); ambiguous (2 — the chains 东来顺 and 四季民福: the trip names Donghuamen,
Dengshikou and Wangfujing, and the street their buttons search with came from OSM's own July answer, so it cannot
pick the branch); another place entirely (2 — 曲水兰亭 is still the Qingdao estate; the Naxi music hall's first
answer is now a bank). MAPS6's Beijing spa and hotel pins therefore stand at: Massage Hospital pinned; Jiuhua and
Chunhuiyuan by name only; Four Points and Blossom House unpinnable from OSM (neither is in it).

**The coordinates the trip already stored — 35 measured, 33 confirmed by a source, none changed.** The two left
to read by hand are the documented ones: card 11 is the Tianmen cableway's lower station while both sources
mark the summit 7 km up (map-links.ts says why), and card 24 is a street number on a 25 km road.

### Decisions (with reasons)

- **`pin`, not `coord`.** `coord` already drives three things on today's screens: the map button's fallback
  dot, a pin on the city close-up, and the day screen's nearest-first ranking of options. Filling it would have
  (a) given the buttonless beds a dot to open — breaking "a bed never ships a dot", which the seed build itself
  enforces (`assert.ts`) — (b) zoomed every city close-up out to fit Mutianyu, Penglai and Macau, and
  (c) re-ranked the day screen's options: UI changes this step may not make. `pin` is drawn, never opened, and
  exists only where `coord` does not. 5c decides, screen by screen, whether the close-up or the ranking should
  read it.
- **The first answer that is the place, not the first answer.** A button opens Nominatim's first answer, so the
  button gate reads only that; a pin claims where the place IS. 南锣鼓巷, 什刹海 and 王府井 all answer first with
  their metro stations, 昆嵛山国家森林公园 and 云南大学 with a bus stop, 金山岭长城 with a motorway junction.
  Namesakes are skipped and named in the reason; ambiguity and contradiction still apply to what is chosen.
- **Radius per city** = the radius the place's own button is already gated with (spots.ts `nearKm`, reasons
  beside each), from the stop's verified coordinate or the spot's own yardstick; past 25 km a pin also needs
  Wikidata. Tighter where the trip's own words say so: beds ("1.2 km to Taikoo Li" → 2 km from the Sanlitun
  card), Macau (10 km from Senado Square, not 75 km from Tsim Sha Tsui), Sifang Square (1.5 km of Dayan —
  Shuhe has its own 四方街 6.5 km away).
- **Driver cards take their category from their own meaning**, never from OSM: the answer a card's button gate
  reads is whatever ranks first (后海's is its metro station, which would have filed the lakes as transport).
- **Details are the trip's own words only.** MAPS6's example lines were used where they are verbatim; where
  they are composed ("Your bed 7–9 Dec — booked") the data carries the trip's line ("Closest base to Qinghe,
  where you leave from on Dec 9") and the UI can say the dates. Capitalising the first letter is the one liberty.
- **The Israel and template seeds were not regenerated.** Israel carries no spots. The template's two spots are
  a fictional sample with no lookup flow; the template authors spots as plain `Spot` fields, so the new fields
  are open to any future trip file. Trips with no categories (every trip built in the app) need the kind as a
  runtime fallback in 5c anyway.

### Found on the way (for the main session)

- **The committed seed carried a stale PDF size.** `documents[0].meta.size` said 162884 since the M1 commit of
  24 Jul, while the bytes embedded beside it are 161182 long — identical, byte for byte, to
  `sources/china-2026/China-2026-Flights.pdf`. Any `npm run seed-build` writes the true length, so the
  regenerated seed changes that one existing value (the only line the seed's diff removes). Nothing reads it.
- **The seed build depended on the checkout's line endings** — fixed (`inputs.ts:32`, above). Also: vite copies
  `app/index.html`'s line endings into `dist/index.html` (and the service worker's precache revision); this
  worktree's working copy was CRLF, so its working copy was given the LF git stores (no change to git) and the
  rebuilt `dist/` is byte-identical to the committed one.
- **Editing a stop in the app deletes its places and options** — pre-existing, on `main` too.
  `stopSpec().fromValues` (`app/src/lib/components/forms/specs.ts`) rebuilds the stop without `spots`,
  `options` or `addressInSearch`, and `saveEntity` puts it whole: save a stop's name or dates and its "All the
  options" blocks and every spot button are gone until the trip is re-imported. Not fixed here (an edit path,
  and Run 4 is restructuring these forms); the fix is to carry `e?.spots`, `e?.options`, `e?.addressInSearch`
  through, as the other specs already carry `coord`.
- **The edit forms would drop the three new fields.** The flight, stay, other-booking and driver-card specs carry
  `coord`/`mapQuery`/`address` through an edit but not `pin`/`category`/`detail`. Nothing reads them before 5c;
  5c should add them to those four `fromValues`.
- **The button gate flags one name today:** 大研纳西古乐会's first OSM answer is now a bank (招商银行丽江分行) —
  OSM changed since July; the name was phone-tested in Amap on 1 Aug. Reported, not demoted (this step changes
  no existing value).
- **The real LTD app on `main` imports the new file unchanged**: `parseBackupText` checks only the envelope
  (`app/src/lib/logic/backup.ts:12–16`, `:76–91` on main), `normalizeBundle` passes stops, bookings and cards
  through whole (`:19–46`), and `upsertTripBundle` `bulkPut`s the objects as they are
  (`app/src/lib/data/repo.ts:86–110`); Dexie indexes only ids, dates and kinds (`app/src/lib/db/db.ts:62+`), so
  the three fields are stored and ignored. Nothing on `main` reads a spot's, card's or booking's `detail`,
  `category` or `pin` (its option candidates' `detail` is parsed from the option line itself). The horizon app's
  own import is proven by the rehearsal, which imports this seed through the import sheet.

### For 5c (the Map tab)

- A place's position is `coord ?? pin`; its icon, colour and filter chip are `category`; its one line is
  `detail` (capital first letter already; no trailing period added). A ticket carries its spot's pin; a bed's pin
  is drawn, and its button still opens only what it opened before (its address, its name, or nothing).
- By name only: 28 places keep their button and have no position — list them ("opens by name") rather than
  placing them; 9 have neither (Blossom House; the academy — its bed and its driver card; 曲水兰亭; the three
  restaurant cards; Thaiwoo; the ski lesson) and are named only. The full list with reasons is in MAP-DATA.md.
- Nothing else reads `pin` yet: the city close-up and the day screen's ranking still read `coord` only. If 5c
  wants them to use pins, the close-up needs a rule for far places first (Mutianyu 61 km and the Ming Tombs
  42 km out of Beijing, Penglai 110 km from the academy, Macau 65 km from Tsim Sha Tsui would zoom it out).
- The edit forms must carry the three fields (and the stop form its spots and options) — see above.
- A re-run of the lookups is `PLACES_PINS=1 npm run verify:places` (seconds with the cache; ~35 min cold, most of
  it Wikidata's throttling), then `npm run seed-build` and `npx tsx scripts/map-data-report.ts`.

### Gates at the end of Map 5a

| Gate | Result |
|---|---|
| `PLACES_PINS=1 npm run verify:places` | the final pass: 750 answers from the cache, **0 over the network** (the cold run asked 353 Nominatim and ~400 Wikidata questions, never more than one a second per service); `pins.ts` written; exit 1 because the button gate flags 大研纳西古乐会 (above — reported, not demoted) |
| `npm run seed-build` | every assertion ✓, incl. "map layer: 209 places categorised, 133 new pins inside their radius, 181 details verbatim" |
| `npm run check` | 591 files, 0 errors, 0 warnings (+ scripts `tsc`) — baseline 583; the 8 are the two new test files and the six script modules they import |
| `npm test` | **742 passed in 43 files** — baseline 717 in 41; +17 `pinrules.test.ts`, +8 `mapdata.test.ts` |
| `npm run build` | check · contrast 47 tokens × 2 match tokens.json, 113 pairs × 2 palettes, 0 failures · vite build (precache 34 entries, 993.20 KiB) · check:dist 23 built files (this worktree has no Android assets copy; China-horizon's count includes one), no personal data, both passport identifiers absent, 14 patterns · bundle: initial load **186.08 KB gz** of 200, all app JS **206.49** of 260 — unchanged; `dist/` byte-identical to the committed one |
| `npm run verify:china` | 121 critical values + 84 structural facts, parity holds |
| `REHEARSAL_PORT=4178 npm run rehearsal` | **147/147** with the network hard off, on the final build — it imports this seed through the app's own import sheet |


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

## Handed over to Run 4 (written at the end of Run 3c)

*Run 4 (top of this file) did the dark-only removal and added the router's unit tests. Still open
from this list: the city's screen-reader list reads the pins in the map's own order; Known issues
10, 11 and 14–16.*

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
2. ~~Daylight~~ — removed in Run 4 (owner, 2026-09-28): the app is dark only, one palette, and a
   stored 'light' from an older install is ignored (the rehearsal boots one).
3. The latin subsets do not carry → (U+2192), ≈ (U+2248) or ₪ (U+20AA); they fall back to the
   system face, cleanly.
4. The Android splash/icon background is still `#000000` (`npm run android:assets`); regenerate
   the native assets when the APK is next built for review. Run 4 checked: the splash is a bitmap
   (`@drawable/splash`, 25 densities), not a colour resource, so it was left to that step — with
   `#0B0C16` in the script's four colour flags, and a `windowSplashScreenBackground` colour on
   `AppTheme.NoActionBarLaunch` for the Android 12+ system splash.
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
    own space ("… + CA / 8683 → Kunyu Academy" at 384 px). ~~The guide's spot rows' address-copy
    pills overflow the screen by 4 px at 384 px~~ — fixed in Map 5c: a row's ways to a map have a
    line of their own under its name.

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

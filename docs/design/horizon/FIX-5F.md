# Map 5f — fixes for the photos + fold (code review of 5e, 2026-09-29) [+ the design check, appended below]

Base: `horizon-map` at 6ddd9da (5e = cba4bb1 + main 4f919a5 merged). The review found no HIGH defect; the pack format,
importer, object URLs, licence data, EXIF stripping and offline guarantees hold. Fix all items; logic → vitest with the
failing case; flows → rehearsal rows that FAIL without the fix. Rules of MAP-5E.md apply.

## MEDIUM
1. **A second place opens part-way down** (`routes/Map.svelte:1034-1053`, `openPlace` :573-580): the `.m-sheet` scroll box is
   reused when `selected` changes A → B; nothing resets its scroll (focus uses preventScroll), so B opens with its photo and
   About scrolled away. Fix: reset the sheet scroll on a new place id (or `{#key selected.id}`), keep the scroll on the
   same place. Rehearsal: open A, scroll to Navigate, tap B → B at its top.
2. **The importer reads deep offsets of the PICKED file** (`lib/map/pack.ts:427` `checkWhole(file)` → metadata, trailer,
   index). On Android a picked file can be a non-seekable content stream (Google Drive files not held offline) → the import
   may fail where 5d's header-only check + sequential copy worked. Fix: on the picked file check ONLY the header (as 5d
   did), stream the copy, then run the full `checkWhole` on the SAVED copy (already at :455) before swapping it in; a failed
   full check deletes the copy and keeps the old pack. Test with a file object that throws on non-sequential reads.
3. **The Flickr photo's credit shows an internal id as its title** (`scripts/maps/photos/manifest.ts:128` →
   `placephotos.ts:183`, `PhotoCredits.svelte:49`): `cn26-spot-dali-jade-belt` reads "openverse:e4ac772e-…". Store the real
   title from the Openverse record (e.g. "Dali - Cangshan") in the manifest and show it (CC BY 2.0 §4(b)). Rebuild the pack.

## LOW
4. Today's / tonight's name tags cover the bottom of photo pins (`Map.svelte:432`, tag 20 px below centre vs photo rim 23.5,
   tonight's ring 26.5, today's halo 29) → offset by the pin's real radius at the current zoom.
5. The keep-off-the-pins geometry still assumes icon pins (`logic/wayfind.ts:317-320`, `Map.svelte:735`: 17 px) → use the
   photo-pin radius (23.5) and its name offset (~43 px) when photo pins are drawn.
6. Folding during a fling loses "keep the view" (`street/index.ts:780`) → defer through `api.setPadding(padding, keep)`.
7. The index accepts a CC BY photo with a blank author (`placephotos.ts:132`) → require a non-empty author unless CC0 / PD.
8. The photo index isn't matched to the trip (`Map.svelte:274-277`): the Israel trip with the China pack gets empty colour
   boxes on every rail card → no photos when `index.trip !== trip.id` (and no empty boxes then).
9. Landscape overflow (no orientation lock): the open "Near you" sheet (466 px) exceeds a landscape viewport (~390 px); the
   place sheet cap leaves ~180 px under a 292 px photo → cap both to the viewport (smaller photo band in landscape) or lock
   portrait in the Android manifest; decide, test at 915×412, say which.
10. The rail re-sorts right after "Show places" when sorted around the map's middle → don't re-sort on the fold's own
    padding change (sort only on real camera moves / new fixes).
11. Screen readers never hear the credit on the card / in Guide me (`PlaceSheet.svelte:103`, `GuideMe.svelte:99`: the
    button's aria-label replaces it) → include the credit in the accessible name (or a separate text node).
12. The Wikipedia text licence link depends on a photo sharing it (`placephotos.ts:234`) → count the About texts' licence
    too.
13. Dead / test-only code: `scripts/maps/photos/_about.ts`, `_cands.ts`, `_first.ts`, `_list.ts`, `_search.ts` (scratch —
    remove or move under a clearly dev-only name), `photoPinAt` (make the style's zoom rule and the test use ONE source),
    unused `focusOf` and `liveUrls`, two different exports named `photoPinImage` (rename one).
14. The `S.photos` strings and the three new glyphs sit in the start-up bundle (~0.5 KB gz) though only the lazy Map /
    Settings use them → move them into the lazy chunks.

## Rules
GIT: read-only only; work only in `C:\Source\China-map` (+ read-only `scratchpad/photomock/`, `fid5e/`). No adb/APK. The
rebuilt photo pack goes to `app/.cache/maps/` (report its new size + SHA-256). Never write the owner's name or any passport
number; never read `~/.ltd-private/*`; don't edit `app/scripts/privacy/`, `check-dist-clean.ts`, the signing block. Keep
`app/index.html` LF. Gates green with real numbers (check, test, build: start-up ≤ 200 · all app ≤ 260 · map engine ≤ 470,
verify:china, `REHEARSAL_PORT=4178` rehearsal). PROGRESS.md: a "Map 5f" section. Stop cleanly at a part boundary.

## Design fidelity (Sonnet, 2026-09-29): 5e vs the mockup at 412 + 384, the real photo pack, Dec 8 Houhai / Dec 23 Central
15. **HIGH — the floating nav covers the end of the place sheet's content on first view** (A, both widths): with 5e's
    About + "Text · CC BY-SA 4.0" + the longer links row, the sheet's last ~90 px sit BEHIND the fixed pill nav — at 412
    the "Google Maps"/"Amap" chips are cut with a stray "Maps" fragment beside the nav; at 384 the About's last line is
    cut ("d harv…"). Scrolled to the end it clears. Cause: `.m-sheet { max-height: calc(100dvh - 210px - env(safe-area-
    inset-top)) }` (Map.svelte ~1835) reserves the map band at the top but nothing for `NavBar.svelte`'s fixed `.navbar`
    (bottom 16 px, height 64 px, z 60). Fix: the sheet's scroll area must end above the nav (bottom padding / max-height
    including the nav + safe-area), so no content is ever hidden under it at any scroll position. Check every sheet on the
    Map tab (place, Guide me, filters, list) the same way. Evidence: scratchpad `fid5e/shots/real/412-A-top.png`,
    `384-A-top.png`, `384-A-longcredit.png`, `compare/A-412.png`, `A-384.png`.
16. **MEDIUM — an off-screen "place N km away" edge chip covers a photo pin's name** (E, Hong Kong Central z15.5, 412): the
    pin left of "Kau Kee" is unlabelled under the "Dragon'… 10.4 km ↗" chip. Keep edge chips clear of drawn pins and their
    names (use the photo-pin geometry of item 5), or drop a chip that would cover one. Evidence:
    `fid5e/shots/real/412-E-hongkong-z15_5.png`, `compare/E-412.png`.
17. LOW (optional): the full-screen viewer's empty band above/below a landscape photo can read as "not loaded" — a quiet
    caption area (title + credit) under the photo, or a subtle frame, if cheap. Everything else (targets ≥ 44 px, credits,
    the fold, the credits page) checked clean.

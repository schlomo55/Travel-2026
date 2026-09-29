# Map 5d — fixes for the Map tab (code review of 5c, 2026-09-29) [+ the design-fidelity review, appended below]

Base: `horizon-map` at 8a8db44 (Map 5c committed). Fix every item; logic → vitest (with the failing case the review
found); flows → rehearsal rows that FAIL without the fix. Keep the brief rules of MAP-5C.md.

## HIGH
1. **"Add to my day" writes wrong data** (`routes/Map.svelte:523-542`). On 8 Dec it is offered for 70 places in OTHER
   cities (a pick for 8 Dec with Kunyu's `stopId` then shows under Beijing's "Planned"), for places already in the day
   (Temple of Heaven, Dong Lai Shun → twice), and on a travel day it writes a pick DayView never shows
   (`DayView.svelte:305/377`). Fix: offer it only with DayView's own candidate rule (`DayView.svelte:139`: today's stop,
   a non-travel day, not already in the day) — reuse that logic, don't copy it.
2. **Compass heading wrong whenever the phone is near flat with any roll** (`logic/wayfind.ts:116-135`): the formula is the
   W3C back-of-device vector. Facing north it reports 56° (β2 γ−3), 34° (β15 γ−10), 350° (β30 γ5). Fix: heading from
   `360 − alpha` corrected by the screen-orientation angle while the phone is near flat, blending to the back-vector only
   as the phone comes upright; handle screen rotation (or portrait-lock the activity and say so). Tests with γ ≠ 0, β
   near 0 and near 90, and each screen angle; the rehearsal row must use γ ≠ 0.
3. **A stale GPS fix is shown as current** (`map/locate.svelte.ts:74-91, 139-149`): leaving the tab / hiding the app keeps
   `fix` + `state='on'`; `fix.at` is never read. Fix: on attach/resume, a fix older than ~30 s is stale — don't draw it
   as YOU, don't measure rings / Near you / Guide me from it; show "Finding where you are…" until a fresh fix. Test +
   rehearsal (a fix, leave, come back later → no stale YOU).

## MEDIUM
4. **Guide me's primary button ignores territory** (`components/map/GuideMe.svelte:77-81`, `platform/maps.ts`
   `openAmapRoute`): 38 Hong Kong/Macau places get "Find it in Amap — works in mainland China without a VPN" (the app's own
   `isAmapTerritory` rule sends exactly these to Google; `geo.ts:228-240`), and the Israel trip gets an Amap route to Israel.
   Fix: choose the primary with `isAmapTerritory`; outside the mainland Google is primary and the VPN line goes.
5. **"The map could not start" crashes the screen** (`lib/map/street/index.ts:376-380`, `Map.svelte:251,269-270,301-312`): a
   throwing `new maplibregl.Map()` (no WebGL) still resolves; `street.map` is undefined; `placeMarkers` / `setPins` throw
   in effects (no `<svelte:boundary>` anywhere). The context-loss rebuild has the same hole. Fix: `openStreetMap` rejects
   when the first build fails; every API method guards `map`; assign `street` only on success; show the designed
   fallback (pins/list still usable). Test with a forced failure.
6. **Scroll no longer resets on in-app navigation** — a side effect of the `live.svelte.ts` fix (the old "Loading…" flash
   used to reset it implicitly; only Pocket and Stop reset scroll themselves). Now scrolled down → Journey opens at the
   old offset. Fix in `TripShell`: on a FORWARD navigation to a different screen/sub-screen, scroll to top (keep the
   existing restore-on-back behaviour, e.g. the guide's scroll after a pass). Rehearsal row: scroll Now, open Journey →
   at top; back → Now at its old offset.
7. **Guide me shows a distance it can't stand behind** (`Map.svelte:677`): the leg label shows "x km" with a rough fix
   and "0 km" under 50 m. Fix: only when `away(selected)` is non-null, via `distanceText`.

## LOW
8. No engine-start timeout (`index.ts:470-475`): v6's module worker failing in the WebView = "Opening the map…" forever.
   Add a timeout → `failed` (and the fallback of item 5).
9. The follow effect cancels its own zoom (`Map.svelte:428-437`): it writes `following`, which it reads → re-runs → its
   `panTo` cancels the `flyTo`. Untrack the write.
10. `mapTab.unavailable` never shown: with location services off, "Show where you are" silently does nothing → show it.
11. Pass "Show on map" skips the `alternative` check (`Pass.svelte:304`) → use the same rule as `drawnIds`/`mapPlaces`.
12. Import error text can be wrong (`pack.ts:314`, `swapIn` outside the try) + a second concurrent import is possible when
    leaving and returning mid-import (the busy flag is per component) → move busy to module state; make the message true.
13. List order under a rough fix (`PlaceList.svelte:38`): non-transitive comparator → rows with a distance first (by
    distance), then the rest by name.
14. Rounding: `distanceText(995)` → "≈ 1000 m", `accuracyText(990)` → "≈ 1000 m", 99.95 km → "≈ 100.0 km" → switch unit at
    the rounded value (≈ 1 km, ≈ 100 km). Tests.
15. Back button mislabelled after "Show on map" (`Map.svelte:506,721`): it says "Back to the map" but returns to the
    guide/pass/Find — label it by the real origin (the router knows `prev`).
16. Rehearsal network row may miss a worker's first requests (`rehearsal.mjs:105`, `waitForDebuggerOnStart: false`) →
    attach with `waitForDebuggerOnStart: true` and resume, so "nothing asked off this machine" is complete.
17. Dead code: `clusterSpoken`, `clusterCategory`, `clusterAria`, `youAria`, `SHOW_ALL`, `goMap`, `api.resize`,
    `mapTab.unavailable` (after item 10, if still unused), Journey's `'route'` anchor branch → remove (or use).

## Rules
GIT: read-only only in `C:\Source\China-map`. Work only there (+ read-only scratchpad `mapspike/`, `fid5c/`). No adb, no APK.
Zero runtime network. Privacy rules as always; don't touch `app/scripts/privacy/`, `check-dist-clean.ts`; keep
`app/index.html` LF. Gates green with real numbers: check, test, build (start-up ≤ 200, all app ≤ 260, map engine ≤ 470),
verify:china, `REHEARSAL_PORT=4178` rehearsal. PROGRESS.md: a "Map 5d" section. Stop cleanly at a part boundary.

## Design fidelity (Sonnet, 2026-09-29): boards vs the real Map tab at 412 + 384, full pack, Dec 8 at Houhai
Everything matched the boards or one of the 23 documented deviations, except:
18. **MEDIUM — the heading cone.** The board's YOU has a crisp directional beam (`map4-map.dc.html`, `url(#m4mCone)`); the real
    `.m-cone` (`routes/Map.svelte:~1074`) is a soft radial gradient centred on the dot and reads round, not directional.
    Match the board's beam (shape + gradient). Evidence: scratchpad `fid5c/shots/compare/map.png`,
    `fid5c/shots/real/412-map-heading.png`.
Main-session observations from the builder's own shots (LOW polish; fix if cheap and clean):
19. A ring's distance label can sit under a cluster badge (412-map: "250 m" hidden by "+3"; 412-place: "+4" over "250 m") →
    place ring labels where no pin/cluster covers them (e.g. choose the free side of the ring), or draw them above clusters.
20. The scale + attribution box at the bottom-left covers pins (412-map: the Beihai Park pin under it) → include the box
    in the map's camera padding / make it compact, so it never hides a pin at rest.

# Horizon — nothing is lost

Every feature the Lantern app had on 2026-09-27, where it lives in Horizon, and
the run that builds it there. Kept current by each run (plan §1: "Nothing is
lost").

**Status words**

- **Built** — rebuilt in the Horizon design in the run named.
- **Bridged** — the Lantern component, re-skinned by the Horizon tokens only,
  reachable at its new address so every intermediate build is a whole app. The
  run named rebuilds it.
- **New** — did not exist in Lantern.

Old deep links all resolve: `today → now`, `itinerary[/stop] → journey[/stop]`,
`wallet → pocket`, `wallet/<booking> → pocket/<booking>` (the pass),
`wallet/spend → pocket/money`, `tasks[/packing|lists] → now/todo[/…]`,
`info → pocket`, `map → journey (route)`, `stats → journey (stats)`,
`docs → pocket/docs`. The address bar is rewritten to the new name without a
history entry (`logic/routes.ts`, 23 tests).

## App shell

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Five-tab pill (Home · Plans · Wallet · Lists · Info) | Nav bar: Now · Journey · Pocket + round Find | 1 | Built |
| Trip bar (trip name, visa pill, edit toggle) | App bar: sun mark → all trips, trip + day, status pill → Pocket › Visa, edit toggle | 1 | Built |
| Sheets close on Android back (layer stack) | Unchanged — every sheet, Counter mode and the driver card call `router.pushLayer()` | 1 | Built |
| `?d=YYYY-MM-DD` date preview + full-width warning strip | Unchanged strip; the app bar pill goes dashed-warn while previewing | 1 | Built |
| Update banner (`#sw-update/#sw-reload/#sw-dismiss`), native SW branch | Unchanged ids, Horizon style | 1 | Built |
| Toasts | Horizon toasts | 1 | Built |
| Empty states (one per surface) | Horizon empty state: icon ring, one line, one action | 1 | Built |
| "Trip data unreadable" banner | Unchanged, Horizon style | 1 | Built |
| Theme: dark default + light, applied before first paint | Horizon night (default) + Daylight; same mechanism (`theme.ts`, boot script, `ltd:theme`) | 1 | Built |
| Calm motion | Calm motion (all motion to end states) | 1 | Built |
| — | Route animations switch (default on) + `calm / no-routes / app-hidden` classes | 1 | New |
| — | The motion system, once, in `src/lib/motion/`: FLOW on the live leg (the only loop; still = a solid leg + arrowhead), INK (the road so far paints itself once a day, remembered per trip/day/legs done; a leg finished with Done inks once; a tap skips it), COMET (a tap on Now's map flies the live leg once, flash on arrival), RELAY (sweep plan + action + CSS, for Journey); all to end states under Calm motion / reduce-motion / Route animations off, all paused while the app is hidden | 2 | New |
| — | The map engine: `logic/projection.ts` (real coordinates, north up, one scale, a real-latitude grid), `logic/constellation.ts` (legs done / today / ahead / not booked, the live leg, YOU and TONIGHT, labels with the Yunnan-cluster rule), `logic/citymap.ts` (city scale for Run 3, "No pin yet" list, exits as bearings), drawn by `lib/map/TripMap.svelte` | 2 | New |
| Fonts: Fraunces, Instrument Sans, IBM Plex Mono, Caveat, Special Elite | Unbounded, Figtree, Martian Mono (latin, variable) | 1 | Built |

## Trips shelf, wizard, import, backup, Drive, Settings

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Shelf sections Active / Upcoming / Past / Archived | Trips shelf (f-trips), same sections | 1 | Built |
| Cover photo or golden-hour scene per trip | The trip's route as a constellation from real stop coordinates (Run 2: drawn by the map engine — first stop, YOU, TONIGHT and the last stop named, never overlapping); else the cover photo; else ridges at sunrise | 1 | Built |
| Battery day meter | "Day X of Y", progress line with the sun, "Tonight: …", "N days to go" | 1 | Built |
| Trip menu: edit, archive/unarchive, delete (export first, two taps) | Same menu sheet (`.tc-menu`) | 1 | Built |
| Start a new trip → wizard | "Start a new trip" door → wizard sheet; names the trip-brief route (docs/NEW-TRIP.md) | 1 | Built |
| Import a trip | "Import a trip" door → import sheet | 1 | Built |
| Backup nag when stale | Backup card always on the shelf; amber when stale | 1 | Built |
| Across every trip (trips, days away, spent per currency, days by year) | Same card, Horizon style | 1 | Built |
| Wizard: name, subtitle, emoji, dates, home currency, trip colour | Same fields, Horizon form | 1 | Built |
| Import: file, pasted text, old China app backup, staged preview, replace warning | Same, Horizon sheet (`.filebtn input[type=file]` kept) | 1 | Built |
| Backup screen: save vault, copy as text, one trip, restore, storage + protection, clear vault | Same screen with a sub-header (‹), Horizon tiles | 1 | Built |
| Drive backup card (unconfigured / disconnected / connected, versions, restore) | Same card, Horizon tile; still buttonless when unconfigured | 1 | Built |
| Settings: theme, calm motion, weather + last fetch, preview a date, storage, about | Settings (f-settings): Appearance · Weather · Backup · This trip · Preview · Storage · About | 1 | Built |
| — | Settings: Route animations, Drive status row, one-tap Save, This trip (export, archive) | 1 | New |

## Now (was Home and Lists)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Home: photo hero | Now's home is the map (f-now); tonight's stop photo rides on the TONIGHT tile | 2 | Built |
| Home: day caption "Day X of Y", day stepping ‹ ›, swipe, long jump by the title | Now › the day (`now/day`): the stepper ‹ Thu 10 · Fri 11 Dec / Day 21 of 37 · Sat 12 ›, the centre opens the long-jump sheet (every date, its place, today marked); a sideways swipe steps; all drive the `?d=` preview | 2 | Built |
| Visa card (loud on exit day, a door) | Now › VISA tile (ring with the day, exit date; warn/crit tone; "Entry day — the count starts tomorrow" on the day you cross) → Pocket › Visa | 2 | Built |
| Next commitment hero (countdown, copyable reference) | Now › NEXT tile — the one opal card: the sun on its arc (real time only), the countdown in minutes, the route, the status → the pass, whose code strip copies the reference | 2 | Built |
| Runbook steps (tick by tapping the text) | Now › the day, a travel day: every step, tickable by its text (44 px ring), copy for long references; ONE Focus card for the current step, pinned above the nav, with its driver card and Done (a write) | 2 | Built |
| Tonight row (booked / no bed / in transit) → its card | Now › the day (tonight row, same four states) and Now › TONIGHT tile → the city | 2 | Built |
| Places today chips (geo: intents) | Now › the day | 2 | Built |
| Timeline, free blocks, picks, "all N options" → guide | Now › the day, an ordinary day: the day line (lilac), the free blocks with the stop's own options (+ / in the day), the rain / too-tired row, "All N options" → the guide; what you picked, with its provenance | 2 | Built |
| Weather chip, snow, offline chip, Anytime list | Weather on Now's header and the day's header (an icon, not an emoji; "weather from …" when old); snow over Now's map; the offline chip on Now's sheet; Anytime on the day | 2 | Built |
| Next deadline card, next timed moment card | Now › TO DO tile (the first open thing from today, and how many earlier ones are still open) and To do | 2 | Built |
| Lists: To do + ring, deadlines, alarms (.ics) | Now › To do (f-todo): to-dos, alarms and bookings still to buy folded into their days; everything past in Earlier; "N coming up"; tick = write; alarms tick when they are in the phone calendar, and the .ics export puts them there; edit mode adds and edits | 2 | Built |
| Packing + ring + add button | Now › To do › Packing: the sun arc as progress, groups, add, templates (save / apply) | 2 | Built |
| Checklists | Now › To do › Checklists: the sun arc, each list, ticks that survive the write | 2 | Built |
| — | Map-first Now home: the constellation (road so far inked, the live leg Flowing with its booking on a chip, you pinging, tonight in opal), the Concierge sentence (`logic/concierge.ts`), glance tiles NEXT · TONIGHT · VISA · DRIVER CARD · TO DO (no NOW tile) | 2 | New |
| — | The travel day as a metro line generated from the day's bookings (`logic/metroline.ts`): last night's bed → every end of every leg → tonight's bed; a flight as an arc; transfers dashed with "see step N"; times lifted only where a step ties them to a place | 2 | New |

## Journey (was Plans and half of Info)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Info › Journey overview — the route map | Journey (`#route`): the constellation from the map engine, each stop not fully booked wearing Relay's ring (the same coverage as the rows), a leg ahead with nothing held dotted amber. Replaces the Lantern RouteMap (deleted) | 2 | Built |
| Info › Journey overview — stop rows with coverage chips | Journey (`#route`) | 3 | Bridged |
| Info › Trip statistics | Journey (`#stats`) | 3 | Bridged |
| Plans: stop bands, coverage chips, connectors, map pills, photo bands, runbooks | Journey › Every stop (Itinerary, embedded) | 3 | Bridged |
| City guide (getting there & money, story, booked, day by day, options, eat & see, spots, jump bar) | Journey › a stop | 3 | Bridged |
| Stop / plan / runbook editing | Same editors on the bridged screens | 3 | Bridged |
| Replay scrubber, relay coverage sweep, city close-up map | Journey | 3 | New (Run 3) |

## Pocket (was Wallet, Spending, Documents and the rest of Info)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Wallet › Travel / Stays / Experiences | Pocket › Travel · Stays · Experiences (rows) | 1 | Built |
| Booking card (stamp, code strip, PIN line, chips, note, find email, manage, maps, booking link) | The pass (f-pass), `pocket/<booking>`, `id="bk-<id>"` | 1 | Built |
| — | Counter mode: full screen, white, max contrast, wake lock | 1 | New |
| Wallet › Cards (passport-free wallet cards, balance) | Pocket › Cards (+ Counter mode) | 1 | Built |
| Wallet › Money: what's already committed, groups, unpriced tallies, either/or leg | Pocket › Money (ledger behind one tap) | 1 | Built |
| Spending: budget chips as filters, log expense, rates, by day, detail, where it went, daily burn, CSV | Pocket › Money | 1 | Built |
| Info › Visa / compliance clock | Pocket › Visa (`#compliance`) | 1 | Built |
| Info › Document vault (files, photos, viewer, hand-off) | Pocket › Documents | 1 | Built |
| Info › Driver cards (full-screen overlay, address copy) + "Maps in China" hint | Pocket › Show the driver + the white driver card | 1 | Built |
| Info › Phrases | Pocket › Phrases | 1 | Built |
| Info › Emergency | Pocket › Emergency (and the SOS link on Pocket home) | 1 | Built |
| Info › Converter (offline, provenance) | Pocket › Converter | 1 | Built |
| Info › Health & insurance | Pocket › Health | 1 | Built |
| Info › Info cards | Pocket › Good to know | 1 | Built |
| Info › Notes | Pocket › Notes | 1 | Built |
| Info › Clocks | Pocket › Clocks | 1 | Built |
| Edit mode + SchemaForm sheets (bookings, cards, driver cards, emergency, info cards, counters) | Same editors, Horizon form; edit toggle in each sub-header | 1 | Built |

## Find

| Feature | Horizon home | Run | Status |
|---|---|---|---|
| — | Find: one offline index over bookings, driver and phrase cards, runbook steps, stops, spots, tasks, info cards, emergency numbers, wallet cards, documents and the trip note; warnings first (the Capital-vs-Daxing card and what to do instead); `logic/find.ts`, 21 tests | 1 | New |

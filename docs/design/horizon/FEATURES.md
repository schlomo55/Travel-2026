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

Since Run 3 nothing is bridged: every Lantern feature below is Built (or New) in the Horizon design.

Old deep links all resolve: `today → now`, `itinerary[/stop] → journey[/stop]`,
`wallet → pocket`, `wallet/<booking> → pocket/<booking>` (the pass),
`wallet/spend → pocket/money`, `tasks[/packing|lists] → now/todo[/…]`,
`info → pocket`, `stats → journey (stats)`,
`docs → pocket/docs`. The address bar is rewritten to the new name without a
history entry (`logic/routes.ts`). Lantern's `map` link opens the Map tab again since Map 5c (it
went to the Journey's route section until then).

## App shell

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Five-tab pill (Home · Plans · Wallet · Lists · Info) | Nav bar: Now · Journey · Pocket + round Find | 1 | Built |
| Trip bar (trip name, visa pill, edit toggle) | App bar: sun mark → all trips, trip + day, status pill → Pocket › Visa (the counter's own word, "VISA 19/30"; the whole name is its accessible name — Run 3b), edit toggle | 1 | Built |
| Sheets close on Android back (layer stack) | Unchanged — every sheet, Counter mode, the driver card and the document viewer call `router.pushLayer()`. Since Run 3c every history entry knows its place in the session (`history.state.i`), so a screen's ‹ goes back only where the app has been, and deleting a stop from its own guide closes the sheet, then steps back past the stop's pages to the Journey — never "Stop not found", never a stuck back press. Since Run 4 the router has unit tests of its own (the session index, `backOr`, `backPast`, the veto). Since Run 4b a close followed by a move waits for the close to land — Edit trip's wizard stays open, Create and Import land on the trip — a booking deleted from its own pass lands on its list, and a sheet that unmounts hands its layer back (the day's long jump left one behind) | 1, 3c, 4, 4b | Built |
| `?d=YYYY-MM-DD` date preview + full-width warning strip | Unchanged strip; the app bar pill goes dashed-warn while previewing | 1 | Built |
| Update banner (`#sw-update/#sw-reload/#sw-dismiss`), native SW branch | Unchanged ids, Horizon style | 1 | Built |
| Toasts | Horizon toasts | 1 | Built |
| Empty states (one per surface) | Horizon empty state: icon ring, one line, one action | 1 | Built |
| "Trip data unreadable" banner | Unchanged, Horizon style | 1 | Built |
| Theme: dark default + light, applied before first paint | The night sky only — Daylight removed by the owner on 2026-09-28: one palette, nothing to choose or store, no boot script; a `theme: 'light'` an older install stored is ignored (the rehearsal boots one) | 1, 4 | Built |
| Calm motion | Calm motion (all motion to end states); since Run 3c a control that only moves a route (the city's ↻) is not offered under Calm motion, Route animations off or the phone's reduce-motion, and the guide's way back up does not glide; since Run 4 the rehearsal proves it on every screen that loops (nothing runs under Calm motion or reduce-motion; Route animations off leaves only the ambient loops) | 1, 3c, 4 | Built |
| — | Route animations switch (default on) + `calm / no-routes / app-hidden` classes | 1 | New |
| — | The motion system, once, in `src/lib/motion/`: FLOW on the live leg (the only loop; still = a solid leg + arrowhead), INK (the road so far paints itself once a day, remembered per trip/day/legs done; a leg finished with Done inks once; a tap skips it), COMET (a tap on Now's map flies the live leg once, flash on arrival), RELAY (sweep plan + action + CSS, for Journey); all to end states under Calm motion / reduce-motion / Route animations off, all paused while the app is hidden — and, since Run 4, any loop scrolled out of view (`offscreen.ts`) | 2, 4 | New |
| — | The accessibility floor on every screen and overlay, at 412 px and at the S23's 384 px: every control named (from Chrome's accessibility tree), every target ≥ 44 px, a focus ring that is drawn and not clipped, one h1 and no skipped heading level — swept by the rehearsal | 4 | New |
| — | The map engine: `logic/projection.ts` (real coordinates, north up, one scale, a real-latitude grid), `logic/constellation.ts` (legs done / today / ahead / not booked, the live leg, YOU and TONIGHT, labels with the Yunnan-cluster rule), `logic/citymap.ts` (city scale: pins, the "No pin yet" list, exits as bearings; since Run 3 also the stay's hops, the pins' words laid out so none covers another, the scale bar, and the city as a constellation), drawn by `lib/map/TripMap.svelte` — for the city too since Run 3 | 2 | New |
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
| Wizard: name, subtitle, emoji, dates, home currency, trip colour | Same fields, Horizon form; its code loads the first time the sheet opens (Run 3c) | 1 | Built |
| Import: file, pasted text, old China app backup, staged preview, replace warning | Same, Horizon sheet (`.filebtn input[type=file]` kept); its code loads the first time the sheet opens (Run 3c) | 1 | Built |
| Backup screen: save vault, copy as text, one trip, restore, storage + protection, clear vault | Same screen with a sub-header (‹), Horizon tiles; loads the first time it opens (Run 3c) | 1 | Built |
| Drive backup card (unconfigured / disconnected / connected, versions, restore) | Same card, Horizon tile; still buttonless when unconfigured | 1 | Built |
| Settings: theme, calm motion, weather + last fetch, preview a date, storage, about | Settings (f-settings): Appearance (Calm motion, Route animations — no theme since Run 4) · Weather · Backup · This trip · Preview · Storage · About; loads the first time it opens (Run 3c) | 1, 4 | Built |
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
| Timeline, free blocks, picks, "all N options" → guide | Now › the day, an ordinary day: the day line (lilac), the free blocks with the stop's own options (+ / in the day), the rain / too-tired row, "All N options" → the guide; what you picked, with its provenance. A plan line is timed when its clock leads it (after its emoji, "~" kept) or closes its short lead-in ("First entry ~07:30 · …", "Sunset ~17:45 — …") — Run 3b; a place's hours ("Temple closes 17:00", "Open daily 09:00") are never a moment of the day, and a range ("10:00 – 12:00") holds its whole span — Run 3c | 2 | Built |
| Weather chip, snow, offline chip, Anytime list | Weather on Now's header and the day's header (an icon, not an emoji; "weather from …" when old); snow over Now's map; the offline chip on Now's sheet; Anytime on the day | 2 | Built |
| Next deadline card, next timed moment card | Now › TO DO tile (the first open thing from today, and how many earlier ones are still open) and To do | 2 | Built |
| Lists: To do + ring, deadlines, alarms (.ics) | Now › To do (f-todo): to-dos, alarms and bookings still to buy folded into their days; everything past in Earlier; "N coming up"; tick = write; alarms tick when they are in the phone calendar, and the .ics export puts them there; edit mode adds and edits | 2 | Built |
| Packing + ring + add button | Now › To do › Packing: the sun arc as progress, groups, add, templates (save / apply) | 2 | Built |
| Checklists | Now › To do › Checklists: the sun arc, each list, ticks that survive the write | 2 | Built |
| — | Map-first Now home: the constellation (road so far inked, the live leg Flowing with its booking on a chip, you pinging, tonight in opal), the Concierge sentence (`logic/concierge.ts`), glance tiles NEXT · TONIGHT · VISA · DRIVER CARD · TO DO (no NOW tile) | 2 | New |
| — | The travel day as a metro line generated from the day's bookings (`logic/metroline.ts`): last night's bed → every end of every leg → tonight's bed; a flight as an arc; transfers dashed with "see step N"; times — and since Run 3b a station's own "NOT …" warning, in warn amber, the whole name it rules out since Run 3c ("NOT Beijing South"; a shouted status is no warning) — lifted only where a step ties them to a place | 2 | New |

## Journey (was Plans and half of Info)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Info › Journey overview — the route map | Journey › Replay (`#route`, f-journey): the constellation for the playhead's day — the road so far inked, the day's leg Flowing, legs ahead dotted (amber where nothing is held), YOU and TONIGHT where that day puts them; the stops the route check flags wear Relay's ring and light with their rows. Replaced the Lantern RouteMap in Run 2 | 2, 3 | Built |
| — | Replay: **Play** (a day a leg is walked holds while a Comet flies it and paints it behind itself, every other day passes quickly, it ends back on today; pressed again it pauses, and goes on from there), **‹ ›** one day, a **drag scrubber** over every day of the trip with its stop and move bars, **the visa window** as a bar under it from `counters.ts` ("19 / 30" on Dec 11, the exit ticked, "Exit by 22 Dec" → Pocket › Visa), "Back to today" (which stops Play — Run 3c); the day, the hour and where that day is spent ("Chongli → Zhangjiajie", "Flights in") under the map. Play's name says what a press will do ("Replay my trip from 21 Nov", "Resume the replay", "Play from 12 Dec"); the route check's rings stay on the map, hidden, while it plays. Play, Pause, the scrubber and Back to today are one state machine (`playback`, Run 3c). `logic/replay.ts`, 21 tests | 3, 3c | New |
| Info › Journey overview — stop rows with coverage chips | Journey › **Route check**: every stop (its beds) and every move (its legs) in trip order, the rail lit up to tonight; the **Relay** sweep (`lib/motion/relay.ts` + `relayPlan()`) lights them once, pausing amber on what is not booked and longer red on a bed missing ahead, and ends on the count ("7 legs to book · 1 bed missing" before the trip, "3 legs to book" on Dec 15). A move is today from its first leg's day to its last's (the way in is today on 22 Nov, not done), and the flights home are found when the last stop ends after the trip does (Israel, template) — Run 3c. A stop row → its city. `logic/routecheck.ts`, 12 tests | 3 | Built |
| Plans: connectors (the moves, "then", the fallback, the gap) | Journey › Route check › a move row: its legs in the order you travel them, "then" between the parts, "or instead" before a fallback, a move nothing covers says so in words; each leg a door to its pass | 3 | Built |
| Plans: stop bands and their coverage chips | Journey › Route check › a stop row: dates, nights, TONIGHT, the bed chip ("Booked", "Walk-in", "N nights pending", "Bed missing · 22 Nov") | 3 | Built |
| Plans: map pills, photo bands | The guide: the stop's photo is its hero; its "Open in Maps" pill is in Getting there (and a compact one in the hero) | 3 | Built |
| Plans: runbooks, add a stop, add a day (edit mode) | Journey in edit mode: add a stop, add a day, the runbooks (add / edit) — one editor sheet | 3 | Built |
| Info › Trip statistics | Journey (`#stats`): days, stops, nights, the stop-to-stop distance (a straight line, and it says so), spent, bookings held, packed; → Pocket › Money for the detail | 3 | Built |
| — | **A city** (`journey/:stopId`, f-city), from `logic/citymap.ts`: the stop at real positions, north up, with a scale bar — a pin only where the trip file stores a coordinate (Zhangjiajie West, Qinghe and the park spots have none), everything else under "No pin yet" (+N opens the guide's list), a pin's booking line naming its booking and that booking's own status ("Sat 12 / ticket pending" — Run 3b), the map laid out in the phone's own pixels, the way on as a bearing at the map's edge with its date and whether it is booked; the stay walked hop by hop (the live hop Flows; on its first opening a Comet per hop replays it, and ↻ replays it again); the guide at half height — its kicker, title, budget, dates and nights, a chip per chapter, **Read the guide**; the scale switch Trip · Today · City. Since Run 3c a pin that holds more than one booking names the one it speaks for by its own title, and a screen reader reads the map as a list — every pin with its words and its booking's line, and the way on with its status | 3 | New |
| City guide (getting there & money, story, booked, day by day, options, eat & see, spots, jump bar) | **The guide** (`journey/:stopId/guide`, f-guide) — an Edition long read that Android back closes onto the city: the photo hero with the city's name, a standfirst in the page's own voice ("Three nights · Fri 11 → Mon 14 Dec · two in the park, one in the city" — Run 3b), then numbered chapters — Getting there & money (the warning, the prose — a line's "fallback(s):" clause in its own amber callout since Run 3b — the budget, the itemised costs, the map pill) · The story (a drop cap, a pull quote in its own words) · Booked (beds, flights and tickets, each → its pass; what is still to buy) · Day by day (the plan at a glance; each day with its weather, its places and its bed) · the stop's other blocks · All the options (our picks ⭐) · Places (every spot, its map button); every "verify" set as a flag; back to the top. The jump bar's chips are the city sheet's chapter chips, each opening the guide at its chapter (the guide takes the chapter once it is drawn — Run 3c). Since Run 3c: a flight whose fare the file records elsewhere shows no price line (never "price not recorded"); the close button says where it goes (the map, Find, Now…); coming back from a pass reopens the guide where it was left | 3 | Built |
| Stop / plan / runbook editing | The guide in edit mode (toggled in its hero): edit or delete the stop (a delete returns to Journey, with undo; one back press then goes where you were before — Run 3c), add a day, edit or delete a day, add / replace the stop photo; add a stop, add a day and the runbooks on Journey | 3 | Built |
| City guide ⇪ (copy the place, offline) | The guide's hero: copy the place's name and address | 3 | Built |

## Pocket (was Wallet, Spending, Documents and the rest of Info)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Wallet › Travel / Stays / Experiences | Pocket › Travel · Stays · Experiences (rows) | 1 | Built |
| Booking card (stamp, code strip, PIN line, chips, note, find email, manage, maps, booking link) | The pass (f-pass), `pocket/<booking>`, `id="bk-<id>"` — since Run 3b a lit pass wears its opal edge with the perforation's notches cut into it, the airports' names short under the codes (whole in its accessible name), and a flight pass offers the vault's flight manifest ("E-ticket · Flight manifest (PDF)") — a document whose name carries flight numbers only on those flights' passes (Run 3c) | 1 | Built |
| — | Counter mode: full screen, white, max contrast, wake lock | 1 | New |
| Wallet › Cards (passport-free wallet cards, balance) | Pocket › Cards (+ Counter mode) | 1 | Built |
| Wallet › Money: what's already committed, groups, unpriced tallies, either/or leg | Pocket › Money (ledger behind one tap) | 1 | Built |
| Spending: budget chips as filters, log expense, rates, by day, detail, where it went, daily burn, CSV | Pocket › Money | 1 | Built |
| Info › Visa / compliance clock | Pocket › Visa (`#compliance`) | 1 | Built |
| Info › Document vault (files, photos, viewer, hand-off) | Pocket › Documents | 1 | Built |
| Info › Driver cards (full-screen overlay, address copy) + "Maps in China" hint | Pocket › Show the driver + the white driver card; the Pocket's three chips carry the place's short name ("Beijing Daxing (PKX)" — `shortPlaceName()`, Run 3b; only the airport words that end a name go, never to nothing — Run 3c), the whole meaning their accessible name | 1 | Built |
| Info › Phrases | Pocket › Phrases | 1 | Built |
| Info › Emergency | Pocket › Emergency (and the SOS link on Pocket home) | 1 | Built |
| Info › Converter (offline, provenance) | Pocket › Converter | 1 | Built |
| Info › Health & insurance | Pocket › Health | 1 | Built |
| Info › Info cards | Pocket › Good to know | 1 | Built |
| Info › Notes | Pocket › Notes | 1 | Built |
| Info › Clocks | Pocket › Clocks | 1 | Built |
| Edit mode + SchemaForm sheets (bookings, cards, driver cards, emergency, info cards, counters) | Same editors, Horizon form; edit toggle in each sub-header. Since Run 4 an edit keeps every field its form does not show (a stop's spots and options, a day's place links, a booking's "or else" flag, group, stop and rail ends — before, saving a stop deleted its options and places). Since Run 4b a map target follows the place it was built from: a flight moved to another airport, a driver card retyped, a stay renamed or a ticket's new venue no longer opens the old place, and the button searches the new name | 1, 4, 4b | Built |

## Find

| Feature | Horizon home | Run | Status |
|---|---|---|---|
| — | Find: one offline index over bookings, driver and phrase cards, runbook steps, stops, spots, tasks, info cards, emergency numbers, wallet cards, documents and the trip note; warnings first (the Capital-vs-Daxing card and what to do instead); `logic/find.ts`, 21 tests | 1 | New |

## Map (Map 5c)

| Feature | Horizon home | Run | Status |
|---|---|---|---|
| — | The Map tab (map4-map): the trip's places as typed pins on a night street map drawn from OpenStreetMap data kept on the phone (the map pack, imported once — Settings › Map pack and the tab's own empty state; no pack: the pins, you and the rings on the night canvas); search, category chips with counts, the filters sheet (every category, your beds or all hotels, the rings), you with your heading and accuracy, the rings at 250 m · 500 m · 1 km, "Near you" nearest first, and the list | 5c | New |
| — | A place's sheet (map4-place): its category, name and Chinese, the trip's own line, a straight-line distance and bearing from your real position with a mini radar, Navigate, the driver card, Google Maps, copy the address, Add to my day (the day screen's pick) | 5c | New |
| — | Guide me (map4-go), offline: you and the place in view, the live leg, a compass made true by the WMM declination, and the hand-off — turn-by-turn in Amap (GCJ-02), Google Maps, the driver | 5c | New |
| — | "Show on map" from the guide's places, the day's places, a pass and Find — wherever the map draws the place | 5c | New |

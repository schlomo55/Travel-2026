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
| Fonts: Fraunces, Instrument Sans, IBM Plex Mono, Caveat, Special Elite | Unbounded, Figtree, Martian Mono (latin, variable) | 1 | Built |

## Trips shelf, wizard, import, backup, Drive, Settings

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Shelf sections Active / Upcoming / Past / Archived | Trips shelf (f-trips), same sections | 1 | Built |
| Cover photo or golden-hour scene per trip | The trip's route as a constellation from real stop coordinates; else the cover photo; else ridges at sunrise | 1 | Built |
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
| Home: photo, day caption, day stepping ‹ ›, long jump by the title | Now › The day | 2 | Bridged |
| Visa card (loud on exit day, a door) | Now › The day → Pocket › Visa | 2 | Bridged |
| Next commitment hero (countdown, copyable reference) | Now › The day → the pass | 2 | Bridged |
| Runbook steps (tick by tapping the text) | Now › The day | 2 | Bridged |
| Tonight row (booked / no bed / in transit) → its card | Now › The day → the pass | 2 | Bridged |
| Places today chips (geo: intents) | Now › The day | 2 | Bridged |
| Timeline, free blocks, picks, "all N options" → guide | Now › The day | 2 | Bridged |
| Weather chip, snow, offline chip, Anytime list | Now › The day | 2 | Bridged |
| Lists: To do + ring, deadlines, alarms (.ics) | Now › To do | 2 | Bridged |
| Packing + ring + add button | Now › To do › Packing | 2 | Bridged |
| Checklists | Now › To do › Checklists | 2 | Bridged |
| Map-first Now home (map, glance tiles, concierge sentence), travel-day metro line | Now | 2 | New (Run 2) |

## Journey (was Plans and half of Info)

| Feature (Lantern) | Horizon home | Run | Status |
|---|---|---|---|
| Info › Journey overview (route map, stop rows with coverage chips) | Journey (`#route`) | 3 | Bridged |
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

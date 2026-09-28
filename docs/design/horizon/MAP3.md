# Round 3 — THE MAP, EXPLORED (the owner's favourite: "I like the map and the animation on the routes")

Start from the Map as built: `project/m-open.dc.html` (read it first — reuse its constellation drawing,
lat/long dot grid, colours, labels and, above all, the ROUTE ANIMATION the owner liked:
today's leg drawn with the sunrise→pink→lilac gradient + flowing dashes (`@keyframes dashflow{to{stroke-dashoffset:-56}}`,
`stroke-dasharray:7 7`, 2.4s linear infinite, glow drop-shadow), the `ping` ripple + `sunrise` glow on the current
position, `twinkle` on the finale). Keep HORIZON.md's look. Facts: CONTENT2.md + CONTENT3.md only.
Every board: a 412×915 phone screen unless stated; no emoji; refs masked; reduced-motion kill switch.
Animations are the point of this round: make them smooth, purposeful, and loop gracefully (CSS keyframes;
`offset-path: path('…')` + `offset-distance` keyframes is allowed for things moving along a route).

## Boards (files `mx-*.dc.html`)

1. **mx-motion.dc.html — "Route motion · four styles" (880×915, not a phone).** Four equal panels (2×2), each
   animating the SAME route Beijing → Chongli → Zhangjiajie (with the Beijing/Chongli/Zhangjiajie stars and their
   small-caps labels), each titled + one plain line of what it means:
   - **Flow** — the current one: dashes streaming along the leg in the travel direction (baseline).
   - **Comet** — a bright head travels the route leaving a fading tail (a short dash + long gap animated, plus a
     blurred copy for the glow), loops every ~3 s.
   - **Ink** — the route paints itself like a brush stroke (stroke-dashoffset from full length to 0 over ~2.5 s,
     a thicker soft under-stroke + a crisp top stroke), holds, fades, repeats — a nod to Chinese ink painting in sunrise colours.
   - **Relay** — the stops light one after another and each leg fills in sequence (staggered animation-delay),
     like a signal passed along the route.
   Panel background = the sky (#0B0C16) with the dot grid; panel titles in Unbounded 18px; explanatory line Figtree 13px #B4B3C8.

2. **mx-replay.dc.html — Journey: "Replay the trip".** The constellation map on top; at the bottom a TIME SCRUBBER
   from 21 Nov to 27 Dec (37 day ticks, stop segments coloured along it, labels for a few dates), the playhead at
   Fri 11 Dec (day 21). The route is drawn only up to the playhead (lit), a comet at today's position on the
   Chongli → Zhangjiajie leg, the future dotted lilac. Above the scrubber a slim **visa bar**: 23 Nov → 22 Dec,
   19 of 30 lit, exit tick "22 Dec 24:00" (planned exit 21 Dec). A round **Play** button ("Replay my trip") and a
   caption "Drag to travel in time". (Animate: the comet moving along today's leg; the playhead glow pulsing.)

3. **mx-tiles.dc.html — Map + glance tiles.** The constellation map fills the top ~55 %; the bottom sheet (peek
   height, grabber) holds a horizontally scrolling row of glance tiles: NEXT CA 8609 · in 5h 13m (sun arc, opal
   edge) · NOW HSR Taizicheng → Qinghe · not booked (amber) · VISA 19/30 ring · TONIGHT Pullman (photo) · DRIVER CARD
   北京大兴国际机场. Under the tiles: the 3-place nav + Find.

4. **mx-brief.dc.html — Map + the Concierge notes.** Map on top with a circular **zoom lens** (magnifier) over the
   Beijing area showing today's hop: Taizicheng station (real: 40.9125 N 115.4418 E) → Daxing PKX (real: 39.5092 N
   116.4106 E), the path labelled "via Qinghe" (Qinghe has no stored coordinate — never draw it as a pin). The sheet
   holds the plain-sentence notes (wording in CONTENT3.md, Concierge q-open), the NOW note (amber) visibly linked to
   the flowing segment in the lens (same colour, a thin connector line or matching glow).

5. **mx-today.dc.html — "Today as a metro line".** A schematic (NOT geographic) transit-map line for Fri 11 Dec,
   top to bottom or snaking: Element · Chongli (checked out — done) → 太子城站 Taizicheng (HSR ~1 h, NOT booked, into
   Qinghe by ~14:30 — amber dashed) → 清河站 Qinghe → (metro or taxi ~1.5 h — verify) → 北京大兴国际机场 Daxing PKX
   ("be there by ~16:45 — not Capital") → CA 8609 18:15 → 20:30 (booked — the line becomes a flight arc) →
   张家界荷花国际机场 DYG → (~40 min) → 武陵源 Wulingyuan · Pullman ≈21:30 (booked). A "you" marker (sun + ping) just
   past Element at 13:02; the next segment flows (dashflow); done segments solid; future dim. Station labels in
   English + Chinese; times on the right like a timetable. Tapping a station would open its driver card (show one
   station's chip "Driver card").

6. **mx-city.dc.html — Zhangjiajie at city scale.** A city-scale constellation from REAL coordinates (projected,
   north up, 11.7 px per km; place the band in the middle of the screen):
   Wulingyuan · park gate (Pullman nearby) x=116 y=0 · Tianmen cableway (Huatian 450 m away) x=40 y=305 ·
   DYG Hehua airport x=0 y=320 (DYG–Wulingyuan 29 km, DYG–Tianmen 3.7 km, Wulingyuan–Tianmen 27 km).
   Zhangjiajie West station has NO coordinate — draw it only as an off-map arrow on the west edge near the city:
   "HSR to Chongqing · Mon 14 · from Zhangjiajie West · not booked".
   The stay's legs animate in order (flow/comet): Fri 11 DYG → Wulingyuan (~40 min, arrive ≈21:30) · Sun 13
   Wulingyuan → the city (~40 min) · Mon 14 Tianmen 08:00 (ticket pending) → off-map west. Park spots (Yuanjiajie,
   Tianzi, Yangjiajie, Golden Whip Stream) have NO coordinates — list them in the sheet, never as pins.
   Bottom sheet at half: "Zhangjiajie · 3 nights · Fri 11 → Mon 14 Dec", day chips (Fri 11 · Sat 12 · Sun 13 ·
   Mon 14) with Sat 12 selected showing "07:30 Golden Whip Stream valley walk · stone-step ascent (~2 h) to
   Yuanjiajie · sunset ~17:45 — off the steps in daylight", and a "Read the guide" button.

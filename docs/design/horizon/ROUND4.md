# ROUND 4 — THE APP, SCREEN BY SCREEN ("Horizon · Map-first")

The owner chose **Map + glance tiles** as home and delegated the rest ("do what you think is best for the
travel / cooler for UI"). This round draws the whole app in that direction, dark theme first (+ a light preview).
Frozen moment: **Fri 11 Dec 2026, 13:02** (unless a screen says otherwise). Look: `HORIZON.md`. Facts: `CONTENT2.md`,
`CONTENT3.md`, `MAP3.md` and THIS file only. Never invent a fact; refs masked `•••• •••• •••• ••••`; no emoji.
**Never show the owner's name, any passport number, or the "I have a reservation, the name is …" phrase.**

## Source-of-truth boards to build from (read the ones your screens need)
- Map + tiles home → `project/mx-tiles.dc.html` · metro day → `project/mx-today.dc.html` · city close-up →
  `project/mx-city.dc.html` · replay → `project/mx-replay.dc.html` · counter mode / pocket → `project/m-pocket.dc.html`
  · Concierge wording → `project/q-open.dc.html` · Edition craft → `project/e-city.dc.html` · Deck big card → `project/d-next.dc.html`.
  Reuse their drawing and components; improve, don't restart.

## Information architecture (final)
- Nav everywhere (except full-screen modes): **Now · Journey · Pocket** + round **Find** button (recipe in HORIZON.md).
- **Now** = the map + glance tiles (home) → travel day (metro line) / ordinary day (day line) / To do.
- **Journey** = Replay the trip + every stop with its coverage → a city → its guide.
- **Pocket** = everything to show someone or need offline in one tap: today's code, passes, driver cards, phrases,
  documents, visa, emergency, converter, insurance. Full-screen **Counter mode** and **Driver card**.
- **Find** = offline search across bookings, cards, steps, places, notes.
- **Borrowed ideas**: Concierge sentence = the one plain-English "what to do now" line on Now; Deck = one big
  **Focus card** for the current step on travel days (and the full-screen modes); Edition = the city guide's reading
  style (headline, drop cap, pull quote, chapters). The Sundial's full dial is NOT used (it would compete with the
  metro line) — only its sun-arc progress survives (already in Horizon).

## Motion system (the owner loves the route animation — every route motion has ONE job)
- **FLOW = live.** The leg you are on or the next segment: flowing dashes (`stroke-dasharray:7 7`, dashoffset loop
  2.4 s linear). The ONLY looping route animation on a screen.
- **COMET = moving through time.** Replay playback; tapping a leg/tile that focuses the map sends a comet along that
  leg once (≈1.2 s, ease-out) with a flash on arrival.
- **INK = done.** When a leg or day is completed, that leg brush-paints itself once (≈2.5 s) in warm ink and stays
  painted — the map slowly becomes a painting of where you have been. First open of the day: the travelled route
  inks in once (skippable).
- **RELAY = check.** Opening Journey runs one status sweep along the route: stops light in order — green = booked,
  it pauses amber on a leg not booked, red on a missing bed — and ends on a count ("7 legs still to book").
- Rules: at most one looping + one one-shot animation at a time; never animate text; **Calm motion** (setting) and
  reduced-motion → static end states (Flow = solid highlighted leg with an arrowhead). Only transform / opacity /
  stroke-dashoffset; pause when the app is hidden.

## Screens — files `f-*.dc.html`, 412×915 unless stated
### Group A · NOW
1. **f-now** — Home. Map (from mx-tiles) with today's leg in FLOW + ping on you; sheet at peek with, on top, the
   Concierge line: "Next: the train to Qinghe — not booked yet. Be in Qinghe by about 14:30." (chevron → f-travelday),
   then the tile rail: NEXT CA 8609 · in 5h 13m (sun arc, opal edge) · NOW HSR Taizicheng → Qinghe · not booked ·
   TONIGHT Pullman Zhangjiajie · booked · VISA 19/30 · DRIVER CARD 北京大兴国际机场 · TO DO Book 重庆1949 · Sat 12 Dec.
2. **f-travelday** — Fri 11 Dec as the metro line (from mx-today) + a big **Focus card** (Deck style) pinned above
   the nav for the current step: "Step 2 of 8 · NOW — HSR Taizicheng → Qinghe (~1 h) · not booked · into Qinghe by
   ~14:30", buttons [Driver card · 太子城站] [Done]. Header: "Travel day · The Daxing flight · 1 of 8 done".
3. **f-day** — an ordinary day: **Sat 12 Dec · "Zhangjiajie on foot"** as a day line (schematic):
   First entry ~07:30 · Golden Whip Stream valley walk → Stone-step ascent (~2 h) to Yuanjiajie + the Avatar Hallelujah
   pillars — on foot, not the elevator → a **FREE block "after the ascent, until sunset ~17:45"** with 3 pickable
   options (real): ⭐ "Tianzi Mountain late in the afternoon — the pillar sea with low sun, and on a good day the fog
   sits below you" · "Shili Gallery monorail in Suoxi Valley — ten minutes under the pillar wall, almost no effort" ·
   rain / too tired: "Golden Whip Stream — the flat 7 km valley walk, the right call when the tops are in cloud"
   (each with ＋ Add) → "Sunset ~17:45 — be off the steps in daylight" → Dinner: ⭐ 唐师傅湘西名菜馆 Tang Shifu Xiangxi,
   Wuling Road, ~¥70pp — 湘西三下锅 sanxiaguo · or 毛氏小馆 Mao's Small House, ~¥59pp. A food note: "Carry breakfast
   and lunch up — in-park food is poor and dear; Pullman's breakfast is included (and is for two)." Tonight: Pullman · booked.
   (Don't draw a map for this day: park spots have no coordinates. The line is schematic.)
4. **f-todo** — "To do", folded into time. Coming up: Sat 12 Dec — "Book 重庆1949 for the Dec 15 evening — Klook or
   Trip.com" · Sun 13 Dec 09:00 (alarm) — "Last free day to cancel Yue Tu Inn (Tina's bus + bag)" · Mon 14 Dec —
   "Tianmen Mountain 08:00 — ticket pending (Huatian offered to book it)". Today, done: 11:00 "Check out by 12:00 —
   then Qinghe → DAXING, NOT Capital". A collapsed row "Earlier · 26 tasks" (don't claim done or not). A card
   "Packing list · 30 items" → Pocket. Tasks show on their day in Now too.

### Group B · POCKET
5. **f-pocket** — Pocket home. Top: TODAY — Air China CA 8609 · booking •••• •••• •••• •••• · [Counter mode] [Pass].
   Then sections: **Wallet** (Travel 15 · Stays 12 · Experiences 11 · Cards 3 — cards are "Passport — the only one used
   for China", "Kunyu Academy — deposit paid", "Travel insurance — PHOENIX Smart"; NO numbers) · **Driver cards 28**
   (chips: 北京大兴国际机场, 太子城站, 武陵源) · **Phrases 7** (请带我去这里 "Please take me here", 请写下来 "Please write it
   down", 微辣 "Micro-spicy") · **Documents** (Flight manifest — all seats, e-tickets, terminals · PDF, + 10 place photos)
   · **Visa 19/30 · exit by 22 Dec** · **Emergency** (110 police · 120 ambulance · 119 fire · 999 Hong Kong & Macau ·
   French Embassy Beijing +86 10 8531 2000 · "Insurance 24h line — add after purchase") · **Converter**
   (1 USD = ¥7.15 · HK$7.8 · €0.92 · ₪3.4 — "rates from your trip file").
6. **f-pass** — the CA 8609 pass (successor of the luggage tag, drawn as a Horizon pass): Air China · CA 8609 · Booked ·
   PKX Beijing Daxing → DYG Zhangjiajie · Fri 11 Dec 2026 · 18:15 → 20:30 · 2h 15m · warning "Departs DAXING (PKX) —
   not Capital" · Checked 20 kg (amber) · Cabin bag 5 kg · Changed 27 Sep · $0 · "Airline PNR •••••• — pre-change,
   verify" (amber) · booking no. masked · Booked via Trip.com · actions [Counter mode] [Find email] [Manage] [Open in maps].
7. **f-counter** — COUNTER MODE full screen, for a stranger at the desk: pure white ground, near-black text, huge
   masked code in Martian Mono, "AIR CHINA · CA 8609", "Beijing Daxing (PKX) → Zhangjiajie (DYG) · Fri 11 Dec · 18:15",
   "Booking no.", a small "Screen at full brightness" note and a big [Close] (44px+). No nav.
8. **f-driver** — DRIVER CARD full screen: white ground, 北京大兴国际机场 as large as fits (system Chinese font), under it
   "Beijing Daxing International Airport (PKX)", the phrase 请带我去这里 "Please take me here", buttons [Open in maps]
   [Copy] and ‹ › to the other cards ("3 of 28"), [Close]. Deliberately plain, like today's driver overlay.

### Group C · JOURNEY + CITY
9. **f-journey** — Replay (from mx-replay: map, scrubber, visa bar, comet) on top; below it the RELAY sweep result as
   a stop list with coverage (stops = beds; legs = moves), sweep frozen mid-way: Kunyu Academy — Yantai · 23 Nov → 5 Dec
   · 12 n · **bed missing (Sun 22 Nov, Yantai)** red · move Yantai → Beijing (Sat 5 Dec) · **nothing booked** amber ·
   Beijing · 5 → 9 Dec · 4 n · beds booked · move Beijing → Taizicheng HSR (Wed 9 Dec) · not booked · Chongli · 9 → 11 ·
   2 n · booked · move Fri 11 · **part booked** (HSR not booked + CA 8609 booked) · **Zhangjiajie · 11 → 14 · 3 n ·
   booked · you are here** · move Mon 14 HSR → Chongqing · not booked … (the rest can run under the nav). Sweep summary
   chip: "7 legs still to book · 1 bed missing".
10. **f-city** — Zhangjiajie close-up (from mx-city: real coords only, legs in order, spots without coords only in the
    sheet, Zhangjiajie West as an off-map arrow) with the guide sheet at half: title, "Fri 11 → Mon 14 Dec · 3 nights ·
    2n park + 1n city · ≈$257", chapter chips (Getting there · The story · Booked · Day by day · Our picks · Where to eat),
    [Read the guide].
11. **f-guide** (412×1500) — the guide sheet pulled to full, Edition style: headline "Zhangjiajie", standfirst, chapter
    01 Getting there & money (Dec 11 eve: Beijing Daxing (PKX) 18:15 → Zhangjiajie 20:30, 2h15 (Air China CA8609), then
    ~40 min to Wulingyuan, in ≈21:30 · budget ≈$257), 02 The story (drop cap on "The sandstone pillars of Wulingyuan are
    what Avatar borrowed…", pull quote "fog that either steals the view or makes it — often both in one day"),
    03 Booked (Pullman $124 · Huatian $59 · CA 8609 $241 — booked; still to buy: park pass ¥165, passport real-name,
    valid 4 consecutive days · Tianmen Dec 14 — pending), 04 Our picks (the three ⭐ picks, real wording, shortened with
    "…"), 05 Where to eat (Tang Shifu Xiangxi ~¥70pp · Mao's Small House ~¥59pp · Tujia Old Kitchen ~¥88pp).

### Group D · SHELL
12. **f-find** — Find anything, query "daxing" typed (no keyboard drawn), results grouped: Bookings — Air China CA 8609
    · PKX 18:15 → DYG · Fri 11 Dec · booked · Driver cards — 北京大兴国际机场 Beijing Daxing International Airport (PKX) ·
    **warning card** — 北京首都国际机场 3号航站楼 Capital T3 (PEK): "NOT the Dec 11 airport any more — CA8609 leaves from
    Daxing (rebooked 27 Sep)" · Today's steps — "Cross to Daxing (PKX) — NOT Capital (PEK). Be at PKX by ~16:45". Chips
    for scopes (All · Bookings · Cards · Steps · Places). Line: "Searches this phone — no internet needed."
13. **f-trips** — the trips shelf (app launch): wordmark "Living the dream"; ACTIVE — **China 2026** · "Kung fu, powder &
    the south" · 21 Nov → 27 Dec · Day 21 of 37 · En route — its card is a mini constellation of its route lit up to
    Zhangjiajie (reuse the positions); [Start a new trip] (hint: "fill the trip brief — Claude builds it") · [Import a trip]
    · a "Save a backup" card · footer "Offline-first · your data stays on this phone".
14. **f-settings** — Settings: Appearance — Theme [Dark (default) · Light], Calm motion (off), Route animations (on);
    Weather — "Update the forecast when online (at most twice a day)" (on); Backup — Google Drive (not set up · Set up),
    [Save a backup file]; This trip — Export · Archive; About — "Living the dream · works offline · no account".

### Group E · SYSTEM
15. **f-motion** (880×915) — the motion system as a board: four live mini-demos on the same leg with their JOBS (FLOW =
    live, COMET = moving through time, INK = done, RELAY = check), one line each of when it plays, plus a strip "Calm
    motion" showing each one's static end state, and the rules (one loop + one one-shot at a time, never text, pause
    when hidden). Build on `project/mx-motion.dc.html`.
16. **f-now-light** — `f-now`'s composition in the LIGHT palette (below). Build from mx-tiles.
17. **f-city-light** — the city close-up in the LIGHT palette. Build from mx-city.

## LIGHT palette — "Horizon · daylight" (designed, not inverted)
sky #F5F1EA · sky-2 #EDE6DA · card #FBF8F3 · card-2 #F0EAE0 · line rgba(27,26,46,0.10) · edge #8A8398 ·
ink #1B1A2E · ink-2 #4A4760 · faint #6B6880 · sunrise TEXT #B8431A · sunrise FILL #FF9F6B with on-sunrise #1A0F08 ·
lilac text #6B4FD8 · ok #1F7A4D · warn #9A5B00 · crit #B42335 · opal edge linear-gradient(120deg,#F08A5D,#E0559A,#8C6CF0,#3FB6C9) ·
map: dot grid rgba(27,26,46,0.08), travelled route #E4572E→#D9468F glow rgba(228,87,46,0.35), future dotted #8C6CF0,
stars #1B1A2E with a sunrise halo · mountains #E9E2D6 / #E1D8CA / #D8CDBD with a low sunrise glow rgba(255,159,107,0.25).
Contrast ≥4.5:1 for all text on sky/card.

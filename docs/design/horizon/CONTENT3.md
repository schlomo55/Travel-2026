# Round 2b — FOUR MORE structures (same Horizon look, same 4 moments, same facts)

Read with: `HORIZON.md` (the look — exact recipes) and `CONTENT2.md` (all facts of Fri 11 Dec 13:02, the feature
rethink: Now · Journey · Pocket + Find, Pocket, Counter mode, lists folded into time). Use ONLY facts from
CONTENT2.md plus the extra facts below. Masked refs `•••• •••• •••• ••••`. No emoji. No invented weather.
For consistency of the nav and header as already built, you may read `project/d-open.dc.html` (one file only).

## Extra real facts (all from the trip file)
- Driver cards (Chinese, shown to a taxi driver): 太子城站 "Taizicheng Station" · 北京大兴国际机场 "Beijing Daxing International Airport (PKX)" · 张家界荷花国际机场 "Zhangjiajie Hehua Airport (DYG)" · 武陵源 "Wulingyuan — Zhangjiajie park gate".
- Alarm 11:00 today (done): "Check out by 12:00 — then Qinghe → DAXING, NOT Capital".
- Task due Sat 12 Dec: "Book 重庆1949 for the Dec 15 evening — Klook or Trip.com".
- Alarm Sun 13 Dec 09:00: "Last free day to cancel Yue Tu Inn (Tina's bus + bag)".
- Visa: 30-day visa-free, day 1 = 23 Nov, day 19 = today, day 30 = 22 Dec — hard deadline 22 Dec 24:00; planned exit 21 Dec (Kunming → Hong Kong, MU 733, booked).
- Trip: 37 days, 21 Nov → 27 Dec; today = day 21. Stops by date: flights out 21–22 Nov · Kunyu Academy 23 Nov–5 Dec · Beijing 5–9 · Chongli 9–11 · Zhangjiajie 11–14 · Chongqing 14–16 · Lijiang 16–18 · Tiger Leaping Gorge 18–19 · Dali 19–20 · Kunming 20–21 · Hong Kong 21–26 · flights home 26–27 Dec.

## Board layout
Each structure = four 412×915 boards, prototype-linked like the others (Now → x-open, flight → x-next,
Pocket → x-pocket, Zhangjiajie → x-city, back returns; Journey → `#`).

---

### S · THE SUNDIAL (files s-open, s-next, s-pocket, s-city)
Organizing principle: **the 24-hour dial IS the horizon.** A large circular day-dial fills the top half:
**noon at the top, midnight at the bottom, 06:00 on the left, 18:00 on the right** — so the horizontal
diameter is literally the horizon line (day above, night below), and the sun marker travels the ring like the
real sun. Angle for a time t (hours): θ = (t − 12) × 15°, measured clockwise from the top;
x = cx + r·sin θ, y = cy − r·cos θ.
Items on the ring today (draw as arcs/ticks at their real times):
- 11:00 alarm check-out reminder — done (dim tick) · ≤12:00 check out of Element — done (dim tick)
- 12:00–14:30 window: HSR Taizicheng → Qinghe (~1 h), "into Qinghe by ~14:30" — NOT booked → amber dashed arc
- 14:30–16:45 window: Qinghe → Daxing (~1.5 h), tick at 16:45 "be at PKX" — lilac arc
- 18:15–20:30 CA 8609 PKX → DYG — booked → thick sunrise arc with a plane glyph
- 20:30–21:30 transfer ~40 min to Wulingyuan (thin arc) · ≈21:30 Pullman (bed glyph)
- NOW 13:02 → the sun marker at θ ≈ 15.5°.
Centre of the dial: "5h 13m" (to CA 8609) + "Fri 11 Dec · Day 21/37". Swipe the dial sideways = previous/next day.
Journey = the dial zooms out into a **37-day trip ring** (stops as coloured arcs, today at day 21) with the
**visa window as an outer arc** from 23 Nov to 22 Dec (19 of 30 lit, the exit tick on 22 Dec).
- s-open: the day dial + under it the current step card (HSR → Qinghe, not booked, by ~14:30) and a two-line "Next".
- s-next: the dial focused on the flight arc (zoom/rotate so 18:15–20:30 is prominent), centre = countdown,
  below: the flight focus (PKX 18:15 → DYG 20:30, be at PKX by ~16:45 — not Capital, 20 kg + 5 kg, fallback, Show code).
- s-pocket: the dial "turns over" — its back face is the Pocket: today's code in the centre + Counter mode button,
  and the Pocket items as round buttons arranged around the ring (Wallet 15/12/11/3, Driver cards 35, Documents 11,
  Visa 19/30, Emergency 9, Phrases, Converter).
- s-city: Zhangjiajie — a round photo window inside a ring of the stay's days (11 arrive ≈21:30 · 12 on foot ·
  13 Tianzi + Yangjiajie → Huatian · 14 Tianmen 08:00 → HSR), then getting there / about / booked below.

### T · THE TILES — bento cockpit (files t-open, t-next, t-pocket, t-city)
Organizing principle: **a home made of live tiles** in a bento grid (2 columns, tiles 1×1, 2×1, 1×2, 2×2 — clear
hierarchy, 12px gaps, radius 28). Tap a tile → it grows into a full screen (shared-element feel). Long-press →
rearrange/pin (show an "Edit tiles" affordance). Tiles are designed so they could later become Android
home-screen widgets.
t-open tiles (in this priority):
1. 2×2 NEXT COMMITMENT: CA 8609 · in 5h 13m (sun arc) · "Be at Daxing by ~16:45 — not Capital" (opal edge)
2. 2×1 NOW (amber): HSR Taizicheng → Qinghe · not booked · into Qinghe by ~14:30
3. 1×1 VISA ring 19/30 · exit by 22 Dec
4. 1×1 TONIGHT with the Zhangjiajie photo: Pullman Zhangjiajie · booked · ≈21:30
5. 1×1 DRIVER CARD: 北京大兴国际机场 big, "Show the driver"
6. 1×1 DEADLINE: "Book 重庆1949 for Dec 15 evening" · due Sat 12 Dec
7. 2×1 TRIP: Day 21 of 37 bar with stop ticks · "$6,402 of $7,500 committed"
8. 2×1 TOMORROW: Sat 12 Dec · 07:30 Golden Whip Stream · sunset ~17:45
(Not everything must fit above the nav — let the grid run under it.)
- t-next: the NEXT tile expanded full-screen (flight focus + the 8 steps with step 2 current), other tiles shrunk into a strip.
- t-pocket: the Pocket as a wall of tiles: CA 8609 code tile (Counter mode), driver-card tiles (4 real ones above),
  Documents 11, Emergency 9, Wallet segments, Phrases, Converter.
- t-city: Zhangjiajie as a bento: big photo tile, 3 nights tile, budget ≈$257 tile, getting-there tile, booked tiles
  (Pullman $124 · Huatian $59 · CA 8609 $241), STILL TO BUY tile (Forest Park pass Dec 12–13 · Tianmen Dec 14 —
  pending, amber), places tile (4 names with Chinese).

### E · THE EDITION — a daily magazine (files e-open, e-next, e-pocket, e-city)
Organizing principle: **every day is an edition.** Edition number = trip day (today = No. 21). Swipe sideways =
yesterday's / tomorrow's edition; Journey = the archive of 37 covers. Editorial hierarchy: masthead, kicker,
huge headline (Unbounded), standfirst, numbered short paragraphs, boxed sidebars, pull quotes, drop caps,
generous margins. Calm, beautiful, readable.
- e-open: the COVER of No. 21: masthead "Living the dream" · "No. 21 · Friday 11 December 2026"; full-bleed
  Zhangjiajie photo; headline "The Daxing flight"; standfirst "Chongli → Beijing Daxing → Zhangjiajie. One train
  still to buy, one flight booked, one bed waiting."; "In this edition: 8 steps · 1 flight · 1 bed"; a slim live
  strip "Now: HSR Taizicheng → Qinghe — not booked · 5h 13m to take-off"; edition arrows ‹ No. 20 · No. 22 ›.
- e-next: the flight ARTICLE: kicker "Step 4 of 8", headline "CA 8609, 18:15", the countdown as a giant pull
  quote, body = steps 3–6 as short numbered paragraphs, a boxed sidebar with the masked code + Show code, a
  boxed "If it's cancelled" note (step 7).
- e-pocket: the BACK PAGE — "The essentials": today's code box + Counter mode on top, then a typographic index
  (Booking codes · Driver cards 35 · Documents 11 · Visa 19/30 · Emergency 9 · Phrases · Converter) with page-like numbers.
- e-city: the FEATURE "Zhangjiajie": headline, standfirst, drop cap on the About text, pull quote "fog that either
  steals the view or makes it — often both in one day", photo with caption, fact box (3 nights · 2n park + 1n city
  · ≈$257 · booked list).

### Q · THE CONCIERGE — a briefing that talks (files q-open, q-next, q-pocket, q-city)
Organizing principle: **the app briefs you in plain sentences, in time order, with the actions right inside.**
Short notes from the app (sun avatar), each with 1–3 action chips; a "Find anything…" bar at the bottom with
suggestion chips (Booking code · Driver card · Visa · Tomorrow). HONESTY RULE: it is composed offline from the trip
file by rules — NOT AI, no internet. Put one quiet line: "Written on this phone from your trip — no internet needed."
Plain, friendly, short English (the owner is a non-native English reader) — no jokes, no invented facts.
q-open notes at 13:02:
1. (done, dim) "You've checked out of Element."
2. (NOW, amber) "Next: the train from Taizicheng to Qinghe. It's not booked yet — be in Qinghe by about 14:30."
   chips: [Driver card · 太子城站] [Mark done]
3. "Then cross to Daxing — not Capital. Be at the airport by about 16:45." chips: [Driver card · 北京大兴国际机场]
4. "Your flight CA 8609 leaves at 18:15 — in 5h 13m. Eat at the airport before security: nothing will be open in
   Wulingyuan when you land." chips: [Show code] [Flight details]
5. "Tonight: Pullman Zhangjiajie, Wulingyuan — booked. You'll arrive around 21:30."
6. (tomorrow, lilac) "Tomorrow: book 重庆1949 for the Dec 15 evening."
- q-next: "Flight details" opened — the note grows into a rich card (sun-arc countdown, PKX 18:15 → DYG 20:30,
  steps 3–8 compact, the fallback, Show code).
- q-pocket: "code" typed in Find → results grouped: Bookings (CA 8609 code card + Counter mode; Pullman), Driver
  cards (the 4 real ones), Documents — "Find anything" in action, keyboard NOT drawn (leave that space empty).
- q-city: tapped "Zhangjiajie" → "Here's Zhangjiajie in 30 seconds." note + photo card + getting-there note +
  about note + booked card, chips: Day by day · Places · Costs.

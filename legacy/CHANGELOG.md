# Changelog — 中国 2026

The single-file trip app (`legacy/index.html` + `sw.js`). Newest first.

---

## 1.2.6 — 29 Jul 2026

**The visa-exit bed is CONFIRMED.** The one thing 1.2.5 said to chase is done.
Source: the owner's Trip.com booking-details page for order **1653715562519718**,
read 29 Jul 2026 and recorded in `sources/china-2026/accommodation-2026-07-25.md`.

### The one thing to read if you read nothing else
**Ten booked beds, ten confirmed.** The ibis Kunming order now prints **Confirmed**
at its head, with **Modify / Cancel** where **"Expedite Booking"** stood — the
property accepted. From 27 to 29 Jul that bed was paid, numbered and unaccepted on
the night the legal exit from the mainland depends on, and every screen in this app
said so. **Every "chase the exit night" line is gone**, and nothing replaces it.

### Changed
- **`cn26-stay-09` reads CONFIRMED.** Status chip **"CONFIRMED — accepted 29 Jul
  2026"**, the `alert` flag dropped, the warning-styled note rewritten as a plain
  one. The Kunming stop, the Dec 20 day plan, the `dali-kunming` task and the
  `hotel-hk` task all lost their "Confirming" line. Unchanged and still on the
  card: **US$25.73 prepaid**, the **one free airport transfer**, free cancellation
  to **23:00 on Dec 17**, and the **smoking room** to ask about at the desk.
- **The assertions moved with the fact, in both directions.** `assert.ts`,
  `verify-china-parity.ts`, `rehearsal.mjs` and `seed.test.ts` used to require the
  word "Confirming" on this bed; they now require **CONFIRMED**, require that
  "Confirming" appears **nowhere** on it, and require that it carries **no**
  `alert`. A warning left standing after it stops being true teaches the reader to
  skip warnings, and this is the last bed on the trip that can afford that.
- **`alert` is now unused and stays in the schema.** It exists so a bed that is
  paid but not yet accepted can say so. That can happen again.
- **`sw.js` cache version bumped to `china2026-v1.2.6`.** It had been left at
  **v1.2.4** while the app shipped 1.2.5 — a stale service-worker cache is what
  makes a real update look like it never installed.

### Not changed
- **No money moved.** The US$25.73 was spent on 27 Jul and counted from then;
  acceptance does not move a cent. Lodging spent stays **$85.68**.
- **Three beds still have unmeasured cancellation risk** — Four Points, Huatian and
  Glenview state no terms at all. That is a different problem from this one and
  closing this one did not touch it.
- **The Dali arrival is still undeclared** and that desk still shuts at 23:00.

### Added
- **On the bed's card, recorded and not acted on:** the order shows **"Earn 129
  Trip Coins (≈$1.29)"** — a loyalty rebate conditional on the stay, the same
  treatment Four Points' 148 and Blossom House's 180 get — and states that the
  booking confirmation may be used **"when checking in or applying for visas"**,
  which on this night specifically is worth having on the phone.

---

## 1.2.5 — 27 Jul 2026

**Booking is finished.** The last two beds — **Dali Yanyuan Mountain Retreat** and
**ibis Kunming Changshui Airport** — are booked, so **ten of the eleven** are held
and the eleventh is the gorge walk-in that must never be pre-booked. Nothing is
`pending` any more. Two other things moved with them: **the Trip.com gift card is
spent**, and **every booked bed now links back to the site it was booked on**.
Sources: the owner's Booking.com confirmation page and their Trip.com
booking-details page, both recorded in
`sources/china-2026/accommodation-2026-07-25.md`.

### The one thing to read if you read nothing else
**The visa-exit bed is PAID and still says "Confirming".** Trip.com took
US$25.73 for the ibis and issued booking 1653715562519718; the property has not
accepted, and the order page offers "Expedite Booking". It is recorded as booked
— it is paid and numbered — and the card says the word the platform used, in a
warning-styled note, with the free-cancellation cut-off (**23:00 on Dec 17**)
beside it. That night is what puts you at Kunming Changshui for **MU733 at 13:50
on Dec 21**, the legal exit from the mainland. Chase it.

### Added
- **Dec 19–20 · Dali Yanyuan Mountain Retreat 大理晏清山居客栈 — BOOKED.**
  Booking.com, Genius rate, confirmation **6352597569** · PIN **8706**. King
  Room, 1 night, 1 adult. **¥324 total** — the page printed US$47.83 as well and
  then quoted the cancellation penalty as "CNY 324 (US$47.83)", yuan first, so
  the yuan is the price and ≈$45 is derived at the trip's own 7.15. Free
  cancellation to **23:59 on Dec 15**; from 00:00 on Dec 16 the **whole ¥324**
  is charged — the trip's second 100% cliff, after Pullman. Payment mode **not
  stated — ask**. ☎ +86 189 8708 1208.
- **Dec 20–21 · ibis Kunming Changshui Airport — BOOKED AND PAID.** Trip.com,
  **US$25.73** ("Prepay Online ✓ Paid"), Queen Room 32 m², **booked as a smoking
  room** (ask at the desk), no meals. **One free airport transfer is itemised on
  the order** — the operational reason this bed exists. Free cancellation to
  **23:00 on Dec 17**. Status **"Confirming"**, see above.
- **⚠️ Dec 19 runbook — off the gorge, and a desk that shuts at 23:00.** A new
  runbook, for the same reason `dec16` exists: on a runbook day Home draws the
  RUNBOOK instead of the day's plan items, and Dec 19 was on the generic
  "Travel-day basics", so anything specific to it was invisible on the day.
  **No late arrival has been declared for Dali and its check-in closes at
  23:00** — an hour earlier than Yue Tu's — after a 4–5 h shared car off the
  gorge road. The runbook says so and gives the number to call.
- **A "Manage" link on every booked bed**, at the owner's request: the price, the
  booked stamp and a way back to the site it was booked on. Where no deep link to
  the reservation was ever supplied the link is the **platform's own entry
  point**, labelled as such and never dressed up as this order —
  `trip.com/account/orderlist/` (Four Points, Blossom House, Huatian, Glenview,
  ibis), `agoda.com/account/bookings.html` (Element, Pullman),
  `secure.booking.com/mytrips.html` (Yue Tu, Dali). **Element still carries no
  confirmation number and now carries a link**: not knowing the number is a
  different admission from not being able to reach the order.
- **The Royal Garden's reservations desk, on the card.** It was booked direct, so
  there is no OTA account holding a copy: the link is the hotel's own site and the
  card now carries **rsvoff@rghk.com.hk** and **+852 2733 2828** beside the
  24-hour front desk.

### Changed
- **The gift card reads $0.** The owner: *"i finish my coupon nothing left"*.
  Every "book these with the gift card (~$298 left)" line is gone — the task, the
  card's note and the Money info card. ❓ **Which bookings absorbed it is NOT
  known**, and nothing was attributed to it: no price reduced, no payment mode
  changed, no bed marked part-paid. **If it went against the five Trip.com beds,
  what is due at those desks is lower than this app says.** That is now an open
  question on the tasks screen, pointed at the same Trip.com order pages that
  still owe Four Points', Huatian's and Glenview's cancellation terms.
- **Lodging spent went $59.95 → $85.68** and total spent $2,949.95 → $2,975.68.
  Two beds have taken money now: Yue Tu's first night (¥428.65, charged at
  reservation) and the ibis in full (US$25.73, already charged). Eight have not.
- **"Booked & committed" went $5,358 → $5,356.** Beds $2,567.97 → $2,566.01: Dali
  ~$47 → $45.31 and Kunming ~$26 → $25.73, both *down*, and in both cases because
  this app converts at 7.15 where the plan quoted an OTA's ≈6.77. **Neither room
  got cheaper.**
- **The Lodging budget line is no longer a guess.** It read $2,550, an estimate
  made before a single bed was booked; it is now **$2,566**, rebuilt from ten real
  prices plus the gorge's ~$20. ⚠️ The eight category plans therefore sum to
  **$7,516** against the $7,500 budget — a real $16 that used to hide inside a
  stale estimate. Nothing else was shaved to make the columns tie.
- **Dali got a street address and a map button.** Its entry had only verified
  coordinates — which a bed never ships — and the confirmation printed
  `No.133, Yinxian Road, Shuidui Village, 671003 Dali, China`, transcribed
  verbatim. **Nine of eleven beds now open**; Blossom House and Huatian still
  ship no button, because being booked is not the same as being locatable.
- **The ibis address did NOT move.** Its order prints a fuller line that is not a
  superset of the one already shipping (district added, unit dropped) and is 82
  characters, so adopting it would mean a trim that deletes "Kunming". One source
  ships whole; the order's version rides on the note.
- **The Dali stop costs ≈$78, not ≈$80**, and both stop pages now say BOOKED with
  their real terms.

## 1.2.4 — 27 Jul 2026

**One correction, one gap filled, one new bed.** Four Points was rebooked and every
term of its old order died with it; Blossom House finally has a platform and a
number; and **Lijiang Yue Tu Inn is booked** — the eighth bed, and the first one
that takes money before you travel. Sources: the owner's Trip.com "My Bookings →
Upcoming" list, captured in full, and their Booking.com confirmation page, both
recorded in `sources/china-2026/accommodation-2026-07-25.md`.

### The one thing to read if you read nothing else
**Four Points is $244.74, not $289.68 — and it no longer has a cancellation
deadline.** The bookings list shows exactly ONE Four Points order, at the lower
rate, with a different number. Everything the app printed about that bed came
from an order that is no longer live: the price, the PIN, the ¥1,960 breakdown,
the $144.84 preauthorization, "pay at the hotel" and free cancellation to 16:00
on Dec 5. All of it is demoted. The card now reads **"not stated — ask"** for
both payment and cancellation, exactly as Huatian and Glenview do, and the old
figures survive only in the accommodation document, labelled as history. **Three
booked beds now have unmeasured money at risk, not two** — booking pressure went
down, paperwork pressure went up.

### Changed
- **Dec 5–7 · Four Points — REBOOKED.** New Trip.com order, **US$244.74** for
  both nights, Superior King Bed Room, confirmed 27 Jul. Amenities on the card:
  gym, public parking, luggage storage. Against plan it is now **+$2.74**, not
  the +$47.68 this app used to claim — the rebooking took ~$45 off the trip.
- **The guest-name warning on Four Points is RESOLVED.** It carried an
  UNVERIFIED / check-at-check-in flag only because the name was invisible on the
  superseded order's page. The bookings list prints **SALOMON CHALOM COHEN** in
  full. The flag is removed from that bed and from that bed only.
- **No PIN ships for Four Points.** The replacement order showed none, so the
  card has no secondary line. PIN 9858 belonged to the dead order and is gone
  from the app — while staying in the privacy gate, because a retired credential
  is still a credential.
- ✅ **The superseded order is CANCELLED — confirmed by the platform.** A fuller
  capture of the bookings list prints the two side by side: `…783471` **Confirmed**
  at US$244.74, `…596848` **Canceled** at CNY 1,960.00, same property, same
  Dec 5–7, same room, same guest. This was an open question for a few hours and
  is now a fact; no second room is held. It changes **nothing** about the two
  blanks — cancelled is not refunded, and neither tells you the live order's
  payment mode or deadline.
- **Dec 7–9 · Blossom House — two of its four blanks are filled.** The same
  bookings list gives the platform (**Trip.com**) and the **confirmation
  number**, so the bed gained a code strip and a link to the order page. Its
  US$299.56 is confirmed, its guest name is printed in full, and its listed
  amenities are hiking, gym and private parking. **No PIN was shown.** Still
  unknown, and still the two that can cost money: **prepaid or due at the
  hotel**, and the **free-cancellation deadline**.
- **Dec 16–18 · Lijiang Yue Tu Inn — BOOKED on Booking.com** at the Genius rate.
  **CNY 857.30** for two nights, Mountain View King with balcony, non-smoking,
  1 adult. Confirmation number and PIN both on the card. Property mobile
  **+86 151 5325 4963**, which matters at 22:30. The confirmation prints the same
  street this app already had and adds the postcode **674100** — recorded in the
  note, never folded into the map search, the same rule Pullman's entry follows.
- **The currency rule met its first two-currency confirmation, and held.** The
  page printed US$126.55 *and* CNY 857.30, then said the dollar figure is a
  converted display, that the charge happens in CNY, and that the rate may move.
  US$126.55 ÷ ¥857.30 is **≈6.77** — Booking.com's own display rate, the same one
  this app has refused to mix with its 7.15 since Pullman. So the card carries
  **¥857.30** and the app converts it itself, about **$120**. (§12 The Royal
  Garden also printed two currencies and keeps its dollar: its engine stated the
  USD as the amount due, with no disclaimer. The rule is "carry what will
  actually be charged", and each page said which that was.)
- **LODGING IS NO LONGER $0.** Yue Tu's terms charge **a prepayment of the first
  night at reservation** — present tense, not a date in December and not a
  "may". That is **¥428.65**, ≈**$60**, and the halving is the page's own: it
  prices a post-Dec-14 cancellation at "US$63 — one night" against a US$126.55
  two-night display. The money screen counts it, Total spent moves **$2,890 →
  $2,950**, and the argument that kept lodging at zero is amended rather than
  quietly left standing — it still holds for the other seven booked beds.
- **⏰ Yue Tu's refund cliff is Dec 13, and it is the bag-transfer deadline.**
  Free to **23:59 on Dec 13**; from **00:00 on Dec 14** a cancellation costs
  **US$63, one night**. A new alarm sits on the morning of Dec 13 and the
  bag-transfer task now names that date as its hard stop.
- **🌙 The Dec 16 late arrival is APPROVED, so stop telling him to message
  them.** A 22:00–23:00 window was requested at booking and the property approved
  it; the 24-hour front desk is confirmed on the page. The day plan, the Dec 16
  runbook, the 3U8011 ticket note, the 17:30 airport alarm and the "Dec 16 — the
  late arrival" info card all used to say "message Yue Tu Inn". Every one now
  says it is approved and gives the mobile to call only if the flight slips.
- **📩 The special request is ASKED, NOT ANSWERED.** Airport pickup from LJG on
  Dec 16, a Jade Dragon cable-car slot for Dec 17, and — the make-or-break one —
  **the bag transfer to Tina's for Dec 18**, in writing. Booking.com says the
  property "may get in touch". Nothing has. The bag transfer is why Yue Tu beat
  Mama Naxi, so it is recorded as open everywhere it appears: the bed's note, the
  Lijiang stop, the Dec 17 day plan, the packing list and its own task.
- **Eight beds, two to go, and the gift card is untouched.** Yue Tu was booked on
  Booking.com, so the ~$298 Trip.com balance still faces only Yanyuan ($47.24)
  and ibis ($26) — $73 of work left for it.
- **Beds now total $2,474.97 booked against $2,443.22 planned, +$31.75.** The
  money card's grand total moves **$5,356 → $5,358**: Lijiang added $119.90 and
  Four Points gave $44.94 back.

### Not recorded, because nobody told us
- **Four Points' real payment mode and cancellation deadline**, which now have to
  be pulled off the Trip.com order page like Huatian's and Glenview's.
- **Blossom House's payment mode and cancellation cut-off** — unchanged, still
  the only two things missing about that bed.
- **Whether Yue Tu will do the bag transfer, the airport pickup or the Jade
  Dragon slot.** No answer to any of the three.
- **What is due at Yue Tu on arrival, and when.** Only the first night's
  prepayment is stated.
- **No manage / order URL for Yue Tu**, so that card links to nothing rather than
  to a guessed Booking.com account page — exactly as Element's and Pullman's do.
- **Element's Agoda booking number**, still. It remains the only booked bed in
  the app with no number on its card.

---

## 1.2.3 — 27 Jul 2026

**Three more beds are booked: Pullman Zhangjiajie, Huatian and Glenview.** Seven
of the eleven are now held and only three remain — Lijiang, Dali and Kunming,
the three the gift card was kept for. Source: the owner's own Agoda booking page
and their Trip.com bookings list, recorded in
`sources/china-2026/accommodation-2026-07-25.md`, which stays the authority for
every bed.

### The one thing to read if you read nothing else
**Pullman's card is charged on 8 December, not 7.** Every earlier version of this
app said the 7th and built a whole task and alarm around the fact that you are on
the Great Wall that day with no signal. The booking says the **8th** — the Beijing
spa day, in a city, with signal. The date is corrected in the bed's note, the
`pullman-charge` task (now due Dec 7, titled "charges the card on Dec 8") and its
alarm (now Dec 7 09:00).

### Changed
- **Dec 11–13 · Pullman Zhangjiajie — BOOKED on Agoda**, as *Hotel Pullman
  Zhangjiajie*. **CNY 887.52** (¥761.14 room + ¥126.38 taxes and fees). Superior
  Room, 1 king, **nature view**, 38 m², **breakfast for 2**, parking, free WiFi;
  1 room, booked for 1 adult, in the passport name. Check-in Fri Dec 11 from
  14:00, check-out Sun Dec 13 by 12:00. Carries its **Agoda booking id** in the
  counter-facing type. Planned $104 booking *direct* with Pullman, so about
  **$20 over plan** at the trip's own rate (~$27 over at Agoda's) — the only one
  of the three that really moved, and it stays freely cancellable to Dec 9, so
  rebooking direct is still on the table.
- **⚠️ Pullman's cancellation has THREE tiers — the most complex on the trip, and
  the only bed that can cost 100%.** Free to **23:59 Dec 9** · **partially
  refundable from 00:00 Dec 10**, where cancelling within a day of arrival costs
  the first night · **NON-REFUNDABLE from 00:00 Dec 11**, its own check-in day
  and the day of the monopoly flight, where a no-show costs the whole ¥887.52.
  All three tiers are chips on the card. **Dec 9 now closes two windows at
  opposite ends of the same day**: Element's at 00:00, Pullman's at 23:59.
- **Dec 13–14 · Huatian Grand Hotel — BOOKED on Trip.com**, and **booked 26 Jul**,
  a day before every other bed on this trip. **CNY 419.00** — *exactly* the ¥419
  that was planned, so plan and reality agree to the yuan with no variance at all.
  Superior Panoramic Single Room, full passport name printed on the booking.
- **Dec 14–16 · Glenview ITC Plaza — BOOKED on Trip.com**, also 26 Jul.
  **CNY 1,166.00**; planned $172.22 through Trip.com, which at Trip.com's own
  rate is ≈$172.33 — **agreement to about ten cents**. Deluxe Double Room, full
  passport name printed.
- **Prices are now quoted in the currency the confirmation printed, always.**
  These three printed **no USD figure at all**, unlike Four Points and Element,
  which printed both. So their cards carry **¥887.52 / ¥419.00 / ¥1,166.00** and
  the app converts them at the trip's own stored rate (**CNY 7.15 = USD 1**, the
  rate every other yuan in this app already goes through) — about $124, $59 and
  $163. Nothing in the app now shows a dollar price that a confirmation did not
  state, and the rate is the app's own rather than the OTAs' ≈6.77. **The two are
  never mixed.**
- **Read the "savings" on Huatian and Glenview as exchange rate, not price.**
  Against plan they look like −$3.40 and −$9.14. Neither room got cheaper: their
  yuan match the plan almost exactly, and the plan's dollar figures were the
  OTA's conversion. Measure these two in yuan.
- **Huatian and Glenview say what they do NOT know.** The bookings list showed no
  cancellation deadline, no payment mode and no PIN, so both cards print
  **"not stated — ask"** instead of reprinting the old research. The free-cancel
  dates, the preauthorization, the 20:00 arrival declarations, the room details
  and the review scores stay in the app as `verify` research, clearly labelled.
- **The deadline task grew up.** "Hong Kong and Chongli are booked" is now
  "**Seven beds are booked** — diarise four deadlines and fill three blanks":
  Element 00:00 Dec 9, Pullman 23:59 Dec 9 → 00:00 Dec 10 → 00:00 Dec 11, Royal
  Garden 14:00 Dec 19; blanks being Element's Agoda number and the two Trip.com
  cancellation deadlines.
- **The gift-card task shrank to what is actually left**: Yue Tu, Yanyuan and
  ibis, $146 of the ~$298 balance. Zhangjiajie and Chongqing came off it.

### Not recorded, because nobody told us
- **Huatian's and Glenview's cancellation deadlines and payment modes.** Two
  booked beds therefore have **unmeasured** money-at-risk — which is not the same
  as zero, and the app does not pretend otherwise.
- **No Agoda order URL** for Pullman, so that card links to nothing rather than
  to a guessed account page — exactly as Element's does.
- **Element's Agoda booking number**, still. That bed remains the only booked one
  in the app with no number at all.
- Nothing was logged as **paid**. Seven booked beds and lodging is still **$0** in
  the tracker. Pullman's 8 Dec auto-charge is a *date*, not a receipt — and it
  lands a day and a half before the free window shuts, so even being charged is
  not being committed.

### Addresses — nothing moved, and every reason is written down
- **Pullman's Agoda page misspells the street: "GADYUN ROAD" for Gaoyun.** The
  accommodation document's spelling stays and is what the map button opens; a
  search for a street that does not exist is worse than no button. The typo is
  *named* on the bed's note, because the owner will see it on their own
  confirmation and needs to know which spelling to trust — the rule the tests
  enforce is that it is never **searchable**. The **postcode 427400** is new and
  is recorded in the note, not glued onto the search string: an address here is
  transcribed from one source, never assembled from two.
- **Huatian still ships no map button**, because its booking prints no address —
  the second booked bed, after Blossom House, to prove that booked and locatable
  are different things.
- Still **seven** beds opening on a street address, still no bed with a
  coordinate, still no hotel name sent to a map.

### Arithmetic
Beds $2,558.20 → **$2,566.01**. Zhangjiajie stop ≈$240 → **≈$257**, Chongqing
≈$240 → **≈$231** (that one drops purely on the exchange rate). The app's
"Booked & committed" total $5,348 → **$5,356** of the $7,500 budget. Seven beds
booked for **$2,400.01** — $2,054.20 + ¥2,472.52 in the currencies they were
actually quoted in — against $2,370.22 planned: **$29.79 over**, of which
$20.13 is Pullman and the rest is noise on a plan that was allowed to move.

### Note on the alarm
The Pullman alarm changed date in place rather than being re-sorted into the
array. Alarm identity is its **index** (`alarm-<i>` ticks, `cn26-alarm-NN` ids),
so moving it would silently reassign two alarms' identities to save a cosmetic
ordering — and every alarm row prints its own date anyway. The new app sorts by
date and time when it displays them, so the order is right where it is read.

---

## 1.2.2 — 27 Jul 2026

**Two more beds are booked: Chongli and Hong Kong.** Four of the eleven are now
held, all four still cancellable — but **not equally cancellable**, which is the
real news in this release. Source: the owner's own Agoda checkout and confirmed
booking pages, and their completed direct booking with The Royal Garden,
recorded in `sources/china-2026/accommodation-2026-07-25.md`, which stays the
authority for every bed.

### Changed
- **Dec 9–11 · Element Chongli — BOOKED on Agoda.** Renamed to the name Agoda
  books it under; the accommodation document's "Element by Marriott Chongli" and
  this are the same property, and the address on the confirmation — Block I,
  Thaiwoo Ski Resort & Alpine Park — is what proves it. Price **$221 →
  $232.95**, shown as **CNY 1,575.99** (¥1,351.58 room + ¥224.41 taxes and
  fees), about **$12 over plan**. Studio King, 41 m², **breakfast included**,
  booked for 2 adults, **pay at the property**. The card on file is recorded as
  a scheme and a last four, nothing more.
- **⚠️ Element's cancellation window is the strictest on the trip, and the app
  now says so.** Free **now**, but from **00:00 on Dec 9, Zhangjiakou time** —
  the very start of the day you travel there — only **54%** comes back, and
  cancelling on the check-in date or not showing up costs **46%**. Four Points
  and The Royal Garden both let you cancel *during* their last day; this one
  does not. No bed on this trip carries a bare "free cancellation" chip any
  more: every booked one prints its own cut-off, and the parity audit, the seed
  assertions and the dress rehearsal all fail if one degrades into a promise.
- **Dec 21–26 · The Royal Garden Tsim Sha Tsui — BOOKED DIRECT with the hotel**,
  through its own booking engine rather than an OTA. Price **$1,209 →
  $1,232.01 (HK$9,661.50)**, about **$23 over plan** — and the total is the
  price: the confirmation's subtotal of $1,090.28 excludes $109.03 service
  charge and $32.71 city tax, so the subtotal alone would have understated the
  bed by $142. **US$0 paid online; the whole amount is due at the desk in HKD.**
  Breakfast **not** included. Free change or cancellation to **14:00 on Dec 19
  (CST)**. Carries its reservation number in the counter-facing type, with
  "booked direct with the hotel" in the secondary line — because a direct
  booking has no order page to fall back on.
- **Dec 26 check-out is 11:00, not 12:00.** An hour earlier than every previous
  version of this plan, corrected in the bed's chip, the Dec 26 day plan, the
  flying-home runbook, the Hong Kong stop and the authority document. The
  luggage-storage advice stands and is easier to act on than before: reception
  is staffed 24 hours. Be at HKG T1 by ~16:30 is unchanged.
- **Dec 21 arrival is covered**: the Royal Garden's reception is open 24 hours
  and its phone (+852 2721 5215) rides on the bed's own card. It was deliberately
  **not** added to the emergency list — that list is police, ambulance, embassies
  and insurers, and one hotel front desk does not belong beside them.
- **The Hong Kong address is now the hotel's own**: 69 Mody Road, **Tsimshatsui
  East, Kowloon, Hong Kong**, replacing the document's shorter line. Element's
  address did not change — its confirmation reprinted what the repo already had.
  Still seven beds opening on a street address, still no bed with a coordinate
  and still no hotel name sent to a map.
- **The "book Hong Kong" task became a deadline task.** It no longer tells you to
  compare rates that have already been beaten; it holds the two live cut-offs and
  the one number nobody supplied.

### Not recorded, because nobody told us
- Element's **Agoda booking number**. That bed ships with **no code strip at
  all**, exactly like Blossom House — the app would rather show nothing than
  something plausible that gets read out at a desk.
- No **Agoda order URL** either, so the card links to nothing rather than to a
  guessed account page.
- Nothing was logged as **paid**. Four booked beds and lodging is still **$0** in
  the tracker: pay-at-hotel, unstated, due-at-property and due-at-desk are none
  of them receipts. Element's page reserving the right to collect "at any time"
  is a warning about the future, not a payment.

### Arithmetic
Beds $2,523.24 → **$2,558.20**. Chongli stop ≈$520 → **≈$532**, Hong Kong stop
≈$1,600 → **≈$1,623**. The app's "Booked & committed" total $5,313 → **$5,348**
of the $7,500 budget. Four beds booked for **$2,054.20** against $2,032 planned:
**$22.20 over**, on a plan that was allowed to move.

---

## 1.2.1 — 27 Jul 2026

**The first two beds are booked.** Both Beijing stays are confirmed and both are
still freely cancellable, so the standing decision holds. Source: the owner's own
Trip.com booking-details page and their Blossom House checkout page, recorded in
`sources/china-2026/accommodation-2026-07-25.md`, which stays the authority for
every bed.

### Changed
- **Dec 5–7 · Four Points by Sheraton Beijing Sanlitun Workers Stadium — BOOKED.**
  Name expanded to the one on the booking. Price **$242 → $289.68**, the real
  charge: **CNY 1,960.00** (¥1,849.06 room + ¥110.94 taxes/VAT), **payable at the
  hotel** with a $144.84 preauthorization held, not prepaid. About **$48 over
  plan**, and the totals say so. Free cancellation to **16:00 on Dec 5**. Carries
  its Trip.com booking number, room, check-in/out times, payment terms and
  cancellation deadline; the **PIN rides in the secondary line** under the number,
  never in the number's own type.
- **Dec 5–7 address confirmed: No. 20 Gongti East Road, Chaoyang District** — the
  "verify the exact address at booking" instruction, carried out. That is now the
  Great Wall pickup address, and the bed's map button opens it. Seven of the
  eleven beds now open on a street address, up from six.
- **Dec 7–9 · Blossom House Prince Kung's Mansion · Beijing Houhai — BOOKED.**
  Renamed to the property on the booking. Price **$360 → $299.56**, about **$60
  under plan**. Booked in the passport name. Hutong Double Bed Room, breakfast
  for one.
- **The heating question is closed.** "Confirm heating before paying" was the
  open worry on this bed; the owner confirmed it before booking, and every place
  that used to warn about it now records it as settled.

### Not recorded, because nobody told us
- Blossom House's **confirmation number**, **booking platform** and whether it is
  **prepaid or due at the hotel**, plus its free-cancellation **deadline** (free
  cancellation is promised; no cut-off time was shown). Its old Hotels.com search
  link is gone rather than left implying a platform.
- The **guest name on the Four Points booking** was not visible on the page, so
  nothing here claims it matches the passport — it is flagged `verify`.
- Nothing was logged as **paid**: a booking is not a payment, and lodging stays
  at $0 in the tracker.

### Beijing arithmetic
Hotels $602 → **$589** (both booked), stop estimate ≈$920 → **≈$907**, and the
app's "Booked & committed" total $5,326 → **$5,313**.

---

## 1.2.0 — 26 Jul 2026

The accommodation swap. Ten of the eleven beds changed, from
`sources/china-2026/accommodation-2026-07-25.md` — the authority document for
every bed, which overrides the guide wherever they disagree. Nothing is booked;
every rate below is the **freely cancellable** one, which is the owner's standing
decision even where a cheaper non-refundable rate exists.

### Changed
- **All eleven beds rewritten.** Dec 5–7 Four Points by Sheraton Sanlitun
  Workers Stadium ($242) · Dec 7–9 Blossom House Houhai ($360) · Dec 9–11 Element
  by Marriott, Thaiwoo ($221) · Dec 11–13 Pullman Zhangjiajie, Wulingyuan ($104)
  · Dec 13–14 Huatian Grand, Zhangjiajie city ($62) · Dec 14–16 Glenview ITC
  Plaza, Jiefangbei ($172) · Dec 16–18 Yue Tu Inn, Dayan ($73) · Dec 18–19
  Halfway Guesthouse ($20, the one bed that did not change, still walk-in) ·
  Dec 19–20 Yanyuan Mountain Retreat, Dali old city ($47) · Dec 20–21 ibis
  Kunming Changshui Airport ($26) · Dec 21–26 The Royal Garden, TST East
  ($1,209). Six of them now carry a real street address, straight out of the
  authority document. Bed labels, sleep blocks, day plans, costs and every
  hotel-bearing task, alarm and runbook step follow the new names.
- **Two taxi cards were actively wrong and are corrected.** 宝钞胡同 (Baochao
  Hutong — the old hutong hotel) is replaced by **后海**, the district Blossom
  House is in, and Dec 7–8 point at it. 昆明南站 stays — the Dali train still
  arrives there on Dec 20 — but its gloss now says so out loud, and Dec 20 points
  at **昆明长水国际机场** instead, because that is where the bed is.
- **Two cards added**, both `vfy:1`: 太舞滑雪小镇 (Thaiwoo Ski Town, for Element)
  and 解放碑 (Jiefangbei, for Glenview). They sit at the END of `DATA.places` on
  purpose — a card's seed id is its index in that array.
- **Dec 20–21 replanned with the bed.** Kunming moved from downtown to the
  airport, so the evening of the 20th now holds the noodles and, if there is
  time, Green Lake at dusk — and the morning of the 21st holds nothing at all.
  You wake 3.4 km from the terminal with a free 24-hour shuttle; the visa exit
  is the only thing that day.
- **Budget raised to $7,500** (was $6,500): lodging $1,750 → $2,550, other
  $350 → $510. Stop totals moved with the beds — Beijing ≈$920, Chongli ≈$520,
  Zhangjiajie ≈$240, Chongqing ≈$240, Lijiang ≈$200, Dali ≈$80, Kunming ≈$26,
  Hong Kong ≈$1,600.

### Added
- Task **`pullman-charge`** (Dec 6): Pullman charges the card on Dec 7, the day
  you are on the Great Wall with no signal — a declined charge could drop the
  room quietly. Paired with a 09:00 alarm the day before.
- Task **`lijiang-bagtransfer`** (Sept 15): get the gorge bag transfer in writing
  from Yue Tu Inn while the booking is still freely cancellable. Mama Naxi
  survives in the app only here and in the Lijiang tip, as the named fallback —
  that service is the whole reason it was ever the pick.

---

## 1.1.0 — 26 Jul 2026

Trip-speed pass: fewer taps between "I need this now" and having it on screen.

### Added
- **Tonight's taxi card.** Days that have a known Chinese address carry a `taxi`
  field pointing at an existing `places` entry; the Tonight card grows a
  full-width **🚕 Show the driver** button that opens the fullscreen card.
  Dec 5 – Dec 20 are covered. Nov 22 – Dec 5 is deliberately blank: the Kunyu
  address is still ⏳ pending and is not going to be invented.
- **Wallet → 🛏 Beds**, a third segment holding the hotels. During the trip
  tonight's bed sorts to the top with a red **TONIGHT** pill, the rest follow by
  date, and nights already behind you drop to the bottom, dimmed, with a `done`
  pill. Hotels gained ISO `start`/`end` fields read off their existing date text.
- **Ticket state at a glance.** Today's leg gets a gold **TODAY** pill, flown
  legs go dim and dashed, and every flight ticket now shows the passport number
  in its meta row — rendered from `traveler`, not copied into each booking.
- **Deep link from Today.** "Open in Wallet" on the next-flight card jumps to the
  Tickets segment, scrolls that exact ticket into view and flashes it.

### Changed
- **Today card order** during the trip: hero → runbook → **Tonight** → the plan →
  next flight → next deadline → next alarm → clocks → notes. At 23:00 in a taxi,
  the bed matters more than the itinerary.
- **Key info card order**: taxi cards → emergency → visa clock → useful Chinese →
  gotchas → backup. The visa clock is a thing you read once a day; the taxi card
  is a thing you open standing in the street.
- Wallet's first segment is now labelled **🎫 Tickets** (was "Bookings").

### Fixed
- **Transition days pick the right stop.** `currentStop()` now matches both ends
  inclusively and lets the last match win, so Dec 9 / Dec 11 / Dec 14 read as the
  place you are arriving in, and **Dec 26 correctly reads Hong Kong**. Dec 27 is
  flying home and shows no stop, which is right. The itinerary's "you are here"
  now comes from that same function instead of duplicating the comparison.
- **Alarms retire during the day.** The next timed moment skips alarms whose time
  has already passed today, not just whole past days.
- **Day rollover on resume.** A phone that slept through midnight now re-renders
  everything when it wakes, instead of only refreshing the status pill.
- **Update toast** waits for the new service worker to actually take control
  before reloading (with a 1.5 s fallback), so tapping it can no longer serve the
  old cached page back.
- **Restore is undoable** — the current state is snapshotted first and the toast's
  UNDO puts it back. Import also validates the blob before writing: non-object
  payloads are rejected and non-string values are skipped.

### Notes
- Storage keys, the backup format and the expense-entry shape are unchanged.
  v1.0.0 backup blobs and bare expense arrays still import.
- **Considered and rejected: full-text search.** A search box across every card
  sounds useful and isn't — typing one-handed on a train, half of it in Chinese,
  loses every time to a button that is already on the screen. The effort went
  into one-tap jumps instead: the taxi button, the beds sort, the ticket deep
  link. Revisit only if something genuinely can't be reached in two taps.
- Service worker cache bumped to `china2026-v1.1.0`; nothing else in `sw.js` moved.

---

## 1.0.0 — 24 Jul 2026

First build. Five tabs (Today, Itinerary, Wallet, Tasks, Key info), all trip data
transcribed from the guide, handoff notes, insurance comparison and the flight
PDF. Offline-first service worker, `?d=YYYY-MM-DD` day preview, boarding-pass
ticket cards, fullscreen show-the-driver overlay, packing and pre-flight
checklists, expense tracker with fixed rates, and copy/file backup + restore.

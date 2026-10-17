# Where this stands — 17 October 2026

*One page, kept current, so any session or person can pick this up cold. For what the app
IS see [OVERVIEW.md](OVERVIEW.md); how to use it, [README.md](README.md); how it is built,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); why it exists, [ABOUT.md](ABOUT.md).*

**The trip: China, 21 Nov – 27 Dec 2026. 37 days. One traveller, French passport.**
35 days out at the time of writing.

---

## The app, in numbers

| | |
|---|---|
| Tests · parity · rehearsal | **1,081** (1,080 pass + 1 skipped) · **156 critical values + 92 structural facts** · rehearsal: see 17 Oct below (not re-run for the follow-up — its Chrome path is Windows-only) |
| Contrast gate | **104 pairs in each of 2 palettes**, 0 failures |
| Bundle | **158.7 KB gzipped JS** against a 200 KB budget · 21.7 KB CSS |
| Places that open in a map | 145 spots · 28 driver cards · 11 stops · 18 travel bookings — **17 Oct: − 6 spots** (Genting, Wanlong, Fulong, Chongli town, Beijing North, Qinghe), **− 2 driver cards** (太子城站, 太舞滑雪小镇), **− 1 stop** (Shanghai opens nothing yet) · **+ 1 driver card without a map** (the Hi Cozy hostel's Chinese name) |
| Day plans with tappable places | **83** links across 25 days (89 until 17 Oct — Dec 9 and Dec 11 lost the Chongli stations; nothing in Shanghai is verified) |
| Beds | **14 arrangements**: **12 booked** (incl. the academy fortnight, $840 in writing, the **Muping night of Nov 22, ¥164 cash at the desk**, and since 17 Oct the **Hi Cozy hostel, Shanghai, Dec 9–11, ₪136.40 prepaid**) · **Element Chongli CANCELLED** on Agoda, 17 Oct, nothing charged · + the gorge guesthouse, a deliberate walk-in · nothing left to book |
| Flights | **10: 9 booked + 1 cancelled** — **MU394** (Dec 11, Pudong T1 19:10 → Zhangjiajie T2 21:40) **booked 17 Oct**, $200.20, PNR on the card · **CA8609** (Daxing → DYG) **cancelled 17 Oct, $220.20 refunded** (the $20.80 fee kept; check it reached the card ~Nov 3) · the Dec 5 leg (**CA1560**) bought 28 Sep · the Nov 22 leg **retimed by the airline 29 Sep** (CA8683 → **CA8641**) |
| Rail | **4** legs, **none a ticket yet** — the Dec 9 **G11, Beijing South 10:05 → Shanghai Hongqiao 14:40**, is **RESERVED on Trip.com** (17 Oct, ILS 330.22; the ticket is bought when sales open 12:45 Nov 25) · the other three to buy (17 Oct: the two Chongli trains went) |
| Experiences | 11, of which **1 booked** (the concert) — 17 Oct: the Thaiwoo lesson went, **Shanghai Disneyland (Dec 10, ⏳)** came |
| **Money** | **$6,301.25 committed** in bookings (**$6,549.65 all-in** with insurance and the academy's application fee) of a **$9,000 budget** · **$5,236.44 already paid** (17 Oct: + Hi Cozy ≈$40.12, + MU394 $200.20, CA8609 $241 → its $20.80 fee) · plans sum **$8,544** |

Installed on the phone as `com.livingthedream.travel`. The trip arrives as a file you
import; the app itself ships empty and a build gate proves it.

---

## 17 Oct 2026, follow-up — the cash is ORDERED for a Nov 21 pickup, Disney is CHOSEN, + the reserve permit

Owner decisions of 15–17 Oct 2026. **Nothing new is booked, bought or paid** — money unchanged.
Authority: the closing "Added 17 Oct 2026, follow-up" section of `accommodation-2026-07-25.md`
and `options/shanghai.md`. **Re-import the seed on the phone.**

- **The cash is ORDERED (17 Oct, by the owner in the Bank Hapoalim app).** **US$1,500**, US
  dollars, through the bank's **"מט״ח בטרמינל"** service (**order no. 629200501** — quote it at
  collection; counter hours are on the bank's website), for collection on **Sat 21 Nov** at the
  **Bank Hapoalim counters at Ben Gurion (Natbag)**, collected by the account holder himself — bring
  the passport or ID card of the collector, as stated in the order; **if the flight date changes,
  update the order** (bank website, Poalim by phone, or a branch). $1,500 is deliberate: anything
  beyond the cash needs goes on Alipay. With the US$300 already held he carries **US$1,800**:
  **School $1,000** (unchanged — $940 to the academy Nov 23) · **Exchange $600** (unchanged — ≈¥4,200
  at Daxing Nov 22 for the cash-only places) · **Reserve $200** (was $400). Task `cash-plan`
  **closed (deleted — tasks 28 → 27)**; the Nov 21 12:00 alarm now reads **"Collect US$1,500 at the
  Bank Hapoalim counter, Ben Gurion (Natbag) — ID as in the order — then split the three
  envelopes"**; the Kunyu kit, the Nov 21 day plan and the packing items carry the new figures.
  (An earlier plan of 15 Oct — an exchange office at T3, US$1,700 / US$2,000 total, Reserve $400 —
  is superseded.)
- **Shanghai Disneyland, Dec 10 — chosen, ⏳ not bought.** **"1 Day Ticket + Disney Premier Access
  of 14 (Standard)", ILS 1,183 on Trip.com**, non-refundable (≈$348 at the trip's 3.4). Also seen:
  Premier Access of 11 + Premier Admission, ILS 896; the plain ticket ¥439; the official site
  ~Nov 11 at ¥449–499. Task `disney-ticket` stays **Nov 12**. ⚠️ The Shanghai + Disney category
  plan ($203) and the stop's "≈$125–235 planned" still assume ¥439–499 + 2–3 single Premier Access
  rides — **not changed**: the owner's call.
- **+ `reserve-permit`** (the IDF reserve abroad permit, filled 15 Oct): add the contact person's
  address, sign, submit to the unit; then the commander, information security and the reserve
  officer sign — due **Oct 16**, check it came back approved **~Oct 29**. No ID in the app.
- **`kunyu-arrival`:** the fitness report was asked of the doctor on 15 Oct (signed, English, fit
  for intensive kung fu training in China 23 Nov – 5 Dec, name as in the passport) — check the
  reply **~Oct 22**; ✅ the insurance certificate is **printed** (15 Oct). Packing items have no
  done flag in this seed, so the packing line says "printed 15 Oct" instead.
- **`12306`** Nov 5 → **Oct 18** (registration that day; check ~Oct 26) — for the Dec 14 and the
  visa-critical Dec 20 trains; G11 is via Trip.com, which stays the fallback.
- **+ `hicozy-arrival`**, due **Dec 1**: message Hi Cozy in Trip.com — arriving ~15:20 (G11, not
  the ~14:30 requested), lower bunk, bag storage on Dec 11 until ~15:30.

**Counts:** tasks 26 → **28** · alarms **27** (one rewritten in place, no id moves) · everything
else unchanged.

## 17 Oct 2026, last — the Dec 9 train is RESERVED: G11, not G7

- **G11, Beijing South 10:05 → Shanghai Hongqiao 14:40**, 4h35, 2nd class — a Trip.com
  **reservation** (number on the card), ILS 330.22 (ticket 307.22 + booking fee 23.00). Not a ticket
  yet: Trip.com buys it when sales open, **12:45 Beijing on Nov 25**, and emails the result within
  2 h. The card stays **pending** (amber) with its reservation number. Every G7 line is gone.
- **Dec 9 retimed:** leave Blossom House **~09:00** (alarm 07:45 → **08:45**), Hongqiao 14:40, Line 2
  to East Nanjing Road ~35–40 min, Hi Cozy ~15:20 (the request sent said ~14:30).
- **Nov 25 alarm → 12:45 "G11 ticket issue — check the Trip.com email after 12:45 Beijing (06:45
  Israel)".** Task `train-shanghai` closed (tasks **26**).
- Trains+flights plan $1,125 → **$1,119**; the eight plans sum to **$8,544**. A reservation is not
  a payment, so nothing new is counted as spent.

## 17 Oct 2026, later still — MU394 BOOKED, CA8609 CANCELLED and REFUNDED

- **MU394** (China Eastern, operated by Shanghai Airlines, also sold as FM9343), Pudong T1 19:10
  → Zhangjiajie T2 21:40, Boeing 737, no meals — **booked on Trip.com, $200.20** (fare $179.20 +
  $21.00), 20 kg checked + one 8 kg carry-on, "eligible for free cancellation". Booking number,
  PNR and e-ticket are on the card (and in the dist gate). Trip.com advises 2 h before, so the
  Dec 11 plan, runbook and alarm now say: **collect the bag at Hi Cozy ~15:30, Line 2, at PVG by
  17:10** (alarm 16:00 → 15:30). Task `mu394` closed.
- **CA8609** cancelled on Trip.com at 13:40 Israel time; **refund issued, $220.20** to the original
  payment method, the **US$20.80** fee kept. The card ships `cancelled` (order number kept for the
  refund); its expense line is now the $20.80 fee. Task `ca8609-refund` → **"Check the $220.20
  reached the card", ~Nov 3**.
- The Dec 9 train stays **not booked**: a Trip.com G7 pre-order made on 17 Oct was cancelled the
  same day. Emails confirmed Agoda's cancellation of Element (03:22 UTC) and the Hi Cozy booking
  (03:06 UTC).
- **Money:** paid **$5,236.44**; committed **$6,301.25**; Trains+flights plan $1,346 → **$1,125**;
  the eight plans sum to **$8,550**, $450 under the cap.
- **Counts:** flights 10 (9 booked, 1 cancelled) · tasks **27** · expenses **16** · alarms 27.

## 17 Oct 2026, later — the Shanghai bed is BOOKED (Hi Cozy hostel), Element is CANCELLED

**The Meliá was never booked.** The owner booked the **Hi Cozy International Hostel East Nanjing
Road** on Trip.com instead — Dec 9 after 14:00 → Dec 11 before 12:00, Male Premium Dormitory, 1
bunk bed, breakfast Dec 10 + 11, **₪136.40 prepaid** (≈$40.12 at the trip's ILS 3.4), **free
cancellation before 18:00 Dec 9** — and **cancelled Element Chongli on Agoda** (pay at the
property, nothing charged). Authority: the second closing section of `accommodation-2026-07-25.md`
and `options/shanghai.md`. **Re-import the seed on the phone.**

- **Beds.** `cn26-stay-13` is the Hi Cozy hostel, **booked**: Trip.com number + PIN on the card
  (the Trip.com family pattern and the PIN list in `check-dist-clean.ts` keep both out of dist),
  the Chinese name 嗨小屋hicozy设计师青旅(外滩南京东路店) on the note and as a new driver card
  (`cn26-place-28`), Room 601, No. 350 Shanxi South Road — **no map button** (not checked in a
  map). `cn26-stay-02` Element is **cancelled**: kept (ids are index-keyed), with none of the
  dead order's numbers, price, card or link; its Agoda ID and allotment number join the dist gate
  as retired credentials. No bed is pending.
- **Days.** Dec 9 Hongqiao → **metro Line 2** (or Line 10) to East Nanjing Road ~35–40 min + 380 m
  on foot; the Bund on foot in the evening. **Dec 10 Disney until the park closes (~21:30)**, metro
  there and back ~60–75 min (Line 2 → 8 → 11, *verify*; the last Line 11 train is disputed, ~22:30
  vs ~23:39, *verify*) or, worst case, a **Didi ordered inside Alipay**, ¥100–150, up to ~¥300 after
  22:00, showing the driver the Chinese name. **Dec 11** bag at the hostel until ~16:00, then
  **Line 2 direct to Pudong** ~60 min (or Line 2 + the Maglev ~40–45 min; Didi 50–70 min), at PVG
  by ~17:45. The Dec 11 runbook says so (step 2).
- **Tasks 30 → 28:** `melia` and `element-cancel` closed. **Alarms 26 → 27:** Dec 11 16:00 now
  "Collect the bag at Hi Cozy → Line 2 to Pudong (PVG) for MU394 19:10"; **+ Dec 10 21:15** "Park
  closes ~21:30 — head for Line 11 or order a Didi in Alipay" (appended — no id moves).
- **Money.** Lodging plan $2,696 → **$2,396**; Shanghai + Disney $287 → **$203** (the taxis became
  the metro: Disney ≤ ¥499 + Premier Access ≤ ¥600 + a Didi back ≤ ¥300 + ~¥50 metro). The eight
  plans sum to **$8,771 — $229 under the cap**, with CA8609 still counted until its refund.
  Committed **$6,101.05** (+ Hi Cozy $40.12); paid **$5,256.44**; forecast **≈ $8,350–9,850**
  (− the Meliá's $317–432, + Hi Cozy $40.12).

**Counts:** stays **14** (12 booked · 1 cancelled · 1 walk-in) · tasks **28** · alarms **27** ·
driver cards **27** · expenses **15** · day-place links **83** (unchanged).

## 17 Oct 2026 — skiing dropped: Dec 9–11 is Shanghai + Shanghai Disneyland, and nothing of it is booked

*Superseded the same evening for the bed — see the section above: the Hi Cozy hostel was booked
and Element cancelled. The rest of this section stands as the record of the morning.*

**Owner decision.** No skiing — too much risk of an injury early in the trip. Dec 9–11 becomes
**Shanghai + Shanghai Disneyland**, on the **late Friday flight MU394**, sleeping at the **Meliá
Shanghai Parkside**. **Nothing new is booked**: every new item is ⏳ pending with a dated task,
and the two Chongli bookings are undone only once their replacements are held. Authority:
**`sources/china-2026/options/shanghai.md`** (the decision + every researched fact, with its
source URL and "seen 17 Oct 2026" — it is also the Shanghai stop's "All the options"), a closing
section in `accommodation-2026-07-25.md`, and dated "superseded" lines in
`days-and-food-2026-07-28.md`. **Re-import the seed on the phone** — and this time the app
changed too (below), so **deploy / rebuild the APK** as well.

- **Days.** Dec 8 "Spa day — rest before Shanghai" (its park-ticket and Macau-ferry jobs kept, +
  cancel Element if still open). **Dec 9** Beijing → Shanghai: taxi to 北京南站, **G7 09:00 →
  Hongqiao 13:35** (¥692 on Trip.com; the December timetable is provisional — *verify*), taxi
  ~32 min to the Meliá, the Bund after dark or rest. **Dec 10** Shanghai Disneyland (~08:30–21:30
  *verify*; ¥439 on Trip.com now, non-refundable, or ¥449–499 direct from ~Nov 11, refundable). **Dec 11** central Shanghai, bag at the Meliá, back ~16:15, taxi to **Pudong** →
  **MU394 19:10 → DYG 21:40** → Wulingyuan ≈22:30. The Dec 11 runbook is rewritten ("the Pudong
  flight"), with MU354 as the fallback reference; the CA8609 fallback lines are gone.
- **Bookings.** ⏳ **added**: the Meliá (`cn26-stay-13`, $317–339 for the 2 nights without
  breakfast, $432 with — every rate free-cancel), MU394 (`cn26-flight-mu394`), the Dec 9 G train (the `dec09` card, rewritten), the Disney
  ticket (`cn26-ticket-disney`). **Removed**: the two Chongli trains (one rewritten in place), the
  Thaiwoo lesson. **Kept, flagged "or instead"**: **Element Chongli** (booked, TO CANCEL) and
  **CA8609** (booked, TO REFUND after MU394; Air China's refund tiers and the 95583 question are on
  the card). The Shanghai stop has **no photo, no coordinate, no spots and no map button** —
  none is verified — and the build names that exception rather than inventing one.
- **Tasks 24 → 30** (`ski-lesson` closed): `melia` **Nov 1** · `disney-ticket` **Nov 12** ·
  `train-shanghai` **Nov 25** (or the 12306 pilot, 60 to 17 days ahead, until ~Nov 22) · `mu394`
  **Dec 1** · `ca8609-refund` **Dec 3** (before the ~18:15 Dec 4 fee tier) · `element-cancel`
  **Dec 8** · `pullman-late` **Dec 9** (the ~22:30 arrival).
- **Alarms 26 → 26.** The Nov 25 window re-pointed at Beijing South → Shanghai Hongqiao (and
  moved 09:00 → 12:30, for the 12:45 sale); the
  Nov 27 Taizicheng → Qinghe window **deleted** (this re-keys the alarm ids after it — harmless on a
  re-import, which replaces them whole); Dec 11 11:00 Chongli check-out → **16:00 "collect the bag
  at the Meliá → Pudong for MU394"**; **+ Dec 9 07:45** leave Blossom House for Beijing South. The
  Dec 9 20:00 Yue Tu and Dec 10 19:45 Jade Dragon alarms stay (signal in the park).
- **Money** (prices from the owner's price comparison of 17 Oct, 04:49–05:15 IDT). Category
  plans: Ski (Chongli) $350 → **Shanghai + Disney $287** (same key) · Trains+flights $1,068 →
  **$1,346** (− 2 Chongli trains, + G7 ~$103, + MU394 at $201 — ceair.com $189.90, Trip.com $201;
  CA8609's $241 stays in until refunded) · Lodging $2,589 → **$2,696** (− Element, + the Meliá at
  $340). The plans sum to **$9,155, $155 over the cap** — visible, and it is CA8609 counted twice
  until its refund. **Forecast ≈ $8,630–10,240** (was ≈ $8,620–10,170): still-to-pay − Element
  $232.95; unpriced + the Meliá $317–339 (+$93 with breakfast), + MU394 $190–201, trains $76 →
  $153, ski $240–408 → Shanghai $143–287, and the CA8609 refund back −$193 to −$241. Nothing was
  paid; "Total spent" is unchanged.
- **Also in this commit:** every Trip.com manage link → `https://www.trip.com/order/all` (the old
  `account/orderlist/` returns 404).
- **App change (dist rebuilt).** `constellation.ts`: a leg that skips a stop with no coordinate
  is never where YOU stand — without it, Dec 11 read **BEIJING · YOU** while you are in Shanghai;
  now there is no YOU star that day until you arrive. And TONIGHT tries YOU's other label spots
  before printing over it (Kunyu → Beijing on the shelf, Dec 5, once Chongli no longer stretched
  the map).

**Counts:** stops 11 (Chongli → Shanghai) · day plans 28 · runbooks 11 · flights 9 → **10** ·
trains 5 → **4** · stays 13 → **14** · experiences 11 · tasks 24 → **30** · alarms **26** · packing
34 → **33** (ski goggles + gloves) · driver cards 28 → **26** · day-place links 89 → **83**.

---

## 29 Sep 2026 — the Nov 22 flight is retimed, the Muping late arrival is chased, the academy is fully resolved

**No app change, no APK rebuild** — `dist/` is byte-identical (only the trip file moved).
**Re-import the seed on the phone.** Authority: a new closing section in
`accommodation-2026-07-25.md` (§1 and §1a), dated corrections in `days-and-food-2026-07-28.md`.

- **✈️ NOV 22 FLIGHT RETIMED.** Trip.com "Important: Your flight has been changed" (29 Sep,
  05:52 local), booking 1653716690406769: Air China replaced **CA8683, PKX 12:35 → YNT 13:45**
  with **CA8641, PKX 15:00 → YNT T2 16:20**, Economy — the owner **accepted the free change on
  Trip.com the same day**. Same order; the PNR **QEH9EM** and ticket **999-5036940536** are
  carried forward ⏳ **unverified** (no "Change Completed" notice, unlike CA1953→CA8609's).
  The EY888 connection widened **3h50 → 6h15** (EY888 lands PKX 08:45), so the "EY888 is late"
  HSR fallback's threshold widens **~2.5 h → ~5 h** and the Oct 12/Nov 22 08:30 cash-exchange
  plan now has plenty of slack. Old CA8683 (12:35/13:45) is kept only as history; the flight's
  stable id stays `cn26-flight-ca8683` (precedent: `cn26-flight-ca1953` kept its id through its
  own 27 Sep retime onto CA8609). Yantai Penglai → Muping: ~69 km, ~1 h 15 by taxi (verify) —
  hotel by roughly 18:00–19:00.
- **🏨 MUPING LATE ARRIVAL, ⏳ NOT YET VISIBLE.** The same day, a Trip.com chat message and a
  special request — "Late arrival around 19:00 … please keep my room, I will pay in cash at
  the desk" — were sent for the Jinjiang Inn Select order (1653717166174001, arrival was
  18:00). **The order page does not show it yet** — it still reads only "Non-smoking room. High
  floor." New task **`muping-late-arrival`**, due mid-Nov: check the order again nearer the
  trip; if it still is not there, call the hotel direct — ☎ **+86-535-3399333** (24-hour desk,
  now also on the Nov 22 arrival runbook).
- **✅ THE ACADEMY IS FULLY RESOLVED.** A WhatsApp voice note answered the school's own 6-point
  message of 28 Sep, point by point: the Muping pickup from 10:30 is "no problem"; the **Nov 28
  class time** — "the school will arrange and will let you know after your arrival"; the **Dec 5
  driver's price** — "after your arrival, the school translator will help you on that";
  registration with Jennifer and the arrival items (2 passport photos, cash, printed insurance)
  are confirmed; and the **US$940 cash figure is "all correct."** Neither small thing left over
  from 28 Sep is a pre-trip email to chase any more — both are answered by arriving. The
  `kunyu-email` task is **reworded**, not closed, to say so.

**Counts:** tasks 24 → **25** (`kunyu-email` reworded, not closed; **+ `muping-late-arrival`**).
Day plans, runbooks, alarms, flights, stays and every other count are unchanged — nothing was
added or removed, only rewritten. **Gates:** check 0 errors · **454** tests · parity **136
critical + 92 structural** · rehearsal unaffected · dist clean.

## 1 Oct 2026 — the Four Points late arrival had already been passed on (28 Sep)

**No app change, no APK rebuild** — `dist/` is byte-identical (only the trip file moved).
**Re-import the seed on the phone.** Authority: a 1 Oct addendum in
`accommodation-2026-07-25.md`, a dated correction in `days-and-food-2026-07-28.md`.

- **🏨 FOUR POINTS (Dec 5) — ✅ ALREADY TOLD.** A Gmail check found Trip.com's email of 28 Sep,
  11:57: "Special request passed on to Four Points by Sheraton Beijing Sanlitun Workers
  Stadium" — *"I will arrive around 17:30 on Saturday 5 December 2026 (flight lands at Beijing
  Capital T3 at 16:15). Please keep my room."* The app still said "message it before Dec 5" in
  five places (the Dec 5 day, the Dec 5 runbook, the CA1560 flight card, the beds task, the
  CA1560 alarm); all five now say it is done, and the booking gains the chip and a dated note.
  The desk number stays as the fallback from the taxi.
- **Still nothing from Phoenix** in Gmail (written confirmation asked 28 Sep) — not blocking
  since the school accepted the certificate as it stands (29 Sep).

**Counts:** unchanged — only text moved. **Gates:** check 0 errors · 1,081 tests pass · parity
**136 critical + 92 structural** · build + dist check clean.

---

## 29 Sep 2026 (later the same day) — the Muping request lands, the school accepts the insurance, and a new arrival message

**No app change** — `dist/` is byte-identical (data-only). **Re-import the seed on the phone.**
Authority: a further closing section in `accommodation-2026-07-25.md` (§1a and the arrival
requirements), `days-and-food-2026-07-28.md` §5, and `insurance-quotes-comparison.md`. Source:
the school's WhatsApp (14:58) and a Trip.com email (11:09), both 29 Sep.

- **✅ MUPING LATE ARRIVAL — PASSED ON TO THE HOTEL.** Trip.com confirmed at 11:09: "Special
  request passed on to Jinjiang Inn Select Yantai Muping Bus Station Xi Guan Night Market Hotel."
  The ~19:00 arrival request sent that morning has reached the hotel. Task `muping-late-arrival`
  is **closed** (tasks 25 → 24); the Muping bed's own record and the Nov 22 day plan/runbook are
  rewritten from "not yet showing on the order" to "passed on to the hotel 29 Sep, 11:09."
- **✅ INSURANCE — THE SCHOOL ACCEPTS THE PHOENIX CERTIFICATE AS IT STANDS.** Asked directly: "Yes,
  as long as it can cover any illness or injuries of China, then it is no problem." Phoenix's own
  written confirmation and re-issued certificate (asked 28 Sep) are now a **nice-to-have, not
  blocking** — the academy's own acceptance is what actually gates training, and it is satisfied.
- **🆕 A NEW ARRIVAL INSTRUCTION.** The school's own words: "Once you arrived at that hotel, please
  send a message to me" — refining the 11 Aug "once you arrived China, let me know" into a
  specific moment, on arrival at the Jinjiang Inn Select, Muping, **~19:00 on Nov 22**, needing
  working mobile data (the trip eSIM, plan A) already active. Added to the Nov 22 day plan, the
  arrival runbook, the Kunyu stop's "Getting there" block, the Kunyu and insurance wallet cards,
  the "Kunyu arrival" info card and the `kunyu-arrival` / `p-insurance` packing text.

**Counts:** tasks 25 → **24** (`muping-late-arrival` closed). Nothing else added or removed — every
other count is unchanged. **Gates:** seed build (map layer 211 places / 133 pins / 182 details) ·
check 0 errors · **1082** tests · parity **136 critical + 92 structural** · build (bundle budgets
all under) · rehearsal **207/207** with the network hard off · dist byte-identical (checked out
after a verification build) · both privacy checks absent.

---

## 28 Sep 2026 — the academy answered; the Muping bed and the Dec 5 flight are booked

**No app change, no APK rebuild** — `dist/` is byte-identical (only the trip file moved).
**Re-import the seed on the phone.** Authorities: `accommodation-2026-07-25.md` (§1 CA1560 +
*"THE ACADEMY'S ANSWERS"*, §1a, a closing section) · `days-and-food-2026-07-28.md` (Dec 5, §5,
§7) · `insurance-quotes-comparison.md`.

- **✅ NOV 22 BED — BOOKED.** Jinjiang Inn Select Yantai Muping Bus Station Xi Guan Night Market
  Hotel, 锦江之星品尚酒店(烟台牟平汽车站西关夜市店), No. 460 Moushan Road, Muping, ☎ +86-535-3399333 ·
  Trip.com, confirmation email 28 Sep 06:20 UTC · Standard Twin, 1 night · **free before check-in ·
  PAY AT HOTEL ¥164.00 IN CASH**, no card, no deposit · 18:00 arrival declared. Committed, unpaid.
  **The twelfth bed exists; nothing is open.** No map button (the Blossom House rule).
- **✅ DEC 5 FLIGHT — BOOKED AND PAID.** Air China **CA1560, YNT T2 14:55 → Beijing Capital PEK
  T3 16:15**, PNR NE1K88, **$110.30** (fare $104.30 + taxes $6.00), 20 kg + 5 kg, C909. **Air China
  retimed it before it was bought** — the plan's 15:40 → 17:15 is dead. **Lands at Capital, not
  Daxing.** The academy books the driver to YNT (price ⏳); leave the school ~11:30–12:00. New Dec 5
  runbook, day plan, flight card, alarm. The flight card opens no map: YNT has no verified name.
- **✅ THE ACADEMY ANSWERED ALL FOUR** (WhatsApp, 28 Sep): **no training Saturdays or Sundays**; Dec 5
  "fine … better before 4 p.m."; **Nov 28: a free 1–2 h shifu class**, accepted (time ⏳) — Nov 28 is
  now a written day; **PSB: the school does it** ("school Jennifer … will do all for you");
  **the $100 was a one-time APPLICATION FEE, NOT part of the $840** → cash for the school is
  **US$940**, one reading, never netted; **stay in Muping, pickup from 10:30** in the lobby (not
  11:00). Mandatory: **cash** (school takes USD/EUR/RMB, owner pays USD — see THE CASH PLAN below),
  **a paper insurance certificate**, **two passport photos**. School rules recorded.
- **✅ INSURANCE (Phoenix, phone, 28 Sep): the martial-arts training IS covered — verbal.** Written
  confirmation + a re-issued certificate naming it asked by email (⏳). The English certificate's
  24/7 line **+972-3-7331177** now fills the app's emergency list. **Print the certificate ×2.**
- **27 Sep, recorded:** ~20:00 arrivals **sent** to Huatian (email via Trip.com's relay) and
  Glenview (Trip.com app); Yue Tu said **"no problem"** (23:09 UTC) to the Dec 10 Jade Dragon
  reservation — the Dec 9 confirm alarm stays.
- 🆕 **Four Points (Dec 5)**: its order asks to be told of arrivals after 17:00, and CA1560 lands at
  16:15 — **message it before Dec 5** (on the beds task, the Dec 5 day and runbook).

**Counts:** flights 8 → **9** · stays 12 → **13** · day plans 27 → **28** (Nov 28) · runbooks
10 → **11** (Dec 5) · tasks 27 → **23 → 24** (closed: `yantai-flights`, `yantai-bed`, `psb`,
`late-arrivals`; `kunyu-email` rewritten to the two small things still due; **+ `cash-plan`, later
the same day**) · alarms 22 → **24 → 26** (+ Nov 23 10:00 lobby, + Dec 5 11:00 leave; the Nov 20
Yantai→Beijing train window marked done; **+ Oct 12 10:00 buy-the-cash, + Nov 22 08:30 exchange,
later the same day**) · packing 30 → **32 → 34** (US$940 school cash, two passport photos;
insurance "print ×2"; **+ the Reserve envelope, + the Hong Kong cash note, later the same day**) ·
expenses 13 → **14**.
**Gates:** check 0 errors · **452** tests · parity **135 critical + 89 structural** · rehearsal
**110/110** offline (+3: the pre-28 Sep holes are proved by setting the two bookings aside in
IndexedDB and restoring them) · dist clean, **15** patterns (Trip.com family widened to the new
`1653717` epoch; PNRs NE1K88 + QEH9EM and the domestic e-tickets added). New guard: the seed fails
if any sentence puts the $100 beside the $840 as "comes off / counts against / part of" without a
negation.

### Added 28 Sep 2026 (later the same day) — THE CASH PLAN: no ATM withdrawals anywhere in China
**Owner decision.** No ATM withdrawals in China — dollars are brought from home and exchanged
once. ~~**Buy US$1,700 more, due Mon 12 Oct 2026, 10:00 Israel**~~ *(superseded 17 Oct: US$1,500
ordered at Bank Hapoalim, collected at Ben Gurion on Nov 21 — see the top)* — already holding US$300,
this carries **US$1,800 total**, clean/recent/undamaged bills.
Three envelopes, packed before Nov 21: **School US$1,000** (the $940 due to the academy Nov 23,
$60 margin) · **Exchange US$600 → ≈¥4,200** at the Beijing Daxing (PKX) international-arrivals
counter, Sun 22 Nov, after immigration and before domestic check-in (French passport, keep the
receipt) · **Reserve US$200** (was $400 until 17 Oct), untouched. The ≈¥4,200 covers ¥164 Muping (cash) + ~¥1,000 near the
school + ~¥1,500 for Tiger Leaping Gorge (Dec 18–19, cash only) + ~¥500 elsewhere, margin the
rest; everything else is card, via Alipay/WeChat Pay. Hong Kong, Dec 21: ~US$50 → HKD at HKG for
cash-only spots (Yat Lok). Same Oct 12 task: **tell the bank** about China + Hong Kong (Nov 21 –
Dec 27); two cards, two places. **New app alarms:** Oct 12, 10:00 Israel (buy the cash + tell the
bank) and Nov 22, 08:30 Beijing ("Change US$600 → RMB at the Daxing arrivals exchange counter
(passport), before domestic check-in" — also on the owner's Google Calendar). Every earlier
"withdraw RMB / ATM at Beijing airport" instruction in the app and its sources is replaced.
**Budget unaffected** — exchanging currency is not spending; every figure in the money table below
stands as written. **No app change, no APK rebuild** — `dist/` is byte-identical (data-only).
**Gates:** tasks 24 · alarms 26 · packing 34 · check 0 errors · **452** tests · parity **135
critical + 89 structural** · rehearsal unchanged.

### 💰 Money — 28 Sep 2026 (USD at the trip's 7.15 ¥ / 7.8 HK$)

| | Before (27 Sep) | Now |
|---|---:|---:|
| **Paid** | $5,106.02 | **$5,216.32** (+ CA1560 $110.30) |
| Bookings committed (the app's "Booked & committed") | $6,401.64 | **$6,534.88** (+ $110.30 + Muping ¥164 ≈ $22.94) |
| All-in committed (+ insurance $148.40 + the academy's $100 fee) | $6,550.04–6,650.04 | **$6,783.28** — one reading |
| Still to pay | $1,444.02–1,544.02 | **$1,566.96** (Element $232.95, Pullman ¥887.52, Huatian ¥419, Glenview ¥1,166, Yue Tu night 2 ¥428.65, Dali ¥324, Halfway ~$20, **Muping ¥164**, academy $840) |
| Category plans (sum) | $8,820 | **$8,833** — trains+flights 1,078 → 1,068, lodging 2,566 → 2,589; $167 under the cap |

**FORECAST — every unpriced line is an ESTIMATE.** The "Yantai bed" and "Dec 5 flight" rows are
gone (real figures above); one new estimate row.

| Still unpriced | Low | High | Basis |
|---|---:|---:|---|
| 4 train legs (Dec 9, 11, 14, 20) | 76 | 76 | the repo's planned fares ~¥90 / ~$13 / ~$35 / ~$15 |
| Nov 22 HSR — only if EY888 is late | 0 | 70 | ~$60–70 (repo) |
| Kunyu winter uniform | 50 | 50 | in writing, 13 Aug |
| 🆕 Dec 5 school driver to YNT (~1.5 h) | 50 | 50 | **ESTIMATE** — the repo's ~$50 for the same ~1.5 h ride (the Nov 23 taxi fallback); price asked 28 Sep |
| Ski: lesson ~¥998 + lift / rental / goggles | 240 | 408 | ¥998 verify; lift ~$60–80/day, rental ~$40/day (repo) |
| Great Wall guide + driver | 180 | 180 | ~$180 solo (repo) |
| Mainland tickets | 142 | 300 | repo + review (unchanged) |
| HK / Macau | 84 | 412 | repo + review (unchanged) |
| Beijing wellness | 150 | 576 | repo figures (unchanged) |
| Travel eSIM | 25 | 40 | the repo's July figure — verify |
| Gear run (Muping now) | 56 | 98 | ¥400–700 (repo) |
| Local transport | 115 | 230 | **ESTIMATE** $5–10/day × 23 days |
| Food, the 23 days the academy does not feed you | 665 | 900 | repo: ~$25/day mainland, ~$40/day HK |
| **Unpriced subtotal** | **1,833** | **3,390** | |
| + paid $5,216.32 + still to pay $1,566.96 | | | |
| **TRIP TOTAL** | **≈ $8,620** | **≈ $10,170** | **vs the $9,000 cap: low ≈ $380 under, high ≈ $1,170 over** |

Refundable floats still left out: $50 academy room-keeping, ¥800 Huatian deposit, ¥150 earpiece
deposit, US$29.52 Yue Tu deposit.

### Asks now out (28 Sep)
| Asked | Of | Status |
|---|---|---|
| 27 Sep | Kunyu academy (WhatsApp) | ✅ **ANSWERED 28 Sep** — ⏳ still due: the **Dec 5 driver's price** and the **Nov 28 class time** (`kunyu-email`, chase mid-Nov) |
| 28 Sep | Phoenix (email, infom@fnx.co.il) | ⏳ written confirmation + a re-issued certificate naming the martial-arts cover (verbal yes by phone) |
| 27 Sep | ~~Element Chongli (ski lesson, via Agoda)~~ | **moot — skiing dropped 17 Oct**; Element was cancelled on Agoda the same day |
| 28 Sep | Four Points (Trip.com special request) | ✅ ~17:30 arrival **passed on to the hotel 28 Sep, 11:57** (found 1 Oct) |

---

## 27 Sep 2026 (still later) — Yue Tu confirms the Dec 10 reservation; the owner takes the gorge bag off the table entirely

Two more messages closed out the evening. **Yue Tu Inn, Booking.com, 16:36 UTC:** a week-ahead
reservation "will definitely ensure you get it" — so the Jade Dragon tour CAN be reserved on the
Dec 10, 7-days-ahead release after all — and "sorry I don't have the contact information for
Tina's Inn." **The owner replied the same evening:** reserve the tour on **10 December** for
**Thu 17 Dec, 1 person, with the big glacier cable car**; will **confirm with the inn on 9
December** that it went in; and will **organise the gorge luggage himself** — Yue Tu and Tina's
bus both drop out of the bag question for good.

**Jade Dragon (Dec 17): now RESERVED, not a race.** The Dec 10, 20:00 public release — WeChat
mini-programs 玉龙雪山服务 + 丽江旅游集团 — becomes a **fallback only**. A new alarm, **Dec 9,
20:00 Beijing**, has the owner confirm with the inn (Booking.com message or WeChat
yanglei400371) that tomorrow's reservation is in; the existing Dec 10, 20:00 alarm stays,
reworded to fire only if that confirmation did not hold.

**The gorge bag (Dec 18–19): OWNER DECISION — Option B.** Take the public bus Lijiang → Qiaotou
with the big bag; leave it in the luggage room at **Jane's Guesthouse, Qiaotou** (≈¥5 for one or
more days, non-guests welcome); hike with a day pack; on Dec 19 ask the shared car leaving Tina's
for Dali to **stop at Jane's to collect the bag** — drivers leaving Middle Gorge routinely do
(tripadvisor.co.za · nomadasaurus.com · saporedicina.com, 27 Sep 2026). Tina's own bus (Option A)
is now the backup only, its contact still unknown. The bag task (`lijiang-bagtransfer`, due
Dec 13) is closed — there is nothing left to book — and becomes a packing note instead: "day pack
for the hike, everything else stays at Jane's." The Dec 18/19 day plans, runbooks, road cards and
`options/gorge.md` are rewritten to match, and every "the bag goes to Tina's" line is gone. Bus
timing Lijiang → Qiaotou and the Dali car's own route through Qiaotou stay <span>verify</span>.

**CA8609 (Dec 11): the airline PNR and baggage are resolved.** Trip.com's "Change Request Has
Been Completed" notice (27 Sep, 12:45 UTC, booking `1653716183770225`, application 2499148444)
confirms **Airline Booking Reference PLF8S9 and E-ticket 999-5274485740 are UNCHANGED**, and
baggage is **20 kg checked + 1 carry-on 5 kg**. Nothing on this leg is still *verify*.

**Asks now out, updated:**
| Asked | Of | Status |
|---|---|---|
| 27 Sep | Yue Tu Inn | ✅ **RESOLVED** — Dec 10 reservation confirmed possible; owner confirms with the inn Dec 9; bag arranged by the owner (Option B) |
| — | CA8609 PNR/baggage | ✅ **RESOLVED** — unchanged, confirmed by Trip.com |
| 27 Sep | Kunyu academy (WhatsApp) | ⏳ still out |
| 27 Sep | Element Chongli (ski lesson, via Agoda) | ⏳ still out, no reply yet |
| — | Phoenix (phone call) | scheduled **28 Sep, 12:00** |

**Money:** the gorge bag transfer's ¥25–50 estimate becomes **¥5** (Jane's Guesthouse storage) in
the forecast's "Local transport" line — a small saving, not worth restating the range.

Counts: tasks 28 → **27** (`lijiang-bagtransfer` closed) · alarms 21 → **22** (+ Dec 9, 20:00).
**No app change yet** — the seed rebuild and gates follow this note.

---

## 27 Sep 2026 (later that evening) — Yue Tu answers again: pickup confirmed, the tour timed, the bag transfer declined

The inn replied a second time on Booking.com, **14:53 UTC**, to the 13:23 UTC reply described
below. It settles three things and reverses one: **the ¥80 airport pickup is CONFIRMED** (arranged
one day ahead, paid at the inn — cash / WeChat / Alipay); **the Jade Dragon tour's terms are set**
— booked **3 days ahead by default**, departure **~06:30**, return **~17:00**, the cable-car ticket
**non-refundable once reserved except for weather** (refund, or a smaller cable car with the
difference refunded); and **payment for the second night and all services is cash / WeChat /
Alipay**. It reverses one thing: **the bag transfer to Tina's is DECLINED** — the inn will not
move it itself, and suggests contacting "the hotel you booked for Tiger Gorge" instead, which does
not fit since Halfway is a deliberate walk-in. The owner replied again, **~15:00 UTC**, confirming
the pickup and the tour, asking whether the inn can reserve at the **Dec 10, 7-days-ahead release**
instead of 3 days out, what the fallback is if the big cable car is unavailable, and asking the inn
to book a seat on **Tina's Guesthouse's own morning bus** (Lijiang ~08:00, per the same evening's
web research) with the driver carrying the big bag on to Tina's. ⏳ **Awaiting answer.**

**Nothing was booked.** The bag transfer's decision deadline is unchanged, **Dec 13** — it is now a
question for Tina's bus, not the inn's declined car. The Dec 10, 20:00 Jade Dragon alarm stays, now
worded: if Yue Tu has not confirmed a Dec 10 reservation, DIY via the two mini-programs, and tell
the inn either way. Updated: `accommodation-2026-07-25.md` (§8, plus a new closing note),
`days-and-food-2026-07-28.md` (Dec 16–18, §1.3, §7), `legacy/index.html` (the Lijiang/gorge day
plans and stops, the Dec 16/18 runbooks, the Yue Tu wallet card, the `jade-dragon` and
`lijiang-bagtransfer` tasks, three alarms, one packing chip), and `app/scripts/china/road.ts` +
`tickets.ts` on the Wallet's Travel tab. Gates and rebuild follow this note.

---

## 27 Sep 2026 (evening) — the review run: three decisions, sixteen fixes, and a forecast

A three-way review ([the checkup page](https://claude.ai/artifact/RRKi6NiMPEYZdvtjYWPyNu)) read
the whole plan against Gmail and the web. The owner decided three things; everything else was a
correction. **Nothing was booked or cancelled. No app change** — `dist/` is byte-identical, so
**no APK rebuild: re-import the seed on the phone.** Authorities: a closing section in
`accommodation-2026-07-25.md` and dated corrections through `days-and-food-2026-07-28.md`.

**Owner decisions.** (1) **Tianmen stays on Dec 14, by the new route.** (2) **Dec 20: train into
Kunming Station 昆明站** (central — keeps the Green Lake evening) → the airport ibis; fallback
**Kunming South → straight to the ibis**; trains/times verify when sales open (Dec 5/6).
(3) **Dec 25: early dim sum → Ngong Ping 360 by ~09:30 → Tai O**; Lung King Heen is optional.

- 🔴 **R1 Royal Garden** — the card said "free to 14:00 Dec 19" and "$1,232.01 at the hotel" two
  months after it was **paid in full (30 Jul) and made non-refundable (31 Jul)**. Now: PAID ·
  NON-REFUNDABLE · nothing due · keep the 31 Jul email offline. The deadline list lost its fake
  Dec 19 entry. **Gated** (assert + parity + test + rehearsal): the dead window cannot come back.
- 🔴 **R2 Tianmen** — upper cableway (middle station → summit) shut since **6 Nov 2025** for "at
  least one year"; east glass skywalk shut since **12 May 2026**; up by cable car → shuttle bus →
  escalators; west-line + Panlong Cliff open (enghunan.gov.cn · travelzhangjiajie.com ·
  voc.com.cn). New task: **re-check late Nov before buying**; Huatian's ¥300 waits. Gate: nothing
  may promise "the longest cableway".
- 🟠 **O1 eSIM is plan A** (April 2026 VPN crackdown) — new `esim` task, early Nov, tested before
  Nov 21; NordVPN is the backup everywhere (runbooks, checklist, packing, info cards).
- 🟠 **O2 Nov 22** — the HSR card said "neither is booked"; it is now the **"EY888 is late"** plan
  (separate tickets; >~2.5 h late loses CA8683; next flight or HSR, times verify; a night of slack).
- 🟠 **O3 PSB** within 24 h at the academy — new `psb` task (Nov 23), day plan, info cards.
- 🟠 **O4** — new `late-arrivals` task, **this week**: Trip.com message to Huatian (Dec 13) and
  Glenview (Dec 14, window 15:00–16:00) — "arriving ~20:00". Dec 14 train time/station = verify.
- 🟠 **O5 Jade Dragon** — two WeChat mini-programs (玉龙雪山服务 / 丽江旅游集团), no windows since
  1 Jan 2026, ≈¥260 DIY (Yue Tu said ¥120 for the cable car — verify), morning slot, altitude rules,
  Spruce Meadow 云杉坪 as the low option. Dec 10 alarm stays.
- 🟠 **O6 Gorge** — 2026 incidents recorded; fallback decided (Tea Horse by ~15:00, else sleep
  there; closed/icy → minibus to Tina's). New **Dec 18 runbook** so Home shows it on the day.
- 🟠 **O7 Dec 20** — "Kunming South in Xiaguan" was wrong (Xiaguan is Dali's station); the old
  town → station leg added; new **Dec 20 runbook** (crit). Gate: Kunming South is never "in Xiaguan".
- 🟠 **O8 Dec 22** — return ferry **~16:15** (was ~17:15, ~30 min of slack), or Macau → Kowloon
  (TST) if a sailing runs (verify); the Dec 8 19:00 alarm says so.
- 🟢 **G1** Nutcracker per-day dates (live 11–13, 18–20, 22–26 Dec, both shows Dec 24) → Dec 24
  option; Symphony of Lights "retirement announced, date not set" (still running 21 Sep).
- 🟢 **G2** exit day: alarm **09:30**, leave the ibis ~10:15, terminal by 10:50 — one time everywhere.
- 🟢 **G3** park ticket ¥165, 4 days, bought by the owner Dec 6/8; bag at the Pullman desk Dec 13.
- 🟢 **G4** Qinghe → Daxing ~1 h 20 + 30–60 min traffic; "at Qinghe by ~14:30" stays.
- 🟢 **G5** Alipay/WeChat Pay foreign-card limits ~US$5,000/payment; WeChat Pay fee-free < ¥200.
- 🟢 **G6** Happy Valley Dec 23 confirmed ("Winter Wonderland Wednesday") → `hkjc` closed · HK Phil
  unchanged · visa-free policy to 31 Dec 2026 re-sourced.
- 🟢 **G7** stale text: "nothing left to book", "13 nights", gear run Nov 29, academy "~$990–1,090",
  "$85.68 spent", "three beds unknown terms", "6 Aug next deadline", "$890/month", ski ~$50–70 vs
  ¥998 (now ~¥998, verify), Ronghui optional, `Sun Nov 22 →` label → `Mon Nov 23 →`. Tasks
  `hotel-beijing`, `hotels-mainland`, `hk-xmas` closed; the 6 Aug on-sale alarm marked done.

**Counts:** tasks 27 → **28** (−4 closed, +5: `late-arrivals`, `esim`, `tianmen-recheck`, `psb`,
`ngong-ping`) · runbooks 8 → **10** · alarms 21 (one marked done). **Gates:** check 0 errors ·
**450** tests · parity **121 critical + 84 structural** · rehearsal **107/107** offline · dist
clean. Also fixed in passing: a parity check whose regex held a literal backspace
(`/29[78]\x08/`) and so could never fire now reads `\b`, as intended.

### 💰 Money — the committed figure reconciled, and a forecast

**"$6,402 committed" is the app's bookings-only total** ($6,401.64 = Etihad ~$2,026 + four domestic
flights $881.30 + twelve beds $3,406.01 + the concert $88.33). It leaves out two payments that are
not bookings: **insurance $148.40** and the **Kunyu deposit $100**. All-in committed is **$6,650.04**
if the deposit is separate from the $840, or **$6,550.04** if the school counts it against the $840
(asked 27 Sep — unanswered). That is the "gap" the review found: $148.40–$248.40.
Of it, **$5,106.02 is paid** and **$1,444.02–$1,544.02 is still to pay** (Element $232.95, Pullman
¥887.52, Huatian ¥419, Glenview ¥1,166, Yue Tu night 2 ¥428.65, Dali ¥324, Halfway ~$20, academy
$740–$840).

**FORECAST — every unpriced line is an ESTIMATE** (USD at the trip's 7.15 ¥ / 7.8 HK$):

| Still unpriced | Low | High | Basis |
|---|---:|---:|---|
| Yantai bed, Nov 22 | 40 | 70 | repo budget (yantai-bed task) |
| Dec 5 Yantai → Beijing flight | 99 | 121 | Kiwi 27 Sep, verify (HSR $60–70 is cheaper) |
| 4 train legs (Dec 9, 11, 14, 20) | 76 | 76 | the repo's planned fares ~¥90 / ~$13 / ~$35 / ~$15 |
| Nov 22 HSR — only if EY888 is late | 0 | 70 | ~$60–70 (repo) |
| Kunyu winter uniform | 50 | 50 | in writing, 13 Aug |
| Ski: lesson ~¥998 + lift / rental / goggles | 240 | 408 | ¥998 verify; lift ~$60–80/day, rental ~$40/day (repo) |
| Great Wall guide + driver | 180 | 180 | ~$180 solo (repo) |
| Mainland tickets (Palace ¥40, park ¥165–360, Tianmen ¥257–300, 1949 ¥180–600, Jade Dragon ¥260 DIY–¥550 tour, gorge ¥65 + Lijiang fee ¥50, Naxi 0–¥180) | 142 | 300 | repo + review |
| HK / Macau (ferries HK$388–484, Ngong Ping HK$270–350; high adds Nutcracker ≤HK$1,280, Lung King Heen ≥HK$770, Aqua Luna ~HK$330) | 84 | 412 | repo + review |
| Beijing wellness (Bodhi, tuina, Jiuhua ¥129–369, bone-setting ¥150–600; high adds Qushui Lanting ¥1,500–2,500 and Ronghui) | 150 | 576 | repo figures |
| Travel eSIM | 25 | 40 | the repo's July figure — a 35-day plan: verify |
| Yantai gear run | 56 | 98 | ¥400–700 (repo) |
| Local transport (taxis, DiDi, metro, airport runs, ~$25 gorge car, ¥80 LJG pickup, bag ¥5, Octopus) | 115 | 230 | **ESTIMATE** $5–10/day × 23 days — no repo figure |
| Food, the 23 days the academy does not feed you | 665 | 900 | repo: ~$25/day mainland, ~$40/day HK (guide v12); high = the Food category plan |
| **Unpriced subtotal** | **1,922** | **3,531** | |
| + paid $5,106.02 + still to pay $1,444.02 (low) / $1,544.02 (high) | | | |
| **TRIP TOTAL** | **≈ $8,470** | **≈ $10,180** | **vs the $7,500 budget: over by ≈ $970 – $2,680** |

Refundable floats are not costs and are left out: $50 academy room-keeping, ¥800 Huatian deposit,
¥150 earpiece deposit, US$29.52 Yue Tu deposit. **The $7,500 cap does not hold on the repo's own
figures** — it was set on 26 Jul while the Int'l flights line still planned $1,050 against the
$2,026 already paid. **Category plans rebuilt** (the lodging precedent — plans follow money paid or
put in writing, nothing else shaved): Int'l flights 1,050 → **2,026**, Kunyu training 1,090 →
**990** (890 if the deposit is netted), Trains+flights 650 → **1,078** ($881.30 paid + ~$121 Dec 5
estimate + ~$76 trains). The eight plans now sum to **$8,820** against the $7,500 budget — visible
on the Money screen rather than hidden. The budget itself is the owner's number and was not moved.

**Same evening — the owner did move it.** Reading this forecast against a cap last set 26 Jul (Int'l
flights $1,050 vs $2,026 now paid), the owner raised it 27 Sep 2026 from $7,500 to **$9,000** — the
realistic middle between what the category plans already commit to ($8,820) and what the forecast's
high end could still cost (≈$10,180). Against $9,000, the eight plans leave **$180 of headroom**
instead of running $1,320 over. Of the forecast range above: the **low, ≈$8,470, now sits under the
cap**; the **high, ≈$10,180, is still over — by ≈$1,180**, not ≈$2,680. Nothing above this note was
rewritten — every figure above was accurate against the cap that held when it was written. Same
precedent as the $6,500 → $7,500 raise on 26 Jul, recorded the same way in
`accommodation-2026-07-25.md`.

## 27 Sep 2026 — Gmail audit: three beds had answers since July, two "bookings" were never made

The owner's inbox was read against the repo. Nothing was booked or cancelled; the record moved.
Authorities updated: `accommodation-2026-07-25.md` (§3, §8, §10 and a dated closing section) and
`days-and-food-2026-07-28.md` (Dec 10, 16–19, 22, 25; the §2.1 table; §7 verify list).

- **Blossom House (§3) was PREPAID in full and has a deadline.** Trip.com confirmation email,
  27 Jul: **"Prepay Online — Paid" US$299.56** = Google Pay $246.60 + **gift card $52.96**, VAT
  $16.96 incl. **Free cancellation before 23:00 on Dec 4** (hotel time), non-refundable after,
  no-show charged. Also: hotel confirmation **R9000388217900556001** (now the card's second
  line, the Element arrangement — not a PIN), check-in after 14:00 / out before 12:00,
  breakfast for 1 on Dec 8 + 9, ☎ +86-10-53859000, 1 king bed, and a door address —
  **北京西城区德内大街羊房胡同9号** — on the note, **deliberately not a map button** until it has
  been checked in Amap on the phone. The §2 Four Points mistake, made twice.
- **Money: paid $4,806.46 → $5,106.02** (lodging $1,562.43 → $1,861.99, five beds).
  **Committed stays $6,402** — the $299.56 was already the bed's price; it only changed column.
  Budget stays **$7,500**. Counted whole: the gift card was the owner's money.
- **Yue Tu (§8) DID answer the special request — 28 Jul, 00:12 UTC.** Pickup 80; a 550 Jade
  Dragon tour incl. the biggest cable car; a ~550 car to the gorge carrying the bag on to
  Tina's. WeChat **yanglei400371**. **Owner replied 27 Sep 13:23 UTC**: yes to the pickup
  (3U8011, LJG 22:00); yes to the tour **only if the cableway ticket is guaranteed**; no to the
  car (public bus), **bag only** to Tina's; asked a package price and how/when to pay night 2.
  ⏳ **No answer.** The **Dec 10 20:00 cableway alarm stays**, annotated "may be replaced".
- **Dali (§10) late arrival was APPROVED on 27 Jul** — 22:00–23:00, no charge. The desk still
  shuts at 23:00, so every "declare an arrival" warning became **"WhatsApp +86 189 8708 1208 your
  ETA when you leave Tina's"** — card chip, Dec 19 runbook, road card, and a new **Dec 19 08:00**
  alarm. The gate now fails if "not declared" survives anywhere in the seed.
- **Macau ferry (Dec 22) and Ngong Ping 360 (Dec 25) are NOT booked** — the day plans said
  "pre-booked" / "booked"; no confirmation exists. Both Experiences cards were already `pending`
  and stay amber; the day lines, tasks and cards now say so. Ferry: book **Dec 8, 19:00 Beijing**
  (the alarm moved there from Dec 18, a no-signal trail day); online closes 48 h before sailing.
  Ngong Ping: **HK$270 Standard / HK$350 Crystal** (np360.com.hk, 2026), book **Nov 15, 12:00
  Israel**; Klook/KKday free-cancel to 24 h.
- **New alarm: Dec 4, 20:00** — Blossom's free window shuts at 23:00. Alarms 19 → 21.
- **No app change, no APK rebuild** — `dist/` is byte-identical. **Re-import the seed on the phone.**

### Asks now OUT, awaiting answers (27 Sep)
| Asked | Of | What | Blocks |
|---|---|---|---|
| 27 Sep | **Element Chongli** (via Agoda) | English ski lesson, first-time skier, Dec 10 | the `ski-lesson` task |
| 27 Sep | **Kunyu academy** (WhatsApp) | Dec 5 departure time + airport drop · Sat Nov 28 · PSB · deposit vs $840 · city-centre pickup | **the Dec 5 YNT→Beijing flight** |
| 27 Sep, ~15:00 UTC | **Yue Tu Inn** (Booking.com relay) — **reply received 27 Sep 14:53 UTC, follow-up sent same evening** | pickup CONFIRMED · tour terms set · bag DECLINED, now asking for a Tina's bus seat + bag | awaiting the Dec 10 booking answer + Tina's bus, decision by **Dec 13** |
| **28 Sep 12:00** | **Phoenix** (phone call) | is amateur Sanda training covered? | open question 1 below |

**Dec 5 flight stays unbooked** until the academy answers. Candidates (Air China, **Kiwi prices
27 Sep — verify**): CA1546 10:25→PEK 11:50 ~$108 · **CA1560 15:40→PEK 17:15 ~$121 (preferred)** ·
CA8642 17:55→**PKX** 19:30 ~$99 · CA1594 22:10→PEK 23:30 ~$100. On the `yantai-flights` task.

**eSIM:** the Trip.com eSIM of 24 Aug (1 day, activate before 23 Oct) was **only a test that
Alipay accepts the card** — not the trip's connectivity. The real eSIM — **plan A since the April
2026 VPN crackdown**, Hong Kong-routed, ~30 days mainland + ~5 HK/Macau, activate-before date after
22 Nov — is bought early November and tested before 21 Nov (the `esim` task).

## 27 Sep 2026 — Air China retimed CA1953 to 07:45; rebooked free onto CA8609 PKX 18:15→DYG 20:30

- **Dec 11 now flies Air China CA8609, Beijing DAXING (PKX) 18:15 → Zhangjiajie DYG T2 20:30**,
  2 h 15, Economy, Boeing 737-800. Same Trip.com order `1653716183770225`, **$0** to change,
  **$241.00** paid in total. Source: the owner's Trip.com "Change Completed" screen.
- **The airport warning is inverted everywhere**: "PEK Capital, NOT Daxing" became
  **"Daxing, NOT Capital"** — day plan, runbook, flight card, rail card, alarm, info card, driver
  cards. A parity check now fails the build if "not Daxing" survives anywhere in the seed.
- **Dec 11 is rewritten** (`days-and-food`, Dec 11): anchor = the flight; meal = eat at PKX before
  security; droppable = a short last morning on the greens before Element's 12:00 check-out.
  HSR Taizicheng → **Qinghe** (aim to arrive by ~14:30, no train chosen), Qinghe → Daxing
  ~1.5 h *(verify)*, **at PKX by ~16:45**, Pullman **≈21:30**. The Dec 11 rail card now opens
  Qinghe; the day's chips are 太子城站 · Qinghe · PKX · DYG · 武陵源.
- ✅ **RESOLVED 27 Sep 2026** (Trip.com "Change Request Has Been Completed", 12:45 UTC, application
  2499148444): **Airline Booking Reference PLF8S9 and E-ticket 999-5274485740 are UNCHANGED**
  after the change; baggage confirmed **20 kg checked + 1 carry-on 5 kg**. Nothing on this leg is
  still *verify*.
- **Pullman still goes non-refundable at 00:00 on Dec 11** — a missed CA8609 is a lost room too.
- **No app change, no APK rebuild**: only the trip file moved (`dist/` byte-identical). **Re-import
  the seed on the phone.** The flight keeps its id (`cn26-flight-ca1953`, named for the order).

## What is actually paid for

- **Flights** — all four Etihad legs (~$2,026) and the five internal flights (**CA8683 $117.30** /
  **CA1560 $110.30**, bought 28 Sep / $241 / $230 / $293)
- **Beds** — five have taken money, **$1,861.99**: Four Points in full ($244.74), **Blossom House
  in full ($299.56, found 27 Sep)**, Yue Tu's first night ($59.95), the ibis in full ($25.73),
  and **The Royal Garden in full, $1,232.01** (30 Jul), which also made it the only
  **non-refundable, unamendable** booking on the trip — nothing is due at its desk
- **The concert** — HK Phil, 22 Dec, HK$689
- **Insurance** — Phoenix Smart, policy `260676675684357`, $148.40
- **Kunyu application fee** — $100, one-time, **not part of the $840** (the school, 28 Sep)

*Committed but paid at the desk: the Muping night, **¥164 in cash** on Nov 22; the academy's
**US$940 in cash** on Nov 23.*

## What is not, and when it can be

| When | What |
|---|---|
| ~~This week~~ | ~~Message Huatian + Glenview: arriving ~20:00~~ ✅ **sent 27 Sep** |
| ~~When the academy answers~~ | ~~Dec 5 flight · the Nov 22 bed~~ ✅ **both booked 28 Sep** (CA1560 · Jinjiang Inn Select, Muping) |
| ~~Before Dec 5~~ | ~~Tell Four Points you arrive after 17:00~~ ✅ **passed on 28 Sep** (~17:30; CA1560 lands PEK 16:15) |
| **16 Oct** | **Reserve abroad permit** — add the contact person's address, sign, submit to the unit; then the commander, information security and the reserve officer sign · check it came back approved **~29 Oct** |
| ~~17 Oct~~ | ✅ ~~**THE CASH PLAN — order the cash**~~ **ordered 17 Oct: US$1,500 at Bank Hapoalim ("מט״ח בטרמינל"), collect 21 Nov at Ben Gurion (Natbag)** · **tell the bank** about China + Hong Kong (Nov 21 – Dec 27) · two cards, two places |
| **18 Oct** | **Register the 12306 account** (verification 3–5 working days — check ~26 Oct) — for the Dec 14 and Dec 20 trains |
| **22 Oct** | **The doctor's reply** — the fitness report (signed, English, fit for intensive kung fu training 23 Nov – 5 Dec, passport name) |
| **Before Nov 21** | ✅ ~~Print the insurance certificate~~ **printed 15 Oct** · **two passport photos** · the fitness report — missing any one "is not allowed" |
| **21 Nov, 12:00 Israel** | **Collect the US$1,500 at the Bank Hapoalim counter, Ben Gurion (Natbag)** — passport/ID of the collector as in the order · if the flight date changes, update the order → split School $1,000 · Exchange $600 · Reserve $200 |
| **Mid-Nov** | Chase the academy if silent: **the Dec 5 driver's price** and **the Nov 28 class time** · chase Phoenix for the **written** martial-arts confirmation |
| **Early Nov** | **Buy the trip eSIM** (plan A), install and test before Nov 21 |
| ~~**15 Oct**~~ | ~~Thaiwoo English ski lesson~~ — **moot: skiing dropped 17 Oct** |
| ~~**1 Nov**~~ | ~~Book the Meliá Shanghai Parkside~~ — ✅ **the Hi Cozy hostel booked instead, 17 Oct** (₪136.40 prepaid; free cancel before 18:00 Dec 9) |
| **by 12 Nov** | **Shanghai Disneyland ticket for Dec 10 — chosen: 1 Day Ticket + Premier Access of 14, ILS 1,183 on Trip.com, non-refundable** (Shanghai Disney Resort → Tickets → Attraction tickets; passport details at booking, bring the same passport) · ⏳ not bought |
| ~~**now → 25 Nov, 12:45**~~ | ~~Dec 9 G7~~ — ✅ **G11 reserved on Trip.com 17 Oct**; the ticket is issued when sales open, 12:45 Nov 25 (alarm) |
| ~~**1 Dec**~~ | ~~Book MU394~~ — ✅ **booked 17 Oct** |
| **~3 Nov** | ~~Refund CA8609~~ — ✅ **cancelled 17 Oct, $220.20 refund issued**: check it reached the card |
| **1 Dec** | **Message Hi Cozy in Trip.com**: arriving ~15:20 on Dec 9 (G11), lower bunk, bag storage Dec 11 until ~15:30 |
| ~~**8 Dec, 23:59**~~ | ~~Cancel Element Chongli on Agoda~~ — ✅ **cancelled 17 Oct**, nothing charged |
| **9 Dec** | **Tell the Pullman you arrive ~22:30 on Dec 11** |
| **15 Nov** | Great Wall guide · **Ngong Ping 360, Dec 25 — by ~09:30 (12:00 Israel — free-cancel to 24 h)** · **download the concert e-Ticket and keep it OFFLINE** |
| **Late Nov** | **Re-check Tianmen** (upper cableway + east skywalk shut) before buying anything |
| **22 Nov, 09:30 Beijing** (was 08:30; EY888 lands 08:45) | **Change US$600 → ≈¥4,200 at the Daxing arrivals exchange counter** (passport, keep the receipt), before domestic check-in — no ATM withdrawal anywhere on this trip · pay the Muping hotel **¥164 in cash** |
| **23 Nov** | **Pickup from 10:30** in the Muping hotel lobby · pay the school **US$940 cash** · PSB: **the school registers you** (hand over the passport) |
| **4 Dec, 23:00** | Blossom House's free cancellation ends (already paid) — alarm 20:00 |
| **6 / 8 Dec** | **Zhangjiajie park ticket, ¥165** — yourself, never Dec 7 |
| **8 Dec, 19:00 Beijing** | **Macau ferry, both legs** (return **~16:15** — the concert is 19:30; or Macau → Kowloon if it runs; online closes 48 h before) |
| **Nov–Dec** | Trains, as each 15-day window opens. **The Dec 20 Dali→Kunming leg is visa-critical** — Kunming Station 昆明站, fallback Kunming South; sales Dec 5/6 |
| **29 Nov, 20:00 Beijing** | Forbidden City, exactly 7 days ahead. Passport IS the ticket |
| **9 Dec, evening (Beijing)** | **Confirm with Yue Tu that they reserve the Jade Dragon tour tomorrow, Dec 10** — Booking.com message or WeChat yanglei400371 |
| **10 Dec, 20:00 Beijing** | **Jade Dragon — fallback only.** The working plan is Yue Tu's ¥550 tour, reserved today on the 7-days-ahead release (inn confirmed 27 Sep); WeChat mini-programs 玉龙雪山服务 + 丽江旅游集团, morning slot, are the DIY fallback if last night's confirmation did not hold |

## The three open questions

1. ~~**Is amateur Sanda training covered?**~~ ✅ **Covered — verbal, 28 Sep 2026** (Phoenix, by
   phone). The rider's wording (*"במסגרת תחרות או אימונים לקראת תחרות"*) was the doubt; the answer
   is yes, and it is **not yet in writing** — the owner emailed infom@fnx.co.il the same day for
   written confirmation and a re-issued certificate naming the martial-arts cover (⏳). The current
   English certificate does not mention sport. Print whichever certificate is newest, ×2.
2. **The Royal Garden prepayment is acknowledged, not verified.** Reservations said it
   would "pass to our Account Department". Worth one line in writing, saved offline — and until
   then, **the hotel's 31 Jul email is the proof: keep it offline.** (The app card now says PAID ·
   NON-REFUNDABLE · nothing due.)
3. ~~**The academy's four small asks**~~ ✅ **ALL ANSWERED 28 Sep 2026**: no training on Saturdays
   or Sundays (Dec 5 "fine … better before 4 p.m."; Nov 28 a free shifu class) · the school does
   the PSB registration · the $100 was a one-time application fee, NOT part of the $840 · stay in
   Muping, pickup from 10:30. What is left is small: the Dec 5 driver's price and the Nov 28 class
   time.

---

## Lantern Run C — the last build run before the Nov 1 freeze (13 Aug 2026)

**Google Drive backup, opt-in.** The one thing a file in Downloads cannot do is survive the
phone itself. Scope is `drive.appdata` — the app sees only its own folder, never the owner's
Drive. Payload is the same `livingthedream/backup` bytes the Backup screen already saves,
gzipped, last 10 kept. Auto-backup is debounced and **only ever runs online**; offline it is
a silent no-op, because offline is normal on this trip.

> **One owner-only step remains.** Google issues an OAuth client id to a *person*, in a
> console, and it cannot be scripted or invented. The app therefore ships with the credential
> `null` and the Backup card says *"Not connected — needs a one-time Google setup"* out loud.
> Five minutes of console work, then a two-minute test on the phone:
> **[docs/DRIVE-SETUP.md](docs/DRIVE-SETUP.md)**. Nothing in this repo has ever talked to
> Google, deliberately — no test fakes a login, and the rehearsal proves the opposite.

**Three small road tools**, all built from data the trip already carried, none of them new
facts: an **offline converter** (rates from the trip, or from what you actually spent, or
typed off the board — each labelled with where it came from and when), a **health &
insurance** section that gathers the policy, the 24-hour line, the local numbers and the
medicine note onto one screen, and **two clocks** on any flight whose own printed flying time
proves its ends keep different time (the four Etihad legs; every domestic Chinese leg stays
silent, correctly).

**Hardening.** The last hard-coded `rgba()` in the app — Home's timeline cards — became
tokens and now flips with the theme. The rehearsal grew an a11y floor swept across seven
screens: every button has a name, every control shows focus.

**Deferred, on purpose:** runbook templates, connectivity guide, transit primer, document
scanning, budget alerts. All Run B / public-product territory, which stays post-trip.

---

## Trips after this one (26 August 2026)

The multi-trip promise now has a mechanism, and it is a form plus a scaffold, not a feature.
Three artifacts: **[docs/TRIP-BRIEF-TEMPLATE.md](docs/TRIP-BRIEF-TEMPLATE.md)**, a blank brief you
fill in as prose; **[docs/NEW-TRIP.md](docs/NEW-TRIP.md)**, the five-step loop — fill, compile,
import, book the open items with Claude, paste the confirmations back; and
`app/scripts/trip-template/`, the builder scaffold whose `assert.ts` is imported rather than
copied, so every trip compiled from a brief passes the same gate. The rule it all turns on:
**every flight and bed line starts `- ✅ BOOKED —` or `- ⏳ OPEN —`** — ✅ becomes a booking with
its reference, ⏳ becomes a `pending` placeholder plus a dated task, amber and only ever amber.
A worked example compiles to `seed/template-example.trip.json` (`npm run seed-build:template-example`,
slug `tx00`). **Nothing in `app/src/` moved: no app change, no APK rebuild, the Nov 1 freeze untouched.**

---

## Rules this repo actually enforces

Not aspirations — each one is a gate that fails the build.

- **Never invent a trip fact.** Bookings, prices and addresses come from `seed/` and
  `sources/`; `verify:china` re-checks them against the original documents.
- **A wrong pin is worse than no pin.** Every map name passes `verify:places` against
  OpenStreetMap *and* Wikidata. About one in seven failed and ships **no button**, each
  with its reason written down.
- **The phone outranks the gate.** Names that OSM answers, Amap does not — 菩提 returns
  a district, Tina's returns a different guesthouse. Both were demoted on device evidence.
- **Two runtime calls, both disclosed, both optional.** Weather (open-meteo, toggleable) and
  the opt-in Drive backup — nothing else, ever. No analytics, no crash reporting. The
  rehearsal proves it with the network hard off, and proves the Drive path makes **zero**
  requests while it is not connected.
- **No personal data in the bundle.** `check:dist` greps every built file and fails.
- **Nothing is "booked" unless it is.** Five rail legs and ten experiences ship `pending`, and
  every future trip inherits the rule: the brief template refuses an ⏳ OPEN line that does not
  compile to both a placeholder and a dated task.

## Traps that cost real time

- **`legacy/index.html` is single-quoted JS — escape every apostrophe.** Pasted text never is.
- **`encodeURIComponent` leaves `'` alone**, and a literal apostrophe kills a Google Maps
  link stone dead. Everything goes through `enc()` now.
- **Amap echoes your query**, so "is the name on screen" matches your own question. Assert
  on the result card.
- **Wireless debugging: read the PAIRING port from mDNS**, not from the screenshot — it
  moves. Then `-s`, because pairing leaves two entries for one phone.
- **Building the APK needs JDK 21** at `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`;
  Gradle caches a daemon on whichever JVM started it, so `--stop` after changing `JAVA_HOME`.

---

## Working on it

```bash
cd app
npm run seed-build && npm run check && npm test && npm run verify:china && npm run build
npm run preview & npm run rehearsal      # the offline dress rehearsal
npm run verify:places                    # network, ~15 min. Exit 2 = throttled, NEVER demote on it
```

Every change to the trip starts in `sources/` or `legacy/index.html` — never in
`seed/china-2026.trip.json`, which is generated.

# Where this stands — 27 September 2026

*One page, kept current, so any session or person can pick this up cold. For what the app
IS see [OVERVIEW.md](OVERVIEW.md); how to use it, [README.md](README.md); how it is built,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); why it exists, [ABOUT.md](ABOUT.md).*

**The trip: China, 21 Nov – 27 Dec 2026. 37 days. One traveller, French passport.**
55 days out at the time of writing.

---

## The app, in numbers

| | |
|---|---|
| Tests · parity · rehearsal | **450** · 121 critical values + 84 structural facts · **107/107 with the network hard off** |
| Contrast gate | **104 pairs in each of 2 palettes**, 0 failures |
| Bundle | **158.7 KB gzipped JS** against a 200 KB budget · 21.7 KB CSS |
| Places that open in a map | 145 spots · 28 driver cards · 11 stops · 18 travel bookings |
| Day plans with tappable places | 89 links across 25 days |
| Beds | **13 arrangements**: **11 booked** (incl. the academy fortnight, $840 in writing) + the gorge guesthouse, a deliberate walk-in + the ⏳ **Yantai night of Nov 22, still open** (waits on the academy) |
| Rail | 5 legs, **all pending** — not one ticket bought |
| Experiences | 11, of which **1 booked** (the concert) |
| **Money** | **$6,402 committed** in bookings (**$6,550–6,650 all-in** with insurance and the deposit) of a **$9,000 budget** (raised from $7,500, owner, 27 Sep 2026) · **$5,106.02 already paid** · **forecast ≈ $8,470–10,180** (estimates — see below) |

Installed on the phone as `com.livingthedream.travel`. The trip arrives as a file you
import; the app itself ships empty and a build gate proves it.

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
| Local transport (taxis, DiDi, metro, airport runs, ~$25 gorge car, ¥80 LJG pickup, bag ¥25–50, Octopus) | 115 | 230 | **ESTIMATE** $5–10/day × 23 days — no repo figure |
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
- ⏳ **Not known, not guessed:** the airline PNR and e-ticket number after the change (the card
  still shows PLF8S9 / 999-5274485740, labelled *pre-change, verify*), and whether the
  20 kg + 5 kg baggage carried over.
- **Pullman still goes non-refundable at 00:00 on Dec 11** — a missed CA8609 is a lost room too.
- **No app change, no APK rebuild**: only the trip file moved (`dist/` byte-identical). **Re-import
  the seed on the phone.** The flight keeps its id (`cn26-flight-ca1953`, named for the order).

## What is actually paid for

- **Flights** — all four Etihad legs (~$2,026) and the four internal flights (**CA8683 $117.30** /
  $241 / $230 / $293)
- **Beds** — five have taken money, **$1,861.99**: Four Points in full ($244.74), **Blossom House
  in full ($299.56, found 27 Sep)**, Yue Tu's first night ($59.95), the ibis in full ($25.73),
  and **The Royal Garden in full, $1,232.01** (30 Jul), which also made it the only
  **non-refundable, unamendable** booking on the trip — nothing is due at its desk
- **The concert** — HK Phil, 22 Dec, HK$689
- **Insurance** — Phoenix Smart, policy `260676675684357`, $148.40
- **Kunyu deposit** — $100

## What is not, and when it can be

| When | What |
|---|---|
| **This week** | **Message Huatian + Glenview on Trip.com: arriving ~20:00** (the `late-arrivals` task) |
| **When the academy answers** | Dec 5 Yantai → Beijing flight (CA1560 preferred — verify) · the Nov 22 Yantai bed |
| **Early Nov** | **Buy the trip eSIM** (plan A), install and test before Nov 21 |
| **15 Oct** | Thaiwoo English ski lesson — not bookable before the winter schedule loads (Element asked 27 Sep) |
| **15 Nov** | Great Wall guide · **Ngong Ping 360, Dec 25 — by ~09:30 (12:00 Israel — free-cancel to 24 h)** · **download the concert e-Ticket and keep it OFFLINE** |
| **Late Nov** | **Re-check Tianmen** (upper cableway + east skywalk shut) before buying anything |
| **23 Nov** | **PSB registration within 24 h** at the academy |
| **4 Dec, 23:00** | Blossom House's free cancellation ends (already paid) — alarm 20:00 |
| **6 / 8 Dec** | **Zhangjiajie park ticket, ¥165** — yourself, never Dec 7 |
| **8 Dec, 19:00 Beijing** | **Macau ferry, both legs** (return **~16:15** — the concert is 19:30; or Macau → Kowloon if it runs; online closes 48 h before) |
| **Nov–Dec** | Trains, as each 15-day window opens. **The Dec 20 Dali→Kunming leg is visa-critical** — Kunming Station 昆明站, fallback Kunming South; sales Dec 5/6 |
| **29 Nov, 20:00 Beijing** | Forbidden City, exactly 7 days ahead. Passport IS the ticket |
| **10 Dec, 20:00 Beijing** | **Jade Dragon — sells out in minutes**; WeChat mini-programs 玉龙雪山服务 + 丽江旅游集团 only, morning slot — *may be replaced by Yue Tu's ¥550 tour if the inn confirms the ticket is guaranteed* |

## The three open questions

1. **Is amateur Sanda training covered?** The Phoenix rider covers sport *"במסגרת תחרות או
   אימונים לקראת תחרות"* — in a competition, or training toward one. **Kunyu is neither.**
   The task was closed on 6 Aug once the policy was bought; the question moved onto the
   insurance wallet card, Hebrew and all. Wanted in writing before 22 Nov. **Call booked with
   Phoenix: 28 Sep, 12:00.**
2. **The Royal Garden prepayment is acknowledged, not verified.** Reservations said it
   would "pass to our Account Department". Worth one line in writing, saved offline — and until
   then, **the hotel's 31 Jul email is the proof: keep it offline.** (The app card now says PAID ·
   NON-REFUNDABLE · nothing due.)
3. **The academy's four small asks** (13 Aug — address and price are ANSWERED; the school's
   own taxi card is now the driver card): the Saturday/departure-day schedule (it gates the
   Dec 5 flight booking), PSB registration, whether the sent deposit counts against the $840,
   and whether pickup could be from the city centre instead of Muping. **All sent on WhatsApp
   27 Sep**, with the Dec 5 departure time and an airport drop — no answer yet.

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

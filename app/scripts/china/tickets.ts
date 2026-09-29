/* THE ELEVEN THINGS THIS TRIP GOES TO, AND THE ONE THAT IS ACTUALLY BOUGHT.

   Until 2026-08-06 the Wallet held flights, trains, beds and cards. On 6 Aug the
   owner bought a concert ticket — the trip's first spend that is not transport,
   a bed or a border — and discovered it had nowhere to live: it was in the Dec 22
   day plan and in the money, and absent from the one screen you hold up at a
   counter. This file is that gap closed, for the concert and for every other
   bookable thing the trip already names.

   IT IS A TRANSCRIPTION, NOT A PLAN. Every price, date, release hour, deposit and
   deadline below is quoted from `legacy/index.html` — the trip's own to-do list
   and day plans — or from `sources/`, and each entry carries the lines it came
   from in `source` so the claim can be traced without leaving the file. Nothing
   is researched here. Where a document says "verify", so does the card.

   ─────────────────────────────────────────────────────────────────────────
   EXACTLY ONE IS BOOKED, AND TEN ARE NOT

   `hkphil` is `booked`: bought at the 10:00 Hong Kong on-sale on 6 Aug 2026,
   with a ticket reference, a seat and a receipt. It is the ONLY one, and every
   other entry ships `pending` without exception — the trip's own key dates still
   say to buy each of them, several inside windows measured in minutes. Rounding
   any of them up to booked would tell the owner there is nothing left to chase,
   which is the worst lie this app can tell. rail.ts says the same thing about
   its five legs, for the same reason.

   ONLY THE BOUGHT ONE CARRIES A `priceNote`. `priceNote` is what the money
   screen's "Booked & committed" card totals — it answers "what am I already
   committed to" — so a quoted ¥300 for a ticket nobody owns must not reach it.
   The documented figures are all here, as `meta` chips, labelled as the
   estimates and asking-prices they are. Ten rows then count as unpriced on that
   card, which is the literal truth.

   AND THE CONCERT IS NOT DOUBLE-COUNTED. Its HK$689 already exists as the
   expense `cn26-exp-prepaid-hkphil` (transform.ts), which feeds "Total spent".
   `priceNote` feeds a different card — the same way The Royal Garden, the ibis
   and Yue Tu carry both a price on the ticket and an expense for the money that
   left the account. A pending ticket has no expense at all.

   ─────────────────────────────────────────────────────────────────────────
   WHAT IS NOT HERE, AND WHY

     Happy Valley races (Dec 23) — the day says "HK$10 … Walk-up is fine; only
       balcony seats and dining packages need booking". A wallet full of places
       you can walk into is a wallet nobody reads. The `hkjc` task asks the trip
       to CONFIRM the fixture, which is a question to answer, not a ticket to buy.
     Yat Lok, Tim Ho Wan, Australia Dairy and the rest — the same rule. They are
       already spots on the city guides. LUNG KING HEEN IS THE EXCEPTION and is
       here: it needs a reservation weeks ahead and carries a minimum spend.
     The Naxi Ancient Music concert (Dec 17) and the Jiuhua hot springs (Dec 8) —
       no document says either needs booking, and "ring ahead" is not a ticket.
     The National Museum (Dec 8) — it really does want a reservation 7 days
       ahead, but it is the day's GREY-DAY SWAP, a contingency rather than a
       plan, and no task asks for it.
     The SZSST clinic (task `szsst`) — an undecided side trip to another city,
       marked "Still unresearched". A decision, not a booking.

   ─────────────────────────────────────────────────────────────────────────
   THE MAP BUTTONS ARE BORROWED, NEVER COMPOSED

   `placeId` names an entity that ALREADY EXISTS and has ALREADY passed
   `verify:places` — a driver card (`cn26-place-NN`) or a stop's spot
   (`<stopKey>/<spotId>`) — and transform.ts copies that entity's own decision.
   It is the same resolver the rail legs use, and it THROWS rather than drops: if
   a referenced entity ever stops opening, the build fails with the id in the
   message instead of quietly shipping a card with a dead button.

   TEN OF THE ELEVEN OPEN. The Thaiwoo ski lesson does not, and that is the rule
   working: 太舞滑雪小镇 (`cn26-place-25`) is the one place card on this trip that
   has never had a coordinate to certify a name against, so it ships nothing —
   and neither does anything that would borrow from it. */
import type { HHMM, ISODate } from '../../src/lib/model/types';

export interface TicketEntry {
  /** `cn26-ticket-<key>` — keyed by the thing, not by an index. */
  key: string;
  date: ISODate;
  /** The card's headline. */
  title: string;
  /** Where it happens, in the words the documents use. */
  venue?: string;
  /** Only where a document states a start time for the thing itself. */
  time?: HHMM;
  /** `booked` for the concert. `pending` for everything else, without exception. */
  status: 'booked' | 'pending';
  /** The counter-facing reference. A ticket nobody has bought carries none. */
  code?: string;
  codeLabel?: string;
  codeSub?: string;
  /** ONLY on something actually paid for — this is what the booked total adds up. */
  priceNote?: string;
  /** Gmail search for the confirmation, where one exists. */
  gmailQuery?: string;
  /** The platform an unbought ticket is actually bought on, where a document
      names one. Never a deep link to an order that does not exist. */
  bookingLinkUrl?: string;
  /** An entity that already passed the gate, to borrow a location from. */
  placeId?: string;
  /** k/v chips, exactly as a flight's `meta` works. `true` marks it warning. */
  meta: [string, string, boolean?][];
  /** md-lite, drawn under the chips. */
  note: string;
  /** Draw the note as an alert. */
  alert?: boolean;
  /** The document line(s) this card was transcribed from. Not shipped — it is
      here so the next reader can check the card against its source. */
  source: string;
}

/** In the order the trip meets them. */
export const TICKETS: TicketEntry[] = [
  /* ── Dec 6 · THE PASSPORT IS THE TICKET ──
     A 7-day release at a fixed hour, bought inside WeChat against the passport
     number. The trip already carries an alarm for the release; this is the card
     you look at on the day. */
  {
    key: 'forbidden-city',
    date: '2026-12-06',
    title: 'Forbidden City · timed entry',
    venue: 'Palace Museum 故宫博物院',
    status: 'pending',
    placeId: 'beijing/palace-museum',
    bookingLinkUrl: 'https://en.dpm.org.cn',
    meta: [
      ['Price', '¥40 (~$6), winter rate'],
      ['Released', 'Nov 29, 20:00 Beijing — exactly 7 days ahead', true],
      ['Bought in', 'the WeChat mini-program 故宫博物院'],
      ['ID', 'the passport number must match', true],
    ],
    note:
      'Released **20:00 Beijing time, exactly 7 days ahead** — an alarm is already set for **Nov 29**. Bought through the WeChat mini-program **故宫博物院** against the passport number: **the passport IS the ticket**, so it has to be the one you travel on.',
    source:
      'Task `forbidden`: "**Forbidden City tickets** for Dec 6 — release 20:00 Beijing time, exactly 7 days ahead" / "Winter ¥40 (~$6) via the WeChat mini-program 故宫博物院. Passport number must match; the passport IS the ticket. Set a phone alarm." · Day 2026-12-06 line 0: "**Forbidden City** — passport IS the ticket (¥40, winter rate)" · guide key date, Nov 29: "Forbidden City tickets — winter ¥40 (~$6) · release ~20:00 Beijing time, 7 days ahead, WeChat mini-program 故宫博物院"',
  },
  /* ── Dec 7 · THE ONE THAT IS A PACKAGE, NOT A TICKET ──
     A guided day with a driver, and the three things that must be agreed in
     writing are all logistics rather than money: the hour, the bag and where you
     are put down at the end of it. Their default pickup is an hour later than
     the one this day needs. */
  {
    key: 'wall-guide',
    date: '2026-12-07',
    title: 'Great Wall guide · Jinshanling wild wall',
    venue: 'Wild Great Wall — in-gate Jinshanling → East Five-Window Tower ("Tower 22")',
    status: 'pending',
    placeId: 'beijing/jinshanling',
    bookingLinkUrl: 'https://wildgreatwall.com/itinerary/jinshanling-wohushan-1-day-hiking/',
    meta: [
      ['Price', '~$180 solo (list $100–150 pp at 2+)'],
      ['Book by', 'mid-Nov'],
      ['Pickup', '06:30 — their default is 07:30', true],
      ['From', 'Four Points Sanlitun, checked out'],
      ['Drop-off', 'Blossom House, Houhai'],
      ['Route call', 'the longer Wohushan cross-section is guide-only'],
    ],
    note:
      'Confirm **in writing**: the **06:30 pickup** (their default is 07:30) **at Four Points Sanlitun**, the bag in the car all day, and the **drop-off at Blossom House, Houhai**. ~7 km / 3.5–5 h, heading down by ~13:30 and out the East Gate before 15:00 — **carry your own food and 2 L of water**, there is no reliable food on that stretch and no signal to summon any.',
    source:
      'Task `wall-guide`: "Book the **Dec 7 Great Wall guide package** — Wild Great Wall, ~$180 solo" / "Route: in-gate Jinshanling → East Five-Window Tower (\'Tower 22\'). The longer Wohushan cross-section is guide-only — decide at booking. Confirm IN WRITING: 6:30 pickup (their default is 7:30) **at Four Points Sanlitun**, bag in the car all day, **drop-off at Blossom House, Houhai**." · Day 2026-12-07 lines 0–3 · guide key date, mid-Nov: "Wild Great Wall ~$180 solo (list $100–150 pp at 2+)"',
  },
  /* ── Dec 10 · THE ONE THAT CANNOT BE BOUGHT YET ──
     Researched on 29 Jul and found not bookable at all: the season had not
     opened and the resort's own English site is years stale. So the card says
     the route rather than the price — the bed is inside the resort and the hotel
     is the channel that actually works.
     IT SHIPS NO MAP BUTTON. 太舞滑雪小镇 is `cn26-place-25`, the one place card
     that never had a coordinate to certify its name against, so it opens nothing
     — and a ticket that borrowed from it would open nothing either. */
  {
    key: 'ski-lesson',
    date: '2026-12-10',
    title: 'Thaiwoo English group ski lesson',
    venue: 'Thaiwoo — the ski school is downstairs from the bed',
    status: 'pending',
    bookingLinkUrl: 'https://www.thaiwoo.com/product/ticket',
    meta: [
      ['Price', '~¥998 "all-in" group lesson — one unverified source; verify what it covers', true],
      ['Bookable from', 'Sept–Oct, once winter schedules publish', true],
      ['Asked', 'Element Chongli via Agoda, 27 Sep — no answer yet'],
      ['Not bookable yet', 'researched 29 Jul 2026', true],
      ['Best route', 'ask Element Chongli to arrange it'],
      ['Property', '+86 313 477 8500 · booking 683386279'],
      ['Level', 'beginner — greens only'],
    ],
    note:
      '**Not bookable yet** (researched 29 Jul 2026): the Chongli season runs late Nov–late Mar and the booking system wants a ski date. ⚠️ Their **English site is stale** — still advertising 2022–23 — and the price pages return a session error, so do not judge availability by it. The academy itself is real: international coaches teaching in English, which is why this resort was chosen.\n⭐ **Ask Element Chongli to arrange it** — a Marriott, English-speaking, and the ski school is downstairs. Quote the stay as **Dec 9–11, Studio King**. The **~¥998 "all-in" group price is one unverified source** — *verify* whether it covers the lift pass and rental or the lesson alone.',
    source:
      'Task `ski-lesson`: "Book the **Thaiwoo English group lesson** (~$50–70) for Dec 10" / "**RESEARCHED 29 Jul 2026 — it is NOT bookable yet.** … ⚠️ **Their ENGLISH site is stale** … 1. ⭐ **Email or phone Element Chongli and ask them to arrange it.** … Agoda booking **683386279** … the property\'s own number, **+86 313 477 8500**. Quote the stay as **Dec 9–11, Studio King** … ⚠️ The **~¥998 \'all-in\' group price** is one unverified source" · Day 2026-12-10 line 0: "Group lesson (booked ahead) + full practice day on the greens" · guide key date, Sept–Oct: "Book the Thaiwoo English group lesson ~$50–70 (Dec 10) once winter schedules publish"',
  },
  /* ── Dec 12 · THE PARK PASS, AND THE PRICE THAT LOOKED WRONG ──
     Huatian offered two tickets on 26 Jul and priced both on the 27th. This
     one, at ¥500, never looked right, and on 2026-09-27 the trip decided: the
     park ticket is ¥165, passport real-name, valid 4 consecutive days, and it
     is bought by the owner on Dec 6 or 8 — never Dec 7, the wall day with no
     signal. Huatian's offer is recorded and not needed. */
  {
    key: 'forest-park',
    date: '2026-12-12',
    title: 'Zhangjiajie Forest Park · park pass',
    venue: 'Wulingyuan park gate 武陵源 — for Dec 12–13',
    status: 'pending',
    placeId: 'cn26-place-10',
    meta: [
      ['Price', '¥165 — passport real-name, valid 4 consecutive days'],
      ['Buy it', 'yourself, Dec 6 evening or Dec 8 — never Dec 7 (no signal)', true],
      ['Huatian asks', '¥500 — not needed (decided 27 Sep)'],
      ['Extras', 'Bailong lift, Tianzi / Yangjiajie cableways — normally separate (verify)'],
    ],
    note:
      '**Decided 27 Sep 2026: buy it yourself.** The park ticket is **¥165, passport real-name, valid 4 consecutive days** (checked 27 Sep 2026) — buy it on the **Dec 6 evening or Dec 8**, never on **Dec 7**, the wall day with no signal. You sleep 900 m from the East Gate with a passport that works at the counter.\n💴 Huatian offered park tickets for Dec 12–13 at **¥500** — about a third over the ≈¥360 window estimate for entry + eco-bus + one Bailong round trip *verify*. **Not needed.** The Bailong lift and the Tianzi / Yangjiajie cableways, which Dec 13 uses, are normally sold separately *verify*.',
    source:
      'Task `huatian-tickets`: "the hotel messaged first on 26 Jul … Forest Park tickets for Dec 12–13 \'more favourable than the window\' … On 27 Jul they priced two of the three: **Tianmen ¥300** and **Forest Park ¥500** … The park at the window is roughly ¥360 for the same use (¥165 flat entry since the 2025 reform, 4 days, plus eco-bus and one Bailong round trip), so ¥500 is about a third over — and you sleep 900 m from the East Gate with a passport that works at the counter. Ask them to break the ¥500 down and to say whether it covers the **Tianzi and Yangjiajie cableways**" · Day 2026-12-06 line 5: "⚠️ **Book the Zhangjiajie Forest Park entry tonight too** (for Dec 12) unless Huatian is selling it — it wants ~5 days\' notice, and 5 days before Dec 12 is Dec 7, the wall day with no signal"',
  },
  /* ── Dec 14 · THE ONE THAT CHANGED UNDER THE PLAN ──
     Until 2026-09-27 this was the clearest case for letting a hotel sell you a
     ticket at a margin. Then the review found the 2026 facts: the main
     cableway's upper section (middle station → summit) has been suspended for
     renovation since 6 Nov 2025, "at least one year", and the east-line glass
     skywalk has been closed since 12 May 2026. The owner kept the day, by the
     new route. The ¥300 package waits for the late-November re-check. */
  {
    key: 'tianmen',
    date: '2026-12-14',
    title: 'Tianmen Mountain · ticket + cableway',
    venue: 'Tianmen Mountain 天门山 — the hotel is 450 m from the cableway',
    time: '08:00',
    status: 'pending',
    placeId: 'cn26-place-11',
    meta: [
      ['Upper cableway', 'middle station → summit SHUT since 6 Nov 2025 for renovation, "at least one year"', true],
      ['The way up', 'cable car → shuttle bus → escalators'],
      ['East glass skywalk', 'CLOSED since 12 May 2026 — no reopening date', true],
      ['Open', 'west-line + Panlong Cliff walkways, Heaven\'s Gate (verify)'],
      ['Re-check', 'late Nov, before buying anything', true],
      ['Huatian asks', '¥300 — do NOT buy before the re-check', true],
      ['At the window', '~¥257 (verify)'],
      ['Entry', '08:00, the first of the day'],
      ['On the day', 'ask the desk about ice before you go', true],
    ],
    note:
      '⚠️ **Not the famous single cable ride this winter.** The main cableway\'s **upper section (middle station → summit) has been suspended for renovation since 6 Nov 2025**, "at least one year" — likely still shut on Dec 14 — so the ascent is **cable car → shuttle bus → escalators**. The **east-line glass skywalk has been closed since 12 May 2026**, no reopening date. The **west-line and Panlong Cliff walkways** and Heaven\'s Gate are open. Sources: enghunan.gov.cn (7 Mar 2026) · travelzhangjiajie.com "2026 Operation Update" (23 Feb 2026) · voc.com.cn / 163.com (May 2026).\n✅ **Kept by the owner on 27 Sep, by the new route.** **Re-check the operation in late November** (its own task) before buying anything — and **do not buy Huatian\'s ¥300 package until then**; ask them exactly which segments it covers. At the window it looked like ≈**¥257** *verify*. Confirmed by the hotel on 26 Jul for the **08:00 first entry**. **Every price agreed before the service, never after.**',
    source:
      'Task `huatian-tickets`: "**Settle the Huatian prices** — Tianmen ¥300 looks fair" / "confirmed on the same evening: Tianmen ticket + cableway for Dec 14 at the 08:00 first entry … Tianmen at the window comes to roughly ¥257 (low-season entry with the cableway, plus the one-way escalator), so ¥300 is a normal service margin — and it buys the one ticket a foreigner cannot get alone, so take it … the Tianmen cableway has been under renovation since Nov 2025 with only partial service through spring 2026 — check the full summit route is running in December before paying for it … **Every price agreed before the service, never after.**" · Day 2026-12-14 lines 0–1: "**Check the Tianmen cableway/skywalk ice status first thing** … the hotel desk is 450 m away and knows before you do" / "**Tianmen Mountain, 08:00 entry** (earliest — the hotel books the ticket)"',
  },
  /* ── Dec 15 · THE SHOW WITH A DEPOSIT ──
     The only item on the trip that asks for money you get straight back, and the
     only one where forgetting a detail (¥150, in cash or on a phone) costs you
     the English narration of a show about a siege. */
  {
    key: 'cq1949',
    date: '2026-12-15',
    title: '重庆1949 · the evening show',
    venue: 'Chongqing 1949 Grand Theatre 重庆1949大剧院',
    status: 'pending',
    placeId: 'chongqing/theatre-1949',
    bookingLinkUrl: 'https://www.klook.com',
    meta: [
      ['Price', '¥180–600 by seat'],
      ['Book', '2–3 days ahead — ~Dec 12 for a Tuesday', true],
      ['A good seat', 'a week out'],
      ['Length', '~1 h, 360° rotating auditorium'],
      ['English earpiece', 'free — ¥150 deposit per person', true],
      ['Deposit', 'cash, WeChat Pay or Alipay — refunded on return'],
    ],
    note:
      'Book **2–3 days ahead for a weekday**; Dec 15 is a Tuesday, so ~Dec 12 is right — a week out if you want a good seat. Roughly an hour, a 360° rotating auditorium with water, fire and live staging.\n🎧 The **English earpiece is FREE but takes a ¥150 deposit per person** — cash, WeChat Pay or Alipay, refunded when you hand the device back. Bring the means to pay a deposit you get straight back.\n💡 Read ten minutes on the 1949 siege of Chongqing before you go in, or half the show will pass you by.',
    source:
      'Task `cq1949`: "Book **重庆1949** for the Dec 15 evening — **Klook** or Trip.com" / "**¥180–600** depending on seat. Book **2–3 days ahead for a weekday**; Dec 15 is a Tuesday, so ~Dec 12 is right, and a week out if you want a good seat. Roughly 1 hour, a 360° rotating auditorium with water, fire and live staging. 🎧 **The English earpiece is FREE but takes a ¥150 deposit per person** — cash, WeChat Pay or Alipay, refunded when you hand the device back. 💡 Read ten minutes on the 1949 siege of Chongqing before you go in" · Day 2026-12-15 line 4: "**Chongqing 1949** show (English earpiece **free, ¥150 refundable deposit** — cash/WeChat/Alipay)"',
  },
  /* ── Dec 17 · THE SHARPEST DEADLINE ON THE TRIP ──
     Seven days ahead, 20:00 Beijing, sold out in minutes — and the release lands
     on the full ski day at Chongli, which is the only reason it is survivable.
     The inn was asked to arrange a slot and — this file said — never answered.
     It HAD answered, on 28 Jul, with a 550 tour that includes the biggest cable
     car ticket; the 27 Sep Gmail audit found it. The owner accepted on the
     condition that the ticket is guaranteed, and the inn answered AGAIN the
     same evening (27 Sep 14:53 UTC): the tour's terms are now set (3 days
     ahead by default, ~06:30–~17:00, non-refundable except weather). A third
     reply, 27 Sep 16:36 UTC, resolved the rest: the inn CAN reserve at this
     Dec 10 release ("booking ahead will definitely ensure you get it"), so
     the owner asked it to do exactly that, confirmed with the inn the
     evening of Dec 9. The tour is RESERVED for Dec 17, and this public
     window is now the fallback only — needed only if that Dec 9 confirmation
     did not hold. */
  {
    key: 'jade-dragon',
    date: '2026-12-17',
    title: 'Jade Dragon glacier cableway',
    venue: 'Jade Dragon Snow Mountain 玉龙雪山',
    status: 'pending',
    placeId: 'lijiang/jade-dragon',
    alert: true,
    meta: [
      ['Released', 'Dec 10, 20:00 Beijing — 7 days ahead (confirmed 16 Sep 2026) — now the FALLBACK only', true],
      ['Bought in', 'WeChat only: 玉龙雪山服务 (entrance) + 丽江旅游集团 (cableway) — no windows since 1 Jan 2026', true],
      ['Price DIY', '≈¥260 = entrance ¥100 + shuttle ¥20 + glacier cableway ¥140 (Yue Tu said ¥120 — verify)'],
      ['Slot', 'MORNING — afternoon wind often stops the cableway', true],
      ['Sells out', 'in minutes — be logged in at 19:55', true],
      ['Working plan', 'Yue Tu\'s ¥550 tour — RESERVED for Dec 17 on today\'s release, confirmed with the inn Dec 9', true],
      ['If not confirmed', 'DIY via the mini-programs at 20:00 — tell the inn so the ticket is not bought twice', true],
      ['Altitude', '4,506 m — no alcohol Dec 16 · <45 min at the top · down at the first headache', true],
      ['Lower option', 'Spruce Meadow 云杉坪 ~3,200 m (winter operation verify)'],
    ],
    note:
      '🎟 **Yue Tu\'s ¥550 tour is RESERVED for Dec 17** — the inn set its terms on 27 Sep (14:53 UTC): booked **3 days ahead by default** once a date is fixed, departure **~06:30**, return **~17:00**; return car, entrance, **the biggest cable car ticket**, insurance, electric car, oxygen, water, clothes, lunch, Blue Moon Lake. The cable-car ticket is **non-refundable once reserved — except weather**, which refunds the fee or substitutes a smaller cable car and refunds the difference. ✅ **Resolved 27 Sep 16:36 UTC: the inn confirmed it CAN reserve at this Dec 10 release** instead of 3 days out — "booking ahead will definitely ensure you get it" — and the owner asked it to do exactly that, confirmed with the inn on the evening of **Dec 9**. The inn answered **"no problem"** (27 Sep, 23:09 UTC) — recorded, and the Dec 9 check stays: a yes in September is not a reservation in December.\n🔴 **This release is now the fallback only** — needed only if last night\'s Dec 9 confirmation did not hold. If so, DIY at 20:00, and tell the inn either way, so the ticket is not bought twice. **Tickets release exactly 7 days ahead at 20:00 and the big cable car sells out in minutes** — confirmed by k.sina.com.cn (16 Sep 2026), which also reports that **since 1 Jan 2026 there are no ticket windows on site**: booking is only through two WeChat mini-programs, **玉龙雪山服务** (entrance) and **丽江旅游集团** (cableway). **≈¥260 DIY** (entrance ¥100 + shuttle ¥20 + glacier cableway ¥140); Yue Tu\'s message priced the cable car at ¥120 — *verify*. Take a **morning** slot: afternoon wind often suspends the cableway.\n⛰ **Altitude:** you land at 2,400 m at 22:00 on Dec 16 and stand at 4,506 m the next morning — **no alcohol on Dec 16, under 45 min at the top, down at the first headache**. The low-risk alternative is **Spruce Meadow 云杉坪**, ~3,200 m (winter operation *verify*).\n📅 **If the fallback is needed:** Dec 10 is the full ski day at Chongli, so you will be off the snow and indoors with wifi — be logged in and sitting down at **19:55**, not looking for the app at 20:01. 4,506 m at the top: go slow up there.',
    source:
      'Task `jade-dragon`: "🔴 **JADE DRAGON — fallback only: DIY at 20:00 Beijing time IF Yue Tu did not confirm on Dec 9**" / "**Yue Tu\'s ¥550 tour is reserved for Dec 17** — on the Dec 10, 7-days-ahead release (the inn confirmed 27 Sep 16:36 UTC) … confirmed with the inn on the evening of Dec 9 … This task is now a fallback only." · Day 2026-12-09 alarm: "Confirm with Yue Tu that they reserve the Jade Dragon tour tomorrow, Dec 10" · Day 2026-12-10 line 1 · Day 2026-12-17 line 0: "**Yue Tu\'s ¥550 Jade Dragon tour, reserved for today** … non-refundable except weather"',
  },
  /* ── Dec 22 · THE ONE THAT IS BOUGHT ──
     Bought at the 10:00 Hong Kong on-sale on 6 Aug 2026, which was 05:00 in
     Israel: single seats in a 2,000-seat hall on a Christmas week do not wait.
     It exists because A Symphony of Lights is being retired and the owner asked
     whether a real orchestra could stand in for it.
     THE WARNING IS THE POINT OF THE CARD. URBTIX says the confirmation email is
     not a ticket, and this is the last week of a trip that spends five weeks
     behind a firewall where Gmail does not open without the VPN. */
  {
    key: 'hkphil',
    date: '2026-12-22',
    title: 'HK Phil · Festive Cadenza: Once in a Christmas Dream',
    venue: 'Hong Kong Cultural Centre Concert Hall',
    time: '19:30',
    status: 'booked',
    placeId: 'hongkong/cultural-centre',
    code: '26080616302422701001',
    codeLabel: 'Ticket reference',
    codeSub: 'transaction 26080616302422701 · e-Ticket',
    priceNote: 'HK$689',
    gmailQuery: 'URBTIX',
    alert: true,
    meta: [
      ['Seat', 'Section STAL2 · Row DD · Seat 44'],
      ['Band', 'STANDARD · HK$680 + HK$9 handling'],
      ['Be in the hall by', '19:00', true],
      ['Bought', '6 Aug 2026, at the 10:00 on-sale'],
      ['Delivery', 'e-Ticket — download it OFFLINE', true],
      ['On stage', 'Joyce Cheung (piano) · Lio Kuokman · Hong Kong Children’s Choir'],
      ['Getting home', '~1 km from The Royal Garden, along the waterfront'],
    ],
    note:
      '⚠️ **THE CONFIRMATION EMAIL IS NOT A TICKET.** URBTIX states it outright: admission is on presentation of the valid ticket only. **Download the e-Ticket and keep it OFFLINE** — Gmail is unreachable inside the mainland without the VPN, and this is the last week of the trip, five weeks after you lose easy access.\n🎯 The seat is zone A: DD is the second row of the rear stalls, mid-floor and essentially on the hall\'s centre line. Chosen over a $400 zone C seat because in C the best free seat was well right of centre.\n⏰ The Macau day is built around this: the **return ferry is ~16:15 from Taipa** (moved from ~17:15 on 27 Sep — that left only ~30 min of slack), or a Macau → Kowloon sailing into the TST China Ferry Terminal if one runs *verify*; hall by 19:00, dinner after (~21:45).',
    source:
      'Task `hkphil`: "✅ **HK Phil concert BOUGHT — Dec 22, STAL2 / DD / 44. Now get the e-Ticket offline**" / "✅ **BOUGHT 6 Aug 2026.** **Section STAL2 · Row DD · Seat 44** · STANDARD · HK$680 + HK$9 handling = **HK$689** (≈$88). Ticket ref **26080616302422701001**, transaction 26080616302422701. Delivered as an **e-Ticket**. … ⚠️ **THE CONFIRMATION EMAIL IS NOT A TICKET.** URBTIX states it outright: admission is on presentation of the valid ticket only. **Download the e-Ticket and keep it OFFLINE** … \'Festive Cadenza: Once in a Christmas Dream with Joyce Cheung\' — **22 Dec (Tue) and 23 Dec (Wed), 19:30**, **Hong Kong Cultural Centre Concert Hall**, about **1 km from The Royal Garden** … Joyce Cheung (piano), **Lio Kuokman** conducting, the **Hong Kong Children\'s Choir**" · Day 2026-12-22 line 4: "🎻 **THE SYMPHONY IS TONIGHT — TICKET BOUGHT**, 6 Aug 2026 … **19:30**, Cultural Centre Concert Hall … **Be at the hall by 19:00**"',
  },
  /* ── Dec 22 · THE LEG THAT STOPPED BEING FREE CHOICE ──
     A ferry is shaped like travel, and it is here rather than on the Travel tab
     because its two legs are one ticket bought for one day out, and because the
     RETURN TIME IS DECIDED BY THE CONCERT above it. Reading them on the same
     screen is the whole reason this card is worth having. */
  {
    key: 'macau-ferry',
    date: '2026-12-22',
    title: 'Macau ferry · both legs',
    venue: 'Sheung Wan ⇄ Taipa',
    status: 'pending',
    placeId: 'hongkong/macau-ferry',
    bookingLinkUrl: 'https://www.cotaiwaterjet.com/ferry-schedule/hongkong-macau-taipa.html',
    alert: true,
    meta: [
      ['Fare', 'HK$194–242/leg'],
      ['Operator', 'Cotai Water Jet / TurboJET — check the terminal'],
      ['Return leg', '~16:15 from Taipa — not ~17:15 (30 min of slack was too thin)', true],
      ['Better if it runs', 'Macau → Kowloon, TST China Ferry Terminal (verify)', true],
      ['Status', 'NOT booked — no confirmation exists (27 Sep)', true],
      ['Book on', 'Dec 8, 19:00 Beijing — your reminder', true],
      ['Online cut-off', '48 h before sailing'],
      ['Fallback', 'HZMB Golden Bus HK$65, 24 h, no pre-book'],
    ],
    note:
      '⏳ **NOT BOOKED.** The Dec 22 day plan called both legs "pre-booked" until 27 Sep 2026, and no confirmation exists — nothing is held. Your reminder is **Dec 8, 19:00 Beijing**; online booking closes **48 h before sailing**, and Dec 22 is a Tuesday.\n⏰ **THE RETURN LEG IS NOT FREE CHOICE ANY MORE.** The HK Phil concert is that evening at **19:30**, so the return is **~16:15 from Taipa** — changed on 27 Sep from ~17:15, which left only ~30 min for both immigrations and the MTR before the hall. Leave Coloane ~15:15, terminal ~15:45. **Better still, a Macau → Kowloon sailing into the Tsim Sha Tsui China Ferry Terminal** if one runs that afternoon *verify* — it lands on the concert\'s side of the harbour. **Book it that way the first time rather than rebooking later.** That still leaves ~10:00–15:15 in Macau — St Paul\'s and Senado in the morning, Coloane and the egg tarts after.\n**Bookable now, and Christmas week fills.** If the ferries are full the fallback is the **HZMB Golden Bus, HK$65, 24 h, no pre-book** — but it is slower, so check it against the 19:30 curtain before relying on it.',
    source:
      'Task `macau-ferry`: "Book the **Macau ferry, BOTH legs**, for Dec 22 — **return ~17:00–17:30**" / "HK$194–242/leg. Sails **Sheung Wan ⇄ Taipa** (Cotai Water Jet / TurboJET) — check the terminal. **Bookable now, and Christmas week fills** … ⏰ **THE RETURN LEG IS NOT FREE CHOICE ANY MORE.** The **HK Phil concert is that evening, 19:30** (decided 29 Jul), so the return has to be **~17:15 from Taipa**: leave Coloane ~16:15, terminal ~16:45 for both immigrations, Sheung Wan ~18:30, hall by 19:00 … Fallback if the ferries are full: **HZMB Golden Bus HK$65, 24h, no pre-book**" · Day 2026-12-22 lines 0, 5, 7 · guide key date: "Book the Macau ferry BOTH legs for Dec 22 (HK$194–242/leg; Macau route currently sails from Sheung Wan — check terminal)"',
  },
  /* ── Dec 25 · THE CLEANEST FREE-CANCELLATION WIN ──
     And the one place a day line and the to-do list disagreed. The Dec 25 plan
     said "(booked, free to cancel to 24h before)"; the trip's own to-do list
     still had it among the Hong Kong Christmas bookings that CAN be made today.
     The to-do list won — a card that claimed a booking nobody made is exactly
     the failure this whole file exists to refuse. The 27 Sep 2026 Gmail audit
     settled it: no confirmation exists, and the day line now says NOT booked
     too, with the owner's own Nov 15 reminder. The Dec 22 ferry was the same
     case ("both legs pre-booked") and is corrected the same way. */
  {
    key: 'ngong-ping',
    date: '2026-12-25',
    title: 'Ngong Ping 360 cable car',
    venue: 'Tung Chung terminal → Ngong Ping, Lantau',
    status: 'pending',
    placeId: 'hongkong/ngong-ping',
    bookingLinkUrl: 'https://www.klook.com',
    meta: [
      ['Status', 'NOT booked — no confirmation exists (27 Sep)', true],
      ['Price', 'HK$270 Standard · HK$350 Crystal, round trip (np360.com.hk, 2026)'],
      ['Where', 'online — cheaper than the counter · Klook / KKday'],
      ['Free cancel', 'up to 24 h before, on Klook / KKday'],
      ['Book on', 'Nov 15, 12:00 Israel — your reminder', true],
      ['Why', 'Christmas Day is a public holiday — Lantau fills', true],
      ['The plan', 'early dim sum → at the cable car by ~09:30 → Big Buddha → Tai O', true],
      ['Big Buddha', 'free, 10:00–17:30 · village 10:00–18:00'],
    ],
    note:
      '⏳ **NOT BOOKED** — your reminder to book it is **Nov 15, 12:00 Israel**. **HK$270 Standard / HK$350 Crystal** round trip (np360.com.hk, 2026), cheaper online than at the counter; on Klook or KKday it is **free to cancel up to 24 hours before** — the cleanest free-cancellation win on the trip. Christmas Day is a public holiday and Lantau will be full, so **be at the cable car by ~09:30** — the Dec 25 plan decided on 27 Sep is early dim sum, then Lantau, then **Tai O** in the afternoon. The Big Buddha itself is free, 10:00–17:30; the village runs 10:00–18:00, with festive hours possible.\n⚠️ **It is not booked.** The Dec 25 plan line read "(booked, free to cancel to 24h before)" until 27 Sep 2026, when a Gmail audit found no confirmation and the line was corrected. Until an order number exists, this card is what is true.',
    source:
      'Task `hk-xmas` ("**The Hong Kong Christmas bookings are the only ones you can make TODAY** — and two are free to cancel", still open): "✅ **Ngong Ping 360 cable car, Dec 25** — book on Klook, ~HK$270 round trip verify, **free cancellation up to 24 hours before**. Christmas Day is a public holiday and Lantau will be full; this is the cleanest free-cancellation win on the trip. Big Buddha itself is free, 10:00–17:30; the village runs 10:00–18:00 with festive hours possible." · Day 2026-12-25 line 1: "Lantau: **Ngong Ping cable car** (booked, free to cancel to 24h before) + **Big Buddha** — free, 10:00–17:30; village 10:00–18:00, festive hours may shift. **Go early: public holiday, it will be full**"',
  },
  /* ── Dec 25 · THE ONLY MEAL IN THE WALLET ──
     Every other restaurant on this trip is somewhere you walk into, and they
     live on the city guides where they belong. This one needs a reservation
     weeks ahead and carries a minimum spend, which makes it a booking. It is
     also explicitly optional, and the card keeps the sentence that says so —
     "skip it without regret" is a fact about the plan, not a hedge. */
  {
    key: 'lung-king-heen',
    date: '2026-12-25',
    title: 'Lung King Heen · optional splurge (not the Dec 25 plan)',
    venue: 'Four Seasons Hong Kong',
    status: 'pending',
    placeId: 'hongkong/lung-king-heen',
    meta: [
      ['Stars', '3 Michelin'],
      ['Minimum spend', 'HK$700 + 10% service pp, from 1 Jan 2026', true],
      ['Book', 'weeks ahead — OpenTable, or ☎ +852 3196 8880', true],
      ['It is optional', 'skip it without regret if the price is not wanted'],
      ['Not the plan', 'since 27 Sep Christmas morning goes to Lantau (Ngong Ping by ~09:30)', true],
    ],
    note:
      '**Optional since 27 Sep 2026, not the plan:** Christmas morning is early dim sum and then Lantau (Ngong Ping 360 by ~09:30, Tai O in the afternoon). If Lung King Heen is still wanted, it is a later meal or another day. The one meal on this trip that needs a reservation, which is the only reason it is in the wallet — everything else on the food lists is somewhere you walk into. **Minimum spend HK$700 + 10% service per person from 1 Jan 2026**, and holiday lunches book out **weeks** ahead: OpenTable, or ☎ **+852 3196 8880**.\n**Skip it without regret if the price is not wanted** — **Tim Ho Wan** (1 star, the cheapest starred food on earth), **Cheung Hing Kee** and **Din Tai Fung** in TST are all Bib Gourmand and need no booking at all.',
    source:
      'Task `hk-xmas`: "🍽 **Lung King Heen, Dec 25 dim sum** — 3 Michelin stars, Four Seasons. **Minimum spend HK$700 + 10% service per person from 1 Jan 2026.** Holiday lunches book out **weeks** ahead: OpenTable, or ☎ +852 3196 8880. Skip it without regret if the price is not wanted — **Tim Ho Wan** (1 star, the cheapest starred food on earth), **Cheung Hing Kee** and **Din Tai Fung** in TST are all Bib Gourmand and need no booking at all." · Day 2026-12-25 line 0: "Splurge: **Lung King Heen** (3 stars, min spend HK$700+10%pp, booked weeks ahead)"',
  },
];

/** The two headings these cards sit under on the Wallet's Experiences tab. One
    thing on this trip has been bought and ten have not, and that difference is
    the first thing the screen should say — the same job
    `RAIL_GROUP_LABEL` does for the trains. */
export const TICKET_BOUGHT_GROUP = 'Bought · show this at the door';
export const TICKET_TODO_GROUP = 'Still to buy';

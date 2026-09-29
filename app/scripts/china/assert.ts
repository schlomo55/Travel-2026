/* Parity assertions for the China seed. Two layers:
   1. Structural counts — every legacy collection arrives whole.
   2. Privacy + critical values — the critical values are present where
      expected, and BOTH passport numbers, Israeli and French (read from
      private files outside the repo, never written here), appear NOWHERE in
      the seed. The French one was required here until 28 Sep 2026; by the
      owner's decision it is now forbidden like the Israeli one, and the
      passport wallet card carries no number. */
import { readFileSync } from 'node:fs';
import type { TripBundle } from '../../src/lib/model/types';
import { ADDRESS_MAX } from '../../src/lib/logic/geo';
import { isOpenable, placeIndex } from '../../src/lib/logic/places';
import { PLACE_PHOTOS } from './photos';
import { mapLayerProblems } from './map-layer';
import { loadPrivateIds } from '../privacy/private-ids';

export const EXPECTED_COUNTS = {
  stops: 11, // 10 stops + 1 transit (international flights)
  transitStops: 1,
  /* 26 → 27 on 2026-08-12: Nov 23 became a day of its own. The academy takes
     arrivals Mon/Tue/Wed only, so Sun 22 Nov is now a night in Yantai city and
     Nov 23 is the morning you go up the mountain — registration, the cash, the
     three papers, and the ask to join that afternoon's session. It is not a
     training day and the kunyuDefault template would have drawn it as one, so
     it is written out in full. The academy range moved with it: the default
     now covers Nov 23 → Dec 5, and Nov 22 sits outside it. */
  /* 27 → 28 on 2026-09-28: Nov 28, a Saturday. The school said that day that
     there is NO training on Saturdays or Sundays, and the kunyuDefault
     template (Mon–Sat) drew Nov 28 as a full training day — which it never was.
     It is written out as what it is: a free day, with an optional 1–2 h class
     a shifu offered as a gift (accepted, time not yet given). */
  dayPlans: 28,
  dayDefaults: 2,
  /* 8 → 10 on 2026-09-27, both for the reason Dec 19's exists: on a runbook day
     Home shows the RUNBOOK, not the plan items. Dec 18 now carries the gorge
     fallback decided after the 2026 mudslide and rockfalls (not at Tea Horse by
     ~15:00 → sleep there; closed or icy → minibus to Tina's); Dec 20 carries the
     rewritten transfer (Kunming Station 昆明站 for Green Lake, Kunming South as
     the fallback, and the old town → Dali station leg that was missing). */
  /* 10 → 11 on 2026-09-28: Dec 5. CA1560 was booked (YNT 14:55 → Beijing
     CAPITAL T3 16:15, retimed by Air China before it was bought) and the day
     was still on the generic "Travel-day basics" — the school's driver, the
     11:30–12:00 leave, the 2 h at YNT and the Capital-not-Daxing landing were
     all invisible on Home on the day. Same reason dec16/18/19/20 exist. */
  runbooks: 11, // +1 on 2026-07-27: Dec 19, the gorge exit into a desk that shuts at 23:00
  flights: 9, // +1 on 2026-09-28: Air China CA1560, Yantai → Beijing Capital, Dec 5, $110.30 paid
  /* NEW on 2026-07-28. The trip has always had five train journeys and, until
     that day, zero train bookings — every flight had a card from the first
     build and the rail legs lived only inside the prose of a day line. Nothing
     about the trip changed; five journeys that were already written down became
     five cards (scripts/china/rail.ts). All five are `pending`, because not one
     ticket is booked, and that is asserted separately below — a rebuild that
     rounded any of them up to booked would be telling the worst lie this app
     can tell, which is that you have nothing left to chase. */
  trains: 5,
  /* 11 → 12 on 2026-08-12, and this one is a RECORD catching up with reality
     rather than anything new being taken. Nov 23 – Dec 4 were twelve real
     nights with a day plan, a bed label and no stay booking behind them, so the
     app called the Kunyu academy fortnight unbooked on every one of them — and
     it is not: "THE DEPOSIT IS SENT AND ACKNOWLEDGED — the slot is held and
     this is not an open item" (owner, 11 Aug 2026). The stay is written down as
     it actually is: booked, and with NO price, NO confirmation number, NO
     cancellation deadline and NO platform link, because none of those four has
     ever existed for it. Every one of those absences is asserted below rather
     than tolerated. */
  /* 12 → 13 on 2026-09-28: THE TWELFTH BED IS BOOKED — the Yantai night of Sun
     22 Nov that the academy's Mon/Tue/Wed rule created on 12 Aug, and which
     lived as the `yantai-bed` task until a property was chosen. Jinjiang Inn
     Select, Muping — where the school asked the owner to sleep (earliest pickup
     10:30 from the lobby) — Trip.com, ¥164.00 pay at hotel in cash, free before
     check-in. It is cn26-stay-12: appended, so no other bed was re-keyed. */
  stays: 13,
  /* NEW on 2026-08-06, and the same story a second time. The trip has always
     had things to go to — a concert, four cableways and mountains, a show, a
     guided wall day, a ferry, a park pass, a lesson and one meal that needs a
     table — and until that day the Wallet had nowhere to put any of them. The
     ticket the owner actually BOUGHT that morning was the proof: it was in the
     Dec 22 day plan and in the money, and absent from the screen you hold up at
     a counter. Nothing about the trip changed; eleven things already written
     down became eleven cards (scripts/china/tickets.ts).
     EXACTLY ONE IS BOOKED and the other ten are `pending`, asserted separately
     below — a rebuild that promoted any of them would say there is nothing left
     to chase, which is the same lie the five trains are guarded against. */
  experiences: 11,
  walletCards: 3, // passport, Kunyu deposit, insurance — the gift card went when it was spent
  /* +3 on 2026-07-28, with the day plans: `jade-dragon` (the 7-day cableway
     window, which is the mechanism that actually works — the slot asked of Yue
     Tu Inn was never answered), `cq1949` (a show that wants 2–3 days' notice and
     a ¥150 earpiece deposit), and `hk-xmas` — the only bookings on this whole
     trip that can be made five months out, two of them freely cancellable. */
  /* +1 on 2026-07-29: `hkphil`. The owner asked whether a real orchestra could
     stand in for the retired Symphony of Lights; it can, and its tickets open
     on 6 Aug — which makes it the nearest dated thing on the whole trip. */
  /* 24 from 2026-08-06: the insurance task closed at the owner's request once
     the policy was bought. The QUESTION it carried is NOT answered — whether a
     two-week amateur course at Kunyu counts as "training toward a competition"
     under ספורט תחרותי — so it moved onto the insurance wallet card, Hebrew and
     all, rather than being deleted. A task can be closed; an unanswered
     question about whether you are covered cannot.
     +1 on 2026-08-11: `kunyu-arrival`. The academy sent its arrival
     requirements and one of them is load-bearing — insurance ON PHYSICAL PAPER,
     because "without the insurance, the students can not join the training".
     The policy is bought, which is exactly why this needs its own task: a
     bought policy reads as a closed item, and an unprinted one loses the
     fortnight. It carries the fitness report and the US$1,000 in cash with it,
     both of which have to happen before the flight, not on arrival.
     +1 on 2026-08-12: `yantai-bed`. The academy takes arrivals Mon/Tue/Wed
     only, so Sun 22 Nov became a night in Yantai city and the academy stay
     dropped to 12 nights. That is a TWELFTH BED on a trip whose booking list
     had been declared finished — it is a task rather than a `stays` entry
     because no property has been chosen, and a bed with no name is not a
     booking. It becomes a bed the day one is picked.
     27 → 28 on 2026-09-27, the review run: FOUR CLOSED — `hotel-beijing` and
     `hotels-mainland` (their blanks were all filled; the gift-card question
     closed on 12 Aug), `hkjc` (Dec 23 is on HKJC's schedule, "Winter Wonderland
     Wednesday") and `hk-xmas` (Lung King Heen is optional now; its one live job,
     Ngong Ping, became its own task) — and FIVE OPENED: `late-arrivals`
     (Huatian and Glenview told of the ~20:00 arrivals now, not at the desk),
     `esim` (plan A since the April 2026 VPN crackdown), `tianmen-recheck` (the
     upper cableway and the east skywalk are shut), `psb` (police registration
     within 24 h at the academy) and `ngong-ping`.
     28 → 27 later the same evening: `lijiang-bagtransfer` CLOSED. Yue Tu's
     third reply (27 Sep 16:36 UTC) said it has no contact for Tina's Inn
     either, so there was nothing left to book — the owner arranges the gorge
     bag himself (Option B, Jane's Guesthouse, Qiaotou) and the task became a
     packing note (`packingItems`, item `b-transfer`) instead of a to-do. */
  /* 27 → 23 on 2026-09-28, four CLOSED and none opened. `yantai-flights`
     (CA1560 booked), `yantai-bed` (Muping booked), `psb` (the school does
     the registration — "you're going to meet school Jennifer and she will do
     all for you"), and `late-arrivals` (Huatian and Glenview were both told
     ~20:00 on 27 Sep). `kunyu-email` stays open, rewritten: all four
     questions are answered and two small things are still to come — the Dec 5
     driver's price and the Nov 28 class time. */
  /* 23 → 24 on 2026-09-28, later the same day: `cash-plan`. The owner decided
     against any ATM withdrawal in China — dollars are brought from home and
     exchanged once, at Beijing Daxing on Nov 22 — and asked for it as its own
     task, due 2026-10-12 (a Google Calendar reminder already exists for that
     morning), rather than folded into `kunyu-arrival`, because it now also
     covers the bank-notification job that used to have no task at all. */
  tasks: 24,
  /* +1 on 2026-07-27: Yue Tu's free-cancellation cliff, the morning of Dec 13.
     +1 on 2026-07-28: Jade Dragon's 20:00 release on Dec 10. It is an alarm and
     not just a task because it is the only booking on the trip measured in
     minutes — and it lands on a ski day, when nobody is thinking about Lijiang. */
  /* +1 on 2026-07-29: the 6 Aug URBTIX on-sale for the HK Phil Christmas
     concert. An alarm and not just a task because it is a 10:00 sale eight days
     out, and because what it really needs decided is which of two evenings to
     give up — Macau's, or the trip's only Wednesday at Happy Valley. */
  /* +2 on 2026-09-27, both from the Gmail audit. Blossom House's free window
     turned out to be stated all along — 23:00 on Dec 4, then non-refundable —
     so it gets the evening alarm Yue Tu's cliff already has. And Dali's late
     arrival turned out to be APPROVED, which changes the Dec 19 job from
     "declare" to "send the ETA when you leave Tina's": the desk still shuts at
     23:00, and the property asked for a confirmed time. The Macau ferry alarm
     did NOT add one — it MOVED, Dec 18 → Dec 8 19:00, onto the owner's own
     reminder, because Dec 18 is a day on the gorge trail with no signal.
     +1 later the same evening, 2026-09-27: Dec 9, 20:00 — "confirm with Yue
     Tu that they reserve the Jade Dragon tour tomorrow, Dec 10", the evening
     the owner is in Beijing with signal. The existing Dec 10, 20:00 alarm
     stays, reworded into a fallback-only check. */
  /* 22 → 24 on 2026-09-28, both APPENDED (alarm ids are index-keyed): Nov 23,
     10:00 — be in the Muping lobby, the school collects from 10:30; and Dec 5,
     11:00 — leave the school by ~11:30–12:00 for CA1560. The Nov 20 "Yantai→
     Beijing train window" alarm is MARKED DONE rather than deleted: Dec 5 is
     flown, and removing it would re-key every alarm after it. */
  /* 24 → 26 on 2026-09-28, later the same day, both APPENDED (alarm ids are
     index-keyed): Oct 12, 10:00 — buy the cash plan's US$1,700 and tell the
     bank; and Nov 22, 08:30 — change the Exchange envelope at the Daxing
     arrivals counter, before domestic check-in. */
  alarms: 26,
  packingItems: 34, // 32 → 34 on 2026-09-28: the cash plan's Reserve envelope and the Hong Kong cash note
  checklists: 1,
  checklistItems: 11,
  categories: 8,
  showCards: 35, // 7 phrases + 28 places
  emergency: 9,
  infoCards: 13, // 12 from DATA.info + the transcribed VPN card
  counters: 1,
  documents: 1 + PLACE_PHOTOS.length, // the flights PDF + one curated photo per real stop
  /* 8 from 2026-08-01: 4 flights, the Kunyu deposit, and THREE beds. The Royal
     Garden joined them by being paid in full to escape a credit-card ultimatum
     — $1,232.01, more than every other prepayment on the trip except the
     Etihad ticket, and the one that turned a refundable bed into a fixed one. */
  /* 9 from 2026-08-06: the HK Phil Christmas concert, HK$689 — the trip's FIRST
     ticket, and its first spend that is not transport, a bed or a border. It
     exists because A Symphony of Lights is being retired and the owner wanted a
     real orchestra in its place. Bought at the 10:00 Hong Kong on-sale, which
     was 05:00 in Israel. */
  /* 10 from 2026-08-06, and this one closed the trip's biggest exposure: the
     Phoenix travel policy, $148.40. Until it was bought, $4,296 of flights,
     beds and a concert stood committed and uninsured, on a trip with Sanda
     sparring, three days on skis, a 4,506 m cable car and a 2,700 m trek. */
  /* 11 from 2026-08-12: Air China CA8683, Beijing PKX to Yantai, $117.30 paid
     on Trip.com by Google Pay. The academy takes arrivals Mon/Tue/Wed only, so
     Sunday 22 Nov became a night in Yantai city and this flight became the way
     there. It is the ONLY Beijing-Yantai departure from PKX, the airport EY888
     actually lands at; every alternative goes from PEK Capital and costs a
     1.5-2 h cross-city transfer on arrival day. $117.30 on Trip.com against
     $204.30 on Expedia for the identical flight. */
  /* 12 from 2026-08-12: Four Points Sanlitun, $244.74. NOT a new purchase — the
     bed was paid at booking and this repo did not know, because the Trip.com
     bookings LIST prints no payment mode and nobody had opened the order
     behind it. The same page supplied its PIN and its cancellation deadline.
     A correction, and the largest one this trip's books have taken. */
  /* 13 from 2026-09-27: Blossom House, $299.56 — the SAME correction a second
     time, and now the largest. Its Trip.com confirmation email said "Prepay
     Online — Paid" (Google Pay $246.60 + gift card $52.96) on 27 Jul, and the
     repo carried "payment: not stated — ask" until a Gmail audit read it. */
  /* 14 from 2026-09-28: Air China CA1560, Yantai → Beijing Capital, $110.30 —
     fare $104.30 + taxes $6.00, "Flight Booking Confirmed" 06:44 UTC. The ~$121
     estimate the forecast carried became a receipt. The Muping bed booked the
     same morning is NOT here: it is pay at the hotel, in cash, on Nov 22. */
  expenses: 14,
  /* NEW on 2026-07-28 with day-places.ts — nothing above moved, because nothing
     was added to the trip: the manifest only JOINS day prose to entities that
     already shipped. These two exist so the join cannot silently evaporate. A
     rebuild that lost the import would leave every count above green and every
     day-plan chip row gone, which is precisely the failure this repo is built
     to refuse.
     24 of the 26 dayPlans + the Kunyu Sunday default = 25 dated/templated days
     that go somewhere. Nov 29 (a Yantai errand day) and Dec 10 (a full day on
     the Chongli greens, no named venue) carry no key at all, and the Kunyu
     training week has nothing to open but the academy — which since 2026-08-13
     HAS an address (its own website footer) and still has no map button,
     because a name is not searched here until `verify:places` has checked it.
     Printing an address and searching one are different promises, and only the
     second one moves these counts.

     BOTH NUMBERS MOVED ON 2026-07-28 with Phase 2, and neither because the trip
     changed: THIRTY researched, sourced and gated spots were added across two
     research passes, so lines that had always named a real place finally have
     one to point at.
     daysWithPlaces 24 → 25 is Dec 22 alone — a full day in Macau that had no
     places in the seed at all and therefore drew no row.
     dayPlaceLinks 58 → 84 → 90. The first 26: six Macau chips plus twenty
     across thirteen other days — Jingshan and Bodhi in Beijing, Jinshanling,
     the hot springs, both Dec 9 stations, Huatian Grand (the first bed ever
     promoted onto a name), Zhangjiajie West, 千厮门大桥, Ronghui, 重庆1949's own
     theatre, Tea Horse, Tina's, Renmin Road and the six Hong Kong places
     Dec 23–25 name. The last 6 came from a second research pass that caught
     what the first missed: Yuanjiajie under the Avatar pillar's official name
     (Dec 12), the Naxi Ancient Music hall (17), Longkan Wharf (20), the HZMB
     Hong Kong port (22), Shau Kei Wan MTR (23) and WinterFest's venue (24).
     THEN ONE CAME OFF AND WENT BACK ON, 90 → 89 → 90, both on 2026-07-28. The
     `verify:places` run demoted cn26-place-05 (后海 → 什刹海), which Dec 7 links
     as the stand-in for Blossom House, because the card had carried no
     coordinate since July 26 and a name cannot be certified against nothing.
     The right remedy was the coordinate, not the demotion: the owner sourced
     Wikidata Q1136851, independently of OpenStreetMap; coords.ts carries it and
     the card is back at `via: 'name'`. The count matches what it was before the
     run, and
     that is not the run being undone — the card is certified now, which it was
     not then. */
  daysWithPlaces: 25,
  /* 90 → 87 on 2026-08-01, and this is the first time the number has gone DOWN
     because of a real phone rather than a gate. Every one of the 141 Amap
     targets was fired at a signed-in Amap on the S23 and read back off the
     screen; two names that OpenStreetMap answers, Amap does not:
       菩提 三里屯   → 三里屯, the business district, not the tuina room
       Tina's / 中峡客栈 → Info not found, then a DIFFERENT guesthouse at the
                          same Middle Gorge descent
     Both were demoted to no button (spots.ts), which removed them from the
     seed, which is what made this assertion fire — the join noticing that two
     of its ids had stopped existing. That is the guard working, not breaking:
     Bodhi came off Dec 5 and Dec 6, Tina's off Dec 19. No day lost its row.
     87 → 89 on 2026-09-27, and the trip changed this time: Air China retimed
     CA1953 and the Dec 11 booking moved free onto CA8609 from DAXING. The
     rewritten day names its stations for the first time, so Dec 11 went from
     three chips (PEK card, DYG, Wulingyuan) to five (太子城站, Qinghe, PKX card,
     DYG, Wulingyuan). No new entity: all five already shipped and opened. */
  dayPlaceLinks: 89, // every id across all of them, duplicates within a day already removed
} as const;

/** What the documents say was already paid, in home-currency minor units.
    The last three terms are the beds that have taken money: Yue Tu Inn's first
    night, ¥428.65 charged at reservation and converted at the trip's own 7.15 →
    $59.95; the ibis Kunming night, US$25.73 marked "Prepay Online ✓ Paid" on
    its Trip.com order; and, from 2026-08-01, The Royal Garden's whole US$1,232.01.
    All but the first are already in the home currency, so no rate is involved.
    Every other term is a dollar the documents state outright.

    THE ROYAL GARDEN IS THE ODD ONE and worth reading twice: it was not due.
    The hotel refused the debit card given at booking, demanded a credit card by
    5 Aug 15:00 HK, and said the room would otherwise be "released automatically
    without prior notice". Paying it outright answered that — and in the same
    reply the terms became non-refundable and unamendable. So this figure is
    both the largest lodging payment on the trip and the moment its last bed
    stopped being able to move. */
export const PREPAID_MINOR = 202600 + 11730 + 24100 + 23000 + 29300 + 10000 + 5995 + 2573 + 123201 + 8833 + 14840 + 24474 + 29956 + 11030;

/** Values that must appear in the seed (spot layer of the 57-value audit; M8 does the full pass). */
const MUST_CONTAIN = [
  '8CR7MR', // Etihad PNR (4 segments)
  'PLF8S9', // Dec 11 airline PNR — confirmed UNCHANGED by the 2026-09-27 change to CA8609
  'NGNRZ1', // 3U8011 airline PNR
  'MZ904B', // MU733 airline ref
  '1653716183770225', // Trip.com, Dec 11 — CA1953 until 2026-09-27, CA8609 since (same order)
  '1653716249124273', // Trip.com 3U8011
  '1653716248615345', // Trip.com MU733
  /* Booked 2026-09-28: the Dec 5 flight out of Yantai and the Nov 22 bed —
     the first two orders from the 1653717… account epoch. */
  '1653717880605553', // Trip.com CA1560, Dec 5 (YNT 14:55 → PEK T3 16:15)
  'NE1K88', // CA1560 airline PNR
  '999-2580773936', // CA1560 e-ticket
  '1653717166174001', // Trip.com Jinjiang Inn Select Muping, Nov 22
  /* Four Points was REBOOKED on 2026-07-27 at a better rate. The order this
     list used to name (…596848) is dead and no longer ships anywhere; the live
     one is below. A dead order number is still personal data, so it stays
     guarded in check-dist-clean by the same family pattern — it is simply not
     something the seed must CONTAIN any more. */
  '1653715561783471', // Trip.com Four Points, the live order (booked 2026-07-27)
  '1653715561827302', // Trip.com Blossom House — the number that was missing until 2026-07-27
  'R9000388217900556001', // Blossom House's OWN confirmation number, off the Trip.com email (2026-09-27)
  '1653715534089209', // Trip.com Huatian Grand (booked 2026-07-26)
  '1653715534121148', // Trip.com Glenview ITC Plaza (booked 2026-07-26)
  '682760663', // Agoda, Pullman Zhangjiajie (booked 2026-07-27)
  '5942328968', // Booking.com, Lijiang Yue Tu Inn (booked 2026-07-27)
  '6352597569', // Booking.com, Dali Yanyuan Mountain Retreat (booked 2026-07-27)
  '1653715562519718', // Trip.com, ibis Kunming Changshui Airport (booked 2026-07-27)
  'cohTex87hq19CnTh', // The Royal Garden, booked DIRECT with the hotel (2026-07-27)
  /* The URBTIX ticket reference for the HK Phil concert, bought 2026-08-06 —
     the trip's first ticket and the only experience on it that is booked. It is
     what admits you to the hall, so it must survive every rebuild; the
     transaction number under it is checked with it. Neither is in `sources/`:
     the URBTIX confirmation was transcribed straight into legacy/index.html on
     the morning it arrived, which is why they are asserted here (presence in
     the seed) rather than in verify-china-parity (agreement with a document). */
  '26080616302422701001', // URBTIX ticket reference
  '26080616302422701', // its transaction number
  '2786', // 3U8011 PIN
  /* The trip's surviving hotel PINs — each with its label, which is the only
     form any of them ships in. Four Points' PIN 9858 belonged to the superseded
     order and is gone from the app entirely. */
  'PIN 3635', // Yue Tu Inn, Booking.com
  'PIN 8706', // Dali Yanyuan Mountain Retreat, Booking.com
  'PIN 2284', // ibis Kunming, Trip.com — the order marks it "do not disclose"
  '600023186044', // Etihad Guest
  '请带我去这里', // driver suffix
  '2026-12-22', // visa hard deadline
];

export interface AssertionReport {
  ok: boolean;
  lines: string[];
}

export function assertChinaBundle(bundle: TripBundle, handoffMdPath: string): AssertionReport {
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    lines.push(`✗ ${msg}`);
  };
  const pass = (msg: string) => lines.push(`✓ ${msg}`);

  const counts: Record<keyof typeof EXPECTED_COUNTS, number> = {
    stops: bundle.stops.length,
    transitStops: bundle.stops.filter((s) => s.kind === 'transit').length,
    dayPlans: bundle.dayPlans.length,
    dayDefaults: bundle.dayDefaults.length,
    runbooks: bundle.runbooks.length,
    flights: bundle.bookings.filter((b) => b.kind === 'flight').length,
    trains: bundle.bookings.filter((b) => b.kind === 'train').length,
    stays: bundle.bookings.filter((b) => b.kind === 'hotel').length,
    experiences: bundle.bookings.filter((b) => b.kind === 'activity').length,
    walletCards: bundle.walletCards.length,
    tasks: bundle.tasks.length,
    alarms: bundle.alarms.length,
    packingItems: bundle.packingItems.length,
    checklists: bundle.checklists.length,
    checklistItems: bundle.checklists.reduce((s, c) => s + c.items.length, 0),
    categories: bundle.categories.length,
    showCards: bundle.showCards.length,
    emergency: bundle.emergency.length,
    infoCards: bundle.infoCards.length,
    counters: bundle.counters.length,
    documents: bundle.documents.length,
    expenses: bundle.expenses.length,
    daysWithPlaces: [...bundle.dayPlans, ...bundle.dayDefaults].filter((d) => (d.placeIds?.length ?? 0) > 0).length,
    dayPlaceLinks: [...bundle.dayPlans, ...bundle.dayDefaults].reduce((n, d) => n + (d.placeIds?.length ?? 0), 0),
  };
  for (const key of Object.keys(EXPECTED_COUNTS) as (keyof typeof EXPECTED_COUNTS)[]) {
    if (counts[key] === EXPECTED_COUNTS[key]) pass(`${key}: ${counts[key]}`);
    else fail(`${key}: expected ${EXPECTED_COUNTS[key]}, got ${counts[key]}`);
  }

  /* referential integrity */
  const runbookIds = new Set(bundle.runbooks.map((r) => r.id));
  for (const d of bundle.dayPlans) {
    if (d.runbookId && !runbookIds.has(d.runbookId)) fail(`dayPlan ${d.date} references missing runbook ${d.runbookId}`);
    if (d.date < bundle.trip.start || d.date > bundle.trip.end) fail(`dayPlan ${d.date} outside trip range`);
  }
  for (const b of bundle.bookings) {
    if (b.kind === 'hotel' && b.checkIn >= b.checkOut) fail(`stay ${b.id} has checkIn >= checkOut`);
  }
  /* photos: every photo document links to a real stop, every linked stop points back,
     and the bytes really are WebP (RIFF....WEBP magic). */
  const stopIds = new Set(bundle.stops.map((s) => s.id));
  const photoDocs = bundle.documents.filter((d) => d.meta.tag === 'photo');
  for (const d of photoDocs) {
    if (!d.meta.stopId || !stopIds.has(d.meta.stopId)) fail(`photo ${d.meta.id} has no valid stop link`);
    const head = Buffer.from(d.dataBase64.slice(0, 24), 'base64');
    if (head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WEBP') {
      fail(`photo ${d.meta.id} is not a WebP`);
    }
  }
  const photoIds = new Set(photoDocs.map((d) => d.meta.id));
  for (const s of bundle.stops) {
    if (s.photoDocId && !photoIds.has(s.photoDocId)) fail(`stop ${s.id} points at missing photo ${s.photoDocId}`);
    if (s.kind === 'stop' && !s.photoDocId) fail(`stop ${s.id} has no photo`);
    if (s.kind === 'stop' && !s.detail) fail(`stop ${s.id} has no read-more text`);
    if (s.kind === 'stop' && (s.options?.length ?? 0) < 2) fail(`stop ${s.id} has fewer than 2 options blocks`);
    if (s.kind === 'stop' && !s.coord) fail(`stop ${s.id} has no coordinate`);
  }
  /* Coordinates are WGS-84 and must be inside the box this trip lives in;
     a swapped lat/lng or a GCJ-02 slip would fall out here. */
  const coords = [
    ...bundle.stops.flatMap((s) => (s.coord ? [[s.id, s.coord] as const] : [])),
    ...bundle.showCards.flatMap((c) => (c.coord ? [[c.id, c.coord] as const] : [])),
  ];
  for (const [id, c] of coords) {
    if (!(c.lat > 20 && c.lat < 45 && c.lng > 95 && c.lng < 125)) fail(`${id} coordinate is outside China/HK: ${c.lat},${c.lng}`);
  }
  pass(`coordinates in range (${coords.length} checked)`);

  /* Bookings get their own box: two of the airports this trip flies from are
     Tel Aviv and Abu Dhabi, which are nowhere near China. A rail leg carries no
     coordinate of its own — its stations do, one per end — so they are checked
     here too, against the same box and by the same rule. */
  for (const b of bundle.bookings) {
    const own: [string, typeof b.coord][] = b.coord ? [[b.id, b.coord]] : [];
    const rail: [string, typeof b.coord][] =
      b.kind === 'train'
        ? [...(b.from.stations ?? []), ...(b.to.stations ?? [])].flatMap((s) => (s.coord ? [[`${b.id} · ${s.name}`, s.coord] as [string, typeof b.coord]] : []))
        : [];
    if (b.coord && b.kind === 'hotel') fail(`${b.id} is a bed with a coordinate — no hotel address is in the sources`);
    for (const [id, c] of [...own, ...rail]) {
      if (!c) continue;
      if (!(c.lat > 20 && c.lat < 45 && c.lng > 34 && c.lng < 125)) fail(`${id} coordinate is off the trip's map: ${c.lat},${c.lng}`);
    }
  }

  /* Map buttons: a place opens by saved link, by name, or by coordinate — and
     must have at least one of the three, or it renders no button at all.
     Same three fields on stops, driver cards, bookings and spots, so one
     button serves all four and one check covers them. */
  const spots = bundle.stops.flatMap((s) => s.spots ?? []);
  const mapped = [
    ...bundle.stops.map((s) => [s.id, s] as const),
    ...bundle.showCards.map((c) => [c.id, c] as const),
    ...bundle.bookings.map((b) => [b.id, b] as const),
    ...spots.map((s) => [s.id, s] as const),
  ];
  let named = 0;
  let saved = 0;
  let addressed = 0;
  for (const [id, e] of mapped) {
    if (e.mapUrl) {
      saved++;
      if (!/^https:\/\//.test(e.mapUrl)) fail(`${id} map link is not an https URL`);
      if (e.mapQuery) fail(`${id} has both a saved link and a name — one of them is dead weight`);
    }
    if (e.mapQuery) {
      named++;
      if (!e.mapQuery.trim()) fail(`${id} has an empty map name`);
    }
    if (e.mapCity && !e.mapQuery) fail(`${id} has a map city but nothing to search for`);
    /* An address on a STOP, a driver card or a spot is always the byproduct of
       a name that passed verification — OpenStreetMap handed it back with the
       answer — so it never stands alone there. A BED is the exception, and the
       only one: the owner's accommodation document prints street addresses for
       six of the eleven hotels and names nothing a map resolves, so the address
       IS the whole location. That is the same thing the app's own Address field
       produces, from the same paperwork. */
    if (e.address !== undefined) {
      addressed++;
      if (!e.address.trim()) fail(`${id} carries an empty address`);
      if (e.address.length > ADDRESS_MAX) fail(`${id} address is ${e.address.length} chars, over the ${ADDRESS_MAX} cap`);
      const isBed = 'kind' in e && e.kind === 'hotel';
      if (!isBed && !e.mapQuery && !e.mapUrl && !e.coord) fail(`${id} carries an address but nothing to open`);
    }
  }
  pass(`map targets: ${named} by name, ${saved} by saved link, ${addressed} with a street address`);

  /* Spots are the one thing in the seed that exists ONLY to be opened. A spot
     nobody can open is dead weight on the page, so every one must carry a
     verified name — the rejected candidates stay in spots.ts, not here. */
  const spotIds = new Set<string>();
  for (const sp of spots) {
    if (spotIds.has(sp.id)) fail(`duplicate spot id ${sp.id}`);
    spotIds.add(sp.id);
    if (!sp.mapQuery && !sp.coord && !sp.mapUrl) fail(`spot ${sp.id} has nothing to open`);
    if (!sp.name.trim()) fail(`spot ${sp.id} has no name`);
  }
  const stopsWithSpots = bundle.stops.filter((s) => s.kind === 'stop' && (s.spots?.length ?? 0) > 0).length;
  if (stopsWithSpots === 10) pass(`spots: ${spots.length} across all 10 real stops`);
  else fail(`spots: only ${stopsWithSpots} of 10 real stops carry any`);

  /* THE FIVE RAIL LEGS (scripts/china/rail.ts), and the two things about them
     that must never drift.

     1. NOTHING IS BOOKED. Every one of them ships `pending`, carries no
        confirmation number and — deliberately — no `priceNote`: the documented
        fares are estimates for tickets nobody has bought, and `priceNote` is
        what "Booked & committed" totals. A rebuild that promoted one to booked,
        or that turned a "~¥90" plan into a counted cost, is stopped here.
     2. EVERY END EITHER OPENS OR SAYS WHY IT DOES NOT. Three of the ten ends on
        this trip are not named in any document (four until 2026-09-27, when the
        rewritten Dec 11 named Qinghe); those ship no button and print
        their reason on the card. An end with neither a station nor a reason
        would be a silent gap, which is the exact failure this repo refuses. */
  const trains = bundle.bookings.filter((b) => b.kind === 'train');
  let railStations = 0;
  let railSilent = 0;
  for (const t of trains) {
    if (t.status !== 'pending') fail(`${t.id} is a train that is not pending — no rail ticket on this trip is booked`);
    if (t.priceNote) fail(`${t.id} carries a priceNote — an unbought fare must not be counted as a cost`);
    if (t.code) fail(`${t.id} carries a confirmation number for a ticket nobody has bought`);
    for (const [side, end] of [['from', t.from], ['to', t.to]] as const) {
      const stations = end.stations ?? [];
      if (!stations.length) {
        railSilent++;
        if (!end.why?.trim()) fail(`${t.id} ${side} ("${end.name}") has no station and no reason for having none`);
        continue;
      }
      for (const st of stations) {
        railStations++;
        if (!st.name.trim()) fail(`${t.id} ${side} has an unnamed station`);
        if (!isOpenable(st)) fail(`${t.id} ${side} station "${st.name}" opens nothing — it would draw a button that does nothing`);
        if (st.address && st.address.length > ADDRESS_MAX) {
          fail(`${t.id} ${side} station "${st.name}" address is ${st.address.length} chars, over the ${ADDRESS_MAX} cap`);
        }
      }
    }
  }
  pass(`rail: ${trains.length} legs, all pending · ${railStations} station buttons · ${railSilent} ends that say why they have none`);

  /* THE ELEVEN EXPERIENCES (scripts/china/tickets.ts), and the four things about
     them that must never drift.

     1. EXACTLY ONE IS BOOKED. The HK Phil concert was bought on 2026-08-06 with
        a reference, a seat and a receipt. Every other entry is a thing still to
        buy, several behind windows measured in minutes — a rebuild that promoted
        one would say there is nothing left to chase, which is the same lie the
        five trains are guarded against.
     2. ONLY THE BOUGHT ONE IS PRICED. `priceNote` is what "Booked & committed"
        totals, so a hotel's ¥300 asking price for a ticket nobody owns must not
        reach it. Those figures ride as chips; ten rows count as unpriced.
     3. NOTHING PENDING CARRIES A REFERENCE. A plausible number on an unbought
        ticket is worse than an empty strip — it is what gets read out at a door.
     4. A CARD OPENS A VERIFIED PLACE OR IT OPENS NOTHING. Ten borrow a location
        from an entity that already passed `verify:places`; the Thaiwoo lesson
        borrows from nothing, because 太舞滑雪小镇 has never had a coordinate to
        certify a name against. */
  type Ticket = Extract<(typeof bundle.bookings)[number], { kind: 'activity' }>;
  const experiences = bundle.bookings.filter((b): b is Ticket => b.kind === 'activity');
  const bought = experiences.filter((t) => t.status === 'booked').map((t) => t.id);
  if (bought.join(',') === 'cn26-ticket-hkphil') pass('exactly one experience is booked: the HK Phil concert');
  else fail(`booked experiences: expected only cn26-ticket-hkphil, got ${bought.join(', ') || '(none)'}`);
  let ticketButtons = 0;
  for (const t of experiences) {
    if (t.status !== 'booked' && t.status !== 'pending') fail(`${t.id} is neither booked nor pending`);
    if (t.status === 'pending') {
      if (t.priceNote) fail(`${t.id} carries a priceNote — an unbought ticket must not be counted as a cost`);
      if (t.code) fail(`${t.id} carries a reference for a ticket nobody has bought`);
    }
    if (!t.meta.length) fail(`${t.id} carries no chips — a ticket with no price, window or seat says nothing`);
    if (!t.note?.trim()) fail(`${t.id} carries no note`);
    if (t.mapQuery || t.coord || t.mapUrl) {
      ticketButtons++;
      if (!isOpenable(t)) fail(`${t.id} would draw a map button that opens nothing`);
    }
  }
  if (ticketButtons === 10) pass(`experiences: ${experiences.length} cards, ${ticketButtons} opening a verified place`);
  else fail(`experiences: expected 10 of 11 to open a verified place, got ${ticketButtons}`);
  /* THE CONCERT ITSELF, which is the only one of these you can be turned away
     for not having. The reference is the counter-facing string, the transaction
     rides under it, the seat is on the card, and the URBTIX warning — the
     confirmation email is NOT a ticket — must survive every rebuild, because it
     lands in the last week of a trip that spends five weeks behind a firewall. */
  const concert = experiences.find((t) => t.id === 'cn26-ticket-hkphil');
  const hkChips = (concert?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    concert?.code === '26080616302422701001' &&
    concert.codeLabel &&
    /26080616302422701\b/.test(concert.codeSub ?? '') &&
    concert.priceNote === 'HK$689' &&
    concert.time === '19:30' &&
    /Cultural Centre/i.test(concert.venue ?? '') &&
    /STAL2/.test(hkChips) &&
    /Row DD/.test(hkChips) &&
    /Seat 44/.test(hkChips) &&
    /valid ticket only/i.test(concert.note ?? '')
  ) {
    pass('cn26-ticket-hkphil carries its reference, seat, hall, time and the URBTIX warning');
  } else {
    fail(`cn26-ticket-hkphil must carry ref 26080616302422701001, HK$689, 19:30 and its seat — got "${hkChips}"`);
  }
  /* AND ITS MONEY IS COUNTED ONCE. The HK$689 exists twice on purpose, in two
     cards that answer different questions: `priceNote` on the ticket feeds
     "Booked & committed", and `cn26-exp-prepaid-hkphil` feeds "Total spent" —
     exactly as the three prepaid beds do. What must never exist is a SECOND
     expense for it, or an expense for anything still pending: ten of these are
     unbought, and money nobody has spent must not appear in a spending total. */
  const ticketSpend = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-tickets');
  const hkphilExp = ticketSpend.find((e) => e.id === 'cn26-exp-prepaid-hkphil');
  if (
    ticketSpend.length === 1 &&
    hkphilExp?.currency === 'HKD' &&
    hkphilExp.amount === 689 &&
    hkphilExp.rateToHome === 7.8 &&
    hkphilExp.homeMinor === 8833
  ) {
    pass('one ticket has been paid for — HK$689 → $88.33 — and nothing pending is counted as spent');
  } else {
    fail(`tickets spent must be the concert alone (HK$689 at 7.8 → $88.33) — got ${ticketSpend.length} line(s)`);
  }

  /* THE DAY→PLACE JOIN (scripts/china/day-places.ts), checked here and nowhere
     else, because here is the last moment it can still be stopped.

     Every id a day carries must resolve to a real entity of this trip AND that
     entity must be openable — a saved link, a name, an address or a coordinate.
     An id that resolves to nothing would draw no chip; an id that resolves to
     something with no map target would draw a chip that does nothing when you
     tap it, which is the worse of the two and completely invisible in the JSON.
     A SILENT DROP IS THE FAILURE MODE THIS WHOLE REPO EXISTS TO PREVENT, so
     either one fails the build with the date and the id spelled out.

     Empty arrays are rejected too: transform.ts spreads the field only when the
     manifest has entries, so `placeIds: []` could only arrive from someone
     hand-editing the seed — and the app tests the KEY before it draws a
     header, so an empty array is a header with nothing under it. */
  const openablePlaces = placeIndex(bundle);
  let dayPlaceCount = 0;
  for (const d of [...bundle.dayPlans, ...bundle.dayDefaults]) {
    const where = 'date' in d ? d.date : d.id;
    if (d.placeIds === undefined) continue;
    if (!d.placeIds.length) {
      fail(`${where} carries an empty placeIds — a day with no places must carry no field at all`);
      continue;
    }
    const seen = new Set<string>();
    for (const id of d.placeIds) {
      dayPlaceCount++;
      if (seen.has(id)) fail(`${where} lists ${id} twice — a place named twice in a day gets one chip`);
      seen.add(id);
      const ref = openablePlaces.get(id);
      if (!ref) fail(`${where} refers to ${id}, which is not an entity in this trip`);
      else if (!isOpenable(ref)) fail(`${where} refers to ${id} ("${ref.label}"), which has no map target — it would draw a chip that opens nothing`);
    }
  }
  pass(`day plans: ${dayPlaceCount} place links, every one resolving to something openable`);

  /* Bed status is a fact about the trip, not a detail: ELEVEN beds are booked —
     every bed except the gorge guesthouse, which stays a deliberate walk-in and
     must never be pre-booked. NOTHING IS PENDING ANY MORE. Dali and Kunming
     went on 2026-07-27, joining the eight taken on 26–27 Jul. THE ELEVENTH IS
     THE ACADEMY, written down on 2026-08-12: its deposit was sent and
     acknowledged on 11 Aug and the slot is held, which is what `booked` means
     here. If a rebuild ever silently reverted a booking to pending this is
     where it stops. */
  const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
  const bookedBeds = stays.filter((b) => b.status === 'booked').map((b) => b.id);
  /* THE TWELFTH, 2026-09-28: the Nov 22 night in Muping (cn26-stay-12), booked
     on Trip.com the morning the academy asked for it. Twelve of thirteen. */
  const BOOKED =
    'cn26-stay-00,cn26-stay-01,cn26-stay-02,cn26-stay-03,cn26-stay-04,cn26-stay-05,cn26-stay-06,cn26-stay-08,cn26-stay-09,cn26-stay-10,cn26-stay-11,cn26-stay-12';
  if (bookedBeds.join(',') === BOOKED) pass(`booked beds: ${bookedBeds.length} of 13`);
  else fail(`booked beds: expected ${BOOKED}, got ${bookedBeds.join(', ') || '(none)'}`);
  const pendingBeds = stays.filter((b) => b.status === 'pending').length;
  const walkinBeds = stays.filter((b) => b.status === 'walkin').length;
  if (pendingBeds === 0 && walkinBeds === 1) pass('nothing left to book: 0 pending, 1 walk-in');
  else fail(`bed statuses: expected 0 pending + 1 walk-in, got ${pendingBeds} + ${walkinBeds}`);
  /* THE OWNER'S OWN RULE, 2026-07-27: every booked bed must show its PRICE,
     that it IS booked, and A LINK TO THE SITE IT WAS BOOKED ON. The link is an
     honest platform entry point where no deep link to the reservation was ever
     supplied — never a guessed order URL — and the rule has no exceptions.
     Element used to prove the point from the hard side: it carried no
     confirmation number and still carried its link, because "we do not know the
     number" is a different admission from "you cannot get back to the order".
     Its number arrived on 2026-07-29; the link rule is unchanged for every bed
     a platform holds.

     THE ACADEMY IS THE ONE EXEMPTION, AND IT IS NAMED RATHER THAN TOLERATED
     (2026-08-12). The rule was written for a bed taken on a platform, and that
     bed is not: it was arranged by message and no platform holds it, so there
     is no link to give and the exemption is by ID rather than by relaxation.

     HALF OF THAT EXEMPTION DIED ON 2026-08-13. It used to cover the PRICE as
     well — the rate had never been confirmed in writing ("price and room NOT
     confirmed in writing"), and an unconfirmed figure may not join a total. The
     school then wrote it down: "you can pay 840 USD to stay for 12 days or two
     weeks", and Nov 23 → Dec 5 is twelve nights, so the sentence covers this
     booking either way. The bed now carries `$840` and the check below demands
     that figure of it — the LINK is still asserted absent, because none exists.
     Two different absences, and only one of them was ever about the price. */
  const ACADEMY = 'cn26-stay-11';
  const platformBeds = stays.filter((b) => b.status === 'booked' && b.id !== ACADEMY);
  const linkless = platformBeds.filter((b) => !b.manageUrl);
  const priceless = platformBeds.filter((b) => !b.priceNote);
  if (!linkless.length && !priceless.length) {
    pass(`all ${platformBeds.length} platform-booked beds carry a price and a link to the site they were booked on`);
  } else {
    fail(
      `booked beds missing a link: ${linkless.map((b) => b.id).join(', ') || '(none)'}; ` +
        `missing a price: ${priceless.map((b) => b.id).join(', ') || '(none)'}`,
    );
  }
  const academy = stays.find((b) => b.id === ACADEMY);
  if (
    academy?.status === 'booked' &&
    academy.checkIn === '2026-11-23' &&
    academy.checkOut === '2026-12-05' &&
    /Kunyu Mountain Shaolin Kung Fu Academy/.test(academy.title) &&
    academy.priceNote === '$840' &&
    !academy.manageUrl &&
    !academy.bookingLinkUrl &&
    !academy.code &&
    !academy.codeLabel &&
    !academy.codeSub
  ) {
    pass('the academy stay is held for its 12 nights at the $840 the school put in writing, with no reference and no platform');
  } else {
    fail(
      `${ACADEMY} must be a booked Kunyu stay 2026-11-23 → 2026-12-05 priced $840, with no code and no link — got ` +
        `${academy?.status ?? '(missing)'} ${academy?.checkIn ?? ''}→${academy?.checkOut ?? ''} ` +
        `price=${academy?.priceNote ?? '(none)'} code=${academy?.code ?? '(none)'} link=${academy?.manageUrl ?? '(none)'}`,
    );
  }
  for (const [id, host] of [
    ['cn26-stay-00', 'www.trip.com'],
    ['cn26-stay-01', 'www.trip.com'],
    ['cn26-stay-02', 'www.agoda.com'],
    ['cn26-stay-03', 'www.agoda.com'],
    ['cn26-stay-04', 'www.trip.com'],
    ['cn26-stay-05', 'www.trip.com'],
    ['cn26-stay-06', 'secure.booking.com'],
    ['cn26-stay-08', 'secure.booking.com'],
    ['cn26-stay-09', 'www.trip.com'],
    ['cn26-stay-10', 'www.rghk.com.hk'],
    ['cn26-stay-12', 'www.trip.com'],
  ] as const) {
    const url = stays.find((s) => s.id === id)?.manageUrl ?? '';
    if (url.startsWith(`https://${host}/`)) continue;
    fail(`${id} must link to the platform it was booked on (${host}) — got "${url || '(none)'}"`);
  }
  pass('each booked bed links to the platform it was actually booked on');
  /* A booked bed must carry the paperwork it was booked with, or the card is a
     stamp with nothing behind it. Four Points, Blossom House, Huatian and
     Glenview have Trip.com order numbers, Pullman an Agoda booking id, Yue Tu a
     Booking.com confirmation number and The Royal Garden a direct-booking
     reservation number; every one of them is what the desk or the order page
     asks for. Four Points' number is the LIVE order: the one this list carried
     until 2026-07-27 belonged to an order that was replaced, and a dead number
     read out at a desk is worse than no number at all. */
  for (const [id, code] of [
    ['cn26-stay-00', '1653715561783471'],
    ['cn26-stay-01', '1653715561827302'],
    ['cn26-stay-03', '682760663'],
    ['cn26-stay-04', '1653715534089209'],
    ['cn26-stay-05', '1653715534121148'],
    ['cn26-stay-06', '5942328968'],
    ['cn26-stay-08', '6352597569'],
    ['cn26-stay-09', '1653715562519718'],
    ['cn26-stay-10', 'cohTex87hq19CnTh'],
    ['cn26-stay-12', '1653717166174001'],
  ] as const) {
    const b = stays.find((s) => s.id === id);
    if (b?.code === code && b.codeLabel && b.meta.length > 0) {
      pass(`${id} carries its confirmation number, label and ${b.meta.length} chips`);
    } else {
      fail(`${id} is booked but carries no counter-facing confirmation number`);
    }
  }
  /* THE SUPERSEDED FOUR POINTS ORDER MUST NOT SURVIVE ANYWHERE IN THE SEED —
     not as the code, not in the note, not in a chip. It is a dead credential,
     and a dead credential printed beside a live booking is exactly the thing a
     tired traveller reads out at 23:00. */
  const seedTextEarly = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });
  if (!seedTextEarly.includes('1653715561596848') && !/9858/.test(seedTextEarly)) {
    pass('the superseded Four Points order number and its PIN are gone from the seed');
  } else {
    fail('the superseded Four Points order number or its PIN 9858 is still in the seed');
  }
  /* EVERY BOOKED BED NOW CARRIES A NUMBER, and Element was the last one that
     did not. Its Agoda number was never captured until 2026-07-29, and until
     then this loop asserted the OPPOSITE — that the bed carried no code at all,
     because a plausible number is worse than an empty strip. It arrived, so the
     assertion inverts: no booked bed may be numberless again without someone
     deleting this check on purpose. (Blossom House left the old list on
     2026-07-27, when the Trip.com bookings list finally showed its order.)
     Element's `codeSub` is not a PIN. Agoda sold a room allotted from
     booking.com, so the property may know the stay by 5351254076 rather than by
     the Agoda ID — both numbers have to reach the desk.

     AND THE ACADEMY IS THE BED THAT PROVES THE OTHER HALF OF IT, 2026-08-12.
     No number was ever ISSUED for it — it is held by an acknowledged deposit,
     not by an order — so it must carry none, and the assertion for it is the
     mirror image: no code, no label, no secondary line. "Nobody ever gave us a
     number" and "we lost the number" have to stay tellable apart, which is
     exactly why this is two checks and not one relaxed one. */
  const numberless = stays.filter((b) => b.status === 'booked' && b.id !== ACADEMY && !b.code);
  if (!numberless.length) {
    pass('every bed booked on a platform carries a confirmation number — Element was the last blank and it is filled');
  } else {
    fail(`booked beds with no confirmation number: ${numberless.map((b) => b.id).join(', ')}`);
  }
  if (!academy?.code && !academy?.codeLabel && !academy?.codeSub) {
    pass('the academy draws no code strip, because no reference for it has ever existed');
  } else {
    fail(`${ACADEMY} is showing a reference nobody issued: ${academy?.code ?? academy?.codeLabel ?? academy?.codeSub}`);
  }
  const el = stays.find((s) => s.id === 'cn26-stay-02');
  if (el?.code === '683386279' && /5351254076/.test(el.codeSub ?? '') && !!el.priceNote && el.meta.length > 0) {
    pass('cn26-stay-02 carries its Agoda ID, the booking.com allotment number behind it, and its terms');
  } else {
    fail(`cn26-stay-02 must carry Agoda 683386279 and allotment 5351254076 — got code=${el?.code ?? '(none)'} sub=${el?.codeSub ?? '(none)'}`);
  }
  /* FOUR POINTS, AND THE DIFFERENCE BETWEEN UNKNOWN AND UNREAD. From 2026-07-27
     this assertion demanded the opposite of what it demands now: no PIN, no
     payment mode, no deadline, and specifically NOT the dead order's
     16:00-Dec-5 window, which would have been the most expensive sentence in
     the app if the rebooking had moved it.
     On 2026-08-12 the order DETAIL page was opened for the first time and
     printed all three — PIN 1170, "Prepay Online ✓ Paid US$244.74", and free
     cancellation to 16:00 on 5 Dec, the SAME window the superseded order had.
     The old refusal was still right: the terms were unknowable from the
     bookings list, and carrying them across on the assumption that a rebooking
     preserves them would have been a guess that merely happened to be correct.
     What this now defends is that the bed says what its own order says. */
  const fourPoints = stays.find((b) => b.id === 'cn26-stay-00');
  const fpChips = (fourPoints?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    fourPoints?.priceNote === '$244.74 (2n)' &&
    /1170/.test(fourPoints.codeSub ?? '') &&
    /free cancel=to 16:00 dec 5/i.test(fpChips) &&
    /payment=prepaid online/i.test(fpChips) &&
    !/not stated/i.test(fpChips)
  ) {
    pass('cn26-stay-00 carries its PIN, its 16:00 Dec 5 window and the prepayment its order states');
  } else {
    fail(`cn26-stay-00 must carry PIN 1170, the 16:00 Dec 5 window and PREPAID ONLINE — got "${fpChips}"`);
  }
  /* YUE TU'S REFUND CLIFF. Free to 23:59 Dec 13, and from 00:00 on Dec 14 a
     cancellation costs one night (US$63). It is the deadline that decides the
     gorge bag transfer, so a card showing only "free cancellation" would hide
     both the money and the decision. */
  const yuetu = stays.find((b) => b.id === 'cn26-stay-06');
  const ytChips = (yuetu?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (/free cancel=to 23:59 dec 13/i.test(ytChips) && /00:00 dec 14/i.test(ytChips) && /US\$63/i.test(ytChips)) {
    pass('cn26-stay-06 carries its 14 Dec refund cliff, priced');
  } else {
    fail(`cn26-stay-06 must print the free window AND the one-night cost after it — got "${ytChips}"`);
  }
  /* THE DEADLINE THAT COSTS MONEY. Element Chongli is the only bed on the trip
     whose free-cancellation window shuts before its own check-in day, and a
     generic "free cancellation" chip would quietly lose 46% of the booking. */
  const element = stays.find((b) => b.id === 'cn26-stay-02');
  const cancelChip = element?.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '';
  if (/00:00/.test(cancelChip) && /dec 9/i.test(cancelChip)) pass(`cn26-stay-02 carries its real deadline: ${cancelChip}`);
  else fail(`cn26-stay-02 must carry the 00:00 Dec 9 cut-off, not a generic promise — got "${cancelChip}"`);
  /* THE SECOND DEADLINE THAT COSTS MONEY, and the only three-tier one on the
     trip. Pullman is free to 23:59 Dec 9, partial from 00:00 Dec 10 and
     NON-REFUNDABLE from 00:00 Dec 11 — its own check-in day, where a no-show
     costs 100% of ¥887.52. All three tiers must be on the card: a bed showing
     only the free window would read as safe on Dec 10, when it is not. */
  const pullman = stays.find((b) => b.id === 'cn26-stay-03');
  const tiers = (pullman?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (/free cancel=to 23:59 dec 9/i.test(tiers) && /partial.*00:00 dec 10/i.test(tiers) && /no refund=from 00:00 dec 11/i.test(tiers)) {
    pass('cn26-stay-03 carries all three cancellation tiers, cliff included');
  } else {
    fail(`cn26-stay-03 must print free/partial/NON-REFUNDABLE with their dates — got "${tiers}"`);
  }
  /* THE CURRENCY RULE. Pullman, Huatian and Glenview printed NO dollar figure
     on their confirmations, so their cards carry the yuan they were quoted in
     and the app converts at the trip's own stored rate. A dollar priceNote on
     any of them would be a number the paperwork never stated.

     YUE TU is the fourth, and it got there by a different road: its Booking.com
     page printed BOTH currencies and then said which one is real — the charge
     happens in CNY, the dollar figure is a converted display, the rate may move.
     US$126.55 is Booking.com's own conversion at ≈6.77, the OTA rate this repo
     never mixes with its own, so ¥857.30 is the price and $119.90 is derived.

     DALI IS THE FIFTH, by Yue Tu's road exactly: the same platform, both
     currencies again, and a cancellation clause that quotes the penalty as
     "CNY 324 (US$47.83)" — yuan first, which is the page naming the currency of
     the charge. US$47.83 ÷ ¥324 is ≈6.774, Booking.com's display rate to three
     decimals. ¥324.00 is the price; $45.31 is derived at 7.15.
     THE IBIS IS NOT IN THIS LIST, and that is the rule working rather than an
     exception to it: its Trip.com order priced the night in US dollars, took US
     dollars, and printed no yuan at all. Carry what will actually be charged —
     and it already was. */
  for (const [id, want] of [
    ['cn26-stay-03', '¥887.52 (2n)'],
    ['cn26-stay-04', '¥419.00'],
    ['cn26-stay-05', '¥1,166.00 (2n)'],
    ['cn26-stay-06', '¥857.30 (2n)'],
    ['cn26-stay-08', '¥324.00'],
    /* The sixth, 2026-09-28: the Muping night is paid at the desk in CASH, in
       yuan. Trip.com's ≈US$24.42 is its own conversion (≈6.72) and is not the
       charge, so ¥164.00 is the price and $22.94 is derived at 7.15. */
    ['cn26-stay-12', '¥164.00'],
  ] as const) {
    const b = stays.find((s) => s.id === id);
    if (b?.priceNote === want) pass(`${id} is priced in the currency its confirmation printed: ${want}`);
    else fail(`${id} must be quoted at ${want}, not converted — got "${b?.priceNote ?? '(none)'}"`);
  }
  /* THE THREE BEDS THAT SAID "NOT STATED" FOR THREE WEEKS, AND WHY THEY DO NOT
     ANY MORE. Four Points, Huatian and Glenview each showed no cancellation
     terms and no payment mode, so each had to SAY so — inventing "free
     cancellation" from old research would have been the most expensive sentence
     in the app. On 2026-08-12 all three order DETAIL pages were opened and every
     one of them printed both. The bookings LIST had never carried them; nobody
     had clicked through. Unread, not unknown.
     The check inverts rather than disappearing, because the property worth
     defending is unchanged: each bed states what its own order states, and none
     of them may drift back to a research line.
     BLOSSOM HOUSE JOINED ON 2026-09-27, the fourth bed "unread, not unknown": its
     Trip.com confirmation EMAIL of 27 Jul printed "Prepay Online — Paid" and a
     free window to 23:00 on Dec 4, and the card said "not stated — ask" and
     "no deadline shown" for two months. */
  for (const [id, cancel, pay] of [
    ['cn26-stay-00', /to 16:00 dec 5/i, /prepaid online/i],
    ['cn26-stay-01', /to 23:00 dec 4/i, /prepaid online/i],
    ['cn26-stay-04', /free before check-in/i, /pay at hotel/i],
    ['cn26-stay-05', /free before check-in/i, /pay at hotel/i],
  ] as const) {
    const b = stays.find((s) => s.id === id);
    const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
    const c = b?.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '';
    const p = b?.meta.find((m) => /^payment$/i.test(m.k))?.v ?? '';
    if (cancel.test(c) && pay.test(p) && !/not stated/i.test(chips)) {
      pass(`${id} carries the cancellation terms and payment mode its order states`);
    } else {
      fail(`${id} must state its own order's terms, not "not stated" — got cancel="${c}" pay="${p}"`);
    }
  }

  /* DALI'S CLIFF, and the arrival nobody has declared. Free to 23:59 on Dec 15;
     from 00:00 on Dec 16 the WHOLE ¥324 is charged, which makes it the second
     bed on the trip that reaches a 100% loss. And its desk shuts at 23:00 — an
     hour earlier than Yue Tu's midnight — on the night the owner arrives by
     shared car off the gorge road, with no late arrival declared. A card that
     showed only "free cancellation" would hide the cliff; one that said nothing
     about 23:00 would hide the reason the standing late-arrival rule is NOT
     satisfied here the way it is at Yue Tu.
     INVERTED 2026-09-27. The arrival WAS declared — Booking.com approved a
     22:00–23:00 check-in on 27 Jul — and nobody had read the email. So the
     chip must now say APPROVED, must still say 23:00 (the door did not move),
     and "not declared" must be gone from the whole bed: a warning that outlives
     its truth teaches the reader to skip warnings. The day's job — WhatsApp the
     ETA when leaving Tina's — rides as its own chip. */
  const dali = stays.find((b) => b.id === 'cn26-stay-08');
  const dlChips = (dali?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    /free cancel=to 23:59 dec 15/i.test(dlChips) &&
    /00:00 dec 16/i.test(dlChips) &&
    /¥324/.test(dlChips) &&
    /late arrival=22:00–23:00 approved/i.test(dlChips) &&
    /23:00/.test(dlChips) &&
    /eta/i.test(dlChips) &&
    !/not declared/i.test(`${dlChips} ${dali?.note ?? ''}`) &&
    /payment=not stated/i.test(dlChips)
  ) {
    pass('cn26-stay-08 carries its 16 Dec cliff, its 23:00 desk, its APPROVED late arrival and the ETA job');
  } else {
    fail(`cn26-stay-08 must print the free window, the full-price cliff, the approved arrival and the ETA job — got "${dlChips}"`);
  }
  /* THE VISA-EXIT NIGHT, AND THE BED THAT WAS BOOKED BEFORE IT WAS ACCEPTED.
     Trip.com took US$25.73 and issued a number on 27 Jul while its own page
     still said "Confirming" with an "Expedite Booking" button beside it; the
     property accepted on 29 Jul and the order now reads Confirmed. The seed
     tracked both states honestly and the assertion moved with it — what is
     checked now is that the bed says CONFIRMED and that the word "Confirming"
     survives NOWHERE on it, because a stale warning on the exit night is as
     misleading as a premature tick was. The `alert` flag is gone with it.
     Everything that made this bed worth asserting in the first place — the
     shuttle, the prepayment, the Dec 17 window — is still checked. */
  const ibis = stays.find((b) => b.id === 'cn26-stay-09');
  const ibChips = (ibis?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    ibis?.status === 'booked' &&
    ibis.alert !== true &&
    /status=confirmed/i.test(ibChips) &&
    !/confirming/i.test(ibChips) &&
    !/confirming/i.test(ibis.note ?? '') &&
    /free cancel=to 23:00 dec 17/i.test(ibChips) &&
    /shuttle=/i.test(ibChips) &&
    /payment=prepaid online/i.test(ibChips) &&
    ibis.priceNote === '$25.73'
  ) {
    pass('cn26-stay-09 is booked, paid, CONFIRMED, and shows its shuttle and its Dec 17 window');
  } else {
    fail(`cn26-stay-09 must be booked and CONFIRMED with no "Confirming" left, plus the shuttle and the Dec 17 cut-off — got "${ibChips}"`);
  }
  /* The Royal Garden's check-out is 11:00. It was 12:00 in every earlier
     version of this trip, and an hour is the difference between a leisurely
     M+ morning and a late-check-out charge. */
  const royal = stays.find((b) => b.id === 'cn26-stay-10');
  const outChip = royal?.meta.find((m) => /check-out/i.test(m.k))?.v ?? '';
  if (/11:00/.test(outChip) && !/12:00/.test(outChip)) pass(`cn26-stay-10 checks out at ${outChip}`);
  else fail(`cn26-stay-10 check-out must read 11:00, not the old 12:00 — got "${outChip}"`);

  /* THE ROYAL GARDEN IS PAID AND CANNOT MOVE — and for two months the card said
     the opposite. It was paid in full on 30 Jul 2026 to answer a credit-card
     demand, and Reservations wrote on 31 Jul that it is "under non-refundable
     basis, no cancellation or amendment is allowed". Until 2026-09-27 the card
     still printed "free to 14:00 Dec 19 CST" and "US$1,232.01 at the hotel", and
     the deadline list still diarised a window that no longer existed. So: the
     card must say PAID and NON-REFUNDABLE, carry no free-cancel chip at all,
     tell you to keep the 31 Jul email offline — and nowhere in the seed may a
     free window at 14:00 on Dec 19 come back. (Dali's "Dec 19 · 14:00–23:00"
     check-in chip is a different fact and is not what this pattern matches.) */
  const rgChips = new Map((royal?.meta ?? []).map((m) => [m.k, m.v]));
  const deadWindow =
    /free[^"|]{0,40}14:00[^"|]{0,12}(?:Dec 19|19 Dec)|to 14:00 Dec 19|(?:Dec 19|19 Dec)[^"|]{0,4}\(?CST|1,232\.01 at the hotel/i;
  if (
    /PAID IN FULL/i.test(rgChips.get('Payment') ?? '') &&
    !/at the hotel/i.test(rgChips.get('Payment') ?? '') &&
    /NON-REFUNDABLE/i.test(rgChips.get('Cancellation') ?? '') &&
    !(royal?.meta ?? []).some((m) => /free cancel/i.test(m.k)) &&
    /31 Jul/.test(royal?.note ?? '') &&
    /OFFLINE/.test(royal?.note ?? '') &&
    !deadWindow.test(seedTextEarly)
  ) {
    pass('cn26-stay-10 is PAID and NON-REFUNDABLE, and the dead 14:00 Dec 19 window appears nowhere');
  } else {
    fail(`cn26-stay-10 must read PAID IN FULL + NON-REFUNDABLE with no free-cancel chip, and "free to 14:00 Dec 19" may not survive anywhere — got "${[...rgChips].map(([k, v]) => `${k}=${v}`).join(' | ')}"`);
  }

  /* THE 27 SEP REVIEW'S OTHER CORRECTIONS, each guarded where it could quietly
     come back:
     · TIANMEN is not "the world's longest cableway" this winter — the upper
       section has been under renovation since 6 Nov 2025 and the east glass
       skywalk closed since 12 May 2026. The ticket card must say both, and a
       re-check task must exist before anything is bought.
     · KUNMING SOUTH is not "in Xiaguan" — Xiaguan is where DALI's station is.
     · NOV 22's fallback card said "neither is booked" six weeks after CA8683
       was bought. It must now be the "EY888 is late" plan. */
  const tianmen = bundle.bookings.find((b) => b.id === 'cn26-ticket-tianmen');
  const tmChips = (tianmen?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  const recheck = bundle.tasks.find((t) => t.id === 'cn26-task-tianmen-recheck');
  if (
    !/longest cable ?way/i.test(seedTextEarly) &&
    /6 Nov 2025/.test(tmChips) &&
    /12 May 2026/.test(tmChips) &&
    /re-check/i.test(tmChips) &&
    (recheck?.due ?? '') >= '2026-11-15' && (recheck?.due ?? '') <= '2026-11-30'
  ) {
    pass('Tianmen: no "longest cableway", both 2026 closures on the card, and a late-Nov re-check task');
  } else {
    fail(`Tianmen must carry the 2026 closures and a late-Nov re-check, and nothing may promise the longest cableway — got "${tmChips}"`);
  }
  if (!/Kunming South(?![^."|]{0,12}\bnot\b)[^."|]{0,60}Xiaguan/i.test(seedTextEarly)) { // an explicit "is NOT in Xiaguan" is the correction, not the error
    pass('Kunming South is never placed in Xiaguan');
  } else {
    const hit = /Kunming South(?![^."|]{0,12}\bnot\b)[^."|]{0,60}Xiaguan/i.exec(seedTextEarly)?.[0] ?? '';
    fail(`the seed still puts Kunming South "in Xiaguan" — Xiaguan is where DALI's station is: "${hit}"`);
  }
  const nov22 = bundle.bookings.find((b) => b.id === 'cn26-train-nov22');
  if (
    !/Neither is booked|flight if booked/i.test(seedTextEarly) &&
    /EY888/.test(nov22?.note ?? '') &&
    /separate tickets/i.test(nov22?.note ?? '')
  ) {
    pass('Nov 22: CA8683 is booked, and the HSR card is the "EY888 is late" plan');
  } else {
    fail('Nov 22 still says the Yantai flight is unbooked, or the fallback card lost its EY888 framing');
  }
  /* The exit day has ONE leave time: alarm 09:30, leave the ibis ~10:15, at the
     terminal by 10:50. Three different hours used to sit on three screens. */
  const exitAlarm = bundle.alarms.find((a) => a.date === '2026-12-21');
  const exitRun = (bundle.runbooks.find((r) => r.id === 'cn26-run-exit')?.steps ?? []).join(' ');
  const exitDay = (bundle.dayPlans.find((d) => d.date === '2026-12-21')?.planItems ?? []).join(' ');
  if (
    exitAlarm?.time === '09:30' &&
    /10:15/.test(exitAlarm.title) &&
    /10:15/.test(exitRun) && /10:50/.test(exitRun) &&
    /10:15/.test(exitDay) && /10:50/.test(exitDay) &&
    !/11:30/.test(exitRun)
  ) {
    pass('Dec 21: one leave time everywhere — alarm 09:30, leave ~10:15, terminal by 10:50');
  } else {
    fail(`Dec 21 must say 09:30 / ~10:15 / 10:50 in the alarm, the runbook and the day — alarm ${exitAlarm?.time ?? '(none)'}`);
  }
  /* Four tasks closed on 2026-09-27 must stay closed, and the 6 Aug on-sale
     alarm is marked done — alarms are index-keyed, so a passed one is marked,
     never deleted. */
  /* +4 on 2026-09-28: yantai-flights (CA1560 booked), yantai-bed (Muping
     booked), psb (the school registers you) and late-arrivals (both hotels told
     on 27 Sep). And a SECOND alarm is marked done: the Nov 20 Yantai→Beijing
     train window, which Dec 5's flight made moot — marked, not deleted, because
     alarm ids are index-keyed. */
  const closed = ['hotel-beijing', 'hotels-mainland', 'hkjc', 'hk-xmas', 'yantai-flights', 'yantai-bed', 'psb', 'late-arrivals']
    .filter((k) => bundle.tasks.some((t) => t.id === `cn26-task-${k}`));
  const onSale = bundle.alarms.find((a) => a.date === '2026-08-06');
  const trainWindow = bundle.alarms.find((a) => a.date === '2026-11-20');
  if (
    !closed.length &&
    onSale?.done === true &&
    trainWindow?.done === true && /CA1560/.test(trainWindow.title) &&
    bundle.alarms.filter((a) => a.done).length === 2
  ) {
    pass('the eight closed tasks stay closed; the 6 Aug on-sale and the moot Nov 20 train window are the two alarms marked done');
  } else {
    fail(`closed tasks back: ${closed.join(', ') || '(none)'}; 6 Aug alarm done=${onSale?.done}; Nov 20 alarm done=${trainWindow?.done}`);
  }

  /* 2026-09-28 — THE ACADEMY ANSWERED, AND TWO BOOKINGS FOLLOWED. Each fact
     below is guarded where it could quietly revert. */
  /* 1. THE TWELFTH BED: booked, Trip.com, ¥164 in CASH at the desk, free
     before check-in, and NO map button — the Blossom House rule (an address is
     fired at Amap on the phone before it becomes a button). The Chinese name
     rides on the note for the YNT taxi. */
  const muping = stays.find((b) => b.id === 'cn26-stay-12');
  const mpChips = (muping?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    muping?.status === 'booked' &&
    muping.checkIn === '2026-11-22' && muping.checkOut === '2026-11-23' &&
    /Muping/.test(muping.title) &&
    muping.code === '1653717166174001' &&
    muping.priceNote === '¥164.00' &&
    muping.manageUrl === 'https://www.trip.com/account/orderlist/' &&
    /payment=pay at hotel — cny 164\.00, in cash/i.test(mpChips) &&
    /free cancel=before check-in/i.test(mpChips) &&
    /pickup=.*10:30/i.test(mpChips) &&
    /锦江之星品尚酒店\(烟台牟平汽车站西关夜市店\)/.test(muping.note ?? '') &&
    /No\. 460 Moushan Road/.test(muping.note ?? '') &&
    !muping.address && !muping.mapQuery && !muping.coord && !muping.mapUrl
  ) {
    pass('cn26-stay-12 is the Muping night: booked, ¥164 cash at the desk, free before check-in, pickup from 10:30, no map button');
  } else {
    fail(`cn26-stay-12 must be the booked Muping night at ¥164 cash, free before check-in, with no map target — got "${mpChips}"`);
  }
  /* 2. CA1560, AS BOOKED — 14:55 → 16:15. Air China retimed it before it was
     bought, so the planned 15:40 → 17:15 may survive only as a labelled
     history chip, never as the flight's time, and nothing may still call it
     unbooked. It lands at CAPITAL, and it opens no map: YNT has no verified
     card (map-links.ts). */
  const ca1560 = bundle.bookings.find((b) => b.id === 'cn26-flight-ca1560');
  const caChips = (ca1560?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    ca1560?.kind === 'flight' && ca1560.status === 'booked' &&
    ca1560.date === '2026-12-05' && ca1560.flightNo === 'CA 1560' &&
    ca1560.from.code === 'YNT' && ca1560.to.code === 'PEK' &&
    ca1560.dep === '14:55' && ca1560.arr === '16:15' &&
    ca1560.code === '1653717880605553' && ca1560.priceNote === '$110.30' &&
    /NE1K88/.test(caChips) && /999-2580773936/.test(ca1560.codeSub ?? '') &&
    /retimed=was 15:40/i.test(caChips) &&
    !ca1560.mapQuery && !ca1560.coord && !ca1560.mapUrl &&
    !/CA ?1560[^|".]{0,30}15:40/.test(seedTextEarly) &&
    !/Dec 5[^|".]{0,40}(?:NOT booked|not booked yet|unbooked)/i.test(seedTextEarly)
  ) {
    pass('CA1560 is booked at the times it was bought (14:55 → PEK T3 16:15), $110.30, and nothing still offers 15:40 or calls Dec 5 unbooked');
  } else {
    fail(`cn26-flight-ca1560 must be YNT 14:55 → PEK 16:15, $110.30, order 1653717880605553, with no map — got "${caChips}"`);
  }
  /* 3. THE $100 IS NOT PART OF THE $840 — the school, 28 Sep: "a one-time
     application fee". For six weeks the app said nobody knew whether it came
     off the $840, and the forecast carried two readings for it. So: every
     sentence in the seed that puts the $840 next to the deposit / fee / $100
     and a "comes off / counts against / part of / netted" verb must be a
     NEGATION, the ledger line must call it an application fee, and the wallet
     card must carry the school's $100. */
  const feeSentences = seedTextEarly
    .split(/[.!?\n]|\\n|<br>/)
    .filter((t) => /\$840/.test(t) && /(deposit|application fee|\$100|\$110)/i.test(t) && /(comes? off|counts? against|part of|netted|net it)/i.test(t));
  const unNegated = feeSentences.filter((t) => !/\bnot\b|\bnever\b|n't\b/i.test(t));
  const feeLine = bundle.expenses.find((e) => e.id === 'cn26-exp-prepaid-kunyu-deposit');
  const feeCard = bundle.walletCards.find((c) => c.id === 'cn26-card-kunyu');
  if (
    feeSentences.length > 0 && !unNegated.length &&
    /application fee/i.test(feeLine?.desc ?? '') && feeLine?.homeMinor === 10000 &&
    feeCard?.code === '$100 PAID' && /application fee/i.test(feeCard.codeLabel ?? '') &&
    !/whether the deposit|may or may not count|UNKNOWN: whether/i.test(seedTextEarly)
  ) {
    pass(`the $100 is an application fee and never part of the $840 (${feeSentences.length} sentences checked, all negations)`);
  } else {
    fail(`the $100 is described as possibly part of the $840: ${unNegated.map((t) => `"${t.trim().slice(0, 90)}"`).join(' · ') || '(ledger or card label)'}`);
  }
  /* 4. THE SCHOOL'S OTHER ANSWERS, where the day shows them: the pickup is
     from 10:30 (not 11:00) on the chip, the Nov 23 day and the arrival
     runbook; the PSB line says the school does it; Nov 28 is a written day
     that says there is no training; Dec 5 runs on its own runbook. */
  const acPickup = academy?.meta.find((m) => m.k === 'Pickup')?.v ?? '';
  const nov23 = (bundle.dayPlans.find((d) => d.date === '2026-11-23')?.planItems ?? []).join(' ');
  const nov28 = bundle.dayPlans.find((d) => d.date === '2026-11-28');
  const arriveRun = (bundle.runbooks.find((r) => r.id === 'cn26-run-arrive')?.steps ?? []).join(' ');
  const dec5 = bundle.dayPlans.find((d) => d.date === '2026-12-05');
  const dec5Run = (bundle.runbooks.find((r) => r.id === 'cn26-run-dec5')?.steps ?? []).join(' ');
  if (
    /10:30/.test(acPickup) && !/11:00/.test(acPickup) &&
    /10:30/.test(nov23) && /school does it/i.test(nov23) &&
    /10:30/.test(arriveRun) && !/11:00 tomorrow/.test(arriveRun) && /Muping/.test(arriveRun) &&
    !!nov28 && /no training on saturdays/i.test(nov28.planItems.join(' ')) &&
    dec5?.runbookId === 'cn26-run-dec5' && /14:55/.test(dec5Run) && /Capital/.test(dec5Run) &&
    /11:30–12:00/.test(dec5Run)
  ) {
    pass('the academy\'s 28 Sep answers are on the days: pickup from 10:30, PSB by the school, Nov 28 free, Dec 5 on its own runbook');
  } else {
    fail(`the 28 Sep answers are missing from a day — pickup chip "${acPickup}", Nov 28 ${nov28 ? 'present' : 'MISSING'}, Dec 5 runbook ${dec5?.runbookId ?? '(none)'}`);
  }

  /* Prepaid expenses: only documented payments, each on a real category.
     Booking is still not paying for SEVEN of the eight booked beds — Four
     Points' live order states no payment mode at all, Blossom House never said
     whether it was charged (both had been — see FIVE below), Element is due at the property, Huatian and
     Glenview state nothing, Pullman takes nothing until 8 Dec 2026, and the
     Royal Garden took US$0 online with the whole total due at the desk.

     EXACTLY ONE bed is counted as paid, and only because its own terms say the
     money moves at reservation rather than on some later date: Yue Tu Inn
     charges a prepayment of the first night "after reservation". ¥428.65 of
     ¥857.30 — the page's own halving, since it prices a post-14-Dec
     cancellation at one night. Anything more than one lodging line here means
     a booking has been mistaken for a receipt again. */
  const catIds = new Set(bundle.categories.map((c) => c.id));
  let prepaidSum = 0;
  for (const e of bundle.expenses) {
    if (!catIds.has(e.categoryId)) fail(`expense ${e.id} references missing category ${e.categoryId}`);
    /* The same arithmetic the app itself uses (logic/money.ts → toHomeMinor):
       rateToHome is units of the expense's currency per 1 home unit, so home is
       amount DIVIDED by the rate. This used to multiply, which was invisible
       while every expense was in the home currency at rate 1 and would have
       silently passed a 51× error on the first foreign one. */
    if (e.homeMinor !== Math.round((e.amount / e.rateToHome) * 100)) fail(`expense ${e.id} home amount does not match`);
    if (e.refund) fail(`expense ${e.id} is a refund — the seed carries payments only`);
    prepaidSum += e.homeMinor;
  }
  /* FOUR BEDS HAVE TAKEN MONEY as of 2026-08-12, and the fourth was taken long
     before anyone here knew. Four Points' order says "Prepay Online ✓ Paid",
     US$244.74 — visible on the order DETAIL page and on no other screen, which
     is why this repo spent sixteen days listing the bed among those that had
     paid nothing. It is a CORRECTION, not a purchase: no money moved on 12 Aug.
     The other three, unchanged, and the Royal Garden still the largest.
     The Royal Garden was not due — the hotel demanded a credit card by 5 Aug or
     the room would be "released automatically without prior notice", and the
     answer given was to pay the room outright. Counted on the same test as the
     other two: the money has left the account. Accounts had not finished
     verifying, which is a confirmation to chase and not a reason to un-count
     $1,232.01 that is gone. See accommodation-2026-07-25.md §12. */
  const lodging = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-lodging');
  const night1 = lodging.find((e) => e.id === 'cn26-exp-prepaid-yuetu-night1');
  const ibisPaid = lodging.find((e) => e.id === 'cn26-exp-prepaid-ibis-kunming');
  const royalPaid = lodging.find((e) => e.id === 'cn26-exp-prepaid-royal-garden');
  const fourPtsPaid = lodging.find((e) => e.id === 'cn26-exp-prepaid-four-points');
  /* FIVE from 2026-09-27: Blossom House, US$299.56, "Prepay Online — Paid" on
     its Trip.com confirmation email of 27 Jul — the Four Points correction made
     a second time. Counted whole, the $52.96 gift-card part included. */
  const blossomPaid = lodging.find((e) => e.id === 'cn26-exp-prepaid-blossom-house');
  if (
    lodging.length === 5 &&
    blossomPaid?.currency === 'USD' &&
    blossomPaid.amount === 299.56 &&
    blossomPaid.rateToHome === 1 &&
    blossomPaid.homeMinor === 29956 &&
    fourPtsPaid?.currency === 'USD' &&
    fourPtsPaid.amount === 244.74 &&
    fourPtsPaid.rateToHome === 1 &&
    fourPtsPaid.homeMinor === 24474 &&
    night1?.currency === 'CNY' &&
    night1.amount === 428.65 &&
    night1.rateToHome === 7.15 &&
    night1.homeMinor === 5995 &&
    ibisPaid?.currency === 'USD' &&
    ibisPaid.amount === 25.73 &&
    ibisPaid.rateToHome === 1 &&
    ibisPaid.homeMinor === 2573 &&
    royalPaid?.currency === 'USD' &&
    royalPaid.amount === 1232.01 &&
    royalPaid.rateToHome === 1 &&
    royalPaid.homeMinor === 123201
  ) {
    pass('lodging spent so far: ¥428.65 → $59.95 + $25.73 + $244.74 + $299.56 + $1,232.01 = $1,861.99, five beds');
  } else {
    fail(`lodging must be Yue Tu, the ibis, Four Points ($244.74), Blossom House ($299.56) and the Royal Garden — got ${lodging.length} line(s)`);
  }
  /* THE TRIP.COM GIFT CARD IS GONE, removed 2026-08-06 at the owner's request
     because it was spent — "i finish my coupon nothing left", 27 Jul 2026.
     An assertion used to live here demanding the card read $0 and that no
     screen still promised its old ~$298. Removing the card makes the same claim
     more simply, and the check below proves the promise is gone from the whole
     seed rather than only from one card. WHICH bookings the balance absorbed is
     unknown and stays unknown: no bed's price or payment mode was ever adjusted
     for it, because none of that is stated anywhere.
     Its NUMBER stays guarded in check-dist-clean — a spent card number is still
     personal data, and it must never appear in a built bundle. */
  const stillPromised = /\$?29[78](\.\d+)?\b/.test(
    JSON.stringify(bundle.walletCards) + JSON.stringify(bundle.tasks) + JSON.stringify(bundle.infoCards),
  );
  if (bundle.walletCards.some((c) => c.id === 'cn26-card-giftcard')) {
    fail('the gift card was removed on 2026-08-06 — it must not come back');
  } else if (stillPromised) {
    fail("a screen still promises the gift card's old ~$298 balance");
  } else {
    pass('the spent gift card is gone, and nothing still offers its old ~$298');
  }
  if (prepaidSum === PREPAID_MINOR) pass(`prepaid total: $${prepaidSum / 100}`);
  else fail(`prepaid total: expected $${PREPAID_MINOR / 100}, got $${prepaidSum / 100}`);
  if (bundle.trip.coverDocId && !photoIds.has(bundle.trip.coverDocId)) fail('trip cover points at a missing photo');
  pass('referential integrity checked (incl. photos, cover and read-more)');

  /* value + privacy layer over the serialized seed (documents excluded — base64) */
  const text = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });
  for (const v of MUST_CONTAIN) {
    if (text.includes(v)) pass(`contains ${v.length > 12 ? v.slice(0, 12) + '…' : v}`);
    else fail(`missing critical value: ${v}`);
  }

  /* Neither passport number is written anywhere in the repo. Each is read from
     a private file outside it (privacy/private-ids.ts) and must be absent from
     the seed and from the handoff source. On a machine without the file the
     check says SKIPPED — it never silently passes. */
  const fullText = text + bundle.documents.map((d) => d.dataBase64).join('');
  const handoffText = readFileSync(handoffMdPath, 'utf8');
  for (const id of loadPrivateIds()) {
    if (!id.value) {
      pass(`${id.label} check SKIPPED — no private file at ${id.file}`);
      continue;
    }
    if (fullText.includes(id.value)) fail(`the ${id.label} appears in the seed`);
    else pass(`${id.label} absent`);
    /* The handoff source must stay redacted too (the owner's rule, 28 Sep 2026). */
    if (handoffText.includes(id.value)) fail(`the ${id.label} is back in the handoff source`);
  }

  /* The passport card stays — title, name, date of birth, the rule — but it
     carries NO number (the owner's decision, 28 Sep 2026). */
  const passportCard = bundle.walletCards.find((c) => c.id === 'cn26-card-passport');
  if (!passportCard) fail('the passport wallet card is missing');
  else if (passportCard.code) fail('the passport wallet card carries a number again');
  else if (!passportCard.rows.some((r) => /not stored/i.test(r.v))) fail('the passport card no longer says the number is not stored');
  else pass('passport card present, with no number stored');

  /* THE MAP TAB'S LAYER (Map 5a, map-layer.ts): every spot, driver card and
     booking has one of the eight categories; every pin is one pins.ts
     confirmed, inside its anchor's radius, on a place with no coord of its
     own; no bed carries a coord; every detail is the trip's own words,
     verbatim, within 90 characters. Only checked where the layer was built. */
  const layered = bundle.bookings.some((b) => b.category !== undefined);
  if (layered) {
    const problems = mapLayerProblems(bundle);
    for (const p of problems) fail(`map layer: ${p}`);
    if (!problems.length) {
      const spots = bundle.stops.flatMap((s) => s.spots ?? []);
      const cards = bundle.showCards.filter((c) => c.kind === 'place');
      const pinned = [...spots, ...cards, ...bundle.bookings].filter((e) => e.pin).length;
      const detailed = [...spots, ...cards, ...bundle.bookings].filter((e) => e.detail).length;
      pass(`map layer: ${spots.length + cards.length + bundle.bookings.length} places categorised, ${pinned} new pins inside their radius, ${detailed} details verbatim`);
    }
  }

  return { ok, lines };
}

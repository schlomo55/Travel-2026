/* Parity assertions for the China seed. Two layers:
   1. Structural counts — every legacy collection arrives whole.
   2. Privacy + critical values — the French-passport data is present where
      expected, and the Israeli passport number (read from the handoff source,
      never hardcoded here) appears NOWHERE in the seed. */
import { readFileSync } from 'node:fs';
import type { TripBundle } from '../../src/lib/model/types';
import { ADDRESS_MAX } from '../../src/lib/logic/geo';
import { isOpenable, placeIndex } from '../../src/lib/logic/places';
import { PLACE_PHOTOS } from './photos';

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
  dayPlans: 27,
  dayDefaults: 2,
  runbooks: 8, // +1 on 2026-07-27: Dec 19, the gorge exit into a desk that shuts at 23:00
  flights: 8,
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
  stays: 12,
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
     booking. It becomes a bed the day one is picked. */
  tasks: 27,
  /* +1 on 2026-07-27: Yue Tu's free-cancellation cliff, the morning of Dec 13.
     +1 on 2026-07-28: Jade Dragon's 20:00 release on Dec 10. It is an alarm and
     not just a task because it is the only booking on the trip measured in
     minutes — and it lands on a ski day, when nobody is thinking about Lijiang. */
  /* +1 on 2026-07-29: the 6 Aug URBTIX on-sale for the HK Phil Christmas
     concert. An alarm and not just a task because it is a 10:00 sale eight days
     out, and because what it really needs decided is which of two evenings to
     give up — Macau's, or the trip's only Wednesday at Happy Valley. */
  alarms: 19,
  packingItems: 30,
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
  expenses: 12,
  /* NEW on 2026-07-28 with day-places.ts — nothing above moved, because nothing
     was added to the trip: the manifest only JOINS day prose to entities that
     already shipped. These two exist so the join cannot silently evaporate. A
     rebuild that lost the import would leave every count above green and every
     day-plan chip row gone, which is precisely the failure this repo is built
     to refuse.
     24 of the 26 dayPlans + the Kunyu Sunday default = 25 dated/templated days
     that go somewhere. Nov 29 (a Yantai errand day) and Dec 10 (a full day on
     the Chongli greens, no named venue) carry no key at all, and the Kunyu
     training week has nothing to open but the academy, whose address is still
     officially pending.

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
     Bodhi came off Dec 5 and Dec 6, Tina's off Dec 19. No day lost its row. */
  dayPlaceLinks: 87, // every id across all of them, duplicates within a day already removed
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
export const PREPAID_MINOR = 202600 + 11730 + 24100 + 23000 + 29300 + 10000 + 5995 + 2573 + 123201 + 8833 + 14840 + 24474;

/** Values that must appear in the seed (spot layer of the 57-value audit; M8 does the full pass). */
const MUST_CONTAIN = [
  '8CR7MR', // Etihad PNR (4 segments)
  'PLF8S9', // CA1953 airline PNR
  'NGNRZ1', // 3U8011 airline PNR
  'MZ904B', // MU733 airline ref
  '1653716183770225', // Trip.com CA1953
  '1653716249124273', // Trip.com 3U8011
  '1653716248615345', // Trip.com MU733
  /* Four Points was REBOOKED on 2026-07-27 at a better rate. The order this
     list used to name (…596848) is dead and no longer ships anywhere; the live
     one is below. A dead order number is still personal data, so it stays
     guarded in check-dist-clean by the same family pattern — it is simply not
     something the seed must CONTAIN any more. */
  '1653715561783471', // Trip.com Four Points, the live order (booked 2026-07-27)
  '1653715561827302', // Trip.com Blossom House — the number that was missing until 2026-07-27
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
  '[redacted]', // French passport — the ONLY passport in the app
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
     2. EVERY END EITHER OPENS OR SAYS WHY IT DOES NOT. Four of the ten ends on
        this trip are not named in any document; those ship no button and print
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
  const BOOKED =
    'cn26-stay-00,cn26-stay-01,cn26-stay-02,cn26-stay-03,cn26-stay-04,cn26-stay-05,cn26-stay-06,cn26-stay-08,cn26-stay-09,cn26-stay-10,cn26-stay-11';
  if (bookedBeds.join(',') === BOOKED) pass(`booked beds: ${bookedBeds.length} of 12`);
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
     bed is not: it was arranged by message, no platform holds it, no rate was
     ever confirmed in writing, and the accommodation document says so in its
     own words — "price and room NOT confirmed in writing". An unconfirmed price
     may not join a total, so this bed carries NEITHER field, and the check
     below demands BOTH absences of it. Relaxing the rule to "most beds" would
     let the next bed lose its price by accident. */
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
    !academy.priceNote &&
    !academy.manageUrl &&
    !academy.bookingLinkUrl &&
    !academy.code &&
    !academy.codeLabel &&
    !academy.codeSub
  ) {
    pass('the academy stay is held for its 12 nights and quotes no price, no reference and no platform');
  } else {
    fail(
      `${ACADEMY} must be a booked Kunyu stay 2026-11-23 → 2026-12-05 with no price, no code and no link — got ` +
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
     of them may drift back to a research line. */
  for (const [id, cancel, pay] of [
    ['cn26-stay-00', /to 16:00 dec 5/i, /prepaid online/i],
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
     satisfied here the way it is at Yue Tu. */
  const dali = stays.find((b) => b.id === 'cn26-stay-08');
  const dlChips = (dali?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
  if (
    /free cancel=to 23:59 dec 15/i.test(dlChips) &&
    /00:00 dec 16/i.test(dlChips) &&
    /¥324/.test(dlChips) &&
    /late arrival=not declared/i.test(dlChips) &&
    /23:00/.test(dlChips) &&
    /payment=not stated/i.test(dlChips)
  ) {
    pass('cn26-stay-08 carries its 16 Dec cliff, its 23:00 desk and an undeclared arrival');
  } else {
    fail(`cn26-stay-08 must print the free window, the full-price cliff and the undeclared arrival — got "${dlChips}"`);
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

  /* Prepaid expenses: only documented payments, each on a real category.
     Booking is still not paying for SEVEN of the eight booked beds — Four
     Points' live order states no payment mode at all, Blossom House never said
     whether it was charged, Element is due at the property, Huatian and
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
  if (
    lodging.length === 4 &&
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
    pass('lodging spent so far: ¥428.65 → $59.95 + $25.73 + $244.74 + $1,232.01 = $1,562.43, four beds');
  } else {
    fail(`lodging must be Yue Tu, the ibis, Four Points ($244.74) and the Royal Garden — got ${lodging.length} line(s)`);
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
  const stillPromised = /\$?29[78](\.\d+)?/.test(
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

  /* The Israeli passport number lives ONLY in the handoff source. Read it from
     there and prove it is absent from the seed — without ever writing it down. */
  const handoff = readFileSync(handoffMdPath, 'utf8');
  const israeliLines = handoff.split('\n').filter((l) => /israeli/i.test(l));
  if (israeliLines.length === 0) fail('could not locate the Israeli-passport line in the handoff source');
  /* Only identifier-shaped tokens (must contain a digit) count — plain words on
     that line ("bookings", the name) legitimately appear elsewhere. The French
     passport number is explicitly allowed: it is the one passport in the app. */
  const frenchPassport = bundle.walletCards.find((c) => c.id === 'cn26-card-passport')?.code;
  const forbidden = new Set<string>();
  for (const line of israeliLines) {
    for (const tok of line.match(/\b[A-Z0-9]{6,12}\b/gi) ?? []) {
      if (/\d/.test(tok) && tok !== frenchPassport) forbidden.add(tok);
    }
  }
  const fullText = text + bundle.documents.map((d) => d.dataBase64).join('');
  let leaked = 0;
  for (const tok of forbidden) {
    if (fullText.includes(tok)) {
      leaked++;
      fail('a value from the Israeli-passport line appears in the seed');
    }
  }
  if (forbidden.size > 0 && leaked === 0) pass(`Israeli passport number absent (checked ${forbidden.size} token[s])`);

  return { ok, lines };
}

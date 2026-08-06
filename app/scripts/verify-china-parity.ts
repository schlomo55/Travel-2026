/* The China parity audit: every trip-critical value in the seed is re-checked
   against the ORIGINAL source documents — not against the legacy app, which is
   itself a transcription. If a value cannot be found in the sources, it is
   reported so it can be confirmed by hand.
   Run: npm run verify:china */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, TripBundle } from '../src/lib/model/types';
import { ADDRESS_MAX } from '../src/lib/logic/geo';
import { PLACE_PHOTOS } from './china/photos';
import { AIRPORT_CARDS } from './china/transform';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const src = join(repo, 'sources', 'china-2026');

const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const bundle = seed.trips[0] as TripBundle;

/* All source documents concatenated: the guide, the handoff, the insurance
   comparison, the original app spec — and the accommodation document, which is
   the AUTHORITY for every bed and every number that moved with them (the raised
   budget included). Where it and the guide disagree about a hotel, it wins; the
   guide's hotel lines are simply stale from 2026-07-26 on. */
const sourceText = [
  'china-2026-trip-guide-v12.html',
  'china-2026-handoff-prompt.md',
  'insurance-quotes-comparison.md',
  'china-app-prompt.md',
  'accommodation-2026-07-25.md',
]
  .map((f) => readFileSync(join(src, f), 'utf8'))
  .join('\n');

/* The PDF is binary; pull the readable ASCII runs out of it so ticket numbers
   and PNRs printed in it can still be matched. */
const pdfText = readFileSync(join(src, 'China-2026-Flights.pdf'))
  .toString('latin1')
  .replace(/[^\x20-\x7e]+/g, ' ');

const haystack = (sourceText + '\n' + pdfText).replace(/\s+/g, ' ');
const seedText = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });

interface Check {
  what: string;
  value: string;
  /** Normalize before searching (the guide writes some values with separators). */
  loose?: boolean;
  /** Also accept these spellings — the documents write dates as "Dec 27". */
  alt?: string[];
  /** Printed only on the flight PDF, whose text uses subset fonts and cannot be
      read by a script. Verified by eye against the PDF, not by this check. */
  pdfOnly?: boolean;
}

/** How many places must still carry a street address. Set from the last
    `npm run verify:places` run, plus the Four Points address that arrived with
    its booking on 2026-07-27 — hence 61, not 60. The Chongli and Hong Kong
    bookings later the same day did NOT move it: Element's confirmation
    reprinted an address the repo already had, and the Royal Garden's replaced a
    short line with a fuller one. Nor did the three booked after them: Pullman's
    confirmation misspells its street (GADYUN for Gaoyun) so the document's
    spelling was kept, and Huatian's and Glenview's Trip.com bookings print no
    address at all. A rebuild that quietly loses addresses fails
    here rather than shipping map buttons that went back to being vaguer.

    62 FROM 2026-07-27 EVENING, when the last two beds were booked. DALI gained
    one: its document entry carried verified COORDINATES and no street, and its
    Booking.com confirmation printed a street — the Four Points case exactly, a
    confirmation supplying what the document never had. (The coordinate is still
    not shipped; a bed never ships a dot.) The ibis Kunming booking did NOT move
    the count: its Trip.com order prints a fuller line that is not a superset of
    the one already shipping, and adopting it would cost the word "Kunming" at
    the ADDRESS_MAX trim. */
const ADDRESS_COUNT_FLOOR = 62;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-12-22' → 'Dec 22' / '22 Dec', the forms the documents actually use. */
function dateSpellings(iso: string): string[] {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const mon = MON[m - 1];
  return mon ? [`${mon} ${d}`, `${d} ${mon}`] : [];
}

const CRITICAL: Check[] = [
  // identity
  { what: 'French passport number', value: '[redacted]' },
  { what: 'Etihad Guest number', value: '600023186044', pdfOnly: true },
  // international flights
  { what: 'Etihad PNR', value: '8CR7MR' },
  { what: 'EY608 departure', value: '14:00' },
  { what: 'EY888 arrival at Daxing', value: '08:45' },
  { what: 'EY871 departure from HKG', value: '19:35' },
  { what: 'EY609 arrival at TLV', value: '04:35' },
  // domestic flights
  { what: 'CA1953 Trip.com booking', value: '1653716183770225' },
  { what: 'CA1953 airline PNR', value: 'PLF8S9', pdfOnly: true },
  { what: 'CA1953 departure', value: '17:00' },
  { what: '3U8011 Trip.com booking', value: '1653716249124273' },
  { what: '3U8011 airline PNR', value: 'NGNRZ1', pdfOnly: true },
  { what: '3U8011 PIN', value: '2786' },
  { what: '3U8011 departure', value: '20:20' },
  { what: 'MU733 Trip.com booking', value: '1653716248615345' },
  { what: 'MU733 airline reference', value: 'MZ904B' },
  { what: 'MU733 departure', value: '13:50' },
  { what: 'MU733 seat', value: '7A' },
  /* beds — the EIGHT booked: six on 2026-07-27, plus Huatian and Glenview on
     2026-07-26. Every one of these is checked against the accommodation
     document, which is the authority for beds and now records the confirmed
     numbers rather than the planned ones.

     Four Points is checked on its LIVE order. The superseded one is deliberately
     absent from this list: it is in the accommodation document as labelled
     history, but nothing in the seed may contain it, and a check that demanded
     it be present would enforce the opposite of what we want. */
  { what: 'Four Points Trip.com booking (live order)', value: '1653715561783471' },
  { what: 'Four Points price as rebooked', value: '244.74' },
  { what: 'Four Points confirmed address', value: 'No. 20 Gongti East Road' },
  { what: 'Blossom House Trip.com booking', value: '1653715561827302' },
  { what: 'Blossom House price as booked', value: '299.56' },
  /* Supplied 29 Jul 2026, and with it the last numberless bed on the trip is
     gone. TWO numbers, because Agoda sold a room allotted from booking.com and
     the property may only recognise the second one. */
  { what: 'Element Agoda booking ID', value: '683386279' },
  { what: 'Element booking.com allotment number', value: '5351254076' },
  { what: 'Element property phone', value: '+86 313 477 8500' },
  { what: 'Element Chongli price as booked', value: '232.95' },
  { what: 'Element Chongli charge in CNY', value: '1,575.99', loose: true },
  { what: 'Element Chongli cancellation cliff', value: '54%' },
  /* Pullman printed no USD at all, so the CNY total IS the price and there is
     no dollar figure to check against the sources — deliberately. */
  { what: 'Pullman Agoda booking id', value: '682760663' },
  { what: 'Pullman charge in CNY', value: '887.52', loose: true },
  { what: 'Pullman room + tax split', value: '761.14', loose: true },
  { what: 'Pullman non-refundable cliff', value: '00:00 Dec 11', alt: ['00:00 on 11 Dec', '11 Dec 2026, 00:00'] },
  { what: 'Pullman card auto-charge date', value: 'charged automatically on 8 December' },
  { what: 'Pullman property phone', value: '+86 744 888 8888' },
  { what: 'Huatian Trip.com booking', value: '1653715534089209' },
  { what: 'Huatian charge in CNY', value: '419.00', loose: true },
  { what: 'Glenview Trip.com booking', value: '1653715534121148' },
  { what: 'Glenview charge in CNY', value: '1,166.00', loose: true },
  /* Yue Tu printed BOTH currencies and said the CNY one is what gets charged,
     so the CNY total is the price and the USD is Booking.com's display. Both
     are checked — the point of the judgment is that both were on the page. */
  { what: 'Yue Tu Booking.com confirmation', value: '5942328968' },
  { what: 'Yue Tu PIN', value: '3635' },
  { what: 'Yue Tu charge in CNY', value: '857.30', loose: true },
  { what: "Yue Tu's US display total", value: '126.55', loose: true },
  { what: 'Yue Tu first night, prepaid at booking', value: '428.65', loose: true },
  { what: 'Yue Tu refund cliff', value: '00:00 Dec 14', alt: ['00:00 on 14 Dec', '14 Dec 2026'] },
  { what: 'Yue Tu property phone', value: '+86 151 5325 4963' },
  { what: 'Yue Tu approved late arrival', value: '22:00–23:00' },
  /* DALI printed both currencies too, and its cancellation clause quotes the
     penalty as "CNY 324 (US$47.83)" — yuan first, which is the page naming the
     currency of the charge. Both figures are checked, exactly as Yue Tu's are:
     the whole point of the judgment is that the page carried both. */
  { what: 'Dali Booking.com confirmation', value: '6352597569' },
  { what: 'Dali PIN', value: '8706' },
  { what: 'Dali charge in CNY', value: '324', loose: true },
  { what: "Dali's US display total", value: '47.83', loose: true },
  { what: 'Dali refund cliff', value: '00:00 Dec 16', alt: ['00:00 on 16 Dec', '16 Dec 2026'] },
  { what: 'Dali check-in window closes', value: '23:00' },
  { what: 'Dali property phone', value: '+86 189 8708 1208' },
  { what: 'Dali confirmed address', value: 'Yinxian Road, Shuidui Village' },
  /* THE VISA-EXIT NIGHT. Paid in dollars, numbered, and — since 29 Jul 2026 —
     CONFIRMED on the platform, after two days booked-but-not-accepted. Every
     one of those four facts is checked, because this is the bed the legal exit
     from the mainland rests on. */
  { what: 'ibis Trip.com booking', value: '1653715562519718' },
  { what: 'ibis PIN', value: '2284' },
  { what: 'ibis price as booked', value: '25.73', loose: true },
  { what: 'ibis prepaid online', value: 'Prepay Online' },
  /* A bare "CONFIRMED" would pass vacuously — the word is all over both files.
     The fact worth pinning is the DATE the property accepted, which is what
     separates this bed's real state from the two days it spent unaccepted. */
  { what: 'ibis platform status', value: 'accepted 29 Jul 2026' },
  { what: 'ibis free airport transfer', value: 'free airport transfer' },
  { what: 'ibis cancellation cut-off', value: '23:00 Dec 17', alt: ['23:00 on 17 Dec', '17 Dec 2026'] },
  { what: 'ibis property phone', value: '+86-871-68513339' },
  { what: 'Royal Garden reservation number', value: 'cohTex87hq19CnTh' },
  { what: 'Royal Garden price as booked', value: '1,232.01', loose: true },
  { what: 'Royal Garden charge in HKD', value: '9,661.50', loose: true },
  { what: 'Royal Garden confirmed address', value: '69 Mody Road, Tsimshatsui East' },
  { what: 'Royal Garden 24-hour reception phone', value: '+852 2721 5215' },
  /* Booked direct means there is no OTA account holding a copy, so the
     reservations desk IS the manage channel and has to be reachable on the card. */
  { what: 'Royal Garden reservations phone', value: '+852 2733 2828' },
  { what: 'Royal Garden reservations email', value: 'rsvoff@rghk.com.hk' },
  /* THE EXPERIENCES (scripts/china/tickets.ts, new 2026-08-06). Only the five
     whose figures the GUIDE itself prints are checked here — this audit is
     seed-against-source, and its haystack is the guide, the handoff, the
     insurance comparison, the app prompt and the accommodation document.
     Jade Dragon's release hour, 重庆1949's ¥180–600, Huatian's ¥300 and ¥500,
     Ngong Ping's ~HK$270 and Lung King Heen's minimum are in the trip's own
     to-do list (legacy/index.html) and NOT in those five files, so they are
     transcribed under the same rule the rail fares are and asserted for
     PRESENCE in assert.ts rather than for agreement here. Listing them as
     critical values would print a permanent "confirm by hand" for facts that
     are already written down; the honest place to fix that is the source
     folder, not this list. */
  { what: 'Macau ferry fare per leg', value: 'HK$194–242' },
  { what: 'Macau ferry terminal', value: 'Sheung Wan' },
  { what: 'the HZMB bus fallback', value: 'HK$65' },
  { what: 'Great Wall guide package price', value: '~$180 solo' },
  { what: 'Thaiwoo English group lesson price', value: '~$50–70' },
  { what: 'Forbidden City winter ticket', value: '¥40 (~$6)' },
  // money
  /* The two quotes are history now — the card carries the POLICY, not the
     shortlist, so the seed no longer contains either figure. What must survive
     is what was actually bought, and it is checked against the same document
     that held the comparison. */
  { what: 'Phoenix policy number', value: '260676675684357' },
  { what: 'insurance price paid', value: '148.40' },
  { what: 'budget total', value: '7500', loose: true },
  /* the booked-flights line of the guide: ~$2,026 + $241 + $230 + $293 = ~$2,790 */
  { what: 'international flights as booked', value: '~$2,026' },
  { what: 'CA1953 booked fare', value: '$241' },
  { what: '3U8011 booked fare', value: '$230' },
  { what: 'MU733 booked fare', value: '$293' },
  // the dates that gate everything
  { what: 'trip start', value: '2026-11-21' },
  { what: 'trip end', value: '2026-12-27' },
  { what: 'mainland entry', value: '2026-11-22' },
  { what: 'planned exit', value: '2026-12-21' },
  { what: 'visa hard deadline', value: '2026-12-22' },
];

const norm = (s: string): string => s.replace(/[\s,-]/g, '').toLowerCase();
const looseHay = norm(haystack);
const looseSeed = norm(seedText);

let missingFromSeed = 0;
let missingFromSources = 0;
const notes: string[] = [];
const pdfOnly: string[] = [];

for (const c of CRITICAL) {
  const inSeed = c.loose ? looseSeed.includes(norm(c.value)) : seedText.includes(c.value);
  /* Dates are written as "Dec 22" in the documents, not ISO. */
  const spellings = [c.value, ...(c.alt ?? []), ...(/^\d{4}-\d{2}-\d{2}$/.test(c.value) ? dateSpellings(c.value) : [])];
  const inSources = spellings.some((v) => (c.loose ? looseHay.includes(norm(v)) : haystack.includes(v)));

  if (!inSeed) {
    console.error(`✗ ${c.what} (${c.value}) is MISSING FROM THE SEED`);
    missingFromSeed++;
  } else if (inSources) {
    console.log(`✓ ${c.what}`);
  } else if (c.pdfOnly) {
    pdfOnly.push(`· ${c.what} (${c.value}) — printed only on the flight PDF, whose text is not machine-readable. Check it by eye once.`);
  } else {
    notes.push(`? ${c.what} (${c.value}) is in the seed but not found in the source documents — confirm by hand`);
    missingFromSources++;
  }
}

/* Structural facts the trip depends on. */
const structural: [string, boolean][] = [
  ['visa counter starts the day AFTER entry', bundle.counters[0]?.countStartsDayAfter === true],
  ['visa limit is 30 days', bundle.counters[0]?.limitDays === 30],
  ['trip spans 37 days', bundle.trip.start === '2026-11-21' && bundle.trip.end === '2026-12-27'],
  ['seven flights are present', bundle.bookings.filter((b) => b.kind === 'flight').length === 7],
  /* THE FIVE TRAIN JOURNEYS, as cards since 2026-07-28 (scripts/china/rail.ts).
     They were always in the trip — Beijing↔Taizicheng, Zhangjiajie West →
     Chongqing, Dali → Kunming and the Nov 22 fallback — but only ever inside
     the prose of a day line, so the one screen you look at on a concourse had
     nothing on it. Nothing was added to the trip; five journeys already written
     down became five cards. */
  ['five rail legs are present', bundle.bookings.filter((b) => b.kind === 'train').length === 5],
  /* AND NOT ONE OF THEM IS BOOKED, which is the fact the cards exist to keep in
     front of you: the trip's own key dates still say to buy each as its 15-day
     window opens. No confirmation number, and no `priceNote` either — the
     documented fares are estimates for tickets nobody has bought, and
     `priceNote` is what "Booked & committed" adds up. They ride as chips. */
  ['no train is booked, and no unbought fare is counted as a cost',
    bundle.bookings.filter((b) => b.kind === 'train').every((b) => b.status === 'pending' && !b.priceNote && !b.code)],
  /* THE HARD PART OF PHASE 3, as a structural fact. Ten rail ends; four are not
     named in any document the trip carries — the Dec 11 arrival ("back to
     Beijing"), the Dec 14 arrival ("Chongqing", which has two main stations far
     apart), the Dec 20 departure ("Dali", whose "the station is in Xiaguan"
     line does not say WHICH station) and the Nov 22 arrival ("Yantai", a city).
     Those four ship no button and print the reason on the card instead. The
     other six carry eight buttons between them, because the Dec 9 departure is
     "Beijing North / Qinghe" — two stations the plan names without choosing, so
     the card opens both rather than making the choice for it. */
  ['every rail end either opens or says on the card why it does not',
    (() => {
      const ends = bundle.bookings
        .filter((b): b is Extract<typeof b, { kind: 'train' }> => b.kind === 'train')
        .flatMap((b) => [b.from, b.to]);
      const withButtons = ends.filter((e) => (e.stations ?? []).length > 0);
      const silent = ends.filter((e) => (e.stations ?? []).length === 0);
      return ends.length === 10 &&
        silent.length === 4 && silent.every((e) => !!e.why?.trim()) &&
        withButtons.reduce((n, e) => n + (e.stations ?? []).length, 0) === 8 &&
        withButtons.every((e) => (e.stations ?? []).every((s) => !!s.name.trim() && (!!s.mapQuery || !!s.coord)));
    })()],
  /* THE ELEVEN EXPERIENCES, as cards since 2026-08-06 (scripts/china/tickets.ts).
     Same story as the trains: every one of them was already in the trip — the
     concert in the Dec 22 plan, the cableways and the show and the guided wall
     day in their own tasks — and none of them had anywhere to live on the one
     screen you hold up at a counter. Nothing was added to the trip. */
  ['eleven experiences are present', bundle.bookings.filter((b) => b.kind === 'activity').length === 11],
  /* AND EXACTLY ONE OF THEM IS BOOKED. The HK Phil concert was bought on
     6 Aug 2026 at the 10:00 Hong Kong on-sale. The other ten are things still to
     buy, several behind windows measured in minutes — Jade Dragon's cable car
     sells out inside them — so a card that read "booked" would tell the owner
     there is nothing left to chase. */
  ['exactly one experience is booked, and it is the concert',
    bundle.bookings.filter((b) => b.kind === 'activity' && b.status === 'booked').map((b) => b.id).join(',') ===
      'cn26-ticket-hkphil'],
  /* NO UNBOUGHT TICKET IS PRICED OR NUMBERED. `priceNote` is what "Booked &
     committed" totals, so the hotel's ¥300 for Tianmen and the ferry's
     HK$194–242 must stay chips; and a plausible reference on a ticket nobody
     owns is worse than an empty strip, because it is what gets read out at a
     door. Ten rows therefore count as unpriced on the money screen. */
  ['no unbought experience is priced or numbered',
    bundle.bookings.filter((b) => b.kind === 'activity' && b.status === 'pending')
      .every((b) => b.status === 'pending' && !b.priceNote && !b.code)],
  /* THE CONCERT ITSELF — the only thing on this trip you can be turned away at a
     door for not having. The reference is the counter-facing string, the seat is
     on the card, and the URBTIX warning must outlive every rebuild: the
     confirmation email is not a ticket, and this falls in the last week of a trip
     that spends five weeks somewhere Gmail does not open without the VPN. */
  ['the concert carries its reference, its seat and the URBTIX warning',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-ticket-hkphil');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return b?.kind === 'activity' && b.status === 'booked' &&
        b.code === '26080616302422701001' && /26080616302422701\b/.test(b.codeSub ?? '') &&
        b.priceNote === 'HK$689' && b.time === '19:30' &&
        /Cultural Centre/i.test(b.venue ?? '') &&
        /STAL2/.test(chips) && /Row DD/.test(chips) && /Seat 44/.test(chips) &&
        /valid ticket only/i.test(b.note ?? '');
    })()],
  /* AND ITS MONEY IS COUNTED ONCE. HK$689 appears on two cards that answer
     different questions — the ticket's price on "Booked & committed", the
     expense on "Total spent" — exactly as the three prepaid beds do. What must
     not exist is a second expense for it, or an expense for anything still
     pending: the tickets category holds one line and one only. */
  ['only the ticket that was actually bought is counted as spending',
    (() => {
      const spent = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-tickets');
      const hkphil = spent[0];
      return spent.length === 1 && hkphil?.id === 'cn26-exp-prepaid-hkphil' &&
        hkphil.currency === 'HKD' && hkphil.amount === 689 && hkphil.rateToHome === 7.8 && hkphil.homeMinor === 8833;
    })()],
  /* A TICKET OPENS A PLACE THIS REPO ALREADY VERIFIED, OR IT OPENS NOTHING. Ten
     borrow one whole — the Cultural Centre, the Sheung Wan pier, 故宫博物院,
     金山岭长城, 武陵源, 天门山, 重庆1949大剧院, 玉龙雪山, the Ngong Ping terminal and
     Lung King Heen. The eleventh, the Thaiwoo ski lesson, borrows from nothing:
     太舞滑雪小镇 is the one place card on this trip that never had a coordinate to
     certify a name against, so nothing here may open it either. */
  ['ten of the eleven experiences open a verified place, and the ski lesson opens nothing',
    (() => {
      const list = bundle.bookings.filter((b) => b.kind === 'activity');
      const withButton = list.filter((b) => b.mapQuery || b.coord || b.mapUrl);
      const lesson = list.find((b) => b.id === 'cn26-ticket-ski-lesson');
      return list.length === 11 && withButton.length === 10 &&
        withButton.every((b) => !!b.mapQuery) &&
        !lesson?.mapQuery && !lesson?.coord && !lesson?.mapUrl && !lesson?.address;
    })()],
  ['eleven beds are present', bundle.bookings.filter((b) => b.kind === 'hotel').length === 11],
  ['one bed is a walk-in (the gorge)', bundle.bookings.filter((b) => b.status === 'walkin').length === 1],
  ['ten stops plus the flights entry', bundle.stops.length === 11],
  ['the Kunyu address is still pending, not invented',
    bundle.showCards.some((c) => c.pending && /kunyu/i.test(c.meaning))],
  /* THE DAY→PLACE JOIN, as a structural fact (scripts/china/day-places.ts).
     Every day plan that goes somewhere carries the ids of places that ALREADY
     shipped, and every one of them must still open. The failure this catches is
     not a wrong pin — assert.ts stops those before the seed is even written —
     it is the join quietly evaporating from a rebuilt seed while every other
     count stays green, which would take the chip row off all 25 days and say
     nothing. The two dateless days (Nov 29, Dec 10) and the Kunyu training week
     carry no field at all, which is the correct empty.
     25 days / 90 links since 2026-07-28: Phase 2 added thirty verified spots
     across two research passes, which gave Dec 22 (Macau) its first row and
     twenty-six more chips to fifteen days that had been naming places the seed
     could not open. The gate run then took ONE off and it went straight back
     on: Dec 7's 后海 card had no coordinate to certify its name against, so the
     owner sourced one from Wikidata rather than let the button go.

     THEN THE PHONE TOOK THREE OFF AND THEY STAYED OFF, 2026-08-01: 90 → 87.
     All 141 Amap targets were fired at a signed-in Amap on the S23 and read
     back off the screen. Two names OpenStreetMap answers, Amap does not —
     菩提 三里屯 returns the district, and Tina's returns first nothing and then
     a different guesthouse at the same gorge descent — so both were demoted to
     no button and came off Dec 5, Dec 6 and Dec 19. Twenty-five days still
     carry a row; none was emptied. A number that only ever goes up is a number
     nobody is checking. */
  ['every day-plan place link resolves to something openable, and no day carries an empty list',
    (() => {
      const days = [...bundle.dayPlans, ...bundle.dayDefaults];
      const withPlaces = days.filter((d) => d.placeIds !== undefined);
      const openable = new Set<string>();
      for (const s of bundle.stops) {
        for (const e of [s, ...(s.spots ?? [])]) if (e.mapUrl || e.mapQuery || e.address || e.coord) openable.add(e.id);
      }
      for (const e of [...bundle.showCards, ...bundle.bookings]) {
        if (e.mapUrl || e.mapQuery || e.address || e.coord) openable.add(e.id);
      }
      return withPlaces.length === 25 &&
        withPlaces.every((d) => (d.placeIds ?? []).length > 0 && (d.placeIds ?? []).every((id) => openable.has(id))) &&
        days.reduce((n, d) => n + (d.placeIds?.length ?? 0), 0) === 87;
    })()],
  /* FLIPPED 2026-08-06. For the whole life of this repo the insurance card was
     asserted to be PENDING, because it was — and it was the largest open risk
     on the trip: $4,296 committed against Sanda sparring, three days on skis, a
     4,506 m cable car and a 2,700 m trek. It is bought. The assertion now
     guards the opposite, so a rebuild cannot quietly lose the policy number and
     go back to telling the owner to buy what they already own. */
  ['insurance is BOUGHT and carries its policy number',
    (() => {
      const c = bundle.walletCards.find((w) => /insurance/i.test(w.title));
      return !!c && !c.pending && (c.code ?? '').includes('260676675684357');
    })()],
  ['CA1953 carries its PEK-not-Daxing warning',
    bundle.bookings.some((b) => b.kind === 'flight' && b.flightNo.includes('1953') && /not Daxing/i.test(b.note ?? ''))],
  /* $2,975.68 → $4,207.69 on 2026-08-01, and $1,232.01 of that arrived in one
     payment: The Royal Garden, paid in full to answer a credit-card ultimatum.
     Lodging spent went $85.68 → $1,317.69, which is 93% of it in a single line. */
  /* $4,207.69 → $4,296.02 on 2026-08-06: the HK Phil concert, HK$689 including
     URBTIX's HK$9 fee, converted at the trip's own 7.8 → $88.33. Small money,
     and the first of its kind here — every other line is a flight, a bed, a
     deposit or a border. It is also the first thing charged in Hong Kong
     dollars, so it is the first use of that rate. */
  /* $4,296.02 → $4,444.42 on 2026-08-06: the Phoenix policy, $148.40. The
     smallest line here and the one that changes the most — everything above it
     had been committed with nothing standing behind it. */
  ['only documented prepayments are logged as spending ($4,444.42)',
    bundle.expenses.length === 10 &&
    bundle.expenses.reduce((s, e) => s + e.homeMinor, 0) === 444442 &&
    bundle.expenses.every((e) => e.id.startsWith('cn26-exp-prepaid-'))],
  /* Booking is still not paying for seven of the eight booked beds. Four
     Points' LIVE order states no payment mode at all (the old order's
     pay-at-hotel and its $144.84 hold went with it), Blossom House's order
     never said whether it was charged, Element is due at the property, Huatian
     and Glenview state nothing, Pullman takes nothing until 8 Dec 2026 and the
     Royal Garden took US$0 online. A charge scheduled for December is a date,
     not a receipt.

     EXACTLY ONE bed is counted as paid: Yue Tu Inn charges a prepayment of the
     first night "after reservation" — present tense, at booking, and the
     reservation is confirmed. ¥428.65 of ¥857.30, in the currency the charge is
     made in, converted at the trip's own 7.15 rather than Booking.com's ≈6.77.
     Leaving lodging at $0 would now be the invention. */
  /* THREE FROM 2026-08-01. The Royal Garden was paid in full — US$1,232.01, the
     whole booking total — not because it was due but because the hotel refused
     the debit card given at booking and demanded a credit card by 5 Aug 15:00 HK
     or the room would be "released automatically without prior notice". Paying
     answered that, and the same reply made the booking non-refundable and
     unamendable. It is counted on the test the other two are counted on: the
     money has left the account. Accounts had not finished verifying, which is a
     confirmation to chase and not a reason to un-count it. */
  ['exactly three beds are counted as paid, and only the ones whose terms already took the money',
    (() => {
      const beds = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-lodging');
      const yue = beds.find((e) => e.id === 'cn26-exp-prepaid-yuetu-night1');
      const ibis = beds.find((e) => e.id === 'cn26-exp-prepaid-ibis-kunming');
      const royal = beds.find((e) => e.id === 'cn26-exp-prepaid-royal-garden');
      return beds.length === 3 &&
        yue?.currency === 'CNY' && yue.amount === 428.65 && yue.rateToHome === 7.15 && yue.homeMinor === 5995 &&
        ibis?.currency === 'USD' && ibis.amount === 25.73 && ibis.rateToHome === 1 && ibis.homeMinor === 2573 &&
        royal?.currency === 'USD' && royal.amount === 1232.01 && royal.rateToHome === 1 && royal.homeMinor === 123201;
    })()],
  /* THE TEN BOOKED BEDS — every bed on the trip except the gorge guesthouse,
     which is a deliberate walk-in. Eight went on 26–27 Jul; Dali and Kunming
     completed the set on 2026-07-27. This is the check that fails if any one of
     them silently reverts to pending. */
  ['the ten booked beds are booked, and no other bed is',
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'booked').map((b) => b.id).join(',') ===
      'cn26-stay-00,cn26-stay-01,cn26-stay-02,cn26-stay-03,cn26-stay-04,cn26-stay-05,cn26-stay-06,cn26-stay-08,cn26-stay-09,cn26-stay-10'],
  ['nothing is pending any more — the walk-in is the only unbooked bed',
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'pending').length === 0 &&
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'walkin').length === 1],
  /* THE OWNER'S RULE, 2026-07-27: a booked bed shows its price, that it IS
     booked, and a link to the site it was booked on. No exceptions — Element
     had no confirmation number until 2026-07-29 and still had its link, because
     not knowing the number is a different admission from not being able to
     reach the order. The number arrived; the link rule never moved.
     Each link is the PLATFORM'S entry point, never a guessed deep link, and
     each must point at the platform that bed was actually booked on. */
  ['every booked bed carries a price and a link to the site it was booked on',
    (() => {
      const want: Record<string, string> = {
        'cn26-stay-00': 'https://www.trip.com/account/orderlist/',
        'cn26-stay-01': 'https://www.trip.com/account/orderlist/',
        'cn26-stay-02': 'https://www.agoda.com/account/bookings.html',
        'cn26-stay-03': 'https://www.agoda.com/account/bookings.html',
        'cn26-stay-04': 'https://www.trip.com/account/orderlist/',
        'cn26-stay-05': 'https://www.trip.com/account/orderlist/',
        'cn26-stay-06': 'https://secure.booking.com/mytrips.html',
        'cn26-stay-08': 'https://secure.booking.com/mytrips.html',
        'cn26-stay-09': 'https://www.trip.com/account/orderlist/',
        'cn26-stay-10': 'https://www.rghk.com.hk/en/index.php',
      };
      const booked = bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'booked');
      return booked.length === 10 &&
        booked.every((b) => !!b.priceNote && b.manageUrl === want[b.id]);
    })()],
  /* THE GIFT CARD IS SPENT. Zero, stated by the owner on 2026-07-27, and the
     card must still HAVE a balance field — "$0" and "we never tracked it" are
     different claims. Which bookings absorbed it is unknown, so nothing
     anywhere may still offer the old ~$298 to spend. */
  /* REMOVED 2026-08-06. The card was spent and the owner asked for it to go, so
     the seed no longer carries its number or its original value — which is why
     the two CRITICAL checks for those figures went with it. What replaces them
     is the stronger claim: the card is absent AND no screen still promises the
     ~$298 it used to hold. The number itself is still guarded by
     check-dist-clean, because spent or not it is personal data. */
  ['the spent gift card is gone, and nothing still promises its old balance',
    !bundle.walletCards.some((c) => c.id === 'cn26-card-giftcard') &&
    !/29[78]/.test(JSON.stringify([bundle.walletCards, bundle.tasks, bundle.infoCards]))],
  ['the five yuan bookings are quoted in yuan, not in an invented or borrowed dollar figure',
    (() => {
      const want: [string, string][] = [
        ['cn26-stay-03', '¥887.52 (2n)'],
        ['cn26-stay-04', '¥419.00'],
        ['cn26-stay-05', '¥1,166.00 (2n)'],
        ['cn26-stay-06', '¥857.30 (2n)'],
        ['cn26-stay-08', '¥324.00'],
      ];
      return want.every(([id, note]) => bundle.bookings.find((b) => b.id === id)?.priceNote === note);
    })()],
  /* AND THE FLIP SIDE OF THE SAME RULE. The ibis order priced the night in US
     dollars, took US dollars and printed no yuan at all, so a ¥ quote on that
     bed would be the invention — the rule is "carry what will actually be
     charged", not "prefer yuan". */
  ['the ibis is quoted in the dollars its order actually charged',
    bundle.bookings.find((b) => b.id === 'cn26-stay-09')?.priceNote === '$25.73'],
  /* DALI'S CLIFF is the second on the trip that reaches a 100% loss, and its
     desk shuts at 23:00 — an hour before Yue Tu's — on the night the owner
     arrives off the gorge road by shared car, with NO late arrival declared.
     Both facts have to be on the card: the money and the reason the standing
     late-arrival rule is not satisfied here. */
  ['Dali prints its full-price cliff, its 23:00 desk and the arrival nobody declared',
    (() => {
      const chips = (bundle.bookings.find((b) => b.id === 'cn26-stay-08')?.meta ?? [])
        .map((m) => `${m.k}=${m.v}`).join(' | ');
      return /free cancel=to 23:59 Dec 15/i.test(chips) &&
        /00:00 Dec 16/.test(chips) && /¥324/.test(chips) &&
        /late arrival=NOT declared/i.test(chips) && /23:00/.test(chips) &&
        /payment=not stated/i.test(chips);
    })()],
  /* THE BED THE LEGAL EXIT FROM THE MAINLAND DEPENDS ON. Trip.com had the money
     and a number on 27 Jul while the property had not accepted and the order
     page offered "Expedite Booking"; the property accepted on 29 Jul. The seed
     said booked throughout — it was paid — and carried each state honestly in
     turn. What is checked now is the CONFIRMED state and, just as hard, that
     the word "Confirming" is gone from every field on this bed: a warning left
     standing after it stops being true teaches the reader to ignore warnings,
     and this is the last bed on the trip that can afford that. The `alert`
     flag must be gone with it. The free-cancellation cut-off and the shuttle
     that is the whole reason this bed exists are unchanged and still checked. */
  ['the ibis is booked, paid, CONFIRMED, and shows the shuttle and the Dec 17 window',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-09');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return b?.status === 'booked' && b.alert !== true &&
        /status=CONFIRMED/i.test(chips) && !/confirming/i.test(chips) &&
        !/confirming/i.test(b?.note ?? '') &&
        /free cancel=to 23:00 Dec 17/i.test(chips) &&
        /shuttle=free airport transfer/i.test(chips) &&
        /payment=PREPAID ONLINE/i.test(chips) &&
        /Smoking=SMOKING PERMITTED/i.test(chips);
    })()],
  /* And the three beds whose order showed NO terms say so, rather than
     reprinting research — or a dead order's terms — as though the live booking
     had stated them. */
  ['the three beds with no confirmed cancellation terms admit it',
    ['cn26-stay-00', 'cn26-stay-04', 'cn26-stay-05'].every((id) =>
      /not stated/i.test(
        bundle.bookings.find((b) => b.id === id)?.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '',
      ))],
  /* A booked bed carries what you read out at the desk, and it must be the
     number of the order that is actually live. Four Points was rebooked on
     2026-07-27: the new order carries no PIN, so the card carries no secondary
     line, and the dead number and its PIN 9858 appear NOWHERE in the seed. */
  ['the live Four Points order is counter-facing, and the superseded one is gone',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-00');
      return b?.code === '1653715561783471' && !!b.codeLabel && !b.codeSub &&
        b.priceNote === '$244.74 (2n)' && b.meta.length >= 5 &&
        !seedText.includes('1653715561596848') && !/9858/.test(seedText);
    })()],
  /* Blossom House's number and platform were the two blanks this app carried
     from 2026-07-27 morning to 2026-07-27 evening. Both are filled; the two
     that can still cost money are not, and the card says so. */
  ['Blossom House carries the number and platform it was missing',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-01');
      return b?.code === '1653715561827302' && b.codeLabel === 'Trip.com booking' &&
        b.manageUrl === 'https://www.trip.com/account/orderlist/' && !b.codeSub &&
        /not stated/i.test(b.meta.find((m) => /payment/i.test(m.k))?.v ?? '') &&
        /no deadline/i.test(b.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '');
    })()],
  /* YUE TU: the trip's designated late-arrival night, its first prepaid bed,
     and the bed whose refund cliff decides the gorge bag transfer. The approved
     22:00–23:00 window is the whole reason the standing "always declare a late
     arrival" rule is satisfied here, so it must be on the card and not only in
     prose. The postcode 674100 rides in the NOTE, never in the address: an
     address is transcribed from one source, never assembled from two — the same
     rule Pullman's entry follows. */
  ['Yue Tu carries its approved late arrival, its cliff, and a postcode that never reaches the map',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-06');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return b?.status === 'booked' && b.code === '5942328968' && /3635/.test(b.codeSub ?? '') &&
        !b.code.includes('3635') && !b.bookingLinkUrl &&
        b.manageUrl === 'https://secure.booking.com/mytrips.html' &&
        /22:00–23:00 APPROVED/.test(chips) && /free cancel=to 23:59 Dec 13/i.test(chips) &&
        /00:00 Dec 14/.test(chips) && /US\$63/.test(chips) &&
        b.address === 'No. 43 Yizheng Jinjia Street, Dayan Ancient Town' &&
        /674100/.test(b.note ?? '') && !/674100/.test(b.address);
    })()],
  /* The Royal Garden was booked DIRECT, so its reservation number is the whole
     credential — there is no order page to fall back on and no OTA account
     holding a copy. It must be in the big type, with the fact that it is a
     direct booking (not an OTA order) in the small line under it. */
  ['the Royal Garden reservation number is counter-facing, and says it is a direct booking',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-10');
      return b?.code === 'cohTex87hq19CnTh' && !!b.codeLabel && /direct/i.test(b.codeSub ?? '') &&
        b.meta.length >= 8 && b.status === 'booked';
    })()],
  /* THIS LIST IS NOW EMPTY, AND THAT IS THE ASSERTION. Element was the last
     booked bed nobody had given a number for, and it carried NONE — a plausible
     confirmation number is worse than an empty strip, because it would be read
     out at a desk. Blossom House left the list on 2026-07-27 when its Trip.com
     order surfaced; Element left it on 2026-07-29 when the Agoda confirmation
     arrived. So the check flips: no booked bed may be numberless.
     Element still carries its link, as it has since 2026-07-27 evening — to
     Agoda's own bookings list, never a guessed deep link. And its secondary
     line is a SECOND NUMBER rather than a PIN: Agoda sold a room allotted from
     booking.com, so the property may only recognise 5351254076. */
  ['no booked bed is numberless any more, and Element carries both of its numbers',
    (() => {
      const beds = bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'booked');
      const el = bundle.bookings.find((x) => x.id === 'cn26-stay-02');
      return beds.every((b) => !!b.code) &&
        el?.code === '683386279' && /5351254076/.test(el.codeSub ?? '') &&
        !el.bookingLinkUrl && el.manageUrl === 'https://www.agoda.com/account/bookings.html';
    })()],
  /* THE DEADLINES, as numbers rather than as the word "free". Element's window
     shuts at 00:00 on its own check-in day — earlier than any other bed's — and
     46% of the booking is lost on a no-show. Pullman's shuts at 23:59 the SAME
     day, so Dec 9 closes two windows at opposite ends of it. Yue Tu's shuts
     23:59 Dec 13 and costs a night after that. The Royal Garden's shuts 14:00
     Dec 19. None may degrade into a generic "free cancellation".
     Four Points is deliberately NOT in this list any more: the 16:00 Dec 5
     window belonged to the order that was replaced, and a bed with no stated
     deadline must say so rather than borrow a dead one. */
  ['each booked bed with a stated deadline carries it as a number, not a promise',
    (() => {
      const want: [string, RegExp][] = [
        ['cn26-stay-02', /00:00.*Dec 9/i],
        ['cn26-stay-03', /23:59.*Dec 9/i],
        ['cn26-stay-06', /23:59.*Dec 13/i],
        ['cn26-stay-08', /23:59.*Dec 15/i],
        ['cn26-stay-09', /23:00.*Dec 17/i],
        ['cn26-stay-10', /14:00.*Dec 19/i],
      ];
      return want.every(([id, re]) => {
        const b = bundle.bookings.find((x) => x.id === id);
        return re.test(b?.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '');
      });
    })()],
  /* PULLMAN'S CLIFF, the only three-tier policy on the trip and the only bed
     that reaches 100% loss. Free to 23:59 Dec 9, partial from 00:00 Dec 10,
     NOTHING back from 00:00 Dec 11 — its own check-in day, and the day of the
     monopoly flight. A card showing only the free window would read as safe on
     Dec 10, when a cancellation then already costs the first night. */
  ['Pullman prints all three tiers, including the non-refundable cliff',
    (() => {
      const chips = (bundle.bookings.find((b) => b.id === 'cn26-stay-03')?.meta ?? [])
        .map((m) => `${m.k}=${m.v}`).join(' | ');
      return /free cancel=to 23:59 Dec 9/i.test(chips) &&
        /partial.*00:00 Dec 10/i.test(chips) &&
        /no refund=from 00:00 Dec 11/i.test(chips);
    })()],
  /* The auto-charge date moved 7 Dec → 8 Dec when the booking was read. The
     old date put it on the Great Wall day, with no signal; the real one is the
     Beijing spa day. It lives in the bed's note, the task and the alarm, and
     all three must agree — and none of them may still say the 7th. */
  ['the Pullman card charge is 8 Dec everywhere, and 7 Dec nowhere',
    (() => {
      const note = bundle.bookings.find((b) => b.id === 'cn26-stay-03')?.note ?? '';
      const task = bundle.tasks.find((t) => t.id === 'cn26-task-pullman-charge');
      const alarm = bundle.alarms.find((a) => /pullman/i.test(a.title));
      const all = `${note} ${task?.title ?? ''} ${task?.detail ?? ''} ${alarm?.title ?? ''} ${alarm?.why ?? ''}`;
      return /charged automatically on 8 December/i.test(note) &&
        /Dec 8/.test(task?.title ?? '') && task?.due === '2026-12-07' &&
        alarm?.date === '2026-12-07' &&
        /8 Dec/.test(alarm?.title ?? '') &&
        /* the bed's own card may not mention the 7th at all; the task may, but
           only to say the date was wrong — never as the charge date */
        !/\bDec 7\b/.test(note) &&
        !/charge[sd]?\b[^.]{0,25}\bDec 7\b/i.test(all);
    })()],
  /* Dec 26 check-out moved 12:00 → 11:00 when the Royal Garden was booked
     direct. The hour lives in three places that must agree: the bed's own chip,
     the day plan, and the flying-home runbook. */
  ['the Dec 26 check-out is 11:00 everywhere it is stated',
    (() => {
      const chip = bundle.bookings.find((b) => b.id === 'cn26-stay-10')?.meta.find((m) => /check-out/i.test(m.k))?.v ?? '';
      const day = (bundle.dayPlans.find((d) => d.date === '2026-12-26')?.planItems ?? []).join(' ');
      const run = (bundle.runbooks.find((r) => r.id === 'cn26-run-home')?.steps ?? []).join(' ');
      return /11:00/.test(chip) && !/12:00/.test(chip) &&
        /11:00/.test(day) && /11:00/.test(run) &&
        !/check.?out.{0,40}12:00/i.test(day + ' ' + run);
    })()],
  ['map buttons open places by name, not by coordinate',
    bundle.stops.filter((s) => s.mapQuery).length >= 7 &&
    bundle.showCards.filter((c) => c.mapQuery).length >= 17],
  ["the gorge opens the owner's own share link",
    bundle.stops.find((s) => s.id === 'cn26-stop-gorge')?.mapUrl === 'https://maps.app.goo.gl/fHfSus2NQN8NmxKcA'],
  ['no place card that could not be verified pretends to have a name',
    ['cn26-place-00', 'cn26-place-06', 'cn26-place-21', 'cn26-place-22', 'cn26-place-23']
      .every((id) => { const c = bundle.showCards.find((x) => x.id === id); return !c?.mapQuery && !c?.coord; })],
  ['the flights PDF rides in the vault',
    bundle.documents.filter((d) => d.meta.mime === 'application/pdf').length === 1],
  ['one curated place photo per real stop rides in the vault',
    bundle.documents.filter((d) => d.meta.tag === 'photo').length === PLACE_PHOTOS.length &&
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => !!s.photoDocId)],
  ['every real stop carries a read-more text',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.detail ?? '').length > 200)],
  ['every real stop carries its options',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.options?.length ?? 0) >= 2 &&
      (s.options ?? []).flatMap((b) => b.items).length >= 8)],
  ['every real stop carries a coordinate, and no bed carries one',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => !!s.coord) &&
    bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => !b.coord)],
  ['the pending Kunyu address still has no coordinate invented for it',
    bundle.showCards.filter((c) => c.pending).every((c) => !c.coord)],
  ['the only flight fares in the seed are the three the guide documents',
    bundle.bookings.filter((b) => b.kind === 'flight' && b.priceNote).length === 3],
  ['the Etihad legs carry no invented fare — their one price rides on the flights stop',
    bundle.bookings.filter((b) => b.kind === 'flight' && /^EY/.test(b.flightNo)).every((b) => !b.priceNote) &&
    /booked ~\$2,026/.test(bundle.stops.find((s) => s.kind === 'transit')?.costNote ?? '')],
  ['every bed carries the price it was quoted at',
    bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => !!b.priceNote)],
  /* Every flight opens the airport it LEAVES from — resolved at build time
     from the driver card that already carries the verified name, so the app
     never cross-looks-up anything. */
  ['every flight opens the airport it departs from',
    bundle.bookings.filter((b) => b.kind === 'flight').every((b) => !!b.mapQuery || !!b.coord)],
  /* THE ONE BED WITH NO LOCATION AT ALL: no street address anywhere, and no
     name here has ever passed the OSM gate. Four Points LEFT this list on
     2026-07-27 and DALI left it the same evening — booking each produced the
     address its entry had never had. (Dali's document entry printed verified
     coordinates the whole time and they were never shipped: a bed opens by
     something the owner can read and check, never by a dot.)
     HUATIAN LEFT ON 2026-07-28, and by a road no bed had taken before: not an
     address, but a NAME that two independent sources agree on — OpenStreetMap
     knows the property as 华天大酒店, 张家界, and the accommodation document's
     own "450 m from the Tianmen cableway" lands on the same spot from a
     coordinate this repo verified long ago for place card 11.
     BLOSSOM HOUSE IS ALL THAT REMAINS, and its 2026-07-28 re-attempt made the
     case weaker, not stronger: only its hutong resolves, and a hutong is not a
     door. It is a BOOKED bed — booked is not the same as locatable. */
  ['the bed with nothing verified to open ships no button at all',
    ['cn26-stay-01'].every((id) => {
      const b = bundle.bookings.find((x) => x.id === id);
      return !!b && !b.mapQuery && !b.coord && !b.mapUrl && !b.address;
    })],
  /* Eight open by a street address the owner's own paperwork prints, and TWO by
     a name: the gorge guesthouse, which never changed, and Huatian. */
  ['ten of the eleven beds carry a location',
    bundle.bookings.filter((b) => b.kind === 'hotel' && (b.mapQuery || b.address || b.mapUrl)).length === 10],
  ['eight of them are addresses off the owner’s own paperwork, and none is a coordinate',
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.address && !b.mapQuery).length === 8 &&
    bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => !b.coord)],
  /* DALI'S ADDRESS came off its confirmation and is transcribed VERBATIM — the
     Four Points case, where the document had nothing to preserve. The postcode
     rides inside the line rather than being appended to one, which is the
     difference between copying a source and assembling two: cutting it out
     would also cut out "Dali", the city, and this repo has measured what
     dropping a city does to a map answer. And the coordinate the document
     prints for this bed is STILL not in the seed. */
  ['the Dali button opens the address its confirmation printed, and never the coordinate',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-08');
      return b?.address === 'No.133, Yinxian Road, Shuidui Village, 671003 Dali, China' &&
        !b.mapQuery && !b.coord && !b.mapUrl && !seedText.includes('25.6957') && !seedText.includes('100.1537');
    })()],
  /* THE IBIS ADDRESS DID NOT MOVE, and the reason is neither Pullman's typo nor
     Yue Tu's agreement: the Trip.com order prints a line that is not a superset
     of the shipped one (it adds the district, drops the unit) and is 82 chars,
     so adopting it would mean a trim that deletes "Kunming". One source ships
     whole; the confirmation's fuller printing lives on the note. */
  ['the ibis keeps the address that names its unit, with the order’s version on the note',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-09');
      return b?.address === 'Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng' &&
        !b.mapQuery && !b.coord && !b.mapUrl && /Guandu District/.test(b.note ?? '');
    })()],
  ['the Four Points button opens the address its confirmation printed',
    bundle.bookings.find((b) => b.id === 'cn26-stay-00')?.address ===
      'No. 20 Gongti East Road, Chaoyang District, Beijing, China'],
  /* Hong Kong is off the GCJ-02 datum and goes straight to Google Maps
     (ARCHITECTURE §9a rule 4), so the address the hotel's own confirmation
     prints — district and territory included — is what the button searches. */
  ['the Royal Garden button opens the address its direct booking printed',
    bundle.bookings.find((b) => b.id === 'cn26-stay-10')?.address ===
      '69 Mody Road, Tsimshatsui East, Kowloon, Hong Kong'],
  /* Element's Agoda page reprinted the address this repo already shipped, so
     the button did not change — but it must still be the address and never the
     brand name, which resolves to the wrong Element. */
  ['the Chongli bed still opens by street, never by the chain name',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-02');
      return b?.address === 'Block I, Thaiwoo Ski Resort & Alpine Park, Sitaizui County' &&
        !b.mapQuery && !b.coord && !b.mapUrl;
    })()],
  /* PULLMAN'S ADDRESS SURVIVED ITS OWN CONFIRMATION. Agoda prints the street as
     "GADYUN ROAD" — its misspelling of Gaoyun — and a map search for a street
     that does not exist is worse than no button at all. So the accommodation
     document's spelling is what ships. The typo is NOT scrubbed from the app,
     though: the owner will read it on their own confirmation, so the bed's note
     names it and says which spelling to trust. The rule is that it is never
     SEARCHABLE — never an address, a map name or a saved link. The postcode
     that arrived with the booking rides in the note for the same reason: an
     address here is transcribed from one source, never assembled from two. */
  ['the Pullman button opens Gaoyun Road, and the confirmation typo is never searchable',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-03');
      const searchable = [...bundle.stops, ...bundle.showCards, ...bundle.bookings,
        ...bundle.stops.flatMap((s) => s.spots ?? [])]
        .flatMap((e) => [e.address ?? '', e.mapQuery ?? '', e.mapUrl ?? '']);
      return b?.address === 'No. 188 Gaoyun Road, Wulingyuan' &&
        !b.mapQuery && !b.coord && !b.mapUrl &&
        /GADYUN/i.test(b.note ?? '') &&
        !searchable.some((s) => /GADYUN/i.test(s)) &&
        /427400/.test(b.note ?? '');
    })()],
  ['every real stop carries at least one verified spot',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.spots?.length ?? 0) >= 1)],
  ['every spot in the seed can actually be opened',
    bundle.stops.flatMap((s) => s.spots ?? []).every((sp) => !!sp.mapQuery || !!sp.coord || !!sp.mapUrl)],
  ['a hundred-odd spots ride on the ten city pages',
    bundle.stops.flatMap((s) => s.spots ?? []).length >= 100],
  ['the shelf cover photo resolves',
    !!bundle.trip.coverDocId && bundle.documents.some((d) => d.meta.id === bundle.trip.coverDocId)],
  /* ADDRESSES. Every one on a stop, a driver card or a spot came back from
     OpenStreetMap's own addressdetails beside a name that had already passed
     the distance and name-agreement gates, and was then re-asked as the app
     will really ask it. None was composed by hand, and a place neither source
     could address has none. A BED's address has a different provenance and is
     the one that may stand alone: it is transcribed from the owner's own
     accommodation document, which names no hotel a map resolves. */
  ['the places that have a street address carry it, and none of them made one up',
    (() => {
      const carriers = [...bundle.stops, ...bundle.showCards, ...bundle.bookings,
        ...bundle.stops.flatMap((s) => s.spots ?? [])];
      const withAddress = carriers.filter((e) => !!e.address);
      return (
        withAddress.length >= ADDRESS_COUNT_FLOOR &&
        withAddress.every((e) => !!e.address?.trim() && e.address.length <= ADDRESS_MAX) &&
        /* an address never stands alone in the seed — it rode in with a name,
           unless it IS the location, which only a bed's ever is */
        withAddress.every((e) => !!e.mapQuery || !!e.mapUrl || !!e.coord || ('kind' in e && e.kind === 'hotel'))
      );
    })()],
  /* The entries that could only ever ship a coordinate. Wikidata is allowed to
     RESCUE one into a name search; nothing is allowed to fall INTO this set. */
  ['only the documented entries still open by coordinate alone',
    (() => {
      const documented = new Set(['cn26-stop-kunyu', 'cn26-stop-chongli', 'cn26-place-09', 'cn26-place-17', 'cn26-place-24']);
      const coordOnly = [...bundle.stops, ...bundle.showCards, ...bundle.bookings]
        .filter((e) => e.coord && !e.mapQuery && !e.mapUrl)
        .map((e) => e.id);
      return coordOnly.every((id) => documented.has(id));
    })()],
  /* An airport card and the flight that leaves from it must be the same
     airport — the flight borrows the card's verified name and coordinate, so a
     mis-keyed IATA would send you to the wrong terminal in another province. */
  ['every airport driver card carries the IATA code of the flight that leaves from it',
    bundle.bookings.filter((b) => b.kind === 'flight').every((b) => {
      if (b.kind !== 'flight') return false;
      const cardId = AIRPORT_CARDS[b.from.code];
      if (!cardId) return !!b.mapQuery; // TLV, AUH and HKG have no driver card
      const card = bundle.showCards.find((c) => c.id === cardId);
      return (
        !!card &&
        card.meaning.includes(`(${b.from.code})`) &&
        b.mapQuery === card.mapQuery &&
        JSON.stringify(b.coord ?? null) === JSON.stringify(card.coord ?? null)
      );
    })],
];

console.log('');
for (const [what, ok] of structural) {
  if (ok) console.log(`✓ ${what}`);
  else {
    console.error(`✗ ${what}`);
    missingFromSeed++;
  }
}

if (pdfOnly.length) {
  console.log('');
  console.log('Traced to the flight PDF rather than to searchable text:');
  for (const n of pdfOnly) console.log(n);
}
if (notes.length) {
  console.log('');
  for (const n of notes) console.warn(n);
}

console.log('');
console.log(`Checked ${CRITICAL.length} critical values + ${structural.length} structural facts.`);
if (missingFromSeed > 0) {
  console.error(`${missingFromSeed} FAILURE(S) — the seed does not match the sources.`);
  process.exit(1);
}
console.log(`✓ parity holds${missingFromSources ? ` (${missingFromSources} value(s) need a manual look — see above)` : ''}`);

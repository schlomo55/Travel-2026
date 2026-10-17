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
import { loadPrivateIds } from './privacy/private-ids';

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
  /* 17 Oct 2026: the authority note for Dec 9–11 once skiing was dropped —
     the decision, and every researched Shanghai fact with its source URL and
     "seen 17 Oct 2026" (the train, the beds, Disneyland, MU394, the CA8609
     refund rules). It is also the stop's "All the options" text. */
  'options/shanghai.md',
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
  { what: 'Etihad Guest number', value: '600023186044', pdfOnly: true },
  // international flights
  { what: 'Etihad PNR', value: '8CR7MR' },
  { what: 'EY608 departure', value: '14:00' },
  { what: 'EY888 arrival at Daxing', value: '08:45' },
  { what: 'EY871 departure from HKG', value: '19:35' },
  { what: 'EY609 arrival at TLV', value: '04:35' },
  // domestic flights
  /* CA8683, bought 2026-08-12 — the trip's eighth flight and the only
     Beijing-Yantai departure from PKX, the airport EY888 lands at.
     RETIMED 2026-09-29 to CA8641, PKX 15:00 → YNT 16:20 (was 12:35 → 13:45) —
     accepted free on Trip.com the same day. Same order, so the booking id is
     unchanged; the PNR and ticket number are carried forward UNVERIFIED (no
     "Change Completed" notice exists for this change, unlike CA1953→CA8609),
     so they are checked `pdfOnly` rather than asserted as confirmed. */
  { what: 'CA8641 (formerly CA8683) Trip.com booking', value: '1653716690406769' },
  { what: 'CA8641 airline PNR, carried forward unverified', value: 'QEH9EM', pdfOnly: true },
  { what: 'CA8641 ticket number, carried forward unverified', value: '999-5036940536', pdfOnly: true },
  { what: 'CA8641 fare as paid (unaffected by the retime)', value: '117.30' },
  { what: 'CA8641 departure from PKX, as retimed 29 Sep', value: '15:00' },
  { what: 'CA8641 arrival at YNT, as retimed 29 Sep', value: '16:20' },
  /* CA1560, bought 2026-09-28 — Dec 5 out of Yantai, the morning the academy
     said "better before 4 p.m." Air China had retimed it to 14:55 → 16:15
     before it was bought; the plan's 15:40 → 17:15 is pinned nowhere. */
  { what: 'CA1560 Trip.com booking', value: '1653717880605553' },
  { what: 'CA1560 airline PNR', value: 'NE1K88' },
  { what: 'CA1560 e-ticket', value: '999-2580773936' },
  { what: 'CA1560 fare as paid', value: '110.30', loose: true },
  { what: 'CA1560 departure from YNT, as retimed', value: '14:55' },
  { what: 'CA1560 arrival at Capital T3', value: '16:15' },
  /* DEC 11 WAS REBOOKED ON 2026-09-27. Air China retimed CA1953 (PEK 17:00)
     to 07:45 and the same Trip.com order was changed free onto CA8609,
     Beijing DAXING 18:15 → DYG T2 20:30 — recorded in the accommodation
     document, §5. The old 17:00 is deliberately no longer pinned: a check that
     demanded it would enforce the flight that no longer exists. The PNR stays
     pinned because Trip.com's own "Change Request Has Been Completed" notice
     (27 Sep 2026, 12:45 UTC, application 2499148444) confirms PLF8S9 and the
     e-ticket 999-5274485740 are UNCHANGED by the move — resolved, not a value
     carried forward as a guess. */
  { what: 'Dec 11 Trip.com booking (same order, CA1953 → CA8609)', value: '1653716183770225' },
  { what: 'Dec 11 airline PNR, confirmed unchanged by the change', value: 'PLF8S9', pdfOnly: true },
  { what: 'CA8609 departure from Daxing', value: '18:15' },
  { what: 'CA8609 arrival at DYG', value: '20:30' },
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
  /* THE TWELFTH BED, booked 2026-09-28 — §1a, the Nov 22 night, in Muping
     because the school asked for it. Paid at the desk, in cash, in yuan. */
  { what: 'Muping night Trip.com booking', value: '1653717166174001' },
  { what: 'Muping night charge in CNY, cash at the desk', value: '164.00', loose: true },
  { what: 'Muping night Chinese name, as booked', value: '锦江之星品尚酒店(烟台牟平汽车站西关夜市店)' },
  { what: 'Muping night street address', value: 'No. 460 Moushan Road' },
  { what: 'Muping night property phone', value: '+86-535-3399333' },
  { what: 'Four Points Trip.com booking (live order)', value: '1653715561783471' },
  { what: 'Four Points price as rebooked', value: '244.74' },
  { what: 'Four Points confirmed address', value: 'No. 20 Gongti East Road' },
  { what: 'Blossom House Trip.com booking', value: '1653715561827302' },
  { what: 'Blossom House price as booked', value: '299.56' },
  /* From the Trip.com confirmation EMAIL of 27 Jul, read in the 2026-09-27
     Gmail audit: the property's own number, the free window that turned out to
     have been stated all along, and the two halves of a payment this repo had
     recorded as "not stated — ask" for two months. */
  { what: 'Blossom House hotel confirmation number', value: 'R9000388217900556001' },
  { what: 'Blossom House free-cancellation cut-off', value: '23:00 Dec 4', alt: ['23:00 on 4 Dec', '23:00 ON 4 DEC'] },
  { what: 'Blossom House paid by Google Pay', value: '246.60' },
  { what: 'Blossom House paid by gift card', value: '52.96' },
  { what: 'Blossom House property phone', value: '+86-10-53859000' },
  { what: 'Blossom House address (Chinese, as printed)', value: '北京西城区德内大街羊房胡同9号' },
  /* Element Chongli's six values (Agoda ID, allotment number, phone, $232.95,
     ¥1,575.99, the 54% cliff) left this list on 2026-10-17: the owner
     CANCELLED it on Agoda, so the seed must no longer carry them — the
     absence is checked structurally below. In their place, the Shanghai bed
     booked the same day, off its Trip.com order. */
  { what: 'Hi Cozy hostel Trip.com booking number', value: '1653717714742604' },
  { what: 'Hi Cozy prepaid, in shekels', value: '136.40' },
  { what: 'Hi Cozy Chinese name (driver card)', value: '嗨小屋hicozy设计师青旅(外滩南京东路店)' },
  { what: 'Hi Cozy address', value: 'No. 350 Shanxi South Road' },
  { what: 'Hi Cozy phone', value: '+86-13482279245' },
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
  /* The inn's 28 Jul reply, found 2026-09-27: its WeChat, and the tour price
     that may replace the Dec 10 cableway release if the ticket is guaranteed. */
  { what: 'Yue Tu WeChat, from its 28 Jul reply', value: 'yanglei400371' },
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
  /* 2026-09-27: the card finally says what the hotel wrote on 31 Jul — the
     prepayment made the booking non-refundable. The words are the hotel's own. */
  { what: 'Royal Garden non-refundable, in the hotel’s own words', value: 'non-refundable basis' },
  /* The review's outside facts that change a day, each recorded with its
     source in the authority file's closing section. */
  { what: 'Tianmen upper cableway suspended since', value: '6 Nov 2025' },
  { what: 'Tianmen east glass skywalk closed since', value: '12 May 2026' },
  { what: 'Jade Dragon entrance mini-program', value: '玉龙雪山服务' },
  { what: 'Jade Dragon cableway mini-program', value: '丽江旅游集团' },
  { what: 'the Dec 20 plan arrives at Kunming Station', value: '昆明站' },
  { what: 'the lower-altitude Jade Dragon alternative', value: '云杉坪' },
  /* THE ACADEMY, written down as a stay on 2026-08-12 and PRICED on 2026-08-13.
     For that month there was no price to check: the document's own words were
     "price and room NOT confirmed in writing", and an unconfirmed figure has no
     business in a total, so only the property, the two dates and the length
     were pinned. The school then wrote the money down and the pins below follow
     it — the stay price, the day it was stated, the uniform, the room-keeping
     fee, the pickup and the address. Each one is checked in BOTH directions, so
     a figure that reaches the app without reaching the authority file (or the
     reverse) fails here rather than in Shandong. The remaining absences — no
     number, no platform — are asserted structurally below, where a missing
     value can be checked and a search for one cannot. */
  { what: 'the academy, by the name its own document uses', value: 'Kunyu Mountain Shaolin Kung Fu Academy', loose: true },
  { what: 'academy arrival, the Monday the academy insisted on', value: '2026-11-23' },
  { what: 'academy departure', value: '2026-12-05' },
  { what: 'the academy fortnight, in nights', value: '12 nights' },
  { what: 'the cash the academy asks for on arrival', value: 'US$1,000', loose: true },
  /* THE FIRST PRICE THIS BED HAS EVER HAD. "You can pay 840 USD to stay for
     12 days or two weeks" — and Nov 23 → Dec 5 is twelve nights, so the
     school's own sentence covers this booking on either reading. */
  { what: 'the academy stay price, in writing at last', value: '$840' },
  { what: 'the day the academy stated its price', value: '13 Aug 2026' },
  /* The two figures that are NOT the price and must never become one: a
     purchase and a refundable float. The uniform replaces a ~$55 estimate that
     was never the school's own; the room-keeping fee was predicted from the
     11 Aug message and is now stated. */
  { what: 'the winter uniform, no longer an estimate', value: '$50 winter uniform' },
  { what: 'the room-keeping fee, in the school’s own words', value: 'refundable on leaving' },
  /* THE PICKUP. It was owner-relayed for a few hours and then confirmed in the
     thread in both directions — the owner said the whole arrangement back and
     the school answered "Yes,great." The hour is the whole fact: a pickup with
     no time is an intention. */
  { what: 'the academy pickup, confirmed 13 Aug', value: '11:00 on Monday 23 Nov' },
  { what: 'the district the pickup was agreed for', value: 'Muping' },
  /* 2026-09-28: THE SCHOOL MOVED THE HOUR AND ANSWERED THE MONEY. The 11:00
     above stays pinned as the record of 13 Aug; 10:30 is the time now. And the
     $100 already paid is a one-time application fee — NOT part of the $840 —
     which is what ended the two-readings forecast. */
  { what: 'the academy pickup, moved 28 Sep', value: 'earliest pickup 10:30', alt: ['earliest pickup is 10:30'] },
  { what: 'the $100 the school calls an application fee', value: 'one-time application fee', loose: true },
  /* THE ADDRESS, off the school's own website footer. The postcode is the part
     that could not be inferred and is therefore the part worth pinning; the
     card that carries it still opens no map, which is asserted structurally. */
  { what: 'the academy postal code, from its own website footer', value: '264100' },
  /* AND THE NAME THE SCHOOL ITSELF NAVIGATES BY, off its own driver card — the
     short form, which is NOT the long one on the footer. Pinned separately
     because a "tidy-up" that collapsed the two would send a taxi to a string
     the school does not use. */
  { what: 'the navigation target on the school’s own driver card', value: '昆嵛山武校' },
  /* The ride, priced in time by the school rather than by this repo's planning
     guess: "One and half hour around" replaced every ~1h on the route. */
  { what: 'the ride the school’s driver card quotes', value: '1.5h', loose: true },
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
  /* ~$50–70 until 2026-09-27: two figures for one lesson had drifted apart —
     "~$50–70" on the card and "~¥998 all-in" in the day plans. The review kept
     the more specific one, still marked verify, and the authority file now
     records it. */
  /* The Thaiwoo lesson price (~¥998) left on 2026-10-17 with skiing — the
     lesson was never booked and is no longer on the trip. In its place, the
     Shanghai facts the new Dec 9–11 hangs on, every one of them NOT booked
     and checked against options/shanghai.md and the accommodation closing
     note of 17 Oct. */
  { what: 'Dec 11 flight, planned and booked 17 Oct 2026', value: 'MU394' },
  /* Booked later the same day (Trip.com "Flight Booking Confirmed", 10:36 UTC). */
  { what: 'MU394 Trip.com booking number', value: '1653718389085873' },
  { what: 'MU394 airline PNR', value: 'NXBE5C' },
  { what: 'MU394 e-ticket', value: '781-2325053008' },
  { what: 'MU394 paid', value: '$200.20', alt: ['USD 200.20'] },
  { what: 'CA8609 refund issued', value: '$220.20' },
  { what: 'MU394 codeshare', value: 'FM9343' },
  { what: 'MU394 departure from Pudong', value: '19:10' },
  { what: 'MU394 arrival at DYG', value: '21:40' },
  /* The owner's price comparison of 17 Oct 2026 (04:49–05:15 IDT) replaced
     the first estimates of the same morning ($149/night, ¥475, ¥626–695). */
  { what: 'MU394 sold as FM9343 on ceair.com', value: '$189.90' },
  { what: 'Shanghai Disneyland on Trip.com, non-refundable', value: '¥439' },
  { what: 'Shanghai Disneyland direct, expected ~Nov 11', value: '¥449–499' },
  /* The 17 Oct follow-up (owner decisions of 15–17 Oct 2026): the Disney
     ticket chosen on Trip.com (not bought), its cheaper alternative, and the
     cash pickup at Ben Gurion T3 that replaced the Oct 12 purchase. */
  { what: 'Disney ticket + Premier Access ×14, the chosen option (Trip.com)', value: 'ILS 1,183' },
  { what: 'Disney Premier Access of 11 + Premier Admission, the alternative', value: 'ILS 896' },
  { what: 'the US$1,700 picked up at Ben Gurion T3', value: 'Nov 21, 12:00' },
  /* G7 (13:35, ¥692) left on 2026-10-17: the train reserved that day is G11. */
  { what: 'G11 Beijing South departure', value: '10:05' },
  { what: 'G11 Shanghai Hongqiao arrival', value: '14:40' },
  { what: 'G11 Trip.com reservation number', value: '1653718542268674' },
  { what: 'G11 reservation total', value: 'ILS 330.22' },
  { what: 'Hi Cozy: free cancellation before', value: '18:00 on Dec 9' , alt: ['before 18:00 Dec 9'] },
  /* '~18:15 Dec 4' (this repo's guess at the 7-day tier) left on 2026-10-17:
     Trip.com's cancel page said 13:15, and CA8609 was cancelled the same day
     at the US$20.80 fee. */
  { what: 'CA8609 cancellation fee kept', value: 'US$20.80' },
  { what: 'Air China service line for the refund question', value: '95583' },
  { what: 'Forbidden City winter ticket', value: '¥40 (~$6)' },
  // money
  /* The two quotes are history now — the card carries the POLICY, not the
     shortlist, so the seed no longer contains either figure. What must survive
     is what was actually bought, and it is checked against the same document
     that held the comparison. */
  { what: 'Phoenix policy number', value: '260676675684357' },
  { what: 'insurance price paid', value: '148.40' },
  /* Off the English certificate the owner holds (28 Sep 2026) — the assistance
     line only; the certificate's ID numbers never enter this repo. */
  { what: 'Phoenix 24/7 assistance line', value: '+972-3-7331177', loose: true },
  { what: 'budget total', value: '9000', loose: true },
  /* the booked-flights line of the guide: ~$2,026 + $241 + $230 + $293 = ~$2,790 */
  { what: 'international flights as booked', value: '~$2,026' },
  { what: 'Dec 11 fare as paid — unchanged by the $0 rebooking', value: '$241' },
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

/* ABSENCE, not agreement: the two passport numbers. The French one was a
   critical value here until 28 Sep 2026, when the owner decided it is stored
   nowhere — the app, the seed, the sources. Both are read from private files
   outside the repo (privacy/private-ids.ts); a missing file is SKIPPED, loudly,
   never passed. The raw seed file is searched too, PDF base64 included. */
const rawSeed = readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8');
console.log('');
for (const id of loadPrivateIds()) {
  if (!id.value) {
    console.warn(`⚠ ${id.label} absence check SKIPPED — no private file at ${id.file}`);
    continue;
  }
  const inSeedFile = rawSeed.includes(id.value);
  const inSourceDocs = sourceText.includes(id.value) || pdfText.includes(id.value);
  if (inSeedFile) console.error(`✗ the ${id.label} is in the seed`);
  if (inSourceDocs) console.error(`✗ the ${id.label} is in the source documents`);
  if (inSeedFile || inSourceDocs) missingFromSeed++;
  else console.log(`✓ ${id.label} absent from the seed and the sources`);
}

/* Structural facts the trip depends on. */
const structural: [string, boolean][] = [
  ['the passport wallet card is there and stores no number', (() => {
    const card = bundle.walletCards.find((c) => c.id === 'cn26-card-passport');
    return !!card && !card.code && card.rows.some((r) => /not stored/i.test(r.v));
  })()],
  ['visa counter starts the day AFTER entry', bundle.counters[0]?.countStartsDayAfter === true],
  ['visa limit is 30 days', bundle.counters[0]?.limitDays === 30],
  ['trip spans 37 days', bundle.trip.start === '2026-11-21' && bundle.trip.end === '2026-12-27'],
  /* EIGHT since 2026-08-12: Air China CA8683, Beijing PKX to Yantai. The
     academy takes arrivals Mon/Tue/Wed only, so Sunday 22 Nov became a night in
     Yantai city and needed a flight to get there. */
  /* NINE since 2026-09-28: Air China CA1560, Yantai → Beijing Capital, Dec 5. */
  /* TEN since 2026-10-17: MU394, Shanghai Pudong → Zhangjiajie — PENDING, the
     Dec 11 leg of the Shanghai plan. CA8609 stays booked beside it as the OR. */
  /* Later the same day MU394 was BOOKED and CA8609 CANCELLED (refunded
     $220.20) — so the one flight not booked is the cancelled one. */
  ['ten flights are present; every one is booked except CA8609, cancelled',
    bundle.bookings.filter((b) => b.kind === 'flight').length === 10 &&
    bundle.bookings.filter((b) => b.kind === 'flight' && b.status !== 'booked').map((b) => `${b.id}:${b.status}`).join(',') === 'cn26-flight-ca1953:cancelled'],
  /* THE FIVE TRAIN JOURNEYS, as cards since 2026-07-28 (scripts/china/rail.ts).
     They were always in the trip — Beijing↔Taizicheng, Zhangjiajie West →
     Chongqing, Dali → Kunming and the Nov 22 fallback — but only ever inside
     the prose of a day line, so the one screen you look at on a concourse had
     nothing on it. Nothing was added to the trip; five journeys already written
     down became five cards. */
  /* FOUR since 2026-10-17: skiing dropped — Dec 9 became Beijing South →
     Shanghai Hongqiao (same card, rewritten) and Dec 11's Taizicheng → Qinghe
     leg went. */
  ['four rail legs are present, and the Chongli trains are gone',
    bundle.bookings.filter((b) => b.kind === 'train').length === 4 &&
    !bundle.bookings.some((b) => b.id === 'cn26-train-dec11') &&
    !JSON.stringify(bundle.bookings.filter((b) => b.kind === 'train')).match(/Taizicheng|Qinghe/)],
  /* AND NOT ONE OF THEM IS BOOKED, which is the fact the cards exist to keep in
     front of you: the trip's own key dates still say to buy each as its 15-day
     window opens. No confirmation number, and no `priceNote` either — the
     documented fares are estimates for tickets nobody has bought, and
     `priceNote` is what "Booked & committed" adds up. They ride as chips. */
  /* ONE NAMED EXCEPTION since 2026-10-17: the Dec 9 train is RESERVED on
     Trip.com (G11, issued when sales open on Nov 25). Still `pending`, still
     unpriced — but it carries its reservation number, labelled as one. */
  ['no train is booked, and no unbought fare is counted as a cost; only the reserved Dec 9 train carries a number',
    bundle.bookings.filter((b) => b.kind === 'train').every((b) => b.status === 'pending' && !b.priceNote &&
      (!b.code || (b.id === 'cn26-train-dec09' && b.code === '1653718542268674' && /reservation/i.test(b.codeLabel ?? ''))))],
  /* THE HARD PART OF PHASE 3, as a structural fact. Ten rail ends; three are
     not named in any document the trip carries — the Dec 14 arrival
     ("Chongqing", which has two main stations far apart), the Dec 20 departure
     ("Dali", whose "the station is in Xiaguan" line does not say WHICH station)
     and the Nov 22 arrival ("Yantai", a city). Those three ship no button and
     print the reason on the card instead. The other seven carry NINE buttons
     between them, because the Dec 9 departure is "Beijing North / Qinghe" — two
     stations the plan names without choosing, so the card opens both rather
     than making the choice for it.
     4 → 3 and 8 → 9 on 2026-09-27: the Dec 11 arrival ("back to Beijing") was
     the fourth silent end until the flight moved to Daxing and the rewritten
     day named Qinghe. */
  ['every rail end either opens or says on the card why it does not',
    (() => {
      const ends = bundle.bookings
        .filter((b): b is Extract<typeof b, { kind: 'train' }> => b.kind === 'train')
        .flatMap((b) => [b.from, b.to]);
      const withButtons = ends.filter((e) => (e.stations ?? []).length > 0);
      const silent = ends.filter((e) => (e.stations ?? []).length === 0);
      /* 10 ends / 3 silent / 9 buttons until 2026-10-17. Now 8 ends: the Dec 9
         departure is Beijing South alone (one button), and Shanghai Hongqiao
         is the fourth silent end — it has never been through the gate. */
      return ends.length === 8 &&
        silent.length === 4 && silent.every((e) => !!e.why?.trim()) &&
        withButtons.reduce((n, e) => n + (e.stations ?? []).length, 0) === 5 &&
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
  /* The eleventh was the Thaiwoo lesson until 2026-10-17; it is Shanghai
     Disneyland now (pending), and it opens nothing for the same reason: no
     Shanghai place has been verified. */
  ['ten of the eleven experiences open a verified place, and Disneyland opens nothing',
    (() => {
      const list = bundle.bookings.filter((b) => b.kind === 'activity');
      const withButton = list.filter((b) => b.mapQuery || b.coord || b.mapUrl);
      const disney = list.find((b) => b.id === 'cn26-ticket-disney');
      return list.length === 11 && withButton.length === 10 &&
        withButton.every((b) => !!b.mapQuery) &&
        disney?.status === 'pending' && !disney.priceNote &&
        !disney.mapQuery && !disney.coord && !disney.mapUrl && !disney.address &&
        !list.some((b) => b.id === 'cn26-ticket-ski-lesson');
    })()],
  /* TWELVE SINCE 2026-08-12: the Kunyu academy fortnight became the stay
     booking it had always been in fact. Nothing was taken — the deposit was
     acknowledged on 11 Aug — and nothing was paid; twelve nights that had a day
     plan and no booking stopped reading as unbooked. */
  /* THIRTEEN since 2026-09-28: the Nov 22 night in Muping, booked. */
  /* FOURTEEN since 2026-10-17: the Shanghai bed (cn26-stay-13) — the Meliá,
     pending, that morning; the Hi Cozy hostel, booked, by the evening. */
  ['fourteen beds are present', bundle.bookings.filter((b) => b.kind === 'hotel').length === 14],
  ['one bed is a walk-in (the gorge)', bundle.bookings.filter((b) => b.status === 'walkin').length === 1],
  ['ten stops plus the flights entry', bundle.stops.length === 11],
  /* THE KUNYU DRIVER CARD, and it inverted on 2026-08-13. For three weeks this
     check demanded that the card be PENDING — a "⏳ pending — ask the academy"
     placeholder — because inventing an address for a school that had never
     given one was the failure mode worth guarding. The school then sent a taxi
     card of its own, so the check demands the opposite of the same card, and
     demands it VERBATIM.
     WHAT IS PINNED IS NOT AN ADDRESS. It is the school's own instruction to a
     driver: navigate to 昆嵛山武校 — their SHORT name, not the long 昆嵛山少林武术学校
     on their website footer — and then use the meter, take the normal route and
     give a receipt, because a previous driver went a long way round. Those
     clauses are the protective half of the card, so 打表 (use the meter) and
     发票 (receipt) are asserted individually: a "tidied" card that kept only the
     destination would still read fine and would have thrown the point away.
     AND IT STILL OPENS NOTHING. Neither name has been through verify:places,
     and a natural conservation district is an area rather than a door.
     Printing a driver's card and searching one are different promises, and this
     is the check that keeps them apart. */
  ['the Kunyu driver card is the school’s own text, verbatim, and still opens nothing',
    (() => {
      const c = bundle.showCards.find((x) => x.id === 'cn26-place-00');
      return !!c && c.kind === 'place' && !c.pending &&
        /师傅您好/.test(c.native) && /昆嵛山武校/.test(c.native) &&
        /打表/.test(c.native) && /发票/.test(c.native) &&
        /Kunyu Mountain Martial Arts School/i.test(c.meaning) &&
        /One and half hour around/i.test(c.meaning) &&
        !c.mapQuery && !c.coord && !c.mapUrl && !c.address;
    })()],
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
        days.reduce((n, d) => n + (d.placeIds?.length ?? 0), 0) === 83; // 87 → 89 on 2026-09-27: Dec 11 names its stations · 89 → 83 on 2026-10-17: Dec 9 and Dec 11 lost the Chongli stations, and nothing in Shanghai is verified
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
  /* INVERTED 2026-09-27, not deleted. For two months this asserted that CA1953
     carried a "PEK, not Daxing" warning. Air China retimed CA1953 and the
     booking moved free onto CA8609 from DAXING, so the same guard held the
     opposite way round.
     REWRITTEN 2026-10-17. Skiing was dropped and Dec 11 leaves SHANGHAI PUDONG
     on MU394 — not booked yet, no code, no fare counted. CA8609 is still
     booked (it is, and $241 is paid) and still warns "NOT Capital" for the day
     it would be flown, but it is the `alternative` now, to refund only once
     MU394 is held. And still nothing in the seed may say "not Daxing".
     LATER ON 2026-10-17: MU394 BOOKED (Trip.com 1653718389085873, PNR NXBE5C,
     $200.20) and CA8609 CANCELLED — refund of $220.20 issued, the US$20.80
     fee kept. CA8609 keeps its order number and its NOT-Capital history. */
  ['Dec 11 is MU394 from Pudong (booked); CA8609 is cancelled and refunded, and nothing says "not Daxing"',
    (() => {
      const mu = bundle.bookings.find((b) => b.id === 'cn26-flight-mu394');
      const ca = bundle.bookings.find((b) => b.id === 'cn26-flight-ca1953');
      return mu?.kind === 'flight' && mu.status === 'booked' && mu.date === '2026-12-11' &&
        mu.from.code === 'PVG' && mu.to.code === 'DYG' && mu.dep === '19:10' && mu.arr === '21:40' &&
        mu.code === '1653718389085873' && /NXBE5C/.test(mu.codeSub ?? '') && mu.priceNote === '$200.20' && !mu.alternative &&
        ca?.kind === 'flight' && ca.status === 'cancelled' && !ca.alternative && ca.code === '1653716183770225' &&
        ca.flightNo === 'CA 8609' && ca.from.code === 'PKX' && ca.dep === '18:15' && ca.arr === '20:30' &&
        /CANCELLED AND REFUNDED/.test(ca.note ?? '') && /\$220\.20/.test(ca.note ?? '') && /US\$20\.80/.test(ca.note ?? '') &&
        !/not Daxing/i.test(seedText);
    })()],
  /* SKIING IS GONE, AND ONLY WHAT IS STILL TRUE OF IT REMAINS: no Chongli stop,
     no ski lesson card or task, no Taizicheng or Thaiwoo driver card, no day
     that sleeps at Element — and Element itself CANCELLED (on Agoda, 17 Oct
     2026, nothing charged), carrying none of the dead order's numbers. */
  ['skiing is gone: no Chongli stop, lesson, trains or ski cards; Element is cancelled, numberless, slept in on no day',
    (() => {
      const el = bundle.bookings.find((b) => b.id === 'cn26-stay-02');
      return !bundle.stops.some((st) => st.id === 'cn26-stop-chongli') &&
        bundle.stops.some((st) => st.id === 'cn26-stop-shanghai') &&
        !bundle.tasks.some((t) => t.id === 'cn26-task-ski-lesson' || t.id === 'cn26-task-element-cancel' || t.id === 'cn26-task-melia') &&
        !bundle.showCards.some((c) => c.id === 'cn26-place-08' || c.id === 'cn26-place-25') &&
        !bundle.dayPlans.some((d) => /Element|Chongli|Thaiwoo/i.test(`${d.bedLabel ?? ''} ${d.title}`)) &&
        el?.status === 'cancelled' && !el.alternative && !el.code && !el.codeSub && !el.priceNote && !el.manageUrl &&
        !el.address && !el.mapQuery && !el.coord && !el.mapUrl &&
        /CANCELLED/.test(el.note ?? '') &&
        !/683386279|5351254076|\+86 313 477 8500|1,575\.99/.test(seedText);
    })()],
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
  /* $4,444.42 → $4,561.72 on 2026-08-12: Air China CA8683, $117.30, paid on
     Trip.com by Google Pay. The first spend caused by the academy's arrival
     rule rather than by the itinerary. */
  /* $4,561.72 → $4,806.46 on 2026-08-12: Four Points had been prepaid in full
     at booking, US$244.74, and only its order DETAIL page ever said so. A
     correction to the books, not a payment — no money moved that day. */
  /* $4,806.46 → $5,106.02 on 2026-09-27: Blossom House had been prepaid in
     full too, US$299.56 (Google Pay $246.60 + gift card $52.96), and only its
     Trip.com confirmation email said so. The same correction a second time.
     "Booked & committed" does not move: the $299.56 was already there as the
     bed's price. */
  /* $5,106.02 → $5,216.32 on 2026-09-28: CA1560, $110.30, paid on Trip.com.
     The Muping bed booked the same morning is pay-at-hotel and moves nothing. */
  /* $5,216.32 → $5,256.44 on 2026-10-17: the Hi Cozy hostel, ₪136.40
     prepaid online on Trip.com, at the trip's own ILS 3.4 → $40.12. */
  /* $5,256.44 → $5,236.44 later the same day: + MU394 $200.20, and CA8609's
     line $241 → $20.80 (cancelled, $220.20 refunded, the fee kept). */
  ['only documented prepayments are logged as spending ($5,236.44)',
    bundle.expenses.length === 16 &&
    bundle.expenses.reduce((s, e) => s + e.homeMinor, 0) === 523644 &&
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
  /* FIVE FROM 2026-09-27: Blossom House, prepaid in full on 27 Jul and found on
     its confirmation email — counted whole, the gift-card part included. */
  /* SIX FROM 2026-10-17: the Hi Cozy hostel, ₪136.40 prepaid online — the
     first bed paid in shekels. */
  ['exactly six beds are counted as paid, and only the ones whose terms already took the money',
    (() => {
      const beds = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-lodging');
      const yue = beds.find((e) => e.id === 'cn26-exp-prepaid-yuetu-night1');
      const ibis = beds.find((e) => e.id === 'cn26-exp-prepaid-ibis-kunming');
      const royal = beds.find((e) => e.id === 'cn26-exp-prepaid-royal-garden');
      const blossom = beds.find((e) => e.id === 'cn26-exp-prepaid-blossom-house');
      const hicozy = beds.find((e) => e.id === 'cn26-exp-prepaid-hicozy');
      return beds.length === 6 &&
        hicozy?.currency === 'ILS' && hicozy.amount === 136.4 && hicozy.rateToHome === 3.4 && hicozy.homeMinor === 4012 &&
        blossom?.currency === 'USD' && blossom.amount === 299.56 && blossom.rateToHome === 1 && blossom.homeMinor === 29956 &&
        yue?.currency === 'CNY' && yue.amount === 428.65 && yue.rateToHome === 7.15 && yue.homeMinor === 5995 &&
        ibis?.currency === 'USD' && ibis.amount === 25.73 && ibis.rateToHome === 1 && ibis.homeMinor === 2573 &&
        royal?.currency === 'USD' && royal.amount === 1232.01 && royal.rateToHome === 1 && royal.homeMinor === 123201;
    })()],
  /* THE ELEVEN BOOKED BEDS — every bed on the trip except the gorge guesthouse,
     which is a deliberate walk-in. Eight went on 26–27 Jul; Dali and Kunming
     completed the platform set on 2026-07-27; THE ACADEMY joined on 2026-08-12,
     held by a deposit that was sent and acknowledged rather than by an order.
     This is the check that fails if any one of them silently reverts to
     pending. */
  /* 2026-10-17: Element (cn26-stay-02) left — cancelled — and the Hi Cozy
     hostel (cn26-stay-13) joined. Still twelve. */
  ['the twelve booked beds are booked, and no other bed is',
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'booked').map((b) => b.id).join(',') ===
      'cn26-stay-00,cn26-stay-01,cn26-stay-03,cn26-stay-04,cn26-stay-05,cn26-stay-06,cn26-stay-08,cn26-stay-09,cn26-stay-10,cn26-stay-11,cn26-stay-12,cn26-stay-13'],
  /* THE ACADEMY RECORD ITSELF, as one CRITICAL structural fact: the dates, the
     name it is held under, the price the school finally stated, and the two
     absences that are just as much of the record.
     THE PRICE WAS AN ABSENCE UNTIL 2026-08-13. This check used to demand
     `!b.priceNote`, because "price and room NOT confirmed in writing" and an
     unconfirmed rate may not join a total. The school wrote it down — "you can
     pay 840 USD to stay for 12 days or two weeks" — so the demand inverts: the
     bed must carry `$840`, and a bed that silently lost it fails here.
     NO REFERENCE — none was ever issued. NO PLATFORM — it was arranged by
     message. Those two are unchanged, and filling either in still fails: they
     are the honest part of this bed and must not be quietly improved. */
  ['the academy fortnight is held, dated, priced at the $840 the school stated, and quotes no reference and no platform',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-11');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return b?.kind === 'hotel' && b.status === 'booked' &&
        b.title === 'Kunyu Mountain Shaolin Kung Fu Academy' && b.city === 'Yantai' &&
        b.checkIn === '2026-11-23' && b.checkOut === '2026-12-05' &&
        b.priceNote === '$840' && !b.code && !b.codeLabel && !b.codeSub &&
        !b.manageUrl && !b.bookingLinkUrl &&
        /Price=\$840 — in writing, 13 Aug 2026/.test(chips) &&
        /Cancellation=none stated/i.test(chips) &&
        /Payment=CASH ONLY/i.test(chips) &&
        /Arrivals=MON\/TUE\/WED ONLY/i.test(chips);
    })()],
  /* THE THREE FACTS THAT ARRIVED WITH THE PRICE AND ARE NOT THE PRICE. The
     uniform is a purchase, the room-keeping fee is a refundable float, and the
     pickup is a plan — none of them is what the bed costs, so all three ride as
     chips and none may ever become a `priceNote`. The pickup keeps its residue
     on the card: as offered it is a hotel in MUPING, and the meeting point is
     still the school's to confirm. */
  ['the uniform, the refundable float and the pickup ride as chips and never as a price',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-11');
      const chip = (k: string) => (b?.meta ?? []).find((m) => m.k === k);
      return /US\$50/.test(chip('Uniform')?.v ?? '') &&
        /US\$50 — refundable on leaving/.test(chip('Room-keeping')?.v ?? '') &&
        /10:30 Mon 23 Nov/.test(chip('Pickup')?.v ?? '') && !/11:00/.test(chip('Pickup')?.v ?? '') &&
        /Muping/.test(chip('Pickup')?.v ?? '') &&
        /confirmed/i.test(chip('Pickup')?.v ?? '') &&
        /1\.5h/.test(chip('Taxi fallback')?.v ?? '') &&
        /昆嵛山武校/.test(chip('Taxi fallback')?.v ?? '') &&
        /address on file/i.test(chip('Where to go')?.v ?? '') &&
        b?.priceNote === '$840';
    })()],
  /* THE PRIVATE ROOM WAS DROPPED, NOT ANSWERED — the owner, 2026-08-13: "i dont
     care about the private room". A decision is not an open question, so the
     chip states it and loses the warn flag it wore while it was one. The Price
     chip loses its warn for the opposite reason: it is in writing now. */
  ['the dropped private room reads as a decision, not as a pending ask',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-11');
      const chip = (k: string) => (b?.meta ?? []).find((m) => m.k === k);
      const ask = bundle.tasks.find((t) => t.id === 'cn26-task-kunyu-email');
      const askText = `${ask?.title ?? ''} ${ask?.detail ?? ''}`;
      return /no preference/i.test(chip('Room')?.v ?? '') && !chip('Room')?.warn && !chip('Price')?.warn &&
        /i dont care about the private room/i.test(askText) &&
        !/private-room reservation/i.test(askText);
    })()],
  /* THE ACADEMY'S ADDRESS RIDES ON THE NOTE AND ON THE DRIVER CARD, AND ON
     NOTHING ELSE. `address` on a booking is what folds into the map intent, so
     a bed that prints an address in prose but carries none in the field is
     exactly the state this fact wants: readable, unsearchable. */
  ['the academy prints its address without acquiring a location',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-11');
      return /昆嵛山少林武术学校/.test(b?.note ?? '') && /264100/.test(b?.note ?? '') &&
        !b?.address && !b?.mapQuery && !b?.coord && !b?.mapUrl;
    })()],
  /* AND THE DEPOSIT STAYS EXACTLY ONE RECORD. The wallet card is the deposit's
     receipt and the booking is the stay; writing the stay down must not create
     a second lodging expense, or the trip would appear to have paid twice for
     one thing it has paid for once. */
  ['recording the stay did not duplicate the deposit',
    bundle.expenses.filter((e) => /kunyu/i.test(e.id)).length === 1 &&
    bundle.expenses.find((e) => e.id === 'cn26-exp-prepaid-kunyu-deposit')?.categoryId === 'cn26-cat-training' &&
    bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-lodging').length === 6 &&
    bundle.expenses.reduce((n, e) => n + e.homeMinor, 0) === 523644],
  /* No bed is pending again (2026-10-17, evening): the Meliá was pending that
     morning and never booked; the Hi Cozy hostel was booked in its place —
     with its number, its ₪ price and no map target. Element is the one
     cancelled bed, and the walk-in is the only other bed not booked. */
  ['no bed is pending; the Shanghai bed is the booked Hi Cozy hostel with no pin; Element is the one cancelled bed; the walk-in is the other',
    !bundle.bookings.some((b) => b.kind === 'hotel' && b.status === 'pending') &&
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'cancelled').map((b) => b.id).join(',') === 'cn26-stay-02' &&
    (() => {
      const m = bundle.bookings.find((b) => b.id === 'cn26-stay-13');
      return !!m && m.status === 'booked' && m.code === '1653717714742604' && m.priceNote === '₪136.40 (2n)' &&
        !m.mapQuery && !m.coord && !m.mapUrl && !m.address && !/Meliá/.test(seedText);
    })() &&
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.status === 'walkin').length === 1],
  /* THE OWNER'S RULE, 2026-07-27: a booked bed shows its price, that it IS
     booked, and a link to the site it was booked on. No exceptions — Element
     had no confirmation number until 2026-07-29 and still had its link, because
     not knowing the number is a different admission from not being able to
     reach the order. The number arrived; the link rule never moved.
     Each link is the PLATFORM'S entry point, never a guessed deep link, and
     each must point at the platform that bed was actually booked on.

     THE ACADEMY IS OUTSIDE THIS RULE AND IS CHECKED SEPARATELY ABOVE
     (2026-08-12). The rule assumes a bed a platform holds; that one was
     arranged by message and its rate has never been confirmed in writing, so it
     has no link to give and no price it may quote. The exemption is by ID, so a
     platform bed cannot slip through it. */
  ['every bed booked on a platform carries a price and a link to the site it was booked on',
    (() => {
      const want: Record<string, string> = {
        'cn26-stay-00': 'https://www.trip.com/order/all',
        'cn26-stay-01': 'https://www.trip.com/order/all',
        'cn26-stay-03': 'https://www.agoda.com/account/bookings.html',
        'cn26-stay-04': 'https://www.trip.com/order/all',
        'cn26-stay-05': 'https://www.trip.com/order/all',
        'cn26-stay-06': 'https://secure.booking.com/mytrips.html',
        'cn26-stay-08': 'https://secure.booking.com/mytrips.html',
        'cn26-stay-09': 'https://www.trip.com/order/all',
        'cn26-stay-10': 'https://www.rghk.com.hk/en/index.php',
        'cn26-stay-12': 'https://www.trip.com/order/all',
        'cn26-stay-13': 'https://www.trip.com/order/all',
      };
      const booked = bundle.bookings
        .filter((b) => b.kind === 'hotel' && b.status === 'booked' && b.id !== 'cn26-stay-11');
      return booked.length === 11 &&
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
    !/29[78]\b/.test(JSON.stringify([bundle.walletCards, bundle.tasks, bundle.infoCards]))],
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
     late-arrival rule is not satisfied here.
     INVERTED 2026-09-27: the rule WAS satisfied — Booking.com approved a
     22:00–23:00 check-in on 27 Jul and the email sat unread. The card now says
     APPROVED, still says 23:00 (the door did not move), carries the ETA job for
     the day, and "NOT declared" must be gone from the whole seed. */
  ['Dali prints its full-price cliff, its 23:00 desk, its APPROVED late arrival and the ETA job',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-08');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return /free cancel=to 23:59 Dec 15/i.test(chips) &&
        /00:00 Dec 16/.test(chips) && /¥324/.test(chips) &&
        /late arrival=22:00–23:00 APPROVED/i.test(chips) && /23:00/.test(chips) &&
        /WhatsApp your ETA/i.test(chips) &&
        !/NOT declared|no late arrival (?:was|has been) declared/i.test(seedText) &&
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
  ["all three formerly termless beds now state the terms their own orders print",
    (() => {
      const want: [string, RegExp, RegExp][] = [
        ['cn26-stay-00', /to 16:00 Dec 5/i, /PREPAID ONLINE/i],
        ['cn26-stay-04', /free before check-in/i, /pay at hotel/i],
        ['cn26-stay-05', /free before check-in/i, /pay at hotel/i],
      ];
      return want.every(([id, c, p]) => {
        const b = bundle.bookings.find((x) => x.id === id);
        const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
        return c.test(chips) && p.test(chips) && !/not stated/i.test(chips);
      });
    })()],

  /* A booked bed carries what you read out at the desk, and it must be the
     number of the order that is actually live. Four Points was rebooked on
     2026-07-27: the new order carries no PIN, so the card carries no secondary
     line, and the dead number and its PIN 9858 appear NOWHERE in the seed. */
  ['the live Four Points order is counter-facing, and the superseded one is gone',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-00');
      const chips = [b?.codeSub ?? '', ...(b?.meta ?? []).map((m) => m.v)].join(' ');
      /* PIN 1170 and the 16:00 window arrived 2026-08-12 from the order detail
         page. The dead order's PIN, price and hold must still reach no chip. */
      return b?.code === '1653715561783471' && /1170/.test(b.codeSub ?? '') &&
        !/9858/.test(chips) && !/289\.68|1,960/.test(chips) && !/144\.84/.test(chips) &&
        !seedText.includes('1653715561596848');
    })()],

  /* Blossom House's number and platform were the two blanks this app carried
     from 2026-07-27 morning to 2026-07-27 evening. The two that could still
     cost money — payment and the cancellation cut-off — stayed blank until
     2026-09-27, when the Trip.com confirmation EMAIL was read: prepaid in full,
     free to 23:00 on Dec 4, then non-refundable. The check inverts: both must
     now be stated, and neither blank may survive. The small line under the
     number is the HOTEL'S own confirmation number — not a PIN (none was ever
     shown), the Element arrangement: a second number for a desk that cannot
     find the first. */
  ['Blossom House carries its number, its platform, its payment and its cut-off',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-01');
      return b?.code === '1653715561827302' && b.codeLabel === 'Trip.com booking' &&
        b.manageUrl === 'https://www.trip.com/order/all' &&
        /R9000388217900556001/.test(b.codeSub ?? '') && !/PIN/i.test(b.codeSub ?? '') &&
        /PREPAID ONLINE/i.test(b.meta.find((m) => /payment/i.test(m.k))?.v ?? '') &&
        /23:00 Dec 4/i.test(b.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '') &&
        !/not stated|no deadline/i.test(b.meta.map((m) => m.v).join(' '));
    })()],
  /* YUE TU: the trip's designated late-arrival night and its first prepaid
     bed. Its refund cliff decided the gorge bag transfer until 27 Sep 2026
     (evening), when the inn's third reply said it has no contact for Tina's
     Inn either — the owner now arranges the bag himself (Option B), so this
     cliff is a pure money deadline again. The approved 22:00–23:00 window is
     the whole reason the standing "always declare a late arrival" rule is
     satisfied here, so it must be on the card and not only in prose. The
     postcode 674100 rides in the NOTE, never in the address: an address is
     transcribed from one source, never assembled from two — the same rule
     Pullman's entry follows. */
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
     booking.com, so the property may only recognise 5351254076.
     THE ACADEMY IS NOT AN EXCEPTION TO THIS, it is the other case: no number
     was ever ISSUED for it, so it must carry none, and the check above demands
     that emptiness of it explicitly. "Nobody gave us a number" and "we lost the
     number" stay two different sentences. */
  /* 2026-10-17: Element was CANCELLED, and its two numbers went with it — a
     dead credential beside a live booking is what gets read out at a desk.
     The Hi Cozy hostel, booked the same day, carries its Trip.com number and
     its PIN on the secondary line, like the other Trip.com beds. */
  ['no bed booked on a platform is numberless any more; cancelled Element carries none, the Hi Cozy hostel its Trip.com number and PIN',
    (() => {
      const beds = bundle.bookings
        .filter((b) => b.kind === 'hotel' && b.status === 'booked' && b.id !== 'cn26-stay-11');
      const el = bundle.bookings.find((x) => x.id === 'cn26-stay-02');
      const hc = bundle.bookings.find((x) => x.id === 'cn26-stay-13');
      return beds.every((b) => !!b.code) &&
        el?.status === 'cancelled' && !el.code && !el.codeSub && !el.manageUrl && !el.bookingLinkUrl &&
        hc?.code === '1653717714742604' && /PIN 8861/.test(hc.codeSub ?? '') && !hc.bookingLinkUrl;
    })()],
  /* THE DEADLINES, as numbers rather than as the word "free". Element's window
     shuts at 00:00 on its own check-in day — earlier than any other bed's — and
     46% of the booking is lost on a no-show. Pullman's shuts at 23:59 the SAME
     day, so Dec 9 closes two windows at opposite ends of it. Yue Tu's shuts
     23:59 Dec 13 and costs a night after that. None may degrade into a
     generic "free cancellation".
     THE ROYAL GARDEN LEFT THIS LIST ON 2026-09-27. Its 14:00 Dec 19 window
     died on 31 Jul, when the prepayment made it non-refundable; the card kept
     printing it for two months. It is guarded from the other side below.
     Four Points is deliberately NOT in this list any more: the 16:00 Dec 5
     window belonged to the order that was replaced, and a bed with no stated
     deadline must say so rather than borrow a dead one. */
  ['each booked bed with a stated deadline carries it as a number, not a promise',
    (() => {
      const want: [string, RegExp][] = [
        /* Element's 00:00 Dec 9 left with the booking (cancelled 2026-10-17);
           the Hi Cozy hostel's 18:00 Dec 9 came with its own. */
        ['cn26-stay-13', /18:00.*Dec 9/i],
        ['cn26-stay-03', /23:59.*Dec 9/i],
        ['cn26-stay-06', /23:59.*Dec 13/i],
        ['cn26-stay-08', /23:59.*Dec 15/i],
        ['cn26-stay-09', /23:00.*Dec 17/i],
      ];
      return want.every(([id, re]) => {
        const b = bundle.bookings.find((x) => x.id === id);
        return re.test(b?.meta.find((m) => /free cancel/i.test(m.k))?.v ?? '');
      });
    })()],
  /* THE ROYAL GARDEN, PAID AND FIXED. Paid in full on 30 Jul 2026 to answer a
     credit-card demand; "under non-refundable basis, no cancellation or
     amendment is allowed" from 31 Jul. The card must say PAID and
     NON-REFUNDABLE, carry no free-cancel chip, and no screen anywhere may
     resurrect a free window at 14:00 on Dec 19 or a desk payment. */
  ['the Royal Garden is PAID and NON-REFUNDABLE, and "free to 14:00 Dec 19" survives nowhere',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-10');
      const chip = (k: string) => b?.meta.find((m) => m.k === k)?.v ?? '';
      return /PAID IN FULL/.test(chip('Payment')) && /NON-REFUNDABLE/.test(chip('Cancellation')) &&
        !(b?.meta ?? []).some((m) => /free cancel/i.test(m.k)) &&
        /non-refundable basis/.test(b?.note ?? '') && /OFFLINE/.test(b?.note ?? '') &&
        !/free[^"|]{0,40}14:00[^"|]{0,12}(?:Dec 19|19 Dec)|to 14:00 Dec 19|(?:Dec 19|19 Dec)[^"|]{0,4}\(?CST|1,232\.01 at the hotel/i.test(seedText);
    })()],
  /* TIANMEN, KEPT BY THE NEW ROUTE (owner, 2026-09-27). The card carries both
     2026 closures, nothing promises "the world's longest cableway", and a
     re-check task sits in late November, before anything is bought. */
  ['Tianmen carries the 2026 closures, promises no "longest cableway", and is re-checked in late Nov',
    (() => {
      const t = bundle.bookings.find((x) => x.id === 'cn26-ticket-tianmen');
      const chips = (t?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      const task = bundle.tasks.find((x) => x.id === 'cn26-task-tianmen-recheck');
      return /6 Nov 2025/.test(chips) && /12 May 2026/.test(chips) && /do NOT buy/i.test(chips) &&
        !/longest cable ?way/i.test(seedText) && (task?.due ?? '').startsWith('2026-11-');
    })()],
  /* DEC 20, REWRITTEN (owner decision 2): Kunming Station 昆明站 for the Green
     Lake evening, Kunming South as the fallback, the old town → Dali station
     leg written down — and Kunming South never again placed "in Xiaguan". Only
     the fallback has a verified button. */
  ['Dec 20: Kunming Station is the plan, Kunming South the fallback, and Kunming South is never "in Xiaguan"',
    (() => {
      const t = bundle.bookings.find((x) => x.id === 'cn26-train-dec20');
      const run = (bundle.runbooks.find((r) => r.id === 'cn26-run-dec20')?.steps ?? []).join(' ');
      return !!t && t.kind === 'train' && /昆明站/.test(t.to.name) && /Kunming South/.test(t.to.name) &&
        (t.to.stations ?? []).map((s) => s.name).join(',') === '昆明南站' &&
        /Xiaguan/.test(t.from.why ?? '') && /昆明站/.test(run) && /Kunming South/.test(run) &&
        !/Kunming South(?![^."|]{0,12}\bnot\b)[^."|]{0,60}Xiaguan/i.test(seedText);
    })()],
  /* NOV 22: CA8683 (retimed 29 Sep to CA8641, PKX 15:00 → YNT 16:20) has been
     booked since 12 Aug; the HSR card is the plan for one bad morning — EY888
     late, separate tickets, nobody obliged to rebook. */
  ['Nov 22: the flight is booked and the HSR card is the "EY888 is late" plan',
    (() => {
      const t = bundle.bookings.find((x) => x.id === 'cn26-train-nov22');
      return !!t && t.alternative === true && /EY888/.test(t.title) && /separate tickets/i.test(t.note ?? '') &&
        !/Neither is booked|flight if booked/i.test(seedText);
    })()],
  /* 2026-09-29: Air China retimed CA8683 to CA8641, PKX 15:00 → YNT 16:20 —
     accepted free on Trip.com the same day. The old 12:35 → 13:45 must not
     survive as this leg's current departure/arrival anywhere in the seed;
     the fallback's lateness threshold must have widened from ~2.5 h to ~5 h
     with it, since the connection went from 3h50 to 6h15. */
  ['Nov 22 flight: retimed to CA8641 15:00 → 16:20, and the fallback threshold widened to ~5 h',
    (() => {
      const f = bundle.bookings.find((x) => x.id === 'cn26-flight-ca8683') as { dep?: string; arr?: string; flightNo?: string } | undefined;
      const train = bundle.bookings.find((x) => x.id === 'cn26-train-nov22');
      return f?.dep === '15:00' && f?.arr === '16:20' && /CA ?8641/.test(f?.flightNo ?? '') &&
        /~5 h/.test(train?.note ?? '') && !/~2\.5 h/.test(train?.note ?? '');
    })()],
  /* 2026-09-29 (later the same day): Trip.com confirmed at 11:09 that the
     ~19:00 late-arrival request reached the hotel, so the task closes — it
     must no longer exist — and the bed's own record must say so rather than
     still reading "not shown yet". */
  ['Muping late arrival: passed on to the hotel 29 Sep, and the task is closed',
    (() => {
      const task = bundle.tasks.find((t) => t.id === 'cn26-task-muping-late-arrival');
      const bed = bundle.bookings.find((x) => x.id === 'cn26-stay-12');
      return !task && !!bed && /passed on to the hotel/i.test(`${bed.note ?? ''}`) &&
        !/not yet showing|does not show it yet|does not show on the order|not shown yet/i.test(seedText);
    })()],
  /* DEC 21: one leave time on three screens. */
  ['Dec 21 has one leave time: alarm 09:30, leave the ibis ~10:15, terminal by 10:50',
    (() => {
      const a = bundle.alarms.find((x) => x.date === '2026-12-21');
      const run = (bundle.runbooks.find((r) => r.id === 'cn26-run-exit')?.steps ?? []).join(' ');
      return a?.time === '09:30' && /10:15/.test(a.title) && /10:15/.test(run) && /10:50/.test(run) && !/11:30/.test(run);
    })()],
  /* DEC 22: the return ferry moved ~17:15 → ~16:15 (30 min of slack before a
     19:00 hall was too thin). The ferry card, the concert card and the Dec 8
     booking alarm must all say it. */
  ['Dec 22: the return ferry is ~16:15 on the ferry card, the concert card and the Dec 8 alarm',
    (() => {
      const ferry = bundle.bookings.find((x) => x.id === 'cn26-ticket-macau-ferry');
      const concert = bundle.bookings.find((x) => x.id === 'cn26-ticket-hkphil');
      const alarm = bundle.alarms.find((x) => x.date === '2026-12-08' && /macau/i.test(x.title));
      return /16:15/.test(ferry?.meta.find((m) => m.k === 'Return leg')?.v ?? '') &&
        /return ferry is ~16:15/.test(concert?.note ?? '') && /16:15/.test(alarm?.why ?? '');
    })()],
  /* JADE DRAGON, 2026 rules: two WeChat mini-programs, no windows, a morning
     slot, and the altitude rules — with the lower alternative named. */
  ['Jade Dragon carries the mini-programs, the morning slot, the altitude rules and Spruce Meadow',
    (() => {
      const t = bundle.bookings.find((x) => x.id === 'cn26-ticket-jade-dragon');
      const chips = (t?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return /玉龙雪山服务/.test(chips) && /丽江旅游集团/.test(chips) && /MORNING/.test(chips) &&
        /45 min/.test(chips) && /云杉坪/.test(chips);
    })()],
  /* THE GORGE FALLBACK, on the road card and on the runbook Home shows that day. */
  ['Dec 18: the gorge fallback is on the road card and on its own runbook',
    (() => {
      const road = bundle.bookings.find((x) => x.id === 'cn26-road-dec18');
      const run = (bundle.runbooks.find((r) => r.id === 'cn26-run-dec18')?.steps ?? []).join(' ');
      const day = bundle.dayPlans.find((d) => d.date === '2026-12-18');
      return /Tea Horse/.test(road?.note ?? '') && /Tina/.test(road?.note ?? '') &&
        /15:00/.test(run) && /Tina/.test(run) && day?.runbookId === 'cn26-run-dec18';
    })()],
  /* THE OWNER'S NEW TO-DOS, each with a date: the two evening arrivals, the
     eSIM (plan A since the April 2026 crackdown), police registration at the
     academy, and Christmas morning's cable car.
     TWO OF THEM ARE DONE since 2026-09-28 and must STAY closed: the arrivals
     were messaged on 27 Sep (Huatian by email via Trip.com's relay, Glenview in
     the app) and the school does the PSB registration. The eSIM and Ngong Ping
     are still dated. */
  ['the review\'s to-dos: eSIM and Ngong Ping dated; the arrivals message and PSB done and closed',
    (() => {
      const t = (k: string) => bundle.tasks.find((x) => x.id === `cn26-task-${k}`);
      const nov23 = (bundle.dayPlans.find((d) => d.date === '2026-11-23')?.planItems ?? []).join(' ');
      return !t('late-arrivals') && !t('psb') && /school does it/i.test(nov23) &&
        t('esim')?.due === '2026-11-05' && t('ngong-ping')?.due === '2026-11-15';
    })()],
  /* THE CATEGORY PLANS THAT MONEY OVERTOOK, rebuilt from what was paid or put
     in writing (the lodging precedent of 2026-07-27): flights $2,026, training
     $990, trains + flights $1,078. The sum is allowed to exceed the budget —
     that is the point of making it visible. */
  /* 28 Sep 2026: two moved again — trains + flights 1,078 → 1,068 (CA1560's
     $110.30 in place of the ~$121 estimate) and lodging 2,566 → 2,589 (the
     Muping night, ¥164 ≈ $22.94). Training's $990 is now the ONLY reading: the
     $100 was an application fee, so the "$890 if netted" alternative is dead. */
  /* 17 Oct 2026: skiing dropped. Ski (Chongli) $350 → "Shanghai + Disney"
     $287 (same key); trains + flights 1,068 → 1,346 (− the two Chongli trains,
     + G7 ~$103, + MU394 at $201; CA8609's paid $241 stays until it is
     refunded); lodging 2,589 → 2,696 (− Element, + the Meliá at $340). The cap
     stays $9,000; the plans sum to $9,155 and that is visible, not shaved.
     Later the same day the bed was booked — the Hi Cozy hostel, ₪136.40 ≈
     $40.12 — and the Meliá never was: lodging 2,696 → 2,396, and with the
     taxis become the metro, Shanghai + Disney 287 → 203. The plans sum to
     $8,771, $229 under the cap. Later still, MU394 was paid $200.20 (planned
     $201) and CA8609 was cancelled with $220.20 refunded: trains + flights
     1,346 → 1,125. The plans sum to $8,550, $450 under the cap. And the Dec 9
     train reserved at ILS 330.22 (≈$97.12, $103 planned): 1,125 → 1,119, sum
     $8,544. */
  ['category plans: flights $2,026, training $990, trains + flights $1,119, lodging $2,396, Shanghai + Disney $203',
    (() => {
      const cat = (k: string) => bundle.categories.find((c) => c.id === `cn26-cat-${k}`);
      const plan = (k: string) => cat(k)?.planMinor;
      return plan('flights') === 202600 && plan('training') === 99000 && plan('transport') === 111900 &&
        plan('lodging') === 239600 && plan('ski') === 20300 && cat('ski')?.label === 'Shanghai + Disney' &&
        bundle.categories.reduce((n, c) => n + c.planMinor, 0) === 854400 &&
        bundle.trip.budgetTotalMinor === 900000;
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
  /* 2026-09-28 — THE ACADEMY ANSWERED AND TWO BOOKINGS FOLLOWED. */
  ['CA1560 is booked as bought — YNT 14:55 → Capital T3 16:15, $110.30 — and lands at Capital',
    (() => {
      const f = bundle.bookings.find((b) => b.id === 'cn26-flight-ca1560');
      const day = (bundle.dayPlans.find((d) => d.date === '2026-12-05')?.planItems ?? []).join(' ');
      return !!f && f.kind === 'flight' && f.status === 'booked' && f.date === '2026-12-05' &&
        f.from.code === 'YNT' && f.to.code === 'PEK' && f.dep === '14:55' && f.arr === '16:15' &&
        f.code === '1653717880605553' && f.priceNote === '$110.30' &&
        /CAPITAL/i.test(f.note ?? '') && /14:55/.test(day) && /16:15/.test(day) &&
        bundle.dayPlans.find((d) => d.date === '2026-12-05')?.runbookId === 'cn26-run-dec5';
    })()],
  ['the twelfth bed is the Muping night: ¥164 cash at the desk, free before check-in, and no button',
    (() => {
      const b = bundle.bookings.find((x) => x.id === 'cn26-stay-12');
      const chips = (b?.meta ?? []).map((m) => `${m.k}=${m.v}`).join(' | ');
      return b?.kind === 'hotel' && b.status === 'booked' && b.checkIn === '2026-11-22' && b.checkOut === '2026-11-23' &&
        b.code === '1653717166174001' && b.priceNote === '¥164.00' &&
        /Payment=PAY AT HOTEL — CNY 164\.00, in CASH/.test(chips) && /Free cancel=before check-in/.test(chips) &&
        /No\. 460 Moushan Road/.test(b.note ?? '') && !b.address && !b.mapQuery && !b.coord && !b.mapUrl &&
        !bundle.expenses.some((e) => /muping|jinjiang/i.test(`${e.id} ${e.desc}`));
    })()],
  ['the $100 is a one-time application fee and is never part of the $840',
    (() => {
      const card = bundle.walletCards.find((c) => c.id === 'cn26-card-kunyu');
      const fee = bundle.expenses.find((e) => e.id === 'cn26-exp-prepaid-kunyu-deposit');
      return card?.code === '$100 PAID' && /application fee/i.test(card.codeLabel ?? '') &&
        /application fee/i.test(fee?.desc ?? '') && fee?.homeMinor === 10000 &&
        !/whether the deposit|may or may not count|UNKNOWN: whether/i.test(seedText);
    })()],
  ['the school\'s answers are on the days: Saturdays free (Nov 28 written), PSB by the school, pickup from 10:30',
    (() => {
      const nov28 = bundle.dayPlans.find((d) => d.date === '2026-11-28');
      const nov23 = (bundle.dayPlans.find((d) => d.date === '2026-11-23')?.planItems ?? []).join(' ');
      const arrive = (bundle.runbooks.find((r) => r.id === 'cn26-run-arrive')?.steps ?? []).join(' ');
      return !!nov28 && /no training on saturdays/i.test(nov28.planItems.join(' ')) && /shifu/i.test(nov28.planItems.join(' ')) &&
        /10:30/.test(nov23) && /school does it/i.test(nov23) && /10:30/.test(arrive) && /Muping/.test(arrive);
    })()],
  ['Phoenix: the 24/7 line is filled in, and the martial-arts cover reads verbal-with-writing-pending',
    (() => {
      const card = bundle.walletCards.find((c) => /insurance/i.test(c.title));
      const rows = new Map((card?.rows ?? []).map((r) => [r.k, r.v]));
      const line = bundle.emergency.find((e) => /insurance/i.test(e.label));
      return /\+972-3-7331177/.test(rows.get('Emergency line') ?? '') &&
        /COVERED/.test(rows.get('Martial arts') ?? '') && /verbal/i.test(rows.get('Martial arts') ?? '') &&
        line?.value === '+972 3 733 1177' && !line.pending && line.kind === 'phone';
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
  /* Every real stop but Shanghai (2026-10-17): no curated photo has been chosen
     for it, and the build never fetches one. */
  ['one curated place photo per real stop rides in the vault — Shanghai, named, has none yet',
    bundle.documents.filter((d) => d.meta.tag === 'photo').length === PLACE_PHOTOS.length &&
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.id === 'cn26-stop-shanghai') !== !!s.photoDocId)],
  ['every real stop carries a read-more text',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.detail ?? '').length > 200)],
  ['every real stop carries its options',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.options?.length ?? 0) >= 2 &&
      (s.options ?? []).flatMap((b) => b.items).length >= 8)],
  /* Shanghai is the named exception since 2026-10-17: no coordinate is
     verified in the sources, so it carries none rather than an invented one. */
  ['every real stop carries a coordinate — Shanghai, named, none — and no bed carries one',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.id === 'cn26-stop-shanghai') !== !!s.coord) &&
    bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => !b.coord)],
  /* No card that is still waiting on a fact may carry a pin for it — and, since
     2026-08-13, neither may the one that stopped waiting. The Kunyu card got
     its address that day and got no coordinate with it, which is the case this
     rule exists for: the answer arrived and the button still did not. */
  ['no place card carries a coordinate it was never given, pending or answered',
    bundle.showCards.filter((c) => c.pending).every((c) => !c.coord) &&
    !bundle.showCards.find((c) => c.id === 'cn26-place-00')?.coord],
  /* THREE until 2026-08-12, when CA 8683 made it four. The first three come
     from the guide's booked-flights line; the fourth is the only one read off a
     receipt, $117.30 paid on Trip.com the day the academy's Mon/Tue/Wed arrival
     rule forced a night in Yantai. The four Etihad legs still carry none. */
  /* FIVE from 2026-09-28: CA1560's $110.30, the second fare read off a receipt. */
  /* SIX from 2026-10-17: MU394's $200.20, read off its Trip.com confirmation. */
  ['the only flight fares in the seed are the six that are documented',
    bundle.bookings.filter((b) => b.kind === 'flight' && b.priceNote).length === 6],
  ['the Etihad legs carry no invented fare — their one price rides on the flights stop',
    bundle.bookings.filter((b) => b.kind === 'flight' && /^EY/.test(b.flightNo)).every((b) => !b.priceNote) &&
    /booked ~\$2,026/.test(bundle.stops.find((s) => s.kind === 'transit')?.costNote ?? '')],
  /* EVERY BED THAT WAS EVER QUOTED A PRICE CARRIES IT, and from 2026-08-13 that
     is every bed on the trip. For one month exactly one was not: the academy's
     rate had never been confirmed in writing ("price and room NOT confirmed in
     writing"), so it carried no quote and this check named it as the single
     permitted exception. The school stated $840 and the exception is gone.
     The check is kept as an EMPTY list rather than deleted, because that is the
     only form that still catches a bed silently losing its price. */
  /* ONE UNQUOTED BED since 2026-10-17, and it is not a lost price: Element was
     CANCELLED, and a cancelled booking's price is not a commitment. (For part
     of that day it was the unbooked Meliá; the Hi Cozy hostel that replaced it
     carries ₪136.40.) */
  ['every booked bed carries the price it was quoted at; the one unquoted bed is cancelled Element',
    bundle.bookings.filter((b) => b.kind === 'hotel' && !b.priceNote).map((b) => `${b.id}:${b.status}`).join(',') === 'cn26-stay-02:cancelled'],
  /* Every flight opens the airport it LEAVES from — resolved at build time
     from the driver card that already carries the verified name, so the app
     never cross-looks-up anything. */
  /* ONE NAMED EXCEPTION since 2026-09-28: CA1560 leaves YNT, which has no
     driver card and no verified name (map-links.ts) — so it opens NOTHING
     rather than a guessed pin, and the academy's driver takes you there. */
  /* AND A SECOND since 2026-10-17: MU394 leaves PVG, Shanghai Pudong — no
     driver card, no verified name, so it opens nothing either. */
  ['every flight opens the airport it departs from — except CA1560 from YNT and MU394 from PVG, which open nothing',
    bundle.bookings.filter((b) => b.kind === 'flight').every((b) =>
      b.kind === 'flight' && (b.from.code === 'YNT' || b.from.code === 'PVG') ? !b.mapQuery && !b.coord && !b.mapUrl : !!b.mapQuery || !!b.coord)],
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
     door. It is a BOOKED bed — booked is not the same as locatable.
     (2026-09-27: its confirmation email DOES print a door, No. 9 Yangfang
     Hutong / 羊房胡同9号. It rides on the note, in English and Chinese, and is
     not yet a button: every address the app opens was checked in Amap on the
     phone first, and this one has not been. Promoting it is a separate,
     device-checked step, not something a data audit does in passing.)
     THE ACADEMY JOINED IT ON 2026-08-12, and it is the starkest instance of the
     same fact: the academy's own arrival message never says where to go — no
     address, no station, no meeting point — so there is nothing to open and
     nothing may be conjured. They meet the flight at YNT, and the Chinese
     address card is still an open question rather than a location. */
  /* THE MUPING NIGHT JOINED ON 2026-09-28 — by Blossom House's road: its
     Trip.com confirmation prints a street (No. 460 Moushan Road), which rides
     on the note for the driver, and it is not a button until it has been
     checked in Amap on the phone. */
  /* 2026-10-17: the Hi Cozy hostel (its order prints a street — No. 350
     Shanxi South Road — not yet checked in a map) and cancelled Element
     (a cancelled bed is nowhere to go) joined them. */
  ['the beds with nothing verified to open ship no button at all',
    ['cn26-stay-01', 'cn26-stay-02', 'cn26-stay-11', 'cn26-stay-12', 'cn26-stay-13'].every((id) => {
      const b = bundle.bookings.find((x) => x.id === id);
      return !!b && !b.mapQuery && !b.coord && !b.mapUrl && !b.address;
    })],
  /* Eight open by a street address the owner's own paperwork prints, and TWO by
     a name: the gorge guesthouse, which never changed, and Huatian. The count
     did not move when the twelfth bed arrived, because that bed has no location
     to carry — ten of TWELVE since 2026-08-12. */
  /* Nine of fourteen since 2026-10-17: Element, cancelled, gave up its
     address button, and the Hi Cozy hostel has none yet. */
  ['nine of the fourteen beds carry a location',
    bundle.bookings.filter((b) => b.kind === 'hotel' && (b.mapQuery || b.address || b.mapUrl)).length === 9],
  ['seven of them are addresses off the owner’s own paperwork, and none is a coordinate',
    bundle.bookings.filter((b) => b.kind === 'hotel' && b.address && !b.mapQuery).length === 7 &&
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
  /* Element opened by its street ('Block I, Thaiwoo Ski Resort & Alpine
     Park, Sitaizui County'), never by the chain name, from 2026-07-27 until
     the owner cancelled it on 2026-10-17. A cancelled bed opens nothing; that
     is checked with the buttonless beds above. */
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
  ['every real stop carries at least one verified spot — Shanghai, named, none yet',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.id === 'cn26-stop-shanghai') === !(s.spots?.length ?? 0))],
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
      const documented = new Set(['cn26-stop-kunyu', 'cn26-place-09', 'cn26-place-17', 'cn26-place-24']); // cn26-stop-chongli left 2026-10-17
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
      if (b.from.code === 'YNT') return !cardId && !b.mapQuery && !b.coord; // CA1560 — no card, no button (28 Sep)
      if (b.from.code === 'PVG') return !cardId && !b.mapQuery && !b.coord; // MU394 — no card, no button (17 Oct)
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

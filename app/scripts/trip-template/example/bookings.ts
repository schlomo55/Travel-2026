/* 🧪 TEMPLATE EXAMPLE · bookings.ts — brief §2 Flights, §3 Beds, §5 Ground.

   FIVE BOOKINGS, AND THE WHOLE POINT IS THE FIFTH.

     ✅ tx00-flight-out    Paris → Porto, booked, ref TEST-AA1
     ✅ tx00-train-porto-lisbon  booked, ref TEST-CP7
     ✅ tx00-flight-home   Lisbon → Paris, booked, ref TEST-ZZ9
     ✅ tx00-bed-porto     booked, ref TEST-BK-4471    → GREEN segment
     ⏳ tx00-bed-lisbon    status 'pending', no ref    → AMBER segment

   Every reference is visibly fake and every note says so. Nothing here
   corresponds to a reservation that exists.

   WHY 'pending' RATHER THAN NO BOOKING AT ALL. Both would leave the Lisbon
   nights unbought. Only one of them is honest on screen:

     · no booking      → `coverage.ts` calls those nights `'missing'`, counts
                         them in `bedsMissing`, and `toneOf()` escalates the
                         chip to CRIT once the booking window closes in. A hole.
     · status 'pending' → `coverage.ts:190` calls them `'pending'`, they land in
                         `bedsPending`, and the segment tone is `'warn'` —
                         amber, and only ever amber, however near the date gets.

   The placeholder still carries real dates, because the dates are what tell the
   app WHICH nights are unheld. It carries no `code`, because there is nothing
   to write down. And it carries the brief's Want: clause verbatim in `note`,
   because that is the sentence worth reading when you sit down to book it. */
import type { Booking, FlightBooking, HotelBooking, TrainBooking } from '../../../src/lib/model/types';
import { SEED_TS, SLUG, STOP_IDS, id } from './base';

const stamps = { createdAt: SEED_TS, updatedAt: SEED_TS };
const SAMPLE = 'Sample booking — not a real reservation.';
const CODE_LABEL = 'Sample booking reference';

/** A plain search. No affiliate tag, no account parameters, nothing personal. */
const search = (q: string): string =>
  `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`;

function flights(): FlightBooking[] {
  return [
    {
      id: id('flight', 'out'),
      tripId: SLUG,
      kind: 'flight',
      status: 'booked',
      title: 'Sample Air · SA 410',
      groupLabel: 'Sample flights',
      date: '2027-04-12',
      code: 'TEST-AA1',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Seat', v: '18C · sample' },
        { k: 'Bag', v: '1 × 23 kg · sample' },
      ],
      note: `${SAMPLE} ✅ BOOKED in the brief, so the reference above is readable offline in one tap.`,
      priceNote: '€110 pp · sample',
      stopId: STOP_IDS.porto,
      mapQuery: 'Paris Charles de Gaulle Airport',
      mapCity: 'Paris',
      carrier: 'Sample Air',
      flightNo: 'SA 410',
      from: { code: 'CDG', name: 'Paris Charles de Gaulle' },
      to: { code: 'OPO', name: 'Porto Francisco Sá Carneiro' },
      dep: '11:05',
      arr: '12:50',
      arrDayOffset: 0,
      duration: '2h45',
      ...stamps,
    },
    {
      id: id('flight', 'home'),
      tripId: SLUG,
      kind: 'flight',
      status: 'booked',
      title: 'Sample Air · SA 411',
      groupLabel: 'Sample flights',
      date: '2027-04-16',
      code: 'TEST-ZZ9',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Seat', v: '9A · sample' },
        { k: 'Bag', v: '1 × 23 kg · sample' },
      ],
      note: `${SAMPLE} Evening departure, which is why the Lisbon room is held through the last day.`,
      priceNote: '€125 pp · sample',
      stopId: STOP_IDS.lisbon,
      mapQuery: 'Lisbon Humberto Delgado Airport',
      mapCity: 'Lisbon',
      carrier: 'Sample Air',
      flightNo: 'SA 411',
      from: { code: 'LIS', name: 'Lisbon Humberto Delgado' },
      to: { code: 'CDG', name: 'Paris Charles de Gaulle' },
      dep: '21:05',
      arr: '00:45',
      arrDayOffset: 1,
      duration: '2h40',
      ...stamps,
    },
  ];
}

function trains(): TrainBooking[] {
  return [
    {
      id: id('train', 'porto-lisbon'),
      tripId: SLUG,
      kind: 'train',
      status: 'booked',
      title: 'Sample train · Porto → Lisbon',
      groupLabel: 'Sample ground transport',
      date: '2027-04-14',
      code: 'TEST-CP7',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Duration', v: '~3 h · sample' },
        { k: 'Seats', v: 'Car 4, 21/22 · sample' },
      ],
      note: `${SAMPLE} Booked, deliberately — so the amber on the Lisbon segment can only be coming from the bed.`,
      priceNote: '€32 pp · sample',
      stopId: STOP_IDS.lisbon,
      from: { name: 'Porto' },
      to: { name: 'Lisbon' },
      dep: '10:30',
      arr: '13:25',
      trainNo: 'AP-000',
      duration: '~3 h',
      ...stamps,
    },
  ];
}

interface BedSpec {
  key: string;
  title: string;
  city: string;
  checkIn: string;
  checkOut: string;
  stopId: string;
  status: 'booked' | 'pending' | 'walkin';
  code?: string;
  priceNote: string;
  searchQuery?: string;
  note: string;
}

const BED_SPECS: BedSpec[] = [
  {
    /* ✅ BOOKED — the green half of the demonstration. */
    key: 'porto',
    title: 'Sample river guesthouse, Porto',
    city: 'Porto',
    checkIn: '2027-04-12',
    checkOut: '2027-04-14', // check-out is the MORNING YOU LEAVE: 2 nights
    stopId: STOP_IDS.porto,
    status: 'booked',
    code: 'TEST-BK-4471',
    priceNote: '€95/n · sample',
    note: `${SAMPLE} ✅ BOOKED. Free cancellation until 5 Apr (sample terms), which is the brief §6 house rule that got it booked first.`,
  },
  {
    /* ⏳ OPEN — the amber half. Real dates, no reference, the Want: clause
       verbatim, and a search link that is a starting point rather than a
       reservation. Paired with tx00-task-book-bed-lisbon in admin.ts. */
    key: 'lisbon',
    title: '⏳ Lisbon bed — not booked yet',
    city: 'Lisbon',
    checkIn: '2027-04-14',
    /* TRIP_END_EXCLUSIVE. The flight home is at 21:05 on the 16th, so the room
       is genuinely held through the trip's last day — and the coverage model
       walks [checkIn, checkOut), so this is also what stops the final day
       reading as an uncovered night. */
    checkOut: '2027-04-17',
    stopId: STOP_IDS.lisbon,
    status: 'pending',
    priceNote: 'budget €100–120/n · sample, nothing paid',
    searchQuery: 'Lisbon',
    note:
      '⏳ **Not booked.** Want: walkable to a metro station, twin beds, under €120/night, free cancellation, a quiet street. Late checkout on the 16th — the flight is at 21:05.\n\nHouse rules that apply (brief §6): always free-cancellable; never more than fifteen minutes\' walk from a station.',
  },
];

function beds(): HotelBooking[] {
  return BED_SPECS.map((b) => ({
    id: id('bed', b.key),
    tripId: SLUG,
    kind: 'hotel' as const,
    status: b.status,
    title: b.title,
    date: b.checkIn,
    city: b.city,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    stopId: b.stopId,
    ...(b.code ? { code: b.code, codeLabel: 'Sample confirmation' } : {}),
    priceNote: b.priceNote,
    ...(b.searchQuery ? { bookingLinkUrl: search(b.searchQuery) } : {}),
    meta: [],
    note: b.note,
    ...stamps,
  }));
}

export function buildBookings(): Booking[] {
  return [...flights(), ...trains(), ...beds()];
}

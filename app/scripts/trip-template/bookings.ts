/* TRIP TEMPLATE · bookings.ts — where the brief's ✅ / ⏳ markers become data.

   BRIEF SECTION → HERE
     §2 Flights           → flights()
     §5 Ground transport  → legs()
     §3 Beds              → beds()

   ── THE ONE MAPPING THIS WHOLE SYSTEM TURNS ON ──────────────────────────────

     `- ✅ BOOKED — …`   →   status: 'booked'
                             + `code` / `codeLabel` from the confirmation
                             + `priceNote` / `paidMinor` as quoted
                             → the app draws a GREEN "All booked ✓" chip and
                               the reference is readable offline in one tap

     `- ⏳ OPEN — … Want: …  by <date>`
                         →   status: 'pending'   ← A PLACEHOLDER, NOT A GAP
                             + no `code` (there is nothing to write)
                             + `note` carrying the Want: clause verbatim
                             + `bookingLinkUrl` — a plain search, no affiliate
                               tag, no personal parameters
                             + A TASK in admin.ts due on the "by" date
                             → the app draws an AMBER chip

   Why `'pending'` specifically, and why it is amber rather than red:
   `src/lib/logic/coverage.ts:190` turns a stay with `status: 'pending'` into a
   night in state `'pending'`; line 214 rolls that into `CoverState 'pending'`;
   and `toneOf()` at lines 135–146 only ever escalates to `'crit'` when
   something is **missing**, so a pending segment is `'warn'` — amber — and
   stays amber however close the date gets. `coverageStamp()` at line 244 hands
   that straight to the `.chip.warn` class (`src/app.css:136`, `--warn:#e0a34c`).

   A night with NO booking at all is a different thing: `'missing'`, which goes
   red inside the seven-day booking window. That is the state the ⏳ placeholder
   exists to avoid. **Never invent a booking to silence a chip** — an ⏳ OPEN
   line is the honest answer, and `assert.ts` checks you wrote one for every
   night rather than leaving a hole.

   Statuses in full (`src/lib/model/types.ts:241`):
     'booked'    — held. Green.
     'pending'   — ⏳ OPEN. Amber, always.
     'walkin'    — deliberately NOT pre-booking. Counts as covered; green chip,
                   neutral stamp. Use it only when the brief says "walk up".
     'cancelled' — dropped from coverage entirely; the night falls back to
                   'missing'. Keep the record if you want the history. */
import type {
  Booking,
  FlightBooking,
  HotelBooking,
  OtherBooking,
  TrainBooking,
} from '../../src/lib/model/types';
import { SEED_TS, SLUG, STOP_IDS, id } from './base';

const stamps = { createdAt: SEED_TS, updatedAt: SEED_TS };

/** A generic search URL for an ⏳ OPEN bed — no affiliate tag, no account
    parameters, nothing personal. It is a starting point, not a reservation. */
const search = (q: string): string =>
  `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`;

/* ── Brief §2 · Flights ───────────────────────────────────────────────────── */

function flights(): FlightBooking[] {
  return [
    {
      /* ✅ BOOKED — everything the confirmation email said. */
      id: id('flight', 'out'),
      tripId: SLUG,
      kind: 'flight',
      status: 'booked',
      title: 'FILL ME — Carrier · XX 000',
      groupLabel: 'Flights',
      date: '2027-01-04', // departure date, and the card's anchor
      code: 'FILL ME', // the PNR / booking reference — the thing you show
      codeLabel: 'Booking reference',
      meta: [
        { k: 'Seat', v: 'FILL ME' },
        { k: 'Bag', v: 'FILL ME' },
        // { k: 'Terminal', v: '…', warn: true },  ← warn:true tints the chip
      ],
      note: 'FILL ME — anything from the confirmation worth reading at 5am.',
      priceNote: 'FILL ME — €000 pp, as quoted',
      stopId: STOP_IDS.first,
      mapQuery: 'FILL ME — the DEPARTURE airport (the place you must reach)',
      carrier: 'FILL ME',
      flightNo: 'XX 000',
      from: { code: 'AAA', name: 'FILL ME' },
      to: { code: 'BBB', name: 'FILL ME' },
      dep: '00:00',
      arr: '00:00',
      arrDayOffset: 0, // 1 if it lands the next day
      ...stamps,
    },
    {
      /* ⏳ OPEN — nothing bought. No `code`: there is nothing to write down.
         The `note` carries the brief's Want: clause verbatim, because that is
         what you will read when you sit down to actually book it. */
      id: id('flight', 'home'),
      tripId: SLUG,
      kind: 'flight',
      status: 'pending',
      title: 'FILL ME — home, not booked yet',
      groupLabel: 'Flights',
      date: '2027-01-08',
      meta: [{ k: 'Status', v: 'Not booked', warn: true }],
      note: '⏳ **Not booked.** Want: FILL ME — paste the brief\'s Want: clause here, word for word.',
      stopId: STOP_IDS.second,
      carrier: 'FILL ME — or delete this leg entirely',
      flightNo: '—',
      from: { code: 'BBB' },
      to: { code: 'AAA' },
      dep: '00:00',
      arr: '00:00',
      arrDayOffset: 0,
      ...stamps,
    },
  ];
}

/* ── Brief §5 · Ground transport ──────────────────────────────────────────── */

/** Trains keep their own shape because a rail end is not an airport code: it
    can name zero stations (the documents say only "Chongqing"), one, or two
    where the choice is still open. Give `why` wherever `stations` is empty and
    the card says on its face why it has no button. */
function trains(): TrainBooking[] {
  return [
    // {
    //   id: id('train', 'a-b'),
    //   tripId: SLUG,
    //   kind: 'train',
    //   status: 'booked',
    //   title: 'City A → City B',
    //   date: 'YYYY-MM-DD',
    //   code: '…',
    //   codeLabel: 'Booking reference',
    //   meta: [{ k: 'Duration', v: '~2 h' }],
    //   stopId: STOP_IDS.second,
    //   from: { name: 'City A' },
    //   to: { name: 'City B' },
    //   dep: '09:00',
    //   arr: '11:00',
    //   ...stamps,
    // },
  ];
}

/** Buses, ferries, shared cars, transfers — anything that moves you and is
    neither a flight nor a train. Same two ends as a train. */
function others(): OtherBooking[] {
  return [];
}

/* ── Brief §3 · Beds ──────────────────────────────────────────────────────── */

interface BedSpec {
  key: string;
  title: string;
  city: string;
  /** [checkIn, checkOut) — checkOut is the MORNING YOU LEAVE, not the last
      night. The LAST stay of the trip should check out on TRIP_END_EXCLUSIVE:
      the coverage model treats the trip's final calendar day as a day you are
      still there, so a checkout on that same morning leaves it uncovered. */
  checkIn: string;
  checkOut: string;
  stopKey: keyof typeof STOP_IDS;
  status: 'booked' | 'pending' | 'walkin';
  /** ✅ only. The confirmation number, and what to call it on screen. */
  code?: string;
  codeLabel?: string;
  priceNote?: string;
  /** Pasted from the confirmation, in whatever script it arrived in. */
  address?: string;
  /** ⏳ only. What to search when you go shopping — the brief's Want: clause. */
  searchQuery?: string;
  note: string;
}

const BED_SPECS: BedSpec[] = [
  {
    /* ✅ BOOKED */
    key: 'first',
    title: 'FILL ME — property name',
    city: 'FILL ME',
    checkIn: '2027-01-04',
    checkOut: '2027-01-06',
    stopKey: 'first',
    status: 'booked',
    code: 'FILL ME — confirmation number',
    codeLabel: 'Confirmation',
    priceNote: 'FILL ME — €000/night',
    address: 'FILL ME — as the confirmation wrote it, or delete this key',
    note: 'FILL ME — cancellation deadline, breakfast, check-in window.',
  },
  {
    /* ⏳ OPEN — the placeholder that draws the amber chip. It still needs
       real dates: they are what tells the app WHICH nights are unheld. */
    key: 'second',
    title: 'FILL ME — city, not booked yet',
    city: 'FILL ME',
    checkIn: '2027-01-06',
    checkOut: '2027-01-09', // = TRIP_END_EXCLUSIVE for the last stay
    stopKey: 'second',
    status: 'pending',
    priceNote: 'FILL ME — budget per night from the brief',
    searchQuery: 'FILL ME — city name',
    note: '⏳ **Not booked.** Want: FILL ME — the brief\'s Want: clause, word for word, plus any §6 house rule that applies.',
  },
];

function beds(): HotelBooking[] {
  return BED_SPECS.map((b) => ({
    id: id('bed', b.key),
    tripId: SLUG,
    kind: 'hotel' as const,
    status: b.status,
    title: b.title,
    date: b.checkIn, // a stay's anchor date is its check-in
    city: b.city,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    stopId: STOP_IDS[b.stopKey],
    ...(b.code ? { code: b.code, codeLabel: b.codeLabel ?? 'Confirmation' } : {}),
    ...(b.priceNote ? { priceNote: b.priceNote } : {}),
    ...(b.address ? { address: b.address } : {}),
    ...(b.searchQuery ? { bookingLinkUrl: search(b.searchQuery) } : {}),
    meta: [],
    note: b.note,
    ...stamps,
  }));
}

export function buildBookings(): Booking[] {
  return [...flights(), ...trains(), ...others(), ...beds()];
}

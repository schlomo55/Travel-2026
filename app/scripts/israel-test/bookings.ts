/* Five sample transport legs and nine sample beds.

   Every code here is deliberately, visibly fake (TESTAA, SMPL01, TSTBUS,
   SMPL02, TESTZZ) and every note says so. Nothing in this file corresponds to
   a reservation that exists.

   The statuses are chosen to put every rendering path on screen at once:
   one leg already flown, one pending; two pending beds, one walk-in, the rest
   booked — including the Jerusalem bed, so "tonight's bed" resolves on the day
   the owner first imports the trip.

   Beds carry no map fields at all. A search for an invented hotel name would
   open a map on nothing, which is worse than no button — the same reasoning
   that keeps coordinates off the China beds. */
import type { Booking, FlightBooking, HotelBooking, OtherBooking, TrainBooking } from '../../src/lib/model/types';
import { SEED_TS, STOP_IDS, TRIP_ID } from './base';

const SAMPLE_NOTE = 'Sample booking — not a real reservation.';
const CODE_LABEL = 'Sample booking code';
const GROUP = 'Sample transport';

/** A generic search, no affiliate tag and no personal parameters. */
const search = (q: string): string => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`;

const stamps = { createdAt: SEED_TS, updatedAt: SEED_TS };

function flights(): FlightBooking[] {
  return [
    {
      id: 'il26-flight-in',
      tripId: TRIP_ID,
      kind: 'flight',
      status: 'booked',
      title: 'Sample Air · SA 100',
      groupLabel: GROUP,
      date: '2026-07-25',
      code: 'TESTAA',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Seat', v: '14A · sample' },
        { k: 'Bag', v: '1 × 23 kg · sample' },
        { k: 'Terminal', v: '3 · sample' },
      ],
      note: `${SAMPLE_NOTE} This leg is already in the past, so the flown-ticket state is visible the moment the trip is imported.`,
      priceNote: '$310 · sample',
      stopId: STOP_IDS.telaviv,
      mapQuery: 'Charles de Gaulle Airport',
      mapCity: 'Paris',
      carrier: 'Sample Air',
      flightNo: 'SA 100',
      from: { code: 'CDG', name: 'Paris Charles de Gaulle' },
      to: { code: 'TLV', name: 'Tel Aviv Ben Gurion' },
      dep: '10:25',
      arr: '15:40',
      arrDayOffset: 0,
      duration: '4h15',
      aircraft: 'Sample narrowbody',
      ...stamps,
    },
    {
      id: 'il26-flight-eilat',
      tripId: TRIP_ID,
      kind: 'flight',
      status: 'pending',
      title: 'Sample Air · SA 220',
      groupLabel: GROUP,
      date: '2026-08-05',
      code: 'SMPL02',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Seat', v: 'Not assigned · sample' },
        { k: 'Bag', v: '1 × 20 kg · sample', warn: true },
      ],
      note: `${SAMPLE_NOTE} Left **pending** on purpose — an unconfirmed leg sitting eight days out is exactly what the app should be nagging about.`,
      priceNote: '$85 · sample',
      stopId: STOP_IDS.eilat,
      mapQuery: 'Ben Gurion Airport',
      mapCity: 'Tel Aviv',
      carrier: 'Sample Air',
      flightNo: 'SA 220',
      from: { code: 'TLV', name: 'Tel Aviv Ben Gurion' },
      to: { code: 'ETM', name: 'Eilat Ramon' },
      dep: '08:15',
      arr: '09:10',
      arrDayOffset: 0,
      duration: '0h55',
      aircraft: 'Sample narrowbody',
      ...stamps,
    },
    {
      id: 'il26-flight-out',
      tripId: TRIP_ID,
      kind: 'flight',
      status: 'booked',
      title: 'Sample Air · SA 101',
      groupLabel: GROUP,
      date: '2026-09-22',
      code: 'TESTZZ',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Seat', v: '9F · sample' },
        { k: 'Bag', v: '1 × 23 kg · sample' },
        { k: 'Permit', v: 'Sample permit expires 2026-09-23', warn: true },
      ],
      note: `${SAMPLE_NOTE} The exit leg: it flies on the last clean day of the sample 60-day permit, which expires the following day.`,
      alert: true,
      priceNote: '$340 · sample',
      stopId: STOP_IDS.telaviv2,
      mapQuery: 'Ben Gurion Airport',
      mapCity: 'Tel Aviv',
      carrier: 'Sample Air',
      flightNo: 'SA 101',
      from: { code: 'TLV', name: 'Tel Aviv Ben Gurion' },
      to: { code: 'CDG', name: 'Paris Charles de Gaulle' },
      dep: '07:50',
      arr: '11:20',
      arrDayOffset: 0,
      duration: '4h30',
      aircraft: 'Sample narrowbody',
      ...stamps,
    },
  ];
}

function trains(): TrainBooking[] {
  return [
    {
      id: 'il26-train-jer',
      tripId: TRIP_ID,
      kind: 'train',
      status: 'booked',
      title: 'Sample train · Tel Aviv → Jerusalem',
      groupLabel: GROUP,
      date: '2026-07-26',
      code: 'SMPL01',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Duration', v: '~35 min · sample' },
        { k: 'Arrives', v: 'Underground station · sample' },
      ],
      note: `${SAMPLE_NOTE} Bought at the machine on the day in real life; here it is a stand-in so the train card has something to render.`,
      priceNote: '$8 · sample',
      stopId: STOP_IDS.jerusalem,
      from: { name: 'Tel Aviv' },
      to: { name: 'Jerusalem' },
      dep: '11:12',
      arr: '11:47',
      trainNo: 'S-100',
      ...stamps,
    },
  ];
}

function others(): OtherBooking[] {
  return [
    {
      id: 'il26-other-negev',
      tripId: TRIP_ID,
      kind: 'other',
      status: 'booked',
      title: 'Sample coach · Jerusalem → Mitzpe Ramon',
      groupLabel: GROUP,
      date: '2026-07-29',
      code: 'TSTBUS',
      codeLabel: CODE_LABEL,
      meta: [
        { k: 'Departs', v: '09:05 · sample' },
        { k: 'Change', v: 'One, en route · sample', warn: true },
        { k: 'Duration', v: '~3h · sample' },
      ],
      note: `${SAMPLE_NOTE} The desert transfer: the crit runbook fires on this date, so this card gets the TODAY treatment on the day it matters.`,
      priceNote: '$14 · sample',
      stopId: STOP_IDS.negev,
      mapQuery: 'Jerusalem Central Bus Station',
      mapCity: 'Jerusalem',
      ...stamps,
    },
  ];
}

interface BedSpec {
  id: string;
  title: string;
  city: string;
  checkIn: string;
  checkOut: string;
  stopId: string;
  status: 'booked' | 'pending' | 'walkin';
  priceNote: string;
  note: string;
  searchQuery?: string;
}

const BEDS: BedSpec[] = [
  {
    id: 'il26-hotel-telaviv',
    title: 'Sample beach hotel, Tel Aviv',
    city: 'Tel Aviv',
    checkIn: '2026-07-25',
    checkOut: '2026-07-26',
    stopId: STOP_IDS.telaviv,
    status: 'booked',
    priceNote: '$95–140/n · sample',
    note: 'One night, landing day. Sample booking — not a real reservation.',
  },
  {
    id: 'il26-hotel-jerusalem',
    title: 'Sample guest house, Jerusalem',
    city: 'Jerusalem',
    checkIn: '2026-07-26',
    checkOut: '2026-07-29',
    stopId: STOP_IDS.jerusalem,
    status: 'booked',
    priceNote: '$70–110/n · sample',
    note: 'Booked, so tonight\'s bed resolves on the day this trip is first imported. Sample booking — not a real reservation.',
  },
  {
    id: 'il26-hotel-negev',
    title: 'Sample desert lodge, Mitzpe Ramon',
    city: 'Mitzpe Ramon',
    checkIn: '2026-07-29',
    checkOut: '2026-08-05',
    stopId: STOP_IDS.negev,
    status: 'pending',
    priceNote: '$60–90/n · sample',
    note: 'Left pending for a whole week on purpose — this is what an unbooked block looks like. Sample booking — not a real reservation.',
    searchQuery: 'Mitzpe Ramon',
  },
  {
    id: 'il26-hotel-eilat',
    title: 'Sample reef hotel, Eilat',
    city: 'Eilat',
    checkIn: '2026-08-05',
    checkOut: '2026-08-12',
    stopId: STOP_IDS.eilat,
    status: 'pending',
    priceNote: '$110–160/n · sample',
    note: 'Pending. Confirm air conditioning before confirming anything else. Sample booking — not a real reservation.',
    searchQuery: 'Eilat',
  },
  {
    id: 'il26-hotel-deadsea',
    title: 'Sample spa hotel, Ein Bokek',
    city: 'Ein Bokek',
    checkIn: '2026-08-12',
    checkOut: '2026-08-16',
    stopId: STOP_IDS.deadsea,
    status: 'booked',
    priceNote: '$130–180/n · sample',
    note: 'Four nights on the Ein Bokek strip. Sample booking — not a real reservation.',
  },
  {
    id: 'il26-hotel-galilee',
    title: 'Sample kibbutz guest house',
    city: 'Rosh Pina',
    checkIn: '2026-08-16',
    checkOut: '2026-08-31',
    stopId: STOP_IDS.galilee,
    status: 'booked',
    priceNote: '$55–80/n · sample',
    note: 'Fifteen nights in one bed — the cheapest and least tiring block of the sample trip. Sample booking — not a real reservation.',
  },
  {
    id: 'il26-hotel-haifa',
    title: 'Sample port apartment, Haifa',
    city: 'Haifa',
    checkIn: '2026-08-31',
    checkOut: '2026-09-10',
    stopId: STOP_IDS.haifa,
    status: 'pending',
    priceNote: '$75–105/n · sample',
    note: 'Pending, ten nights, in September. The second unbooked bed. Sample booking — not a real reservation.',
    searchQuery: 'Haifa',
  },
  {
    id: 'il26-hotel-telaviv2',
    title: 'Sample city flat, Tel Aviv',
    city: 'Tel Aviv',
    checkIn: '2026-09-10',
    checkOut: '2026-09-20',
    stopId: STOP_IDS.telaviv2,
    status: 'booked',
    priceNote: '$120–170/n · sample',
    note: 'Ten nights, the reward block. Sample booking — not a real reservation.',
  },
  {
    id: 'il26-hotel-airport',
    title: 'Sample airport hotel',
    city: 'Lod',
    checkIn: '2026-09-20',
    checkOut: '2026-09-23',
    stopId: STOP_IDS.telaviv2,
    status: 'walkin',
    priceNote: '$90/n · sample',
    note: 'A **walk-in**: no reservation at all, two nights before an international flight. Deliberately left this way so the walk-in state is on screen. Sample booking — not a real reservation.',
  },
];

function beds(): HotelBooking[] {
  return BEDS.map((b) => ({
    id: b.id,
    tripId: TRIP_ID,
    kind: 'hotel' as const,
    status: b.status,
    title: b.title,
    date: b.checkIn,
    city: b.city,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    stopId: b.stopId,
    priceNote: b.priceNote,
    ...(b.searchQuery ? { bookingLinkUrl: search(b.searchQuery) } : {}),
    meta: [],
    note: b.note,
    ...stamps,
  }));
}

export function buildBookings(): Booking[] {
  return [...flights(), ...trains(), ...others(), ...beds()];
}

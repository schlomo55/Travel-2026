/* Show cards (the driver cards), emergency contacts and info cards.

   The Hebrew here is general knowledge — place names and everyday phrases, the
   same class of content as the China `vfy` cards — so every place card carries
   `verify: true` and the app is expected to say so on screen.

   Coordinates appear on exactly the two cards that ARE one of the towns whose
   city-grade coordinate this trip already carries. Everything else opens by
   name. Nothing is invented to fill a field. */
import type { EmergencyContact, InfoCard, ShowCard } from '../../src/lib/model/types';
import { STOP_COORDS, TRIP_ID } from './base';

interface PhraseSpec {
  key: string;
  native: string;
  meaning: string;
  note?: string;
  isKey?: boolean;
  pending?: boolean;
}

const PHRASES: PhraseSpec[] = [
  {
    key: 'takeme',
    native: 'קח אותי לכאן בבקשה',
    meaning: 'Please take me here',
    note: 'The key phrase. It is appended under every place card in the driver overlay — this trip\'s own suffix, not the Chinese one.',
    isKey: true,
  },
  { key: 'thanks', native: 'תודה רבה', meaning: 'Thank you very much' },
  { key: 'howmuch', native: 'כמה זה עולה?', meaning: 'How much does this cost?' },
  { key: 'bill', native: 'החשבון בבקשה', meaning: 'The bill, please' },
  {
    key: 'pending',
    native: '⏳ sample pending',
    meaning: 'A card deliberately left unresolved',
    note: 'Here only so the pending rendering path is on screen. There is nothing to look up — it is a test trip.',
    pending: true,
  },
];

interface PlaceSpec {
  key: string;
  native: string;
  meaning: string;
  mapQuery: string;
  mapCity?: string;
  coord?: { lat: number; lng: number };
  note?: string;
}

const PLACES: PlaceSpec[] = [
  {
    key: 'airport',
    native: 'נמל תעופה בן גוריון',
    meaning: 'Ben Gurion Airport',
    mapQuery: 'Ben Gurion Airport',
    mapCity: 'Tel Aviv',
    note: 'The card for both ends of the sample trip — the landing and the exit.',
  },
  {
    key: 'machaneyehuda',
    native: 'שוק מחנה יהודה',
    meaning: 'Machane Yehuda market, Jerusalem',
    mapQuery: 'Machane Yehuda Market',
    mapCity: 'Jerusalem',
  },
  {
    key: 'kotel',
    native: 'הכותל המערבי',
    meaning: 'The Western Wall, Jerusalem',
    mapQuery: 'Western Wall',
    mapCity: 'Jerusalem',
  },
  {
    key: 'makhtesh',
    native: 'מכתש רמון',
    meaning: 'The Ramon crater, at Mitzpe Ramon',
    mapQuery: 'Makhtesh Ramon',
    mapCity: 'Mitzpe Ramon',
  },
  {
    key: 'einbokek',
    native: 'עין בוקק',
    meaning: 'Ein Bokek, the Dead Sea hotel strip',
    mapQuery: 'Ein Bokek',
    coord: STOP_COORDS.deadsea,
  },
  {
    key: 'roshpina',
    native: 'ראש פינה',
    meaning: 'Rosh Pina, Upper Galilee',
    mapQuery: 'Rosh Pina',
    coord: STOP_COORDS.galilee,
  },
  {
    key: 'haifaport',
    native: 'נמל חיפה',
    meaning: 'Haifa port',
    mapQuery: 'Haifa Port',
    mapCity: 'Haifa',
  },
  {
    key: 'telavivport',
    native: 'נמל תל אביב',
    meaning: 'Tel Aviv port',
    mapQuery: 'Tel Aviv Port',
    mapCity: 'Tel Aviv',
  },
];

export function buildShowCards(): ShowCard[] {
  const phrases: ShowCard[] = PHRASES.map((p, i) => ({
    id: `il26-phrase-${p.key}`,
    tripId: TRIP_ID,
    kind: 'phrase' as const,
    native: p.native,
    meaning: p.meaning,
    ...(p.note ? { note: p.note } : {}),
    verify: false,
    pending: !!p.pending,
    isKey: !!p.isKey,
    order: i + 1,
  }));
  const places: ShowCard[] = PLACES.map((p, i) => ({
    id: `il26-place-${p.key}`,
    tripId: TRIP_ID,
    kind: 'place' as const,
    native: p.native,
    meaning: p.meaning,
    ...(p.note ? { note: p.note } : {}),
    ...(p.coord ? { coord: p.coord } : {}),
    mapQuery: p.mapQuery,
    ...(p.mapCity ? { mapCity: p.mapCity } : {}),
    verify: true, // general knowledge, not a trip document — the app says so
    pending: false,
    isKey: false,
    order: 101 + i,
  }));
  return [...phrases, ...places];
}

export function buildEmergency(): EmergencyContact[] {
  return [
    { id: 'il26-emg-police', label: 'Police', value: '100', kind: 'phone' as const, verify: true, pending: false },
    {
      id: 'il26-emg-ambulance',
      label: 'Ambulance — Magen David Adom',
      value: '101',
      kind: 'phone' as const,
      verify: true,
      pending: false,
    },
    { id: 'il26-emg-fire', label: 'Fire and rescue', value: '102', kind: 'phone' as const, verify: true, pending: false },
    {
      id: 'il26-emg-homefront',
      label: 'Home Front Command',
      value: '104',
      kind: 'phone' as const,
      verify: true,
      pending: false,
    },
    {
      id: 'il26-emg-insurance',
      label: 'Sample insurance line',
      value: '⏳ sample — no real number',
      kind: 'text' as const,
      verify: false,
      pending: true,
    },
  ].map((e, i) => ({ ...e, tripId: TRIP_ID, order: i + 1 }));
}

export function buildInfoCards(): InfoCard[] {
  const cards: Omit<InfoCard, 'tripId' | 'order'>[] = [
    {
      id: 'il26-info-what',
      emoji: '🧪',
      heading: 'What this trip is',
      items: [
        '🧪 This is a sample trip. Every code, price and booking here is invented so you can rehearse the app with real passing time. Delete it from the shelf whenever you like — the China trip is untouched.',
        'Nothing in it is personal data: no passport, no booking reference, no real hotel, no real phone number except the public emergency lines.',
        'The dates are chosen so things actually happen: a permit clock that ticks today, an overdue task, a crit runbook a few days out, and a fortnight of default days in the middle.',
      ],
      severity: 'normal',
    },
    {
      id: 'il26-info-permit',
      emoji: '🛂',
      heading: 'The sample permit clock',
      items: [
        '**Sample 60-day permit.** Starts 2026-07-25; the count begins the day AFTER, so 2026-07-26 is day 1.',
        '**Sample hard deadline: 2026-09-23.** The planned exit is 2026-09-22 — day 59, a one-day buffer, exactly like the real thing.',
        'This is not a real permit and it has no legal meaning whatsoever. It exists so the pinned counter in the app bar has something to count.',
        'When the China visa clock does this for real, it will look and behave identically.',
      ],
      severity: 'crit',
    },
    {
      id: 'il26-info-heat',
      emoji: '🌡',
      heading: 'Summer heat — the shape of every day',
      items: [
        'August in the south runs past forty degrees. The Dead Sea block is the worst of it, at four hundred metres below sea level.',
        '**Nothing outdoors between 11:00 and 16:00.** Every day plan in this trip is built around that, not around opening hours.',
        'The Negev sits at nine hundred metres, which is the only reason a desert week in August works at all — and it is genuinely cold there after dark.',
        'September on the coast is a different trip. The last two blocks are where the afternoons come back.',
      ],
      severity: 'normal',
    },
    {
      id: 'il26-info-shabbat',
      emoji: '🕯',
      heading: 'Shabbat — plan around it, not into it',
      items: [
        'From Friday afternoon until Saturday night most shops shut and intercity buses stop. Trains stop too.',
        '**Shop on Friday morning.** Every Friday day plan in this trip says so, and the Galilee default day for Saturdays says what to do instead.',
        'Haifa is the exception: buses and the underground funicular run there on Saturdays.',
        'Restaurants in Tel Aviv largely stay open. Almost everywhere else, assume closed.',
      ],
      severity: 'normal',
    },
    {
      id: 'il26-info-water',
      emoji: '💧',
      heading: 'Water and sun',
      items: [
        '**Three litres per person per day in the desert**, and that is the floor. Four on any day with a walk in it.',
        'Electrolytes, not just water — sweating that hard flushes the salt out with it.',
        'Wide brim, long light sleeves, sunglasses. A cap covers nothing that matters.',
        'Tap water is drinkable everywhere on this trip. Refill rather than buy.',
      ],
      severity: 'normal',
    },
    {
      id: 'il26-info-money',
      emoji: '💳',
      heading: 'Money — sample figures only',
      items: [
        'Home currency is USD. The trip also carries ILS at a sample rate of 3.4 and EUR at 0.92 — **rounded stand-ins, not today\'s rates.**',
        'The $3,000 budget and the six category plans are invented to make the tracker render something honest-looking.',
        'Three sample expenses are pre-loaded in the first two days so the chips and the daily bars are not empty.',
        'Cards work almost everywhere in the real country; small cash helps on buses and in markets.',
      ],
      severity: 'normal',
    },
  ];
  return cards.map((c, i) => ({ ...c, tripId: TRIP_ID, order: i + 1 }));
}

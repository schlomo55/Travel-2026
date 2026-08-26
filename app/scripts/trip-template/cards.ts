/* TRIP TEMPLATE · cards.ts — show cards (the "hold this up" screen), emergency
   contacts and info cards.

   BRIEF SECTION → HERE
     §7 Language cards → buildShowCards()
     §7 Emergency      → buildEmergency()
     §4 Notes / §6     → buildInfoCards()

   TWO FLAGS DECIDE HOW HONEST THE SCREEN IS.

     `verify: true`  — this line came from general knowledge rather than from a
                       document the traveller holds. The app says so on the
                       card. Set it on anything you did not read off a source.
     `pending: true` — there is nothing to look up yet. The card renders as the
                       ⏳ it is instead of pretending.

   Between them there is no reason to ever invent a phone number or an address
   to fill a field. A card with nothing verified is a card that says so. */
import type { EmergencyContact, InfoCard, ShowCard } from '../../src/lib/model/types';
import { SLUG, id } from './base';

interface PhraseSpec {
  key: string;
  native: string;
  meaning: string;
  note?: string;
  /** The "please take me here" suffix, appended under every place card. */
  isKey?: boolean;
  pending?: boolean;
}

const PHRASES: PhraseSpec[] = [
  {
    key: 'takeme',
    native: 'FILL ME — in the local script',
    meaning: 'Please take me here',
    isKey: true,
  },
  // { key: 'thanks',  native: '…', meaning: 'Thank you' },
  // { key: 'howmuch', native: '…', meaning: 'How much is this?' },
];

interface PlaceSpec {
  key: string;
  /** The big text a driver reads — the place name in the LOCAL script. */
  native: string;
  meaning: string;
  mapQuery: string;
  mapCity?: string;
  coord?: { lat: number; lng: number };
  /** Full-screen under the name in the driver overlay. Local script. */
  address?: string;
  note?: string;
}

const PLACES: PlaceSpec[] = [
  // {
  //   key: 'station',
  //   native: '…',
  //   meaning: 'Central station',
  //   mapQuery: 'Central Station',
  //   mapCity: 'City',
  // },
];

export function buildShowCards(): ShowCard[] {
  const phrases: ShowCard[] = PHRASES.map((p, i) => ({
    id: id('phrase', p.key),
    tripId: SLUG,
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
    id: id('place', p.key),
    tripId: SLUG,
    kind: 'place' as const,
    native: p.native,
    meaning: p.meaning,
    ...(p.note ? { note: p.note } : {}),
    ...(p.coord ? { coord: p.coord } : {}),
    mapQuery: p.mapQuery,
    ...(p.mapCity ? { mapCity: p.mapCity } : {}),
    ...(p.address ? { address: p.address } : {}),
    verify: true, // general knowledge unless it came off a booking document
    pending: false,
    isKey: false,
    order: 101 + i,
  }));
  return [...phrases, ...places];
}

/** Brief §7. Public emergency numbers are safe to carry and are worth more
    offline than anywhere else. Your insurer's line goes here too — mark it
    `pending: true` until the policy exists. */
export function buildEmergency(): EmergencyContact[] {
  return [
    { id: id('emg', 'police'), label: 'FILL ME — Police', value: '000', kind: 'phone' as const, verify: true, pending: false },
    { id: id('emg', 'ambulance'), label: 'FILL ME — Ambulance', value: '000', kind: 'phone' as const, verify: true, pending: false },
    { id: id('emg', 'insurance'), label: 'Insurance emergency line', value: '⏳ not bought yet', kind: 'text' as const, verify: false, pending: true },
  ].map((e, i) => ({ ...e, tripId: SLUG, order: i + 1 }));
}

/** The standing facts that are not tied to a day: money, health, customs, the
    thing everyone gets wrong. `severity: 'crit'` is for the one or two that
    cost real money or a flight if ignored. */
export function buildInfoCards(): InfoCard[] {
  const cards: Omit<InfoCard, 'tripId' | 'order'>[] = [
    {
      id: id('info', 'money'),
      emoji: '💳',
      heading: 'FILL ME — Money',
      items: [
        'FILL ME — cards vs cash, what the rate in this trip is and that it is a written-down number, not a live one.',
      ],
      severity: 'normal',
    },
    {
      id: id('info', 'open'),
      emoji: '⏳',
      heading: 'What is still open',
      items: [
        'FILL ME — list every ⏳ OPEN item and its deadline, so the state of the trip is readable in one card.',
        'Each of them is an amber chip in the itinerary and a dated task in the to-do list.',
      ],
      severity: 'normal',
    },
  ];
  return cards.map((c, i) => ({ ...c, tripId: SLUG, order: i + 1 }));
}

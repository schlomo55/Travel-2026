/* 🧪 TEMPLATE EXAMPLE · cards.ts — brief §7 and the standing facts.

   The Portuguese here is general knowledge — everyday phrases and public place
   names — so every place card carries `verify: true` and the app is expected to
   say so on screen. The only real numbers in the whole trip are the public
   emergency lines, which are worth more offline than anywhere else. */
import type { EmergencyContact, InfoCard, ShowCard } from '../../../src/lib/model/types';
import { SLUG, STOP_COORDS, id } from './base';

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
    native: 'Leve-me aqui, por favor',
    meaning: 'Please take me here',
    note: 'The key phrase — appended under every place card in the driver overlay.',
    isKey: true,
  },
  { key: 'thanks', native: 'Muito obrigado', meaning: 'Thank you very much' },
  { key: 'howmuch', native: 'Quanto custa?', meaning: 'How much does this cost?' },
  {
    key: 'pending',
    native: '⏳ sample pending',
    meaning: 'A card deliberately left unresolved',
    note: 'Here only so the pending rendering path is on screen. There is nothing to look up — it is a sample trip.',
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
}

const PLACES: PlaceSpec[] = [
  { key: 'porto', native: 'Porto', meaning: 'Porto city centre', mapQuery: 'Porto', coord: STOP_COORDS.porto },
  { key: 'lisbon', native: 'Lisboa', meaning: 'Lisbon city centre', mapQuery: 'Lisbon', coord: STOP_COORDS.lisbon },
  { key: 'belem', native: 'Torre de Belém', meaning: 'The Belém tower, Lisbon', mapQuery: 'Torre de Belém', mapCity: 'Lisbon' },
  { key: 'comercio', native: 'Praça do Comércio', meaning: 'The riverside square, Lisbon', mapQuery: 'Praça do Comércio', mapCity: 'Lisbon' },
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
    { id: id('emg', 'eu'), label: 'Emergency (all services)', value: '112', kind: 'phone' as const, verify: true, pending: false },
    {
      id: id('emg', 'insurance'),
      label: 'Sample insurance line',
      value: '⏳ sample — no real number',
      kind: 'text' as const,
      verify: false,
      pending: true,
    },
  ].map((e, i) => ({ ...e, tripId: SLUG, order: i + 1 }));
}

export function buildInfoCards(): InfoCard[] {
  const cards: Omit<InfoCard, 'tripId' | 'order'>[] = [
    {
      id: id('info', 'what'),
      emoji: '🧪',
      heading: 'What this trip is',
      items: [
        '🧪 A **worked example**, compiled from `docs/examples/porto-lisbon-mini.brief.md` by the scaffold in `app/scripts/trip-template/`. Every reference, price and property is invented.',
        'It exists to put one contrast on screen: **Porto green, Lisbon amber.** Delete it from the shelf whenever you like — every id starts with `tx00-`, so it cannot reach another trip.',
        'Nothing in it is personal data: no passport, no real booking reference, no real property, and no phone number except the public 112.',
      ],
      severity: 'normal',
    },
    {
      id: id('info', 'open'),
      emoji: '⏳',
      heading: 'What is still open',
      items: [
        '**The Lisbon bed, 14–17 Apr.** Want: walkable to a metro station, twin beds, under €120/night, free cancellation, a quiet street. **Book by 1 Mar 2027.**',
        'It shows up in three places at once: an amber chip on the Lisbon segment, a dated task in the to-do list, and a card in the wallet-side view of the booking itself.',
        'Amber is not a warning that something went wrong. It is the trip saying, accurately, that these nights are known about and not bought. A night with nothing against it at all would be red — and the build refuses to produce one.',
      ],
      severity: 'normal',
    },
    {
      id: id('info', 'money'),
      emoji: '💳',
      heading: 'Money — sample figures only',
      items: [
        'Home currency is EUR and the destination uses it too, so there is no conversion to get wrong on this trip.',
        'The €900 budget and its four category plans are invented, and they add up exactly — the build checks the arithmetic.',
        'No expenses are pre-loaded. Nothing has been spent on a trip that has not happened.',
      ],
      severity: 'normal',
    },
  ];
  return cards.map((c, i) => ({ ...c, tripId: SLUG, order: i + 1 }));
}

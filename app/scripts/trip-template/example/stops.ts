/* 🧪 TEMPLATE EXAMPLE · stops.ts — brief §4, Cities & wishes.

   Two stops, abutting exactly: Porto's `end` is Lisbon's `start`, and Lisbon's
   `end` is TRIP_END_EXCLUSIVE so the final day still resolves to a stop.

   The places named are real and public; every price, property and reference is
   invented and labelled `sample`. */
import type { ContentBlock, Spot, Stop } from '../../../src/lib/model/types';
import { SLUG, STOP_COORDS, STOP_IDS, TRIP_END_EXCLUSIVE, BEDS, type StopKey } from './base';

interface StopSpec {
  key: StopKey;
  name: string;
  emoji: string;
  hue: number;
  start: string;
  end: string;
  nights: number;
  whenLabel: string;
  costNote: string;
  mapQuery: string;
  detail: string;
  blocks: { heading: string; items?: string[]; dayRows?: { label: string; text: string }[] }[];
  reco: { heading: string; items: string[] }[];
  spots?: Omit<Spot, 'id'>[];
}

const SPECS: StopSpec[] = [
  {
    key: 'porto',
    name: 'Porto',
    emoji: '🍷',
    hue: 268,
    start: '2027-04-12',
    end: '2027-04-14',
    nights: 2,
    whenLabel: 'Mon 12 Apr → Wed 14 Apr',
    costNote: '≈€230 · sample',
    mapQuery: 'Porto',
    detail:
      'Two nights, and the brief asked for a slow start: land at lunchtime, put the bag down, and walk downhill to the river without a plan more elaborate than that.\n\nThe bed here is **booked** (sample reference), so the Porto segment reads green in the itinerary from the moment this trip is imported. That is the whole point of the pair: Porto is what a settled leg looks like, and Lisbon is what an open one looks like, on the same screen.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample Air **SA 410**, Paris → Porto, landing early afternoon. Sample booking — not a real reservation.',
          'The metro runs from the airport into the centre in about half an hour. Buy at the machine.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '✅ **Sample river guesthouse, Porto** — two nights, €95/n · sample. Booked, free cancellation until 5 Apr (sample terms).',
          'Brief §6 house rule: everything free-cancellable. This one is, which is why it got booked first.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Mon 12 Apr', text: 'Land, metro in, drop the bag, walk down to the river. Nothing else.' },
          { label: 'Tue 13 Apr', text: 'A whole free day — no explicit plan, so the app falls through to the Porto default day.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'The city is built on a hill and every map underestimates it. Whatever the walk says it takes, add half again.',
          'Brief §4 Skip: no port-cellar tour. It was decided against before the trip, so nobody needs to re-suggest it.',
        ],
      },
    ],
    reco: [
      {
        heading: 'If you do one thing',
        items: ['Cross the upper deck of the Dom Luís I bridge on foot at sunset and walk back along the far bank.'],
      },
    ],
  },
  {
    key: 'lisbon',
    name: 'Lisbon',
    emoji: '⏳',
    hue: 40,
    start: '2027-04-14',
    end: TRIP_END_EXCLUSIVE,
    nights: 3,
    whenLabel: 'Wed 14 Apr → Fri 16 Apr',
    costNote: '≈€300 · sample, budgeted not booked',
    mapQuery: 'Lisbon',
    detail:
      'Three nights and **no bed booked**. That is deliberate: the brief left it ⏳ OPEN with a shopping brief attached, so the trip carries a placeholder rather than a hole, and the app draws this segment amber instead of pretending it is fine.\n\nAmber is not an error. It means "known about, not bought yet". The night that would be an error is one with nothing against it at all, and there is no such night in this trip — assert.ts refuses to write the file if there is.\n\nWhen the room is booked for real, the confirmation goes back into the brief, the seed is rebuilt, and this chip turns green.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample train Porto → Lisbon, roughly three hours. Sample booking — not a real reservation, but **booked**, so the move itself is not what makes this segment amber.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '⏳ **Not booked.** Want: walkable to a metro station, twin beds, under €120/night, free cancellation, a quiet street. Book by **1 Mar 2027**.',
          'Until it is booked this segment carries an amber coverage chip and a dated task. Both disappear the moment a real confirmation is pasted into the brief and the seed is rebuilt.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Wed 14 Apr', text: 'Train down, drop the bag wherever the bed ends up, walk the Baixa grid.' },
          { label: 'Thu 15 Apr', text: 'Belém in the morning, back along the water in the afternoon.' },
          { label: 'Fri 16 Apr', text: 'Sample flight home in the evening; the room is held until then.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'Brief §6 house rule: nothing more than fifteen minutes\' walk from a metro station. It is in the task detail too, so it is in front of you at the moment you actually book.',
          'The hills here are the same argument as Porto\'s, with trams as the excuse not to walk them.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The riverside walk out to Belém, done westward in the morning light rather than back into it.',
          'Praça do Comércio at the blue hour, when the arch is lit and the square empties.',
        ],
      },
    ],
    /* Brief §4 "Must do", as the two places the day plan can actually open on
       a map. Named the way a map answers, not the way a person says it. */
    spots: [
      {
        name: 'Torre de Belém',
        kind: 'sight',
        mapQuery: 'Torre de Belém',
        mapCity: 'Lisbon',
        verify: true, // general knowledge, not a trip document — the app says so
      },
      {
        name: 'Praça do Comércio',
        kind: 'sight',
        mapQuery: 'Praça do Comércio',
        mapCity: 'Lisbon',
        verify: true,
      },
    ],
  },
];

function toBlocks(stopId: string, prefix: string, src: StopSpec['blocks']): ContentBlock[] {
  return src.map((b, i) => ({
    id: `${stopId}-${prefix}${i}`,
    heading: b.heading,
    items: b.items ?? [],
    ...(b.dayRows ? { dayRows: b.dayRows } : {}),
  }));
}

/** The spot ids the day plans link to, derived from the same rule as buildStops. */
export const SPOT_IDS = {
  belem: `${STOP_IDS.lisbon}-spot0`,
  comercio: `${STOP_IDS.lisbon}-spot1`,
} as const;

export function buildStops(): Stop[] {
  return SPECS.map((s, i) => {
    const stopId = STOP_IDS[s.key];
    const spots: Spot[] = (s.spots ?? []).map((sp, si) => ({ id: `${stopId}-spot${si}`, ...sp }));
    return {
      id: stopId,
      tripId: SLUG,
      kind: 'stop' as const,
      name: s.name,
      emoji: s.emoji,
      hue: s.hue,
      start: s.start,
      end: s.end,
      nights: s.nights,
      whenLabel: s.whenLabel,
      costNote: s.costNote,
      detail: s.detail,
      coord: STOP_COORDS[s.key],
      mapQuery: s.mapQuery,
      blocks: toBlocks(stopId, 'b', s.blocks),
      recoBlocks: toBlocks(stopId, 'r', s.reco),
      ...(spots.length ? { spots } : {}),
      order: i + 1,
    };
  });
}

/** Which stop covers a date, under the same [start, end) rule the app uses. */
export function stopKeyFor(date: string): StopKey {
  for (const s of SPECS) if (date >= s.start && date < s.end) return s.key;
  throw new Error(`no stop covers ${date}`);
}

/** The bed label a day inside a stop inherits. */
export function bedFor(date: string): { bedEmoji: string; bedLabel: string } {
  const b = BEDS[stopKeyFor(date)];
  return { bedEmoji: b.emoji, bedLabel: b.label };
}

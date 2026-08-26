/* TRIP TEMPLATE · stops.ts — one stop per city you sleep in.

   BRIEF SECTION → HERE
     §4 Cities & wishes → one SPECS entry per `### City` block
     §4 Nights          → `start` / `end` / `nights`
     §4 Interests       → `detail` (the long read-more prose)
     §4 Must do         → `reco` blocks, and `spots` for the ones that open in
                          a map
     §4 Skip / Notes    → a `Tips` block, in the brief's own words

   OCCUPANCY IS [start, end). Each stop's `end` is the NEXT one's `start`, and
   the last stop's `end` is TRIP_END_EXCLUSIVE — one day past the trip — so the
   final trip day still resolves to a stop. `assert.ts` refuses anything else.

   NEVER INVENT A FACT HERE. Opening hours, prices and addresses go in only if
   the brief carried them or a source was checked. A spot whose name could not
   be verified is simply left out: the app draws one fewer chip, never a chip
   that opens the wrong place. */
import type { ContentBlock, Spot, Stop } from '../../src/lib/model/types';
import { BEDS, SLUG, STOP_COORDS, STOP_IDS, TRIP_END_EXCLUSIVE, type StopKey } from './base';

interface StopSpec {
  key: StopKey;
  name: string;
  emoji: string;
  /** 0–360. A per-city tint; keep the cities distinguishable from each other. */
  hue: number;
  start: string;
  end: string;
  nights: number;
  /** "Mon 4 Jan → Wed 6 Jan" — written out, because a date range read at a
      glance is worth more than one computed from the fields above. */
  whenLabel: string;
  /** Free text from the brief: "≈€240" or "$20–30/n". Never a computed total. */
  costNote?: string;
  mapQuery?: string;
  detail: string;
  blocks: { heading: string; items?: string[]; dayRows?: { label: string; text: string }[] }[];
  reco: { heading: string; items: string[] }[];
  /** Named places from §4 "Must do" that a map can actually open. */
  spots?: Omit<Spot, 'id'>[];
}

const SPECS: StopSpec[] = [
  {
    key: 'first',
    name: 'FILL ME — first city',
    emoji: '🏙',
    hue: 210,
    start: '2027-01-04',
    end: '2027-01-06',
    nights: 2,
    whenLabel: 'FILL ME — Mon 4 Jan → Wed 6 Jan',
    costNote: 'FILL ME — or delete',
    mapQuery: 'FILL ME — the city name a map answers to',
    detail:
      'FILL ME. Two or three paragraphs of the brief\'s §4 Interests turned into prose: what this stop is FOR, what shape the days take, and what has already been decided against. This is the "read more" text on the stop card.',
    blocks: [
      {
        heading: 'Getting there',
        items: ['FILL ME — the leg that lands you here, in one line, and the fallback if it fails.'],
      },
      {
        heading: 'Sleep',
        items: ['FILL ME — the bed from brief §3, with its ✅ / ⏳ state said out loud.'],
      },
      {
        heading: 'Day by day',
        dayRows: [{ label: 'FILL ME — Mon 4 Jan', text: 'FILL ME — one sentence.' }],
      },
      {
        heading: 'Tips',
        items: ['FILL ME — brief §4 Skip and Notes: closing days, dress codes, what not to bother with.'],
      },
    ],
    reco: [
      {
        heading: 'If you do one thing',
        items: ['FILL ME — the single line from §4 Must do that survives a bad day.'],
      },
    ],
    // spots: [
    //   {
    //     name: 'Verified place name',
    //     kind: 'sight',
    //     coord: { lat: 0, lng: 0 },
    //     mapQuery: 'Verified place name',
    //     mapCity: 'City',
    //     verify: true, // true = this came from general knowledge, not a document
    //   },
    // ],
  },
  {
    key: 'second',
    name: 'FILL ME — second city',
    emoji: '🌆',
    hue: 30,
    start: '2027-01-06',
    end: TRIP_END_EXCLUSIVE, // the LAST stop always ends here
    nights: 3,
    whenLabel: 'FILL ME — Wed 6 Jan → Fri 8 Jan',
    detail: 'FILL ME.',
    blocks: [{ heading: 'Sleep', items: ['FILL ME.'] }],
    reco: [],
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

export function buildStops(photoDocIds: Partial<Record<StopKey, string>> = {}): Stop[] {
  return SPECS.map((s, i) => {
    const stopId = STOP_IDS[s.key];
    const photo = photoDocIds[s.key];
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
      ...(s.costNote ? { costNote: s.costNote } : {}),
      ...(photo ? { photoDocId: photo } : {}),
      detail: s.detail,
      coord: STOP_COORDS[s.key],
      ...(s.mapQuery ? { mapQuery: s.mapQuery } : {}),
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
  throw new Error(`no stop covers ${date} — check the SPECS windows against TRIP_START/TRIP_END`);
}

/** The bed label a day inside a stop inherits. Written once in base.ts. */
export function bedFor(date: string): { bedEmoji: string; bedLabel: string } {
  const b = BEDS[stopKeyFor(date)];
  return { bedEmoji: b.emoji, bedLabel: b.label };
}

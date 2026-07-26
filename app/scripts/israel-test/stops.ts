/* The eight stops of the sample trip.

   Occupancy is [start, end), so each stop's `end` is the next one's `start` and
   the last one ends 2026-09-23 — one day past the trip, so the final trip day
   still resolves to a stop.

   Every price, every hotel and every "sample" line here is invented. Where a
   real public place is named (Machane Yehuda, Masada, the Ramon crater) it is
   only itinerary flavour: no opening hours, no fares, nothing that would need
   verifying before the owner relied on it. */
import type { ContentBlock, Stop } from '../../src/lib/model/types';
import { BEDS, STOP_COORDS, STOP_IDS, TRIP_END_EXCLUSIVE, TRIP_ID, type StopKey } from './base';

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
}

const SPECS: StopSpec[] = [
  {
    key: 'telaviv',
    name: 'Tel Aviv — landing',
    emoji: '🌊',
    hue: 195,
    start: '2026-07-25',
    end: '2026-07-26',
    nights: 1,
    whenLabel: 'Sat 25 Jul → Sun 26 Jul',
    costNote: '≈$120 · sample',
    mapQuery: 'Tel Aviv',
    detail:
      'One night, and the only job is to land well. The sample flight arrives mid-afternoon, which leaves just enough daylight to reach the city, drop the bag and stand in the sea before dark.\n\nNothing is booked past tomorrow morning except the bed and the train, and that is deliberate — the first night of a long trip is the worst night to have a schedule. Everything ambitious in Tel Aviv is parked until the finale, twelve nights of it, at the other end of September.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample Air **SA 100**, Paris → Tel Aviv, landing mid-afternoon. Sample booking — not a real reservation.',
          'The airport train runs into the city in about fifteen minutes. Buy at the machine; it is the cheapest way in by a wide margin.',
          'A taxi is the fallback if the train is down — show the driver card, it carries the Hebrew.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample beach hotel, Tel Aviv** — one night, $95–140/n · sample. Booked in this trip file, which is why tonight\'s bed resolves.',
          'Ask for a late-ish checkout; tomorrow\'s train to Jerusalem is not early.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [{ label: 'Sat 25 Jul', text: 'Land, train into the city, walk to the water, eat something simple, sleep.' }],
      },
      {
        heading: 'Tips',
        items: [
          'Saturday: buses barely run and many shops are shut. The train from the airport is the reliable option.',
          'Cash is rarely needed — cards work almost everywhere. Draw a small amount anyway for the desert week.',
        ],
      },
    ],
    reco: [
      {
        heading: 'If you do one thing',
        items: ['Walk the promenade south at sunset until the light goes. That is the whole plan for tonight.'],
      },
    ],
  },
  {
    key: 'jerusalem',
    name: 'Jerusalem',
    emoji: '🕍',
    hue: 40,
    start: '2026-07-26',
    end: '2026-07-29',
    nights: 3,
    whenLabel: 'Sun 26 Jul → Wed 29 Jul',
    costNote: '≈$210 · sample',
    mapQuery: 'Jerusalem',
    detail:
      'Three nights, an hour inland and eight hundred metres up. The city is hot but dry, and the stone holds the heat well past sunset, so the day splits cleanly in two: everything on foot before eleven, nothing at all between one and five.\n\nThe third day is really a packing day. The desert transfer on Wednesday is the hardest single move of the sample trip, and it goes badly if the bag is still open at midnight.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample train from Tel Aviv, roughly thirty-five minutes, arriving at the underground station. Sample booking — not a real reservation.',
          'From the station a light-rail line reaches the Old City area. The walk is possible but not in the middle of the day.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample guest house, Jerusalem** — three nights, $70–110/n · sample. Booked, so tonight\'s bed resolves the moment this trip is imported.',
          'Anything inside or just outside the Old City walls saves an hour of walking a day.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Sun 26 Jul', text: 'Train up, check in, Machane Yehuda for lunch, the walls at golden hour.' },
          { label: 'Mon 27 Jul', text: 'Out at 07:00 for the Old City on foot. Back indoors by 11:00. Out again at 18:00.' },
          { label: 'Tue 28 Jul', text: 'One big indoor museum morning, then pack for the desert.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'From Friday afternoon to Saturday night the city closes almost completely. This visit lands Sunday to Wednesday and misses it — the Galilee block later does not.',
          'Modest shoulders and knees for the religious sites, and that is not a suggestion at the Western Wall plaza.',
          'Refill bottles everywhere. The dry heat hides how much you are losing.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          '**Machane Yehuda market** in the late afternoon, when the produce stalls close and the bars in the same alleys open.',
          'The ramparts walk along the Old City wall — short, shaded in places, and the best way to understand the shape of the place.',
        ],
      },
      {
        heading: 'Sample budget',
        items: ['≈$70/day all in for three days · sample figure, invented for this test trip.'],
      },
    ],
  },
  {
    key: 'negev',
    name: 'Negev & Mitzpe Ramon',
    emoji: '🏜',
    hue: 25,
    start: '2026-07-29',
    end: '2026-08-05',
    nights: 7,
    whenLabel: 'Wed 29 Jul → Wed 5 Aug',
    costNote: '≈$390 · sample',
    mapQuery: 'Mitzpe Ramon',
    detail:
      'A week on the rim of the Ramon crater, at nine hundred metres, which is the only reason a desert week in August is survivable at all. Nights are genuinely cold; days are not negotiable between eleven and four.\n\nThis is the longest stretch of the sample trip without a bed that is actually confirmed — the lodge is deliberately left `pending`, so the app shows what an unbooked week looks like for seven days running. That is the point of it.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample coach, Jerusalem → Mitzpe Ramon, roughly three hours with one change. Sample booking — not a real reservation.',
          'The desert runbook fires on the morning of the transfer. It is the one to actually read.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample desert lodge, Mitzpe Ramon** — seven nights, $60–90/n · sample. Left **pending** on purpose: this is the unbooked-bed state, live, for a whole week.',
          'Anything on the rim itself is worth the extra; anything in the industrial edge of town is not.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Wed 29 Jul', text: 'Transfer day. Coach down, check in, do nothing else.' },
          { label: 'Thu 30 – Fri 31 Jul', text: 'Rim walks at first light. Long afternoons indoors.' },
          { label: 'Sat 1 Aug', text: 'Shabbat — the town is quiet and half of it is shut. Plan for that.' },
          { label: 'Sun 2 – Tue 4 Aug', text: 'Down into the makhtesh once, early. Otherwise slow.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          '**Three litres of water per person per day**, and that is the floor, not the target.',
          'Nothing outdoors between 11:00 and 16:00. Not a short walk, not a quick photo stop.',
          'Bring a warm layer. The temperature drop after dark up here surprises people every single time.',
          'Fuel and groceries: stock up in town. The next real shop is a long way in any direction.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The **Ramon crater** rim at first light — the whole thing fills with haze and then empties as the sun comes up.',
          'The sky after dark. There is almost no light here, which is the other reason people come.',
        ],
      },
    ],
  },
  {
    key: 'eilat',
    name: 'Eilat & the Red Sea',
    emoji: '🐠',
    hue: 190,
    start: '2026-08-05',
    end: '2026-08-12',
    nights: 7,
    whenLabel: 'Wed 5 Aug → Wed 12 Aug',
    costNote: '≈$520 · sample',
    mapQuery: 'Eilat',
    detail:
      'Sea level, and the hottest week of the sample trip by a distance. The compensation is that the water is twenty-six degrees and the reef starts a few metres from the shore, so the entire day can be arranged around being in it.\n\nThe sample flight down is left `pending`, which means the trip carries an unconfirmed travel leg for eight days before it is used. That is on purpose too.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample domestic flight, Tel Aviv → Eilat, about an hour. **Status: pending** — the app should be nagging about it.',
          'The overland alternative is a long bus down the Arava. Fine in winter; not in August.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample reef hotel, Eilat** — seven nights, $110–160/n · sample. Also **pending**.',
          'The south beach end is closer to the reef; the north end is closer to everything else.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Wed 5 Aug', text: 'Fly down, check in, first swim before the sun drops.' },
          { label: 'Thu 6 – Sun 9 Aug', text: 'Water in the morning, indoors at midday, water again at five.' },
          { label: 'Mon 10 – Tue 11 Aug', text: 'One boat day, one nothing day. Pack for the Dead Sea on Tuesday night.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'Reef-safe sunscreen, and a rash guard beats reapplying it every hour.',
          'Do not touch, stand on or hold anything on the reef. It is protected, and the fines are real.',
          '**Air conditioning is not optional here.** Check the room has it before confirming anything.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The shore reef at first light, before the boats are out and while the water is still glassy.',
          'The mountains behind the town at sunset — ten minutes out of the resort strip and it is empty desert again.',
        ],
      },
      {
        heading: 'Sample budget',
        items: ['≈$75/day all in · sample figure, invented for this test trip.'],
      },
    ],
  },
  {
    key: 'deadsea',
    name: 'Dead Sea',
    emoji: '🧂',
    hue: 210,
    start: '2026-08-12',
    end: '2026-08-16',
    nights: 4,
    whenLabel: 'Wed 12 Aug → Sun 16 Aug',
    costNote: '≈$300 · sample',
    mapQuery: 'Ein Bokek',
    detail:
      'Four nights at four hundred metres below sea level, which is the lowest place on the trip and the hottest air on it. Mid-August here regularly reads over forty degrees in the afternoon, and the heat runbook exists because of that, not as decoration.\n\nThe plan is deliberately thin: float, shade, float again. The one ambitious thing — Masada at dawn — happens before the day has properly started, or it does not happen at all.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample road transfer up the Arava, roughly three hours. Sample booking — not a real reservation.',
          'The heat runbook fires on arrival day. Read it before setting off, not on arrival.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample spa hotel, Ein Bokek** — four nights, $130–180/n · sample. Booked.',
          'The Ein Bokek strip has the public beaches with fresh-water showers, which matters more than it sounds.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Wed 12 Aug', text: 'Transfer, check in, first float in the late afternoon. Heat runbook day.' },
          { label: 'Thu 13 Aug', text: '**Masada before dawn** or not at all. Back at the hotel by 09:00.' },
          { label: 'Fri 14 – Sat 15 Aug', text: 'Shade, water, and the spa. Shabbat is quiet even here.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          '**Never put your head under.** The water blinds if it reaches your eyes and burns any cut you had forgotten about.',
          'Twenty minutes in the water is plenty. Shower immediately afterwards.',
          'Do not shave the morning of a float. Everybody learns this exactly once.',
          'Afternoon sun here is the most dangerous on the whole sample trip. Treat 11:00–17:00 as indoors.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          '**Masada** by the eastern path in the dark, arriving at the top for sunrise. The cable car is the honest alternative.',
          'The salt formations along the shore late in the day, when the light goes pink and the far shore disappears.',
        ],
      },
    ],
  },
  {
    key: 'galilee',
    name: 'Galilee & the Golan',
    emoji: '🌿',
    hue: 110,
    start: '2026-08-16',
    end: '2026-08-31',
    nights: 15,
    whenLabel: 'Sun 16 Aug → Mon 31 Aug',
    costNote: '≈$900 · sample',
    mapQuery: 'Rosh Pina',
    detail:
      'Two weeks in one place, and the only block of the sample trip that is not scheduled day by day. There are explicit plans for the arrival and for one Saturday, and everything between them falls through to a default day — which is precisely the mechanism this stop exists to exercise.\n\nGreen, high, and much easier than the south: the Upper Galilee sits at three or four hundred metres and the nights actually cool down. Two weeks is long enough to stop sightseeing and start living somewhere, which is the whole argument for staying put.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample road transfer north, roughly four hours with a stop. Sample booking — not a real reservation.',
          'Travel-day basics runbook fires on arrival. It is the short one.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample kibbutz guest house** — fifteen nights, $55–80/n · sample. Booked, so the long block is settled.',
          'Two weeks in one bed is the cheapest week of the sample trip per night, and by a long way the least tiring.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Sun 16 Aug', text: 'Arrive, unpack properly — this bed is home for a fortnight.' },
          { label: 'Mon 17 – Fri 21 Aug', text: 'Default days: a walk in the morning, work or nothing after.' },
          { label: 'Sat 22 Aug', text: 'A planned Saturday — the one explicit day inside the block.' },
          { label: 'Sun 23 – Sun 30 Aug', text: 'Default days again, with the Shabbat variant on the 29th.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          '**Saturdays here are properly quiet.** Buy food on Friday morning or eat what is in the fridge.',
          'The Golan is a car trip, not a bus trip. Rent for two or three days rather than the whole fortnight.',
          'August evenings are warm but not hot. This is the block to eat outside.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The Hula valley early, when the light is low and the birds are still on the water.',
          'A day up on the Golan plateau — it looks and feels like a different country from the valley below.',
        ],
      },
      {
        heading: 'Sample budget',
        items: ['≈$60/day all in over fifteen days · sample figure, invented for this test trip.'],
      },
    ],
  },
  {
    key: 'haifa',
    name: 'Haifa & the coast',
    emoji: '⚓',
    hue: 165,
    start: '2026-08-31',
    end: '2026-09-10',
    nights: 10,
    whenLabel: 'Mon 31 Aug → Thu 10 Sep',
    costNote: '≈$620 · sample',
    mapQuery: 'Haifa',
    detail:
      'Ten nights on the coast, in the one city on this trip that keeps running on a Saturday. Haifa is built up a mountain that ends in a working port, so every walk is either uphill or downhill and the sea is always somewhere below.\n\nSeptember starts here, and the difference is immediate: the evenings drop several degrees and the afternoons become usable again. This is the block where the trip stops hiding from the sun.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample road transfer down from the Galilee, roughly two hours. Sample booking — not a real reservation.',
          'Travel-day basics runbook fires again on arrival.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample port apartment, Haifa** — ten nights, $75–105/n · sample. Left **pending**, so a second unbooked bed is live in September.',
          'Halfway up the mountain is the compromise: the views of the upper city, the walkability of the lower.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Mon 31 Aug', text: 'Transfer down, settle in, walk to the sea in the evening.' },
          { label: 'Tue 1 – Sun 6 Sep', text: 'The terraces, the port, the beaches, and a day trip north.' },
          { label: 'Mon 7 – Wed 9 Sep', text: 'Slow week. Laundry, admin, and the last of the coast.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'The buses and the one underground funicular line run on Saturdays here. That is unusual in this country and worth planning around.',
          'The gardens on the slope have fixed entry times and a dress code. Check on the day, not in advance.',
          'The mountain is steep. Whatever the map says the walk takes, add half again.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The terraced gardens from the top of the slope at opening time, before the coaches arrive.',
          'A day up the coast to Akko — the walled old town and the sea walls are worth the short train ride.',
        ],
      },
    ],
  },
  {
    key: 'telaviv2',
    name: 'Tel Aviv — the finale',
    emoji: '🎆',
    hue: 300,
    start: '2026-09-10',
    end: TRIP_END_EXCLUSIVE,
    nights: 12,
    whenLabel: 'Thu 10 Sep → Tue 22 Sep',
    costNote: '≈$980 · sample',
    mapQuery: 'Tel Aviv',
    detail:
      'Twelve nights back where it started, and the longest single block of the sample trip apart from the Galilee. The city that got one exhausted evening in July gets a fortnight in September, which is the right way round.\n\nThe last three nights move to an airport-side bed, deliberately left as a walk-in — an unconfirmed room forty-eight hours before an international flight, which is exactly the state the app should be shouting about. The exit runbook fires on the final morning.',
    blocks: [
      {
        heading: 'Getting there',
        items: [
          'Sample train down the coast from Haifa, about ninety minutes. Sample booking — not a real reservation.',
          'Travel-day basics runbook fires one last time.',
        ],
      },
      {
        heading: 'Sleep',
        items: [
          '**Sample city flat, Tel Aviv** — ten nights, $120–170/n · sample. Booked.',
          '**Sample airport hotel** — the last three nights, $90/n · sample, and a **walk-in**: no reservation at all. Fix it or accept it, but know about it.',
        ],
      },
      {
        heading: 'Day by day',
        dayRows: [
          { label: 'Thu 10 – Sun 13 Sep', text: 'Settle back in. Beach mornings, city evenings.' },
          { label: 'Mon 14 – Sat 19 Sep', text: 'The museums, the markets, and the neighbourhoods that got skipped in July.' },
          { label: 'Sun 20 – Mon 21 Sep', text: 'Move to the airport bed. Repack, weigh the bag, spend the last shekels.' },
          { label: 'Tue 22 Sep', text: '**Exit day.** Sample flight out, and the sample permit expires the day after.' },
        ],
      },
      {
        heading: 'Tips',
        items: [
          'September evenings are the best of the year here. Eat outside every night.',
          'The last Saturday of the trip is the 19th — shops shut, so do the shopping on Friday.',
          '**Be at the airport three hours before the sample flight.** Departure security here is slower than arrival.',
        ],
      },
    ],
    reco: [
      {
        heading: 'Worth the detour',
        items: [
          'The old port at Jaffa in the evening, walking back north along the water as the city lights come on.',
          'The market streets around Levinsky and the Carmel — the food is the whole reason to give this city two weeks.',
        ],
      },
      {
        heading: 'Sample budget',
        items: ['≈$80/day all in over twelve days · sample figure, invented for this test trip.'],
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

export function buildStops(photoDocIds: Partial<Record<StopKey, string>>): Stop[] {
  return SPECS.map((s, i) => {
    const id = STOP_IDS[s.key];
    const photo = photoDocIds[s.key];
    return {
      id,
      tripId: TRIP_ID,
      kind: 'stop' as const,
      name: s.name,
      emoji: s.emoji,
      hue: s.hue,
      start: s.start,
      end: s.end,
      nights: s.nights,
      whenLabel: s.whenLabel,
      costNote: s.costNote,
      ...(photo ? { photoDocId: photo } : {}),
      detail: s.detail,
      coord: STOP_COORDS[s.key],
      mapQuery: s.mapQuery,
      blocks: toBlocks(id, 'b', s.blocks),
      recoBlocks: toBlocks(id, 'r', s.reco),
      order: i + 1,
    };
  });
}

/** Which stop covers a date, under the same [start, end) rule the app uses. */
export function stopKeyFor(date: string): StopKey {
  for (const s of SPECS) {
    if (date >= s.start && date < s.end) return s.key;
  }
  throw new Error(`no stop covers ${date}`);
}

/** The bed label a day inside a stop inherits. */
export function bedFor(date: string): { bedEmoji: string; bedLabel: string } {
  const b = BEDS[stopKeyFor(date)];
  return { bedEmoji: b.emoji, bedLabel: b.label };
}

/* 🧪 TEMPLATE EXAMPLE · days.ts — brief §4 (Interests, Must do) and §7.

   FOUR EXPLICIT DAYS OUT OF FIVE. Tuesday the 13th has no DayPlan at all: it
   falls through to the Porto DayDefault, which is what the brief's "slow, one
   unplanned day" line actually means in data. Writing five itineraries when
   the traveller asked for four would be inventing a day. */
import type { DayDefault, DayPlan, Runbook } from '../../../src/lib/model/types';
import { SLUG, STOP_IDS, id } from './base';
import { SPOT_IDS, bedFor } from './stops';

interface DaySpec {
  date: string;
  title: string;
  items: string[];
  placeIds?: string[];
  run?: 'arrive' | 'exit';
}

const DAYS: DaySpec[] = [
  {
    date: '2027-04-12',
    title: 'Landing in Porto',
    run: 'arrive',
    items: [
      'Sample Air SA 410 lands early afternoon. Metro into the centre — buy at the machine.',
      'Check into the **sample river guesthouse** (✅ booked, ref TEST-BK-4471). Drop the bag, do not unpack.',
      'Walk downhill to the river and stop there. That is the whole plan for today.',
      'Brief §6 rule in action: nothing was booked that could not be cancelled free.',
    ],
  },
  /* 2027-04-13 has NO entry on purpose — see the header. */
  {
    date: '2027-04-14',
    title: 'Down to Lisbon',
    items: [
      'Sample train at 10:30, arriving just after lunch (✅ booked, ref TEST-CP7).',
      '⏳ **The Lisbon bed is not booked.** Until it is, this segment carries an amber chip and a dated task — and the task says exactly what to look for.',
      'Whatever the room turns out to be, walk the Baixa grid in the late afternoon.',
    ],
  },
  {
    date: '2027-04-15',
    title: 'Belém, and back along the water',
    /* The two verified places this day names. Explicit, because matching prose
       to place names at runtime would have to guess. */
    placeIds: [SPOT_IDS.belem, SPOT_IDS.comercio],
    items: [
      'Out west to **Torre de Belém** in the morning light rather than back into it.',
      'Walk the river eastward through the afternoon.',
      '**Praça do Comércio** at the blue hour, when the arch is lit and the square empties.',
    ],
  },
  {
    date: '2027-04-16',
    title: 'Last day, evening flight',
    run: 'exit',
    items: [
      'The room is held through today — the flight is not until 21:05.',
      'One unhurried morning, then bags to wherever they can be left.',
      '**At the airport by 19:00.** Sample flight SA 411, ref TEST-ZZ9.',
    ],
  },
];

export function buildDayPlans(): DayPlan[] {
  return DAYS.map((d) => ({
    id: id('day', d.date),
    tripId: SLUG,
    date: d.date,
    title: d.title,
    ...bedFor(d.date),
    planItems: d.items,
    ...(d.placeIds?.length ? { placeIds: d.placeIds } : {}),
    ...(d.run ? { runbookId: id('run', d.run) } : {}),
  }));
}

/** Only Porto needs one — every Lisbon day is written out. Weekday-specific
    defaults would go BEFORE the all-days one for the same stop, because
    resolveDay() returns the first that matches. */
export function buildDayDefaults(): DayDefault[] {
  return [
    {
      id: id('default', 'porto'),
      tripId: SLUG,
      stopId: STOP_IDS.porto,
      title: 'Porto — a free day',
      bedEmoji: '🍷',
      bedLabel: 'Sample river guesthouse, Porto',
      planItems: [
        'Nothing scheduled. The brief asked for one unplanned day and this is it.',
        'Walk the upper deck of the bridge, across and back along the far bank.',
        'Eat late, somewhere chosen by walking past it rather than by reading about it.',
        'Brief §4 Skip: no port-cellar tour. Already decided; nobody has to re-argue it.',
      ],
    },
  ];
}

export function buildRunbooks(): Runbook[] {
  return [
    {
      id: id('run', 'arrive'),
      tripId: SLUG,
      title: 'Arrival — sample landing day',
      severity: 'warn',
      steps: [
        'Data plan on and confirmed working **before leaving the terminal**, while there is still airport wifi to fix it.',
        'Small amount of cash from an arrivals machine. Cards work almost everywhere; buses are the exception.',
        'Metro into the centre. Screenshot the guesthouse address before going underground.',
        'Check in, drop the bag, do not unpack — it is two nights.',
        'River before dark, food, early night.',
        'Every reference in this trip is a sample. Nothing here is a real reservation.',
      ],
    },
    {
      id: id('run', 'exit'),
      tripId: SLUG,
      title: '✈️ Last day — evening flight',
      severity: 'crit',
      steps: [
        '**Ask about late checkout the night before, not on the morning.** The room is held to the 17th in this trip file; confirm the real property agrees.',
        'Repack: documents, medication and anything valuable into the daypack, never the hold bag.',
        'Weigh the bag before leaving. Fixing it at the desk costs money and time you will not have.',
        '**At the airport by 19:00** for the 21:05 departure.',
        'Spend or change the last coins before the gate.',
        'This is a sample runbook on a sample trip. When a real deadline fires, it will look exactly like this.',
      ],
    },
  ];
}

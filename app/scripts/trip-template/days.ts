/* TRIP TEMPLATE · days.ts — day plans, default days, and runbooks.

   BRIEF SECTION → HERE
     §4 Interests / Must do      → DAYS, one entry per dated day
     §1 Pace                     → how many DAYS you write at all
     §7 Anything that could go   → buildRunbooks()
        badly

   A DAY DOES NOT NEED A PLAN. `resolveDay()` falls back to a DayDefault for
   any date inside a stop that has no explicit DayPlan, which is how a
   fortnight in one place stays honest instead of inventing fourteen
   itineraries. Write explicit days for the ones that actually differ — arrival,
   departure, the timed ticket — and let a default carry the rest.

   ORDER MATTERS in `buildDayDefaults()`. `resolveDay()` (src/lib/logic/day.ts)
   returns the FIRST default whose stop and weekday both match, so a
   weekday-specific default must be emitted BEFORE the all-days one for the
   same stop or it can never fire. */
import type { DayDefault, DayPlan, Runbook } from '../../src/lib/model/types';
import { SLUG, id } from './base';
import { bedFor } from './stops';

interface DaySpec {
  date: string;
  title: string;
  items: string[];
  /** Ids of stops / spots / show cards / bookings this day's prose names, in
      the day's own order. EXPLICIT on purpose: matching prose to place names at
      runtime would guess, and the wrong guesses are the expensive ones.
      `assert.ts` refuses an id the trip does not carry. */
  placeIds?: string[];
  /** A runbook key from buildRunbooks(), for the days that need one. */
  run?: string;
}

const DAYS: DaySpec[] = [
  {
    date: '2027-01-04',
    title: 'FILL ME — arrival day',
    run: 'arrive',
    items: [
      'FILL ME — one line per thing that actually happens, in order.',
      'md-lite is allowed: **bold**, *italic*, [label](url).',
      'Say what NOT to do as readily as what to do — an arrival day survives on that.',
    ],
  },
  {
    date: '2027-01-08',
    title: 'FILL ME — departure day',
    items: ['FILL ME.'],
  },
];

export function buildDayPlans(): DayPlan[] {
  return DAYS.map((d) => ({
    id: id('day', d.date),
    tripId: SLUG,
    date: d.date,
    title: d.title,
    ...bedFor(d.date), // bedEmoji + bedLabel, from base.ts BEDS — never retyped
    planItems: d.items,
    ...(d.placeIds?.length ? { placeIds: d.placeIds } : {}),
    ...(d.run ? { runbookId: id('run', d.run) } : {}),
  }));
}

/** WEEKDAY-SPECIFIC DEFAULTS FIRST. See the header. */
export function buildDayDefaults(): DayDefault[] {
  return [
    {
      id: id('default', 'first'),
      tripId: SLUG,
      stopId: `${SLUG}-stop-first`,
      // weekdays: [6],  ← 0 = Sunday. Omit for "every day in this stop".
      title: 'FILL ME — what an ordinary day here looks like',
      bedEmoji: '🏨',
      bedLabel: 'FILL ME — same label as base.ts BEDS',
      planItems: ['FILL ME — the shape of a day, not a schedule.'],
    },
    {
      id: id('default', 'second'),
      tripId: SLUG,
      stopId: `${SLUG}-stop-second`,
      title: 'FILL ME',
      bedEmoji: '🏨',
      bedLabel: 'FILL ME',
      planItems: ['FILL ME.'],
    },
  ];
}

/** Brief §7 · the numbered checklist that surfaces on the day it matters.
    `severity` decides how loudly: 'info' | 'warn' | 'crit'. Reserve 'crit' for
    the two or three days that genuinely go wrong if improvised — the long
    transfer, the visa deadline, the 4am airport run. */
export function buildRunbooks(): Runbook[] {
  return [
    {
      id: id('run', 'arrive'),
      tripId: SLUG,
      title: 'FILL ME — arrival runbook',
      severity: 'warn',
      steps: [
        'FILL ME — one step per line, in the order you do them.',
        'Steps are ticked per DATE, so the same runbook can fire on several days.',
      ],
    },
  ];
}

/* ┌──────────────────────────────────────────────────────────────────────────┐
   │ 🧪 TEMPLATE EXAMPLE · base.ts                                            │
   └──────────────────────────────────────────────────────────────────────────┘

   THE WORKED EXAMPLE for the trip-brief pipeline. It is the compiled form of
   `docs/examples/porto-lisbon-mini.brief.md` — read the two side by side and
   every field below has a line of the brief it came from.

   IT IS ENTIRELY INVENTED. Every reference, price and property here is fake and
   says so on its face (`TEST-…`). The cities are real because a made-up city
   would make the map buttons meaningless, but nothing about the trip is.

   It exists to be built, imported, looked at, and deleted. Its slug is `tx00`,
   which no real trip uses, so importing it beside China 2026 or the Israel
   test trip cannot touch either of them — and deleting it cannot either.

   Build:  npm run seed-build:template-example
   Output: seed/template-example.trip.json */
import type { ISODate } from '../../../src/lib/model/types';

/** Unique across every trip on the shelf. `cn26` is China 2026, `il26` is the
    Israel test trip; this one is deliberately neither. */
export const SLUG = 'tx00';

/** Fixed build instant — no Date.now() anywhere, so two runs of this builder
    produce byte-identical output. */
export const SEED_TS = Date.UTC(2026, 7, 26); // 2026-08-26
export const SEED_DATE: ISODate = '2026-08-26';

/* Brief §1 · Dates — five inclusive days, four nights. */
export const TRIP_START: ISODate = '2027-04-12'; // Monday
export const TRIP_END: ISODate = '2027-04-16'; // Friday
/** TRIP_END + 1. The last stop's EXCLUSIVE end, so 2027-04-16 still resolves
    to a stop under the [start, end) occupancy rule. */
export const TRIP_END_EXCLUSIVE: ISODate = '2027-04-17';

/** The evening-before pack reminder is the one thing allowed to predate the
    trip. Nothing may fall earlier. */
export const ALARM_EARLIEST: ISODate = '2027-04-11';

/* Brief §4 · Cities — two, in trip order. */
export const STOP_IDS = {
  porto: `${SLUG}-stop-porto`,
  lisbon: `${SLUG}-stop-lisbon`,
} as const;

export type StopKey = keyof typeof STOP_IDS;

/** The bed a day plan names, per stop. Written once, reused by every day, so
    the label on the day card can never drift from the booking. */
export const BEDS: Record<StopKey, { emoji: string; label: string }> = {
  porto: { emoji: '🍷', label: 'Sample river guesthouse, Porto' },
  lisbon: { emoji: '⏳', label: 'Lisbon — bed not booked yet' },
};

/** City-grade WGS-84. Public geography, nothing personal, nothing guessed. */
export const STOP_COORDS: Record<StopKey, { lat: number; lng: number }> = {
  porto: { lat: 41.1579, lng: -8.6291 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
};

/** Every id in the bundle goes through here. Nothing builds one by hand. */
export const id = (...parts: string[]): string => [SLUG, ...parts].join('-');

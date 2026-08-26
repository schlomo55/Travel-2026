/* ┌──────────────────────────────────────────────────────────────────────────┐
   │ TRIP TEMPLATE · base.ts — constants every other file in the trip reads.  │
   └──────────────────────────────────────────────────────────────────────────┘

   THIS FOLDER IS A SCAFFOLD, NOT A TRIP. Nothing here is built by any npm
   script and nothing here reaches `seed/`. To make a real trip:

     1. copy the whole folder to `app/scripts/<your-trip>/`
     2. change SLUG below and search-and-replace `xx00-` throughout
     3. work down the `FILL ME` markers, brief section by brief section
     4. copy `app/scripts/build-template-example-seed.ts` to
        `app/scripts/build-<your-trip>-seed.ts`, point it at your folder, and add
        the matching `seed-build:<your-trip>` script to package.json

   A worked end-to-end version of all four steps lives in `./example/`, and the
   brief it was compiled from is `docs/examples/porto-lisbon-mini.brief.md`.

   ── THE ID RULE, WHICH IS NOT OPTIONAL ──────────────────────────────────────
   Dexie primary keys in this app are GLOBAL, not scoped per trip. An id shared
   with another trip does not raise an error on import — it silently OVERWRITES
   that other trip's record. The protection is a slug prefix on every single id
   in the bundle, and `../assert.ts` proves it holds before anything is written.

   Pick a SLUG no existing trip uses. Taken so far: `cn26` (China 2026),
   `il26` (the Israel test trip), `tx00` (this scaffold's worked example).

   ── THE DETERMINISM RULE ────────────────────────────────────────────────────
   No `Date.now()`, no `new Date()` with no argument, no randomness, anywhere in
   a builder. Two runs of the same builder must produce byte-identical output,
   or a rebuild shows up as a diff that says nothing. Every timestamp in the
   bundle comes from SEED_TS below.  */
import type { ISODate } from '../../src/lib/model/types';

/** FILL ME — four characters, lowercase, unique across every trip you own.
    Convention is two letters of the destination plus the two-digit year. */
export const SLUG = 'xx00';

/** FILL ME — the day you authored the seed, as a fixed UTC instant. Write the
    literal; do not compute it from today. Every `createdAt`, `updatedAt`, and
    expense `ts` in the bundle is this number. */
export const SEED_TS = Date.UTC(2027, 0, 1);
/** The same day as an ISO string — what "as of" checks compare against. */
export const SEED_DATE: ISODate = '2027-01-01';

/* ── Brief §1 · Trip header ───────────────────────────────────────────────── */

/** FILL ME — first day of the trip, inclusive. The day you leave home. */
export const TRIP_START: ISODate = '2027-01-04';
/** FILL ME — last day of the trip, inclusive. The day you get home. */
export const TRIP_END: ISODate = '2027-01-08';
/** TRIP_END + 1 day. The last stop's `end` is EXCLUSIVE, so it has to be one
    day past the trip or the final day resolves to no stop at all. */
export const TRIP_END_EXCLUSIVE: ISODate = '2027-01-09';

/** The earliest date anything in the bundle may carry. Alarms are the one
    collection allowed to reach back before departure — the pack-and-go
    reminder the evening before. Set it to TRIP_START if you have none. */
export const ALARM_EARLIEST: ISODate = '2027-01-03';

/* ── Brief §4 · Cities ────────────────────────────────────────────────────── */

/** FILL ME — one key per city you sleep in, in trip order. Every stop id, and
    every id derived from one, is built from these. */
export const STOP_IDS = {
  first: `${SLUG}-stop-first`,
  second: `${SLUG}-stop-second`,
} as const;

export type StopKey = keyof typeof STOP_IDS;

/** FILL ME — the bed a day plan names, per stop. Written once here and reused
    by every day inside that stop, so the label can never drift. */
export const BEDS: Record<StopKey, { emoji: string; label: string }> = {
  first: { emoji: '🏨', label: 'FILL ME — property name, first city' },
  second: { emoji: '🏨', label: 'FILL ME — property name, second city' },
};

/** FILL ME — city/area-grade WGS-84 coordinates. Public geography only; never
    a coordinate you guessed. A stop with no verified coordinate should simply
    have none — the app draws one fewer button rather than a wrong one. */
export const STOP_COORDS: Record<StopKey, { lat: number; lng: number }> = {
  first: { lat: 0, lng: 0 },
  second: { lat: 0, lng: 0 },
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Every ISO date from `from` to `to`, inclusive. Pure string/UTC maths, so no
    local timezone can shift a day. Copy this helper as-is. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  let t = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (t <= end) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
    t += 86_400_000;
  }
  return out;
}

/** Every id in the bundle goes through here. Nothing builds an id by hand. */
export const id = (...parts: string[]): string => [SLUG, ...parts].join('-');

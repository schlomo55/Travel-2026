/* Shared constants and tiny helpers for the Israel TEST seed.

   This trip is entirely INVENTED. It exists so the owner can rehearse every
   date-aware behaviour of the app against real passing time instead of waiting
   for the China trip to start. Nothing in it is a real booking, price, code or
   person.

   The one rule that matters more than any content decision: Dexie primary keys
   are global, not per-trip, so every id in this bundle starts with `il26-`.
   A single `cn26-` collision would overwrite China data on import. */
import type { ISODate } from '../../src/lib/model/types';

export const TRIP_ID = 'il26';

/** Fixed build instant — 2026-07-26, the day this seed was authored. No
    Date.now() anywhere, so two runs produce byte-identical output. */
export const SEED_TS = Date.UTC(2026, 6, 26); // 1785024000000
export const SEED_DATE: ISODate = '2026-07-26';

export const TRIP_START: ISODate = '2026-07-25';
export const TRIP_END: ISODate = '2026-09-22'; // inclusive — 60 days
/** The last stop's EXCLUSIVE end, one day past the last trip day, so that
    2026-09-22 still resolves to a stop under the [start, end) occupancy rule. */
export const TRIP_END_EXCLUSIVE: ISODate = '2026-09-23';

/** The one date before the trip an alarm may carry: the pack-and-go reminder
    the evening before departure. The China seed does the same thing (its
    earliest alarm is eleven days before the trip starts), so this is a
    supported state, not a leak — but nothing may fall earlier than this. */
export const ALARM_EARLIEST: ISODate = '2026-07-24';

export const STOP_IDS = {
  telaviv: 'il26-stop-telaviv',
  jerusalem: 'il26-stop-jerusalem',
  negev: 'il26-stop-negev',
  eilat: 'il26-stop-eilat',
  deadsea: 'il26-stop-deadsea',
  galilee: 'il26-stop-galilee',
  haifa: 'il26-stop-haifa',
  telaviv2: 'il26-stop-telaviv2',
} as const;

export type StopKey = keyof typeof STOP_IDS;

/** The bed a day plan names, per stop — written once, reused by every day. */
export const BEDS: Record<StopKey, { emoji: string; label: string }> = {
  telaviv: { emoji: '🌊', label: 'Sample beach hotel, Tel Aviv' },
  jerusalem: { emoji: '🕍', label: 'Sample guest house, Jerusalem' },
  negev: { emoji: '🏜', label: 'Sample desert lodge, Mitzpe Ramon' },
  eilat: { emoji: '🐠', label: 'Sample reef hotel, Eilat' },
  deadsea: { emoji: '🧂', label: 'Sample spa hotel, Ein Bokek' },
  galilee: { emoji: '🌿', label: 'Sample kibbutz guest house' },
  haifa: { emoji: '⚓', label: 'Sample port apartment, Haifa' },
  telaviv2: { emoji: '🎆', label: 'Sample city flat, Tel Aviv' },
};

/** City/area-grade WGS-84 coordinates. Public geography, nothing personal. */
export const STOP_COORDS: Record<StopKey, { lat: number; lng: number }> = {
  telaviv: { lat: 32.0853, lng: 34.7818 },
  jerusalem: { lat: 31.7683, lng: 35.2137 },
  negev: { lat: 30.6097, lng: 34.8014 },
  eilat: { lat: 29.5577, lng: 34.9519 },
  deadsea: { lat: 31.1975, lng: 35.3647 },
  galilee: { lat: 32.9686, lng: 35.5425 },
  haifa: { lat: 32.794, lng: 34.9896 },
  telaviv2: { lat: 32.0853, lng: 34.7818 },
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Every ISO date from `from` to `to`, inclusive. Pure string/UTC math so no
    local timezone can shift a day. */
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

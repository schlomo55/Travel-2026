/* Resolving "what is today": an explicit DayPlan wins; otherwise a DayDefault
   whose stop contains the date and whose weekday matches (the Kunyu training
   day / Sunday-off pattern, generalized). */
import type { DayDefault, DayPlan, ISODate, Stop } from '../model/types';
import { compareIso, weekday } from './dates';

export interface ResolvedDay {
  title: string;
  bedEmoji?: string;
  bedLabel?: string;
  planItems: string[];
  /** The openable places this day's plan refers to (types.ts → DayPlan). Carried
      through from whichever of the two shapes answered, so a default day gets
      its chips too — the Kunyu Sunday really does list four places. */
  placeIds?: string[];
  runbookId?: string;
  fromDefault: boolean;
}

/** THE TRIP'S STOPS IN TRIP ORDER — by date, then by the file's own `order`
    for two that start on the same day; the transit pseudo-stop left out.
    One helper (Run 3c), so a city's ways out, "stop N of M", Journey's
    count, the map, the connectors, the route check and Replay can never put
    the same stops in two different orders. */
export function realStops(stops: Stop[]): Stop[] {
  return stops.filter((s) => s.kind === 'stop').sort((a, b) => compareIso(a.start, b.start) || a.order - b.order);
}

export function currentStop(stops: Stop[], date: ISODate): Stop | null {
  let found: Stop | null = null;
  for (const s of stops) {
    if (s.kind === 'transit') continue;
    // [start, end) — matches the legacy occupancy rule
    if (compareIso(date, s.start) >= 0 && compareIso(date, s.end) < 0) found = s;
  }
  return found;
}

export function resolveDay(
  date: ISODate,
  dayPlans: DayPlan[],
  defaults: DayDefault[],
  stops: Stop[],
): ResolvedDay | null {
  const explicit = dayPlans.find((d) => d.date === date);
  if (explicit) {
    return {
      title: explicit.title,
      ...(explicit.bedEmoji ? { bedEmoji: explicit.bedEmoji } : {}),
      ...(explicit.bedLabel ? { bedLabel: explicit.bedLabel } : {}),
      planItems: explicit.planItems,
      ...(explicit.placeIds?.length ? { placeIds: explicit.placeIds } : {}),
      ...(explicit.runbookId ? { runbookId: explicit.runbookId } : {}),
      fromDefault: false,
    };
  }
  const dow = weekday(date);
  /* The most specific default wins, never the first one in the array: a Dexie
     query returns rows in primary-key order, so a Shabbat default sitting next
     to a catch-all for the same stop would otherwise be decided by its id. */
  let best: DayDefault | null = null;
  let bestScore = -1;
  for (const d of defaults) {
    if (d.weekdays && !d.weekdays.includes(dow)) continue;
    if (d.stopId) {
      const stop = stops.find((s) => s.id === d.stopId);
      if (!stop) continue;
      if (compareIso(date, stop.start) < 0 || compareIso(date, stop.end) > 0) continue;
    }
    const score = (d.weekdays ? 2 : 0) + (d.stopId ? 1 : 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  if (!best) return null;
  return {
    title: best.title,
    ...(best.bedEmoji ? { bedEmoji: best.bedEmoji } : {}),
    ...(best.bedLabel ? { bedLabel: best.bedLabel } : {}),
    planItems: best.planItems,
    ...(best.placeIds?.length ? { placeIds: best.placeIds } : {}),
    fromDefault: true,
  };
}

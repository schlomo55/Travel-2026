/* The weather cache and the (only) runtime fetch.

   Policy, locked with the owner:
   - auto and quiet: no button, no spinner, no toast, ever;
   - runs on app open and on Today mount;
   - only when navigator.onLine AND the setting is on AND the cache is stale;
   - at most two stops per sweep — the one you are in and the one you go to next;
   - 8s timeout, everything caught, failure is indistinguishable from offline.

   Storage is db.meta (key/value) so no schema version is needed. */
import { db } from '../db/db';
import type { Stop } from '../model/types';
import { compareIso } from '../logic/dates';
import { realStops } from '../logic/day';
import {
  asWeatherCache,
  FETCH_TIMEOUT_MS,
  forecastUrl,
  isStale,
  parseForecast,
  weatherKey,
  type WeatherCache,
} from '../logic/weather';

/** Stop id 'cn26-stop-beijing' → 'beijing'. Ids are stable; names are not. */
export function stopWeatherKey(stop: Stop): string {
  return stop.id;
}

export async function readWeather(stop: Stop): Promise<WeatherCache | null> {
  try {
    const row = await db.meta.get(weatherKey(stopWeatherKey(stop)));
    return asWeatherCache(row?.value);
  } catch {
    return null;
  }
}

/** One stop, one request. Resolves to false on any problem — never throws. */
async function fetchStop(stop: Stop, now: number): Promise<boolean> {
  if (!stop.coord) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(forecastUrl(stop.coord), { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return false;
    const daily = parseForecast(await res.json());
    if (!daily.length) return false;
    /* Plain objects built here — nothing from $state, nothing to snapshot. */
    const value: WeatherCache = { fetchedAt: now, daily };
    await db.meta.put({ key: weatherKey(stopWeatherKey(stop)), value });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The current stop and the next one — the only two forecasts that matter. */
export function stopsToRefresh(stops: Stop[], today: string): Stop[] {
  const real = realStops(stops).filter((s) => s.coord);
  const here = real.findIndex((s) => compareIso(today, s.start) >= 0 && compareIso(today, s.end) < 0);
  if (here >= 0) return real.slice(here, here + 2);
  const next = real.findIndex((s) => compareIso(s.start, today) >= 0);
  if (next >= 0) return real.slice(next, next + 2);
  return [];
}

let sweeping = false;
/* A failed sweep writes no cache, so nothing else would stop us trying again
   on the very next re-render. Inside the Firewall that would mean an 8-second
   dead request every time anything in the trip is touched. Session-scoped, in
   memory only: a failure buys ten minutes of quiet. */
let quietUntil = 0;
const FAIL_BACKOFF_MS = 10 * 60 * 1000;

/** Quiet refresh. Returns how many stops were updated (0 is the normal case). */
export async function refreshWeather(stops: Stop[], today: string, enabled: boolean): Promise<number> {
  if (sweeping) return 0;
  if (!enabled) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  const now = Date.now();
  if (now < quietUntil) return 0;
  sweeping = true;
  let done = 0;
  let tried = 0;
  try {
    for (const stop of stopsToRefresh(stops, today)) {
      if (!isStale(await readWeather(stop), now)) continue;
      tried++;
      if (await fetchStop(stop, now)) done++;
    }
  } catch {
    /* nothing may escape */
  } finally {
    if (tried > 0 && done === 0) quietUntil = Date.now() + FAIL_BACKOFF_MS;
    sweeping = false;
  }
  return done;
}

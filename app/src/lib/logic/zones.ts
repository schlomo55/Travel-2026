/* Two clocks on one journey (Lantern Run C, C2.3).
 *
 * A boarding pass prints both ends in LOCAL time and says nothing about the
 * gap between them. "Depart 21:20, arrive 08:45+1" reads as eleven and a half
 * hours in the air; it is seven and a half, and the four hours are a timezone.
 * The traveller lands at what their body still calls 04:45.
 *
 * THE ZONES ARE NOT GUESSED, AND THERE IS NO AIRPORT TABLE HERE. The shift is
 * derived from figures the trip documents already carry:
 *
 *     shift = (arrival + dayOffset) − departure − duration
 *
 * where `duration` is the airline's own printed flying time. If a leg has no
 * duration, or an approximate one ("~2 h"), no shift is derived and no chip is
 * drawn — an app that guesses a timezone is worse than one that says nothing.
 *
 * On this trip that yields exactly the four Etihad legs (Tel Aviv ↔ Abu Dhabi
 * ↔ Beijing / Hong Kong) and leaves every domestic Chinese leg silent, which
 * is correct: the mainland is one timezone.
 */
import type { HHMM } from '../model/types';

/** Real timezone offsets are whole quarter-hours; a shift that is not one is
    arithmetic noise from a rounded duration, not a zone. */
const QUARTER = 15;
/** Below this, it is a rounding artefact rather than a zone worth naming. */
const MIN_SHIFT = 30;

export function hhmmToMinutes(t: string | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToHhmm(total: number): HHMM {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * "3h 15m", "7h 25m", "1h 10m", "2h" → minutes.
 *
 * An approximate figure ("~2 h", "about 2 h") returns null on purpose: it
 * cannot carry the precision a timezone claim needs.
 */
export function parseDurationMinutes(s: string | undefined): number | null {
  if (!s) return null;
  if (/[~≈]|about|approx/i.test(s)) return null;
  const m = /^\s*(?:(\d{1,2})\s*h)?\s*(?:(\d{1,2})\s*m)?\s*$/i.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

export interface Leg {
  dep?: HHMM;
  arr?: HHMM;
  arrDayOffset?: number;
  duration?: string;
}

/**
 * How far the destination's clock is ahead (+) or behind (−) the origin's,
 * in minutes — or null when the trip data cannot prove it.
 */
export function zoneShiftMinutes(leg: Leg): number | null {
  const dep = hhmmToMinutes(leg.dep);
  const arr = hhmmToMinutes(leg.arr);
  const flying = parseDurationMinutes(leg.duration);
  if (dep === null || arr === null || flying === null) return null;
  const wallElapsed = arr + (leg.arrDayOffset ?? 0) * 1440 - dep;
  const shift = wallElapsed - flying;
  if (Math.abs(shift) < MIN_SHIFT) return null;
  /* Anything that is not a whole quarter-hour is not a timezone. */
  if (shift % QUARTER !== 0) return null;
  return shift;
}

export function crossesZone(leg: Leg): boolean {
  return zoneShiftMinutes(leg) !== null;
}

/** The arrival time as the clock the traveller LEFT would show it — the
    number that explains why they feel the way they do. */
export function arrivalInOriginTime(leg: Leg): HHMM | null {
  const arr = hhmmToMinutes(leg.arr);
  const shift = zoneShiftMinutes(leg);
  if (arr === null || shift === null) return null;
  return minutesToHhmm(arr - shift);
}

/** "+4 h", "−2 h", "+5 h 30" — a signed, human offset. */
export function fmtShift(minutes: number | null): string | null {
  if (minutes === null) return null;
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h} h${m ? ` ${m}` : ''}`;
}

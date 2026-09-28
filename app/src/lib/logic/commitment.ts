/* THE NEXT THING YOU HAVE TO BE AT — and whether tonight is spent moving.

   Home's "Next leg" was a 14.5 px row two thirds of the way down the screen,
   under the day, the places and the bed: the one fact that has a clock attached
   to it, drawn quieter than the weather. This module is the derivation behind
   the element that replaced it, lifted out of the screen so it can be tested
   with fixed dates instead of read off a phone at the airport.

   IT IS THE SAME QUERY HOME ALREADY ASKED, widened by exactly one case.
   `nextTravel` filtered bookings to the kinds that move you, dropped the
   cancelled and the `alternative` ones (Nov 22 is a flight OR ELSE the HSR) and
   took the earliest still ahead. All of that survives verbatim; what joins it is
   the day a stay BEGINS, because a check-in is a place you have to be by a
   certain hour just as much as a gate is, and on the days the two disagree the
   nearer one is the answer.

   NOTHING HERE INVENTS A CLOCK. A commitment carries the time its own booking
   states — `dep` on a leg — and `null` where the documents state none, and the
   countdown falls back to whole days rather than guessing an hour. That is the
   same rule logic/timeline.ts follows for the day's plan items.

   Pure: bookings and dates in, values out. No DOM, no `new Date(string)`. */
import type { Booking, HHMM, ISODate } from '../model/types';
import { addDays, compareIso, daysBetween, parseYmd, ymd } from './dates';
import { timeMinutes, type FixedPoint } from './timeline';
import { isLive as live } from './booked';
import { S } from '../i18n/strings';

/** The kinds that MOVE you between places. A ticket is dated too, and a concert
    is emphatically not the next leg — letting one answer this question would
    push the flight you are actually catching off the screen. */
const MOVES = new Set(['flight', 'train', 'other']);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Inside two days a countdown is worth reading; beyond it, days are. */
export const LIVE_WINDOW_MS = 48 * HOUR;

export interface Commitment {
  booking: Booking;
  /** 'leg' — a flight, train or road move. 'checkin' — the day a stay begins. */
  kind: 'leg' | 'checkin';
  /** The calendar day it happens on (a stay's check-in day, not its anchor). */
  date: ISODate;
  /** The clock the booking itself states, or null where it states none. */
  time: HHMM | null;
}

/** The departure clock a booking carries, if it carries one. */
function statedTime(b: Booking): HHMM | null {
  return 'dep' in b && typeof b.dep === 'string' && b.dep ? b.dep : null;
}

/* A cancelled booking is not a commitment, and an `alternative` is the OTHER
   way of doing a journey that is already listed — counting it would put a
   train he is not catching at the top of the screen (booked.ts isLive, the
   one copy of the rule). */

/** Every timed commitment from `from` onwards, soonest first. */
export function commitments(bookings: Booking[], from: ISODate): Commitment[] {
  const out: Commitment[] = [];
  for (const b of bookings) {
    if (!live(b)) continue;
    if (MOVES.has(b.kind) && compareIso(b.date, from) >= 0) {
      out.push({ booking: b, kind: 'leg', date: b.date, time: statedTime(b) });
    } else if (b.kind === 'hotel' && compareIso(b.checkIn, from) >= 0) {
      out.push({ booking: b, kind: 'checkin', date: b.checkIn, time: null });
    }
  }
  /* Date, then the clock — and a thing with NO stated clock sorts last on its
     own day, because the one that states an hour is the one you can be late
     for. On Dec 21 that is MU 733 at 13:50 ahead of the Hong Kong check-in,
     which is the order the day actually happens in. A tie between a leg and a
     check-in goes to the leg for the same reason: you travel, then you arrive. */
  out.sort(
    (a, b) =>
      compareIso(a.date, b.date) ||
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
      (a.kind === b.kind ? 0 : a.kind === 'leg' ? -1 : 1),
  );
  return out;
}

/** The next one, or null when nothing timed is left. */
export function nextCommitment(bookings: Booking[], from: ISODate): Commitment | null {
  return commitments(bookings, from)[0] ?? null;
}

/** The wall-clock moment a commitment happens, or null where it states no time.
    `parseYmd` first, never `new Date('YYYY-MM-DD')` — dates.ts §HARD RULE. */
export function commitmentAt(date: ISODate, time: HHMM | null): Date | null {
  if (!time) return null;
  const at = parseYmd(date);
  const h = Number(time.slice(0, 2));
  const m = Number(time.slice(3, 5));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  at.setHours(h, m, 0, 0);
  return at;
}

/** 'today' · 'tomorrow' · 'in 5 days' — day granularity, the phrasing Home has
    used for a leg with no clock since the first build. */
export function whenLabel(from: ISODate, date: ISODate): string {
  return S.today.countdownDays(daysBetween(from, date));
}

/**
 * The countdown a commitment wears:
 *
 *   · beyond 48 h, or with no stated clock → the day phrasing above;
 *   · inside 48 h → "in 2 h 40 m", at minute granularity;
 *   · the minute it lands → "now";
 *   · once it has passed → **null**, because "in -20 m" is not a countdown and
 *     a flight that left is not something to count down to. The caller falls
 *     back to the day phrasing, which stays true all day.
 */
export function countdownLabel(date: ISODate, time: HHMM | null, now: Date): string | null {
  const at = commitmentAt(date, time);
  if (!at) return whenLabel(ymd(now), date);
  const ms = at.getTime() - now.getTime();
  if (ms < 0) return null;
  if (ms < MINUTE) return S.today.countdownNow;
  if (ms >= LIVE_WINDOW_MS) return whenLabel(ymd(now), date);
  const mins = Math.floor(ms / MINUTE);
  return S.today.countdownHm(Math.floor(mins / 60), mins % 60);
}

/** Does this leg carry the night on `date` across into the next day?
 *
 *  TWO SHAPES OF EVIDENCE, AND NO THIRD:
 *    · a flight's `arrDayOffset`, which STATES the crossing (EY 888 leaves Abu
 *      Dhabi at 21:20 on 21 Nov and lands at 08:45 on the 22nd);
 *    · a rail or road leg whose stated arrival clock is EARLIER than its stated
 *      departure clock — the clock has wrapped past midnight, which is
 *      arithmetic on the trip's own two numbers rather than a guess about them.
 *
 *  A leg that states neither is not counted. No field, no claim. */
export function spansNight(b: Booking): boolean {
  if (b.kind === 'flight') return b.arrDayOffset >= 1;
  const dep = 'dep' in b ? b.dep : undefined;
  const arr = 'arr' in b ? b.arr : undefined;
  return !!dep && !!arr && arr < dep;
}

/**
 * The parts of a day that the BOOKINGS have already spoken for — the other
 * half of the input to logic/timeline.ts § freeBlocks, beside the day's own
 * timed prose.
 *
 * A flight at 13:50 is the most fixed point a day can have, and a "free
 * afternoon" drawn straight through it would be the app inventing time the
 * traveller does not own. So every booking that states a clock puts a point on
 * the day, and every booking that states none puts nothing:
 *
 *   · a MOVE with a `dep` occupies dep → arr where its own arrival is later
 *     the same day, and is an instant where the clock wrapped past midnight
 *     (the leg is then handled as the arrival case below, on the day it lands);
 *   · an ACTIVITY with a `time` — the concert, the guided day — is an instant,
 *     because nothing in the record says how long it runs;
 *   · a leg that LANDS on this day from the day before occupies the day from
 *     midnight to its stated arrival: you are aboard it, and the morning is
 *     not yours until it opens the door;
 *   · a stay's check-in states no hour anywhere in this trip's data, so it is
 *     NOT a point. Pinning a plausible 14:00 to it would be exactly the kind
 *     of invented fact §RULES 2 forbids.
 *
 * Cancelled and `alternative` bookings are excluded by the same `live()` test
 * the rest of this module uses — a journey that will not happen cannot eat an
 * afternoon.
 */
export function bookingFixedPoints(bookings: Booking[], date: ISODate): FixedPoint[] {
  const out: FixedPoint[] = [];
  for (const b of bookings) {
    if (!live(b)) continue;
    const dep = 'dep' in b ? b.dep : undefined;
    const arr = 'arr' in b ? b.arr : undefined;
    const depM = dep ? timeMinutes(dep) : null;
    const arrM = arr ? timeMinutes(arr) : null;
    const here = compareIso(b.date, date) === 0;

    if (MOVES.has(b.kind) && here && depM !== null) {
      const sameDay = arrM !== null && arrM > depM && !spansNight(b);
      out.push({
        start: depM,
        ...(sameDay ? { end: arrM } : {}),
        label: b.title,
        ...(b.coord ? { coord: b.coord } : {}),
      });
      continue;
    }
    /* A leg that lands here, having left yesterday (or the day before). */
    if (MOVES.has(b.kind) && spansNight(b) && arrM !== null) {
      const offset = b.kind === 'flight' ? b.arrDayOffset : 1;
      if (compareIso(addDays(b.date, offset), date) === 0) {
        out.push({ start: 0, end: arrM, label: b.title, ...(b.coord ? { coord: b.coord } : {}) });
      }
      continue;
    }
    if (b.kind === 'activity' && here && b.time) {
      const t = timeMinutes(b.time);
      if (t !== null) out.push({ start: t, label: b.title, ...(b.coord ? { coord: b.coord } : {}) });
    }
  }
  return out;
}

/** The overnight leg the night of `date` is spent aboard, or null when the
    night is spent somewhere with a bed in it. */
export function nightInTransit(bookings: Booking[], date: ISODate): Booking | null {
  return (
    bookings.find(
      (b) => MOVES.has(b.kind) && live(b) && compareIso(b.date, date) === 0 && spansNight(b),
    ) ?? null
  );
}

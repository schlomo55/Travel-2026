/* WHAT CLOCK IS THE TRAVELLER LIVING BY? (Reminders, Part 1)

   A reminder is a moment, and a phone schedules moments as instants. The trip
   writes times the way people do, as wall-clock times in whatever place the
   traveller will be standing: "22 Nov 09:30, change the cash at Daxing" is
   Beijing time, even when it is typed in Tel Aviv in October. Read in the
   phone's own zone at the moment of scheduling, it would ring six hours late,
   after the 15:00 flight to Yantai had already left.

   THE ANCHOR IS THE PHONE, NOW. Android moves the phone's clock when it lands,
   so the phone's current offset is the one fact about "where am I" the app
   can trust. Everything else is walked out from it along the legs, using the
   same proven shift zones.ts draws its chips from:

       shift = (arrival + dayOffset) − departure − duration

   A leg that crosses no zone (every mainland leg) shifts by 0. A ground leg
   with no printed duration (a bus, "~4–5 h") is taken as 0 too: ground legs on
   a trip do not change zones, and a guessed hour is not better than none. A
   FLIGHT with no provable duration breaks the chain: the moments beyond it
   return null, and the caller falls back to the phone's own clock and re-plans
   at the next open, when the phone itself knows.

   ONCE A LEG HAS DEPARTED, THE TRAVELLER LIVES IN ITS ARRIVAL ZONE. People
   write in-flight and landing-side times in destination time: EY888 leaves
   Abu Dhabi 21:20 on 21 Nov and lands 08:45 on 22 Nov, and the trip's
   "22 Nov 09:30" is Beijing time.

   Pure: the phone's offset comes in as a function, so the tests can stand the
   phone in Tel Aviv, in Beijing, or on either side of a DST change. */
import type { Booking, HHMM, ISODate } from '../model/types';
import { compareClock, compareIso } from './dates';
import { hhmmToMinutes, parseDurationMinutes } from './zones';

/** Minutes east of UTC at a given instant (Tel Aviv in November: +120). */
export type OffsetAt = (utcMs: number) => number;

/** The phone's own zone, the way a browser reports it. */
export const deviceOffsetAt: OffsetAt = (utcMs) => -new Date(utcMs).getTimezoneOffset();

export interface ZoneLeg {
  date: ISODate;
  dep: HHMM;
  shift: number | null;
  /** The printed flying time, when it can be read. */
  flyingMin: number | null;
}

const MOVES = new Set(['flight', 'train', 'other']);

/** The legs that move the traveller, in departure order. A cancelled leg did
    not happen and an `alternative` is the road not taken; neither moves
    anyone's clock. */
export function zoneLegs(bookings: Booking[]): ZoneLeg[] {
  const out: ZoneLeg[] = [];
  for (const b of bookings) {
    if (!MOVES.has(b.kind) || b.status === 'cancelled' || b.alternative) continue;
    if (!('dep' in b) || !b.dep || hhmmToMinutes(b.dep) === null) continue;
    out.push({ date: b.date, dep: b.dep, shift: legShift(b), flyingMin: parseDurationMinutes('duration' in b ? b.duration : undefined) });
  }
  return out.sort((a, b) => compareIso(a.date, b.date) || compareClock(a.dep, b.dep));
}

/** The zone change a leg makes, in minutes, or null when it cannot be proven. */
export function legShift(b: Booking): number | null {
  if (!('dep' in b)) return 0;
  const dep = hhmmToMinutes(b.dep);
  const arr = hhmmToMinutes(b.arr);
  const flying = parseDurationMinutes(b.duration);
  if (dep === null || arr === null || flying === null) return b.kind === 'flight' ? null : 0;
  const dayOffset = b.kind === 'flight' ? b.arrDayOffset : arr < dep ? 1 : 0;
  const shift = arr + dayOffset * 1440 - dep - flying;
  /* Under half an hour is a rounded duration, not a zone; a zone is always a
     whole quarter-hour. The same rules zones.ts uses for its chips. */
  if (Math.abs(shift) < 30) return 0;
  return shift % 15 === 0 ? shift : null;
}

/** The instant a wall-clock moment is, in a zone `offset` minutes east of UTC. */
export function instantAt(date: ISODate, time: HHMM, offset: number): number {
  const y = Number(date.slice(0, 4));
  const mo = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const mins = hhmmToMinutes(time) ?? 0;
  return Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60) - offset * 60_000;
}

/** The phone's offset for a wall-clock moment read in the phone's own zone
    (settled twice, so a moment next to a DST change lands on the right side). */
function localOffset(date: ISODate, time: HHMM, offsetAt: OffsetAt): number {
  let off = offsetAt(instantAt(date, time, 0));
  off = offsetAt(instantAt(date, time, off));
  return off;
}

/**
 * The traveller's clocks along the trip: segment k is the time between leg
 * k−1 departing and leg k departing (segment 0 is before the first leg).
 * Each entry is that segment's offset, `null` where the chain cannot prove
 * it, and `'home'` for segment 0 while the phone is still at home: that one
 * follows the phone through DST changes.
 */
export interface ZonePlan {
  legs: ZoneLeg[];
  offsets: (number | null | 'home')[];
  offsetAt: OffsetAt;
  /** Set while the phone is still at home: the home offset at the first
      departure, for the caller to remember (see HomeAnchor). */
  homeAnchor: HomeAnchor | null;
}

/**
 * THE HOME OFFSET, REMEMBERED. Once the trip is under way the phone's clock
 * is a weak witness: in the air, and for a while after landing, it still
 * shows the zone it left. So while the phone is still at home the plan
 * records the home offset at the first departure, and every plan made after
 * that walks the whole trip out from it, whatever the phone says. Keyed by
 * the first departure, so an edited trip is never read against a stale one.
 */
export interface HomeAnchor {
  firstDep: string;
  offset: number;
}

const HOUR_MS = 3_600_000;

export function zonePlan(
  bookings: Booking[],
  nowMs: number,
  offsetAt: OffsetAt = deviceOffsetAt,
  anchor: HomeAnchor | null = null,
): ZonePlan {
  const legs = zoneLegs(bookings);
  const n = legs.length;
  if (n === 0) return { legs, offsets: ['home'], offsetAt, homeAnchor: null };
  const firstDep = `${legs[0]!.date} ${legs[0]!.dep}`;

  /* forward from a known segment 0 */
  const chainFrom0 = (o0: number): (number | null)[] => {
    const o: (number | null)[] = [o0];
    for (let j = 0; j < n; j++) {
      const cur = o[j] ?? null;
      const s = legs[j]!.shift;
      o.push(cur === null || s === null ? null : cur + s);
    }
    return o;
  };

  /* 1. Still at home: the phone's own clock is the home clock. */
  const homeAtFirst = localOffset(legs[0]!.date, legs[0]!.dep, offsetAt);
  if (nowMs < instantAt(legs[0]!.date, legs[0]!.dep, homeAtFirst)) {
    const o = chainFrom0(homeAtFirst);
    return {
      legs,
      offsets: ['home', ...o.slice(1)],
      offsetAt,
      homeAnchor: { firstDep, offset: homeAtFirst },
    };
  }

  /* 2. On the road, with the home offset remembered: walk it out. */
  if (anchor && anchor.firstDep === firstDep) {
    return { legs, offsets: chainFrom0(anchor.offset), offsetAt, homeAnchor: null };
  }

  /* 3. On the road with nothing remembered (installed mid-trip): ask which
     segment the phone's clock can belong to. */
  const here = offsetAt(nowMs);
  const offsetsIf = (k: number): (number | null)[] => {
    const o: (number | null)[] = new Array(n + 1).fill(null);
    o[k] = here;
    for (let j = k; j < n; j++) {
      const cur = o[j] ?? null;
      const s = legs[j]!.shift;
      o[j + 1] = cur === null || s === null ? null : cur + s;
    }
    for (let j = k - 1; j >= 0; j--) {
      const nxt = o[j + 1] ?? null;
      const s = legs[j]!.shift;
      o[j] = nxt === null || s === null ? null : nxt - s;
    }
    return o;
  };
  const depAt = (j: number, off: number): number => instantAt(legs[j]!.date, legs[j]!.dep, off);

  /* 3a. The phone already shows the zone of the segment it is in. */
  for (let k = 1; k <= n; k++) {
    const o = offsetsIf(k);
    const prev = o[k - 1];
    /* ...and only once leg k−1 has actually LANDED under that reading: a
       phone still on the old zone would otherwise pass for one already on
       the new zone, one leg later. */
    const flying = legs[k - 1]!.flyingMin ?? 0;
    const afterPrev = prev === null || prev === undefined ? true : nowMs >= depAt(k - 1, prev) + flying * 60_000;
    const beforeNext = k === n || nowMs < depAt(k, here);
    if (afterPrev && beforeNext) return { legs, offsets: o, offsetAt, homeAnchor: null };
  }
  /* 3b. The phone still shows the zone it left: in the air, or just landed
     before Android caught up. Latest leg first, so a short early leg cannot
     claim a long later one. */
  for (let k = n; k >= 1; k--) {
    const leg = legs[k - 1]!;
    const left = depAt(k - 1, here);
    const flying = leg.flyingMin ?? 12 * 60;
    if (nowMs >= left && nowMs < left + flying * 60_000 + 6 * HOUR_MS) {
      /* the phone's clock is leg k−1's origin: walk from there, and the
         traveller (already departed) lives in segment k */
      return { legs, offsets: offsetsIf(k - 1), offsetAt, homeAnchor: null };
    }
  }
  /* 4. Nothing fits: prove nothing. The caller uses the phone's own clock
     and re-plans at the next open. */
  return { legs, offsets: new Array(n + 1).fill(null), offsetAt, homeAnchor: null };
}

/** The offset (minutes east of UTC) the traveller lives by at a wall-clock
    moment, or null when the trip cannot prove it. */
export function offsetFor(plan: ZonePlan, date: ISODate, time: HHMM): number | null {
  const { legs, offsets, offsetAt } = plan;
  let seg = 0;
  for (let j = 0; j < legs.length; j++) {
    /* Compare in the clock the traveller holds just before leg j: the moment
       and the departure are both wall-clock times in that one zone, so the
       comparison is plain calendar order. */
    /* The departure minute itself still belongs to the ground the leg
       leaves: "EY608 at 14:00" is Tel Aviv's 14:00. */
    const leg = legs[j]!;
    const c = compareIso(date, leg.date) || compareClock(time, leg.dep);
    if (c > 0) seg = j + 1;
    else break;
  }
  const o = offsets[seg];
  if (o === 'home') return localOffset(date, time, offsetAt);
  return o ?? null;
}

/** The instant to ring at, or null when the zone cannot be proven. */
export function instantFor(plan: ZonePlan, date: ISODate, time: HHMM): number | null {
  const off = offsetFor(plan, date, time);
  return off === null ? null : instantAt(date, time, off);
}

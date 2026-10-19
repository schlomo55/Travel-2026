/* LEAVE BY (TripIt's "Go Now", done offline) — for each BOOKED flight or
   train with a date and a departure time: when to walk out of last night's
   bed so that you stand at the departure point a buffer before it leaves.

       leave by = departure − buffer − the taxi there (≈, logic/dayroute.ts)

   ONLY WHAT THE TRIP PROVES. Both ends need a position the trip already
   carries — never a guessed one — or there is no leave-by at all:
   · the START is the bed whose nights hold the night before (checkIn ≤
     date − 1 < checkOut, the rule mapplaces' isTonight uses), drawn where the
     Map tab draws it (`coord ?? pin`, logic/mapdrawn.ts). Two live beds on
     that night, or none, or one with no position: none.
   · the END is the booking's own `coord` (a flight carries its departure
     airport's), or, for a train, the ONE station its from-end names with a
     coordinate (a RailStation is a driver card or a spot borrowed whole). Two
     stations ("Beijing North / Qinghe") is a choice not made: none.
   · the traveller must be starting from that bed: a leg that is not the
     day's first departure, that leaves after another leg landed that same
     day, or that leaves the airport a flight landed at within
     CONNECTION_MINUTES (EY609 after EY871, across midnight) starts elsewhere.
   · the ride must be one dayroute.ts estimates: past its FAR_METRES a leg is
     not a taxi ride it will put a number on, so neither will this.

   THE RIDE IS A TAXI, forced. The default mode would make a 1.5 km leg a walk
   (the Kunming airport ibis), and nobody walks to a terminal with the bags;
   the estimate is the one the Day view shows for a taxi, "≈" and all.

   EVERY CLOCK HERE IS THE DEPARTURE'S OWN WALL CLOCK, the way the trip writes
   it (logic/dates.ts: local-naive dates, never `new Date('YYYY-MM-DD')`). The
   reminders turn it into an instant through the trip's zone plan; the screens
   print it as written.

   Derived, never stored: no rows, nothing to back up, nothing to migrate.
   Pure: bookings in, leave-bys out. */
import type { Booking, Coord, FlightBooking, HHMM, HotelBooking, ISODate, TrainBooking } from '../model/types';
import { addDays, compareClock, daysBetween } from './dates';
import { rideEstimate, type Leg } from './dayroute';
import { placePos } from './mapdrawn';
import { legLabel } from './metroline';
import { legShift } from './tripzone';
import { hhmmToMinutes, minutesToHhmm } from './zones';

/* the ride's "≈ 40 min", the Day view's own words — for the screens that load this lazily */
export { minutesText } from './dayroute';

/** Minutes at the airport before an international flight (Hong Kong, Macau
    and Taiwan included: their own border, China's clock). */
export const BUFFER_INTL_FLIGHT = 180;
/** Before a domestic flight — Chinese domestic check-in shuts 45 min before
    departure (the trip's own notes); two hours is the airlines' advice. */
export const BUFFER_DOMESTIC_FLIGHT = 120;
/** Before a train: security and the gate close a few minutes before. */
export const BUFFER_TRAIN = 45;
/** A leg leaving within this long of another leg's arrival is a connection. */
export const CONNECTION_MINUTES = 8 * 60;
/** Leave-by is rounded DOWN to this many minutes: earlier, never later. */
export const ROUND_TO = 5;

/* Same set notify.ts keeps for its own lead (not imported: notify is not
   in the start-up chunk and this must not drag it there). */
const OWN_BORDER = new Set(['HKG', 'MFM', 'TPE', 'TSA', 'KHH', 'RMQ']);

export type LeaveLeg = FlightBooking | TrainBooking;

export interface LeaveBy {
  booking: LeaveLeg;
  /** "CA 8609", "G 123" */
  label: string;
  /** where you are going: the airport code, else the station's own name */
  place: string;
  /** the departure, as the booking writes it */
  depDate: ISODate;
  dep: HHMM;
  /** leave by — the departure's wall clock; the day before for an early leg */
  date: ISODate;
  time: HHMM;
  /** minutes from leave-by to departure: buffer + ride + the rounding */
  ahead: number;
  buffer: number;
  /** the taxi, from dayroute.ts — `leg.minutes` is the ≈ figure */
  leg: Leg;
  bed: HotelBooking;
}

const live = (b: Booking): boolean => b.status !== 'cancelled' && !b.alternative;
const isLeg = (b: Booking): b is LeaveLeg | Extract<Booking, { kind: 'other' }> =>
  b.kind === 'flight' || b.kind === 'train' || b.kind === 'other';
const depOf = (b: Booking): HHMM | null =>
  'dep' in b && typeof b.dep === 'string' && hhmmToMinutes(b.dep) !== null ? b.dep : null;

export function isInternational(b: FlightBooking): boolean {
  return legShift(b) !== 0 || OWN_BORDER.has(b.from.code) || OWN_BORDER.has(b.to.code);
}

export function bufferFor(b: LeaveLeg): number {
  if (b.kind === 'train') return BUFFER_TRAIN;
  return isInternational(b) ? BUFFER_INTL_FLIGHT : BUFFER_DOMESTIC_FLIGHT;
}

/** The bed of the night before `date`, when exactly one live stay holds it. */
export function bedBefore(bookings: Booking[], date: ISODate): HotelBooking | null {
  const night = addDays(date, -1);
  const beds = bookings.filter(
    (b): b is HotelBooking =>
      b.kind === 'hotel' && live(b) && b.status !== 'pending' && night >= b.checkIn && night < b.checkOut,
  );
  return beds.length === 1 ? beds[0]! : null;
}

/** Where the leg leaves from, when the trip proves it. */
function departurePoint(b: LeaveLeg): { pos: Coord; place: string } | null {
  if (b.kind === 'flight') {
    const pos = placePos({ coord: b.coord });
    return pos ? { pos, place: b.from.code } : null;
  }
  const st = b.from.stations ?? [];
  if (st.length !== 1) return null;
  const pos = placePos({ coord: st[0]!.coord });
  return pos ? { pos, place: st[0]!.name } : null;
}

/** Minutes since `ref` 00:00 of a wall-clock moment (same zone assumed). */
const wallMinutes = (ref: ISODate, date: ISODate, time: HHMM): number => daysBetween(ref, date) * 1440 + hhmmToMinutes(time)!;

function arrivalOf(b: Booking): { date: ISODate; time: HHMM } | null {
  const dep = depOf(b);
  const arr = 'arr' in b && typeof b.arr === 'string' && hhmmToMinutes(b.arr) !== null ? b.arr : null;
  if (!dep || !arr) return null;
  if (b.kind === 'flight') return { date: addDays(b.date, b.arrDayOffset), time: arr };
  return { date: compareClock(arr, dep) < 0 ? addDays(b.date, 1) : b.date, time: arr };
}

/** Does the traveller start this leg from last night's bed? */
function startsFromBed(b: LeaveLeg, dep: HHMM, legs: Booking[]): boolean {
  const at = wallMinutes(b.date, b.date, dep);
  for (const o of legs) {
    if (o.id === b.id) continue;
    const od = depOf(o);
    /* another departure earlier that day — or one that day with no time,
       whose order nobody can prove */
    if (o.date === b.date && (!od || compareClock(od, dep) < 0)) return false;
    const arr = arrivalOf(o);
    if (!arr) continue;
    const gap = at - wallMinutes(b.date, arr.date, arr.time);
    /* arrived this very day, before it leaves (an overnight train, a morning
       landing) — or a connection at the same airport, across midnight too */
    if (arr.date === b.date && gap >= 0) return false;
    const sameGround = o.kind === 'flight' && b.kind === 'flight' && o.to.code === b.from.code;
    if (sameGround && gap >= 0 && gap <= CONNECTION_MINUTES) return false;
  }
  return true;
}

/** The leave-by of one booking, or null when the trip cannot prove it. */
export function leaveByOf(b: Booking, bookings: Booking[]): LeaveBy | null {
  if ((b.kind !== 'flight' && b.kind !== 'train') || b.status !== 'booked' || b.alternative) return null;
  const dep = depOf(b);
  if (!dep) return null;
  const end = departurePoint(b);
  if (!end) return null;
  const bed = bedBefore(bookings, b.date);
  const from = bed ? placePos(bed) : undefined;
  if (!bed || !from) return null;
  if (!startsFromBed(b, dep, bookings.filter((o) => isLeg(o) && live(o)))) return null;
  /* a road transfer, not a day's leg: rideEstimate ignores the day view's
     FAR cut-off, so an airport like Daxing (~45 km out) still gets its ride */
  const ride = rideEstimate(from, end.pos, 'taxi');
  if (!ride || !(ride.minutes > 0)) return null;
  const leg: Leg = { fromId: bed.id, toId: b.id, metres: ride.metres, mode: 'taxi', minutes: ride.minutes, chosen: true, far: false };
  const buffer = bufferFor(b);
  const raw = hhmmToMinutes(dep)! - buffer - leg.minutes;
  const leave = Math.floor(raw / ROUND_TO) * ROUND_TO;
  const days = Math.floor(leave / 1440);
  return {
    booking: b,
    label: legLabel(b),
    place: end.place,
    depDate: b.date,
    dep,
    date: addDays(b.date, days),
    time: minutesToHhmm(leave),
    ahead: hhmmToMinutes(dep)! - leave,
    buffer,
    leg,
    bed,
  };
}

/** Every leave-by the trip can prove, in departure order. */
export function leaveBys(bookings: Booking[]): LeaveBy[] {
  const out: LeaveBy[] = [];
  for (const b of bookings) {
    const l = leaveByOf(b, bookings);
    if (l) out.push(l);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : compareClock(a.time, b.time)));
}

/** "2 h", "45 min", "1 h 30" — a buffer is a rule, not an estimate: no "≈". */
export function bufferText(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

/* ---------- the To-do timeline ---------- */

export interface LeaveItem {
  kind: 'leave';
  id: string;
  time: HHMM;
  leave: LeaveBy;
}

/** Fold the leave-bys from `now` on into the To-do days, each at its time.
    The days' own items are untouched; a day only a leave-by falls on is added. */
export function withLeaves<T extends { time?: string }>(
  days: { date: ISODate; items: T[] }[],
  leaves: LeaveBy[],
  now: ISODate,
): { date: ISODate; items: (T | LeaveItem)[] }[] {
  const map = new Map<ISODate, (T | LeaveItem)[]>(days.map((d) => [d.date, [...d.items]]));
  for (const l of leaves) {
    if (l.date < now) continue;
    const list = map.get(l.date) ?? [];
    /* in clock order among the timed: before the first item that is later */
    const i = list.findIndex((x) => !x.time || compareClock(x.time, l.time) > 0);
    list.splice(i < 0 ? list.length : i, 0, { kind: 'leave', id: `leave:${l.booking.id}`, time: l.time, leave: l });
    map.set(l.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, items]) => ({ date, items }));
}

/* ---------- the reminder ---------- */

/** The plan entry the retimer needs — the shape of notify.ts's Planned. */
interface PlannedLike {
  id: number;
  at: number;
  title: string;
  body: string;
  wall: { date: ISODate; time: HHMM };
}

/**
 * Move each leg's "leave for the airport/station" reminder (notify.ts, id
 * `leave:<booking>`) to its leave-by, and add a heads-up `lead` minutes
 * before it (id `leave-soon:<booking>`, the alarms' heads-up rule). The
 * instant shifts by the wall-clock difference from the planned moment, so
 * the zone stays the one notify.ts proved. A leave-by already past drops the
 * reminder; a leg without a leave-by keeps notify's own. Ids are stable, so
 * a re-plan replaces and never doubles; a cancelled booking, or the legs
 * switch off, has no `leave:` entry to move, so nothing rings for it.
 */
export function retimeLeaves<P extends PlannedLike>(
  plan: P[],
  leaves: LeaveBy[],
  opts: {
    idOf: (key: string) => number;
    lead: number;
    now: number;
    title: (l: LeaveBy) => string;
    soon: (l: LeaveBy, lead: number) => string;
    body: (l: LeaveBy, was: string) => string;
  },
): P[] {
  const out = [...plan];
  for (const l of leaves) {
    const i = out.findIndex((x) => x.id === opts.idOf(`leave:${l.booking.id}`));
    if (i < 0) continue;
    const was = out[i]!;
    const shift = wallMinutes(was.wall.date, l.date, l.time) - wallMinutes(was.wall.date, was.wall.date, was.wall.time);
    const at = was.at + shift * 60_000;
    if (at <= opts.now) {
      out.splice(i, 1);
      continue;
    }
    const body = opts.body(l, was.body);
    out[i] = { ...was, at, title: opts.title(l), body, wall: { date: l.date, time: l.time } };
    if (opts.lead > 0 && at - opts.lead * 60_000 > opts.now) {
      const m = hhmmToMinutes(l.time)! - opts.lead;
      out.push({
        ...was,
        id: opts.idOf(`leave-soon:${l.booking.id}`),
        at: at - opts.lead * 60_000,
        title: opts.soon(l, opts.lead),
        body,
        wall: { date: addDays(l.date, Math.floor(m / 1440)), time: minutesToHhmm(m) },
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

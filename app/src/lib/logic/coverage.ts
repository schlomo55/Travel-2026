/* IS THIS PART OF THE TRIP ACTUALLY BOOKED?

   Plans could tell you where you sleep and, since connectors.ts, how you get
   there — but never in one glance whether any of it is HELD. The facts were all
   on the page and each of them was one tap away inside a different card: a bed
   is a stay booking, a move is a connector, and "no bed at all" was drawn as
   nothing whatsoever. A blank is the one thing a traveller cannot check.

   THIS FILE DERIVES, IT DOES NOT STORE. No new field, no new entity: a
   segment's status is a function of the stops and the bookings that already
   exist, so it can never drift from them, and the moment the owner books the
   Yantai bed the chip flips by data alone.

   EVERY NIGHT OF THE TRIP BELONGS TO EXACTLY ONE SEGMENT — that is the whole
   point, and the reason the window is NOT simply the stop's own [start, end).
   Nov 22 is the case that proves it: the academy takes arrivals on Mon/Tue/Wed
   only, so the Kunyu stop begins on the 23rd, and the night of the 22nd — on
   the ground in Yantai city, with nothing booked — belonged to no stop at all.
   A coverage model that walked stop windows would have reported the one truly
   bedless night on the trip as perfectly fine. So a segment answers for every
   night from the moment the PREVIOUS stop released you until its own end, and
   the trip's first night is answered for by the first stop of any kind. The
   transit pseudo-stop takes part in that hand-off (it owns the night in the
   air) and is never itself reported, because it is a phase and not a place.

   THREE ABSENCES THAT ARE NOT HOLES, and conflating them would teach the reader
   to skip the colour:
     · a WALK-IN bed is a decision, not a gap (the gorge guesthouse says "do NOT
       pre-book") — covered, and still named as a walk-in;
     · a night spent aboard an overnight leg has nobody to book it with — the
       same reasoning stamps.ts already applies on Home;
     · a leg with a card and no reservation is PLANNED, which is what the Tiger
       Leaping Gorge bus and the shared car out of it will always be: walk-up,
       no advance sale, printed on their own cards. Pending, never a gap.

   The one real gap on this trip is Dec 5, Yantai → Beijing, where neither the
   flight nor the train has been bought — connectors.ts already calls that
   `none`, and this file only counts it.

   Pure: stops, bookings and a date in, values out. No DOM, no Dexie. */
import type { Booking, HotelBooking, ISODate, Stop, Trip } from '../model/types';
import { addDays, compareIso, daysBetween } from './dates';
import { nightInTransit } from './commitment';
import { isLive as live } from './booked';
import { buildConnectors, type Connector, type ConnectorState } from './connectors';
import type { Stamp } from './stamps';

/** China sells rail tickets ~15 days out and rooms go in a week; a hole this
    close stops being a to-do and becomes the thing to fix today. The trip's own
    rule of thumb, stated once as a constant rather than guessed per venue. */
export const BOOKING_WINDOW_DAYS = 7;

/** A corrupt end date must not spin the loop that walks a segment's nights.
    No real trip segment is longer than this; a longer one is bad data. */
const MAX_NIGHTS = 400;

/** What a single night of the trip is worth saying about. */
export type NightState =
  /** A reservation is held for it. */
  | 'booked'
  /** A bed chosen deliberately without one — a plan, not a gap. */
  | 'walkin'
  /** A stay exists for it and is not held yet. */
  | 'pending'
  /** Spent aboard an overnight leg: nobody could book it. */
  | 'transit'
  /** Nothing covers it at all. */
  | 'missing';

/** ok · something is unheld · something is absent. */
export type CoverState = 'ok' | 'pending' | 'missing';
/** The Lantern treatment the chip wears. */
export type CoverTone = 'ok' | 'warn' | 'crit';

export interface CoveredNight {
  date: ISODate;
  state: NightState;
  /** The stay that covers it, or the overnight leg it is spent aboard. */
  booking: Booking | null;
}

export interface CoveredLeg {
  /** 'in' — how you get to this stop. 'out' — how you leave it. */
  role: 'in' | 'out';
  connector: Connector;
  state: ConnectorState;
}

export interface SegmentCoverage {
  stopId: string;
  /** The first night this segment answers for. */
  from: ISODate;
  /** The morning it hands over — exclusive, like a stop's own window. */
  end: ISODate;
  nights: CoveredNight[];
  legs: CoveredLeg[];
  bedsMissing: number;
  bedsPending: number;
  legsMissing: number;
  legsPending: number;
  /** bedsPending + legsPending, and the same for missing — what the chip counts. */
  pending: number;
  missing: number;
  state: CoverState;
  tone: CoverTone;
}

/* Cancelled is not a plan and an `alternative` is the OTHER way of doing
   something already listed — counting either would make a bed appear twice or
   a cancelled room read as a held one. Excluded everywhere in this file, by
   the one rule (booked.ts isLive). */

/** Best-held first, so an overlapping pending stay can never mask a booked one. */
const STAY_RANK: Record<string, number> = { booked: 0, walkin: 1, pending: 2 };

function coversNight(b: HotelBooking, date: ISODate): boolean {
  return compareIso(b.checkIn, date) <= 0 && compareIso(date, b.checkOut) < 0;
}

/** A leg's contribution: held, unheld-but-carded, or nothing at all. */
function legWeight(state: ConnectorState): 'ok' | 'pending' | 'missing' {
  if (state === 'booked') return 'ok';
  if (state === 'none') return 'missing';
  return 'pending';
}

/** Warn by default; crit only while the hole is still fixable and near.
 *
 *  "Still fixable" is the half that stops the app crying wolf: a segment that
 *  has already ENDED cannot be booked any more, so an unbooked night in the
 *  past stays amber — true, and no longer urgent. A segment you are inside, or
 *  one that starts within the booking window, goes red. */
function toneOf(state: CoverState, seg: { from: ISODate; end: ISODate }, now: ISODate | null): CoverTone {
  if (state === 'ok') return 'ok';
  if (
    state === 'missing' &&
    now &&
    compareIso(now, seg.end) < 0 &&
    daysBetween(now, seg.from) <= BOOKING_WINDOW_DAYS
  ) {
    return 'crit';
  }
  return 'warn';
}

/**
 * One segment per real stop, in trip order, each answering for every night from
 * the previous stop's hand-over to its own end plus the moves in and out of it.
 */
export function buildCoverage(
  trip: Pick<Trip, 'start' | 'end'>,
  stops: Stop[],
  bookings: Booking[],
  now: ISODate | null = null,
): SegmentCoverage[] {
  const all = [...stops].sort((a, b) => compareIso(a.start, b.start) || a.order - b.order);
  if (!all.length) return [];

  const stays = bookings
    .filter((b): b is HotelBooking => b.kind === 'hotel' && live(b))
    .sort((a, b) => (STAY_RANK[a.status] ?? 9) - (STAY_RANK[b.status] ?? 9));

  const conns = buildConnectors(stops, bookings, trip);
  const into = new Map<string, Connector>();
  const outOf = new Map<string, Connector>();
  for (const c of conns) {
    if (c.toStopId && !into.has(c.toStopId)) into.set(c.toStopId, c);
    if (c.fromStopId && !outOf.has(c.fromStopId)) outOf.set(c.fromStopId, c);
  }

  const out: SegmentCoverage[] = [];
  /* Where the last stop released you. The trip's own first day seeds it, so no
     night between landing and the first bed can fall between the cracks. */
  let cursor: ISODate = compareIso(trip.start, all[0]!.start) < 0 ? trip.start : all[0]!.start;

  for (const s of all) {
    const from = compareIso(cursor, s.end) < 0 ? cursor : s.start;
    cursor = compareIso(cursor, s.end) > 0 ? cursor : s.end;
    if (s.kind !== 'stop') continue;

    const nights: CoveredNight[] = [];
    let d = from;
    for (let i = 0; i < MAX_NIGHTS && compareIso(d, s.end) < 0; i++) {
      const stay = stays.find((b) => coversNight(b, d));
      if (stay) {
        nights.push({
          date: d,
          state: stay.status === 'pending' ? 'pending' : stay.status === 'walkin' ? 'walkin' : 'booked',
          booking: stay,
        });
      } else {
        const aboard = nightInTransit(bookings, d);
        nights.push(
          aboard ? { date: d, state: 'transit', booking: aboard } : { date: d, state: 'missing', booking: null },
        );
      }
      d = addDays(d, 1);
    }

    const legs: CoveredLeg[] = [];
    const inConn = into.get(s.id);
    const outConn = outOf.get(s.id);
    if (inConn) legs.push({ role: 'in', connector: inConn, state: inConn.state });
    if (outConn) legs.push({ role: 'out', connector: outConn, state: outConn.state });

    const bedsMissing = nights.filter((n) => n.state === 'missing').length;
    const bedsPending = nights.filter((n) => n.state === 'pending').length;
    const legsMissing = legs.filter((l) => legWeight(l.state) === 'missing').length;
    const legsPending = legs.filter((l) => legWeight(l.state) === 'pending').length;
    const missing = bedsMissing + legsMissing;
    const pending = bedsPending + legsPending;
    const state: CoverState = missing > 0 ? 'missing' : pending > 0 ? 'pending' : 'ok';

    out.push({
      stopId: s.id,
      from,
      end: s.end,
      nights,
      legs,
      bedsMissing,
      bedsPending,
      legsMissing,
      legsPending,
      pending,
      missing,
      state,
      tone: toneOf(state, { from, end: s.end }, now),
    });
  }
  return out;
}

/** Keyed by stop, for a screen that draws its stops in its own order. */
export function coverageByStop(segments: SegmentCoverage[]): Map<string, SegmentCoverage> {
  return new Map(segments.map((s) => [s.stopId, s]));
}

/** A segment's verdict in one stamp — a missing bed named before a missing
    move (a ticket can be bought standing in the station; a room at midnight
    cannot), then what is still pending, else "All booked ✓".
    Since Horizon Run 3 no screen draws this stamp: Journey's route check
    (routecheck.ts) says the same facts in its own words, a row per stop and
    per move. It stays for scripts/trip-template/assert.ts, whose report prints
    one per segment — so its words live here, not in strings.ts, and nothing
    of it reaches the bundle. */
export function coverageStamp(seg: SegmentCoverage): Stamp {
  const cls = seg.tone === 'ok' ? 'ok' : seg.tone === 'crit' ? 'crit' : 'warn';
  if (seg.bedsMissing > 0) return { label: seg.bedsMissing === 1 ? '⚠ bed missing' : `⚠ ${seg.bedsMissing} beds missing`, cls };
  if (seg.legsMissing > 0) return { label: seg.legsMissing === 1 ? '⚠ move unbooked' : `⚠ ${seg.legsMissing} moves unbooked`, cls };
  if (seg.pending > 0) return { label: `${seg.pending} pending`, cls };
  return { label: 'All booked ✓', cls };
}

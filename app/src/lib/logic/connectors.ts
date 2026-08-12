/* HOW YOU GET FROM ONE STOP TO THE NEXT.

   The Plans page used to list where you sleep and say nothing about the moves
   between — a night in Lijiang, a night in the gorge, a night in Dali, and no
   answer to "how". Every one of those moves was already in the app as a flight,
   a train or (since road.ts) a road leg; none of them was on the page that
   shows the shape of the trip.

   THIS FILE DERIVES, IT DOES NOT STORE. A connector is not a new entity and
   nothing here is persisted: it is the join between two consecutive stops and
   the booking(s) already dated on the handover day. That means a connector can
   never drift from the booking it describes, and deleting a booking cannot
   leave a phantom leg behind.

   THE MATCHING RULE is the one routemap.ts already uses for its schematic map —
   a booking dated on the day you arrive at the next stop is how you travelled.
   Reused rather than reinvented, so the map and the list can never disagree
   about how a leg was made.

   TWO CASES THE NAIVE VERSION GETS WRONG, and both are real on this trip:

     Dec 11 · Chongli → Zhangjiajie is a train to Beijing AND THEN a flight.
              Two bookings, one journey, both of which have to happen. The
              connector holds both, in departure order.
     Nov 22 · PKX → Yantai is a flight OR ELSE the HSR. Also two bookings on one
              date, but only one will happen. The fallback carries
              `alternative`, and it is offered as an alternative rather than
              counted as a second hop — otherwise the page would tell you to
              catch a train you are not catching.

   A JOIN WITH NO BOOKING AT ALL IS STILL A CONNECTOR. It renders as the gap it
   is, because a blank between two stops is the thing most worth seeing: on this
   trip that is 5 Dec, Yantai → Beijing, where neither the flight nor the train
   has been bought and the choice between them is still open. */
import type { Booking, ISODate, Stop, Trip } from '../model/types';
import { compareIso } from './dates';

/** Air, rail or road — the same three the route map draws. */
export type ConnectorMode = 'air' | 'rail' | 'road' | 'unknown';

/** What the join between two stops is worth saying at a glance. */
export type ConnectorState =
  /** Every part of it is held. */
  | 'booked'
  /** At least one part is held and at least one is not — the Dec 11 case. */
  | 'partial'
  /** A card exists for every part and nothing is held yet. */
  | 'planned'
  /** No booking of any kind covers this join. */
  | 'none';

export interface Connector {
  /** Derived, stable, and keyed by the stops it joins rather than by an index. */
  id: string;
  /** Null on the arrival connector — nothing precedes getting to the country. */
  fromStopId: string | null;
  /** Null on the departure connector. */
  toStopId: string | null;
  /** The journey into the trip, or out of it, rather than between two stops. */
  edge?: 'arrive' | 'depart';
  /** The handover day — the date you arrive at the next stop. */
  date: ISODate;
  mode: ConnectorMode;
  state: ConnectorState;
  /** The journeys that make up this move, in departure order. Empty for a gap. */
  legs: Booking[];
  /** The other way of making the same journey — offered, never counted. */
  alternatives: Booking[];
  /** True when `legs` holds more than one journey, e.g. a train then a flight. */
  multiLeg: boolean;
}

/** Only the kinds that actually move you between cities. A hotel is dated on
    the same day and is emphatically not how you got there. */
const MOVES = new Set(['flight', 'train', 'other']);

function modeOf(legs: Booking[]): ConnectorMode {
  if (!legs.length) return 'unknown';
  /* A train-then-flight move is named by the part that covers the distance. */
  if (legs.some((b) => b.kind === 'flight')) return 'air';
  if (legs.some((b) => b.kind === 'train')) return 'rail';
  return 'road';
}

function stateOf(legs: Booking[]): ConnectorState {
  if (!legs.length) return 'none';
  const held = legs.filter((b) => b.status === 'booked').length;
  if (held === legs.length) return 'booked';
  if (held > 0) return 'partial';
  return 'planned';
}

/** Departure order within a move. A leg with NO stated departure sorts FIRST,
    which looks backwards until you see the case it exists for: Dec 11 is the
    unbooked HSR out of Chongli and then CA1953 at 17:00, and the train is the
    one that delivers you to the airport. Sorting the untimed leg last would
    print "fly, then catch the train to the airport". The feeder is the part
    nobody has bought yet precisely because it is the flexible half. */
function byDeparture(a: Booking, b: Booking): number {
  /* DATE FIRST, and that is not pedantry: the arrival connector spans two days
     — EY608 at 14:00 on the 21st, EY888 at 21:20, then CA8683 at 12:35 on the
     22nd. Comparing clock times alone put the last leg first and printed the
     journey home-to-academy in the wrong order. */
  const byDate = compareIso(a.date, b.date);
  if (byDate !== 0) return byDate;
  const t = (x: Booking): string =>
    ('dep' in x && typeof x.dep === 'string' && x.dep) || '00:00';
  return t(a).localeCompare(t(b));
}

/**
 * One connector per gap between consecutive stops, in trip order — plus, when
 * `trip` is given, the journey INTO the first stop and OUT of the last.
 *
 * TRANSIT PSEUDO-STOPS ARE NOT STOPS HERE. "International flights" is a phase
 * of the trip and not somewhere you go, and once the moves between cities are
 * drawn it has nothing left to be: its four Etihad legs are the arrival and
 * departure connectors. It stays in the data because it is the record of one
 * booking across four legs AND of their shared ~$2,026, which booked.ts reads
 * off `costNote` so the price is counted exactly once. Filtered from the spine,
 * kept as the receipt.
 */
export function buildConnectors(
  stops: Stop[],
  bookings: Booking[],
  trip?: Pick<Trip, 'start' | 'end'>,
): Connector[] {
  const ordered = [...stops]
    .filter((s) => s.kind !== 'transit')
    .sort((a, b) => compareIso(a.start, b.start) || a.order - b.order);

  const movable = bookings.filter(
    (b) => MOVES.has(b.kind) && b.status !== 'cancelled',
  );

  const pick = (fromDate: ISODate, toDate: ISODate): Booking[] =>
    movable.filter(
      (b) => compareIso(b.date, fromDate) >= 0 && compareIso(b.date, toDate) <= 0,
    );

  const assemble = (
    id: string,
    fromStopId: string | null,
    toStopId: string | null,
    date: ISODate,
    pool: Booking[],
    edge?: 'arrive' | 'depart',
  ): Connector => {
    const legs = pool.filter((b) => !b.alternative).sort(byDeparture);
    return {
      id,
      fromStopId,
      toStopId,
      ...(edge ? { edge } : {}),
      date,
      mode: modeOf(legs),
      state: stateOf(legs),
      legs,
      alternatives: pool.filter((b) => b.alternative).sort(byDeparture),
      multiLeg: legs.length > 1,
    };
  };

  const out: Connector[] = [];

  /* GETTING THERE. Everything dated from the trip's first day up to the day the
     first stop begins — on this trip that is EY608 + EY888 out of Tel Aviv and
     then CA8683 down to Yantai, one journey across two days with a night in the
     middle, which is exactly what it is. */
  const first = ordered[0];
  if (trip && first) {
    const pool = pick(trip.start, first.start);
    if (pool.length) {
      out.push(assemble(`conn-arrive-${first.id}`, null, first.id, trip.start, pool, 'arrive'));
    }
  }

  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i]!;
    const to = ordered[i + 1]!;

    /* THE WINDOW, not the day. Where two stops abut — the usual case — the day
       one ends is the day the next begins and this is a single date. But a move
       can straddle a night: the Etihad flights end on 22 Nov and the academy
       does not begin until the 23rd, because the academy takes arrivals on
       Mon/Tue/Wed only and 22 Nov is a Sunday. CA8683 flies on the 22nd and is
       unmistakably how you got to the 23rd. Matching `to.start` alone lost it
       and drew a gap across the trip's first move. */
    const onDay = movable.filter(
      (b) => compareIso(b.date, from.end) >= 0 && compareIso(b.date, to.start) <= 0,
    );

    out.push(assemble(`conn-${from.id}-${to.id}`, from.id, to.id, to.start, onDay));
  }

  /* GETTING HOME. Everything from the last stop's final day to the trip's end. */
  const last = ordered[ordered.length - 1];
  if (trip && last) {
    const pool = pick(last.end, trip.end);
    if (pool.length) {
      out.push(assemble(`conn-depart-${last.id}`, last.id, null, last.end, pool, 'depart'));
    }
  }
  return out;
}

/** The connector arriving at a given stop, or null for the first stop. */
export function connectorInto(connectors: Connector[], stopId: string): Connector | null {
  return connectors.find((c) => c.toStopId === stopId) ?? null;
}

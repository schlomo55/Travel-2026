/* THE ROUTE CHECK (f-journey) — the rows the Relay sweep lights, in trip
   order: every stop is a BED check, every move between two stops a LEG check,
   with the journey in at the top and the journey home at the bottom.

   It reads coverage.ts and connectors.ts and adds nothing to them: which
   nights are held and which moves are booked are their answers. What this
   file decides is how the sweep SAYS it — the Relay's three colours:

   · green  — booked (a walk-in bed and a night aboard are covered too: a
              decision and a berth, not holes);
   · amber  — not booked: a move with nothing held or only part of it held, a
              bed chosen but not held, and a missing bed that is already in
              the past (still true, and no longer something to fix);
   · red    — a bed missing on a night still ahead.

   And it counts what is STILL to do from `now` on — the sweep ends on "3 legs
   to book · 1 bed missing". A move or a night that is behind you is shown as
   it is, and never counted as a job. */
import type { Booking, ISODate, Stop, Trip } from '../model/types';
import { compareIso, fmtShort } from './dates';
import { buildCoverage, type SegmentCoverage } from './coverage';
import { buildConnectors, type Connector } from './connectors';
import { legLabel } from './metroline';
import { shortName } from './constellation';
import { realStops } from './day';
import { S } from '../i18n/strings';

export type CheckTone = 'ok' | 'warn' | 'crit';

export interface StopCheck {
  kind: 'stop';
  stop: Stop;
  tone: CheckTone;
  /** the chip's word: "Booked", "Bed missing · 22 Nov", "Walk-in" */
  word: string;
  /** tonight is spent here */
  tonight: boolean;
  /** the stop's nights are behind you */
  past: boolean;
  seg: SegmentCoverage | null;
}
export interface LegCheck {
  kind: 'leg';
  connector: Connector;
  tone: CheckTone;
  /** "Booked", "Part booked", "Not booked", "Nothing booked" */
  word: string;
  /** "HSR + CA 8609 → Zhangjiajie" */
  label: string;
  /** the move is today */
  today: boolean;
  past: boolean;
}
export type CheckRow = StopCheck | LegCheck;

export interface RouteCheck {
  rows: CheckRow[];
  /** moves from today on that are not fully booked */
  legsToBook: number;
  /** nights from today on with no bed at all */
  bedsMissing: number;
}

const LEG_WORD: Record<Connector['state'], () => string> = {
  booked: () => S.journey.leg.booked,
  partial: () => S.journey.leg.partial,
  planned: () => S.journey.leg.planned,
  none: () => S.journey.leg.none,
};

function stopCheck(stop: Stop, seg: SegmentCoverage | undefined, now: ISODate): StopCheck {
  const tonight = compareIso(now, stop.start) >= 0 && compareIso(now, stop.end) < 0;
  const past = compareIso(stop.end, now) <= 0;
  const base = { kind: 'stop' as const, stop, tonight, past, seg: seg ?? null };
  if (!seg || !seg.nights.length) return { ...base, tone: 'ok', word: S.journey.bed.none };
  const missing = seg.nights.filter((n) => n.state === 'missing');
  if (missing.length) {
    const ahead = missing.some((n) => compareIso(n.date, now) >= 0);
    const word = missing.length === 1 ? S.journey.bed.missing(fmtShort(missing[0]!.date)) : S.journey.bed.missingN(missing.length);
    return { ...base, tone: ahead ? 'crit' : 'warn', word };
  }
  const pending = seg.nights.filter((n) => n.state === 'pending').length;
  if (pending) return { ...base, tone: 'warn', word: S.journey.bed.pending(pending) };
  if (seg.nights.some((n) => n.state === 'walkin')) return { ...base, tone: 'ok', word: S.journey.bed.walkin };
  return { ...base, tone: 'ok', word: S.journey.bed.booked };
}

/** The words a move goes by on its row: the legs that make it, and where it
    ends — "HSR + CA 8609 → Zhangjiajie"; a move nothing covers is named by
    its two stops. */
export function moveLabel(c: Connector, byId: Map<string, Stop>): string {
  const to = c.toStopId ? byId.get(c.toStopId) : undefined;
  const from = c.fromStopId ? byId.get(c.fromStopId) : undefined;
  const last = c.legs[c.legs.length - 1];
  const dest = to
    ? shortName(to.name)
    : last?.kind === 'flight'
      ? (last.to.name ?? last.to.code)
      : last && 'to' in last && last.to
        ? shortName(last.to.name)
        : '';
  if (!c.legs.length) return from && to ? `${shortName(from.name)} → ${shortName(to.name)}` : dest;
  const legs = c.legs.map(legLabel).filter(Boolean).join(' + ');
  return dest ? `${legs} → ${dest}` : legs;
}

export function routeCheck(
  trip: Pick<Trip, 'start' | 'end'>,
  stops: Stop[],
  bookings: Booking[],
  now: ISODate,
): RouteCheck {
  const real = realStops(stops);
  const byId = new Map(stops.map((s) => [s.id, s]));
  const cover = new Map(buildCoverage(trip, stops, bookings, now).map((s) => [s.stopId, s]));
  const conns = buildConnectors(stops, bookings, trip);
  const into = new Map(conns.filter((c) => c.toStopId).map((c) => [c.toStopId!, c]));
  const home = conns.find((c) => c.edge === 'depart');

  /* A MOVE IS JUDGED BY ITS LEGS' OWN DATES (Run 3c). The way in is dated on
     the trip's first day, but its last leg (CA 8683) flies on the second:
     judged by the move's date it read "done" on 22 Nov with a flight still
     ahead, and an unbooked leg that day dropped out of "N legs to book". A
     move is today from its first leg's day to its last leg's day, and
     behind you only once its last leg's day is. */
  const legRow = (c: Connector): LegCheck => {
    const from = c.legs[0]?.date ?? c.date;
    const to = c.legs[c.legs.length - 1]?.date ?? c.date;
    const past = compareIso(to, now) < 0;
    return {
      kind: 'leg',
      connector: c,
      tone: c.state === 'booked' ? 'ok' : 'warn',
      word: LEG_WORD[c.state](),
      label: moveLabel(c, byId),
      today: !past && compareIso(from, now) <= 0,
      past,
    };
  };

  const rows: CheckRow[] = [];
  for (const s of real) {
    const c = into.get(s.id);
    if (c) rows.push(legRow(c));
    rows.push(stopCheck(s, cover.get(s.id), now));
  }
  if (home) rows.push(legRow(home));

  let legsToBook = 0;
  let bedsMissing = 0;
  for (const r of rows) {
    if (r.kind === 'leg') {
      if (r.tone !== 'ok' && !r.past) legsToBook++;
    } else {
      bedsMissing += r.seg?.nights.filter((n) => n.state === 'missing' && compareIso(n.date, now) >= 0).length ?? 0;
    }
  }
  return { rows, legsToBook, bedsMissing };
}

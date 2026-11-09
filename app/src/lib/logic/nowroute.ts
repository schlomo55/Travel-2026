/* THE ROUTE STRIP — the trip's stops as one line of dots, for Now's home.

   The whole trip is drawn large on Journey (logic/constellation.ts); Now only
   needs to say where in the trip you are, in one line: a dot for every stop in
   trip order, the road so far lit, the road ahead dotted, tonight's stop
   marked — or, with none (before the trip, a night in transit), the next one.
   A tap on it opens Journey.

   Pure: the stops and the day in, the line out. The same rule as the map for
   what is behind you, where you are and what is ahead (a stop is done once its
   last night is over, here from its first night until then), so the strip and
   the map can never tell two stories. A stop with no stored coordinate is
   still a dot: the strip needs an order, not a place. */
import type { ISODate, Stop } from '../model/types';
import { compareIso } from './dates';
import { realStops } from './day';
import { shortName } from './constellation';
import { S } from '../i18n/strings';

export type DotState = 'done' | 'here' | 'ahead';
export type LegState = 'done' | 'today' | 'ahead';

export interface StripDot {
  state: DotState;
  /** the stop the line points at when you are in none: the first one ahead */
  next: boolean;
  /** the road from this stop to the next one (the last stop has none to draw) */
  leg: LegState;
}

export interface RouteStrip {
  dots: StripDot[];
  /** the line under the dots: "In Hangzhou" · "Next: Shanghai" · "First stop: …" · "Trip complete" */
  where: string;
  /** "9 stops" */
  count: string;
  /** the whole strip as one sentence, for a screen reader */
  aria: string;
}

/** `arrived` — the day's line says today's travel is over (so today's leg is done). */
export function routeStrip(stops: Stop[], now: ISODate, arrived = false): RouteStrip | null {
  const real = realStops(stops);
  if (!real.length) return null;
  const states = real.map((s): DotState => (compareIso(s.end, now) <= 0 ? 'done' : compareIso(s.start, now) <= 0 ? 'here' : 'ahead'));
  const noneHere = !states.includes('here');
  const firstAhead = states.indexOf('ahead');
  const dots = real.map((_, i): StripDot => {
    const c = real[i + 1] ? compareIso(real[i + 1]!.start, now) : 1;
    return { state: states[i]!, next: noneHere && i === firstAhead, leg: c < 0 || (c === 0 && arrived) ? 'done' : c === 0 ? 'today' : 'ahead' };
  });
  /* the stop in view: tonight's, else the next one; none once the trip is over */
  const at = dots.findIndex((d) => d.state === 'here' || d.next);
  const name = (i: number): string => shortName(real[i]!.name);
  const where =
    at < 0 ? S.nowRoute.done : states[at] === 'here' ? S.nowRoute.at(name(at)) : states.includes('done') ? S.nowRoute.next(name(at)) : S.nowRoute.first(name(at));
  const count = S.shelf.stops(dots.length);
  return { dots, where, count, aria: S.nowRoute.aria(count, name(0), name(dots.length - 1), where) };
}

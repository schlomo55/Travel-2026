/* TURN-BY-TURN FOR A DAY'S LEG (demo) — the leg's destination handed to Amap
   or Google Maps (Settings › Turn-by-turn, lib/state/navApp.svelte.ts), in
   the leg's own mode. The hand-off is Guide me's own (./maps.ts): a place with
   a verified coordinate goes to the route planner on the app's datum, a place
   that opens by name to its search — never the drawn-only pin. A far leg (a
   train, ferry or flight) has no estimate and no mode, but the place it arrives
   at is still one to open in a map app — from where you are, as the first stop's
   is — so it is a destination like any other.

   WHERE IT STARTS. A leg starts at the stop before it, so the app is asked for
   THAT route, not "from where you stand": a leg can be checked the evening
   before, from another city or country (Google has no walk from Israel to Hong
   Kong; Amap would start the route in the wrong place). The first stop has no
   stop before it — its route starts from you, in no particular mode; so does a
   stop a ferry or a train brings you to. */
import type { TravelMode } from '../logic/geo';
import type { DayRoute, Leg, LegMode } from '../logic/dayroute';
import type { MapPlace } from '../logic/mapplaces';
import { openAmapRoute, openGoogleDirections } from './maps';

export const LEG_TRAVEL: Record<LegMode, TravelMode> = { walk: 'walk', taxi: 'drive', metro: 'transit' };

/** The place a leg arrives at: a stop of the route, or tonight's bed — a far
    leg's too, which is asked for with no start and no mode (see above). */
export function legDestination(route: DayRoute, l: Leg): MapPlace | null {
  if (route.bed && l.toId === route.bed.id) return route.bed;
  return route.stops.find((s) => s.id === l.toId)?.place ?? null;
}

/** The place a leg starts from: always a stop of the route. */
export function legOrigin(route: DayRoute, l: Leg): MapPlace | null {
  return route.stops.find((s) => s.id === l.fromId)?.place ?? null;
}

/** `mode` null: no leg gives one (the first stop) — Google shows the modes that
    suit the route, Amap its default; `from` null: from where you are. */
export async function openLegDirections(dest: MapPlace, mode: LegMode | null, app: 'amap' | 'google', from: MapPlace | null = null): Promise<void> {
  const travel = mode ? LEG_TRAVEL[mode] : null;
  if (app === 'amap') return openAmapRoute(dest.target, dest.native ?? dest.name, travel, from ? { target: from.target, name: from.native ?? from.name } : undefined);
  return openGoogleDirections(dest.target, travel, from?.target);
}

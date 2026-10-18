/* TURN-BY-TURN FOR A DAY'S LEG (demo) — the leg's destination handed to Amap
   or Google Maps (Settings › Turn-by-turn, lib/state/navApp.svelte.ts), in
   the leg's own mode, from wherever the traveller stands. The hand-off is
   Guide me's own (./maps.ts): a place with a verified coordinate goes to the
   route planner on the app's datum, a place that opens by name to its search
   — never the drawn-only pin. A far leg (a train, ferry or flight) has none. */
import type { TravelMode } from '../logic/geo';
import type { DayRoute, Leg, LegMode } from '../logic/dayroute';
import type { MapPlace } from '../logic/mapplaces';
import { openAmapRoute, openGoogleDirections } from './maps';

export const LEG_TRAVEL: Record<LegMode, TravelMode> = { walk: 'walk', taxi: 'drive', metro: 'transit' };

/** The place a leg arrives at: a stop of the route, or tonight's bed. */
export function legDestination(route: DayRoute, l: Leg): MapPlace | null {
  if (l.far) return null;
  if (route.bed && l.toId === route.bed.id) return route.bed;
  return route.stops.find((s) => s.id === l.toId)?.place ?? null;
}

export async function openLegDirections(dest: MapPlace, mode: LegMode, app: 'amap' | 'google'): Promise<void> {
  const travel = LEG_TRAVEL[mode];
  if (app === 'amap') return openAmapRoute(dest.target, dest.native ?? dest.name, travel);
  return openGoogleDirections(dest.target, travel);
}

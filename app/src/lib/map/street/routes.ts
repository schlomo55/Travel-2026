/* A DAY'S ROUTE AS THE MAP DRAWS IT (demo) — the lines and the numbered
   points of logic/maproute.ts's RouteDraw, as GeoJSON, and the names of the
   numbered pins' map images. Here, under lib/map/street/, so it ships in the
   map engine's chunk with the only code that reads it (the bundle gate). Pure. */
import type { RouteDraw, StopGroup } from '../../logic/maproute';

type LngLat = [number, number];

/** The map image of a numbered badge: `rt-<rrggbb>-<text>[-o][-s]` — its number(s), "3" or "1·5" (-o: optional,
    drawn quieter; -s: the chosen one). */
export function routePinName(colour: string, text: string, selected: boolean, optional = false): string {
  return `rt-${colour.replace('#', '').toLowerCase()}-${text}${optional ? '-o' : ''}${selected ? '-s' : ''}`;
}
export function parseRoutePinName(name: string): { colour: string; text: string; optional: boolean; selected: boolean } | null {
  const m = /^rt-([0-9a-f]{6})-(\d{1,3}(?:·\d{1,3}){0,19})(-o)?(-s)?$/.exec(name);
  return m?.[1] && m[2] ? { colour: `#${m[1]}`, text: m[2], optional: !!m[3], selected: !!m[4] } : null;
}

/** The lines (`k`): the stops in order, solid ('path'); a leg into or out of an optional stop, dashed and dimmed
    ('opt' — as dayroute.ts marks it); the last stop to the bed, dotted ('bed', `o: 1` when that stop is optional). */
export function routeLineData(routes: readonly RouteDraw[]) {
  type K = 'path' | 'opt' | 'bed';
  const features: { type: 'Feature'; properties: { c: string; k: K; o: number }; geometry: { type: 'LineString'; coordinates: LngLat[] } }[] = [];
  const line = (c: string, k: K, coordinates: LngLat[], o = 0): void => void features.push({ type: 'Feature', properties: { c, k, o }, geometry: { type: 'LineString', coordinates } });
  for (const r of routes) {
    const at = r.stops.map((s): LngLat => [s.lng, s.lat]);
    let run: LngLat[] = [];
    for (let i = 1; i < at.length; i++) {
      if (r.stops[i - 1]!.optional || r.stops[i]!.optional) {
        if (run.length >= 2) line(r.colour, 'path', run);
        run = [];
        line(r.colour, 'opt', [at[i - 1]!, at[i]!]);
      } else run = run.length ? [...run, at[i]!] : [at[i - 1]!, at[i]!];
    }
    if (run.length >= 2) line(r.colour, 'path', run);
    const last = at[at.length - 1];
    if (r.bed && last) line(r.colour, 'bed', [last, [r.bed.lng, r.bed.lat]], r.stops[r.stops.length - 1]!.optional ? 1 : 0);
  }
  return { type: 'FeatureCollection' as const, features };
}

/** The numbered badges, one per group of stops that share a spot at this zoom (logic/maproute.ts groupStops),
    at its first stop — the one a tap opens; the chosen place's drawn on top. `v: ''` and `label`, as a category
    pin's, so the screen keeps its words off the name under it. */
export function routeStopData(groups: readonly StopGroup[], selected: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: groups.map((g) => {
      const s = g.stops[0]!;
      const sel = g.stops.some((x) => x.id === selected);
      const optional = g.stops.every((x) => x.optional);
      return {
        type: 'Feature' as const,
        properties: { id: s.id, n: s.n, c: g.colour, label: s.label, cat: s.cat, v: '', img: routePinName(g.colour, g.text, sel, optional), k: sel ? 1000 : s.n },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as LngLat },
      };
    }),
  };
}

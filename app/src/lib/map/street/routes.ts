/* A DAY'S ROUTE AS THE MAP DRAWS IT (demo) — the lines and the numbered
   points of logic/maproute.ts's RouteDraw, as GeoJSON, and the names of the
   numbered pins' map images. Here, under lib/map/street/, so it ships in the
   map engine's chunk with the only code that reads it (the bundle gate). Pure. */
import type { RouteDraw } from '../../logic/maproute';

type LngLat = [number, number];

/** The map image of a numbered pin: `rt-<rrggbb>-<n>[-s]` (-s: the chosen one). */
export function routePinName(colour: string, n: number, selected: boolean): string {
  return `rt-${colour.replace('#', '').toLowerCase()}-${n}${selected ? '-s' : ''}`;
}
export function parseRoutePinName(name: string): { colour: string; n: number; selected: boolean } | null {
  const m = /^rt-([0-9a-f]{6})-(\d{1,3})(-s)?$/.exec(name);
  return m?.[1] && m[2] ? { colour: `#${m[1]}`, n: Number(m[2]), selected: !!m[3] } : null;
}

/** The lines: the stops in order, solid; the last stop to the bed, dotted (`k`: 'path' | 'bed'). */
export function routeLineData(routes: readonly RouteDraw[]) {
  const features: { type: 'Feature'; properties: { c: string; k: 'path' | 'bed' }; geometry: { type: 'LineString'; coordinates: LngLat[] } }[] = [];
  for (const r of routes) {
    const path = r.stops.map((s): LngLat => [s.lng, s.lat]);
    if (path.length >= 2) features.push({ type: 'Feature', properties: { c: r.colour, k: 'path' }, geometry: { type: 'LineString', coordinates: path } });
    const last = path[path.length - 1];
    if (r.bed && last) features.push({ type: 'Feature', properties: { c: r.colour, k: 'bed' }, geometry: { type: 'LineString', coordinates: [last, [r.bed.lng, r.bed.lat]] } });
  }
  return { type: 'FeatureCollection' as const, features };
}

/** The numbered pins; the chosen place's drawn on top. `v: ''` and `label`, as a category pin's, so the screen
    keeps its words off the name under it. */
export function routeStopData(routes: readonly RouteDraw[], selected: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.flatMap((r) =>
      r.stops.map((s) => {
        const sel = s.id === selected;
        return {
          type: 'Feature' as const,
          properties: { id: s.id, n: s.n, c: r.colour, label: s.label, cat: s.cat, v: '', img: routePinName(r.colour, s.n, sel), k: sel ? 1000 : s.n },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as LngLat },
        };
      }),
    ),
  };
}

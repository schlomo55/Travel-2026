/* HORIZON NIGHT — the street map's style (the spike's, 2026-09-28): the
   Protomaps basemap (@protomaps/basemaps 5.7, BSD-3-Clause; its "dark" flavor
   as the start) recoloured to Horizon and the map4-map board — land a
   night-indigo, parks green-black, water deep indigo with a faint aqua edge,
   streets in ink at low alpha, words in Figtree drawn by the phone.

   EVERY COLOUR THAT CARRIES WORDS IS A TOKEN, read here at run time from
   app.css (`--map-*`), so the contrast gate (scripts/check-contrast.mjs)
   measures exactly what the map draws — a word on the ground its halo is.
   The rest — road fills, buildings, land cover — carries no text and is
   decoration, written here as the spike measured it.

   OpenStreetMap's own points of interest stay NEUTRAL: colour on this map
   means the trip's own categories (MAPS6 — food rose, spa aqua…), never an
   OSM café. No sprite (the pins and the POI dots are drawn with addImage),
   no glyph URL (fonts.ts), no network: the only source is the map pack. */
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import { STACK } from './fonts';

/** A token's value from app.css, else the value tokens.json gives it. */
function tok(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || fallback;
}

export function palette() {
  return {
    land: tok('map-land', '#0d0f1c'),
    water: tok('map-water', '#121a38'),
    park: tok('map-park', '#0f1b17'),
    label: tok('map-label', '#8e8da6'),
    labelDim: tok('map-label-dim', '#7c7b94'),
    labelRoad: tok('map-label-road', '#9c9bb4'),
    labelCity: tok('map-label-city', '#d6d4e6'),
    labelWater: tok('map-label-water', '#7489c2'),
    labelPark: tok('map-label-park', '#86a898'),
    labelTransit: tok('map-label-transit', '#93a3d2'),
    ink: tok('ink', '#f4f2fa'),
    ink2: tok('ink-2', '#b4b3c8'),
    sky: tok('sky', '#0b0c16'),
    edge: tok('edge', '#6a7099'),
    sunrise: tok('sunrise', '#ff9f6b'),
  };
}
export type Palette = ReturnType<typeof palette>;

const CASE = '#0b0c16';
function flavor(p: Palette): Flavor {
  return {
    ...namedFlavor('dark'),
    background: p.land,
    earth: p.land,
    park_a: p.park,
    park_b: '#11201b',
    hospital: '#15132a',
    industrial: '#0f1120',
    school: '#12142a',
    wood_a: '#0e1917',
    wood_b: '#0f1c19',
    pedestrian: '#141630',
    scrub_a: '#0f1a17',
    scrub_b: '#0f1a17',
    glacier: '#1b1e36',
    sand: '#16151f',
    beach: '#17161f',
    aerodrome: '#111325',
    runway: '#1f2137',
    water: p.water,
    zoo: p.park,
    military: '#12131f',
    tunnel_other_casing: CASE,
    tunnel_minor_casing: CASE,
    tunnel_link_casing: CASE,
    tunnel_major_casing: CASE,
    tunnel_highway_casing: CASE,
    tunnel_other: '#191b2d',
    tunnel_minor: '#1c1e31',
    tunnel_link: '#22243a',
    tunnel_major: '#25273e',
    tunnel_highway: '#2b2d47',
    pier: '#1c1e31',
    buildings: '#15172c',
    minor_service_casing: CASE,
    minor_casing: CASE,
    link_casing: CASE,
    major_casing_late: CASE,
    highway_casing_late: CASE,
    other: '#1c1e31',
    minor_service: '#1e2034',
    minor_a: '#272940',
    minor_b: '#23253b',
    link: '#303250',
    major_casing_early: CASE,
    major: '#34375a',
    highway_casing_early: CASE,
    highway: '#434670',
    railway: '#3a3c58',
    boundaries: '#4a4f72',
    bridges_other_casing: CASE,
    bridges_minor_casing: CASE,
    bridges_link_casing: CASE,
    bridges_major_casing: CASE,
    bridges_highway_casing: CASE,
    bridges_other: '#1c1e31',
    bridges_minor: '#272940',
    bridges_link: '#303250',
    bridges_major: '#34375a',
    bridges_highway: '#434670',
    /* the words — every one a token, each on the ground its halo is */
    roads_label_minor: p.labelDim,
    roads_label_minor_halo: p.land,
    roads_label_major: p.labelRoad,
    roads_label_major_halo: p.land,
    ocean_label: p.labelWater,
    subplace_label: p.label,
    subplace_label_halo: p.land,
    city_label: p.labelCity,
    city_label_halo: p.land,
    state_label: p.labelDim,
    state_label_halo: p.land,
    country_label: p.label,
    address_label: p.labelDim,
    address_label_halo: p.land,
    regular: STACK.regular,
    bold: STACK.bold,
    italic: STACK.italic,
    pois: {
      blue: p.label,
      green: p.labelPark,
      lapis: p.labelTransit,
      pink: p.label,
      red: p.label,
      slategray: p.label,
      tangerine: p.label,
      turquoise: p.label,
    },
    landcover: {
      grassland: '#0f1a18',
      barren: '#12131f',
      urban_area: '#121426',
      farmland: '#0f1719',
      glacier: '#1b1e36',
      scrub: '#0f1918',
      forest: '#0e1a18',
    },
  };
}

export interface StyleOpts {
  /** pmtiles:// URL of the map pack, or null: no pack on this phone — the night canvas */
  url: string | null;
  /** the pack's zooms, so MapLibre never asks for a tile it does not have */
  minzoom?: number;
  maxzoom?: number;
  /** label language (@protomaps/basemaps): 'en' draws "English\n中文" where OSM has name:en */
  lang: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layer = any;

/** The style MapLibre is given. */
export function horizonStyle(o: StyleOpts, p: Palette = palette()): Record<string, unknown> {
  const sources: Record<string, unknown> = {};
  /* no pack: no layer at all — the canvas stays clear and the screen's own
     night ground (and its faint grid) shows through */
  let list: Layer[] = [];
  if (o.url) {
    sources.protomaps = {
      type: 'vector',
      url: o.url,
      ...(o.minzoom != null ? { minzoom: o.minzoom } : {}),
      ...(o.maxzoom != null ? { maxzoom: o.maxzoom } : {}),
    };
    list = [];
    for (const l of layers('protomaps', flavor(p), { lang: o.lang }) as Layer[]) {
      if (l.id === 'roads_oneway' || l.id === 'roads_shields') continue; // sprite icons, of no use offline
      if (l.id === 'pois') {
        l.layout['icon-image'] = 'poi-dot';
        /* a traveller's POIs — sights, viewpoints, peaks, stations, information —
           1.5 zoom levels earlier than the stock style (OSM gives most of them
           min_zoom 16; Yuanjiajie's viewpoints only appeared at z16), and
           `viewpoint` and `information` were not in the stock list at all */
        const kinds = [...l.filter[1][2][1], 'viewpoint', 'information'];
        const EARLY = ['attraction', 'viewpoint', 'peak', 'information', 'museum', 'station', 'ferry_terminal', 'aerodrome', 'theatre', 'zoo'];
        l.filter = ['all', ['in', ['get', 'kind'], ['literal', kinds]], ['>=', ['zoom'], ['+', ['get', 'min_zoom'], ['match', ['get', 'kind'], EARLY, -1.5, 0]]]];
        /* the stock colour `case` falls through to the land colour (invisible) for unlisted kinds */
        l.paint['text-color'] = [
          'match',
          ['get', 'kind'],
          ['park', 'forest', 'garden', 'beach', 'zoo', 'marina', 'peak', 'viewpoint'],
          p.labelPark,
          ['aerodrome', 'station', 'bus_stop', 'ferry_terminal'],
          p.labelTransit,
          p.label,
        ];
        l.paint['text-halo-color'] = p.land;
      }
      if (l.id === 'roads_other') {
        /* paths, steps and trails: visible and dashed — the hiking stops
           (Wulingyuan, the Gorge, the Great Wall) live on them */
        l.paint['line-color'] = '#5c6089';
        l.paint['line-width'] = ['interpolate', ['exponential', 1.6], ['zoom'], 13, 0.7, 15, 1.3, 18, 3, 20, 7];
        l.paint['line-dasharray'] = [2.5, 1.5];
      }
      if (l.id === 'places_locality') l.layout['icon-image'] = ['step', ['zoom'], 'poi-dot', 8, ''];
      if (l.id === 'places_country') l.paint['text-halo-color'] = p.land;
      list.push(l);
      if (l.id === 'water') {
        list.push({
          id: 'water_edge',
          type: 'line',
          source: 'protomaps',
          'source-layer': 'water',
          minzoom: 11,
          filter: ['==', '$type', 'Polygon'],
          paint: { 'line-color': 'rgba(127,227,240,0.16)', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 1.2] },
        });
      }
    }
  }
  const style: Record<string, unknown> = { version: 8, name: 'Horizon night', sources, layers: list };
  /* the basemap names a Devanagari fontstack inside a `case` — never drawn in
     China; one family keeps TinySDF from registering a face nobody reads */
  return JSON.parse(JSON.stringify(style).replaceAll('Noto Sans Devanagari Regular v1', STACK.regular)) as Record<string, unknown>;
}

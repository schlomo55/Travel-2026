/* THE STREET MAP (Map 5c) — the map engine behind the Map tab, and the only
   module that loads it. The Map route imports this file lazily, the first
   time the tab opens; everything under lib/map/street/ (maplibre-gl, pmtiles,
   the basemap's layers, this glue) is its own chunk with its own budget
   (scripts/check-bundle.mjs, the map engine gate).

   It knows nothing of the trip. The route hands it plain pins, a position
   and a few switches; it draws them on the map pack's streets — read from
   the phone, one File slice per tile — or, with no pack, on the plain night
   canvas, and it answers with taps and camera moves.

   WHAT IS DRAWN HERE: the streets (style.ts), the pins and their clusters
   (pins.ts), the distance rings round you (250 m · 500 m · 1 km, their labels
   in Martian Mono) and your accuracy halo — and a day's route (demo): its
   line, the dotted leg to tonight's bed, and its numbered stops, whose
   category pins step aside (setRoutes). WHAT THE ROUTE DRAWS, as DOM on
   markers this module places: you (the sunrise dot, its ping, the heading
   cone), the selected pin and its name, today's and tonight's labels — and,
   over the map, the guide line.

   A LOST CONTEXT IS REBUILT. Android may take the WebGL context away while
   the app is in the background and not give it back: on the next visible
   moment, if the map has not recovered by itself, it is built again — same
   camera, same pins, same markers. Nothing renders while nothing changes
   (MapLibre draws on demand), and on hiding, any camera flight stops.

   A MAP THAT CANNOT START SAYS SO (Map 5d). No WebGL, or a worker that never
   starts, and the map does not open: `openStreetMap` rejects — when the map
   cannot be made at all, and when it has not loaded within START_MS — and
   the screen shows its fallback (the rail and the list work without a map).
   A rebuild after a lost context that fails is reported through `onError`,
   and every method of the map it leaves behind does nothing, safely.

   Motion: under Calm motion or the phone's reduce-motion a camera move is a
   jump, never a flight; symbols never fade. */
import maplibregl from '#map-engine';
import { FileSource, PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import type { PlaceCategory } from '../../model/types';
import { CATEGORIES } from '../../logic/mapplaces';
import { fitView, metresPerPx, ringLabelCorner, roomMiddle, type DrawnPin, type RingCorner } from '../../logic/wayfind';
import { parsePhotoPinName, PHOTO_LABEL_EM, photoPinAt, photoPinStep } from '../../logic/placephotos';
import { parseRoutePinName, routeIds, routeLineData, routeStopData, type RouteDraw } from '../../logic/maproute';
import { horizonStyle, palette } from './style';
import { loadMapFonts, STACK } from './fonts';
import { clusterImage, photoPinImage, PIN_GLYPHS, pinImage, poiDot, PR, PR_PHOTO, routePinImage, type PinVariant } from './pins';

type MLMap = InstanceType<typeof maplibregl.Map>;
type MLMarker = InstanceType<typeof maplibregl.Marker>;
type LngLat = [number, number];

export interface StreetPin {
  id: string;
  lng: number;
  lat: number;
  cat: PlaceCategory;
  glyph: string;
  label: string;
  v: PinVariant;
  /** the place has a photo in the map pack: at close zoom its pin wears it (Map 5e) */
  ph?: boolean;
}
export interface StreetView {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  /** [west, south, east, north] of what is on screen */
  bounds: [number, number, number, number];
  /** metres per CSS pixel at the centre */
  mpp: number;
  /** this move was the map keeping what is on the screen where it is (setPadding's `keep`: the places' sheet
      folded or unfolded) — nothing moved on screen, only the centre the room is measured from (Map 5f) */
  kept?: boolean;
}
export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export interface You {
  lng: number;
  lat: number;
  /** metres */
  accuracy: number;
}
export interface MarkerHandle {
  move(at: LngLat): void;
  rotate(deg: number): void;
  remove(): void;
}
export interface StreetOptions {
  container: HTMLElement;
  /** the map pack from this phone, or null: the night canvas */
  pack: File | null;
  packZooms?: { min: number; max: number };
  center: LngLat;
  zoom: number;
  padding?: Padding;
  /** the canvas's own accessible name */
  label: string;
  onPin(id: string): void;
  onView(v: StreetView): void;
  /** a hand moved the map (a drag, a pinch, a wheel) */
  onGesture(): void;
  onError(message: string): void;
  /** the places drawn as a pin of their own when the map comes to rest (not
      in a cluster) — the screen names today's and tonight's only there —,
      where every pin and cluster on screen is and how much room it takes
      (a photo pin more than an icon, its name under it), so nothing is laid
      over one, and which of the places wear their photo there (Map 5f) */
  onDrawn?(ids: Set<string>, at: DrawnPin[], photos: Set<string>): void;
  /** a place's photo for its pin (Map 5e): the square image from the map
      pack, or null — asked for the first time the map needs that pin */
  photo?(id: string): Promise<Blob | null>;
}
export interface StreetMap {
  readonly engine: string;
  setPins(pins: StreetPin[]): void;
  setSelected(id: string | null): void;
  setYou(you: You | null): void;
  setRings(on: boolean): void;
  /** a day's route, or several (demo): each a line through its stops in its colour, a dotted leg on to
      tonight's bed, and a numbered pin per stop over the category pins — whose own pin steps aside.
      A tap on a numbered pin is a tap on that place's pin (onPin). [] draws none. */
  setRoutes(routes: RouteDraw[]): void;
  marker(el: HTMLElement, at: LngLat, opts?: { anchor?: 'center' | 'top' | 'bottom' | 'left'; map?: boolean; offset?: [number, number] }): MarkerHandle;
  project(at: LngLat): { x: number; y: number };
  view(): StreetView;
  flyTo(at: LngLat, zoom?: number): void;
  /** a short pan that keeps the zoom — following you */
  panTo(at: LngLat): void;
  /** `margin`: the room kept round the points, px [x, y] — by default enough for a chosen pin's name under it */
  fit(points: LngLat[], maxZoom?: number, margin?: [number, number]): void;
  zoomBy(d: number): void;
  northUp(): void;
  /** the room the panels leave the map; `keep`: what is on the screen stays where it is (the places' sheet
      folded or unfolded, Map 5e) — otherwise the map's centre moves to the new room's centre */
  setPadding(p: Padding, keep?: boolean): void;
  destroy(): void;
}

/** A map that has not loaded in this long is not going to (a worker that
    never starts in the WebView): the screen shows its fallback instead of
    "Opening the map…" for ever (Map 5d). */
export const START_MS = 15_000;

const RINGS = [1000, 500, 250] as const;
const ringText = (r: number): string => (r >= 1000 ? `${r / 1000} km` : `${r} m`);
/** a ring label's anchor and offset (em) on each diagonal: outside the ring, away from you */
const CORNER: Record<RingCorner, [string, [number, number]]> = {
  45: ['bottom-left', [0.3, -0.2]],
  135: ['top-left', [0.3, 0.2]],
  225: ['top-right', [-0.3, 0.2]],
  315: ['bottom-right', [-0.3, -0.2]],
};
const EMPTY = { type: 'FeatureCollection', features: [] } as const;

/** The pack's File, read one slice per request — and counted, so the
    container can say how much of the map came from it (the rehearsal reads it). */
class CountingSource implements Source {
  reads = 0;
  constructor(private inner: Source) {}
  getKey(): string {
    return this.inner.getKey();
  }
  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const r = await this.inner.getBytes(offset, length, signal, etag);
    this.reads++;
    return r;
  }
}

let protocol: Protocol | null = null;
function tiles(): Protocol {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

/** A circle of radius `m` metres as a closed line (equirectangular — plenty at a kilometre). */
function circle(lng: number, lat: number, m: number, n = 96): LngLat[] {
  const dLat = m / 111320;
  const dLng = m / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    ring.push([lng + dLng * Math.sin(a), lat + dLat * Math.cos(a)]);
  }
  return ring;
}
/** The point `m` metres from (lng, lat) on bearing `deg`. */
function along(lng: number, lat: number, m: number, deg: number): LngLat {
  const a = (deg * Math.PI) / 180;
  return [lng + (m * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (m * Math.cos(a)) / 111320];
}

const still = (): boolean =>
  document.documentElement.classList.contains('calm') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** One count property per category, summed over a cluster's points. */
const CLUSTER_PROPS = Object.fromEntries(CATEGORIES.map((c) => [c, ['+', ['case', ['==', ['get', 'cat'], c], 1, 0]]]));
/** The glyph a cluster wears: the one category it holds, else "mixed". */
const CLUSTER_GLYPH = ['case', ...CATEGORIES.flatMap((c) => [['==', ['get', c], ['get', 'point_count']], c]), 'mixed'];

export async function openStreetMap(o: StreetOptions): Promise<StreetMap> {
  await loadMapFonts();
  const p = palette();
  let url: string | null = null;
  let counter: CountingSource | null = null;
  if (o.pack) {
    counter = new CountingSource(new FileSource(o.pack));
    const archive = new PMTiles(counter);
    tiles().add(archive);
    url = `pmtiles://${archive.source.getKey()}`;
  }
  const style = horizonStyle({ url, lang: 'en', ...(o.packZooms ? { minzoom: o.packZooms.min, maxzoom: Math.max(o.packZooms.max, o.packZooms.min) } : {}) }, p);

  /* everything the map shows, kept here so a rebuilt map shows it again */
  let pins: StreetPin[] = [];
  let selected: string | null = null;
  let you: You | null = null;
  let rings = true;
  /* the day's route(s) drawn, and the places they number (their category pins step aside) */
  let routes: RouteDraw[] = [];
  let routeHidden = new Set<string>();
  /* the diagonal each ring's label is on — NE, as the board draws it, until a
     pin or a cluster covers that spot (Map 5d; chosen as the map comes to rest) */
  let corners: Record<number, RingCorner> = { 1000: 45, 500: 45, 250: 45 };
  let padding: Padding = o.padding ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const markers = new Set<{ el: HTMLElement; at: LngLat; rot: number; opts: Parameters<StreetMap['marker']>[2]; m: MLMarker | null }>();
  /** the map on screen — null before it has started, after a rebuild failed, and after destroy */
  let map: MLMap | null = null;
  /** where the camera was when a map last answered, for view() with none */
  let last: StreetView | null = null;
  let lost = false;
  let gone = false;
  /** THE CAMERA MOVE OF OURS UNDER WAY — what it is for, so a panel that
      settles its height mid-flight (the place sheet measuring itself as the
      map flies to its place) re-aims the move in the new padding instead of
      the map jumping when it lands. A gesture has none. */
  let aim: { at: LngLat; zoom?: number } | { fit: LngLat[]; maxZoom: number; margin?: [number, number] } | null = null;
  /* a padding change waiting for a gesture's move to end (setPadding), and whether it keeps the screen */
  let deferred = false;
  let deferKeep = false;

  /* the photo pins painted so far (Map 5e): each once per map */
  const painted = new Set<string>();
  async function paintPhoto(m: MLMap, image: string, id: string, v: PinVariant): Promise<void> {
    let data: ImageData | null = null;
    try {
      const blob = await o.photo?.(id);
      if (blob) {
        const bmp = await createImageBitmap(blob);
        data = photoPinImage(bmp, pins.find((x) => x.id === id)?.glyph ?? 'sight', v);
        bmp.close?.();
      }
    } catch {
      data = null;
    }
    if (m !== map || m.hasImage(image)) return;
    if (data) {
      m.addImage(image, data, { pixelRatio: PR_PHOTO });
      painted.add(image);
    } else m.addImage(image, pinImage(pins.find((x) => x.id === id)?.glyph ?? 'sight', v), { pixelRatio: PR });
  }
  /* maplibre 5 only: pins asked for before their photos arrived are laid out again, once per batch */
  let relayTimer: ReturnType<typeof setTimeout> | undefined;
  const relayOut = (): void => {
    clearTimeout(relayTimer);
    relayTimer = setTimeout(() => src('places')?.setData(pinData()), 120);
  };

  const pinData = () => ({
    type: 'FeatureCollection',
    features: pins
      .filter((x) => x.id !== selected && !routeHidden.has(x.id))
      .map((x) => ({ type: 'Feature', properties: { id: x.id, cat: x.cat, glyph: x.glyph, label: x.label, v: x.v, ph: x.ph ? 1 : 0 }, geometry: { type: 'Point', coordinates: [x.lng, x.lat] } })),
  });
  const ringData = () =>
    you && rings
      ? { type: 'FeatureCollection', features: RINGS.map((r) => ({ type: 'Feature', properties: { r }, geometry: { type: 'LineString', coordinates: circle(you!.lng, you!.lat, r) } })) }
      : EMPTY;
  const ringLabelData = () =>
    you && rings
      ? {
          type: 'FeatureCollection',
          features: RINGS.map((r) => {
            const c = corners[r] ?? 45;
            const [a, off] = CORNER[c];
            return { type: 'Feature', properties: { t: ringText(r), a, o: off }, geometry: { type: 'Point', coordinates: along(you!.lng, you!.lat, r, c) } };
          }),
        }
      : EMPTY;
  const routeStops = () => routeStopData(routes, selected);
  const youData = () => (you ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [you.lng, you.lat] } } : EMPTY);
  /* the accuracy halo in metres at every zoom: pixels double per zoom level */
  const haloRadius = () => {
    const m2px0 = 1 / metresPerPx(you?.lat ?? 0, 0);
    const a = you?.accuracy ?? 0;
    return ['interpolate', ['exponential', 2], ['zoom'], 0, a * m2px0, 22, a * m2px0 * 2 ** 22];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const src = (id: string): any => map?.getSource(id);

  function addImages(m: MLMap): void {
    for (const g of PIN_GLYPHS) {
      for (const v of ['', 'today', 'tonight'] as const) {
        const id = `pin-${g}${v ? `-${v}` : ''}`;
        if (!m.hasImage(id)) m.addImage(id, pinImage(g, v), { pixelRatio: PR });
      }
    }
    if (!m.hasImage('poi-dot')) m.addImage('poi-dot', poiDot(), { pixelRatio: PR });
  }

  function addOverlays(m: MLMap): void {
    m.addSource('you', { type: 'geojson', data: youData() as never });
    m.addLayer({
      id: 'you-halo',
      type: 'circle',
      source: 'you',
      paint: {
        'circle-color': 'rgba(255,159,107,0.10)',
        'circle-stroke-color': 'rgba(255,159,107,0.28)',
        'circle-stroke-width': 1,
        'circle-radius': haloRadius() as never,
        'circle-pitch-alignment': 'map',
      },
    });
    m.addSource('rings', { type: 'geojson', data: ringData() as never });
    const ringPaint: Record<number, [number, number[] | null]> = { 1000: [0.2, null], 500: [0.26, [3, 4]], 250: [0.34, [2, 3]] };
    for (const r of RINGS) {
      const [alpha, dash] = ringPaint[r] ?? [0.2, null];
      m.addLayer({
        id: `ring-${r}`,
        type: 'line',
        source: 'rings',
        filter: ['==', ['get', 'r'], r],
        paint: { 'line-color': `rgba(255,159,107,${alpha})`, 'line-width': 1, ...(dash ? { 'line-dasharray': dash } : {}) },
      });
    }
    m.addSource('ring-labels', { type: 'geojson', data: ringLabelData() as never });
    m.addLayer({
      id: 'ring-labels',
      type: 'symbol',
      source: 'ring-labels',
      layout: {
        'text-field': ['get', 't'],
        'text-font': [STACK.mono],
        'text-size': 11,
        'text-anchor': ['get', 'a'] as never,
        'text-offset': ['get', 'o'] as never,
        'text-allow-overlap': true,
        /* the map's own words make room for them, as they do for the pins (Map 5d) */
        'text-ignore-placement': false,
      },
      paint: { 'text-color': p.ink2, 'text-halo-color': p.land, 'text-halo-width': 2.5 },
    });
    /* A DAY'S ROUTE (demo), under every pin: the stops in order, solid on a night casing; the last stop
       to tonight's bed, dotted */
    m.addSource('routes', { type: 'geojson', data: routeLineData(routes) as never });
    m.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'k'], 'path'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': p.land, 'line-opacity': 0.6, 'line-width': 6 },
    });
    m.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'k'], 'path'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'c'] as never, 'line-width': 3 },
    });
    m.addLayer({
      id: 'route-bed',
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'k'], 'bed'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'c'] as never, 'line-width': 2, 'line-dasharray': [0.5, 2.5] },
    });
    m.addSource('places', {
      type: 'geojson',
      data: pinData() as never,
      cluster: true,
      clusterRadius: 38,
      clusterMaxZoom: 15,
      clusterProperties: CLUSTER_PROPS as never,
    });
    m.addLayer({
      id: 'clusters',
      type: 'symbol',
      source: 'places',
      filter: ['has', 'point_count'],
      /* the trip's pins are always drawn, and the map's own words make room
         for them: an OpenStreetMap label under a pin (often the same name)
         gives way */
      layout: {
        'icon-image': ['concat', 'cl-', CLUSTER_GLYPH, '-', ['to-string', ['min', ['get', 'point_count'], 99]]] as never,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
      },
    });
    /* PHOTO PINS (Map 5e, E): from PHOTO_PIN_ZOOM on, a place with a photo
       wears it — its own map image, ph-<id>, painted the first time it is
       asked for (paint, below); zoomed out, the icon. A cluster never is a
       photo. The name hangs a little lower under the larger round. The zoom
       rule is placephotos.ts's photoPinStep — the one the screen reads back
       with photoPinAt (Map 5f). */
    const variantSuffix = ['match', ['get', 'v'], 'tonight', '-tonight', 'today', '-today', ''];
    const iconPin = ['concat', 'pin-', ['get', 'glyph'], variantSuffix];
    const hasPhoto = ['==', ['get', 'ph'], 1];
    const iconName = ['literal', [0, 1.9]];
    m.addLayer({
      id: 'pins',
      type: 'symbol',
      source: 'places',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': photoPinStep<unknown>(iconPin, ['case', hasPhoto, ['concat', 'ph-', ['get', 'id'], variantSuffix], iconPin]) as never,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'symbol-sort-key': ['match', ['get', 'v'], 'tonight', 0, 'today', 1, 2] as never,
        /* today's and tonight's are named by their tag on the map (Map.svelte), not twice */
        'text-field': ['case', ['==', ['get', 'v'], ''], ['get', 'label'], ''] as never,
        'text-font': [STACK.bold],
        'text-size': 11.5,
        'text-offset': photoPinStep<unknown>(iconName, ['case', hasPhoto, ['literal', [0, PHOTO_LABEL_EM]], iconName]) as never,
        'text-anchor': 'top',
        'text-optional': true,
        'text-max-width': 9,
      },
      paint: { 'text-color': p.ink, 'text-halo-color': p.land, 'text-halo-width': 1.6 },
    });
    /* the day's numbered stops, over the category pins (their own pins stepped aside: pinData) */
    m.addSource('route-stops', { type: 'geojson', data: routeStops() as never });
    m.addLayer({
      id: 'route-pins',
      type: 'symbol',
      source: 'route-stops',
      layout: {
        'icon-image': ['get', 'img'] as never,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'symbol-sort-key': ['get', 'k'] as never,
        'text-field': ['get', 'label'] as never,
        'text-font': [STACK.bold],
        'text-size': 11.5,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-optional': true,
        'text-max-width': 9,
      },
      paint: { 'text-color': p.ink, 'text-halo-color': p.land, 'text-halo-width': 1.6 },
    });
    quiet(m);
  }
  /* a place chosen: the others step back, unnamed (map4-place draws them at 70 %) */
  function quiet(m: MLMap): void {
    const a = selected ? 0.7 : 1;
    if (m.getLayer('pins')) {
      m.setPaintProperty('pins', 'icon-opacity', a);
      m.setPaintProperty('pins', 'text-opacity', selected ? 0 : 1);
    }
    if (m.getLayer('clusters')) m.setPaintProperty('clusters', 'icon-opacity', a);
    /* the stops keep their numbers; their names give way to the chosen one's */
    if (m.getLayer('route-pins')) m.setPaintProperty('route-pins', 'text-opacity', selected ? 0 : 1);
  }

  /* the move under way is the map keeping the screen as it is (setPadding's `keep`) — said on the views it makes */
  let keeping = false;
  function viewOf(m: MLMap): StreetView {
    const c = m.getCenter();
    const b = m.getBounds();
    last = { lng: c.lng, lat: c.lat, zoom: m.getZoom(), bearing: m.getBearing(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], mpp: metresPerPx(c.lat, m.getZoom()) };
    return keeping ? { ...last, kept: true } : last;
  }
  /** no map: the last view it had, else where it was asked to open */
  const lastView = (): StreetView =>
    last ?? { lng: o.center[0], lat: o.center[1], zoom: o.zoom, bearing: 0, bounds: [o.center[0], o.center[1], o.center[0], o.center[1]], mpp: metresPerPx(o.center[1], o.zoom) };

  function attach(rec: { el: HTMLElement; at: LngLat; rot: number; opts: Parameters<StreetMap['marker']>[2]; m: MLMarker | null }): void {
    rec.m?.remove();
    rec.m = null;
    const on = map;
    if (!on) return;
    /* THE SCREEN'S OWN ELEMENTS KEEP WHAT THEY SAY ABOUT THEMSELVES. Every
       marker here is decorative (aria-hidden: you, the cone, the chosen pin,
       a day's name — the places are in the rail and the list). maplibre 5, the
       fallback, names every marker "Map marker" and makes it a button as it is
       added (6 leaves an element of the page's alone): whatever it adds is
       taken off again. */
    const el = rec.el;
    const own = (['role', 'aria-label', 'tabindex'] as const).map((k) => [k, el.getAttribute(k)] as const);
    rec.m = new maplibregl.Marker({
      element: rec.el,
      anchor: rec.opts?.anchor ?? 'center',
      rotationAlignment: rec.opts?.map ? 'map' : 'viewport',
      pitchAlignment: 'map',
      ...(rec.opts?.offset ? { offset: rec.opts.offset } : {}),
    })
      .setLngLat(rec.at)
      .setRotation(rec.rot)
      .addTo(on);
    for (const [k, v] of own) {
      if (v === null) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
  }

  /** Make the map and wait for it to load. REJECTS when it cannot be made (no
      WebGL: maplibre throws) and when it has not loaded within START_MS —
      the map is taken down then, and `map` left null (Map 5d: a throwing
      constructor used to resolve, leaving every method on an undefined map). */
  function build(camera: { center: LngLat; zoom: number; bearing: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      let m: MLMap;
      /* what the container held before: a constructor that throws has already
         laid its canvas and control boxes in, and they go with it */
      const had = new Set(Array.from(o.container.children ?? []));
      try {
        m = new maplibregl.Map({
          container: o.container,
          style: style as never,
          center: camera.center,
          zoom: camera.zoom,
          bearing: camera.bearing,
          minZoom: 2,
          maxZoom: 19,
          maxPitch: 0,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
          fadeDuration: 0,
          pixelRatio: Math.min(3, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
          locale: { 'Map.Title': o.label },
        } as never);
      } catch (e) {
        for (const el of Array.from(o.container.children ?? [])) if (!had.has(el)) el.remove();
        o.container.classList?.remove('maplibregl-map');
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      map = m;
      m.setPadding(padding);
      /* a change that was waiting on the map before this one waits no more: this map starts in it */
      deferred = false;
      deferKeep = false;
      /* A CLUSTER'S IMAGE IS PAINTED WHEN FIRST ASKED FOR — its glyph and its
         "+N" — and anything else the style names but nobody drew is a blank
         pixel. maplibre 6 asks a resolver and WAITS for it: an image added in
         its 'styleimagemissing' event arrives too late for the tile that
         asked, and that tile drew no cluster until it was laid out again (a
         cluster of the Drum Tower, the Bell Tower and Yaoji Chaogan, 300 m
         from Houhai, was missing — and with it the only food pin in sight).
         maplibre 5, the fallback, has no resolver and looks again straight
         after its event. */
      /* A PHOTO PIN IS PAINTED FROM THE PACK (Map 5e): its square image read,
         decoded off the main thread, laid in its ring. maplibre 6 waits for
         it; maplibre 5 has already moved on, so its pins are laid out again
         once a batch has arrived. A photo that cannot be had is the place's
         icon pin under the photo pin's name — never a blank. */
      const paint = (id: string): void | Promise<void> => {
        if (m.hasImage(id)) return;
        const ph = parsePhotoPinName(id);
        if (ph) return paintPhoto(m, id, ph.id, ph.v);
        const rt = parseRoutePinName(id);
        if (rt) return void m.addImage(id, routePinImage(rt.colour, rt.n, rt.selected), { pixelRatio: PR });
        const cl = /^cl-([a-z]+)-(\d+)$/.exec(id);
        if (cl?.[1] && cl[2]) m.addImage(id, clusterImage(cl[1], Number(cl[2])), { pixelRatio: PR });
        else m.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      };
      const v6 = m as unknown as { setMissingStyleImageResolver?: (r: ((id: string) => Promise<void>) | null) => void };
      if (typeof v6.setMissingStyleImageResolver === 'function') v6.setMissingStyleImageResolver(async (id) => paint(id));
      else
        m.on('styleimagemissing', (e: { id: string }) => {
          const later = paint(e.id);
          if (later) void later.then(relayOut);
        });
      m.on('error', (e: { error?: { message?: string } }) => {
        /* a tile the pack does not hold is not an error worth a word */
        if (!/pmtiles|404|tile/i.test(String(e.error?.message ?? ''))) console.warn('map:', e.error?.message ?? e);
      });
      m.on('webglcontextlost', () => {
        lost = true;
      });
      m.on('webglcontextrestored', () => {
        lost = false;
      });
      m.on('move', () => o.onView(viewOf(m)));
      /* the container says when everything asked for is drawn — the
         rehearsal and the screenshots wait on it */
      m.on('idle', () => {
        /* what is drawn, said on the container: the pins on screen by category
           (clusters by what they hold) and the reads from the pack */
        const cats: Record<string, number> = {};
        const drawn = new Set<string>();
        /* which of them wear their photo — the style's own zoom rule, read back (Map 5e; Map 5f: the screen keeps
           its words off the larger round and its lower name, and hangs today's tag under it) */
        const photoZoom = photoPinAt(m.getZoom(), true);
        const wearing = new Set<string>();
        const at: DrawnPin[] = [];
        for (const f of m.queryRenderedFeatures({ layers: ['pins', 'clusters', 'route-pins'] } as never) as { properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }[]) {
          const pr = f.properties ?? {};
          const pin = typeof pr.point_count !== 'number';
          if (!pin) for (const c of CATEGORIES) cats[c] = (cats[c] ?? 0) + Number(pr[c] ?? 0);
          else if (typeof pr.cat === 'string') cats[pr.cat] = (cats[pr.cat] ?? 0) + 1;
          if (pin && typeof pr.id === 'string') drawn.add(pr.id);
          const photo = pin && photoZoom && pr.ph === 1;
          if (photo && typeof pr.id === 'string') wearing.add(pr.id);
          const g = f.geometry?.coordinates;
          if (g && g.length >= 2) {
            const pt = m.project(g as LngLat);
            /* its name, where the map draws one (not today's and tonight's: the screen names those) */
            const chars = pin && pr.v === '' && typeof pr.label === 'string' ? pr.label.length : 0;
            at.push({ x: Math.round(pt.x), y: Math.round(pt.y), ...(photo ? { photo: true } : {}), ...(chars ? { chars } : {}) });
          }
        }
        o.onDrawn?.(drawn, at, wearing);
        /* how many pins wear their photo now (Map 5e — the rehearsal and the screenshots read it) */
        o.container.dataset.photos = String(wearing.size);
        o.container.dataset.photoImages = String(painted.size);
        /* a ring's label on the diagonal no pin or cluster covers (Map 5d) */
        if (you && rings) {
          const me = you;
          const next: Record<number, RingCorner> = {};
          for (const r of RINGS) {
            const t = ringText(r);
            next[r] = ringLabelCorner(
              (c) => {
                const pt = m.project(along(me.lng, me.lat, r, c));
                return { x: pt.x, y: pt.y };
              },
              { w: t.length * 7 + 5, h: 16 },
              at,
            );
          }
          if (RINGS.some((r) => next[r] !== corners[r])) {
            corners = next;
            src('ring-labels')?.setData(ringLabelData());
          }
        }
        o.container.dataset.cats = Object.entries(cats)
          .filter(([, n]) => n > 0)
          .map(([c, n]) => `${c}:${n}`)
          .join(',');
        o.container.dataset.reads = String(counter?.reads ?? 0);
        /* where each pin and cluster is on screen (Map 5d: the rehearsal checks the foot keeps off them), ",1" after
           one that wears its photo and the length of the name under it, if any (Map 5f: "x,y,photo,chars") */
        o.container.dataset.at = at.map((q) => `${q.x},${q.y}${q.photo || q.chars ? `,${q.photo ? 1 : 0},${q.chars ?? 0}` : ''}`).join(' ');
        o.container.dataset.rings = String(m.queryRenderedFeatures({ layers: RINGS.map((r) => `ring-${r}`) } as never).length);
        const c = m.getCenter();
        o.container.dataset.center = [c.lng.toFixed(4), c.lat.toFixed(4), m.getZoom().toFixed(2)].join(',');
        o.container.dataset.idle = '1';
      });
      m.on('dataloading', () => delete o.container.dataset.idle);
      m.on('movestart', () => delete o.container.dataset.idle);
      m.on('moveend', () => (aim = null));
      const hand = (e: { originalEvent?: unknown }): void => {
        if (e.originalEvent) o.onGesture();
      };
      m.on('dragstart', hand);
      m.on('zoomstart', hand);
      m.on('rotatestart', hand);
      /* a numbered stop over a pin or a cluster takes the tap — one place opens, once */
      const onStop = (e: { point?: unknown }): boolean =>
        !!e.point && routes.length > 0 && !!m.getLayer('route-pins') && (m.queryRenderedFeatures(e.point as never, { layers: ['route-pins'] } as never) as unknown[]).length > 0;
      m.on('click', 'route-pins', (e: { features?: { properties?: Record<string, unknown> }[] }) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') o.onPin(id);
      });
      m.on('click', 'pins', (e: { point?: unknown; features?: { properties?: Record<string, unknown> }[] }) => {
        if (onStop(e)) return;
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') o.onPin(id);
      });
      m.on('click', 'clusters', (e: { point?: unknown; features?: { properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }[] }) => {
        if (onStop(e)) return;
        const f = e.features?.[0];
        const id = f?.properties?.cluster_id;
        const at = f?.geometry?.coordinates;
        if (typeof id !== 'number' || !at) return;
        void src('places')
          .getClusterExpansionZoom(id)
          .then((z: number) => m.easeTo({ center: at as LngLat, zoom: Math.min(z + 0.3, 18), duration: still() ? 0 : 500 }))
          .catch(() => undefined);
      });
      for (const layer of ['pins', 'clusters', 'route-pins']) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
      let settled = false;
      const fail = (e: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(late);
        if (map === m) map = null;
        try {
          m.remove();
        } catch {
          /* it never got going */
        }
        reject(e instanceof Error ? e : new Error(String(e)));
      };
      const late = setTimeout(() => fail(new Error(`the map did not load in ${START_MS / 1000} s`)), START_MS);
      try {
        addImages(m);
      } catch (e) {
        fail(e);
        return;
      }
      m.once('load', () => {
        if (settled) return;
        settled = true;
        clearTimeout(late);
        addOverlays(m);
        for (const r of markers) attach(r);
        o.onView(viewOf(m));
        resolve();
      });
    });
  }

  /* the first map: if it cannot start, nothing is left behind and the screen hears why */
  await build({ center: o.center, zoom: o.zoom, bearing: 0 });

  /* a lost context the WebView does not give back is built again, where it was */
  const onVisible = (): void => {
    if (document.hidden) {
      map?.stop();
      return;
    }
    if (!lost || gone) return;
    setTimeout(() => {
      const was = map;
      if (!lost || gone || document.hidden || !was) return;
      const c = was.getCenter();
      const camera = { center: [c.lng, c.lat] as LngLat, zoom: was.getZoom(), bearing: was.getBearing() };
      for (const r of markers) {
        r.m?.remove();
        r.m = null;
      }
      try {
        was.remove();
      } catch {
        /* a context that is gone may throw on the way out */
      }
      map = null;
      lost = false;
      /* the rebuild can fail as the first build can: then there is no map, and the screen is told */
      build(camera).catch((e: unknown) => {
        map = null;
        if (!gone) o.onError(String((e as Error)?.message ?? e));
      });
    }, 900);
  };
  document.addEventListener('visibilitychange', onVisible);

  const api: StreetMap = {
    engine: maplibregl.getVersion(),
    setPins(next) {
      pins = next;
      src('places')?.setData(pinData());
    },
    setSelected(id) {
      selected = id;
      src('places')?.setData(pinData());
      src('route-stops')?.setData(routeStops());
      if (map) quiet(map);
    },
    setYou(next) {
      const accChanged = (next?.accuracy ?? 0) !== (you?.accuracy ?? 0) || !!next !== !!you || Math.abs((next?.lat ?? 0) - (you?.lat ?? 0)) > 0.05;
      you = next;
      src('you')?.setData(youData());
      src('rings')?.setData(ringData());
      src('ring-labels')?.setData(ringLabelData());
      if (accChanged && map?.getLayer('you-halo')) map.setPaintProperty('you-halo', 'circle-radius', haloRadius() as never);
    },
    setRings(on) {
      rings = on;
      src('rings')?.setData(ringData());
      src('ring-labels')?.setData(ringLabelData());
    },
    setRoutes(next) {
      routes = next;
      routeHidden = routeIds(next);
      src('routes')?.setData(routeLineData(routes));
      src('route-stops')?.setData(routeStops());
      src('places')?.setData(pinData());
    },
    marker(el, at, opts) {
      const rec = { el, at, rot: 0, opts, m: null as MLMarker | null };
      markers.add(rec);
      attach(rec);
      return {
        move(to) {
          rec.at = to;
          rec.m?.setLngLat(to);
        },
        rotate(deg) {
          rec.rot = deg;
          rec.m?.setRotation(deg);
        },
        remove() {
          rec.m?.remove();
          markers.delete(rec);
        },
      };
    },
    project(at) {
      if (!map) return { x: Number.NaN, y: Number.NaN };
      const pt = map.project(at);
      return { x: pt.x, y: pt.y };
    },
    view: () => (map ? viewOf(map) : lastView()),
    /* every camera move lands in the padding the panels asked for last */
    flyTo(at, zoom) {
      if (!map) return;
      const z = zoom ?? map.getZoom();
      if (still()) map.jumpTo({ center: at, zoom: z, padding });
      else {
        map.flyTo({ center: at, zoom: z, padding, duration: 700, essential: false });
        aim = { at, zoom: z };
      }
    },
    panTo(at) {
      if (!map) return;
      if (still()) map.jumpTo({ center: at, padding });
      else {
        map.easeTo({ center: at, padding, duration: 400 });
        aim = { at };
      }
    },
    fit(points, maxZoom = 16, margin = [88, 56]) {
      if (!points.length || !map) return;
      if (points.length === 1) return api.flyTo(points[0]!, maxZoom);
      const cv = map.getCanvas();
      /* room at the sides for a chosen pin's name, centred under it (or what the caller asks for) */
      const v = fitView(points, cv.clientWidth - padding.left - padding.right, cv.clientHeight - padding.top - padding.bottom, maxZoom, margin);
      if (v) api.flyTo(v.center, v.zoom);
      else {
        /* no room between the panels: the points' middle, where the map is */
        const lngs = points.map((x) => x[0]);
        const lats = points.map((x) => x[1]);
        api.flyTo([(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]);
      }
      if (aim) aim = { fit: points, maxZoom, margin };
    },
    zoomBy(d) {
      if (!map) return;
      if (still()) map.jumpTo({ zoom: map.getZoom() + d });
      else map.easeTo({ zoom: map.getZoom() + d, duration: 250 });
    },
    northUp() {
      if (!map) return;
      if (still()) map.jumpTo({ bearing: 0 });
      else map.easeTo({ bearing: 0, duration: 300 });
    },
    setPadding(next, keep = false) {
      /* MapLibre's setPadding is a jumpTo, which STOPS a camera move under way:
         a panel settling its height mid-flight would leave the map where the
         flight began. So a move of ours is aimed again, in the new padding;
         under a gesture the change waits for the move to end; and a padding
         that is already the map's is not applied again. */
      const same = (a: Padding, b: Padding): boolean => a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;
      const m = map;
      if (!m) {
        padding = next; // the next map starts in it
        return;
      }
      if (same(padding, next) && same(m.getPadding() as Padding, next)) return;
      padding = next;
      const was = aim;
      if (m.isMoving() && was) {
        if ('fit' in was) api.fit(was.fit, was.maxZoom, was.margin);
        else if (was.zoom === undefined) api.panTo(was.at);
        else api.flyTo(was.at, was.zoom);
      } else if (m.isMoving()) {
        /* UNDER A GESTURE — a fling still gliding — the change waits for the move to end, and keeps what is on
           the screen then if it was asked to (Map 5f: folding the sheet mid-fling jumped the map when it landed):
           once, however many changes came while it moved, with the last padding and any `keep` among them */
        deferKeep ||= keep;
        if (!deferred) {
          deferred = true;
          m.once('moveend', () => {
            deferred = false;
            const k = deferKeep;
            deferKeep = false;
            if (map === m) api.setPadding(padding, k);
          });
        }
      } else if (keep) {
        /* KEEP WHAT IS ON THE SCREEN WHERE IT IS (Map 5e, the places' sheet
           folded or unfolded): the new room's centre becomes the map's centre
           — the point already drawn there — so nothing moves; the room given
           back simply shows more map at the foot. The views this makes say so
           (`kept`): the rail does not sort itself again for it (Map 5f). */
        const c = m.getContainer();
        keeping = true;
        try {
          m.jumpTo({ center: m.unproject(roomMiddle(next, c.clientWidth, c.clientHeight)), padding: next });
        } finally {
          keeping = false;
        }
      } else m.setPadding(next);
    },
    destroy() {
      gone = true;
      document.removeEventListener('visibilitychange', onVisible);
      for (const r of markers) r.m?.remove();
      markers.clear();
      try {
        map?.remove();
      } catch {
        /* already gone */
      }
      map = null;
    },
  };
  return api;
}

/* THE MAP PACK'S AREAS (Map 5c; shared with the app since the in-app map
   builder, 7 Nov 2026) — where the pack carries street detail, cut from the
   trip's own positions. Pure: a trip in, boxes out — no Node API and no
   network, so the workshop's build (scripts/maps/build-pack.ts, through
   scripts/maps/areas.ts) and the phone's "Build map for this trip"
   (lib/map/build/) cut the SAME region from the same trip.

   AN ANCHOR is a point the traveller goes to:
   · every place the Map tab draws, at its VERIFIED position — `coord ?? pin`,
     exactly the places lib/logic/mapplaces.ts draws (the same function, so the
     pack and the pins can never disagree);
   · every stop's own coordinate — the city itself;
   · every station and airport a booking leaves from or arrives at, where the
     trip file stores one: a flight's `coord` (its departure airport) and a rail
     or road end's `stations`.
   A located anchor belongs to the stop it is nearest to within CITY_KM (the
   city close-up's own rule); one farther than that from every stop — Tel Aviv
   and Abu Dhabi, where the international flights leave — is not in a China
   pack, and is reported as dropped.

   COVERAGE-ONLY ANCHORS. Twenty-two spots, a few beds and one airport the
   trip goes to have no verified position (MAP-DATA.md says why, place by
   place): they get no pin, ever. But the pack is about STREETS, not pins —
   Jinshanling's wild wall, the Kunyu forest park and the Muping night are
   exactly where an offline map earns its keep. So each of them carries an
   approximate point (general knowledge, good to 1–2 km — the spike's own
   anchors, 2026-09-28) that only SIZES a box. Each is keyed by the entity it
   stands for and is used only while that entity has no position of its own:
   the day the coordinate pass pins one, its approximate point drops out by
   itself. Nothing here is ever drawn, listed or opened. Another trip's ids
   are not in the table, so for it the table does nothing.

   A BOX is the bounding box of a cluster of anchors (single linkage: two
   anchors closer than LINK_KM share one), grown by MARGIN_KM — the walk
   round every place. Boxes that overlap (a MultiPolygon's parts must not)
   are merged into their union, until none does.

   EVERY STOP GETS AT LEAST ITS COUNTRYSIDE (owner, 7 Nov 2026): a square of
   ±STOP_MIN_KM round the stop's own coordinate — 50 × 50 km — joins the boxes
   and is merged with them like any other. A trip of stops and no places (the
   Israel test trip: 8 stops, 0 places) had only a 4 × 4 km box round each
   city centre, too small to find your way by offline; a day trip, a taxi
   from the airport or a wrong bus all leave it. The squares are what makes
   the packs larger: measured with the extractor on the 7 Nov build, China
   49.9 → ~123 MB, Israel 8.2 → ~88 MB.
   Which stops get one is the rule that already decides which stops are on
   the map at all: a stop of kind 'stop' with a coordinate — the stops that
   give the 'stop' anchors above and that nearestStop() files places under.
   A transit leg ("International Flights") and a stop with no coordinate yet
   (Shanghai) get none; nothing outside the stops gets one, so an anchor
   dropped today — the airports the international flights leave from, Tel
   Aviv and Abu Dhabi, farther than CITY_KM from every stop — stays dropped. */
import type { Coord, Stop } from '../model/types';
import { nearestStop } from '../logic/citymap';
import { mapPlaces, type PlaceSources } from '../logic/mapplaces';
import { haversineKm } from '../logic/geoStats';

export const LINK_KM = 10;
export const MARGIN_KM = 2;
/** every stop's square reaches this far from its coordinate, each way (see the header) */
export const STOP_MIN_KM = 25;
const KM_PER_DEG = 111.32;

export type AnchorSrc = 'place' | 'stop' | 'station' | 'coverage';
export interface Anchor {
  id: string;
  label: string;
  at: Coord;
  stopId: string;
  src: AnchorSrc;
}
export interface Box {
  w: number;
  s: number;
  e: number;
  n: number;
  stopIds: string[];
  anchors: Anchor[];
}
export interface Area {
  stopId: string;
  name: string;
  boxes: Box[];
  km2: number;
}
export type Dropped = { id: string; label: string; at: Coord };
/** The one region an extract reads: a MultiPolygon, one part per box. */
export type Region = { type: 'MultiPolygon'; coordinates: number[][][][] };

/** The approximate points (see the header) — the entity each stands for, its
    stop, where, and what it is. Used only while the entity has no position. */
export const COVERAGE: { for: string; stopId: string; label: string; at: Coord }[] = [
  { for: 'cn26-spot-kunyu-park', stopId: 'cn26-stop-kunyu', label: 'Kunyu Mountain forest park', at: { lat: 37.25, lng: 121.73 } },
  { for: 'cn26-stay-12', stopId: 'cn26-stop-kunyu', label: 'Muping town (the Nov 22 night)', at: { lat: 37.387, lng: 121.603 } },
  { for: 'cn26-spot-kunyu-suochengli', stopId: 'cn26-stop-kunyu', label: 'Suochengli old quarter', at: { lat: 37.536, lng: 121.402 } },
  { for: 'cn26-spot-kunyu-changyu', stopId: 'cn26-stop-kunyu', label: 'Changyu Wine Culture Museum', at: { lat: 37.549, lng: 121.4 } },
  { for: 'cn26-spot-kunyu-zhifu', stopId: 'cn26-stop-kunyu', label: 'Zhifu Island', at: { lat: 37.605, lng: 121.385 } },
  { for: 'cn26-flight-ca1560', stopId: 'cn26-stop-kunyu', label: 'Yantai Penglai airport (YNT, the Dec 5 flight)', at: { lat: 37.657, lng: 120.988 } },
  { for: 'cn26-spot-beijing-jinshanling', stopId: 'cn26-stop-beijing', label: 'Jinshanling Great Wall', at: { lat: 40.676, lng: 117.24 } },
  { for: 'cn26-spot-beijing-jiuhua', stopId: 'cn26-stop-beijing', label: 'Jiuhua Resort hot springs', at: { lat: 40.173, lng: 116.39 } },
  { for: 'cn26-spot-beijing-chunhuiyuan', stopId: 'cn26-stop-beijing', label: 'Chunhuiyuan hot springs', at: { lat: 40.08, lng: 116.57 } },
  { for: 'cn26-spot-zhangjiajie-yangjiajie', stopId: 'cn26-stop-zhangjiajie', label: 'Yangjiajie', at: { lat: 29.38, lng: 110.4 } },
  { for: 'cn26-spot-zhangjiajie-huanglong', stopId: 'cn26-stop-zhangjiajie', label: 'Huanglong Cave', at: { lat: 29.34, lng: 110.565 } },
  { for: 'cn26-spot-zhangjiajie-puguang', stopId: 'cn26-stop-zhangjiajie', label: 'Puguang Temple', at: { lat: 29.125, lng: 110.477 } },
  { for: 'cn26-spot-lijiang-blue-moon', stopId: 'cn26-stop-lijiang', label: 'Blue Moon Valley', at: { lat: 27.115, lng: 100.24 } },
  { for: 'cn26-spot-gorge-shangri-la', stopId: 'cn26-stop-gorge', label: 'Shangri-La — Dukezong old town', at: { lat: 27.82, lng: 99.7 } },
  { for: 'cn26-spot-kunming-guandu', stopId: 'cn26-stop-kunming', label: 'Guandu Ancient Town', at: { lat: 24.95, lng: 102.76 } },
  { for: 'cn26-spot-kunming-yunnan-university', stopId: 'cn26-stop-kunming', label: 'Yunnan University', at: { lat: 25.057, lng: 102.7 } },
  { for: 'cn26-spot-hongkong-outer-harbour-ferry', stopId: 'cn26-stop-hongkong', label: 'Macau Outer Harbour ferry terminal', at: { lat: 22.197, lng: 113.559 } },
  { for: 'cn26-spot-hongkong-taipa-ferry', stopId: 'cn26-stop-hongkong', label: 'Taipa ferry terminal', at: { lat: 22.165, lng: 113.576 } },
];

const ok = (c: Coord | undefined): c is Coord => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);

/** Every anchor of a trip, and what was left out and why. */
export function anchorsOf(t: PlaceSources): { anchors: Anchor[]; dropped: Dropped[] } {
  const anchors: Anchor[] = [];
  const dropped: Dropped[] = [];
  const stops = t.stops.filter((s) => s.kind === 'stop');
  const home = (id: string, label: string, at: Coord, src: AnchorSrc, stopId?: string): void => {
    const sid = stopId ?? nearestStop(at, stops)?.id;
    if (sid) anchors.push({ id, label, at, stopId: sid, src });
    else dropped.push({ id, label, at });
  };
  for (const s of stops) if (ok(s.coord)) home(s.id, s.name, s.coord, 'stop', s.id);

  const places = mapPlaces(t);
  const located = new Set<string>();
  for (const p of places) {
    for (const m of [p.id, ...p.with.map((w) => w.id)]) if (p.pos) located.add(m);
    /* a spot belongs to its own stop, however far out (Penglai, Macau) */
    if (p.pos) home(p.id, p.name, p.pos, 'place', p.kind === 'spot' ? p.stopId : undefined);
  }
  for (const b of t.bookings) {
    if (b.status === 'cancelled') continue;
    if (b.kind === 'flight' && ok(b.coord)) home(b.id, `${b.flightNo} departs`, b.coord, 'station');
    if (b.kind === 'train' || b.kind === 'other') {
      for (const end of [b.from, b.to]) for (const st of end?.stations ?? []) if (ok(st.coord)) home(`${b.id}:${st.name}`, st.name, st.coord, 'station');
    }
  }
  const ids = new Set([...t.stops.flatMap((s) => (s.spots ?? []).map((x) => x.id)), ...t.showCards.map((c) => c.id), ...t.bookings.map((b) => b.id)]);
  for (const c of COVERAGE) {
    if (!ids.has(c.for) || located.has(c.for)) continue;
    if (!stops.some((s) => s.id === c.stopId)) continue;
    anchors.push({ id: `coverage:${c.for}`, label: c.label, at: c.at, stopId: c.stopId, src: 'coverage' });
  }
  return { anchors, dropped };
}

/** A box round some anchors, grown by `marginKm` on every side (rounded out to 1e-4°). */
function boxOf(list: Anchor[], marginKm: number): Box {
  const lats = list.map((a) => a.at.lat);
  const lngs = list.map((a) => a.at.lng);
  const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = marginKm / KM_PER_DEG;
  const dLng = marginKm / (KM_PER_DEG * Math.cos((mid * Math.PI) / 180));
  const down = (x: number): number => Math.floor(x * 1e4) / 1e4;
  const up = (x: number): number => Math.ceil(x * 1e4) / 1e4;
  return {
    w: down(Math.min(...lngs) - dLng),
    s: down(Math.min(...lats) - dLat),
    e: up(Math.max(...lngs) + dLng),
    n: up(Math.max(...lats) + dLat),
    stopIds: [...new Set(list.map((a) => a.stopId))],
    anchors: list,
  };
}

const overlaps = (a: Box, b: Box): boolean => a.w < b.e && b.w < a.e && a.s < b.n && b.s < a.n;
const union = (a: Box, b: Box): Box => ({
  w: Math.min(a.w, b.w),
  s: Math.min(a.s, b.s),
  e: Math.max(a.e, b.e),
  n: Math.max(a.n, b.n),
  stopIds: [...new Set([...a.stopIds, ...b.stopIds])],
  anchors: [...a.anchors, ...b.anchors],
});

/** Single-linkage clusters of one stop's anchors. */
function clusters(list: Anchor[], linkKm: number): Anchor[][] {
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] ?? i)));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a && b && haversineKm(a.at, b.at) < linkKm) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Anchor[]>();
  list.forEach((a, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), a]);
  });
  return [...groups.values()];
}

/** The boxes: clusters per stop, grown by the margin, every stop's own square
    (its 'stop' anchor, grown by stopMinKm — the anchor itself is listed in its
    cluster's box, not twice), overlaps merged. */
export function boxesOf(anchors: Anchor[], linkKm = LINK_KM, marginKm = MARGIN_KM, stopMinKm = STOP_MIN_KM): Box[] {
  const byStop = new Map<string, Anchor[]>();
  for (const a of anchors) byStop.set(a.stopId, [...(byStop.get(a.stopId) ?? []), a]);
  let boxes: Box[] = [];
  for (const list of byStop.values()) for (const c of clusters(list, linkKm)) boxes.push(boxOf(c, marginKm));
  for (const a of anchors) if (a.src === 'stop') boxes.push({ ...boxOf([a], stopMinKm), anchors: [] });
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a && b && overlaps(a, b)) {
          boxes = [...boxes.filter((_, k) => k !== i && k !== j), union(a, b)];
          changed = true;
          break outer;
        }
      }
    }
  }
  return boxes.sort((a, b) => b.n - a.n || a.w - b.w);
}

/** A box's area in km². */
export function boxKm2(b: Box): number {
  const mid = ((b.s + b.n) / 2) * (Math.PI / 180);
  return (b.e - b.w) * KM_PER_DEG * Math.cos(mid) * (b.n - b.s) * KM_PER_DEG;
}

/** The areas, one per stop, in trip order. A merged box that spans two stops
    is listed under the first — and a stop left with no area of its own is
    named in the one that covers it ("Tel Aviv + Jerusalem": the stops' squares
    merged), so every stop on the map is in the list the owner reads. */
export function areasOf(t: PlaceSources): { areas: Area[]; boxes: Box[]; anchors: Anchor[]; dropped: Dropped[] } {
  const { anchors, dropped } = anchorsOf(t);
  const boxes = boxesOf(anchors);
  const order = [...t.stops].filter((s) => s.kind === 'stop').sort((a, b) => a.start.localeCompare(b.start) || a.order - b.order);
  const areas: Area[] = [];
  const used = new Set<Box>();
  for (const s of order) {
    const mine = boxes.filter((b) => !used.has(b) && b.stopIds.includes(s.id));
    for (const b of mine) used.add(b);
    if (mine.length) areas.push({ stopId: s.id, name: shortStop(s), boxes: mine, km2: Math.round(mine.reduce((n, b) => n + boxKm2(b), 0)) });
  }
  for (const s of order) {
    if (areas.some((a) => a.stopId === s.id)) continue;
    const a = areas.find((x) => x.boxes.some((b) => b.stopIds.includes(s.id)));
    if (a && !a.name.split(' + ').includes(shortStop(s))) a.name += ` + ${shortStop(s)}`;
  }
  return { areas, boxes, anchors, dropped };
}

const shortStop = (s: Stop): string => (s.name.split(' — ')[0] ?? s.name).trim();

/** The name a pack built for a trip carries (`ltd:pack`), the phone's and the workshop's alike: "China 2026" →
    "china-2026-map". */
export const packName = (title: string): string =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'trip'
  }-map`;

/** The one region an extract reads: a MultiPolygon, one part per box. */
export function regionOf(boxes: Box[]): Region {
  return {
    type: 'MultiPolygon',
    coordinates: boxes.map((b) => [
      [
        [b.w, b.s],
        [b.e, b.s],
        [b.e, b.n],
        [b.w, b.n],
        [b.w, b.s],
      ],
    ]),
  };
}

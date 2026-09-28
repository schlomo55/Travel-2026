/* THE COORDINATE PASS'S RULES — when an OpenStreetMap answer may become a pin.

   Pure: no network, no files. `npm run verify:places` gathers the answers (and
   caches them); this file decides, so the decision can be re-run, read and
   unit-tested without asking anybody anything (src/tests/mapdata.test.ts).

   A PIN IS KEPT ONLY WHEN ALL OF THESE HOLD, in this order — the first that
   fails is the reason written down:

   1. OSM KNOWS THE PLACE. Of Nominatim's five answers, the FIRST that passes
      rules 2–4 is the one judged. The answers above it are namesakes — a bus
      stop, a metro station, a motorway junction or a house number named
      after the place (all measured, 2026-09-28) — and are written into the
      reason as skipped. A button opens the first answer, so the button gate
      reads only that; a pin is a claim about where the place IS, so it asks
      whether any answer is the place — and then rules 5–7 still apply.
   2. THE NAME AGREES. One of the answer's own names — the label Nominatim
      shows and every name tag it carries (name, name:zh, name:en,
      official_name, alt_name, short_name; never old_name) — contains one of
      the tokens the trip itself uses, both normalised (NFKC, case, spaces,
      curly quotes, dashes). The existing verify:places gate, reading more.
   3. IT IS NEAR ITS ANCHOR — the stop's verified coordinate, or the spot's
      own yardstick (coords.ts SPOT_COORDS), within the radius the button's
      gate already uses and justifies (spots.ts `nearKm`, map-links.ts), or a
      tighter one the trip's own words give (pin-targets.ts PIN_ANCHORS).
   4. IT IS THE RIGHT KIND OF THING. OSM's class=type fits what the trip says
      the place is (FITS below, or a place's own list in pin-targets.ts
      PIN_FITS): a sight is not a metro station, a ferry terminal is not the
      light-rail stop that shares its name, the 28 Bends are not a petrol
      station, a resort is not a housing estate.
   5. IT IS NOT AMBIGUOUS. No other answer passing rules 2–4 sits somewhere
      else in the circle (further than the answer's own size, at least 1 km).
      A road OSM keeps in pieces is one place: same-name road answers within
      ROAD_KM of each other are its pieces, not rivals. Anything else — a
      chain's branches included — needs Wikidata to side with one answer.
   6. THE SOURCES DO NOT CONTRADICT. The item OSM links the answer to, and any
      item bearing the place's own name inside the circle, must lie on the
      answer's outline or within AGREE_KM of it. Where one does, the pin is
      two sources agreeing (a name that merely CONTAINS the token may agree —
      it must also be there — but only the same name may contradict).
   7. FAR IS HELD TO TWO SOURCES. Past FAR_KM from its anchor distance stops
      telling places apart, so a pin out there needs Wikidata to agree.

   Anything else: no pin. The place keeps opening by name, as it does today. */
import type { Coord } from '../../src/lib/model/types';

export type PinKind = 'sight' | 'food' | 'show' | 'transport' | 'other' | 'hotel' | 'spa' | 'medical';

/** One Nominatim answer, as the pass reads it. */
export interface OsmCand {
  lat: number;
  lng: number;
  /** Nominatim's display_name. */
  label: string;
  /** Every name the object carries (see rule 2). */
  names: string[];
  cls: string;
  type: string;
  /** `node/123` · `way/123` · `relation/123`. */
  osm: string;
  /** The object's own `wikidata=` tag, where it has one. */
  wikidata?: string;
  /** south, north, west, east. */
  bbox?: [number, number, number, number];
}

/** One Wikidata item, as the pass reads it. */
export interface WdCand {
  id: string;
  /** Labels and aliases in Chinese (any script) and English. */
  names: string[];
  coord?: Coord;
}

export interface PinAsk {
  kind: PinKind;
  anchor: Coord;
  nearKm: number;
  /** The trip's own tokens (rule 2). */
  want: string[];
  /** Nominatim's answers for the button's own query, in its own order. */
  osm: OsmCand[];
  /** Wikidata's candidates for the place (its label search, plus the item the
      OSM object links to, if any). */
  wd: WdCand[];
  /** This place's own kinds, replacing the table for its kind — `class=type`
      or `class=*` (pin-targets.ts PIN_FITS, each with its reason). */
  fits?: readonly string[];
}

export type PinSources = 'osm' | 'osm+wikidata';

export interface PinVerdict {
  ok: boolean;
  /** The one OSM answer the verdict is about (the pin, or the reason's subject). */
  hit?: OsmCand;
  /** Great-circle km from the anchor. */
  km?: number;
  sources?: PinSources;
  /** The Wikidata item that agreed, and how far from the hit it sits. */
  wd?: { id: string; km: number };
  reason: string;
}

/** Past this, distance alone no longer tells places apart (rule 7) — the same
    25 km a city stop can plausibly cover (spots.ts DEFAULT_NEAR_KM). */
export const FAR_KM = 25;

/** How far apart two same-name pieces of one road may lie (rule 5): Nanbin
    Road's four answers span ~1 km, the Jade Belt path's ~1.3 km. */
export const ROAD_KM = 5;

export function km(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** NFKC folds full-width forms; case, whitespace, curly quotes and the dash
    family are noise. Nothing else is touched — "M+" must stay "m+". */
export function normName(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, '');
}

/** The name part of Nominatim's display_name — everything before its first
    comma, which is where the address starts. */
export const labelName = (label: string): string => (label.split(',')[0] ?? label).trim();

/** The name tags that say what an object IS called — never old_name, which a
    place can lose to a successor, nor anything that merely mentions a name. */
const NAME_KEY = /^(name|official_name|alt_name|short_name|int_name|loc_name|reg_name)(:[a-z]{2,3}(-[A-Za-z]+)?)?$/;

/** Every name an OSM object carries, its label's first (rule 2). OSM packs
    alternatives into one tag with semicolons; each counts on its own. */
export function osmNames(label: string, namedetails: Record<string, string> = {}): string[] {
  const out = [labelName(label)];
  for (const [k, v] of Object.entries(namedetails)) {
    if (!NAME_KEY.test(k) || !v) continue;
    for (const part of v.split(';')) {
      const p = part.trim();
      if (p && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Rule 2: some name of the hit contains some token of the trip's. */
export function namesAgree(names: string[], want: string[]): string | null {
  const tokens = want.map(normName).filter(Boolean);
  for (const n of names) {
    const nn = normName(n);
    if (nn && tokens.some((t) => nn.includes(t))) return n;
  }
  return null;
}

/** Rule 6's stricter test: some name of the item IS one of the trip's tokens.
    Only an item with the place's own name can contradict an answer — 后堡站,
    a metro station whose alias is 南滨路站, contains Nanbin Road's name and is
    not Nanbin Road. */
export function namesEqual(names: string[], want: string[]): boolean {
  const tokens = new Set(want.map(normName).filter(Boolean));
  return names.some((n) => tokens.has(normName(n)));
}

/** Half the diagonal of the object's own extent — how big it is. A node is 0. */
export function sizeKm(c: OsmCand): number {
  if (!c.bbox) return 0;
  const [s, n, w, e] = c.bbox;
  return km({ lat: s, lng: w }, { lat: n, lng: e }) / 2;
}

/** How far a point lies OUTSIDE the answer's own outline (its bounding box;
    0 inside it). A lake's Wikidata point on its shore is on the lake.

    AN ADMINISTRATIVE BOUNDARY IS THE EXCEPTION: its outline is a whole
    district, and the point Nominatim gives for it may be the town at its
    centre (威海市, 双廊镇) or just the middle of the map (崇礼区 lands 9 km
    from Xiwanzi, 香格里拉市 14 km from Dukezong). Anything "inside" a district
    says nothing about where its town is, so a boundary is measured point to
    point, against BOUNDARY_AGREE_KM. */
export function offKm(c: OsmCand, p: Coord): number {
  if (c.cls === 'boundary') return Math.max(0, km(c, p) - (BOUNDARY_AGREE_KM - AGREE_KM));
  if (!c.bbox) return km(c, p);
  const [s, n, w, e] = c.bbox;
  return km(p, { lat: Math.min(Math.max(p.lat, s), n), lng: Math.min(Math.max(p.lng, w), e) });
}

/** Two sources agree when Wikidata's point is on the answer or within this of
    its outline (rules 5–7). */
export const AGREE_KM = 0.5;
/** …and, for a town, district or city boundary, within this of its point — a
    city's Wikidata point marks its centre, and Weihai's sits 1.9 km from OSM's. */
export const BOUNDARY_AGREE_KM = 2;

/* RULE 4 — WHAT KIND OF THING OSM SAYS IT IS.

   Per kind, the classes that fit, and within a class either every type ('*')
   or the listed ones. What is NOT here is the point. highway=bus_stop,
   amenity=fuel, amenity=school, highway=motorway_junction, landuse=residential
   and historic=house fit nothing a trip names — those are OSM's answers for
   Walnut Garden, the 28 Bends, Taikoo Li, Jinshanling, Jiuhua's namesake
   estate in Hefei and a courtyard on Dali's Renmin Road. A SIGHT is never a
   railway station (南锣鼓巷, 王府井 and 什刹海 all answer first with theirs),
   and tourism=hotel is not a sight (a hotel named after a temple is not the
   temple) — only the tourism types that are sights are.

   A street is a fair answer for a street the trip names (Hollywood Road,
   Nanbin Road, Wenlin Street), so the ordinary road types fit a sight or a
   food street — never a service road, a bus stop or a track. */
const ROADS = ['primary', 'secondary', 'tertiary', 'trunk', 'unclassified', 'residential', 'pedestrian', 'living_street', 'footway', 'path', 'steps'];
const AREA = {
  tourism: ['attraction', 'museum', 'viewpoint', 'gallery', 'zoo', 'theme_park', 'artwork', 'aquarium', 'yes'],
  historic: ['monument', 'memorial', 'ruins', 'castle', 'city_gate', 'citywalls', 'building', 'temple', 'archaeological_site', 'heritage', 'tower', 'fort', 'palace', 'tomb', 'wayside_shrine', 'yes', 'dormitory', 'district'],
  natural: ['*'],
  water: ['lake', 'reservoir', 'pond', 'river', 'basin'],
  place: ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'island', 'islet', 'locality', 'hamlet', 'borough', 'city_block', 'square'],
  boundary: ['administrative', 'national_park', 'protected_area'],
  leisure: ['park', 'garden', 'nature_reserve', 'common', 'water_park', 'beach_resort', 'marina', 'track', 'stadium', 'sports_centre', 'resort', 'ice_rink'],
  landuse: ['recreation_ground', 'religious', 'retail', 'commercial', 'village_green', 'forest', 'winter_sports'],
  amenity: ['place_of_worship', 'monastery', 'university', 'college', 'arts_centre', 'library', 'fountain', 'townhall', 'marketplace', 'theatre'],
  man_made: ['tower', 'bridge', 'pier', 'lighthouse', 'observatory', 'viewpoint'],
  bridge: ['*'],
  waterway: ['river', 'stream', 'waterfall', 'canal'],
  highway: ROADS,
  building: ['yes', 'temple', 'church', 'cathedral', 'civic', 'public', 'tower', 'pagoda', 'shrine', 'museum', 'university', 'college', 'commercial', 'retail'],
} as const;

export const FITS: Record<PinKind, Record<string, readonly string[]>> = {
  sight: { ...AREA, aerialway: ['station', 'cable_car', 'gondola'], railway: ['monorail'] },
  food: {
    amenity: ['restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub', 'biergarten', 'ice_cream', 'marketplace'],
    shop: ['bakery', 'pastry', 'confectionery', 'deli', 'tea', 'coffee', 'seafood', 'food', 'dairy'],
    tourism: ['guest_house', 'hotel'],
    highway: ROADS,
    place: ['neighbourhood', 'quarter', 'locality'],
    landuse: ['retail', 'commercial'],
  },
  show: {
    amenity: ['theatre', 'arts_centre', 'concert_hall', 'cinema', 'events_venue', 'event_ground', 'community_centre', 'nightclub', 'music_venue', 'exhibition_centre', 'restaurant', 'cafe', 'bar', 'pub'],
    tourism: ['hotel', 'attraction', 'museum'],
    leisure: ['park', 'common', 'garden'],
    building: ['yes', 'theatre', 'civic', 'public', 'commercial'],
    landuse: ['recreation_ground', 'commercial'],
    place: ['square', 'locality'],
  },
  transport: {
    railway: ['station', 'halt', 'stop', 'tram_stop'],
    public_transport: ['station', 'stop_area', 'platform'],
    aeroway: ['aerodrome', 'terminal'],
    aerialway: ['*'],
    amenity: ['ferry_terminal', 'bus_station'],
    building: ['train_station', 'transportation', 'yes'],
    man_made: ['pier'],
    highway: ['footway', 'steps', 'elevator'],
    tourism: ['attraction'],
  },
  other: { shop: ['*'], amenity: ['marketplace'], landuse: ['retail', 'commercial'], building: ['yes', 'retail', 'commercial'] },
  hotel: { tourism: ['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'chalet', 'alpine_hut'], building: ['hotel'] },
  spa: { leisure: ['spa', 'resort', 'sauna'], amenity: ['public_bath', 'spa'], natural: ['hot_spring'], shop: ['massage', 'beauty'], tourism: ['hotel', 'attraction', 'resort'] },
  medical: { amenity: ['hospital', 'clinic', 'doctors'], healthcare: ['*'], building: ['hospital'] },
};

export function fits(kind: PinKind, cls: string, type: string, own?: readonly string[]): boolean {
  if (own) return own.includes(`${cls}=${type}`) || own.includes(`${cls}=*`);
  const types = FITS[kind][cls];
  return !!types && (types.includes('*') || types.includes(type));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const what = (c: OsmCand) => `${c.cls}=${c.type} "${c.names[0] ?? labelName(c.label)}"`;

/** The Wikidata items that speak about this place, nearest the answer first:
    the item OSM links the answer to, and items whose name carries one of the
    trip's tokens — or, with `strict`, IS one (rule 6's contradictions). `d`
    is how far each lies outside the answer's outline. */
function wdOfName(a: PinAsk, hit: OsmCand, strict = false): { c: WdCand & { coord: Coord }; d: number; linked: boolean }[] {
  return a.wd
    .filter((c): c is WdCand & { coord: Coord } => !!c.coord)
    .map((c) => ({ c, d: offKm(hit, c.coord), linked: c.id === hit.wikidata }))
    .filter((x) => x.linked || (strict ? namesEqual(x.c.names, a.want) : !!namesAgree(x.c.names, a.want)))
    .sort((x, y) => Number(y.linked) - Number(x.linked) || x.d - y.d);
}

/** Rules 2–4 for one answer: null when it passes, else why it does not. */
function reject(a: PinAsk, hit: OsmCand | undefined): string | null {
  if (!hit) return 'OSM does not know this name';
  if (!namesAgree(hit.names, a.want)) return `a different place: "${hit.names[0] ?? hit.label}"`;
  const d = km(a.anchor, hit);
  if (d > a.nearKm) return `${d.toFixed(1)} km from its anchor — too far (limit ${a.nearKm} km)`;
  if (!fits(a.kind, hit.cls, hit.type, a.fits)) {
    return a.fits
      ? `OSM files it as ${hit.cls}=${hit.type}; the trip names a ${a.fits.join(" or ")}`
      : `OSM files it as ${hit.cls}=${hit.type}, which is not a ${a.kind}`;
  }
  return null;
}

/** Rule 1: the first answer that passes rules 2–4, and the namesakes above it. */
function firstPlace(a: PinAsk, list: OsmCand[]): { hit?: OsmCand; skipped: OsmCand[] } {
  const skipped: OsmCand[] = [];
  for (const c of list) {
    if (!reject(a, c)) return { hit: c, skipped };
    skipped.push(c);
  }
  return { skipped };
}

/** Rule 5: the other answers that pass rules 2–4 somewhere else in the circle.
    Same-name road answers within ROAD_KM are pieces of one road, not rivals. */
function rivalsOf(a: PinAsk, list: OsmCand[], hit: OsmCand): OsmCand[] {
  const sep = Math.max(1, sizeKm(hit));
  const same = (x: OsmCand) => normName(x.names[0] ?? '') === normName(hit.names[0] ?? '');
  return list.filter(
    (c) => c !== hit && !reject(a, c) && km(hit, c) > sep && !(c.cls === 'highway' && hit.cls === 'highway' && same(c) && km(hit, c) <= ROAD_KM),
  );
}

export function decidePin(a: PinAsk): PinVerdict {
  const first = firstPlace(a, a.osm);
  const hit = first.hit;
  if (!hit) {
    const top = a.osm[0];
    const why = reject(a, top) ?? 'OSM does not know this name';
    const more = a.osm.length > 1 ? ' — and none of its other answers is the place either' : '';
    return { ok: false, ...(top ? { hit: top, km: r2(km(a.anchor, top)) } : {}), reason: why + more };
  }
  const skippedNote = first.skipped.length ? `skipped ${first.skipped.map(what).join(', ')} above it` : null;

  /* rule 5 — another answer of the same name and kind, elsewhere in the circle:
     only Wikidata siding with one of them settles it */
  const h = hit;
  let resolvedBy: string | null = null;
  const rivals = rivalsOf(a, a.osm, h);
  if (rivals.length) {
    const siding = wdOfName(a, h).find((x) => x.d <= AGREE_KM);
    if (!siding) {
      const r = rivals[0]!;
      return {
        ok: false,
        hit: h,
        km: r2(km(a.anchor, h)),
        reason: `ambiguous: ${rivals.length + 1} places of that name and kind in the circle ("${r.names[0] ?? r.label}" ${km(h, r).toFixed(1)} km away)`,
      };
    }
    resolvedBy = `Wikidata ${siding.c.id} sides with this answer`;
  }

  /* rule 6 — an item OSM links to, or one bearing the place's own name inside
     the circle, must lie on the answer's outline or within AGREE_KM of it */
  const d = km(a.anchor, h);
  const inCircle = (x: { c: { coord: Coord }; linked: boolean }) => x.linked || km(a.anchor, x.c.coord) <= a.nearKm;
  const agree = wdOfName(a, h).filter(inCircle).find((x) => x.d <= AGREE_KM);
  const against = wdOfName(a, h, true).filter(inCircle).filter((x) => x.d > AGREE_KM);
  if (!agree && against.length) {
    const w = against[0]!;
    return {
      ok: false,
      hit: h,
      km: r2(d),
      reason: `the sources disagree: Wikidata ${w.c.id} puts "${w.c.names[0] ?? ''}" ${w.d.toFixed(1)} km from OSM's answer`,
    };
  }

  /* rule 7 — far from the anchor, one source is not enough */
  if (d > FAR_KM && !agree) {
    return { ok: false, hit: h, km: r2(d), reason: `${d.toFixed(1)} km out, past ${FAR_KM} km, and Wikidata does not confirm it` };
  }

  const sources: PinSources = agree ? 'osm+wikidata' : 'osm';
  return {
    ok: true,
    hit: h,
    km: r2(d),
    sources,
    ...(agree ? { wd: { id: agree.c.id, km: r2(agree.d) } } : {}),
    reason: [
      agree ? `two sources agree (Wikidata ${agree.c.id}${agree.linked ? ', the item OSM links to' : ''}, ${agree.d === 0 ? 'on the answer' : `${agree.d.toFixed(2)} km from it`})` : 'one clean OSM answer',
      resolvedBy,
      skippedNote,
    ]
      .filter(Boolean)
      .join('; '),
  };
}

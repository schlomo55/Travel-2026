/* Coordinates and map links.

   THE GCJ-02 TRAP: everything the app stores is WGS-84, the datum GPS and
   Google Maps use. Mainland Chinese map apps (Amap / 高德, Baidu, Tencent) draw
   on GCJ-02, a state-mandated offset of the same globe. Handing raw WGS-84 to
   Amap puts the pin 100–600 m away — enough to send a taxi to the wrong block.
   So: store WGS-84, convert at the link builder, and only for mainland apps.

   The transform below is the standard public Krasovsky-ellipsoid approximation.
   It is deterministic, dependency-free and a deliberate no-op outside the
   mainland bounding box — which is why Hong Kong (already WGS-84 on Amap)
   passes through untouched. */
import type { Coord } from '../model/types';

const PI = Math.PI;
const A = 6378245.0; // Krasovsky 1940 semi-major axis
const EE = 0.00669342162296594323; // and its squared eccentricity

/** Outside mainland China the offset is not applied (HK, Macau, Taiwan, abroad). */
export function outOfChina(lat: number, lng: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return ret;
}

/** WGS-84 → GCJ-02 ("Mars coordinates"). Identity outside mainland China. */
export function wgs84ToGcj02(lat: number, lng: number): Coord {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

/* Hong Kong and Macau sit inside the crude mainland box but are NOT shifted on
   Chinese maps. Keeping them literal here is simpler — and safer — than
   trying to trace the real administrative border. */
const HK_MACAU = { minLat: 22.05, maxLat: 22.58, minLng: 113.5, maxLng: 114.45 };

export function isShiftedDatumArea(lat: number, lng: number): boolean {
  if (outOfChina(lat, lng)) return false;
  const h = HK_MACAU;
  return !(lat >= h.minLat && lat <= h.maxLat && lng >= h.minLng && lng <= h.maxLng);
}

/** The datum Amap expects for this point: shifted inland, plain in HK/Macau. */
export function toAmapDatum(c: Coord): Coord {
  return isShiftedDatumArea(c.lat, c.lng) ? wgs84ToGcj02(c.lat, c.lng) : c;
}

const fix6 = (n: number): string => n.toFixed(6);

/** What a map button should open for one place.
    `url` is a share link the owner pasted — it wins over everything.
    `query` is a place NAME (Chinese on the mainland): a name search lands on
    the real place page, with its photos, hours and Directions button.
    `address` is the street address, in the local script — it narrows the name
    to one building without ever replacing it.
    `coord` alone is the honest fallback — a correct dot beats the wrong branch
    of a chain. Decided at build time in scripts/china/map-links.ts; the app
    never looks anything up. */
export interface MapTarget {
  url?: string;
  query?: string;
  address?: string;
  city?: string;
  coord?: Coord;
}

/** How long a shipped address may be. Chinese writes an address in a dozen
    characters; anything past this is a postal essay, not a destination. */
export const ADDRESS_MAX = 60;
/** And how long the whole search string may be. Past this a map search starts
    matching the postcode instead of the place, so the address is dropped and
    the clean name + city is sent — which is what worked before addresses. */
export const QUERY_MAX = 120;

const CJK = /[㐀-鿿]/;
/** Blank is the same as absent everywhere below: a field the owner cleared
    must not conjure a button that searches for whitespace. */
const has = (s: string | undefined): s is string => !!s && !!s.trim();

/** Address components ordered BIG → SMALL (province, city, district,
    subdistrict, street) into one line.

    Chinese writes an address biggest-first and unseparated —
    重庆市渝中区朝天门街道千厮门大桥 — which is what a driver reads at a glance.
    Latin addresses run the other way, smallest-first with commas. Both are
    produced here from the same ordered input, and both are trimmed from the
    BIG end when they run long: a taxi already in Chongqing does not need to be
    told the province. */
export function joinAddress(bigToSmall: string[]): string {
  const parts = [...new Set(bigToSmall.map((p) => p.trim()).filter(Boolean))];
  if (!parts.length) return '';
  const chinese = parts.every((p) => CJK.test(p));
  const render = (p: string[]) => (chinese ? p.join('') : [...p].reverse().join(', '));
  let out = parts;
  while (out.length > 1 && render(out).length > ADDRESS_MAX) out = out.slice(1);
  const line = render(out);
  return line.length > ADDRESS_MAX ? line.slice(0, ADDRESS_MAX).trim() : line;
}

/** Only a real web link may be launched — a pasted value is never trusted. */
export function safeMapUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** What a map search actually receives, highest precedence first:
      a saved link wins outright (handled by the callers, not here),
      then NAME + ADDRESS + CITY,
      then NAME + CITY,
      then the coordinate.

    The address never replaces the name — 洪崖洞 finds the place page, an address
    alone finds a block of road. It is appended, so the search has both, and it
    is dropped again the moment the pair grows past QUERY_MAX: a search engine
    handed 200 characters of postal string matches the postcode, not the place. */
export function searchTerms(t: MapTarget): string {
  const part = (s: string | undefined) => (has(s) ? s.trim() : '');
  const withAddress = [part(t.query), part(t.address), part(t.city)].filter(Boolean).join(', ');
  if (withAddress.length <= QUERY_MAX) return withAddress;
  return [part(t.query), part(t.city)].filter(Boolean).join(', ');
}

/** Google Maps. A name resolves to the place page; a coordinate drops a pin.
    Needs the VPN inside the mainland either way. */
export function googleMapsUrl(t: MapTarget): string | null {
  const saved = safeMapUrl(t.url);
  if (saved) return saved;
  if (has(t.query) || has(t.address)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerms(t))}`;
  if (t.coord) return `https://www.google.com/maps/search/?api=1&query=${fix6(t.coord.lat)},${fix6(t.coord.lng)}`;
  return null;
}

/* Amap's POI search takes ONE keyword field and its own `city` param, so the
   name goes in alone and the address is the fallback for a place that has an
   address but no confirmed name (a bed the owner pasted a confirmation into).
   Piling both into `keywords` makes Amap match neither. */
const amapKeyword = (t: MapTarget): string | undefined =>
  has(t.query) ? t.query.trim() : has(t.address) ? t.address.trim() : undefined;

/** Amap's app scheme for a name: POI search, which resolves Chinese exactly. */
export function amapAppSearchUrl(t: MapTarget): string | null {
  const kw = amapKeyword(t);
  if (!kw) return null;
  const city = t.city ? `&city=${encodeURIComponent(t.city)}` : '';
  return `androidamap://poi?sourceApplication=ltd&keywords=${encodeURIComponent(kw)}${city}&dev=0`;
}

/** Amap's web fallback for a name. */
export function amapWebSearchUrl(t: MapTarget): string | null {
  const kw = amapKeyword(t);
  if (!kw) return null;
  const city = t.city ? `&city=${encodeURIComponent(t.city)}` : '';
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(kw)}${city}`;
}

/** The ONE link the app launches on the phone.

    `geo:` is Android's own "here is a place" intent. Every map app registers
    for it, so the system shows its chooser the first time and then remembers
    the pick — which is the entire point of a single button: the owner decides
    once, with their own map app, and the phone honours it forever after.

    A NAME goes out as a search (`geo:0,0?q=…`). Each app then resolves the
    name in its own data, which sidesteps the GCJ-02 shift completely: Amap
    looks it up on its own datum, Google on WGS-84, and neither is handed a
    coordinate it could misplace.

    A COORDINATE goes out as a labelled pin, in WGS-84 — the datum RFC 5870
    defines geo: on, and converting to it is then the receiving app's job.

    A saved share link is not a geo: URI at all: there is nothing to convert,
    the https link opens as itself. Hence null here — the caller opens it. */
export function geoUri(t: MapTarget, label?: string): string | null {
  if (safeMapUrl(t.url)) return null;
  if (has(t.query) || has(t.address)) return `geo:0,0?q=${encodeURIComponent(searchTerms(t))}`;
  if (t.coord) {
    const ll = `${fix6(t.coord.lat)},${fix6(t.coord.lng)}`;
    const name = (label ?? '').trim();
    return `geo:${ll}?q=${ll}${name ? `(${encodeURIComponent(name)})` : ''}`;
  }
  return null;
}

/** Amap's Android app scheme. Note lat/lon named params here. */
export function amapAppUrl(c: Coord, name: string): string {
  const g = toAmapDatum(c);
  return `androidamap://viewMap?sourceApplication=ltd&lat=${fix6(g.lat)}&lon=${fix6(g.lng)}&poiname=${encodeURIComponent(name)}&dev=0`;
}

/** Amap's web fallback. Its URI API takes position as LNG,LAT — not lat,lng. */
export function amapWebUrl(c: Coord, name: string): string {
  const g = toAmapDatum(c);
  return `https://uri.amap.com/marker?position=${fix6(g.lng)},${fix6(g.lat)}&name=${encodeURIComponent(name)}`;
}

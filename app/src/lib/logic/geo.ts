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
    `coord` alone is the honest fallback — a correct dot beats the wrong branch
    of a chain. Decided at build time in scripts/china/map-links.ts; the app
    never looks anything up. */
export interface MapTarget {
  url?: string;
  query?: string;
  city?: string;
  coord?: Coord;
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

const searchTerms = (t: MapTarget): string => [t.query, t.city].filter(Boolean).join(', ');

/** Google Maps. A name resolves to the place page; a coordinate drops a pin.
    Needs the VPN inside the mainland either way. */
export function googleMapsUrl(t: MapTarget): string | null {
  const saved = safeMapUrl(t.url);
  if (saved) return saved;
  if (t.query) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerms(t))}`;
  if (t.coord) return `https://www.google.com/maps/search/?api=1&query=${fix6(t.coord.lat)},${fix6(t.coord.lng)}`;
  return null;
}

/** Amap's app scheme for a name: POI search, which resolves Chinese exactly. */
export function amapAppSearchUrl(t: MapTarget): string | null {
  if (!t.query) return null;
  const city = t.city ? `&city=${encodeURIComponent(t.city)}` : '';
  return `androidamap://poi?sourceApplication=ltd&keywords=${encodeURIComponent(t.query)}${city}&dev=0`;
}

/** Amap's web fallback for a name. */
export function amapWebSearchUrl(t: MapTarget): string | null {
  if (!t.query) return null;
  const city = t.city ? `&city=${encodeURIComponent(t.city)}` : '';
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(t.query)}${city}`;
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
  if (t.query) return `geo:0,0?q=${encodeURIComponent(searchTerms(t))}`;
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

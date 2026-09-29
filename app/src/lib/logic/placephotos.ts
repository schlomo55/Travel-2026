/* THE PLACES' PHOTOS, AS DATA (Map 5e) — what the map pack's photo index says
   about a place, and how the app words it. Pure: no file is read here (that is
   lib/map/photos.ts), nothing goes online.

   WHERE THE PHOTOS LIVE. Inside the map pack, after its tiles: the pack is a
   PMTiles v3 archive, then the photos (WebP, three sizes each), then this
   index (JSON), then a 32-byte trailer that says where the index is. Its own
   metadata says how many bytes of photos follow (`ltd:photos`), so a copy cut
   short is refused (lib/map/pack.ts). A pack from before Map 5e is the
   archive alone: no index, no photos — and every screen looks as it did.

   WHAT THE INDEX SAYS. Every place the pack's build LOOKED at, by the Map
   tab's own id: its free photo (who took it, under which licence, its file
   page), Wikipedia's own first sentences about it and the article, its
   official site. A place the build looked at and found no free photo for
   says so ("No free photo of this place"); a place it never looked at (added
   to the trip after the pack was built) says nothing — it simply has no photo
   box, as before Map 5e.

   TRUTH RULES: a photo is shown only with its credit; an About is Wikipedia's
   text verbatim, labelled "From Wikipedia", with its article and licence;
   nothing here is composed. */

/** The trailer that ends a pack carrying photos: "LTDPHOTO", a version, the
    index's offset and length. Every offset here — the trailer's and the
    index's — counts from the end of the archive (the photo region's start),
    so stamping the archive's metadata, which changes its length, moves
    nothing the index says. */
export const PHOTO_MAGIC = 'LTDPHOTO';
export const PHOTO_TRAILER = 32;
export const PHOTO_VERSION = 1;

/** One stored image: [offset in the photo region, length, width, height]. */
export type PhotoSpan = [number, number, number, number];

export interface PackPhoto {
  /** the file's own name where it lives ("File:…" on Commons) */
  file: string;
  /** the original's size */
  w: number;
  h: number;
  /** who took it, as the file page credits them — never guessed */
  author: string;
  /** "CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain" */
  licence: string;
  licenceUrl?: string;
  /** the file's own page (Wikimedia Commons, Flickr…) */
  source: string;
  /** where it lives, for the credits: "Wikimedia Commons", "Flickr" */
  site?: string;
  /** the vertical point the crops keep, 0 top … 1 bottom (default ½) */
  fy?: number;
  /** ~800 px long side: the place card (A), full screen, Guide me (F) */
  card: PhotoSpan;
  /** the "Near you" card's banner (B) */
  rail: PhotoSpan;
  /** a square, for the round photo pin (E) */
  pin: PhotoSpan;
}
export interface PackAbout {
  /** Wikipedia's own words: the first sentences of the article's summary, verbatim */
  text: string;
  /** the article's title */
  title: string;
  url: string;
  licence: string;
}
export interface PackPlace {
  /** the place's name when the pack was built (the credits page lists by it) */
  name: string;
  city?: string;
  photo?: PackPhoto;
  about?: PackAbout;
  wikipedia?: string;
  official?: string;
}
export interface PhotoIndex {
  v: number;
  trip?: string;
  built?: string;
  places: Record<string, PackPlace>;
  /** where the photo region starts in the pack file (set by the reader, not stored) */
  base: number;
}

/** Where an image lies in the pack file: [start, end). */
export const spanBytes = (index: Pick<PhotoIndex, 'base'>, s: PhotoSpan): [number, number] => [index.base + s[0], index.base + s[0] + s[1]];

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const httpUrl = (x: unknown): x is string => {
  if (!isStr(x)) return false;
  try {
    const u = new URL(x);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

function span(x: unknown, lo: number, hi: number): PhotoSpan | null {
  if (!Array.isArray(x) || x.length !== 4 || !x.every(isNum)) return null;
  const [at, len, w, h] = x as PhotoSpan;
  if (len <= 0 || w <= 0 || h <= 0 || at < lo || at + len > hi) return null;
  return [at, len, w, h];
}

/**
 * The index as the app may trust it: every image inside the photo region
 * [0, end) — the bytes before the index —, every photo with its author's
 * credit, licence and page, every About with its article. What fails a check
 * is left out — a photo without its credit is never shown — and the rest
 * stands. `base` is where the region starts in the pack file.
 */
export function parseIndex(json: unknown, end: number, base = 0): PhotoIndex | null {
  const lo = 0;
  const hi = end;
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.v !== PHOTO_VERSION || !o.places || typeof o.places !== 'object') return null;
  const places: Record<string, PackPlace> = {};
  for (const [id, raw] of Object.entries(o.places as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (!isStr(p.name)) continue;
    const out: PackPlace = { name: p.name.trim(), ...(isStr(p.city) ? { city: p.city } : {}) };
    const ph = p.photo as Record<string, unknown> | undefined;
    if (ph && typeof ph === 'object') {
      const card = span(ph.card, lo, hi);
      const rail = span(ph.rail, lo, hi);
      const pin = span(ph.pin, lo, hi);
      if (card && rail && pin && isStr(ph.file) && typeof ph.author === 'string' && isStr(ph.licence) && httpUrl(ph.source) && isNum(ph.w) && isNum(ph.h)) {
        out.photo = {
          file: ph.file,
          w: ph.w,
          h: ph.h,
          author: ph.author.trim(),
          licence: ph.licence,
          ...(httpUrl(ph.licenceUrl) ? { licenceUrl: ph.licenceUrl } : {}),
          source: ph.source,
          ...(isStr(ph.site) ? { site: ph.site } : {}),
          ...(typeof ph.fy === 'number' && ph.fy >= 0 && ph.fy <= 1 ? { fy: ph.fy } : {}),
          card,
          rail,
          pin,
        };
      }
    }
    const ab = p.about as Record<string, unknown> | undefined;
    if (ab && typeof ab === 'object' && isStr(ab.text) && isStr(ab.title) && httpUrl(ab.url) && isStr(ab.licence)) {
      out.about = { text: ab.text.trim(), title: ab.title, url: ab.url, licence: ab.licence };
    }
    if (httpUrl(p.wikipedia)) out.wikipedia = p.wikipedia;
    if (httpUrl(p.official)) out.official = p.official;
    places[id] = out;
  }
  return { v: PHOTO_VERSION, ...(isStr(o.trip) ? { trip: o.trip } : {}), ...(isStr(o.built) ? { built: o.built } : {}), places, base };
}

/** What the index says about a place: by its own id, else by an entity riding
    with it (a ticket at its spot) — undefined when the pack never looked at it. */
export function entryFor(index: PhotoIndex | null | undefined, place: { id: string; with?: { id: string }[] }): PackPlace | undefined {
  if (!index) return undefined;
  const own = index.places[place.id];
  if (own) return own;
  for (const m of place.with ?? []) {
    const e = index.places[m.id];
    if (e) return e;
  }
  return undefined;
}

/** A place's photo, when the pack has one. */
export const photoOf = (index: PhotoIndex | null | undefined, place: { id: string; with?: { id: string }[] }): PackPhoto | undefined => entryFor(index, place)?.photo;

/** The credit a photo wears: "Photo: Shujianyang · CC BY-SA 4.0". */
export function creditLine(p: Pick<PackPhoto, 'author' | 'licence'>): string {
  const who = p.author.trim();
  return who ? `Photo: ${who} · ${p.licence}` : `Photo · ${p.licence}`;
}

/** The file's own name, as the credits page titles it ("Temple of Heaven 20160323 01"). */
export function photoTitle(p: Pick<PackPhoto, 'file'>): string {
  return p.file
    .replace(/^File:/, '')
    .replace(/\.(jpe?g|png|webp|tiff?|gif)$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

/** The crops keep this point in view: CSS object-position. */
export const focusOf = (p: Pick<PackPhoto, 'fy'>): string => `50% ${Math.round((p.fy ?? 0.5) * 100)}%`;

/* ---------- the photo pins (E) ---------- */

/** From this zoom on, a place with a photo wears it on its pin — a small round
    photo in its category's ring; below it, the icon (Map 5e: chosen from the
    screenshots — see PROGRESS.md). Clusters are never photos. */
export const PHOTO_PIN_ZOOM = 15;

/** Does a pin wear its photo at this zoom? */
export const photoPinAt = (zoom: number, hasPhoto: boolean): boolean => hasPhoto && zoom >= PHOTO_PIN_ZOOM;

/** The map image a photo pin is drawn with — `ph-<id>`, `-today` or `-tonight` as its pin is. */
export const photoPinImage = (id: string, v: '' | 'today' | 'tonight'): string => `ph-${id}${v ? `-${v}` : ''}`;

/** …and back: which place, which variant, or null for any other image. */
export function parsePhotoPinImage(name: string): { id: string; v: '' | 'today' | 'tonight' } | null {
  const m = /^ph-(.+?)(?:-(today|tonight))?$/.exec(name);
  if (!m?.[1]) return null;
  return { id: m[1], v: (m[2] as 'today' | 'tonight' | undefined) ?? '' };
}

/* ---------- the credits page ---------- */

export interface CreditRow {
  id: string;
  name: string;
  city?: string;
  photo?: PackPhoto;
  about?: PackAbout;
}

/** Every credit the pack carries, city by city in the pack's own order, then by name. */
export function creditRows(index: PhotoIndex | null | undefined): CreditRow[] {
  if (!index) return [];
  return Object.entries(index.places)
    .filter(([, p]) => p.photo || p.about)
    .map(([id, p]) => ({ id, name: p.name, ...(p.city ? { city: p.city } : {}), ...(p.photo ? { photo: p.photo } : {}), ...(p.about ? { about: p.about } : {}) }));
}

/** The licences in use, each once, with the deed to read it at — and how
    many photos use it (a photo two places share counts once, as photoCount). */
export function licencesUsed(index: PhotoIndex | null | undefined): { licence: string; url?: string; n: number }[] {
  const out = new Map<string, { licence: string; url?: string; n: number }>();
  const seen = new Set<number>();
  for (const p of Object.values(index?.places ?? {})) {
    if (!p.photo || seen.has(p.photo.card[0])) continue;
    seen.add(p.photo.card[0]);
    const k = p.photo.licence;
    const was = out.get(k);
    if (was) was.n++;
    else out.set(k, { licence: k, ...(p.photo.licenceUrl ? { url: p.photo.licenceUrl } : {}), n: 1 });
  }
  return [...out.values()].sort((a, b) => b.n - a.n || a.licence.localeCompare(b.licence));
}

/** How many photos the index carries (a photo two places share counts once). */
export function photoCount(index: PhotoIndex | null | undefined): number {
  return new Set(Object.values(index?.places ?? {}).flatMap((p) => (p.photo ? [p.photo.card[0]] : []))).size;
}

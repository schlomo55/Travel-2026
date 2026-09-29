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
  /** the file's own name where it lives ("File:…" on Commons), or the library's id for it ("openverse:…") */
  file: string;
  /** the work's own title where the file's name is not one — a Flickr photo found through Openverse ("Dali -
      Cangshan"): the licence asks for the title the author gave it (CC BY 2.0 §4(b); Map 5f) */
  title?: string;
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

/** A licence that asks no credit of us — CC0, the public domain. A photo under any other is shown only with its
    author named (Map 5f: the index took a CC BY photo with a blank author). */
export const creditFree = (licence: string): boolean => /^(CC0|Public domain)$/i.test(licence.trim());

function span(x: unknown, lo: number, hi: number): PhotoSpan | null {
  if (!Array.isArray(x) || x.length !== 4 || !x.every(isNum)) return null;
  const [at, len, w, h] = x as PhotoSpan;
  if (len <= 0 || w <= 0 || h <= 0 || at < lo || at + len > hi) return null;
  return [at, len, w, h];
}

/**
 * The index as the app may trust it: every image inside the photo region
 * [0, end) — the bytes before the index —, every photo with its licence, its
 * page and its author's credit (a blank author only where the licence asks no
 * credit: CC0, the public domain), every About with its article. What fails a
 * check is left out — a photo without its credit is never shown — and the rest
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
      if (
        card &&
        rail &&
        pin &&
        isStr(ph.file) &&
        typeof ph.author === 'string' &&
        isStr(ph.licence) &&
        (ph.author.trim() !== '' || creditFree(ph.licence)) &&
        httpUrl(ph.source) &&
        isNum(ph.w) &&
        isNum(ph.h)
      ) {
        out.photo = {
          file: ph.file,
          ...(isStr(ph.title) ? { title: ph.title.trim() } : {}),
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

/** THE INDEX FOR THIS TRIP, or null (Map 5f). A pack is built for one trip and its index names that trip's places:
    another trip — the Israel rehearsal trip with the China pack on the phone — gets no photos at all, and so no
    empty "no free photo" boxes on every card, and no About for a place it never had. */
export const indexForTrip = (index: PhotoIndex | null | undefined, tripId: string): PhotoIndex | null => (index && index.trip === tripId ? index : null);

/** The credit a photo wears: "Photo: Shujianyang · CC BY-SA 4.0". */
export function creditLine(p: Pick<PackPhoto, 'author' | 'licence'>): string {
  const who = p.author.trim();
  return who ? `Photo: ${who} · ${p.licence}` : `Photo · ${p.licence}`;
}

/** A photo button's accessible name (the card's photo, Guide me's "Look for this"): what a tap does, then the
    credit the photo wears — the eye reads it on the photo, and a screen reader hears it too (Map 5f: the button's
    label used to replace it). */
export const photoButtonName = (does: string, p: Pick<PackPhoto, 'author' | 'licence'>): string => `${does}. ${creditLine(p)}`;

/** The work's title, as the credits page names it: the title its author gave it where the pack carries one (a
    Flickr photo's), else the file's own name ("Temple of Heaven 20160323 01") — and never a library's internal id
    ("openverse:e4ac…", Map 5f): '' when there is neither. */
export function photoTitle(p: Pick<PackPhoto, 'file' | 'title'>): string {
  const own = p.title?.trim();
  if (own) return own;
  if (!/^File:/i.test(p.file)) return '';
  return p.file
    .replace(/^File:/i, '')
    .replace(/\.(jpe?g|png|webp|tiff?|gif)$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

/* ---------- the photo pins (E) ---------- */

/** From this zoom on, a place with a photo wears it on its pin — a small round
    photo in its category's ring; below it, the icon (Map 5e: chosen from the
    screenshots — see PROGRESS.md). Clusters are never photos. */
export const PHOTO_PIN_ZOOM = 15;

/** THE ZOOM RULE AS THE MAP'S STYLE WRITES IT — one source (Map 5f): lib/map/street draws its pins' image and
    their names' offset with it, `photoPinAt` reads it back for the screen, the tests hold both. Below
    PHOTO_PIN_ZOOM `icon`, from it on `photo`: a maplibre `step` on the zoom. */
export function photoPinStep<T>(icon: T, photo: T): ['step', ['zoom'], T, number, T] {
  return ['step', ['zoom'], icon, PHOTO_PIN_ZOOM, photo];
}

/** Does a pin wear its photo at this zoom? The style's own rule, evaluated as maplibre evaluates a `step`: the
    output of the last stop at or below the zoom. */
export function photoPinAt(zoom: number, hasPhoto: boolean): boolean {
  const [, , below, from, above] = photoPinStep(false, true);
  return hasPhoto && (zoom >= from ? above : below);
}

/* THE PHOTO PIN'S GEOMETRY, CSS px from its point — lib/map/street/pins.ts paints it, the Map tab keeps its own
   words off it (logic/wayfind.ts pinBox, tagBelow): the photo, round; the night rim that is the pin's edge;
   tonight's gap-and-ring, to its outer edge; today's sunrise halo, where it fades out; and its name, which hangs
   PHOTO_LABEL_EM (of the 11.5 px label) below the point and reaches PHOTO_NAME_BELOW down. */
export const PHOTO_R = 20;
export const PHOTO_RIM = 23.5;
export const PHOTO_TONIGHT = 27.25;
export const PHOTO_HALO = 29;
export const PHOTO_LABEL_EM = 2.5;
export const PHOTO_NAME_BELOW = 43;

/** The map image a photo pin is drawn with — `ph-<id>`, `-today` or `-tonight` as its pin is (the style's own
    `concat` writes the same name from the pin's properties). */
export const photoPinName = (id: string, v: '' | 'today' | 'tonight'): string => `ph-${id}${v ? `-${v}` : ''}`;

/** …and back: which place, which variant, or null for any other image. */
export function parsePhotoPinName(name: string): { id: string; v: '' | 'today' | 'tonight' } | null {
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

/** A Creative Commons licence's deed, from its name ("CC BY-SA 4.0" → …/licenses/by-sa/4.0/; CC0's own); none
    for the public domain, which has no licence to read. */
export function deedOf(licence: string): string | undefined {
  const l = licence.trim();
  const m = /^CC (BY|BY-SA) (\d\.\d)$/.exec(l);
  if (m) return `https://creativecommons.org/licenses/${m[1]!.toLowerCase()}/${m[2]}/`;
  return /^CC0$/i.test(l) ? 'https://creativecommons.org/publicdomain/zero/1.0/' : undefined;
}

export interface LicenceUse {
  licence: string;
  /** the deed to read it at */
  url?: string;
  /** how many photos use it (a photo two places share counts once, as photoCount) */
  n: number;
  /** how many About texts use it (Wikipedia's words: CC BY-SA 4.0) */
  texts: number;
}

/** The licences in use, each once, with the deed to read it at — the photos' AND the About texts' (Map 5f: the
    texts' licence was linked only when a photo happened to share it). The photos' own deed where the pack gives
    one, else the licence's by its name. Most photos first. */
export function licencesUsed(index: PhotoIndex | null | undefined): LicenceUse[] {
  const out = new Map<string, LicenceUse>();
  const row = (k: string): LicenceUse => {
    let r = out.get(k);
    if (!r) out.set(k, (r = { licence: k, n: 0, texts: 0 }));
    return r;
  };
  const photos = new Set<number>();
  const texts = new Set<string>();
  for (const p of Object.values(index?.places ?? {})) {
    if (p.photo && !photos.has(p.photo.card[0])) {
      photos.add(p.photo.card[0]);
      const r = row(p.photo.licence);
      r.n++;
      if (!r.url && p.photo.licenceUrl) r.url = p.photo.licenceUrl;
    }
    if (p.about && !texts.has(p.about.url)) {
      texts.add(p.about.url);
      row(p.about.licence).texts++;
    }
  }
  for (const r of out.values()) {
    const d = r.url ? undefined : deedOf(r.licence);
    if (d) r.url = d;
  }
  return [...out.values()].sort((a, b) => b.n - a.n || b.texts - a.texts || a.licence.localeCompare(b.licence));
}

/** How many photos the index carries (a photo two places share counts once). */
export function photoCount(index: PhotoIndex | null | undefined): number {
  return new Set(Object.values(index?.places ?? {}).flatMap((p) => (p.photo ? [p.photo.card[0]] : []))).size;
}

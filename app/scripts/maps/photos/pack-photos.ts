/* THE PHOTO APPENDIX OF A MAP PACK (Map 5e) — DEV ONLY, called by
   build-pack.ts. From the committed manifest (manifest.json — which photo
   for which place, its credit, Wikipedia's words, the links: all decided by
   manifest.ts from the lookups and the choices made by LOOKING at every
   candidate, choices.ts) to the bytes that follow the archive: every photo's
   three images, the index keyed by place id, the trailer (bundle.ts).

   The source images come from the cache (app/.cache/photos/bin), fetched
   once and politely if one is missing (net.ts) — the only network here. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PHOTO_VERSION, type PackPlace, type PhotoIndex } from '../../../src/lib/logic/placephotos';
import { appendixOf, imagesOf, layout, type Images } from './bundle';
import { getFile } from './net';

const here = dirname(fileURLToPath(import.meta.url));
export const MANIFEST = join(here, 'manifest.json');

export interface ManifestPhoto {
  file: string;
  /** the work's own title, for a photo whose file is known by a library's id (Map 5f: Openverse's record) */
  title?: string;
  w: number;
  h: number;
  author: string;
  licence: string;
  licenceUrl?: string;
  source: string;
  site: string;
  /** where the pack's own sizes are made from (a 1280 px thumbnail, or the original) */
  image: string;
  fy?: number;
  /** how it was found, and what it shows — the check made by looking at it */
  via: string;
  shows: string;
}
export interface ManifestAbout {
  text: string;
  /** the summary's first paragraph, as Wikipedia gave it — `text` is its prefix */
  extract: string;
  title: string;
  url: string;
  licence: string;
}
export interface ManifestPlace {
  name: string;
  city: string;
  category: string;
  item?: string;
  photo?: ManifestPhoto;
  about?: ManifestAbout;
  official?: string;
  /** a place looked at and left without a photo: why */
  noPhoto?: string;
}
export interface Manifest {
  v: number;
  trip: string;
  built: string;
  places: Record<string, ManifestPlace>;
  rejected: { place: string; file: string; why: string }[];
}

export const readManifest = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;

/** The appendix for these places (all of them, or the test set's): its bytes,
    the index it carries and how many photos. `small` makes the rehearsal's
    tiny images. */
export async function photoAppendix(m: Manifest, ids: string[], small = false): Promise<{ appendix: Buffer; index: Omit<PhotoIndex, 'base'>; count: number; imageBytes: number }> {
  const made = new Map<string, Images>();
  const list: { key: string; img: Images }[] = [];
  for (const id of ids) {
    const p = m.places[id];
    const ph = p?.photo;
    if (!ph || made.has(ph.file)) continue;
    const src = readFileSync(await getFile(ph.image, 'img'));
    /* the orientation is baked in and every metadata block dropped (bundle.ts) — checked here: no EXIF, no GPS, no XMP left */
    const img = await imagesOf(src, ph.fy ?? 0.5, small);
    for (const b of [img.card, img.rail, img.pin]) {
      const meta = await sharp(b).metadata();
      if (meta.exif || meta.xmp || meta.iptc) throw new Error(`${ph.file}: metadata survived the resize`);
    }
    made.set(ph.file, img);
    list.push({ key: ph.file, img });
  }
  const { parts, at, size } = layout(list);
  const places: Record<string, PackPlace> = {};
  for (const id of ids) {
    const p = m.places[id];
    if (!p) continue;
    const ph = p.photo;
    const spans = ph ? at.get(ph.file) : undefined;
    places[id] = {
      name: p.name,
      city: p.city,
      ...(ph && spans
        ? {
            photo: {
              file: ph.file,
              ...(ph.title ? { title: ph.title } : {}),
              w: ph.w,
              h: ph.h,
              author: ph.author,
              licence: ph.licence,
              ...(ph.licenceUrl ? { licenceUrl: ph.licenceUrl } : {}),
              source: ph.source,
              site: ph.site,
              ...(ph.fy !== undefined && ph.fy !== 0.5 ? { fy: ph.fy } : {}),
              ...spans,
            },
          }
        : {}),
      ...(p.about ? { about: { text: p.about.text, title: p.about.title, url: p.about.url, licence: p.about.licence } } : {}),
      ...(p.about ? { wikipedia: p.about.url } : {}),
      ...(p.official ? { official: p.official } : {}),
    };
  }
  const index = { v: PHOTO_VERSION, trip: m.trip, built: m.built, places };
  const appendix = appendixOf(parts, size, index);
  return { appendix, index, count: made.size, imageBytes: size };
}

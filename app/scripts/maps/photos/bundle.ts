/* THE PHOTOS, INTO THE MAP PACK (Map 5e) — DEV ONLY. The images made from each
   chosen photo, laid end to end after the archive, then the index, then the
   trailer — the format lib/logic/placephotos.ts reads and lib/map/pack.ts
   checks. Every offset counts from the end of the archive, so the archive's
   metadata can be stamped (`ltd:photos`, which changes its length) without
   moving anything the index says.

   THE IMAGES (sharp; metadata — EXIF, GPS, XMP, ICC — never copied: sharp
   writes none unless asked, and the orientation is baked in first):
   · card — 800 px on the long side, uncropped: the place card's 16:9 photo
     (CSS crops it round the photo's own focal point), the full-screen view
     and Guide me's "Look for this";
   · rail — 536 × 216, cropped round the focal point: the "Near you" card's
     banner, 268 × 108 CSS px at 2× (the brief's ~160 px square would be
     blown up four to six times on the S23's 3.75× screen);
   · pin — 128 px square, cropped round the focal point: the round photo pin,
     44 CSS px across (the brief's ~96 px, a little more for the S23). */
import sharp from 'sharp';
import { PHOTO_MAGIC, PHOTO_TRAILER, PHOTO_VERSION, type PhotoSpan } from '../../../src/lib/logic/placephotos';

export const CARD_LONG = 800;
export const RAIL = { w: 536, h: 216 } as const;
export const PIN = 128;

export interface Images {
  card: Buffer;
  rail: Buffer;
  pin: Buffer;
  cardWH: [number, number];
  railWH: [number, number];
  pinWH: [number, number];
}

/** A crop of `w × h` from the image scaled to cover it, kept round the focal point `fy`. */
async function coverCrop(src: Buffer, w: number, h: number, fy: number, quality: number): Promise<Buffer> {
  const base = sharp(src).rotate();
  const meta = await sharp(await base.clone().toBuffer()).metadata();
  const W = meta.width ?? w;
  const H = meta.height ?? h;
  const s = Math.max(w / W, h / H);
  const rw = Math.max(w, Math.round(W * s));
  const rh = Math.max(h, Math.round(H * s));
  const left = Math.round((rw - w) / 2);
  const top = Math.min(rh - h, Math.max(0, Math.round((rh - h) * fy)));
  return sharp(src).rotate().resize(rw, rh).extract({ left, top, width: w, height: h }).webp({ quality, effort: 6 }).toBuffer();
}

/** The three images of one photo. `small` makes the rehearsal's tiny set. */
export async function imagesOf(src: Buffer, fy = 0.5, small = false): Promise<Images> {
  const long = small ? 420 : CARD_LONG;
  const card = await sharp(src)
    .rotate()
    .resize({ width: long, height: long, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: small ? 58 : 74, effort: 6 })
    .toBuffer();
  const m = await sharp(card).metadata();
  const rw: [number, number] = small ? [268, 108] : [RAIL.w, RAIL.h];
  const pw: [number, number] = small ? [96, 96] : [PIN, PIN];
  const rail = await coverCrop(src, rw[0], rw[1], fy, small ? 55 : 70);
  const pin = await coverCrop(src, pw[0], pw[1], fy, small ? 60 : 76);
  return { card, rail, pin, cardWH: [m.width ?? 0, m.height ?? 0], railWH: rw, pinWH: pw };
}

export interface Laid {
  card: PhotoSpan;
  rail: PhotoSpan;
  pin: PhotoSpan;
}

/** The photo region: every image end to end, and where each lies (from 0). */
export function layout(list: { key: string; img: Images }[]): { parts: Buffer[]; at: Map<string, Laid>; size: number } {
  const parts: Buffer[] = [];
  const at = new Map<string, Laid>();
  let o = 0;
  const put = (b: Buffer, w: number, h: number): PhotoSpan => {
    const s: PhotoSpan = [o, b.length, w, h];
    parts.push(b);
    o += b.length;
    return s;
  };
  for (const { key, img } of list) {
    if (at.has(key)) continue;
    const card = put(img.card, img.cardWH[0], img.cardWH[1]);
    const rail = put(img.rail, img.railWH[0], img.railWH[1]);
    const pin = put(img.pin, img.pinWH[0], img.pinWH[1]);
    at.set(key, { card, rail, pin });
  }
  return { parts, at, size: o };
}

/** The 32 bytes that end the pack: the magic, the version, the index's offset and length (from the region's start). */
export function trailerOf(indexAt: number, indexLen: number): Buffer {
  const b = Buffer.alloc(PHOTO_TRAILER);
  b.write(PHOTO_MAGIC, 0, 'latin1');
  b.writeUInt32LE(PHOTO_VERSION, 8);
  b.writeUInt32LE(0, 12);
  b.writeBigUInt64LE(BigInt(indexAt), 16);
  b.writeBigUInt64LE(BigInt(indexLen), 24);
  return b;
}

/** Everything that follows the archive: the images, the index, the trailer. */
export function appendixOf(parts: Buffer[], size: number, index: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(index), 'utf8');
  return Buffer.concat([...parts, json, trailerOf(size, json.length)]);
}

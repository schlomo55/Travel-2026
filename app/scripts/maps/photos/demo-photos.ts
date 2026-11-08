/* THE TEST PACK'S PHOTO SET (8 Nov 2026) — DEV ONLY, called by build-pack.ts.
   The committed test pack (scripts/e2e/fixtures/bund-test-photos.pmtiles) is
   cut round the Bund for the DEMO trip (seed/demo-2027.trip.json, dm27), a
   made-up trip: so its photos are made up too, and say so. Each is an
   abstract gradient generated here from integer maths (no randomness, no
   network, no committed binary — like scripts/demo-trip/images.ts), credited
   honestly: author "LTD demo (generated)", CC0, its "source" this very file.
   No photograph of a real place pretends to be one, and no Commons page is
   named.

   The set mirrors what the rehearsal walks:
   · the Bund — a photo and an About (a test text, which says it is one);
   · Yuyuan Garden and Nanxiang Mantou Dian beside it — ONE image, two places
     (one image, two credits);
   · Lujiazui — a photo with its focal point moved (fy), and an About;
   · Xintiandi — a place CARD with a photo, and a TALL one (the full-screen
     viewer's other shape);
   · Tianzifang and the Sample Blind Massage — looked at, no photo ("No free
     photo of this place").
   Four images in all. Every id is a dm27 Map-tab id inside the test bbox
   (build-pack.ts TEST_BBOX); the names and cities are the trip's own,
   read from its seed (places.ts photoPlaces). */
import sharp from 'sharp';
import type { AppBackup } from '../../../src/lib/model/types';
import { photoPlaces } from './places';
import type { Manifest, ManifestPhoto, ManifestPlace } from './pack-photos';

/** The demo trip the set belongs to. */
export const DEMO_TRIP = 'dm27';

const SOURCE = 'https://github.com/schlomo55/Travel-2026/blob/main/app/scripts/maps/photos/demo-photos.ts';
const W = 720;
const H = 480;
type RGB = readonly [number, number, number];

interface Spec {
  key: string;
  title: string;
  ids: string[];
  from: RGB;
  to: RGB;
  phase: number;
  fy?: number;
  /** the original's size (default 720 × 480, a wide one) */
  w?: number;
  h?: number;
}
const SPECS: Spec[] = [
  { key: 'bund', title: 'The Bund — generated gradient (not a photograph)', ids: ['dm27-spot-shanghai-bund'], from: [18, 28, 64], to: [238, 186, 100], phase: 0.7 },
  { key: 'yuyuan', title: 'Yuyuan Garden — generated gradient (not a photograph)', ids: ['dm27-spot-shanghai-yuyuan', 'dm27-spot-shanghai-nanxiang'], from: [30, 66, 40], to: [214, 230, 168], phase: 2.2 },
  { key: 'lujiazui', title: 'Lujiazui — generated gradient (not a photograph)', ids: ['dm27-spot-shanghai-lujiazui'], from: [40, 20, 70], to: [170, 210, 250], phase: 3.9, fy: 0.3 },
  { key: 'xintiandi', title: 'Xintiandi — generated gradient (not a photograph)', ids: ['dm27-place-05'], from: [70, 26, 20], to: [246, 196, 150], phase: 5.3, w: 480, h: 720 },
];
/** places looked at and left without a photo, on purpose */
const NONE = ['dm27-spot-shanghai-tianzifang', 'dm27-place-06'];
const ABOUT: Record<string, string> = {
  'dm27-spot-shanghai-bund': 'The Bund is the riverside walk of the demo trip’s Shanghai stop. This is a test text written for the LTD demo map pack, not Wikipedia’s.',
  'dm27-spot-shanghai-lujiazui': 'Lujiazui is the skyline across the river from the Bund on the demo trip. This is a test text written for the LTD demo map pack, not Wikipedia’s.',
};

/** Every place id the set speaks for (with a photo or without), in order. */
export const DEMO_PHOTO_IDS: string[] = [...SPECS.flatMap((s) => s.ids), ...NONE];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
function render(s: Spec, W: number, H: number): Buffer {
  const buf = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const band = 0.07 * Math.sin(fx * Math.PI * 3 + fy * Math.PI * 1.5 + s.phase) + 0.03 * Math.sin(fy * Math.PI * 5 - fx * Math.PI * 2 + s.phase * 1.7);
      const k = Math.min(1, Math.max(0, fx * 0.55 + fy * 0.45 + band));
      const i = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) buf[i + ch] = clamp(s.from[ch]! + (s.to[ch]! - s.from[ch]!) * k);
    }
  }
  return buf;
}

/** The source image of a generated photo (lossless; the pack's own sizes are made from it). */
export async function demoImage(ph: ManifestPhoto): Promise<Buffer> {
  const s = SPECS.find((x) => `generated:${x.key}` === ph.image);
  if (!s) throw new Error(`${ph.file}: not one of the demo set's generated images`);
  const [w, h] = [s.w ?? W, s.h ?? H];
  return sharp(render(s, w, h), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** The set as a photo manifest for the demo trip — names and cities from its seed. */
export function demoManifest(seed: AppBackup, built = new Date().toISOString().slice(0, 10)): Manifest {
  const trip = seed.trips[0];
  if (trip?.trip.id !== DEMO_TRIP) throw new Error(`the demo photo set is ${DEMO_TRIP}'s, not ${trip?.trip.id ?? 'no trip'}'s`);
  const drawn = new Map(photoPlaces(seed).flatMap((p) => p.ids.map((id) => [id, p] as const)));
  const places: Record<string, ManifestPlace> = {};
  const at = (id: string): ManifestPlace => {
    const p = drawn.get(id);
    if (!p) throw new Error(`${id}: the demo trip draws no such place`);
    return {
      name: p.name,
      city: p.city,
      category: p.category,
      ...(ABOUT[id] ? { about: { text: ABOUT[id], extract: ABOUT[id], title: 'LTD demo map pack (test text)', url: SOURCE, licence: 'CC0' } } : {}),
    };
  };
  for (const s of SPECS) {
    const photo: ManifestPhoto = {
      file: `demo:${s.key}`,
      title: s.title,
      w: s.w ?? W,
      h: s.h ?? H,
      author: 'LTD demo (generated)',
      licence: 'CC0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: SOURCE,
      site: 'LTD demo (generated)',
      image: `generated:${s.key}`,
      ...(s.fy !== undefined ? { fy: s.fy } : {}),
      via: 'generated for the demo test pack',
      shows: 'an abstract gradient — the demo trip is made up, so are its pictures',
    };
    for (const id of s.ids) places[id] = { ...at(id), photo };
  }
  for (const id of NONE) places[id] = { ...at(id), noPhoto: 'left without a photo on purpose: the test pack’s “No free photo of this place”' };
  return { v: 1, trip: DEMO_TRIP, built, places, rejected: [] };
}

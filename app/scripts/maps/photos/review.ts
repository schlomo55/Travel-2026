/* THE CROPS, LOOKED AT (Map 5e) — DEV ONLY, no network. Out of the built pack
   itself (what the phone will show, byte for byte): every photo as the place
   card crops it (16:9 round its focal point, CSS object-fit: cover), the
   "Near you" banner and the round pin — twelve photos to a sheet, for the
   last look before a pack goes to the owner (fy in choices.ts moves a crop).

   Run (from app/):  npx tsx scripts/maps/photos/review.ts [pack]   → app/.cache/photos/sheets/crops-NN.jpg */
import { mkdirSync, openAsBlob, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describePack, readPhotos } from '../../../src/lib/map/pack';
import { spanBytes, type PackPhoto } from '../../../src/lib/logic/placephotos';
import { CACHE } from './net';

const file = process.argv[2] ?? join(CACHE, '..', 'maps', 'china-2026-map-photos.pmtiles');
const blob = await openAsBlob(file);
const info = await describePack(new File([blob], 'pack.pmtiles'));
const index = (await readPhotos(blob, info, info.photos))!;
const buf = readFileSync(file);
const bytes = (p: PackPhoto, k: 'card' | 'rail' | 'pin'): Buffer => {
  const [a, b] = spanBytes(index, p[k]);
  return buf.subarray(a, b);
};
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** CSS object-fit: cover into w×h, object-position 50% fy */
async function cover(img: Buffer, w: number, h: number, fy: number): Promise<Buffer> {
  const m = await sharp(img).metadata();
  const s = Math.max(w / (m.width ?? w), h / (m.height ?? h));
  const rw = Math.max(w, Math.round((m.width ?? w) * s));
  const rh = Math.max(h, Math.round((m.height ?? h) * s));
  return sharp(img)
    .resize(rw, rh)
    .extract({ left: Math.round((rw - w) / 2), top: Math.round((rh - h) * fy), width: w, height: h })
    .png()
    .toBuffer();
}
const round = async (img: Buffer, d: number): Promise<Buffer> =>
  sharp(await sharp(img).resize(d, d).png().toBuffer())
    .composite([{ input: Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer();

const seen = new Set<number>();
const list = Object.entries(index.places).filter(([, p]) => {
  if (!p.photo || seen.has(p.photo.card[0])) return false;
  seen.add(p.photo.card[0]);
  return true;
});
const dir = join(CACHE, 'sheets');
mkdirSync(dir, { recursive: true });
const CELL = { w: 640, h: 190 };
for (let i = 0; i < list.length; i += 12) {
  const part = list.slice(i, i + 12);
  const layers: sharp.OverlayOptions[] = [];
  for (const [k, [id, p]] of part.entries()) {
    const ph = p.photo!;
    const x = (k % 2) * CELL.w;
    const y = Math.floor(k / 2) * CELL.h;
    const fy = ph.fy ?? 0.5;
    layers.push({ input: await cover(bytes(ph, 'card'), 256, 144, fy), left: x + 4, top: y + 4 });
    layers.push({ input: await cover(bytes(ph, 'rail'), 268, 108, 0.5), left: x + 266, top: y + 4 });
    layers.push({ input: await round(bytes(ph, 'pin'), 88), left: x + 545, top: y + 14 });
    layers.push({
      input: Buffer.from(
        `<svg width="${CELL.w}" height="38"><text x="4" y="15" font-family="Arial" font-size="13" fill="#fff">${esc(`${i + k + 1} ${p.name}`.slice(0, 70))}</text><text x="4" y="32" font-family="Arial" font-size="11" fill="#9cf">${esc(`${id.replace('cn26-', '')} · fy ${fy} · card ${ph.card[2]}×${ph.card[3]} ${Math.round(ph.card[1] / 1024)} KB · rail ${Math.round(ph.rail[1] / 1024)} KB · pin ${Math.round(ph.pin[1] / 1024)} KB`)}</text></svg>`,
      ),
      left: x,
      top: y + 150,
    });
  }
  const rows = Math.ceil(part.length / 2);
  const name = `crops-${String(i / 12 + 1).padStart(2, '0')}.jpg`;
  await sharp({ create: { width: CELL.w * 2, height: rows * CELL.h, channels: 3, background: '#0b0c16' } })
    .composite(layers)
    .jpeg({ quality: 80 })
    .toFile(join(dir, name));
  console.log(`  ${name}`);
}
console.log(`${list.length} photos from ${file}`);

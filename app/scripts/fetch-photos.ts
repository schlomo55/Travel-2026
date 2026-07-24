/* Downloads and optimizes the curated place photos. DEV-ONLY and manual —
   this NEVER runs during seed-build; the optimized WebPs are committed so
   seed rebuilds stay byte-identical and need no network.
   Run: npm run photos:fetch */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COVER_STOP_KEY, PLACE_PHOTOS } from './china/photos';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'sources', 'china-2026', 'images');
mkdirSync(outDir, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let credits =
  '# Place photo credits\n\n' +
  'All photos come from Wikimedia Commons, chosen to match the season of the\n' +
  'visit (late November – December) where the archive allows. Each file is\n' +
  'resized to 1200px WebP q70 and stripped of metadata (EXIF/GPS) by\n' +
  'scripts/fetch-photos.ts before being committed.\n\n';

for (const p of PLACE_PHOTOS) {
  const bare = p.commonsTitle.replace(/^File:/, '');
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(bare)}?width=1400`;
  process.stdout.write(`${p.stopKey} ← ${bare} … `);
  const res = await fetch(url, { headers: { 'User-Agent': 'ltd-trip-curation/1.0 (personal use)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  /* sharp strips metadata by default — no EXIF/GPS survives. */
  const out = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  writeFileSync(join(outDir, `${p.stopKey}.webp`), out);
  console.log(`${Math.round(out.byteLength / 1024)} KB`);
  credits += `- **${p.stopKey}.webp** — “${bare}” by ${p.author}, ${p.license}.\n  https://commons.wikimedia.org/wiki/File:${encodeURIComponent(bare.replace(/ /g, '_'))}\n`;
  await sleep(4000);
}

credits += `\nThe trip shelf cover reuses the ${COVER_STOP_KEY} photo.\n`;
writeFileSync(join(outDir, 'CREDITS.md'), credits);
console.log('CREDITS.md written.');

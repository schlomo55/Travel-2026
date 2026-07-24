/* Renders icon-src/*.svg → public/icons/*.png. Generated PNGs are committed,
   so this script (and sharp) only matters when the icon design changes. */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'icon-src');
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const jobs: Array<[string, string, number]> = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-192-maskable.png', 192],
  ['icon-maskable.svg', 'icon-512-maskable.png', 512],
];

for (const [src, out, size] of jobs) {
  await sharp(join(srcDir, src), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, out));
  console.log('✓', out);
}

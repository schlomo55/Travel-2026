/* Renders the launcher icon and splash for the Android app from icon-src/.
   Run: npm run android:assets  (then @capacitor/assets fans them out to every
   density). Generated PNGs are committed, so this only matters when the icon
   design changes. */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'icon-src');
const outDir = join(here, '..', 'assets');
mkdirSync(outDir, { recursive: true });

/* @capacitor/assets expects these exact names. */
const jobs: Array<[string, string, number, number]> = [
  ['icon.svg', 'icon.png', 1024, 1024],
  ['icon-maskable.svg', 'icon-foreground.png', 1024, 1024],
  ['splash.svg', 'splash.png', 2732, 2732],
  ['splash.svg', 'splash-dark.png', 2732, 2732],
];

for (const [src, out, w, h] of jobs) {
  await sharp(join(srcDir, src), { density: 400 })
    .resize(w, h, { fit: 'contain', background: { r: 246, g: 241, b: 230, alpha: 1 } })
    .png()
    .toFile(join(outDir, out));
  console.log('✓', out);
}

/* A flat background plate for the adaptive icon. */
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 246, g: 241, b: 230, alpha: 1 } },
})
  .png()
  .toFile(join(outDir, 'icon-background.png'));
console.log('✓ icon-background.png');

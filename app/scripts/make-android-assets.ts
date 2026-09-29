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

/* The launcher icon keeps its true-black plate (the icon the owner knows). The
   SPLASH wears Horizon's night sky, #0B0C16 — the same --sky the app paints the
   moment it starts (docs/design/HORIZON.md), so opening the app never flashes
   from black to blue. The Android 12+ launch colour lives in
   res/values/splash.xml and must match. */
const CANVAS = { r: 0, g: 0, b: 0, alpha: 1 };
const SKY = { r: 0x0b, g: 0x0c, b: 0x16, alpha: 1 };

for (const [src, out, w, h] of jobs) {
  await sharp(join(srcDir, src), { density: 400 })
    .resize(w, h, { fit: 'contain', background: out.startsWith('splash') ? SKY : CANVAS })
    .png()
    .toFile(join(outDir, out));
  console.log('✓', out);
}

/* A flat background plate for the adaptive icon. */
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CANVAS } })
  .png()
  .toFile(join(outDir, 'icon-background.png'));
console.log('✓ icon-background.png');

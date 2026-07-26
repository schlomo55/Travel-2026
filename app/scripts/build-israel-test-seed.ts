/* Builds seed/israel-test.trip.json — the fabricated Israel TEST trip, so the
   owner can rehearse every date-aware behaviour of the app against real passing
   time instead of waiting for November.

   Run: npm run seed-build:israel. Deterministic output — rebuilds are
   byte-identical, and the assertions run BEFORE the write, so a failure means
   no file is produced.

   Nothing in this trip is real, and every id it carries starts with `il26-`.
   Dexie primary keys are global: an id shared with the China seed would
   overwrite China data on import. scripts/israel-test/assert.ts proves it does
   not happen. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIsraelBundle } from './israel-test/bundle';
import { assertIsraelBundle } from './israel-test/assert';
import { buildImages } from './israel-test/images';
import { SEED_TS } from './israel-test/base';
import type { AppBackup } from '../src/lib/model/types';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const outPath = join(repo, 'seed', 'israel-test.trip.json');

const images = await buildImages();
for (const img of images) console.log(`image ${img.key}: ${Math.round(img.buffer.byteLength / 1024)} KB`);

const bundle = buildIsraelBundle(images);

const seed: AppBackup = {
  format: 'livingthedream/backup',
  formatVersion: 1,
  kind: 'trip',
  exportedAt: new Date(SEED_TS).toISOString(),
  appVersion: (JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string }).version,
  trips: [bundle],
};

const report = assertIsraelBundle(bundle, seed);
for (const line of report.lines) console.log(line);
if (!report.ok) {
  console.error('\nSeed assertions FAILED — seed not written.');
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(seed, null, 1) + '\n', 'utf8');
console.log(`\nWrote ${outPath}`);

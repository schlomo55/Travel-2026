/* Builds seed/template-example.trip.json — the worked example for the
   trip-brief pipeline, compiled from docs/examples/porto-lisbon-mini.brief.md
   by the scaffold in scripts/trip-template/.

   Run: npm run seed-build:template-example

   Deterministic: no Date.now() anywhere in the builder, so rebuilds are
   byte-identical. The assertions run BEFORE the write, so a failure means no
   file is produced rather than a bad one.

   ── COPY THIS FILE FOR A REAL TRIP ──────────────────────────────────────────
   It is the whole entry point: swap the three `./trip-template/example`
   imports for your own folder, change `outPath`, and add the matching
   `seed-build:<your-trip>` line to package.json. Nothing else here changes.

   Nothing in this trip is real, and every id it carries starts with `tx00-`.
   Dexie primary keys are global: an id shared with another seed would silently
   overwrite that trip's records on import. scripts/trip-template/assert.ts
   proves it does not happen. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup } from '../src/lib/model/types';
import { assertTripBundle } from './trip-template/assert';
import { EXAMPLE_ASSERT, buildExampleBundle } from './trip-template/example/bundle';
import { SEED_TS } from './trip-template/example/base';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const outPath = join(repo, 'seed', 'template-example.trip.json');

const bundle = buildExampleBundle();

const seed: AppBackup = {
  format: 'livingthedream/backup',
  formatVersion: 1,
  kind: 'trip',
  exportedAt: new Date(SEED_TS).toISOString(),
  appVersion: (JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string }).version,
  trips: [bundle],
};

const report = assertTripBundle(bundle, seed, EXAMPLE_ASSERT);
for (const line of report.lines) console.log(line);
if (!report.ok) {
  console.error('\nSeed assertions FAILED — seed not written.');
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(seed, null, 1) + '\n', 'utf8');
console.log(`\nWrote ${outPath}`);

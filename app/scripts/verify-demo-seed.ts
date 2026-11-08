/* `npm run verify:demo` — the committed demo trip, held to its gate.

   Replaces verify:china (verify-china-parity.ts), which proved the China seed
   carried every critical value of the trip's source documents. Those
   documents are gone with the trip; what is left to prove for a made-up trip
   is that the committed file IS what the builder makes (rebuilt in memory,
   compared byte for byte) and that it passes every structural, coverage and
   privacy rule in demo-trip/assert.ts. Exit 1 on any failure. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup } from '../src/lib/model/types';
import { assertDemoBundle } from './demo-trip/assert';
import { buildDemoBundle } from './demo-trip/bundle';
import { buildImages, buildTicketPdf } from './demo-trip/images';
import { SEED_TS } from './demo-trip/base';

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '..', '..', 'seed', 'demo-2027.trip.json');
const onDisk = readFileSync(path, 'utf8');
const seed = JSON.parse(onDisk) as AppBackup;

let failed = 0;
const report = assertDemoBundle(seed.trips[0]!, seed);
for (const l of report.lines) console.log(l);
if (!report.ok) failed++;

const rebuilt: AppBackup = {
  ...seed,
  exportedAt: new Date(SEED_TS).toISOString(),
  trips: [buildDemoBundle(await buildImages(), buildTicketPdf())],
};
if (JSON.stringify(rebuilt, null, 1) + '\n' === onDisk) console.log('✓ the committed seed is exactly what the builder makes');
else {
  console.error('✗ the committed seed differs from a rebuild — run npm run seed-build');
  failed++;
}
if (failed) process.exit(1);

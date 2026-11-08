/* Builds seed/demo-2027.trip.json — the made-up demo trip every test, gate and
   the offline rehearsal run against (scripts/demo-trip/base.ts says what it is
   and why). Run: npm run seed-build. Deterministic: rebuilds are
   byte-identical, and the assertions run BEFORE the write, so a failure means
   no file is produced. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoBundle } from './demo-trip/bundle';
import { assertDemoBundle } from './demo-trip/assert';
import { buildImages, buildTicketPdf } from './demo-trip/images';
import { SEED_TS } from './demo-trip/base';
import type { AppBackup } from '../src/lib/model/types';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
export const DEMO_SEED = join(repo, 'seed', 'demo-2027.trip.json');

const bundle = buildDemoBundle(await buildImages(), buildTicketPdf());
const seed: AppBackup = {
  format: 'livingthedream/backup',
  formatVersion: 1,
  kind: 'trip',
  exportedAt: new Date(SEED_TS).toISOString(),
  appVersion: (JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string }).version,
  trips: [bundle],
};

const report = assertDemoBundle(bundle, seed);
for (const line of report.lines) console.log(line);
if (!report.ok) {
  console.error('\nDemo seed assertions FAILED — seed not written.');
  process.exit(1);
}
mkdirSync(dirname(DEMO_SEED), { recursive: true });
writeFileSync(DEMO_SEED, JSON.stringify(seed, null, 1) + '\n', 'utf8');
console.log(`\nWrote ${DEMO_SEED}`);

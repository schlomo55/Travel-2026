/* Builds seed/china-2026.trip.json from the frozen legacy app + sources.
   Run: npm run seed-build. Deterministic output — rebuilds are byte-identical. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLegacyData } from './china/extract';
import { buildChinaBundle, SEED_TS } from './china/transform';
import { readExtras, readOptions, readPhotoInputs } from './china/inputs';
import { assertChinaBundle } from './china/assert';
import type { AppBackup } from '../src/lib/model/types';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const legacyHtml = join(repo, 'legacy', 'index.html');
const flightsPdfPath = join(repo, 'sources', 'china-2026', 'China-2026-Flights.pdf');
const handoffPath = join(repo, 'sources', 'china-2026', 'china-2026-handoff-prompt.md');
const outPath = join(repo, 'seed', 'china-2026.trip.json');

const legacy = extractLegacyData(legacyHtml);
const pdf = readFileSync(flightsPdfPath);
const bundle = buildChinaBundle({
  legacy,
  flightsPdf: { base64: pdf.toString('base64'), size: pdf.byteLength },
  photos: readPhotoInputs(repo),
  extras: readExtras(repo),
  options: readOptions(repo),
});

const report = assertChinaBundle(bundle, handoffPath);
for (const line of report.lines) console.log(line);
if (!report.ok) {
  console.error('\nSeed assertions FAILED — seed not written.');
  process.exit(1);
}

const seed: AppBackup = {
  format: 'livingthedream/backup',
  formatVersion: 1,
  kind: 'trip',
  exportedAt: new Date(SEED_TS).toISOString(),
  appVersion: (JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string }).version,
  trips: [bundle],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(seed, null, 1) + '\n', 'utf8');
console.log(`\nWrote ${outPath}`);

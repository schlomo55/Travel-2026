/* The China parity audit: every trip-critical value in the seed is re-checked
   against the ORIGINAL source documents — not against the legacy app, which is
   itself a transcription. If a value cannot be found in the sources, it is
   reported so it can be confirmed by hand.
   Run: npm run verify:china */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, TripBundle } from '../src/lib/model/types';
import { PLACE_PHOTOS } from './china/photos';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const src = join(repo, 'sources', 'china-2026');

const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const bundle = seed.trips[0] as TripBundle;

/* All source documents concatenated: the guide, the handoff, the insurance
   comparison and the original app spec. */
const sourceText = [
  'china-2026-trip-guide-v12.html',
  'china-2026-handoff-prompt.md',
  'insurance-quotes-comparison.md',
  'china-app-prompt.md',
]
  .map((f) => readFileSync(join(src, f), 'utf8'))
  .join('\n');

/* The PDF is binary; pull the readable ASCII runs out of it so ticket numbers
   and PNRs printed in it can still be matched. */
const pdfText = readFileSync(join(src, 'China-2026-Flights.pdf'))
  .toString('latin1')
  .replace(/[^\x20-\x7e]+/g, ' ');

const haystack = (sourceText + '\n' + pdfText).replace(/\s+/g, ' ');
const seedText = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });

interface Check {
  what: string;
  value: string;
  /** Normalize before searching (the guide writes some values with separators). */
  loose?: boolean;
  /** Also accept these spellings — the documents write dates as "Dec 27". */
  alt?: string[];
  /** Printed only on the flight PDF, whose text uses subset fonts and cannot be
      read by a script. Verified by eye against the PDF, not by this check. */
  pdfOnly?: boolean;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-12-22' → 'Dec 22' / '22 Dec', the forms the documents actually use. */
function dateSpellings(iso: string): string[] {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const mon = MON[m - 1];
  return mon ? [`${mon} ${d}`, `${d} ${mon}`] : [];
}

const CRITICAL: Check[] = [
  // identity
  { what: 'French passport number', value: '[redacted]' },
  { what: 'Etihad Guest number', value: '600023186044', pdfOnly: true },
  // international flights
  { what: 'Etihad PNR', value: '8CR7MR' },
  { what: 'EY608 departure', value: '14:00' },
  { what: 'EY888 arrival at Daxing', value: '08:45' },
  { what: 'EY871 departure from HKG', value: '19:35' },
  { what: 'EY609 arrival at TLV', value: '04:35' },
  // domestic flights
  { what: 'CA1953 Trip.com booking', value: '1653716183770225' },
  { what: 'CA1953 airline PNR', value: 'PLF8S9', pdfOnly: true },
  { what: 'CA1953 departure', value: '17:00' },
  { what: '3U8011 Trip.com booking', value: '1653716249124273' },
  { what: '3U8011 airline PNR', value: 'NGNRZ1', pdfOnly: true },
  { what: '3U8011 PIN', value: '2786' },
  { what: '3U8011 departure', value: '20:20' },
  { what: 'MU733 Trip.com booking', value: '1653716248615345' },
  { what: 'MU733 airline reference', value: 'MZ904B' },
  { what: 'MU733 departure', value: '13:50' },
  { what: 'MU733 seat', value: '7A' },
  // money
  { what: 'gift-card number', value: '2870 6769 9755', loose: true },
  { what: 'gift-card original value', value: '527.49' },
  { what: 'Harel insurance quote', value: '135.41' },
  { what: 'Phoenix insurance quote', value: '146.40' },
  { what: 'budget total', value: '6500', loose: true },
  // the dates that gate everything
  { what: 'trip start', value: '2026-11-21' },
  { what: 'trip end', value: '2026-12-27' },
  { what: 'mainland entry', value: '2026-11-22' },
  { what: 'planned exit', value: '2026-12-21' },
  { what: 'visa hard deadline', value: '2026-12-22' },
];

const norm = (s: string): string => s.replace(/[\s,-]/g, '').toLowerCase();
const looseHay = norm(haystack);
const looseSeed = norm(seedText);

let missingFromSeed = 0;
let missingFromSources = 0;
const notes: string[] = [];
const pdfOnly: string[] = [];

for (const c of CRITICAL) {
  const inSeed = c.loose ? looseSeed.includes(norm(c.value)) : seedText.includes(c.value);
  /* Dates are written as "Dec 22" in the documents, not ISO. */
  const spellings = [c.value, ...(c.alt ?? []), ...(/^\d{4}-\d{2}-\d{2}$/.test(c.value) ? dateSpellings(c.value) : [])];
  const inSources = spellings.some((v) => (c.loose ? looseHay.includes(norm(v)) : haystack.includes(v)));

  if (!inSeed) {
    console.error(`✗ ${c.what} (${c.value}) is MISSING FROM THE SEED`);
    missingFromSeed++;
  } else if (inSources) {
    console.log(`✓ ${c.what}`);
  } else if (c.pdfOnly) {
    pdfOnly.push(`· ${c.what} (${c.value}) — printed only on the flight PDF, whose text is not machine-readable. Check it by eye once.`);
  } else {
    notes.push(`? ${c.what} (${c.value}) is in the seed but not found in the source documents — confirm by hand`);
    missingFromSources++;
  }
}

/* Structural facts the trip depends on. */
const structural: [string, boolean][] = [
  ['visa counter starts the day AFTER entry', bundle.counters[0]?.countStartsDayAfter === true],
  ['visa limit is 30 days', bundle.counters[0]?.limitDays === 30],
  ['trip spans 37 days', bundle.trip.start === '2026-11-21' && bundle.trip.end === '2026-12-27'],
  ['seven flights are present', bundle.bookings.filter((b) => b.kind === 'flight').length === 7],
  ['eleven beds are present', bundle.bookings.filter((b) => b.kind === 'hotel').length === 11],
  ['one bed is a walk-in (the gorge)', bundle.bookings.filter((b) => b.status === 'walkin').length === 1],
  ['ten stops plus the flights entry', bundle.stops.length === 11],
  ['the Kunyu address is still pending, not invented',
    bundle.showCards.some((c) => c.pending && /kunyu/i.test(c.meaning))],
  ['insurance is still marked not bought',
    bundle.walletCards.some((c) => c.pending && /insurance/i.test(c.title))],
  ['CA1953 carries its PEK-not-Daxing warning',
    bundle.bookings.some((b) => b.kind === 'flight' && b.flightNo.includes('1953') && /not Daxing/i.test(b.note ?? ''))],
  ['the flights PDF rides in the vault',
    bundle.documents.filter((d) => d.meta.mime === 'application/pdf').length === 1],
  ['one curated place photo per real stop rides in the vault',
    bundle.documents.filter((d) => d.meta.tag === 'photo').length === PLACE_PHOTOS.length &&
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => !!s.photoDocId)],
  ['every real stop carries a read-more text',
    bundle.stops.filter((s) => s.kind === 'stop').every((s) => (s.detail ?? '').length > 200)],
  ['the shelf cover photo resolves',
    !!bundle.trip.coverDocId && bundle.documents.some((d) => d.meta.id === bundle.trip.coverDocId)],
];

console.log('');
for (const [what, ok] of structural) {
  if (ok) console.log(`✓ ${what}`);
  else {
    console.error(`✗ ${what}`);
    missingFromSeed++;
  }
}

if (pdfOnly.length) {
  console.log('');
  console.log('Traced to the flight PDF rather than to searchable text:');
  for (const n of pdfOnly) console.log(n);
}
if (notes.length) {
  console.log('');
  for (const n of notes) console.warn(n);
}

console.log('');
console.log(`Checked ${CRITICAL.length} critical values + ${structural.length} structural facts.`);
if (missingFromSeed > 0) {
  console.error(`${missingFromSeed} FAILURE(S) — the seed does not match the sources.`);
  process.exit(1);
}
console.log(`✓ parity holds${missingFromSources ? ` (${missingFromSources} value(s) need a manual look — see above)` : ''}`);

/* Parity assertions for the China seed. Two layers:
   1. Structural counts — every legacy collection arrives whole.
   2. Privacy + critical values — the French-passport data is present where
      expected, and the Israeli passport number (read from the handoff source,
      never hardcoded here) appears NOWHERE in the seed. */
import { readFileSync } from 'node:fs';
import type { TripBundle } from '../../src/lib/model/types';

export const EXPECTED_COUNTS = {
  stops: 11, // 10 stops + 1 transit (international flights)
  transitStops: 1,
  dayPlans: 26,
  dayDefaults: 2,
  runbooks: 7,
  flights: 7,
  stays: 11,
  walletCards: 4,
  tasks: 18,
  alarms: 15,
  packingItems: 30,
  checklists: 1,
  checklistItems: 11,
  categories: 8,
  showCards: 32, // 7 phrases + 25 places
  emergency: 9,
  infoCards: 13, // 12 from DATA.info + the transcribed VPN card
  counters: 1,
  documents: 1,
} as const;

/** Values that must appear in the seed (spot layer of the 57-value audit; M8 does the full pass). */
const MUST_CONTAIN = [
  '8CR7MR', // Etihad PNR (4 segments)
  'PLF8S9', // CA1953 airline PNR
  'NGNRZ1', // 3U8011 airline PNR
  'MZ904B', // MU733 airline ref
  '1653716183770225', // Trip.com CA1953
  '1653716249124273', // Trip.com 3U8011
  '1653716248615345', // Trip.com MU733
  '2786', // 3U8011 PIN
  '[redacted]', // French passport — the ONLY passport in the app
  '600023186044', // Etihad Guest
  '2870 6769 9755', // Trip.com gift card
  '请带我去这里', // driver suffix
  '2026-12-22', // visa hard deadline
];

export interface AssertionReport {
  ok: boolean;
  lines: string[];
}

export function assertChinaBundle(bundle: TripBundle, handoffMdPath: string): AssertionReport {
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    lines.push(`✗ ${msg}`);
  };
  const pass = (msg: string) => lines.push(`✓ ${msg}`);

  const counts: Record<keyof typeof EXPECTED_COUNTS, number> = {
    stops: bundle.stops.length,
    transitStops: bundle.stops.filter((s) => s.kind === 'transit').length,
    dayPlans: bundle.dayPlans.length,
    dayDefaults: bundle.dayDefaults.length,
    runbooks: bundle.runbooks.length,
    flights: bundle.bookings.filter((b) => b.kind === 'flight').length,
    stays: bundle.bookings.filter((b) => b.kind === 'hotel').length,
    walletCards: bundle.walletCards.length,
    tasks: bundle.tasks.length,
    alarms: bundle.alarms.length,
    packingItems: bundle.packingItems.length,
    checklists: bundle.checklists.length,
    checklistItems: bundle.checklists.reduce((s, c) => s + c.items.length, 0),
    categories: bundle.categories.length,
    showCards: bundle.showCards.length,
    emergency: bundle.emergency.length,
    infoCards: bundle.infoCards.length,
    counters: bundle.counters.length,
    documents: bundle.documents.length,
  };
  for (const key of Object.keys(EXPECTED_COUNTS) as (keyof typeof EXPECTED_COUNTS)[]) {
    if (counts[key] === EXPECTED_COUNTS[key]) pass(`${key}: ${counts[key]}`);
    else fail(`${key}: expected ${EXPECTED_COUNTS[key]}, got ${counts[key]}`);
  }

  /* referential integrity */
  const runbookIds = new Set(bundle.runbooks.map((r) => r.id));
  for (const d of bundle.dayPlans) {
    if (d.runbookId && !runbookIds.has(d.runbookId)) fail(`dayPlan ${d.date} references missing runbook ${d.runbookId}`);
    if (d.date < bundle.trip.start || d.date > bundle.trip.end) fail(`dayPlan ${d.date} outside trip range`);
  }
  for (const b of bundle.bookings) {
    if (b.kind === 'hotel' && b.checkIn >= b.checkOut) fail(`stay ${b.id} has checkIn >= checkOut`);
  }
  pass('referential integrity checked');

  /* value + privacy layer over the serialized seed (documents excluded — base64) */
  const text = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });
  for (const v of MUST_CONTAIN) {
    if (text.includes(v)) pass(`contains ${v.length > 12 ? v.slice(0, 12) + '…' : v}`);
    else fail(`missing critical value: ${v}`);
  }

  /* The Israeli passport number lives ONLY in the handoff source. Read it from
     there and prove it is absent from the seed — without ever writing it down. */
  const handoff = readFileSync(handoffMdPath, 'utf8');
  const israeliLines = handoff.split('\n').filter((l) => /israeli/i.test(l));
  if (israeliLines.length === 0) fail('could not locate the Israeli-passport line in the handoff source');
  /* Only identifier-shaped tokens (must contain a digit) count — plain words on
     that line ("bookings", the name) legitimately appear elsewhere. The French
     passport number is explicitly allowed: it is the one passport in the app. */
  const frenchPassport = bundle.walletCards.find((c) => c.id === 'cn26-card-passport')?.code;
  const forbidden = new Set<string>();
  for (const line of israeliLines) {
    for (const tok of line.match(/\b[A-Z0-9]{6,12}\b/gi) ?? []) {
      if (/\d/.test(tok) && tok !== frenchPassport) forbidden.add(tok);
    }
  }
  const fullText = text + bundle.documents.map((d) => d.dataBase64).join('');
  let leaked = 0;
  for (const tok of forbidden) {
    if (fullText.includes(tok)) {
      leaked++;
      fail('a value from the Israeli-passport line appears in the seed');
    }
  }
  if (forbidden.size > 0 && leaked === 0) pass(`Israeli passport number absent (checked ${forbidden.size} token[s])`);

  return { ok, lines };
}

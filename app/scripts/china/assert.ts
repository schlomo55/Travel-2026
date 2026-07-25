/* Parity assertions for the China seed. Two layers:
   1. Structural counts — every legacy collection arrives whole.
   2. Privacy + critical values — the French-passport data is present where
      expected, and the Israeli passport number (read from the handoff source,
      never hardcoded here) appears NOWHERE in the seed. */
import { readFileSync } from 'node:fs';
import type { TripBundle } from '../../src/lib/model/types';
import { ADDRESS_MAX } from '../../src/lib/logic/geo';
import { PLACE_PHOTOS } from './photos';

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
  documents: 1 + PLACE_PHOTOS.length, // the flights PDF + one curated photo per real stop
  expenses: 5, // prepaid only: 4 flight payments + the Kunyu deposit
} as const;

/** What the documents say was already paid, in home-currency minor units. */
export const PREPAID_MINOR = 202600 + 24100 + 23000 + 29300 + 10000;

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
    expenses: bundle.expenses.length,
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
  /* photos: every photo document links to a real stop, every linked stop points back,
     and the bytes really are WebP (RIFF....WEBP magic). */
  const stopIds = new Set(bundle.stops.map((s) => s.id));
  const photoDocs = bundle.documents.filter((d) => d.meta.tag === 'photo');
  for (const d of photoDocs) {
    if (!d.meta.stopId || !stopIds.has(d.meta.stopId)) fail(`photo ${d.meta.id} has no valid stop link`);
    const head = Buffer.from(d.dataBase64.slice(0, 24), 'base64');
    if (head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WEBP') {
      fail(`photo ${d.meta.id} is not a WebP`);
    }
  }
  const photoIds = new Set(photoDocs.map((d) => d.meta.id));
  for (const s of bundle.stops) {
    if (s.photoDocId && !photoIds.has(s.photoDocId)) fail(`stop ${s.id} points at missing photo ${s.photoDocId}`);
    if (s.kind === 'stop' && !s.photoDocId) fail(`stop ${s.id} has no photo`);
    if (s.kind === 'stop' && !s.detail) fail(`stop ${s.id} has no read-more text`);
    if (s.kind === 'stop' && (s.options?.length ?? 0) < 2) fail(`stop ${s.id} has fewer than 2 options blocks`);
    if (s.kind === 'stop' && !s.coord) fail(`stop ${s.id} has no coordinate`);
  }
  /* Coordinates are WGS-84 and must be inside the box this trip lives in;
     a swapped lat/lng or a GCJ-02 slip would fall out here. */
  const coords = [
    ...bundle.stops.flatMap((s) => (s.coord ? [[s.id, s.coord] as const] : [])),
    ...bundle.showCards.flatMap((c) => (c.coord ? [[c.id, c.coord] as const] : [])),
  ];
  for (const [id, c] of coords) {
    if (!(c.lat > 20 && c.lat < 45 && c.lng > 95 && c.lng < 125)) fail(`${id} coordinate is outside China/HK: ${c.lat},${c.lng}`);
  }
  pass(`coordinates in range (${coords.length} checked)`);

  /* Bookings get their own box: two of the airports this trip flies from are
     Tel Aviv and Abu Dhabi, which are nowhere near China. */
  for (const b of bundle.bookings) {
    if (!b.coord) continue;
    if (b.kind === 'hotel') fail(`${b.id} is a bed with a coordinate — no hotel address is in the sources`);
    const c = b.coord;
    if (!(c.lat > 20 && c.lat < 45 && c.lng > 34 && c.lng < 125)) fail(`${b.id} coordinate is off the trip's map: ${c.lat},${c.lng}`);
  }

  /* Map buttons: a place opens by saved link, by name, or by coordinate — and
     must have at least one of the three, or it renders no button at all.
     Same three fields on stops, driver cards, bookings and spots, so one
     button serves all four and one check covers them. */
  const spots = bundle.stops.flatMap((s) => s.spots ?? []);
  const mapped = [
    ...bundle.stops.map((s) => [s.id, s] as const),
    ...bundle.showCards.map((c) => [c.id, c] as const),
    ...bundle.bookings.map((b) => [b.id, b] as const),
    ...spots.map((s) => [s.id, s] as const),
  ];
  let named = 0;
  let saved = 0;
  let addressed = 0;
  for (const [id, e] of mapped) {
    if (e.mapUrl) {
      saved++;
      if (!/^https:\/\//.test(e.mapUrl)) fail(`${id} map link is not an https URL`);
      if (e.mapQuery) fail(`${id} has both a saved link and a name — one of them is dead weight`);
    }
    if (e.mapQuery) {
      named++;
      if (!e.mapQuery.trim()) fail(`${id} has an empty map name`);
    }
    if (e.mapCity && !e.mapQuery) fail(`${id} has a map city but nothing to search for`);
    /* An address in the SEED is always the byproduct of a name that passed
       verification — OpenStreetMap handed it back with the answer. So it never
       stands alone here. (In the APP it may: a bed with nothing else gets its
       button the moment the owner pastes an address, which is the point of the
       Address field. That is user data, and this guard is about build data.) */
    if (e.address !== undefined) {
      addressed++;
      if (!e.address.trim()) fail(`${id} carries an empty address`);
      if (e.address.length > ADDRESS_MAX) fail(`${id} address is ${e.address.length} chars, over the ${ADDRESS_MAX} cap`);
      if (!e.mapQuery && !e.mapUrl && !e.coord) fail(`${id} carries an address but nothing to open`);
    }
  }
  pass(`map targets: ${named} by name, ${saved} by saved link, ${addressed} with a street address`);

  /* Spots are the one thing in the seed that exists ONLY to be opened. A spot
     nobody can open is dead weight on the page, so every one must carry a
     verified name — the rejected candidates stay in spots.ts, not here. */
  const spotIds = new Set<string>();
  for (const sp of spots) {
    if (spotIds.has(sp.id)) fail(`duplicate spot id ${sp.id}`);
    spotIds.add(sp.id);
    if (!sp.mapQuery && !sp.coord && !sp.mapUrl) fail(`spot ${sp.id} has nothing to open`);
    if (!sp.name.trim()) fail(`spot ${sp.id} has no name`);
  }
  const stopsWithSpots = bundle.stops.filter((s) => s.kind === 'stop' && (s.spots?.length ?? 0) > 0).length;
  if (stopsWithSpots === 10) pass(`spots: ${spots.length} across all 10 real stops`);
  else fail(`spots: only ${stopsWithSpots} of 10 real stops carry any`);

  /* Prepaid expenses: only documented payments, each on a real category, and
     never a bed (every stay is still pending). */
  const catIds = new Set(bundle.categories.map((c) => c.id));
  let prepaidSum = 0;
  for (const e of bundle.expenses) {
    if (!catIds.has(e.categoryId)) fail(`expense ${e.id} references missing category ${e.categoryId}`);
    if (e.homeMinor !== Math.round(e.amount * 100 * e.rateToHome)) fail(`expense ${e.id} home amount does not match`);
    if (e.refund) fail(`expense ${e.id} is a refund — the seed carries payments only`);
    prepaidSum += e.homeMinor;
  }
  if (prepaidSum === PREPAID_MINOR) pass(`prepaid total: $${prepaidSum / 100}`);
  else fail(`prepaid total: expected $${PREPAID_MINOR / 100}, got $${prepaidSum / 100}`);
  if (bundle.trip.coverDocId && !photoIds.has(bundle.trip.coverDocId)) fail('trip cover points at a missing photo');
  pass('referential integrity checked (incl. photos, cover and read-more)');

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

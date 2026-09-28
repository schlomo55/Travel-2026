/* The gate. Nothing is written unless every one of these holds.

   Two of them matter more than the rest:

   - **The id rule.** Dexie primary keys are global, not scoped per trip, so an
     id shared with the China seed would silently OVERWRITE China data the
     moment this file is imported. Every id must start with `il26-`, and the
     string `cn26` must not appear anywhere in the serialized output.
   - **The privacy scan.** This trip is fabricated end to end; not one value
     from the real trip may have leaked into it.

   Where a rule is really a question about app behaviour ("does every day
   resolve to a plan?") it is answered with the app's OWN functions —
   resolveDay(), currentStop(), tripDays(), toHomeMinor(), isBackup() — so the
   seed and the app can never disagree about the answer. */
import type { AppBackup, TripBundle } from '../../src/lib/model/types';
import { currentStop, resolveDay } from '../../src/lib/logic/day';
import { tripDays } from '../../src/lib/logic/phase';
import { toHomeMinor } from '../../src/lib/logic/money';
import { isBackup } from '../../src/lib/logic/backup';
import { ALARM_EARLIEST, SEED_DATE, TRIP_END, TRIP_END_EXCLUSIVE, TRIP_ID, dateRange } from './base';
import { loadPrivateIds } from '../privacy/private-ids';

/* Real values from the China trip and its sources. Not one of them may appear
   in this seed. Hardcoded here deliberately: this file is not deployed, is not
   imported by the app, and never reaches dist/ (see check-dist-clean.ts, which
   scans the built bundle for exactly these). The two passport numbers are NOT
   in this list: they are written nowhere in the repo and are read from private
   files instead (privacy/private-ids.ts), checked separately below. */
const FORBIDDEN_VALUES = [
  '8CR7MR',
  'PLF8S9',
  'NGNRZ1',
  'MZ904B',
  '1653716183770225',
  '1653716249124273',
  '1653716248615345',
  '2870 6769 9755',
  '600023186044',
  'SALOMON',
  'COHEN',
  '607 2417267029',
  '999-5274485740',
  '876-5279135029',
  '781-9441975808',
];

/** Any passport-shaped token at all — not just the one we know about. */
const PASSPORT_SHAPE = /\b\d{2}[A-Z]{2}\d{5}\b/;

export interface AssertionReport {
  ok: boolean;
  lines: string[];
}

/** Every id the bundle carries, including the nested ones. */
function collectIds(b: TripBundle): { id: string; where: string }[] {
  const out: { id: string; where: string }[] = [];
  const add = (where: string, ids: (string | undefined)[]) => {
    for (const id of ids) if (id !== undefined) out.push({ id, where });
  };
  add('trip', [b.trip.id]);
  add('counters', b.counters.map((r) => r.id));
  add('stops', b.stops.map((r) => r.id));
  add('stop blocks', b.stops.flatMap((s) => [...s.blocks, ...s.recoBlocks, ...(s.options ?? [])].map((x) => x.id)));
  add('stop spots', b.stops.flatMap((s) => (s.spots ?? []).map((x) => x.id)));
  add('dayPlans', b.dayPlans.map((r) => r.id));
  add('dayDefaults', b.dayDefaults.map((r) => r.id));
  add('runbooks', b.runbooks.map((r) => r.id));
  add('bookings', b.bookings.map((r) => r.id));
  add('walletCards', b.walletCards.map((r) => r.id));
  add('tasks', b.tasks.map((r) => r.id));
  add('alarms', b.alarms.map((r) => r.id));
  add('packingItems', b.packingItems.map((r) => r.id));
  add('checklists', b.checklists.map((r) => r.id));
  add('checklist items', b.checklists.flatMap((c) => c.items.map((i) => i.id)));
  add('expenses', b.expenses.map((r) => r.id));
  add('categories', b.categories.map((r) => r.id));
  add('showCards', b.showCards.map((r) => r.id));
  add('emergency', b.emergency.map((r) => r.id));
  add('infoCards', b.infoCards.map((r) => r.id));
  add('documents', b.documents.map((d) => d.meta.id));
  return out;
}

export function assertIsraelBundle(bundle: TripBundle, envelope: AppBackup): AssertionReport {
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    lines.push(`✗ ${msg}`);
  };
  const pass = (msg: string) => lines.push(`✓ ${msg}`);

  const trip = bundle.trip;
  const text = JSON.stringify(envelope);

  /* ---- 1. the id rule ---- */
  const ids = collectIds(bundle);
  if (trip.id !== TRIP_ID) fail(`trip.id is "${trip.id}", expected "${TRIP_ID}"`);
  let badPrefix = 0;
  for (const { id, where } of ids) {
    if (id === TRIP_ID) continue; // the trip's own id is the bare slug
    if (!id.startsWith('il26-')) {
      badPrefix++;
      fail(`${where}: id "${id}" does not start with "il26-"`);
    }
    if (id.includes('cn26')) fail(`${where}: id "${id}" contains "cn26"`);
  }
  if (badPrefix === 0) pass(`all ${ids.length} ids carry the il26- prefix`);
  if (text.includes('cn26')) fail('the string "cn26" appears somewhere in the serialized trip');
  else pass('the string "cn26" appears nowhere in the serialized trip');

  /* ---- 2. global uniqueness ---- */
  const seen = new Set<string>();
  let dupes = 0;
  for (const { id, where } of ids) {
    if (seen.has(id)) {
      dupes++;
      fail(`duplicate id "${id}" (${where})`);
    }
    seen.add(id);
  }
  if (dupes === 0) pass(`all ${seen.size} ids unique`);

  /* ---- 3. exactly 60 inclusive days ---- */
  const days = tripDays(trip);
  if (days === 60) pass('trip is 60 inclusive days');
  else fail(`trip is ${days} inclusive days, expected 60`);

  /* ---- 4. every date inside the trip ---- */
  const inTrip = (d: string): boolean => d >= trip.start && d <= trip.end;
  for (const s of bundle.stops) {
    if (!inTrip(s.start)) fail(`stop ${s.id} starts outside the trip (${s.start})`);
    /* The last stop's exclusive end is one day past the trip on purpose. */
    if (!inTrip(s.end) && s.end !== TRIP_END_EXCLUSIVE) fail(`stop ${s.id} ends outside the trip (${s.end})`);
  }
  for (const d of bundle.dayPlans) if (!inTrip(d.date)) fail(`dayPlan ${d.date} outside the trip`);
  /* Alarms are the one collection allowed to reach back before departure — the
     pack-and-go reminder the evening before. Bounded to a single day, and
     never past the end. */
  for (const a of bundle.alarms) {
    if (a.date > trip.end || a.date < ALARM_EARLIEST) fail(`alarm ${a.id} outside the allowed range (${a.date})`);
  }
  for (const b of bundle.bookings) if (!inTrip(b.date)) fail(`booking ${b.id} outside the trip (${b.date})`);
  for (const e of bundle.expenses) if (!inTrip(e.date)) fail(`expense ${e.id} outside the trip (${e.date})`);
  pass(`every stop, day, booking and expense date lies inside the trip; alarms from ${ALARM_EARLIEST}`);

  /* ---- 5. stops contiguous and non-overlapping ---- */
  const sorted = [...bundle.stops].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  let contiguous = true;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (!s) continue;
    if (s.start >= s.end) {
      contiguous = false;
      fail(`stop ${s.id} has start >= end`);
    }
    const next = sorted[i + 1];
    if (next && s.end !== next.start) {
      contiguous = false;
      fail(`gap or overlap: ${s.id} ends ${s.end} but ${next.id} starts ${next.start}`);
    }
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first && first.start !== trip.start) fail(`first stop starts ${first.start}, trip starts ${trip.start}`);
  if (last && last.end !== TRIP_END_EXCLUSIVE) fail(`last stop ends ${last?.end}, expected ${TRIP_END_EXCLUSIVE}`);
  if (contiguous) pass(`${sorted.length} stops are contiguous and non-overlapping`);

  /* ---- 6. referential integrity ---- */
  const runbookIds = new Set(bundle.runbooks.map((r) => r.id));
  const stopIds = new Set(bundle.stops.map((s) => s.id));
  const docIds = new Set(bundle.documents.map((d) => d.meta.id));
  const catIds = new Set(bundle.categories.map((c) => c.id));
  for (const d of bundle.dayPlans) {
    if (d.runbookId && !runbookIds.has(d.runbookId)) fail(`dayPlan ${d.date} points at missing runbook ${d.runbookId}`);
  }
  for (const s of bundle.stops) {
    if (s.photoDocId && !docIds.has(s.photoDocId)) fail(`stop ${s.id} points at missing document ${s.photoDocId}`);
  }
  if (trip.coverDocId && !docIds.has(trip.coverDocId)) fail(`trip cover points at missing document ${trip.coverDocId}`);
  for (const b of bundle.bookings) {
    if (b.stopId && !stopIds.has(b.stopId)) fail(`booking ${b.id} points at missing stop ${b.stopId}`);
    if (b.kind === 'hotel' && b.checkIn >= b.checkOut) fail(`bed ${b.id} has checkIn >= checkOut`);
  }
  for (const d of bundle.dayDefaults) {
    if (d.stopId && !stopIds.has(d.stopId)) fail(`dayDefault ${d.id} points at missing stop ${d.stopId}`);
  }
  for (const e of bundle.expenses) {
    if (!catIds.has(e.categoryId)) fail(`expense ${e.id} points at missing category ${e.categoryId}`);
  }
  for (const d of bundle.documents) {
    if (d.meta.stopId && !stopIds.has(d.meta.stopId)) fail(`document ${d.meta.id} points at missing stop ${d.meta.stopId}`);
    const head = Buffer.from(d.dataBase64.slice(0, 24), 'base64');
    if (head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WEBP') {
      fail(`document ${d.meta.id} is not a WebP`);
    }
    if (d.meta.size !== Buffer.from(d.dataBase64, 'base64').byteLength) fail(`document ${d.meta.id} size does not match its bytes`);
  }
  pass('referential integrity: runbooks, documents, stops, categories');

  /* ---- 7 + 8. every trip day resolves, using the app's own logic ---- */
  const allDays = dateRange(trip.start, TRIP_END);
  let unresolved = 0;
  let stopless = 0;
  let fromDefault = 0;
  for (const date of allDays) {
    const r = resolveDay(date, bundle.dayPlans, bundle.dayDefaults, bundle.stops);
    if (!r) {
      unresolved++;
      fail(`${date} resolves to no plan at all`);
    } else if (r.fromDefault) fromDefault++;
    if (!currentStop(bundle.stops, date)) {
      stopless++;
      fail(`${date} resolves to no stop`);
    }
  }
  if (unresolved === 0) pass(`all ${allDays.length} trip days resolve to a plan (${fromDefault} from a DayDefault) — via resolveDay()`);
  if (stopless === 0) pass(`all ${allDays.length} trip days resolve to a stop — via currentStop()`);

  /* The Saturday default must actually beat the all-days one. resolveDay()
     returns the FIRST matching default, so this proves the emitted order. */
  const shabbat = resolveDay('2026-08-29', bundle.dayPlans, bundle.dayDefaults, bundle.stops);
  const weekday = resolveDay('2026-08-18', bundle.dayPlans, bundle.dayDefaults, bundle.stops);
  if (shabbat?.title.includes('Shabbat')) pass('Saturday 2026-08-29 resolves to the Shabbat default');
  else fail(`Saturday 2026-08-29 resolved to "${shabbat?.title}" — the weekday-specific default lost`);
  if (weekday?.fromDefault && !weekday.title.includes('Shabbat')) pass('Tuesday 2026-08-18 resolves to the all-days Galilee default');
  else fail(`Tuesday 2026-08-18 resolved to "${weekday?.title}"`);

  /* ---- 8b. money ---- */
  const planSum = bundle.categories.reduce((s, c) => s + c.planMinor, 0);
  if (planSum === trip.budgetTotalMinor) pass(`category plans sum to the budget ($${planSum / 100})`);
  else fail(`category plans sum to ${planSum}, budget is ${trip.budgetTotalMinor}`);
  const codes = new Set(trip.currencies.map((c) => c.code));
  for (const e of bundle.expenses) {
    if (!codes.has(e.currency)) fail(`expense ${e.id} uses currency ${e.currency}, which the trip does not carry`);
    const expected = toHomeMinor(e.amount, e.rateToHome);
    if (e.homeMinor !== expected) fail(`expense ${e.id}: homeMinor ${e.homeMinor}, expected ${expected}`);
  }
  pass(`${bundle.expenses.length} expenses convert correctly — via toHomeMinor()`);

  /* ---- 9. the states this trip exists to put on screen ---- */
  const overdue = bundle.tasks.filter((t) => t.due && t.due < SEED_DATE && !t.done);
  const pastAlarms = bundle.alarms.filter((a) => a.date < SEED_DATE);
  const flown = bundle.bookings.filter((b) => b.kind !== 'hotel' && b.date < SEED_DATE);
  const beds = bundle.bookings.filter((b) => b.kind === 'hotel');
  const walkins = beds.filter((b) => b.status === 'walkin');
  const pendingBeds = beds.filter((b) => b.status === 'pending');
  const pendingCards = bundle.showCards.filter((c) => c.pending);
  const critOn = (date: string): boolean =>
    bundle.dayPlans.some((d) => {
      if (d.date !== date || !d.runbookId) return false;
      return bundle.runbooks.some((r) => r.id === d.runbookId && r.severity === 'crit');
    });
  const need: [label: string, got: number, min: number][] = [
    [`overdue tasks (as of ${SEED_DATE})`, overdue.length, 2],
    ['alarms already past', pastAlarms.length, 2],
    ['transport legs already flown', flown.length, 1],
    ['walk-in beds', walkins.length, 1],
    ['pending beds', pendingBeds.length, 1],
    ['pending show cards', pendingCards.length, 1],
  ];
  for (const [label, got, min] of need) {
    if (got >= min) pass(`${label}: ${got}`);
    else fail(`${label}: ${got}, need at least ${min}`);
  }
  if (critOn('2026-07-29')) pass('crit runbook fires on 2026-07-29');
  else fail('no crit runbook on 2026-07-29');
  if (critOn('2026-09-22')) pass('crit runbook fires on 2026-09-22');
  else fail('no crit runbook on 2026-09-22');
  if (bundle.counters.some((c) => c.pinned)) pass('a pinned compliance counter exists');
  else fail('no pinned compliance counter');

  /* ---- 10. privacy ---- */
  const lower = text.toLowerCase();
  let leaks = 0;
  for (const v of FORBIDDEN_VALUES) {
    if (lower.includes(v.toLowerCase())) {
      leaks++;
      fail(`a value from the real trip appears in this seed (${v.length} chars, starts "${v.slice(0, 3)}…")`);
    }
  }
  if (leaks === 0) pass(`privacy scan clean (${FORBIDDEN_VALUES.length} real values checked, none present)`);
  for (const id of loadPrivateIds()) {
    if (!id.value) pass(`${id.label} check SKIPPED — no private file at ${id.file}`);
    else if (lower.includes(id.value.toLowerCase())) fail(`the ${id.label} appears in this seed`);
    else pass(`${id.label} absent`);
  }
  const passportish = PASSPORT_SHAPE.exec(text);
  if (passportish) fail(`a passport-shaped token appears in this seed: ${passportish[0]}`);
  else pass('no passport-shaped token anywhere');

  /* ---- 11. it round-trips and it is a backup ---- */
  const round = JSON.stringify(JSON.parse(text));
  if (round === text) pass('the envelope round-trips through JSON unchanged');
  else fail('the envelope does not round-trip through JSON');
  if (isBackup(JSON.parse(text))) pass('the envelope passes isBackup()');
  else fail('the envelope does not pass isBackup()');

  return { ok, lines };
}

/* The demo trip's gate — run by the builder before it writes, by
   `npm run verify:demo` against the committed file, and by the unit suite
   (seed.test.ts). Nothing is written unless every line holds.

   Three kinds of rule:
   · STRUCTURE — the id rule (every id `dm27-`, Dexie keys are global), unique
     ids, dates inside the trip, contiguous stops, referential integrity,
     every day resolving to a plan and a stop (the app's own resolveDay /
     currentStop), money that adds up (toHomeMinor).
   · COVERAGE — the trip exists to exercise the app, so it must keep carrying
     what the app can show: every booking kind and status, an alternative leg,
     Simplified AND Traditional cards, a fill-in phrase, metro and no-metro
     cities, a hike stop, a Hong Kong stop with Macau places, a crit runbook,
     a travel day whose metro line joins its runbook and lifts a NOT.
   · PRIVACY — it is invented end to end: every booking code starts DEMO, no
     pattern the privacy gate greps for may match, no passport-shaped token. */
import type { AppBackup, Booking, TripBundle } from '../../src/lib/model/types';
import { currentStop, resolveDay } from '../../src/lib/logic/day';
import { toHomeMinor } from '../../src/lib/logic/money';
import { isBackup } from '../../src/lib/logic/backup';
import { placeIndex, isOpenable } from '../../src/lib/logic/places';
import { hasMetro } from '../../src/lib/logic/dayroute';
import { buildMetroLine } from '../../src/lib/logic/metroline';
import { FORBIDDEN } from '../privacy/forbidden';
import { P, TRIP_END, TRIP_ID, TRIP_START, dateRange } from './base';

export interface AssertionReport {
  ok: boolean;
  lines: string[];
}

const PASSPORT_SHAPE = /\b\d{2}[A-Z]{2}\d{5}\b/;

function collectIds(b: TripBundle): { id: string; where: string }[] {
  const out: { id: string; where: string }[] = [];
  const add = (where: string, ids: (string | undefined)[]) => {
    for (const id of ids) if (id !== undefined) out.push({ id, where });
  };
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

export function assertDemoBundle(b: TripBundle, envelope: AppBackup): AssertionReport {
  const lines: string[] = [];
  let ok = true;
  const fail = (m: string) => {
    ok = false;
    lines.push(`✗ ${m}`);
  };
  const pass = (m: string) => lines.push(`✓ ${m}`);
  const check = (cond: boolean, m: string, why = '') => (cond ? pass(m) : fail(why ? `${m} — ${why}` : m));
  const text = JSON.stringify(envelope);
  const trip = b.trip;

  /* ---- structure ---- */
  check(trip.id === TRIP_ID, `trip id is ${TRIP_ID}`);
  check(/^TEST\b/.test(trip.title) && trip.subtitle === 'Sample trip · not real data', 'the title says TEST and the subtitle says sample data');
  const ids = collectIds(b);
  const bad = ids.filter((x) => !x.id.startsWith(P));
  check(bad.length === 0, `all ${ids.length} ids carry the ${P} prefix`, bad.slice(0, 3).map((x) => `${x.where}:${x.id}`).join(', '));
  check(!/\b(cn26|il26)\b|cn26-|il26-/.test(text), 'no id of another seed appears');
  const seen = new Set<string>();
  const dupes = ids.filter((x) => (seen.has(x.id) ? true : (seen.add(x.id), false)));
  check(dupes.length === 0, `all ${seen.size} ids unique`, dupes.map((d) => d.id).join(', '));
  check(trip.start === TRIP_START && trip.end === TRIP_END, `trip runs ${TRIP_START} → ${TRIP_END}`);

  const inTrip = (d: string) => d >= trip.start && d <= trip.end;
  const outside = [
    ...b.stops.filter((s) => !inTrip(s.start) || !inTrip(s.end)).map((s) => s.id),
    ...b.dayPlans.filter((d) => !inTrip(d.date)).map((d) => d.id),
    ...b.bookings.filter((x) => !inTrip(x.date)).map((x) => x.id),
    ...b.expenses.filter((x) => !inTrip(x.date)).map((x) => x.id),
  ];
  check(outside.length === 0, 'every stop, day, booking and expense date lies inside the trip', outside.join(', '));

  /* The flights in start the trip; the arrival night (a bed by the station,
     before the school's stop opens) is the one gap, as on any trip that lands
     somewhere it does not stay. From the first real stop on, no gaps. */
  const sorted = [...b.stops].sort((x, y) => x.order - y.order);
  const real0 = sorted.filter((s) => s.kind === 'stop');
  const gaps = real0.flatMap((s, i) => {
    const n = real0[i + 1];
    return [...(s.start >= s.end ? [`${s.id} start>=end`] : []), ...(n && n.start !== s.end ? [`${s.id}→${n.id}`] : [])];
  });
  check(gaps.length === 0 && sorted[0]?.start === trip.start, `${real0.length} stops are contiguous, the flights in on the first day`, gaps.join(', '));

  const stopIds = new Set(b.stops.map((s) => s.id));
  const runbookIds = new Set(b.runbooks.map((r) => r.id));
  const docIds = new Set(b.documents.map((d) => d.meta.id));
  const catIds = new Set(b.categories.map((x) => x.id));
  const broken = [
    ...b.dayPlans.filter((d) => d.runbookId && !runbookIds.has(d.runbookId)).map((d) => `${d.date}→${d.runbookId}`),
    ...b.stops.filter((s) => s.photoDocId && !docIds.has(s.photoDocId)).map((s) => s.id),
    ...(trip.coverDocId && !docIds.has(trip.coverDocId) ? ['cover'] : []),
    ...b.bookings.filter((x) => x.stopId && !stopIds.has(x.stopId)).map((x) => x.id),
    ...b.bookings.filter((x) => x.kind === 'hotel' && x.checkIn >= x.checkOut).map((x) => x.id),
    ...b.dayDefaults.filter((d) => d.stopId && !stopIds.has(d.stopId)).map((d) => d.id),
    ...b.expenses.filter((e) => !catIds.has(e.categoryId)).map((e) => e.id),
    ...b.documents.filter((d) => d.meta.stopId && !stopIds.has(d.meta.stopId)).map((d) => d.meta.id),
    ...b.documents.filter((d) => d.meta.size !== Buffer.from(d.dataBase64, 'base64').byteLength).map((d) => `${d.meta.id} size`),
  ];
  check(broken.length === 0, 'referential integrity: runbooks, documents, stops, categories', broken.join(', '));

  /* every placeIds entry resolves to something a map button can open */
  const index = placeIndex(b);
  const deadPlaces = [...b.dayPlans, ...b.dayDefaults].flatMap((d) =>
    (d.placeIds ?? []).filter((id) => !index.get(id) || !isOpenable(index.get(id)!)).map((id) => `${d.id}:${id}`),
  );
  check(deadPlaces.length === 0, 'every day→place id resolves to an openable place', deadPlaces.join(', '));
  check(b.dayPlans.every((d) => d.placeIds === undefined || d.placeIds.length > 0), 'a day with nothing to link has no placeIds field, never an empty one');

  /* every trip day resolves — with the app's own functions */
  const days = dateRange(trip.start, trip.end);
  const noPlan = days.filter((d) => !resolveDay(d, b.dayPlans, b.dayDefaults, b.stops));
  check(noPlan.length === 0, `all ${days.length} trip days resolve to a plan`, noPlan.join(', '));
  const lastStopEnd = sorted[sorted.length - 1]!.end;
  const noStop = days.filter((d) => d >= real0[0]!.start && d < lastStopEnd && !currentStop(b.stops, d));
  check(noStop.length === 0, 'every day from the first stop to the flight home resolves to a stop', noStop.join(', '));
  const sunday = resolveDay('2027-03-28', b.dayPlans, b.dayDefaults, b.stops);
  const weekday = resolveDay('2027-03-24', b.dayPlans, b.dayDefaults, b.stops);
  check(!!sunday?.fromDefault && /Sunday/.test(sunday.title), 'Sunday Mar 28 resolves to the Sunday default');
  check(!!weekday?.fromDefault && /training day/.test(weekday.title), 'Wednesday Mar 24 resolves to the training-day default');

  /* money */
  const plan = b.categories.reduce((s, x) => s + x.planMinor, 0);
  check(plan === trip.budgetTotalMinor, `category plans sum to the budget ($${plan / 100})`);
  const codes = new Set(trip.currencies.map((x) => x.code));
  const badMoney = b.expenses.filter((e) => !codes.has(e.currency) || e.homeMinor !== toHomeMinor(e.amount, e.rateToHome)).map((e) => e.id);
  check(badMoney.length === 0, `${b.expenses.length} expenses convert correctly — via toHomeMinor()`, badMoney.join(', '));

  /* ---- coverage: what the trip exists to exercise ---- */
  const kinds = new Set(b.bookings.map((x) => x.kind));
  check(['flight', 'train', 'other', 'hotel', 'activity'].every((k) => kinds.has(k as Booking['kind'])), 'a booking of every kind');
  const statuses = new Set(b.bookings.map((x) => x.status));
  check(['booked', 'pending', 'walkin', 'cancelled'].every((s) => statuses.has(s as Booking['status'])), 'a booking in every status');
  check(b.bookings.some((x) => x.alternative), 'an alternative leg');
  check(b.bookings.some((x) => x.kind === 'flight' && x.arrDayOffset === 1), 'an overnight flight');
  check(b.bookings.some((x) => (x.kind === 'train' || x.kind === 'other') && (x.from?.stations?.length ?? 0) === 0 && !!x.from?.why), 'a rail/road end with no station and the reason why');
  check(b.bookings.some((x) => x.kind === 'hotel' && !!x.native && !!x.address && !!x.phone), 'a stay with a native name, a local address and a phone');
  check(b.bookings.some((x) => x.kind === 'activity' && !!x.time) && b.bookings.some((x) => x.kind === 'activity' && x.status === 'booked'), 'a timed ticket and a booked ticket');
  check(b.counters.some((x) => x.pinned && x.countStartsDayAfter && !!x.hardDeadline), 'a pinned visa counter with a deadline');
  check(b.showCards.some((x) => x.kind === 'phrase' && !x.script) && b.showCards.some((x) => x.script === 'Hant' && x.region === 'HK'), 'Simplified and Traditional (HK) cards');
  check(b.showCards.some((x) => x.native.includes('___')) && b.showCards.some((x) => !!x.pinyin && !!x.set), 'a fill-in phrase, and phrases with pinyin and sets');
  check(b.showCards.some((x) => x.isKey), 'the "please take me here" key phrase');
  const real = b.stops.filter((s) => s.kind === 'stop');
  check(real.some((s) => hasMetro(s)) && real.some((s) => !hasMetro(s)), 'metro and no-metro cities');
  check(real.some((s) => /hike/i.test(s.whenLabel ?? '')), 'a hike stop');
  check(real.some((s) => (s.spots ?? []).some((x) => x.mapCity === 'Macau')), 'a Hong Kong stop with Macau places');
  check(real.some((s) => !s.coord && !s.photoDocId), 'a stop with no coordinate and no photo yet');
  check(b.runbooks.some((r) => r.severity === 'crit') && b.runbooks.some((r) => r.severity === 'warn'), 'crit and warn runbooks');
  check(b.tasks.some((x) => x.done) && b.tasks.some((x) => !x.done) && b.alarms.some((x) => x.done), 'done and open tasks, a done alarm');

  /* the crit travel day: its line joins every leg to a step and lifts a NOT */
  const apr04 = b.dayPlans.find((d) => d.date === '2027-04-04')!;
  const line = buildMetroLine({ date: apr04.date, bookings: b.bookings, cards: b.showCards, runbook: b.runbooks.find((r) => r.id === apr04.runbookId), bedLabel: apr04.bedLabel });
  const legs = line?.segments.filter((s) => s.kind === 'leg') ?? [];
  check(!!line && line.stations.length >= 4 && legs.every((s) => s.step !== null), 'Apr 4: the metro line joins its flight to the runbook');
  check(!!line?.stations.some((s) => s.warn === 'NOT Pudong'), 'Apr 4: "NOT Pudong" is lifted onto the Hongqiao station');

  /* ---- privacy ---- */
  const coded = b.bookings.filter((x) => x.code && !x.code.startsWith('DEMO')).map((x) => x.id);
  check(coded.length === 0, 'every booking code starts with DEMO', coded.join(', '));
  const leaks = FORBIDDEN.filter(({ re }) => re.test(text)).map((x) => x.label);
  check(leaks.length === 0, `none of the privacy gate's ${FORBIDDEN.length} patterns matches`, leaks.join(', '));
  check(!PASSPORT_SHAPE.test(text), 'no passport-shaped token anywhere');

  /* ---- the envelope ---- */
  check(JSON.stringify(JSON.parse(text)) === text, 'the envelope round-trips through JSON');
  check(isBackup(JSON.parse(text)), 'the envelope passes isBackup()');

  return { ok, lines };
}

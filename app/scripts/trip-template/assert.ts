/* ┌──────────────────────────────────────────────────────────────────────────┐
   │ TRIP TEMPLATE · assert.ts — the gate. Nothing is written unless every    │
   │ one of these holds. Generic: parameterised by slug, reused by every trip │
   │ compiled from a brief. Copy nothing; import it.                          │
   └──────────────────────────────────────────────────────────────────────────┘

   Three of these matter more than the rest.

   · **The id rule.** Dexie primary keys are global, not scoped per trip, so an
     id shared with another trip silently OVERWRITES that trip's record the
     moment this file is imported. Every id must start with `${slug}-`, and no
     foreign slug may appear anywhere in the serialized output.

   · **Coverage.** Every night of the trip must be answered for — by a held
     stay, a deliberate walk-in, a night spent aboard an overnight leg, or an
     explicit ⏳ OPEN placeholder (`status: 'pending'`). A night with NOTHING
     against it is a hole, and holes are what this check exists to catch before
     they reach a phone. Answered with the app's own `buildCoverage()`, so the
     seed and the app can never disagree about the answer.

   · **The privacy scan.** Empty by default, and deliberately so — a brand-new
     trip has nothing to leak yet. The China precedent is why the hook exists:
     that trip carries real passport numbers, PNRs and order ids, and both its
     builder (`scripts/china/assert.ts`) and the deploy gate
     (`scripts/check-dist-clean.ts`) grep for those literals so they can never
     reach a built file. The moment your trip carries a real reference that
     must not escape this repo, add it to `privacyValues` and it is guarded the
     same way. A passport-shaped token is refused unconditionally.

   Everywhere a rule is really a question about app behaviour ("does every day
   resolve to a plan?", "would this chip be amber?") it is answered by calling
   the app's OWN function rather than restating its logic here. */
import type { AppBackup, ISODate, TripBundle } from '../../src/lib/model/types';
import { currentStop, resolveDay } from '../../src/lib/logic/day';
import { tripDays } from '../../src/lib/logic/phase';
import { toHomeMinor } from '../../src/lib/logic/money';
import { isBackup } from '../../src/lib/logic/backup';
import { buildCoverage, coverageStamp } from '../../src/lib/logic/coverage';

/** Slugs of every other trip that could be on the same phone. A collision with
    any of these is the failure mode this whole file exists to prevent. */
const KNOWN_SLUGS = ['cn26', 'il26', 'tx00'];

/** Any passport-shaped token at all — not just one we know about. Refused
    unconditionally, in every trip, forever. */
const PASSPORT_SHAPE = /\b\d{2}[A-Z]{2}\d{5}\b/;

/** One ⏳ OPEN line from the brief, as the pair of records it compiled into.
    The brief's contract is that an OPEN line produces BOTH — a placeholder the
    app can draw amber, and a to-do with a date on it — and this is where that
    contract is enforced rather than merely intended. */
export interface OpenItem {
  /** The placeholder booking. Must exist and must carry `status: 'pending'`. */
  bookingId: string;
  /** The Task carrying the "by <date>" deadline. Must exist and have a `due`. */
  taskId: string;
}

/** Counts a typo in a builder would change. Omit any you do not want checked —
    every field is optional, and an omitted one is simply not asserted. */
export interface ExpectedCounts {
  days?: number;
  stops?: number;
  dayPlans?: number;
  bookings?: number;
  tasks?: number;
  /** Bookings with `status: 'pending'` — i.e. ⏳ OPEN lines from the brief. */
  openBookings?: number;
}

export interface AssertConfig {
  /** The trip's slug. `trip.id` must equal it; every other id must prefix it. */
  slug: string;
  /** The fixed authoring date. Coverage is evaluated as of this day, never
      today, or the report would change between two identical runs. */
  seedDate: ISODate;
  /** TRIP_END + 1. The last stop's exclusive end. */
  tripEndExclusive: ISODate;
  /** Earliest date an alarm may carry. Defaults to `trip.start`. */
  alarmEarliest?: ISODate;
  /** Slugs that must not appear in the serialized output. Defaults to every
      known slug except this trip's own. */
  foreignSlugs?: string[];
  /** The template's stop contract: stops abut exactly, the first starts on the
      trip's first day and the last ends on `tripEndExclusive`, so every single
      day resolves to a stop. Default true, and worth keeping.

      THE CHINA TRIP DELIBERATELY DOES NOT SATISFY THIS — it carries a transit
      pseudo-stop for the flights, a night in Yantai city that belongs to no
      stop, and two tail days after the last stop releases you. That trip was
      reverse-engineered from documents; a trip compiled from a brief has no
      reason to inherit its irregularities. Set false only if yours genuinely
      has a shape like that, and expect the day-resolution checks below to have
      something to say about it. */
  contiguousStops?: boolean;
  /** Literal strings that must never leak. EMPTY BY DEFAULT — see the header. */
  privacyValues?: string[];
  /** Every ⏳ OPEN line, as `{ bookingId, taskId }`. */
  openItems?: OpenItem[];
  expect?: ExpectedCounts;
}

export interface AssertionReport {
  ok: boolean;
  lines: string[];
}

/** Every id the bundle carries, including the nested ones. Walking ALL of them
    is the point: a missed collection is an unguarded collision. */
function collectIds(b: TripBundle): { id: string; where: string }[] {
  const out: { id: string; where: string }[] = [];
  const add = (where: string, ids: (string | undefined)[]): void => {
    for (const v of ids) if (v !== undefined) out.push({ id: v, where });
  };
  add('trip', [b.trip.id]);
  add('counters', b.counters.map((r) => r.id));
  add('stops', b.stops.map((r) => r.id));
  add(
    'stop blocks',
    b.stops.flatMap((s) => [...s.blocks, ...s.recoBlocks, ...(s.options ?? [])].map((x) => x.id)),
  );
  add('stop spots', b.stops.flatMap((s) => (s.spots ?? []).map((x) => x.id)));
  add('dayPlans', b.dayPlans.map((r) => r.id));
  add('dayDefaults', b.dayDefaults.map((r) => r.id));
  add('dayPicks', (b.dayPicks ?? []).map((r) => r.id));
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

export function assertTripBundle(
  bundle: TripBundle,
  envelope: AppBackup,
  cfg: AssertConfig,
): AssertionReport {
  const lines: string[] = [];
  let ok = true;
  const fail = (msg: string): void => {
    ok = false;
    lines.push(`✗ ${msg}`);
  };
  const pass = (msg: string): void => void lines.push(`✓ ${msg}`);

  const trip = bundle.trip;
  const slug = cfg.slug;
  const prefix = `${slug}-`;
  const text = JSON.stringify(envelope);
  const foreign = cfg.foreignSlugs ?? KNOWN_SLUGS.filter((s) => s !== slug);
  const alarmEarliest = cfg.alarmEarliest ?? trip.start;

  /* ---- 1. the id rule ---- */
  const ids = collectIds(bundle);
  if (trip.id !== slug) fail(`trip.id is "${trip.id}", expected "${slug}"`);
  let badPrefix = 0;
  for (const { id, where } of ids) {
    if (id === slug) continue; // the trip's own id is the bare slug
    if (!id.startsWith(prefix)) {
      badPrefix++;
      fail(`${where}: id "${id}" does not start with "${prefix}"`);
    }
  }
  if (badPrefix === 0) pass(`all ${ids.length} ids carry the ${prefix} prefix`);

  let collisions = 0;
  for (const other of foreign) {
    if (text.includes(other)) {
      collisions++;
      fail(`the string "${other}" — another trip's slug — appears in the serialized trip`);
    }
  }
  if (collisions === 0) {
    pass(`no foreign trip slug appears anywhere (checked ${foreign.join(', ') || 'none'})`);
  }

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

  /* ---- 3. every date inside the trip ---- */
  const inTrip = (d: string): boolean => d >= trip.start && d <= trip.end;
  for (const s of bundle.stops) {
    if (!inTrip(s.start)) fail(`stop ${s.id} starts outside the trip (${s.start})`);
    if (!inTrip(s.end) && s.end !== cfg.tripEndExclusive) {
      fail(`stop ${s.id} ends outside the trip (${s.end})`);
    }
  }
  for (const d of bundle.dayPlans) if (!inTrip(d.date)) fail(`dayPlan ${d.date} outside the trip`);
  for (const a of bundle.alarms) {
    if (a.date > trip.end || a.date < alarmEarliest) {
      fail(`alarm ${a.id} outside the allowed range (${a.date}; earliest ${alarmEarliest})`);
    }
  }
  for (const b of bundle.bookings) if (!inTrip(b.date)) fail(`booking ${b.id} outside the trip (${b.date})`);
  for (const e of bundle.expenses) if (!inTrip(e.date)) fail(`expense ${e.id} outside the trip (${e.date})`);
  for (const c of bundle.counters) {
    if (c.startDate > trip.end) fail(`counter ${c.id} starts after the trip ends (${c.startDate})`);
  }
  pass(`every stop, day, booking and expense date lies inside the trip; alarms from ${alarmEarliest}`);

  /* ---- 4. stops contiguous and non-overlapping ---- */
  const sorted = [...bundle.stops].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  let contiguous = true;
  for (const s of sorted) {
    if (s.start >= s.end) {
      contiguous = false;
      fail(`stop ${s.id} has start >= end`);
    }
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) fail('the trip carries no stops at all');
  if (cfg.contiguousStops !== false) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i]!;
      const next = sorted[i + 1]!;
      if (s.end !== next.start) {
        contiguous = false;
        fail(`gap or overlap: ${s.id} ends ${s.end} but ${next.id} starts ${next.start}`);
      }
    }
    if (first && first.start !== trip.start) fail(`first stop starts ${first.start}, trip starts ${trip.start}`);
    if (last && last.end !== cfg.tripEndExclusive) {
      fail(`last stop ends ${last.end}, expected ${cfg.tripEndExclusive} (TRIP_END + 1 day)`);
    }
    if (contiguous && first && last) pass(`${sorted.length} stops are contiguous and cover every trip day`);
  } else if (contiguous) {
    pass(`${sorted.length} stops each have start < end (contiguity check waived)`);
  }

  /* ---- 5. referential integrity ---- */
  const runbookIds = new Set(bundle.runbooks.map((r) => r.id));
  const stopIds = new Set(bundle.stops.map((s) => s.id));
  const docIds = new Set(bundle.documents.map((d) => d.meta.id));
  const catIds = new Set(bundle.categories.map((c) => c.id));
  const bookingIds = new Set(bundle.bookings.map((b) => b.id));
  const spotIds = new Set(bundle.stops.flatMap((s) => (s.spots ?? []).map((x) => x.id)));
  const showCardIds = new Set(bundle.showCards.map((c) => c.id));
  /* placeIds is a join written by hand — an id that resolves to nothing would
     draw a chip that opens the wrong place, or nothing at all. */
  const placeTargets = new Set([...stopIds, ...spotIds, ...showCardIds, ...bookingIds]);
  for (const d of bundle.dayPlans) {
    if (d.runbookId && !runbookIds.has(d.runbookId)) fail(`dayPlan ${d.date} points at missing runbook ${d.runbookId}`);
    for (const p of d.placeIds ?? []) {
      if (!placeTargets.has(p)) fail(`dayPlan ${d.date} names place "${p}", which the trip does not carry`);
    }
  }
  for (const d of bundle.dayDefaults) {
    if (d.stopId && !stopIds.has(d.stopId)) fail(`dayDefault ${d.id} points at missing stop ${d.stopId}`);
    for (const p of d.placeIds ?? []) {
      if (!placeTargets.has(p)) fail(`dayDefault ${d.id} names place "${p}", which the trip does not carry`);
    }
  }
  for (const s of bundle.stops) {
    if (s.photoDocId && !docIds.has(s.photoDocId)) fail(`stop ${s.id} points at missing document ${s.photoDocId}`);
  }
  if (trip.coverDocId && !docIds.has(trip.coverDocId)) fail(`trip cover points at missing document ${trip.coverDocId}`);
  for (const b of bundle.bookings) {
    if (b.tripId !== slug) fail(`booking ${b.id} carries tripId "${b.tripId}"`);
    if (b.stopId && !stopIds.has(b.stopId)) fail(`booking ${b.id} points at missing stop ${b.stopId}`);
    if (b.kind === 'hotel' && b.checkIn >= b.checkOut) fail(`bed ${b.id} has checkIn >= checkOut`);
  }
  for (const e of bundle.expenses) {
    if (!catIds.has(e.categoryId)) fail(`expense ${e.id} points at missing category ${e.categoryId}`);
  }
  for (const d of bundle.documents) {
    if (d.meta.stopId && !stopIds.has(d.meta.stopId)) fail(`document ${d.meta.id} points at missing stop ${d.meta.stopId}`);
    if (d.meta.bookingId && !bookingIds.has(d.meta.bookingId)) fail(`document ${d.meta.id} points at missing booking ${d.meta.bookingId}`);
    if (d.meta.size !== Buffer.from(d.dataBase64, 'base64').byteLength) {
      fail(`document ${d.meta.id} size does not match its bytes`);
    }
  }
  pass('referential integrity: runbooks, stops, documents, categories, named places');

  /* ---- 6. every trip day resolves, using the app's own logic ---- */
  const days = tripDays(trip);
  if (cfg.expect?.days !== undefined) {
    if (days === cfg.expect.days) pass(`trip is ${days} inclusive days`);
    else fail(`trip is ${days} inclusive days, expected ${cfg.expect.days}`);
  }
  let unresolved = 0;
  let stopless = 0;
  let fromDefault = 0;
  const allDays: ISODate[] = [];
  for (let d = trip.start; d <= trip.end; ) {
    allDays.push(d);
    const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
    const nx = new Date(Date.UTC(y, m - 1, dd) + 86_400_000);
    const p2 = (n: number): string => String(n).padStart(2, '0');
    d = `${nx.getUTCFullYear()}-${p2(nx.getUTCMonth() + 1)}-${p2(nx.getUTCDate())}`;
  }
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
  if (unresolved === 0) {
    pass(`all ${allDays.length} trip days resolve to a plan (${fromDefault} from a DayDefault) — via resolveDay()`);
  }
  if (stopless === 0) pass(`all ${allDays.length} trip days resolve to a stop — via currentStop()`);

  /* ---- 7. COVERAGE — every night answered for, and OPEN reads amber ----

     This is the check the ✅/⏳ brief exists to make possible. `buildCoverage`
     is the app's own function, so the colours reported here are literally the
     ones the phone will draw. `missing` is a hole (amber now, RED once the
     booking window closes in on it); `pending` is an honest ⏳ OPEN placeholder
     and is amber and only ever amber — `toneOf()` escalates on missing alone. */
  const segs = buildCoverage(trip, bundle.stops, bundle.bookings, cfg.seedDate);
  let holes = 0;
  for (const seg of segs) {
    if (seg.bedsMissing > 0) {
      holes++;
      const dates = seg.nights.filter((n) => n.state === 'missing').map((n) => n.date);
      fail(`${seg.stopId}: ${seg.bedsMissing} night(s) with no bed and no ⏳ OPEN placeholder — ${dates.join(', ')}`);
    }
    if (seg.legsMissing > 0) {
      holes++;
      fail(`${seg.stopId}: ${seg.legsMissing} move(s) with no booking of any kind — add a ⏳ OPEN placeholder`);
    }
  }
  if (holes === 0) pass(`every night of the trip is covered by a stay, a walk-in, a transit leg or a ⏳ OPEN placeholder`);
  for (const seg of segs) {
    const stamp = coverageStamp(seg);
    lines.push(`  · ${seg.stopId} ${seg.from}→${seg.end}: ${stamp.cls.padEnd(4)} "${stamp.label}"`);
  }
  const amberSegs = segs.filter((s) => s.tone === 'warn');
  const openBookings = bundle.bookings.filter((b) => b.status === 'pending');
  if (openBookings.length > 0) {
    if (amberSegs.length > 0) {
      pass(`${openBookings.length} ⏳ OPEN placeholder(s) → ${amberSegs.length} amber segment(s) — via buildCoverage()`);
    } else {
      fail(`${openBookings.length} ⏳ OPEN placeholder(s) but no segment reads amber — check stopId/dates on them`);
    }
  }
  if (segs.some((s) => s.tone === 'crit')) {
    fail('a segment reads CRIT — that is a real hole inside the booking window, not an ⏳ OPEN item');
  }

  /* ---- 8. the ⏳ OPEN contract: a placeholder AND a dated task ---- */
  const taskById = new Map(bundle.tasks.map((t) => [t.id, t]));
  const bookingById = new Map(bundle.bookings.map((b) => [b.id, b]));
  let openBad = 0;
  for (const item of cfg.openItems ?? []) {
    const b = bookingById.get(item.bookingId);
    const t = taskById.get(item.taskId);
    if (!b) {
      openBad++;
      fail(`⏳ OPEN item names booking "${item.bookingId}", which the trip does not carry`);
    } else if (b.status !== 'pending') {
      openBad++;
      fail(`⏳ OPEN booking "${item.bookingId}" has status "${b.status}" — must be "pending" to render amber`);
    }
    if (!t) {
      openBad++;
      fail(`⏳ OPEN item names task "${item.taskId}", which the trip does not carry`);
    } else if (!t.due) {
      openBad++;
      fail(`⏳ OPEN task "${item.taskId}" carries no due date — the brief's "by <date>" was dropped`);
    } else if (b && t.due > b.date) {
      openBad++;
      fail(`⏳ OPEN task "${item.taskId}" is due ${t.due}, after the thing it books happens (${b.date})`);
    }
  }
  const declared = (cfg.openItems ?? []).length;
  if (declared > 0 && openBad === 0) {
    pass(`all ${declared} ⏳ OPEN item(s) carry both a pending placeholder and a dated task`);
  }
  if (declared > 0 && declared !== openBookings.length) {
    fail(`${openBookings.length} booking(s) are pending but only ${declared} ⏳ OPEN item(s) are declared`);
  }

  /* ---- 9. money ---- */
  if (trip.budgetTotalMinor !== undefined && bundle.categories.length > 0) {
    const planSum = bundle.categories.reduce((s, c) => s + c.planMinor, 0);
    if (planSum === trip.budgetTotalMinor) pass(`category plans sum to the budget (${planSum / 100} ${trip.homeCurrency})`);
    else fail(`category plans sum to ${planSum}, budget is ${trip.budgetTotalMinor}`);
  }
  const codes = new Set(trip.currencies.map((c) => c.code));
  if (!codes.has(trip.homeCurrency)) fail(`homeCurrency ${trip.homeCurrency} is not in trip.currencies`);
  for (const e of bundle.expenses) {
    if (!codes.has(e.currency)) fail(`expense ${e.id} uses currency ${e.currency}, which the trip does not carry`);
    const expected = toHomeMinor(e.amount, e.rateToHome);
    if (e.homeMinor !== expected) fail(`expense ${e.id}: homeMinor ${e.homeMinor}, expected ${expected}`);
  }
  if (bundle.expenses.length) pass(`${bundle.expenses.length} expenses convert correctly — via toHomeMinor()`);

  /* ---- 10. determinism ---- */
  const stamps = [
    trip.createdAt,
    trip.updatedAt,
    ...bundle.bookings.flatMap((b) => [b.createdAt, b.updatedAt]),
    ...bundle.expenses.map((e) => e.ts),
    ...bundle.documents.map((d) => d.meta.addedAt),
  ];
  const drifting = stamps.filter((t) => t > Date.UTC(2100, 0, 1) || t < Date.UTC(2000, 0, 1));
  if (drifting.length) fail(`${drifting.length} timestamp(s) look computed rather than fixed`);
  else pass(`${stamps.length} timestamps are fixed literals — the build is reproducible`);

  /* ---- 11. expected counts ---- */
  const counts: [key: keyof ExpectedCounts, got: number][] = [
    ['stops', bundle.stops.length],
    ['dayPlans', bundle.dayPlans.length],
    ['bookings', bundle.bookings.length],
    ['tasks', bundle.tasks.length],
    ['openBookings', openBookings.length],
  ];
  for (const [key, got] of counts) {
    const want = cfg.expect?.[key];
    if (want === undefined) continue;
    if (got === want) pass(`${key}: ${got}`);
    else fail(`${key}: ${got}, expected ${want}`);
  }

  /* ---- 12. privacy ---- */
  const values = cfg.privacyValues ?? [];
  const lower = text.toLowerCase();
  let leaks = 0;
  for (const v of values) {
    if (v && lower.includes(v.toLowerCase())) {
      leaks++;
      fail(`a guarded value appears in this seed (${v.length} chars, starts "${v.slice(0, 3)}…")`);
    }
  }
  if (leaks === 0) {
    pass(
      values.length
        ? `privacy scan clean (${values.length} guarded values checked, none present)`
        : 'privacy scan: no guarded values configured (see the header before adding real references)',
    );
  }
  const passportish = PASSPORT_SHAPE.exec(text);
  if (passportish) fail(`a passport-shaped token appears in this seed: ${passportish[0]}`);
  else pass('no passport-shaped token anywhere');

  /* ---- 13. it round-trips and it is a backup ---- */
  const round = JSON.stringify(JSON.parse(text));
  if (round === text) pass('the envelope round-trips through JSON unchanged');
  else fail('the envelope does not round-trip through JSON');
  if (isBackup(JSON.parse(text))) pass('the envelope passes isBackup()');
  else fail('the envelope does not pass isBackup()');

  return { ok, lines };
}

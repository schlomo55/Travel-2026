/* THE ROUTE CHECK — the Relay's rows: stops are beds, moves are legs, in
   trip order; green booked, amber not booked, red a bed missing still ahead;
   and the count of what is STILL to do. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Stop } from '../lib/model/types';
import { routeCheck, type LegCheck, type StopCheck } from '../lib/logic/routecheck';
import { relayPlan } from '../lib/logic/motion';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const check = (now: string) => routeCheck(china.trip, china.stops, china.bookings, now);
/* THE TRIP AS IT STOOD UNTIL 28 SEP 2026 — the real seed minus the two
   bookings made that morning (the Muping bed for Nov 22 and CA1560 for Dec 5).
   The red row, the dated missing bed and the move with nothing booked were
   built for those two holes and are still proved on them; the real trip is
   asserted as it is now (coverage.test.ts does the same). */
const BOOKED_28_SEP = new Set(['cn26-stay-12', 'cn26-flight-ca1560']);
const before = china.bookings.filter((b) => !BOOKED_28_SEP.has(b.id));
const checkBefore = (now: string) => routeCheck(china.trip, china.stops, before, now);
const stopRow = (rows: ReturnType<typeof check>['rows'], id: string) =>
  rows.find((r): r is StopCheck => r.kind === 'stop' && r.stop.id === id)!;
const legInto = (rows: ReturnType<typeof check>['rows'], id: string) =>
  rows.find((r): r is LegCheck => r.kind === 'leg' && r.connector.toStopId === id)!;

describe('route check · China, the real trip', () => {
  it('reads in trip order: the way in, then each stop after the move into it, then home', () => {
    const { rows } = check('2026-10-01');
    const kinds = rows.map((r) => r.kind[0]).join('');
    expect(kinds).toBe('lslslslslslslslslslsl');
    expect(rows.filter((r) => r.kind === 'stop').length).toBe(10);
    expect((rows[0] as LegCheck).connector.edge).toBe('arrive');
    expect((rows[rows.length - 1] as LegCheck).connector.edge).toBe('depart');
  });

  it('before the trip: six legs to book and no bed missing — every bed is booked since 28 Sep', () => {
    const c = check('2026-10-01');
    expect(c.legsToBook).toBe(6);
    expect(c.bedsMissing).toBe(0);
    const kunyu = stopRow(c.rows, 'cn26-stop-kunyu');
    expect(kunyu.tone).toBe('ok');
    expect(kunyu.word).toBe('Booked');
    expect(c.rows.some((r) => r.tone === 'crit')).toBe(false);
  });

  it('until 28 Sep, before the trip: seven legs to book and the one bed missing, in red', () => {
    const c = checkBefore('2026-10-01');
    expect(c.legsToBook).toBe(7);
    expect(c.bedsMissing).toBe(1);
    const kunyu = stopRow(c.rows, 'cn26-stop-kunyu');
    expect(kunyu.tone).toBe('crit');
    expect(kunyu.word).toBe('Bed missing · 22 Nov');
  });

  it('names each move by its legs — the Dec 5 one by CA 1560 since 28 Sep', () => {
    const { rows } = check('2026-10-01');
    expect(legInto(rows, 'cn26-stop-zhangjiajie').label).toBe('HSR + CA 8609 → Zhangjiajie');
    expect(legInto(rows, 'cn26-stop-zhangjiajie').word).toBe('Part booked');
    const dec5 = legInto(rows, 'cn26-stop-beijing');
    expect(dec5.label).toBe('CA 1560 → Beijing');
    expect(dec5.word).toBe('Booked');
    expect(dec5.tone).toBe('ok');
    expect(legInto(rows, 'cn26-stop-lijiang').tone).toBe('ok');
    expect(legInto(rows, 'cn26-stop-kunyu').label).toBe('EY 608 + EY 888 + CA 8641 → Kunyu Academy');
  });

  it('names the move with nothing booked by its stops (the Dec 5 gap until 28 Sep)', () => {
    const gap = legInto(checkBefore('2026-10-01').rows, 'cn26-stop-beijing');
    expect(gap.label).toBe('Kunyu Academy → Beijing');
    expect(gap.word).toBe('Nothing booked');
    expect(gap.tone).toBe('warn');
  });

  it('calls the walk-up legs not booked, and the walk-in bed a walk-in — never a hole', () => {
    const { rows } = check('2026-10-01');
    expect(legInto(rows, 'cn26-stop-gorge').word).toBe('Not booked');
    const gorge = stopRow(rows, 'cn26-stop-gorge');
    expect(gorge.tone).toBe('ok');
    expect(gorge.word).toBe('Walk-in');
    expect(stopRow(rows, 'cn26-stop-hongkong').word).toBe('Booked');
  });

  it('on Dec 15: what is behind you is shown and not counted', () => {
    const c = check('2026-12-15');
    expect(c.bedsMissing).toBe(0);
    expect(c.legsToBook).toBe(3); // Dec 18 bus, Dec 19 shared car, Dec 20 HSR
    const kunyu = stopRow(c.rows, 'cn26-stop-kunyu');
    expect(kunyu.tone).toBe('ok');
    expect(kunyu.word).toBe('Booked');
    expect(kunyu.past).toBe(true);
    expect(stopRow(c.rows, 'cn26-stop-chongqing').tonight).toBe(true);
  });

  it('on Dec 15, until 28 Sep: the Yantai night went amber — still true, no longer a job', () => {
    const c = checkBefore('2026-12-15');
    expect(c.bedsMissing).toBe(0);
    expect(c.legsToBook).toBe(3);
    const kunyu = stopRow(c.rows, 'cn26-stop-kunyu');
    expect(kunyu.tone).toBe('warn');
    expect(kunyu.word).toBe('Bed missing · 22 Nov');
    expect(kunyu.past).toBe(true);
  });

  it('marks today’s move', () => {
    const { rows } = check('2026-12-11');
    const today = rows.filter((r): r is LegCheck => r.kind === 'leg' && r.today);
    expect(today.length).toBe(1);
    expect(today[0]!.connector.toStopId).toBe('cn26-stop-zhangjiajie');
  });

  /* Run 3c: the way in is dated on the trip's first day, but CA 8683 flies
     on the second — judged by the move's date, 22 Nov read it as done */
  it('judges a move that spans two days by its last leg: the way in is today on 22 Nov, done on the 23rd', () => {
    const inOn = (now: string) => check(now).rows[0] as LegCheck;
    expect(inOn('2026-11-21')).toMatchObject({ today: true, past: false });
    expect(inOn('2026-11-22')).toMatchObject({ today: true, past: false });
    expect(inOn('2026-11-23')).toMatchObject({ today: false, past: true });
    /* …and the way home, EY 871 on the 26th then EY 609 on the 27th */
    const home = (now: string) => check(now).rows.at(-1) as LegCheck;
    expect(home('2026-12-27')).toMatchObject({ today: true, past: false });
    expect(home('2026-12-28')).toMatchObject({ today: false, past: true });
  });

  /* Run 3c: the Israel and template trips let the last stop run one day past
     the trip's end — the window home began after it closed */
  it('finds the flights home when the last stop ends after the trip does (Israel, template)', () => {
    for (const [file, flight] of [
      ['israel-test.trip.json', 'il26-flight-out'],
      ['template-example.trip.json', 'tx00-flight-home'],
    ] as const) {
      const t = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', file), 'utf8')) as AppBackup).trips[0]!;
      const last = t.stops.filter((s) => s.kind === 'stop').sort((a, b) => a.start.localeCompare(b.start)).at(-1)!;
      expect(last.end > t.trip.end, file).toBe(true);
      const c = routeCheck(t.trip, t.stops, t.bookings, t.trip.start);
      const home = c.rows.at(-1) as LegCheck;
      expect(home.kind, file).toBe('leg');
      expect(home.connector.edge, file).toBe('depart');
      expect(home.connector.legs.map((b) => b.id), file).toEqual([flight]);
      expect(home.word, file).toBe('Booked');
    }
  });

  it('gives the Relay one tone per row: it pauses on every amber and red', () => {
    const { rows } = check('2026-10-01');
    const plan = relayPlan(rows.map((r) => r.tone));
    expect(plan.steps.length).toBe(rows.length);
    expect(plan.counts.crit).toBe(0);
    expect(plan.counts.warn).toBe(6);
    /* until 28 Sep: the missing bed was its one red row, and the Dec 5 gap a seventh amber */
    const was = relayPlan(checkBefore('2026-10-01').rows.map((r) => r.tone));
    expect(was.counts.crit).toBe(1);
    expect(was.counts.warn).toBe(7);
  });
});

describe('route check · the rules', () => {
  const stop = (id: string, order: number, start: string, end: string): Stop => ({
    id,
    tripId: 't',
    kind: 'stop',
    name: id,
    hue: 0,
    start,
    end,
    blocks: [],
    recoBlocks: [],
    order,
  });
  const trip = { start: '2027-03-01', end: '2027-03-06' };
  const stops = [stop('a', 0, '2027-03-01', '2027-03-03'), stop('b', 1, '2027-03-03', '2027-03-06')];
  const bed = (id: string, checkIn: string, checkOut: string, status: Booking['status']): Booking => ({
    id,
    tripId: 't',
    kind: 'hotel',
    status,
    title: id,
    date: checkIn,
    city: 'x',
    checkIn,
    checkOut,
    meta: [],
    createdAt: 0,
    updatedAt: 0,
  });

  it('a bed chosen and not held is amber, and says so', () => {
    const c = routeCheck(trip, stops, [bed('h1', '2027-03-01', '2027-03-03', 'pending'), bed('h2', '2027-03-03', '2027-03-06', 'booked')], '2027-02-01');
    const a = c.rows.find((r): r is StopCheck => r.kind === 'stop' && r.stop.id === 'a')!;
    expect(a.tone).toBe('warn');
    expect(a.word).toBe('2 nights pending');
    expect(c.bedsMissing).toBe(0);
  });

  it('counts a move with nothing booked between two stops as one to book', () => {
    const c = routeCheck(trip, stops, [bed('h1', '2027-03-01', '2027-03-06', 'booked')], '2027-02-01');
    expect(c.legsToBook).toBe(1);
    expect(c.rows.map((r) => r.tone)).toEqual(['ok', 'warn', 'ok']);
  });

  /* Run 3c: an unbooked leg on the second day of a two-day move is still to
     book on that day — the move is not behind you until its last leg is */
  it('still counts a two-day move whose second leg is not booked, on the second day', () => {
    const leg = (id: string, date: string, status: Booking['status']): Booking => ({
      id,
      tripId: 't',
      kind: 'train',
      status,
      title: id,
      date,
      from: { name: 'x' },
      to: { name: 'y' },
      meta: [],
      createdAt: 0,
      updatedAt: 0,
    });
    const late = [stop('a', 0, '2027-03-02', '2027-03-04'), stop('b', 1, '2027-03-04', '2027-03-06')];
    const moves = [leg('in1', '2027-03-01', 'booked'), leg('in2', '2027-03-02', 'pending'), bed('h1', '2027-03-02', '2027-03-06', 'booked')];
    const on = (now: string) => routeCheck(trip, late, moves, now);
    expect(on('2027-03-02').rows[0]).toMatchObject({ kind: 'leg', today: true, past: false, word: 'Part booked' });
    expect(on('2027-03-02').legsToBook).toBe(2);
    expect(on('2027-03-03').rows[0]).toMatchObject({ today: false, past: true });
    expect(on('2027-03-03').legsToBook).toBe(1);
  });
});

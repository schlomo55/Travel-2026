/* THE ROUTE CHECK — the Relay's rows: stops are beds, moves are legs, in
   trip order; green booked, amber not booked, red a bed missing still ahead;
   and the count of what is STILL to do. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Stop } from '../lib/model/types';
import { routeCheck, type LegCheck, type StopCheck } from '../lib/logic/routecheck';
import { relayPlan } from '../lib/logic/motion';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const check = (now: string) => routeCheck(demo.trip, demo.stops, demo.bookings, now);
/* THE TRIP WITH TWO HOLES — the demo seed minus the Guilin airport bed for
   Apr 12 and 3U 9001, the Apr 7 flight into Chengdu. The red row, the dated
   missing bed and the move with nothing booked are proved on those two holes;
   the demo trip itself is asserted as it is (every bed held). */
const HOLES = new Set(['dm27-stay-12', 'dm27-flight-3u9001']);
const before = demo.bookings.filter((b) => !HOLES.has(b.id));
const checkBefore = (now: string) => routeCheck(demo.trip, demo.stops, before, now);
const stopRow = (rows: ReturnType<typeof check>['rows'], id: string) =>
  rows.find((r): r is StopCheck => r.kind === 'stop' && r.stop.id === id)!;
const legInto = (rows: ReturnType<typeof check>['rows'], id: string) =>
  rows.find((r): r is LegCheck => r.kind === 'leg' && r.connector.toStopId === id)!;

describe('route check · the demo trip', () => {
  it('reads in trip order: the way in, then each stop after the move into it, then home', () => {
    const { rows } = check('2027-03-01');
    const kinds = rows.map((r) => r.kind[0]).join('');
    expect(kinds).toBe('lslslslslslslslslsl');
    /* nine real stops — the International Flights transit is not one */
    expect(rows.filter((r) => r.kind === 'stop').length).toBe(9);
    expect((rows[0] as LegCheck).connector.edge).toBe('arrive');
    expect((rows[rows.length - 1] as LegCheck).connector.edge).toBe('depart');
  });

  /* the Suzhou train, the bus into the terraces and the shared car out */
  it('before the trip: three legs to book and no bed missing — every bed is held', () => {
    const c = check('2027-03-01');
    expect(c.legsToBook).toBe(3);
    expect(c.bedsMissing).toBe(0);
    const guilin = stopRow(c.rows, 'dm27-stop-guilin');
    expect(guilin.tone).toBe('ok');
    expect(guilin.word).toBe('Booked');
    expect(c.rows.some((r) => r.tone === 'crit')).toBe(false);
  });

  /* + the move into Chengdu with 3U 9001 gone */
  it('with the two holes, before the trip: four legs to book and the one bed missing, in red', () => {
    const c = checkBefore('2027-03-01');
    expect(c.legsToBook).toBe(4);
    expect(c.bedsMissing).toBe(1);
    const guilin = stopRow(c.rows, 'dm27-stop-guilin');
    expect(guilin.tone).toBe('crit');
    expect(guilin.word).toBe('Bed missing · 12 Apr');
  });

  it('names each move by its legs — the Apr 7 one by 3U 9001', () => {
    const { rows } = check('2027-03-01');
    /* Apr 4: MU 5003 from Pudong was CANCELLED and MU 5001 from Hongqiao
       booked — a cancelled leg never names the move, and the booked one
       gives it its tick */
    expect(legInto(rows, 'dm27-stop-huangshan').label).toBe('MU 5001 → Huangshan');
    expect(legInto(rows, 'dm27-stop-huangshan').word).toBe('Booked');
    expect(legInto(rows, 'dm27-stop-huangshan').tone).toBe('ok');
    /* the Suzhou move: the train in is not booked; the bed is (the Canal
       Hostel — the Lakeside Resort was cancelled) */
    expect(legInto(rows, 'dm27-stop-suzhou').label).toBe('HSR → Suzhou + the gardens');
    expect(legInto(rows, 'dm27-stop-suzhou').word).toBe('Not booked');
    expect(stopRow(rows, 'dm27-stop-suzhou').word).toBe('Booked');
    expect(stopRow(rows, 'dm27-stop-suzhou').tone).toBe('ok');
    const apr7 = legInto(rows, 'dm27-stop-chengdu');
    expect(apr7.label).toBe('3U 9001 → Chengdu');
    expect(apr7.word).toBe('Booked');
    expect(apr7.tone).toBe('ok');
    expect(legInto(rows, 'dm27-stop-yangshuo').tone).toBe('ok');
    /* the way in: both Finnair legs and the train — the "if AY 9057 is late"
       ALTERNATIVE train never joins it */
    expect(legInto(rows, 'dm27-stop-hangzhou').label).toBe('AY 1501 + AY 9057 + G7501 → Tai-chi school');
  });

  it('names the move with nothing booked by its stops (the Apr 7 hole)', () => {
    const gap = legInto(checkBefore('2027-03-01').rows, 'dm27-stop-chengdu');
    expect(gap.label).toBe('Huangshan → Chengdu');
    expect(gap.word).toBe('Nothing booked');
    expect(gap.tone).toBe('warn');
  });

  it('calls the walk-up legs not booked, and the walk-in bed a walk-in — never a hole', () => {
    const { rows } = check('2027-03-01');
    expect(legInto(rows, 'dm27-stop-longji').word).toBe('Not booked');
    const longji = stopRow(rows, 'dm27-stop-longji');
    expect(longji.tone).toBe('ok');
    expect(longji.word).toBe('Walk-in');
    expect(stopRow(rows, 'dm27-stop-hongkong').word).toBe('Booked');
  });

  it('on Apr 10: what is behind you is shown and not counted', () => {
    const c = check('2027-04-10');
    expect(c.bedsMissing).toBe(0);
    expect(c.legsToBook).toBe(2); // Apr 11 bus, Apr 12 shared car — the Apr 2 train is behind
    const chengdu = stopRow(c.rows, 'dm27-stop-chengdu');
    expect(chengdu.tone).toBe('ok');
    expect(chengdu.word).toBe('Booked');
    expect(chengdu.past).toBe(true);
    expect(stopRow(c.rows, 'dm27-stop-yangshuo').tonight).toBe(true);
  });

  it('on Apr 13, with the two holes: the Guilin night went amber — still true, no longer a job', () => {
    const c = checkBefore('2027-04-13');
    expect(c.bedsMissing).toBe(0);
    expect(c.legsToBook).toBe(0);
    const guilin = stopRow(c.rows, 'dm27-stop-guilin');
    expect(guilin.tone).toBe('warn');
    expect(guilin.word).toBe('Bed missing · 12 Apr');
    expect(guilin.past).toBe(true);
  });

  it('marks today’s move', () => {
    const { rows } = check('2027-04-04');
    const today = rows.filter((r): r is LegCheck => r.kind === 'leg' && r.today);
    expect(today.length).toBe(1);
    expect(today[0]!.connector.toStopId).toBe('dm27-stop-huangshan');
  });

  /* Run 3c: the way in is dated on the trip's first day, but the G7501 runs
     on the second — judged by the move's date, Mar 20 would read it as done */
  it('judges a move that spans two days by its last leg: the way in is today on 20 Mar, done on the 21st', () => {
    const inOn = (now: string) => check(now).rows[0] as LegCheck;
    expect(inOn('2027-03-19')).toMatchObject({ today: true, past: false });
    expect(inOn('2027-03-20')).toMatchObject({ today: true, past: false });
    expect(inOn('2027-03-21')).toMatchObject({ today: false, past: true });
    /* …and the way home, AY 9070 on the 17th then AY 1506 on the 18th */
    const home = (now: string) => check(now).rows.at(-1) as LegCheck;
    expect(home('2027-04-18')).toMatchObject({ today: true, past: false });
    expect(home('2027-04-19')).toMatchObject({ today: false, past: true });
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
    const { rows } = check('2027-03-01');
    const plan = relayPlan(rows.map((r) => r.tone));
    expect(plan.steps.length).toBe(rows.length);
    expect(plan.counts.crit).toBe(0);
    /* the three legs still to book; every bed is held (the walk-in is green) */
    expect(plan.counts.warn).toBe(3);
    /* with the two holes: the missing bed is the one red row, and the Apr 7 gap one more amber */
    const was = relayPlan(checkBefore('2027-03-01').rows.map((r) => r.tone));
    expect(was.counts.crit).toBe(1);
    expect(was.counts.warn).toBe(4);
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

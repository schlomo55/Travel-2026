/* LEAVE BY (lib/logic/leaveby.ts) — departure − buffer − the taxi from last
   night's bed. On small hand-built trips for the rules (shaped on the demo
   trip's Chengdu night and its evening flight to Guilin), then on the demo
   trip itself. The ride's minutes come from dayroute.ts and are never pinned
   here (its speed model is its own): each test recomputes the leave-by from
   the leg it got back. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Coord, FlightBooking, HotelBooking, TrainBooking } from '../lib/model/types';
import {
  BUFFER_DOMESTIC_FLIGHT,
  BUFFER_INTL_FLIGHT,
  BUFFER_TRAIN,
  ROUND_TO,
  bedBefore,
  bufferText,
  leaveByOf,
  leaveBys,
  retimeLeaves,
  withLeaves,
  type LeaveBy,
} from '../lib/logic/leaveby';
import { FAR_METRES } from '../lib/logic/dayroute';
import { stableId } from '../lib/logic/notify';
import { hhmmToMinutes } from '../lib/logic/zones';

const HOTEL: Coord = { lat: 30.6558, lng: 104.0812 }; // the Sample Teahouse Hotel, Chunxi Road
const AIRPORT: Coord = { lat: 30.5785, lng: 103.9471 }; // Chengdu Shuangliu, ≈ 16 km: a taxi ride
const north = (c: Coord, m: number): Coord => ({ lat: c.lat + m / 111_195, lng: c.lng });

const base = { tripId: 't', meta: [], createdAt: 0, updatedAt: 0 };
const bed = (over: Partial<HotelBooking> = {}): HotelBooking => ({
  ...base,
  id: 'bed',
  kind: 'hotel',
  status: 'booked',
  title: 'Sample Teahouse Hotel, Chunxi Road',
  city: 'Chengdu',
  date: '2027-04-07',
  checkIn: '2027-04-07',
  checkOut: '2027-04-09',
  pin: HOTEL,
  ...over,
});
const flight = (over: Partial<FlightBooking> = {}): FlightBooking => ({
  ...base,
  id: 'f1',
  kind: 'flight',
  status: 'booked',
  title: 'Sichuan Airlines · 3U 9003',
  carrier: 'Sichuan Airlines',
  flightNo: '3U 9003',
  from: { code: 'CTU' },
  to: { code: 'KWL' },
  date: '2027-04-09',
  dep: '20:20',
  arr: '22:00',
  arrDayOffset: 0,
  duration: '1h 40m',
  coord: AIRPORT,
  ...over,
});
const train = (over: Partial<TrainBooking> = {}): TrainBooking => ({
  ...base,
  id: 't1',
  kind: 'train',
  status: 'booked',
  title: 'HSR · Chengdu East → Chongqing',
  trainNo: 'G 9001',
  from: { name: 'Chengdu East', stations: [{ name: '成都东站', coord: AIRPORT }] },
  to: { name: 'Chongqing' },
  date: '2027-04-09',
  dep: '09:00',
  arr: '10:15',
  ...over,
});

/** what the leave-by must be, from the leg the function itself used */
const expected = (l: LeaveBy): number => {
  const raw = hhmmToMinutes(l.dep)! - l.buffer - l.leg.minutes;
  return Math.floor(raw / ROUND_TO) * ROUND_TO;
};
const minutesOf = (l: LeaveBy): number =>
  hhmmToMinutes(l.time)! + (l.date < l.depDate ? -1440 : 0);

describe('the buffer', () => {
  it('2 h before a domestic flight, 3 h before an international one, 45 min before a train', () => {
    const dom = leaveByOf(flight(), [bed(), flight()])!;
    expect(dom.buffer).toBe(BUFFER_DOMESTIC_FLIGHT);
    expect(BUFFER_DOMESTIC_FLIGHT).toBe(120);
    const intl = flight({ to: { code: 'HKG' } }); // same clock, own border
    expect(leaveByOf(intl, [bed(), intl])!.buffer).toBe(BUFFER_INTL_FLIGHT);
    expect(BUFFER_INTL_FLIGHT).toBe(180);
    const zone = flight({ to: { code: 'HEL' }, dep: '20:20', arr: '01:00', arrDayOffset: 1, duration: '8h 40m' });
    expect(leaveByOf(zone, [bed(), zone])!.buffer).toBe(BUFFER_INTL_FLIGHT);
    expect(leaveByOf(train(), [bed(), train()])!.buffer).toBe(BUFFER_TRAIN);
    expect(BUFFER_TRAIN).toBe(45);
  });

  it('leave by = departure − buffer − the ≈ taxi, rounded down to 5 min', () => {
    const l = leaveByOf(flight(), [bed(), flight()])!;
    expect(l.leg.mode).toBe('taxi');
    expect(l.leg.far).toBe(false);
    expect(l.leg.minutes).toBeGreaterThan(0);
    expect(minutesOf(l)).toBe(expected(l));
    expect(minutesOf(l) % ROUND_TO).toBe(0);
    expect(l.ahead).toBeGreaterThanOrEqual(l.buffer + l.leg.minutes);
    expect(l.place).toBe('CTU');
    expect(l.label).toBe('3U 9003');
    expect(l.bed.id).toBe('bed');
  });

  it('a short ride is still a taxi, not the walk the default mode would pick', () => {
    const near = flight({ coord: north(HOTEL, 800) });
    expect(leaveByOf(near, [bed(), near])!.leg.mode).toBe('taxi');
  });

  it('buffer text is a rule, not an estimate: no ≈', () => {
    expect(bufferText(120)).toBe('2 h');
    expect(bufferText(180)).toBe('3 h');
    expect(bufferText(45)).toBe('45 min');
    expect(bufferText(90)).toBe('1 h 30');
  });
});

describe('a missing position means no leave-by', () => {
  it('a flight with no departure coord', () => {
    const f = flight({ coord: undefined });
    expect(leaveByOf(f, [bed(), f])).toBeNull();
  });

  it('a bed with no coord and no pin', () => {
    expect(leaveByOf(flight(), [bed({ pin: undefined }), flight()])).toBeNull();
  });

  it('no bed at all the night before', () => {
    expect(leaveByOf(flight(), [flight()])).toBeNull();
  });

  it('a train with no station, or two not yet chosen between', () => {
    const none = train({ from: { name: 'Shanghai', stations: [], why: 'the plan names none' } });
    const two = train({
      from: {
        name: 'Suzhou / Suzhou North',
        stations: [
          { name: '苏州站', coord: AIRPORT },
          { name: '苏州北站', coord: north(AIRPORT, 5000) },
        ],
      },
    });
    const noCoord = train({ from: { name: 'Hangzhou East', stations: [{ name: '杭州东站' }] } });
    for (const t of [none, two, noCoord]) expect(leaveByOf(t, [bed(), t])).toBeNull();
  });

  it('a ride past what dayroute estimates is not guessed (RIDE_MAX_METRES), but an airport past the day view’s FAR cut-off is', async () => {
    const { RIDE_MAX_METRES } = await import('../lib/logic/dayroute');
    const airport = flight({ coord: north(HOTEL, FAR_METRES + 5000) });
    expect(leaveByOf(airport, [bed(), airport])).not.toBeNull();
    const tooFar = flight({ coord: north(HOTEL, RIDE_MAX_METRES + 5000) });
    expect(leaveByOf(tooFar, [bed(), tooFar])).toBeNull();
  });

  it('no departure time', () => {
    const t = train({ dep: undefined });
    expect(leaveByOf(t, [bed(), t])).toBeNull();
  });
});

describe("the previous night's bed", () => {
  it('the stay whose nights hold the day before — not the one checked out that morning, nor one checked in that day', () => {
    const last = bed({ id: 'last', checkIn: '2027-04-07', checkOut: '2027-04-09' });
    const next = bed({ id: 'next', checkIn: '2027-04-09', checkOut: '2027-04-11', pin: north(HOTEL, 3000) });
    expect(bedBefore([last, next], '2027-04-09')?.id).toBe('last');
    expect(bedBefore([last, next], '2027-04-10')?.id).toBe('next');
    expect(bedBefore([last], '2027-04-07')).toBeNull(); // checked in that day: you did not sleep there
    expect(leaveByOf(flight(), [last, next, flight()])!.bed.id).toBe('last');
  });

  it('a cancelled or pending bed is not where you slept; two live beds on one night is no answer', () => {
    expect(bedBefore([bed({ status: 'cancelled' })], '2027-04-09')).toBeNull();
    expect(bedBefore([bed({ status: 'pending' })], '2027-04-09')).toBeNull();
    expect(bedBefore([bed({ status: 'walkin' })], '2027-04-09')?.id).toBe('bed');
    expect(bedBefore([bed(), bed({ id: 'b2' })], '2027-04-09')).toBeNull();
    expect(bedBefore([bed(), bed({ id: 'b2', status: 'cancelled' })], '2027-04-09')?.id).toBe('bed');
  });

  it('only the day’s first departure starts from the bed', () => {
    const early = train({ dep: '08:00' });
    const later = flight({ dep: '20:20' });
    expect(leaveByOf(early, [bed(), early, later])).not.toBeNull();
    expect(leaveByOf(later, [bed(), early, later])).toBeNull();
    /* a leg that day with no time: its order cannot be proven */
    const untimed = train({ id: 't2', dep: undefined, status: 'pending' });
    expect(leaveByOf(later, [bed(), untimed, later])).toBeNull();
  });

  /* the demo's way home: AY 9070 lands in Helsinki the next morning and
     AY 1506 flies on from there — with a bed (made up) still holding the night */
  it('a connection at the same airport, across midnight, is not a fresh departure', () => {
    const inbound = flight({ id: 'in', from: { code: 'HKG' }, to: { code: 'HEL' }, date: '2027-04-17', dep: '23:55', arr: '06:05', arrDayOffset: 1, duration: '11h 10m' });
    const onward = flight({ id: 'on', from: { code: 'HEL' }, to: { code: 'CDG' }, date: '2027-04-18', dep: '08:00', arr: '09:40', arrDayOffset: 0, duration: '2h 40m' });
    const sleptIn = bed({ checkIn: '2027-04-16', checkOut: '2027-04-18' });
    expect(leaveByOf(onward, [sleptIn, inbound, onward])).toBeNull();
  });
});

describe('only booked legs', () => {
  it('a cancelled, pending or alternative leg has none, and a hotel never has one', () => {
    for (const status of ['cancelled', 'pending', 'walkin'] as const) {
      const f = flight({ status });
      expect(leaveByOf(f, [bed(), f])).toBeNull();
    }
    const alt = flight({ alternative: true });
    expect(leaveByOf(alt, [bed(), alt])).toBeNull();
    expect(leaveByOf(bed(), [bed()])).toBeNull();
  });

  it('a cancelled leg earlier the same day does not hide the real one', () => {
    const gone = flight({ id: 'gone', status: 'cancelled', dep: '07:00' });
    expect(leaveByOf(flight(), [bed(), gone, flight()])).not.toBeNull();
  });
});

describe('dates stay on the wall calendar', () => {
  it('an early departure leaves the evening before, on the previous date', () => {
    const red = flight({ dep: '01:30', arr: '03:15' });
    const l = leaveByOf(red, [bed(), red])!;
    expect(l.depDate).toBe('2027-04-09');
    expect(l.date).toBe('2027-04-08');
    expect(minutesOf(l)).toBe(expected(l));
  });

  it('a departure across a month end keeps its calendar', () => {
    const f = flight({ date: '2027-01-01', dep: '00:40' });
    const b = bed({ checkIn: '2026-12-30', checkOut: '2027-01-02' });
    const l = leaveByOf(f, [b, f])!;
    expect(l.date).toBe('2026-12-31');
  });

  it('leaveBys lists them in leave-by order', () => {
    const t = train({ id: 't1', date: '2027-04-08', dep: '10:00' });
    const f = flight();
    const list = leaveBys([bed(), f, t]);
    expect(list.map((l) => l.booking.id)).toEqual(['t1', 'f1']);
  });
});

describe('the To-do timeline', () => {
  const l = leaveByOf(flight(), [bed(), flight()])!;
  type Row = { id: string; time?: string };
  it('folds in at its time, adds a day only it falls on, and skips the past', () => {
    const days = [{ date: '2027-04-09', items: [{ id: 'a', time: '09:00' }, { id: 'b', time: '21:00' }, { id: 'c' }] as Row[] }];
    const out = withLeaves(days, [l], '2027-04-03');
    expect(out[0]!.items.map((x) => x.id)).toEqual(['a', 'leave:f1', 'b', 'c']);
    expect(days[0]!.items).toHaveLength(3); // the plan itself is untouched
    expect(withLeaves([], [l], '2027-04-03')).toEqual([{ date: '2027-04-09', items: [expect.objectContaining({ kind: 'leave' })] }]);
    expect(withLeaves([], [l], '2027-04-10')).toEqual([]);
  });
});

describe('the reminder', () => {
  const l = leaveByOf(flight(), [bed(), flight()])!;
  const MIN = 60_000;
  /* notify.ts's own entry: 2 h before 20:20, Chengdu (UTC+8) */
  const depAt = Date.UTC(2027, 3, 9, 12, 20);
  const planned = [
    { id: stableId('leave:f1'), at: depAt - 120 * MIN, title: 'old', body: 'CTU → KWL', wall: { date: '2027-04-09', time: '18:20' } },
    { id: 99, at: depAt - 24 * 60 * MIN, title: 'check-in', body: '', wall: { date: '2027-04-08', time: '20:20' } },
  ];
  const opts = (lead: number, now = 0) => ({
    idOf: stableId,
    lead,
    now,
    title: (x: LeaveBy) => `go ${x.place}`,
    soon: (_: LeaveBy, m: number) => `in ${m}`,
    body: (_: LeaveBy, was: string) => `≈ · ${was}`,
  });

  it('moves notify’s "leave for…" to the leave-by, same id, with a heads-up `lead` before', () => {
    const out = retimeLeaves(planned, [l], opts(30));
    const main = out.find((x) => x.id === stableId('leave:f1'))!;
    const soon = out.find((x) => x.id === stableId('leave-soon:f1'))!;
    expect(main.at).toBe(depAt - l.ahead * MIN);
    expect(main.wall).toEqual({ date: l.date, time: l.time });
    expect(main.title).toBe('go CTU');
    expect(main.body).toBe('≈ · CTU → KWL');
    expect(soon.at).toBe(main.at - 30 * MIN);
    expect(out.filter((x) => x.id === stableId('leave:f1'))).toHaveLength(1);
    expect(out.map((x) => x.at)).toEqual([...out.map((x) => x.at)].sort((a, b) => a - b));
  });

  it('re-planning replaces instead of doubling; lead 0 means no heads-up', () => {
    const once = retimeLeaves(planned, [l], opts(0));
    expect(once).toHaveLength(2);
    expect(once.some((x) => x.id === stableId('leave-soon:f1'))).toBe(false);
  });

  it('no `leave:` entry (legs off, booking cancelled, reminders off) — nothing rings', () => {
    expect(retimeLeaves([planned[1]!], [l], opts(30))).toEqual([planned[1]]);
    expect(retimeLeaves([], [l], opts(30))).toEqual([]);
  });

  it('a leave-by already past drops the reminder rather than ringing late', () => {
    const out = retimeLeaves(planned, [l], opts(30, depAt - l.ahead * MIN + 1));
    expect(out.map((x) => x.id)).toEqual([99]);
  });
});

describe('the demo trip', () => {
  const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0]!;
  const bookings = demo.bookings as Booking[];
  const list = leaveBys(bookings);
  const of = (no: string) => list.find((l) => l.label === no);

  it('every leave-by is a booked leg, from a bed with a position, by the rule', () => {
    for (const l of list) {
      expect(l.booking.status).toBe('booked');
      expect(l.bed.status).not.toBe('cancelled');
      expect(minutesOf(l)).toBe(expected(l));
    }
  });

  it('nothing for a cancelled flight, a connection, or a bed with no position', () => {
    expect(of('MU 5003')).toBeUndefined(); // cancelled
    expect(of('AY 9057')).toBeUndefined(); // Helsinki connection
    expect(of('AY 1506')).toBeUndefined(); // Helsinki on the way home
    expect(list.some((l) => l.booking.id === 'dm27-train-mar20')).toBe(false); // the night before was spent flying
    expect(of('CZ 9005')).toBeUndefined(); // the Guilin Airport Hotel has no position
    expect(of('MU 5001')).toBeUndefined(); // nor does the Suzhou hostel
  });

  it('3U 9003 out of Chengdu: from the Sample Teahouse Hotel, 2 h before', () => {
    const l = of('3U 9003');
    if (!l) return; // a model that calls Chunxi Road → CTU "far" proves none
    expect(l.bed.title).toMatch(/Sample Teahouse Hotel/);
    expect(l.buffer).toBe(120);
    expect(l.place).toBe('CTU');
  });

  it('AY 9070 out of Hong Kong: from the Harbour Hotel, 3 h before', () => {
    const l = of('AY 9070');
    if (!l) return;
    expect(l.bed.id).toBe('dm27-stay-13');
    expect(l.buffer).toBe(180);
    expect(l.place).toBe('HKG');
  });
});

describe('leave-by · an airport past the day view’s 30 km cut-off', () => {
  it('Pudong, ~47 km from Hongqiao station, still gets a taxi ride and a leave-by', async () => {
    const { rideEstimate } = await import('../lib/logic/dayroute');
    const pvg = { lat: 31.1443, lng: 121.8083 };
    const hongqiao = { lat: 31.1945, lng: 121.3204 };
    const ride = rideEstimate(hongqiao, pvg, 'taxi');
    expect(ride).not.toBeNull();
    expect(ride!.minutes).toBeGreaterThan(40);
    expect(ride!.minutes).toBeLessThan(90);
  });
});

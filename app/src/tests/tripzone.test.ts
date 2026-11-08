/* THE TRAVELLER'S CLOCK (Reminders, Part 1) — a wall-clock time in the trip
   becomes the right instant whether the phone is still in Paris, already in
   Shanghai, or in the air between them. Pinned on the demo trip's legs:
   Paris → Helsinki → Shanghai out, Hong Kong → Helsinki → Paris home, every
   mainland leg and the hop to Hong Kong on +8 between. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking } from '../lib/model/types';
import { instantAt, instantFor, legShift, offsetFor, zoneLegs, zonePlan, type OffsetAt } from '../lib/logic/tripzone';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const bookings = demo.bookings;

/* Paris: CEST (+2) until 01:00 UTC on Sunday 25 Oct 2026, CET (+1) through
   the winter, CEST again from 01:00 UTC on Sunday 28 Mar 2027 — mid-trip. */
const PARIS_DST_END = Date.UTC(2026, 9, 25, 1, 0);
const PARIS_DST_START = Date.UTC(2027, 2, 28, 1, 0);
const paris: OffsetAt = (ms) => (ms < PARIS_DST_END ? 120 : ms < PARIS_DST_START ? 60 : 120);
const shanghai: OffsetAt = () => 480;
const helsinki: OffsetAt = () => 120;
const utc = (y: number, mo: number, d: number, h: number, mi = 0): number => Date.UTC(y, mo - 1, d, h, mi);

describe('the legs and their shifts', () => {
  it('reads the Finnair shifts from the printed durations, and 0 for every mainland leg', () => {
    const f = (no: string): Booking => bookings.find((b) => b.kind === 'flight' && b.flightNo === no)!;
    expect(legShift(f('AY 1501'))).toBe(60); // CDG → HEL, +1 → +2 in March
    expect(legShift(f('AY 9057'))).toBe(360); // HEL → PVG, +2 → +8
    expect(legShift(f('MU 5001'))).toBe(0);
    expect(legShift(f('3U 9001'))).toBe(0);
    expect(legShift(f('CZ 9005'))).toBe(0); // Guilin → Hong Kong, both +8
    expect(legShift(f('AY 9070'))).toBe(-300); // HKG → HEL, +8 → +3 in April
    expect(legShift(f('AY 1506'))).toBe(-60); // HEL → CDG, +3 → +2
  });

  it('leaves out cancelled legs and alternatives, and sorts by departure', () => {
    const legs = zoneLegs(bookings);
    const sorted = [...legs].sort((a, b) => (a.date + a.dep < b.date + b.dep ? -1 : 1));
    expect(legs).toEqual(sorted);
    const alt = bookings.filter((b) => b.alternative).length;
    expect(alt).toBeGreaterThan(0);
    expect(bookings.some((b) => b.status === 'cancelled' && b.kind === 'flight')).toBe(true);
    expect(legs.length).toBeLessThan(bookings.filter((b) => ['flight', 'train', 'other'].includes(b.kind)).length);
  });

  it('breaks the chain at a flight whose duration cannot be proven', () => {
    const f = bookings.find((b) => b.kind === 'flight' && b.flightNo === 'AY 9057')!;
    expect(legShift({ ...f, duration: '~7 h' } as Booking)).toBeNull();
  });
});

describe('scheduled from home, in October', () => {
  const plan = zonePlan(bookings, utc(2026, 10, 1, 9), paris);

  it('20 Oct 10:00, still before the clocks go back: Paris summer time', () => {
    expect(offsetFor(plan, '2026-10-20', '10:00')).toBe(120);
    expect(instantFor(plan, '2026-10-20', '10:00')).toBe(utc(2026, 10, 20, 8));
  });

  it('19 Mar, AY1501 at 11:05: Paris winter time, even though it was summer time when this was planned', () => {
    expect(offsetFor(plan, '2027-03-19', '11:05')).toBe(60);
  });

  it('10 Mar 19:00, the dress rehearsal alarm: still home, Paris winter time', () => {
    expect(offsetFor(plan, '2027-03-10', '19:00')).toBe(60);
    expect(instantFor(plan, '2027-03-10', '19:00')).toBe(utc(2027, 3, 10, 18));
  });

  it('20 Mar 09:30, on Line 2 out of Pudong: Shanghai time, not Paris', () => {
    expect(offsetFor(plan, '2027-03-20', '09:30')).toBe(480);
    expect(instantFor(plan, '2027-03-20', '09:30')).toBe(utc(2027, 3, 20, 1, 30));
  });

  it('in the air on AY9057 the traveller already lives in the arrival zone', () => {
    expect(offsetFor(plan, '2027-03-20', '08:30')).toBe(480);
  });

  it('the legs inside China and to Hong Kong stay on +8', () => {
    expect(offsetFor(plan, '2027-03-20', '15:00')).toBe(480);
    expect(offsetFor(plan, '2027-04-09', '20:20')).toBe(480);
    expect(offsetFor(plan, '2027-04-13', '13:50')).toBe(480);
    expect(offsetFor(plan, '2027-04-17', '19:30')).toBe(480);
  });

  it('the way home: Helsinki for AY1506, then Paris — on summer time by now', () => {
    expect(offsetFor(plan, '2027-04-18', '06:30')).toBe(180);
    expect(offsetFor(plan, '2027-04-18', '12:00')).toBe(120);
  });
});

describe('the same plan made on the road', () => {
  it('from Shanghai on 25 Mar: the same instants', () => {
    const home = zonePlan(bookings, utc(2026, 10, 1, 9), paris);
    const road = zonePlan(bookings, utc(2027, 3, 25, 2), shanghai);
    for (const [d, t] of [
      ['2027-04-09', '20:20'],
      ['2027-04-13', '13:50'],
      ['2027-04-18', '06:30'],
      ['2027-04-18', '12:00'],
    ] as const) {
      expect(instantFor(road, d, t)).toBe(instantFor(home, d, t));
    }
  });

  it('from Helsinki in transit on 19 Mar: Shanghai still +8, Paris behind', () => {
    const transit = zonePlan(bookings, utc(2027, 3, 19, 15), helsinki);
    expect(offsetFor(transit, '2027-03-20', '09:30')).toBe(480);
    expect(offsetFor(transit, '2027-04-18', '12:00')).toBe(120);
  });
});

describe('when the chain cannot be proven', () => {
  it('moments beyond an unprovable flight return null', () => {
    const broken = bookings.map((b) =>
      b.kind === 'flight' && b.flightNo === 'AY 9057' ? ({ ...b, duration: undefined } as Booking) : b,
    );
    const plan = zonePlan(broken, utc(2026, 10, 1, 9), paris);
    expect(offsetFor(plan, '2027-03-19', '11:05')).toBe(60);
    expect(offsetFor(plan, '2027-03-20', '09:30')).toBeNull();
    expect(instantFor(plan, '2027-03-20', '09:30')).toBeNull();
  });

  it('a trip with no legs follows the phone', () => {
    const plan = zonePlan([], utc(2026, 10, 1, 9), paris);
    expect(offsetFor(plan, '2026-10-12', '10:00')).toBe(120);
    expect(offsetFor(plan, '2026-11-12', '10:00')).toBe(60);
  });
});

describe('instantAt', () => {
  it('turns a wall-clock time into an instant', () => {
    expect(instantAt('2027-04-09', '20:20', 480)).toBe(utc(2027, 4, 9, 12, 20));
  });
});

/* THE PHONE'S CLOCK LAGS IN THE AIR (review, 29 Sep): mid-flight and just
   after landing the phone still shows the zone it left. With no remembered
   home offset the plan must still land on Shanghai, never on the post-trip
   segment; with one, the phone's clock does not matter at all. */
describe('the phone in the air, or just landed', () => {
  const hk: OffsetAt = () => 480;
  const at = (plan: ReturnType<typeof zonePlan>) => offsetFor(plan, '2027-03-20', '09:30');

  it('1 h into AY9057 with the phone still on Helsinki time', () => {
    expect(at(zonePlan(bookings, utc(2027, 3, 19, 16, 30), helsinki))).toBe(480);
  });

  it('landed at Pudong before Android moved the clock', () => {
    expect(at(zonePlan(bookings, utc(2027, 3, 20, 0, 55), helsinki))).toBe(480);
  });

  it('in China on 8 Apr with a flight behind you whose duration was lost', () => {
    const broken = bookings.map((b) =>
      b.kind === 'flight' && b.flightNo === 'MU 5001' ? ({ ...b, duration: undefined } as Booking) : b,
    );
    const plan = zonePlan(broken, utc(2027, 4, 8, 2), shanghai);
    expect(offsetFor(plan, '2027-04-13', '13:50')).toBe(480);
  });

  it('2 h into AY9070 with the phone still on Hong Kong time', () => {
    const plan = zonePlan(bookings, utc(2027, 4, 17, 17, 55), hk);
    expect(offsetFor(plan, '2027-04-18', '06:30')).toBe(180);
    expect(offsetFor(plan, '2027-04-18', '12:00')).toBe(120);
  });

  it('at home the plan hands back the home offset to remember, and a remembered one wins on the road', () => {
    const home = zonePlan(bookings, utc(2026, 10, 1, 9), paris);
    expect(home.homeAnchor).toEqual({ firstDep: '2027-03-19 11:05', offset: 60 });
    const liar: OffsetAt = () => -300; // a phone set to New York by mistake
    const road = zonePlan(bookings, utc(2027, 3, 25, 2), liar, home.homeAnchor);
    expect(offsetFor(road, '2027-04-09', '20:20')).toBe(480);
    expect(road.homeAnchor).toBeNull();
  });

  it('a remembered offset for another first departure is ignored', () => {
    const road = zonePlan(bookings, utc(2027, 3, 25, 2), shanghai, { firstDep: '2027-03-18 09:00', offset: 0 });
    expect(offsetFor(road, '2027-04-09', '20:20')).toBe(480);
  });
});

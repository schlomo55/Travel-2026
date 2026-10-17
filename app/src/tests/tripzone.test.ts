/* THE TRAVELLER'S CLOCK (Reminders, Part 1) — a wall-clock time in the trip
   becomes the right instant whether the phone is still in Tel Aviv, already
   in Beijing, or in the air between them. Pinned on the real China legs. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking } from '../lib/model/types';
import { instantAt, instantFor, legShift, offsetFor, zoneLegs, zonePlan, type OffsetAt } from '../lib/logic/tripzone';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const bookings = china.bookings;

/* Israel: IDT (+3) until 02:00 on Sunday 25 Oct 2026, IST (+2) after. */
const ISRAEL_DST_END = Date.UTC(2026, 9, 24, 23, 0);
const israel: OffsetAt = (ms) => (ms < ISRAEL_DST_END ? 180 : 120);
const beijing: OffsetAt = () => 480;
const abuDhabi: OffsetAt = () => 240;
const utc = (y: number, mo: number, d: number, h: number, mi = 0): number => Date.UTC(y, mo - 1, d, h, mi);

describe('the legs and their shifts', () => {
  it('reads the Etihad shifts from the printed durations, and 0 for every mainland leg', () => {
    const f = (no: string): Booking => bookings.find((b) => b.kind === 'flight' && b.flightNo === no)!;
    expect(legShift(f('EY 608'))).toBe(120); // TLV → AUH
    expect(legShift(f('EY 888'))).toBe(240); // AUH → PKX
    expect(legShift(f('CA 8641'))).toBe(0);
    expect(legShift(f('3U 8011'))).toBe(0);
    expect(legShift(f('EY 871'))).toBe(-240); // HKG → AUH
    expect(legShift(f('EY 609'))).toBe(-120); // AUH → TLV
  });

  it('leaves out cancelled legs and alternatives, and sorts by departure', () => {
    const legs = zoneLegs(bookings);
    const sorted = [...legs].sort((a, b) => (a.date + a.dep < b.date + b.dep ? -1 : 1));
    expect(legs).toEqual(sorted);
    const alt = bookings.filter((b) => b.alternative).length;
    expect(alt).toBeGreaterThan(0);
    expect(legs.length).toBeLessThan(bookings.filter((b) => ['flight', 'train', 'other'].includes(b.kind)).length);
  });

  it('breaks the chain at a flight whose duration cannot be proven', () => {
    const f = bookings.find((b) => b.kind === 'flight' && b.flightNo === 'EY 888')!;
    expect(legShift({ ...f, duration: '~7 h' } as Booking)).toBeNull();
  });
});

describe('scheduled from home, in October', () => {
  const plan = zonePlan(bookings, utc(2026, 10, 1, 9), israel);

  /* The cash alarm was 12 Oct 10:00 ("buy the dollars") until 2026-10-17;
     the owner's 15 Oct plan orders them on Oct 17 and collects them at Ben
     Gurion T3 on Nov 21, 12:00 — still home, two hours before EY608. */
  it('17 Oct 10:00, order the dollars: Israel summer time', () => {
    expect(offsetFor(plan, '2026-10-17', '10:00')).toBe(180);
    expect(instantFor(plan, '2026-10-17', '10:00')).toBe(utc(2026, 10, 17, 7));
  });

  it('21 Nov, EY608 at 14:00: Israel winter time, even though it was October when this was planned', () => {
    expect(offsetFor(plan, '2026-11-21', '14:00')).toBe(120);
  });

  it('21 Nov 12:00, the dollars picked up at Ben Gurion T3: still home, Israel winter time', () => {
    expect(offsetFor(plan, '2026-11-21', '12:00')).toBe(120);
    expect(instantFor(plan, '2026-11-21', '12:00')).toBe(utc(2026, 11, 21, 10));
  });

  it('22 Nov 09:30, the Daxing exchange: Beijing time, not Tel Aviv', () => {
    expect(offsetFor(plan, '2026-11-22', '09:30')).toBe(480);
    expect(instantFor(plan, '2026-11-22', '09:30')).toBe(utc(2026, 11, 22, 1, 30));
  });

  it('in the air on EY888 the traveller already lives in the arrival zone', () => {
    expect(offsetFor(plan, '2026-11-22', '08:30')).toBe(480);
  });

  it('the legs inside China and to Hong Kong stay on +8', () => {
    expect(offsetFor(plan, '2026-11-22', '15:00')).toBe(480);
    expect(offsetFor(plan, '2026-12-10', '19:45')).toBe(480);
    expect(offsetFor(plan, '2026-12-21', '13:50')).toBe(480);
    expect(offsetFor(plan, '2026-12-26', '19:35')).toBe(480);
  });

  it('the way home: Abu Dhabi for EY609, then Israel', () => {
    expect(offsetFor(plan, '2026-12-27', '02:45')).toBe(240);
    expect(offsetFor(plan, '2026-12-27', '09:00')).toBe(120);
  });
});

describe('the same plan made on the road', () => {
  it('from Beijing on 25 Nov: the same instants', () => {
    const home = zonePlan(bookings, utc(2026, 10, 1, 9), israel);
    const road = zonePlan(bookings, utc(2026, 11, 25, 2), beijing);
    for (const [d, t] of [
      ['2026-12-10', '19:45'],
      ['2026-12-21', '13:50'],
      ['2026-12-27', '02:45'],
      ['2026-12-27', '09:00'],
    ] as const) {
      expect(instantFor(road, d, t)).toBe(instantFor(home, d, t));
    }
  });

  it('from Abu Dhabi in transit on 21 Nov: Beijing still +8, Tel Aviv behind', () => {
    const transit = zonePlan(bookings, utc(2026, 11, 21, 16), abuDhabi);
    expect(offsetFor(transit, '2026-11-22', '09:30')).toBe(480);
    expect(offsetFor(transit, '2026-12-27', '09:00')).toBe(120);
  });
});

describe('when the chain cannot be proven', () => {
  it('moments beyond an unprovable flight return null', () => {
    const broken = bookings.map((b) =>
      b.kind === 'flight' && b.flightNo === 'EY 888' ? ({ ...b, duration: undefined } as Booking) : b,
    );
    const plan = zonePlan(broken, utc(2026, 10, 1, 9), israel);
    expect(offsetFor(plan, '2026-11-21', '14:00')).toBe(120);
    expect(offsetFor(plan, '2026-11-22', '09:30')).toBeNull();
    expect(instantFor(plan, '2026-11-22', '09:30')).toBeNull();
  });

  it('a trip with no legs follows the phone', () => {
    const plan = zonePlan([], utc(2026, 10, 1, 9), israel);
    expect(offsetFor(plan, '2026-10-12', '10:00')).toBe(180);
    expect(offsetFor(plan, '2026-11-12', '10:00')).toBe(120);
  });
});

describe('instantAt', () => {
  it('turns a wall-clock time into an instant', () => {
    expect(instantAt('2026-12-10', '19:45', 480)).toBe(utc(2026, 12, 10, 11, 45));
  });
});

/* THE PHONE'S CLOCK LAGS IN THE AIR (review, 29 Sep): mid-flight and just
   after landing the phone still shows the zone it left. With no remembered
   home offset the plan must still land on Beijing, never on the post-trip
   segment; with one, the phone's clock does not matter at all. */
describe('the phone in the air, or just landed', () => {
  const auh: OffsetAt = () => 240;
  const bj: OffsetAt = () => 480;
  const at = (plan: ReturnType<typeof zonePlan>) => offsetFor(plan, '2026-11-22', '09:30');

  it('1 h into EY888 with the phone still on Abu Dhabi time', () => {
    expect(at(zonePlan(bookings, utc(2026, 11, 21, 18, 20), auh))).toBe(480);
  });

  it('landed at Daxing before Android moved the clock', () => {
    expect(at(zonePlan(bookings, utc(2026, 11, 22, 2, 45), auh))).toBe(480);
  });

  it('in China on 1 Dec with a flight whose duration was lost', () => {
    const broken = bookings.map((b) =>
      b.kind === 'flight' && b.flightNo === 'CA 8641' ? ({ ...b, duration: undefined } as Booking) : b,
    );
    const plan = zonePlan(broken, utc(2026, 12, 1, 2), bj);
    expect(offsetFor(plan, '2026-12-10', '19:45')).toBe(480);
  });

  it('2 h into EY871 with the phone still on Hong Kong time', () => {
    const plan = zonePlan(bookings, utc(2026, 12, 26, 13, 35), bj);
    expect(offsetFor(plan, '2026-12-27', '02:45')).toBe(240);
    expect(offsetFor(plan, '2026-12-27', '09:00')).toBe(120);
  });

  it('at home the plan hands back the home offset to remember, and a remembered one wins on the road', () => {
    const home = zonePlan(bookings, utc(2026, 10, 1, 9), israel);
    expect(home.homeAnchor).toEqual({ firstDep: '2026-11-21 14:00', offset: 120 });
    const liar: OffsetAt = () => -300; // a phone set to New York by mistake
    const road = zonePlan(bookings, utc(2026, 11, 25, 2), liar, home.homeAnchor);
    expect(offsetFor(road, '2026-12-10', '19:45')).toBe(480);
    expect(road.homeAnchor).toBeNull();
  });

  it('a remembered offset for another first departure is ignored', () => {
    const road = zonePlan(bookings, utc(2026, 11, 25, 2), bj, { firstDep: '2026-11-20 09:00', offset: 0 });
    expect(offsetFor(road, '2026-12-10', '19:45')).toBe(480);
  });
});

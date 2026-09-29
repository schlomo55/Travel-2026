import { describe, expect, it } from 'vitest';
import {
  commitmentAt,
  countdownLabel,
  nextCommitment,
  nightInTransit,
  spansNight,
  whenLabel,
} from '../lib/logic/commitment';
import type { Booking, HotelBooking } from '../lib/model/types';

/* Fixed dates only. A countdown tested against `Date.now()` passes at 09:00 and
   fails at 23:00, which is the one time of day this app is actually read. */

const flight = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'f1',
    tripId: 't',
    kind: 'flight',
    status: 'booked',
    title: 'China Eastern · MU 733',
    date: '2026-12-21',
    carrier: 'China Eastern',
    flightNo: 'MU 733',
    from: { code: 'KMG' },
    to: { code: 'HKG' },
    dep: '13:50',
    arr: '16:05',
    arrDayOffset: 0,
    meta: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Booking;

const train = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'r1',
    tripId: 't',
    kind: 'train',
    status: 'pending',
    title: 'HSR · Dali → Kunming',
    date: '2026-12-20',
    from: { name: 'Dali' },
    to: { name: 'Kunming South' },
    meta: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Booking;

const stay = (over: Partial<HotelBooking> = {}): HotelBooking => ({
  id: 'h1',
  tripId: 't',
  kind: 'hotel',
  status: 'booked',
  title: 'The Royal Garden, TST East',
  city: 'Hong Kong',
  date: '2026-12-21',
  checkIn: '2026-12-21',
  checkOut: '2026-12-26',
  meta: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const ticket = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'a1',
    tripId: 't',
    kind: 'activity',
    status: 'booked',
    title: 'HK Phil · Festive Cadenza',
    date: '2026-12-22',
    meta: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Booking;

/** A local wall-clock moment, built the way dates.ts insists on. */
const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min, 0, 0);

describe('nextCommitment', () => {
  it('picks the soonest leg still ahead', () => {
    const c = nextCommitment([flight(), train()], '2026-12-19');
    expect(c?.booking.id).toBe('r1');
    expect(c?.kind).toBe('leg');
  });

  it('ignores legs that are already behind', () => {
    const c = nextCommitment([train(), flight()], '2026-12-21');
    expect(c?.booking.id).toBe('f1');
  });

  it('returns null when nothing timed is left', () => {
    expect(nextCommitment([flight(), train()], '2026-12-22')).toBeNull();
  });

  it('skips a cancelled leg', () => {
    const c = nextCommitment([train({ status: 'cancelled' }), flight()], '2026-12-19');
    expect(c?.booking.id).toBe('f1');
  });

  it('skips the `alternative` half of an either/or move', () => {
    /* Nov 22 is a flight to Yantai OR ELSE the HSR. Without this the train he
       is not catching wins the top of the home screen. */
    const c = nextCommitment(
      [train({ id: 'alt', date: '2026-12-19', alternative: true }), flight()],
      '2026-12-19',
    );
    expect(c?.booking.id).toBe('f1');
  });

  it('is about legs and beds, never about tickets', () => {
    /* A concert is a dated booking too; letting one answer "what is next" would
       push the flight you are actually catching off the screen. */
    const c = nextCommitment([ticket({ date: '2026-12-19' }), flight()], '2026-12-19');
    expect(c?.booking.id).toBe('f1');
  });

  it('picks a check-in when it comes before the next leg', () => {
    const c = nextCommitment([flight({ date: '2026-12-26' }), stay({ checkIn: '2026-12-19' })], '2026-12-18');
    expect(c?.booking.id).toBe('h1');
    expect(c?.kind).toBe('checkin');
    expect(c?.date).toBe('2026-12-19');
    expect(c?.time).toBeNull();
  });

  it('reads a stay from its check-in day, not from its anchor date', () => {
    const c = nextCommitment([stay({ date: '2026-12-01', checkIn: '2026-12-19' })], '2026-12-19');
    expect(c?.date).toBe('2026-12-19');
  });

  it('puts the leg first when a leg and a check-in share a day', () => {
    /* Dec 21: MU 733 at 13:50 and then Hong Kong. You travel, then you arrive. */
    const c = nextCommitment([stay(), flight()], '2026-12-21');
    expect(c?.booking.id).toBe('f1');
    expect(c?.time).toBe('13:50');
  });

  it('sorts a stated clock ahead of a leg that states none on the same day', () => {
    const c = nextCommitment([train({ date: '2026-12-21' }), flight()], '2026-12-21');
    expect(c?.booking.id).toBe('f1');
  });

  /* Run 4b: '~07:30' kept its '~' and sorted after '99:99' — the stand-in
     for "no clock" — so the leg you can be late for lost to one you cannot */
  it('sorts an approximate clock as the time it gives, ahead of a leg that states none', () => {
    const c = nextCommitment([train({ date: '2026-12-21' }), train({ id: 'r2', date: '2026-12-21', dep: '~07:30' })], '2026-12-21');
    expect(c?.booking.id).toBe('r2');
    const first = nextCommitment([flight({ dep: '08:15' }), train({ id: 'r2', date: '2026-12-21', dep: '~07:30' })], '2026-12-21');
    expect(first?.booking.id).toBe('r2');
  });
});

describe('countdownLabel', () => {
  it('counts days when the moment is more than 48 h away', () => {
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 18, 9, 0))).toBe('in 3 days');
  });

  it('goes live at 47 hours', () => {
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 19, 14, 50))).toBe('in 47 h');
  });

  it('prints hours and minutes inside the window', () => {
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 21, 12, 20))).toBe('in 1 h 30 m');
  });

  it('drops the hours below one', () => {
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 21, 13, 10))).toBe('in 40 m');
  });

  it('says now on the minute it lands', () => {
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 21, 13, 50))).toBe('now');
  });

  it('returns null once the moment has passed', () => {
    /* "in -20 m" is not a countdown, and a flight that left is not something to
       count down to — the caller falls back to the day phrasing. */
    expect(countdownLabel('2026-12-21', '13:50', at(2026, 12, 21, 14, 10))).toBeNull();
  });

  it('falls back to days when the booking states no clock', () => {
    expect(countdownLabel('2026-12-21', null, at(2026, 12, 20, 23, 0))).toBe('tomorrow');
    expect(countdownLabel('2026-12-21', null, at(2026, 12, 21, 1, 0))).toBe('today');
  });

  it('builds the moment from parseYmd, never from new Date(string)', () => {
    const moment = commitmentAt('2026-12-21', '13:50');
    expect(moment?.getFullYear()).toBe(2026);
    expect(moment?.getMonth()).toBe(11);
    expect(moment?.getDate()).toBe(21);
    expect(moment?.getHours()).toBe(13);
    expect(moment?.getMinutes()).toBe(50);
  });

  it('has no moment to build without a clock', () => {
    expect(commitmentAt('2026-12-21', null)).toBeNull();
  });
});

describe('whenLabel', () => {
  it('speaks in whole days', () => {
    expect(whenLabel('2026-12-21', '2026-12-21')).toBe('today');
    expect(whenLabel('2026-12-21', '2026-12-22')).toBe('tomorrow');
    expect(whenLabel('2026-12-21', '2026-12-26')).toBe('in 5 days');
  });
});

describe('nightInTransit', () => {
  const ey888 = flight({
    id: 'ey888',
    date: '2026-11-21',
    flightNo: 'EY 888',
    from: { code: 'AUH' },
    to: { code: 'PKX' },
    dep: '21:20',
    arr: '08:45',
    arrDayOffset: 1,
  });
  const ey608 = flight({
    id: 'ey608',
    date: '2026-11-21',
    flightNo: 'EY 608',
    from: { code: 'TLV' },
    to: { code: 'AUH' },
    dep: '14:00',
    arr: '19:15',
    arrDayOffset: 0,
  });

  it('finds the leg the night is spent aboard', () => {
    expect(nightInTransit([ey608, ey888], '2026-11-21')?.id).toBe('ey888');
  });

  it('says nothing about a night with no overnight leg on it', () => {
    /* Nov 22 — the Yantai arrival night — is genuinely bedless and must stay
       loud; CA 8683 lands the same afternoon. */
    expect(nightInTransit([ey608, ey888, flight({ id: 'ca8683', date: '2026-11-22' })], '2026-11-22')).toBeNull();
  });

  it('does not let a cancelled or alternative leg carry a night', () => {
    expect(nightInTransit([flight({ ...ey888, status: 'cancelled' } as Partial<Booking>)], '2026-11-21')).toBeNull();
    expect(nightInTransit([flight({ ...ey888, alternative: true } as Partial<Booking>)], '2026-11-21')).toBeNull();
  });

  it('reads a wrapped clock on a rail or road leg as an overnight one', () => {
    expect(spansNight(train({ dep: '22:10', arr: '06:30' }))).toBe(true);
    expect(spansNight(train({ dep: '08:10', arr: '11:30' }))).toBe(false);
  });

  it('claims nothing about a leg that states neither', () => {
    /* No field, no claim: the Dali → Kunming HSR carries no clock at all. */
    expect(spansNight(train())).toBe(false);
  });

  it('never counts a bed or a ticket as a night in transit', () => {
    expect(nightInTransit([stay({ checkIn: '2026-11-21' }), ticket({ date: '2026-11-21' })], '2026-11-21')).toBeNull();
  });
});

/* THE PASS'S FIRST SCREEN (logic/passfacts.ts) — which rows of a stay's or a
   ticket's pass are its KEY FACTS, which of them need action, what may be set
   in the mono face, and which actions the booking can do. On the demo trip's
   own bookings (one of each shape) and on small hand-built ones for the
   rules; nothing here names a real booking. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Booking, HotelBooking } from '../lib/model/types';
import { passKind } from '../lib/logic/pass';
import {
  MAX_FACTS,
  dueSoon,
  isDataLike,
  looseDate,
  passActions,
  passKeyFacts,
  telHref,
} from '../lib/logic/passfacts';

const repo = join(__dirname, '..', '..', '..');
const demo = (JSON.parse(readFileSync(join(repo, 'seed', 'demo-2027.trip.json'), 'utf8')) as { trips: { bookings: Booking[] }[] })
  .trips[0]!.bookings;
const get = (id: string): Booking => {
  const b = demo.find((x) => x.id === id);
  if (!b) throw new Error(`no demo booking ${id}`);
  return b;
};
const facts = (id: string, now = '2027-03-01') => {
  const b = get(id);
  return passKeyFacts(b, passKind(b), now);
};
const byLabel = (id: string, label: string, now?: string) => facts(id, now).facts.find((f) => f.label === label);

describe('passfacts · what may be monospace', () => {
  it('codes, times, dates and amounts are; sentences are not', () => {
    for (const v of ['from 14:00', 'to Mar 27', '¥260', 'HK$5,200 (4n)', '~¥150', '20:00', 'Sat 20 Mar', '2027-03-27', '≈21:30', 'by 17:10', 'SHA'])
      expect(isDataLike(v), v).toBe(true);
    for (const v of ['cash on arrival', 'free with a booking', '≈21:30 — they know', '12:00 — the bag stays till evening', 'the school collects you here Sun 10:30', '—', ''])
      expect(isDataLike(v), v).toBe(false);
  });
});

describe('passfacts · a deadline named in a sentence', () => {
  it('reads "Mar 27", "27 Mar" and an ISO day as the latest such day not after the booking', () => {
    expect(looseDate('to Mar 27', '2027-03-29')).toBe('2027-03-27');
    expect(looseDate('free until 27th March', '2027-03-29')).toBe('2027-03-27');
    expect(looseDate('2027-03-27 18:00', '2027-03-29')).toBe('2027-03-27');
    /* a December deadline for a January stay is last year's */
    expect(looseDate('to Dec 28', '2027-01-03')).toBe('2026-12-28');
    expect(looseDate('any time', '2027-03-29')).toBeNull();
    expect(looseDate('Mar 99', '2027-03-29')).toBeNull();
  });
  it('is soon from today to seven days ahead, and not before or after', () => {
    const near = '2027-03-29';
    expect(dueSoon('to Mar 27', near, '2027-03-27')).toBe(true); // today
    expect(dueSoon('to Mar 27', near, '2027-03-20')).toBe(true); // 7 days
    expect(dueSoon('to Mar 27', near, '2027-03-19')).toBe(false); // 8 days
    expect(dueSoon('to Mar 27', near, '2027-03-28')).toBe(false); // passed
    expect(dueSoon('whenever', near, '2027-03-27')).toBe(false);
  });
});

describe('passfacts · flights, trains and road legs keep their hero', () => {
  it.each(['dm27-flight-mu5001', 'dm27-flight-ay9057', 'dm27-train-mar20', 'dm27-train-apr02', 'dm27-road-apr11'])('%s has no key facts', (id) => {
    expect(facts(id)).toEqual({ facts: [], used: [] });
  });
});

describe('passfacts · a stay', () => {
  it('says what to pay, when to arrive and where — and consumes those meta rows', () => {
    const r = facts('dm27-stay-01');
    expect(r.facts.map((f) => f.label)).toEqual(['Paid', 'Check-in', 'Pickup', 'Address']);
    const [pay, checkIn, pickup, address] = r.facts;
    expect(pay).toMatchObject({ value: '¥260', mono: true, warn: false });
    expect(checkIn).toMatchObject({ value: 'from 14:00', mono: true, warn: false, from: [0] });
    /* a sentence stays in the UI face */
    expect(pickup).toMatchObject({ mono: false, warn: false, from: [1] });
    /* the local-script address, as written */
    expect(address).toMatchObject({ value: '浙江省杭州市上城区样本路1号', mono: false, local: true, warn: false });
    expect(r.used).toEqual([0, 1]);
  });

  it('an amount still to pay is warn, with what the trip file says about it underneath', () => {
    const r = facts('dm27-stay-02');
    const pay = r.facts[0]!;
    expect(pay).toMatchObject({ id: 'pay', label: 'To pay', value: '$720', detail: 'cash on arrival', warn: true, from: [0] });
    /* "Room" is not a key: it stays under All details */
    expect(r.used).toEqual([0]);
  });

  it('a walk-in with a price is still to pay; a cancelled stay says nothing about money', () => {
    expect(byLabel('dm27-stay-11', 'To pay')).toMatchObject({ value: '~¥150', warn: true });
    expect(facts('dm27-stay-06')).toEqual({ facts: [], used: [] });
  });

  it('a cancellation deadline the trip file flagged is warn whenever it is', () => {
    const f = byLabel('dm27-stay-03', 'Free cancel', '2027-01-05')!;
    expect(f).toMatchObject({ id: 'deadline', value: 'to Mar 27', mono: true, warn: true });
  });

  it('an arrival the trip file flagged is said, but not in the warn colour — it is not money or a deadline', () => {
    expect(byLabel('dm27-stay-07', 'Late arrival')).toMatchObject({ warn: false, mono: false });
    expect(byLabel('dm27-stay-10', 'Late check-in')).toMatchObject({ warn: false, value: 'agreed — ≈23:15' });
  });

  it('a check-out with a sentence after the time is not monospace', () => {
    expect(byLabel('dm27-stay-13', 'Check-out')).toMatchObject({ mono: false });
    expect(byLabel('dm27-stay-13', 'Paid')).toMatchObject({ value: 'HK$5,200 (4n)', mono: true });
  });

  it('an unflagged deadline turns warn only inside seven days of now', () => {
    const stay: HotelBooking = {
      tripId: 't', id: 's', kind: 'hotel', status: 'booked', title: 'Inn', city: 'X', date: '2027-03-29',
      checkIn: '2027-03-29', checkOut: '2027-03-31', createdAt: 0, updatedAt: 0, paidMinor: 5000, priceNote: '¥500',
      meta: [{ k: 'Cancel by', v: 'Mar 27' }],
    };
    const at = (now: string) => passKeyFacts(stay, 'stay', now).facts.find((f) => f.id === 'deadline')!;
    expect(at('2027-03-22').warn).toBe(true);
    expect(at('2027-03-10').warn).toBe(false);
    expect(at('2027-03-28').warn).toBe(false); // gone by
  });

  it('a stay with none of the keys has no block, and nothing breaks', () => {
    const bare: HotelBooking = {
      tripId: 't', id: 'b', kind: 'hotel', status: 'booked', title: 'Inn', city: 'X', date: '2027-03-29',
      checkIn: '2027-03-29', checkOut: '2027-03-31', createdAt: 0, updatedAt: 0, meta: [{ k: 'Room', v: 'twin' }, { k: 'Shuttle', v: 'free' }],
    };
    expect(passKeyFacts(bare, 'stay', '2027-03-01')).toEqual({ facts: [], used: [] });
    expect(passKeyFacts({ ...bare, meta: [] }, 'stay', '2027-03-01')).toEqual({ facts: [], used: [] });
  });

  it('never more than six rows; the rest stay under All details', () => {
    const many: HotelBooking = {
      tripId: 't', id: 'm', kind: 'hotel', status: 'booked', title: 'Inn', city: 'X', date: '2027-03-29', checkIn: '2027-03-29',
      checkOut: '2027-03-31', createdAt: 0, updatedAt: 0, priceNote: '¥500', address: 'Somewhere 1', addressEn: 'Somewhere One',
      meta: [
        { k: 'Check-in', v: 'from 14:00' }, { k: 'Late check-in', v: '23:00' }, { k: 'Arrival', v: 'by 18:00' },
        { k: 'Check-out', v: '12:00' }, { k: 'Free cancel', v: 'to Mar 20' }, { k: 'Paid', v: 'online' },
      ],
    };
    const r = passKeyFacts(many, 'stay', '2027-03-01');
    expect(r.facts).toHaveLength(MAX_FACTS);
    expect(r.facts.map((f) => f.id)).toEqual(['pay', 'time', 'time', 'time', 'deadline', 'address']);
    /* the third arrival row and the address's English line … */
    expect(r.facts[0]).toMatchObject({ label: 'Paid', detail: 'online', warn: false });
    expect(r.facts[5]).toMatchObject({ value: 'Somewhere 1', detail: 'Somewhere One' });
    /* … and 'Check-in' was not taken twice */
    expect(new Set(r.used).size).toBe(r.used.length);
  });
});

describe('passfacts · a ticket', () => {
  it('says its times, what it cost, and where — without repeating the hero', () => {
    const r = facts('dm27-ticket-concert');
    expect(r.facts.map((f) => f.label)).toEqual(['Doors', 'Paid', 'Address']);
    expect(r.facts[0]).toMatchObject({ value: '19:00', mono: true, warn: false });
    expect(r.facts[1]).toMatchObject({ value: 'HK$480', mono: true, warn: false });
    /* "Seat" is not a key fact: it stays under All details */
    expect(r.used).toEqual([1]);
  });

  it('a pending ticket has a price, not a bill — and the day its tickets are released, which the trip file flagged', () => {
    expect(byLabel('dm27-ticket-museum', 'Price')).toMatchObject({ value: 'free with a booking', mono: false, warn: false });
    expect(byLabel('dm27-ticket-museum', 'Released')).toMatchObject({ id: 'deadline', value: '7 days ahead, 20:00 Shanghai', mono: false, warn: true });
    expect(byLabel('dm27-ticket-garden', 'Price')).toMatchObject({ value: '¥90', mono: true, warn: false });
  });

  it('a show time is a key fact', () => {
    expect(facts('dm27-ticket-opera').facts.map((f) => [f.label, f.value])).toEqual([
      ['Show', '20:00'],
      ['Price', '¥180 (sample)'],
    ]);
  });
});

describe('passfacts · paid, price or still to pay (a bought ticket is never "To pay" in amber)', () => {
  const ticket = (o: Partial<Extract<Booking, { kind: 'activity' }>> = {}): Booking => ({
    tripId: 't', id: 'k', kind: 'activity', status: 'booked', title: 'Concert', date: '2027-03-29', time: '19:30',
    createdAt: 0, updatedAt: 0, priceNote: 'HK$689', meta: [], ...o,
  }) as Booking;
  const stay = (o: Partial<HotelBooking> = {}): Booking => ({
    tripId: 't', id: 's', kind: 'hotel', status: 'booked', title: 'Inn', city: 'X', date: '2027-03-29',
    checkIn: '2027-03-29', checkOut: '2027-03-31', createdAt: 0, updatedAt: 0, priceNote: '¥500', meta: [], ...o,
  });
  const pay = (b: Booking) => passKeyFacts(b, passKind(b), '2027-03-01').facts.find((f) => f.id === 'pay');

  it('a ticket that is booked, with a price and nothing said about paying later, shows the price in ink', () => {
    expect(pay(ticket())).toMatchObject({ label: 'Price', value: 'HK$689', warn: false });
  });
  it('a ticket with money paid, or a Paid row, says Paid in ink', () => {
    expect(pay(ticket({ paidMinor: 68900 }))).toMatchObject({ label: 'Paid', value: 'HK$689', warn: false });
    expect(pay(ticket({ priceNote: undefined, meta: [{ k: 'Paid', v: 'HK$689 online' }] }))).toMatchObject({ label: 'Paid', warn: false });
  });
  it('a booked ticket whose price is paid at the gate is still to pay, in amber', () => {
    expect(pay(ticket({ priceNote: 'HK$10 at the gate' }))).toMatchObject({ label: 'To pay', warn: true });
    expect(pay(ticket({ meta: [{ k: 'Price', v: 'pay at the door' }] }))).toMatchObject({ label: 'To pay', warn: true });
  });
  it('a pending ticket with a price is a price, not a bill', () => {
    expect(pay(ticket({ status: 'pending' }))).toMatchObject({ label: 'Price', warn: false });
  });
  it('a walk-in is still to pay', () => {
    expect(pay(ticket({ status: 'walkin', priceNote: '~HK$10' }))).toMatchObject({ label: 'To pay', warn: true });
  });
  it('a booked stay to be paid at the hotel is to pay in amber; one paid in advance says Paid', () => {
    expect(pay(stay({ meta: [{ k: 'Paid', v: 'pay at hotel' }] }))).toMatchObject({ label: 'To pay', value: '¥500', detail: 'pay at hotel', warn: true });
    expect(pay(stay())).toMatchObject({ label: 'To pay', warn: true });
    expect(pay(stay({ paidMinor: 50000 }))).toMatchObject({ label: 'Paid', warn: false });
    expect(pay(stay({ meta: [{ k: 'Paid', v: 'online, in full' }] }))).toMatchObject({ label: 'Paid', warn: false });
  });
  it('a cancelled booking says nothing about money', () => {
    expect(pay(ticket({ status: 'cancelled' }))).toBeUndefined();
  });
});

describe('passfacts · every demo booking', () => {
  it('uses each meta row at most once, within range, and never more than six facts', () => {
    for (const b of demo) {
      const r = passKeyFacts(b, passKind(b), '2027-03-20');
      expect(r.facts.length, b.id).toBeLessThanOrEqual(MAX_FACTS);
      expect(new Set(r.used).size, b.id).toBe(r.used.length);
      for (const i of r.used) expect(i, b.id).toBeLessThan(b.meta.length);
      /* nothing is drawn warn on a cancelled booking */
      if (b.status === 'cancelled') expect(r.facts.some((f) => f.warn), b.id).toBe(false);
    }
  });
});

describe('passfacts · the actions', () => {
  it('lists the driver card, a map, a call and the address copy, in that order, and only what the booking has', () => {
    expect(passActions(get('dm27-stay-01'), true)).toEqual(['driver', 'navigate', 'call', 'copy']);
    expect(passActions(get('dm27-stay-01'), false)).toEqual(['navigate', 'call', 'copy']);
    /* a pin or a name is enough for a map; no address, no copy */
    expect(passActions(get('dm27-flight-mu5001'), false)).toEqual(['navigate']);
    /* nothing to open, dial or copy: no row */
    expect(passActions(get('dm27-stay-04'), false)).toEqual([]);
    expect(passActions(get('dm27-train-apr02'), false)).toEqual([]);
  });
});

describe('passfacts · the number to dial', () => {
  it('keeps a leading + and the digits, and gives nothing for no number', () => {
    expect(telHref('+86 571 0000 0001')).toBe('tel:+8657100000001');
    expect(telHref('(02) 555-0100')).toBe('tel:025550100');
    expect(telHref('')).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref('ask at the desk')).toBeNull();
  });
});

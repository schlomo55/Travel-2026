/* PAID, OR STILL TO PAY (10 Nov 2026) — the trip file's `pay` / `payDue` /
   `payCash`, kept on import only when they are what they say, and the stamp
   (logic/stamps.ts payStamp) that says them beside Booked: from the field,
   else from the money rows the pass already reads (logic/paystate.ts), else
   nothing. The pass's money row (logic/passfacts.ts) and the stamp give one
   answer. Made-up bookings only. */
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, HotelBooking, Trip, TripBundle } from '../lib/model/types';
import { normalizeBundle, parseBackupText } from '../lib/logic/backup';
import { payStamp } from '../lib/logic/stamps';
import { payOf } from '../lib/logic/paystate';
import { passKeyFacts } from '../lib/logic/passfacts';

const stay = (o: Partial<HotelBooking> = {}): HotelBooking => ({
  tripId: 't', id: 's', kind: 'hotel', status: 'booked', title: 'Sample Inn', city: 'Sample City', date: '2027-04-12',
  checkIn: '2027-04-12', checkOut: '2027-04-14', createdAt: 0, updatedAt: 0, meta: [], ...o,
});
const trip = { id: 't', title: 'T', start: '2027-04-12', end: '2027-04-18', homeCurrency: 'USD', currencies: [], accentHue: 0, clocks: [], archived: false, createdAt: 0, updatedAt: 0 } as Trip;
const moneyRow = (b: Booking) => passKeyFacts(b, 'stay', '2027-04-01').facts.find((f) => f.id === 'pay');

describe('import — pay, payDue and payCash are kept only when they are what they say', () => {
  it('keeps the right types and drops anything else', () => {
    const b = normalizeBundle({
      trip,
      bookings: [
        stay({ id: 'a', pay: 'due', payDue: '¥300 at the hotel', payCash: true }),
        { ...stay({ id: 'b' }), pay: 'yes', payDue: 300, payCash: 'true' } as unknown as Booking,
        { ...stay({ id: 'c' }), pay: 'PAID', payCash: false } as unknown as Booking,
        stay({ id: 'd', pay: 'paid' }),
      ],
    } as Partial<TripBundle>);
    expect(b.bookings[0]).toMatchObject({ pay: 'due', payDue: '¥300 at the hotel', payCash: true });
    for (const k of ['pay', 'payDue', 'payCash']) {
      expect(b.bookings[1]).not.toHaveProperty(k);
      expect(b.bookings[2]).not.toHaveProperty(k);
    }
    expect(b.bookings[3]).toMatchObject({ pay: 'paid' });
  });
  it('a file without them loads exactly as before', () => {
    expect(normalizeBundle({ trip, bookings: [stay()] }).bookings[0]).toEqual(stay());
  });
  it('an exported file carries them back in', () => {
    const out: AppBackup = {
      format: 'livingthedream/backup', formatVersion: 1, kind: 'trip', exportedAt: '2027-04-01T00:00:00Z', appVersion: 'test',
      trips: [normalizeBundle({ trip, bookings: [stay({ pay: 'due', payDue: 'US$200 cash on arrival', payCash: true })] })],
    };
    const back = parseBackupText(JSON.stringify(out));
    expect(back.trips[0]!.bookings[0]).toMatchObject({ pay: 'due', payDue: 'US$200 cash on arrival', payCash: true });
  });
});

describe('payStamp — Paid, To pay, or nothing', () => {
  it('Paid, in the ok tone', () => {
    expect(payStamp(stay({ pay: 'paid' }))).toEqual({ label: 'Paid', cls: 'ok' });
  });
  it('To pay, in the warn tone — with what is left and where, and cash only when that is the only way', () => {
    expect(payStamp(stay({ pay: 'due' }))).toEqual({ label: 'To pay', cls: 'warn' });
    expect(payStamp(stay({ pay: 'due', payDue: ' ¥300 at the hotel ' }))).toEqual({ label: 'To pay · ¥300 at the hotel', cls: 'warn' });
    expect(payStamp(stay({ pay: 'due', payCash: true }))).toEqual({ label: 'To pay, cash only', cls: 'warn' });
    expect(payStamp(stay({ pay: 'due', payCash: true, payDue: 'US$200 on arrival' }))).toEqual({ label: 'To pay, cash only · US$200 on arrival', cls: 'warn' });
  });
  it('nothing on a pending or a cancelled booking — the status stamp already says it', () => {
    expect(payStamp(stay({ status: 'pending', pay: 'paid' }))).toBeNull();
    expect(payStamp(stay({ status: 'cancelled', pay: 'due', payDue: '¥300' }))).toBeNull();
  });
  it('without the field, what the money rows say', () => {
    expect(payStamp(stay({ priceNote: '¥500', meta: [{ k: 'Payment', v: 'at the hotel, cash' }] }))).toEqual({ label: 'To pay', cls: 'warn' });
    expect(payStamp(stay({ priceNote: '$200', meta: [{ k: 'Payment', v: 'prepaid online' }] }))).toEqual({ label: 'Paid', cls: 'ok' });
    expect(payStamp(stay({ priceNote: '$200', paidMinor: 20000 }))).toEqual({ label: 'Paid', cls: 'ok' });
  });
  it('without the field and with nothing said either way, no stamp — never a guess', () => {
    expect(payStamp(stay())).toBeNull();
    expect(payStamp(stay({ priceNote: '$200' }))).toBeNull();
    /* a deposit alone is not the room's money */
    expect(payStamp(stay({ meta: [{ k: 'Deposit', v: '¥300 at check-in' }] }))).toBeNull();
  });
  it('the field outranks the rows', () => {
    expect(payStamp(stay({ pay: 'paid', priceNote: '¥500', meta: [{ k: 'Payment', v: 'at the hotel' }] }))).toEqual({ label: 'Paid', cls: 'ok' });
    expect(payStamp(stay({ pay: 'due', priceNote: '$200', meta: [{ k: 'Payment', v: 'prepaid online' }] }))?.label).toBe('To pay');
  });
});

describe('the pass\'s money row and the stamp never disagree', () => {
  const cases: HotelBooking[] = [
    stay({ pay: 'paid', priceNote: '¥500', meta: [{ k: 'Payment', v: 'at the hotel' }] }),
    stay({ pay: 'due', priceNote: '$200', meta: [{ k: 'Payment', v: 'prepaid online' }] }),
    stay({ pay: 'due', payDue: '¥300 at the hotel' }),
    stay({ pay: 'due', payDue: '¥300 at the hotel', priceNote: '¥600 (2n)' }),
    stay({ priceNote: '¥500', meta: [{ k: 'Paid', v: 'pay at hotel' }] }),
    stay({ priceNote: '$200', meta: [{ k: 'Payment', v: 'PREPAID ONLINE' }] }),
    stay({ status: 'walkin', priceNote: '~¥200' }),
  ];
  it('Paid on the stamp is Paid on the row; To pay is To pay', () => {
    for (const b of cases) {
      const s = payStamp(b);
      const row = moneyRow(b);
      expect(s, JSON.stringify(b)).not.toBeNull();
      expect(row?.label, JSON.stringify(b)).toBe(s!.cls === 'ok' ? 'Paid' : 'To pay');
      expect(row?.warn).toBe(s!.cls === 'warn');
      expect(payOf(b)).toBe(s!.cls === 'ok' ? 'paid' : 'due');
    }
  });
  it('what is left and where is said on the row too', () => {
    expect(moneyRow(stay({ pay: 'due', payDue: '¥300 at the hotel' }))).toMatchObject({ label: 'To pay', value: '¥300 at the hotel', warn: true });
    expect(moneyRow(stay({ pay: 'due', payDue: '¥300 at the hotel', priceNote: '¥600 (2n)' }))).toMatchObject({
      label: 'To pay',
      value: '¥600 (2n)',
      detail: '¥300 at the hotel',
    });
  });
});

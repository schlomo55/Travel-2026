/* SHOW THE DRIVER YOUR BED (QA, 7 Nov 2026): every stay with a local-script
   name or address gets its own white card, the driver list holds them in
   trip order, and the optional fields a trip file may carry are validated on
   import. Synthetic trips only. */
import { describe, expect, it } from 'vitest';
import { driverCards, stayCard } from '../lib/logic/pocket';
import { normalizeBundle } from '../lib/logic/backup';
import type { Booking, DayPlan, HotelBooking, ShowCard, Stop, Trip, TripBundle } from '../lib/model/types';

const stay = (id: string, checkIn: string, over: Partial<HotelBooking> = {}): HotelBooking => ({
  id,
  tripId: 't',
  kind: 'hotel',
  status: 'booked',
  title: `Hotel ${id}`,
  date: checkIn,
  city: 'Sample City',
  checkIn,
  checkOut: checkIn.replace(/\d\d$/, (d) => String(Number(d) + 2).padStart(2, '0')),
  meta: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});
const place = (id: string, order: number, over: Partial<ShowCard> = {}): ShowCard => ({
  id, tripId: 't', kind: 'place', native: `地点${order}`, meaning: `Place ${id}`, verify: false, pending: false, isKey: false, order, ...over,
});

describe('stayCard — a stay’s own driver card', () => {
  it('puts the local name and address large, the English address and the phone small', () => {
    const c = stayCard(stay('a', '2027-04-12', { native: '样例酒店', address: '样例市中山路1号', addressEn: '1 Zhongshan Rd', phone: '+86 10 0000 0000' }))!;
    expect(c).toMatchObject({ id: 'a', kind: 'place', native: '样例酒店', meaning: 'Hotel a', address: '样例市中山路1号', addressEn: '1 Zhongshan Rd', phone: '+86 10 0000 0000', category: 'hotel', pending: false, order: -1 });
  });

  it('reads an address in Latin letters as the English one — the file may have them the other way round', () => {
    const c = stayCard(stay('b', '2027-04-12', { native: '样例酒店', address: '1 Zhongshan Road, Sample City' }))!;
    expect(c.address).toBeUndefined();
    expect(c.addressEn).toBe('1 Zhongshan Road, Sample City');
  });

  it('falls back to the Chinese of a two-script title, or a Chinese map name', () => {
    expect(stayCard(stay('c', '2027-04-12', { title: 'Sample Inn 样例客栈' }))).toMatchObject({ native: '样例客栈', meaning: 'Sample Inn' });
    expect(stayCard(stay('d', '2027-04-12', { mapQuery: '样例青旅' }))?.native).toBe('样例青旅');
  });

  it('with only a local address, the address itself is the large line', () => {
    expect(stayCard(stay('e', '2027-04-12', { address: '样例市中山路1号' }))).toMatchObject({ native: '样例市中山路1号', address: '样例市中山路1号' });
  });

  it('has no card with nothing a driver could read, nor for a cancelled or either/or stay', () => {
    expect(stayCard(stay('f', '2027-04-12'))).toBeNull();
    expect(stayCard(stay('g', '2027-04-12', { address: 'Rua das Flores 1, Porto' }))).toBeNull();
    expect(stayCard(stay('h', '2027-04-12', { native: '样例', status: 'cancelled' }))).toBeNull();
    expect(stayCard(stay('i', '2027-04-12', { native: '样例', alternative: true }))).toBeNull();
    const flight = { ...stay('j', '2027-04-12', { native: '样例' }), kind: 'flight' } as unknown as Booking;
    expect(stayCard(flight)).toBeNull();
  });
});

describe('driverCards — every card, the stays’ among them, in trip order', () => {
  const stop = (id: string, start: string, end: string, lat: number): Stop => ({
    id, tripId: 't', kind: 'stop', name: id, hue: 0, start, end, coord: { lat, lng: 110 }, blocks: [], recoBlocks: [], order: 0,
  });
  const stops = [stop('north', '2027-04-12', '2027-04-15', 40), stop('south', '2027-04-15', '2027-04-18', 22)];
  const day = (date: string, placeIds: string[]): DayPlan => ({ id: date, tripId: 't', date, title: date, planItems: [], placeIds });
  it('places a card on the first day that names it, else at its city’s start, else beside the one before it; a stay at check-in', () => {
    const cards = [
      place('school', 0), // named by nothing, no position: stays first, as the file has it
      place('south-sight', 1, { coord: { lat: 22.01, lng: 110 } }), // in the south city: 15 Apr
      place('station', 2), // beside south-sight
      place('north-sight', 3), // named on 13 Apr
      { ...place('phrase', 4), kind: 'phrase' as const },
    ];
    const bookings: Booking[] = [stay('bed-south', '2027-04-15', { native: '南方酒店' }), stay('bed-north', '2027-04-12', { native: '北方酒店' }), stay('nameless', '2027-04-12')];
    const ids = driverCards(cards, bookings, [day('2027-04-13', ['north-sight'])], stops).map((c) => c.id);
    expect(ids).toEqual(['school', 'bed-north', 'north-sight', 'south-sight', 'station', 'bed-south']);
  });
});

describe('import — the optional fields are kept only when they are what they say', () => {
  const trip = { id: 't', title: 'T', start: '2027-04-12', end: '2027-04-18', homeCurrency: 'USD', currencies: [], accentHue: 0, clocks: [], archived: false, createdAt: 0, updatedAt: 0 } as Trip;
  it('keeps strings and a known script, drops anything else, and loads a file without them as before', () => {
    const raw = {
      trip,
      bookings: [{ ...stay('a', '2027-04-12'), native: '样例酒店', phone: 12345, addressEn: '1 Main St' } as unknown as Booking],
      showCards: [{ ...place('p', 0), kind: 'phrase', pinyin: 'yànglì', set: 'medical', region: 'HK', script: 'Hant' } as ShowCard, { ...place('q', 1), script: 'Cyrl', set: 7 } as unknown as ShowCard],
    } as Partial<TripBundle>;
    const b = normalizeBundle(raw);
    expect(b.bookings[0]).toMatchObject({ native: '样例酒店', addressEn: '1 Main St' });
    expect(b.bookings[0]).not.toHaveProperty('phone');
    expect(b.showCards[0]).toMatchObject({ pinyin: 'yànglì', set: 'medical', region: 'HK', script: 'Hant' });
    expect(b.showCards[1]).not.toHaveProperty('script');
    expect(b.showCards[1]).not.toHaveProperty('set');
    expect(normalizeBundle({ trip, bookings: [stay('z', '2027-04-12')] }).bookings[0]).toEqual(stay('z', '2027-04-12'));
  });
});

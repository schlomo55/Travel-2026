/* A STOP'S STATUS LINE AND ITS DAYS (logic/stopview.ts, logic/stopdays.ts) — read off the demo trip, the way the
   stop page reads them: bookedHere + coverage for the line, daysHere + the
   same two for the Days view. The holes are made in the test by taking a
   booking out of the demo, never by a second fixture. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, Stop, Trip } from '../lib/model/types';
import { cityPlaces } from '../lib/logic/citymap';
import { buildCoverage } from '../lib/logic/coverage';
import { bookedHere, daysHere } from '../lib/logic/guide';
import { stopDays } from '../lib/logic/stopdays';
import { stopStatus } from '../lib/logic/stopview';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const stopOf = (id: string): Stop => demo.stops.find((s) => s.id === `dm27-stop-${id}`)!;

/** the page's own reading of one stop, on `bookings` and the day `now` */
function read(id: string, now: string, bookings: Booking[] = demo.bookings) {
  const stop = stopOf(id);
  const places = cityPlaces(stop, { stops: demo.stops, showCards: demo.showCards, bookings, dayPlans: demo.dayPlans, dayDefaults: demo.dayDefaults });
  const held = bookedHere(stop, bookings, new Set(places.filter((p) => p.kind === 'booking').map((p) => p.id)));
  const seg = buildCoverage(demo.trip as Trip, demo.stops, bookings, now).find((s) => s.stopId === stop.id) ?? null;
  return { stop, held, seg, days: daysHere(stop, demo.dayPlans), status: stopStatus(held, seg), rows: stopDays(daysHere(stop, demo.dayPlans), held, seg, now) };
}
const words = (cs: { text: string }[]): string[] => cs.map((c) => c.text);

describe('stopStatus · the line under the city guide', () => {
  it('counts what is held and names what is still to buy — Huangshan', () => {
    const { status } = read('huangshan', '2027-04-05');
    /* two beds and the two flights in the stay are held; the park pass and the cableway are still to buy */
    expect(status).toEqual([
      { text: '4 booked', tone: 'ok' },
      { text: '2 tickets to buy', tone: 'warn' },
    ]);
  });

  it('says a move that is not held in the route check’s own words, amber, after the counts', () => {
    expect(read('suzhou', '2027-04-03').status).toEqual([
      { text: '2 booked', tone: 'ok' },
      { text: '1 ticket to buy', tone: 'warn' },
      { text: 'train not booked', tone: 'warn' },
    ]);
  });

  it('says nothing about a move that is held', () => {
    expect(words(read('hangzhou', '2027-03-25').status)).toEqual(['1 booked']);
  });

  it('joins moves of one kind into one chip — Longji’s two rides', () => {
    expect(words(read('longji', '2027-04-05').status)).toEqual(['2 rides not booked']);
  });

  it('says a move that is only part held — and a held train adds no chip and no count (the Booked chapter lists beds, flights and tickets)', () => {
    const { held, seg } = read('suzhou', '2027-04-03');
    const part = { ...seg!, legs: seg!.legs.map((l) => (l.role === 'in' ? { ...l, state: 'partial' as const } : l)) };
    expect(words(stopStatus(held, part))).toEqual(['2 booked', '1 ticket to buy', 'train part booked']);
    const held2 = demo.bookings.map((b) => (b.id === 'dm27-train-apr02' ? { ...b, status: 'booked' as const } : b));
    expect(words(read('suzhou', '2027-04-03', held2).status)).toEqual(['2 booked', '1 ticket to buy']);
  });

  it('flags a night with no bed — red while it is still ahead, amber once it is behind', () => {
    const hole = demo.bookings.filter((b) => b.id !== 'dm27-stay-08');
    expect(words(read('huangshan', '2027-04-05', hole).status)).toContain('1 night with no bed');
    expect(read('huangshan', '2027-04-05', hole).status.find((c) => /no bed/.test(c.text))!.tone).toBe('crit');
    expect(read('huangshan', '2027-05-01', hole).status.find((c) => /no bed/.test(c.text))!.tone).toBe('warn');
  });

  it('counts a stay that is not held yet, and has nothing to say with no seg and no bookings', () => {
    const pending = demo.bookings.map((b) => (b.id === 'dm27-stay-07' ? { ...b, status: 'pending' as const } : b));
    expect(words(read('huangshan', '2027-04-05', pending).status)).toContain('1 stay not booked');
    const empty = { beds: [], flights: [], tickets: [] };
    expect(stopStatus(empty, null)).toEqual([]);
  });
});

describe('stopDays · the Days view', () => {
  const { rows, days } = read('huangshan', '2027-04-05');

  it('is the guide’s own list of days — one row per planned day, in date order', () => {
    expect(rows.map((r) => r.date)).toEqual(days.map((d) => d.date));
    expect(rows.map((r) => r.date)).toEqual(['2027-04-04', '2027-04-05', '2027-04-06', '2027-04-07']);
    expect(rows[1]).toMatchObject({ dow: 'Mon', day: '5 Apr', title: 'Huangshan on foot' });
  });

  it('gives each night its bed — the day’s own words', () => {
    expect(rows.map((r) => r.bed)).toEqual([
      'Sample Pine Lodge, Tangkou',
      'Sample Pine Lodge, Tangkou',
      'Sample Old Street Hotel, Tunxi',
      'Sample Teahouse Hotel, Chunxi Road',
    ]);
  });

  it('falls back on the stay that covers the night when the day names no bed', () => {
    const bare = daysHere(stopOf('huangshan'), demo.dayPlans).map((d) => ({ ...d, bedLabel: undefined }));
    const { held, seg } = read('huangshan', '2027-04-05');
    const out = stopDays(bare, held, seg, '2027-04-05');
    expect(out[0]!.bed).toBe('Sample Pine Lodge, Tangkou');
    /* the departure day has no night in this stop */
    expect(out[3]!.bed).toBeNull();
  });

  it('marks the day that is today, and only that one', () => {
    expect(rows.filter((r) => r.today).map((r) => r.date)).toEqual(['2027-04-05']);
    expect(stopDays(days, read('huangshan', '2027-04-05').held, null, '2027-01-01').some((r) => r.today)).toBe(false);
  });

  it('puts a ticket still to buy on the day it is for', () => {
    const byDate = Object.fromEntries(rows.map((r) => [r.date, words(r.chips)]));
    expect(byDate['2027-04-05']).toContain('ticket to buy');
    expect(byDate['2027-04-06']).toContain('ticket to buy');
    expect(byDate['2027-04-04']).not.toContain('ticket to buy');
  });

  it('puts a move that is not held on the day it happens', () => {
    const { rows: suzhou } = read('suzhou', '2027-04-03');
    const arrival = suzhou.find((r) => r.date === '2027-04-02')!;
    expect(words(arrival.chips)).toContain('train not booked');
    expect(suzhou.filter((r) => words(r.chips).includes('train not booked'))).toHaveLength(1);
  });

  it('names the move on each day it happens — Longji’s ride in and ride out are two days, one chip each', () => {
    const { rows: longji } = read('longji', '2027-04-05');
    expect(longji.map((r) => words(r.chips))).toEqual([['ride not booked'], ['ride not booked']]);
  });

  it('flags a bed that is missing or not held on that night, and nothing on a night that is fine', () => {
    const hole = read('huangshan', '2027-04-05', demo.bookings.filter((b) => b.id !== 'dm27-stay-08')).rows;
    expect(hole[2]!.chips).toContainEqual({ text: 'no bed', tone: 'crit' });
    expect(hole[1]!.chips.some((c) => /bed/.test(c.text))).toBe(false);
    const pending = read('huangshan', '2027-04-05', demo.bookings.map((b) => (b.id === 'dm27-stay-08' ? { ...b, status: 'pending' as const } : b))).rows;
    expect(pending[2]!.chips).toContainEqual({ text: 'bed not booked', tone: 'warn' });
  });

  it('has no rows for a stop with no planned day', () => {
    expect(stopDays([], read('huangshan', '2027-04-05').held, null, '2027-04-05')).toEqual([]);
  });
});

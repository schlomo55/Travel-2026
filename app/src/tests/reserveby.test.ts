/* RESERVE BY — a ticket on the place it is for, and the book-by the traveller
   typed: the Day view's chips, the To-do row, the reminder and the form, on
   the real China trip (whose file carries NO book-by: every one here is set
   by the test, as the traveller would on the edit form). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ActivityBooking, AppBackup, Booking } from '../lib/model/types';
import { bookByOf, bookByPassed, dayTickets, placeTickets, ticketLine } from '../lib/logic/reserveby';
import { mapPlaces, placeById } from '../lib/logic/mapplaces';
import { resolvePlaces } from '../lib/logic/places';
import { resolveDay } from '../lib/logic/day';
import { todoOn, todoPlan, todoTitle } from '../lib/logic/todo';
import { planNotifications, stableId, type PlanInput } from '../lib/logic/notify';
import { zonePlan } from '../lib/logic/tripzone';
import { otherBookingSpec } from '../lib/components/forms/specs';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const FC = 'cn26-ticket-forbidden-city';
const ticket = (id: string): ActivityBooking => china.bookings.find((b) => b.id === id) as ActivityBooking;
/** the trip with one booking changed, the way an edit would */
const withBooking = (id: string, patch: Partial<ActivityBooking>): Booking[] =>
  china.bookings.map((b) => (b.id === id ? ({ ...b, ...patch } as Booking) : b));
const src = (bookings: Booking[] = china.bookings) => ({ stops: china.stops, showCards: china.showCards, bookings });

describe('which places and days carry a ticket', () => {
  it('puts the Forbidden City ticket on the Palace Museum, on Sun 6 Dec only', () => {
    const ids = resolveDay('2026-12-06', china.dayPlans, china.dayDefaults, china.stops)!.placeIds!;
    const got = dayTickets(ids, src(), '2026-12-06');
    expect([...got.keys()]).toEqual(['cn26-spot-beijing-palace-museum']);
    expect(got.get('cn26-spot-beijing-palace-museum')!.map((b) => b.id)).toEqual([FC]);
    /* the same place another day: nothing */
    expect(dayTickets(ids, src(), '2026-12-07').size).toBe(0);
  });

  it('never matches by name: a ticket with no point rides with nothing', () => {
    const ids = china.stops.flatMap((s) => (s.spots ?? []).map((sp) => sp.id));
    const disney = ticket('cn26-ticket-disney');
    expect(dayTickets(ids, src(), disney.date).size).toBe(0);
  });

  it('a cancelled ticket, or the other way of doing it, is no chip', () => {
    const ids = ['cn26-spot-beijing-palace-museum'];
    expect(dayTickets(ids, src(withBooking(FC, { status: 'cancelled' })), '2026-12-06').size).toBe(0);
    expect(dayTickets(ids, src(withBooking(FC, { alternative: true })), '2026-12-06').size).toBe(0);
  });

  it('two chips at one point never both carry it — the first one does', () => {
    const got = dayTickets(['cn26-spot-beijing-palace-museum', FC], src(), '2026-12-06');
    expect([...got.keys()]).toEqual(['cn26-spot-beijing-palace-museum']);
  });

  /* the chips' join (records, posKey) and the route's (MapPlace.with) are one
     join: on every day of the trip they name the same tickets */
  it('agrees with the Map’s own grouping on every day of the trip', () => {
    const places = mapPlaces({ tripId: china.trip.id, ...src(), dayPlans: china.dayPlans, dayDefaults: china.dayDefaults });
    let seen = 0;
    for (const d of china.dayPlans) {
      const ids = d.placeIds ?? [];
      const viaChips = new Set([...dayTickets(ids, src(), d.date).values()].flat().map((b) => b.id));
      const viaWith = new Set<string>();
      for (const id of ids) for (const b of placeTickets(placeById(places, id) ?? { with: [] }, d.date)) viaWith.add(b.id);
      expect([...viaChips].sort(), d.date).toEqual([...viaWith].sort());
      seen += viaChips.size;
    }
    expect(seen).toBeGreaterThan(3);
  });

  it('a chip the day resolves is a chip that can carry it', () => {
    const refs = resolvePlaces(resolveDay('2026-12-06', china.dayPlans, china.dayDefaults, china.stops)!.placeIds, src());
    expect(dayTickets(refs.map((r) => r.id), src(), '2026-12-06').has('cn26-spot-beijing-palace-museum')).toBe(true);
  });
});

describe('what the chip says', () => {
  const fc = ticket(FC);
  it('pending, no book-by: only "Ticket not booked"', () => {
    expect(ticketLine(fc, '2026-11-01', 600)).toEqual({ text: 'Ticket not booked', booked: false });
    expect(bookByOf(fc)).toBeNull();
  });
  it('pending with a book-by: the day and the hour the traveller set', () => {
    const b = { ...fc, bookBy: '2026-11-29', bookByTime: '20:00' };
    expect(ticketLine(b, '2026-11-01', 600).text).toBe('Ticket not booked · book by Sun 29 Nov 20:00');
    expect(ticketLine({ ...b, bookByTime: undefined }, '2026-11-01', 600).text).toBe('Ticket not booked · book by Sun 29 Nov');
  });
  it('past it and still pending: "(passed)" — and nothing about whether it is open or closed', () => {
    const b = { ...fc, bookBy: '2026-11-29', bookByTime: '20:00' };
    expect(bookByPassed(b, '2026-11-29', 19 * 60 + 59)).toBe(false);
    expect(bookByPassed(b, '2026-11-29', 20 * 60)).toBe(true);
    expect(bookByPassed(b, '2026-11-30', null)).toBe(true);
    expect(ticketLine(b, '2026-11-30', 0).text).toBe('Ticket not booked · book by Sun 29 Nov 20:00 (passed)');
    expect(ticketLine(b, '2026-11-30', 0).text).not.toMatch(/open|closed/i);
  });
  it('booked: "Ticket ✓", whatever book-by it still carries', () => {
    expect(ticketLine(ticket('cn26-ticket-hkphil'), '2026-12-22', 0)).toEqual({ text: 'Ticket ✓', booked: true });
    expect(ticketLine({ ...fc, status: 'booked', bookBy: '2026-11-29' }, '2026-12-01', 0).text).toBe('Ticket ✓');
  });
});

describe('the To-do row', () => {
  const bookings = withBooking(FC, { bookBy: '2026-11-29', bookByTime: '20:00' });

  it('moves the ticket’s own row to its book-by — one row, never two', () => {
    const plan = todoPlan(china.tasks, china.alarms, bookings, '2026-11-01');
    const all = [...plan.earlier, ...plan.days.flatMap((d) => d.items), ...plan.undated];
    expect(all.filter((i) => i.id === FC)).toHaveLength(1);
    const row = todoOn(plan, '2026-11-29').find((i) => i.id === FC)!;
    expect(row).toMatchObject({ kind: 'booking', time: '20:00', bookFor: '2026-12-06', late: false });
    expect(todoTitle(row)).toBe('Book: Forbidden City · timed entry — for Sun 6 Dec');
    expect(todoOn(plan, '2026-12-06').some((i) => i.id === FC)).toBe(false);
  });

  it('without a book-by the row stays on the day it is for, as before', () => {
    const plan = todoPlan(china.tasks, china.alarms, china.bookings, '2026-11-01');
    const row = todoOn(plan, '2026-12-06').find((i) => i.id === FC)!;
    expect(row.bookFor).toBeUndefined();
    expect(todoTitle(row)).toBe(ticket(FC).title);
  });

  it('past its book-by and still pending it is late; booked, it is no row', () => {
    const plan = todoPlan(china.tasks, china.alarms, bookings, '2026-12-01');
    expect(plan.earlier.find((i) => i.id === FC)?.late).toBe(true);
    const booked = todoPlan(china.tasks, china.alarms, withBooking(FC, { status: 'booked', bookBy: '2026-11-29' }), '2026-11-01');
    expect([...booked.earlier, ...booked.days.flatMap((d) => d.items)].some((i) => i.id === FC)).toBe(false);
  });
});

describe('the reminder', () => {
  const NOW = Date.UTC(2026, 9, 20, 9);
  const input = (bookings: Booking[], over: Partial<PlanInput> = {}): PlanInput => ({
    trip: china.trip,
    bookings,
    alarms: [],
    tasks: [],
    counters: [],
    stops: china.stops,
    dayPlans: china.dayPlans,
    dayDefaults: china.dayDefaults,
    prefs: { on: true, legs: false, travelCard: false, evening: false, backup: false, visa: false },
    lastBackupAt: NOW,
    lastMutationAt: NOW - 1000,
    weather: {},
    zone: zonePlan(bookings, NOW),
    now: NOW,
    ...over,
  });
  const mine = (bs: Booking[], over?: Partial<PlanInput>) =>
    planNotifications(input(bs, over)).filter((x) => x.ref?.kind === 'booking' && x.ref.id === FC);

  it('rings at the book-by with the heads-up before it, under stable ids', () => {
    const got = mine(withBooking(FC, { bookBy: '2026-11-29', bookByTime: '20:00' }));
    expect(got.map((x) => x.id)).toEqual([stableId(`bookby-soon:${FC}`), stableId(`bookby:${FC}`)]);
    const main = got[1]!;
    expect(main.wall).toEqual({ date: '2026-11-29', time: '20:00' });
    expect(main.title).toBe('🎫 Book now: Forbidden City · timed entry');
    expect(main.body).toBe('Tickets for Sun 6 Dec — the book-by you set');
    expect(main.route).toBe(`#/trip/${china.trip.id}/pocket/${FC}`);
    expect(main.at - got[0]!.at).toBe(30 * 60_000);
    /* re-planned after an edit: the same ids, so nothing doubles */
    const again = mine(withBooking(FC, { bookBy: '2026-11-28', bookByTime: '20:00' }));
    expect(again.map((x) => x.id)).toEqual(got.map((x) => x.id));
  });

  it('with no time: 09:00 that day, and no heads-up', () => {
    const got = mine(withBooking(FC, { bookBy: '2026-11-29' }));
    expect(got).toHaveLength(1);
    expect(got[0]!.wall).toEqual({ date: '2026-11-29', time: '09:00' });
  });

  it('nothing once booked or cancelled, with reminders or to-dos off, or in the past', () => {
    expect(mine(withBooking(FC, { bookBy: '2026-11-29', bookByTime: '20:00', status: 'booked' }))).toEqual([]);
    expect(mine(withBooking(FC, { bookBy: '2026-11-29', bookByTime: '20:00', status: 'cancelled' }))).toEqual([]);
    expect(mine(withBooking(FC, { bookBy: '2026-11-29' }), { prefs: { on: false } })).toEqual([]);
    expect(mine(withBooking(FC, { bookBy: '2026-11-29' }), { prefs: { on: true, tasks: false } })).toEqual([]);
    expect(mine(withBooking(FC, { bookBy: '2026-10-19', bookByTime: '20:00' }))).toEqual([]);
    expect(mine(china.bookings)).toEqual([]);
  });
});

describe('the edit form', () => {
  const spec = otherBookingSpec(china.trip.id, 'activity');
  const stored = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

  it('round-trips a book-by, and leaves an activity without one exactly as it was', () => {
    const fc = ticket(FC);
    const v = spec.toValues(fc);
    expect(v.bookBy).toBe('');
    const same = stored(spec.fromValues(v, fc)) as ActivityBooking;
    expect({ ...same, updatedAt: 0 }).toEqual({ ...fc, updatedAt: 0 });

    const set = stored(spec.fromValues({ ...v, bookBy: '2026-11-29', bookByTime: '20:00' }, fc)) as ActivityBooking;
    expect([set.bookBy, set.bookByTime]).toEqual(['2026-11-29', '20:00']);
    expect(spec.toValues(set)).toMatchObject({ bookBy: '2026-11-29', bookByTime: '20:00' });

    const cleared = stored(spec.fromValues({ ...spec.toValues(set), bookBy: '' }, set)) as ActivityBooking;
    expect('bookBy' in cleared || 'bookByTime' in cleared).toBe(false);
  });

  it('a time without its date is refused; a ticket made a train drops both', () => {
    const v = spec.toValues(ticket(FC));
    expect(spec.validate!({ ...v, bookByTime: '20:00' })).toMatch(/needs its date/);
    const set = { ...ticket(FC), bookBy: '2026-11-29', bookByTime: '20:00' };
    const train = stored(spec.fromValues({ ...spec.toValues(set), kind: 'train' }, set));
    expect('bookBy' in train || 'bookByTime' in train).toBe(false);
  });
});

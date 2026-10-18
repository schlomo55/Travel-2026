import { describe, expect, it } from 'vitest';
import { buildIcs } from '../lib/logic/ics';
import type { Alarm } from '../lib/model/types';

const trip = { id: 'cn26', title: 'China 2026' };
const alarm = (over: Partial<Alarm> = {}): Alarm => ({
  id: 'a', tripId: 'cn26', date: '2026-11-29', time: '19:45',
  title: 'FORBIDDEN CITY tickets — 20:00 Beijing time',
  why: 'Release is exactly 7 days ahead.', done: false, ...over,
});

describe('buildIcs', () => {
  const ics = buildIcs([alarm()], trip, '2026-07-24T12:00:00.000Z');

  it('emits a valid calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('uses floating local times — an alarm rings at the wall-clock time', () => {
    expect(ics).toContain('DTSTART:20261129T194500');
    expect(ics).not.toContain('DTSTART:20261129T194500Z');
  });

  it('adds a 30-minute display alarm', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT30M');
  });

  it('escapes commas and semicolons per RFC 5545', () => {
    const out = buildIcs([alarm({ title: 'Pack: shoes, wraps; mouthguard' })], trip, '2026-07-24T12:00:00.000Z');
    expect(out).toContain('shoes\\, wraps\\; mouthguard');
  });

  it('strips md-lite markup from summaries', () => {
    const out = buildIcs([alarm({ title: '**VISA-CRITICAL** train' })], trip, '2026-07-24T12:00:00.000Z');
    expect(out).toContain('SUMMARY:VISA-CRITICAL train');
    expect(out).not.toContain('**');
  });

  it('folds lines longer than 75 octets', () => {
    const long = 'x'.repeat(200);
    const out = buildIcs([alarm({ title: long })], trip, '2026-07-24T12:00:00.000Z');
    for (const line of out.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('never rolls an end time past midnight', () => {
    const out = buildIcs([alarm({ time: '23:30' })], trip, '2026-07-24T12:00:00.000Z');
    expect(out).toContain('DTEND:20261129T233000');
  });

  it('namespaces UIDs by trip so two trips never collide', () => {
    expect(ics).toContain('UID:livingthedream-cn26-20261129-0@trip.local');
  });
});

/* EXACT TIMES (Reminders, Part 5): given the trip's zone plan, every time is
   the instant it will be where the traveller stands, so a calendar that
   imports the file in Tel Aviv still rings at Beijing's 19:45. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppBackup, FlightBooking } from '../lib/model/types';
import { zonePlan } from '../lib/logic/tripzone';
import { leaveLead } from '../lib/logic/notify';

describe('buildIcs with the trip zone plan', () => {
  const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
    .trips[0]!;
  const israel = (ms: number): number => (ms < Date.UTC(2026, 9, 24, 23, 0) ? 180 : 120);
  const zone = zonePlan(china.bookings, Date.UTC(2026, 9, 1, 9), israel);
  /* As the To-do screen hands them over (Todo.svelte): never a cancelled
     flight, never the OTHER way of a journey — since 2026-10-17 that is CA8609,
     still booked but to refund once MU394 is. MU394 itself goes in. */
  const flights = china.bookings.filter((b): b is FlightBooking => b.kind === 'flight' && b.status !== 'cancelled' && !b.alternative);

  it('writes an alarm as its UTC instant', () => {
    const out = buildIcs([alarm({ date: '2026-12-10', time: '19:45' }), alarm({ date: '2026-11-22', time: '09:30' })], trip, '2026-09-29T12:00:00.000Z', { zone });
    expect(out).toContain('DTSTART:20261210T114500Z');
    expect(out).toContain('DTSTART:20261122T013000Z');
  });

  it('adds each flight from departure to arrival, with a leave-now alarm', () => {
    const out = buildIcs([], trip, '2026-09-29T12:00:00.000Z', { zone, flights, leaveLead });
    expect(out).toContain('SUMMARY:CA 8641 PKX→YNT');
    expect(out).toContain('DTSTART:20261122T070000Z');
    expect(out).toContain('DTEND:20261122T082000Z');
    expect(out).toContain('TRIGGER:-PT120M');
    expect(out).toContain('SUMMARY:EY 888 AUH→PKX');
    expect(out).toContain('TRIGGER:-PT180M');
    expect(out.match(/BEGIN:VEVENT/g)?.length).toBe(9);
    expect(out).toContain('SUMMARY:MU 394 PVG→DYG');
    expect(out).not.toContain('SUMMARY:CA 8609');
  });

  it('keeps the old floating form when no zone plan is given', () => {
    const out = buildIcs([alarm()], trip, '2026-09-29T12:00:00.000Z');
    expect(out).toContain('DTSTART:20261129T194500');
    expect(out).not.toContain('T194500Z');
  });
});

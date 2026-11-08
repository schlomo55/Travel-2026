import { describe, expect, it } from 'vitest';
import { buildIcs } from '../lib/logic/ics';
import type { Alarm } from '../lib/model/types';

const trip = { id: 'dm27', title: 'TEST — Demo China' };
const alarm = (over: Partial<Alarm> = {}): Alarm => ({
  id: 'a', tripId: 'dm27', date: '2027-03-23', time: '19:45',
  title: 'SHANGHAI MUSEUM tickets — 20:00 Shanghai',
  why: 'Released 7 days ahead and they go fast.', done: false, ...over,
});

describe('buildIcs', () => {
  const ics = buildIcs([alarm()], trip, '2026-07-24T12:00:00.000Z');

  it('emits a valid calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('uses floating local times — an alarm rings at the wall-clock time', () => {
    expect(ics).toContain('DTSTART:20270323T194500');
    expect(ics).not.toContain('DTSTART:20270323T194500Z');
  });

  it('adds a 30-minute display alarm', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT30M');
  });

  it('escapes commas and semicolons per RFC 5545', () => {
    const out = buildIcs([alarm({ title: 'Pack: indoor shoes, rain shell; the cash envelope' })], trip, '2026-07-24T12:00:00.000Z');
    expect(out).toContain('indoor shoes\\, rain shell\\; the cash envelope');
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
    expect(out).toContain('DTEND:20270323T233000');
  });

  it('namespaces UIDs by trip so two trips never collide', () => {
    expect(ics).toContain('UID:livingthedream-dm27-20270323-0@trip.local');
  });
});

/* EXACT TIMES (Reminders, Part 5): given the trip's zone plan, every time is
   the instant it will be where the traveller stands, so a calendar that
   imports the file in Paris still rings at Shanghai's 19:45. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppBackup, FlightBooking } from '../lib/model/types';
import { zonePlan } from '../lib/logic/tripzone';
import { leaveLead } from '../lib/logic/notify';

describe('buildIcs with the trip zone plan', () => {
  const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
    .trips[0]!;
  /* home is Paris: CET (+1) until the last Sunday of March, then CEST (+2) */
  const paris = (ms: number): number => (ms < Date.UTC(2027, 2, 28, 1, 0) ? 60 : 120);
  const zone = zonePlan(demo.bookings, Date.UTC(2027, 1, 20, 9), paris);
  /* As the To-do screen hands them over (Todo.svelte): never a cancelled
     flight (MU5003 from Pudong), never the OTHER way of a journey (an
     alternative). MU5001, which replaced it, goes in. */
  const flights = demo.bookings.filter((b): b is FlightBooking => b.kind === 'flight' && b.status !== 'cancelled' && !b.alternative);

  it('writes an alarm as its UTC instant', () => {
    /* in China (UTC+8) both: the museum release, and the morning after landing */
    const out = buildIcs([alarm({ date: '2027-03-23', time: '19:45' }), alarm({ date: '2027-03-20', time: '09:30' })], trip, '2027-02-20T12:00:00.000Z', { zone });
    expect(out).toContain('DTSTART:20270323T114500Z');
    expect(out).toContain('DTSTART:20270320T013000Z');
    /* still at home in Paris (CET, UTC+1) the day before departure */
    expect(buildIcs([alarm({ date: '2027-03-18', time: '20:00' })], trip, '2027-02-20T12:00:00.000Z', { zone })).toContain('DTSTART:20270318T190000Z');
  });

  it('adds each flight from departure to arrival, with a leave-now alarm', () => {
    const out = buildIcs([], trip, '2027-02-20T12:00:00.000Z', { zone, flights, leaveLead });
    expect(out).toContain('SUMMARY:MU 5001 SHA→TXN');
    expect(out).toContain('DTSTART:20270404T111000Z'); // 19:10 Shanghai
    expect(out).toContain('DTEND:20270404T122500Z'); // 20:25 Huangshan
    expect(out).toContain('TRIGGER:-PT120M');
    expect(out).toContain('SUMMARY:AY 9057 HEL→PVG');
    expect(out).toContain('TRIGGER:-PT180M');
    /* AY 1501, AY 9057, MU 5001, 3U 9001, 3U 9003, CZ 9005, AY 9070, AY 1506 */
    expect(out.match(/BEGIN:VEVENT/g)?.length).toBe(8);
    expect(out).not.toContain('SUMMARY:MU 5003');
  });

  it('keeps the old floating form when no zone plan is given', () => {
    const out = buildIcs([alarm()], trip, '2027-02-20T12:00:00.000Z');
    expect(out).toContain('DTSTART:20270323T194500');
    expect(out).not.toContain('T194500Z');
  });
});

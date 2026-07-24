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
    expect(ics).toContain('UID:sojourn-cn26-20261129-0@trip.local');
  });
});

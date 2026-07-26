import { describe, expect, it } from 'vitest';
import { currentStop, resolveDay } from '../lib/logic/day';
import type { DayDefault, DayPlan, Stop } from '../lib/model/types';

const stop = (id: string, start: string, end: string, kind: Stop['kind'] = 'stop'): Stop => ({
  id, tripId: 't', kind, name: id, hue: 0, start, end, blocks: [], recoBlocks: [], order: 0,
});

const stops: Stop[] = [
  stop('flights', '2026-11-21', '2026-11-22', 'transit'),
  stop('kunyu', '2026-11-22', '2026-12-05'),
  stop('beijing', '2026-12-05', '2026-12-09'),
];

describe('currentStop', () => {
  it('uses [start, end) so a handover day belongs to the arriving stop', () => {
    expect(currentStop(stops, '2026-12-04')?.id).toBe('kunyu');
    expect(currentStop(stops, '2026-12-05')?.id).toBe('beijing');
  });
  it('ignores transit pseudo-stops', () => {
    expect(currentStop(stops, '2026-11-21')).toBeNull();
  });
  it('returns null outside every stop', () => {
    expect(currentStop(stops, '2026-12-20')).toBeNull();
  });
});

describe('resolveDay', () => {
  const plans: DayPlan[] = [
    { id: 'd1', tripId: 't', date: '2026-11-29', title: 'Sunday errands', planItems: ['Forbidden City tickets'] },
    { id: 'd2', tripId: 't', date: '2026-12-11', title: 'Travel day', planItems: ['Fly'], runbookId: 'run-dec11' },
  ];
  const defaults: DayDefault[] = [
    { id: 'wk', tripId: 't', stopId: 'kunyu', weekdays: [1, 2, 3, 4, 5, 6], title: 'Training day', planItems: ['6am run'] },
    { id: 'su', tripId: 't', stopId: 'kunyu', weekdays: [0], title: 'Sunday off', planItems: ['Rest'] },
  ];

  it('prefers an explicit day plan over any default', () => {
    const r = resolveDay('2026-11-29', plans, defaults, stops); // a Sunday inside Kunyu
    expect(r?.title).toBe('Sunday errands');
    expect(r?.fromDefault).toBe(false);
  });

  it('falls back to the weekday default inside the stop', () => {
    const mon = resolveDay('2026-11-23', plans, defaults, stops);
    expect(mon?.title).toBe('Training day');
    expect(mon?.fromDefault).toBe(true);
  });

  it('picks the Sunday default on Sundays', () => {
    expect(resolveDay('2026-11-22', plans, defaults, stops)?.title).toBe('Sunday off');
  });

  it('does not apply a stop default outside that stop', () => {
    expect(resolveDay('2026-12-07', plans, defaults, stops)).toBeNull();
  });

  it('carries the runbook link through', () => {
    expect(resolveDay('2026-12-11', plans, defaults, stops)?.runbookId).toBe('run-dec11');
  });

  /* A weekday default beside a catch-all for the same stop must win on its day
     whatever order the two arrive in — Dexie hands them back in id order. */
  it('prefers a weekday default over a catch-all, in either array order', () => {
    const sat: DayDefault = { id: 'sat', tripId: 't', stopId: 'kunyu', weekdays: [6], title: 'Shabbat', planItems: ['Rest'] };
    const any: DayDefault = { id: 'any', tripId: 't', stopId: 'kunyu', title: 'Working day', planItems: ['Train'] };
    const saturday = '2026-11-28', thursday = '2026-11-26';
    expect(resolveDay(saturday, [], [sat, any], stops)?.title).toBe('Shabbat');
    expect(resolveDay(saturday, [], [any, sat], stops)?.title).toBe('Shabbat');
    expect(resolveDay(thursday, [], [any, sat], stops)?.title).toBe('Working day');
  });

  it('prefers a stop default over a trip-wide one', () => {
    const wide: DayDefault = { id: 'wide', tripId: 't', title: 'Anywhere', planItems: ['x'] };
    const here: DayDefault = { id: 'here', tripId: 't', stopId: 'kunyu', title: 'At Kunyu', planItems: ['y'] };
    expect(resolveDay('2026-11-26', [], [wide, here], stops)?.title).toBe('At Kunyu');
    expect(resolveDay('2026-12-20', [], [wide, here], stops)?.title).toBe('Anywhere');
  });
});

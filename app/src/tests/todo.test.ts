/* TO DO, FOLDED INTO TIME — each thing on its day, everything past in one
   Earlier group (kept, never claimed done or not), and a count of what is
   still open from today on. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Task } from '../lib/model/types';
import { todoNext, todoOn, todoPlan } from '../lib/logic/todo';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const plan = todoPlan(china.tasks, china.alarms, china.bookings, '2026-12-11');

describe('to do · the real trip on Fri 11 Dec', () => {
  it('puts today’s alarm on today, and the 重庆1949 to-do on its own day', () => {
    const today = todoOn(plan, '2026-12-11');
    expect(today.some((i) => i.kind === 'alarm' && i.time === '11:00')).toBe(true);
    const sat = todoOn(plan, '2026-12-12');
    expect(sat.map((i) => i.id)).toContain(china.tasks.find((t) => /1949/.test(t.title))!.id);
  });

  it('carries the bookings still to buy on their days — Tianmen on the 14th', () => {
    const mon = todoOn(plan, '2026-12-14');
    const tianmen = mon.find((i) => i.id === 'cn26-ticket-tianmen');
    expect(tianmen?.kind).toBe('booking');
    /* a booked thing is not a to-do, and an either/or leg is never one */
    const all = plan.days.flatMap((d) => d.items);
    expect(all.some((i) => i.booking?.status === 'booked')).toBe(false);
    expect(all.some((i) => i.booking?.alternative)).toBe(false);
  });

  /* 28 → 24 on 27–28 Sep 2026: lijiang-bagtransfer, yantai-flights (CA1560
     booked), yantai-bed (the Muping night booked), psb (the school registers
     you) and late-arrivals closed, and cash-plan opened (no ATM in China, due
     12 Oct) — the rehearsal's to-do count carries the same history. */
  it('folds everything before today into Earlier, newest first, all 25 to-dos accounted for', () => {
    const tasks = [...plan.earlier, ...plan.days.flatMap((d) => d.items), ...plan.undated].filter((i) => i.kind === 'task');
    expect(tasks).toHaveLength(25); // +1 on 29 Sep: muping-late-arrival
    expect(plan.earlier.filter((i) => i.kind === 'task')).toHaveLength(24);
    const dates = plan.earlier.map((i) => i.date!);
    expect([...dates].sort().reverse()).toEqual(dates);
    /* none of them are ticked in the trip file, so all 24 are late */
    expect(plan.earlier.filter((i) => i.late)).toHaveLength(24);
  });

  it('orders a day by the clock, untimed last', () => {
    for (const d of plan.days) {
      const times = d.items.map((i) => i.time ?? '99:99');
      expect([...times].sort()).toEqual(times);
    }
  });

  it('counts what is still open from today on', () => {
    const open = plan.days.flatMap((d) => d.items).filter((i) => !i.done).length;
    expect(plan.comingUp).toBe(open);
    expect(plan.comingUp).toBeGreaterThan(5);
  });

  it('the tile holds the first open thing from today, and how many are late', () => {
    const n = todoNext(plan);
    expect(n.item?.date).toBe('2026-12-11');
    expect(n.late).toBe(24);
  });
});

describe('to do · the rules', () => {
  const t = (id: string, due: string | undefined, done = false): Task => ({
    id,
    tripId: 't',
    title: id,
    ...(due ? { due } : {}),
    priority: 2,
    done,
    order: 0,
  });

  it('a to-do with no date sits in its own group', () => {
    const p = todoPlan([t('a', undefined), t('b', '2027-01-02')], [], [], '2027-01-01');
    expect(p.undated.map((i) => i.id)).toEqual(['a']);
    expect(p.days.map((d) => d.date)).toEqual(['2027-01-02']);
  });

  it('a done to-do stays on its day, ticked, and is not counted as coming up', () => {
    const p = todoPlan([t('a', '2027-01-02', true), t('b', '2027-01-02')], [], [], '2027-01-01');
    expect(p.days[0]!.items.map((i) => i.done)).toEqual([true, false]);
    expect(p.comingUp).toBe(1);
    expect(todoNext(p).item?.id).toBe('b');
  });

  it('with nothing dated ahead, the tile falls back to the undated list', () => {
    const p = todoPlan([t('a', undefined)], [], [], '2027-01-01');
    expect(todoNext(p).item?.id).toBe('a');
    expect(todoNext(todoPlan([], [], [], '2027-01-01'))).toEqual({ item: null, late: 0 });
  });
});

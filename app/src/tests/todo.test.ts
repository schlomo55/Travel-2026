/* TO DO, FOLDED INTO TIME — each thing on its day, everything past in one
   Earlier group (kept, never claimed done or not), and a count of what is
   still open from today on. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Task } from '../lib/model/types';
import { dueNote, todoNext, todoOn, todoPlan } from '../lib/logic/todo';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const plan = todoPlan(demo.tasks, demo.alarms, demo.bookings, '2027-03-21');

describe('to do · the demo trip on Sun 21 Mar, the school’s first day', () => {
  it('puts today’s alarm on today, and the museum-tickets to-do on its own day', () => {
    const today = todoOn(plan, '2027-03-21');
    /* 10:00 — be in the inn lobby, the school collects you from 10:30 */
    expect(today.some((i) => i.kind === 'alarm' && i.time === '10:00')).toBe(true);
    const tue = todoOn(plan, '2027-03-23');
    expect(tue.map((i) => i.id)).toContain(demo.tasks.find((t) => /Shanghai Museum East tickets/.test(t.title))!.id);
  });

  it('carries the bookings still to buy on their days — the park pass on the 5th', () => {
    const mon = todoOn(plan, '2027-04-05');
    const pass = mon.find((i) => i.id === 'dm27-ticket-park-pass');
    expect(pass?.kind).toBe('booking');
    /* a booked thing is not a to-do, and an either/or leg is never one */
    const all = plan.days.flatMap((d) => d.items);
    expect(demo.bookings.some((b) => b.alternative)).toBe(true);
    expect(all.some((i) => i.booking?.status === 'booked')).toBe(false);
    expect(all.some((i) => i.booking?.alternative)).toBe(false);
  });

  /* The demo has 12 to-dos, every one dated. Five fall before Mar 21 —
     insurance (Jan 15, done), the concert (Feb 1, done), the eSIM (Mar 10),
     the school cash (Mar 17) and the Suzhou train (Mar 19) — so five land in
     Earlier, and the three still open there are late. */
  it('folds everything before today into Earlier, newest first, all 12 to-dos accounted for', () => {
    const tasks = [...plan.earlier, ...plan.days.flatMap((d) => d.items), ...plan.undated].filter((i) => i.kind === 'task');
    expect(tasks).toHaveLength(12);
    expect(plan.earlier.filter((i) => i.kind === 'task')).toHaveLength(5);
    const dates = plan.earlier.map((i) => i.date!);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(plan.earlier.filter((i) => i.late)).toHaveLength(3);
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
    expect(n.item?.date).toBe('2027-03-21');
    expect(n.late).toBe(3);
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

/* QA, 7 Nov 2026: overdue to-dos were folded away at the bottom ("Earlier · 5
   to-dos"), ticked ones stayed in the open list, and the due line read "due
   resolved 29 Sep — nothing left to chase", "due decide", "due Nov 10· 10 Nov". */
describe('to do · overdue first, done out of the way', () => {
  const t = (id: string, due: string | undefined, done = false): Task => ({ id, tripId: 't', title: id, ...(due ? { due } : {}), priority: 2, done, order: 0 });

  it('lists what is late and still open as overdue, oldest first — the tile counts the same', () => {
    const p = todoPlan([t('b', '2027-01-05'), t('a', '2027-01-02'), t('ok', '2027-01-03', true), t('next', '2027-01-12')], [], [], '2027-01-10');
    expect(p.overdue.map((i) => i.id)).toEqual(['a', 'b']);
    expect(p.overdue.every((i) => i.late && !i.done)).toBe(true);
    expect(todoNext(p).late).toBe(2);
  });

  it('gathers every ticked to-do, past or ahead, in Done — and never as overdue', () => {
    const p = todoPlan([t('past', '2027-01-02', true), t('ahead', '2027-01-20', true), t('open', '2027-01-20')], [], [], '2027-01-10');
    expect(p.done.map((i) => i.id)).toEqual(['past', 'ahead']);
    expect(p.overdue).toEqual([]);
    expect(p.comingUp).toBe(1);
  });

  it('a past alarm is a moment gone by, not an overdue to-do', () => {
    const p = todoPlan([], [{ id: 'al', tripId: 't', date: '2027-01-02', time: '09:00', title: 'al', done: false }], [], '2027-01-10');
    expect(p.overdue).toEqual([]);
    expect(p.earlier.map((i) => i.id)).toEqual(['al']);
  });
});

describe('to do · dueNote — the label, less the date it restates', () => {
  it('drops a label that only restates the due date', () => {
    expect(dueNote('Nov 10', '2026-11-10')).toBeNull();
    expect(dueNote('by Dec 9', '2026-12-09')).toBeNull();
    expect(dueNote('~Dec 12', '2026-12-12')).toBeNull();
    expect(dueNote('10 November 2026', '2026-11-10')).toBeNull();
  });
  it('keeps what the label adds after the date', () => {
    expect(dueNote('Nov 22 — the hotel night', '2026-11-22')).toBe('the hotel night');
    expect(dueNote('Tue 1 Dec 20:00 Beijing (14:00 home)', '2026-12-01')).toBe('20:00 Beijing (14:00 home)');
    expect(dueNote('Dec 8, 19:00 — your reminder', '2026-12-08')).toBe('19:00 — your reminder');
  });
  it('keeps a label whole that is not the date, or not exactly it', () => {
    expect(dueNote('decide', '2026-12-01')).toBe('decide');
    expect(dueNote('e-Ticket offline', '2026-11-15')).toBe('e-Ticket offline');
    expect(dueNote('resolved 29 Sep — nothing left to chase', '2026-11-15')).toBe('resolved 29 Sep — nothing left to chase');
    expect(dueNote('Dec 5/6 — when sales open', '2026-12-06')).toBe('Dec 5/6 — when sales open');
    expect(dueNote('Nov 20+', '2026-11-20')).toBe('Nov 20+');
    expect(dueNote('Dec 4 → Dec 17', '2026-12-04')).toBe('Dec 4 → Dec 17');
  });
  it('with no due date the label is all there is; with no label, nothing', () => {
    expect(dueNote('pre-trip', undefined)).toBe('pre-trip');
    expect(dueNote(undefined, '2026-11-10')).toBeNull();
    expect(dueNote('  ', '2026-11-10')).toBeNull();
  });
});

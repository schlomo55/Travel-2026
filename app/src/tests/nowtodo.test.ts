/* NOW'S TO DO BLOCK — which rows the home shows (logic/nowTodo.ts) and what
   the round tick writes (lib/data/todoTick.ts).

   The rows are a slice of the To do page's own plan: overdue first (oldest
   first), then what is open today in the plan's time order, three at most
   with the overdue winning the room; nothing overdue and nothing today is an
   empty view. A previewed day reads its own day's list and is never ticked. */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/db/db';
import { tick } from '../lib/data/todoTick';
import { dueLine, nowTodo, NOW_TODO_ROWS } from '../lib/logic/nowTodo';
import { todoPlan } from '../lib/logic/todo';
import type { Alarm, AppBackup, Task } from '../lib/model/types';

const NOW = '2027-03-05';
const task = (id: string, due: string | undefined, o: Partial<Task> = {}): Task => ({
  id,
  tripId: 't-now',
  title: `Task ${id}`,
  ...(due ? { due } : {}),
  priority: 2,
  done: false,
  order: 0,
  ...o,
});
const alarm = (id: string, date: string, time: string, o: Partial<Alarm> = {}): Alarm => ({
  id,
  tripId: 't-now',
  date,
  time,
  title: `Alarm ${id}`,
  done: false,
  ...o,
});
const view = (tasks: Task[], alarms: Alarm[] = [], now = NOW, previewing = false) =>
  nowTodo(todoPlan(tasks, alarms, [], now), now, previewing);
const ids = (v: ReturnType<typeof view>): string[] => v.rows.map((r) => r.item.id);

describe('now to do · overdue first, oldest first', () => {
  it('lists what is late from the oldest day, whatever order the to-dos were written in', () => {
    const v = view([task('c', '2027-03-03', { order: 0 }), task('a', '2027-03-01', { order: 1 }), task('b', '2027-03-02', { order: 2 })]);
    expect(ids(v)).toEqual(['a', 'b', 'c']);
    expect(v.rows.every((r) => r.group === 'overdue')).toBe(true);
    expect(v.overdue).toBe(3);
    expect(v.more).toBe(0);
    expect(v.empty).toBe(false);
  });

  it('puts every overdue row before today’s, even a to-do due today that was written first', () => {
    const v = view([task('today', NOW, { order: 0 }), task('late', '2027-03-04', { order: 1 })]);
    expect(ids(v)).toEqual(['late', 'today']);
    expect(v.rows.map((r) => r.group)).toEqual(['overdue', 'today']);
  });

  it('says which day an overdue to-do was due, and keeps its own label', () => {
    const v = view([task('a', '2027-03-01', { dueLabel: 'decide' })]);
    expect(v.rows[0]!.line).toBe('Due 1 Mar · decide');
  });
});

describe('now to do · today, in time order', () => {
  it('orders today by the clock — timed first, an alarm at its time — and the untimed last', () => {
    const v = view([task('t', NOW)], [alarm('p', NOW, '14:00'), alarm('a', NOW, '09:00')]);
    expect(ids(v)).toEqual(['a', 'p', 't']);
    expect(v.rows[0]!.line).toBe('Alarm · 09:00');
    expect(v.rows[1]!.line).toBe('Alarm · 14:00');
    expect(v.rows[2]!.line).toBe('Today');
  });

  it('leaves tomorrow’s things to the To do page, and counts them as coming up', () => {
    const v = view([task('x', '2027-03-06'), task('y', '2027-03-09')], [alarm('z', '2027-03-06', '08:00')]);
    expect(v.rows).toEqual([]);
    expect(v.empty).toBe(true);
    expect(v.comingUp).toBe(3);
  });

  it('drops a to-do that is ticked done, and keeps a ticked alarm as the page does', () => {
    const v = view([task('done', NOW, { done: true }), task('open', NOW)], [alarm('cal', NOW, '10:00', { done: true })]);
    expect(ids(v)).toEqual(['cal', 'open']);
  });
});

describe('now to do · three rows, the overdue win the room', () => {
  it('shows three rows at most', () => {
    expect(NOW_TODO_ROWS).toBe(3);
    const v = view([task('1', NOW), task('2', NOW), task('3', NOW), task('4', NOW), task('5', NOW)]);
    expect(v.rows).toHaveLength(3);
    expect(v.more).toBe(2);
  });

  it('gives the room to the overdue first, and still counts all of them', () => {
    const v = view(
      [task('o1', '2027-03-01'), task('o2', '2027-03-02'), task('o3', '2027-03-03'), task('o4', '2027-03-04')],
      [alarm('a', NOW, '09:00')],
    );
    expect(ids(v)).toEqual(['o1', 'o2', 'o3']);
    expect(v.overdue).toBe(4);
    expect(v.more).toBe(2);
  });

  it('fills what the overdue leave with today’s first rows', () => {
    const v = view([task('o1', '2027-03-01')], [alarm('late', NOW, '18:00'), alarm('early', NOW, '07:30'), alarm('noon', NOW, '12:00')]);
    expect(ids(v)).toEqual(['o1', 'early', 'noon']);
    expect(v.more).toBe(1);
  });
});

describe('now to do · nothing due', () => {
  it('is empty with no to-dos at all', () => {
    const v = view([]);
    expect(v.empty).toBe(true);
    expect(v.rows).toEqual([]);
    expect(v.overdue).toBe(0);
    expect(v.more).toBe(0);
    expect(v.comingUp).toBe(0);
  });

  it('is empty when everything late was ticked and today has nothing', () => {
    const v = view([task('a', '2027-03-01', { done: true }), task('b', '2027-03-20')]);
    expect(v.empty).toBe(true);
    expect(v.comingUp).toBe(1);
  });
});

/* ---------------- the demo trip: the same slice on real days ---------------- */
const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const demoView = (now: string, previewing = false) => nowTodo(todoPlan(demo.tasks, demo.alarms, demo.bookings, now), now, previewing);

describe('now to do · the demo trip', () => {
  it('twelve days before the trip: nothing due, the rest coming up', () => {
    const v = demoView('2027-03-07');
    expect(v.empty).toBe(true);
    expect(v.comingUp).toBeGreaterThan(10);
  });

  it('Mar 21, the school’s first day: the three late to-dos, oldest first, then today’s alarm does not fit', () => {
    const v = demoView('2027-03-21');
    expect(ids(v)).toEqual(['dm27-task-esim', 'dm27-task-school-cash', 'dm27-task-suzhou-train']);
    expect(v.overdue).toBe(3);
    expect(v.more).toBe(1);
  });

  it('the list follows the day on show: a previewed day has its own overdue and its own today', () => {
    const all = (now: string) => nowTodo(todoPlan(demo.tasks, demo.alarms, demo.bookings, now), now, true, 50);
    const mar23 = all('2027-03-23');
    expect(mar23.previewing).toBe(true);
    /* still the same three late to-dos, then the museum to-do's 19:45 alarm and the to-do itself — today's on the 23rd */
    expect(ids(mar23).slice(0, 3)).toEqual(['dm27-task-esim', 'dm27-task-school-cash', 'dm27-task-suzhou-train']);
    expect(ids(mar23).slice(3)).toEqual(['dm27-alarm-03', 'dm27-task-museum']);
    /* two weeks on, more has slipped behind and today is another day's list */
    const apr5 = all('2027-04-05');
    expect(apr5.overdue).toBe(7);
    expect(ids(apr5)).not.toContain('dm27-alarm-03');
    expect(apr5.rows.filter((r) => r.group === 'today').map((r) => r.item.id)).toContain('dm27-ticket-park-pass');
  });

  it('a ticket still to buy is a row of its own, a door to its pass, not a to-do', () => {
    const v = nowTodo(todoPlan(demo.tasks, demo.alarms, demo.bookings, '2027-04-05'), '2027-04-05', false, 20);
    const pass = v.rows.find((r) => r.item.id === 'dm27-ticket-park-pass');
    expect(pass?.item.kind).toBe('booking');
    expect(pass?.item.task).toBeUndefined();
    expect(pass?.line.startsWith('Booking')).toBe(true);
  });

  it('a row’s line never says "undefined"', () => {
    for (const day of ['2027-03-21', '2027-04-05', '2027-04-13']) {
      for (const r of nowTodo(todoPlan(demo.tasks, demo.alarms, demo.bookings, day), day, false, 50).rows) {
        expect(dueLine(r.item, day)).not.toMatch(/undefined|null/);
        expect(r.line).toBe(dueLine(r.item, day));
      }
    }
  });
});

/* ---------------- the tick ---------------- */
describe('the round tick', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await db.tasks.clear();
    await db.alarms.clear();
  });

  it('ticks a to-do done, says when, and takes the tick back', async () => {
    const t = task('tick-1', NOW);
    await db.tasks.put(t);
    await tick({ task: t });
    const done = await db.tasks.get('tick-1');
    expect(done?.done).toBe(true);
    expect(typeof done?.doneAt).toBe('number');
    await tick({ task: done! });
    const back = await db.tasks.get('tick-1');
    expect(back?.done).toBe(false);
    expect(back?.doneAt).toBeUndefined();
  });

  it('ticks an alarm as "in the phone’s calendar"', async () => {
    const a = alarm('tick-a', NOW, '09:00');
    await db.alarms.put(a);
    await tick({ alarm: a });
    expect((await db.alarms.get('tick-a'))?.done).toBe(true);
  });

  it('writes nothing on a previewed day — a tick, or taking one back', async () => {
    const t = task('tick-2', NOW);
    const a = alarm('tick-b', NOW, '09:00', { done: true });
    await db.tasks.put(t);
    await db.alarms.put(a);
    await tick({ task: t }, true);
    await tick({ alarm: a }, true);
    expect((await db.tasks.get('tick-2'))?.done).toBe(false);
    expect((await db.alarms.get('tick-b'))?.done).toBe(true);
  });
});

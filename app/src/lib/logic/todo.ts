/* TO DO, FOLDED INTO TIME (f-todo) — the to-dos, the phone alarms and the
   bookings still to buy, each on the day it belongs to.

   · a to-do sits on its due date, an alarm on its date, a booking that is
     still PENDING on the day it is for (the Tianmen ticket on 14 Dec);
   · everything dated before today folds into ONE "Earlier" group — it is
     kept, never deleted, and never claimed done or not: it is shown as it is;
   · a to-do with no date sits last, in its own group;
   · "coming up" counts what is still open from today on.

   Pure: the lists and today in, the plan out. The screen draws it; Now's
   day view reads its own day out of the same plan, so a to-do shows on its
   day in both places and can never disagree with itself. */
import type { Alarm, Booking, ISODate, Task } from '../model/types';
import { compareIso } from './dates';

export type TodoKind = 'task' | 'alarm' | 'booking';
export interface TodoItem {
  kind: TodoKind;
  id: string;
  date: ISODate | null;
  /** the clock the record states — an alarm's, a leg's departure, a ticket's */
  time?: string;
  done: boolean;
  /** a to-do whose date has gone by and is still open */
  late: boolean;
  task?: Task;
  alarm?: Alarm;
  booking?: Booking;
}
export interface TodoDay {
  date: ISODate;
  items: TodoItem[];
}
export interface TodoPlan {
  earlier: TodoItem[];
  days: TodoDay[];
  undated: TodoItem[];
  /** open items from today on */
  comingUp: number;
}

function bookingTime(b: Booking): string | undefined {
  if (b.kind === 'activity') return b.time;
  if ('dep' in b && typeof b.dep === 'string') return b.dep || undefined;
  return undefined;
}

/** Timed first, in clock order; then the rest as they came. */
const byTime = (a: TodoItem, b: TodoItem): number =>
  a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0;

export function todoPlan(tasks: Task[], alarms: Alarm[], bookings: Booking[], now: ISODate): TodoPlan {
  const all: TodoItem[] = [
    ...[...tasks]
      .sort((a, b) => a.order - b.order)
      .map(
        (t): TodoItem => ({
          kind: 'task',
          id: t.id,
          date: t.due ?? null,
          done: t.done,
          late: !t.done && !!t.due && compareIso(t.due, now) < 0,
          task: t,
        }),
      ),
    ...alarms.map(
      (a): TodoItem => ({ kind: 'alarm', id: a.id, date: a.date, time: a.time, done: a.done, late: false, alarm: a }),
    ),
    ...bookings
      .filter((b) => b.status === 'pending' && !b.alternative)
      .map((b): TodoItem => {
        const time = bookingTime(b);
        return { kind: 'booking', id: b.id, date: b.date, ...(time ? { time } : {}), done: false, late: false, booking: b };
      }),
  ];

  const earlier = all
    .filter((i) => i.date !== null && compareIso(i.date, now) < 0)
    .sort((a, b) => compareIso(b.date!, a.date!) || byTime(a, b));
  const byDay = new Map<ISODate, TodoItem[]>();
  for (const i of all) {
    if (i.date === null || compareIso(i.date, now) < 0) continue;
    byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => compareIso(a, b))
    .map(([date, items]) => ({ date, items: items.sort(byTime) }));
  const undated = all.filter((i) => i.date === null);
  const comingUp = days.reduce((n, d) => n + d.items.filter((i) => !i.done).length, 0);
  return { earlier, days, undated, comingUp };
}

/** One day's items, as the day view shows them. */
export function todoOn(plan: TodoPlan, date: ISODate): TodoItem[] {
  return plan.days.find((d) => d.date === date)?.items ?? [];
}

/** What the TO DO tile holds: the first open item from today on, and how
    many to-dos before today are still open. */
export function todoNext(plan: TodoPlan): { item: TodoItem | null; late: number } {
  const item = plan.days.flatMap((d) => d.items).find((i) => !i.done) ?? plan.undated.find((i) => !i.done) ?? null;
  return { item, late: plan.earlier.filter((i) => i.late).length };
}

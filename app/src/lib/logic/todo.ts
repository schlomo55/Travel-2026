/* TO DO, FOLDED INTO TIME (f-todo) — the to-dos, the phone alarms and the
   bookings still to buy, each on the day it belongs to.

   · a to-do sits on its due date, an alarm on its date, a booking that is
     still PENDING on the day it is for (the Tianmen ticket on 14 Dec) — or,
     a ticket the traveller gave a book-by (logic/reserveby.ts), on THAT
     moment instead: the same row, moved and reworded ("Book: … — for Sun 6
     Dec"), never a second one; past it and still pending, it is late;
   · everything dated before today is kept, never deleted; what of it is
     still open and late is OVERDUE, and leads the screen in red, never folded
     away (owner, QA 7 Nov 2026); the rest folds into one "Earlier" group;
   · a to-do ticked done leaves the open lists for its own "Done" group;
   · a to-do with no date sits last, in its own group;
   · "coming up" counts what is still open from today on.

   Pure: the lists and today in, the plan out. The screen draws it; Now's
   day view reads its own day out of the same plan, so a to-do shows on its
   day in both places and can never disagree with itself. */
import type { Alarm, Booking, ISODate, Task } from '../model/types';
import { compareClock, compareIso, fmtDow } from './dates';
import { bookByOf } from './reserveby';
import { plainWords } from './mdlite';
import { S } from '../i18n/strings';

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
  /** a ticket's row moved to its book-by: the day the ticket is FOR */
  bookFor?: ISODate;
}
export interface TodoDay {
  date: ISODate;
  items: TodoItem[];
}
export interface TodoPlan {
  /** everything dated before today — kept, as it is */
  earlier: TodoItem[];
  /** of those, what is still open and late: shown FIRST, in red, oldest first */
  overdue: TodoItem[];
  /** every to-do ticked done, whatever its date: out of the open lists */
  done: TodoItem[];
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
  a.time && b.time ? compareClock(a.time, b.time) : a.time ? -1 : b.time ? 1 : 0;

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
        const by = bookByOf(b);
        if (by) {
          const late = compareIso(by.date, now) < 0;
          return { kind: 'booking', id: b.id, date: by.date, ...(by.time ? { time: by.time } : {}), done: false, late, booking: b, bookFor: b.date };
        }
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
  const overdue = earlier.filter((i) => i.late).reverse();
  const done = all.filter((i) => i.kind === 'task' && i.done);
  return { earlier, overdue, done, days, undated, comingUp };
}

/** A row's md-lite title, as every screen that lists to-dos draws it. */
export function todoTitle(it: TodoItem): string {
  if (it.booking && it.bookFor) return S.bookBy.todo(it.booking.title, fmtDow(it.bookFor));
  return it.task?.title ?? it.alarm?.title ?? it.booking?.title ?? '';
}

/** One day's items, as the day view shows them. */
export function todoOn(plan: TodoPlan, date: ISODate): TodoItem[] {
  return plan.days.find((d) => d.date === date)?.items ?? [];
}

/* ONE LINE FOR ONE THING (QA, 10 Nov 2026: "On this day" listed a to-do and its
   alarm twice). A to-do and an alarm on the same day are the same thing when
   the alarm was made FOR that to-do (its `ref`, the Remind me sheet's link —
   the link decides whenever there is one), else when they say exactly the same
   in words (md-lite, a leading emoji and case off). The alarm stays: of the two
   it is the one with a clock. Another day's twin, a different line, a booking,
   two to-dos or two alarms with one text: all kept. */
const same = (it: TodoItem): string => plainWords(todoTitle(it)).toLowerCase();
export const foldReminders = (items: TodoItem[]): TodoItem[] =>
  items.filter(
    (t) =>
      !t.task ||
      !items.some((a) => {
        const w = a.alarm && (a.alarm.ref?.id ?? same(a));
        return w && a.date === t.date && (w === t.id || w === same(t));
      }),
  );

/** What the TO DO tile holds: the first open item from today on, and how
    many to-dos before today are still open. */
export function todoNext(plan: TodoPlan): { item: TodoItem | null; late: number } {
  const item = plan.days.flatMap((d) => d.items).find((i) => !i.done) ?? plan.undated.find((i) => !i.done) ?? null;
  return { item, late: plan.overdue.length };
}

/* A TO-DO'S OWN LABEL, LESS THE DATE IT RESTATES. `dueLabel` is free text —
   "Nov 10", "by Dec 9", "Tue 1 Dec 20:00 Beijing", "decide", "e-Ticket
   offline" — and was printed as "due <label>" beside the date again: "due
   Nov 10· 10 Nov", "due decide" (QA, 7 Nov 2026). This takes off a leading
   restatement of the due date itself (with its "by", "~" or weekday) and
   keeps whatever else the label says; a label that says only the date says
   nothing more (null). A date it does not restate exactly — "Dec 5/6",
   "Nov 20+", "Dec 4 → Dec 17" — is kept whole. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dueNote(label: string | undefined, due: ISODate | undefined): string | null {
  const l = label?.trim();
  if (!l) return null;
  if (!due) return l;
  const d = Number(due.slice(8));
  const m = MONTHS[Number(due.slice(5, 7)) - 1];
  const re = new RegExp(`^(?:by |due )?[~≈]?(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? )?(?:${m}[a-z]* ${d}|${d} ${m}[a-z]*)(?:,? \\d{4})?(?![\\d/+]|\\s*[→–-]\\s*[A-Z\\d])`, 'i');
  const rest = l.replace(re, '').replace(/^[\s,—–·:-]+/, '');
  return rest === l ? l : rest || null;
}

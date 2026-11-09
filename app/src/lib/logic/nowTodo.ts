/* WHICH TO-DOS SHOW ON NOW — the home's own slice of the To do plan.

   The To do page (logic/todo.ts todoPlan) already decides what is overdue,
   what sits on which day and what is still open; this takes ITS answer and
   picks the few rows the home has room for, so the two can never disagree:

   · OVERDUE first, oldest first — the plan's own Overdue group, in red;
   · then what is open on TODAY, in the plan's own time order (timed first, an
     alarm at its clock, then the rest as they came);
   · at most NOW_TODO_ROWS rows in all, overdue winning the room;
   · nothing overdue and nothing today = an empty view (the screen says one
     quiet line), never a list of tomorrow's things.

   `now` is whichever day the app is showing — the previewed date when one is
   chosen — and the plan was built for that same day, so a preview reads its
   own day's list. A previewed day is looked at, never ticked: `previewing`
   rides along for the screen to lock the round tick (the same rule as the
   runbook's, lib/data/checks.ts setCheck).

   Pure: the plan and the day in, the rows out. The screen draws them. */
import type { ISODate } from '../model/types';
import { compareIso, fmtShort } from './dates';
import { dueNote, todoOn, type TodoItem, type TodoPlan } from './todo';
import { S } from '../i18n/strings';

/** The home has room for three rows. */
export const NOW_TODO_ROWS = 3;

export interface NowTodoRow {
  item: TodoItem;
  group: 'overdue' | 'today';
  /** the row's second line: "Due 8 Nov · decide", "Alarm · 09:00", "Book by · 14:00" */
  line: string;
}

export interface NowTodoView {
  rows: NowTodoRow[];
  /** every overdue item, not only the ones with a row */
  overdue: number;
  /** overdue + today that did not fit */
  more: number;
  /** open items from today on — the To do page's own count */
  comingUp: number;
  /** nothing overdue and nothing due today */
  empty: boolean;
  previewing: boolean;
}

/** Same rule as the To do page: a ticked to-do leaves the open lists. */
const open = (i: TodoItem): boolean => !(i.kind === 'task' && i.done);

/** A row's second line — the To do page's own wording, one line long. An alarm
    is only ever on its own day (the plan never calls one late), so it never
    needs a date; a ticket or a to-do that is overdue says which day it was for. */
export function dueLine(it: TodoItem, now: ISODate): string {
  const when = it.date && compareIso(it.date, now) < 0 ? fmtShort(it.date) : '';
  if (it.alarm) return `${S.todo.alarm} · ${it.alarm.time}`;
  const t = it.task;
  const lead = it.booking ? (it.bookFor ? S.bookBy.caps : S.todo.booking) : when ? S.glance.due(when) : S.glance.today;
  return [lead, it.booking ? it.time : dueNote(t?.dueLabel, t?.due), it.booking && it.bookFor ? when : ''].filter(Boolean).join(' · ');
}

export function nowTodo(plan: TodoPlan, now: ISODate, previewing = false, limit = NOW_TODO_ROWS): NowTodoView {
  /* the plan's Overdue group is oldest first already; sorting by date again
     (stable) keeps it so, and a day's own order is the plan's, as on the page */
  const late = [...plan.overdue].sort((a, b) => compareIso(a.date ?? '', b.date ?? ''));
  const today = todoOn(plan, now).filter(open);
  const row = (group: NowTodoRow['group']) => (item: TodoItem): NowTodoRow => ({ item, group, line: dueLine(item, now) });
  const rows = [...late.map(row('overdue')), ...today.map(row('today'))].slice(0, limit);
  return {
    rows,
    overdue: late.length,
    more: late.length + today.length - rows.length,
    comingUp: plan.comingUp,
    empty: late.length + today.length === 0,
    previewing,
  };
}

/* TRIP TEMPLATE · admin.ts — tasks, alarms, wallet, packing, checklists,
   budget categories, expenses and the trip note.

   BRIEF SECTION → HERE
     §2/§3/§5 every ⏳ OPEN line → buildTasks(), one task per open item, due on
                                  the brief's "by <date>"
     §6 Rules I care about       → repeated in the `detail` of the task each
                                  rule constrains, so future-you sees the
                                  constraint at the moment of booking
     §7 Insurance / practical    → buildWalletCards()
     §7 Alarms                   → buildAlarms()
     §7 Packing                  → buildPackingItems()
     §1 Budget                   → buildCategories(), which MUST sum to
                                  trip.budgetTotalMinor

   THE ⏳ OPEN → TASK CONTRACT. Every `⏳ OPEN` line in the brief produces TWO
   records: the pending placeholder in bookings.ts (which draws the amber chip)
   and a Task here (which carries the deadline). `assert.ts` takes the pairs as
   `openItems` and refuses a build where one half is missing, or where the task
   is due AFTER the thing it is supposed to book. */
import type {
  Alarm,
  Checklist,
  Expense,
  ExpenseCategory,
  PackingItem,
  Task,
  TripNote,
  WalletCard,
} from '../../src/lib/model/types';
import { toHomeMinor } from '../../src/lib/logic/money';
import { SEED_TS, SLUG, id } from './base';

/* ── Tasks: one per ⏳ OPEN line ──────────────────────────────────────────── */

interface TaskSpec {
  key: string;
  title: string;
  /** The WHY. Paste the brief's Want: clause and any §6 rule that applies —
      the constraint is worth more at booking time than at writing time. */
  detail: string;
  /** The brief's "by <date>". Must not be after the thing it books. */
  due: string;
  /** How the date reads on screen: "Fri 15 Jan", "Overdue · 3 Jan". */
  dueLabel: string;
  /** 1 = do it now, 3 = whenever. */
  priority: 1 | 2 | 3;
  /** A plain search link, no affiliate tag and nothing personal. */
  link?: string;
}

const TASKS: TaskSpec[] = [
  {
    key: 'book-bed-second',
    title: 'FILL ME — Book the ⏳ open bed in <city>',
    detail:
      'FILL ME. Want: <the brief\'s clause, verbatim>. House rules that apply: <brief §6>. Until this is booked the segment chip stays amber.',
    due: '2027-01-02',
    dueLabel: 'FILL ME — Sat 2 Jan',
    priority: 1,
    link: 'https://www.booking.com/searchresults.html?ss=FILL%20ME',
  },
];

export function buildTasks(): Task[] {
  return TASKS.map((t, i) => ({
    id: id('task', t.key),
    tripId: SLUG,
    title: t.title,
    detail: t.detail,
    due: t.due,
    dueLabel: t.dueLabel,
    priority: t.priority,
    ...(t.link ? { link: t.link } : {}),
    done: false,
    order: i + 1,
  }));
}

/* ── Alarms ───────────────────────────────────────────────────────────────── */

/** The ONE collection allowed to reach back before departure: the pack-and-go
    reminder the evening before. Nothing may fall earlier than ALARM_EARLIEST
    in base.ts, and `assert.ts` enforces it. */
const ALARMS: [key: string, date: string, time: string, title: string, why: string][] = [
  ['pack', '2027-01-03', '18:00', 'FILL ME — Pack', 'FILL ME — why this matters tonight rather than tomorrow.'],
];

export function buildAlarms(): Alarm[] {
  return ALARMS.map(([key, date, time, title, why]) => ({
    id: id('alarm', key),
    tripId: SLUG,
    date,
    time,
    title,
    why,
    done: false, // the "put it in the phone calendar" tick
  }));
}

/* ── Wallet cards ─────────────────────────────────────────────────────────── */

/** Brief §7. `pending: true` is the wallet's own ⏳ — a card you know you need
    and do not have yet (insurance not bought, visa not issued).

    NEVER PUT A PASSPORT NUMBER HERE. `assert.ts` refuses a passport-shaped
    token outright, and the deploy gate greps the built bundle for the same
    shape. Scans and certificates belong in the on-device documents vault. */
export function buildWalletCards(): WalletCard[] {
  return [
    {
      id: id('card', 'insurance'),
      tripId: SLUG,
      emoji: '🏥',
      title: 'FILL ME — insurer',
      code: '⏳ not bought yet',
      codeLabel: 'Policy №',
      rows: [
        { k: 'Cover', v: 'FILL ME' },
        { k: 'Emergency line', v: 'FILL ME — or "see Emergency"' },
      ],
      note: 'FILL ME — or delete this card if the brief named a real policy.',
      pending: true,
      order: 1,
    },
  ];
}

/* ── Packing ──────────────────────────────────────────────────────────────── */

const PACKING: [group: string, items: [key: string, label: string][]][] = [
  [
    'Documents',
    [
      ['cards', 'FILL ME — brief §6: two payment cards, kept separately'],
      ['copies', 'Photos of everything, stored offline on the phone'],
    ],
  ],
  ['Trip-specific', [['fillme', 'FILL ME — brief §7 packing, the things this trip needs and others do not']]],
];

export function buildPackingItems(): PackingItem[] {
  return PACKING.flatMap(([group, items], gi) =>
    items.map(([key, label], ii) => ({
      id: id('pack', key),
      tripId: SLUG,
      group,
      label,
      done: false,
      order: gi * 100 + ii,
    })),
  );
}

/* ── Checklists ───────────────────────────────────────────────────────────── */

export function buildChecklists(): Checklist[] {
  return [
    {
      id: id('check', 'fly'),
      tripId: SLUG,
      title: 'Before you fly',
      note: 'All of this is easier at home than at the gate.',
      items: [
        { id: id('chk', 'maps'), label: 'Offline maps downloaded', done: false },
        { id: id('chk', 'docs'), label: 'Photos of the documents saved offline', done: false },
        { id: id('chk', 'backup'), label: 'A backup of this app exported and mailed to yourself', done: false },
      ],
      order: 1,
    },
  ];
}

/* ── Money ────────────────────────────────────────────────────────────────── */

/** Brief §1 · budget. Minor units. These MUST sum to trip.budgetTotalMinor —
    `assert.ts` checks the arithmetic, because a budget that does not add up is
    a tracker that lies quietly. If the brief gave no split, put the whole
    amount in one category rather than inventing six. */
const CATEGORIES: [key: string, label: string, planMinor: number, color: string][] = [
  ['transport', 'Transport', 40000, '#2b8a9e'],
  ['lodging', 'Lodging', 35000, '#7b5ea7'],
  ['food', 'Food', 18000, '#c2703d'],
  ['other', 'Other', 7000, '#6b7280'],
];

export function buildCategories(): ExpenseCategory[] {
  return CATEGORIES.map(([key, label, planMinor, color], i) => ({
    id: id('cat', key),
    tripId: SLUG,
    label,
    planMinor,
    color,
    order: i + 1,
  }));
}

/** Usually EMPTY on a new trip — you have not spent anything yet, and an
    invented expense is a lie in the one screen that has to be true. Included
    here only to show the shape; `rateToHome` must match trip.currencies, and
    `homeMinor` goes through the app's own `toHomeMinor` so the seed and the
    app can never disagree about the maths. */
const EXPENSES: [key: string, date: string, cat: string, desc: string, amount: number, currency: string, rate: number, payment: 'card' | 'cash'][] = [];

export function buildExpenses(): Expense[] {
  return EXPENSES.map(([key, date, cat, desc, amount, currency, rate, payment]) => ({
    id: id('exp', key),
    tripId: SLUG,
    date,
    categoryId: id('cat', cat),
    desc,
    amount,
    currency,
    rateToHome: rate,
    homeMinor: toHomeMinor(amount, rate),
    payment,
    refund: false,
    ts: SEED_TS,
  }));
}

/* ── The trip note ────────────────────────────────────────────────────────── */

export function buildNote(): TripNote {
  return {
    tripId: SLUG,
    text: 'FILL ME — the one paragraph you would want to read on the plane. What this trip is for, and what is still open.',
    updatedAt: SEED_TS,
  };
}

/* 🧪 TEMPLATE EXAMPLE · admin.ts — brief §1 (budget), §6 (rules) and §7.

   THE ⏳ OPEN → TASK HALF OF THE CONTRACT. The Lisbon bed is a pending
   placeholder in bookings.ts; here is its other half — a task due on the
   brief's "by 1 Mar 2027", carrying the Want: clause and the §6 house rules in
   its detail so the constraints are in front of you at the moment you book,
   not only at the moment you wrote them down.

   `assert.ts` takes the pair as an `openItems` entry and refuses to write the
   seed if either half is missing, or if the task is due after the thing it is
   supposed to book. */
import type {
  Alarm,
  Checklist,
  Expense,
  ExpenseCategory,
  PackingItem,
  Task,
  TripNote,
  WalletCard,
} from '../../../src/lib/model/types';
import { SEED_TS, SLUG, id } from './base';

/* ── Tasks ────────────────────────────────────────────────────────────────── */

interface TaskSpec {
  key: string;
  title: string;
  detail: string;
  due: string;
  dueLabel: string;
  priority: 1 | 2 | 3;
  link?: string;
}

const TASKS: TaskSpec[] = [
  {
    /* THE ⏳ OPEN TASK. Paired with tx00-bed-lisbon in assert.ts. */
    key: 'book-bed-lisbon',
    title: 'Book the Lisbon bed — still ⏳ open',
    detail:
      'Three nights, 14–17 Apr. **Want:** walkable to a metro station, twin beds, under €120/night, free cancellation, a quiet street. Late checkout on the 16th — the flight home is at 21:05.\n\n**House rules (brief §6):** always free-cancellable; never more than fifteen minutes\' walk from a station.\n\nUntil this is booked the Lisbon segment carries an amber coverage chip. It is not an error — it is the trip saying, accurately, that these three nights are known about and not bought.',
    due: '2027-03-01',
    dueLabel: 'Mon 1 Mar',
    priority: 1,
    link: 'https://www.booking.com/searchresults.html?ss=Lisbon',
  },
  {
    key: 'delete-me',
    title: 'Delete this example trip when you are done looking at it',
    detail:
      'It lives on the shelf beside the real trips and can be removed at any time. Its ids all start with `tx00-`, so deleting it cannot touch anything else — that is the whole reason the slug prefix exists.',
    due: '2027-04-16',
    dueLabel: 'Fri 16 Apr',
    priority: 3,
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

const ALARMS: [key: string, date: string, time: string, title: string, why: string][] = [
  ['pack', '2027-04-11', '19:00', 'Pack for the sample trip', 'The one thing allowed to sit before departure. Five days, hand luggage, one warm layer.'],
  ['airport', '2027-04-16', '18:00', 'Leave for the sample airport', 'The flight is at 21:05 and the crit runbook fires today.'],
];

export function buildAlarms(): Alarm[] {
  return ALARMS.map(([key, date, time, title, why]) => ({
    id: id('alarm', key),
    tripId: SLUG,
    date,
    time,
    title,
    why,
    done: false,
  }));
}

/* ── Wallet ───────────────────────────────────────────────────────────────── */

/** One card, deliberately `pending`. **No identity document is stored in this
    trip and none should ever be typed into one** — assert.ts refuses a
    passport-shaped token outright, and scans belong in the on-device vault. */
export function buildWalletCards(): WalletCard[] {
  return [
    {
      id: id('card', 'insurance'),
      tripId: SLUG,
      emoji: '🏥',
      title: 'Sample travel insurance',
      code: '⏳ not bought yet',
      codeLabel: 'Policy № · sample',
      rows: [
        { k: 'Insurer', v: 'Sample Insurance Co.' },
        { k: 'Cover', v: 'Sample — not a real policy' },
      ],
      note: '⏳ Left **pending** so the unresolved-card state is on screen from day one.',
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
      ['cards', 'Two payment cards, kept in two different places (brief §6)'],
      ['copies', 'Photos of everything, stored offline on the phone'],
    ],
  ],
  [
    'Five days, hand luggage',
    [
      ['shoes', 'Shoes that survive cobbles and a hill — both cities are built on one'],
      ['layer', 'One warm layer. April on the Atlantic is not April inland.'],
      ['rain', 'A light shell. It will probably rain once.'],
    ],
  ],
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
      title: 'Before you fly — sample',
      note: 'All of this is easier at home than at the gate.',
      items: [
        { id: id('chk', 'lisbon'), label: '⏳ The Lisbon bed is actually booked', done: false },
        { id: id('chk', 'maps'), label: 'Offline maps downloaded for both cities', done: false },
        { id: id('chk', 'docs'), label: 'Photos of the documents saved offline', done: false },
        { id: id('chk', 'backup'), label: 'A backup of this app exported and mailed to yourself', done: false },
      ],
      order: 1,
    },
  ];
}

/* ── Money ────────────────────────────────────────────────────────────────── */

/** Brief §1: "€900 all in". These sum to exactly 90000 minor units, and
    assert.ts checks the arithmetic. */
const CATEGORIES: [key: string, label: string, planMinor: number, color: string][] = [
  ['transport', 'Transport', 30000, '#7b5ea7'],
  ['lodging', 'Lodging', 34000, '#2b8a9e'],
  ['food', 'Food', 18000, '#c2703d'],
  ['other', 'Other', 8000, '#6b7280'],
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

/** EMPTY, on purpose. Nothing has been spent on a trip that has not happened,
    and an invented expense is a lie in the one screen that must be true. */
export function buildExpenses(): Expense[] {
  return [];
}

/* ── The trip note ────────────────────────────────────────────────────────── */

export function buildNote(): TripNote {
  return {
    tripId: SLUG,
    text:
      '🧪 **This is the worked example for the trip-brief pipeline.** It was compiled from `docs/examples/porto-lisbon-mini.brief.md` by the scaffold in `app/scripts/trip-template/`. Every reference, price and property in it is invented.\n\nIt exists to show one thing on screen: **Porto is green and Lisbon is amber.** Porto\'s bed is ✅ BOOKED; Lisbon\'s is ⏳ OPEN — a placeholder with real dates, no reference, and a task due 1 Mar carrying the shopping brief. Amber means "known about, not bought yet". A night with nothing against it at all would be a hole, and the build refuses to produce one.\n\nDelete it from the shelf whenever you like. Every id starts with `tx00-`, so nothing it does can reach another trip.',
    updatedAt: SEED_TS,
  };
}

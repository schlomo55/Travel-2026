/* Wallet cards, tasks, alarms, packing, the one checklist, the budget
   categories, three sample expenses and the trip note.

   Nothing here is a real number. The wallet cards carry deliberately
   nonsense codes, the expenses are three invented entries whose only job is to
   stop the spending tracker rendering an empty state, and the categories add up
   to exactly the trip's $3,000 sample budget.

   The home-currency amount on each expense goes through the app's own
   `toHomeMinor`, so the seed can never disagree with the app about the maths. */
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
import { SEED_TS, TRIP_ID } from './base';

export function buildWalletCards(): WalletCard[] {
  return [
    {
      id: 'il26-card-id',
      tripId: TRIP_ID,
      emoji: '🪪',
      title: 'Sample traveller · SAMPLE TRAVELER',
      code: 'SAMPLE-0000',
      codeLabel: 'Sample reference',
      rows: [
        { k: 'Name on everything', v: 'SAMPLE TRAVELER' },
        { k: 'Document', v: 'Sample — no real document exists' },
        { k: 'Valid to', v: 'Sample · nothing to check' },
        { k: 'Carried', v: 'Nowhere. This card is a placeholder.' },
      ],
      note: 'A stand-in so the wallet has something to render. **No real identity document is stored in this trip**, and none should ever be typed into it — it is a test file that gets deleted.',
      pending: false,
      order: 1,
    },
    {
      id: 'il26-card-insurance',
      tripId: TRIP_ID,
      emoji: '🏥',
      title: 'Sample travel insurance',
      code: '⏳ SAMPLE',
      codeLabel: 'Policy № · sample',
      rows: [
        { k: 'Insurer', v: 'Sample Insurance Co.' },
        { k: 'Cover', v: 'Sample · not a real policy' },
        { k: 'Emergency line', v: 'See the Sample insurance line in Emergency' },
      ],
      note: '⏳ Left **pending** so the unresolved-card state is on screen from day one.',
      pending: true,
      order: 2,
    },
    {
      id: 'il26-card-credit',
      tripId: TRIP_ID,
      emoji: '💳',
      title: 'Sample prepaid credit',
      code: 'SAMPLE-CREDIT',
      codeLabel: 'Sample reference',
      rows: [
        { k: 'Original value', v: '$200 · sample' },
        { k: 'Earmarked for', v: 'Nothing — it is not real money' },
      ],
      balance: { amountMinor: 20000, currency: 'USD' },
      note: 'The balance is **editable in the app** — knock it down after a sample purchase and check the number sticks. That is the only reason this card exists.',
      pending: false,
      order: 3,
    },
  ];
}

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
    key: 'overdue-insurance',
    title: 'Sort the sample insurance card',
    detail: 'Deliberately dated before the trip started, so it is **overdue and red** the moment this trip is imported. Tick it or leave it — it is here to prove the overdue state renders.',
    due: '2026-07-23',
    dueLabel: 'Overdue · 23 Jul',
    priority: 1,
  },
  {
    key: 'overdue-esim',
    title: 'Buy a data plan for the sample trip',
    detail: 'The second overdue task. Two of them, so the count on the Today screen has something to show.',
    due: '2026-07-25',
    dueLabel: 'Overdue · 25 Jul',
    priority: 1,
  },
  {
    key: 'coach-negev',
    title: 'Confirm the desert coach seat',
    detail: 'The Jerusalem → Mitzpe Ramon leg on 29 Jul. Sample booking, but the reminder is real enough to test with.',
    due: '2026-07-28',
    dueLabel: 'Tue 28 Jul',
    priority: 1,
  },
  {
    key: 'lodge-negev',
    title: 'Book the desert lodge — it is still pending',
    detail: 'Seven nights left unconfirmed on purpose. This is the task that should nag hardest in the first week.',
    due: '2026-08-01',
    dueLabel: 'Sat 1 Aug',
    priority: 1,
    link: 'https://www.booking.com/searchresults.html?ss=Mitzpe%20Ramon',
  },
  {
    key: 'flight-eilat',
    title: 'Confirm the sample flight to Eilat',
    detail: 'Pending domestic leg on 5 Aug. A week ahead is the right time to stop assuming it is fine.',
    due: '2026-08-03',
    dueLabel: 'Mon 3 Aug',
    priority: 2,
  },
  {
    key: 'hotel-eilat',
    title: 'Book the Eilat reef hotel',
    detail: 'Also pending. Check the room actually has air conditioning before confirming anything in August.',
    due: '2026-08-04',
    dueLabel: 'Tue 4 Aug',
    priority: 2,
    link: 'https://www.booking.com/searchresults.html?ss=Eilat',
  },
  {
    key: 'car-golan',
    title: 'Arrange two or three car days in the Galilee',
    detail: 'The Golan is a car trip, not a bus trip. Two or three days is plenty out of a fortnight.',
    due: '2026-08-19',
    dueLabel: 'Wed 19 Aug',
    priority: 2,
  },
  {
    key: 'hotel-haifa',
    title: 'Book the Haifa apartment',
    detail: 'Ten nights from 31 Aug, still pending. The last of the three unbooked blocks.',
    due: '2026-08-24',
    dueLabel: 'Mon 24 Aug',
    priority: 2,
    link: 'https://www.booking.com/searchresults.html?ss=Haifa',
  },
  {
    key: 'backup',
    title: 'Export a backup halfway through',
    detail: 'Halfway is the right moment to prove the export works — including on a trip you intend to delete.',
    due: '2026-09-02',
    dueLabel: 'Wed 2 Sep',
    priority: 3,
  },
  {
    key: 'airport-bed',
    title: 'Decide about the airport walk-in',
    detail: 'The last three nights have no reservation at all. Either book something or accept it knowingly — but decide before the 20th.',
    due: '2026-09-14',
    dueLabel: 'Mon 14 Sep',
    priority: 1,
  },
  {
    key: 'delete-me',
    title: 'Delete this test trip when the rehearsal is done',
    detail: 'It lives on the shelf beside China 2026 and can be removed at any time. Deleting it does not touch the China trip.',
    due: '2026-09-22',
    dueLabel: 'Tue 22 Sep',
    priority: 3,
  },
];

export function buildTasks(): Task[] {
  return TASKS.map((t, i) => ({
    id: `il26-task-${t.key}`,
    tripId: TRIP_ID,
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

const ALARMS: [key: string, date: string, time: string, title: string, why: string][] = [
  ['pack', '2026-07-24', '18:00', 'Pack for the sample trip', 'Already in the past — here so a done-and-gone alarm is on screen from the start.'],
  ['airport', '2026-07-25', '05:30', 'Leave for the airport', 'Also past. The arrival runbook fires on this date.'],
  ['coach', '2026-07-28', '09:00', 'Buy the desert coach ticket', 'The next alarm due after import. Tomorrow is the transfer.'],
  ['desert', '2026-07-29', '06:15', 'Desert transfer — fill the water first', 'The crit runbook day. Three litres before leaving the guest house.'],
  ['eilat', '2026-08-05', '06:45', 'Flight down to Eilat', 'Travel day. The leg is still pending — check it tonight.'],
  ['deadsea', '2026-08-12', '05:45', 'Leave early for the Dead Sea', 'The heat runbook day. The Arava road bakes from mid-morning.'],
  ['galilee', '2026-08-16', '08:15', 'Move north to the Galilee', 'Four hours with a stop. Unpack properly at the other end.'],
  ['telaviv', '2026-09-10', '09:00', 'Train down to Tel Aviv', 'The last travel day before the finale block.'],
  ['exit', '2026-09-22', '04:30', '🛂 Exit day — airport three hours early', 'The sample permit expires tomorrow. This is the last clean day out.'],
];

export function buildAlarms(): Alarm[] {
  return ALARMS.map(([key, date, time, title, why]) => ({
    id: `il26-alarm-${key}`,
    tripId: TRIP_ID,
    date,
    time,
    title,
    why,
    done: false,
  }));
}

const PACKING: [group: string, items: [key: string, label: string][]][] = [
  [
    'Documents',
    [
      ['passport', 'Passport — the real one lives in your pocket, never in this file'],
      ['insurance', 'Printed insurance policy (sample card is a placeholder)'],
      ['cards', 'Two payment cards, kept in two different places'],
      ['cash', 'A small float of local cash for buses and markets'],
      ['copies', 'Photos of everything, stored offline on the phone'],
    ],
  ],
  [
    'Desert kit',
    [
      ['bottles', 'Three-litre water capacity per person — bottles or a bladder'],
      ['hat', 'Wide brim hat, not a cap'],
      ['sleeves', 'Long light sleeves — cooler than bare arms in real sun'],
      ['fleece', 'A warm layer for the crater rim after dark'],
      ['salts', 'Electrolyte tablets'],
      ['torch', 'Head torch for the pre-dawn starts'],
    ],
  ],
  [
    'Beach & water',
    [
      ['rashguard', 'Rash guard — beats reapplying sunscreen every hour'],
      ['reefsafe', 'Reef-safe sunscreen'],
      ['sandals', 'Water shoes for the shore reef and the salt shelf'],
      ['drybag', 'Small dry bag'],
    ],
  ],
  [
    'Tech',
    [
      ['powerbank', 'Power bank and its cable'],
      ['adapter', 'Type-H plug adapter'],
      ['offline', 'Offline maps downloaded before leaving'],
      ['headphones', 'Headphones for the long transfers'],
    ],
  ],
];

export function buildPackingItems(): PackingItem[] {
  return PACKING.flatMap(([group, items], gi) =>
    items.map(([key, label], ii) => ({
      id: `il26-pack-${key}`,
      tripId: TRIP_ID,
      group,
      label,
      done: false,
      order: gi * 100 + ii,
    })),
  );
}

export function buildChecklists(): Checklist[] {
  return [
    {
      id: 'il26-check-fly',
      tripId: TRIP_ID,
      title: 'Before you fly — sample',
      note: 'All of this is easier at home than at the gate.',
      items: [
        { id: 'il26-chk-esim', label: 'Data plan bought and tested on the phone', done: false },
        { id: 'il26-chk-maps', label: 'Offline maps downloaded for the whole country', done: false },
        { id: 'il26-chk-docs', label: 'Photos of the documents saved offline', done: false },
        { id: 'il26-chk-cards', label: 'Bank told you are travelling', done: false },
        { id: 'il26-chk-bag', label: 'Bag weighed at home, not at the desk', done: false },
        { id: 'il26-chk-backup', label: 'A backup of this app exported and mailed to yourself', done: false },
      ],
      order: 1,
    },
  ];
}

const CATEGORIES: [key: string, label: string, planMinor: number, color: string][] = [
  ['transport', 'Transport', 90000, '#2b8a9e'],
  ['lodging', 'Lodging', 105000, '#7b5ea7'],
  ['food', 'Food', 55000, '#c2703d'],
  ['activities', 'Activities', 30000, '#3f8f5e'],
  ['gear', 'Gear', 12000, '#a8873b'],
  ['other', 'Other', 8000, '#6b7280'],
];

export function buildCategories(): ExpenseCategory[] {
  return CATEGORIES.map(([key, label, planMinor, color], i) => ({
    id: `il26-cat-${key}`,
    tripId: TRIP_ID,
    label,
    planMinor,
    color,
    order: i + 1,
  }));
}

/** Rates match trip.currencies exactly — ILS 3.4 per home dollar, EUR 0.92. */
const EXPENSES: [key: string, date: string, cat: string, desc: string, amount: number, currency: string, rate: number, payment: 'card' | 'cash'][] = [
  ['train', '2026-07-25', 'transport', 'Sample: airport train into the city', 18, 'ILS', 3.4, 'card'],
  ['dinner', '2026-07-25', 'food', 'Sample: first dinner by the sea', 132, 'ILS', 3.4, 'card'],
  ['market', '2026-07-26', 'food', 'Sample: lunch at the market', 12, 'EUR', 0.92, 'cash'],
];

export function buildExpenses(): Expense[] {
  return EXPENSES.map(([key, date, cat, desc, amount, currency, rate, payment]) => ({
    id: `il26-exp-${key}`,
    tripId: TRIP_ID,
    date,
    categoryId: `il26-cat-${cat}`,
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

export function buildNote(): TripNote {
  return {
    tripId: TRIP_ID,
    text:
      '🧪 **This is a sample trip.** Every booking code, price, hotel and phone number in it was invented so the app can be rehearsed against real passing time — a permit clock that actually ticks, an overdue task that is actually red, a runbook that actually fires this week.\n\nNothing here is a real reservation and nothing here is personal data. Delete it from the trip shelf whenever the rehearsal is done: the China trip is a separate record and is not touched by it.',
    updatedAt: SEED_TS,
  };
}

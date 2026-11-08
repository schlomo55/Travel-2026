/* Wallet cards, tasks, alarms, packing, the pre-flight checklist, money and
   the trip note — all invented. The passport card stores no number and no
   name; the insurer and the travel card are samples. */
import type { Alarm, Checklist, Expense, ExpenseCategory, PackingItem, Task, TripNote, WalletCard } from '../../src/lib/model/types';
import { toHomeMinor } from '../../src/lib/logic/money';
import { SEED_TS, TRIP_ID } from './base';

const t = TRIP_ID;

export function buildWalletCards(): WalletCard[] {
  return [
    {
      id: 'dm27-card-passport', tripId: t, emoji: '🛂', title: 'Passport — the one every booking is on',
      rows: [{ k: 'Passport №', v: 'not stored — on the physical passport' }, { k: 'Name', v: 'as printed on the passport' }, { k: 'Visa', v: 'sample rule: 25 days visa-free · HK 90 days' }],
      note: 'Validity must be ≥6 months on arrival. Nothing on this card is real.', pending: false, order: 0,
    },
    {
      id: 'dm27-card-school', tripId: t, emoji: '🥋', title: 'Sample Tai-chi School — the week',
      rows: [{ k: 'Dates', v: 'Sun Mar 21 → Mon Mar 29' }, { k: 'Fee', v: 'US$720, cash on arrival' }, { k: 'Pickup', v: 'Sun 10:30, Sample Station Inn lobby' }, { k: 'Bring', v: 'indoor shoes, the insurance certificate' }],
      pending: false, order: 1,
    },
    {
      id: 'dm27-card-insurance', tripId: t, emoji: '🩺', title: 'Travel insurance — Sample Assurance',
      code: 'DEMO-INS-0001', codeLabel: 'Policy (sample)',
      rows: [{ k: 'Cover', v: 'Mar 19 → Apr 18, 2027' }, { k: 'Medical', v: 'up to $250,000 (sample)' }, { k: 'Emergency line', v: '+33 1 00 00 00 00' }],
      pending: false, order: 2,
    },
    {
      id: 'dm27-card-travelcard', tripId: t, emoji: '💳', title: 'Sample prepaid travel card',
      rows: [{ k: 'Use', v: 'backup for phone payments' }], balance: { amountMinor: 30000, currency: 'USD' },
      note: 'Top up before the Hong Kong leg.', pending: true, order: 3,
    },
  ];
}

const task = (id: string, title: string, due: string, priority: Task['priority'], done: boolean, order: number, detail?: string, link?: string): Task => ({
  id: `dm27-task-${id}`, tripId: t, title, due, priority, done, order, ...(detail ? { detail } : {}), ...(link ? { link } : {}), ...(done ? { doneAt: SEED_TS } : {}),
});

export function buildTasks(): Task[] {
  return [
    task('insurance', '🩺 **Buy travel insurance** — print the certificate twice; the school asks for paper', '2027-01-15', 1, true, 0),
    task('esim', '📶 **Buy the trip eSIM** and test it at home', '2027-03-10', 1, false, 1),
    task('school-cash', '💵 **US$720 for the school**, in an envelope', '2027-03-17', 1, false, 2, 'The school takes cash only, on arrival.'),
    task('museum', '**Shanghai Museum East tickets** for Tue Mar 30 — released 7 days ahead at 20:00', '2027-03-23', 1, false, 3, 'Booked against the passport number.', 'https://www.shanghaimuseum.net/'),
    task('garden', '**Humble Administrator\'s Garden** — book the Saturday slot', '2027-03-27', 2, false, 4),
    task('suzhou-train', '**Book the Suzhou train** for Fri Apr 2', '2027-03-19', 2, false, 5),
    task('pine-lodge-late', '🌙 **Tell the Sample Pine Lodge** you arrive ~21:30 on Apr 4', '2027-04-01', 2, false, 6),
    task('park-pass', '**Huangshan park pass** for Apr 5–6 — buy at the gate or online', '2027-04-04', 2, false, 7),
    task('opera', 'Book **蜀风雅韵** for the Apr 8 evening', '2027-04-06', 2, false, 8),
    task('ferry', 'Book the **Macau ferry, BOTH legs**, for Apr 15', '2027-04-12', 1, false, 9),
    task('concert', '✅ **Concert BOUGHT — Apr 16, 19:30**', '2027-02-01', 2, true, 10),
    task('exit', '🛂 **VISA-CRITICAL: re-check the Apr 13 exit flight**', '2027-04-10', 1, false, 11, 'Day 24 of 25 — if it moves, rebook the same day.'),
  ];
}

const alarm = (n: number, date: string, time: string, title: string, done = false, why?: string): Alarm => ({
  id: `dm27-alarm-${String(n).padStart(2, '0')}`, tripId: t, date, time, title, done, ...(why ? { why } : {}),
});

export function buildAlarms(): Alarm[] {
  return [
    alarm(0, '2027-03-10', '19:00', 'App dress rehearsal (airplane mode test)'),
    alarm(1, '2027-02-01', '10:00', '✅ Concert tickets on sale 10:00 — bought', true),
    alarm(2, '2027-03-18', '20:00', '🧳 Pack — 20 kg, the cash envelope, the passport'),
    alarm(3, '2027-03-23', '19:45', '⏰ SHANGHAI MUSEUM tickets — 20:00 Shanghai', false, 'Released 7 days ahead and they go fast.'),
    alarm(4, '2027-03-21', '10:00', '🚐 Be in the inn lobby — the school collects you from 10:30'),
    alarm(5, '2027-03-29', '09:15', '🚄 Leave the school for Hangzhou East — G7520 10:10'),
    alarm(6, '2027-03-30', '08:30', 'Museum entry today — passport = ticket'),
    alarm(7, '2027-04-04', '14:00', '⏰ Collect the bag at the hostel → train to Hongqiao'),
    alarm(8, '2027-04-06', '06:45', '⏰ Yungu cableway — first ride 07:30'),
    alarm(9, '2027-04-09', '17:45', '⏰ Taxi to CTU — 3U9003 20:20'),
    alarm(10, '2027-04-10', '19:00', '💵 Draw ¥500 cash for the terraces — no ATM on the trail'),
    alarm(11, '2027-04-12', '08:00', '📲 Ask the guesthouse to call the shared car for 14:00'),
    alarm(12, '2027-04-13', '10:30', '🛂 EXIT DAY — shuttle at 10:45 for CZ9005'),
    alarm(13, '2027-04-12', '19:00', 'Book the Macau ferry, both legs (Apr 15)'),
    alarm(14, '2027-04-17', '19:30', '⏰ Leave for HKG — AY9070 23:55'),
  ];
}

export function buildPackingItems(): PackingItem[] {
  const groups: [string, string[]][] = [
    ['📄 Documents & money', ['Passport (validity ≥ 6 months)', '**Insurance certificate PRINTED ×2**', '**School envelope — US$720**', '**Spare cash — $400 in envelopes**', 'A card with no foreign-transaction fee']],
    ['📱 Tech', ['Phone + charger', 'Power bank with the 3C mark', 'Universal adapter', 'Headphones']],
    ['🎒 The bag — one bag, 20 kg', ['Walking shoes with real grip', 'Indoor shoes for the school hall', 'Rain shell', 'Two warm layers for the mountain', 'Light trousers ×2', 'Quick-dry shirts ×4']],
    ['🧴 Health', ['Plasters for the hike', 'Ibuprofen', 'Stomach tablets']],
  ];
  const out: PackingItem[] = [];
  for (const [group, items] of groups) {
    for (const label of items) out.push({ id: `dm27-pack-${String(out.length).padStart(2, '0')}`, tripId: t, group, label, done: false, order: out.length });
  }
  return out;
}

export function buildChecklists(): Checklist[] {
  const items = [
    '**Phone payments** — link a card and make one real test payment before flying',
    '**The eSIM** — installed, tested at home, data roaming on for the trip line',
    '**Offline maps** — Shanghai, Hangzhou, Huangshan, Chengdu, Guilin',
    '**Translation app** with the Chinese pack downloaded',
    '**Train booking app** — account verified with the passport',
    '**Ride-hailing app** — a card linked',
  ];
  return [
    {
      id: 'dm27-check-apps', tripId: t, title: 'Before you fly', note: 'All of this must work BEFORE landing.', order: 0,
      items: items.map((label, i) => ({ id: `dm27-app-${String(i).padStart(2, '0')}`, label, done: false })),
    },
  ];
}

export function buildCategories(): ExpenseCategory[] {
  const rows: [string, string, number, string, string][] = [
    ['flights', "Int'l flights", 115000, '#3987e5', 'flights'],
    ['school', 'Tai-chi school', 72000, '#e66767', 'training'],
    ['lodging', 'Lodging', 190000, '#9085e9', 'lodging'],
    ['transport', 'Trains+flights', 70000, '#199e70', 'transport'],
    ['tickets', 'Tickets+shows', 35000, '#d55181', 'tickets'],
    ['food', 'Food', 80000, '#c98500', 'food'],
    ['other', 'Other', 38000, '#898781', 'other'],
  ];
  return rows.map(([key, label, planMinor, color, legacyKey], order) => ({ id: `dm27-cat-${key}`, tripId: t, label, planMinor, color, order, legacyKey }));
}

const RATES: Record<string, number> = { USD: 1, CNY: 7.15, HKD: 7.8, EUR: 0.92, MOP: 8.05 };
export function buildExpenses(): Expense[] {
  const rows: [string, string, string, string, number, string, Expense['payment'], boolean?][] = [
    ['prepaid-flights', '2027-03-19', 'flights', 'Finnair return · Paris ⇄ Shanghai / Hong Kong (prepaid, sample)', 1150, 'USD', 'card'],
    ['prepaid-mu5001', '2027-03-19', 'transport', 'China Eastern MU5001 · Hongqiao → Huangshan (prepaid)', 98, 'USD', 'card'],
    ['prepaid-3u9001', '2027-03-19', 'transport', 'Sichuan 3U9001 · Huangshan → Chengdu (prepaid)', 142, 'USD', 'card'],
    ['prepaid-3u9003', '2027-03-19', 'transport', 'Sichuan 3U9003 · Chengdu → Guilin (prepaid)', 126, 'USD', 'card'],
    ['prepaid-cz9005', '2027-03-19', 'transport', 'China Southern CZ9005 · Guilin → Hong Kong (prepaid)', 189, 'USD', 'card'],
    ['prepaid-bund', '2027-03-19', 'lodging', 'Sample Bund Hotel · prepaid (2n)', 1180, 'CNY', 'card'],
    ['prepaid-harbour', '2027-03-19', 'lodging', 'Sample Harbour Hotel · prepaid (4n)', 5200, 'HKD', 'card'],
    ['prepaid-concert', '2027-03-19', 'tickets', 'Sample Orchestra · Apr 16 (prepaid)', 480, 'HKD', 'card'],
    ['prepaid-insurance', '2027-03-19', 'other', 'Travel insurance · Sample Assurance', 96, 'EUR', 'card'],
    ['school-fee', '2027-03-21', 'school', 'Sample Tai-chi School · the week, cash', 720, 'USD', 'cash'],
    ['noodles', '2027-03-21', 'food', 'Noodles by the lake', 38, 'CNY', 'cash'],
    ['dimsum', '2027-04-14', 'food', 'Lunch in Shek O', 260, 'HKD', 'card'],
    ['egg-tarts', '2027-04-15', 'food', 'Egg tarts, Coloane', 80, 'MOP', 'cash'],
    ['refund-mu5003', '2027-03-19', 'transport', 'MU5003 cancelled — refund (sample)', 110, 'USD', 'card', true],
  ];
  return rows.map(([id, date, cat, desc, amount, currency, payment, refund]) => ({
    id: `dm27-exp-${id}`, tripId: t, date, categoryId: `dm27-cat-${cat}`, desc, amount, currency,
    rateToHome: RATES[currency]!, homeMinor: toHomeMinor(amount, RATES[currency]!), payment, refund: !!refund, ts: SEED_TS,
  }));
}

export function buildNote(): TripNote {
  return { tripId: t, text: 'A made-up demo trip. Nothing in it is a real booking, price, code or person.', updatedAt: SEED_TS };
}

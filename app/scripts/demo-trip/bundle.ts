/* Assembles the demo TripBundle. Content lives in the sibling modules. */
import type { ComplianceCounter, Trip, TripBundle } from '../../src/lib/model/types';
import { SEED_TS, STOP_IDS, TRIP_END, TRIP_ID, TRIP_START, type StopKey } from './base';
import { buildStops } from './stops';
import { buildDayDefaults, buildDayPlans, buildRunbooks } from './days';
import { buildBookings } from './bookings';
import { buildAlarms, buildCategories, buildChecklists, buildExpenses, buildNote, buildPackingItems, buildTasks, buildWalletCards } from './admin';
import { buildEmergency, buildInfoCards, buildShowCards } from './cards';
import type { GeneratedFile } from './images';

export function buildDemoBundle(images: GeneratedFile[], ticketPdf: Buffer): TripBundle {
  const photo: Partial<Record<StopKey, string>> = {};
  const documents: TripBundle['documents'] = [
    {
      meta: {
        id: 'dm27-doc-flights-pdf', tripId: TRIP_ID, name: 'Sample e-ticket — every flight on one page', fileName: 'Demo-2027-Flights.pdf',
        mime: 'application/pdf', size: ticketPdf.byteLength, tag: 'ticket', addedAt: SEED_TS,
      },
      dataBase64: ticketPdf.toString('base64'),
    },
  ];
  for (const img of images) {
    const key = img.key as StopKey;
    const id = `dm27-photo-${key}`;
    photo[key] = id;
    documents.push({
      meta: { id, tripId: TRIP_ID, stopId: STOP_IDS[key], name: `Sample image · ${key}`, fileName: `dm27-${key}.webp`, mime: 'image/webp', size: img.buffer.byteLength, tag: 'photo', addedAt: SEED_TS },
      dataBase64: img.buffer.toString('base64'),
    });
  }

  const categories = buildCategories();
  const trip: Trip = {
    id: TRIP_ID,
    title: 'TEST — Demo China',
    subtitle: 'Sample trip · not real data',
    emoji: '🧪',
    start: TRIP_START,
    end: TRIP_END,
    homeCurrency: 'USD',
    currencies: [
      { code: 'USD', symbol: '$', rateToHome: 1 },
      { code: 'CNY', symbol: '¥', rateToHome: 7.15 },
      { code: 'HKD', symbol: 'HK$', rateToHome: 7.8 },
      { code: 'MOP', symbol: 'MOP$', rateToHome: 8.05 },
      { code: 'EUR', symbol: '€', rateToHome: 0.92 },
    ],
    accentHue: 8,
    coverDocId: 'dm27-photo-shanghai',
    clocks: [
      { label: 'China', timeZone: 'Asia/Shanghai', flag: '🇨🇳' },
      { label: 'Paris', timeZone: 'Europe/Paris', flag: '🇫🇷' },
      { label: 'Helsinki', timeZone: 'Europe/Helsinki', flag: '🇫🇮' },
    ],
    budgetTotalMinor: categories.reduce((s, x) => s + x.planMinor, 0),
    driverSuffix: { native: '请带我去这里', meaning: 'Please take me here' },
    archived: false,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };

  const counters: ComplianceCounter[] = [
    {
      id: 'dm27-counter-visa',
      tripId: TRIP_ID,
      name: 'Mainland visa (sample rule)',
      icon: '🛂',
      startDate: '2027-03-20',
      countStartsDayAfter: true,
      limitDays: 25,
      hardDeadline: '2027-04-14',
      plannedEndDate: '2027-04-13',
      note: 'A demo visa-free window: 25 days, counted from the day after entry. Hong Kong and Macau do not count. Planned Apr 13 exit = day 24, a one-day buffer.',
      pinned: true,
    },
  ];

  return {
    trip,
    counters,
    stops: buildStops(photo),
    dayPlans: buildDayPlans(),
    dayDefaults: buildDayDefaults(),
    runbooks: buildRunbooks(),
    bookings: buildBookings(),
    walletCards: buildWalletCards(),
    tasks: buildTasks(),
    alarms: buildAlarms(),
    packingItems: buildPackingItems(),
    checklists: buildChecklists(),
    expenses: buildExpenses(),
    categories,
    showCards: buildShowCards(),
    emergency: buildEmergency(),
    infoCards: buildInfoCards(),
    note: buildNote(),
    checkState: [],
    documents,
  };
}

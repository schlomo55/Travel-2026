/* Assembles the Israel TEST TripBundle. Content lives in the sibling modules;
   this file only wires it together and stamps the fixed timestamps. */
import type { ComplianceCounter, Trip, TripBundle } from '../../src/lib/model/types';
import { SEED_TS, STOP_IDS, TRIP_END, TRIP_ID, TRIP_START, type StopKey } from './base';
import { buildStops } from './stops';
import { buildDayDefaults, buildDayPlans, buildRunbooks } from './days';
import { buildBookings } from './bookings';
import {
  buildAlarms,
  buildCategories,
  buildChecklists,
  buildExpenses,
  buildNote,
  buildPackingItems,
  buildTasks,
  buildWalletCards,
} from './admin';
import { buildEmergency, buildInfoCards, buildShowCards } from './cards';
import type { GeneratedImage } from './images';

const COVER_DOC_ID = 'il26-photo-cover';

/** Which stop each generated image belongs to. The cover belongs to none. */
const PHOTO_STOPS: Record<string, StopKey | null> = {
  cover: null,
  jerusalem: 'jerusalem',
  negev: 'negev',
};

export function buildIsraelBundle(images: GeneratedImage[]): TripBundle {
  const documents: TripBundle['documents'] = images.map((img) => {
    const stopKey = PHOTO_STOPS[img.key] ?? null;
    return {
      meta: {
        id: `il26-photo-${img.key}`,
        tripId: TRIP_ID,
        ...(stopKey ? { stopId: STOP_IDS[stopKey] } : {}),
        name: `Sample image · ${img.key}`,
        fileName: `il26-${img.key}.webp`,
        mime: 'image/webp',
        size: img.buffer.byteLength,
        tag: 'photo' as const,
        addedAt: SEED_TS,
      },
      dataBase64: img.buffer.toString('base64'),
    };
  });

  const photoDocIds: Partial<Record<StopKey, string>> = {};
  for (const img of images) {
    const stopKey = PHOTO_STOPS[img.key];
    if (stopKey) photoDocIds[stopKey] = `il26-photo-${img.key}`;
  }
  const hasCover = images.some((i) => i.key === 'cover');

  const trip: Trip = {
    id: TRIP_ID,
    title: 'TEST — Israel 60',
    subtitle: 'Sample trip · not real data',
    emoji: '🧪',
    start: TRIP_START,
    end: TRIP_END,
    homeCurrency: 'USD',
    currencies: [
      { code: 'USD', symbol: '$', rateToHome: 1 },
      { code: 'ILS', symbol: '₪', rateToHome: 3.4 },
      { code: 'EUR', symbol: '€', rateToHome: 0.92 },
    ],
    accentHue: 195, // petrol/teal — deliberately far from China's vermilion 8
    ...(hasCover ? { coverDocId: COVER_DOC_ID } : {}),
    clocks: [
      { label: 'Israel', timeZone: 'Asia/Jerusalem', flag: '🇮🇱' },
      { label: 'France', timeZone: 'Europe/Paris', flag: '🇫🇷' },
      { label: 'UTC', timeZone: 'UTC' },
    ],
    budgetTotalMinor: 300000, // $3,000 sample budget
    driverSuffix: { native: 'קח אותי לכאן בבקשה', meaning: 'Please take me here' },
    archived: false,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };

  const counters: ComplianceCounter[] = [
    {
      id: 'il26-counter-permit',
      tripId: TRIP_ID,
      name: 'Sample 60-day permit',
      icon: '🛂',
      startDate: '2026-07-25',
      countStartsDayAfter: true, // same rule as the real visa clock: entry day is day 0
      limitDays: 60,
      hardDeadline: '2026-09-23',
      plannedEndDate: '2026-09-22',
      note: 'Sample counter — exercises the visa-clock logic. Not a real permit.',
      pinned: true,
    },
  ];

  return {
    trip,
    counters,
    stops: buildStops(photoDocIds),
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
    categories: buildCategories(),
    showCards: buildShowCards(),
    emergency: buildEmergency(),
    infoCards: buildInfoCards(),
    note: buildNote(),
    checkState: [],
    documents,
  };
}

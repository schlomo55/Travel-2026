/* 🧪 TEMPLATE EXAMPLE · trip.ts — brief §1, Trip header. */
import type { ComplianceCounter, Trip } from '../../../src/lib/model/types';
import { SEED_TS, SLUG, TRIP_END, TRIP_START } from './base';

export function buildTrip(): Trip {
  return {
    id: SLUG,
    title: 'TEST — Porto & Lisbon 5',
    subtitle: 'Worked example of the trip-brief pipeline · not real data',
    emoji: '🧪',
    start: TRIP_START,
    end: TRIP_END,
    homeCurrency: 'EUR',
    currencies: [{ code: 'EUR', symbol: '€', rateToHome: 1 }],
    /* Violet — deliberately far from China's vermilion 8 and the Israel test
       trip's petrol 195, so three trips on one shelf never read as one. */
    accentHue: 268,
    clocks: [
      { label: 'Portugal', timeZone: 'Europe/Lisbon', flag: '🇵🇹' },
      { label: 'Home', timeZone: 'Europe/Paris', flag: '🇫🇷' },
    ],
    /* Brief §1: "€900 all in". Minor units; the categories in admin.ts sum to
       exactly this, and assert.ts checks the arithmetic. */
    budgetTotalMinor: 90000,
    driverSuffix: { native: 'Leve-me aqui, por favor', meaning: 'Please take me here' },
    archived: false,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };
}

/** The brief named no visa or permit clock — five days inside Schengen for a
    French passport is not a clock. So there is none, rather than an invented
    one. */
export function buildCounters(): ComplianceCounter[] {
  return [];
}

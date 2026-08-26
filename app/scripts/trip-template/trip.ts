/* TRIP TEMPLATE · trip.ts — the Trip record itself.

   BRIEF SECTION → HERE
     §1 Trip header  → every field below
     §1 Visa/permit  → buildCounters(), which is empty unless the brief asked
                       for a clock

   The Trip record is the only thing the shelf shows before you open a trip, so
   `title`, `emoji` and `accentHue` are the whole first impression. Pick a hue
   no other trip on the shelf uses: China is vermilion 8, the Israel test is
   petrol 195. */
import type { ComplianceCounter, Trip } from '../../src/lib/model/types';
import { SEED_TS, SLUG, TRIP_END, TRIP_START } from './base';

export function buildTrip(coverDocId?: string): Trip {
  return {
    id: SLUG, // the trip's own id is the BARE slug — everything else prefixes it
    title: 'FILL ME — trip name (brief §1)',
    subtitle: 'FILL ME — one line, or delete this key',
    emoji: '🧭',
    start: TRIP_START,
    end: TRIP_END,

    /* Brief §1 · money. `homeCurrency` must appear in `currencies`, and
       `rateToHome` is units of that currency per 1 home unit. These are
       DISPLAY rates written down once — the app never fetches a rate. */
    homeCurrency: 'EUR',
    currencies: [
      { code: 'EUR', symbol: '€', rateToHome: 1 },
      // { code: 'JPY', symbol: '¥', rateToHome: 160 },
    ],

    /* 0–360. Drives --accent-h across the whole trip. Keep it distinct. */
    accentHue: 210,

    ...(coverDocId ? { coverDocId } : {}),

    /* Brief §1 · time zones. The strip at the top of Today. */
    clocks: [{ label: 'Home', timeZone: 'Europe/Paris', flag: '🇫🇷' }],

    /* Brief §1 · budget, in MINOR units of the home currency (cents).
       Delete the key entirely if the brief gave no budget — an invented
       number is worse than none. Categories in admin.ts must sum to it. */
    budgetTotalMinor: 100000,

    /* Brief §7 · the phrase appended under every place card in the driver
       overlay. Delete if the destination speaks your language. */
    // driverSuffix: { native: '…', meaning: 'Please take me here' },

    archived: false,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };
}

/** Brief §1 · visa / permit clock. Return [] if the brief named none — an
    invented counter is a legal fact you made up. `countStartsDayAfter: true`
    means the entry day is day 0, which is how most day-count permits read. */
export function buildCounters(): ComplianceCounter[] {
  return [
    // {
    //   id: `${SLUG}-counter-schengen`,
    //   tripId: SLUG,
    //   name: '90-day Schengen',
    //   icon: '🛂',
    //   startDate: TRIP_START,
    //   countStartsDayAfter: true,
    //   limitDays: 90,
    //   hardDeadline: 'YYYY-MM-DD',
    //   plannedEndDate: TRIP_END,
    //   note: 'What the brief said, in its own words.',
    //   pinned: true,
    // },
  ];
}

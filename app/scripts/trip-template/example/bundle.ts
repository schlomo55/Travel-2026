/* 🧪 TEMPLATE EXAMPLE · bundle.ts — assembly, and the assert configuration.

   The config at the bottom is the part worth copying: it is where a trip
   declares what the generic gate should hold it to. `openItems` is the ⏳
   contract made checkable — one entry per OPEN line in the brief, naming both
   halves it compiled into. */
import type { TripBundle } from '../../../src/lib/model/types';
import type { AssertConfig } from '../assert';
import { SEED_DATE, SLUG, TRIP_END_EXCLUSIVE, ALARM_EARLIEST, id } from './base';
import { buildCounters, buildTrip } from './trip';
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

export function buildExampleBundle(): TripBundle {
  return {
    trip: buildTrip(),
    counters: buildCounters(),
    stops: buildStops(),
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
    /* No images. A cover is optional; see scripts/israel-test/images.ts for the
       deterministic-gradient pattern if you want one. Real e-tickets and scans
       never belong in a seed at all — they go into the on-device vault. */
    documents: [],
  };
}

export const EXAMPLE_ASSERT: AssertConfig = {
  slug: SLUG,
  seedDate: SEED_DATE,
  tripEndExclusive: TRIP_END_EXCLUSIVE,
  alarmEarliest: ALARM_EARLIEST,

  /* Every ⏳ OPEN line in the brief, as the pair it compiled into. The gate
     checks that the booking really is `pending` (so the chip really is amber)
     and that the task really carries the brief's "by <date>". */
  openItems: [{ bookingId: id('bed', 'lisbon'), taskId: id('task', 'book-bed-lisbon') }],

  /* EMPTY, and correctly so: this trip is fabricated end to end, so there is
     nothing real in it to guard. The hook exists because the China trip needs
     it — that one carries genuine passport numbers, PNRs and order ids, and
     both its own builder and the deploy gate (scripts/check-dist-clean.ts)
     grep for those literals so they can never reach a built file. Add a real
     reference to your trip and it belongs in this list. A passport-shaped
     token is refused whatever this says. */
  privacyValues: [],

  expect: {
    days: 5,
    stops: 2,
    dayPlans: 4, // 13 Apr has none on purpose — it falls to the Porto default
    bookings: 5,
    tasks: 2,
    openBookings: 1, // the Lisbon bed, and nothing else
  },
};

/* TRIP TEMPLATE · bundle.ts — assembly only.

   Content lives in the sibling modules; this file wires them together and is
   the one place that names every collection in a TripBundle. If a collection
   is missing here it silently ships empty, so the list below is deliberately
   exhaustive rather than spread-based.

   `documents` is empty in the scaffold. Photos and cover images are optional;
   see `scripts/israel-test/images.ts` for the deterministic-gradient pattern
   (pure integer maths, no network, no committed binary — two runs produce the
   same bytes). Real e-tickets and scans do NOT belong in a seed at all: they
   go into the on-device documents vault after import. */
import type { TripBundle } from '../../src/lib/model/types';
import { buildTrip, buildCounters } from './trip';
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

export function buildBundle(): TripBundle {
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
    /* Runbook step ticks. Always [] in a seed — nobody has ticked anything. */
    checkState: [],
    /* A trip FILE cannot carry day picks: a pick is something a traveller did
       on a phone, not something a trip file says. Omit the key entirely. */
    documents: [],
  };
}

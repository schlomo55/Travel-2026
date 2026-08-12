import { db, TRIP_TABLES } from '../db/db';
import type { Id, Settings, AppBackup, TripBundle } from '../model/types';
import { toast } from '../state/toast.svelte';
import { S } from '../i18n/strings';

const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  activeTripId: null,
  lastBackupAt: null,
  lastMutationAt: 0,
  backupNagDays: 7,
  weatherOnline: true,
  calmMotion: false,
  theme: 'dark',
};

/** Weather is opt-OUT: undefined (settings written before the toggle existed)
    reads as on, which matches the default a fresh install gets. */
export function weatherEnabled(s: { weatherOnline?: boolean } | undefined | null): boolean {
  return s?.weatherOnline !== false;
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'settings' });
}

/** Stamp after every user-visible mutation — drives the stale-backup nag. */
export async function touchMutation(): Promise<void> {
  await updateSettings({ lastMutationAt: Date.now() });
}

/** Run a mutation and stamp lastMutationAt afterwards.
 *
 *  A FAILED WRITE MUST NOT BE SILENT. Callers fire these and drop the promise
 *  (`onclick={() => toggleTask(t)}`), so before this catch a rejected write was
 *  a checkbox that simply did not move — which is exactly how the checklist
 *  DataCloneError shipped unnoticed. The rejection is re-thrown after the toast
 *  so callers that DO await still see it. */
export async function mutate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn();
    await touchMutation();
    return out;
  } catch (err) {
    console.error('write failed', err);
    toast.show(S.system.saveFailed);
    throw err;
  }
}

/** Delete a trip and every record belonging to it, atomically. */
export async function deleteTripCascade(tripId: Id): Promise<void> {
  await db.transaction('rw', [db.trips, ...TRIP_TABLES.map((t) => db[t]), db.documentBlobs], async () => {
    const docIds = await db.documents.where('tripId').equals(tripId).primaryKeys();
    if (docIds.length) await db.documentBlobs.bulkDelete(docIds as string[]);
    for (const t of TRIP_TABLES) {
      await db[t].where('tripId').equals(tripId).delete();
    }
    await db.trips.delete(tripId);
  });
}

/** Upsert one trip bundle (seed import / restore). Documents' base64 is decoded
    to Blobs by the caller (browser: backup.ts; tests may pass none). */
export async function upsertTripBundle(bundle: TripBundle, blobs?: Map<Id, Blob>): Promise<void> {
  await db.transaction('rw', [db.trips, ...TRIP_TABLES.map((t) => db[t]), db.documentBlobs], async () => {
    await db.trips.put(bundle.trip);
    await db.counters.bulkPut(bundle.counters);
    await db.stops.bulkPut(bundle.stops);
    await db.dayPlans.bulkPut(bundle.dayPlans);
    await db.dayDefaults.bulkPut(bundle.dayDefaults);
    await db.runbooks.bulkPut(bundle.runbooks);
    await db.bookings.bulkPut(bundle.bookings);
    await db.walletCards.bulkPut(bundle.walletCards);
    await db.tasks.bulkPut(bundle.tasks);
    await db.alarms.bulkPut(bundle.alarms);
    await db.packingItems.bulkPut(bundle.packingItems);
    await db.checklists.bulkPut(bundle.checklists);
    await db.expenses.bulkPut(bundle.expenses);
    await db.categories.bulkPut(bundle.categories);
    await db.showCards.bulkPut(bundle.showCards);
    await db.emergency.bulkPut(bundle.emergency);
    await db.infoCards.bulkPut(bundle.infoCards);
    if (bundle.note) await db.notes.put(bundle.note);
    await db.checkState.bulkPut(bundle.checkState);
    await db.documents.bulkPut(bundle.documents.map((d) => d.meta));
    if (blobs) {
      for (const [id, blob] of blobs) await db.documentBlobs.put({ id, blob });
    }
  });
}

export function isAppBackup(o: unknown): o is AppBackup {
  return (
    typeof o === 'object' &&
    o !== null &&
    (o as AppBackup).format === 'livingthedream/backup' &&
    (o as AppBackup).formatVersion === 1 &&
    Array.isArray((o as AppBackup).trips)
  );
}

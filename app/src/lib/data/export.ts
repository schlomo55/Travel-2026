/* Building backup files out of the vault. Documents ride along as base64 and
   the whole thing is gzipped, so a full vault stays a single file you can mail
   to yourself. */
import type { EntityTable } from 'dexie';
import { db, TRIP_TABLES } from '../db/db';
import { getSettings, updateSettings } from './repo';
import { backupFileName, blobToBase64, downloadBlob, gzipText } from '../logic/backup';
import type { Id, AppBackup, TripBundle } from '../model/types';

const APP_VERSION = '2.0.0';

export async function buildTripBundle(tripId: Id, includeDocuments = true): Promise<TripBundle | null> {
  const trip = await db.trips.get(tripId);
  if (!trip) return null;
  const where = <T, K extends keyof T>(t: EntityTable<T, K>): Promise<T[]> =>
    t.where('tripId').equals(tripId).toArray();

  const [
    counters, stops, dayPlans, dayDefaults, runbooks, bookings, walletCards,
    tasks, alarms, packingItems, checklists, expenses, categories,
    showCards, emergency, infoCards, note, checkState, documents,
  ] = await Promise.all([
    where(db.counters), where(db.stops), where(db.dayPlans), where(db.dayDefaults),
    where(db.runbooks), where(db.bookings), where(db.walletCards), where(db.tasks),
    where(db.alarms), where(db.packingItems), where(db.checklists), where(db.expenses),
    where(db.categories), where(db.showCards), where(db.emergency), where(db.infoCards),
    db.notes.get(tripId), where(db.checkState), where(db.documents),
  ]);

  const docs: TripBundle['documents'] = [];
  for (const meta of documents) {
    if (!includeDocuments) {
      docs.push({ meta, dataBase64: '' });
      continue;
    }
    const rec = await db.documentBlobs.get(meta.id);
    docs.push({ meta, dataBase64: rec ? await blobToBase64(rec.blob) : '' });
  }

  return {
    trip, counters, stops, dayPlans, dayDefaults, runbooks, bookings, walletCards,
    tasks, alarms, packingItems, checklists, expenses, categories, showCards,
    emergency, infoCards, ...(note ? { note } : {}), checkState, documents: docs,
  };
}

export async function buildBackup(tripIds: Id[], includeDocuments = true): Promise<AppBackup> {
  const trips: TripBundle[] = [];
  for (const id of tripIds) {
    const b = await buildTripBundle(id, includeDocuments);
    if (b) trips.push(b);
  }
  const vault = tripIds.length > 1;
  return {
    format: 'livingthedream/backup',
    formatVersion: 1,
    kind: vault ? 'vault' : 'trip',
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    ...(vault ? { settings: await getSettings(), packingTemplates: await db.packingTemplates.toArray() } : {}),
    trips,
  };
}

export async function exportVault(): Promise<void> {
  const ids = (await db.trips.toArray()).map((t) => t.id);
  const backup = await buildBackup(ids, true);
  const blob = await gzipText(JSON.stringify(backup));
  downloadBlob(backupFileName(null), blob);
  await updateSettings({ lastBackupAt: Date.now() });
}

export async function exportTrip(tripId: Id): Promise<void> {
  const trip = await db.trips.get(tripId);
  const backup = await buildBackup([tripId], true);
  const blob = await gzipText(JSON.stringify(backup));
  downloadBlob(backupFileName(trip?.title ?? 'trip'), blob);
  await updateSettings({ lastBackupAt: Date.now() });
}

/** Text small enough to paste into a note — documents excluded. */
export async function textBackup(): Promise<string> {
  const ids = (await db.trips.toArray()).map((t) => t.id);
  const backup = await buildBackup(ids, false);
  await updateSettings({ lastBackupAt: Date.now() });
  return JSON.stringify(backup);
}

export interface VaultStats {
  trips: number;
  documents: number;
  documentBytes: number;
  expenses: number;
}

export async function vaultStats(): Promise<VaultStats> {
  const [trips, docs, expenses] = await Promise.all([
    db.trips.count(),
    db.documents.toArray(),
    db.expenses.count(),
  ]);
  return {
    trips,
    documents: docs.length,
    documentBytes: docs.reduce((s, d) => s + d.size, 0),
    expenses,
  };
}

/** True when there are unsaved changes older than the nag threshold. */
export function backupIsStale(s: { lastBackupAt: number | null; lastMutationAt: number; backupNagDays: number }): boolean {
  if (!s.lastMutationAt) return false;
  if (!s.lastBackupAt) return true;
  if (s.lastMutationAt <= s.lastBackupAt) return false;
  return Date.now() - s.lastBackupAt > s.backupNagDays * 86_400_000;
}

/** Everything the app knows, cleared. Used only behind a typed confirmation. */
export async function wipeVault(): Promise<void> {
  await db.transaction('rw', [db.trips, db.packingTemplates, db.settings, db.meta, db.documentBlobs, ...TRIP_TABLES.map((t) => db[t])], async () => {
    for (const t of TRIP_TABLES) await db[t].clear();
    await db.trips.clear();
    await db.documentBlobs.clear();
    await db.packingTemplates.clear();
    await db.meta.clear();
    await db.settings.clear();
  });
}

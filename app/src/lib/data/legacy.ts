/* Applying an old China-app backup onto the imported China trip. */
import { db } from '../db/db';
import { mutate } from './repo';
import { plain } from './edit';
import { importLegacy, type LegacyMappingTargets } from '../logic/legacyImport';
import type { Id } from '../model/types';

/** The seed builder's deterministic trip id. */
export const LEGACY_TRIP_ID = 'cn26';

export interface LegacyApplyResult {
  expenses: number;
  ticks: number;
  unmatched: number;
}

export async function importLegacyBackup(raw: unknown, tripId: Id): Promise<LegacyApplyResult | null> {
  const [categories, tasks, packing, checklists, alarms, runbooks] = await Promise.all([
    db.categories.where('tripId').equals(tripId).toArray(),
    db.tasks.where('tripId').equals(tripId).toArray(),
    db.packingItems.where('tripId').equals(tripId).toArray(),
    db.checklists.where('tripId').equals(tripId).toArray(),
    db.alarms.where('tripId').equals(tripId).toArray(),
    db.runbooks.where('tripId').equals(tripId).toArray(),
  ]);

  const targets: LegacyMappingTargets = {
    tripId,
    categories,
    taskIds: new Set(tasks.map((t) => t.id)),
    packingIds: new Set(packing.map((p) => p.id)),
    checklistItemIds: new Set(checklists.flatMap((c) => c.items.map((i) => i.id))),
    /* legacy alarm ticks are keyed by index, and the seed keeps that order */
    alarmIdsByIndex: [...alarms].sort((a, b) => a.id.localeCompare(b.id)).map((a) => a.id),
    runbookIds: new Set(runbooks.map((r) => r.id)),
  };

  const r = importLegacy(raw, targets);
  if (!r) return null;

  await mutate(async () => {
    if (r.expenses.length) await db.expenses.bulkPut(plain(r.expenses));
    if (r.customPacking.length) await db.packingItems.bulkPut(plain(r.customPacking));
    if (r.checkState.length) await db.checkState.bulkPut(plain(r.checkState));
    for (const id of r.taskIdsDone) await db.tasks.update(id, { done: true });
    for (const id of r.packingIdsDone) await db.packingItems.update(id, { done: true });
    for (const id of r.alarmIdsDone) await db.alarms.update(id, { done: true });
    if (r.checklistItemIdsDone.length) {
      const doneIds = new Set(r.checklistItemIdsDone);
      for (const c of checklists) {
        if (!c.items.some((i) => doneIds.has(i.id))) continue;
        await db.checklists.update(c.id, {
          items: c.items.map((i) => (doneIds.has(i.id) ? { ...i, done: true } : i)),
        });
      }
    }
    if (r.notes) await db.notes.put({ tripId, text: r.notes, updatedAt: Date.now() });
    if (r.giftBalanceMinor != null) {
      const gift = await db.walletCards.get('cn26-card-giftcard');
      if (gift?.balance) {
        await db.walletCards.update(gift.id, {
          balance: { amountMinor: r.giftBalanceMinor, currency: gift.balance.currency },
        });
      }
    }
  });

  return {
    expenses: r.expenses.length,
    ticks:
      r.taskIdsDone.length +
      r.packingIdsDone.length +
      r.checklistItemIdsDone.length +
      r.alarmIdsDone.length +
      r.checkState.length,
    unmatched: r.unmatched.length,
  };
}

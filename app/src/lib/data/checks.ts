/* Dated checkbox state — runbook step ticks, keyed per (trip, runbook, date, index)
   so the same runbook ticked on Dec 11 stays separate from Dec 16. */
import { db } from '../db/db';
import { touchMutation } from './repo';
import type { Id, ISODate } from '../model/types';

export function runStepKey(tripId: Id, runbookId: Id, date: ISODate, idx: number): string {
  return `${tripId}:run:${runbookId}:${date}:${idx}`;
}

export async function setCheck(key: string, tripId: Id, on: boolean): Promise<void> {
  if (on) await db.checkState.put({ key, tripId, at: Date.now() });
  else await db.checkState.delete(key);
  await touchMutation();
}

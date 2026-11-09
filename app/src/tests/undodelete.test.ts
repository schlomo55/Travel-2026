/* ONE TAP DELETES AN EXPENSE — AND ONE TAP BRINGS IT BACK (QA 9 Nov 2026).
 *
 * The × on a spending row deletes at once; what makes that safe is the Undo
 * on the toast (the same single-slot undo as the day view's Done). This holds
 * that the delete offers it, and that pressing it restores the row exactly. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../lib/db/db';
import { deleteEntity } from '../lib/data/edit';
import { toast } from '../lib/state/toast.svelte';
import type { Expense } from '../lib/model/types';

const entry: Expense = {
  id: 'e-undo-1', tripId: 't-undo', date: '2027-01-02', categoryId: 'c1', desc: 'TEST — noodles',
  amount: 30, currency: 'CNY', rateToHome: 7.15, homeMinor: 420, payment: 'cash', refund: false, ts: 1,
};

describe('expense delete · undo', () => {
  it('the delete toast carries an Undo that puts the entry back as it was', async () => {
    await db.expenses.put(entry);
    toast.list = [];
    await deleteEntity(db.expenses, entry, 'Entry deleted');
    expect(await db.expenses.get(entry.id)).toBeUndefined();

    const t = toast.list.find((x) => x.msg === 'Entry deleted');
    expect(t?.action?.label).toBe('Undo');
    t!.action!.fn();
    await new Promise((r) => setTimeout(r, 20));
    expect(await db.expenses.get(entry.id)).toEqual(entry);
  });
});

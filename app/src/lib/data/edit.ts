/* Generic save/delete for any per-trip entity, with undo on delete. */
import type { EntityTable } from 'dexie';
import { mutate } from './repo';
import { offerUndo } from '../state/undo.svelte';
import { toast } from '../state/toast.svelte';

/** Strip Svelte's deep proxy — IndexedDB cannot structured-clone a Proxy. */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Every editable entity is keyed by `id`. */
type ById<T extends { id: string }> = EntityTable<T, 'id'>;

export async function saveEntity<T extends { id: string }>(table: ById<T>, entity: T): Promise<void> {
  await mutate(async () => {
    await table.put(plain(entity));
  });
  toast.show('Saved ✓');
}

export async function deleteEntity<T extends { id: string }>(
  table: ById<T>,
  entity: T,
  label = 'Deleted',
): Promise<void> {
  const snapshot = plain(entity);
  /* Dexie's key type is conditional on T, which TS cannot narrow for a generic
     T — but `id` is the primary key of every table this is used with. */
  const key = entity.id as Parameters<ById<T>['delete']>[0];
  await mutate(async () => {
    await table.delete(key);
  });
  offerUndo({
    label,
    undo: () =>
      mutate(async () => {
        await table.put(snapshot);
      }),
  });
}

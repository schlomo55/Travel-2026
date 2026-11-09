/* The round tick on a to-do or an alarm — what pressing it WRITES.

   A to-do ticks done (and says when); an alarm's tick is "in the phone's
   calendar" (the app cannot ring while it is closed). These are the same two
   writes the To do page makes; Now's home takes them from here so the tick
   means one thing on both screens.

   A previewed day is looked at, never ticked: while `previewing` nothing is
   written (the same rule as a runbook step's tick, lib/data/checks.ts
   setCheck). */
import { db } from '../db/db';
import { mutate } from './repo';
import type { Alarm, Task } from '../model/types';

export async function tick({ task: t, alarm: a }: { task?: Task; alarm?: Alarm }, previewing = false): Promise<void> {
  if (previewing) return;
  if (t) await mutate(() => db.tasks.update(t.id, { done: !t.done, doneAt: t.done ? undefined : Date.now() }));
  else if (a) await mutate(() => db.alarms.update(a.id, { done: !a.done }));
}

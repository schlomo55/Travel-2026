/* PICKING SOMETHING OUT OF A FREE BLOCK, AND PUTTING IT BACK.

   Two writes, and both of them are one row. The whole point of `DayPick`
   living on its own table (types.ts) is that adding to a day and undoing it
   are symmetrical: a pick inserts exactly one record, an un-pick deletes
   exactly that record, and the authored day is not touched in either
   direction. Nothing merges, nothing rewrites, nothing has to be undone
   later by hand.

   THE PICK CARRIES NO TIME. The block it came out of has a start — "14:10" —
   and it would have been one line to stamp it onto the pick. It is not
   stamped, for two reasons:

     1. Nothing knows it. The trip file never said Huanglong Cave happens at
        14:10; the block start is where the LAST fixed thing let go of you.
        Writing it onto the item makes the app state a fact it invented, which
        is the one thing this app does not do (§RULES 2).
     2. It would close the block on the first pick. A timed item is a fixed
        point, so a pick stamped with the block's own start would split that
        block at its own opening edge — and the second thing you wanted to do
        with the same afternoon would have nowhere to go.

   So a pick lands untimed, in the day's "Anytime" list, beside the trip
   file's own untimed prose — which is exactly where an afternoon plan with no
   clock on it belongs. */
import { db } from '../db/db';
import { newId } from '../model/ids';
import { mutate } from './repo';
import type { Candidate } from '../logic/options';
import type { DayPick, Id, ISODate } from '../model/types';

/** Add one researched line to a day. Returns the new pick's id. */
export async function pickOption(
  tripId: Id,
  date: ISODate,
  stopId: Id | undefined,
  c: Candidate,
): Promise<Id> {
  const rec: DayPick = {
    id: newId(),
    tripId,
    date,
    /* Plain strings and numbers, built here rather than spread off a $state
       proxy — see docs/ARCHITECTURE.md §"binding rules". */
    text: String(c.raw),
    blockId: String(c.blockId),
    itemIndex: Number(c.index),
    ...(stopId ? { stopId } : {}),
    ...(c.spot ? { spotId: c.spot.id } : {}),
    origin: 'picked',
    createdAt: Date.now(),
  };
  await mutate(() => db.dayPicks.put(rec));
  return rec.id;
}

/** Remove exactly the row a pick wrote. The block re-opens by re-deriving. */
export async function unpick(id: Id): Promise<void> {
  await mutate(() => db.dayPicks.delete(id));
}

/** The picks of one day, oldest first — the order they joined it. */
export function picksOn(picks: DayPick[], date: ISODate): DayPick[] {
  return picks.filter((p) => p.date === date).sort((a, b) => a.createdAt - b.createdAt);
}

/** Which candidate ids this day has already taken → the pick that took them.
    Keyed the way logic/options.ts keys a candidate, so a row can flip to its
    "planned" look without the screen knowing how either id is built. */
export function pickedIndex(picks: DayPick[], date: ISODate): Map<string, Id> {
  const m = new Map<string, Id>();
  for (const p of picksOn(picks, date)) m.set(`${p.blockId}#${p.itemIndex}`, p.id);
  return m;
}

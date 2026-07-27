/* The arithmetic behind the Lists tab's progress rings.

   Three segments now draw the same neon ring — to-dos, packing and checklists —
   so the percentage lives here rather than inside the component, where only a
   browser could check it. The formula is the one the packing ring shipped with,
   moved unchanged: nothing is clamped and nothing is rounded differently,
   because a ring that disagreed with the `done/total` printed under it would be
   a new bug invented by a refactor. */
import type { Checklist } from '../model/types';

export interface Tally {
  done: number;
  total: number;
}

/** Whole percent, and 0 rather than NaN when there is nothing to finish. */
export function ringPct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** Every checklist on the trip counted as one list: ticked items over all items. */
export function tallyChecklists(lists: Checklist[]): Tally {
  let done = 0;
  let total = 0;
  for (const l of lists) {
    total += l.items.length;
    done += l.items.filter((i) => i.done).length;
  }
  return { done, total };
}

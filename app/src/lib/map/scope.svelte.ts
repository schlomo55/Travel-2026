/* WHICH PART OF THE TRIP THE MAP TAB IS ABOUT, AS THE PERSON LEFT IT (10 Nov 2026; the rule itself, and the
   default when nobody has chosen, are lib/logic/mapscope.ts). Module state, so leaving the Map tab — to a place's
   pass, to Now — and coming back finds the scope as it was: it changes ONLY when the person changes it. Kept
   per trip; never written to the phone, so a new start of the app opens on the default again. */
import type { ScopeId } from '../logic/mapscope';

let chosen = $state<{ tripId: string; id: ScopeId } | null>(null);

export const mapScope = {
  /** what this trip's scope was last set to; undefined: nobody has chosen */
  of(tripId: string): ScopeId | undefined {
    return chosen?.tripId === tripId ? chosen.id : undefined;
  },
  choose(tripId: string, id: ScopeId): void {
    chosen = { tripId, id };
  },
};

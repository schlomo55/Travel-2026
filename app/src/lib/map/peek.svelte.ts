/* THE "NEAR YOU" SHEET, SHOWN OR HIDDEN (Map 5e — the owner's addition: "i
   want to be able to press on a arrow or something to make it disipear and
   a arrow to reappear"). Hidden, the sheet at the foot of the Map tab is a
   slim bar — its title, how many places, and "Show places" — and the map
   takes the room back. Choosing a place still opens its sheet as ever.

   The choice lasts the session: it is module state, so leaving the Map tab
   and coming back finds it as it was left. It is also written to this
   phone's storage as a convenience, every touch guarded — a private window
   or blocked storage only means it is forgotten, never an error. */

export const PEEK_KEY = 'ltd:map:peekHidden';

type Reads = Pick<Storage, 'getItem'>;
type Writes = Pick<Storage, 'setItem' | 'removeItem'>;

/** What the phone remembers: hidden only if it says so, in every other case shown. */
export function readPeekHidden(store: Reads | null | undefined): boolean {
  try {
    return store?.getItem(PEEK_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remember it — or forget it quietly where the phone keeps nothing. */
export function writePeekHidden(store: Writes | null | undefined, hidden: boolean): void {
  try {
    if (hidden) store?.setItem(PEEK_KEY, '1');
    else store?.removeItem(PEEK_KEY);
  } catch {
    /* no storage: the session still remembers */
  }
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

let hidden = $state(readPeekHidden(storage()));

export const peek = {
  /** the places' sheet is folded to its bar */
  get hidden(): boolean {
    return hidden;
  },
  set(next: boolean): void {
    hidden = next;
    writePeekHidden(storage(), next);
  },
  toggle(): void {
    peek.set(!hidden);
  },
};

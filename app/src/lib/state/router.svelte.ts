/* Hash router + sheet layer stack (docs/ARCHITECTURE.md §5).
   Sheets push a history entry; Android back closes the top sheet, then leaves
   the screen, then (at root) minimizes the PWA — never a dead end. A close
   callback returning false vetoes the pop (dirty-form guard) and re-pushes.

   HORIZON'S INFORMATION ARCHITECTURE (docs/design/horizon/ROUND4.md):
   three places and a search —

     Now      #/trip/:id/now            the day (Run 1: the Lantern day view)
              #/trip/:id/now/todo[/…]   To do (Run 1: the Lantern lists)
     Journey  #/trip/:id/journey        Replay, the route check, the numbers
              #/trip/:id/journey/:stop  a city at real positions
              #/trip/:id/journey/:stop/guide   its guide, the long read
     Pocket   #/trip/:id/pocket         everything to show, offline
              #/trip/:id/pocket/:bookingId   the pass
              #/trip/:id/pocket/<section>    travel · stays · experiences ·
                                             cards · money · docs · driver ·
                                             phrases · visa · emergency ·
                                             convert · health · info ·
                                             notes · clocks
     Find     #/trip/:id/find

   EVERY LINK EVER WRITTEN STILL RESOLVES. Five tabs, three retired Info
   routes and their sub-paths live in backups, in the owner's memory and in
   the rehearsal; each is aliased onto the place that now holds its content
   (the same move MERGED_INTO_INFO made in Phase 1), and the address bar is
   quietly rewritten to the new name so a back-press never lands on an old
   one. Counter mode and the driver card are LAYERS, not routes. */

import { parseHash, routeHash, tabPath, type TabName } from '../logic/routes';

export {
  isPocketSection,
  parseHash,
  PLACES,
  POCKET_SECTIONS,
  routeHash,
  type LegacyTab,
  type Place,
  type PocketSection,
  type Route,
  type TabName,
} from '../logic/routes';

type LayerClose = () => boolean | void; // return false to veto (dirty guard)
type EntryState = { layer?: number; i?: number } | null;

class Router {
  hash = $state(typeof location !== 'undefined' ? location.hash || '#/' : '#/');
  route = $derived(parseHash(this.hash));
  /** An element id the NEXT screen should scroll to once it has mounted.
      Deep links inside a screen cannot ride on the hash — the hash is the
      route — so the target is handed over here and the screen consumes it. */
  pendingAnchor = $state<string | null>(null);
  /** How many sheets are open, as state a screen can read. */
  depth = $state(0);
  /** A screen whose subject is gone is being left (backPast) — the shell
      draws no "not found" card for the entries it steps back through. */
  leaving = $state(false);
  /** The address the current one was reached from (the last hash change) —
      where a screen was opened from, for a close button's name. */
  prev: string | null = null;
  private layers: LayerClose[] = [];
  /** THIS ENTRY'S PLACE IN THE SESSION (Run 3c). Every history entry the app
      makes carries its index as `history.state.i` — stamped as it is made,
      found again on back and forward — so "is there anything of this app
      behind me?" has an exact answer: `at > 0`. (Counting hash changes, as
      before, also counted the backward ones.) */
  private at = 0;

  private stamp(fresh: boolean): void {
    const s = history.state as EntryState;
    if (typeof s?.i === 'number') this.at = s.i;
    else {
      if (fresh) this.at++;
      history.replaceState({ ...(s ?? {}), i: this.at }, '');
    }
  }

  start(): void {
    const sync = (): void => {
      const h = location.hash || '#/';
      const r = parseHash(h);
      /* An alias carries a section to land on; hand it to the screen. */
      if (r.name === 'trip' && r.anchor) this.pendingAnchor = r.anchor;
      /* An old name resolves, then the address bar is rewritten to the new
         one — without a history entry, so back never meets the old name. */
      const canonical = routeHash(r);
      if (r.name === 'trip' && canonical !== h) {
        history.replaceState(history.state, '', location.pathname + location.search + canonical);
        this.hash = canonical;
      } else {
        this.hash = h;
      }
    };
    this.stamp(false);
    sync();
    window.addEventListener('hashchange', () => {
      this.prev = this.hash;
      this.stamp(true);
      sync();
    });
    window.addEventListener('popstate', (e) => this.onPop(e));
  }

  go(to: string): void {
    if (location.hash === to) return;
    location.hash = to;
  }

  /** A screen's own ‹ button. With somewhere behind it in this session it is
      the same as Android back — the screen you came from, scroll and all.
      Opened cold from a link, there is nothing behind it, so it goes UP to
      `fallback` instead of out of the app. */
  backOr(fallback: string): void {
    if (this.at > 0) history.back();
    else this.go(fallback);
  }

  /** LEAVE A SCREEN WHOSE SUBJECT IS GONE (Run 3c — a stop deleted from its
      own guide). Step back past every entry `gone` claims (the guide, the
      city before it), never past the start of this session; then show
      `fallback` — as it is, if that is where the steps land; in place of
      the last dead entry, if nothing of the app lies behind it; else on
      top, so one back press returns to where you were before. Never a
      "not found" screen, never a back press that lands on one. */
  async backPast(gone: (hash: string) => boolean, fallback: string): Promise<void> {
    this.leaving = true;
    try {
      while (gone(location.hash) && this.at > 0) {
        /* one step back — and never wait forever for a step that does not come */
        const popped = await new Promise<boolean>((r) => {
          const t = setTimeout(() => r(false), 1500);
          window.addEventListener('popstate', () => (clearTimeout(t), r(true)), { once: true });
          history.back();
        });
        if (!popped) break;
      }
      if (gone(location.hash)) this.replace(fallback);
      else this.go(fallback);
    } finally {
      this.leaving = false;
    }
  }

  /** Replace the current entry (used by redirects) — no history growth. */
  replace(to: string): void {
    const url = location.pathname + location.search + to;
    history.replaceState(history.state, '', url);
    this.hash = to;
  }

  /** A place, or any tab id the app ever used — old ids resolve through the
      alias table, so the fifteen call sites that still say 'today' or
      'itinerary' land where their content lives now. */
  goTab(tripId: string, tab: TabName): void {
    this.go(tabPath(tripId, tab));
  }

  /** A Pocket screen: a section name or a booking id (the pass). */
  goPocket(tripId: string, sub?: string): void {
    this.go(`#/trip/${tripId}/pocket${sub ? `/${encodeURIComponent(sub)}` : ''}`);
  }

  /** THE COMPLIANCE CLOCK, SPELLED OUT. Pocket's Visa screen holds every
      counter in full — day, days left, hard deadline and the note that
      explains the rule — and the doorways to it (the app bar's pill, Now's
      visa card, the Pocket tile) all go through this one function, so they
      can never open onto different places. */
  goCompliance(tripId: string): void {
    this.goPocket(tripId, 'visa');
  }

  /** THE GUIDE, OPENED AT A CHAPTER. Now's free blocks cap themselves at
      four rows and defer the rest to the guide's "All the options" — far
      down the longest page in the app, so landing at its top would be the
      same as not linking at all. */
  goGuide(tripId: string, stopId: string, anchor?: string): void {
    if (anchor) this.pendingAnchor = anchor;
    this.go(`#/trip/${tripId}/journey/${encodeURIComponent(stopId)}/guide`);
  }
  goStopOptions(tripId: string, stopId: string): void {
    this.goGuide(tripId, stopId, 'g-options');
  }

  /** A sheet registers itself; returns nothing — closing happens via back(). */
  pushLayer(close: LayerClose): void {
    this.layers.push(close);
    this.depth = this.layers.length;
    history.pushState({ layer: this.layers.length, i: ++this.at }, '');
  }

  /** Programmatic close of the top sheet (the ✕ button, or after save). */
  closeTopLayer(): void {
    if (this.layers.length > 0) history.back();
  }

  get layerDepth(): number {
    return this.layers.length;
  }

  private onPop(e: PopStateEvent): void {
    const st = e.state as EntryState;
    if (typeof st?.i === 'number') this.at = st.i;
    const targetDepth = st?.layer ?? 0;
    while (this.layers.length > targetDepth) {
      const top = this.layers[this.layers.length - 1];
      if (top && top() === false) {
        history.pushState({ layer: this.layers.length, i: ++this.at }, ''); // vetoed — restore
        return;
      }
      this.layers.pop();
      this.depth = this.layers.length;
    }
  }
}

export const router = new Router();

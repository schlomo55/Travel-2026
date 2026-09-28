/* Hash router + sheet layer stack (docs/ARCHITECTURE.md §5).
   Sheets push a history entry; Android back closes the top sheet, then leaves
   the screen, then (at root) minimizes the PWA — never a dead end. A close
   callback returning false vetoes the pop (dirty-form guard) and re-pushes.

   HORIZON'S INFORMATION ARCHITECTURE (docs/design/horizon/ROUND4.md):
   three places and a search —

     Now      #/trip/:id/now            the day (Run 1: the Lantern day view)
              #/trip/:id/now/todo[/…]   To do (Run 1: the Lantern lists)
     Journey  #/trip/:id/journey        route, coverage, every stop
              #/trip/:id/journey/:stop  a city and its guide
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

class Router {
  hash = $state(typeof location !== 'undefined' ? location.hash || '#/' : '#/');
  route = $derived(parseHash(this.hash));
  /** An element id the NEXT screen should scroll to once it has mounted.
      Deep links inside a screen cannot ride on the hash — the hash is the
      route — so the target is handed over here and the screen consumes it. */
  pendingAnchor = $state<string | null>(null);
  private layers: LayerClose[] = [];
  /** How many screens this session has moved through — a screen's own ‹
      goes back through them, and "up" only when there is nothing behind. */
  private moves = 0;

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
    sync();
    window.addEventListener('hashchange', () => {
      this.moves++;
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
    if (this.moves > 0) history.back();
    else this.go(fallback);
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

  /** THE GUIDE, OPENED AT ITS OPTIONS. Now's free blocks cap themselves at
      four rows and defer the rest to the city guide's "All the options"
      section — ~11,800 px down the longest page in the app, so landing at
      its top would be the same as not linking at all. */
  goStopOptions(tripId: string, stopId: string): void {
    this.pendingAnchor = 'g-options';
    this.go(`#/trip/${tripId}/journey/${encodeURIComponent(stopId)}`);
  }

  /** A sheet registers itself; returns nothing — closing happens via back(). */
  pushLayer(close: LayerClose): void {
    this.layers.push(close);
    history.pushState({ layer: this.layers.length }, '');
  }

  /** Programmatic close of the top sheet (the ✕ button, or after save). */
  closeTopLayer(): void {
    if (this.layers.length > 0) history.back();
  }

  get layerDepth(): number {
    return this.layers.length;
  }

  private onPop(e: PopStateEvent): void {
    const targetDepth = (e.state as { layer?: number } | null)?.layer ?? 0;
    while (this.layers.length > targetDepth) {
      const top = this.layers[this.layers.length - 1];
      if (top && top() === false) {
        history.pushState({ layer: this.layers.length }, ''); // vetoed — restore
        return;
      }
      this.layers.pop();
    }
  }
}

export const router = new Router();

/* Hash router + sheet layer stack (docs/ARCHITECTURE.md §5).
   Sheets push a history entry; Android back closes the top sheet, then leaves
   the screen, then (at root) minimizes the PWA — never a dead end. A close
   callback returning false vetoes the pop (dirty-form guard) and re-pushes. */

export type TabName = 'today' | 'itinerary' | 'wallet' | 'tasks' | 'info' | 'map' | 'stats' | 'docs';
export const TRIP_TABS: TabName[] = ['today', 'itinerary', 'wallet', 'tasks', 'info'];

/* Info absorbed the route map, the documents and the statistics in Phase 1
   (plan §SCREENS 6). The three old routes keep working — every deep link ever
   written, in a backup file or in the owner's head, still lands somewhere
   true — they just resolve onto the tab that now holds their content. */
const MERGED_INTO_INFO: Partial<Record<string, TabName>> = { map: 'info', stats: 'info', docs: 'info' };

export type Route =
  | { name: 'redirect' }
  | { name: 'shelf' }
  | { name: 'settings' }
  | { name: 'backup' }
  | { name: 'trip'; tripId: string; tab: TabName; sub?: string };

function parseHash(h: string): Route {
  const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
  const p0 = parts[0];
  if (!p0) return { name: 'redirect' };
  if (p0 === 'trips') return { name: 'shelf' };
  if (p0 === 'settings') return { name: 'settings' };
  if (p0 === 'backup') return { name: 'backup' };
  if (p0 === 'trip' && parts[1]) {
    const raw = parts[2] ?? 'today';
    const tab = (MERGED_INTO_INFO[raw] ?? raw) as TabName;
    /* the merged routes carried no sub-path worth keeping */
    return { name: 'trip', tripId: parts[1], tab, sub: MERGED_INTO_INFO[raw] ? undefined : parts[3] };
  }
  return { name: 'shelf' };
}

type LayerClose = () => boolean | void; // return false to veto (dirty guard)

class Router {
  hash = $state(typeof location !== 'undefined' ? location.hash || '#/' : '#/');
  route = $derived(parseHash(this.hash));
  /** An element id the NEXT screen should scroll to once it has mounted.
      Deep links inside a screen cannot ride on the hash — the hash is the
      route — so the target is handed over here and the screen consumes it. */
  pendingAnchor = $state<string | null>(null);
  private layers: LayerClose[] = [];

  start(): void {
    window.addEventListener('hashchange', () => {
      this.hash = location.hash || '#/';
    });
    window.addEventListener('popstate', (e) => this.onPop(e));
  }

  go(to: string): void {
    if (location.hash === to) return;
    location.hash = to;
  }

  /** Replace the current entry (used by redirects) — no history growth. */
  replace(to: string): void {
    const url = location.pathname + location.search + to;
    history.replaceState(history.state, '', url);
    this.hash = to;
  }

  goTab(tripId: string, tab: TabName): void {
    this.go(`#/trip/${tripId}/${tab}`);
  }

  /** THE COMPLIANCE CLOCK, SPELLED OUT. Info holds the counter in full — day,
      days left, hard deadline and the note that explains the rule — and two
      controls now lead there: the app bar's status pill and Home's visa card.
      One function, so the two doorways can never open onto different places. */
  goCompliance(tripId: string): void {
    this.goTab(tripId, 'info');
    setTimeout(
      () => document.getElementById('compliance')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      140,
    );
  }

  /** THE GUIDE, OPENED AT ITS OPTIONS. Home's free blocks cap themselves at
      four rows and defer the rest to the city guide's "All the options"
      section — which is ~11,800 px down the longest page in the app, so
      landing at its top would be the same as not linking at all. */
  goStopOptions(tripId: string, stopId: string): void {
    this.pendingAnchor = 'g-options';
    this.go(`#/trip/${tripId}/itinerary/${stopId}`);
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

/* Hash router + sheet layer stack (docs/ARCHITECTURE.md §5).
   Sheets push a history entry; Android back closes the top sheet, then leaves
   the screen, then (at root) minimizes the PWA — never a dead end. A close
   callback returning false vetoes the pop (dirty-form guard) and re-pushes.
   Closing is a step back, and a step back lands later: `closeTopLayer()`
   resolves when the layer has really closed, and nothing is pushed while
   the router's own step is on its way (Run 4b). A sheet that unmounts
   without being closed hands its layer back (`pushLayer`'s release).

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
/** A layer as the router holds it (Run 4b). */
interface Layer {
  close: LayerClose;
  /** Its owner is gone (the sheet unmounted): its close still runs when it is
      popped, but can no longer refuse. */
  gone?: boolean;
  /** The step back that closes it, while that step is on its way. */
  closing?: Promise<boolean>;
}

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
  private layers: Layer[] = [];
  /** THE ROUTER'S OWN STEP BACK, WHILE IT IS ON ITS WAY (Run 4b). `history.back()`
      lands later, in a task of its own, and takes its target when it is
      CALLED: anything pushed before it lands — a sheet opened, or a screen
      gone to, the instant another sheet closed — is undone by it (Chrome
      lands on the entry under the closed sheet, behind the new one: Edit
      trip's wizard closed as it opened, Create and Import landed on the
      shelf). So until the step has landed the router pushes nothing: `go`,
      `replace`, `backOr`, `backPast` and a new layer wait for it. */
  private step: Promise<boolean> | null = null;
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

  /** Run `fn` once no step back of the router's own is on its way — at once
      when none is (Run 4b; see `step`). */
  private whenStill(fn: () => void): void {
    if (this.step) void this.step.then(() => this.whenStill(fn));
    else fn();
  }

  go(to: string): void {
    this.whenStill(() => {
      if (location.hash === to) return;
      location.hash = to;
    });
  }

  /** A screen's own ‹ button. With somewhere behind it in this session it is
      the same as Android back — the screen you came from, scroll and all.
      Opened cold from a link, there is nothing behind it, so it goes UP to
      `fallback` instead of out of the app. */
  backOr(fallback: string): void {
    this.whenStill(() => {
      if (this.at > 0) history.back();
      else this.go(fallback);
    });
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
      /* the sheet that deleted the subject lands first (Run 4b: it is
         called from that sheet's onclose, inside the step that closes it) */
      while (this.step) await this.step;
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

  /** Replace the current entry (used by redirects) — no history growth. A
      sheet on its way out lands first, so the entry replaced is the screen's,
      never the closing sheet's (Run 4b). */
  replace(to: string): void {
    this.whenStill(() => {
      const url = location.pathname + location.search + to;
      history.replaceState(history.state, '', url);
      this.hash = to;
    });
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

  /** A sheet registers itself; closing happens via back(). Returns the
      layer's RELEASE, for its owner to call as it goes (Run 4b — see
      `release`). While a step back is on its way the layer opens once it
      has landed, so that step cannot close it. */
  pushLayer(close: LayerClose): () => void {
    const layer: Layer = { close };
    this.whenStill(() => {
      if (layer.gone) return; // its owner went before it could open
      this.layers.push(layer);
      this.depth = this.layers.length;
      history.pushState({ layer: this.layers.length, i: ++this.at }, '');
    });
    return () => this.release(layer);
  }

  /** Programmatic close of the top sheet (the ✕ button, or after save).
      RESOLVES WHEN IT HAS REALLY CLOSED (Run 4b), so "close, then go or
      open" awaits it: true once the layer is gone, false if its guard kept
      it (a dirty form) or no step came. With nothing open, true at once. A
      second call while the close is on its way is the same close — a double
      tap on ✕ never leaves the screen. */
  closeTopLayer(): Promise<boolean> {
    const top = this.layers[this.layers.length - 1];
    if (!top) return Promise.resolve(true);
    return top.closing ?? this.stepBack(top);
  }

  get layerDepth(): number {
    return this.layers.length;
  }

  /** One step back, off `layer`'s entry. Settled by the popstate it makes,
      once `onPop` has handled it (the router's own listener runs first) —
      or after 1.5 s, like `backPast`, should the step never come. */
  private stepBack(layer: Layer): Promise<boolean> {
    const p = new Promise<boolean>((resolve) => {
      const done = (): void => {
        clearTimeout(timer);
        window.removeEventListener('popstate', done);
        layer.closing = undefined;
        if (this.step === p) this.step = null;
        resolve(!this.layers.includes(layer));
      };
      const timer = setTimeout(done, 1500);
      window.addEventListener('popstate', done);
    });
    layer.closing = p;
    this.step = p;
    history.back();
    return p;
  }

  /** A LAYER'S OWNER IS GONE (Run 4b) — a sheet unmounted because the flag
      that showed it was cleared, or its screen went. If its entry is the one
      on screen the router steps off it: left there, the next back press was
      spent on a sheet no one could see, and `depth` stayed up. Its close
      still runs once, as the step lands (the owner's onclose may be what
      moves the app on), but it can no longer veto. Already closed by back or
      ✕ (the popstate took it), or closing: no step — never a second one.
      Under a layer that is still open, it is stepped past when that one
      closes. */
  private release(layer: Layer): void {
    if (layer.gone) return;
    layer.gone = true;
    if (!this.layers.includes(layer) || layer.closing) return;
    this.whenStill(() => {
      const top = this.layers[this.layers.length - 1];
      const onScreen = (history.state as EntryState)?.layer === this.layers.length;
      if (top === layer && !layer.closing && onScreen) void this.stepBack(layer);
    });
  }

  private onPop(e: PopStateEvent): void {
    const st = e.state as EntryState;
    if (typeof st?.i === 'number') this.at = st.i;
    const targetDepth = st?.layer ?? 0;
    while (this.layers.length > targetDepth) {
      const top = this.layers[this.layers.length - 1];
      /* Its close runs even when its owner has gone: what the owner does on
         closing must still happen — a stop deleted from its guide takes the
         guide's whole screen, sheet and all, before the sheet has closed, and
         that sheet's onclose is what moves on. But a layer whose owner is
         gone cannot refuse (Run 4b): no sheet is left to ask again. */
      if (top && top.close() === false && !top.gone) {
        history.pushState({ layer: this.layers.length, i: ++this.at }, ''); // vetoed — restore
        return;
      }
      this.layers.pop();
      this.depth = this.layers.length;
    }
    /* back onto the entry of a layer whose owner has gone: off it too */
    const top = this.layers[this.layers.length - 1];
    if (top?.gone && !top.closing && targetDepth === this.layers.length) void this.stepBack(top);
  }
}

export const router = new Router();

/* THE ROUTER'S HISTORY — the session index, backOr, backPast and the veto
   (Horizon Run 4; until now the rehearsal was its only test).

   The router is history, not logic: what it does is only visible through the
   browser's session history. So these tests give it one — an in-memory
   `location`, `history` and `window` that keep the HTML standard's order of
   events, because the router's correctness lives in that order:

   · setting `location.hash` is a fragment navigation: a NEW entry (the
     forward entries are dropped), `popstate` fired at once with that entry's
     state (null), and `hashchange` queued as a task;
   · `history.back()` / `go(n)` traverse LATER, in a task of their own:
     `popstate` with the entry's state, then `hashchange` queued if the
     fragment changed; at the first entry there is nothing to go back to and
     nothing happens;
   · `pushState` / `replaceState` fire nothing.

   Each test imports a fresh router (vi.resetModules) onto a fresh history,
   with fake timers, so "later" is exact: `settle()` runs every queued task. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = { fn: (e: unknown) => void; once: boolean };
type Entry = { url: string; state: unknown };

class SessionHistory {
  entries: Entry[];
  index = 0;
  /** history.back() calls — a screen's ‹ that went back rather than up */
  backs = 0;
  /** a traversal the browser never performs (the step that never comes) */
  stall = false;
  private listeners = new Map<string, Set<Listener>>();

  constructor(start: string) {
    this.entries = [{ url: new URL(start, 'https://app.test/').href, state: null }];
  }
  get url(): URL {
    return new URL(this.entries[this.index]!.url);
  }
  /** the hashes of every entry, `*` marking the current one */
  get trail(): string[] {
    return this.entries.map((e, i) => `${i === this.index ? '*' : ''}${new URL(e.url).hash}`);
  }

  private fire(type: string, event: unknown): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) {
      if (l.once) this.listeners.get(type)!.delete(l);
      l.fn(event);
    }
  }
  private traverse(delta: number): void {
    const to = this.index + delta;
    if (this.stall || to < 0 || to >= this.entries.length) return;
    setTimeout(() => {
      const oldHash = this.url.hash;
      this.index = to;
      this.fire('popstate', { state: structuredClone(this.entries[to]!.state) });
      if (this.url.hash !== oldHash) setTimeout(() => this.fire('hashchange', {}), 0);
    }, 0);
  }

  readonly window = {
    addEventListener: (type: string, fn: (e: unknown) => void, opts?: { once?: boolean }): void => {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add({ fn, once: !!opts?.once });
    },
    removeEventListener: (type: string, fn: (e: unknown) => void): void => {
      for (const l of this.listeners.get(type) ?? []) if (l.fn === fn) this.listeners.get(type)!.delete(l);
    },
  };

  readonly location = ((h: SessionHistory) => ({
    get hash(): string {
      return h.url.hash;
    },
    set hash(v: string) {
      const next = new URL(h.url);
      next.hash = v;
      if (next.href === h.url.href) return; // the same fragment: no navigation
      h.entries.splice(h.index + 1, Infinity, { url: next.href, state: null });
      h.index++;
      h.fire('popstate', { state: null });
      setTimeout(() => h.fire('hashchange', {}), 0);
    },
    get pathname(): string {
      return h.url.pathname;
    },
    get search(): string {
      return h.url.search;
    },
  }))(this);

  readonly history = ((h: SessionHistory) => ({
    get state(): unknown {
      return structuredClone(h.entries[h.index]!.state);
    },
    get length(): number {
      return h.entries.length;
    },
    pushState(state: unknown, _title: string, url?: string): void {
      h.entries.splice(h.index + 1, Infinity, { url: url ? new URL(url, h.url).href : h.url.href, state: structuredClone(state) });
      h.index++;
    },
    replaceState(state: unknown, _title: string, url?: string): void {
      h.entries[h.index] = { url: url ? new URL(url, h.url).href : h.url.href, state: structuredClone(state) };
    },
    back(): void {
      h.backs++;
      h.traverse(-1);
    },
    forward(): void {
      h.traverse(1);
    },
    go(n: number): void {
      h.traverse(n);
    },
  }))(this);
}

let web: SessionHistory;
const settle = (): Promise<void> => vi.runAllTimersAsync().then(() => undefined);

/** A fresh router, started on `start`, the way App.svelte starts it. */
async function boot(start: string) {
  web = new SessionHistory(start);
  vi.stubGlobal('window', web.window);
  vi.stubGlobal('location', web.location);
  vi.stubGlobal('history', web.history);
  vi.resetModules();
  const { router } = await import('../lib/state/router.svelte');
  router.start();
  return router;
}
/** The session index stamped on the current entry. */
const here = (): unknown => (web.history.state as { i?: number } | null)?.i;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('router · every entry knows its place in the session', () => {
  it('stamps the first entry 0, and each new one the next number', async () => {
    const router = await boot('/#/trips');
    expect(here()).toBe(0);
    router.go('#/trip/cn26/now');
    await settle();
    expect(here()).toBe(1);
    router.go('#/trip/cn26/journey');
    await settle();
    expect(here()).toBe(2);
    expect(web.trail).toEqual(['#/trips', '#/trip/cn26/now', '*#/trip/cn26/journey']);
    expect(router.hash).toBe('#/trip/cn26/journey');
    expect(router.prev).toBe('#/trip/cn26/now');
  });

  /* Back and forward do not count up: the entry already carries its number,
     and it is read back — this is what counting hash changes got wrong. */
  it('finds the number again on back and forward, and never restamps it', async () => {
    const router = await boot('/#/trips');
    router.go('#/trip/cn26/now');
    await settle();
    router.go('#/trip/cn26/pocket');
    await settle();
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/now');
    expect(here()).toBe(1);
    web.history.back();
    await settle();
    expect(here()).toBe(0);
    web.history.forward();
    await settle();
    expect(here()).toBe(1);
    expect(web.entries.map((e) => (e.state as { i: number }).i)).toEqual([0, 1, 2]);
  });

  it('keeps an entry’s own state when it stamps it (a layer’s depth survives)', async () => {
    await boot('/#/trips');
    web.history.replaceState({ layer: 0, keep: 'me' }, '');
    web.location.hash = '#/trip/cn26/find';
    await settle();
    web.history.back();
    await settle();
    expect(web.history.state).toMatchObject({ keep: 'me', layer: 0 });
  });

  it('an old name resolves in place: the address is rewritten, no entry is added', async () => {
    const router = await boot('/#/trips');
    router.go('#/trip/cn26/wallet');
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
    expect(web.trail).toEqual(['#/trips', '*#/trip/cn26/pocket']);
    expect(here()).toBe(1);
  });

  /* The ?d= preview rides in the search part: rewriting the hash keeps it. */
  it('keeps the ?d= preview when it rewrites an address', async () => {
    const router = await boot('/?d=2026-12-11#/trip/cn26/today');
    expect(router.hash).toBe('#/trip/cn26/now');
    expect(web.url.search).toBe('?d=2026-12-11');
    router.replace('#/trip/cn26/journey');
    expect(web.url.search).toBe('?d=2026-12-11');
  });
});

describe('router · backOr — back where the app has been, else up', () => {
  it('opened cold from a link, ‹ goes up to the fallback, not out of the app', async () => {
    const router = await boot('/#/trip/cn26/pocket/visa');
    router.backOr('#/trip/cn26/pocket');
    await settle();
    expect(web.backs).toBe(0);
    expect(web.trail).toEqual(['#/trip/cn26/pocket/visa', '*#/trip/cn26/pocket']);
  });

  it('with somewhere behind it, ‹ is Android back', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket/visa');
    await settle();
    router.backOr('#/trip/cn26/pocket');
    await settle();
    expect(web.backs).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/now');
    expect(web.trail).toEqual(['*#/trip/cn26/now', '#/trip/cn26/pocket/visa']);
  });

  /* The Run 3c bug: a count of hash changes also counted the step BACK to
     the first entry, so a second ‹ there went back — out of the app. */
  it('back on the first entry again, ‹ knows nothing of the app is behind it', async () => {
    const router = await boot('/#/trip/cn26/journey');
    router.go('#/trip/cn26/journey/cn26-stop-kunyu');
    await settle();
    router.backOr('#/trip/cn26/journey');
    await settle();
    expect(router.hash).toBe('#/trip/cn26/journey');
    router.backOr('#/trips');
    await settle();
    expect(web.backs).toBe(1);
    expect(router.hash).toBe('#/trips');
  });

  it('a sheet’s entry counts as somewhere the app has been', async () => {
    const router = await boot('/#/trip/cn26/pocket/visa');
    router.pushLayer(() => true);
    expect(here()).toBe(1);
    router.backOr('#/trip/cn26/pocket');
    await settle();
    expect(web.backs).toBe(1);
    expect(router.layerDepth).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket/visa');
  });
});

describe('router · layers — Android back closes the top one first', () => {
  it('a layer is an entry of its own, stamped with its depth and its place', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.pushLayer(() => true);
    expect(web.history.state).toEqual({ layer: 1, i: 1 });
    expect(router.depth).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/pocket');
    expect(web.url.hash).toBe('#/trip/cn26/pocket');
  });

  it('back closes the top layer only, then the next, then leaves the screen', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket');
    await settle();
    const closed: string[] = [];
    router.pushLayer(() => void closed.push('sheet'));
    router.pushLayer(() => void closed.push('driver card'));
    expect(router.depth).toBe(2);
    web.history.back();
    await settle();
    expect(closed).toEqual(['driver card']);
    expect(router.depth).toBe(1);
    router.closeTopLayer();
    await settle();
    expect(closed).toEqual(['driver card', 'sheet']);
    expect(router.depth).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket');
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/now');
  });

  it('closeTopLayer with no layer open does nothing, and says nothing is open', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket');
    await settle();
    const closed = router.closeTopLayer();
    await settle();
    expect(await closed).toBe(true);
    expect(web.backs).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  /* THE VETO: a dirty form's guard returns false. The layer stays, its
     entry is put back (so the next back press asks again), and nothing
     below it is touched. */
  it('a guard that says no keeps the layer, its entry and its place', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    let dirty = true;
    let closes = 0;
    router.pushLayer(() => {
      if (dirty) return false;
      closes++;
      return true;
    });
    const before = web.entries.length;
    web.history.back();
    await settle();
    expect(router.depth).toBe(1);
    expect(router.layerDepth).toBe(1);
    expect(closes).toBe(0);
    expect(web.history.state).toEqual({ layer: 1, i: 1 });
    expect(web.entries.length).toBe(before);
    /* …asked again on the next back press, and this time it may close */
    dirty = false;
    web.history.back();
    await settle();
    expect(closes).toBe(1);
    expect(router.depth).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket');
    expect(here()).toBe(0);
  });

  it('a veto on the upper of two layers leaves both open', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    let lower = 0;
    router.pushLayer(() => void lower++);
    router.pushLayer(() => false);
    web.history.back();
    await settle();
    expect(router.depth).toBe(2);
    expect(lower).toBe(0);
  });

  it('a link followed from inside a sheet closes it (the new entry has no layer)', async () => {
    const router = await boot('/#/trip/cn26/now');
    let closed = 0;
    router.pushLayer(() => void closed++);
    router.go('#/trip/cn26/pocket/cn26-flight-ey888');
    await settle();
    expect(closed).toBe(1);
    expect(router.depth).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket/cn26-flight-ey888');
    expect(here()).toBe(2);
  });
});

describe('router · backPast — leaving a screen whose subject is gone', () => {
  const mine = '#/trip/cn26/journey/cn26-stop-zjj';
  const gone = (h: string): boolean => h === mine || h.startsWith(`${mine}/`);

  /* The walk the rehearsal makes: Pocket → Journey → the city → its guide →
     edit → delete. The sheet closes, then the router steps back past the
     guide and the city and lands on the Journey — as it was, so one more
     back press returns to the Pocket. */
  it('steps back past every entry of the deleted stop to where the app was', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    for (const to of ['#/trip/cn26/journey', mine, `${mine}/guide`]) {
      router.go(to);
      await settle();
    }
    router.pushLayer(() => true);
    router.closeTopLayer();
    await settle();
    const leaving = router.backPast(gone, '#/trip/cn26/journey');
    expect(router.leaving).toBe(true);
    await settle();
    await leaving;
    expect(router.leaving).toBe(false);
    expect(router.hash).toBe('#/trip/cn26/journey');
    expect(web.trail.indexOf('*#/trip/cn26/journey')).toBe(1);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  /* Landing somewhere else than the fallback: the Journey goes on top, so the
     screen before it is still one back press away. */
  it('puts the fallback on top of an unrelated screen it lands on', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    for (const to of [mine, `${mine}/guide`]) {
      router.go(to);
      await settle();
    }
    const p = router.backPast(gone, '#/trip/cn26/journey');
    await settle();
    await p;
    expect(web.trail).toEqual(['#/trip/cn26/pocket', '*#/trip/cn26/journey']);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  /* Opened cold on the guide: nothing of the app lies behind it, so the dead
     entry is replaced — never a back press out of the app, never a page that
     says "not found". */
  it('replaces the dead entry when the session began on it', async () => {
    const router = await boot(`/#${mine.slice(1)}/guide`);
    const p = router.backPast(gone, '#/trip/cn26/journey');
    await settle();
    await p;
    expect(web.backs).toBe(0);
    expect(web.trail).toEqual(['*#/trip/cn26/journey']);
    expect(router.hash).toBe('#/trip/cn26/journey');
    expect(router.leaving).toBe(false);
  });

  it('never steps past the start of the session', async () => {
    const router = await boot(`/#${mine.slice(1)}`);
    router.go(`${mine}/guide`);
    await settle();
    const p = router.backPast(gone, '#/trip/cn26/journey');
    await settle();
    await p;
    expect(web.backs).toBe(1);
    expect(web.trail).toEqual(['*#/trip/cn26/journey', `${mine}/guide`]);
  });

  /* A step that never comes (the browser drops the traversal): after 1.5 s
     the router stops waiting and replaces the dead entry it is still on. */
  it('does not wait forever for a step that never comes', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.go(`${mine}/guide`);
    await settle();
    web.stall = true;
    const p = router.backPast(gone, '#/trip/cn26/journey');
    await vi.advanceTimersByTimeAsync(1499);
    expect(router.leaving).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(router.leaving).toBe(false);
    expect(web.trail).toEqual(['#/trip/cn26/pocket', '*#/trip/cn26/journey']);
  });

  it('with nothing gone, it simply goes to the fallback', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    const p = router.backPast(gone, '#/trip/cn26/journey');
    await settle();
    await p;
    expect(web.backs).toBe(0);
    expect(web.trail).toEqual(['#/trip/cn26/pocket', '*#/trip/cn26/journey']);
  });
});

/* ============================================================
   RUN 4b — CLOSING IS A STEP BACK, AND A STEP BACK LANDS LATER.
   `history.back()` takes its target when it is called and lands in a task
   of its own: anything pushed in between is undone by it. The review found
   it in Chrome — Edit trip closed the menu and opened the wizard, and the
   step landed behind the wizard's entry and took the wizard with it; Create
   and Import closed their sheet and went to the trip, and landed on the
   shelf. `closeTopLayer()` now resolves when the layer has really closed,
   and the router pushes nothing while its own step is on its way.
   ============================================================ */
describe('router · close, then go or open (Run 4b)', () => {
  /* the model keeps Chrome's order, or none of this proves anything */
  it('the session history reproduces the race: a back, then a push, lands behind the push', async () => {
    await boot('/#/trips');
    web.history.pushState({ layer: 1, i: 1 }, '');
    web.history.back();
    web.location.hash = '#/trip/new/now';
    await settle();
    expect(web.url.hash).toBe('#/trips');
  });

  it('closeTopLayer resolves once the layer has really closed', async () => {
    const router = await boot('/#/trips');
    let closes = 0;
    router.pushLayer(() => void closes++);
    let settled = false;
    const p = router.closeTopLayer().then((r) => ((settled = true), r));
    await Promise.resolve();
    expect(settled).toBe(false); // the step has not landed yet
    expect(router.depth).toBe(1);
    await settle();
    expect(await p).toBe(true);
    expect(closes).toBe(1);
    expect(router.depth).toBe(0);
  });

  /* Create a trip, import one: the sheet closes, then the app goes to the trip */
  it('awaited, close-then-go lands on the new screen, and back returns to the one under the sheet', async () => {
    const router = await boot('/#/trips');
    router.pushLayer(() => true);
    const landed = (async () => {
      await router.closeTopLayer();
      router.goTab('new', 'now');
    })();
    await settle();
    await landed;
    expect(router.hash).toBe('#/trip/new/now');
    expect(web.trail).toEqual(['#/trips', '*#/trip/new/now']);
    expect(router.depth).toBe(0);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trips');
  });

  it('not awaited, the router still waits for its own step before it goes', async () => {
    const router = await boot('/#/trips');
    router.pushLayer(() => true);
    void router.closeTopLayer();
    router.goTab('new', 'now');
    await settle();
    expect(router.hash).toBe('#/trip/new/now');
    expect(web.trail).toEqual(['#/trips', '*#/trip/new/now']);
  });

  /* Edit trip: the menu closes, the wizard opens — and stays open */
  it('close one sheet, then open another: the new one stays open', async () => {
    const router = await boot('/#/trips');
    const closed: string[] = [];
    router.pushLayer(() => void closed.push('menu'));
    const menu = router.closeTopLayer();
    await settle();
    expect(await menu).toBe(true);
    router.pushLayer(() => void closed.push('wizard'));
    await settle();
    expect(closed).toEqual(['menu']);
    expect(router.depth).toBe(1);
    expect(web.history.state).toMatchObject({ layer: 1 });
    expect(web.trail).toEqual(['#/trips', '*#/trips']);
  });

  it('not awaited, a sheet opened as another closes waits for the step, then opens', async () => {
    const router = await boot('/#/trips');
    const closed: string[] = [];
    router.pushLayer(() => void closed.push('menu'));
    void router.closeTopLayer();
    router.pushLayer(() => void closed.push('wizard'));
    await settle();
    expect(closed).toEqual(['menu']);
    expect(router.depth).toBe(1);
    web.history.back();
    await settle();
    expect(closed).toEqual(['menu', 'wizard']);
    expect(router.depth).toBe(0);
    expect(router.hash).toBe('#/trips');
  });

  it('a close the guard refuses resolves false and leaves the sheet as it was', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.pushLayer(() => false);
    const p = router.closeTopLayer();
    await settle();
    expect(await p).toBe(false);
    expect(router.depth).toBe(1);
    expect(web.history.state).toMatchObject({ layer: 1 });
  });

  /* a double tap on ✕ */
  it('a second close while one is on its way is the same close — it never leaves the screen', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket');
    await settle();
    router.pushLayer(() => true);
    const a = router.closeTopLayer();
    const b = router.closeTopLayer();
    expect(b).toBe(a);
    await settle();
    expect(web.backs).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('a step that never comes: after 1.5 s it gives up, and the router is not left waiting', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.pushLayer(() => true);
    web.stall = true;
    let result: boolean | null = null;
    void router.closeTopLayer().then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(1499);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
    web.stall = false;
    router.go('#/trip/cn26/pocket/travel');
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket/travel');
  });

  /* the delete from a pass used to rewrite the SHEET's entry (Pocket.svelte) */
  it('replace while a sheet closes replaces the screen’s entry, not the sheet’s', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.go('#/trip/cn26/pocket/cn26-flight-ey888');
    await settle();
    router.pushLayer(() => true);
    void router.closeTopLayer();
    router.replace('#/trip/cn26/pocket/travel');
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket/travel');
    expect(web.trail.slice(0, 2)).toEqual(['#/trip/cn26/pocket', '*#/trip/cn26/pocket/travel']);
  });

  it('a ‹ pressed while a sheet closes decides on the entry the step lands on', async () => {
    const router = await boot('/#/trip/cn26/pocket/visa');
    router.pushLayer(() => true);
    void router.closeTopLayer();
    router.backOr('#/trip/cn26/pocket');
    await settle();
    expect(web.backs).toBe(1); // the close's; the ‹ went up, not out of the app
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });
});

/* A SHEET THAT GOES WITHOUT BEING CLOSED (Run 4b). The day's long jump
   cleared the flag that showed its sheet: the sheet unmounted and its layer
   stayed — the next back press closed nothing anyone could see, `depth`
   stayed up (hiding TripShell's "not found") and the ?d= went onto the
   sheet's entry. A Sheet now hands its layer back as it unmounts (the release
   `pushLayer` returns, called from its effect's cleanup). */
describe('router · a layer whose owner is gone (the Sheet’s cleanup, Run 4b)', () => {
  it('a sheet unmounted without closing: one step off its entry, its close run once', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/now/day');
    await settle();
    let asked = 0;
    const release = router.pushLayer(() => void asked++);
    release();
    await settle();
    expect(asked).toBe(1);
    expect(router.depth).toBe(0);
    expect(web.backs).toBe(1);
    expect(web.history.state).not.toHaveProperty('layer');
    /* and the next back press leaves the day, as a back press should */
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/now');
  });

  /* a dirty form whose sheet is gone has no one left to ask again */
  it('a layer whose owner is gone cannot refuse', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    const release = router.pushLayer(() => false);
    release();
    await settle();
    expect(router.depth).toBe(0);
    expect(web.history.state).not.toHaveProperty('layer');
    expect(web.backs).toBe(1);
  });

  /* THE STOP DELETED FROM ITS GUIDE (Run 3c's walk, which the first Run 4b
     build broke): the stop goes, so the shell unmounts the whole guide —
     its sheet with it — before that sheet has closed, or while its close is
     on its way. The sheet's onclose is what steps back to the Journey: it
     must still run, whichever comes first. */
  const mine = '#/trip/cn26/journey/cn26-stop-zjj';
  const walkToGuide = async () => {
    const router = await boot('/#/trip/cn26/pocket');
    for (const to of ['#/trip/cn26/journey', mine, `${mine}/guide`]) {
      router.go(to);
      await settle();
    }
    let closed = 0;
    const release = router.pushLayer(() => {
      closed++;
      void router.backPast((h) => h === mine || h.startsWith(`${mine}/`), '#/trip/cn26/journey');
      return true;
    });
    return { router, release, closed: () => closed };
  };

  it('the screen goes while its sheet’s close is on its way: the onclose still moves on', async () => {
    const { router, release, closed } = await walkToGuide();
    void router.closeTopLayer();
    release();
    await settle();
    expect(closed()).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/journey');
    expect(web.trail.indexOf('*#/trip/cn26/journey')).toBe(1);
  });

  it('the screen goes before its sheet is closed: the one step still runs the onclose', async () => {
    const { router, release, closed } = await walkToGuide();
    release();
    void router.closeTopLayer();
    await settle();
    expect(closed()).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/journey');
    expect(web.trail.indexOf('*#/trip/cn26/journey')).toBe(1);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('closed by back first, the release as it unmounts takes no second step', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket');
    await settle();
    const release = router.pushLayer(() => true);
    web.history.back();
    await settle();
    release();
    await settle();
    expect(web.backs).toBe(1);
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('closed by ✕, released before the step lands: still one step', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go('#/trip/cn26/pocket');
    await settle();
    const release = router.pushLayer(() => true);
    void router.closeTopLayer();
    release();
    await settle();
    expect(web.backs).toBe(1);
    expect(router.depth).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('a link followed from inside a sheet: the release that follows takes no step', async () => {
    const router = await boot('/#/trip/cn26/now');
    const release = router.pushLayer(() => true);
    router.go('#/trip/cn26/pocket/cn26-flight-ey888');
    await settle();
    release();
    await settle();
    expect(web.backs).toBe(0);
    expect(router.hash).toBe('#/trip/cn26/pocket/cn26-flight-ey888');
  });

  it('released under a layer still open, it is stepped past when that one closes', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    const asked: string[] = [];
    const releaseSheet = router.pushLayer(() => void asked.push('sheet'));
    router.pushLayer(() => void asked.push('counter'));
    releaseSheet();
    await settle();
    expect(web.backs).toBe(0);
    expect(router.depth).toBe(2);
    web.history.back();
    await settle();
    expect(asked).toEqual(['counter', 'sheet']);
    expect(router.depth).toBe(0);
    expect(web.history.state).not.toHaveProperty('layer');
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('an owner gone before its layer could open leaves nothing behind', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    router.pushLayer(() => true);
    void router.closeTopLayer();
    const release = router.pushLayer(() => true); // waits for the step
    release();
    await settle();
    expect(router.depth).toBe(0);
    expect(web.history.state).not.toHaveProperty('layer');
    expect(web.backs).toBe(1);
  });
});

/* DELETING A BOOKING FROM ITS OWN PASS (Run 4b — Pocket.svelte). The delete
   marks the pass gone, the sheet closes, and its onclose steps back past the
   pass to its list — Run 3c's stop delete, on the pass. */
describe('router · a booking deleted from its pass lands on its list', () => {
  const pass = '#/trip/cn26/pocket/cn26-flight-ey888';
  const list = '#/trip/cn26/pocket/travel';
  /* the pass's editor: its onclose steps back past the pass */
  const editor = (router: Awaited<ReturnType<typeof boot>>): void =>
    void router.pushLayer(() => {
      void router.backPast((h) => h === pass, list);
      return true;
    });

  it('opened from its list: the list as it was, and one back press is the Pocket', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    for (const to of [list, pass]) {
      router.go(to);
      await settle();
    }
    editor(router);
    void router.closeTopLayer();
    await settle();
    expect(router.hash).toBe(list);
    expect(router.depth).toBe(0);
    expect(router.leaving).toBe(false);
    expect(web.trail.indexOf(`*${list}`)).toBe(1);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('opened from Now: the list goes on top, and one back press is Now', async () => {
    const router = await boot('/#/trip/cn26/now');
    router.go(pass);
    await settle();
    editor(router);
    void router.closeTopLayer();
    await settle();
    expect(web.trail).toEqual(['#/trip/cn26/now', `*${list}`]);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/now');
  });

  it('called before the sheet’s step has landed, it waits for it — never a step too many', async () => {
    const router = await boot('/#/trip/cn26/pocket');
    for (const to of [list, pass]) {
      router.go(to);
      await settle();
    }
    router.pushLayer(() => true);
    void router.closeTopLayer();
    const p = router.backPast((h) => h === pass, list);
    await settle();
    await p;
    expect(router.hash).toBe(list);
    expect(web.trail.indexOf(`*${list}`)).toBe(1);
    web.history.back();
    await settle();
    expect(router.hash).toBe('#/trip/cn26/pocket');
  });

  it('opened cold on the pass: its dead entry is replaced by the list', async () => {
    const router = await boot(`/${pass}`);
    editor(router);
    void router.closeTopLayer();
    await settle();
    expect(router.hash).toBe(list);
    expect(web.trail[0]).toBe(`*${list}`);
  });
});

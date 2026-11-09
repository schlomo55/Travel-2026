/* PREVIEWING A DATE IS A LOOK, NOT A DAY LIVED (state/appState.svelte.ts,
   data/checks.ts, the day view).

   · Nothing is ticked while a date is previewed: the one writer of a step's
     tick (setCheck) writes nothing then.
   · A preview made by opening a day from Find lasts that visit: Back — the
     phone's button and the screen's ‹ are both history.back() — to Find ends
     it. A preview the user chose (Settings, ?d=) stays across screens; only
     the strip ends it.

   The second needs a browser's session history, so these tests give the real
   router and the real appState one: an in-memory `location`, `history` and
   `window` that keep the HTML standard's order of events (see router.test.ts,
   which this harness is a trimmed copy of). */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../lib/db/db';
import { runStepKey, setCheck } from '../lib/data/checks';

describe('the one writer of a step’s tick', () => {
  const key = runStepKey('t1', 'rb1', '2027-04-04', 0);
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await db.checkState.clear();
  });

  it('writes and takes back a tick on a day that is lived', async () => {
    await setCheck(key, 't1', true);
    expect(await db.checkState.get(key)).toMatchObject({ key, tripId: 't1' });
    await setCheck(key, 't1', false);
    expect(await db.checkState.get(key)).toBeUndefined();
  });

  it('writes nothing while a date is previewed — a tick, or taking one back', async () => {
    await setCheck(key, 't1', true, true);
    expect(await db.checkState.count()).toBe(0);
    await setCheck(key, 't1', true);
    await setCheck(key, 't1', false, true);
    expect(await db.checkState.get(key)).toBeDefined(); // not taken back either
  });
});

type Listener = { fn: (e: unknown) => void; once: boolean };
type Entry = { url: string; state: unknown };

class SessionHistory {
  entries: Entry[];
  index = 0;
  private listeners = new Map<string, Set<Listener>>();

  constructor(start: string) {
    this.entries = [{ url: new URL(start, 'https://app.test/').href, state: null }];
  }
  get url(): URL {
    return new URL(this.entries[this.index]!.url);
  }
  private fire(type: string, event: unknown): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) {
      if (l.once) this.listeners.get(type)!.delete(l);
      l.fn(event);
    }
  }
  private traverse(delta: number): void {
    const to = this.index + delta;
    if (to < 0 || to >= this.entries.length) return;
    setTimeout(() => {
      const oldHash = this.url.hash;
      const oldUrl = this.url.href.replace(/#.*$/, '');
      this.index = to;
      this.fire('popstate', { state: structuredClone(this.entries[to]!.state) });
      /* hashchange only between entries that differ in their fragment ALONE */
      if (this.url.hash !== oldHash && this.url.href.replace(/#.*$/, '') === oldUrl) setTimeout(() => this.fire('hashchange', {}), 0);
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
    get href(): string {
      return h.url.href;
    },
    get hash(): string {
      return h.url.hash;
    },
    set hash(v: string) {
      const next = new URL(h.url);
      next.hash = v;
      if (next.href === h.url.href) return;
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
    pushState(state: unknown, _title: string, url?: string): void {
      h.entries.splice(h.index + 1, Infinity, { url: url ? new URL(url, h.url).href : h.url.href, state: structuredClone(state) });
      h.index++;
    },
    replaceState(state: unknown, _title: string, url?: string | URL): void {
      h.entries[h.index] = { url: url ? new URL(url, h.url).href : h.url.href, state: structuredClone(state) };
    },
    back(): void {
      h.traverse(-1);
    },
  }))(this);
}

let web: SessionHistory;
/* every queued task, but not the midnight timer appState arms (that one re-arms itself) */
const settle = (): Promise<void> => vi.advanceTimersByTimeAsync(20).then(() => undefined);

/** The real router and appState, started the way App.svelte starts them, on `start`. */
async function boot(start: string) {
  vi.useFakeTimers(); // here, not for the file: fake-indexeddb above needs the real ones
  web = new SessionHistory(start);
  vi.stubGlobal('window', web.window);
  vi.stubGlobal('location', web.location);
  vi.stubGlobal('history', web.history);
  vi.stubGlobal('document', { hidden: false, addEventListener: () => undefined });
  vi.resetModules();
  const { router } = await import('../lib/state/router.svelte');
  const { appState } = await import('../lib/state/appState.svelte');
  router.start();
  appState.start();
  return { router, appState };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const FIND = '#/trip/dm27/find';
const DAY = '#/trip/dm27/now/day';

describe('a day opened from Find: the preview is for that visit', () => {
  it('Back to Find puts the real day back — the strip, the date and the address', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind('2027-04-04', router.entry);
    router.go(DAY);
    await settle();
    expect(router.hash).toBe(DAY);
    expect(appState.previewing).toBe(true);
    expect(appState.now).toBe('2027-04-04');
    expect(web.location.search).toBe('?d=2027-04-04');

    web.history.back(); // the phone's Back button (platform/backbutton.ts)
    await settle();
    expect(router.hash).toBe(FIND);
    expect(appState.previewing).toBe(false);
    expect(appState.previewDate).toBeNull();
    expect(web.location.search).toBe('');
  });

  it('the screen’s own ‹ is the same step back', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind('2027-04-04', router.entry);
    router.go(DAY);
    await settle();
    router.backOr('#/trip/dm27/now'); // the day view's header button
    await settle();
    expect(router.hash).toBe(FIND);
    expect(appState.previewing).toBe(false);
  });

  it('works from the very first entry of the session, and from a deeper one', async () => {
    const first = await boot(`/${FIND}`);
    first.appState.previewFromFind('2027-04-04', first.router.entry);
    first.router.go(DAY);
    await settle();
    expect(first.router.entry).toBe(1);
    web.history.back();
    await settle();
    expect(first.appState.previewing).toBe(false);

    const deep = await boot('/#/trips');
    deep.router.go('#/trip/dm27/now');
    await settle();
    deep.router.go(FIND);
    await settle();
    deep.appState.previewFromFind('2027-04-05', deep.router.entry);
    deep.router.go(DAY);
    await settle();
    expect(deep.appState.previewing).toBe(true);
    web.history.back();
    await settle();
    expect(deep.router.hash).toBe(FIND);
    expect(deep.appState.previewing).toBe(false);
  });

  it('stays on while the day is on screen — a sheet over it opened and closed, ‹ › used', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind('2027-04-04', router.entry);
    router.go(DAY);
    await settle();

    router.pushLayer(() => undefined); // the long-jump sheet
    await settle();
    expect(router.entry).toBe(2);
    web.history.back(); // closes the sheet, not the visit
    await settle();
    expect(router.hash).toBe(DAY);
    expect(appState.previewing).toBe(true);

    appState.movePreview('2027-04-05'); // › on the day view: another day, the same visit
    expect(appState.now).toBe('2027-04-05');
    web.history.back();
    await settle();
    expect(router.hash).toBe(FIND);
    expect(appState.previewing).toBe(false);
  });

  it('a Find result that is today previews nothing', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind(null, router.entry);
    router.go(DAY);
    await settle();
    expect(appState.previewing).toBe(false);
    web.history.back();
    await settle();
    expect(appState.previewing).toBe(false);
  });
});

describe('a preview the user chose stays', () => {
  it('Settings → Preview a date: the preview rides across screens and Back', async () => {
    const { router, appState } = await boot('/#/settings');
    appState.setPreview('2027-04-04'); // what Settings does
    router.go('#/trip/dm27/now');
    await settle();
    router.go(DAY);
    await settle();
    router.go('#/trip/dm27/journey');
    await settle();
    expect(appState.previewing).toBe(true);
    web.history.back();
    await settle();
    web.history.back();
    await settle();
    web.history.back();
    await settle(); // all the way back to Settings itself
    expect(router.hash).toBe('#/settings');
    expect(appState.previewing).toBe(true);
    expect(appState.previewDate).toBe('2027-04-04');
  });

  it('?d= on the address is the user’s too', async () => {
    const { router, appState } = await boot(`/?d=2027-04-04${FIND}`);
    expect(appState.previewing).toBe(true);
    appState.previewFromFind('2027-04-05', router.entry); // opening a day from Find does not make it a visit's
    router.go(DAY);
    await settle();
    web.history.back();
    await settle();
    expect(router.hash).toBe(FIND);
    expect(appState.previewing).toBe(true);
  });

  it('a date chosen in Settings in the middle of a Find visit is the user’s from then on', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind('2027-04-04', router.entry);
    router.go(DAY);
    await settle();
    router.go('#/settings');
    await settle();
    appState.setPreview('2027-04-06'); // the picker
    web.history.back();
    await settle();
    web.history.back();
    await settle();
    expect(router.hash).toBe(FIND);
    expect(appState.previewing).toBe(true);
    expect(appState.previewDate).toBe('2027-04-06');
  });

  it('the strip ends either kind', async () => {
    const { router, appState } = await boot(`/${FIND}`);
    appState.previewFromFind('2027-04-04', router.entry);
    router.go(DAY);
    await settle();
    appState.setPreview(null); // the strip
    expect(appState.previewing).toBe(false);
    expect(web.location.search).toBe('');
  });
});

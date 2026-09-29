/* WHERE YOU ARE, AND WHEN (Map 5d, lib/map/locate.svelte.ts) — the review's
   HIGH finding: leaving the Map tab or hiding the app kept the last fix and
   `state = 'on'`, and `fix.at` was never read, so coming back an hour later
   drew YOU where you had been — the rings, "Near you" and Guide me measured
   from it — until the GPS answered again. Now a fix older than STALE_MS found
   on coming back is forgotten, and the state is 'asking' ("Finding where you
   are…") until a fresh one. And with no position to be had, "Show where you
   are" starts the watch over instead of doing nothing (item 10).

   The locator is state over the browser's geolocation, so it runs here on a
   stand-in: a watch whose positions and errors the test hands over, a
   document whose visibility it flips, and a clock it sets. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STALE_MS, staleFix } from '../lib/logic/wayfind';

type Pos = { coords: { latitude: number; longitude: number; accuracy: number; heading: number | null; speed: number | null }; timestamp: number };
type Err = { code: number; PERMISSION_DENIED: number };

let watches: Map<number, { ok: (p: Pos) => void; err: (e: Err) => void }>;
let nextWatch: number;
let visListeners: Set<() => void>;
const doc = { hidden: false, addEventListener: (_t: string, f: () => void) => visListeners.add(f), removeEventListener: (_t: string, f: () => void) => visListeners.delete(f) };
const store = new Map<string, string>();

const T0 = Date.UTC(2026, 11, 8, 2, 0, 0); // Tue 8 Dec, 10:00 in Beijing
const at = (ms: number, lat = 39.938, lng = 116.3871): Pos => ({ coords: { latitude: lat, longitude: lng, accuracy: 25, heading: null, speed: null }, timestamp: ms });
/** the one watch running now */
const live = () => {
  expect(watches.size).toBe(1);
  return [...watches.values()][0]!;
};
const flipVisible = (hidden: boolean): void => {
  doc.hidden = hidden;
  for (const f of [...visListeners]) f();
};

async function fresh() {
  vi.resetModules();
  const { locator } = await import('../lib/map/locate.svelte');
  return locator;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  watches = new Map();
  nextWatch = 1;
  visListeners = new Set();
  doc.hidden = false;
  store.clear();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  vi.stubGlobal('navigator', {
    geolocation: {
      watchPosition: (ok: (p: Pos) => void, err: (e: Err) => void) => {
        const id = nextWatch++;
        watches.set(id, { ok, err });
        return id;
      },
      clearWatch: (id: number) => watches.delete(id),
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a stale position is not you', () => {
  it('the rule: older than 30 s is stale', () => {
    expect(STALE_MS).toBe(30_000);
    expect(staleFix(T0, T0 + 30_000)).toBe(false);
    expect(staleFix(T0, T0 + 30_001)).toBe(true);
    expect(staleFix(null, T0)).toBe(true);
  });

  it('leave the tab, come back a minute later: no YOU until a fresh fix — then YOU again', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start(); // the tap
    expect(locator.state).toBe('asking');
    live().ok(at(T0));
    expect(locator.state).toBe('on');
    expect(locator.fix?.at).toBe(T0);

    locator.detach(); // Now, Journey…
    expect(watches.size).toBe(0);
    vi.setSystemTime(T0 + 60_000);
    locator.attach(); // the Map tab again — it remembers you asked
    expect(locator.fix).toBeNull();
    expect(locator.state).toBe('asking');
    live().ok(at(T0 + 61_000, 39.9391, 116.3902));
    expect(locator.state).toBe('on');
    expect(locator.fix?.lat).toBe(39.9391);
  });

  it('back within 30 s the fix stands: you moved nowhere in that time worth hiding', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    live().ok(at(T0));
    locator.detach();
    vi.setSystemTime(T0 + 20_000);
    locator.attach();
    expect(locator.state).toBe('on');
    expect(locator.fix?.at).toBe(T0);
  });

  it('the app hidden and shown again later: the same — the watch paused, the old fix forgotten', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    live().ok(at(T0));
    flipVisible(true);
    expect(watches.size).toBe(0);
    vi.setSystemTime(T0 + 5 * 60_000);
    flipVisible(false);
    expect(locator.fix).toBeNull();
    expect(locator.state).toBe('asking');
    live().ok(at(T0 + 5 * 60_000 + 800));
    expect(locator.state).toBe('on');
  });

  it('the running watch’s own fixes are current, however long you stand still', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    live().ok(at(T0));
    vi.setSystemTime(T0 + 10 * 60_000);
    expect(locator.state).toBe('on');
    expect(locator.fix?.at).toBe(T0);
  });
});

describe('no position to be had (item 10)', () => {
  it('location off: "unavailable" — and the next tap starts the watch over, not nothing', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    const first = [...watches.keys()][0];
    live().err({ code: 2, PERMISSION_DENIED: 1 }); // POSITION_UNAVAILABLE
    expect(locator.state).toBe('unavailable');
    expect(watches.size).toBe(1); // the browser keeps a watch after an error
    locator.start(); // the tap, location now on
    expect(locator.state).toBe('asking');
    expect([...watches.keys()]).not.toContain(first);
    live().ok(at(T0 + 3000));
    expect(locator.state).toBe('on');
  });

  it('denied: no dot, forgotten, and asked again only by a tap', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    live().err({ code: 1, PERMISSION_DENIED: 1 });
    expect(locator.state).toBe('denied');
    expect(locator.fix).toBeNull();
    expect(watches.size).toBe(0);
    expect(store.has('ltd:map:locate')).toBe(false);
  });
});

describe('never "Finding…" with nothing looking', () => {
  it('back with a stale fix on a phone that cannot remember it asked: no fix, and not asking — nothing is looking', async () => {
    const locator = await fresh();
    locator.attach();
    locator.start();
    live().ok(at(T0));
    locator.detach();
    store.clear(); // the flag gone (no storage): the tab will not start the watch by itself
    vi.setSystemTime(T0 + 60_000);
    locator.attach();
    expect(watches.size).toBe(0);
    expect(locator.fix).toBeNull();
    expect(locator.state).toBe('off');
  });
});

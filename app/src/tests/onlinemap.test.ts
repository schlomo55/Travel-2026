/* THE ONLINE MAP (7 Nov 2026, lib/map/street/online.ts) — per tile: the pack,
   else the Protomaps API while online with a key the page may use, else not
   drawn. What is proved here is the promise to an offline phone: with no
   connection, or no key, or an origin the key's CORS list does not name, NOT
   ONE fetch — the map is exactly what it was. And since the review (7 Nov):
   a tile not drawn is REJECTED, never a cached empty tile, and is asked for
   again when the phone is back online or the back-off ends; a request that
   hangs (the mainland without a VPN, a hotel's login page) gives up after
   8 s; a refused key, a rate limit or a server error back off. No real key is
   needed or read: the tests make one up. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, BACKOFF_MAX_MS, BACKOFF_MS, MISSED_MAX, onlineKey, retryMissed, shownFrom, tileFor, TileMissed, TIMEOUT_MS, type TileEnv } from '../lib/map/street/online';

const KEY = 'test-key-not-real';
const tile = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
type Answer = { ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> };
const answer = (status: number, body = 'from the api'): Answer => ({ ok: status >= 200 && status < 300, status, arrayBuffer: async () => tile(body) });

function env(over: Partial<TileEnv> = {}): TileEnv & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (_u: string, _i: { signal?: AbortSignal }): Promise<Answer> => answer(200));
  return {
    /* the pack holds exactly 14/13464/6203 */
    pack: { getZxy: async (z: number, x: number, y: number) => (z === 14 && x === 13464 && y === 6203 ? { data: tile('from the pack') } : undefined) },
    key: KEY,
    onLine: () => true,
    now: () => Date.now(),
    downUntil: 0,
    fails: 0,
    missed: new Set<string>(),
    ...over,
    fetch,
  } as TileEnv & { fetch: ReturnType<typeof vi.fn> };
}
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const missed = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(TileMissed);
  return (e as TileMissed).why;
};
afterEach(() => vi.useRealTimers());

describe('the online map · which tile comes from where', () => {
  it('a tile the pack holds comes from the pack — online or not, nothing is fetched', async () => {
    const e = env();
    const r = await tileFor(e, 14, 13464, 6203);
    expect(r.from).toBe('pack');
    expect(text(r.data)).toBe('from the pack');
    expect(e.fetch).not.toHaveBeenCalled();
    const off = env({ onLine: () => false });
    expect((await tileFor(off, 14, 13464, 6203)).from).toBe('pack');
  });

  it('a tile the pack does not hold, online, with a key: the API, at its v4 address', async () => {
    const e = env();
    const r = await tileFor(e, 14, 1, 2);
    expect(r.from).toBe('online');
    expect(text(r.data)).toBe('from the api');
    expect(e.fetch).toHaveBeenCalledTimes(1);
    expect(e.fetch.mock.calls[0]![0]).toBe(`https://api.protomaps.com/tiles/v4/14/1/2.mvt?key=${KEY}`);
    expect(apiUrl('a b', 0, 0, 0)).toBe('https://api.protomaps.com/tiles/v4/0/0/0.mvt?key=a%20b');
  });

  it('no pack at all, online: every tile from the API', async () => {
    const e = env({ pack: null });
    expect((await tileFor(e, 14, 13464, 6203)).from).toBe('online');
  });

  it('offline: a tile the pack does not hold is NOT DRAWN — rejected, not cached empty — and NO request is made', async () => {
    const e = env({ onLine: () => false });
    expect(await missed(tileFor(e, 14, 1, 2))).toBe('offline');
    expect(e.fetch).not.toHaveBeenCalled();
    expect([...e.missed]).toEqual(['14/1/2']); // remembered by id, to be asked for again
    /* and offline with no pack: the night canvas, still no request */
    const e2 = env({ onLine: () => false, pack: null });
    expect(await missed(tileFor(e2, 3, 1, 1))).toBe('offline');
    expect(e2.fetch).not.toHaveBeenCalled();
  });

  it('no key (a build without it): not drawn, no request — online or not', async () => {
    const e = env({ key: null });
    expect(await missed(tileFor(e, 14, 1, 2))).toBe('nokey');
    expect(e.fetch).not.toHaveBeenCalled();
  });

  it('a tile the API does not have (404, 204 — an empty sea) is drawn empty, and is no failure', async () => {
    const e = env();
    e.fetch.mockResolvedValueOnce(answer(404)).mockResolvedValueOnce(answer(204));
    for (const y of [1, 2]) {
      const r = await tileFor(e, 14, 9, y);
      expect(r.from).toBe('online');
      expect(r.data.byteLength).toBe(0);
    }
    expect(e.downUntil).toBe(0);
  });

  it('a request that hangs gives up after 8 s, as a network failure: the back-off starts', async () => {
    vi.useFakeTimers();
    const e = env();
    e.fetch.mockImplementationOnce(
      (_u: string, i: { signal?: AbortSignal }) =>
        new Promise<Answer>((_, rej) => i.signal?.addEventListener('abort', () => rej(i.signal?.reason))),
    );
    const p = missed(tileFor(e, 14, 1, 2));
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(e.fails).toBe(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(await p).toBe('failed');
    expect(e.fails).toBe(1);
    expect(e.downUntil - Date.now()).toBe(BACKOFF_MS - 1);
    /* backing off: the next tiles are not asked for */
    expect(await missed(tileFor(e, 14, 1, 3))).toBe('backoff');
    expect(e.fetch).toHaveBeenCalledTimes(1);
  });

  it('failures double the back-off up to 10 min; one burst counts once; a success resets it', async () => {
    vi.useFakeTimers();
    const e = env();
    e.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    /* a burst: three tiles in flight together, one failure */
    await Promise.all([1, 2, 3].map((y) => missed(tileFor(e, 14, 1, y))));
    expect(e.fails).toBe(1);
    expect(e.downUntil - Date.now()).toBe(BACKOFF_MS);
    for (const n of [2, 3, 4, 5, 6, 7]) {
      vi.setSystemTime(e.downUntil);
      await missed(tileFor(e, 14, 1, 9));
      expect(e.fails).toBe(n);
      expect(e.downUntil - Date.now()).toBe(Math.min(BACKOFF_MAX_MS, BACKOFF_MS * 2 ** (n - 1)));
    }
    vi.setSystemTime(e.downUntil);
    e.fetch.mockResolvedValue(answer(200));
    expect((await tileFor(e, 14, 1, 9)).from).toBe('online');
    expect(e.fails).toBe(0);
  });

  it('a refused key (401, 403) stops asking for 10 min at once; a rate limit (429) or a server error (5xx) backs off', async () => {
    vi.useFakeTimers();
    for (const status of [401, 403]) {
      const e = env();
      e.fetch.mockResolvedValueOnce(answer(status, 'no'));
      expect(await missed(tileFor(e, 14, 1, 2))).toBe('refused');
      expect(e.downUntil - Date.now()).toBe(BACKOFF_MAX_MS);
    }
    for (const status of [429, 500, 503]) {
      const e = env();
      e.fetch.mockResolvedValueOnce(answer(status, 'busy'));
      expect(await missed(tileFor(e, 14, 1, 2))).toBe('failed');
      expect(e.downUntil - Date.now()).toBe(BACKOFF_MS);
    }
  });

  it('a cancelled tile is cancelled, not a network failure', async () => {
    const e = env();
    const ac = new AbortController();
    e.fetch.mockImplementationOnce(async () => {
      ac.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    await expect(tileFor(e, 14, 1, 2, ac.signal)).rejects.toThrow('aborted');
    expect(e.downUntil).toBe(0);
    expect(e.missed.size).toBe(0);
  });

  it('remembers at most the most recent MISSED_MAX tiles, each once', async () => {
    const e = env({ onLine: () => false });
    for (let x = 0; x < MISSED_MAX + 10; x++) await missed(tileFor(e, 14, x, 7));
    await missed(tileFor(e, 14, 5, 7)); // already remembered: once, now the newest
    expect(e.missed.size).toBe(MISSED_MAX);
    expect(e.missed.has('14/0/7')).toBe(false);
    expect([...e.missed].at(-1)).toBe('14/5/7');
  });
});

describe('the online map · the tiles not drawn are asked for again', () => {
  const target = (): EventTarget => new EventTarget();

  it('when the phone comes back online — not while it is offline', async () => {
    let online = false;
    const e = env({ onLine: () => online });
    const t = target();
    const refresh = vi.fn();
    const r = retryMissed(e, refresh, t);
    await missed(tileFor(e, 14, 1, 2));
    r.miss();
    t.dispatchEvent(new Event('online')); // the event before the phone says so: still offline
    expect(refresh).not.toHaveBeenCalled();
    online = true;
    t.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    /* BY ID: the engine hands these to map.refreshTiles — resetting the source left MapLibre's errored tiles hanging */
    expect(refresh).toHaveBeenCalledWith([{ z: 14, x: 1, y: 2 }]);
    expect(e.missed.size).toBe(0);
    /* nothing missed since: a second `online` asks for nothing */
    t.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    r.stop();
  });

  it('when the back-off ends — once, however many tiles were missed', async () => {
    vi.useFakeTimers();
    const e = env();
    const refresh = vi.fn();
    const r = retryMissed(e, refresh, target());
    e.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await Promise.all([1, 2, 3].map((y) => missed(tileFor(e, 14, 1, y))));
    for (let i = 0; i < 3; i++) r.miss();
    await vi.advanceTimersByTimeAsync(BACKOFF_MS - 1000);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith([
      { z: 14, x: 1, y: 1 },
      { z: 14, x: 1, y: 2 },
      { z: 14, x: 1, y: 3 },
    ]);
    r.stop();
  });

  it('a map that goes stops listening', async () => {
    const e = env();
    const t = target();
    const refresh = vi.fn();
    const r = retryMissed(e, refresh, t);
    e.missed.add('14/1/2');
    r.stop();
    t.dispatchEvent(new Event('online'));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('the online map · only where the key may be used', () => {
  it('the Android app’s origin and the :8080 dev server — with a key built in', () => {
    expect(onlineKey('https://localhost', KEY)).toBe(KEY);
    expect(onlineKey('http://localhost:8080', KEY)).toBe(KEY);
  });
  it('anywhere else — the public PWA, the rehearsal’s preview, another port — never', () => {
    for (const o of ['https://livingthedream.pages.dev', 'https://living-the-dream.pages.dev', 'http://localhost:4173', 'http://localhost:5173', 'http://localhost', 'https://localhost:8080'])
      expect(onlineKey(o, KEY), o).toBeNull();
  });
  it('no key built in (the default build, and these tests): never', () => {
    expect(onlineKey('https://localhost', '')).toBeNull();
    expect(onlineKey('https://localhost')).toBeNull();
  });
});

describe('the online map · the badge: which source drew what is on screen', () => {
  const view: [number, number, number, number] = [116.38, 39.93, 116.4, 39.945];
  it('the visible tiles, at the source’s zoom: any from the internet → Online, else from the pack → Offline map', () => {
    const seen = new Map<string, 'pack' | 'online'>();
    expect(shownFrom(seen, 14.4, view, 0, 15)).toBeNull();
    seen.set('14/13488/6205', 'pack');
    expect(shownFrom(seen, 14.4, view, 0, 15)).toBe('pack');
    seen.set('14/13489/6206', 'online');
    expect(shownFrom(seen, 14.4, view, 0, 15)).toBe('online');
    /* a tile from the internet somewhere else does not count */
    seen.delete('14/13489/6206');
    seen.set('14/1/1', 'online');
    expect(shownFrom(seen, 14.4, view, 0, 15)).toBe('pack');
    /* past the source's last zoom the map shows its last zoom's tiles; under its first, nothing */
    seen.set('15/26977/12412', 'online');
    expect(shownFrom(seen, 17.2, [116.385, 39.94, 116.386, 39.941], 0, 15)).toBe('online');
    expect(shownFrom(seen, 9, view, 11, 13)).toBeNull();
  });
});

/* THE ONLINE MAP (7 Nov 2026, lib/map/street/online.ts) — per tile: the pack,
   else the Protomaps API while online with a key the page may use, else
   empty. What is proved here is the promise to an offline phone: with no
   connection, or no key, or an origin the key's CORS list does not name, NOT
   ONE fetch — the map is exactly what it was. No real key is needed or read:
   the tests make one up. */
import { describe, expect, it, vi } from 'vitest';
import { apiUrl, BACKOFF_MS, onlineKey, shownFrom, tileFor, type TileEnv } from '../lib/map/street/online';

const KEY = 'test-key-not-real';
const tile = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

function env(over: Partial<TileEnv> = {}): TileEnv & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => tile('from the api') }));
  return {
    /* the pack holds exactly 14/13464/6203 */
    pack: { getZxy: async (z: number, x: number, y: number) => (z === 14 && x === 13464 && y === 6203 ? { data: tile('from the pack') } : undefined) },
    key: KEY,
    onLine: () => true,
    now: () => 1_000_000,
    downUntil: 0,
    ...over,
    fetch,
  } as TileEnv & { fetch: ReturnType<typeof vi.fn> };
}
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe('the online map · which tile comes from where', () => {
  it('a tile the pack holds comes from the pack — online or not, nothing is fetched', async () => {
    const e = env();
    const r = await tileFor(e, 14, 13464, 6203);
    expect(r.from).toBe('pack');
    expect(text(r.data)).toBe('from the pack');
    expect(e.fetch).not.toHaveBeenCalled();
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

  it('offline: a tile the pack does not hold stays empty, and NO request is made', async () => {
    const e = env({ onLine: () => false });
    const r = await tileFor(e, 14, 1, 2);
    expect(r.from).toBeNull();
    expect(r.data.byteLength).toBe(0);
    expect(e.fetch).not.toHaveBeenCalled();
    /* and offline with no pack: the night canvas, still no request */
    const e2 = env({ onLine: () => false, pack: null });
    expect((await tileFor(e2, 3, 1, 1)).from).toBeNull();
    expect(e2.fetch).not.toHaveBeenCalled();
  });

  it('no key (a build without it): empty, no request — online or not', async () => {
    const e = env({ key: null });
    expect((await tileFor(e, 14, 1, 2)).from).toBeNull();
    expect(e.fetch).not.toHaveBeenCalled();
  });

  it('past the API’s z15: empty, no request', async () => {
    const e = env();
    expect((await tileFor(e, 16, 1, 2)).from).toBeNull();
    expect(e.fetch).not.toHaveBeenCalled();
  });

  it('a network failure backs off: no request for 30 s, then it tries again; a missing tile does not', async () => {
    let now = 1_000_000;
    const e = env({ now: () => now });
    e.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await tileFor(e, 14, 1, 2)).from).toBeNull();
    expect((await tileFor(e, 14, 1, 3)).from).toBeNull();
    expect(e.fetch).toHaveBeenCalledTimes(1);
    now += BACKOFF_MS + 1;
    expect((await tileFor(e, 14, 1, 3)).from).toBe('online');
    e.fetch.mockResolvedValueOnce({ ok: false, status: 404, arrayBuffer: async () => tile('') });
    expect((await tileFor(e, 14, 9, 9)).from).toBeNull();
    expect((await tileFor(e, 14, 9, 10)).from).toBe('online'); // a 404 is a missing tile, not a dead network
  });

  it('a cancelled tile is cancelled, not a network failure', async () => {
    const e = env();
    e.fetch.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(tileFor(e, 14, 1, 2)).rejects.toThrow('aborted');
    expect(e.downUntil).toBe(0);
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

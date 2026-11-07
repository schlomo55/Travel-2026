/* THE ONLINE MAP (7 Nov 2026, owner's decision) — the map pack first, the
   internet only for what the pack does not have.

   Per tile: the pack on this phone answers if it holds the tile. If it does
   not — the tile is outside its area, or there is no pack — AND the phone is
   online, the tile comes from the Protomaps hosted API (the same v4 basemap
   schema as the daily builds the packs are cut from, z0–15). Otherwise the
   tile stays empty, which is what the map has always done: offline, this
   module makes no request at all (navigator.onLine false → no fetch).

   ONLY WHERE THE KEY MAY BE USED. The API key is the owner's; this repository
   is public, so the key lives only in ~/.ltd-private/protomaps.key on the
   build machine and enters only the Android build (vite.config.ts — mode
   `android`, into dist-android/, never the committed dist/). The key's CORS
   allow-list is exactly the Android app's origin (https://localhost) and a
   dev server on http://localhost:8080; anywhere else — the public PWA, the
   preview the rehearsal walks — the API would refuse, so the map does not
   ask: no key or another origin, and the map is exactly what it was.

   A FAILED FETCH BACKS OFF. Online by the phone's word but not in fact — a
   hotel Wi-Fi's login page, the mainland without a VPN — every new tile would
   fail on its own; after one network failure the map asks nothing for
   BACKOFF_MS. A tile the API does not have (an empty sea) is just empty.

   The engine (street/index.ts) registers the `ltdtiles://` protocol that
   calls tileFor(), and says which source drew what is on screen (shownFrom:
   the Map tab's "Offline map" / "Online" badge). */

/** The origins the key's CORS allow-list names: the Android app, and a dev server on :8080. */
export const ONLINE_ORIGINS = ['https://localhost', 'http://localhost:8080'];
/** the API's last zoom (the daily builds' too) */
export const API_MAXZOOM = 15;
export const BACKOFF_MS = 30_000;

/** The key, when online viewing may be used here: a key was built in AND the page's origin is allowed. */
export function onlineKey(origin: string, key: string | undefined = typeof __LTD_MAP_KEY__ === 'string' ? __LTD_MAP_KEY__ : ''): string | null {
  return key && ONLINE_ORIGINS.includes(origin) ? key : null;
}

export const apiUrl = (key: string, z: number, x: number, y: number): string => `https://api.protomaps.com/tiles/v4/${z}/${x}/${y}.mvt?key=${encodeURIComponent(key)}`;

export type TileFrom = 'pack' | 'online';
export interface TileEnv {
  /** the pack on this phone (pmtiles' PMTiles), or null */
  pack: { getZxy(z: number, x: number, y: number, signal?: AbortSignal): Promise<{ data: ArrayBuffer } | undefined> } | null;
  key: string | null;
  onLine(): boolean;
  fetch(url: string, init: { signal?: AbortSignal }): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
  now(): number;
  /** no request before this (a network failure's back-off) */
  downUntil: number;
}

/** One tile: from the pack, else (online, with a key) from the API, else empty. */
export async function tileFor(env: TileEnv, z: number, x: number, y: number, signal?: AbortSignal): Promise<{ data: Uint8Array; from: TileFrom | null }> {
  const t = await env.pack?.getZxy(z, x, y, signal);
  if (t) return { data: new Uint8Array(t.data), from: 'pack' };
  if (!env.key || z > API_MAXZOOM || !env.onLine() || env.now() < env.downUntil) return { data: new Uint8Array(), from: null };
  let r: Awaited<ReturnType<TileEnv['fetch']>>;
  try {
    r = await env.fetch(apiUrl(env.key, z, x, y), { ...(signal ? { signal } : {}) });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    env.downUntil = env.now() + BACKOFF_MS;
    return { data: new Uint8Array(), from: null };
  }
  if (!r.ok) return { data: new Uint8Array(), from: null };
  return { data: new Uint8Array(await r.arrayBuffer()), from: 'online' };
}

/** Which source drew the tiles on screen: 'online' if any did, else 'pack' if any did, else null.
    `seen` holds each tile's source by "z/x/y"; the tiles are the source's zoom for `zoom` (512 px tiles). */
export function shownFrom(seen: Map<string, TileFrom>, zoom: number, bounds: [number, number, number, number], minz: number, maxz: number): TileFrom | null {
  if (zoom < minz) return null;
  const z = Math.min(maxz, Math.floor(zoom));
  const n = 2 ** z;
  const clamp = (v: number): number => Math.max(0, Math.min(n - 1, Math.floor(v)));
  const tx = (lng: number): number => clamp(((lng + 180) / 360) * n);
  const ty = (lat: number): number => {
    const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
    return clamp((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  };
  const [w, s, e, nn] = bounds;
  let pack = false;
  for (let x = tx(w), x1 = tx(e); x <= x1; x++) {
    for (let y = ty(nn), y1 = ty(s); y <= y1; y++) {
      const f = seen.get(`${z}/${x}/${y}`);
      if (f === 'online') return 'online';
      if (f === 'pack') pack = true;
    }
  }
  return pack ? 'pack' : null;
}

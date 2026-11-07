/* THE ONLINE MAP (7 Nov 2026, owner's decision) — the map pack first, the
   internet only for what the pack does not have.

   Per tile: the pack on this phone answers if it holds the tile. If it does
   not — the tile is outside its area, or there is no pack — AND the phone is
   online, the tile comes from the Protomaps hosted API (the same v4 basemap
   schema as the daily builds the packs are cut from, z0–15). Otherwise the
   tile is not drawn, which is what the map has always done: offline, this
   module makes no request at all (navigator.onLine false → no fetch — and on
   Android only with ACCESS_NETWORK_STATE in the manifest, without which the
   WebView says online in airplane mode).

   ONLY WHERE THE KEY MAY BE USED. The API key is the owner's; this repository
   is public, so the key lives only in ~/.ltd-private/protomaps.key on the
   build machine and enters only the Android build (vite.config.ts — mode
   `android`, into dist-android/, never the committed dist/). The key's CORS
   allow-list is exactly the Android app's origin (https://localhost) and a
   dev server on http://localhost:8080; anywhere else — the public PWA, the
   preview the rehearsal walks — the API would refuse, so the map does not
   ask: no key or another origin, and the map is exactly what it was.

   A TILE NOT DRAWN IS NOT AN EMPTY TILE (review, 7 Nov 2026). A tile the
   map did not ask for (offline, backing off) or asked for in vain (no answer
   in TIMEOUT_MS, a refused key, a server error) is REJECTED (TileMissed), not
   answered empty: MapLibre then keeps it as errored instead of caching a
   loaded, empty tile, and asks for it again when the source is refreshed —
   which retryMissed() does when the phone comes back online or the back-off
   ends. Only a tile the API answers it does not have (404, 204: an empty
   sea) is drawn empty.

   A FAILED FETCH BACKS OFF. Online by the phone's word but not in fact — a
   hotel Wi-Fi's login page, the mainland without a VPN, where a request can
   hang for minutes — every tile in view would wait on its own; so a request
   gets TIMEOUT_MS, and a failure (no answer, a timeout, 429, a 5xx) stops
   all asking for BACKOFF_MS, doubling with each failure to BACKOFF_MAX_MS
   and reset by the next success. A refused key (401, 403) stops it for
   BACKOFF_MAX_MS at once: a revoked key or a rate limit must not mean a
   request on every pan, for ever.

   The engine (street/index.ts) registers the `ltdtiles://` protocol that
   calls tileFor(), and says which source drew what is on screen (shownFrom:
   the Map tab's "Offline map" / "Online" badge). */

/** The origins the key's CORS allow-list names: the Android app, and a dev server on :8080. */
export const ONLINE_ORIGINS = ['https://localhost', 'http://localhost:8080'];
/** the API's last zoom (the daily builds' too) */
export const API_MAXZOOM = 15;
/** a request with no answer in this long has failed */
export const TIMEOUT_MS = 8_000;
/** after a failure, no request for this long — doubled per failure, up to BACKOFF_MAX_MS */
export const BACKOFF_MS = 30_000;
export const BACKOFF_MAX_MS = 10 * 60_000;

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
  /** no request before this (a failure's back-off) */
  downUntil: number;
  /** failures in a row (the back-off doubles with each; a success resets it) */
  fails: number;
  /** tiles not drawn since the last refresh (retryMissed asks again for them) */
  missed: number;
}

/** A tile not drawn: not asked for (no key, offline, backing off) or asked for in vain. MapLibre keeps it errored. */
export class TileMissed extends Error {
  constructor(readonly why: 'nokey' | 'offline' | 'backoff' | 'failed' | 'refused') {
    super(`tile not drawn: ${why}`);
  }
}

/** `signal`, or TIMEOUT_MS gone by — whichever comes first (AbortSignal.any + timeout, on any WebView). */
function timed(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done(): void } {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new DOMException('the map server did not answer in time', 'TimeoutError')), ms);
  const pass = (): void => ctl.abort(signal?.reason);
  if (signal?.aborted) pass();
  else signal?.addEventListener('abort', pass, { once: true });
  return {
    signal: ctl.signal,
    done: () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', pass);
    },
  };
}

/** A failure: no request for a while — one burst of failures (in flight together) counts once. */
function backOff(env: TileEnv, refused = false): void {
  if (env.now() < env.downUntil) return;
  env.fails++;
  env.downUntil = env.now() + (refused ? BACKOFF_MAX_MS : Math.min(BACKOFF_MAX_MS, BACKOFF_MS * 2 ** (env.fails - 1)));
}

/** One tile: from the pack, else (online, with a key, not backing off) from the API — else rejected (TileMissed). */
export async function tileFor(env: TileEnv, z: number, x: number, y: number, signal?: AbortSignal): Promise<{ data: Uint8Array; from: TileFrom }> {
  const t = await env.pack?.getZxy(z, x, y, signal);
  if (t) return { data: new Uint8Array(t.data), from: 'pack' };
  const miss = (why: TileMissed['why']): TileMissed => {
    env.missed++;
    return new TileMissed(why);
  };
  if (!env.key || z > API_MAXZOOM) throw new TileMissed('nokey');
  if (!env.onLine()) throw miss('offline');
  if (env.now() < env.downUntil) throw miss('backoff');
  const tm = timed(signal, TIMEOUT_MS);
  try {
    const r = await env.fetch(apiUrl(env.key, z, x, y), { signal: tm.signal });
    /* a tile the API does not have — an empty sea — is drawn empty */
    if (r.status === 404 || r.status === 204) {
      env.fails = 0;
      return { data: new Uint8Array(), from: 'online' };
    }
    if (r.status === 401 || r.status === 403) {
      backOff(env, true);
      throw miss('refused');
    }
    if (!r.ok) {
      backOff(env);
      throw miss('failed');
    }
    const data = new Uint8Array(await r.arrayBuffer());
    env.fails = 0;
    return { data, from: 'online' };
  } catch (err) {
    /* MapLibre no longer needs the tile: a cancel, not a failure */
    if (signal?.aborted) throw err;
    if (err instanceof TileMissed) throw err;
    backOff(env);
    throw miss('failed');
  } finally {
    tm.done();
  }
}

/**
 * Ask again for the tiles not drawn — `refresh()` (the engine resets its
 * source, and MapLibre asks for every errored tile in view) — when the phone
 * comes back online (its `online` event), or when the back-off ends. Call
 * `miss()` after a tile was not drawn; `stop()` when the map goes.
 */
export function retryMissed(env: TileEnv, refresh: () => void, target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = globalThis): { miss(): void; stop(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const go = (): void => {
    clearTimeout(timer);
    timer = undefined;
    if (!env.missed || !env.onLine()) return;
    env.missed = 0;
    refresh();
  };
  target.addEventListener('online', go);
  return {
    miss() {
      if (timer !== undefined || !env.onLine()) return;
      timer = setTimeout(go, Math.max(1000, env.downUntil - env.now() + 250));
    },
    stop() {
      clearTimeout(timer);
      target.removeEventListener('online', go);
    },
  };
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

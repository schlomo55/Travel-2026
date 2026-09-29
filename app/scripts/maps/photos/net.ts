/* THE PHOTO LOOKUPS' ONE DOOR TO THE NETWORK (Map 5e) — DEV ONLY. The app,
   `npm run build`, the tests and the rehearsal never come here: the photos
   travel inside the map pack, which is built on this PC.

   Politeness, as the services ask it: a descriptive User-Agent that names the
   tool and what it does (no e-mail, nothing personal); ONE request in flight
   per host and at least GAP_MS between two to the same host (Wikidata,
   Commons, the image server, Wikipedia and Openverse each keep their own
   cadence); a host that answers 429 / 503 is taken at its word for the rest
   of the run — one request per SLOWED_MS, its Retry-After waited out in full.

   EVERY ANSWER IS KEPT on disk (app/.cache/photos/http, git-ignored), keyed by
   the exact URL: a re-run asks nobody anything it has asked before. What is
   ever sent: the place names and coordinates the trip already publishes to
   map apps, Wikidata ids and Commons file names — never any other trip data. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CACHE = join(here, '..', '..', '..', '.cache', 'photos');
const HTTP = join(CACHE, 'http');
const BIN = join(CACHE, 'bin');

export const UA = 'LivingTheDream-place-photos/1.0 (offline travel app; dev-time lookup of free-licensed place photos and Wikipedia summaries; results cached, never fetched at runtime)';
const GAP_MS = 1100;
const SLOWED_MS = 5000;

const lastSent = new Map<string, number>();
const queue = new Map<string, Promise<unknown>>();
const gapFor = new Map<string, number>();
export const asked = { cached: 0, network: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politely<T>(url: string, read: (r: Response) => Promise<T>): Promise<T> {
  /* PHOTOS_OFFLINE=1: a re-run that must ask nobody anything (Map 5f rebuilt the manifest and the pack from the
     cache alone) — a question the cache cannot answer stops it, rather than going out */
  if (process.env.PHOTOS_OFFLINE === '1') throw new Error(`offline run: ${url} is not in the cache`);
  const host = new URL(url).host;
  const backoff = [5000, 10000, 20000, 40000, 60000];
  const turn = (queue.get(host) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = (lastSent.get(host) ?? 0) + (gapFor.get(host) ?? GAP_MS) - Date.now();
        if (wait > 0) await sleep(wait);
        lastSent.set(host, Date.now());
        asked.network++;
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: '*/*' } });
        if (res.ok) return read(res);
        const throttled = res.status === 429 || res.status === 503;
        const back = backoff[attempt];
        if (!throttled || back === undefined) throw new Error(`${res.status} for ${url}`);
        gapFor.set(host, SLOWED_MS);
        const retry = Number(res.headers.get('retry-after'));
        console.warn(`  ${host} said ${res.status}: waiting ${Math.max(back, Number.isFinite(retry) ? retry * 1000 : 0) / 1000} s`);
        await sleep(Math.max(back, Number.isFinite(retry) ? retry * 1000 : 0));
      }
    });
  queue.set(host, turn);
  return turn as Promise<T>;
}

const key = (url: string): string => createHash('sha256').update(url).digest('hex').slice(0, 40);

/** A JSON answer: from the cache, else asked once and kept. `null` when the
    service says there is nothing (404) — kept too, so it is asked once. */
export async function getJson<T = unknown>(url: string): Promise<T | null> {
  const file = join(HTTP, `${key(url)}.json`);
  if (existsSync(file)) {
    asked.cached++;
    return (JSON.parse(readFileSync(file, 'utf8')) as { body: T | null }).body;
  }
  let body: T | null;
  try {
    body = await politely(url, (r) => r.json() as Promise<T>);
  } catch (e) {
    if (/^404 /.test(String((e as Error).message))) body = null;
    else throw e;
  }
  mkdirSync(HTTP, { recursive: true });
  writeFileSync(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), body }));
  return body;
}

/** A file (an image): its path on disk, downloaded once. */
export async function getFile(url: string, ext: string): Promise<string> {
  const file = join(BIN, `${key(url)}.${ext}`);
  if (existsSync(file)) {
    asked.cached++;
    return file;
  }
  const buf = await politely(url, async (r) => Buffer.from(await r.arrayBuffer()));
  mkdirSync(BIN, { recursive: true });
  writeFileSync(file, buf);
  return file;
}

export function writeCache(name: string, v: unknown): string {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, name);
  writeFileSync(f, JSON.stringify(v, null, 1));
  return f;
}
export function readCache<T>(name: string): T | null {
  const f = join(CACHE, name);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
}

/** A file already downloaded (no network): its path, or null. */
export function cachedFile(url: string, ext: string): string | null {
  const file = join(BIN, `${key(url)}.${ext}`);
  return existsSync(file) ? file : null;
}

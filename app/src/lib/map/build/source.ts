/* THE BUILDER'S NETWORK (7 Nov 2026) — Capacitor's native HTTP.

   build.protomaps.com answers a browser's CORS only for Protomaps' own sites,
   so the WebView's fetch is refused; Android's own HTTP stack is not a
   browser and asks no CORS question. CapacitorHttp (@capacitor/core, already
   in the app — no new dependency) runs each request on a native thread pool,
   so the extractor's parallel requests stay parallel.

   WHAT IT RETURNS: with responseType 'arraybuffer' Android reads the whole
   body and hands it over as BASE64 (android.util.Base64.DEFAULT — line breaks
   every 76 characters), through the bridge as a string: hence chunks of at
   most 1 MB, four at once (lib/map/build/run.ts — the review's measure, 7 Nov:
   each answer is read whole in Java, then base64'd across the bridge, some
   15–20 MB of Java heap per 2 MB chunk), decoded here. An HTTP error comes back as
   its status with the body as text, not as a rejection; a dropped connection
   rejects, and the extractor retries it.

   EVERY REQUEST: a Range; `Accept-Encoding: identity`, so Java's
   HttpURLConnection neither asks for gzip nor unzips a range behind our back;
   and, once the first answer named it, the build's ETag in If-Match — the
   build is pinned, and a changed file answers 412 rather than splice two
   builds into one pack. A 404, 410 or 412 is SourceGone: retrying cannot help
   (the daily builds are deleted after a while).

   AN ANSWER IS CHECKED BEFORE IT IS TRUSTED: a 206 must cover exactly the
   range asked for (Content-Range, and no longer than asked). A 200 to a Range
   request is a proxy or a captive network that ignored the range: that stops
   the build at once (RangeIgnored — never retried, so never fetched again) —
   though the native layer will already have read that answer whole, which
   JavaScript cannot stop. */
import { CapacitorHttp } from '@capacitor/core';
import { SourceGone, type ByteSource } from './extract';

/** The network answered a Range request with the whole file (200): a proxy that ignores ranges. Not retried. */
export class RangeIgnored extends Error {
  readonly fatal = true;
  readonly rangeIgnored = true;
  constructor() {
    super('the network answered a part request with the whole file');
  }
}

export const BUILDS_URL = 'https://build-metadata.protomaps.dev/builds.json';
export const buildUrl = (date: string): string => `https://build.protomaps.com/${date}.pmtiles`;

interface Answer {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}
export interface Http {
  request(o: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    responseType?: 'arraybuffer' | 'json';
    connectTimeout?: number;
    readTimeout?: number;
  }): Promise<Answer>;
}
const native: Http = CapacitorHttp;

/** Base64 (Android's, line breaks and all) → bytes. */
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const header = (h: Record<string, string>, name: string): string | undefined => Object.entries(h ?? {}).find(([k]) => k.toLowerCase() === name)?.[1];

/** The newest Protomaps daily build, YYYYMMDD (the list build-pack.ts reads too). */
export async function latestBuild(http: Http = native): Promise<string> {
  const r = await http.request({ url: BUILDS_URL, method: 'GET', responseType: 'json', connectTimeout: 20_000, readTimeout: 30_000 });
  if (r.status !== 200) throw new Error(`builds.json answered ${r.status}`);
  const list = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as { key?: unknown }[];
  const key = Array.isArray(list) ? list.at(-1)?.key : undefined;
  const m = typeof key === 'string' ? /^(\d{8})\.pmtiles$/.exec(key) : null;
  if (!m?.[1]) throw new Error('builds.json lists no build');
  return m[1];
}

export interface NativeSource extends ByteSource {
  /** the build's ETag, once an answer named it ('' before) */
  readonly etag: string;
}
/** The build at `url`, read range by range, pinned to `etag` — or to the first answer's, when ''. */
export function nativeSource(url: string, etag = '', http: Http = native): NativeSource {
  let tag = etag;
  return {
    get id() {
      return tag ? `${url} ${tag}` : url;
    },
    get etag() {
      return tag;
    },
    async getBytes(offset: number, length: number): Promise<Uint8Array> {
      const headers: Record<string, string> = { Range: `bytes=${offset}-${offset + length - 1}`, 'Accept-Encoding': 'identity' };
      if (tag) headers['If-Match'] = tag;
      const r = await http.request({ url, method: 'GET', headers, responseType: 'arraybuffer', connectTimeout: 20_000, readTimeout: 60_000 });
      if (r.status === 404 || r.status === 410 || r.status === 412) throw new SourceGone(r.status);
      if (r.status === 200) throw new RangeIgnored();
      if (r.status !== 206) throw new Error(`the map server answered ${r.status}`);
      /* the range answered must be the one asked for */
      const cr = /^bytes (\d+)-(\d+)\//.exec(header(r.headers, 'content-range') ?? '');
      if (cr && (Number(cr[1]) !== offset || Number(cr[2]) > offset + length - 1)) throw new Error(`the map server answered another range (${cr[1]}–${cr[2]})`);
      const bytes = typeof r.data === 'string' ? fromBase64(r.data) : new Uint8Array(r.data as ArrayBuffer);
      if (bytes.length > length) throw new Error(`the map server answered ${bytes.length} bytes for ${length}`);
      const e = header(r.headers, 'etag');
      if (!tag && e && !e.startsWith('W/')) tag = e;
      return bytes;
    },
  };
}

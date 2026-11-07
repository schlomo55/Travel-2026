/* THE BUILDER'S NETWORK (lib/map/build/source.ts) against a stand-in for
   Capacitor's native HTTP that answers as Android's does: a Range answered
   206 with the body as BASE64 wrapped every 76 characters
   (android.util.Base64.DEFAULT), an HTTP error as its status, response
   headers in whatever case the server sent. The real plugin on a real phone
   is the on-device check; this pins what the code asks for and how it reads
   the answers. */
import { describe, expect, it } from 'vitest';
import { fromBase64, latestBuild, nativeSource, RangeIgnored, type Http } from '../lib/map/build/source';
import { extract } from '../lib/map/build/extract';

const FILE = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 256);
/** Android's Base64.DEFAULT: line breaks every 76 characters, and one at the end */
const androidB64 = (b: Uint8Array): string => (Buffer.from(b).toString('base64').match(/.{1,76}/g) ?? []).join('\n') + '\n';

function fake(answer?: (o: Parameters<Http['request']>[0]) => { status: number; data: unknown; headers?: Record<string, string> }) {
  const asked: Parameters<Http['request']>[0][] = [];
  const http: Http = {
    async request(o) {
      asked.push(o);
      if (answer) return { headers: {}, ...answer(o) };
      const [, a, z] = /bytes=(\d+)-(\d+)/.exec(o.headers?.Range ?? '') ?? [];
      return {
        status: 206,
        data: androidB64(FILE.slice(Number(a), Number(z) + 1)),
        headers: { ETag: '"abc123"', 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${a}-${Math.min(Number(z), FILE.length - 1)}/${FILE.length}` },
      };
    },
  };
  return { http, asked };
}

describe('the builder’s network · Capacitor’s native HTTP', () => {
  it('decodes Android’s wrapped base64 to the very bytes', () => {
    expect(Buffer.compare(Buffer.from(fromBase64(androidB64(FILE))), Buffer.from(FILE))).toBe(0);
  });

  it('asks for a range, unzipped by nobody, and pins the build to the first answer’s ETag', async () => {
    const { http, asked } = fake();
    const s = nativeSource('https://build.protomaps.com/20261107.pmtiles', '', http);
    expect(s.id).toBe('https://build.protomaps.com/20261107.pmtiles');
    const a = await s.getBytes(100, 2000);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(FILE.slice(100, 2100)))).toBe(0);
    expect(asked[0]).toMatchObject({ method: 'GET', responseType: 'arraybuffer', headers: { Range: 'bytes=100-2099', 'Accept-Encoding': 'identity' } });
    expect(asked[0]!.headers!['If-Match']).toBeUndefined();
    expect(s.etag).toBe('"abc123"');
    expect(s.id).toBe('https://build.protomaps.com/20261107.pmtiles "abc123"');
    await s.getBytes(0, 10);
    expect(asked[1]!.headers!['If-Match']).toBe('"abc123"');
  });

  it('a resumed build is pinned from its first request', async () => {
    const { http, asked } = fake();
    const s = nativeSource('https://build.protomaps.com/20261107.pmtiles', '"abc123"', http);
    await s.getBytes(0, 10);
    expect(asked[0]!.headers!['If-Match']).toBe('"abc123"');
  });

  it('404, 410 and 412 are the build gone or changed — not worth a retry; any other status is an error', async () => {
    for (const status of [404, 410, 412]) {
      const s = nativeSource('u', '"e"', fake(() => ({ status, data: 'nope' })).http);
      await expect(s.getBytes(0, 10)).rejects.toMatchObject({ fatal: true, status });
    }
    const s = nativeSource('u', '"e"', fake(() => ({ status: 500, data: 'oops' })).http);
    await expect(s.getBytes(0, 10)).rejects.toThrow('the map server answered 500');
  });

  it('a 200 to a Range request (a proxy that ignores ranges) stops the build — never retried, never fetched again', async () => {
    const { http, asked } = fake(() => ({ status: 200, data: androidB64(FILE) }));
    const t = nativeSource('u', '"e"', http);
    await expect(t.getBytes(0, 10)).rejects.toBeInstanceOf(RangeIgnored);
    /* through the extractor: one request, no retry (the native layer has read that whole answer already) */
    asked.length = 0;
    await expect(extract(nativeSource('u', '', http), { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, { dryRun: true, sleep: async () => {} })).rejects.toBeInstanceOf(RangeIgnored);
    expect(asked).toHaveLength(1);
  });

  it('an answer that is not the range asked for is not trusted', async () => {
    const other = nativeSource('u', '"e"', fake(() => ({ status: 206, data: androidB64(FILE.slice(0, 10)), headers: { 'Content-Range': 'bytes 50-59/5000' } })).http);
    await expect(other.getBytes(0, 10)).rejects.toThrow('another range');
    const longer = nativeSource('u', '"e"', fake(() => ({ status: 206, data: androidB64(FILE.slice(0, 20)) })).http);
    await expect(longer.getBytes(0, 10)).rejects.toThrow('20 bytes for 10');
  });

  it('the newest build from builds.json, parsed or not by the plugin', async () => {
    const list = [{ key: '20261105.pmtiles' }, { key: '20261107.pmtiles', version: '4.15.2' }];
    expect(await latestBuild(fake(() => ({ status: 200, data: list })).http)).toBe('20261107');
    expect(await latestBuild(fake(() => ({ status: 200, data: JSON.stringify(list) })).http)).toBe('20261107');
    await expect(latestBuild(fake(() => ({ status: 200, data: [] })).http)).rejects.toThrow('lists no build');
    await expect(latestBuild(fake(() => ({ status: 503, data: '' })).http)).rejects.toThrow('503');
  });
});

/* THE EXTRACTOR (in-app map builder, lib/map/build/extract.ts) — `pmtiles
   extract --region`, in the app. No network here: the sources are buffers.

   1. THE COMMITTED TEST PACK (real Protomaps tiles round Houhai, z11–13): a
      sub-region cut out of it is a pack the app's own reader accepts
      (lib/map/pack.ts describePack, the importer's check), the pmtiles
      library reads, and whose every tile equals the source's.
   2. A SYNTHETIC PLANET built here, with what the real one has and the test
      pack has not: leaf directories, run-length entries, and a content shared
      by many tiles stored where it first occurred — so later tiles point
      BACKWARDS in the source (the extractor's "strays").
   3. RESUME: a run cut short after a checkpoint, the file cut back to the
      checkpoint and finished by a second run, is byte-identical to a run that
      was never interrupted; a changed plan refuses to resume.
   4. A source that says retrying cannot help (the build is gone: 404/412) is
      not retried. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import {
  defaultCodec,
  extract,
  idToZxy,
  parseDir,
  parseHeader,
  regionTiles,
  serializeDir,
  serializeHeader,
  SourceGone,
  zxyToId,
  type ByteSource,
  type Checkpoint,
  type Entry,
  type RegionGeo,
} from '../lib/map/build/extract';
import { describePack } from '../lib/map/pack';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = new Uint8Array(readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles')));

const memSource = (buf: Uint8Array, id = 'mem'): ByteSource & { reads: number } => ({
  id,
  reads: 0,
  async getBytes(o: number, l: number) {
    this.reads++;
    return buf.slice(o, Math.min(o + l, buf.length));
  },
});
const concat = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const sinkInto = (parts: Uint8Array[]) => ({ write: (b: Uint8Array) => void parts.push(b.slice()) });
const reader = (buf: Uint8Array): PMTiles => {
  const src: Source = {
    getKey: () => `k${buf.length}`,
    getBytes: async (o: number, l: number): Promise<RangeResponse> => ({ data: buf.slice(o, o + l).buffer }),
  };
  return new PMTiles(src);
};
const box = (w: number, s: number, e: number, n: number): { type: 'MultiPolygon'; coordinates: number[][][][] } => ({
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  ],
});
const same = (a: ArrayBuffer | undefined, b: ArrayBuffer | undefined): boolean =>
  !!a && !!b && a.byteLength === b.byteLength && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

/** Every tile the region asks for, read from both archives: equal where the source has one, absent where not. */
async function sameTiles(source: Uint8Array, out: Uint8Array, region: RegionGeo, minz: number, maxz: number): Promise<number> {
  const a = reader(source);
  const b = reader(out);
  let n = 0;
  for (const id of regionTiles(region, minz, maxz).ids) {
    const [z, x, y] = idToZxy(id);
    const s = await a.getZxy(z, x, y);
    const o = await b.getZxy(z, x, y);
    if (!s) expect(o, `${z}/${x}/${y}`).toBeUndefined();
    else {
      expect(same(s.data, o?.data), `${z}/${x}/${y}`).toBe(true);
      n++;
    }
  }
  return n;
}

/** Every entry of an archive's directories, leaves followed. */
async function entriesOf(buf: Uint8Array): Promise<Entry[]> {
  const h = parseHeader(buf.subarray(0, 127));
  const dir = async (o: number, l: number): Promise<Entry[]> => parseDir(await defaultCodec.gunzip(buf.subarray(o, o + l)));
  const out: Entry[] = [];
  const walk = async (es: Entry[]): Promise<void> => {
    for (const e of es) {
      if (e.runLength === 0) await walk(await dir(h.leafOffset + e.offset, e.length));
      else out.push(e);
    }
  };
  await walk(await dir(h.rootOffset, h.rootLength));
  return out;
}

describe('the extractor · the committed test pack (real tiles, z11–13)', () => {
  /* Houhai's lakes and the Drum Tower — part of the pack's bbox, not all of it */
  const region = box(116.37, 39.925, 116.4, 39.95);

  it('cuts a sub-region the app’s reader accepts, every tile equal to the source', async () => {
    const parts: Uint8Array[] = [];
    const st = await extract(memSource(FIXTURE), region, { sink: sinkInto(parts), metadata: { 'ltd:pack': 'houhai-cut', 'ltd:trip': 'Test', 'ltd:areas': ['Houhai'], 'ltd:maxzoom': 13 } });
    const out = concat(parts);
    expect(out.length).toBe(st.outputBytes);
    const n = await sameTiles(FIXTURE, out, region, 11, 13);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(10); // fewer than the pack's ten: it IS a sub-region
    /* the importer's own check (lib/map/pack.ts) and what Settings shows */
    const info = await describePack(new File([out], 'cut.pmtiles'));
    expect([info.minZoom, info.maxZoom]).toEqual([11, 13]);
    expect(info.name).toBe('houhai-cut');
    expect(info.trip).toBe('Test');
    expect(info.areas).toEqual(['Houhai']);
    expect(info.osmDate).toBe('2026-09-28'); // the source's metadata travels on
    expect(info.archiveEnd).toBe(out.length);
    expect(info.photos).toBeUndefined();
    const meta = (await reader(out).getMetadata()) as Record<string, unknown>;
    expect(meta['ltd:maxzoom']).toBe(13);
  });

  it('a dry run plans the same file without writing a byte', async () => {
    const parts: Uint8Array[] = [];
    const full = await extract(memSource(FIXTURE), region, { sink: sinkInto(parts) });
    const dry = await extract(memSource(FIXTURE), region, { dryRun: true });
    expect(dry.outputBytes).toBe(full.outputBytes);
    expect(dry.planKey).toBe(full.planKey);
    expect(dry.tileEntries).toBe(full.tileEntries);
  });
});

/* ---------- a synthetic planet ---------- */
const MAXZ = 6;
/** z0–6, every tile; "ocean" (a pattern) shares ONE content, so its later tiles point back to the first */
function planetTiles(): { id: number; data: Uint8Array }[] {
  const ocean = new TextEncoder().encode('ocean-ocean-ocean');
  const list: { id: number; data: Uint8Array }[] = [];
  for (let z = 0; z <= MAXZ; z++) {
    for (let x = 0; x < 2 ** z; x++) {
      for (let y = 0; y < 2 ** z; y++) {
        const id = zxyToId(z, x, y);
        const sea = z >= 2 && (x + y) % 3 !== 0;
        list.push({ id, data: sea ? ocean : new TextEncoder().encode(`land ${z}/${x}/${y} `.repeat(1 + ((x + y) % 4))) });
      }
    }
  }
  return list.sort((a, b) => a.id - b.id);
}
/** A clustered PMTiles v3 archive: contents in tile-id order, a repeat stored once (where it first
    occurred), consecutive repeats as one run, the directory split into leaves of `leafSize` entries. */
async function makeArchive(tiles: { id: number; data: Uint8Array }[], leafSize: number): Promise<Uint8Array> {
  const at = new Map<string, number>();
  const data: Uint8Array[] = [];
  const entries: Entry[] = [];
  let off = 0;
  for (const t of tiles) {
    const key = Buffer.from(t.data).toString('latin1');
    let o = at.get(key);
    if (o === undefined) {
      o = off;
      at.set(key, o);
      data.push(t.data);
      off += t.data.length;
    }
    const last = entries[entries.length - 1];
    if (last && last.offset === o && last.tileId + last.runLength === t.id) last.runLength++;
    else entries.push({ tileId: t.id, offset: o, length: t.data.length, runLength: 1 });
  }
  const leaves: Uint8Array[] = [];
  const rootEntries: Entry[] = [];
  let lo = 0;
  for (let i = 0; i < entries.length; i += leafSize) {
    const z = await defaultCodec.gzip(serializeDir(entries.slice(i, i + leafSize)));
    rootEntries.push({ tileId: entries[i]!.tileId, offset: lo, length: z.length, runLength: 0 });
    leaves.push(z);
    lo += z.length;
  }
  const root = await defaultCodec.gzip(serializeDir(rootEntries));
  const meta = await defaultCodec.gzip(new TextEncoder().encode(JSON.stringify({ name: 'synthetic planet' })));
  const leafBytes = concat(leaves);
  const tileData = concat(data);
  const header = serializeHeader({
    rootOffset: 127,
    rootLength: root.length,
    metadataOffset: 127 + root.length,
    metadataLength: meta.length,
    leafOffset: 127 + root.length + meta.length,
    leafLength: leafBytes.length,
    tileDataOffset: 127 + root.length + meta.length + leafBytes.length,
    tileDataLength: tileData.length,
    addressedTiles: tiles.length,
    tileEntries: entries.length,
    tileContents: at.size,
    clustered: true,
    internalCompression: 2,
    tileCompression: 1,
    tileType: 1,
    minZoom: 0,
    maxZoom: MAXZ,
    minLonE7: -1800000000,
    minLatE7: -850511287,
    maxLonE7: 1800000000,
    maxLatE7: 850511287,
    centerZoom: 0,
    centerLonE7: 0,
    centerLatE7: 0,
  });
  return concat([header, root, meta, leafBytes, tileData]);
}

describe('the extractor · a synthetic planet: leaves, runs, backward offsets', async () => {
  const planet = await makeArchive(planetTiles(), 150);
  /* two boxes, one with a hole in neither: Europe-ish and a strip of ocean-heavy south */
  const region: RegionGeo = {
    type: 'MultiPolygon',
    coordinates: [box(5, 35, 40, 60).coordinates[0]!, box(-60, -40, -20, -10).coordinates[0]!],
  };

  it('every tile the region needs, equal to the source; the shared tile fetched backwards; runs kept', async () => {
    const src = memSource(planet);
    const parts: Uint8Array[] = [];
    const st = await extract(src, region, { sink: sinkInto(parts), maxGap: 0, maxChunk: 4096 });
    const out = concat(parts);
    expect(await sameTiles(planet, out, region, 0, MAXZ)).toBe(st.addressedTiles);
    expect(st.leafRequests).toBeGreaterThan(0); // the root pointed at leaves
    expect(st.strayRanges).toBeGreaterThan(0); // the ocean, stored where it first occurred
    expect(st.tileContents).toBeLessThan(st.addressedTiles!); // stored once, addressed many times
    const entries = await entriesOf(out);
    expect(entries.some((e) => e.runLength > 1)).toBe(true);
    expect(entries.reduce((n, e) => n + e.runLength, 0)).toBe(st.addressedTiles);
    /* a tile far outside the region is not carried */
    expect(await reader(out).getZxy(MAXZ, 0, 0)).toBeUndefined();
    const info = await describePack(new File([out], 'synthetic.pmtiles'));
    expect(info.maxZoom).toBe(MAXZ);
    expect(info.archiveEnd).toBe(out.length);
  });

  it('cut short after a checkpoint and resumed: byte-identical to a run never interrupted', async () => {
    const o = { maxGap: 0, maxChunk: 2048, concurrency: 3 };
    const whole: Uint8Array[] = [];
    const full = await extract(memSource(planet, 'planet@etag1'), region, { ...o, sink: sinkInto(whole) });
    expect(full.tileChunks).toBeGreaterThan(6);

    /* the app dies right after its third checkpoint was saved */
    const parts: Uint8Array[] = [];
    let saved: Checkpoint | null = null;
    let n = 0;
    await expect(
      extract(memSource(planet, 'planet@etag1'), region, {
        ...o,
        sink: sinkInto(parts),
        onCheckpoint: (c) => {
          saved = c;
          if (++n === 3) throw new Error('killed');
        },
      }),
    ).rejects.toThrow('killed');
    const cp = saved as Checkpoint | null;
    expect(cp).not.toBeNull();
    /* the file as the phone kept it: cut back to the checkpoint (bytes past it may be half written) */
    const kept = concat(parts).subarray(0, cp!.bytes);
    const rest: Uint8Array[] = [];
    const src = memSource(planet, 'planet@etag1');
    await extract(src, region, { ...o, sink: sinkInto(rest), resume: cp! });
    expect(Buffer.compare(Buffer.from(concat([kept, ...rest])), Buffer.from(concat(whole)))).toBe(0);

    /* and an abort (Cancel) mid-way resumes the same way */
    const ac = new AbortController();
    const parts2: Uint8Array[] = [];
    let last: Checkpoint | null = null;
    await expect(
      extract(memSource(planet, 'planet@etag1'), region, {
        ...o,
        signal: ac.signal,
        sink: sinkInto(parts2),
        onCheckpoint: (c) => {
          last = c;
          if (c.item > 4) ac.abort();
        },
      }),
    ).rejects.toThrow();
    const cp2 = last as Checkpoint | null;
    const rest2: Uint8Array[] = [];
    await extract(memSource(planet, 'planet@etag1'), region, { ...o, sink: sinkInto(rest2), resume: cp2! });
    expect(Buffer.compare(Buffer.from(concat([concat(parts2).subarray(0, cp2!.bytes), ...rest2])), Buffer.from(concat(whole)))).toBe(0);
  });

  it('a resume against another build (a new ETag) or another region refuses, never splices', async () => {
    const o = { maxGap: 0, maxChunk: 2048 };
    const plan = await extract(memSource(planet, 'planet@etag1'), region, { ...o, dryRun: true });
    const cp: Checkpoint = { planKey: plan.planKey!, item: 3, bytes: 5000 };
    await expect(extract(memSource(planet, 'planet@etag2'), region, { ...o, sink: sinkInto([]), resume: cp })).rejects.toThrow(/plan changed/);
    await expect(extract(memSource(planet, 'planet@etag1'), box(5, 35, 41, 60), { ...o, sink: sinkInto([]), resume: cp })).rejects.toThrow(/plan changed/);
  });

  it('a source that is gone (404 / 412) is not retried; a flaky one is', async () => {
    let calls = 0;
    const gone: ByteSource = {
      id: 'gone',
      getBytes: async () => {
        calls++;
        throw new SourceGone(412);
      },
    };
    await expect(extract(gone, region, { dryRun: true, sleep: async () => {} })).rejects.toBeInstanceOf(SourceGone);
    expect(calls).toBe(1);
    let fails = 2;
    const flaky = memSource(planet);
    const inner = flaky.getBytes.bind(flaky);
    flaky.getBytes = async (o2: number, l: number) => {
      if (fails-- > 0) throw new Error('network');
      return inner(o2, l);
    };
    const st = await extract(flaky, region, { dryRun: true, sleep: async () => {} });
    expect(st.retries).toBe(2);
  });
});

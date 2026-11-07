/* THE EXTRACTOR (in-app map builder, 7 Nov 2026) — `pmtiles extract --region`
   (go-pmtiles 1.31.2, BSD-3-Clause) ported to plain TypeScript, so the phone
   can cut its own map pack out of a Protomaps daily build of the planet. The
   prototype (extract.mjs) was proven against the real tool on the China
   region: the same 4,738 tiles, each byte-identical, 49.9 MB in 425 requests.

   It knows nothing of the phone. Bytes come from `source.getBytes(offset,
   length)` — the native HTTP of lib/map/build/source.ts on the phone, a
   buffer in the tests — and leave through `sink.write(bytes)`, in file order,
   once each. gzip is CompressionStream unless `codec` says otherwise.

   WHAT IT DOES, IN ORDER:
   1. the source's header and root directory, in one request (16 KB);
   2. the region → every tile id z0–15 it needs (the boundary walked at the
      top zoom, the inside filled run by run along the Hilbert curve, then
      every ancestor) — go-pmtiles' bitmapMultiPolygon + generalizeOr;
   3. the directories: the root, then the leaves the region touches, keeping
      the entries inside it (a run-length entry trimmed to the region);
   4. the plan: the kept tiles re-addressed contiguously in tile-id order, a
      content shared by many tiles (an ocean, an empty square) stored once;
      the source ranges coalesced into requests of at most `maxChunk` bytes
      whose gaps waste at most `overfetch` of what is kept (go-pmtiles' rule);
   5. the new archive's prefix — header, root, metadata (the source's, plus
      ours: `metadata`), leaves — written first, all small, all in memory;
   6. the tile data, streamed through a bounded window of parallel requests.

   A SHARED TILE POINTS BACKWARDS. Planet builds store a repeated tile where it
   first occurred, so its range lies behind the ones around it in the source.
   Those few "strays" are fetched up front and held (a few KB), the rest is one
   ascending chain streamed in order.

   MEMORY: the plan (tens of thousands of small entries), the prefix, the
   strays and at most `window` fetched-but-unwritten chunks, each ≤ maxChunk.
   The tile data is never assembled in memory.

   RESUMABLE. After the last range of each chunk is written, `onCheckpoint`
   gets {planKey, item, bytes}: the first range not yet written and the file
   length so far. A later call with `resume` set to it (the file cut back to
   `bytes`) writes only the rest — provided the plan is the same, which the
   key proves: the source's id (its URL and ETag), the region, the zooms, the
   chunking and the metadata. A different plan throws rather than splice two
   archives. */

const HEADER_LEN = 127;
/** header + root directory (+ usually the metadata) in one request */
const FIRST_READ = 16384;
const R = 6378137;

export interface ByteSource {
  /** the source archive's bytes [offset, offset + length) */
  getBytes(offset: number, length: number): Promise<Uint8Array>;
  /** names the archive and its version (URL and ETag): part of the resume key */
  readonly id: string;
}
export interface Sink {
  write(bytes: Uint8Array): Promise<void> | void;
}
export interface Codec {
  gzip(b: Uint8Array): Promise<Uint8Array>;
  gunzip(b: Uint8Array): Promise<Uint8Array>;
}
export interface Checkpoint {
  planKey: string;
  /** the first range not yet written */
  item: number;
  /** the output's length once everything before `item` is written */
  bytes: number;
}
/** A region: a MultiPolygon (lib/map/region.ts regionOf) or a Polygon, [lng, lat]. */
export type RegionGeo = { type: 'MultiPolygon'; coordinates: number[][][][] } | { type: 'Polygon'; coordinates: number[][][] };

export interface Stats {
  requests: number;
  retries: number;
  bytesFetched: number;
  leafRequests: number;
  leafBytes: number;
  tileRequests: number;
  tileBytesFetched: number;
  /* known once planned */
  regionTiles?: number;
  tileEntries?: number;
  addressedTiles?: number;
  tileContents?: number;
  tileChunks?: number;
  strayRanges?: number;
  plannedTileBytes?: number;
  keptTileBytes?: number;
  /** the new archive's size */
  outputBytes?: number;
  gapUsed?: number;
  planKey?: string;
  /** every request the whole extract makes (directories read so far + tile chunks) */
  planRequests?: number;
  minZoom?: number;
  maxZoom?: number;
}
export interface Progress extends Stats {
  phase: 'directories' | 'tiles';
  done: number;
  total: number;
}
export interface ExtractOptions {
  sink?: Sink;
  minzoom?: number;
  maxzoom?: number;
  /** the largest gap merged into one request (bytes), unless `overfetch` decides it */
  maxGap?: number;
  /** the gap merged between leaf directories (default maxGap) */
  leafGap?: number;
  /** waste at most this share of the kept bytes on gaps (go-pmtiles' rule) — sets the gap */
  overfetch?: number;
  maxChunk?: number;
  concurrency?: number;
  /** fetched-but-unwritten chunks at most (default concurrency × 2) */
  window?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
  onProgress?(p: Progress): void;
  onCheckpoint?(c: Checkpoint): void | Promise<void>;
  resume?: Checkpoint;
  /** plan only: read the directories, write nothing, return the stats */
  dryRun?: boolean;
  codec?: Codec;
  signal?: AbortSignal;
  sleep?(ms: number): Promise<void>;
}

/** An error the source raises when retrying cannot help (the build is gone, or changed: 404, 412). */
export class SourceGone extends Error {
  readonly fatal = true;
  constructor(readonly status: number) {
    super(`the source answered ${status}`);
  }
}

/* ---------- Hilbert tile ids ---------- */
function rot(n: number, xy: [number, number], rx: number, ry: number): void {
  if (ry === 0) {
    if (rx === 1) {
      xy[0] = n - 1 - xy[0];
      xy[1] = n - 1 - xy[1];
    }
    const t = xy[0];
    xy[0] = xy[1];
    xy[1] = t;
  }
}
export function zxyToId(z: number, x: number, y: number): number {
  let acc = 0;
  for (let t = 0; t < z; t++) acc += 4 ** t;
  const n = 2 ** z;
  const xy: [number, number] = [x, y];
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = xy[0] & s ? 1 : 0;
    const ry = xy[1] & s ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    rot(n, xy, rx, ry);
  }
  return acc + d;
}
export function idToZxy(id: number): [number, number, number] {
  let z = 0;
  let acc = 0;
  for (; ; z++) {
    const n = 4 ** z;
    if (acc + n > id) break;
    acc += n;
  }
  let t = id - acc;
  const xy: [number, number] = [0, 0];
  for (let s = 1; s < 2 ** z; s *= 2) {
    const rx = Math.floor(t / 2) % 2;
    const ry = (t % 2) ^ rx;
    rot(s, xy, rx, ry);
    xy[0] += s * rx;
    xy[1] += s * ry;
    t = Math.floor(t / 4);
  }
  return [z, xy[0], xy[1]];
}

/* ---------- the region's tile set ---------- */
type Ring = number[][];
const polygonsOf = (g: RegionGeo): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

/** a point's position in tiles at zoom z (fractional) */
function frac(p: number[], z: number): [number, number] {
  const lng = p[0] ?? 0;
  const lat = p[1] ?? 0;
  const n = 2 ** z;
  let y: number;
  if (lat < -85.0511) y = n - 1;
  else if (lat > 85.0511) y = 0;
  else {
    const s = Math.sin((lat * Math.PI) / 180);
    y = (0.5 + (0.5 * Math.log((1 + s) / (1 - s))) / (-2 * Math.PI)) * n;
  }
  return [(lng / 360 + 0.5) * n, y];
}
/** every tile a ring's segments pass through (orb tilecover.LineString: a grid walk) */
function lineTiles(line: Ring, z: number, set: Set<number>): void {
  let prevX = -1;
  let prevY = -1;
  for (let i = 0; i < line.length - 1; i++) {
    const a = frac(line[i]!, z);
    const b = frac(line[i + 1]!, z);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) continue;
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    let x = Math.floor(a[0]);
    let y = Math.floor(a[1]);
    let tMaxX = dx !== 0 ? Math.abs(((dx > 0 ? 1 : 0) + x - a[0]) / dx) : Infinity;
    let tMaxY = dy !== 0 ? Math.abs(((dy > 0 ? 1 : 0) + y - a[1]) / dy) : Infinity;
    const tdx = Math.abs(sx / dx);
    const tdy = Math.abs(sy / dy);
    if (x !== prevX || y !== prevY) {
      set.add(zxyToId(z, x, y));
      prevX = x;
      prevY = y;
    }
    while (tMaxX < 1 || tMaxY < 1) {
      if (tMaxX < tMaxY) {
        tMaxX += tdx;
        x += sx;
      } else {
        tMaxY += tdy;
        y += sy;
      }
      set.add(zxyToId(z, x, y));
      prevX = x;
      prevY = y;
    }
  }
}
const merc = (p: number[]): [number, number] => {
  const lng = p[0] ?? 0;
  const lat = p[1] ?? 0;
  return [(R * lng * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
};
function inRing(p: [number, number], ring: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const tileLat = (y: number, z: number): number => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

export interface TileSet {
  /** every tile id the region needs, sorted */
  ids: Float64Array;
  has(id: number): boolean;
  /** does any id lie in [lo, hi)? */
  intersects(lo: number, hi: number): boolean;
  /** the index of the first id ≥ v */
  lower(v: number): number;
}
/** The sorted ids of every tile minzoom..maxzoom the region needs. */
export function regionTiles(region: RegionGeo, minzoom: number, maxzoom: number): TileSet {
  const polys = polygonsOf(region);
  const boundary = new Set<number>();
  for (const poly of polys) for (const ring of poly) lineTiles(ring, maxzoom, boundary);
  const b = Float64Array.from(boundary).sort();
  const mpolys = polys.map((poly) => poly.map((ring) => ring.map(merc)));
  const all = new Set<number>(b);
  /* between two boundary tiles the Hilbert curve is all inside or all outside: one look at the first tile decides */
  for (let k = 0; k + 1 < b.length; k++) {
    const id = b[k]! + 1;
    if (b[k + 1] === id) continue;
    const [z, x, y] = idToZxy(id);
    const c = merc([((x + 0.5) / 2 ** z) * 360 - 180, (tileLat(y, z) + tileLat(y + 1, z)) / 2]);
    /* inside iff in an outer ring and in none of that polygon's holes */
    if (mpolys.some((p) => inRing(c, p[0]!) && !p.slice(1).some((h) => inRing(c, h)))) for (let i = id; i < b[k + 1]!; i++) all.add(i);
  }
  /* every ancestor, down to minzoom */
  let level = [...all];
  for (let z = maxzoom; z > minzoom; z--) {
    const parents = new Set<number>();
    for (const id of level) {
      const [, x, y] = idToZxy(id);
      parents.add(zxyToId(z - 1, x >> 1, y >> 1));
    }
    for (const p of parents) all.add(p);
    level = [...parents];
  }
  const ids = Float64Array.from(all).sort();
  const lower = (v: number): number => {
    let lo = 0;
    let hi = ids.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ids[m]! < v) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  return {
    ids,
    has: (id) => ids[lower(id)] === id,
    intersects: (lo, hi) => {
      const i = lower(lo);
      return i < ids.length && ids[i]! < hi;
    },
    lower,
  };
}

/* ---------- varints, directories, the header ---------- */
export interface Entry {
  tileId: number;
  offset: number;
  length: number;
  /** 0: a leaf directory; ≥ 1: that many consecutive tile ids share the content */
  runLength: number;
}
function reader(buf: Uint8Array): () => number {
  let p = 0;
  return () => {
    let v = 0;
    let m = 1;
    for (;;) {
      const b = buf[p++] ?? 0;
      v += (b & 0x7f) * m;
      if (b < 0x80) return v;
      m *= 128;
    }
  };
}
function putVarint(out: number[], v: number): void {
  while (v >= 128) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}
export function parseDir(raw: Uint8Array): Entry[] {
  const next = reader(raw);
  const n = next();
  const e: Entry[] = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    id += next();
    e.push({ tileId: id, offset: 0, length: 0, runLength: 0 });
  }
  for (const x of e) x.runLength = next();
  for (const x of e) x.length = next();
  e.forEach((x, i) => {
    const v = next();
    const prev = e[i - 1];
    x.offset = v === 0 && prev ? prev.offset + prev.length : v - 1;
  });
  return e;
}
export function serializeDir(e: Entry[]): Uint8Array {
  const o: number[] = [];
  putVarint(o, e.length);
  let last = 0;
  for (const x of e) {
    putVarint(o, x.tileId - last);
    last = x.tileId;
  }
  for (const x of e) putVarint(o, x.runLength);
  for (const x of e) putVarint(o, x.length);
  e.forEach((x, i) => {
    const prev = e[i - 1];
    putVarint(o, prev && x.offset === prev.offset + prev.length ? 0 : x.offset + 1);
  });
  return Uint8Array.from(o);
}

export interface Header {
  rootOffset: number;
  rootLength: number;
  metadataOffset: number;
  metadataLength: number;
  leafOffset: number;
  leafLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  addressedTiles: number;
  tileEntries: number;
  tileContents: number;
  clustered: boolean;
  internalCompression: number;
  tileCompression: number;
  tileType: number;
  minZoom: number;
  maxZoom: number;
  minLonE7: number;
  minLatE7: number;
  maxLonE7: number;
  maxLatE7: number;
  centerZoom: number;
  centerLonE7: number;
  centerLatE7: number;
}
const U64 = [
  'rootOffset',
  'rootLength',
  'metadataOffset',
  'metadataLength',
  'leafOffset',
  'leafLength',
  'tileDataOffset',
  'tileDataLength',
  'addressedTiles',
  'tileEntries',
  'tileContents',
] as const;
export function parseHeader(b: Uint8Array): Header {
  if (b.length < HEADER_LEN || String.fromCharCode(...b.subarray(0, 7)) !== 'PMTiles' || b[7] !== 3) throw new Error('not a PMTiles v3 archive');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const i = (o: number): number => dv.getInt32(o, true);
  const h = Object.fromEntries(U64.map((k, n) => [k, Number(dv.getBigUint64(8 + 8 * n, true))])) as Record<(typeof U64)[number], number>;
  return {
    ...h,
    clustered: b[96] === 1,
    internalCompression: b[97]!,
    tileCompression: b[98]!,
    tileType: b[99]!,
    minZoom: b[100]!,
    maxZoom: b[101]!,
    minLonE7: i(102),
    minLatE7: i(106),
    maxLonE7: i(110),
    maxLatE7: i(114),
    centerZoom: b[118]!,
    centerLonE7: i(119),
    centerLatE7: i(123),
  };
}
export function serializeHeader(h: Header): Uint8Array {
  const b = new Uint8Array(HEADER_LEN);
  const dv = new DataView(b.buffer);
  b.set([80, 77, 84, 105, 108, 101, 115, 3]); // "PMTiles", v3
  U64.forEach((k, n) => dv.setBigUint64(8 + 8 * n, BigInt(h[k]), true));
  b[96] = h.clustered ? 1 : 0;
  b[97] = h.internalCompression;
  b[98] = h.tileCompression;
  b[99] = h.tileType;
  b[100] = h.minZoom;
  b[101] = h.maxZoom;
  dv.setInt32(102, h.minLonE7, true);
  dv.setInt32(106, h.minLatE7, true);
  dv.setInt32(110, h.maxLonE7, true);
  dv.setInt32(114, h.maxLatE7, true);
  b[118] = h.centerZoom;
  dv.setInt32(119, h.centerLonE7, true);
  dv.setInt32(123, h.centerLatE7, true);
  return b;
}

/* ---------- gzip ---------- */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const w = stream.writable.getWriter();
  void w.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  void w.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
export const defaultCodec: Codec = {
  gzip: (b) => pipe(b, new CompressionStream('gzip')),
  gunzip: (b) => pipe(b, new DecompressionStream('gzip')),
};

/* ---------- the plan ---------- */
/** go-pmtiles RelevantEntries: the tile entries inside the region (a run trimmed to it) and the leaves it touches. */
function relevant(set: TileSet, maxzoom: number, dir: Entry[]): { tiles: Entry[]; leaves: Entry[] } {
  const last = zxyToId(maxzoom + 1, 0, 0);
  const tiles: Entry[] = [];
  const leaves: Entry[] = [];
  dir.forEach((e, idx) => {
    if (e.runLength === 0) {
      if (set.intersects(e.tileId, dir[idx + 1]?.tileId ?? last)) leaves.push(e);
    } else if (e.runLength === 1) {
      if (set.has(e.tileId)) tiles.push(e);
    } else {
      const end = e.tileId + e.runLength;
      let start = -1;
      let prev = -1;
      for (let k = set.lower(e.tileId); k < set.ids.length && set.ids[k]! < end; k++) {
        const id = set.ids[k]!;
        if (start >= 0 && id === prev + 1) {
          prev = id;
          continue;
        }
        if (start >= 0) tiles.push({ tileId: start, offset: e.offset, length: e.length, runLength: prev - start + 1 });
        start = prev = id;
      }
      if (start >= 0) tiles.push({ tileId: start, offset: e.offset, length: e.length, runLength: prev - start + 1 });
    }
  });
  return { tiles, leaves };
}

interface Span {
  offset: number;
  length: number;
}
interface Chunk<T extends Span> {
  offset: number;
  end: number;
  length: number;
  parts: T[];
  i: number;
  got?: boolean;
}
/** Merge sorted, non-overlapping ranges while the gap is ≤ maxGap and the chunk stays ≤ maxChunk. */
export function coalesce<T extends Span>(items: T[], maxGap: number, maxChunk: number): Chunk<T>[] {
  const chunks: Chunk<T>[] = [];
  let cur: Chunk<T> | null = null;
  for (const it of items) {
    const end = it.offset + it.length;
    if (cur && it.offset - cur.end <= maxGap && end - cur.offset <= maxChunk) {
      cur.parts.push(it);
      cur.end = end;
    } else {
      cur = { offset: it.offset, end, length: 0, parts: [it], i: chunks.length };
      chunks.push(cur);
    }
  }
  for (const c of chunks) c.length = c.end - c.offset;
  return chunks;
}

/** one source range the output needs, at `dst` in the tile data */
interface Range extends Span {
  dst: number;
  idx: number;
  chunk?: Chunk<Range>;
  buf?: Uint8Array | null;
}

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
};

/**
 * Cut `region` out of the archive `source` reads, into `opts.sink`. Resolves
 * with the stats; with `dryRun`, after the plan, having written nothing.
 */
export async function extract(source: ByteSource, region: RegionGeo, opts: ExtractOptions = {}): Promise<Stats> {
  const o = { minzoom: 0, maxzoom: 15, maxGap: 65536, maxChunk: 4 << 20, concurrency: 6, retries: 5, metadata: {}, codec: defaultCodec, ...opts };
  const leafGap = o.leafGap ?? o.maxGap;
  const codec = o.codec;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const st: Stats = { requests: 0, retries: 0, bytesFetched: 0, leafRequests: 0, leafBytes: 0, tileRequests: 0, tileBytesFetched: 0 };
  const progress = (phase: Progress['phase'], done: number, total: number): void => o.onProgress?.({ ...st, phase, done, total });

  /* one read, retried with a growing, jittered pause — unless the source says retrying cannot help */
  const get = async (off: number, len: number, lenient = false): Promise<Uint8Array> => {
    for (let a = 0; ; a++) {
      try {
        o.signal?.throwIfAborted();
        st.requests++;
        const b = await source.getBytes(off, len);
        if (b.length !== len && !(lenient && b.length >= HEADER_LEN && b.length < len)) throw new Error(`short read ${b.length}/${len}`);
        st.bytesFetched += b.length;
        return b;
      } catch (e) {
        if (a >= o.retries || (e as { fatal?: boolean }).fatal || o.signal?.aborted) throw e;
        st.retries++;
        await sleep(Math.min(30000, 500 * 2 ** a) * (0.5 + Math.random() / 2));
      }
    }
  };
  const pool = async <T>(items: T[], n: number, fn: (it: T) => Promise<void>): Promise<void> => {
    let i = 0;
    await Promise.all(
      Array.from({ length: Math.min(n, items.length) }, async () => {
        while (i < items.length) await fn(items[i++]!);
      }),
    );
  };

  /* 1 · the header and the root (and usually the metadata) in one request — a short answer is a tiny archive */
  const head = await get(0, FIRST_READ, true);
  const h = parseHeader(head);
  if (!h.clustered) throw new Error('the source archive must be clustered');
  if (h.internalCompression > 2) throw new Error(`internal compression ${h.internalCompression} is not supported`);
  const unz = (b: Uint8Array): Promise<Uint8Array> => (h.internalCompression === 2 ? codec.gunzip(b) : Promise.resolve(b));
  const maxzoom = Math.min(o.maxzoom, h.maxZoom);
  const minzoom = Math.max(o.minzoom, h.minZoom);
  const slice = async (off: number, len: number): Promise<Uint8Array> => (off + len <= head.length ? head.subarray(off, off + len) : get(off, len));

  /* 2 · the region's tiles; 3 · root → leaves → tile entries */
  const set = regionTiles(region, minzoom, maxzoom);
  let { tiles, leaves } = relevant(set, maxzoom, parseDir(await unz(await slice(h.rootOffset, h.rootLength))));
  while (leaves.length) {
    const uniq = [...new Map(leaves.map((l) => [l.offset, l])).values()].sort((a, b) => a.offset - b.offset);
    const chunks = coalesce(
      uniq.map((l) => ({ offset: h.leafOffset + l.offset, length: l.length })),
      leafGap,
      o.maxChunk,
    );
    const next: Entry[] = [];
    await pool(chunks, o.concurrency, async (c) => {
      const buf = await get(c.offset, c.length);
      st.leafRequests++;
      st.leafBytes += c.length;
      for (const p of c.parts) {
        const r = relevant(set, maxzoom, parseDir(await unz(buf.subarray(p.offset - c.offset, p.offset - c.offset + p.length))));
        tiles.push(...r.tiles);
        next.push(...r.leaves);
      }
      progress('directories', st.leafRequests, chunks.length);
    });
    leaves = next;
  }
  tiles.sort((a, b) => a.tileId - b.tileId);

  /* 4 · re-addressed: offsets contiguous in tile-id order, a source offset shared by many tiles stored once */
  const seen = new Map<number, number>();
  const ranges: Range[] = [];
  const entries: Entry[] = [];
  let dst = 0;
  let addressed = 0;
  for (const e of tiles) {
    let d = seen.get(e.offset);
    if (d === undefined) {
      const lr = ranges[ranges.length - 1];
      if (lr && lr.offset + lr.length === h.tileDataOffset + e.offset) lr.length += e.length;
      else ranges.push({ offset: h.tileDataOffset + e.offset, length: e.length, dst, idx: ranges.length });
      d = dst;
      seen.set(e.offset, d);
      dst += e.length;
    }
    entries.push({ tileId: e.tileId, offset: d, length: e.length, runLength: e.runLength });
    addressed += e.runLength;
  }
  const tileData = dst;
  /* `main` is the ascending chain, streamed in order; `strays` point backwards (a shared tile), fetched first and held */
  const main: Range[] = [];
  const strays: Range[] = [];
  let mainEnd = -1;
  for (const r of ranges) {
    if (r.offset >= mainEnd) {
      main.push(r);
      mainEnd = r.offset + r.length;
    } else strays.push(r);
  }
  /* the gap: fixed, or the largest whose total waste stays within `overfetch` × the kept bytes */
  let gap = o.maxGap;
  if (o.overfetch != null) {
    const gaps = main
      .slice(1)
      .map((r, i) => r.offset - (main[i]!.offset + main[i]!.length))
      .sort((x, y) => x - y);
    let sum = 0;
    gap = 0;
    for (const g of gaps) {
      if (sum + g > o.overfetch * tileData) break;
      sum += g;
      gap = g;
    }
  }
  const chunks = coalesce(main, gap, o.maxChunk);
  for (const c of chunks) for (const p of c.parts) p.chunk = c;
  const strayChunks = coalesce(
    [...strays].sort((x, y) => x.offset - y.offset),
    gap,
    o.maxChunk,
  );
  const planned = chunks.reduce((n, c) => n + c.length, 0) + strayChunks.reduce((n, c) => n + c.length, 0);

  /* 5 · the prefix: directories, metadata, header — small, in memory */
  const [root, leafBytes] = await buildDirs(entries, FIRST_READ - HEADER_LEN, codec);
  const meta = JSON.parse(new TextDecoder().decode(await unz(await slice(h.metadataOffset, h.metadataLength)))) as Record<string, unknown>;
  const metaBytes = await codec.gzip(new TextEncoder().encode(JSON.stringify({ ...meta, ...o.metadata })));
  const bb = polygonsOf(region)
    .flat(2)
    .reduce((b, p) => [Math.min(b[0]!, p[0]!), Math.min(b[1]!, p[1]!), Math.max(b[2]!, p[0]!), Math.max(b[3]!, p[1]!)], [Infinity, Infinity, -Infinity, -Infinity]);
  const E7 = (v: number): number => Math.trunc(v * 1e7);
  const out: Header = {
    ...h,
    rootOffset: HEADER_LEN,
    rootLength: root.length,
    metadataOffset: HEADER_LEN + root.length,
    metadataLength: metaBytes.length,
    leafOffset: HEADER_LEN + root.length + metaBytes.length,
    leafLength: leafBytes.length,
    tileDataOffset: HEADER_LEN + root.length + metaBytes.length + leafBytes.length,
    tileDataLength: tileData,
    addressedTiles: addressed,
    tileEntries: entries.length,
    tileContents: seen.size,
    internalCompression: 2,
    minZoom: minzoom,
    maxZoom: maxzoom,
    minLonE7: E7(bb[0]!),
    minLatE7: E7(bb[1]!),
    maxLonE7: E7(bb[2]!),
    maxLatE7: E7(bb[3]!),
    centerZoom: Math.min(Math.max(h.centerZoom, minzoom), maxzoom),
    centerLonE7: E7((bb[0]! + bb[2]!) / 2),
    centerLatE7: E7((bb[1]! + bb[3]!) / 2),
  };
  const prefix = [serializeHeader(out), root, metaBytes, leafBytes];
  const planKey = fnv(
    JSON.stringify([source.id, minzoom, maxzoom, gap, o.maxChunk, JSON.stringify(region), JSON.stringify(o.metadata), entries.length, tileData, root.length, metaBytes.length]),
  );
  Object.assign(st, {
    regionTiles: set.ids.length,
    tileEntries: entries.length,
    addressedTiles: addressed,
    tileContents: seen.size,
    tileChunks: chunks.length,
    strayRanges: strays.length,
    plannedTileBytes: planned,
    keptTileBytes: tileData,
    outputBytes: out.tileDataOffset + tileData,
    gapUsed: gap,
    planKey,
    planRequests: st.requests + chunks.length + strayChunks.length,
    minZoom: minzoom,
    maxZoom: maxzoom,
  });
  if (o.dryRun) return st;
  if (!o.sink) throw new Error('extract: no sink to write to');
  const sink = o.sink;

  /* 6 · the stream: the prefix, then the ranges in output order, the chain through a bounded window of parallel fetches */
  if (o.resume && o.resume.planKey !== planKey) throw new Error('resume: the plan changed (another build, region or settings) — start over');
  const item = o.resume ? o.resume.item : 0;
  if (!o.resume) for (const p of prefix) await sink.write(p);
  const window = o.window ?? o.concurrency * 2;
  const running = new Map<number, Promise<Uint8Array | null>>();
  let inflight = 0;
  let aborted = false;
  const waiters: (() => void)[] = [];
  const fetchChunk = async (c: Chunk<Range>): Promise<Uint8Array | null> => {
    while (inflight >= o.concurrency) await new Promise<void>((r) => waiters.push(r));
    if (aborted) return null;
    inflight++;
    try {
      return await get(c.offset, c.length);
    } finally {
      inflight--;
      waiters.shift()?.();
    }
  };
  try {
    const todo = strayChunks.filter((c) => c.parts.some((p) => p.idx >= item));
    await pool(todo, o.concurrency, async (c) => {
      const buf = await get(c.offset, c.length);
      st.tileRequests++;
      st.tileBytesFetched += c.length;
      /* a copy: the chunk's buffer can go */
      for (const p of c.parts) p.buf = buf.slice(p.offset - c.offset, p.offset - c.offset + p.length);
    });
    let launched = chunks.findIndex((c) => c.parts[0]!.idx >= item);
    if (launched < 0) launched = chunks.length;
    for (let j = item; j < ranges.length; j++) {
      const r = ranges[j]!;
      const c = r.chunk;
      let buf = r.buf;
      if (c) {
        while (launched < chunks.length && launched - c.i < window) {
          const pr = fetchChunk(chunks[launched]!);
          pr.catch(() => {});
          running.set(launched++, pr);
        }
        const cb = await running.get(c.i);
        if (!cb) throw new Error('extract: a chunk was not fetched');
        if (!c.got) {
          c.got = true;
          st.tileRequests++;
          st.tileBytesFetched += c.length;
        }
        buf = cb.subarray(r.offset - c.offset, r.offset - c.offset + r.length);
      }
      if (!buf) throw new Error('extract: a range has no bytes');
      await sink.write(buf);
      r.buf = null;
      if (c && r === c.parts[c.parts.length - 1]) {
        running.delete(c.i);
        await o.onCheckpoint?.({ planKey, item: j + 1, bytes: out.tileDataOffset + r.dst + r.length });
        progress('tiles', r.dst + r.length, tileData);
      }
    }
  } finally {
    aborted = true;
  }
  return st;
}

/** The directories: the whole index as the root when it fits `targetRoot`, else leaves the root points at. */
async function buildDirs(entries: Entry[], targetRoot: number, codec: Codec): Promise<[Uint8Array, Uint8Array]> {
  const whole = await codec.gzip(serializeDir(entries));
  if (whole.length <= targetRoot) return [whole, new Uint8Array(0)];
  let size = Math.max(4096, entries.length / 3500);
  for (;;) {
    const rootEntries: Entry[] = [];
    const leaves: Uint8Array[] = [];
    let off = 0;
    for (let i = 0; i < entries.length; i += Math.floor(size)) {
      const z = await codec.gzip(serializeDir(entries.slice(i, i + Math.floor(size))));
      rootEntries.push({ tileId: entries[i]!.tileId, offset: off, length: z.length, runLength: 0 });
      leaves.push(z);
      off += z.length;
    }
    const root = await codec.gzip(serializeDir(rootEntries));
    if (root.length < targetRoot) {
      const all = new Uint8Array(off);
      let p = 0;
      for (const l of leaves) {
        all.set(l, p);
        p += l.length;
      }
      return [root, all];
    }
    size *= 1.2;
  }
}

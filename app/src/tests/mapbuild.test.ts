/* BUILD MAP FOR THIS TRIP (7 Nov 2026, lib/map/build/run.ts) — end to end,
   with no network and no phone: the trip is the Israel test trip
   (seed/israel-test.trip.json, no personal data) in the real Dexie schema
   (fake-indexeddb), the "server" is the synthetic planet
   (fixtures/planet.ts) behind a stand-in source, and OPFS is a stand-in that
   behaves as Chromium's does where it matters: what a writable stream wrote
   reaches the file only when the stream CLOSES (an app killed mid-write loses
   everything since the last close), and a reopened stream with
   keepExistingData starts from the file as it is.

   What is proved: the plan's size is the pack's size to the byte; the build
   lands through the importer's own check and swap, stamped with the ltd: keys
   build-pack.ts writes, and is the file a direct extract writes; it REPLACES a
   pack with photos completely; Cancel, and an app killed between two commits
   and opened again, both carry on to the same bytes; a build gone from the
   server drops its half-built file and keeps the old pack; and every failure
   says what is true. */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { SourceGone, type ByteSource } from '../lib/map/build/extract';
import { makeArchive, planetTiles } from './fixtures/planet';

const here = dirname(fileURLToPath(import.meta.url));
const trip = (JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'israel-test.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const PHOTO_PACK = new Uint8Array(readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles')));
/* z0–6 everywhere, to z10 over Israel: the trip's region is dozens of chunks, not a handful */
const planet = await makeArchive(planetTiles({ bbox: [33.5, 28.5, 36.5, 33.9], to: 10 }), 150);
const TRIP = { id: trip.trip.id, title: trip.trip.title };
/* small chunks, so the synthetic planet's Israel makes many of them (the phone's are 2 MB) */
const TUNE = { maxChunk: 64, concurrency: 1 };
const BUILD = '20261107';

/* ---------- OPFS, as Chromium keeps it ---------- */
let folder: Map<string, Uint8Array>;
/* what the stand-ins are told to do: a stream's close that fails (a full disk at the last moment), and which writers
   were opened */
const fail = { close: false };
const opened = { streams: 0, handles: 0 };
const notFound = (): Error => Object.assign(new Error('not found'), { name: 'NotFoundError' });
class Handle {
  constructor(public name: string) {}
  async getFile(): Promise<File> {
    const b = folder.get(this.name);
    if (!b) throw notFound();
    return new File([Uint8Array.from(b)], this.name, { lastModified: Date.now() });
  }
  /* the synchronous access handle a worker holds (the in-place writer): writes land where they go */
  async createSyncAccessHandle() {
    opened.handles++;
    const name = this.name;
    const at = (): Uint8Array => folder.get(name) ?? new Uint8Array();
    return {
      truncate(n: number) {
        const b = at();
        const c = new Uint8Array(n);
        c.set(b.subarray(0, Math.min(n, b.length)));
        folder.set(name, c);
      },
      write(d: Uint8Array, o: { at: number }) {
        let b = at();
        if (o.at + d.length > b.length) {
          const c = new Uint8Array(o.at + d.length);
          c.set(b);
          b = c;
        }
        b.set(d, o.at);
        folder.set(name, b);
        return d.length;
      },
      flush() {},
      close() {},
    };
  }
  async createWritable(o?: { keepExistingData?: boolean }) {
    opened.streams++;
    const name = this.name;
    let buf = o?.keepExistingData ? Uint8Array.from(folder.get(name) ?? []) : new Uint8Array();
    let pos = 0;
    const grow = (n: number): void => {
      if (n <= buf.length) return;
      const b = new Uint8Array(n);
      b.set(buf);
      buf = b;
    };
    return {
      async write(d: Uint8Array) {
        grow(pos + d.length);
        buf.set(d, pos);
        pos += d.length;
      },
      async seek(p: number) {
        pos = p;
      },
      async truncate(n: number) {
        buf = n <= buf.length ? buf.slice(0, n) : (grow(n), buf);
        if (pos > n) pos = n;
      },
      /* only now does the file change */
      async close() {
        if (fail.close) throw new Error('QuotaExceededError');
        folder.set(name, buf);
      },
      async abort() {},
      /* the importer's path pipes into it */
      getWriter: undefined,
    };
  }
  async move(to: string): Promise<void> {
    const b = folder.get(this.name);
    if (!b) throw notFound();
    folder.set(to, b);
    folder.delete(this.name);
    this.name = to;
  }
}
const dir = {
  async getDirectoryHandle() {
    return dir;
  },
  async getFileHandle(name: string, o?: { create?: boolean }) {
    if (!folder.has(name)) {
      if (!o?.create) throw notFound();
      folder.set(name, new Uint8Array());
    }
    return new Handle(name);
  },
  async removeEntry(name: string) {
    if (!folder.delete(name)) throw notFound();
  },
};

/* ---------- the server ---------- */
function server(etag = '"e1"'): ByteSource & { etag: string; reads: number; stall?: number } {
  const s = {
    id: `https://build.protomaps.com/${BUILD}.pmtiles ${etag}`,
    etag,
    reads: 0,
    stall: undefined as number | undefined,
    async getBytes(o: number, l: number): Promise<Uint8Array> {
      s.reads++;
      /* the phone dies here: this read never answers */
      if (s.stall !== undefined && s.reads > s.stall) return new Promise<Uint8Array>(() => {});
      return planet.slice(o, Math.min(o + l, planet.length));
    },
  };
  return s;
}

/** the app's modules, fresh — as after a restart (OPFS and IndexedDB stay as they were) */
async function app() {
  vi.resetModules();
  const run = await import('../lib/map/build/run');
  const state = await import('../lib/map/build/state');
  const pack = await import('../lib/map/pack');
  const { extract } = await import('../lib/map/build/extract');
  const { db } = await import('../lib/db/db');
  return { run, state, pack, extract, db };
}

beforeEach(async () => {
  folder = new Map();
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir, estimate: async () => ({ quota: 1e10, usage: 0 }), persist: async () => true } });
  const { db } = await app();
  await db.delete();
  await db.open();
  await db.stops.bulkPut(trip.stops);
  await db.showCards.bulkPut(trip.showCards);
  await db.bookings.bulkPut(trip.bookings);
  await db.dayPlans.bulkPut(trip.dayPlans);
  await db.dayDefaults.bulkPut(trip.dayDefaults);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fail.close = false;
  opened.streams = opened.handles = 0;
});

/** A Worker as the WebView runs the in-place writer: the very source run.ts hands it, run here against the OPFS
    stand-in (`noHandle`: a WebView whose worker has no sync access handle). */
function workers(noHandle = false): void {
  const blobs = new Map<string, Blob>();
  let n = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    const id = `blob:w${n++}`;
    blobs.set(id, b as Blob);
    return id;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const nav = {
    storage: {
      getDirectory: async () => ({
        getDirectoryHandle: async () => ({
          getFileHandle: async (name: string, o?: { create?: boolean }) => {
            const h = (await dir.getFileHandle(name, o)) as unknown as Record<string, unknown>;
            return noHandle ? { ...h, createSyncAccessHandle: undefined } : h;
          },
        }),
      }),
    },
  };
  class FakeWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: { message: string }) => void) | null = null;
    private ready: Promise<(e: { data: unknown }) => Promise<void>>;
    constructor(url: string) {
      this.ready = blobs
        .get(url)!
        .text()
        .then((src) => new Function('postMessage', 'navigator', `let onmessage;\n${src}\nreturn onmessage;`)((m: unknown) => this.onmessage?.({ data: m }), nav));
    }
    postMessage(m: unknown): void {
      void this.ready.then((h) => h({ data: m }));
    }
    terminate(): void {}
  }
  vi.stubGlobal('Worker', FakeWorker);
}

const quiet = { onProgress: () => {} };

describe('build map for this trip · plan, build, land', () => {
  it('plans the trip from its own tables: its areas, the ltd: keys, the size to the byte — and writes nothing', async () => {
    const { run } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    expect(p.saved.areas).toEqual(['Tel Aviv + Jerusalem', 'Negev & Mitzpe Ramon', 'Eilat & the Red Sea', 'Dead Sea', 'Galilee & the Golan', 'Haifa & the coast']);
    expect(p.saved.meta).toMatchObject({ 'ltd:pack': 'test-israel-60-map', 'ltd:trip': 'TEST — Israel 60', 'ltd:source': `Protomaps daily build ${BUILD} · OpenStreetMap`, 'ltd:maxzoom': 15 });
    expect(p.saved.meta['ltd:built']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.saved.etag).toBe('"e1"');
    expect(p.hadPack).toBe(false);
    expect(folder.size).toBe(0);
  });

  it('builds and lands it: the importer’s check and swap, the file a direct extract writes, the plan’s size', async () => {
    const { run, state, pack, extract } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const steps = new Set<string>();
    const info = await run.build(p.saved, { source: p.source, signal: new AbortController().signal, onProgress: (_, s) => void steps.add(s) });
    expect(steps).toEqual(new Set(['index', 'tiles', 'check']));
    expect(info.trip).toBe('TEST — Israel 60');
    expect(info.name).toBe('test-israel-60-map');
    expect(info.areas).toHaveLength(6);
    expect(info.photos).toBeUndefined();
    const landed = folder.get('map.pmtiles')!;
    expect(landed.length).toBe(p.saved.total);
    expect(folder.has('map.pmtiles.part')).toBe(false);
    expect(await state.readSaved()).toBeNull();
    /* the same bytes the extractor writes straight into memory */
    const parts: Uint8Array[] = [];
    await extract(server(), p.saved.region, { ...p.saved.opts, metadata: p.saved.meta, sink: { write: (b) => void parts.push(b.slice()) } });
    expect(Buffer.compare(Buffer.from(landed), Buffer.concat(parts))).toBe(0);
    expect((await pack.packInfo())?.bytes).toBe(p.saved.total);
  });

  it('REPLACES the pack on the phone completely — its photos with it', async () => {
    folder.set('map.pmtiles', Uint8Array.from(PHOTO_PACK));
    const { run, pack } = await app();
    const before = await pack.packInfo();
    expect(before?.photos?.count).toBeGreaterThan(0);
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    expect(p.hadPack).toBe(true);
    expect(p.photos).toBe(before!.photos!.count);
    const info = await run.build(p.saved, { source: p.source, signal: new AbortController().signal, ...quiet });
    expect(info.photos).toBeUndefined();
    expect(await pack.packPhotos()).toBeNull();
    expect(folder.get('map.pmtiles')!.length).toBe(p.saved.total);
  });
});

describe('build map for this trip · stopped and carried on', () => {
  it('Cancel keeps what is written and its checkpoint; Carry on finishes the same file; the old pack stood throughout', async () => {
    folder.set('map.pmtiles', Uint8Array.from(PHOTO_PACK));
    const { run, state } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const ctl = new AbortController();
    await expect(
      run.build(p.saved, {
        source: p.source,
        signal: ctl.signal,
        onProgress: (pct, step) => {
          if (step === 'tiles' && pct >= 20) ctl.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const s = await state.readSaved();
    expect(s?.bytes).toBeGreaterThan(0);
    expect(folder.get('map.pmtiles.part')!.length).toBeGreaterThanOrEqual(s!.bytes);
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.from(PHOTO_PACK))).toBe(0);
    expect(run.explain(new DOMException('stop', 'AbortError'), BUILD, true)).toBeNull();
    /* Carry on — a fresh source, pinned to the saved build and ETag */
    const src = server();
    await run.build(s!, { source: src, signal: new AbortController().signal, ...quiet });
    const direct = await app();
    const parts: Uint8Array[] = [];
    await direct.extract(server(), s!.region, { ...s!.opts, metadata: s!.meta, sink: { write: (b) => void parts.push(b.slice()) } });
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.concat(parts))).toBe(0);
  });

  it('the app killed mid-build and opened again: what was committed is kept, the rest is fetched, the file is the same', async () => {
    const first = await app();
    const planning = server();
    const p = await first.run.plan(TRIP, { source: () => planning, build: BUILD, tune: TUNE });
    expect(p.saved.total).toBeGreaterThan(0);
    const dying = server();
    /* the build reads the directories again (its own source), then the tiles: the server stops answering after
       the third tile chunk */
    dying.stall = planning.reads + 3;
    /* commits at every checkpoint (the phone's: every 8 MB) */
    void first.run.build(p.saved, { source: dying, signal: new AbortController().signal, commitBytes: 1, ...quiet });
    await vi.waitFor(async () => expect((await first.state.readSaved())?.bytes).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    /* …killed: only what a stream CLOSED is in the file; the saved checkpoint never claims more */
    const saved = (await first.state.readSaved())!;
    const kept = folder.get('map.pmtiles.part')!;
    expect(kept.length).toBeGreaterThanOrEqual(saved.bytes);
    expect(saved.bytes).toBeLessThan(saved.total);
    /* opened again */
    const again = await app();
    const s = await again.state.readSaved();
    expect(s?.bytes).toBe(saved.bytes);
    expect(await again.run.stillThere(s!)).toBe(true);
    const src = server();
    const info = await again.run.build(s!, { source: src, signal: new AbortController().signal, ...quiet });
    expect(info.trip).toBe('TEST — Israel 60');
    const parts: Uint8Array[] = [];
    await again.extract(server(), s!.region, { ...s!.opts, metadata: s!.meta, sink: { write: (b) => void parts.push(b.slice()) } });
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.concat(parts))).toBe(0);
    expect(await again.state.readSaved()).toBeNull();
  });

  it('a build gone from the server (404) or changed (412): the half-built file goes, the old pack stays, and it says so', async () => {
    folder.set('map.pmtiles', Uint8Array.from(PHOTO_PACK));
    const { run, state } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const ctl = new AbortController();
    await run
      .build(p.saved, { source: p.source, signal: ctl.signal, onProgress: (pct, st) => st === 'tiles' && pct >= 10 && ctl.abort() })
      .catch(() => {});
    const s = (await state.readSaved())!;
    expect(folder.has('map.pmtiles.part')).toBe(true);
    const gone: ByteSource = {
      id: s.url,
      getBytes: async () => {
        throw new SourceGone(404);
      },
    };
    const err = await run.build(s, { source: gone, signal: new AbortController().signal, ...quiet }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceGone);
    expect(run.explain(err, s.date, true)).toBe('The map build of 7 Nov 2026 is no longer on the server — start again with today’s.');
    expect(run.explain(new SourceGone(412), s.date, true)).toMatch(/changed since this build started/);
    expect(await state.readSaved()).toBeNull();
    expect(folder.has('map.pmtiles.part')).toBe(false);
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.from(PHOTO_PACK))).toBe(0);
  });

  it('a half-built file removed meanwhile (an import, Delete): said, and the build starts again', async () => {
    const { run, state } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const ctl = new AbortController();
    await run.build(p.saved, { source: p.source, signal: ctl.signal, onProgress: (pct, st) => st === 'tiles' && pct >= 10 && ctl.abort() }).catch(() => {});
    const s = (await state.readSaved())!;
    folder.delete('map.pmtiles.part');
    expect(await run.stillThere(s)).toBe(false);
    const err = await run.build(s, { source: server(), signal: new AbortController().signal, ...quiet }).catch((e: unknown) => e);
    expect(run.explain(err, s.date, false)).toBe('The half-built map was removed from this phone — start again.');
    expect(await state.readSaved()).toBeNull();
  });
});

describe('build map for this trip · how it writes (review, 7 Nov)', () => {
  it('in place where a worker can hold the file: no createWritable, and Cancel + Carry on still give the same bytes', async () => {
    workers();
    const { run, state, extract } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const ctl = new AbortController();
    await run
      .build(p.saved, { source: p.source, signal: ctl.signal, commitBytes: 64, onProgress: (pct, st) => st === 'tiles' && pct >= 30 && ctl.abort() })
      .catch(() => {});
    const s = (await state.readSaved())!;
    expect(s.bytes).toBeGreaterThan(0);
    await run.build(s, { source: server(), signal: new AbortController().signal, ...quiet });
    expect(opened.handles).toBe(2);
    expect(opened.streams).toBe(0);
    const parts: Uint8Array[] = [];
    await extract(server(), s.region, { ...s.opts, metadata: s.meta, sink: { write: (b) => void parts.push(b.slice()) } });
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.concat(parts))).toBe(0);
  });

  it('a worker with no sync access handle: the createWritable writer', async () => {
    workers(true);
    const { run } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    await run.build(p.saved, { source: p.source, signal: new AbortController().signal, ...quiet });
    expect(opened.handles).toBe(0);
    expect(opened.streams).toBeGreaterThan(0);
    expect(folder.get('map.pmtiles')!.length).toBe(p.saved.total);
  });

  it('where a commit copies the file (createWritable), the room check counts that copy too', async () => {
    const { run, pack } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    /* room for the pack once, not for the pack and its copy */
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir, estimate: async () => ({ quota: p.saved.total * 1.5, usage: 0 }), persist: async () => true } });
    const err = await run.build(p.saved, { source: p.source, signal: new AbortController().signal, ...quiet }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(pack.PackError);
    expect((err as InstanceType<typeof pack.PackError>).problem).toBe('noRoom');
    expect(folder.has('map.pmtiles')).toBe(false);
    /* written in place, the same room is enough */
    workers();
    const again = await app();
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir, estimate: async () => ({ quota: p.saved.total * 1.5, usage: 0 }), persist: async () => true } });
    await again.run.build(p.saved, { source: server(), signal: new AbortController().signal, ...quiet });
    expect(folder.get('map.pmtiles')!.length).toBe(p.saved.total);
  });

  it('a file that will not close after a failure: the saved checkpoint stays the last COMMITTED one, and Carry on works', async () => {
    const { run, state, extract } = await app();
    const p = await run.plan(TRIP, { source: () => server(), build: BUILD, tune: TUNE });
    const ctl = new AbortController();
    /* a commit about every quarter of the file; Cancel past half, and the close fails (nothing since the last commit lands) */
    await run
      .build(p.saved, {
        source: p.source,
        signal: ctl.signal,
        commitBytes: Math.floor(p.saved.total / 4),
        onProgress: (pct, st) => {
          if (st === 'tiles' && pct >= 60) {
            fail.close = true;
            ctl.abort();
          }
        },
      })
      .catch(() => {});
    fail.close = false;
    const s = (await state.readSaved())!;
    const part = folder.get('map.pmtiles.part')!;
    /* the state claims no byte the file does not hold — so carrying on does not throw the file away */
    expect(s.bytes).toBeGreaterThan(0);
    expect(part.length).toBeGreaterThanOrEqual(s.bytes);
    expect(await run.stillThere(s)).toBe(true);
    await run.build(s, { source: server(), signal: new AbortController().signal, ...quiet });
    const parts: Uint8Array[] = [];
    await extract(server(), s.region, { ...s.opts, metadata: s.meta, sink: { write: (b) => void parts.push(b.slice()) } });
    expect(Buffer.compare(Buffer.from(folder.get('map.pmtiles')!), Buffer.concat(parts))).toBe(0);
  });
});

describe('build map for this trip · the words', () => {
  it('says only what is true', async () => {
    const { run, pack } = await app();
    const offline = Object.assign(new Error('Unable to resolve host'), { net: true });
    expect(run.explain(offline, BUILD, true)).toBe('No connection to the map server — carry on when the phone is online.');
    expect(run.explain(new pack.PackError('noRoom', '52000000', true), BUILD, true)).toBe('Not enough room on this phone for the new map (52.0 MB free). Nothing changed.');
    expect(run.explain(new pack.PackError('busy', '', true), BUILD, true)).toMatch(/being copied/);
    expect(run.explain(new pack.PackError('incomplete', '', true), BUILD, true)).toBe('The new map did not check out — the map pack from before is still here.');
    expect(run.explain(new pack.PackError('incomplete', '', false), BUILD, false)).toBe('The map build did not finish — no map pack was saved.');
    expect(run.explain(new run.PlanError('x'), BUILD, true)).toBe('x');
  });

  it('a trip with no position anywhere has nothing to build', async () => {
    const { run } = await app();
    await expect(run.plan({ id: 'nowhere', title: 'Nowhere' }, { source: () => server(), build: BUILD })).rejects.toThrow(/nothing to build a map of/);
  });
});

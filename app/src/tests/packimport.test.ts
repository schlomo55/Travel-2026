/* THE MAP-PACK IMPORT, ONE AT A TIME, IN TRUE WORDS (Map 5d, lib/map/pack.ts
   + lib/map/packImport.svelte.ts) — the review's LOW finding 12. The swap ran
   outside the import's try, so a swap that failed after taking the old pack
   away still said "the old map pack is still here"; a pack swapped in that
   could not be read back said the same; and the busy flag was per control, so
   leaving the tab mid-copy and coming back allowed a second import at once.

   OPFS needs a browser, so it is a stand-in here: one folder of named byte
   arrays, whose remove, move and read can be made to fail. The pack is the
   committed test pack (and a copy of it with one byte of its tiles changed,
   so the old and the new can be told apart). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const A = new Uint8Array(readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles')));
const B = Uint8Array.from(A);
B[B.length - 1] = B[B.length - 1]! ^ 0xff; // the same header, other tiles
const file = (b: Uint8Array, name = 'china-2026-map.pmtiles'): File => new File([Uint8Array.from(b)], name, { lastModified: 1_790_000_000_000 });

const fail = { remove: 0, move: 0, readNew: false, writeCut: false, hold: null as Promise<void> | null };
let folder: Map<string, Uint8Array>;
let writes = 0;
let clock = 1_790_000_000_000;
const notFound = (): Error => Object.assign(new Error('not found'), { name: 'NotFoundError' });

class Handle {
  constructor(public name: string) {}
  async getFile(): Promise<File> {
    const b = folder.get(this.name);
    if (!b) throw notFound();
    if (fail.readNew && this.name === 'map.pmtiles' && b[b.length - 1] === B[B.length - 1]) throw new Error('NotReadableError');
    return new File([Uint8Array.from(b)], this.name, { lastModified: ++clock });
  }
  async createWritable(): Promise<WritableStream<Uint8Array>> {
    writes++;
    const chunks: Uint8Array[] = [];
    const name = this.name;
    return new WritableStream<Uint8Array>({
      write(c) {
        chunks.push(c);
        if (fail.writeCut) throw new Error('the copy stopped');
      },
      close() {
        const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
        let at = 0;
        for (const c of chunks) {
          out.set(c, at);
          at += c.byteLength;
        }
        folder.set(name, out);
      },
    });
  }
  async move(to: string): Promise<void> {
    /* the swap held at its start, once: the moment between the copy and its move */
    const hold = fail.hold;
    if (hold) {
      fail.hold = null;
      await hold;
    }
    if (fail.move > 0) {
      fail.move--;
      throw new Error('move failed');
    }
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
    if (fail.remove > 0 && name === 'map.pmtiles') {
      fail.remove--;
      throw new Error('NoModificationAllowedError');
    }
    if (!folder.delete(name)) throw notFound();
  },
};

async function load() {
  vi.resetModules();
  const pack = await import('../lib/map/pack');
  const imp = await import('../lib/map/packImport.svelte');
  return { ...pack, ...imp };
}

beforeEach(() => {
  folder = new Map();
  writes = 0;
  Object.assign(fail, { remove: 0, move: 0, readNew: false, writeCut: false, hold: null });
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => dir, estimate: async () => ({ quota: 1e10, usage: 0 }), persist: async () => true } });
});
afterEach(() => vi.unstubAllGlobals());

const lastByte = (): number | undefined => {
  const b = folder.get('map.pmtiles');
  return b ? b[b.length - 1] : undefined;
};

describe('one import at a time', () => {
  it('a second import while the first is copying is refused — and the first lands', async () => {
    const { importPack, PackError } = await load();
    const first = importPack(file(A));
    const second = importPack(file(B));
    await expect(second).rejects.toBeInstanceOf(PackError);
    await expect(second).rejects.toMatchObject({ problem: 'busy' });
    await expect(first).resolves.toMatchObject({ bytes: A.length });
    expect(lastByte()).toBe(A[A.length - 1]);
    expect(writes).toBe(1);
  });

  it('the app-wide importer: while one runs, another pick starts nothing, and every control sees the progress', async () => {
    const { packImporter } = await load();
    const run = packImporter.run(file(A));
    expect(packImporter.busy).toBe(true);
    await packImporter.run(file(B)); // a control mounted again mid-copy
    await run;
    expect(writes).toBe(1);
    expect(packImporter.busy).toBe(false);
    expect(packImporter.landed?.n).toBe(1);
    expect(packImporter.problem).toBeNull();
  });
});

describe('a screen opened mid-import does not race it', () => {
  it('the copy is whole and not yet moved in: the Map tab opening then leaves it to the import', async () => {
    const { importPack, packFile } = await load();
    let release!: () => void;
    fail.hold = new Promise<void>((r) => (release = r));
    const running = importPack(file(A));
    for (let i = 0; i < 50 && !(folder.has('map.pmtiles.part') && folder.get('map.pmtiles.part')!.length === A.length && fail.hold === null); i++) await new Promise((r) => setTimeout(r, 5));
    expect(folder.get('map.pmtiles.part')?.length).toBe(A.length); // copied, held before its move
    expect(await packFile()).toBeNull(); // the tab, opening now: no pack yet — and it moves nothing
    expect(folder.has('map.pmtiles.part')).toBe(true);
    release();
    await expect(running).resolves.toMatchObject({ bytes: A.length });
    expect(folder.has('map.pmtiles')).toBe(true);
  });
});

describe('what a failed import says is true', () => {
  it('the swap took the old pack away and could not move the new one in: it does NOT say the old one is still here', async () => {
    const { importPack, packFile, problemWords } = await load();
    await importPack(file(A));
    fail.move = 2; // the swap, and its one more try
    const err = await importPack(file(B)).catch((e: unknown) => e);
    expect(err).toMatchObject({ problem: 'notPlaced', kept: false });
    expect(problemWords(err)).not.toMatch(/still here/);
    expect(problemWords(err)).toMatch(/open the Map tab again/);
    expect(folder.has('map.pmtiles')).toBe(false);
    /* and the next open finishes it, as the words say */
    const f = await packFile();
    expect(f?.size).toBe(B.length);
    expect(lastByte()).toBe(B[B.length - 1]);
  });

  it('the old pack could not be taken away nor the new one moved over it: then it IS still here, and says so', async () => {
    const { importPack, problemWords } = await load();
    await importPack(file(A));
    fail.remove = 1;
    fail.move = 1;
    const err = await importPack(file(B)).catch((e: unknown) => e);
    expect(err).toMatchObject({ problem: 'failed', kept: true });
    expect(problemWords(err)).toMatch(/the old map pack is still here/);
    expect(lastByte()).toBe(A[A.length - 1]);
  });

  it('the new pack in place but unreadable: it says so, not that the old one stayed', async () => {
    const { importPack, problemWords } = await load();
    await importPack(file(A));
    fail.readNew = true;
    const err = await importPack(file(B)).catch((e: unknown) => e);
    expect(err).toMatchObject({ problem: 'unreadable', kept: false });
    expect(problemWords(err)).not.toMatch(/still here/);
  });

  it('a first import that fails claims no old pack; one with a pack before does', async () => {
    const { importPack, problemWords } = await load();
    fail.writeCut = true;
    const first = await importPack(file(A)).catch((e: unknown) => e);
    expect(first).toMatchObject({ kept: false });
    expect(problemWords(first)).not.toMatch(/old/);
    fail.writeCut = false;
    await importPack(file(A));
    fail.writeCut = true;
    const later = await importPack(file(B)).catch((e: unknown) => e);
    expect(later).toMatchObject({ kept: true });
    expect(problemWords(later)).toMatch(/still here/);
    expect(lastByte()).toBe(A[A.length - 1]);
  });

  it('refused before a byte is written: "nothing changed", with or without a pack before', async () => {
    const { importPack, problemWords } = await load();
    const json = new File([new TextEncoder().encode('{"trips":[]}'.padEnd(400, ' '))], 'trip.json');
    const err = await importPack(json).catch((e: unknown) => e);
    expect(err).toMatchObject({ problem: 'notAPack', kept: false });
    expect(problemWords(err)).toMatch(/Nothing changed/);
    expect(writes).toBe(0);
  });
});

/* THE PLACES' PHOTOS TRAVEL IN THE SAME FILE (Map 5e): a pack with photos is
   still one import, one swap; a copy cut short in its photos is refused as one
   cut short in its tiles; and a plain pack over it takes the photos away. */
const C = new Uint8Array(readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles')));

describe('a pack with the places’ photos', () => {
  it('imports into the one file, and its photos read back from the phone', async () => {
    const { importPack, packPhotos } = await load();
    await expect(importPack(file(C, 'china-2026-map-photos.pmtiles'))).resolves.toMatchObject({ bytes: C.length, photos: { count: 4 } });
    expect(folder.get('map.pmtiles')?.length).toBe(C.length);
    expect([...folder.keys()]).toEqual(['map.pmtiles']);
    const index = await packPhotos();
    expect(Object.values(index?.places ?? {}).filter((p) => p.photo).length).toBe(5); // the lakes' photo serves two places
  });

  it('cut short in its photos: refused before a byte is written, and the pack from before is kept', async () => {
    const { importPack, problemWords } = await load();
    await importPack(file(A));
    const before = writes;
    const err = await importPack(file(C.subarray(0, C.length - 1))).catch((e: unknown) => e);
    expect(err).toMatchObject({ problem: 'incomplete', kept: true });
    expect(problemWords(err)).toMatch(/still here/);
    expect(writes).toBe(before);
    expect(lastByte()).toBe(A[A.length - 1]);
  });

  it('a plain pack over it: the streets change, and the photos go with the old file', async () => {
    const { importPack, packPhotos } = await load();
    await importPack(file(C));
    expect(await packPhotos()).not.toBeNull();
    await importPack(file(A));
    expect(await packPhotos()).toBeNull();
  });
});

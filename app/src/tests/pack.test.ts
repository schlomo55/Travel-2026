/* THE MAP PACK'S CHECKS (Map 5c, lib/map/pack.ts) — what an import refuses
   before a byte is written, and what the app reads out of a pack's header and
   metadata. On the committed test pack and on broken copies of it. (The OPFS
   copy and swap need a browser; the rehearsal walks them in Chrome.) */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describePack, PackError, packSize, readHeader, readPhotos } from '../lib/map/pack';
import { photoCount, spanBytes } from '../lib/logic/placephotos';

const here = dirname(fileURLToPath(import.meta.url));
const bytes = readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles'));
const asFile = (b: Uint8Array, name = 'x.pmtiles'): File => new File([Uint8Array.from(b)], name, { lastModified: 1_790_000_000_000 });

async function problem(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'accepted';
  } catch (e) {
    return e instanceof PackError ? e.problem : `threw ${String(e)}`;
  }
}

describe('the map pack · reading and refusing', () => {
  it('reads the test pack: vector tiles, z11–13, round Houhai', async () => {
    const h = await readHeader(asFile(bytes));
    expect(h.minZoom).toBe(11);
    expect(h.maxZoom).toBe(13);
    expect(h.tileEntries).toBe(10);
    const [w, s, e, n] = h.bounds;
    expect(w).toBeCloseTo(116.345, 3);
    expect(s).toBeCloseTo(39.915, 3);
    expect(e).toBeCloseTo(116.425, 3);
    expect(n).toBeCloseTo(39.962, 3);
  });

  it('reads the metadata the app shows: which pack, and OpenStreetMap’s date', async () => {
    const info = await describePack(asFile(bytes));
    expect(info.name).toBe('houhai-test');
    expect(info.osmDate).toBe('2026-09-28');
    expect(info.bytes).toBe(bytes.length);
  });

  it('refuses a file that is not a map pack', async () => {
    expect(await problem(readHeader(asFile(new TextEncoder().encode('{"format":"livingthedream/backup","trips":[]}'.padEnd(400, ' ')), 'trip.json')))).toBe('notAPack');
    const v2 = Uint8Array.from(bytes);
    v2[7] = 2;
    expect(await problem(readHeader(asFile(v2)))).toBe('notAPack');
    const raster = Uint8Array.from(bytes);
    raster[99] = 2; // PNG tiles: nothing the night style can draw
    expect(await problem(readHeader(asFile(raster)))).toBe('notAPack');
  });

  it('refuses a file too small to hold a header', async () => {
    expect(await problem(readHeader(asFile(bytes.subarray(0, 50))))).toBe('tooSmall');
  });

  it('refuses a pack cut short — a download that stopped', async () => {
    expect(await problem(readHeader(asFile(bytes.subarray(0, Math.floor(bytes.length * 0.6)))))).toBe('incomplete');
    expect(await problem(readHeader(asFile(bytes.subarray(0, bytes.length - 1))))).toBe('incomplete');
    expect(await problem(readHeader(asFile(bytes)))).toBe('accepted');
  });

  it('says a size the way the owner reads it', () => {
    expect(packSize(54_169_147)).toBe('54.2 MB');
    expect(packSize(633_312)).toBe('633 KB');
  });
});

/* THE PLACES' PHOTOS, IN THE PACK (Map 5e) — the committed test pack with the
   rehearsal's tiny photo set (houhai-test-photos.pmtiles, built by
   `npm run map:pack -- --photos-only` from the plain test pack beside it):
   the archive first, then the photos, their index and the trailer. */
const withPhotos = readFileSync(join(here, '..', '..', 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles'));
const latin1 = (b: Uint8Array): string => String.fromCharCode(...b);

describe('the map pack · its photos (Map 5e)', () => {
  it('a pack from before Map 5e declares none, and imports as it always did', async () => {
    const f = asFile(bytes);
    const info = await describePack(f);
    expect(info.photos).toBeUndefined();
    expect(await readPhotos(f, info, info.photos)).toBeNull();
    expect(info.archiveEnd).toBe(bytes.length);
  });

  it('a pack with photos declares them, and is exactly the archive and what it declared', async () => {
    const f = asFile(withPhotos);
    const info = await describePack(f);
    expect(info.photos?.count).toBe(4);
    expect(info.bytes).toBe(info.archiveEnd + info.photos!.bytes);
    expect(latin1(withPhotos.subarray(withPhotos.length - 32, withPhotos.length - 24))).toBe('LTDPHOTO');
    /* the same streets: the tiles are the plain test pack's, byte for byte */
    const plain = await readHeader(asFile(bytes));
    expect(info.tileEntries).toBe(plain.tileEntries);
    expect(info.minZoom).toBe(plain.minZoom);
    expect(info.maxZoom).toBe(plain.maxZoom);
  });

  it('reads the index, and every image it names is a WebP inside the photo region', async () => {
    const f = asFile(withPhotos);
    const info = await describePack(f);
    const index = (await readPhotos(f, info, info.photos))!;
    expect(index.base).toBe(info.archiveEnd);
    expect(photoCount(index)).toBe(4);
    for (const p of Object.values(index.places)) {
      for (const s of p.photo ? [p.photo.card, p.photo.rail, p.photo.pin] : []) {
        const [a, b] = spanBytes(index, s);
        expect(a).toBeGreaterThanOrEqual(info.archiveEnd);
        expect(b).toBeLessThanOrEqual(withPhotos.length - 32);
        const head = withPhotos.subarray(a, a + 12);
        expect(latin1(head.subarray(0, 4))).toBe('RIFF');
        expect(latin1(head.subarray(8, 12))).toBe('WEBP');
      }
    }
  });

  it('refuses a pack whose photos are cut short, or whose trailer or index is broken', async () => {
    const check = async (b: Uint8Array): Promise<string> => {
      const f = asFile(b);
      try {
        const info = await describePack(f);
        await readPhotos(f, info, info.photos);
        return 'accepted';
      } catch (e) {
        return e instanceof PackError ? e.problem : `threw ${String(e)}`;
      }
    };
    expect(await check(withPhotos)).toBe('accepted');
    expect(await check(withPhotos.subarray(0, withPhotos.length - 1))).toBe('incomplete');
    const info = await describePack(asFile(withPhotos));
    expect(await check(withPhotos.subarray(0, info.archiveEnd))).toBe('incomplete');
    expect(await check(withPhotos.subarray(0, info.archiveEnd + Math.floor(info.photos!.bytes / 2)))).toBe('incomplete');
    const noMagic = Uint8Array.from(withPhotos);
    noMagic[noMagic.length - 32] = 0x58;
    expect(await check(noMagic)).toBe('incomplete');
    const badIndex = Uint8Array.from(withPhotos);
    const at = Number(new DataView(badIndex.buffer).getBigUint64(badIndex.length - 16, true));
    badIndex[info.archiveEnd + at] = 0x7a; // the index's first "{" is no longer JSON
    expect(await check(badIndex)).toBe('incomplete');
  });
});

/* THE MAP PACK'S CHECKS (Map 5c, lib/map/pack.ts) — what an import refuses
   before a byte is written, and what the app reads out of a pack's header and
   metadata. On the committed test pack and on broken copies of it. (The OPFS
   copy and swap need a browser; the rehearsal walks them in Chrome.) */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describePack, PackError, packSize, readHeader } from '../lib/map/pack';

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

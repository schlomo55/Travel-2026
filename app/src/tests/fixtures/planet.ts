/* A SYNTHETIC PLANET for the map builder's tests (extract.test.ts,
   mapbuild.test.ts): a clustered PMTiles v3 archive built here, z0–6, every
   tile — with what the real planet has and the committed test pack has not:
   leaf directories, run-length entries, and one "ocean" content shared by many
   tiles, stored where it first occurred, so later tiles point BACKWARDS. */
import { defaultCodec, idToZxy, serializeDir, serializeHeader, zxyToId, type Entry } from '../../lib/map/build/extract';

export const MAXZ = 6;

const concat = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** z0–6, every tile; "ocean" (a pattern) shares ONE content, so its later tiles point back to the first.
    `detail`: more zooms, to `to`, inside a [w, s, e, n] window — detailed where a test looks, as the real planet is. */
export function planetTiles(detail?: { bbox: [number, number, number, number]; to: number }): { id: number; data: Uint8Array }[] {
  const ocean = new TextEncoder().encode('ocean-ocean-ocean');
  const list: { id: number; data: Uint8Array }[] = [];
  const tx = (lng: number, z: number): number => Math.floor(((lng + 180) / 360) * 2 ** z);
  const ty = (lat: number, z: number): number => {
    const s = Math.sin((lat * Math.PI) / 180);
    return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z);
  };
  for (let z = 0; z <= Math.max(MAXZ, detail?.to ?? 0); z++) {
    const all = z <= MAXZ;
    const [x0, x1, y0, y1] = all || !detail ? [0, 2 ** z - 1, 0, 2 ** z - 1] : [tx(detail.bbox[0], z), tx(detail.bbox[2], z), ty(detail.bbox[3], z), ty(detail.bbox[1], z)];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
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
export async function makeArchive(tiles: { id: number; data: Uint8Array }[], leafSize: number): Promise<Uint8Array> {
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
    maxZoom: Math.max(...tiles.map((t) => idToZxy(t.id)[0])),
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


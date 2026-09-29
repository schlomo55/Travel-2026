/* THE MAP PACK ON THIS PHONE (Map 5c) — one .pmtiles file of street data,
   imported once through the file picker and kept in the Origin Private File
   System. The map reads it back as a File, one slice per tile (pmtiles'
   FileSource): no tile ever travels over HTTP, so nothing depends on how a
   local server answers Range requests (the spike's finding — Capacitor's
   does not), and the app never goes online for maps.

   IMPORT IS A SWAP, NEVER AN OVERWRITE. The chosen file is checked first —
   the PMTiles v3 magic bytes, vector tiles, and a header whose sections all
   lie inside the file, so a half-downloaded pack is refused before a byte is
   written — then copied BESIDE the pack already here (`.part`), checked
   again, and only then moved into its place. A failed or interrupted import
   leaves the old pack exactly as it was. (A copy interrupted after the old
   pack was removed but before the move leaves a complete `.part`, which the
   next open finishes moving.)

   The picker is a plain <input type=file> with NO accept filter: the
   Capacitor chooser builds its Android intent from the first accepted MIME
   type, and `.pmtiles` has none — an accept list crashes it (spike, code
   reading). The magic bytes are the filter.

   Storage persistence is asked for after a pack lands (the same request the
   vault makes): OPFS is best-effort storage, like IndexedDB — a re-import is
   the recovery, a minute at home on Wi-Fi.

   Small on purpose: Settings and the Map tab's empty state use it without
   loading the map engine. */

const DIR = 'mappacks';
const NAME = 'map.pmtiles';
const PART = `${NAME}.part`;
/** A PMTiles v3 header is 127 bytes. */
const HEADER = 127;

export type PackProblem = 'notAPack' | 'tooSmall' | 'incomplete' | 'noRoom' | 'noOpfs' | 'failed';
export class PackError extends Error {
  constructor(
    readonly problem: PackProblem,
    readonly detail = '',
  ) {
    super(`${problem}${detail ? `: ${detail}` : ''}`);
  }
}

export interface PackHeader {
  minZoom: number;
  maxZoom: number;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  center: [number, number];
  centerZoom: number;
  tileEntries: number;
  metadataOffset: number;
  metadataLength: number;
  internalCompression: number;
}

export interface PackInfo extends PackHeader {
  bytes: number;
  /** when the copy on this phone was written */
  savedAt: number;
  /** from the pack's own metadata, when it says */
  name?: string;
  trip?: string;
  /** OpenStreetMap's date, YYYY-MM-DD */
  osmDate?: string;
  built?: string;
  areas?: string[];
}

/** Does this browser keep files in the Origin Private File System? */
export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.getDirectory === 'function';
}

async function dir(create = false): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create });
}

const u64 = (v: DataView, at: number): number => Number(v.getBigUint64(at, true));

/** Read and check a PMTiles v3 header; throw a PackError naming what is wrong. */
export async function readHeader(file: Blob): Promise<PackHeader> {
  if (file.size < HEADER) throw new PackError('tooSmall');
  const buf = await file.slice(0, HEADER).arrayBuffer();
  const b = new Uint8Array(buf);
  const magic = String.fromCharCode(...b.slice(0, 7));
  if (magic !== 'PMTiles' || b[7] !== 3) throw new PackError('notAPack');
  const v = new DataView(buf);
  const rootOffset = u64(v, 8);
  const rootLength = u64(v, 16);
  const metadataOffset = u64(v, 24);
  const metadataLength = u64(v, 32);
  const leafOffset = u64(v, 40);
  const leafLength = u64(v, 48);
  const dataOffset = u64(v, 56);
  const dataLength = u64(v, 64);
  /* vector tiles (1 = MVT) — the only kind the night style can draw */
  if (b[99] !== 1) throw new PackError('notAPack', 'not vector tiles');
  for (const [off, len] of [
    [rootOffset, rootLength],
    [metadataOffset, metadataLength],
    [leafOffset, leafLength],
    [dataOffset, dataLength],
  ] as const) {
    if (!Number.isSafeInteger(off) || !Number.isSafeInteger(len) || off + len > file.size) throw new PackError('incomplete');
  }
  if (rootLength === 0 || dataLength === 0) throw new PackError('incomplete');
  const e7 = (at: number): number => v.getInt32(at, true) / 1e7;
  return {
    minZoom: b[100] ?? 0,
    maxZoom: b[101] ?? 0,
    bounds: [e7(102), e7(106), e7(110), e7(114)],
    centerZoom: b[118] ?? 0,
    center: [e7(119), e7(123)],
    tileEntries: u64(v, 80),
    metadataOffset,
    metadataLength,
    internalCompression: b[97] ?? 0,
  };
}

/** The pack's JSON metadata, the few fields the app shows. */
async function readMeta(file: Blob, h: PackHeader): Promise<Pick<PackInfo, 'name' | 'trip' | 'osmDate' | 'built' | 'areas'>> {
  try {
    if (!h.metadataLength || h.metadataLength > 4 * 1024 * 1024) return {};
    let blob = file.slice(h.metadataOffset, h.metadataOffset + h.metadataLength);
    if (h.internalCompression === 2) {
      if (typeof DecompressionStream === 'undefined') return {};
      blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
    } else if (h.internalCompression !== 1 && h.internalCompression !== 0) return {};
    const m = JSON.parse(await blob.text()) as Record<string, unknown>;
    const str = (k: string): string | undefined => (typeof m[k] === 'string' ? (m[k] as string) : undefined);
    const osm = str('planetiler:osm:osmosisreplicationtime')?.slice(0, 10);
    const areas = Array.isArray(m['ltd:areas']) ? (m['ltd:areas'] as unknown[]).filter((x): x is string => typeof x === 'string') : undefined;
    return {
      ...(str('ltd:pack') ? { name: str('ltd:pack') } : {}),
      ...(str('ltd:trip') ? { trip: str('ltd:trip') } : {}),
      ...(osm && /^\d{4}-\d{2}-\d{2}$/.test(osm) ? { osmDate: osm } : {}),
      ...(str('ltd:built') ? { built: str('ltd:built') } : {}),
      ...(areas?.length ? { areas } : {}),
    };
  } catch {
    return {};
  }
}

/** The pack as a File, or null when none is on this phone. Finishes a swap an
    interrupted import left half done (a complete `.part`, no pack). */
export async function packFile(): Promise<File | null> {
  if (!opfsSupported()) return null;
  let d: FileSystemDirectoryHandle;
  try {
    d = await dir();
  } catch {
    return null;
  }
  try {
    return await (await d.getFileHandle(NAME)).getFile();
  } catch {
    /* no pack — perhaps a finished copy waiting to be moved in */
  }
  try {
    const part = await d.getFileHandle(PART);
    const f = await part.getFile();
    await readHeader(f);
    await swapIn(d, part);
    return await (await d.getFileHandle(NAME)).getFile();
  } catch {
    return null;
  }
}

let cached: { key: string; info: PackInfo } | null = null;

/** What the pack on this phone is, or null. */
export async function packInfo(): Promise<PackInfo | null> {
  const f = await packFile();
  if (!f) return null;
  const key = `${f.size}:${f.lastModified}`;
  if (cached?.key === key) return cached.info;
  try {
    const info = await describePack(f);
    cached = { key, info };
    return info;
  } catch {
    return null;
  }
}

/** What a pack file is: its header, its metadata's few fields, its size. */
export async function describePack(f: File): Promise<PackInfo> {
  const h = await readHeader(f);
  return { ...h, ...(await readMeta(f, h)), bytes: f.size, savedAt: f.lastModified };
}

/** Move a checked `.part` into the pack's place. */
async function swapIn(d: FileSystemDirectoryHandle, part: FileSystemFileHandle): Promise<void> {
  const movable = part as FileSystemFileHandle & { move?: (name: string) => Promise<void> };
  if (typeof movable.move === 'function') {
    try {
      await d.removeEntry(NAME);
    } catch {
      /* the first import */
    }
    await movable.move(NAME);
    return;
  }
  /* no move(): copy the checked part over the pack (one more pass), then drop it */
  const f = await part.getFile();
  const w = await (await d.getFileHandle(NAME, { create: true })).createWritable({ keepExistingData: false });
  await f.stream().pipeTo(w);
  await d.removeEntry(PART);
}

/** Write a Blob into a file handle: createWritable where the WebView has it,
    else a worker's synchronous access handle (older OPFS). */
async function write(part: FileSystemFileHandle, file: File, onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  const count = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      done += chunk.byteLength;
      onProgress?.(done, file.size);
      ctl.enqueue(chunk);
    },
  });
  const writable = part as FileSystemFileHandle & { createWritable?: FileSystemFileHandle['createWritable'] };
  if (typeof writable.createWritable === 'function') {
    const w = await writable.createWritable({ keepExistingData: false });
    await file.stream().pipeThrough(count).pipeTo(w);
    return;
  }
  await writeInWorker(file);
  onProgress?.(file.size, file.size);
}

/** The fallback writer (the spike's): OPFS written through a sync access handle, in a worker. */
function writeInWorker(file: File): Promise<void> {
  const src = `onmessage = async (e) => {
    try {
      const root = await navigator.storage.getDirectory();
      const d = await root.getDirectoryHandle('${DIR}', { create: true });
      const h = await d.getFileHandle('${PART}', { create: true });
      const a = await h.createSyncAccessHandle(); a.truncate(0);
      const r = e.data.stream().getReader(); let at = 0;
      for (;;) { const { done, value } = await r.read(); if (done) break; a.write(value, { at }); at += value.byteLength; }
      a.flush(); a.close(); postMessage('ok');
    } catch (err) { postMessage('error: ' + (err && err.message || err)); }
  };`;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  return new Promise((res, rej) => {
    const w = new Worker(url);
    const end = (): void => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
    w.onmessage = (e: MessageEvent<string>) => {
      end();
      if (e.data === 'ok') res();
      else rej(new PackError('failed', e.data));
    };
    w.onerror = (e) => {
      end();
      rej(new PackError('failed', e.message));
    };
    w.postMessage(file);
  });
}

/**
 * Import a map pack: check it, copy it beside the old one, check the copy,
 * swap it in, ask for persistent storage. Resolves with the new pack's info;
 * rejects with a PackError, the old pack untouched.
 */
export async function importPack(file: File, onProgress?: (done: number, total: number) => void): Promise<PackInfo> {
  if (!opfsSupported()) throw new PackError('noOpfs');
  await readHeader(file);
  /* room for the copy while the old pack still stands */
  try {
    const e = await navigator.storage.estimate();
    if (e.quota != null && e.usage != null && e.quota - e.usage < file.size * 1.02) throw new PackError('noRoom', String(Math.max(0, e.quota - e.usage)));
  } catch (err) {
    if (err instanceof PackError) throw err;
  }
  let d: FileSystemDirectoryHandle;
  try {
    d = await dir(true);
  } catch {
    throw new PackError('noOpfs');
  }
  try {
    await d.removeEntry(PART);
  } catch {
    /* no stale copy */
  }
  const part = await d.getFileHandle(PART, { create: true });
  try {
    await write(part, file, onProgress);
    const copy = await part.getFile();
    if (copy.size !== file.size) throw new PackError('incomplete');
    await readHeader(copy);
  } catch (err) {
    try {
      await d.removeEntry(PART);
    } catch {
      /* nothing to clean */
    }
    if (err instanceof PackError) throw err;
    const name = (err as { name?: string })?.name;
    if (name === 'QuotaExceededError') throw new PackError('noRoom', '0');
    throw new PackError('failed', String((err as Error)?.message ?? err));
  }
  await swapIn(d, part);
  cached = null;
  try {
    await navigator.storage.persist?.();
  } catch {
    /* not offered here */
  }
  const info = await packInfo();
  if (!info) throw new PackError('failed', 'the pack could not be read back');
  return info;
}

/** Remove the pack from this phone (and any unfinished copy). */
export async function removePack(): Promise<void> {
  if (!opfsSupported()) return;
  cached = null;
  try {
    const d = await dir();
    for (const n of [NAME, PART]) {
      try {
        await d.removeEntry(n);
      } catch {
        /* not there */
      }
    }
  } catch {
    /* no folder */
  }
}

/** "54.2 MB" — the size the owner sees. */
export function packSize(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

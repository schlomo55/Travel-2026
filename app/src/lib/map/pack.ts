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
   WHOLE, and only then moved into its place. A failed or interrupted import
   leaves the old pack exactly as it was. (A copy interrupted after the old
   pack was removed but before the move leaves a complete `.part`, which the
   next open finishes moving.)

   THE PICKED FILE IS READ ONLY FROM ITS START, IN ORDER (Map 5f). On the
   phone a file picked from Google Drive — one not kept offline — can be a
   content STREAM that cannot seek: its first bytes and then the rest, once.
   So the picked file gives only its 127-byte header (as Map 5d read it) and
   one sequential copy; its metadata, its photo index and its trailer — deep
   in the file — are read from the SAVED copy in OPFS, which can seek, before
   the copy is swapped in. A copy that fails that whole check is deleted and
   the pack from before is kept ("did not copy completely — the old one is
   still here").

   The picker is a plain <input type=file> with NO accept filter: the
   Capacitor chooser builds its Android intent from the first accepted MIME
   type, and `.pmtiles` has none — an accept list crashes it (spike, code
   reading). The magic bytes are the filter.

   Storage persistence is asked for after a pack lands (the same request the
   vault makes): OPFS is best-effort storage, like IndexedDB — a re-import is
   the recovery, a minute at home on Wi-Fi.

   ONE IMPORT AT A TIME, AND ITS WORDS ARE TRUE (Map 5d). A second import while
   one is copying is refused ('busy') — the screens' busy flag was per
   control, so leaving the tab mid-copy and coming back offered the picker
   again. And a failure says what is really left on the phone: `kept` — the
   pack from before is still there (false on a first import, and once the swap
   has taken the old one away); 'notPlaced' — the copy is whole but not yet in
   place, which the next open finishes; 'unreadable' — the new pack is in
   place and cannot be read back.

   THE PLACES' PHOTOS TRAVEL IN THE SAME FILE (Map 5e). A pack built since
   Map 5e is the PMTiles archive, unchanged, and then — past the archive's last
   section, where a PMTiles reader never looks — the photos (WebP), their index
   (JSON, keyed by place id: lib/logic/placephotos.ts) and a 32-byte trailer
   ("LTDPHOTO", a version, where the index is). The archive's own metadata
   declares the photos (`ltd:photos`: how many, how many bytes follow), so a
   download cut short in its photos is refused like one cut short in its tiles,
   and the one file is still one swap. A pack from before Map 5e declares none:
   it imports exactly as it always did, with no photos. The map reads the
   tiles from the same File as ever — the photos only make it longer.

   Small on purpose: Settings and the Map tab's empty state use it without
   loading the map engine. */
import { parseIndex, PHOTO_MAGIC, PHOTO_TRAILER, PHOTO_VERSION, type PhotoIndex } from '../logic/placephotos';

const DIR = 'mappacks';
const NAME = 'map.pmtiles';
const PART = `${NAME}.part`;
/** A PMTiles v3 header is 127 bytes. */
const HEADER = 127;

export type PackProblem = 'notAPack' | 'tooSmall' | 'incomplete' | 'noRoom' | 'noOpfs' | 'failed' | 'busy' | 'notPlaced' | 'unreadable';
export class PackError extends Error {
  constructor(
    readonly problem: PackProblem,
    readonly detail = '',
    /** a pack from before this import is still on the phone, as it was */
    readonly kept = false,
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
  /** where the archive's last section ends — a pack with photos goes on past it */
  archiveEnd: number;
}

/** The photos a pack declares it carries (its metadata's `ltd:photos`). */
export interface PackPhotos {
  count: number;
  /** every byte after the archive: the photos, their index, the trailer */
  bytes: number;
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
  /** the places' photos, when the pack carries them (Map 5e) */
  photos?: PackPhotos;
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
    archiveEnd: Math.max(HEADER, rootOffset + rootLength, metadataOffset + metadataLength, leafOffset + leafLength, dataOffset + dataLength),
  };
}

/** The photos a pack's metadata declares — only a whole, sane declaration counts. */
function declared(m: Record<string, unknown>): PackPhotos | undefined {
  const d = m['ltd:photos'] as { v?: unknown; count?: unknown; bytes?: unknown } | undefined;
  if (!d || typeof d !== 'object' || d.v !== PHOTO_VERSION) return undefined;
  const ok = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
  return ok(d.count) && ok(d.bytes) && d.bytes > PHOTO_TRAILER ? { count: d.count, bytes: d.bytes } : undefined;
}

/** The pack's JSON metadata, the few fields the app shows. */
async function readMeta(file: Blob, h: PackHeader): Promise<Pick<PackInfo, 'name' | 'trip' | 'osmDate' | 'built' | 'areas' | 'photos'>> {
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
    const photos = declared(m);
    return {
      ...(str('ltd:pack') ? { name: str('ltd:pack') } : {}),
      ...(str('ltd:trip') ? { trip: str('ltd:trip') } : {}),
      ...(osm && /^\d{4}-\d{2}-\d{2}$/.test(osm) ? { osmDate: osm } : {}),
      ...(str('ltd:built') ? { built: str('ltd:built') } : {}),
      ...(areas?.length ? { areas } : {}),
      ...(photos ? { photos } : {}),
    };
  } catch {
    return {};
  }
}

/** Where a pack's photo index is, from its trailer — counted from `base`,
    where the photo region starts — or null when it has none. */
async function trailer(file: Blob, base: number): Promise<{ at: number; len: number } | null> {
  if (file.size < base + PHOTO_TRAILER) return null;
  const buf = await file.slice(file.size - PHOTO_TRAILER, file.size).arrayBuffer();
  const b = new Uint8Array(buf);
  if (String.fromCharCode(...b.slice(0, 8)) !== PHOTO_MAGIC) return null;
  const v = new DataView(buf);
  if (v.getUint32(8, true) !== PHOTO_VERSION) return null;
  const at = u64(v, 16);
  const len = u64(v, 24);
  if (!Number.isSafeInteger(at) || !Number.isSafeInteger(len) || len <= 0 || base + at + len !== file.size - PHOTO_TRAILER) return null;
  return { at, len };
}

/**
 * THE PHOTOS A PACK DECLARES, CHECKED: the file is exactly the archive plus
 * the bytes its metadata says follow, it ends in the trailer, and the index
 * the trailer points at reads — else the pack is incomplete (a download cut
 * short), refused before a byte is written. A pack that declares none has
 * none: null. Every image the index names must lie in the photo region.
 */
export async function readPhotos(file: Blob, h: PackHeader, photos: PackPhotos | undefined): Promise<PhotoIndex | null> {
  if (!photos) return null;
  if (file.size !== h.archiveEnd + photos.bytes) throw new PackError('incomplete', 'the photos are cut short');
  const t = await trailer(file, h.archiveEnd);
  if (!t) throw new PackError('incomplete', 'no photo index');
  let json: unknown;
  try {
    json = JSON.parse(await file.slice(h.archiveEnd + t.at, h.archiveEnd + t.at + t.len).text());
  } catch {
    throw new PackError('incomplete', 'the photo index does not read');
  }
  const index = parseIndex(json, t.at, h.archiveEnd);
  if (!index) throw new PackError('incomplete', 'the photo index does not read');
  return index;
}

let indexCache: { key: string; index: PhotoIndex | null } | null = null;

/** The photo index of the pack on this phone (null: no pack, or one without
    photos). Read once per pack and kept. */
export async function packPhotos(file?: File | null): Promise<PhotoIndex | null> {
  const f = file === undefined ? await packFile() : file;
  if (!f) return null;
  const key = `${f.size}:${f.lastModified}`;
  if (indexCache?.key === key) return indexCache.index;
  let index: PhotoIndex | null = null;
  try {
    const info = await describePack(f);
    index = await readPhotos(f, info, info.photos);
  } catch {
    index = null;
  }
  indexCache = { key, index };
  return index;
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
  /* …unless an import is under way: that copy is its own, and it moves it in
     itself (a screen opened mid-import must not race it — Map 5d) */
  if (running || !(await finishSwap(d))) return null;
  try {
    return await (await d.getFileHandle(NAME)).getFile();
  } catch {
    return null;
  }
}

/** A whole copy waiting where no pack is: move it in. True once it is in place. */
async function finishSwap(d: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const part = await d.getFileHandle(PART);
    await checkWhole(await part.getFile());
    await swapIn(d, part);
    return true;
  } catch {
    return false;
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

/** The whole file checked: its archive, and the photos it declares (Map 5e). */
async function checkWhole(f: Blob): Promise<void> {
  const h = await readHeader(f);
  await readPhotos(f, h, (await readMeta(f, h)).photos);
}

/** Is there a file of this name in the folder? */
async function has(d: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await d.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
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

let running = false;

/** Is an import copying now (from any screen)? */
export const importing = (): boolean => running;

/**
 * Import a map pack: check it, copy it beside the old one, check the copy,
 * swap it in, ask for persistent storage. Resolves with the new pack's info;
 * rejects with a PackError that says what is left on the phone (`kept`).
 * One at a time: a second call while one runs is refused ('busy').
 */
export async function importPack(file: File, onProgress?: (done: number, total: number) => void): Promise<PackInfo> {
  if (running) throw new PackError('busy', '', true);
  running = true;
  try {
    return await importOne(file, onProgress);
  } finally {
    running = false;
  }
}

async function importOne(file: File, onProgress?: (done: number, total: number) => void): Promise<PackInfo> {
  if (!opfsSupported()) throw new PackError('noOpfs');
  /* was there a (readable) pack before? — what "nothing changed" leaves on the phone */
  const before = (await packInfo()) !== null;
  /* the picked file: its header only — its first 127 bytes, the one read a stream that cannot seek gives before
     the copy (Map 5f; the whole file is checked on the saved copy, below) */
  try {
    await readHeader(file);
  } catch (err) {
    if (err instanceof PackError) throw new PackError(err.problem, err.detail, before);
    throw err;
  }
  /* room for the copy while the old pack still stands */
  try {
    const e = await navigator.storage.estimate();
    if (e.quota != null && e.usage != null && e.quota - e.usage < file.size * 1.02) throw new PackError('noRoom', String(Math.max(0, e.quota - e.usage)), before);
  } catch (err) {
    if (err instanceof PackError) throw err;
  }
  let d: FileSystemDirectoryHandle;
  try {
    d = await dir(true);
  } catch {
    throw new PackError('noOpfs', '', before);
  }
  try {
    await d.removeEntry(PART);
  } catch {
    /* no stale copy */
  }
  const part = await d.getFileHandle(PART, { create: true });
  try {
    /* one sequential pass over the picked file… */
    await write(part, file, onProgress);
    const copy = await part.getFile();
    if (copy.size !== file.size) throw new PackError('incomplete');
    /* …and the whole of it checked on the copy, which can seek: its archive, its metadata, the photos it declares,
       their trailer and index (Map 5f: 5e read those deep offsets of the picked file) */
    await checkWhole(copy);
  } catch (err) {
    try {
      await d.removeEntry(PART);
    } catch {
      /* nothing to clean */
    }
    if (err instanceof PackError) throw new PackError(err.problem, err.detail, before);
    const name = (err as { name?: string })?.name;
    if (name === 'QuotaExceededError') throw new PackError('noRoom', '0', before);
    throw new PackError('failed', String((err as Error)?.message ?? err), before);
  }
  /* THE SWAP. Until the old pack is removed a failure leaves it as it was; after,
     the copy is whole and waiting beside it — the next open moves it in
     (packFile), and so does one more try here, now. */
  try {
    await swapIn(d, part);
  } catch (err) {
    cached = null;
    if (await has(d, NAME)) throw new PackError('failed', String((err as Error)?.message ?? err), before);
    if (!(await finishSwap(d))) throw new PackError('notPlaced', String((err as Error)?.message ?? err), false);
  }
  cached = null;
  try {
    await navigator.storage.persist?.();
  } catch {
    /* not offered here */
  }
  const info = await packInfo();
  if (!info) throw new PackError('unreadable', 'the pack could not be read back', false);
  return info;
}

/** Remove the pack from this phone (and any unfinished copy). */
export async function removePack(): Promise<void> {
  if (!opfsSupported()) return;
  cached = null;
  indexCache = null;
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

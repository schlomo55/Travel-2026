/* Import/export envelope handling (docs/ARCHITECTURE.md §7).
   Documents travel as base64 inside the JSON; gzip via native CompressionStream
   keeps that affordable. Import accepts plain .json too — the China seed ships
   readable in the repo. */
import type { DocumentFile, Id, AppBackup, TripBundle } from '../model/types';
import { saveFile } from '../platform/files';

export const BACKUP_FORMAT = 'livingthedream/backup';
/** The app was called Sojourn before. Files exported then still restore. */
const ACCEPTED_FORMATS = new Set([BACKUP_FORMAT, 'sojourn/backup']);

export function isBackup(o: unknown): o is AppBackup {
  if (typeof o !== 'object' || o === null) return false;
  const b = o as AppBackup;
  return ACCEPTED_FORMATS.has(b.format) && b.formatVersion === 1 && Array.isArray(b.trips);
}

/** Tolerate seeds/backups that predate a later-added collection. */
export function normalizeBundle(raw: Partial<TripBundle>): TripBundle {
  if (!raw.trip) throw new Error('Trip file has no trip record');
  return {
    trip: raw.trip,
    counters: raw.counters ?? [],
    stops: raw.stops ?? [],
    dayPlans: raw.dayPlans ?? [],
    dayDefaults: raw.dayDefaults ?? [],
    runbooks: raw.runbooks ?? [],
    bookings: raw.bookings ?? [],
    walletCards: raw.walletCards ?? [],
    tasks: raw.tasks ?? [],
    alarms: raw.alarms ?? [],
    packingItems: raw.packingItems ?? [],
    checklists: raw.checklists ?? [],
    expenses: raw.expenses ?? [],
    categories: raw.categories ?? [],
    showCards: raw.showCards ?? [],
    emergency: raw.emergency ?? [],
    infoCards: raw.infoCards ?? [],
    ...(raw.note ? { note: raw.note } : {}),
    checkState: raw.checkState ?? [],
    documents: raw.documents ?? [],
  };
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000; // avoid arg-limit blowups on big PDFs
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

/** Blobs for every document in a bundle, keyed by document id. */
export function bundleBlobs(bundle: TripBundle): Map<Id, Blob> {
  const out = new Map<Id, Blob>();
  for (const d of bundle.documents) {
    if (d.dataBase64) out.set(d.meta.id, base64ToBlob(d.dataBase64, d.meta.mime));
  }
  return out;
}

/** Parse text that may be a full backup or a single bare trip bundle. */
export function parseBackupText(text: string): AppBackup {
  const o: unknown = JSON.parse(text);
  if (isBackup(o)) {
    return { ...o, trips: o.trips.map((t) => normalizeBundle(t as Partial<TripBundle>)) };
  }
  if (typeof o === 'object' && o !== null && 'trip' in o) {
    return {
      format: BACKUP_FORMAT,
      formatVersion: 1,
      kind: 'trip',
      exportedAt: new Date().toISOString(),
      appVersion: 'unknown',
      trips: [normalizeBundle(o as Partial<TripBundle>)],
    };
  }
  throw new Error('This file is not a Living the dream backup or trip file');
}

/** Read a File that may be gzipped (.gz) or plain JSON. */
export async function readBackupFile(file: File): Promise<AppBackup> {
  const gz = file.name.endsWith('.gz') || file.type === 'application/gzip';
  let text: string;
  if (gz && 'DecompressionStream' in globalThis) {
    const ds = new DecompressionStream('gzip');
    text = await new Response(file.stream().pipeThrough(ds)).text();
  } else {
    text = await file.text();
  }
  return parseBackupText(text);
}

export async function gzipText(text: string): Promise<Blob> {
  if (!('CompressionStream' in globalThis)) return new Blob([text], { type: 'application/json' });
  const cs = new CompressionStream('gzip');
  const stream = new Blob([text]).stream().pipeThrough(cs);
  return new Response(stream).blob();
}

export function summarizeBundle(b: TripBundle): string {
  const bits: string[] = [];
  const push = (n: number, one: string, many = one + 's') => {
    if (n > 0) bits.push(`${n} ${n === 1 ? one : many}`);
  };
  push(b.stops.length, 'stop');
  push(b.dayPlans.length, 'day');
  push(b.bookings.length, 'booking');
  push(b.tasks.length, 'task');
  push(b.packingItems.length, 'packing item');
  push(b.showCards.length, 'card');
  push(b.documents.length, 'document');
  return bits.join(' · ');
}

/** Hand a generated file to the user. On the web this downloads; inside the
    Android app it opens the share sheet — see lib/platform/files.ts. */
export function downloadBlob(name: string, blob: Blob): void {
  void saveFile(name, blob);
}

export function documentIcon(d: Pick<DocumentFile, 'mime'>): string {
  if (d.mime.startsWith('image/')) return '🖼️';
  if (d.mime === 'application/pdf') return '📄';
  return '📎';
}

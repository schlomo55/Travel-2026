/* The documents vault: real files kept on the phone, openable at a counter with
   no signal. Metadata and blobs live in separate tables so listing documents
   never deserializes megabytes. */
import { db } from '../db/db';
import { mutate } from './repo';
import { newId } from '../model/ids';
import { offerUndo } from '../state/undo.svelte';
import type { DocumentFile, DocumentTag, Id } from '../model/types';

/** Warn above this per file; nothing is blocked, the user is told. */
export const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export function guessTag(file: File): DocumentTag {
  const n = file.name.toLowerCase();
  if (/insur|policy|assur/.test(n)) return 'insurance';
  if (/passport|visa|id/.test(n)) return 'passport';
  if (/ticket|boarding|flight|booking|itiner/.test(n)) return 'ticket';
  return 'other';
}

export async function addDocument(
  file: File,
  tripId: Id,
  link?: { bookingId?: Id; walletCardId?: Id },
): Promise<DocumentFile> {
  const meta: DocumentFile = {
    id: newId(),
    tripId,
    ...(link?.bookingId ? { bookingId: link.bookingId } : {}),
    ...(link?.walletCardId ? { walletCardId: link.walletCardId } : {}),
    name: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    tag: guessTag(file),
    addedAt: Date.now(),
  };
  await mutate(async () => {
    await db.documents.put(meta);
    await db.documentBlobs.put({ id: meta.id, blob: file });
  });
  return meta;
}

export async function renameDocument(id: Id, name: string): Promise<void> {
  await mutate(async () => {
    await db.documents.update(id, { name });
  });
}

export async function deleteDocument(doc: DocumentFile): Promise<void> {
  const blob = await db.documentBlobs.get(doc.id);
  await mutate(async () => {
    await db.documents.delete(doc.id);
    await db.documentBlobs.delete(doc.id);
  });
  offerUndo({
    label: 'Document deleted',
    undo: () =>
      mutate(async () => {
        await db.documents.put(doc);
        if (blob) await db.documentBlobs.put(blob);
      }),
  });
}

export async function openDocument(id: Id): Promise<string | null> {
  const rec = await db.documentBlobs.get(id);
  if (!rec) return null;
  return URL.createObjectURL(rec.blob);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

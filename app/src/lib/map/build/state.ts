/* A MAP BUILD'S RESUME STATE (7 Nov 2026) — one row of Dexie's `meta`
   (`map.build`; `meta` is never exported, so a backup never carries it). What
   is pinned in it is everything that decides the plan, so a build carried on
   after a cut connection or a restart writes exactly the file it started:
   the Protomaps build (its date, URL and ETag), the region, the `ltd:`
   metadata, the plan's key — and how far the `.part` on this phone is good
   (`item`, `bytes`: the last checkpoint written AND committed to storage).

   Small on purpose: Settings and the Map tab read it to say "stopped at 45 %"
   without loading the extractor (lib/map/build/run.ts). */
import { db } from '../../db/db';
import type { Region } from '../region';

const KEY = 'map.build';

export interface Saved {
  v: 1;
  tripId: string;
  title: string;
  /** the Protomaps daily build, YYYYMMDD */
  date: string;
  url: string;
  etag: string;
  region: Region;
  meta: Record<string, unknown>;
  areas: string[];
  planKey: string;
  /** the extract's options the plan was made with (a resume uses these, whatever a later version's defaults) */
  opts: { maxzoom: number; overfetch: number; maxChunk: number; concurrency: number };
  /** the photos the pack being replaced carries for this trip, copied after the new archive (phase 2, 8 Nov
      2026): where they start in that pack, how many bytes, and that pack's size (it must be the same file) */
  carry?: { from: number; bytes: number; size: number };
  /** the new pack's size */
  total: number;
  /** the extractor's checkpoint: the first range not yet written, and the file's good length */
  item: number;
  bytes: number;
}

const isSaved = (v: unknown): v is Saved => {
  const s = v as Partial<Saved> | undefined;
  return !!s && s.v === 1 && typeof s.url === 'string' && typeof s.planKey === 'string' && Number.isSafeInteger(s.bytes) && Number.isSafeInteger(s.total) && !!s.region && !!s.opts;
};

/** The build under way or paused, or null. */
export async function readSaved(): Promise<Saved | null> {
  try {
    const v = (await db.meta.get(KEY))?.value;
    return isSaved(v) ? v : null;
  } catch {
    return null;
  }
}
export async function writeSaved(s: Saved): Promise<void> {
  await db.meta.put({ key: KEY, value: s });
}
export async function clearSaved(): Promise<void> {
  await db.meta.delete(KEY);
}
/** how far a saved build is, 0–100 */
export const savedPct = (s: Saved): number => (s.total ? Math.min(99, Math.floor((s.bytes / s.total) * 100)) : 0);

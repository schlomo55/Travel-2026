/* BUILD MAP FOR THIS TRIP (7 Nov 2026) — the work behind the button, loaded
   only when it is tapped (a chunk of its own with the extractor and the
   native source; Settings and the Map tab carry only the button,
   lib/map/build/builder.svelte.ts).

   1. PLAN. The trip's region (lib/map/region.ts — the one rule the workshop's
      `npm run map:pack` uses, every stop with at least ±25 km), the newest
      Protomaps daily build (builds.json), and the extractor's dry run against
      it: the header and the directories the region touches (a few MB — kept,
      so the build does not read them twice), and from them the new pack's
      exact size. Nothing is written yet; the owner sees the size and that the
      new pack REPLACES the one on the phone, photos and all.
   2. BUILD. Into the importer's own `.part` (lib/map/pack.ts), holding its
      one-at-a-time lock: room checked first, persistent storage asked for,
      then the tiles streamed in order. Wi-Fi or mobile data, no difference
      (the owner's call).
   3. LAND. The `.part` checked whole and swapped in by the importer's own code
      (landPart): a build that fails the check, or never finishes, leaves the
      pack from before exactly as it was. The new pack has no place photos.

   RESUME. Every COMMIT_BYTES the `.part` is committed to storage and the
   checkpoint saved (build/state.ts) — in that order, so the saved state never
   claims bytes the phone does not hold. Cancel, a lost connection or the app
   killed: the next "Carry on" cuts the `.part` back to the checkpoint and the
   extractor writes only the rest, against the SAME build (URL + ETag pinned).
   Gone from the server (404/410) or changed (412), or a plan that no longer
   matches: said plainly, the half-built file dropped, start again.

   TWO WRITERS, as the importer has: createWritable where the WebView has it
   (its writes land only when the stream closes, so a commit is close +
   reopen), else a worker's synchronous access handle (writes in place, a
   commit is flush). Both behind a 1 MB buffer: the extractor hands over many
   small ranges. */
import { db } from '../../db/db';
import { fmtLong, ymd } from '../../logic/dates';
import { SB } from '../../i18n/mapbuild';
import { hasPack, holdPack, landPart, PACK_DIR, PACK_PART, PackError, packInfo, packSize, partFile, partHandle, removePart, type PackInfo } from '../pack';
import { areasOf, packName, regionOf } from '../region';
import { extract, type ByteSource, type Checkpoint } from './extract';
import { buildUrl, latestBuild, nativeSource } from './source';
import { clearSaved, writeSaved, type Saved } from './state';

/** the extract: z0–15 (the API's and the daily builds'), ≤ 5 % wasted on gaps, ≤ 2 MB a request (base64 through the bridge), six at once */
export const OPTS = { maxzoom: 15, overfetch: 0.05, maxChunk: 2 << 20, concurrency: 6 } as const;
/** a committed checkpoint at least this often: what a killed app loses at most */
const COMMIT_BYTES = 8 << 20;
const BUF = 1 << 20;

export interface Planned {
  saved: Saved;
  /** the dry run's source, its directory reads kept for the build */
  source: ByteSource;
  /** the pack on the phone now: is there one, and how many photos it carries (the confirm's warning) */
  hadPack: boolean;
  photos: number;
}

/** A source that keeps what it reads while `keep` is on, and gives each kept answer back once. */
function memo(s: ByteSource): ByteSource & { keep: boolean } {
  const m = new Map<string, Uint8Array>();
  return {
    keep: true,
    get id() {
      return s.id;
    },
    async getBytes(o, l) {
      const k = `${o}:${l}`;
      const hit = m.get(k);
      if (hit) {
        m.delete(k);
        return hit;
      }
      const b = await s.getBytes(o, l);
      if (this.keep) m.set(k, b);
      return b;
    },
  };
}

/** the build is gone from the server or changed (extract.ts SourceGone: 404, 410, 412) — read by its fields, not its class */
const gone = (e: unknown): number | null => {
  const g = e as { fatal?: unknown; status?: unknown } | null;
  return g?.fatal === true && typeof g.status === 'number' ? g.status : null;
};
/** an error of the network, not of the phone (explain() says "no connection" for it) */
const net = (e: unknown): Error => Object.assign(e instanceof Error ? e : new Error(String(e)), { net: true });

/** A source whose failures are marked as the network's, and whose reads end the moment `signal` aborts (Cancel
    answers at once: a native request cannot be stopped, its answer is dropped). */
function guarded(s: ByteSource, signal?: AbortSignal): ByteSource {
  return {
    get id() {
      return s.id;
    },
    getBytes: (o, l) =>
      new Promise<Uint8Array>((res, rej) => {
        if (signal?.aborted) return rej(signal.reason);
        const stop = (): void => rej(signal?.reason);
        signal?.addEventListener('abort', stop, { once: true });
        s.getBytes(o, l)
          .then(res, (e) => rej(net(e)))
          .finally(() => signal?.removeEventListener('abort', stop));
      }),
  };
}

/** 1 · THE PLAN: the region, the newest build, the dry run. Writes nothing. */
export async function plan(
  trip: { id: string; title: string },
  opts: { signal?: AbortSignal; source?: (url: string) => ByteSource & { etag: string }; build?: string; tune?: Partial<Saved['opts']> } = {},
): Promise<Planned> {
  const xo = { ...OPTS, ...opts.tune };
  const [stops, showCards, bookings, dayPlans, dayDefaults] = await Promise.all([
    db.stops.where('tripId').equals(trip.id).toArray(),
    db.showCards.where('tripId').equals(trip.id).toArray(),
    db.bookings.where('tripId').equals(trip.id).toArray(),
    db.dayPlans.where('tripId').equals(trip.id).toArray(),
    db.dayDefaults.where('tripId').equals(trip.id).toArray(),
  ]);
  const { areas, boxes } = areasOf({ tripId: trip.id, stops, showCards, bookings, dayPlans, dayDefaults });
  if (!boxes.length) throw new PlanError(SB.noPlaces);
  const region = regionOf(boxes);
  const date: string =
    opts.build ??
    (await latestBuild().catch((e: unknown) => {
      throw net(e);
    }));
  const url = buildUrl(date);
  const inner = opts.source ? opts.source(url) : nativeSource(url);
  const source = memo(inner);
  const meta = {
    'ltd:pack': packName(trip.title),
    'ltd:trip': trip.title,
    'ltd:built': ymd(new Date()),
    'ltd:source': `Protomaps daily build ${date} · OpenStreetMap`,
    'ltd:areas': areas.map((a) => a.name),
    'ltd:maxzoom': xo.maxzoom,
  };
  const st = await extract(guarded(source, opts.signal), region, { ...xo, metadata: meta, dryRun: true, ...(opts.signal ? { signal: opts.signal } : {}) });
  source.keep = false;
  const now = await packInfo();
  return {
    saved: { v: 1, tripId: trip.id, title: trip.title, date, url, etag: inner.etag, region, meta, areas: meta['ltd:areas'], planKey: st.planKey!, opts: xo, total: st.outputBytes!, item: 0, bytes: 0 },
    source,
    hadPack: !!now,
    photos: now?.photos?.count ?? 0,
  };
}

/** A plan that cannot be made, in the words to say. */
export class PlanError extends Error {}

interface Writer {
  write(b: Uint8Array): Promise<void>;
  /** everything written so far, on storage */
  commit(): Promise<void>;
  close(): Promise<void>;
}

/** The two writers behind one 1 MB buffer. */
function buffered(put: (b: Uint8Array) => Promise<void>, durable: () => Promise<void>, end: () => Promise<void>): Writer {
  const buf = new Uint8Array(BUF);
  let n = 0;
  const drain = async (): Promise<void> => {
    if (!n) return;
    const b = buf.slice(0, n);
    n = 0;
    await put(b);
  };
  return {
    async write(b) {
      if (n + b.length > BUF) await drain();
      if (b.length >= BUF) await put(b.slice());
      else {
        buf.set(b, n);
        n += b.length;
      }
    },
    async commit() {
      await drain();
      await durable();
    },
    async close() {
      await drain();
      await end();
    },
  };
}

/** The `.part`, cut back to `at` and open for writing from there. */
async function openWriter(at: number): Promise<Writer> {
  const h = (await partHandle()) as FileSystemFileHandle & { createWritable?: FileSystemFileHandle['createWritable'] };
  if (typeof h.createWritable === 'function') {
    const open = async (keep: boolean, pos: number): Promise<FileSystemWritableFileStream> => {
      const w = await h.createWritable!({ keepExistingData: keep });
      await w.truncate(pos);
      await w.seek(pos);
      return w;
    };
    let pos = at;
    let w = await open(at > 0, at);
    return buffered(
      async (b) => {
        await w.write(b as Uint8Array<ArrayBuffer>);
        pos += b.length;
      },
      async () => {
        await w.close();
        w = await open(true, pos);
      },
      () => w.close(),
    );
  }
  return workerWriter(at);
}

/** The fallback writer (older OPFS): a worker holding the `.part`'s synchronous access handle. */
async function workerWriter(at: number): Promise<Writer> {
  const src = `let a,at=0;onmessage=async(e)=>{const[op,x]=e.data;try{
    if(op==='open'){const d=await(await navigator.storage.getDirectory()).getDirectoryHandle('${PACK_DIR}',{create:true});
      a=await(await d.getFileHandle('${PACK_PART}',{create:true})).createSyncAccessHandle();a.truncate(x);at=x;}
    else if(op==='write'){at+=a.write(x,{at});}else if(op==='flush'){a.flush();}else{a.flush();a.close();}
    postMessage('ok');}catch(err){postMessage('error: '+(err&&err.message||err));}};`;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const w = new Worker(url);
  const waiting: { res: () => void; rej: (e: Error) => void }[] = [];
  w.onmessage = (e: MessageEvent<string>) => {
    const p = waiting.shift();
    if (e.data === 'ok') p?.res();
    else p?.rej(new PackError('failed', e.data));
  };
  w.onerror = (e) => {
    for (const p of waiting.splice(0)) p.rej(new PackError('failed', e.message));
  };
  const call = (op: string, x?: unknown, transfer: Transferable[] = []): Promise<void> =>
    new Promise((res, rej) => {
      waiting.push({ res, rej });
      w.postMessage([op, x], transfer);
    });
  const end = (): void => {
    w.terminate();
    URL.revokeObjectURL(url);
  };
  try {
    await call('open', at);
  } catch (err) {
    end();
    throw err;
  }
  return buffered(
    (b) => call('write', b, [b.buffer]),
    () => call('flush'),
    async () => {
      try {
        await call('close');
      } finally {
        end();
      }
    },
  );
}

/** The build stopped for good: its state and its half-built file go. */
export async function forget(): Promise<void> {
  await clearSaved();
  await removePart();
}

/** Is the `.part` a saved build counts on still on the phone, at least as long as its checkpoint? */
export async function stillThere(s: Saved): Promise<boolean> {
  if (s.bytes === 0) return true;
  const f = await partFile();
  return !!f && f.size >= s.bytes;
}

/**
 * 2 + 3 · BUILD AND LAND: write the pack `s` plans (from its checkpoint, if it
 * has one) into the `.part`, then land it. Resolves with the new pack's info.
 * Rejects as the failure is: the saved state kept (Cancel, no connection, no
 * room) or dropped with the file (gone, changed, did not check out).
 */
export async function build(
  s: Saved,
  opts: { source?: ByteSource; signal: AbortSignal; onProgress(pct: number, step: 'index' | 'tiles' | 'check'): void; commitBytes?: number },
): Promise<PackInfo> {
  const release = holdPack();
  if (!release) throw new PackError('busy', '', true);
  try {
    const before = await hasPack();
    if (!(await stillThere(s))) {
      await forget();
      throw new PlanError(SB.partGone);
    }
    const at = s.bytes;
    /* room for the rest while the old pack still stands */
    try {
      const e = await navigator.storage.estimate();
      if (e.quota != null && e.usage != null && e.quota - e.usage < (s.total - at) * 1.02) throw new PackError('noRoom', String(Math.max(0, e.quota - e.usage)), before);
    } catch (err) {
      if (err instanceof PackError) throw err;
    }
    try {
      await navigator.storage.persist?.();
    } catch {
      /* not offered here */
    }
    await writeSaved(s);
    const w = await openWriter(at);
    let last: Checkpoint | null = at > 0 ? { planKey: s.planKey, item: s.item, bytes: at } : null;
    let committed = at;
    const keep = (c: Checkpoint): Promise<void> => writeSaved({ ...s, item: c.item, bytes: c.bytes });
    opts.onProgress(Math.floor((at / s.total) * 100), 'index');
    try {
      await extract(guarded(opts.source ?? nativeSource(s.url, s.etag), opts.signal), s.region, {
        ...s.opts,
        metadata: s.meta,
        sink: w,
        signal: opts.signal,
        ...(last ? { resume: last } : {}),
        onProgress: (p) => p.phase === 'tiles' && opts.onProgress(Math.min(99, Math.floor((p.done / p.total) * 100)), 'tiles'),
        onCheckpoint: async (c) => {
          last = c;
          if (c.bytes - committed < (opts.commitBytes ?? COMMIT_BYTES)) return;
          await w.commit();
          committed = c.bytes;
          await keep(c);
        },
      });
      await w.close();
    } catch (err) {
      /* what was written stays; the saved checkpoint says how much of it is good */
      await w.close().catch(() => {});
      const cp = last as Checkpoint | null;
      if (cp) await keep(cp);
      if (gone(err) !== null || /plan changed/.test(String((err as Error)?.message))) await forget();
      throw err;
    }
    opts.onProgress(100, 'check');
    try {
      return await landPart(before);
    } finally {
      /* landed, or failed its check (and landPart removed the copy): either way this build is over */
      await clearSaved();
    }
  } finally {
    release();
  }
}

/** What a failed plan or build says (null: nothing to say — the owner cancelled). Whether it can be carried on is
    whether its saved state is still there (build/state.ts): build() drops it when it cannot. */
export function explain(err: unknown, date: string | null, before: boolean): string | null {
  const name = (err as { name?: string })?.name;
  if (name === 'AbortError') return null;
  if (err instanceof PlanError) return err.message;
  const status = gone(err);
  if (status !== null) return status === 412 ? SB.changed : SB.gone(date ? fmtLong(buildDate(date)) : '');
  if (/plan changed/.test(String((err as Error)?.message))) return SB.changed;
  if (name === 'QuotaExceededError') return SB.noRoom(packSize(0));
  if (err instanceof PackError) {
    switch (err.problem) {
      case 'noRoom':
        return SB.noRoom(packSize(Number(err.detail) || 0));
      case 'noOpfs':
        return SB.noOpfs;
      case 'busy':
        return SB.busy;
      case 'incomplete':
      case 'notAPack':
      case 'tooSmall':
        return err.kept ? SB.invalid : SB.failedNone;
      default:
        return err.kept || before ? SB.failed : SB.failedNone;
    }
  }
  if ((err as { net?: boolean })?.net) return SB.noConnection;
  return before ? SB.failed : SB.failedNone;
}

/** "20261107" → "2026-11-07" */
export const buildDate = (d: string): string => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

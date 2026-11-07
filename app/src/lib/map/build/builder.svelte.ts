/* "BUILD MAP FOR THIS TRIP", ONE FOR THE WHOLE APP (7 Nov 2026) — started
   from Settings or the Map tab's empty state, it is one job, like the import
   (lib/map/packImport.svelte.ts): its phase, its words and the pack it lands
   live here, so leaving the screen mid-build and coming back shows the build
   still under way, and whichever screen is open when it lands takes the new
   pack up.

     idle ── Build ──▶ planning ──▶ confirm ── Build it ──▶ running ──▶ idle (landed)
                          │            └─ Not now ─▶ idle        │
                          └─ cannot plan: words ─▶ idle          ├─ Cancel / no connection ─▶ paused ─ Carry on ─▶ running
                                                                 └─ gone / changed / bad file: words ─▶ idle
   A build left paused — this session, or before the app was closed — is found
   in its saved state (build/state.ts) the first time a screen shows the
   button, and offered again: Carry on, or Discard.

   The work itself (the extractor, the native HTTP) is a chunk loaded on the
   first tap: lib/map/build/run.ts. */
import { readSaved, savedPct } from './state';
import { hasPack, partFile, type PackInfo } from '../pack';
import { toast } from '../../state/toast.svelte';
import { SB } from '../../i18n/mapbuild';

type Work = typeof import('./run');
let work: Promise<Work> | null = null;
const load = (): Promise<Work> => (work ??= import('./run'));

/** What the confirm sheet shows. */
export interface PlanView {
  title: string;
  /** the new pack's size on the phone */
  bytes: number;
  /** what is left to download (the tile data asked for, its few % of gaps included) */
  download: number;
  areas: string[];
  /** the Protomaps build, YYYYMMDD */
  date: string;
  /** a pack on the phone now, and its photos: what the new one replaces */
  hadPack: boolean;
  photos: number;
  /** of those, the ones the new map carries over (phase 2) */
  carried: number;
}

class MapBuilder {
  phase = $state<'idle' | 'planning' | 'confirm' | 'running' | 'paused'>('idle');
  /** how far the build is, 0–100, and what it is doing */
  pct = $state(0);
  step = $state<'index' | 'tiles' | 'check'>('index');
  /** the trip the build under way or paused is for — said with it, whatever trip is on screen */
  title = $state('');
  /** why the last plan or build stopped — cleared when the next one starts */
  problem = $state<string | null>(null);
  view = $state.raw<PlanView | null>(null);
  /** the last pack a build landed, numbered, so a control mounted later knows it is new */
  landed = $state<{ n: number; info: PackInfo } | null>(null);
  #plan: Awaited<ReturnType<Work['plan']>> | null = null;
  #ctl: AbortController | null = null;
  #looked = false;

  get busy(): boolean {
    return this.phase === 'planning' || this.phase === 'running';
  }

  /** A build left paused (before a restart, too): offered again. Once per session. */
  async look(): Promise<void> {
    if (this.#looked || this.phase !== 'idle') return;
    this.#looked = true;
    const s = await readSaved();
    if (!s || this.phase !== 'idle') return;
    const f = s.bytes ? await partFile() : null;
    if (s.bytes && (!f || f.size < s.bytes)) {
      await (await load()).forget();
      this.problem = SB.partGone;
      return;
    }
    this.pct = savedPct(s);
    this.title = s.title;
    this.phase = 'paused';
  }

  /** 1 · plan the trip's map and ask */
  async start(trip: { id: string; title: string }): Promise<void> {
    if (this.busy || this.phase === 'confirm') return;
    this.problem = null;
    this.phase = 'planning';
    this.title = trip.title;
    const ctl = new AbortController();
    this.#ctl = ctl;
    try {
      const w = await load();
      const p = await w.plan(trip, { signal: ctl.signal });
      this.#plan = p;
      this.view = { title: trip.title, bytes: p.saved.total, download: p.download, areas: p.saved.areas, date: p.saved.date, hadPack: p.hadPack, photos: p.photos, carried: p.carried };
      this.phase = 'confirm';
    } catch (err) {
      /* a plan writes nothing: what it says of the pack is only what is on the phone */
      this.problem = (await load()).explain(err, null, await hasPack());
      this.phase = 'idle';
    } finally {
      this.#ctl = null;
    }
  }

  /** "Not now": the plan goes, nothing was written */
  dismiss(): void {
    if (this.phase !== 'confirm') return;
    this.#plan = null;
    this.view = null;
    this.phase = 'idle';
  }

  /** 2 · "Build it" */
  async confirm(): Promise<void> {
    const p = this.#plan;
    if (!p || this.phase !== 'confirm') return;
    this.#plan = null;
    this.view = null;
    await this.#run((w, o) => w.build(p.saved, { ...o, source: p.source }), p.saved.date, p.hadPack);
  }

  /** "Carry on" a paused build */
  async resume(): Promise<void> {
    if (this.phase !== 'paused') return;
    const s = await readSaved();
    if (!s) {
      this.phase = 'idle';
      return;
    }
    this.title = s.title;
    await this.#run((w, o) => w.build(s, o), s.date, true);
  }

  cancel(): void {
    this.#ctl?.abort();
  }

  /** "Discard" a paused build: its state and its half-built file */
  async discard(): Promise<void> {
    if (this.phase !== 'paused') return;
    await (await load()).forget();
    this.problem = null;
    this.pct = 0;
    this.phase = 'idle';
  }

  async #run(go: (w: Work, o: Parameters<Work['build']>[1]) => Promise<PackInfo>, date: string, before: boolean): Promise<void> {
    this.problem = null;
    this.phase = 'running';
    this.step = 'index';
    const ctl = new AbortController();
    this.#ctl = ctl;
    const w = await load();
    try {
      const info = await go(w, {
        signal: ctl.signal,
        onProgress: (pct, step) => {
          this.pct = pct;
          this.step = step;
        },
      });
      toast.show(SB.ready);
      this.landed = { n: (this.landed?.n ?? 0) + 1, info };
      this.pct = 0;
      this.phase = 'idle';
    } catch (err) {
      this.problem = w.explain(err, date, before);
      /* carried on later only if its state is still saved (build() drops it when it cannot be) */
      const s = await readSaved();
      this.pct = s ? savedPct(s) : 0;
      this.phase = s ? 'paused' : 'idle';
    } finally {
      this.#ctl = null;
    }
  }
}

export const mapBuilder = new MapBuilder();

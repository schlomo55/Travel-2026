<script lang="ts">
  import { db } from '../lib/db/db';
  import { deleteTripCascade, mutate, updateSettings, upsertTripBundle } from '../lib/data/repo';
  import { bundleBlobs, parseBackupText, readBackupFile, summarizeBundle } from '../lib/logic/backup';
  import { extractLegacyData } from '../lib/logic/legacyImport';
  import { importLegacyBackup, LEGACY_TRIP_ID } from '../lib/data/legacy';
  import { fmtShort, fmtLong } from '../lib/logic/dates';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';
  import type { AppBackup, TripBundle } from '../lib/model/types';

  let staged = $state<AppBackup | null>(null);
  let existingIds = $state<Set<string>>(new Set());
  let legacy = $state<{ raw: unknown; summary: string } | null>(null);
  let pasteText = $state('');
  let err = $state('');
  let busy = $state(false);

  async function stage(backup: AppBackup): Promise<void> {
    err = '';
    const ids = new Set<string>();
    for (const b of backup.trips) {
      if (await db.trips.get(b.trip.id)) ids.add(b.trip.id);
    }
    existingIds = ids;
    staged = backup;
  }

  /** Try the Living the dream envelope first, then the old China app's formats. */
  async function readAny(text: string): Promise<void> {
    try {
      await stage(parseBackupText(text));
      return;
    } catch (envelopeErr) {
      const raw: unknown = JSON.parse(text);
      const data = extractLegacyData(raw);
      if (!data) throw envelopeErr;
      const target = await db.trips.get(LEGACY_TRIP_ID);
      if (!target) {
        err = S.importer.legacyNeedsTrip;
        return;
      }
      const n = Array.isArray(data['expenses.v1'])
        ? (data['expenses.v1'] as unknown[]).length
        : typeof data['expenses.v1'] === 'string'
          ? ((JSON.parse(data['expenses.v1'] as string) as unknown[]) ?? []).length
          : 0;
      legacy = { raw, summary: `${n} expense${n === 1 ? '' : 's'} plus ticks and notes → ${target.title}` };
      err = '';
    }
  }

  async function onFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.gz')) await stage(await readBackupFile(file));
      else await readAny(await file.text());
    } catch (ex) {
      err = ex instanceof Error ? ex.message : S.importer.unreadable;
    }
  }

  function onPaste(): void {
    void readAny(pasteText).catch((ex: unknown) => {
      err = ex instanceof Error ? ex.message : S.importer.unparseable;
    });
  }

  async function applyLegacy(): Promise<void> {
    if (!legacy || busy) return;
    busy = true;
    try {
      const result = await importLegacyBackup(legacy.raw, LEGACY_TRIP_ID);
      if (!result) {
        err = S.importer.nothingMatched;
        busy = false;
        return;
      }
      toast.show(
        `Restored ${result.expenses} expenses · ${result.ticks} ticks${result.unmatched ? ` · ${result.unmatched} unmatched` : ''}`,
        undefined,
        7000,
      );
      router.closeTopLayer();
      router.goTab(LEGACY_TRIP_ID, 'wallet');
    } catch (ex) {
      err = ex instanceof Error ? ex.message : S.importer.failed;
      busy = false;
    }
  }

  async function apply(): Promise<void> {
    if (!staged || busy) return;
    busy = true;
    try {
      /* $state deep-proxies objects, and IndexedDB cannot structured-clone a
         Proxy — snapshot back to plain data before any write. */
      const payload = $state.snapshot(staged) as AppBackup;
      let last = '';
      for (const bundle of payload.trips as TripBundle[]) {
        /* Replacing a trip: clear it first so records dropped from the file
           don't linger as orphans. */
        if (existingIds.has(bundle.trip.id)) await deleteTripCascade(bundle.trip.id);
        await mutate(() => upsertTripBundle(bundle, bundleBlobs(bundle)));
        last = bundle.trip.id;
      }
      if (payload.packingTemplates?.length) {
        await db.packingTemplates.bulkPut(payload.packingTemplates);
      }
      if (last) await updateSettings({ activeTripId: last });
      toast.show(S.importer.imported(payload.trips.length));
      router.closeTopLayer();
      if (last) router.goTab(last, 'today');
    } catch (ex) {
      err = ex instanceof Error ? ex.message : S.importer.failed;
      busy = false;
    }
  }
</script>

{#if legacy}
  <div class="preview">
    <section class="card lit">
      <h3>{S.importer.legacyTitle}</h3>
      <p class="lead">{legacy.summary}</p>
      <p class="small" style="margin:0">{S.importer.legacyBody}</p>
    </section>
    <div class="acts">
      <button class="btn ghost" style="flex:1" onclick={() => (legacy = null)} disabled={busy}>{S.importer.back}</button>
      <button class="btn primary" style="flex:2" onclick={applyLegacy} disabled={busy}>
        {busy ? S.importer.restoring : S.importer.restore}
      </button>
    </div>
  </div>
{:else if !staged}
  <p class="muted" style="margin:0 0 16px">{S.importer.intro}</p>

  <label class="filebtn">
    <input type="file" accept=".json,.gz,application/json,application/gzip" onchange={onFile} />
    <span>📂 {S.importer.choose}</span>
  </label>

  <details class="paste">
    <summary class="pastesum">{S.importer.orPaste}</summary>
    <textarea bind:value={pasteText} rows="5" placeholder={S.importer.pastePh}></textarea>
    <button class="btn wfull" style="margin-top:9px" onclick={onPaste} disabled={!pasteText.trim()}>
      {S.importer.readPaste}
    </button>
  </details>
{:else}
  <div class="preview">
    {#each staged.trips as b (b.trip.id)}
      <article class="card lit tripcard" style="--h:{b.trip.accentHue}">
        <span class="hue" aria-hidden="true"></span>
        <div class="ttlrow">
          <h3 class="tname">{b.trip.emoji ? `${b.trip.emoji} ` : ''}{b.trip.title}</h3>
          {#if existingIds.has(b.trip.id)}<span class="chip warn">{S.importer.replaces}</span>{/if}
        </div>
        <div class="small mono dates">{fmtShort(b.trip.start)} → {fmtLong(b.trip.end)}</div>
        <div class="muted" style="margin-top:7px">{summarizeBundle(b)}</div>
      </article>
    {/each}

    {#if existingIds.size > 0}
      <div class="card warn">
        <h3>⚠️ {S.importer.replaceWarn}</h3>
        <div class="muted">{S.importer.replaceWarnBody}</div>
      </div>
    {/if}

    <div class="acts">
      <button class="btn ghost" style="flex:1" onclick={() => (staged = null)} disabled={busy}>{S.importer.back}</button>
      <button class="btn primary" style="flex:2" onclick={apply} disabled={busy}>
        {busy ? S.importer.importing : existingIds.size ? S.importer.replaceImport : S.importer.import}
      </button>
    </div>
  </div>
{/if}

{#if err}<div class="err" role="alert">{err}</div>{/if}

<style>
  /* The file button is a label wrapping a real <input type=file> — the
     rehearsal drives the import through `.filebtn input[type=file]`, so this
     shape is load-bearing, not decorative. */
  .filebtn {
    display: block;
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-sm);
  }
  .filebtn input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0;
    cursor: pointer;
  }
  .filebtn span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    background: var(--btn-fill);
    color: var(--on-accent);
    border-radius: var(--radius-sm);
    padding: 15px;
    min-height: 52px;
    font-size: var(--text-md);
    font-weight: 700;
    box-shadow: var(--glow-2);
  }
  .paste {
    margin-top: 18px;
  }
  .pastesum {
    display: flex;
    align-items: center;
    min-height: 44px;
    font-size: 12.5px;
    font-weight: 650;
    letter-spacing: 0.4px;
    color: var(--gold-deep);
    cursor: pointer;
  }
  textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
  .lead {
    margin: 0 0 8px;
    font-size: 14.5px;
    color: var(--ink);
  }
  .preview {
    display: flex;
    flex-direction: column;
  }
  .tripcard {
    overflow: hidden;
  }
  /* the trip's own hue, as the identity badge it is allowed to be */
  .hue {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--stop);
  }
  .ttlrow {
    display: flex;
    align-items: baseline;
    gap: 9px;
    flex-wrap: wrap;
  }
  .tname {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0;
    color: var(--ink);
  }
  .dates {
    margin-top: 4px;
  }
  .acts {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .err {
    color: var(--crit);
    font-size: 13.5px;
    font-weight: 650;
    background: var(--crit-bg);
    border: 1px solid color-mix(in srgb, var(--crit) 45%, var(--line));
    border-radius: var(--radius-sm);
    padding: 11px 13px;
    margin-top: 14px;
  }
</style>

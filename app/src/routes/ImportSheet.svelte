<script lang="ts">
  /* THE IMPORT SHEET — a trip file, a Living the dream backup, or a backup
     from the old China app. Whatever arrives is STAGED and shown (what is in
     it, what it would replace) before a single record is written. */
  import { db } from '../lib/db/db';
  import { deleteTripCascade, mutate, updateSettings, upsertTripBundle } from '../lib/data/repo';
  import { bundleBlobs, parseBackupText, readBackupFile, summarizeBundle } from '../lib/logic/backup';
  import { extractLegacyData } from '../lib/logic/legacyImport';
  import { importLegacyBackup, LEGACY_TRIP_ID } from '../lib/data/legacy';
  import { fmtShort, fmtLong } from '../lib/logic/dates';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import type { AppBackup, TripBundle } from '../lib/model/types';

  interface Props {
    /** A copy that arrived some other way than the file picker — today, one
        downloaded from Drive. It goes through the SAME staging and the same
        preview: where the bytes came from must not change how carefully they
        are shown before anything is written. */
    file?: File | null;
  }
  const { file = null }: Props = $props();

  let staged = $state<AppBackup | null>(null);
  let existingIds = $state<Set<string>>(new Set());
  let legacy = $state<{ raw: unknown; summary: string } | null>(null);
  let pasteText = $state('');
  let err = $state('');
  let busy = $state(false);

  $effect(() => {
    if (!file) return;
    void readBackupFile(file)
      .then(stage)
      .catch((ex: unknown) => {
        err = ex instanceof Error ? ex.message : S.importer.unreadable;
      });
  });

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
      /* what came back is spending, so land on the money */
      router.goPocket(LEGACY_TRIP_ID, 'money');
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
      if (last) router.goTab(last, 'now');
    } catch (ex) {
      err = ex instanceof Error ? ex.message : S.importer.failed;
      busy = false;
    }
  }
</script>

{#if legacy}
  <div class="preview">
    <section class="pv-card lit">
      <span class="klabel">{S.importer.legacyTitle}</span>
      <p class="lead">{legacy.summary}</p>
      <p class="note">{S.importer.legacyBody}</p>
    </section>
    <div class="acts">
      <button class="btn ghost" style="flex:1" onclick={() => (legacy = null)} disabled={busy}>{S.importer.back}</button>
      <button class="btn primary" style="flex:2" onclick={applyLegacy} disabled={busy}>
        {busy ? S.importer.restoring : S.importer.restore}
      </button>
    </div>
  </div>
{:else if !staged}
  <p class="intro">{S.importer.intro}</p>

  <label class="filebtn">
    <input type="file" accept=".json,.gz,application/json,application/gzip" onchange={onFile} />
    <span><Icon name="doc" size={18} /> {S.importer.choose}</span>
  </label>

  <details class="paste">
    <summary class="pastesum"><Icon name="chevron-right" size={16} class="pchev" /> {S.importer.orPaste}</summary>
    <textarea class="mono" bind:value={pasteText} rows="5" placeholder={S.importer.pastePh}></textarea>
    <button class="btn wfull" style="margin-top:10px" onclick={onPaste} disabled={!pasteText.trim()}>
      {S.importer.readPaste}
    </button>
  </details>
{:else}
  <div class="preview">
    {#each staged.trips as b (b.trip.id)}
      <article class="pv-card pv-trip" style="--h:{b.trip.accentHue}">
        <span class="hue" aria-hidden="true"></span>
        <div class="ttlrow">
          <h3 class="display tname">{b.trip.emoji ? `${b.trip.emoji} ` : ''}{b.trip.title}</h3>
          {#if existingIds.has(b.trip.id)}<span class="chip warn">{S.importer.replaces}</span>{/if}
        </div>
        <div class="num dates">{fmtShort(b.trip.start)} → {fmtLong(b.trip.end)}</div>
        <div class="sum">{summarizeBundle(b)}</div>
      </article>
    {/each}

    {#if existingIds.size > 0}
      <div class="pv-card warn">
        <span class="w-head"><Icon name="alert" size={17} /> {S.importer.replaceWarn}</span>
        <div class="note">{S.importer.replaceWarnBody}</div>
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

{#if err}<div class="err" role="alert"><Icon name="alert" size={16} /> {err}</div>{/if}

<style>
  /* The file button is a label wrapping a real <input type=file> — the
     rehearsal drives the import through `.filebtn input[type=file]`, so this
     shape is load-bearing, not decorative. */
  .filebtn {
    display: block;
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-pill);
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
    background: var(--sunrise-fill);
    color: var(--on-sunrise);
    border-radius: var(--radius-pill);
    padding: 14px;
    min-height: 52px;
    font-size: var(--fs-row);
    font-weight: 600;
    box-shadow: var(--glow-sunrise);
  }
  .filebtn:focus-within span {
    outline: 2px solid var(--sunrise);
    outline-offset: 3px;
  }
  .intro {
    margin: 0 0 16px;
    font-size: var(--fs-label);
    line-height: 1.5;
    color: var(--ink-2);
  }
  .paste {
    margin-top: 14px;
  }
  .pastesum {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--sunrise);
    cursor: pointer;
    list-style: none;
  }
  .pastesum::-webkit-details-marker {
    display: none;
  }
  .paste[open] :global(.pchev) {
    transform: rotate(90deg);
  }
  textarea {
    width: 100%;
    font-size: var(--fs-caption);
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pv-card {
    position: relative;
    overflow: hidden;
    padding: 16px 16px 16px 20px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .pv-card.lit {
    border-color: color-mix(in srgb, var(--sunrise) 45%, transparent);
  }
  .pv-card.warn {
    border-color: var(--warn-line);
    background: var(--warn-soft);
  }
  .lead {
    margin: 8px 0;
    font-size: var(--fs-row);
    color: var(--ink);
  }
  .note {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .w-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--warn-ink);
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
    font-size: var(--fs-card-title);
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .dates {
    margin-top: 4px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .sum {
    margin-top: 8px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .acts {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .err {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--crit-ink);
    font-size: var(--fs-label);
    font-weight: 600;
    background: var(--crit-soft);
    border: 1px solid var(--crit-line);
    border-radius: var(--radius-button-sm);
    padding: 11px 13px;
    margin-top: 14px;
  }
</style>

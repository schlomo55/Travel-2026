<script lang="ts">
  import { db } from '../lib/db/db';
  import { deleteTripCascade, mutate, updateSettings, upsertTripBundle } from '../lib/data/repo';
  import { bundleBlobs, parseBackupText, readBackupFile, summarizeBundle } from '../lib/logic/backup';
  import { fmtShort, fmtLong } from '../lib/logic/dates';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import type { SojournBackup, TripBundle } from '../lib/model/types';

  let staged = $state<SojournBackup | null>(null);
  let existingIds = $state<Set<string>>(new Set());
  let pasteText = $state('');
  let err = $state('');
  let busy = $state(false);

  async function stage(backup: SojournBackup): Promise<void> {
    err = '';
    const ids = new Set<string>();
    for (const b of backup.trips) {
      if (await db.trips.get(b.trip.id)) ids.add(b.trip.id);
    }
    existingIds = ids;
    staged = backup;
  }

  async function onFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await stage(await readBackupFile(file));
    } catch (ex) {
      err = ex instanceof Error ? ex.message : 'Could not read that file';
    }
  }

  function onPaste(): void {
    try {
      void stage(parseBackupText(pasteText));
    } catch (ex) {
      err = ex instanceof Error ? ex.message : 'That did not parse';
    }
  }

  async function apply(): Promise<void> {
    if (!staged || busy) return;
    busy = true;
    try {
      /* $state deep-proxies objects, and IndexedDB cannot structured-clone a
         Proxy — snapshot back to plain data before any write. */
      const payload = $state.snapshot(staged) as SojournBackup;
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
      toast.show(`Imported ${payload.trips.length} trip${payload.trips.length === 1 ? '' : 's'} ✓`);
      router.closeTopLayer();
      if (last) router.goTab(last, 'today');
    } catch (ex) {
      err = ex instanceof Error ? ex.message : 'Import failed';
      busy = false;
    }
  }
</script>

{#if !staged}
  <p class="muted" style="margin:0 0 14px">
    Import a trip file or a Sojourn backup. Everything stays on this device — nothing is uploaded.
  </p>

  <label class="filebtn">
    <input type="file" accept=".json,.gz,application/json,application/gzip" onchange={onFile} />
    <span>📂 Choose a file…</span>
  </label>

  <details style="margin-top:14px">
    <summary class="pastesum">or paste the text</summary>
    <textarea bind:value={pasteText} rows="5" placeholder="Paste a backup blob…"></textarea>
    <button class="btn wfull" style="margin-top:8px" onclick={onPaste} disabled={!pasteText.trim()}>
      Read pasted text
    </button>
  </details>
{:else}
  <div class="preview">
    {#each staged.trips as b (b.trip.id)}
      <article class="card" style="--accent-h:{b.trip.accentHue}; margin-bottom:10px">
        <div class="routeline" aria-hidden="true"><i></i><i></i><i></i></div>
        <div style="display:flex; align-items:baseline; gap:9px">
          <h3 style="margin:0; font-size:19px; font-family:var(--font-display); text-transform:none; letter-spacing:0; color:var(--ink)">
            {b.trip.emoji ? `${b.trip.emoji} ` : ''}{b.trip.title}
          </h3>
          {#if existingIds.has(b.trip.id)}<span class="stamp warn">Replaces</span>{/if}
        </div>
        <div class="small mono" style="margin-top:4px">{fmtShort(b.trip.start)} → {fmtLong(b.trip.end)}</div>
        <div class="muted" style="margin-top:6px">{summarizeBundle(b)}</div>
      </article>
    {/each}

    {#if existingIds.size > 0}
      <div class="card warn">
        <h3>⚠️ This replaces a trip you already have</h3>
        <div class="muted">
          The existing copy is deleted first, then the file is written in. Ticks and expenses stored
          only on this device — and not present in the file — would be lost.
        </div>
      </div>
    {/if}

    <div style="display:flex; gap:9px">
      <button class="btn ghost" style="flex:1" onclick={() => (staged = null)} disabled={busy}>Back</button>
      <button class="btn primary" style="flex:2" onclick={apply} disabled={busy}>
        {busy ? 'Importing…' : existingIds.size ? 'Replace & import' : 'Import'}
      </button>
    </div>
  </div>
{/if}

{#if err}<div class="err">{err}</div>{/if}

<style>
  .filebtn {
    display: block;
    position: relative;
    overflow: hidden;
  }
  .filebtn input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  .filebtn span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--accent);
    color: #fff;
    border-radius: 12px;
    padding: 14px;
    font-weight: 650;
  }
  .pastesum {
    font-size: 12.5px;
    color: var(--ink-2);
    cursor: pointer;
    margin-bottom: 8px;
  }
  textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
  .err {
    color: var(--crit);
    font-size: 13px;
    font-weight: 650;
    margin-top: 12px;
  }
</style>

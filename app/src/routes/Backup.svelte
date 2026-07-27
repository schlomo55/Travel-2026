<script lang="ts">
  /* Backup & restore (plan §PHASES Phase 2 — "friendlier").

     Three things changed from the Phase 0 screen, all of them about knowing
     what a tap will do before you make it:

     · the export buttons print the exact filename they will save;
     · the vault line says what is in the copy — trips, documents, bytes;
     · restore opens the same staged preview the shelf uses, so nothing is
       written until you have read what is in the file.

     Everything still happens on this device. Nothing here touches a network. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { requestPersistence, storageEstimate } from '../lib/db/persist';
  import { backupIsStale, exportTrip, exportVault, textBackup, vaultStats, wipeVault } from '../lib/data/export';
  import { backupFileName } from '../lib/logic/backup';
  import { fmtBytes } from '../lib/data/documents';
  import { copyText, toast } from '../lib/state/toast.svelte';
  import { router } from '../lib/state/router.svelte';
  import Sheet from '../lib/components/ui/Sheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import { S } from '../lib/i18n/strings';

  const settingsLive = live(() => db.settings.get('settings'));
  const tripsLive = live(() => db.trips.toArray(), { initial: [] });
  const settings = $derived(settingsLive.current);
  const trips = $derived(tripsLive.current ?? []);

  let stats = $state<Awaited<ReturnType<typeof vaultStats>> | null>(null);
  let estimate = $state<{ usage: number; quota: number } | null>(null);
  let importOpen = $state(false);
  let wipeArmed = $state(false);
  let busy = $state(false);

  $effect(() => {
    void vaultStats().then((s) => (stats = s));
    void storageEstimate().then((e) => (estimate = e));
  });

  const stale = $derived(settings ? backupIsStale(settings) : false);
  const lastBackup = $derived(
    settings?.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : S.backup.never,
  );
  /* Recomputed on every render rather than cached: a vault left open past
     midnight would otherwise promise yesterday's filename. */
  const vaultName = $derived(backupFileName(null));

  async function run(fn: () => Promise<void>, done: string): Promise<void> {
    busy = true;
    try {
      await fn();
      toast.show(done);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : S.backup.failed);
    }
    busy = false;
    void vaultStats().then((s) => (stats = s));
  }

  async function copyTextBackup(): Promise<void> {
    busy = true;
    const text = await textBackup();
    await copyText(text, `(${Math.round(text.length / 1024)} KB, no documents)`);
    busy = false;
  }

  async function doWipe(): Promise<void> {
    if (!wipeArmed) {
      wipeArmed = true;
      setTimeout(() => (wipeArmed = false), 5000);
      return;
    }
    await run(async () => {
      await exportVault(); // never wipe without handing back a copy first
      await wipeVault();
    }, S.backup.cleared);
    router.go('#/trips');
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">{S.backup.title} <span class="pagesub">{S.backup.subtitle}</span></h1>

  {#if stale}
    <section class="card warn u-rise">
      <h3>⚠️ {S.backup.staleTitle}</h3>
      <p class="muted" style="margin:0">{S.backup.staleBody}</p>
    </section>
  {/if}

  <section class="card lit u-rise" style="--i:1">
    <h3>{S.backup.saveTitle}</h3>
    <div class="lastline">
      {S.backup.lastBackup}: <b>{lastBackup}</b>
    </div>
    {#if stats}
      <div class="small" style="margin:3px 0 12px">
        {S.backup.vaultLine(stats.trips, stats.documents, fmtBytes(stats.documentBytes))}
      </div>
    {/if}

    <button class="btn primary bigbtn" disabled={busy} onclick={() => run(exportVault, S.backup.saved)}>
      <span class="bl">⬇ {S.backup.saveAll}</span>
      <span class="bs mono">{vaultName}</span>
    </button>
    <button class="btn bigbtn" style="margin-top:10px" disabled={busy} onclick={copyTextBackup}>
      <span class="bl">📋 {S.backup.copyText}</span>
      <span class="bs">{S.backup.copyTextSub}</span>
    </button>
    <p class="small" style="margin:10px 0 0">{S.backup.saveNote}</p>
  </section>

  <section class="card u-rise" style="--i:2">
    <h3>{S.backup.oneTrip}</h3>
    {#if trips.length === 0}
      <EmptyState compact glyph={S.empty.backupTrips.glyph} title={S.empty.backupTrips.title} body={S.empty.backupTrips.body} />
    {:else}
      <p class="small" style="margin:0 0 8px">{S.backup.oneTripSub}</p>
      {#each trips as t (t.id)}
        <div class="trow">
          <span class="tname">
            {t.emoji ? `${t.emoji} ` : ''}{t.title}
            <small class="mono">{backupFileName(t.title)}</small>
          </span>
          <button class="btn ghost small-btn" disabled={busy} onclick={() => run(() => exportTrip(t.id), S.backup.savedTrip(t.title))}>
            ⬇ {S.backup.save}
          </button>
        </div>
      {/each}
    {/if}
  </section>

  <section class="card u-rise" style="--i:3">
    <h3>{S.backup.restoreTitle}</h3>
    <p class="muted" style="margin:0 0 12px">{S.backup.restoreBody}</p>
    <button class="btn wfull" onclick={() => (importOpen = true)}>⬆ {S.backup.restoreBtn}</button>
  </section>

  <section class="card u-rise" style="--i:4">
    <h3>{S.backup.storage}</h3>
    {#if settings?.persisted}
      <div class="statline ok">✓ {S.backup.protected}</div>
    {:else}
      <div class="statline">{S.backup.notProtected}</div>
      <button
        class="btn wfull"
        style="margin-top:10px"
        onclick={() => run(async () => { await requestPersistence(); }, S.backup.askedProtection)}
      >
        {S.backup.askProtection}
      </button>
      <p class="small" style="margin:9px 0 0">{S.backup.protectionHint}</p>
    {/if}
    {#if estimate}
      <div class="gauge" aria-hidden="true">
        <i style="width:{Math.min(100, Math.max(1, Math.round((estimate.usage / Math.max(1, estimate.quota)) * 100)))}%"></i>
      </div>
      <div class="small" style="margin-top:6px">{S.backup.usage(fmtBytes(estimate.usage), fmtBytes(estimate.quota))}</div>
    {/if}
  </section>

  <section class="card crit u-rise" style="--i:5">
    <h3>{S.backup.clearTitle}</h3>
    <p class="muted" style="margin:0 0 12px">{S.backup.clearBody}</p>
    <button class="btn danger wfull" disabled={busy} onclick={doWipe}>
      {wipeArmed ? S.backup.clearArm : `🗑 ${S.backup.clear}`}
    </button>
  </section>
</main>

{#if importOpen}
  <Sheet title={S.importer.title} onclose={() => (importOpen = false)}>
    <ImportSheet />
  </Sheet>
{/if}

<style>
  .lastline {
    font-size: 14px;
  }
  /* a two-line button: what it does, and what it will leave behind */
  .bigbtn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    min-height: 58px;
    padding: 11px 14px;
    text-align: center;
  }
  .bigbtn .bl {
    font-size: 14.5px;
    font-weight: 700;
  }
  .bigbtn .bs {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2px;
    opacity: 0.72;
    word-break: break-all;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px dashed var(--line);
  }
  .trow:last-child {
    border-bottom: none;
  }
  .tname {
    flex: 1;
    min-width: 0;
    font-size: 14.5px;
  }
  .tname small {
    display: block;
    font-size: 10.5px;
    color: var(--faint);
    word-break: break-all;
  }
  .small-btn {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 7px 15px;
    font-size: 12.5px;
  }
  .statline {
    font-size: 14.5px;
    font-weight: 600;
  }
  .statline.ok {
    color: var(--ok);
  }
  .gauge {
    margin-top: 12px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--neon-track);
    overflow: hidden;
  }
  .gauge i {
    display: block;
    height: 100%;
    background: var(--neon);
    box-shadow: var(--glow-neon);
  }
  .btn.danger {
    background: transparent;
    border-color: color-mix(in srgb, var(--crit) 55%, var(--line));
    color: var(--crit);
  }
</style>

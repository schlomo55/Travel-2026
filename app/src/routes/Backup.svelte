<script lang="ts">
  /* Backup & restore (plan §PHASES Phase 2 — "friendlier").

     Three things changed from the Phase 0 screen, all of them about knowing
     what a tap will do before you make it:

     · the export buttons print the exact filename they will save;
     · the vault line says what is in the copy — trips, documents, bytes;
     · restore opens the same staged preview the shelf uses, so nothing is
       written until you have read what is in the file.

     Everything still happens on this phone. Nothing here touches a network
     — except the Drive card, and only once its owner has connected it.

     Horizon: a sub-screen with the round back button (the way you came, or
     up to Settings), tiles on the night sky, icons instead of emoji. */
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
  import DriveCard from '../lib/components/cards/DriveCard.svelte';
  import { once } from '../lib/state/lazy';
  import SubHeader from '../lib/components/horizon/SubHeader.svelte';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import { S } from '../lib/i18n/strings';

  /* the import sheet's chunk loads when it first opens (lib/state/lazy.ts) */
  const importSheet = once(() => import('./ImportSheet.svelte').then((m) => m.default));

  const settingsLive = live(() => db.settings.get('settings'));
  const tripsLive = live(() => db.trips.toArray(), { initial: [] });
  const settings = $derived(settingsLive.current);
  const trips = $derived(tripsLive.current ?? []);

  let stats = $state<Awaited<ReturnType<typeof vaultStats>> | null>(null);
  let estimate = $state<{ usage: number; quota: number } | null>(null);
  let importOpen = $state(false);
  /** Set when a copy came down from Drive — the importer stages it exactly as
      if it had been chosen from the phone's files. */
  let importFile = $state<File | null>(null);
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

<SubHeader title={S.backup.title} subtitle={S.backup.subtitle} up="#/settings" backLabel={S.misc.back} />

<main class="wrap backup">
  {#if stale}
    <section class="bk-card warn u-rise">
      <span class="bk-head warn"><Icon name="alert" size={18} /> {S.backup.staleTitle}</span>
      <p class="bk-note">{S.backup.staleBody}</p>
    </section>
  {/if}

  <section class="bk-card lit u-rise" style="--i:1">
    <h2 class="caps">{S.backup.saveTitle}</h2>
    <div class="lastline">
      {S.backup.lastBackup}: <b class="num">{lastBackup}</b>
    </div>
    {#if stats}
      <div class="bk-note num" style="margin:3px 0 14px">
        {S.backup.vaultLine(stats.trips, stats.documents, fmtBytes(stats.documentBytes))}
      </div>
    {/if}

    <button class="btn primary bigbtn" disabled={busy} onclick={() => run(exportVault, S.backup.saved)}>
      <span class="bl"><Icon name="download" size={18} stroke={2} /> {S.backup.saveAll}</span>
      <span class="bs num">{vaultName}</span>
    </button>
    <button class="btn bigbtn" style="margin-top:10px" disabled={busy} onclick={copyTextBackup}>
      <span class="bl"><Icon name="copy" size={17} /> {S.backup.copyText}</span>
      <span class="bs">{S.backup.copyTextSub}</span>
    </button>
    <p class="bk-note" style="margin:12px 0 0">{S.backup.saveNote}</p>
  </section>

  <!-- The one thing a file in Downloads cannot do: survive the phone itself.
       Opt-in, and silent about it until the owner asks. -->
  <DriveCard
    onrestore={(f) => {
      importFile = f;
      importOpen = true;
    }}
  />

  <section class="bk-card u-rise" style="--i:3">
    <h2 class="caps">{S.backup.oneTrip}</h2>
    {#if trips.length === 0}
      <EmptyState compact glyph={S.empty.backupTrips.glyph} title={S.empty.backupTrips.title} body={S.empty.backupTrips.body} />
    {:else}
      <p class="bk-note" style="margin:0 0 6px">{S.backup.oneTripSub}</p>
      {#each trips as t (t.id)}
        <div class="trow">
          <span class="tname">
            {t.emoji ? `${t.emoji} ` : ''}{t.title}
            <small class="num">{backupFileName(t.title)}</small>
          </span>
          <button class="btn ghost small-btn" disabled={busy} onclick={() => run(() => exportTrip(t.id), S.backup.savedTrip(t.title))}>
            <Icon name="download" size={16} /> {S.backup.save}
          </button>
        </div>
      {/each}
    {/if}
  </section>

  <section class="bk-card u-rise" style="--i:4">
    <h2 class="caps">{S.backup.restoreTitle}</h2>
    <p class="bk-note" style="margin:0 0 12px">{S.backup.restoreBody}</p>
    <button
      class="btn wfull"
      onclick={() => {
        importFile = null;
        importOpen = true;
      }}><Icon name="doc" size={17} /> {S.backup.restoreBtn}</button
    >
  </section>

  <section class="bk-card u-rise" style="--i:5">
    <h2 class="caps">{S.backup.storage}</h2>
    {#if settings?.persisted}
      <div class="statline ok"><Icon name="check" size={16} stroke={2.2} /> {S.backup.protected}</div>
    {:else}
      <div class="statline">{S.backup.notProtected}</div>
      <button
        class="btn wfull"
        style="margin-top:10px"
        onclick={() => run(async () => { await requestPersistence(); }, S.backup.askedProtection)}
      >
        <Icon name="shield" size={17} /> {S.backup.askProtection}
      </button>
      <p class="bk-note" style="margin:9px 0 0">{S.backup.protectionHint}</p>
    {/if}
    {#if estimate}
      <div class="gauge" aria-hidden="true">
        <i style="width:{Math.min(100, Math.max(1, Math.round((estimate.usage / Math.max(1, estimate.quota)) * 100)))}%"></i>
      </div>
      <div class="bk-note num" style="margin-top:6px">{S.backup.usage(fmtBytes(estimate.usage), fmtBytes(estimate.quota))}</div>
    {/if}
  </section>

  <section class="bk-card crit u-rise" style="--i:6">
    <h2 class="caps crit-h">{S.backup.clearTitle}</h2>
    <p class="bk-note" style="margin:0 0 12px">{S.backup.clearBody}</p>
    <button class="btn danger wfull" disabled={busy} onclick={doWipe}>
      {#if !wipeArmed}<Icon name="trash" size={16} />{/if}
      {wipeArmed ? S.backup.clearArm : S.backup.clear}
    </button>
  </section>
</main>

{#if importOpen}
  <Sheet
    title={S.importer.title}
    onclose={() => {
      importOpen = false;
      importFile = null;
    }}
  >
    {#await importSheet()}
      <p class="lazywait" role="status">{S.misc.opening}</p>
    {:then Import}
      <Import file={importFile} />
    {:catch}
      <p class="lazywait fail" role="alert">{S.misc.openFailed}</p>
    {/await}
  </Sheet>
{/if}

<style>
  .backup {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 4px;
    padding-bottom: 40px;
  }
  /* the Backup screen's cards share one shape: a tile on the night sky (the
     Drive card draws the same tile itself) */
  .bk-card {
    position: relative;
    margin: 0;
    padding: 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .bk-card.lit {
    border-color: color-mix(in srgb, var(--sunrise) 40%, transparent);
  }
  .bk-card.warn {
    border-color: var(--warn-line);
    background: linear-gradient(var(--warn-soft), var(--warn-soft)), var(--card);
  }
  .bk-card.crit {
    border-color: var(--crit-line);
  }
  .bk-card h2 {
    margin: 0 0 10px;
    color: var(--ink-2);
  }
  .bk-card h2.crit-h {
    color: var(--crit-ink);
  }
  .bk-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .bk-head.warn {
    color: var(--warn-ink);
  }
  .bk-note {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .lastline {
    font-size: var(--fs-label);
    color: var(--ink-2);
  }
  .lastline b {
    color: var(--ink);
    font-weight: 500;
  }
  /* a two-line button: what it does, and what it will leave behind */
  .bigbtn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    min-height: 60px;
    padding: 11px 16px;
    border-radius: var(--radius-inner);
    text-align: center;
  }
  .bigbtn .bl {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .bigbtn .bs {
    font-size: var(--fs-chip);
    font-weight: 500;
    opacity: 0.8;
    word-break: break-all;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }
  .trow:last-child {
    border-bottom: none;
  }
  .tname {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .tname small {
    display: block;
    margin-top: 2px;
    font-size: var(--fs-chip);
    font-weight: 400;
    color: var(--faint);
    word-break: break-all;
  }
  .small-btn {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 7px 15px;
  }
  .statline {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .statline.ok {
    color: var(--ok-ink);
  }
  .gauge {
    margin-top: 12px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--scene-track);
    overflow: hidden;
  }
  .gauge i {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2));
  }
</style>

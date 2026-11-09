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
  import { backupIsStale, exportTrip, exportVault, markCopied, textBackup, vaultStats, wipeVault } from '../lib/data/export';
  import { fmtStamp } from '../lib/logic/dates';
  import type { SaveOutcome } from '../lib/platform/files';
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
  import { SBK } from '../lib/i18n/backup';
  import { isNative } from '../lib/platform/files';
  import { driveConfigured } from '../lib/data/driveConfig';

  /* the import sheet is in this screen's own chunk (occasional.ts), asked for when it first opens */
  const importSheet = once(() => import('./occasional').then((m) => m.ImportSheet));

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
  const lastBackup = $derived(settings?.lastBackupAt ? fmtStamp(settings.lastBackupAt) : SBK.never);
  const lastLabel = $derived(
    settings?.lastBackupVia === 'shared'
      ? SBK.lastShared
      : settings?.lastBackupVia === 'copied'
        ? SBK.lastCopied
        : SBK.lastBackup,
  );
  /* Recomputed on every render rather than cached: a vault left open past
     midnight would otherwise promise yesterday's filename. */
  const vaultName = $derived(backupFileName(null));

  /* "Back up to Drive" (the Reminders run): on the phone the backup leaves
     through the share menu to the Google Drive app. The Drive sign-in card
     only shows once its keys exist: the owner chose the share menu instead,
     and a card that can only say "not set up" is noise. */
  const native = isNative();
  const showDriveCard = driveConfigured(native);
  /* The backup reminder's "Back up now" button lands here and starts it. */
  $effect(() => {
    let want = false;
    try {
      want = sessionStorage.getItem('ltd:backup-now') === '1';
      sessionStorage.removeItem('ltd:backup-now');
    } catch {
      /* no session storage: the person taps Save */
    }
    if (want) void run(exportVault, SBK.saved, SBK.shared);
  });

  /** The toast says what happened: saved (a download), handed over (the share
      sheet came back with an app), or nothing (the sheet was dismissed). */
  async function run(fn: () => Promise<SaveOutcome | void>, saved: string, shared = saved): Promise<void> {
    busy = true;
    try {
      const outcome = await fn();
      toast.show(outcome === 'cancelled' ? SBK.shareCancelled : outcome === 'shared' ? shared : saved);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : SBK.failed);
    }
    busy = false;
    void vaultStats().then((s) => (stats = s));
  }

  async function copyTextBackup(): Promise<void> {
    busy = true;
    const text = await textBackup();
    if (await copyText(text, `(${Math.round(text.length / 1024)} KB, no documents)`)) await markCopied();
    busy = false;
  }

  async function doWipe(): Promise<void> {
    if (!wipeArmed) {
      wipeArmed = true;
      setTimeout(() => (wipeArmed = false), 5000);
      return;
    }
    busy = true;
    try {
      // never wipe without handing back a copy first — and a dismissed share
      // sheet handed back nothing
      if ((await exportVault()) === 'cancelled') {
        toast.show(SBK.clearCancelled);
        busy = false;
        wipeArmed = false;
        return;
      }
      await wipeVault();
      toast.show(SBK.cleared);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : SBK.failed);
      busy = false;
      return;
    }
    busy = false;
    router.go('#/trips');
  }
</script>

<SubHeader title={SBK.title} subtitle={SBK.subtitle} up="#/settings" backLabel={S.misc.back} />

<main class="wrap backup">
  {#if stale}
    <section class="bk-card warn u-rise">
      <span class="bk-head warn"><Icon name="alert" size={18} /> {SBK.staleTitle}</span>
      <p class="bk-note">{SBK.staleBody}</p>
    </section>
  {/if}

  <section class="bk-card lit u-rise" style="--i:1">
    <h2 class="caps">{SBK.saveTitle}</h2>
    <div class="lastline">
      {lastLabel}: <b class="num">{lastBackup}</b>
    </div>
    {#if stats}
      <div class="bk-note num" style="margin:3px 0 14px">
        {SBK.vaultLine(stats.trips, stats.documents, fmtBytes(stats.documentBytes))}
      </div>
    {/if}

    <button class="btn primary bigbtn" disabled={busy} onclick={() => run(exportVault, SBK.saved, SBK.shared)}>
      <span class="bl"><Icon name={native ? 'cloud-up' : 'download'} size={18} stroke={2} /> {native ? SBK.saveToDrive : SBK.saveAll}</span>
      <span class="bs num">{vaultName}</span>
    </button>
    <button class="btn bigbtn" style="margin-top:10px" disabled={busy} onclick={copyTextBackup}>
      <span class="bl"><Icon name="copy" size={17} /> {SBK.copyText}</span>
      <span class="bs">{SBK.copyTextSub}</span>
    </button>
    {#if native}<p class="bk-note" style="margin:12px 0 0">{SBK.driveHint}</p>{/if}
    <p class="bk-note" style="margin:12px 0 0">{SBK.saveNote}</p>
  </section>

  <!-- The one thing a file in Downloads cannot do: survive the phone itself.
       Opt-in, and silent about it until the owner asks. -->
  {#if showDriveCard}
    <DriveCard
      onrestore={(f) => {
        importFile = f;
        importOpen = true;
      }}
    />
  {/if}

  <section class="bk-card u-rise" style="--i:3">
    <h2 class="caps">{SBK.oneTrip}</h2>
    {#if trips.length === 0}
      <EmptyState compact glyph={S.empty.backupTrips.glyph} title={S.empty.backupTrips.title} body={S.empty.backupTrips.body} />
    {:else}
      <p class="bk-note" style="margin:0 0 6px">{SBK.oneTripSub}</p>
      {#each trips as t (t.id)}
        <div class="trow">
          <span class="tname">
            {t.emoji ? `${t.emoji} ` : ''}{t.title}
            <small class="num">{backupFileName(t.title)}</small>
          </span>
          <button class="btn ghost small-btn" disabled={busy} onclick={() => run(() => exportTrip(t.id), SBK.savedTrip(t.title), SBK.sharedTrip(t.title))}>
            <Icon name="download" size={16} /> {SBK.save}
          </button>
        </div>
      {/each}
    {/if}
  </section>

  <section class="bk-card u-rise" style="--i:4">
    <h2 class="caps">{SBK.restoreTitle}</h2>
    <p class="bk-note" style="margin:0 0 12px">{SBK.restoreBody}</p>
    <button
      class="btn wfull"
      onclick={() => {
        importFile = null;
        importOpen = true;
      }}><Icon name="doc" size={17} /> {SBK.restoreBtn}</button
    >
  </section>

  <section class="bk-card u-rise" style="--i:5">
    <h2 class="caps">{SBK.storage}</h2>
    {#if native || settings?.persisted}
      <div class="statline ok"><Icon name="check" size={16} stroke={2.2} /> {native ? S.settings.nativeStore : SBK.protected}</div>
    {:else}
      <div class="statline">{SBK.notProtected}</div>
      <button
        class="btn wfull"
        style="margin-top:10px"
        onclick={() => run(async () => { await requestPersistence(); }, SBK.askedProtection)}
      >
        <Icon name="shield" size={17} /> {SBK.askProtection}
      </button>
      <p class="bk-note" style="margin:9px 0 0">{SBK.protectionHint}</p>
    {/if}
    {#if estimate}
      <div class="gauge" aria-hidden="true">
        <i style="width:{Math.min(100, Math.max(1, Math.round((estimate.usage / Math.max(1, estimate.quota)) * 100)))}%"></i>
      </div>
      <div class="bk-note num" style="margin-top:6px">{SBK.usage(fmtBytes(estimate.usage), fmtBytes(estimate.quota))}</div>
    {/if}
  </section>

  <!-- closed, last: clearing the vault is not one of the routine backup actions -->
  <details class="dz">
    <summary><Icon name="alert" size={16} stroke={2} /> {SBK.dangerTitle}</summary>
    <div class="dz-body">
      {#if stats}<p class="dz-note">{SBK.clearCost(SBK.vaultLine(stats.trips, stats.documents, fmtBytes(stats.documentBytes)))}</p>{/if}
      <button class="btn danger wfull" disabled={busy} onclick={doWipe}>
        {#if !wipeArmed}<Icon name="trash" size={16} />{/if}
        {wipeArmed ? SBK.clearArm : SBK.clear}
      </button>
    </div>
  </details>
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
  .bk-card h2 {
    margin: 0 0 10px;
    color: var(--ink-2);
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

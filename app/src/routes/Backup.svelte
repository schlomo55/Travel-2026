<script lang="ts">
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { requestPersistence, storageEstimate } from '../lib/db/persist';
  import { backupIsStale, exportTrip, exportVault, textBackup, vaultStats, wipeVault } from '../lib/data/export';
  import { fmtBytes } from '../lib/data/documents';
  import { copyText, toast } from '../lib/state/toast.svelte';
  import { router } from '../lib/state/router.svelte';
  import Sheet from '../lib/components/ui/Sheet.svelte';
  import ImportSheet from './ImportSheet.svelte';

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
    settings?.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : 'never',
  );

  async function run(fn: () => Promise<void>, done: string): Promise<void> {
    busy = true;
    try {
      await fn();
      toast.show(done);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : 'That did not work');
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
    }, 'Vault cleared — a backup was downloaded first');
    router.go('#/trips');
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">Backup <span class="pagesub">everything stays on this device</span></h1>

  {#if stale}
    <section class="card warn">
      <h3>⚠️ Your backup is out of date</h3>
      <p class="muted" style="margin:0">
        You have changed things since the last export. Save one now — browser storage can be cleared,
        especially when the phone is low on space.
      </p>
    </section>
  {/if}

  <section class="card">
    <h3>Save a copy</h3>
    <p class="muted" style="margin:0 0 10px">
      Last backup: <b>{lastBackup}</b>
      {#if stats}· {stats.trips} trip{stats.trips === 1 ? '' : 's'}, {stats.documents} document{stats.documents === 1 ? '' : 's'} ({fmtBytes(stats.documentBytes)}){/if}
    </p>
    <button class="btn primary wfull" disabled={busy} onclick={() => run(exportVault, 'Vault saved ✓')}>
      ⬇ Save everything (a single file)
    </button>
    <button class="btn wfull" style="margin-top:9px" disabled={busy} onclick={copyTextBackup}>
      📋 Copy as text (no documents)
    </button>
    <p class="small" style="margin:8px 0 0">
      The text form fits in a note or an email to yourself. The file form includes your documents.
    </p>
  </section>

  {#if trips.length}
    <section class="card">
      <h3>One trip only</h3>
      {#each trips as t (t.id)}
        <div class="trow">
          <span>{t.emoji ? `${t.emoji} ` : ''}{t.title}</span>
          <button class="btn ghost small-btn" disabled={busy} onclick={() => run(() => exportTrip(t.id), `${t.title} saved ✓`)}>
            ⬇ Save
          </button>
        </div>
      {/each}
    </section>
  {/if}

  <section class="card">
    <h3>Restore</h3>
    <p class="muted" style="margin:0 0 10px">
      Load a Living the dream backup, a trip file, or a backup from the old China app.
    </p>
    <button class="btn wfull" onclick={() => (importOpen = true)}>⬆ Import a file</button>
  </section>

  <section class="card">
    <h3>Storage</h3>
    {#if settings?.persisted}
      <div>✓ Protected against automatic cleanup</div>
    {:else}
      <div>Not yet protected against cleanup</div>
      <button class="btn wfull" style="margin-top:9px" onclick={() => run(async () => { await requestPersistence(); }, 'Asked the browser to protect this data')}>
        Ask for protection
      </button>
      <p class="small" style="margin:8px 0 0">
        Installing Living the dream to the home screen is what usually earns it.
      </p>
    {/if}
    {#if estimate}
      <div class="small" style="margin-top:6px">{fmtBytes(estimate.usage)} used of {fmtBytes(estimate.quota)} available</div>
    {/if}
  </section>

  <section class="card crit">
    <h3>Clear everything</h3>
    <p class="muted" style="margin:0 0 10px">
      Deletes every trip on this device. A backup file is downloaded first, automatically.
    </p>
    <button class="btn danger wfull" disabled={busy} onclick={doWipe}>
      {wipeArmed ? 'Tap again to clear the vault' : '🗑 Clear the vault'}
    </button>
  </section>
</main>

{#if importOpen}
  <Sheet title="Restore" onclose={() => (importOpen = false)}>
    <ImportSheet />
  </Sheet>
{/if}

<style>
  .trow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--line);
  }
  .trow:last-child {
    border-bottom: none;
  }
  .trow span {
    flex: 1;
  }
  .small-btn {
    min-height: 38px;
    padding: 7px 14px;
    font-size: 12.5px;
  }
  .btn.danger {
    background: transparent;
    border-color: color-mix(in srgb, var(--crit) 55%, var(--line));
    color: var(--crit);
  }
</style>

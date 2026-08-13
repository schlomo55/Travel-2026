<script lang="ts">
  /* The Drive backup card (Lantern Run C, C1).
   *
   * The whole point of this card is that it is honest at every stage:
   *
   * · with no client id it says so and offers NO button, because there is
   *   nothing a tap could achieve — a Connect button that always fails would
   *   be worse than the truth;
   * · before connecting it says exactly what leaves the phone and where to;
   * · offline it says "next backup when you're back online" in the quiet
   *   voice, never an error — being offline is normal on this trip;
   * · a failure appears once, in the state line, and never nags.
   *
   * See lib/data/drive.ts for what actually moves, and docs/DRIVE-SETUP.md
   * for the one-time console steps only the owner can take.
   */
  import { live } from '../../data/live.svelte';
  import { isNative } from '../../platform/files';
  import { driveConfigured } from '../../data/driveConfig';
  import {
    backupToDrive,
    connectDrive,
    disconnectDrive,
    downloadDriveVersion,
    listDriveVersions,
    readStatus,
    readTokens,
  } from '../../data/drive';
  import { driveErrorText, driveState, type DriveFile } from '../../logic/drive';
  import { appState } from '../../state/appState.svelte';
  import { toast } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';

  interface Props {
    /** Handed a downloaded copy, the parent opens the existing staged-preview
        import flow. A restore is never applied blind. */
    onrestore: (file: File) => void;
  }
  const { onrestore }: Props = $props();

  const configured = driveConfigured(isNative());
  const tokensLive = live(() => readTokens(), { initial: null });
  const statusLive = live(() => readStatus());

  const conn = $derived(driveState({ configured, tokens: tokensLive.current ?? null }));
  const status = $derived(statusLive.current ?? null);

  let busy = $state(false);
  let versions = $state<DriveFile[] | null>(null);
  let listing = $state(false);

  const lastLine = $derived(
    status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : S.drive.never,
  );
  const failLine = $derived(
    status?.lastError && status.lastErrorAt
      ? S.drive.failedAt(status.lastError, new Date(status.lastErrorAt).toLocaleString())
      : null,
  );

  async function doConnect(): Promise<void> {
    busy = true;
    try {
      await connectDrive();
    } catch (err) {
      toast.show(driveErrorText(err));
    }
    busy = false;
  }

  async function doBackup(): Promise<void> {
    busy = true;
    const ok = await backupToDrive();
    /* A silent false is the offline case, which is not a failure and gets no
       toast — the state line already says when the last real one was. */
    if (ok) toast.show(S.drive.backedUp);
    busy = false;
  }

  async function doDisconnect(): Promise<void> {
    busy = true;
    await disconnectDrive();
    versions = null;
    toast.show(S.drive.disconnected);
    busy = false;
  }

  async function doList(): Promise<void> {
    listing = true;
    try {
      versions = await listDriveVersions();
    } catch (err) {
      toast.show(driveErrorText(err));
      versions = [];
    }
    listing = false;
  }

  async function doRestore(f: DriveFile): Promise<void> {
    busy = true;
    try {
      onrestore(await downloadDriveVersion(f));
    } catch (err) {
      toast.show(driveErrorText(err));
    }
    busy = false;
  }

  function when(f: DriveFile): string {
    const t = f.createdTime ? Date.parse(f.createdTime) : Number.NaN;
    return Number.isNaN(t) ? f.name : new Date(t).toLocaleString();
  }
</script>

<section class="card u-rise drivecard" style="--i:2">
  <h3>☁ {S.drive.title} <span class="sub">{S.drive.subtitle}</span></h3>

  {#if conn === 'unconfigured'}
    <!-- The honest dead end. No button: nothing a tap could do would work. -->
    <div class="statline dim">{S.drive.unconfigured}</div>
    <p class="muted" style="margin:8px 0 0">{S.drive.unconfiguredBody}</p>
    <p class="small" style="margin:8px 0 0">{S.drive.explainer}</p>
  {:else if conn === 'disconnected'}
    <div class="statline dim">{S.drive.notConnected}</div>
    <p class="muted" style="margin:8px 0 10px">{S.drive.explainer}</p>
    <p class="small" style="margin:0 0 4px">{S.drive.privacy}</p>
    <p class="small" style="margin:0 0 12px">{S.drive.nothingElse}</p>
    <button class="btn primary wfull" disabled={busy} onclick={doConnect}>
      {busy ? S.drive.connecting : S.drive.connect}
    </button>
  {:else}
    <div class="statline ok">✓ {S.drive.connected}</div>
    <div class="lastline">{S.drive.lastBackup}: <b>{lastLine}</b></div>
    {#if appState.offline}
      <div class="small offnote">{S.drive.offline}</div>
    {/if}
    {#if failLine}
      <div class="small failnote">{failLine}</div>
    {/if}
    <p class="small" style="margin:8px 0 12px">{S.drive.autoNote}</p>

    <button class="btn primary wfull" disabled={busy || appState.offline} onclick={doBackup}>
      {busy ? S.drive.backingUp : `☁ ${S.drive.backupNow}`}
    </button>

    <h4 class="sech">{S.drive.restoreTitle}</h4>
    <p class="small" style="margin:0 0 10px">{S.drive.restoreBody}</p>
    {#if versions === null}
      <button class="btn wfull" disabled={listing || appState.offline} onclick={doList}>
        {listing ? S.drive.loading : S.drive.listVersions}
      </button>
    {:else if versions.length === 0}
      <div class="small">{S.drive.noVersions}</div>
    {:else}
      {#each versions as v (v.id)}
        <div class="vrow">
          <span class="vwhen">{when(v)}</span>
          <button class="btn ghost small-btn" disabled={busy} onclick={() => doRestore(v)}>
            {S.drive.use}
          </button>
        </div>
      {/each}
    {/if}

    <button class="btn ghost wfull discbtn" disabled={busy} onclick={doDisconnect}>
      {S.drive.disconnect}
    </button>
  {/if}
</section>

<style>
  .sub {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 500;
    letter-spacing: 0.3px;
    text-transform: none;
    color: var(--faint);
  }
  .statline {
    font-size: var(--text-base);
    font-weight: 600;
  }
  .statline.ok {
    color: var(--ok);
  }
  /* Not-connected is a STATE, not a fault — it reads in the quiet voice. */
  .statline.dim {
    color: var(--ink-2);
  }
  .lastline {
    margin-top: 4px;
    font-size: var(--text-sm);
  }
  .offnote {
    margin-top: 6px;
    color: var(--faint);
  }
  .failnote {
    margin-top: 6px;
    color: var(--crit);
  }
  .sech {
    margin: 18px 0 4px;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .vrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--line);
  }
  .vwhen {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
  }
  .small-btn {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 7px 15px;
    font-size: var(--text-sm);
  }
  .discbtn {
    margin-top: 14px;
  }
</style>

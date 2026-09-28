<script lang="ts">
  /* The Drive backup card (Lantern Run C, C1; Horizon tile in Run 1).
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
  import Icon from '../horizon/Icon.svelte';

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

<section class="drivecard u-rise" style="--i:2">
  <h3 class="caps dc-title">{S.drive.title} <span class="sub">{S.drive.subtitle}</span></h3>

  {#if conn === 'unconfigured'}
    <!-- The honest dead end. No button: nothing a tap could do would work. -->
    <div class="statline dim"><span class="dc-ic" aria-hidden="true"><Icon name="cloud" size={17} /></span>{S.drive.unconfigured}</div>
    <p class="dc-note">{S.drive.unconfiguredBody}</p>
    <p class="dc-note">{S.drive.explainer}</p>
  {:else if conn === 'disconnected'}
    <div class="statline dim"><span class="dc-ic" aria-hidden="true"><Icon name="cloud" size={17} /></span>{S.drive.notConnected}</div>
    <p class="dc-note lead">{S.drive.explainer}</p>
    <p class="dc-note">{S.drive.privacy}</p>
    <p class="dc-note" style="margin-bottom:12px">{S.drive.nothingElse}</p>
    <button class="btn primary wfull" disabled={busy} onclick={doConnect}>
      {busy ? S.drive.connecting : S.drive.connect}
    </button>
  {:else}
    <div class="statline ok"><span class="dc-ic ok" aria-hidden="true"><Icon name="check" size={17} stroke={2.2} /></span>{S.drive.connected}</div>
    <div class="lastline">{S.drive.lastBackup}: <b class="num">{lastLine}</b></div>
    {#if appState.offline}
      <div class="dc-note offnote">{S.drive.offline}</div>
    {/if}
    {#if failLine}
      <div class="dc-note failnote">{failLine}</div>
    {/if}
    <p class="dc-note" style="margin-bottom:12px">{S.drive.autoNote}</p>

    <button class="btn primary wfull" disabled={busy || appState.offline} onclick={doBackup}>
      {#if !busy}<Icon name="cloud-up" size={18} />{/if}
      {busy ? S.drive.backingUp : S.drive.backupNow}
    </button>

    <h4 class="caps sech">{S.drive.restoreTitle}</h4>
    <p class="dc-note" style="margin:0 0 10px">{S.drive.restoreBody}</p>
    {#if versions === null}
      <button class="btn wfull" disabled={listing || appState.offline} onclick={doList}>
        {listing ? S.drive.loading : S.drive.listVersions}
      </button>
    {:else if versions.length === 0}
      <div class="dc-note">{S.drive.noVersions}</div>
    {:else}
      {#each versions as v (v.id)}
        <div class="vrow">
          <span class="vwhen num">{when(v)}</span>
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
  /* the same tile the Backup screen's own cards are */
  .drivecard {
    position: relative;
    margin: 0;
    padding: 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .dc-title {
    margin: 0 0 10px;
    color: var(--ink-2);
  }
  .sub {
    margin-left: 6px;
    font-size: var(--fs-chip);
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--faint);
  }
  .statline {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .dc-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    color: var(--lilac-ink);
    background: var(--lilac-soft);
  }
  .dc-ic.ok {
    color: var(--ok-ink);
    background: var(--ok-soft);
  }
  .statline.ok {
    color: var(--ok-ink);
  }
  /* Not-connected is a STATE, not a fault — it reads in the quiet voice. */
  .statline.dim {
    color: var(--ink-2);
  }
  .dc-note {
    margin: 8px 0 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .dc-note.lead {
    color: var(--ink);
    margin-bottom: 8px;
  }
  .lastline {
    margin-top: 8px;
    font-size: var(--fs-label);
    color: var(--ink-2);
  }
  .lastline b {
    color: var(--ink);
    font-weight: 500;
  }
  .offnote {
    color: var(--faint);
  }
  .failnote {
    color: var(--crit-ink);
  }
  .sech {
    margin: 18px 0 4px;
    color: var(--ink-2);
  }
  .vrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
  }
  .vwhen {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-caption);
  }
  .small-btn {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 7px 15px;
  }
  .discbtn {
    margin-top: 14px;
  }
</style>

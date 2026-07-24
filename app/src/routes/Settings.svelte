<script lang="ts">
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { updateSettings } from '../lib/data/repo';
  import { storageEstimate } from '../lib/db/persist';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { isIsoDate } from '../lib/logic/dates';
  import { S } from '../lib/i18n/strings';
  import type { Settings } from '../lib/model/types';

  const settingsLive = live(() => db.settings.get('settings'));
  const settings = $derived(settingsLive.current);

  let previewInput = $state(appState.previewDate ?? '');
  let estimate = $state<{ usage: number; quota: number } | null>(null);
  $effect(() => {
    void storageEstimate().then((e) => (estimate = e));
  });

  async function setTheme(theme: Settings['theme']): Promise<void> {
    await updateSettings({ theme });
  }
  function applyPreview(): void {
    if (isIsoDate(previewInput)) appState.setPreview(previewInput);
  }
  function mb(n: number): string {
    return (n / 1048576).toFixed(1) + ' MB';
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">{S.settings.title}</h1>

  <section class="card">
    <h3>{S.settings.theme}</h3>
    <div class="themes">
      {#each [['system', S.settings.themeSystem], ['light', S.settings.themeLight], ['dark', S.settings.themeDark]] as [val, label] (val)}
        <button
          class="btn"
          class:primary={(settings?.theme ?? 'system') === val}
          onclick={() => setTheme(val as Settings['theme'])}>{label}</button
        >
      {/each}
    </div>
  </section>

  <section class="card">
    <h3>{S.settings.preview}</h3>
    <p class="muted" style="margin:0 0 10px">{S.settings.previewHint}</p>
    <div style="display:flex; gap:9px">
      <input type="date" bind:value={previewInput} style="flex:1" />
      <button class="btn" onclick={applyPreview}>Preview</button>
      {#if appState.previewing}
        <button class="btn ghost" onclick={() => appState.setPreview(null)}>Exit</button>
      {/if}
    </div>
  </section>

  <section class="card">
    <h3>🌦 Weather</h3>
    <label class="wrow">
      <input
        type="checkbox"
        checked={settings?.weatherOnline !== false}
        onchange={(e) => updateSettings({ weatherOnline: e.currentTarget.checked })}
      />
      <span>{S.weather.setting}</span>
    </label>
    <p class="muted" style="margin:6px 0 0">{S.weather.settingHint}</p>
  </section>

  <section class="card">
    <h3>{S.settings.storage}</h3>
    <div>{settings?.persisted ? S.settings.persisted : S.settings.notPersisted}</div>
    {#if estimate}
      <div class="small" style="margin-top:5px">{mb(estimate.usage)} used of {mb(estimate.quota)}</div>
    {/if}
    <button class="btn wfull" style="margin-top:10px" onclick={() => router.go('#/backup')}>
      💾 Backup &amp; restore
    </button>
  </section>

  <section class="card">
    <h3>{S.settings.about}</h3>
    <div class="muted">{S.app.name} 2.0.0 · {S.misc.localOnly}</div>
  </section>
</main>

<style>
  .themes {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }
  .themes .btn {
    flex: 1;
    min-width: 120px;
  }
  .wrow {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 44px;
    cursor: pointer;
    font-weight: 600;
  }
  .wrow input {
    width: 21px;
    height: 21px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
</style>

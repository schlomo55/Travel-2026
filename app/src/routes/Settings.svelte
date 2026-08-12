<script lang="ts">
  /* Settings (plan §PHASES Phase 2).

     Four switches and no accounts. The theme switch is gone with the light
     theme (§DECISIONS: dark-only) — but a hole where a control used to be
     reads as a bug, so the Look card says out loud that there is one look and
     why. Calm motion is the only appearance setting left. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { updateSettings } from '../lib/data/repo';
  import { storageEstimate } from '../lib/db/persist';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { fmtShort, isIsoDate, ymd } from '../lib/logic/dates';
  import { asWeatherCache, WEATHER_KEY_PREFIX } from '../lib/logic/weather';
  import { S } from '../lib/i18n/strings';

  const settingsLive = live(() => db.settings.get('settings'));
  const settings = $derived(settingsLive.current);

  /* The newest fetchedAt across every cached forecast — the only evidence the
     app has that the one sanctioned network call has ever worked. */
  const weatherMetaLive = live(() => db.meta.where('key').startsWith(WEATHER_KEY_PREFIX).toArray(), {
    initial: [],
  });
  const lastWeather = $derived.by(() => {
    const rows = weatherMetaLive.current ?? [];
    let newest = 0;
    for (const r of rows) {
      const c = asWeatherCache(r.value);
      if (c && c.fetchedAt > newest) newest = c.fetchedAt;
    }
    if (!newest) return null;
    const at = new Date(newest);
    const p = (n: number): string => String(n).padStart(2, '0');
    return S.weather.lastFetch(`${fmtShort(ymd(at))}, ${p(at.getHours())}:${p(at.getMinutes())}`);
  });

  let previewInput = $state(appState.previewDate ?? '');
  let estimate = $state<{ usage: number; quota: number } | null>(null);
  $effect(() => {
    void storageEstimate().then((e) => (estimate = e));
  });

  function applyPreview(): void {
    if (isIsoDate(previewInput)) appState.setPreview(previewInput);
  }
  function mb(n: number): string {
    return (n / 1048576).toFixed(1) + ' MB';
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">{S.settings.title} <span class="pagesub">{S.settings.subtitle}</span></h1>

  <section class="card u-rise" style="--i:0">
    <h3>{S.settings.motion}</h3>
    <label class="switch">
      <input
        type="checkbox"
        checked={settings?.calmMotion === true}
        onchange={(e) => updateSettings({ calmMotion: e.currentTarget.checked })}
      />
      <span class="sw-label">{S.settings.calmMotion}</span>
    </label>
    <p class="muted" style="margin:6px 0 0">{S.settings.calmMotionHint}</p>
  </section>

  <section class="card u-rise" style="--i:1">
    <h3>{S.settings.look}</h3>
    <div class="lookrow">
      <span class="swatchset" aria-hidden="true">
        <i class="sw-paper"></i><i class="sw-card"></i><i class="sw-gold"></i><i class="sw-neon"></i>
      </span>
      <b>{S.settings.darkOnly}</b>
    </div>
    <p class="muted" style="margin:8px 0 0">{S.settings.darkOnlyHint}</p>
  </section>

  <section class="card u-rise" style="--i:2">
    <h3>🌦 {S.settings.weather}</h3>
    <label class="switch">
      <input
        type="checkbox"
        checked={settings?.weatherOnline !== false}
        onchange={(e) => updateSettings({ weatherOnline: e.currentTarget.checked })}
      />
      <span class="sw-label">{S.weather.setting}</span>
    </label>
    <p class="muted" style="margin:6px 0 0">{S.weather.settingHint}</p>
    <!-- In China the toggle is ON and every request dies, and nothing anywhere
         admitted it — a switch permanently on and permanently doing nothing.
         This breaks no vow: a diagnostic in Settings is not a spinner on Home. -->
    <p class="small" style="margin:8px 0 0">{lastWeather ?? S.weather.lastFetchNever}</p>
  </section>

  <section class="card u-rise" style="--i:3">
    <h3>{S.settings.preview}</h3>
    <p class="muted" style="margin:0 0 12px">{S.settings.previewHint}</p>
    <div class="prow">
      <input type="date" bind:value={previewInput} aria-label={S.settings.preview} />
      <button class="btn" onclick={applyPreview}>{S.settings.previewBtn}</button>
      {#if appState.previewing}
        <button class="btn ghost" onclick={() => appState.setPreview(null)}>{S.settings.previewExit}</button>
      {/if}
    </div>
  </section>

  <section class="card u-rise" style="--i:4">
    <h3>{S.settings.storage}</h3>
    <div class="statline" class:ok={settings?.persisted}>
      {settings?.persisted ? S.settings.persisted : S.settings.notPersisted}
    </div>
    {#if estimate}
      <div class="small" style="margin-top:6px">{S.settings.usedOf(mb(estimate.usage), mb(estimate.quota))}</div>
    {/if}
    <button class="btn wfull" style="margin-top:12px" onclick={() => router.go('#/backup')}>
      💾 {S.settings.backupBtn}
    </button>
  </section>

  <section class="card u-rise" style="--i:5">
    <h3>{S.settings.about}</h3>
    <div class="brandline">{S.app.name}</div>
    <div class="muted">2.0.0 · {S.misc.localOnly}</div>
  </section>
</main>

<style>
  .prow {
    display: flex;
    gap: 9px;
    align-items: stretch;
    flex-wrap: wrap;
  }
  .prow input {
    flex: 1 1 150px;
  }
  .statline {
    font-size: 14.5px;
    font-weight: 600;
  }
  .statline.ok {
    color: var(--ok);
  }
  /* the palette itself, standing in for the switch that is gone */
  .lookrow {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .lookrow b {
    font-size: 15px;
  }
  .swatchset {
    display: flex;
    gap: 5px;
    flex: 0 0 auto;
  }
  .swatchset i {
    width: 18px;
    height: 26px;
    border-radius: 5px;
    border: 1px solid var(--line-2);
  }
  .sw-paper {
    background: var(--paper);
  }
  .sw-card {
    background: var(--card-2);
  }
  .sw-gold {
    background: var(--gold);
    border-color: var(--gold);
    box-shadow: 0 0 10px rgba(232, 176, 75, 0.45);
  }
  .sw-neon {
    background: var(--neon);
    border-color: var(--neon);
  }
  .brandline {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 620;
    font-size: 21px;
    letter-spacing: 0.4px;
    color: var(--gold);
    margin-bottom: 2px;
  }
</style>

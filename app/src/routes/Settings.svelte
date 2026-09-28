<script lang="ts">
  /* SETTINGS (f-settings) — grouped rows on the night sky, each group with a
     caps label and, where it matters, a chip saying whether it needs the
     internet or stays on this phone.

     Appearance: the theme (two named choices, so a segmented control, not a
     switch), Calm motion, and Route animations — whose note has three states,
     because "on" while Calm motion holds everything still would be a lie
     (logic/motion.ts). Weather: the one sanctioned network call, and the last
     time it actually worked. Backup: Drive's honest state and a one-tap file.
     This trip: export and archive. Then the tools that were here before —
     preview a date, storage — and the about line.

     The theme writes the settings record; App.svelte paints the document from
     it and mirrors it for the boot script, so the choice survives a restart
     and is applied before the first frame (lib/logic/theme.ts). */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { mutate, updateSettings } from '../lib/data/repo';
  import { normalizeTheme } from '../lib/logic/theme';
  import { routeMotionState } from '../lib/logic/motion';
  import { storageEstimate } from '../lib/db/persist';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { fmtShort, isIsoDate, ymd } from '../lib/logic/dates';
  import { tripPhase } from '../lib/logic/phase';
  import { asWeatherCache, WEATHER_KEY_PREFIX } from '../lib/logic/weather';
  import { exportTrip, exportVault } from '../lib/data/export';
  import { isNative } from '../lib/platform/files';
  import { driveConfigured } from '../lib/data/driveConfig';
  import { readTokens } from '../lib/data/drive';
  import { driveState } from '../lib/logic/drive';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import SunMark from '../lib/components/horizon/SunMark.svelte';

  const settingsLive = live(() => db.settings.get('settings'));
  const settings = $derived(settingsLive.current);
  const theme = $derived(normalizeTheme(settings?.theme));
  const routeState = $derived(
    routeMotionState({ calmMotion: settings?.calmMotion, routeAnimations: settings?.routeAnimations }),
  );

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

  /* Drive, in the same three states its card on the Backup screen uses. */
  const configured = driveConfigured(isNative());
  const tokensLive = live(() => readTokens(), { initial: null });
  const drive = $derived(driveState({ configured, tokens: tokensLive.current ?? null }));

  /* "This trip": the one on the road today, else the last one opened here. */
  const tripsLive = live(() => db.trips.toArray(), { initial: [] });
  const thisTrip = $derived.by(() => {
    const all = tripsLive.current ?? [];
    return (
      all.find((t) => !t.archived && tripPhase(t, appState.now) === 'during') ??
      all.find((t) => t.id === settings?.activeTripId) ??
      null
    );
  });

  let previewInput = $state(appState.previewDate ?? '');
  let estimate = $state<{ usage: number; quota: number } | null>(null);
  let busy = $state(false);
  $effect(() => {
    void storageEstimate().then((e) => (estimate = e));
  });

  function applyPreview(): void {
    if (isIsoDate(previewInput)) appState.setPreview(previewInput);
  }
  function mb(n: number): string {
    return (n / 1048576).toFixed(1) + ' MB';
  }
  async function saveFile(): Promise<void> {
    busy = true;
    try {
      await exportVault();
      toast.show(S.backup.saved);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : S.backup.failed);
    }
    busy = false;
  }
  async function exportThis(): Promise<void> {
    const t = thisTrip;
    if (!t) return;
    busy = true;
    try {
      await exportTrip(t.id);
      toast.show(S.backup.savedTrip(t.title));
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : S.backup.failed);
    }
    busy = false;
  }
  async function toggleArchive(): Promise<void> {
    const t = thisTrip;
    if (!t) return;
    await mutate(() => db.trips.update(t.id, { archived: !t.archived, updatedAt: Date.now() }));
    toast.show(t.archived ? S.shelf.restored : S.shelf.archivedToast);
  }
</script>

<header class="sethead wrap">
  <button class="iconbtn" onclick={() => router.backOr('#/trips')} aria-label={S.settings.back}>
    <Icon name="chevron-left" size={20} />
  </button>
  <h1 class="display">{S.settings.title}</h1>
</header>

<main class="wrap settings">
  <!-- ---------- Appearance ---------- -->
  <div class="grouphead">
    <h2 class="caps">{S.settings.appearance}</h2>
    <span class="gchip"><Icon name="device" size={11} stroke={2} /> {S.settings.onPhone}</span>
  </div>
  <section class="group" aria-label={S.settings.appearance}>
    <div class="row col">
      <span class="rhead">
        <span class="rname">{S.settings.theme}</span>
        <span class="rnote">{S.settings.themeLine}</span>
      </span>
      <!-- Two named choices with a default is a segmented control, not a
           switch: a switch would have to label one of them as the "off" one. -->
      <div class="seg themeseg" role="group" aria-label={S.settings.theme}>
        <button class:on={theme === 'dark'} aria-pressed={theme === 'dark'} onclick={() => updateSettings({ theme: 'dark' })}>
          <Icon name="moon" size={16} stroke={2} />{S.settings.themeDark}
        </button>
        <button class:on={theme === 'light'} aria-pressed={theme === 'light'} onclick={() => updateSettings({ theme: 'light' })}>
          <Icon name="sun" size={16} stroke={2} />{S.settings.themeLight}
        </button>
      </div>
    </div>
    <div class="div" aria-hidden="true"></div>
    <label class="row switch">
      <span class="rtext">
        <span class="rname">{S.settings.calmMotion}</span>
        <span class="rsub">{S.settings.calmLine}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={settings?.calmMotion === true}
        onchange={(e) => updateSettings({ calmMotion: e.currentTarget.checked })}
      />
    </label>
    <div class="div" aria-hidden="true"></div>
    <label class="row switch">
      <span class="rtext">
        <span class="rname withflow">
          {S.settings.routeAnimations}
          <svg class="miniflow" width="58" height="10" viewBox="0 0 58 10" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="set-flow" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" style="stop-color: var(--route-lit)" />
                <stop offset="0.55" style="stop-color: var(--route-today)" />
                <stop offset="1" style="stop-color: var(--route-future)" />
              </linearGradient>
            </defs>
            <path d="M3 5 H55" stroke="url(#set-flow)" stroke-width="2.4" stroke-linecap="round" opacity="0.3" />
            <path class="flow" d="M3 5 H55" stroke="url(#set-flow)" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        </span>
        <span class="rsub">{S.settings.routeNote(routeState)}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={settings?.routeAnimations !== false}
        onchange={(e) => updateSettings({ routeAnimations: e.currentTarget.checked })}
      />
    </label>
  </section>

  <!-- ---------- Weather ---------- -->
  <div class="grouphead">
    <h2 class="caps">{S.settings.weather}</h2>
    <span class="gchip net"><Icon name="cloud" size={11} stroke={2} /> {S.settings.needsInternet}</span>
  </div>
  <section class="group" aria-label={S.settings.weather}>
    <label class="row switch">
      <span class="rtext">
        <span class="rname">{S.settings.weatherRow}</span>
        <span class="rsub">{S.settings.weatherLine}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={settings?.weatherOnline !== false}
        onchange={(e) => updateSettings({ weatherOnline: e.currentTarget.checked })}
      />
    </label>
    <!-- In China the switch is ON and every request dies, and nothing anywhere
         admitted it — a switch permanently on and permanently doing nothing.
         A diagnostic in Settings is not a spinner on the day. -->
    <p class="rfoot num">{lastWeather ?? S.weather.lastFetchNever}</p>
  </section>

  <!-- ---------- Backup ---------- -->
  <div class="grouphead"><h2 class="caps">{S.settings.backupSection}</h2></div>
  <section class="group" aria-label={S.settings.backupSection}>
    <div class="row">
      <span class="ric net" aria-hidden="true"><Icon name="cloud-up" size={18} /></span>
      <span class="rtext">
        <span class="rname">{S.settings.drive} <span class="ropt">{S.settings.optional}</span></span>
        <span class="rsub line">
          <span class="gchip net sm"><Icon name="cloud" size={10} stroke={2.2} /> {S.settings.needsInternet}</span>
          {drive === 'unconfigured' ? S.settings.driveUnconfigured : drive === 'disconnected' ? S.settings.driveDisconnected : S.settings.driveConnected}
        </span>
      </span>
      <a class="btn" href="#/backup">
        {drive === 'unconfigured' ? S.settings.driveHow : drive === 'disconnected' ? S.settings.driveSetUp : S.settings.driveOpen}
      </a>
    </div>
    <div class="div" aria-hidden="true"></div>
    <div class="row">
      <span class="ric" aria-hidden="true"><Icon name="download" size={18} /></span>
      <span class="rtext">
        <span class="rname">{S.settings.saveFile}</span>
        <span class="rsub line">
          <span class="gchip sm"><Icon name="device" size={10} stroke={2.2} /> {S.settings.onPhone}</span>
          {S.settings.saveFileSub}
        </span>
      </span>
      <button class="btn primary savebtn" disabled={busy} onclick={saveFile}>{S.settings.save}</button>
    </div>
    <div class="div" aria-hidden="true"></div>
    <a class="row link" href="#/backup">
      <span class="lic" aria-hidden="true"><Icon name="shield" size={18} /></span>
      <span class="rname grow">{S.settings.backupBtn}</span>
      <Icon name="chevron-right" size={18} class="chev" />
    </a>
  </section>

  <!-- ---------- This trip ---------- -->
  {#if thisTrip}
    <div class="grouphead"><h2 class="caps">{S.settings.thisTrip(thisTrip.title)}</h2></div>
    <section class="group" aria-label={S.settings.thisTrip(thisTrip.title)}>
      <button class="row link" disabled={busy} onclick={exportThis}>
        <span class="lic" aria-hidden="true"><Icon name="share" size={18} /></span>
        <span class="rname grow">{S.settings.exportTrip}</span>
        <Icon name="chevron-right" size={18} class="chev" />
      </button>
      <div class="div" aria-hidden="true"></div>
      <button class="row link" onclick={toggleArchive}>
        <span class="lic" aria-hidden="true"><Icon name="archive" size={18} /></span>
        <span class="rname grow">{thisTrip.archived ? S.settings.unarchive : S.settings.archive}</span>
        <Icon name="chevron-right" size={18} class="chev" />
      </button>
    </section>
  {/if}

  <!-- ---------- Preview a date ---------- -->
  <div class="grouphead"><h2 class="caps">{S.settings.preview}</h2></div>
  <section class="group pad" aria-label={S.settings.preview}>
    <p class="rsub">{S.settings.previewHint}</p>
    <div class="prow">
      <input class="num" type="date" bind:value={previewInput} aria-label={S.settings.preview} />
      <button class="btn" onclick={applyPreview}>{S.settings.previewBtn}</button>
      {#if appState.previewing}
        <button class="btn ghost" onclick={() => appState.setPreview(null)}>{S.settings.previewExit}</button>
      {/if}
    </div>
  </section>

  <!-- ---------- Storage ---------- -->
  <div class="grouphead"><h2 class="caps">{S.settings.storage}</h2></div>
  <section class="group pad" aria-label={S.settings.storage}>
    <div class="statline" class:ok={settings?.persisted}>
      {#if settings?.persisted}<Icon name="check" size={16} stroke={2.2} />{/if}
      {settings?.persisted ? S.settings.persisted : S.settings.notPersisted}
    </div>
    {#if estimate}
      <div class="rsub num">{S.settings.usedOf(mb(estimate.usage), mb(estimate.quota))}</div>
    {/if}
  </section>

  <!-- ---------- About ---------- -->
  <footer class="about" aria-label={S.settings.about}>
    <SunMark size={22} />
    <span>{S.settings.footer}</span>
  </footer>
  <p class="version num">{S.settings.version('2.0.0')}</p>
</main>

<style>
  .sethead {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: 4px;
  }
  .sethead h1 {
    margin: 0;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 40px;
  }
  .grouphead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    padding: 0 6px;
  }
  .grouphead h2 {
    margin: 0;
    color: var(--faint);
    letter-spacing: 0.16em;
  }
  .gchip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: var(--fs-caps);
    font-weight: 600;
    color: var(--ink-2);
    background: var(--card-2);
    border: 1px solid var(--edge);
    white-space: nowrap;
  }
  .gchip.net {
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border-color: var(--lilac-line);
  }
  .gchip.sm {
    height: 20px;
    padding: 0 7px;
    gap: 4px;
  }
  .group {
    display: flex;
    flex-direction: column;
    border-radius: 26px;
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  .group.pad {
    padding: 14px 16px;
    gap: 8px;
  }
  .div {
    height: 1px;
    margin: 0 16px;
    background: var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 12px 10px 16px;
  }
  .row.col {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 14px 16px;
  }
  .row.switch {
    padding-right: 16px;
  }
  .rhead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .rtext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .rname {
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
  }
  .rname.grow {
    flex: 1;
  }
  .withflow {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ropt {
    font-weight: 500;
    color: var(--faint);
  }
  .rnote {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .rsub {
    margin: 0;
    font-size: var(--fs-chip);
    font-weight: 500;
    line-height: 1.35;
    color: var(--ink-2);
  }
  .rsub.line {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .rfoot {
    margin: -4px 16px 12px;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .themeseg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
  }
  .themeseg button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: var(--fs-label);
  }
  .ric {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    color: var(--ink);
    background: var(--card-2);
  }
  .ric.net {
    color: var(--lilac-ink);
    background: var(--lilac-soft);
  }
  .savebtn {
    min-height: 44px;
    padding: 0 16px;
    font-size: var(--fs-label);
  }
  .row.link {
    min-height: 52px;
    width: 100%;
    padding: 0 16px;
    border: none;
    border-radius: 0;
    background: none;
    text-align: left;
    text-decoration: none;
    color: var(--ink);
  }
  .row.link:active {
    background: var(--card-2);
  }
  .lic {
    display: flex;
    color: var(--ink-2);
  }
  .row.link :global(.chev) {
    color: var(--faint);
  }
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
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .statline.ok {
    color: var(--ok-ink);
  }
  .about {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 22px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .version {
    margin: 0;
    text-align: center;
    font-size: var(--fs-caps);
    color: var(--faint);
  }
</style>

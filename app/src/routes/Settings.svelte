<script lang="ts">
  /* SETTINGS (f-settings) — grouped rows on the night sky, each group with a
     caps label and, where it matters, a chip saying whether it needs the
     internet or stays on this phone.

     Appearance: Calm motion, and Route animations — whose note has three
     states, because "on" while Calm motion holds everything still would be a
     lie (logic/motion.ts). The app is dark only since Run 4 (owner,
     2026-09-28), so there is no theme to choose. Weather: the one sanctioned
     network call, and the last time it actually worked. Backup: Drive's
     honest state and a one-tap file. This trip: export and archive. Then the
     tools that were here before — preview a date, storage — and the about
     line. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { mutate, updateSettings } from '../lib/data/repo';
  import { routeMotionState } from '../lib/logic/motion';
  import { storageEstimate } from '../lib/db/persist';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { fmtLong, fmtShort, isIsoDate, ymd } from '../lib/logic/dates';
  import { tripPhase } from '../lib/logic/phase';
  import { asWeatherCache, WEATHER_KEY_PREFIX } from '../lib/logic/weather';
  import { exportTrip, exportVault } from '../lib/data/export';
  import { isNative } from '../lib/platform/files';
  import { driveConfigured } from '../lib/data/driveConfig';
  import { readTokens } from '../lib/data/drive';
  import { driveState } from '../lib/logic/drive';
  import { S } from '../lib/i18n/strings';
  import { SP } from '../lib/i18n/photos';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import SunMark from '../lib/components/horizon/SunMark.svelte';
  import { offscreen } from '../lib/motion/offscreen';
  import PackImport from '../lib/components/map/PackImport.svelte';
  import PhotoCredits from '../lib/components/map/PhotoCredits.svelte';
  import { packInfo, packPhotos, packSize, removePack, type PackInfo } from '../lib/map/pack';
  import type { PhotoIndex } from '../lib/logic/placephotos';
  import { R } from '../lib/i18n/reminders';
  import { reminderPrefs } from '../lib/logic/notify';
  import { fmtDowDay } from '../lib/logic/dates';
  import { NAV_PREFS } from '../lib/state/navApp.svelte';
  import {
    exactAllowed,
    notificationsAllowed,
    openExactSetting,
    readStatus,
    sendTest,
    setPrefs,
    syncReminders,
    turnOn,
    type Allowed,
    type SyncStatus,
  } from '../lib/platform/reminders';

  const settingsLive = live(() => db.settings.get('settings'));
  const settings = $derived(settingsLive.current);
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

  /* THE MAP PACK ON THIS PHONE (Map 5c): what it is, how big, how old its
     OpenStreetMap data is — and Replace, and a two-tap Delete. */
  let pack = $state<PackInfo | null | undefined>(undefined);
  let packArmed = $state(false);
  $effect(() => {
    void packInfo().then((p) => (pack = p));
  });
  /* REMINDERS (the Reminders run): phone-scheduled, so the group only works
     in the Android app; a browser gets one honest line instead. */
  const native = isNative();
  const rp = $derived(reminderPrefs(settings?.reminders));
  let allowed = $state<Allowed | null>(null);
  let exact = $state<boolean | null>(null);
  let status = $state<SyncStatus | null>(null);
  async function refreshReminders(): Promise<void> {
    if (!native) return;
    allowed = await notificationsAllowed().catch(() => null);
    exact = await exactAllowed().catch(() => null);
    status = await readStatus();
  }
  $effect(() => {
    void refreshReminders();
    /* Coming back from Android's own settings page is a visibility change. */
    const onVis = (): void => {
      if (!document.hidden) void syncReminders().then(refreshReminders);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });
  async function master(on: boolean, el: HTMLInputElement): Promise<void> {
    if (on) {
      const ok = await turnOn();
      if (!ok) el.checked = false;
    } else await setPrefs({ on: false });
    await refreshReminders();
  }
  async function pref(patch: Parameters<typeof setPrefs>[0]): Promise<void> {
    await setPrefs(patch);
    status = await readStatus();
  }
  function whenLine(at: number): string {
    const d = new Date(at);
    const p2 = (n: number): string => String(n).padStart(2, '0');
    return `${fmtDowDay(ymd(d))}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  const REMINDER_ROWS = [
    ['alarms', R.alarms, R.alarmsSub],
    ['legs', R.legs, R.legsSub],
    ['tasks', R.tasks, R.tasksSub],
    ['visa', R.visa, R.visaSub],
    ['backup', R.backupRow, R.backupRowSub],
    ['travelCard', R.travelCardRow, R.travelCardRowSub],
    ['morning', R.morningRow, R.morningRowSub],
    ['evening', R.eveningRow, R.eveningRowSub],
  ] as const;

  async function deletePack(): Promise<void> {
    if (!packArmed) {
      packArmed = true;
      return;
    }
    packArmed = false;
    await removePack();
    pack = null;
    toast.show(S.mapTab.packDeleted);
  }
  /* PHOTO CREDITS (Map 5e): who took each of the pack's photos, and its
     licence — read from the pack when the sheet opens */
  let credits = $state<{ index: PhotoIndex | null } | null>(null);
  async function openCredits(): Promise<void> {
    credits = { index: await packPhotos() };
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
            <path class="flow" d="M3 5 H55" stroke="url(#set-flow)" stroke-width="2.4" stroke-linecap="round" use:offscreen />
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

  <!-- ---------- Turn-by-turn: which app directions open in (demo) ---------- -->
  <div class="grouphead">
    <h2 class="caps">{S.settings.navGroup}</h2>
    <span class="gchip"><Icon name="device" size={11} stroke={2} /> {S.settings.onPhone}</span>
  </div>
  <section class="group" aria-label={S.settings.navGroup}>
    <div class="row">
      <span class="rtext">
        <span class="rname">{S.settings.navLead}</span>
        <span class="rsub">{S.settings.navSub[settings?.navApp ?? 'auto']}</span>
      </span>
      <div class="seg" role="radiogroup" aria-label={S.settings.navLead}>
        {#each NAV_PREFS as p (p)}
          <button
            class="segbtn"
            role="radio"
            aria-checked={(settings?.navApp ?? 'auto') === p}
            onclick={() => void updateSettings({ navApp: p })}>{S.settings.navOpt[p]}</button
          >
        {/each}
      </div>
    </div>
  </section>

  <!-- ---------- Reminders (the Reminders run) ---------- -->
  <div class="grouphead">
    <h2 class="caps">{R.group}</h2>
    <span class="gchip"><Icon name="device" size={11} stroke={2} /> {S.settings.onPhone}</span>
  </div>
  <section class="group" aria-label={R.group} data-testid="reminders">
    {#if !native}
      <p class="rnote">{R.webOnly}</p>
    {:else}
      <label class="row switch">
        <span class="ric" aria-hidden="true"><Icon name="bell" size={18} /></span>
        <span class="rtext">
          <span class="rname">{R.master}</span>
          <span class="rsub">{R.masterSub}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={rp.on}
          onchange={(e) => void master(e.currentTarget.checked, e.currentTarget)}
        />
      </label>
      {#if rp.on}
        {#each REMINDER_ROWS as [key, name, sub] (key)}
          <div class="div" aria-hidden="true"></div>
          <label class="row switch">
            <span class="rtext">
              <span class="rname">{name}</span>
              <span class="rsub">{sub}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={rp[key]}
              onchange={(e) => void pref({ [key]: e.currentTarget.checked })}
            />
          </label>
        {/each}
        <div class="div" aria-hidden="true"></div>
        <div class="row">
          <span class="rtext"><span class="rname">{R.lead}</span></span>
          <div class="seg" role="radiogroup" aria-label={R.lead}>
            {#each [0, 10, 30, 60] as m (m)}
              <button
                class="segbtn"
                role="radio"
                aria-checked={rp.lead === m}
                onclick={() => void pref({ lead: m })}>{m === 0 ? R.leadOff : R.leadMins(m)}</button
              >
            {/each}
          </div>
        </div>
        <div class="div" aria-hidden="true"></div>
        <label class="row switch">
          <span class="rtext">
            <span class="rname">{R.quiet}</span>
            <span class="rsub">{R.quietSub}</span>
          </span>
          <input type="checkbox" role="switch" checked={rp.quiet} onchange={(e) => void pref({ quiet: e.currentTarget.checked })} />
        </label>
        {#if rp.quiet}
          <div class="qrow">
            <input
              class="num"
              type="time"
              aria-label={`${R.quiet} · from`}
              value={rp.quietFrom}
              onchange={(e) => e.currentTarget.value && void pref({ quietFrom: e.currentTarget.value })}
            />
            <span aria-hidden="true">–</span>
            <input
              class="num"
              type="time"
              aria-label={`${R.quiet} · until`}
              value={rp.quietTo}
              onchange={(e) => e.currentTarget.value && void pref({ quietTo: e.currentTarget.value })}
            />
          </div>
        {/if}
        <div class="div" aria-hidden="true"></div>
        <div class="row">
          <span class="rtext">
            <span class="rname">{R.allowed}</span>
            {#if allowed === 'denied'}<span class="rsub">{R.allowedDenied}</span>{/if}
          </span>
          {#if allowed === 'granted'}
            <span class="okline"><Icon name="check" size={16} stroke={2.2} /> {R.allowedYes}</span>
          {:else}
            <button class="btn" onclick={() => void turnOn().then(refreshReminders)}>{R.allowedAsk}</button>
          {/if}
        </div>
        <div class="div" aria-hidden="true"></div>
        <div class="row">
          <span class="rtext">
            <span class="rname">{R.exact}</span>
            <span class="rsub">{R.exactSub}</span>
          </span>
          {#if exact}
            <span class="okline"><Icon name="check" size={16} stroke={2.2} /> {R.exactYes}</span>
          {:else}
            <button class="btn" onclick={() => void openExactSetting()}>{R.exactAllow}</button>
          {/if}
        </div>
        <div class="div" aria-hidden="true"></div>
        <div class="row">
          <span class="rtext">
            <span class="rname">{R.samsung}</span>
            <span class="rsub">{R.samsungSub}</span>
          </span>
        </div>
        <div class="div" aria-hidden="true"></div>
        <div class="row">
          <span class="rtext">
            <span class="rname">{status?.count ? R.count(status.count) : R.nextNone}</span>
            {#if status?.next}<span class="rsub num">{R.next(status.next.title, whenLine(status.next.at))}</span>{/if}
          </span>
          <button class="btn primary savebtn" onclick={() => void sendTest()}>{R.test}</button>
        </div>
      {/if}
    {/if}
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
    {#if configured}
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
    {/if}
    <div class="row">
      <span class="ric" aria-hidden="true"><Icon name="download" size={18} /></span>
      <span class="rtext">
        <span class="rname">{native ? S.backup.saveToDrive : S.settings.saveFile}</span>
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

  <!-- ---------- The map pack (Map 5c) ---------- -->
  <div class="grouphead">
    <h2 class="caps">{S.mapTab.packGroup}</h2>
    <span class="gchip"><Icon name="device" size={11} stroke={2} /> {S.settings.onPhone}</span>
  </div>
  <section class="group pad mappack" aria-label={S.mapTab.packGroup}>
    {#if pack}
      <div class="mp-row">
        <span class="ric" aria-hidden="true"><Icon name="map" size={18} /></span>
        <span class="rtext">
          <span class="rname">{pack.trip ? S.mapTab.packName(pack.trip) : S.mapTab.packGroup}</span>
          <span class="rsub num">{S.mapTab.packLine(packSize(pack.bytes), pack.osmDate ? fmtLong(pack.osmDate) : '—', pack.areas?.length ?? 0)}{pack.photos ? ` · ${S.mapTab.packPhotos(pack.photos.count)}` : ''}</span>
        </span>
        <button class="btn danger mp-del" onclick={deletePack} onblur={() => (packArmed = false)}>
          {packArmed ? S.mapTab.packDeleteArm : S.mapTab.packDelete}
        </button>
      </div>
      {#if pack.photos}
        <button class="row link mp-credits" onclick={() => void openCredits()}>
          <span class="lic" aria-hidden="true"><Icon name="image" size={18} /></span>
          <span class="rtext grow">
            <span class="rname">{SP.credits}</span>
            <span class="rsub">{SP.creditsLine(pack.photos.count)}</span>
          </span>
          <Icon name="chevron-right" size={18} class="chev" />
        </button>
      {/if}
      <PackImport replace primary={false} onimported={(p) => (pack = p)} />
    {:else if pack === null}
      <div class="mp-row">
        <span class="ric" aria-hidden="true"><Icon name="map" size={18} /></span>
        <span class="rtext">
          <span class="rname">{S.mapTab.packNone}</span>
          <span class="rsub">{S.mapTab.packNoneLine}</span>
        </span>
      </div>
      <PackImport primary={false} onimported={(p) => (pack = p)} />
    {/if}
  </section>

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

{#if credits}
  <PhotoCredits index={credits.index} onclose={() => (credits = null)} />
{/if}

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
  .row.switch {
    padding-right: 16px;
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
  /* the map pack (Map 5c): what is here, then Replace / Import */
  .mappack {
    gap: 12px;
  }
  .mp-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mp-del {
    flex-shrink: 0;
    min-height: 44px;
    padding: 0 14px;
    font-size: var(--fs-label);
  }
  /* Photo credits (Map 5e): a row of the group, edge to edge */
  .row.link.mp-credits {
    width: calc(100% + 32px);
    min-height: 60px;
    margin: 0 -16px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
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
  /* a row fills its group, which clips: the focus ring goes inside */
  .row.link:focus-visible {
    outline-offset: -4px;
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
  /* Reminders (the Reminders run) */
  .rnote {
    margin: 0;
    padding: 14px 16px;
    font-size: var(--fs-chip);
    line-height: 1.4;
    color: var(--ink-2);
  }
  /* at 384 px the four segments and their label share one row only just:
     the label goes above rather than squeeze */
  .row:has(.seg) {
    flex-wrap: wrap;
  }
  .seg {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--card-2);
  }
  .segbtn {
    min-width: 44px;
    min-height: 44px;
    padding: 0 8px;
    border: none;
    border-radius: 9px;
    background: none;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
  }
  .segbtn[aria-checked='true'] {
    background: var(--card);
    color: var(--ink);
    box-shadow: var(--shadow-card);
  }
  .qrow {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 16px 14px;
    color: var(--ink-2);
  }
  .qrow input {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
  }
  .okline {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ok-ink);
  }
  .version {
    margin: 0;
    text-align: center;
    font-size: var(--fs-caps);
    color: var(--faint);
  }
</style>

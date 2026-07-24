<script lang="ts">
  import { db } from './lib/db/db';
  import { live } from './lib/data/live.svelte';
  import { getSettings } from './lib/data/repo';
  import { requestPersistence } from './lib/db/persist';
  import { appState } from './lib/state/appState.svelte';
  import { router } from './lib/state/router.svelte';
  import { S } from './lib/i18n/strings';
  import { fmtDow } from './lib/logic/dates';
  import Toasts from './lib/components/ui/Toasts.svelte';
  import TripsHome from './routes/TripsHome.svelte';
  import TripShell from './routes/TripShell.svelte';
  import Settings from './routes/Settings.svelte';
  import Backup from './routes/Backup.svelte';

  router.start();
  appState.start();

  const settingsLive = live(() => db.settings.get('settings'));
  const theme = $derived(settingsLive.current?.theme ?? 'system');

  $effect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  });

  /* '#/' resolves to the last-open trip when there is one. */
  $effect(() => {
    if (router.route.name !== 'redirect') return;
    void (async () => {
      const s = await getSettings();
      const target = s.activeTripId && (await db.trips.get(s.activeTripId));
      router.replace(target ? `#/trip/${target.id}/today` : '#/trips');
    })();
  });

  /* Ask for storage persistence on the first real interaction. */
  $effect(() => {
    const once = (): void => {
      void requestPersistence();
      window.removeEventListener('pointerdown', once);
    };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  });
</script>

{#if router.route.name === 'trip'}
  <TripShell tripId={router.route.tripId} tab={router.route.tab} sub={router.route.sub} />
{:else}
  <header class="appbar">
    <div class="in wrap">
      <button class="brandbtn" onclick={() => router.go('#/trips')}>{S.app.name}</button>
      <button
        class="iconbtn"
        onclick={() => router.go(router.route.name === 'settings' ? '#/trips' : '#/settings')}
        aria-label={S.settings.title}>{router.route.name === 'settings' ? '✕' : '⚙'}</button
      >
    </div>
  </header>

  {#if router.route.name === 'settings'}
    <Settings />
  {:else if router.route.name === 'backup'}
    <Backup />
  {:else}
    <TripsHome />
  {/if}
{/if}

{#if appState.previewing && appState.previewDate}
  <button class="previewpill" onclick={() => appState.setPreview(null)}>
    👁 {S.settings.previewNow(fmtDow(appState.previewDate))}
  </button>
{/if}

<Toasts />

<style>
  .brandbtn {
    background: none;
    border: none;
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 620;
    font-size: 21px;
    letter-spacing: 0.4px;
    color: var(--ink);
    padding: 0;
  }
  .iconbtn {
    margin-left: auto;
    background: var(--card);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    width: 38px;
    height: 38px;
    font-size: 15px;
    color: var(--ink-2);
  }
  .previewpill {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 58px);
    z-index: 80;
    background: var(--card);
    color: var(--warn);
    border: 1px solid color-mix(in srgb, var(--warn) 55%, var(--line));
    border-radius: 999px;
    padding: 7px 15px;
    font-size: 12.5px;
    font-weight: 700;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    max-width: 92vw;
  }
</style>

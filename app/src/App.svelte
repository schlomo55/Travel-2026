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

  /* Lantern is dark-only, so the only look setting left is motion.
     `html.calm` collapses every animation and transition in app.css —
     the phone's own prefers-reduced-motion does the same, independently. */
  const calmMotion = $derived(settingsLive.current?.calmMotion === true);
  $effect(() => {
    document.documentElement.classList.toggle('calm', calmMotion);
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

<!-- THE FAKE-DATE WARNING BELONGS WHERE DATES ARE READ, and it must not be
     ON them: the old pill was fixed at nav-h + 58 px — mid-card — and in the
     capture it covered the CHECK-IN row of the very stay card whose dates it
     was faking. It is a full-width strip at the head of the page now, taking
     real layout space so it can never overlap anything, and the app bar's own
     status pill goes dashed-warn for as long as the preview lasts (TripShell)
     so the warning survives scrolling. -->
{#if appState.previewing && appState.previewDate}
  <button class="previewstrip" onclick={() => appState.setPreview(null)}>
    👁 {S.settings.previewNow(fmtDow(appState.previewDate))}
  </button>
{/if}

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
    color: var(--gold);
    padding: 0;
  }
  /* 38 px in the top-right corner of a 6.8" screen: under the floor, in the
     spot a right thumb reaches last. The floor is the floor. */
  .iconbtn {
    margin-left: auto;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 15px;
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .previewstrip {
    display: block;
    width: 100%;
    background: var(--warn);
    color: var(--on-accent);
    border: none;
    border-radius: 0;
    padding: calc(env(safe-area-inset-top) + 8px) 14px 8px;
    font-size: 12.5px;
    font-weight: 750;
    letter-spacing: 0.3px;
    text-align: center;
    min-height: 40px;
  }
</style>

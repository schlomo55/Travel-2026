<script lang="ts">
  import { untrack } from 'svelte';
  import { db } from './lib/db/db';
  import { live } from './lib/data/live.svelte';
  import { getSettings } from './lib/data/repo';
  import { requestPersistence } from './lib/db/persist';
  import { appState } from './lib/state/appState.svelte';
  import { router } from './lib/state/router.svelte';
  import { screenShown, startScrollMemory } from './lib/state/scroll';
  import { motion } from './lib/state/motion.svelte';
  import { S } from './lib/i18n/strings';
  import { fmtDow } from './lib/logic/dates';
  import { motionClasses } from './lib/logic/motion';
  import Toasts from './lib/components/ui/Toasts.svelte';
  import Icon from './lib/components/horizon/Icon.svelte';
  import TripsHome from './routes/TripsHome.svelte';
  import TripShell from './routes/TripShell.svelte';
  import { once } from './lib/state/lazy';

  /* Settings and Backup are opened a few times a trip: their chunks load the
     first time they are shown, not on every cold start (lib/state/lazy.ts). */
  const settingsScreen = once(() => import('./routes/Settings.svelte').then((m) => m.default));
  const backupScreen = once(() => import('./routes/Backup.svelte').then((m) => m.default));

  router.start();
  appState.start();
  startScrollMemory();

  /* WHERE A SCREEN OPENS (Map 5d): stepped to, at its top; stepped back to,
     where it was left — for every screen of the app (lib/state/scroll.ts). */
  $effect(() => {
    void router.hash;
    untrack(() => screenShown(router.route));
  });

  const settingsLive = live(() => db.settings.get('settings'));

  /* THE MOTION SWITCHES, painted onto <html> as classes app.css keys off:
     `calm` (Calm motion — every motion to its end state; the phone's own
     reduce-motion does the same, independently), `no-routes` (Route
     animations off — the route lines stand still) and `app-hidden` (nothing
     moves while the app is not on screen). The decision is pure
     (logic/motion.ts); this only applies it. */
  let hidden = $state(typeof document !== 'undefined' && document.hidden);
  $effect(() => {
    const onVis = (): void => {
      hidden = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });
  $effect(() => {
    const s = settingsLive.current;
    const want = motionClasses({ calmMotion: s?.calmMotion, routeAnimations: s?.routeAnimations, hidden });
    const root = document.documentElement;
    for (const c of ['calm', 'no-routes', 'app-hidden'] as const) root.classList.toggle(c, want.includes(c));
    motion.classes = want;
    motion.known = settingsLive.loaded || !!settingsLive.error;
  });

  /* '#/' resolves to the last-open trip when there is one. */
  $effect(() => {
    if (router.route.name !== 'redirect') return;
    void (async () => {
      const s = await getSettings();
      const target = s.activeTripId && (await db.trips.get(s.activeTripId));
      router.replace(target ? `#/trip/${target.id}/now` : '#/trips');
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
     ON them: a full-width strip at the head of the page, taking real layout
     space so it can never overlap anything, while the trip bar's status pill
     goes dashed-warn for as long as the preview lasts. -->
{#if appState.previewing && appState.previewDate}
  <button class="previewstrip" onclick={() => appState.setPreview(null)}>
    <Icon name="eye" size={16} />
    {S.settings.previewNow(fmtDow(appState.previewDate))}
  </button>
{/if}

{#if router.route.name === 'trip'}
  <TripShell tripId={router.route.tripId} place={router.route.place} sub={router.route.sub} view={router.route.view} />
{:else if router.route.name === 'settings' || router.route.name === 'backup'}
  {#await router.route.name === 'settings' ? settingsScreen() : backupScreen()}
    <p class="lazywait" role="status">{S.misc.opening}</p>
  {:then Screen}
    <Screen />
  {:catch}
    <p class="lazywait fail" role="alert">{S.misc.openFailed}</p>
  {/await}
{:else}
  <TripsHome />
{/if}

<Toasts />

<style>
  .previewstrip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    /* the amber wash over a card, the ground the contrast gate measures
       warn-ink on (warn-soft@card) */
    background: linear-gradient(var(--warn-soft), var(--warn-soft)), var(--card);
    color: var(--warn-ink);
    border: none;
    border-bottom: 1px dashed var(--warn-line);
    border-radius: 0;
    padding: calc(env(safe-area-inset-top) + 8px) 14px 8px;
    font-size: var(--fs-caption);
    font-weight: 700;
    text-align: center;
    min-height: 44px;
  }
  /* edge to edge at the top of the page: the ring goes inside, where it
     can be seen */
  .previewstrip:focus-visible {
    outline-offset: -4px;
  }
</style>

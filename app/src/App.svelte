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
  import { navApp } from './lib/state/navApp.svelte';
  import { S } from './lib/i18n/strings';
  import { fmtDow } from './lib/logic/dates';
  import { motionClasses } from './lib/logic/motion';
  import Toasts from './lib/components/ui/Toasts.svelte';
  import Icon from './lib/components/horizon/Icon.svelte';
  import TripsHome from './routes/TripsHome.svelte';
  import TripShell from './routes/TripShell.svelte';
  import { once } from './lib/state/lazy';
  import { FIND_PROXY_ID } from './routes/Find.svelte';

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
  /* which app turn-by-turn opens in (Settings › Turn-by-turn) */
  $effect(() => {
    navApp.pref = settingsLive.current?.navApp ?? 'auto';
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

  /* --preview-bar-h: the preview strip's height on :root (see the markup
     below); 0px whenever it is not shown. */
  let barH = $state(0);
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty('--preview-bar-h', appState.previewing && appState.previewDate ? `${barH}px` : '0px');
    return () => root.style.setProperty('--preview-bar-h', '0px');
  });

  /* THE FIND TAB OPENS WITH THE KEYBOARD UP. Android's WebView only raises the
     keyboard for a focus() made inside the tap itself, and Find's own box does
     not exist yet at that moment (it mounts a render later). So the tap on the
     Find button focuses a hidden stand-in box right away — the keyboard opens
     with the tap — and Find, once mounted, hands the focus to its real box
     (routes/Find.svelte), which keeps the keyboard up. Back from a result is
     not a tap on that button, so it never pops the keyboard over the results. */
  $effect(() => {
    const proxy = document.createElement('input');
    proxy.id = FIND_PROXY_ID;
    proxy.type = 'text';
    proxy.tabIndex = -1;
    proxy.autocomplete = 'off';
    proxy.setAttribute('aria-hidden', 'true');
    proxy.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;pointer-events:none;font-size:16px;';
    document.body.appendChild(proxy);
    const onTap = (e: Event): void => {
      const a = (e.target as Element | null)?.closest?.('a.findbtn');
      if (!a || /\/find$/.test(location.hash)) return;
      proxy.focus({ preventScroll: true });
      /* if Find never takes it (the trip didn't open), let go again */
      setTimeout(() => {
        if (document.activeElement === proxy) proxy.blur();
      }, 1200);
    };
    document.addEventListener('click', onTap, true);
    return () => {
      document.removeEventListener('click', onTap, true);
      proxy.remove();
    };
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
     space (the slot) so it can never cover anything, while the trip bar's
     status pill goes dashed-warn for as long as the preview lasts.

     The strip itself is FIXED to the top of the window, so scrolling a long
     screen (Settings) can never slide it up under the Android status bar, and
     it stays tappable on every screen, the Map included. It paints its own
     background up behind the (transparent, edge-to-edge) status bar and keeps
     its text below it with env(safe-area-inset-top).

     --preview-bar-h (on :root, 0px when not previewing) is the strip's whole
     height, status-bar inset INCLUDED. A screen with its own fixed top overlay
     (the Map) clears the strip with  max(env(safe-area-inset-top),
     var(--preview-bar-h))  in place of the bare inset. -->
{#if appState.previewing && appState.previewDate}
  <div class="previewslot" style:height="{barH}px">
    <button class="previewstrip" bind:offsetHeight={barH} onclick={() => appState.setPreview(null)}>
      <Icon name="eye" size={16} />
      {S.settings.previewNow(fmtDow(appState.previewDate))}
    </button>
  </div>
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
  .previewslot {
    /* the room the fixed strip takes in the page flow */
    display: block;
  }
  .previewstrip {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 58; /* over every screen, under the nav (60), sheets (70) and full-screen layers (100) */
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

<script lang="ts">
  import { router, type TabName } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';

  let { tripId, active }: { tripId: string; active: TabName } = $props();

  /* Inline stroke icons inherit currentColor, so they follow the theme and the
     per-trip accent — unlike emoji, which render as fixed-colour Noto blobs. */
  const tabs: { tab: TabName; d: string; label: string }[] = [
    { tab: 'today', d: 'M3 10.5 12 3l9 7.5 M5 9.3V21h14V9.3', label: S.tabs.today },
    { tab: 'itinerary', d: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z M9 4v14 M15 6v14', label: S.tabs.plan },
    {
      tab: 'wallet',
      d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z M13 5v2 M13 11v2 M13 17v2',
      label: S.tabs.wallet,
    },
    { tab: 'tasks', d: 'M21 11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11 M8 11l3 3 9-9', label: S.tabs.tasks },
    { tab: 'info', d: 'M12 3a9 9 0 1 0 .01 0Z M12 11v5 M12 8h.01', label: S.tabs.info },
  ];
</script>

<nav class="tabbar" aria-label="Trip navigation">
  <div class="in">
    {#each tabs as t (t.tab)}
      <button class:on={active === t.tab} onclick={() => router.goTab(tripId, t.tab)}>
        <svg
          class="ic"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d={t.d} /></svg
        >
        {t.label}
        <span class="dot" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 10px);
    z-index: 60;
    pointer-events: none;
  }
  .in {
    pointer-events: auto;
    width: min(440px, calc(100% - 28px));
    margin: 0 auto;
    display: flex;
    background: color-mix(in srgb, var(--card) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    border-radius: 32px;
    box-shadow: var(--shadow-card);
    padding: 4px;
  }
  button {
    flex: 1;
    background: none;
    border: none;
    border-radius: 28px;
    padding: 7px 2px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: var(--faint);
    font-size: 10.5px;
    font-weight: 650;
    letter-spacing: 0.4px;
    min-height: 56px;
  }
  .ic {
    width: 22px;
    height: 22px;
  }
  button.on {
    color: var(--accent-deep);
  }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: transparent;
  }
  button.on .dot {
    background: var(--accent-deep);
  }
</style>

<script lang="ts">
  import { router, type TabName } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';

  let { tripId, active }: { tripId: string; active: TabName } = $props();

  const tabs: { tab: TabName; icon: string; label: string }[] = [
    { tab: 'today', icon: '🏠', label: S.tabs.today },
    { tab: 'itinerary', icon: '🗺️', label: S.tabs.plan },
    { tab: 'wallet', icon: '🎫', label: S.tabs.wallet },
    { tab: 'tasks', icon: '✅', label: S.tabs.tasks },
    { tab: 'info', icon: 'ℹ️', label: S.tabs.info },
  ];
</script>

<nav class="tabbar" aria-label="Trip navigation">
  <div class="in">
    {#each tabs as t (t.tab)}
      <button class:on={active === t.tab} onclick={() => router.goTab(tripId, t.tab)}>
        <span class="ic" aria-hidden="true">{t.icon}</span>{t.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .in {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
  }
  button {
    flex: 1;
    background: none;
    border: none;
    padding: 8px 2px 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: var(--faint);
    font-size: 10.5px;
    font-weight: 650;
    letter-spacing: 0.4px;
    min-height: var(--nav-h);
    position: relative;
  }
  button .ic {
    font-size: 20px;
    line-height: 1.2;
    filter: grayscale(1) opacity(0.55);
  }
  button.on {
    color: var(--ink);
  }
  button.on .ic {
    filter: none;
  }
  button.on::before {
    content: '';
    position: absolute;
    top: 0;
    left: 30%;
    right: 30%;
    height: 3px;
    background: var(--accent);
    border-radius: 0 0 4px 4px;
  }
</style>

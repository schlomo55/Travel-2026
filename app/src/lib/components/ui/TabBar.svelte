<script lang="ts">
  /* The floating pill (plan §SCREENS, tab bar): blurred dark glass, five tabs,
     one family of Lucide-style stroke icons. Gold glyph + label + glow on the
     active tab; everything else rests in --faint, which is the one ink tier
     below body text that still passes 4.5:1 on the pill (LANTERN §8).

     Inline SVG rather than emoji: a stroke inherits currentColor, so the whole
     set lights up gold in one rule, and none of it needs a font. */
  import { router, type TabName } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';

  let { tripId, active }: { tripId: string; active: TabName } = $props();

  const tabs: { tab: TabName; d: string[]; label: string }[] = [
    { tab: 'today', d: ['M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], label: S.tabs.home },
    {
      tab: 'itinerary',
      d: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 7h8', 'M8 11h8', 'M8 15h5'],
      label: S.tabs.plans,
    },
    {
      tab: 'wallet',
      d: ['M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M3 10h18', 'M16 15h2'],
      label: S.tabs.wallet,
    },
    {
      tab: 'tasks',
      d: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
      label: S.tabs.lists,
    },
    { tab: 'info', d: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 8h.01', 'M12 11v5'], label: S.tabs.info },
  ];
</script>

<nav class="tabbar" aria-label="Trip navigation">
  <div class="in">
    {#each tabs as t (t.tab)}
      <button class:on={active === t.tab} aria-pressed={active === t.tab} onclick={() => router.goTab(tripId, t.tab)}>
        <svg
          class="ic"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {#each t.d as d, i (i)}<path {d} />{/each}
        </svg>
        <span class="lb">{t.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom) + 12px);
    z-index: 60;
    pointer-events: none;
  }
  .in {
    pointer-events: auto;
    width: min(440px, calc(100% - 28px));
    margin: 0 auto;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: color-mix(in srgb, var(--paper-2) 84%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--line);
    border-radius: 30px;
    box-shadow: var(--glow-1);
    padding: 8px 6px 6px;
  }
  button {
    flex: 1;
    background: none;
    border: none;
    border-radius: 24px;
    padding: 4px 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    color: var(--faint);
    min-height: 52px;
    transition: color var(--motion-fast) var(--ease-out);
  }
  .ic {
    width: 22px;
    height: 22px;
  }
  .lb {
    font-size: var(--text-xs);
    font-weight: 650;
    letter-spacing: 0.3px;
  }
  button.on {
    color: var(--gold);
  }
  button.on .ic {
    filter: var(--glow-glyph);
  }
</style>

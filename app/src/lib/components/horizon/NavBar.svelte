<script lang="ts">
  /* THE NAV (system/components/NavBar): three places — Now, Journey, Pocket —
     on a floating bar, and the round Find button beside it. Every item is a
     real link to its place; the current one is sunrise with a 4 px sun under
     its label, and carries aria-current. Shown everywhere in a trip except the
     full-screen modes, which are layers drawn above it.

     Placement is the board's, to the pixel: 16 px from the left and the
     bottom, 84 px from the right so Find has its own 52 px circle. */
  import type { Place } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from './Icon.svelte';

  let { tripId, active }: { tripId: string; active: Place | null } = $props();

  const items: { place: Place; icon: string; label: string }[] = [
    { place: 'now', icon: 'sun', label: S.nav.now },
    { place: 'journey', icon: 'route', label: S.nav.journey },
    { place: 'pocket', icon: 'pouch', label: S.nav.pocket },
  ];
  const href = (p: Place): string => `#/trip/${encodeURIComponent(tripId)}/${p}`;
</script>

<nav class="navbar" aria-label={S.nav.label}>
  {#each items as it (it.place)}
    <a
      class="navitem"
      class:on={active === it.place}
      href={href(it.place)}
      data-place={it.place}
      aria-current={active === it.place ? 'page' : undefined}
    >
      <Icon name={it.icon} size={22} />
      <span class="lb">{it.label}</span>
      <span class="sundot" aria-hidden="true"></span>
    </a>
  {/each}
</nav>
<a
  class="findbtn"
  class:on={active === 'find'}
  href={href('find')}
  aria-label={S.nav.find}
  aria-current={active === 'find' ? 'page' : undefined}
>
  <Icon name="search" size={20} stroke={active === 'find' ? 2.1 : 1.8} />
</a>

<style>
  .navbar {
    position: fixed;
    left: 16px;
    right: 84px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    height: 64px;
    z-index: 60;
    display: flex;
    align-items: stretch;
    padding: 4px;
    border-radius: 32px;
    background: var(--chrome);
    border: 1px solid var(--line);
    box-shadow:
      var(--shadow-float),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  /* on a wide screen the bar keeps the phone's proportions, centred */
  @media (min-width: 560px) {
    .navbar {
      left: calc(50% - 206px + 16px);
      right: calc(50% - 206px + 84px);
    }
    .findbtn {
      right: calc(50% - 206px + 16px) !important;
    }
  }
  .navitem {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 28px;
    text-decoration: none;
    color: var(--ink-2);
    min-height: 44px;
  }
  .lb {
    font-size: var(--fs-caps);
    font-weight: 600;
    line-height: 1.2;
  }
  .sundot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
  }
  .navitem.on {
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  .navitem.on :global(.hicon) {
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.7));
  }
  .navitem.on .sundot {
    background: var(--sunrise-fill);
    box-shadow: 0 0 8px var(--sunrise-fill);
  }
  :root[data-theme='light'] .navitem.on .lb {
    font-weight: 700;
  }
  :root[data-theme='light'] .navitem.on :global(.hicon) {
    filter: none;
  }
  .findbtn {
    position: fixed;
    right: 16px;
    bottom: calc(22px + env(safe-area-inset-bottom));
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--float-btn);
    border: 1px solid var(--edge);
    box-shadow: var(--shadow-float);
  }
  .findbtn.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--switch-on-edge);
    box-shadow:
      0 0 0 5px rgba(255, 159, 107, 0.16),
      var(--shadow-float);
  }
</style>

<script lang="ts">
  /* A BOTTOM SHEET — floating chrome (sky-2 at night, lifted card paper in
     daylight), its top corners at radius-photo, a grab handle, a title and a
     44 px close. It registers with router.pushLayer, so Android back closes
     it; a guard that returns false vetoes the close (a dirty form). */
  import type { Snippet } from 'svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let {
    title,
    onclose,
    guard,
    children,
  }: {
    title: string;
    /** Called when the sheet actually closes (back / close / after save). */
    onclose: () => void;
    /** Return false to veto closing (dirty form). */
    guard?: () => boolean;
    children: Snippet;
  } = $props();

  let el = $state<HTMLElement | null>(null);

  $effect(() => {
    router.pushLayer(() => {
      if (guard && guard() === false) return false;
      onclose();
      return true;
    });
    /* Focus the first field of the BODY: opening an editor with the cursor
       parked on "close" is a small betrayal. A body that loads lazily (the
       wizard, the import sheet — lib/state/lazy.ts) arrives a moment later:
       its first field is focused when it does. */
    const first = (): boolean => {
      const f = el?.querySelector<HTMLElement>('.sheet-body :is(input, select, textarea, button)');
      f?.focus();
      return !!f;
    };
    if (first() || !el) return;
    const mo = new MutationObserver(() => first() && mo.disconnect());
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  });
</script>

<div
  class="sheet-backdrop"
  onclick={() => router.closeTopLayer()}
  onkeydown={(e) => e.key === 'Escape' && router.closeTopLayer()}
  role="presentation"
></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} bind:this={el}>
  <span class="grab" aria-hidden="true"></span>
  <span class="hline" aria-hidden="true"></span>
  <header class="sheet-head">
    <h2>{title}</h2>
    <button class="iconbtn sheet-x" onclick={() => router.closeTopLayer()} aria-label={S.misc.close}>
      <Icon name="close" size={18} />
    </button>
  </header>
  <div class="sheet-body">
    {@render children()}
  </div>
</div>

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(5, 6, 12, 0.62);
    animation: h-fade var(--motion-fast) both;
  }
  :global(:root[data-theme='light']) .sheet-backdrop {
    background: rgba(27, 26, 46, 0.32);
  }
  .sheet {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    z-index: 71;
    width: min(100%, 520px);
    max-height: calc(100dvh - 40px - env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    background: var(--chrome);
    border: 1px solid var(--line);
    border-bottom: none;
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
    animation: sheet-rise var(--duration-rise) var(--ease-out) both;
  }
  :global(:root[data-theme='light']) .sheet {
    box-shadow: 0 -16px 40px -14px rgba(27, 26, 46, 0.35);
  }
  .grab {
    display: block;
    width: 40px;
    height: 5px;
    margin: 10px auto 0;
    border-radius: 3px;
    background: var(--edge);
    opacity: 0.6;
  }
  /* the horizon line along the sheet's top edge */
  .hline {
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px 10px 20px;
  }
  .sheet-head h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-card-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.25;
  }
  .sheet-body {
    padding: 8px 20px calc(20px + env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  @keyframes sheet-rise {
    from {
      transform: translateX(-50%) translateY(24px);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';

  let {
    title,
    onclose,
    guard,
    children,
  }: {
    title: string;
    /** Called when the sheet actually closes (back / ✕ / after save). */
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
    /* Focus the first field, and look for it inside the BODY only: the ✕ is
       the first focusable descendant of the sheet, and opening an editor with
       the cursor parked on "close" is a small betrayal. */
    el?.querySelector<HTMLElement>('.sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button')?.focus();
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
  <header class="sheet-head">
    <h2>{title}</h2>
    <button class="sheet-x" onclick={() => router.closeTopLayer()} aria-label={S.misc.close}>✕</button>
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
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: fade var(--motion-fast) both;
  }
  /* The sheet is the lantern opening: chrome ink, a gold hairline where it
     meets the dark, and the glow reaching upward instead of a shadow falling
     down — on true black a drop shadow is invisible (LANTERN.md §2). */
  .sheet {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    z-index: 71;
    width: min(100%, 520px);
    max-height: calc(100dvh - 40px - env(safe-area-inset-top));
    background: var(--paper-2);
    border: 1px solid color-mix(in srgb, var(--gold) 20%, var(--line));
    border-bottom: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow:
      0 0 34px rgba(232, 176, 75, 0.14),
      0 -14px 44px rgba(0, 0, 0, 0.75);
    display: flex;
    flex-direction: column;
    animation: rise-sheet var(--motion) var(--ease-out) both;
  }
  .grab {
    display: block;
    width: 40px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--deco);
    margin: 9px auto 0;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px 10px 18px;
    border-bottom: 1px solid var(--line);
  }
  .sheet-head h2 {
    margin: 0;
    font-size: 19px;
    line-height: 1.25;
    flex: 1;
    min-width: 0;
  }
  .sheet-x {
    flex: 0 0 auto;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 16px;
    color: var(--ink-2);
  }
  .sheet-x:active {
    border-color: var(--gold);
    color: var(--gold-light);
  }
  .sheet-body {
    padding: 16px 18px calc(20px + env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  @keyframes rise-sheet {
    from {
      transform: translateX(-50%) translateY(40px);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>

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
    // focus the first field for keyboard users
    el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
  });
</script>

<div
  class="sheet-backdrop"
  onclick={() => router.closeTopLayer()}
  onkeydown={(e) => e.key === 'Escape' && router.closeTopLayer()}
  role="presentation"
></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} bind:this={el}>
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
    background: rgba(20, 16, 8, 0.45);
    backdrop-filter: blur(2px);
    animation: fade 0.18s both;
  }
  .sheet {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    z-index: 71;
    width: min(100%, 520px);
    max-height: calc(100dvh - 40px - env(safe-area-inset-top));
    background: var(--paper);
    border: 1px solid var(--line);
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    animation: rise-sheet 0.22s cubic-bezier(0.2, 0.7, 0.3, 1) both;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px 10px;
    border-bottom: 1px dashed var(--line);
  }
  .sheet-head h2 {
    margin: 0;
    font-size: 19px;
    flex: 1;
  }
  .sheet-x {
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 15px;
    color: var(--ink-2);
  }
  .sheet-body {
    padding: 14px 18px calc(18px + env(safe-area-inset-bottom));
    overflow-y: auto;
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

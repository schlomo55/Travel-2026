<script lang="ts">
  /* Fills the screen with one line of text for someone else to read — a taxi
     driver, a hotel desk. Holds the screen awake while it is open. */
  import { router } from '../../state/router.svelte';
  import type { Trip } from '../../model/types';

  let {
    native,
    meaning,
    suffix,
    onclose,
  }: { native: string; meaning: string; suffix?: Trip['driverSuffix']; onclose: () => void } = $props();

  let wakeLock: WakeLockSentinel | null = null;

  $effect(() => {
    router.pushLayer(() => {
      onclose();
      return true;
    });
    void (async () => {
      try {
        wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* denied or unsupported — the card still works */
      }
    })();
    return () => {
      try {
        void wakeLock?.release();
      } catch {
        /* already gone */
      }
      wakeLock = null;
    };
  });
</script>

<div class="driver" role="dialog" aria-modal="true">
  <button class="x" onclick={() => router.closeTopLayer()} aria-label="Close">✕</button>
  <div class="zh">{native}</div>
  <div class="en">{meaning}</div>
  {#if suffix}
    <div class="ask">
      {suffix.native}
      <div class="asken">"{suffix.meaning}"</div>
    </div>
  {/if}
</div>

<style>
  .driver {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #000;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 26px;
    gap: 18px;
  }
  .zh {
    font-family: var(--font-zh);
    font-weight: 700;
    font-size: clamp(38px, 12vw, 62px);
    line-height: 1.3;
  }
  .en {
    color: #9a9a9a;
    font-size: 15px;
  }
  .ask {
    font-family: var(--font-zh);
    color: #e6c88a;
    font-size: clamp(22px, 6.5vw, 31px);
    border-top: 1px solid #333;
    padding-top: 16px;
  }
  .asken {
    font-family: var(--font-ui);
    font-size: 14px;
    color: #777;
    margin-top: 4px;
  }
  .x {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    right: 16px;
    background: #1c1c1c;
    border: 1px solid #333;
    color: #bbb;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 17px;
  }
</style>

<script lang="ts">
  /* Fills the screen with one line of text for someone else to read — a taxi
     driver, a hotel desk. Holds the screen awake while it is open. */
  import { router } from '../../state/router.svelte';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import type { Trip } from '../../model/types';

  let {
    native,
    meaning,
    address,
    suffix,
    onclose,
  }: {
    native: string;
    meaning: string;
    /** The street address in the local script. A card without one renders
        nothing here — no placeholder, no invented street. */
    address?: string;
    suffix?: Trip['driverSuffix'];
    onclose: () => void;
  } = $props();

  let wakeLock: WakeLockSentinel | null = null;

  /* THE ✕ IS A CORRECT 44 px CIRCLE IN THE ONE PLACE A THUMB CANNOT REACH.
     The real sequence is: hold the phone out to a driver at arm's length, take
     it back one-handed while getting into the taxi, then stretch to the far
     corner of a 6.8" screen. Android back already closes this; a tap on the
     empty card and a swipe down now do too. The card's own controls stop the
     tap, so copying the address never closes the thing you are copying from. */
  let downY: number | null = null;
  function onPointerDown(e: PointerEvent): void {
    downY = e.target === e.currentTarget ? e.clientY : null;
  }
  function onPointerUp(e: PointerEvent): void {
    if (downY === null) return;
    const dy = e.clientY - downY;
    downY = null;
    /* a tap on the backdrop, or a deliberate swipe down from it */
    if (Math.abs(dy) < 12 || dy > 70) router.closeTopLayer();
  }

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

<div
  class="driver"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onpointerdown={onPointerDown}
  onpointerup={onPointerUp}
>
  <button class="x" onclick={() => router.closeTopLayer()} aria-label="Close">✕</button>
  <div class="zh">{native}</div>
  <div class="en">{meaning}</div>
  {#if address}
    <!-- The address, big enough to read at arm's length across a taxi seat,
         and its own copy button for pasting into a ride-hailing app. -->
    <button class="addr" onclick={() => copyText(address, S.maps.copiedAddress)} title={S.maps.copyAddress}>
      {address}<span class="cp" aria-hidden="true">⧉</span>
    </button>
  {/if}
  {#if suffix}
    <div class="ask">
      {suffix.native}
      <div class="asken">"{suffix.meaning}"</div>
    </div>
  {/if}
</div>

<style>
  /* §RULES 4: this stays a plain black/white card a stranger reads in daylight.
     Lantern is allowed the FRAME and nothing else — the hairline below says
     "this is the app" without tinting one character of what is being read. */
  .driver {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #000;
    color: #fff;
    box-shadow: inset 0 0 0 1px rgba(232, 176, 75, 0.22);
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
  /* Deliberate raw colours, like the rest of this overlay: it is a black card
     held up in daylight, not a themed screen. */
  .addr {
    font-family: var(--font-zh);
    font-size: clamp(19px, 5.6vw, 27px);
    line-height: 1.45;
    color: #f2f2f2;
    background: #141414;
    border: 1px solid #333;
    border-radius: 14px;
    padding: 12px 16px;
    min-height: 44px;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .addr .cp {
    font-family: var(--font-ui);
    font-size: 15px;
    color: #8a8a8a;
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
  /* frame furniture, so it takes the app's chrome */
  .x {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    right: 16px;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    color: var(--ink-2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 17px;
  }
</style>

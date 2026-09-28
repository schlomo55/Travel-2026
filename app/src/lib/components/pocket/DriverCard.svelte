<script lang="ts">
  /* THE DRIVER CARD (f-driver) — a destination in Chinese for a taxi driver,
     full screen, white = for other eyes. Deliberately plain, like the
     overlay it replaces: the phrase to hold up ("请带我去这里 — Please take me
     here"), the place as large as it fits, its English line, its address to
     copy into a ride-hailing app, Open in maps and Copy, and ‹ › through the
     other cards ("3 of 28"). A PHRASE opens the same screen without the
     please-take-me-here line, because a phrase is not a destination.

     A card whose own words carry ⚠️ is a place you must NOT be taken to by
     mistake (the old Capital-airport card). Its warning is lifted out of the
     English line and printed above it, red, so a ‹ › swipe that lands on it
     cannot be shown to a driver unread.

     The screen is held awake; back, Close, Escape and a swipe down close it;
     a swipe sideways (or the arrow keys) moves between cards. */
  import type { ShowCard, Trip } from '../../model/types';
  import { splitWarning } from '../../logic/pass';
  import { holdScreenAwake } from '../../platform/wakeLock';
  import { router } from '../../state/router.svelte';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import MapButtons from '../ui/MapButtons.svelte';

  let {
    cards,
    start,
    suffix,
    onclose,
  }: {
    /** The cards ‹ › moves through — all place cards, or all phrases. */
    cards: ShowCard[];
    start: number;
    suffix?: Trip['driverSuffix'];
    onclose: () => void;
  } = $props();

  let i = $state(0);
  $effect.pre(() => {
    i = Math.max(0, Math.min(start, cards.length - 1));
  });
  const card = $derived(cards[i]);
  const isPlace = $derived(card?.kind === 'place');
  const parts = $derived(card ? splitWarning(card.meaning) : { main: '', warning: null });
  /* As large as it fits: the board's 78 px for an airport's eight characters,
     stepping down for a school's whole paragraph of taxi instructions. */
  const zhSize = $derived.by(() => {
    const n = [...(card?.native ?? '')].length;
    return n <= 8 ? 'xl' : n <= 14 ? 'lg' : n <= 26 ? 'md' : n <= 60 ? 'sm' : 'xs';
  });

  function step(d: number): void {
    if (cards.length < 2) return;
    i = (i + d + cards.length) % cards.length;
  }

  let closeBtn = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    router.pushLayer(() => {
      onclose();
      return true;
    });
    const release = holdScreenAwake();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') router.closeTopLayer();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    closeBtn?.focus({ preventScroll: true });
    return () => {
      release();
      window.removeEventListener('keydown', onKey);
    };
  });

  /* A deliberate swipe, not a tap: sideways moves between cards, down closes.
     The card's own controls stop nothing — a tap is never a swipe. */
  let x0: number | null = null;
  let y0: number | null = null;
  function down(e: PointerEvent): void {
    x0 = e.clientX;
    y0 = e.clientY;
  }
  function up(e: PointerEvent): void {
    if (x0 === null || y0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    else if (dy > 110 && dy > Math.abs(dx) * 1.5) router.closeTopLayer();
  }
</script>

{#if card}
  <div
    class="driver"
    class:phrase={!isPlace}
    role="dialog"
    aria-modal="true"
    aria-label={isPlace
      ? S.driver.aria(i + 1, cards.length, parts.main)
      : S.driver.phraseAria(i + 1, cards.length, card.meaning)}
    tabindex="-1"
    onpointerdown={down}
    onpointerup={up}
  >
    <div class="dc-top">
      <div class="dc-kind">
        <span class="dc-caps">{isPlace ? S.driver.title : S.driver.phraseTitle}</span>
        <span class="dc-count num">{S.driver.of(i + 1, cards.length)}</span>
      </div>
      <button class="dc-close" bind:this={closeBtn} onclick={() => router.closeTopLayer()}>
        <Icon name="close" size={18} stroke={2} />
        {S.misc.close}
      </button>
    </div>

    <div class="dc-mid">
      {#if isPlace && suffix}
        <div class="dc-ask">
          <span class="zh dc-askzh" lang="zh">{suffix.native}</span>
          <span class="dc-asken">{suffix.meaning}</span>
        </div>
        <div class="dc-rule" aria-hidden="true"></div>
      {/if}

      {#if parts.warning}
        <div class="dc-warn" role="note">
          <Icon name="alert" size={20} stroke={2} />
          <span><b>{S.driver.watchOut}</b> {parts.warning}</span>
        </div>
      {/if}

      <span class="zh dc-zh {zhSize}" lang="zh">{card.native}</span>
      <span class="dc-en">{parts.main}</span>

      {#if card.address}
        <!-- the street, to paste into a ride-hailing app — its own copy button -->
        <button class="addr zh" onclick={() => copyText(card.address ?? '', S.maps.copiedAddress)} title={S.maps.copyAddress}>
          <span>{card.address}</span>
          <Icon name="copy" size={18} />
        </button>
      {/if}
    </div>

    <div class="dc-bottom">
      <div class="dc-actions" class:single={!isPlace}>
        {#if isPlace}
          <MapButtons
            coord={card.coord}
            name={card.meaning}
            query={card.mapQuery}
            address={card.address}
            addressInSearch={card.addressInSearch}
            city={card.mapCity}
            url={card.mapUrl}
            paper
            noAddressCopy
          />
        {/if}
        <button class="dc-copy" onclick={() => copyText(card.native)} aria-label={S.driver.copyZh}>
          <Icon name="copy" size={18} />
          {S.info.copy}
        </button>
      </div>
      {#if cards.length > 1}
        <div class="dc-nav">
          <button class="dc-step" onclick={() => step(-1)} aria-label={S.driver.prev}>
            <Icon name="chevron-left" size={22} stroke={2} />
          </button>
          <div class="dc-hint">
            <span class="dc-show">{isPlace ? S.driver.show : S.driver.showPhrase}</span>
            <span class="dc-count num">{S.driver.of(i + 1, cards.length)}</span>
          </div>
          <button class="dc-step" onclick={() => step(1)} aria-label={S.driver.next}>
            <Icon name="chevron-right" size={22} stroke={2} />
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .driver {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
    background: var(--counter-paper);
    color: var(--counter-ink);
    overflow-y: auto;
    animation: h-fade 220ms ease-out both;
  }
  .dc-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dc-kind {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .dc-caps {
    font-size: var(--fs-caption);
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--counter-ink-2);
  }
  .dc-count {
    font-size: var(--fs-time);
    color: var(--counter-ink-2);
  }
  .dc-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 22px;
    border-radius: 999px;
    border: none;
    font-size: var(--fs-body);
    font-weight: 600;
    color: var(--counter-paper);
    background: var(--counter-ink);
  }
  .dc-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    padding: 20px 0;
  }
  .dc-ask {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dc-askzh {
    font-size: 34px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.04em;
  }
  .dc-asken {
    font-size: var(--fs-body);
    color: var(--counter-ink-2);
  }
  .dc-rule {
    height: 2px;
    border-radius: 1px;
    background: var(--counter-rule);
  }
  .dc-warn {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius-inner);
    font-size: var(--fs-row);
    line-height: 1.4;
    color: var(--counter-crit);
    background: var(--counter-crit-soft);
    border: 1.5px solid var(--counter-crit-line);
  }
  .dc-warn b {
    font-weight: 700;
  }
  .dc-zh {
    font-weight: 700;
    line-height: 1.14;
    letter-spacing: 0.02em;
    color: var(--counter-ink);
    overflow-wrap: anywhere;
  }
  .dc-zh.xl {
    font-size: 78px;
  }
  .dc-zh.lg {
    font-size: 56px;
  }
  .dc-zh.md {
    font-size: var(--fs-hero-code);
    line-height: 1.25;
  }
  .dc-zh.sm {
    font-size: var(--fs-countdown);
    line-height: 1.35;
  }
  .dc-zh.xs {
    font-size: var(--fs-screen-title);
    line-height: 1.45;
  }
  .dc-en {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--counter-ink);
  }
  .addr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 12px 16px;
    border-radius: var(--radius-inner);
    border: 1.5px solid var(--counter-rule);
    background: var(--counter-paper-2);
    color: var(--counter-ink);
    font-size: var(--fs-card-title);
    line-height: 1.45;
    text-align: left;
  }
  .addr :global(.hicon) {
    color: var(--counter-ink-2);
  }
  .dc-bottom {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dc-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .dc-actions.single {
    grid-template-columns: 1fr;
  }
  .dc-copy {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 54px;
    border-radius: 999px;
    font-size: var(--fs-body);
    font-weight: 600;
    color: var(--counter-ink);
    background: var(--counter-paper);
    border: 1.5px solid var(--counter-ink);
  }
  .dc-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dc-step {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: 999px;
    border: none;
    color: var(--counter-ink);
    background: var(--counter-paper-2);
  }
  .dc-hint {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .dc-show {
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--counter-ink);
  }
  .driver :global(button:focus-visible) {
    outline-color: var(--counter-accent);
  }
</style>

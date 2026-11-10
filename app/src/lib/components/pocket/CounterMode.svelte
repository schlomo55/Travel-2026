<script lang="ts">
  /* COUNTER MODE (f-counter, system/components/CounterMode) — one booking code
     for a stranger at a desk. White = for other eyes in its purest form:
     counter-paper and counter-ink, no nav, no map, no accent colour, no
     motion on anything that can be read.

     The code is printed in full — the real one, the one the desk asks for —
     in fours where it is long, so the eye has somewhere to rest; tapping it
     copies the raw string. The screen is held awake while it is up; Android
     back, the Close button, Escape and a swipe down all close it. The header and
     the foot (the hand-over line and Close) stay put and only the code between
     them scrolls, so Close is never pushed under the phone's own bar. */
  import { untrack } from 'svelte';
  import type { CounterSubject } from '../../logic/pass';
  import { codeGroups } from '../../logic/pass';
  import { holdScreenAwake } from '../../platform/wakeLock';
  import { router } from '../../state/router.svelte';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let { subject, onclose }: { subject: CounterSubject; onclose: () => void } = $props();

  const groups = $derived(codeGroups(subject.code));
  /* The title is as loud as it can be and still fit: a flight number takes
     the board's 62 px; a hotel's name steps down so it never runs off. */
  const titleSize = $derived(
    subject.title.length <= 9 ? 'xl' : subject.title.length <= 16 ? 'lg' : subject.title.length <= 28 ? 'md' : 'sm',
  );
  let closeBtn = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    /* the layer goes with the screen, however it goes (Run 4b) */
    const layer = router.pushLayer(() => {
      onclose();
      return true;
    });
    const release = holdScreenAwake();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void router.closeTopLayer();
    };
    window.addEventListener('keydown', onKey);
    untrack(() => closeBtn?.focus({ preventScroll: true }));
    return () => {
      release();
      window.removeEventListener('keydown', onKey);
      layer();
    };
  });

  let downY: number | null = null;
  function down(e: PointerEvent): void {
    downY = e.clientY;
  }
  function up(e: PointerEvent): void {
    if (downY !== null && e.clientY - downY > 110) router.closeTopLayer();
    downY = null;
  }
</script>

<div
  class="counter"
  role="dialog"
  aria-modal="true"
  aria-label={S.counter.aria(subject.title)}
  tabindex="-1"
  onpointerdown={down}
  onpointerup={up}
>
  <div class="cm-top">
    <Icon name="sun" size={20} stroke={2} />
    <span class="cm-mode">{S.counter.title}</span>
    <span class="cm-bright">{S.counter.brightness}</span>
  </div>

  <div class="cm-mid">
    <div class="cm-who">
      <span class="cm-caps">{subject.caps}</span>
      <span class="cm-title display {titleSize}">{subject.title}</span>
    </div>

    {#if subject.lines.length || subject.when}
      <div class="cm-route">
        {#each subject.lines as l, i (i)}<span class="cm-line">{l}</span>{/each}
        {#if subject.when}<span class="cm-when num">{subject.when}</span>{/if}
      </div>
    {/if}

    <div class="cm-opal" aria-hidden="true"></div>

    <div class="cm-codebox">
      <span class="cm-label">{subject.codeLabel}</span>
      <button class="cm-code num code" onclick={() => copyText(subject.code, subject.codeLabel)} aria-label={S.counter.copy(subject.codeLabel)}>
        {#each groups as g, i (i)}<span class="grp">{g}</span>{/each}
      </button>
      {#if subject.codeSub}
        <button class="cm-sub num codesub" onclick={() => copyText(subject.codeSub ?? '')}>{subject.codeSub}</button>
      {/if}
    </div>
  </div>

  <div class="cm-bottom">
    <div class="cm-band">
      <Icon name="handset" size={22} />
      <span>{S.counter.hand}</span>
    </div>
    <button class="cm-close" bind:this={closeBtn} onclick={() => router.closeTopLayer()}>
      <Icon name="close" size={20} stroke={2} />
      {S.misc.close}
    </button>
  </div>
</div>

<style>
  .counter {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    /* no bottom padding here: the foot (.cm-bottom) carries it, so it can clear the phone's navigation bar */
    padding: calc(24px + env(safe-area-inset-top)) 24px 0;
    background: var(--counter-paper);
    color: var(--counter-ink);
    overflow: hidden;
    animation: h-fade 220ms ease-out both;
  }
  .cm-top {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    color: var(--counter-accent);
  }
  .cm-mode {
    flex: 1;
    font-size: var(--fs-caption);
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--counter-ink-2);
  }
  .cm-bright {
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--counter-ink-2);
  }
  /* the booking between the header and the foot: centred while it fits, scrolling inside when it does not. The two
     empty ends share the spare room (justify-content: center would push a tall booking's top out of reach). */
  .cm-mid {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 22px;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* a scroller clips what it holds: 8 px each side keep a focus ring on a full-width button (the address) whole */
    margin: 0 -8px;
    padding: 0 8px;
  }
  .cm-mid::before,
  .cm-mid::after {
    content: '';
    flex: 1 1 0;
  }
  .cm-who {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cm-caps {
    font-size: var(--fs-body);
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--counter-ink-2);
  }
  .cm-title {
    font-weight: 600;
    line-height: 1.02;
    color: var(--counter-ink);
    overflow-wrap: anywhere;
  }
  .cm-title.xl {
    font-size: 62px;
  }
  .cm-title.lg {
    font-size: var(--fs-hero-code);
  }
  .cm-title.md {
    font-size: var(--fs-countdown);
    line-height: 1.12;
  }
  .cm-title.sm {
    font-size: var(--fs-screen-title);
    line-height: 1.2;
  }
  .cm-route {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cm-line {
    font-size: 21px;
    font-weight: 600;
    line-height: 1.3;
  }
  .cm-when {
    font-size: var(--fs-screen-title);
    font-weight: 500;
    color: var(--counter-ink);
  }
  .cm-opal {
    height: 3px;
    border-radius: 2px;
    background: var(--counter-opal);
  }
  .cm-codebox {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cm-label {
    font-size: var(--fs-row);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--counter-ink-2);
  }
  .cm-code {
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.42em;
    row-gap: 2px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    font-size: var(--fs-counter-code);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: 0.04em;
    color: var(--counter-ink);
    min-height: 44px;
    word-break: break-all;
  }
  .cm-sub {
    align-self: flex-start;
    padding: 6px 0;
    border: none;
    background: none;
    text-align: left;
    font-size: var(--fs-screen-title);
    font-weight: 500;
    color: var(--counter-ink-2);
    min-height: 44px;
    /* "ve / rify" was a word cut in two: break only what cannot fit a line */
    overflow-wrap: anywhere;
  }
  /* the foot clears the phone's navigation bar: the WebView can report the inset as 0 under a 3-button bar, so
     the floor (--sysbar-min) stands in; it is never added to a real inset. Close is 60 px tall. */
  .cm-bottom {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 0 calc(16px + max(env(safe-area-inset-bottom), var(--sysbar-min)));
  }
  .cm-band {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-inner);
    background: var(--counter-paper-2);
    color: var(--counter-ink-2);
    font-size: var(--fs-body);
    line-height: 1.4;
  }
  .cm-band span {
    color: var(--counter-ink);
  }
  .cm-close {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 60px;
    border-radius: 999px;
    border: none;
    font-size: var(--fs-card-title);
    font-weight: 600;
    color: var(--counter-paper);
    background: var(--counter-ink);
  }
  .cm-close:focus-visible,
  .cm-code:focus-visible,
  .cm-sub:focus-visible {
    outline-color: var(--counter-accent);
  }
</style>

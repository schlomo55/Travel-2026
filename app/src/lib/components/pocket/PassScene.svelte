<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /* THE PASS HERO (f-pass): a night sky falling to a warm horizon, a leg drawn
     as an arc between the place you leave and the place you land, and the
     clocks at each end.

     The arc's motion has ONE job (system/README § Motion): it FLOWS only
     while this is the next thing you have to be at — the one looping route
     on the screen. A finished leg is painted (Ink's end state), a leg further
     ahead is dotted lilac, and a leg nobody has booked is drawn unlit, in
     amber dashes, with no motion at all. Calm motion and Route animations
     off still the Flow into a solid leg with an arrowhead (app.css). The
     names, times and codes never move. */
  import type { LegState } from '../../logic/pass';
  import Icon from '../horizon/Icon.svelte';
  import { offscreen } from '../../motion/offscreen';

  let {
    state,
    glyph,
    dep,
    arr,
    duration,
  }: {
    state: LegState;
    glyph: string;
    dep?: string;
    arr?: string;
    duration?: string;
  } = $props();

  const n = ++seq;
  const arcId = `pass-arc-${n}`;
  const ringId = `pass-ring-${n}`;
  const ARC = 'M36 118 C 110 10, 242 10, 316 118';
</script>

<div class="scene" data-leg={state}>
  <span class="glow" aria-hidden="true"></span>
  <svg viewBox="0 0 352 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={arcId} x1="36" y1="0" x2="316" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color: var(--route-lit)" />
        <stop offset="0.55" style="stop-color: var(--route-today)" />
        <stop offset="1" style="stop-color: var(--route-future)" />
      </linearGradient>
      <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--opal-1)" />
        <stop offset="0.35" style="stop-color: var(--opal-2)" />
        <stop offset="0.7" style="stop-color: var(--opal-3)" />
        <stop offset="1" style="stop-color: var(--opal-4)" />
      </linearGradient>
    </defs>
    <g class="sparkle">
      <circle cx="92" cy="22" r="1" opacity="0.5" />
      <circle cx="150" cy="12" r="0.8" opacity="0.35" />
      <circle cx="214" cy="26" r="1.1" opacity="0.45" />
      <circle cx="276" cy="16" r="0.8" opacity="0.4" />
      <circle cx="320" cy="40" r="1" opacity="0.3" />
      <circle cx="40" cy="48" r="0.9" opacity="0.35" />
    </g>
    <path class="hill2" d="M196 126 Q 232 104 268 116 T 352 106 L 352 126 Z" />
    <path class="hill" d="M0 150 L0 126 Q60 120 120 124 T240 122 T352 126 L352 150 Z" />
    <path class="horizon" d="M0 118.5 H352" />
    <path class="track" d={ARC} />
    {#if state === 'flow'}
      <path class="arc flowing flow" d={ARC} stroke="url(#{arcId})" use:offscreen />
      <!-- the arrowhead Flow's end state carries (shown only when it is still) -->
      <path class="flow-arrow arrow" d="M -7 -5 L 0 0 L -7 5" transform="translate(292.2 88.8) rotate(45.7)" />
    {:else if state === 'done'}
      <path class="arc done" d={ARC} />
    {:else if state === 'ahead'}
      <path class="arc ahead" d={ARC} />
    {:else}
      <path class="arc unlit" d={ARC} />
    {/if}
    <circle class="o-halo" cx="36" cy="118" r="9" />
    <circle class="o-dot" cx="36" cy="118" r="4.5" />
    <circle class="d-halo" cx="316" cy="118" r="13" />
    <circle class="d-ring" cx="316" cy="118" r="6.5" stroke="url(#{ringId})" />
    <circle class="d-dot" cx="316" cy="118" r="2.4" />
    {#if duration}<text class="dur" x="176" y="60" text-anchor="middle">{duration}</text>{/if}
    {#if dep}<text class="clk" x="22" y="141">{dep}</text>{/if}
    {#if arr}<text class="clk" x="330" y="141" text-anchor="end">{arr}</text>{/if}
  </svg>
  <span class="glyph" aria-hidden="true"><Icon name={glyph} size={18} /></span>
</div>

<style>
  .scene {
    position: relative;
    aspect-ratio: 352 / 150;
    border-radius: 22px;
    overflow: hidden;
    background: var(--scene-sky);
    border: 1px solid var(--line);
  }
  .glow {
    position: absolute;
    left: -10%;
    right: -10%;
    bottom: -47%;
    height: 80%;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgba(255, 159, 107, 0.34), rgba(255, 126, 182, 0.1) 60%, transparent 100%);
    pointer-events: none;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .sparkle circle {
    fill: var(--scene-sparkle);
  }
  .hill {
    fill: var(--scene-hill);
  }
  .hill2 {
    fill: var(--scene-hill-2);
  }
  .horizon {
    stroke: var(--scene-horizon);
    stroke-width: 1;
    fill: none;
  }
  .track {
    stroke: var(--scene-track);
    stroke-width: 2;
    stroke-linecap: round;
    fill: none;
  }
  .arc {
    fill: none;
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .arc.flowing {
    filter: drop-shadow(0 0 5px rgba(255, 126, 182, 0.75));
  }
  .arrow {
    fill: none;
    stroke: var(--route-today);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .arc.done {
    stroke: var(--route-lit);
    filter: drop-shadow(0 0 5px rgba(255, 159, 107, 0.6));
  }
  .arc.ahead {
    stroke: var(--route-future);
    stroke-dasharray: 0.1 6;
    stroke-width: 2.2;
    opacity: 0.9;
  }
  .arc.unlit {
    stroke: var(--warn);
    stroke-dasharray: 5 6;
    stroke-width: 2;
    opacity: 0.9;
  }
  .o-halo {
    fill: var(--sunrise-soft);
  }
  .o-dot {
    fill: var(--route-lit);
  }
  .d-halo {
    fill: var(--lilac-soft);
  }
  .d-ring {
    fill: var(--scene-1);
    stroke-width: 2.2;
  }
  .d-dot {
    fill: var(--star);
  }
  .dur,
  .clk {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
  }
  .dur {
    font-size: 12px;
    fill: var(--ink-2);
  }
  .clk {
    font-size: 14px;
    font-weight: 500;
    fill: var(--ink);
  }
  .glyph {
    position: absolute;
    left: 10.4%;
    top: 52%;
    display: flex;
    padding: 3px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--scene-2);
  }
  [data-leg='unlit'] .glyph {
    color: var(--warn);
  }
</style>

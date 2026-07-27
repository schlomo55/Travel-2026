<script module lang="ts">
  /* The ring fills once per visit and is instant on re-entry (plan §MOTION).
     The flag lives in module scope so switching segments — which unmounts the
     ring — does not replay the fill, while a fresh page load does.

     It is a Set keyed by `id` rather than one boolean, because the Lists tab
     draws three of these: each segment gets its own first fill the first time
     it is opened, instead of the packing ring stealing the animation from the
     two segments the traveller has not looked at yet. */
  const filledOnce = new Set<string>();
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { ringPct } from '../../logic/progress';

  let {
    id,
    done,
    total,
    label,
  }: { id: string; done: number; total: number; label: string } = $props();

  const R = 80;
  const C = 2 * Math.PI * R;
  const pct = $derived(ringPct(done, total));

  /* Start empty only for the very first fill; afterwards mount at the value.
     Read once, deliberately: a ring keeps the identity it mounted with. */
  let armed = $state(untrack(() => filledOnce.has(id)));
  $effect(() => {
    if (armed) return;
    const t = setTimeout(() => {
      armed = true;
      filledOnce.add(id);
    }, 60);
    return () => clearTimeout(t);
  });
  const offset = $derived(armed ? C * (1 - pct / 100) : C);
</script>

<div class="ringwrap">
  <div class="ring" role="img" aria-label="{pct}% {label}">
    <svg width="190" height="190" viewBox="0 0 190 190" aria-hidden="true">
      <circle class="track" cx="95" cy="95" r={R} />
      <circle class="val" cx="95" cy="95" r={R} stroke-dasharray={C} stroke-dashoffset={offset} />
    </svg>
    <div class="center">
      <div class="pct">{pct}%</div>
      <div class="plab">{label}</div>
      <div class="pcount">{done}/{total}</div>
    </div>
  </div>
</div>

<style>
  .ringwrap {
    display: flex;
    justify-content: center;
    padding: 6px 0 2px;
  }
  .ring {
    position: relative;
    width: 190px;
    height: 190px;
  }
  .ring svg {
    transform: rotate(-90deg);
  }
  .track {
    stroke: var(--neon-track);
    stroke-width: 14;
    fill: none;
  }
  .val {
    stroke: var(--neon);
    stroke-width: 14;
    fill: none;
    stroke-linecap: round;
    filter: var(--glow-glyph-neon);
    transition: stroke-dashoffset 1s var(--ease-out);
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .pct {
    font-size: 40px;
    font-weight: 800;
    color: var(--neon);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .plab {
    font-size: 15px;
    color: var(--ink-2);
  }
  .pcount {
    font-size: 12px;
    color: var(--faint);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
</style>

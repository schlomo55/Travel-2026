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
    inline = false,
  }: {
    id: string;
    done: number;
    total: number;
    label: string;
    /** A 56 px ring that sits BESIDE a header instead of above a list. The
        to-do segment takes it: there, the deadlines are the point of the
        screen and a 190 px arc at 0 % was pushing them past the fold to
        print a number the header already carries. */
    inline?: boolean;
  } = $props();

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

<div class="ringwrap" class:inline>
  <div class="ring" role="img" aria-label="{pct}% {label}">
    <svg width="190" height="190" viewBox="0 0 190 190" aria-hidden="true">
      <circle class="track" cx="95" cy="95" r={R} />
      <circle class="val" cx="95" cy="95" r={R} stroke-dasharray={C} stroke-dashoffset={offset} />
    </svg>
    <div class="center">
      <div class="pct">{pct}%</div>
      {#if !inline}
        <div class="plab">{label}</div>
        <div class="pcount">{done}/{total}</div>
      {/if}
    </div>
  </div>
  <!-- Inline, the two smaller lines move OUT of a 56 px circle they cannot
       fit in. Same elements, same classes — .ringwrap is what to select. -->
  {#if inline}
    <span class="iside">
      <span class="plab">{label}</span>
      <span class="pcount">{done}/{total}</span>
    </span>
  {/if}
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
  /* ---------- the inline variant ---------- */
  .ringwrap.inline {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 9px;
    padding: 0;
    flex: 0 0 auto;
  }
  .ringwrap.inline .ring {
    width: 56px;
    height: 56px;
  }
  .ringwrap.inline .track,
  .ringwrap.inline .val {
    stroke-width: 22;
  }
  .ringwrap.inline .pct {
    font-size: var(--text-base);
  }
  .iside {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .iside .plab {
    font-size: var(--text-sm);
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
    font-size: var(--text-hero);
    font-weight: 800;
    color: var(--neon);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .plab {
    font-size: var(--text-base);
    color: var(--ink-2);
  }
  .pcount {
    font-size: var(--text-sm);
    color: var(--faint);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
</style>

<script lang="ts">
  /* THE ROUTE STRIP — Now's one line of the trip (logic/nowroute.ts): a dot
     per stop in trip order, the road so far lit, the road ahead dotted,
     tonight's stop (or the next one) marked, and under it where you are. The
     whole drawing lives on Journey, one tap away: the strip is a single link
     there, named by one sentence — the dots are decoration, so they are
     hidden from a screen reader. Nothing on it moves. */
  import type { RouteStrip } from '../../logic/nowroute';
  import Icon from '../horizon/Icon.svelte';

  let { strip, href }: { strip: RouteStrip; href: string } = $props();
</script>

<a class="rstrip" {href} aria-label={strip.aria}>
  <span class="rs-line" aria-hidden="true">
    {#each strip.dots as d, i (i)}<i class="rs-d {d.state} l-{d.leg}" class:next={d.next}></i>{/each}
  </span>
  <span class="rs-cap" aria-hidden="true">
    <span class="rs-where">{strip.where}</span>
    <span class="rs-n">{strip.count}</span>
    <Icon name="chevron-right" size={16} />
  </span>
</a>

<style>
  .rstrip {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-height: 52px;
    padding: 8px 12px 8px 14px;
    border-radius: var(--radius-inner);
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .rs-line {
    display: flex;
    align-items: center;
    height: 14px;
    padding: 0 3px;
    /* a very long trip is cut at the edge, never wider than the page; the lit
       dot's ring (3 px out) keeps its room */
    overflow-x: clip;
  }
  /* one cell per stop: its dot at the left, the road to the next stop after it */
  .rs-d {
    position: relative;
    flex: 1 1 0;
    min-width: 8px;
    height: 14px;
  }
  .rs-d:last-child {
    flex: none;
    width: 14px;
  }
  .rs-d::before,
  .rs-d::after {
    content: '';
    position: absolute;
    top: 50%;
  }
  .rs-d::before {
    left: 0;
    width: 10px;
    height: 10px;
    margin-top: -5px;
    border-radius: 50%;
  }
  .rs-d.done::before {
    background: var(--route-lit);
  }
  .rs-d.ahead::before {
    border: 2px solid var(--route-future);
  }
  .rs-d.ahead.next::before {
    border-color: var(--sunrise);
  }
  .rs-d.here::before {
    background: var(--sunrise-fill);
    box-shadow: 0 0 0 3px var(--sunrise-soft);
  }
  .rs-d.here::before,
  .rs-d.next::before {
    width: 14px;
    height: 14px;
    margin-top: -7px;
  }
  .rs-d::after {
    left: 16px;
    right: 2px;
  }
  .rs-d.here::after,
  .rs-d.next::after {
    left: 20px;
  }
  .rs-d:last-child::after {
    display: none;
  }
  .l-done::after {
    height: 3px;
    margin-top: -1.5px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--opal-1), var(--route-lit));
  }
  .l-today::after {
    border-top: 2.5px dashed var(--route-today);
  }
  .l-ahead::after {
    border-top: 2.5px dotted var(--route-future);
  }
  .rs-cap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-chip);
    line-height: 1.3;
  }
  .rs-where {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rs-n {
    flex-shrink: 0;
    color: var(--ink-2);
  }
  .rs-cap :global(.hicon) {
    flex-shrink: 0;
    color: var(--ink-2);
  }
</style>

<script lang="ts">
  /* THE PLACES' SHEET AT ITS PEEK (10 Nov 2026) — one row under the title: a chip for each place the cards would
     show, nearest first, each its category's glyph and its name; or, while the map draws a day's route, the day's
     stops in the plan's order, each numbered in the day's colour as its pin is. A chip is one tap to the place's
     sheet — what a card's name is. The cards themselves are one tap on the chevron away (Map.svelte). */
  import type { MapPlace } from '../../logic/mapplaces';
  import type { PeekChip } from '../../logic/mapscope';
  import { catColour, glyphOf } from '../../map/icons';
  import { revealFocus } from '../ui/revealFocus';
  import { S } from '../../i18n/strings';
  import { SM } from '../../i18n/mapview';
  import MapIcon from './MapIcon.svelte';

  let { chips, onopen }: { chips: PeekChip[]; onopen: (p: MapPlace, from: HTMLElement) => void } = $props();
</script>

{#if chips.length}
  <ul class="pk" aria-label={SM.peekRow} use:revealFocus>
    {#each chips as c (c.place.id)}
      {@const p = c.place}
      <li>
        <button
          class="pk-chip"
          data-place={p.id}
          style="--c: {c.colour ?? catColour(p.category)}"
          aria-label={c.n ? `${S.mapTab.stopN(c.n)}, ${p.name}` : S.mapTab.open(p.name)}
          onclick={(e) => onopen(p, e.currentTarget)}
        >
          <span class="pk-disc" aria-hidden="true">
            {#if c.n}<span class="num">{c.n}</span>{:else}<MapIcon name={glyphOf(p.category, p.name, p.native)} size={14} />{/if}
          </span>
          <span class="pk-name">{p.name}</span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="pk-none">{S.mapTab.nothingHere}</p>
{/if}

<style>
  .pk {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 6px 16px;
    list-style: none;
    overflow-x: auto;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
    mask-image: linear-gradient(90deg, #000 88%, transparent);
  }
  .pk::-webkit-scrollbar {
    display: none;
  }
  .pk li {
    flex-shrink: 0;
  }
  .pk-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 200px;
    height: 44px;
    padding: 0 14px 0 8px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .pk-disc {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    box-sizing: border-box;
    font-size: var(--fs-chip);
    font-weight: 700;
    color: var(--c);
    background: var(--card-2);
    border: 1.5px solid var(--c);
  }
  .pk-name {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pk-none {
    margin: 0;
    padding: 0 16px;
    font-size: var(--fs-caption);
    line-height: 44px;
    color: var(--ink-2);
  }
</style>

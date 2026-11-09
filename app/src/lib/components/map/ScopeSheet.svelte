<script lang="ts">
  /* WHERE ON THE TRIP (10 Nov 2026) — the choice behind the Map tab's scope chip: the whole trip, or one stop (a
     city), each with how many places it has on the map. The chips, the cards and the list follow it, and the map
     never changes it by itself; this is the only place it changes. A Sheet, so Android back closes it. A pick
     closes the sheet — close, then say it (the choice is the whole job). */
  import type { ScopeId, ScopeOption } from '../../logic/mapscope';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import { SM } from '../../i18n/mapview';
  import Sheet from '../ui/Sheet.svelte';
  import MapIcon from './MapIcon.svelte';

  let {
    options,
    current,
    onpick,
    onclose,
  }: {
    options: ScopeOption[];
    current: ScopeId;
    onpick: (id: ScopeId) => void;
    onclose: () => void;
  } = $props();

  function pick(id: ScopeId): void {
    if (id !== current) onpick(id);
    void router.closeTopLayer();
  }
</script>

<Sheet title={SM.scopeTitle} {onclose}>
  <p class="sc-sub">{SM.scopeSub}</p>
  <div class="sc-rows" role="radiogroup" aria-label={SM.scopeTitle}>
    {#each options as o (o.id ?? 'trip')}
      {@const on = o.id === current}
      {@const name = o.name ?? SM.wholeTrip}
      <button class="sc-row" class:on role="radio" aria-checked={on} onclick={() => pick(o.id)}>
        <span class="sc-name">{name}</span>
        <span class="num sc-n">{S.mapTab.results(o.n)}</span>
        <span class="sc-tick" aria-hidden="true">{#if on}<MapIcon name="check" size={18} stroke={2.2} />{/if}</span>
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .sc-sub {
    margin: -6px 0 8px;
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
  }
  .sc-rows {
    display: flex;
    flex-direction: column;
  }
  .sc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 6px 4px;
    border: none;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    background: none;
    color: var(--ink);
    text-align: left;
  }
  .sc-row:focus-visible {
    outline-offset: -4px;
  }
  .sc-name {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sc-n {
    flex-shrink: 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .sc-tick {
    flex-shrink: 0;
    display: flex;
    width: 18px;
    color: var(--sunrise);
  }
  .sc-row.on .sc-name {
    color: var(--sunrise);
  }
</style>

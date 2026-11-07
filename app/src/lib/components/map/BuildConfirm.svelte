<script lang="ts">
  /* THE BUILD, ASKED FOR (7 Nov 2026) — the confirm sheet's body: what the
     download comes to (the extractor's own plan, to the byte), on which
     network, which areas, from which OpenStreetMap build — and, when a pack is
     on the phone, that the new one REPLACES it completely, its place photos
     with it (the new pack has none: photos are a later phase). The size it
     leads with is the DOWNLOAD — the tile data the plan asks for, its gaps
     included — and then what the finished map takes on the phone (review,
     7 Nov 2026: the pack's size alone undersold the download). */
  import type { PlanView } from '../../map/build/builder.svelte';
  import { packSize } from '../../map/pack';
  import { fmtLong } from '../../logic/dates';
  import { SB } from '../../i18n/mapbuild';
  import Icon from '../horizon/Icon.svelte';

  let { view, onconfirm, oncancel }: { view: PlanView; onconfirm: () => void; oncancel: () => void } = $props();
  const date = $derived(fmtLong(`${view.date.slice(0, 4)}-${view.date.slice(4, 6)}-${view.date.slice(6, 8)}`));
</script>

<div class="bc">
  <p class="bc-size num">{SB.download(packSize(view.download))}</p>
  <p class="bc-note num">{SB.onPhone(packSize(view.bytes))}</p>
  <p class="bc-note">{SB.network}</p>
  <p class="bc-areas">{SB.areas(view.areas.length, view.areas.join(' · '))}</p>
  <p class="bc-note">{SB.areasNote} {SB.source(date)}</p>
  {#if view.hadPack}
    <p class="bc-warn" role="note"><Icon name="alert" size={16} /> <span><strong>{SB.replaces}</strong> {SB.replacesWhat(view.photos)}</span></p>
  {:else}
    <p class="bc-note">{SB.firstPack}</p>
  {/if}
  <div class="bc-row">
    <button class="btn ghost" onclick={oncancel}>{SB.notNow}</button>
    <button class="btn primary" onclick={onconfirm}>{SB.go}</button>
  </div>
</div>

<style>
  .bc {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 8px;
  }
  .bc p {
    margin: 0;
    line-height: 1.45;
  }
  .bc-size {
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
  }
  .bc-areas {
    font-size: var(--fs-label);
    color: var(--ink);
  }
  .bc-note {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .bc-warn {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: var(--fs-caption);
    color: var(--warn-ink);
  }
  .bc-warn :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .bc-row {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }
  .bc-row .btn {
    min-height: 44px;
    padding: 0 18px;
  }
</style>

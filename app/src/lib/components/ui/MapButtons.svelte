<script lang="ts">
  /* Two ways to put a pin on a phone: Google (works with the VPN, and in Hong
     Kong) and Amap (works everywhere in the mainland). Both are pure link
     builders — nothing is fetched, so these render identically offline. */
  import type { Coord } from '../../model/types';
  import { googleMapsUrl, type MapTarget } from '../../logic/geo';
  import { openInAmap, openInGoogleMaps } from '../../platform/maps';
  import { S } from '../../i18n/strings';

  let {
    coord,
    name,
    query,
    city,
    url,
    compact = false,
  }: {
    coord?: Coord;
    name: string;
    /** Place name a map search opens — beats a coordinate when it is verified. */
    query?: string;
    city?: string;
    /** A share link the owner pasted; opened verbatim. */
    url?: string;
    compact?: boolean;
  } = $props();

  const target = $derived<MapTarget>({ url, query, city, coord });
  /* Nothing to open — no coordinate, no name, no link — so draw nothing. */
  const usable = $derived(!!googleMapsUrl(target));
</script>

{#if usable}

<div class="maps" class:compact>
  <button
    class="mapbtn"
    onclick={() => openInGoogleMaps(target)}
    aria-label="{S.maps.openIn(name)} · Google Maps"
    title="Google Maps"
  >
    {#if compact}🗺{:else}{S.maps.google}{/if}
  </button>
  <button
    class="mapbtn"
    onclick={() => openInAmap(target, name)}
    aria-label="{S.maps.openIn(name)} · Amap"
    title="Amap 高德地图"
  >
    {#if compact}📍{:else}{S.maps.amap}{/if}
  </button>
</div>
{/if}

<style>
  .maps {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .mapbtn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 44px;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--ink);
  }
  .mapbtn:active {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .maps.compact {
    margin-top: 0;
    gap: 2px;
    flex-shrink: 0;
  }
  .maps.compact .mapbtn {
    flex: none;
    width: 44px;
    min-height: 44px;
    padding: 0;
    font-size: 16px;
    background: none;
    border: none;
    color: var(--faint);
    border-radius: 10px;
  }
</style>

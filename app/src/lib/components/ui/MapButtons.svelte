<script lang="ts">
  /* ONE button, everywhere a place has a location.

     It hands the place to Android as a `geo:` intent, so the phone puts up its
     own chooser the first time — Google Maps, Amap, Organic Maps, Waze — and
     then remembers the answer. That is the whole design: we do not decide
     which map the owner uses, the owner does, once.

     Pure link building: nothing is fetched, so this renders identically with
     the network hard off. And when a place has no verified location at all,
     the button does not render — a missing button is the honest outcome, not
     a gap. Long-press copies the name, for a phone with no map app on it. */
  import type { Coord } from '../../model/types';
  import { geoUri, googleMapsUrl, type MapTarget } from '../../logic/geo';
  import { openInMaps } from '../../platform/maps';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';

  let {
    coord,
    name,
    query,
    address,
    addressInSearch,
    city,
    url,
    compact = false,
    pill = false,
  }: {
    coord?: Coord;
    name: string;
    /** Place name a map search opens — beats a coordinate when it is verified. */
    query?: string;
    /** The street address, folded in BEHIND the name (geo.ts decides how). */
    address?: string;
    /** Chains only: let the street pick the branch. */
    addressInSearch?: boolean;
    city?: string;
    /** A share link the owner pasted; opened verbatim. */
    url?: string;
    compact?: boolean;
    /** The city guide's glowing gold-outlined "Open in Maps" pill. */
    pill?: boolean;
  } = $props();

  const target = $derived<MapTarget>({ url, query, address, addressInSearch, city, coord });
  /* Nothing to open — no coordinate, no name, no link — so draw nothing. */
  const usable = $derived(!!googleMapsUrl(target));
  /* What a tap WOULD launch on the phone, published on the element itself:
     a headless browser has no Capacitor and no map app, so this is the only
     way the dress rehearsal can see the real Android intent. */
  const geo = $derived(geoUri(target) ?? '');

  /* Long-press copies the address when there is one — that is the string you
     hand over or paste into a ride-hailing app — and the name otherwise. */
  function copy(e: Event): void {
    e.preventDefault();
    if (address) return void copyText(address, S.maps.copiedAddress);
    void copyText(query ?? name, S.maps.copied);
  }
</script>

{#if usable}
  <div class="maps" class:compact class:pill>
    <button
      class="mapbtn"
      data-geo={geo}
      onclick={() => openInMaps(target)}
      oncontextmenu={copy}
      aria-label={S.maps.openIn(name)}
      title={S.maps.open}
    >
      {#if pill}{S.plan.openInMaps}{:else if compact}🗺{:else}{S.maps.open}{/if}
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
  /* the guide's pill: outlined gold, lit from inside */
  .maps.pill {
    margin-top: 0;
    flex-shrink: 0;
  }
  .maps.pill .mapbtn {
    flex: none;
    font-family: var(--font-type);
    font-size: 13px;
    font-weight: 400;
    padding: 6px 13px;
    min-height: 44px;
    white-space: nowrap;
    background: none;
    border: 1.5px solid var(--gold);
    border-radius: var(--radius-pill);
    color: var(--gold-light);
    box-shadow: 0 0 14px rgba(232, 176, 75, 0.4), inset 0 0 8px rgba(232, 176, 75, 0.14);
  }
</style>

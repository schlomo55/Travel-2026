<script lang="ts">
  /* ONE button, everywhere a place has a location.

     It hands the place to Android as a `geo:` intent, so the phone puts up its
     own chooser the first time — Google Maps, Amap, Organic Maps, Waze — and
     then remembers the answer. That is the whole design: we do not decide
     which map the owner uses, the owner does, once.

     Pure link building: nothing is fetched, so this renders identically with
     the network hard off. And when a place has no verified location at all,
     the button does not render — a missing button is the honest outcome, not
     a gap. Long-press copies the name, for a phone with no map app on it.

     Horizon: a secondary pill with a pin (no emoji), a 44 px icon-only
     `compact` form, the guide's outlined `pill`, the white driver card's
     `paper` form, and `short` for a row of pass actions ("Maps"). */
  import type { Coord } from '../../model/types';
  import { geoUri, googleMapsUrl, type MapTarget } from '../../logic/geo';
  import { openInMaps } from '../../platform/maps';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

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
    paper = false,
    short = false,
    noAddressCopy = false,
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
    /** The city guide's outlined "Open in Maps" pill. */
    pill?: boolean;
    /** On a white for-other-eyes card. */
    paper?: boolean;
    /** "Maps" — one of a row of pass actions. */
    short?: boolean;
    /** The screen draws its own address copy (the driver card). */
    noAddressCopy?: boolean;
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
  const label = $derived(pill ? S.plan.openInMaps : short ? S.maps.short : S.maps.open);
</script>

{#if usable}
  <div class="maps" class:compact class:pill class:paper class:short>
    <button
      class="mapbtn"
      data-geo={geo}
      onclick={() => openInMaps(target)}
      oncontextmenu={copy}
      aria-label={S.maps.openIn(name)}
      title={S.maps.open}
    >
      <Icon name="pin" size={compact ? 20 : 17} />
      {#if !compact}<span>{label}</span>{/if}
    </button>
  </div>
  <!-- The address in Chinese is what you paste into Didi. The long-press stays
       the fast path; this is the visible one. It is deliberately OUTSIDE
       `.maps`: "one button per place" means one button that OPENS A MAP, and
       a copy control is not a second map app. -->
  {#if address && !compact && !noAddressCopy}
    <button class="addrcopy" class:pill class:short onclick={copy} title={S.maps.copyAddress}>
      <Icon name="copy" size={16} />
      <span>{S.maps.copyAddressBtn}</span>
    </button>
  {/if}
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
    gap: 8px;
    min-height: 44px;
    padding: 8px 16px;
    background: var(--card-2);
    border: 1px solid var(--edge);
    border-radius: 999px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink);
  }
  .mapbtn:active {
    background: var(--sunrise-soft);
    border-color: var(--sunrise);
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
    background: none;
    border: none;
    color: var(--ink-2);
  }
  .maps.short {
    margin-top: 0;
  }
  .maps.short .mapbtn {
    min-height: 48px;
    padding: 8px 10px;
    font-size: var(--fs-caption);
  }
  .addrcopy {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 44px;
    margin-top: 10px;
    padding: 8px 16px;
    background: var(--card-2);
    border: 1px solid var(--edge);
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .addrcopy:active {
    border-color: var(--sunrise);
    color: var(--sunrise);
  }
  .addrcopy.pill,
  .addrcopy.short {
    margin-top: 0;
  }

  /* the guide's pill: outlined sunrise */
  .maps.pill {
    margin-top: 0;
    flex-shrink: 0;
    /* the row shares its name with the app's .pill chip (app.css) and must
       not wear it: only the button is the pill */
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
  }
  .maps.pill .mapbtn {
    flex: none;
    white-space: nowrap;
    background: none;
    border: 1.5px solid var(--sunrise);
    color: var(--sunrise);
  }

  /* on a white card read by a stranger: ink on paper */
  .maps.paper {
    margin-top: 0;
  }
  .maps.paper .mapbtn {
    min-height: 54px;
    font-size: var(--fs-body);
    color: var(--counter-ink);
    background: var(--counter-paper);
    border: 1.5px solid var(--counter-ink);
  }
</style>

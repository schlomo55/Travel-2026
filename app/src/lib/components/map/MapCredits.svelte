<script lang="ts">
  /* MAP CREDITS (10 Nov 2026) — the full words behind the one line at the map's foot ("© OpenStreetMap
     contributors"): whose map data it is and where the streets on screen are kept (the saved map on this phone —
     or, in the app, the internet for the tiles it lacks), and the licence's own page: a link out, which needs the
     internet and opens outside the app like every link on the Map tab. The place photos' credits stay where they
     were: Settings › Map pack. A Sheet: Android back closes it. */
  import { external } from '../../platform/links';
  import { S } from '../../i18n/strings';
  import { SM } from '../../i18n/mapview';
  import Sheet from '../ui/Sheet.svelte';
  import MapIcon from './MapIcon.svelte';

  const COPYRIGHT = 'openstreetmap.org/copyright';

  let { online, onclose }: { online: boolean; onclose: () => void } = $props();
</script>

<Sheet title={SM.creditsTitle} {onclose}>
  <p class="mc-p">{online ? S.mapTab.attributionShort : S.mapTab.attribution}</p>
  <a class="mc-link" href="https://www.{COPYRIGHT}" onclick={(e) => external(e, `https://www.${COPYRIGHT}`)}>
    <span>{COPYRIGHT}</span>
    <MapIcon name="external" size={14} stroke={2} />
  </a>
</Sheet>

<style>
  .mc-p {
    margin: 0 0 10px;
    font-size: var(--fs-label);
    line-height: 1.5;
    color: var(--ink);
  }
  .mc-link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--lilac-ink);
  }
</style>

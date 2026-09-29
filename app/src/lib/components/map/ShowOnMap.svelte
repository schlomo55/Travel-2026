<script lang="ts">
  /* "SHOW ON MAP" (Map 5c) — the doorway from the guide, a pass, Find and the
     day onto the Map tab, opening at the place's own sheet. Drawn only where
     the Map tab draws the place (a verified position — lib/logic/mapplaces
     drawnIds): no pin, no doorway. A link, because it goes somewhere: the
     map's address is #/trip/:id/map/:place (router.mapHash). Small on purpose
     — it lives in the screens that start the app, and the map itself loads
     only when it is followed. Its glyph is the nav's Map; its name says which
     map, beside the pin button that hands the place to the phone's map app. */
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let { tripId, id, name, labelled = false }: { tripId: string; id: string; name: string; labelled?: boolean } = $props();
</script>

<a class="onmap" class:btn={labelled} class:labelled href={router.mapHash(tripId, id)} aria-label={S.mapTab.showOnMapAria(name)}>
  <Icon name="map" size={labelled ? 16 : 19} />
  {#if labelled}<span>{S.mapTab.showOnMap}</span>{/if}
</a>

<style>
  .onmap {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius-pill);
    color: var(--ink-2);
    text-decoration: none;
  }
  .onmap:active {
    color: var(--sunrise);
  }
  .onmap.labelled {
    color: var(--ink);
  }
</style>

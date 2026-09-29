<script lang="ts">
  /* A PLACE'S PHOTO, FULL SCREEN (Map 5e, option A) — the whole photo, as
     large as the screen allows (uncropped), under the place's name; its
     credit — who took it, under which licence — and its file page, which
     needs the internet and opens outside the app. A layer (router.pushLayer):
     ✕, Escape and Android back close it, and the place's sheet is where it
     was. Pinch-zoom is not offered (the brief). Focus goes to ✕ as it opens;
     the screen that opened it takes focus back as it closes. The photo, in a
     quiet frame, and its caption are one group in the middle of the screen
     (Map 5f: a wide photo between two empty bands read as "not loaded"). */
  import { untrack } from 'svelte';
  import { creditLine, type PackPhoto as Photo } from '../../logic/placephotos';
  import type { PhotoSource } from '../../map/photoUrls';
  import { router } from '../../state/router.svelte';
  import { external } from '../../platform/links';
  import { SP } from '../../i18n/photos';
  import MapIcon from './MapIcon.svelte';
  import PackPhoto from './PackPhoto.svelte';

  let {
    src,
    photo,
    name,
    native,
    onclose,
  }: {
    src: PhotoSource;
    photo: Photo;
    name: string;
    native?: string;
    onclose: () => void;
  } = $props();

  let closeBtn = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    const layer = router.pushLayer(() => {
      onclose();
      return true;
    });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void router.closeTopLayer();
    };
    window.addEventListener('keydown', onKey);
    untrack(() => closeBtn?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener('keydown', onKey);
      layer();
    };
  });
  const site = $derived(photo.site ?? 'Wikimedia Commons');
</script>

<div class="pv" role="dialog" aria-modal="true" aria-label={SP.viewerAria(name)} tabindex="-1">
  <div class="pv-top">
    <span class="pv-names">
      <span class="pv-name">{name}</span>
      {#if native}<span class="pv-zh zh" lang="zh">{native}</span>{/if}
    </span>
    <button class="pv-x" bind:this={closeBtn} onclick={() => void router.closeTopLayer()} aria-label={SP.close}><MapIcon name="close" size={20} stroke={2} /></button>
  </div>
  <!-- the photo and its caption, one group in the middle of the screen (Map 5f): the room above and below a wide
       photo is the screen's own, not a photo still loading -->
  <div class="pv-body">
    <div class="pv-img">
      <PackPhoto {src} span={photo.card} eager alt={SP.alt(name)} />
    </div>
    <div class="pv-foot">
      <p class="pv-credit">{creditLine(photo)}</p>
      <p class="pv-note">{SP.changed}</p>
      <a class="pv-link" href={photo.source} onclick={(e) => external(e, photo.source)} aria-label={SP.sourceAria(name, site)}>
        <MapIcon name="external" size={15} stroke={2} />{SP.filePage(site)}
      </a>
    </div>
  </div>
</div>

<style>
  /* a full-screen layer, above the nav and every sheet (the driver card's level) */
  .pv {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background: var(--sky);
    outline: none;
  }
  .pv-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  }
  .pv-names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pv-name {
    font-size: var(--fs-row);
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pv-zh {
    font-family: var(--font-zh);
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .pv-x {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  /* the photo and its caption as one group, centred in the room under the top row (Map 5f: the photo alone took the
     middle and the caption sat at the foot, so a wide photo floated between two empty bands that read as "not
     loaded"); a tall photo shrinks to leave its caption room */
  .pv-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pv-img {
    flex: 0 1 auto;
    min-height: 0;
    display: flex;
    justify-content: center;
    padding: 0 8px;
  }
  /* a quiet frame: the photo's own edge, as the card draws its photo */
  .pv-img :global(img) {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: var(--radius-inner);
    box-shadow: 0 0 0 1px var(--line);
  }
  .pv-foot {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px 16px;
  }
  .pv-credit {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink);
  }
  .pv-note {
    margin: 0;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .pv-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-top: 4px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
</style>

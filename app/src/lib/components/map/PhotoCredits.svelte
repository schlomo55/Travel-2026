<script lang="ts">
  /* PHOTO CREDITS (Map 5e) — Settings › Map pack › Photo credits: every photo
     the map pack on this phone carries, place by place — its file's name, who
     took it, its licence, and a link to its own page — and every About text,
     Wikipedia's words, with its article. What the free licences ask of us:
     the author, the licence (each linked once, at the top), where the work
     lives, and that it was changed (resized and cropped). The links need the
     internet and open outside the app. A sheet: Android back closes it.

     Map 5f: a photo is titled by the title its author gave it where the pack
     carries one (a Flickr photo's, found through Openverse) — never by a
     library's internal id —, else by its file's name; a photo with neither is
     "A photo on Flickr". The licences list the About texts' too, so
     Wikipedia's CC BY-SA 4.0 is linked whether or not a photo shares it. And a
     link's name carries the credit it shows: a screen reader hears who took
     the photo and under which licence, as the eye reads it. */
  import { creditRows, licencesUsed, photoTitle, type PhotoIndex } from '../../logic/placephotos';
  import { external } from '../../platform/links';
  import { SP } from '../../i18n/photos';
  import Sheet from '../ui/Sheet.svelte';
  import MapIcon from './MapIcon.svelte';

  let { index, onclose }: { index: PhotoIndex | null; onclose: () => void } = $props();

  const rows = $derived(creditRows(index));
  const licences = $derived(licencesUsed(index));
</script>

<Sheet title={SP.credits} {onclose}>
  {#if !rows.length}
    <p class="cr-none">{SP.creditsNone}</p>
  {:else}
    <p class="cr-intro">{SP.creditsIntro}</p>
    <h3 class="caps cr-h">{SP.licences}</h3>
    <ul class="cr-lics">
      {#each licences as l (l.licence)}
        <li>
          {#if l.url}
            <a class="cr-link" href={l.url} onclick={(e) => external(e, l.url!)}>
              <span class="cr-main">{l.licence}</span>
              <span class="cr-sub num">{SP.licenceCount(l.n, l.texts)}</span>
              <MapIcon name="external" size={14} stroke={2} />
            </a>
          {:else}
            <span class="cr-link plain"><span class="cr-main">{l.licence}</span><span class="cr-sub num">{SP.licenceCount(l.n, l.texts)}</span></span>
          {/if}
        </li>
      {/each}
    </ul>
    <ul class="cr-list">
      {#each rows as r (r.id)}
        <li class="cr-row">
          <h3 class="cr-name">{r.name}{#if r.city}<span class="cr-city">{` · ${r.city}`}</span>{/if}</h3>
          {#if r.photo}
            {@const site = r.photo.site ?? 'Wikimedia Commons'}
            {@const title = photoTitle(r.photo) || SP.untitled(site)}
            {@const by = SP.photoBy(r.photo.author, r.photo.licence)}
            <a class="cr-link" href={r.photo.source} onclick={(e) => external(e, r.photo!.source)} aria-label={`${SP.sourceAria(r.name, site)}: “${title}”, ${by}`}>
              <span class="cr-main">{title}</span>
              <span class="cr-sub">{by}</span>
              <MapIcon name="external" size={14} stroke={2} />
            </a>
          {/if}
          {#if r.about}
            <a class="cr-link" href={r.about.url} onclick={(e) => external(e, r.about!.url)} aria-label={`${SP.textAria(r.about.title)} · ${r.about.licence}`}>
              <span class="cr-main">{SP.textBy(r.about.title, r.about.licence)}</span>
              <MapIcon name="external" size={14} stroke={2} />
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Sheet>

<style>
  .cr-none,
  .cr-intro {
    margin: 0 0 12px;
    font-size: var(--fs-caption);
    line-height: 1.5;
    color: var(--ink-2);
  }
  .cr-h {
    margin: 8px 0 6px;
    color: var(--faint);
  }
  .cr-lics,
  .cr-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cr-lics {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .cr-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
    border-top: 1px solid var(--line);
  }
  .cr-name {
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
  }
  .cr-city {
    font-weight: 400;
    color: var(--ink-2);
  }
  .cr-link {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 14px;
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .cr-link.plain {
    grid-template-columns: minmax(0, 1fr);
  }
  .cr-link :global(.micon) {
    grid-column: 2;
    grid-row: 1 / span 2;
    color: var(--ink-2);
  }
  .cr-main {
    font-size: var(--fs-caption);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .cr-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
</style>

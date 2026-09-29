<script lang="ts">
  /* A PLACE'S PHOTO FROM THE MAP PACK (Map 5e) — one slice of the pack on this
     phone, shown through an object URL that is handed back as the image goes
     (lib/map/photoUrls.ts), so nothing leaks as cards are drawn and dropped.
     Fully offline. The crop keeps the photo's own focal point. A photo that
     will not decode leaves the element empty: the box under it (the category
     colour) shows through, and nothing is guessed in its place. */
  import type { HTMLImgAttributes } from 'svelte/elements';
  import type { PhotoSpan } from '../../logic/placephotos';
  import { acquire, release, type PhotoSource } from '../../map/photoUrls';

  let {
    src,
    span,
    fy,
    eager = false,
    ...rest
  }: {
    src: PhotoSource;
    span: PhotoSpan;
    /** the vertical point the crop keeps, 0 top … 1 bottom */
    fy?: number;
    eager?: boolean;
  } & Omit<HTMLImgAttributes, 'src'> = $props();

  let url = $state<string | null>(null);
  let broken = $state(false);
  $effect(() => {
    const f = src.file;
    const s = span;
    url = acquire(f, src.index, s);
    broken = false;
    return () => release(f, s);
  });
</script>

{#if url && !broken}
  <img
    src={url}
    width={span[2]}
    height={span[3]}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    style="object-position: 50% {Math.round((fy ?? 0.5) * 100)}%"
    onerror={() => (broken = true)}
    {...rest}
  />
{/if}

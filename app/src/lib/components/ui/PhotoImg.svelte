<script lang="ts">
  /* A documents-vault photo drawn from its IndexedDB blob, fully offline.
     The object URL is created when the blob arrives and revoked on teardown
     or when docId changes — nothing leaks under liveQuery-driven re-renders.
     Renders nothing until ready (and never for a missing/broken blob), so a
     parent's fallback layer underneath simply stays visible. */
  import type { HTMLImgAttributes } from 'svelte/elements';
  import { documentBlob } from '../../data/documents';
  import type { Id } from '../../model/types';

  let { docId, ...rest }: { docId: Id } & HTMLImgAttributes = $props();

  let url = $state<string | null>(null);

  $effect(() => {
    const id = docId;
    let created: string | null = null;
    let dead = false;
    void documentBlob(id).then((blob) => {
      if (dead || !blob) return;
      created = URL.createObjectURL(blob);
      url = created;
    });
    return () => {
      dead = true;
      if (created) URL.revokeObjectURL(created);
      url = null;
    };
  });
</script>

{#if url}
  <img src={url} loading="lazy" decoding="async" {...rest} onerror={() => (url = null)} />
{/if}

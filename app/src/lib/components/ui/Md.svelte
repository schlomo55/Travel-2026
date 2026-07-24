<script lang="ts">
  import { renderMdlite } from '../../logic/mdlite';

  let { text, as = 'span' }: { text: string; as?: 'span' | 'div' | 'li' } = $props();

  /* renderMdlite escapes before it formats, so stored content can never
     inject markup — this is the only place {@html} is used. */
  const html = $derived(renderMdlite(text));
</script>

{#if as === 'div'}
  <div>{@html html}</div>
{:else if as === 'li'}
  <li>{@html html}</li>
{:else}
  <span>{@html html}</span>
{/if}

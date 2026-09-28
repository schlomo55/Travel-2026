<script lang="ts">
  import { flagVerify, renderMdlite } from '../../logic/mdlite';

  let { text, as = 'span', verify = false }: { text: string; as?: 'span' | 'div' | 'li'; verify?: boolean } = $props();

  /* renderMdlite escapes before it formats, so stored content can never
     inject markup — this is the only place {@html} is used. `verify` sets
     the trip file's own *(verify …)* marker as a chip (the guide), so the
     honesty flag reads as a flag and not as an aside. */
  const html = $derived(
    verify ? flagVerify(renderMdlite(text)) : renderMdlite(text),
  );
</script>

{#if as === 'div'}
  <div>{@html html}</div>
{:else if as === 'li'}
  <li>{@html html}</li>
{:else}
  <span>{@html html}</span>
{/if}

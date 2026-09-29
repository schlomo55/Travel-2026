<script lang="ts">
  /* One of the map's glyphs (lib/map/icons.ts) as inline SVG — the same
     drawing the engine paints on a pin. Decorative: every control that
     carries one also carries a word or a label. */
  import { GLYPH } from '../../map/icons';

  let { name, size = 20, stroke = 1.8 }: { name: string; size?: number; stroke?: number } = $props();
</script>

<svg
  class="micon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each GLYPH[name] ?? [] as d, i (i)}<path {d} />{/each}
</svg>

<style>
  .micon {
    flex-shrink: 0;
    display: block;
  }
</style>

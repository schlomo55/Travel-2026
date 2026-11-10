<script lang="ts" module>
  /* HORIZON'S ICONS — the drawings are iconpaths.ts's (the map's glyphs borrow some) */
  import { I } from './iconpaths';

  /** an icon's inner markup: each bare path's data becomes its <path> */
  const inner = (name: string): string =>
    (I[name] ?? '')
      .split('|')
      .map((p) => (p[0] == '<' ? p : `<path d="${p}"/>`))
      .join('');

  export type IconName = keyof typeof I;
  export function hasIcon(name: string): boolean {
    return name in I;
  }
  /** A glyph as markup, for text the app sets as HTML (the guide's option
      lines) — the same drawing, 16 px, decorative. */
  export const iconSvg = (name: string): string =>
    `<svg class="hicon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner(name)}</svg>`;
</script>

<script lang="ts">
  let {
    name,
    size = 20,
    stroke = 1.8,
    label,
    class: cls = '',
  }: {
    name: string;
    size?: number;
    stroke?: number;
    /** Only for an icon that stands alone as meaning; controls label themselves. */
    label?: string;
    class?: string;
  } = $props();

</script>

<svg
  class="hicon {cls}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {@html inner(name)}
</svg>

<style>
  .hicon {
    flex-shrink: 0;
    display: block;
  }
</style>

<script lang="ts">
  /* THE PLACE SHEET'S MINI RADAR (map4-place) — you at the centre, north up,
     the place at its true bearing on a ring sized to it: the outer ring is the
     next round distance past it (500 m, 1 km, 2 km, 5 km…), the inner one
     half that. A picture of the sentence beside it, so it is one image with
     that sentence as its name. */
  let { deg, m, color, label }: { deg: number; m: number; color: string; label: string } = $props();

  const RINGS = [250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const outer = $derived(RINGS.find((r) => r >= m) ?? m);
  const r = $derived(Math.max(6, Math.min(40, (m / outer) * 40)));
  const a = $derived((deg * Math.PI) / 180);
  const x = $derived(44 + r * Math.sin(a));
  const y = $derived(44 - r * Math.cos(a));
</script>

<svg class="radar" role="img" aria-label={label} width="88" height="88" viewBox="0 0 88 88" fill="none">
  <circle cx="44" cy="44" r="42" style="fill: var(--sky-2); stroke: var(--line)" />
  <circle cx="44" cy="44" r="20" stroke="rgba(255,159,107,0.28)" stroke-dasharray="2 3" />
  <circle cx="44" cy="44" r="40" stroke="rgba(255,159,107,0.2)" />
  <path d="M44 6v6" style="stroke: var(--sunrise)" stroke-width="1.5" stroke-linecap="round" />
  <path d="M44 44 L{x.toFixed(1)} {y.toFixed(1)}" style="stroke: {color}" stroke-width="1.5" stroke-dasharray="2 3" stroke-linecap="round" />
  <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="5" style="fill: {color}" />
  <circle cx="44" cy="44" r="4" style="fill: var(--sunrise-fill)" />
  <text x="44" y="24" text-anchor="middle" class="r-n">N</text>
</svg>

<style>
  .radar {
    flex-shrink: 0;
    display: block;
  }
  .r-n {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
    font-size: 11px;
    fill: var(--faint);
  }
</style>

<script lang="ts">
  /* GUIDE ME'S COMPASS (map4-go) — the rose turns so the top is the way you
     face (the letter you face lit sunrise); the arrow points at the place.
     Heading from the phone's compass (true north, the declination added) or
     your walking course; with neither, north is at the top and the arrow
     points from there — the words beside it say which. The arrow takes the
     short way round (359° → 1° is two degrees, not a lap); under Calm motion
     it simply jumps (app.css). Its glow is still: the motion rules give the
     Map tab one loop, the guide line. */
  import { compass16, norm360 } from '../../logic/wayfind';

  let { bearing, heading, label }: { bearing: number | null; heading: number | null; label: string } = $props();

  /* the arrow's angle keeps turning the short way, so its transition does too */
  let last = 0;
  const near = (prev: number, next: number): number => prev + ((((next - prev) % 360) + 540) % 360) - 180;
  const arrow = $derived.by(() => (bearing === null ? last : (last = near(last, bearing - (heading ?? 0)))));
  const facing = $derived(heading === null ? null : compass16(heading));
  /* the four letters where they stand from the way you face, upright */
  const letters = $derived(
    (['N', 'E', 'S', 'W'] as const).map((l, i) => {
      const a = (norm360(i * 90 - (heading ?? 0)) * Math.PI) / 180;
      return { l, x: 75 + 46 * Math.sin(a), y: 79 - 46 * Math.cos(a) };
    }),
  );
</script>

<svg class="compass" role="img" aria-label={label} width="150" height="150" viewBox="0 0 150 150" fill="none">
  <circle cx="75" cy="75" r="72" style="fill: var(--card); stroke: var(--line)" stroke-width="1" />
  <circle cx="75" cy="75" r="72" stroke="rgba(255,159,107,0.35)" stroke-width="2" stroke-dasharray="1 17.85" />
  <circle cx="75" cy="75" r="56" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
  <path d="M75 6v10" style="stroke: var(--sunrise)" stroke-width="2.5" stroke-linecap="round" />
  {#each letters as t (t.l)}
    <text x={t.x.toFixed(1)} y={t.y.toFixed(1)} text-anchor="middle" class="c-l" class:facing={facing === t.l}>{t.l}</text>
  {/each}
  {#if bearing !== null}
    <g class="c-arrow" style="transform: rotate({arrow}deg)">
      <path d="M75 30 L92 88 L75 78 L58 88 Z" style="fill: var(--c, var(--cat-spa))" />
      <path d="M75 30 L75 78 L58 88 Z" style="fill: var(--c, var(--cat-spa))" opacity="0.72" />
    </g>
  {/if}
  <circle cx="75" cy="75" r="5" style="fill: var(--sunrise-fill)" />
</svg>

<style>
  .compass {
    flex-shrink: 0;
    display: block;
  }
  .c-arrow {
    transform-origin: 75px 75px;
    transition: transform 240ms var(--ease-out);
    filter: drop-shadow(0 0 8px rgba(127, 227, 240, 0.7));
  }
  .c-l {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
    font-size: 11px;
    font-weight: 600;
    fill: var(--faint);
  }
  .c-l.facing {
    fill: var(--sunrise);
  }
</style>

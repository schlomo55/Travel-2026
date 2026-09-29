<script lang="ts">
  /* FLOW — live: dashes (7 7) streaming along the leg you are on, over a
     faint copy of the same leg. The only route that loops. Its end state —
     Calm motion, reduce-motion, Route animations off — is a solid line with
     an arrowhead (app.css closes the dashes and shows the arrow). Off the
     screen it stands still (lib/motion/offscreen.ts). */
  import { offscreen } from './offscreen';

  let {
    d,
    stroke,
    tip,
    width = 2.5,
    cls = '',
  }: {
    d: string;
    stroke: string;
    /** the end of the leg and the way it points there */
    tip: { x: number; y: number; angle: number };
    width?: number;
    cls?: string;
  } = $props();
</script>

<path class="fl-under {cls}" {d} {stroke} stroke-width={width} />
<path class="flow fl-line {cls}" {d} {stroke} stroke-width={width} use:offscreen />
<path class="flow-arrow fl-arrow {cls}" d="M-9 -5 L1 0 L-9 5 Z" transform="translate({tip.x} {tip.y}) rotate({tip.angle})" />

<style>
  path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fl-under {
    opacity: 0.35;
  }
  .fl-line {
    filter: drop-shadow(0 0 5px rgba(255, 126, 182, 0.7));
  }
  .fl-arrow {
    fill: var(--route-today);
    stroke: none;
  }
</style>

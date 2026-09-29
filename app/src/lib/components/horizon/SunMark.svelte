<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /* The app's own icon as a mark: a sun rising behind a ridge, on the
     horizon line (f-trips header). The sun's glow breathes — one of the three
     ambient motions the system allows — and stops under Calm motion, and
     while it is off the screen (lib/motion/offscreen.ts). */
  import { offscreen } from '../../motion/offscreen';

  let { size = 38, breathe = true }: { size?: number; breathe?: boolean } = $props();
  const id = `sunmark-${++seq}`;
</script>

<svg class="sunmark" width={size} height={size} viewBox="0 0 38 38" fill="none" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient {id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--opal-1)" />
      <stop offset="1" style="stop-color: var(--opal-2)" />
    </linearGradient>
  </defs>
  <circle class="sun" class:breathe cx="19" cy="23" r="9" fill="url(#{id})" use:offscreen />
  <path class="ridge" d="M2 30 L12 19 L18 25 L25 16 L36 30 Z" stroke-width="1" stroke-linejoin="round" />
  <path class="line" d="M1 30.5 H37" stroke-width="1.2" stroke-linecap="round" />
</svg>

<style>
  .sunmark {
    display: block;
    flex-shrink: 0;
  }
  .sun {
    filter: drop-shadow(0 0 5px rgba(255, 159, 107, 0.7));
  }
  .sun.breathe {
    animation: h-sun var(--duration-sun) ease-in-out infinite;
  }
  .ridge {
    fill: var(--ridge-3);
    stroke: var(--opal-1);
    stroke-opacity: 0.55;
  }
  .line {
    stroke: var(--opal-1);
  }
</style>

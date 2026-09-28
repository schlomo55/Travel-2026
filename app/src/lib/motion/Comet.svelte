<script lang="ts">
  /* COMET — moving through time: a bright head with a fading tail flies the
     leg once, and the star it reaches flashes. One-shot: it tells its parent
     when it has landed, so the parent can take it away (and let the next
     one-shot play — never two at once). Calm motion shows the end state:
     the leg and its end simply lit (app.css). */
  let {
    d,
    end,
    onend,
    trail,
  }: {
    d: string;
    end: { x: number; y: number };
    onend?: () => void;
    /** a stroke that paints the leg behind the head (Replay) */
    trail?: string;
  } = $props();
</script>

<g class="comet">
  {#if trail}<path class="comet-ink" pathLength="1" {d} stroke={trail} />{/if}
  <path class="comet-tail" pathLength="1" {d} />
  <path class="comet-head" pathLength="1" {d} onanimationend={() => onend?.()} />
  <circle class="comet-flash" cx={end.x} cy={end.y} r="9" />
</g>

<style>
  path {
    fill: none;
    stroke-linecap: round;
  }
  .comet-ink {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.75));
  }
  .comet-tail {
    stroke: var(--route-today);
    stroke-width: 3;
    opacity: 0.55;
  }
  .comet-head {
    stroke: #fff4ec;
    stroke-width: 6;
    filter: drop-shadow(0 0 6px rgba(255, 244, 236, 0.95));
  }
  .comet-flash {
    fill: none;
    stroke: var(--route-today);
    stroke-width: 2;
  }
  :global(:root[data-theme='light']) .comet-head {
    stroke: var(--route-lit);
    filter: none;
  }
</style>

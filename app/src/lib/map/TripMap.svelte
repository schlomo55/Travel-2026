<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /* THE TRIP AS A CONSTELLATION (f-now, f-trips) — every stop a star at its
     real stored coordinates (logic/constellation.ts lays it out), north up,
     on a faint grid of real latitudes.

     WHAT MOVES, AND WHAT IT MEANS (system/README.md § Motion):
     · FLOW on the live leg — the one you are on today, else the next — is
       the only loop;
     · INK paints the road so far once on the first open of a day (and again
       when a leg is finished), then it stays painted; a tap skips it;
     · COMET flies a leg once when the parent asks (never together with Ink);
     · the you-are-here PING is the one ambient pulse.
     Calm motion, reduce-motion and Route animations off show the end states;
     nothing runs while the app is hidden (app.css). Words never move. */
  import type { Constellation, Leg } from '../logic/constellation';
  import { graticule } from '../logic/projection';
  import { inkPace } from '../logic/motion';
  import type { RelayStep } from '../logic/motion';
  import { inkOnce, inkVars } from '../motion/ink';
  import { relay } from '../motion/relay';
  import FlowPath from '../motion/FlowPath.svelte';
  import Comet from '../motion/Comet.svelte';
  import { offscreen } from '../motion/offscreen';

  let {
    c,
    grid = false,
    ink = null,
    shelf = false,
    comet = null,
    oncometend,
    trail = false,
    ontap,
    flags,
    relayAt,
    quiet = false,
  }: {
    c: Constellation;
    /** the latitude grid and its labels (Now) */
    grid?: boolean;
    /** Ink's memory key (logic/motion.ts inkKey) — null never inks */
    ink?: string | null;
    /** the small card on the Trips shelf */
    shelf?: boolean;
    /** a leg to fly a Comet along, once */
    comet?: Leg | null;
    oncometend?: () => void;
    /** the Comet leaves its leg painted behind it (Replay: the road so far is
        drawn by the comet that walks it) */
    trail?: boolean;
    /** a tap on the map itself (Now flies a Comet along the live leg) */
    ontap?: () => void;
    /** Relay's end state: a ring on each stop not fully booked (coverage tone) */
    flags?: Map<string, string>;
    /** the Relay sweep: each ring lights at its stop's moment (Journey) */
    relayAt?: Map<string, RelayStep>;
    /** hide the rings for now (Journey while Play runs) — they stay MOUNTED,
        so their sweep is not run again when they show (Run 3c: unmounted,
        they replayed their delays and amber/red stayed dark for seconds) */
    quiet?: boolean;
  } = $props();

  const n = ++seq;
  const ids = { lit: `tm-lit-${n}`, today: `tm-today-${n}`, ring: `tm-ring-${n}` };

  /* Ink decides once, when the map first draws: a second open of the same
     day finds the road already painted. A tap, or a Comet, skips to the end. */
  let inking = $state(false);
  $effect.pre(() => {
    if (ink) inking = inkOnce(ink);
  });
  $effect(() => {
    if (comet) inking = false;
  });
  let svg = $state<SVGSVGElement | null>(null);
  $effect(() => {
    const skip = (): void => {
      inking = false;
    };
    const tap = (): void => ontap?.();
    svg?.addEventListener('pointerdown', skip);
    svg?.addEventListener('click', tap);
    return () => {
      svg?.removeEventListener('pointerdown', skip);
      svg?.removeEventListener('click', tap);
    };
  });

  const done = $derived(c.legs.filter((l) => l.state === 'done'));
  const pace = $derived(inkPace(done.map((l) => l.len), 2500));
  /* a star blooms as the brush reaches it */
  const bloomAt = $derived(new Map(done.map((l, i) => [l.to.id, pace[i]!.delay + pace[i]!.dur])));
  const g = $derived(grid ? graticule(c.proj, c) : null);
  /* a latitude label gives way to a stop's name on the same line, and is not
     written where Now's floating header (the top 56) or its sheet's lip (the
     bottom 40) would half-cover it — the line itself still runs there */
  const latClear = (y: number): boolean =>
    y > 56 &&
    y < c.height - 40 &&
    !c.labels.some((l) => Math.abs(l.y - (y - 4)) < 13 && (l.anchor === 'end' ? l.x : l.x + 8.4 * (l.lines[0]?.length ?? 0) * (l.anchor === 'middle' ? 0.5 : 1)) > c.width - 64);
</script>

<svg
  bind:this={svg}
  class="tmap"
  class:shelfmap={shelf}
  viewBox="0 0 {c.width} {c.height}"
  aria-hidden="true"
  focusable="false"
>
  <defs>
    <linearGradient id={ids.lit} x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" style="stop-color: var(--opal-1)" />
      <stop offset="1" style="stop-color: var(--route-lit)" />
    </linearGradient>
    <linearGradient id={ids.today} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--route-lit)" />
      <stop offset="0.55" style="stop-color: var(--route-today)" />
      <stop offset="1" style="stop-color: var(--route-future)" />
    </linearGradient>
    <linearGradient id={ids.ring} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color: var(--opal-1)" />
      <stop offset="0.35" style="stop-color: var(--opal-2)" />
      <stop offset="0.7" style="stop-color: var(--opal-3)" />
      <stop offset="1" style="stop-color: var(--opal-4)" />
    </linearGradient>
  </defs>

  {#if g}
    <g class="grid">
      {#each g.lats as l (l.label)}<path d="M24 {l.y}H{c.width - 24}" />{/each}
      {#each g.lngs as l (l.x)}<path d="M{l.x} 0V{c.height}" />{/each}
    </g>
    {#each g.lats as l (l.label)}{#if latClear(l.y)}<text class="lat" x={c.width - 20} y={l.y - 4}>{l.label}</text>{/if}{/each}
  {/if}

  {#each c.legs as l, i (i)}
    {#if l.live}
      <FlowPath d={l.d} stroke="url(#{ids.today})" tip={l.tip} width={shelf ? 2.4 : 2.5} />
    {:else if l.state === 'done'}
      {@const v = inking ? inkVars(pace[done.indexOf(l)]) : ''}
      {#if !shelf}<path class="leg glow" class:ink={inking} pathLength="1" d={l.d} style={v} />{/if}
      <path class="leg done" class:ink={inking} pathLength="1" d={l.d} stroke="url(#{ids.lit})" style={v} />
    {:else}
      <path class="leg ahead" class:unbooked={l.notBooked} d={l.d} />
    {/if}
    {#if l.arrow && !l.live}<path class="leg-arrow {l.state}" class:unbooked={l.notBooked} d="M-9 -6 L2 0 L-9 6 Z" transform="translate({l.tip.x} {l.tip.y}) rotate({l.tip.angle})" />{/if}
  {/each}

  <!-- keyed by the leg: consecutive legs in a Replay each fly from the start -->
  {#each comet ? [comet] : [] as cm (cm.d)}<Comet d={cm.d} end={cm.tip} onend={oncometend} trail={trail ? `url(#${ids.lit})` : undefined} />{/each}

  {#each c.stars as s (s.id)}
    {#if s.tonight}
      <circle class="here-halo" cx={s.x} cy={s.y} r="15" />
      <circle class="here-ring" cx={s.x} cy={s.y} r="8" stroke="url(#{ids.ring})" />
      <circle class="here-dot" cx={s.x} cy={s.y} r="3" />
    {:else if s.state === 'done'}
      <circle
        class="done-halo"
        class:bloom={inking}
        cx={s.x}
        cy={s.y}
        r="9"
        style={inking ? `--ink-d:${bloomAt.get(s.id) ?? 0}ms` : ''}
      />
      <circle class="done-dot" class:you={s.you} cx={s.x} cy={s.y} r={s.you ? 5.5 : 4} />
    {:else}
      <circle class="ahead-dot" cx={s.x} cy={s.y} r="3.8" />
    {/if}
    {#if s.you}<circle class="ping" cx={s.x} cy={s.y} r="5" use:offscreen />{/if}
    {#if flags?.get(s.id)}<circle class="flag {flags.get(s.id)}" class:quiet data-stop={s.id} cx={s.x} cy={s.y} r="11" use:relay={relayAt?.get(s.id)} />{/if}
  {/each}

  {#each c.labels as l (l.x + ':' + l.y)}
    <text class="lbl {l.tone}" x={l.x} y={l.y} text-anchor={l.anchor}
      >{l.lines[0]}{#if l.lines[1]}<tspan class="sub" x={l.x} dy="16">{l.lines[1]}</tspan>{/if}</text
    >
  {/each}
</svg>

<style>
  .tmap {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .grid path {
    stroke: var(--map-grid);
    stroke-width: 1;
    stroke-dasharray: 2 6;
  }
  .lat {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
    font-size: 11px;
    fill: var(--faint);
    text-anchor: end;
  }
  .leg {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .leg.ahead {
    stroke: var(--route-future);
    stroke-width: 2;
    stroke-dasharray: 0.1 7;
    opacity: 0.9;
  }
  .leg.ahead.unbooked {
    stroke: var(--warn);
  }
  /* the way on, off the edge of a city map */
  .leg-arrow {
    fill: var(--route-future);
  }
  .leg-arrow.done {
    fill: var(--route-lit);
  }
  .leg-arrow.unbooked {
    fill: var(--warn);
  }
  .flag {
    fill: none;
    stroke: var(--warn);
    stroke-width: 2;
  }
  .flag.crit {
    stroke: var(--crit);
  }
  /* hidden, not removed: an animation cannot overrule visibility */
  .flag.quiet {
    visibility: hidden;
  }
  /* Relay: a ring lights at its stop's moment in the sweep — the same moment
     its row lights in the route check under the map */
  .flag:global(.relay) {
    transform-box: fill-box;
    transform-origin: center;
    animation: tm-ring var(--rt) var(--ease-out) var(--rd) both;
  }
  @keyframes tm-ring {
    from {
      opacity: 0;
      transform: scale(0.4);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .leg.done {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.75));
  }
  .leg.glow {
    stroke: rgba(255, 159, 107, 0.28);
    stroke-width: 8;
    filter: blur(2px);
  }
  .shelfmap .leg.done {
    stroke-width: 2.4;
  }
  .done-halo {
    fill: var(--sunrise-soft);
  }
  .done-dot {
    fill: var(--opal-1);
  }
  .done-dot.you {
    fill: var(--sunrise-fill);
    filter: drop-shadow(0 0 8px rgba(255, 159, 107, 0.95));
  }
  .ahead-dot {
    fill: var(--sky);
    stroke: var(--route-future);
    stroke-width: 1.5;
  }
  .here-halo {
    fill: var(--lilac-soft);
  }
  .here-ring {
    fill: var(--sky);
    stroke-width: 2.5;
  }
  .here-dot {
    fill: var(--star);
  }
  .ping {
    fill: none;
    stroke: var(--sunrise-fill);
    stroke-width: 1.5;
    transform-box: fill-box;
    transform-origin: center;
    animation: h-ping var(--duration-ping) ease-out infinite;
  }
  .lbl {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    fill: var(--ink-2);
  }
  .lbl.you {
    fill: var(--sunrise);
  }
  .lbl.tonight {
    fill: var(--ink);
  }
  .lbl .sub {
    fill: var(--sunrise);
  }
</style>

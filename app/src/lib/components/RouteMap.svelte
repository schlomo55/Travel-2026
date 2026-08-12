<script module lang="ts">
  /* The map draws itself once per page load (plan §MOTION, ~600 ms) and is
     instant on every re-open, so scrolling back to Info is never a wait. */
  let drawnOnce = false;
</script>

<script lang="ts">
  /* The route, as a glowing metro diagram (plan §SCREENS 6).

     The model stays pure: routemap.ts decides every coordinate, and this file
     only decides how light falls on it. Line colour carries the transport
     kind — gold for air, the trip's own hue for rail and road — because that
     is the one place §DECISIONS still lets `accentHue` speak. */
  import type { Booking, ComplianceCounter, ISODate, Stop, Trip } from '../model/types';
  import { buildRouteMap } from '../logic/routemap';
  import { buildCoverage } from '../logic/coverage';
  import { mdliteToText } from '../logic/mdlite';

  let {
    trip,
    stops,
    bookings,
    counters,
    now = null,
    compact = false,
  }: {
    trip: Trip;
    stops: Stop[];
    bookings: Booking[];
    counters: ComplianceCounter[];
    now?: ISODate | null;
    compact?: boolean;
  } = $props();

  const m = $derived(buildRouteMap(trip, stops, bookings, counters, now));

  /* A STATION WITH A HOLE IN IT GETS A RING, and nothing else. The diagram's
     whole value is that it is uncluttered — the label collision pass exists
     because two names in one place made both unreadable — so an unbooked
     segment says so in colour at the dot rather than in another word beside
     it. Same derivation as the chips on Plans (logic/coverage.ts), so the map
     and the list can never disagree about what is held. */
  const flags = $derived(
    new Map(
      buildCoverage(trip, stops, bookings, now)
        .filter((s) => s.tone !== 'ok')
        .map((s) => [s.stopId, s.tone]),
    ),
  );
  const legPath = (fromY: number, toY: number, x: number): string =>
    `M ${x} ${fromY} C ${x + 22} ${fromY + (toY - fromY) * 0.3}, ${x + 22} ${fromY + (toY - fromY) * 0.7}, ${x} ${toY}`;

  let draw = $state(!drawnOnce);
  $effect(() => {
    if (!draw) return;
    drawnOnce = true;
    const id = setTimeout(() => (draw = false), 900);
    return () => clearTimeout(id);
  });
</script>

{#if m.stations.length === 0}
  <p class="muted" style="margin:0">Add stops with dates and the route draws itself.</p>
{:else}
  <div class="mapwrap" class:compact class:draw>
    <svg viewBox="0 0 {m.width} {m.height}" width="100%" height={compact ? 200 : m.height} role="img"
         aria-label="Route map: {m.stations.length} stops{flags.size ? `, ${flags.size} not fully booked` : ''}">
      <!-- date rail -->
      {#each m.ticks as t, i (i)}
        <line x1={m.spineX - 16} y1={t.y} x2={m.spineX - 9} y2={t.y}
              stroke="var(--line-2)" stroke-width={t.major ? 1.4 : 0.8} opacity={t.major ? 0.9 : 0.45} />
        {#if t.label}
          <text x={m.spineX - 20} y={t.y + 3.5} text-anchor="end" class="tick">{t.label}</text>
        {/if}
      {/each}

      <!-- the spine -->
      <line x1={m.spineX} y1={m.startY} x2={m.spineX} y2={m.endY} stroke="var(--line)" stroke-width="2" />

      <!-- legs between stops: colour = transport kind -->
      {#each m.legs as leg (leg.id)}
        {#if leg.mode === 'air'}
          <path class="ln air" pathLength="1" d={legPath(leg.fromY, leg.toY, m.spineX)} fill="none" />
          <text x={m.spineX + 26} y={(leg.fromY + leg.toY) / 2 + 4} class="legicon">✈</text>
        {:else if leg.mode === 'rail'}
          <line class="ln rail" pathLength="1" x1={m.spineX - 2.6} y1={leg.fromY} x2={m.spineX - 2.6} y2={leg.toY} />
          <line class="ln rail" pathLength="1" x1={m.spineX + 2.6} y1={leg.fromY} x2={m.spineX + 2.6} y2={leg.toY} />
        {:else}
          <line class="ln road" pathLength="1" x1={m.spineX} y1={leg.fromY} x2={m.spineX} y2={leg.toY} />
        {/if}
      {/each}

      <!-- stay bars + stations (each group re-tints via --h, dark-safe) -->
      {#each m.stations as s (s.id)}
        <g style="--h:{s.hue}">
          <rect class="bar" x={m.spineX - 5} y={s.barTop} width="10" height={Math.max(4, s.barBottom - s.barTop)}
                rx="5" fill="var(--stop)" />
          <circle class="dot" cx={m.spineX} cy={s.y} r="7" fill="var(--paper-2)" stroke="var(--stop)" stroke-width="3" />
          {#if flags.get(s.id)}
            <circle class="flag {flags.get(s.id)}" cx={m.spineX} cy={s.y} r="11.5" fill="none" stroke-width="1.6" />
          {/if}
          {#if !compact}
            <!-- leader line when a label had to move down to stay readable -->
            {#if s.labelY - s.y > 2}
              <path d="M {m.spineX + 9} {s.y} L {m.spineX + 15} {s.labelY - 5}" fill="none"
                    stroke="var(--stop)" stroke-width="1" opacity="0.55" />
            {/if}
            <text x={m.spineX + 19} y={s.labelY - 1} class="nm" class:here={s.isCurrent}>{s.emoji ?? ''} {mdliteToText(s.name)}</text>
            <text x={m.spineX + 19} y={s.labelY + 12} class="sub">
              {s.dateLabel}{s.nights ? ` · ${s.nights}n` : ''}{s.isCurrent ? ' · you are here' : ''}
            </text>
          {/if}
        </g>
      {/each}

      <!-- hard deadlines -->
      <!-- The tick stays on the real date; the LABEL takes the same collision
           pass as the stop labels (routemap.ts), with a leader when it moved. -->
      {#each m.walls as w, i (i)}
        <line x1={m.spineX - 13} y1={w.y} x2={m.width - 6} y2={w.y} stroke="var(--crit)" stroke-width="1.6" stroke-dasharray="3 3" />
        {#if !compact}
          {#if w.labelY - w.y > 2}
            <path d="M {m.width - 40} {w.y} L {m.width - 34} {w.labelY - 9}" fill="none" stroke="var(--crit)" stroke-width="1" opacity="0.5" />
          {/if}
          <text x={m.width - 6} y={w.labelY - 5} text-anchor="end" class="wall">{w.label}</text>
        {/if}
      {/each}

      <!-- you are here: the one infinite loop in the app -->
      {#if m.nowY !== null}
        <circle cx={m.spineX} cy={m.nowY} r="4.5" fill="var(--gold)" class="nowdot" />
        <circle class="nowring u-pulse" cx={m.spineX} cy={m.nowY} r="13" fill="none" stroke="var(--gold)" stroke-width="2" />
      {/if}

      <!-- termini -->
      <circle cx={m.spineX} cy={m.startY} r="3.4" fill="var(--ink-2)" />
      <circle cx={m.spineX} cy={m.endY} r="3.4" fill="var(--ink-2)" />
    </svg>
  </div>
{/if}

<style>
  .mapwrap {
    overflow-x: auto;
  }
  .mapwrap.compact svg {
    max-height: 200px;
  }
  .tick {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    fill: var(--faint);
  }
  .nm {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 650;
    fill: var(--ink);
  }
  .nm.here {
    fill: var(--gold);
  }
  .sub {
    font-size: var(--text-xs);
    fill: var(--faint);
  }
  .wall {
    font-size: var(--text-xs);
    fill: var(--crit);
    font-weight: 700;
  }
  .legicon {
    font-size: var(--text-xs);
    fill: var(--gold);
  }

  /* ---------- the metro lines ---------- */
  .ln {
    stroke-linecap: round;
    fill: none;
  }
  .ln.air {
    stroke: var(--gold);
    stroke-width: 2.4;
    stroke-dasharray: 5 4;
    filter: var(--glow-line-air);
  }
  .ln.rail {
    stroke: var(--stop);
    stroke-width: 1.8;
  }
  .ln.road {
    stroke: var(--ink-2);
    stroke-width: 2.2;
    opacity: 0.65;
  }
  .bar {
    opacity: 0.9;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--stop) 55%, transparent));
  }
  .dot {
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--stop) 65%, transparent));
  }
  /* Not fully booked: one ring, no word. Dashed so it reads as provisional
     even where the hue behind it is already warm. */
  .flag {
    stroke-dasharray: 3.5 3;
  }
  .flag.warn {
    stroke: var(--warn);
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--warn) 55%, transparent));
  }
  .flag.crit {
    stroke: var(--crit);
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--crit) 65%, transparent));
  }
  .nowdot {
    filter: var(--glow-glyph);
  }
  /* a scaling SVG circle needs its own box as the origin, or it flies away */
  .nowring {
    transform-box: fill-box;
    transform-origin: center;
  }

  /* ---------- the map draws itself, once ---------- */
  @keyframes routedraw {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  .draw .ln.rail,
  .draw .ln.road {
    stroke-dasharray: 1;
    animation: routedraw 600ms var(--ease-in-out) both;
  }
  .draw .ln.air {
    /* the dashed flight arc keeps its dashes: it fades in instead */
    animation: lantern-fade 600ms var(--ease-out) both;
  }
  .draw .dot,
  .draw .bar {
    animation: lantern-fade 600ms var(--ease-out) both;
    animation-delay: 200ms;
  }
</style>

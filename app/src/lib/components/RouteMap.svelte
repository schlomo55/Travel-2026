<script lang="ts">
  import type { Booking, ComplianceCounter, ISODate, Stop, Trip } from '../model/types';
  import { buildRouteMap } from '../logic/routemap';
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
  const legPath = (fromY: number, toY: number, x: number): string =>
    `M ${x} ${fromY} C ${x + 22} ${fromY + (toY - fromY) * 0.3}, ${x + 22} ${fromY + (toY - fromY) * 0.7}, ${x} ${toY}`;
</script>

{#if m.stations.length === 0}
  <p class="muted" style="margin:0">Add stops with dates and the route draws itself.</p>
{:else}
  <div class="mapwrap" class:compact>
    <svg viewBox="0 0 {m.width} {m.height}" width="100%" height={compact ? 200 : m.height} role="img"
         aria-label="Route map: {m.stations.length} stops">
      <!-- date rail -->
      {#each m.ticks as t, i (i)}
        <line x1={m.spineX - 16} y1={t.y} x2={m.spineX - 9} y2={t.y}
              stroke="var(--line-2)" stroke-width={t.major ? 1.4 : 0.8} opacity={t.major ? 0.9 : 0.45} />
        {#if t.label}
          <text x={m.spineX - 20} y={t.y + 3.5} text-anchor="end" class="tick">{t.label}</text>
        {/if}
      {/each}

      <!-- the spine -->
      <line x1={m.spineX} y1={m.startY} x2={m.spineX} y2={m.endY} stroke="var(--line-2)" stroke-width="2" />

      <!-- legs between stops -->
      {#each m.legs as leg (leg.id)}
        {#if leg.mode === 'air'}
          <path d={legPath(leg.fromY, leg.toY, m.spineX)} fill="none" stroke="var(--accent)"
                stroke-width="2" stroke-dasharray="5 4" opacity="0.85" />
          <text x={m.spineX + 26} y={(leg.fromY + leg.toY) / 2 + 4} class="legicon">✈</text>
        {:else if leg.mode === 'rail'}
          <line x1={m.spineX - 2.5} y1={leg.fromY} x2={m.spineX - 2.5} y2={leg.toY} stroke="var(--accent)" stroke-width="1.6" />
          <line x1={m.spineX + 2.5} y1={leg.fromY} x2={m.spineX + 2.5} y2={leg.toY} stroke="var(--accent)" stroke-width="1.6" />
        {:else}
          <line x1={m.spineX} y1={leg.fromY} x2={m.spineX} y2={leg.toY} stroke="var(--ink-2)" stroke-width="2" opacity="0.6" />
        {/if}
      {/each}

      <!-- stay bars + stations -->
      {#each m.stations as s (s.id)}
        <rect x={m.spineX - 4.5} y={s.barTop} width="9" height={Math.max(4, s.barBottom - s.barTop)}
              rx="4.5" fill="hsl({s.hue} 45% 50%)" opacity="0.85" />
        <circle cx={m.spineX} cy={s.y} r="6.5" fill="var(--card)" stroke="hsl({s.hue} 50% 42%)" stroke-width="2.6" />
        {#if !compact}
          <!-- leader line when a label had to move down to stay readable -->
          {#if s.labelY - s.y > 2}
            <path d="M {m.spineX + 8} {s.y} L {m.spineX + 14} {s.labelY - 5}" fill="none"
                  stroke="hsl({s.hue} 40% 55%)" stroke-width="1" opacity="0.55" />
          {/if}
          <text x={m.spineX + 18} y={s.labelY - 1} class="nm">{s.emoji ?? ''} {mdliteToText(s.name)}</text>
          <text x={m.spineX + 18} y={s.labelY + 12} class="sub">
            {s.dateLabel}{s.nights ? ` · ${s.nights}n` : ''}{s.isCurrent ? ' · you are here' : ''}
          </text>
        {/if}
      {/each}

      <!-- hard deadlines -->
      {#each m.walls as w, i (i)}
        <line x1={m.spineX - 13} y1={w.y} x2={m.width - 6} y2={w.y} stroke="var(--crit)" stroke-width="1.6" stroke-dasharray="3 3" />
        {#if !compact}<text x={m.width - 6} y={w.y - 5} text-anchor="end" class="wall">{w.label}</text>{/if}
      {/each}

      <!-- you are here -->
      {#if m.nowY !== null}
        <circle cx={m.spineX} cy={m.nowY} r="4" fill="var(--accent)" />
        <circle cx={m.spineX} cy={m.nowY} r="9" fill="none" stroke="var(--accent)" stroke-width="1.2" opacity="0.5" />
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
    font-size: 8.5px;
    fill: var(--faint);
  }
  .nm {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    fill: var(--ink);
  }
  .sub {
    font-size: 9.5px;
    fill: var(--faint);
  }
  .wall {
    font-size: 9px;
    fill: var(--crit);
    font-weight: 700;
  }
  .legicon {
    font-size: 11px;
    fill: var(--accent);
  }
</style>

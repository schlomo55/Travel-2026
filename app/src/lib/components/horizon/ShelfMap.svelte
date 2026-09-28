<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /* A TRIP'S ROUTE AS A CONSTELLATION (f-trips) — each stop a star at its
     real stored coordinates, north up; the road so far painted, today's leg
     FLOWING (the one looping route on the screen), the legs ahead dotted
     lilac, and tonight's star ringed in opal with the you-are-here ping.
     The layout is logic/constellation.ts; stops without a coordinate are
     never drawn. Labels name the first stop, tonight's, and the last. */
  import type { ISODate, Stop } from '../../model/types';
  import { buildConstellation, legPath, type Star } from '../../logic/constellation';
  import { S } from '../../i18n/strings';

  let { stops, now, width = 380, height = 240 }: { stops: Stop[]; now: ISODate; width?: number; height?: number } =
    $props();

  const c = $derived(buildConstellation(stops, now, { width, height, pad: 34 }));
  const n = ++seq;
  const litId = `shelf-lit-${n}`;
  const todayId = `shelf-today-${n}`;
  const ringId = `shelf-ring-${n}`;

  type Label = { star: Star; text: string; sub?: string; end: boolean };
  /* Uppercase 11px with 0.12em tracking runs about 8.4px a letter. */
  const textWidth = (t: string): number => t.length * 8.4;
  const labels = $derived.by((): Label[] => {
    if (!c) return [];
    const here = c.here;
    const first = c.stars[0];
    const last = c.stars[c.stars.length - 1];
    const make = (star: Star): Label => {
      const text = star.name.toUpperCase();
      const sub = star === here ? S.shelf.tonight.toUpperCase() : undefined;
      const w = Math.max(textWidth(text), sub ? textWidth(sub) : 0);
      /* a label reads to the right of its star unless the right has no room
         and the left has more */
      const right = width - 6 - (star.x + 12);
      const left = star.x - 12 - 6;
      return { star, text, sub, end: right < w && left > right };
    };
    const out: Label[] = [];
    if (first) out.push(make(first));
    if (here && here !== first && here !== last) out.push(make(here));
    if (last && last !== first) out.push(make(last));
    return out;
  });
</script>

{#if c}
  <svg class="shelfmap" viewBox="0 0 {width} {height}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={litId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style="stop-color: var(--opal-1)" />
        <stop offset="1" style="stop-color: var(--route-lit)" />
      </linearGradient>
      <linearGradient id={todayId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--route-lit)" />
        <stop offset="0.55" style="stop-color: var(--route-today)" />
        <stop offset="1" style="stop-color: var(--route-future)" />
      </linearGradient>
      <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--opal-1)" />
        <stop offset="0.35" style="stop-color: var(--opal-2)" />
        <stop offset="0.7" style="stop-color: var(--opal-3)" />
        <stop offset="1" style="stop-color: var(--opal-4)" />
      </linearGradient>
    </defs>

    {#each c.legs as l, i (i)}
      {#if l.state === 'ahead'}
        <path class="leg ahead" d={legPath(l.from, l.to)} />
      {:else if l.state === 'done'}
        <path class="leg done" d={legPath(l.from, l.to)} stroke="url(#{litId})" />
      {:else}
        <path class="leg today-under" d={legPath(l.from, l.to)} stroke="url(#{todayId})" />
        <path class="leg today flow" d={legPath(l.from, l.to)} stroke="url(#{todayId})" />
      {/if}
    {/each}

    {#each c.stars as s (s.id)}
      {#if s.state === 'here'}
        <circle class="here-halo" cx={s.x} cy={s.y} r="13" />
        <circle class="here-ring" cx={s.x} cy={s.y} r="7" stroke="url(#{ringId})" />
        <circle class="here-dot" cx={s.x} cy={s.y} r="2.6" />
        <circle class="ping" cx={s.x} cy={s.y} r="4.5" />
      {:else if s.state === 'done'}
        <circle class="done-halo" cx={s.x} cy={s.y} r="8" />
        <circle class="done-dot" cx={s.x} cy={s.y} r="3.5" />
      {:else}
        <circle class="ahead-dot" cx={s.x} cy={s.y} r="3.2" />
      {/if}
    {/each}

    {#each labels as l (l.star.id)}
      {@const lx = l.end ? l.star.x - 12 : l.star.x + 12}
      <text class="lbl" class:here={!!l.sub} x={lx} y={l.star.y + 4} text-anchor={l.end ? 'end' : 'start'}>{l.text}</text>
      {#if l.sub}
        <text class="lbl sub" x={lx} y={l.star.y + 18} text-anchor={l.end ? 'end' : 'start'}>{l.sub}</text>
      {/if}
    {/each}
  </svg>
{/if}

<style>
  .shelfmap {
    display: block;
    width: 100%;
    height: 100%;
  }
  .leg {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .leg.ahead {
    stroke: var(--route-future);
    stroke-width: 1.8;
    stroke-dasharray: 0.1 6;
    opacity: 0.9;
  }
  .leg.done {
    stroke-width: 2.4;
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.7));
  }
  .leg.today-under {
    stroke-width: 2.4;
    opacity: 0.35;
  }
  .leg.today {
    stroke-width: 2.4;
    filter: drop-shadow(0 0 5px rgba(255, 126, 182, 0.7));
  }
  .done-halo {
    fill: var(--sunrise-soft);
  }
  .done-dot {
    fill: var(--opal-1);
  }
  .ahead-dot {
    fill: var(--sky-2);
    stroke: var(--route-future);
    stroke-width: 1.4;
  }
  .here-halo {
    fill: var(--lilac-soft);
  }
  .here-ring {
    fill: var(--sky-2);
    stroke-width: 2.2;
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
  .lbl.here {
    fill: var(--ink);
  }
  .lbl.sub {
    fill: var(--sunrise);
  }
</style>

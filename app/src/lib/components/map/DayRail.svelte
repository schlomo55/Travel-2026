<script lang="ts">
  /* THE DAY'S STOPS (demo, Wanderlog-inspired) — the peek sheet's rail while the map draws a day's route
     (Map.svelte, instead of "Near you"): one line saying the day, its stops and its estimated distance and
     moving time, then the stops in the plan's order, each numbered in the day's colour as its pin is. A
     stop is one tap to its sheet — the same as a tap on its pin — and its leg on to the next stop (or to
     tonight's bed) is one tap to switch walk · taxi · metro (state/legModes, shared with the day view).
     After the stops: tonight's bed, then the places the plan names that have no pin — listed, never
     numbered, never on the map.

     The last stop opened is lit, and scrolled to, when the rail comes back under the closed sheet. Every
     figure is an estimate and printed with "≈" (logic/dayroute.ts). */
  import type { ISODate } from '../../model/types';
  import type { MapPlace } from '../../logic/mapplaces';
  import { metresText, minutesText, nextMode, type DayRoute, type Leg } from '../../logic/dayroute';
  import { routeTotals } from '../../logic/maproute';
  import { fmtDow, fmtDowDay } from '../../logic/dates';
  import { catColour, glyphOf } from '../../map/icons';
  import { motion } from '../../state/motion.svelte';
  import { revealFocus } from '../ui/revealFocus';
  import { S } from '../../i18n/strings';
  import MapIcon from './MapIcon.svelte';

  let {
    routes,
    now,
    all,
    current = null,
    onopen,
    oncycle,
  }: {
    /** what the map draws: one day, or every day of the stay */
    routes: DayRoute[];
    now: ISODate;
    /** "All days": each stop says its day */
    all: boolean;
    /** the stop opened last — lit, and scrolled to */
    current?: string | null;
    onopen: (p: MapPlace, from: HTMLElement) => void;
    oncycle: (leg: Leg) => void;
  } = $props();

  const totals = $derived(routeTotals(routes));
  const dayWord = (d: ISODate): string => (d === now ? S.mapTab.today : fmtDowDay(d));
  /* "Sun 6 · 5 stops · ≈ 9.4 km · ≈ 1 h 10 moving" */
  const summary = $derived(
    [
      ...(all ? [S.mapTab.days(routes.length)] : routes[0] ? [fmtDowDay(routes[0].date)] : []),
      S.day.route.stops(totals.stops),
      ...(totals.legs ? [S.day.route.distance(metresText(totals.metres)), S.day.route.moving(minutesText(totals.minutes))] : []),
    ].join(' · '),
  );
  /* a leg reads as it does in the day view (its words, S.day.route) */
  const legAria = (l: Leg, to: string): string => S.day.route.legAria(l.minutes, S.day.route.how[l.mode], to, S.day.route.switchTo[nextMode(l.mode)]);

  /* a new day starts at its first stop; the stop opened last is brought into view (at once the first time) */
  let ul = $state<HTMLUListElement | null>(null);
  let first = true;
  const key = $derived(routes.map((r) => r.date).join());
  $effect(() => {
    void key;
    const box = ul;
    const id = current;
    if (!box) return;
    const li = id ? box.querySelector<HTMLElement>(`[data-stop="${CSS.escape(id)}"]`) : null;
    const left = li ? Math.max(0, li.offsetLeft - 16) : 0;
    box.scrollTo({ left, behavior: first || motion.calm ? 'auto' : 'smooth' });
    first = false;
  });
</script>

{#snippet open(p: MapPlace, aria: string, sub: string, n: number, icon: string)}
  <button class="dr-open" data-place={p.id} aria-label={aria} onclick={(e) => onopen(p, e.currentTarget)}>
    <span class="dr-n num" aria-hidden="true">{#if n}{n}{:else}<MapIcon name={icon} size={15} stroke={2} />{/if}</span>
    <span class="dr-names">
      <span class="dr-name">{p.name}</span>
      <span class="dr-sub">{sub}</span>
    </span>
  </button>
{/snippet}

<div class="dr">
  <p class="dr-sum">
    {#if !all && routes[0]}<span class="dr-dot" style="--c: {routes[0].colour}" aria-hidden="true"></span>{/if}
    <span>{summary}</span>
  </p>
  <ul class="dr-rail" bind:this={ul} aria-label={S.mapTab.dayListAria(all ? S.mapTab.allDays : routes[0] ? fmtDow(routes[0].date) : '')} use:revealFocus>
    {#each routes as r (r.date)}
      {@const on = all ? `${dayWord(r.date)} · ` : ''}
      {#each r.stops as st, i (st.id)}
        {@const leg = r.legs[i] ?? (i === r.stops.length - 1 ? r.toBed : null)}
        {@const toBed = !!leg && leg === r.toBed}
        <li class="dr-card" class:on={current === st.id} data-stop={st.id} style="--c: {r.colour}">
          {@render open(st.place, S.mapTab.stopAria(st.place.name, st.n, fmtDow(r.date)), on + S.mapTab.cat[st.place.category], st.n, '')}
          {#if leg?.far}
            <span class="dr-leg far"><span class="num">{metresText(leg.metres)}</span> <span class="dr-m">· {S.day.route.far}</span></span>
          {:else if leg}
            <button class="dr-leg" onclick={() => oncycle(leg)} aria-label={legAria(leg, toBed ? S.day.route.tonightsBed : S.mapTab.stopN(st.n + 1))}>
              <span class="num">{minutesText(leg.minutes)}</span>
              <span>{S.day.route.mode[leg.mode]}</span>
              <span class="num dr-m">· {metresText(leg.metres)}</span>
              {#if toBed}<span class="dr-m">· {S.day.route.toBed}</span>{/if}
            </button>
          {/if}
        </li>
      {/each}
      {#if !all && r.bed && r.toBed}
        <li class="dr-card bed" data-stop={r.bed.id} class:on={current === r.bed.id} style="--c: {r.colour}">
          {@render open(r.bed, `${r.bed.name}, ${S.day.route.tonightsBed}`, S.mapTab.tonight, 0, 'hotel')}
        </li>
      {/if}
      {#each r.unplaced as u (u.id)}
        <li class="dr-card nopin" style="--c: {catColour(u.category)}">
          {@render open(u, `${u.name}, ${S.mapTab.noPin}`, on + S.mapTab.noPin, 0, glyphOf(u.category, u.name, u.native))}
        </li>
      {/each}
    {/each}
  </ul>
</div>

<style>
  .dr-sum {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 16px 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
    line-height: 1.4;
  }
  .dr-dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--c);
  }
  .dr-rail {
    position: relative;
    display: flex;
    gap: 10px;
    margin: 8px 0 0;
    padding: 6px 16px;
    list-style: none;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 16px;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
    mask-image: linear-gradient(90deg, #000 88%, transparent);
  }
  .dr-rail::-webkit-scrollbar {
    display: none;
  }
  .dr-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 216px;
    padding: 8px 10px 6px;
    box-sizing: border-box;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
    scroll-snap-align: start;
  }
  /* the stop opened last: lit in its day's colour */
  .dr-card.on {
    border-color: var(--c);
    box-shadow: 0 0 26px -12px var(--c);
  }
  .dr-open {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: none;
    border-radius: 12px;
    background: none;
    color: var(--ink);
    text-align: left;
  }
  /* the pin's own look: the day's colour, the number in night ink, a night ring */
  .dr-n {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    box-sizing: border-box;
    font-size: var(--fs-chip);
    font-weight: 700;
    color: var(--sky);
    background: var(--c);
    box-shadow: 0 0 0 2px var(--sky);
  }
  .dr-card.on .dr-n {
    box-shadow:
      0 0 0 2px var(--sky),
      0 0 0 4px #fff;
  }
  .bed .dr-n {
    color: var(--c);
    background: var(--card-2);
    border: 1.5px solid var(--c);
    box-shadow: none;
  }
  /* no pin: listed, never numbered */
  .nopin .dr-n {
    color: var(--c);
    background: transparent;
    border: 1.5px dashed var(--edge);
    box-shadow: none;
  }
  .dr-names {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .dr-name {
    font-size: var(--fs-label);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dr-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dr-leg.far {
    color: var(--ink-2);
  }
  /* the leg on: drawn 30 px, a 44 px target all the same */
  .dr-leg {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    max-width: 100%;
    height: 30px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 600;
    white-space: nowrap;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  .dr-leg::after {
    content: '';
    position: absolute;
    top: -7px;
    bottom: -7px;
    left: 0;
    right: 0;
  }
  /* on to the next stop: the day's colour (decorative — the button's name says where) */
  .dr-leg:not(.far)::before {
    content: '→';
    color: var(--c);
    font-weight: 700;
  }
  .dr-m {
    color: var(--ink-2);
    font-weight: 500;
  }
</style>

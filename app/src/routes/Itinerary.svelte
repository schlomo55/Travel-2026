<script lang="ts">
  import type { DayPlan, ISODate, Stop, Trip } from '../lib/model/types';
  import { compareIso, fmtDow, fmtShort } from '../lib/logic/dates';
  import { tripPhase } from '../lib/logic/phase';
  import Md from '../lib/components/ui/Md.svelte';
  import { S } from '../lib/i18n/strings';

  let { trip, stops, dayPlans, now }: { trip: Trip; stops: Stop[]; dayPlans: DayPlan[]; now: ISODate } = $props();

  const ordered = $derived([...stops].sort((a, b) => a.order - b.order));
  const during = $derived(tripPhase(trip, now) === 'during');

  function isHere(s: Stop): boolean {
    return during && compareIso(now, s.start) >= 0 && compareIso(now, s.end) < 0;
  }
  function daysOf(s: Stop): DayPlan[] {
    return dayPlans
      .filter((d) => compareIso(d.date, s.start) >= 0 && compareIso(d.date, s.end) <= 0)
      .sort((a, b) => compareIso(a.date, b.date));
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">
    {S.tabs.plan}
    <span class="pagesub">{ordered.filter((s) => s.kind === 'stop').length} stops</span>
  </h1>

  {#if ordered.length === 0}
    <section class="card" style="text-align:center; padding:26px 18px">
      <p class="muted" style="margin:0">No stops yet. They arrive with an imported trip, or you can add them once editing lands.</p>
    </section>
  {/if}

  {#each ordered as s (s.id)}
    {@const here = isHere(s)}
    <details class="stop" style="--h:{s.hue}" open={here}>
      <summary>
        <span class="em">{s.emoji ?? '📍'}</span>
        <span class="ttl">
          <span class="nm"><Md text={s.name} /></span>
          <span class="wh">
            {s.whenLabel ?? `${fmtShort(s.start)} → ${fmtShort(s.end)}`}
            {#if here}· <b class="here">you are here</b>{/if}
          </span>
        </span>
        {#if s.nights}<span class="nn">{s.nights}n</span>{/if}
        <span class="chev" aria-hidden="true">▸</span>
      </summary>

      <div class="bd">
        {#if s.costNote}<div class="small">Budgeted <Md text={s.costNote} /></div>{/if}
        {#if s.warn}
          <div class="card crit" style="margin-top:9px"><Md text={s.warn} as="div" /></div>
        {/if}

        {#each s.blocks as b (b.id)}
          <section class="blk">
            <h4><Md text={b.heading} /></h4>
            {#if b.items.length}
              <ul>
                {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
              </ul>
            {/if}
            {#each b.dayRows ?? [] as row, i (i)}
              <div class="dayrow"><span class="d">{row.label}</span><span><Md text={row.text} /></span></div>
            {/each}
          </section>
        {/each}

        {#if daysOf(s).length}
          <details class="sub">
            <summary>📆 Day by day — {daysOf(s).length} planned</summary>
            <div class="rc">
              {#each daysOf(s) as d (d.id)}
                <div class="dayplan">
                  <div class="dp-head">
                    <span class="dp-date">{fmtDow(d.date)}</span>
                    <span class="dp-title"><Md text={d.title} /></span>
                  </div>
                  <ul>
                    {#each d.planItems as p, i (i)}<Md text={p} as="li" />{/each}
                  </ul>
                  {#if d.bedLabel}
                    <div class="small">{d.bedEmoji ?? '🛏'} <Md text={d.bedLabel} /></div>
                  {/if}
                </div>
              {/each}
            </div>
          </details>
        {/if}

        {#if s.recoBlocks.length}
          <details class="sub reco">
            <summary>⭐ Extra ideas — researched</summary>
            <div class="rc">
              {#each s.recoBlocks as b (b.id)}
                <h5><Md text={b.heading} /></h5>
                <ul>
                  {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
                </ul>
              {/each}
            </div>
          </details>
        {/if}
      </div>
    </details>
  {/each}
</main>

<style>
  .stop {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }
  .stop > summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    cursor: pointer;
    border-left: 5px solid hsl(var(--h) 45% 45%);
  }
  .stop > summary::-webkit-details-marker {
    display: none;
  }
  .em {
    font-size: 20px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 11px;
    flex-shrink: 0;
  }
  .ttl {
    flex: 1;
    min-width: 0;
  }
  .nm {
    display: block;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
    line-height: 1.25;
  }
  .wh {
    display: block;
    color: var(--ink-2);
    font-size: 12.5px;
  }
  .here {
    color: hsl(var(--h) 50% 38%);
  }
  .nn {
    background: hsl(var(--h) 40% 92%);
    color: hsl(var(--h) 55% 26%);
    font-size: 11px;
    font-weight: 700;
    border-radius: 16px;
    padding: 2.5px 9px;
    white-space: nowrap;
  }
  .chev {
    color: var(--faint);
    font-size: 12px;
    transition: transform 0.2s;
  }
  .stop[open] .chev {
    transform: rotate(90deg);
  }
  .bd {
    padding: 2px 14px 14px;
  }
  .blk {
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 11px;
    padding: 11px 13px;
    margin-top: 10px;
  }
  .blk h4 {
    margin: 0 0 6px;
    font-size: 10.5px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: hsl(var(--h) 45% 34%);
  }
  .blk ul {
    margin: 0;
    padding-left: 18px;
  }
  .blk :global(li) {
    margin-bottom: 5px;
    font-size: 14px;
  }
  .dayrow {
    display: flex;
    gap: 9px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .dayrow .d {
    background: hsl(var(--h) 40% 92%);
    color: hsl(var(--h) 55% 26%);
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 7px;
    padding: 2px 7px;
    height: fit-content;
    white-space: nowrap;
    margin-top: 2px;
    flex-shrink: 0;
  }
  details.sub {
    border: 1px dashed var(--line-2);
    border-radius: 11px;
    margin-top: 10px;
  }
  details.sub > summary {
    list-style: none;
    cursor: pointer;
    padding: 10px 13px;
    font-size: 11.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
  }
  details.sub > summary::-webkit-details-marker {
    display: none;
  }
  .rc {
    padding: 0 13px 11px;
  }
  .rc h5 {
    margin: 8px 0 4px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--faint);
  }
  .rc ul {
    margin: 0;
    padding-left: 18px;
  }
  .rc :global(li) {
    font-size: 13.5px;
    margin-bottom: 5px;
  }
  .dayplan {
    border-bottom: 1px dashed var(--line);
    padding: 9px 0;
  }
  .dayplan:last-child {
    border-bottom: none;
  }
  .dp-head {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .dp-date {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: hsl(var(--h) 50% 34%);
    white-space: nowrap;
  }
  .dp-title {
    font-weight: 650;
    font-size: 14px;
  }
</style>

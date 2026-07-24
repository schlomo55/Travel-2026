<script lang="ts">
  /* The full-screen place page — the "read more" surface. Reached at
     #/trip/:tripId/itinerary/:stopId (route.sub), so Android back returns to
     the Plan tab through real history, no layer bookkeeping. */
  import type { DayPlan, Stop, Trip } from '../lib/model/types';
  import { compareIso, fmtDow, fmtShort } from '../lib/logic/dates';
  import Md from '../lib/components/ui/Md.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    stop,
    stops,
    dayPlans,
  }: {
    trip: Trip;
    stop: Stop;
    stops: Stop[];
    dayPlans: DayPlan[];
  } = $props();

  const days = $derived(
    dayPlans
      .filter((d) => compareIso(d.date, stop.start) >= 0 && compareIso(d.date, stop.end) <= 0)
      .sort((a, b) => compareIso(a.date, b.date)),
  );
  const pos = $derived.by(() => {
    const real = stops.filter((s) => s.kind === 'stop').sort((a, b) => a.order - b.order);
    const i = real.findIndex((s) => s.id === stop.id);
    return i === -1 ? null : { n: i + 1, total: real.length };
  });

  function back(): void {
    router.goTab(trip.id, 'itinerary');
  }
</script>

<main class="place">
  <div class="hero" style="--h:{stop.hue}">
    <span class="fall" aria-hidden="true"><i>{stop.emoji ?? '📍'}</i></span>
    {#if stop.photoDocId}
      <PhotoImg docId={stop.photoDocId} alt="" />
    {/if}
    <span class="shade" aria-hidden="true"></span>
    <button class="back" onclick={back} aria-label={S.misc.back}>‹</button>
    <div class="title">
      <h1><Md text={stop.name} /></h1>
      <div class="chips">
        <span class="chip glass mono">{stop.whenLabel ?? `${fmtShort(stop.start)} → ${fmtShort(stop.end)}`}</span>
        {#if stop.nights}<span class="chip glass mono">{stop.nights} {stop.nights === 1 ? 'night' : 'nights'}</span>{/if}
        {#if pos}<span class="chip glass mono">{S.plan.stopOf(pos.n, pos.total)}</span>{/if}
      </div>
    </div>
  </div>

  <div class="sheet">
    <div class="wrap">
      {#if stop.costNote}<div class="small" style="margin:2px 0 10px">Budgeted <Md text={stop.costNote} /></div>{/if}
      {#if stop.warn}
        <div class="card crit"><Md text={stop.warn} as="div" /></div>
      {/if}

      {#if stop.detail}
        <div class="detail"><Md text={stop.detail} as="div" /></div>
      {/if}

      {#each stop.blocks as b (b.id)}
        <section class="sec">
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

      {#if days.length}
        <section class="sec">
          <h4>📆 Day by day</h4>
          {#each days as d (d.id)}
            <div class="dp">
              <div class="dp-head">
                <span class="dp-date mono">{fmtDow(d.date)}</span>
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
        </section>
      {/if}

      {#each stop.recoBlocks as b (b.id)}
        <section class="sec">
          <h4>⭐ <Md text={b.heading} /></h4>
          <ul>
            {#each b.items as it, i (i)}<Md text={it} as="li" />{/each}
          </ul>
        </section>
      {/each}

      <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
    </div>
  </div>
</main>

<style>
  .hero {
    position: relative;
    height: min(44vh, 330px);
    min-height: 210px;
    overflow: hidden;
  }
  .fall {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 26px;
    background: linear-gradient(135deg, hsl(var(--h) 55% 36%), hsl(var(--h) 55% 28%));
  }
  .fall i {
    font-style: normal;
    font-size: 84px;
    opacity: 0.18;
  }
  .hero :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: photoin 0.18s ease-out;
  }
  @keyframes photoin {
    from {
      opacity: 0;
    }
  }
  .shade {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--photo-dim), var(--photo-dim)),
      linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0) 22%),
      var(--scrim);
  }
  .back {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 10px);
    left: 10px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
    font-size: 24px;
    line-height: 1;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .title {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 34px;
  }
  .title h1 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-weight: 640;
    font-size: var(--text-hero);
    line-height: 1.1;
    color: var(--on-photo);
  }
  .chips {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }
  .glass {
    background: rgba(0, 0, 0, 0.38);
    color: #fff;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    text-transform: none;
    letter-spacing: 0.3px;
  }
  .sheet {
    position: relative;
    margin-top: -24px;
    border-radius: 24px 24px 0 0;
    background: var(--paper);
    padding-top: 18px;
    min-height: 40vh;
  }
  .detail {
    font-size: var(--text-base);
    line-height: 1.6;
    margin-bottom: 14px;
  }
  .sec {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    padding: 13px 15px;
    margin-bottom: 12px;
  }
  .sec h4 {
    margin: 0 0 7px;
    font-size: var(--text-xs);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--stop-text);
  }
  .sec ul {
    margin: 0;
    padding-left: 18px;
  }
  .sec :global(li) {
    margin-bottom: 5px;
    font-size: 14px;
  }
  .dayrow {
    display: flex;
    gap: 9px;
    margin: 8px 0;
    font-size: 14px;
  }
  .dayrow .d {
    background: var(--stop-soft);
    color: var(--stop-text);
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 7px;
    padding: 2px 7px;
    height: fit-content;
    white-space: nowrap;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .dp {
    border-bottom: 1px dashed var(--line);
    padding: 8px 0;
  }
  .dp:last-of-type {
    border-bottom: none;
  }
  .dp-head {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .dp-date {
    font-size: 11px;
    font-weight: 600;
    color: var(--stop-text);
    white-space: nowrap;
  }
  .dp-title {
    font-weight: 650;
    font-size: 14px;
    flex: 1;
  }
  .dp ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
</style>

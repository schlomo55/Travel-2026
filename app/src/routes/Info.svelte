<script lang="ts">
  import type { ComplianceCounter, EmergencyContact, InfoCard, ISODate, ShowCard, Trip } from '../lib/model/types';
  import { counterState } from '../lib/logic/counters';
  import { clockIn, fmtLong } from '../lib/logic/dates';
  import { copyText } from '../lib/state/toast.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import DriverOverlay from '../lib/components/ui/DriverOverlay.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    counters,
    infoCards,
    emergency,
    showCards,
    now,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    infoCards: InfoCard[];
    emergency: EmergencyContact[];
    showCards: ShowCard[];
    now: ISODate;
  } = $props();

  let driver = $state<ShowCard | null>(null);

  /* Clock faces recompute off this tick rather than on every render. */
  let tick = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const clockFaces = $derived(trip.clocks.map((c) => ({ ...c, time: clockIn(c.timeZone, new Date(tick)) })));

  const places = $derived(showCards.filter((c) => c.kind === 'place').sort((a, b) => a.order - b.order));
  const phrases = $derived(showCards.filter((c) => c.kind === 'phrase' && !c.isKey).sort((a, b) => a.order - b.order));
  const cards = $derived([...infoCards].sort((a, b) => a.order - b.order));
  const contacts = $derived([...emergency].sort((a, b) => a.order - b.order));
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">{S.tabs.info} <span class="pagesub">one tap away</span></h1>

  {#each counters as c (c.id)}
    {@const st = counterState(c, now)}
    <section class="card" class:crit={st.phase === 'overLimit' || (st.phase === 'counting' && st.remaining <= 3)}>
      <h3>{c.icon ?? '🛂'} {c.name}</h3>
      {#if st.phase === 'before'}
        <div>Starts {fmtLong(c.startDate)}{c.countStartsDayAfter ? ' — the count begins the day after' : ''}.</div>
      {:else if st.phase === 'entryDay'}
        <div>{S.today.entryDay}</div>
      {:else if st.phase === 'complete'}
        <div>Complete ✓ — you left on {c.plannedEndDate ? fmtLong(c.plannedEndDate) : 'schedule'}, day {st.day} of {st.limitDays}.</div>
      {:else}
        <div style="font-size:15px">
          Day <b style="font-size:24px">{st.day}</b> of {st.limitDays} ·
          <b>{st.remaining} {st.remaining === 1 ? 'day' : 'days'} of legal stay left</b>
        </div>
      {/if}
      {#if c.hardDeadline}
        <div class="small" style="margin-top:6px">Hard deadline: <b>{fmtLong(c.hardDeadline)}</b></div>
      {/if}
      {#if c.note}<div class="muted" style="margin-top:6px"><Md text={c.note} as="div" /></div>{/if}
    </section>
  {/each}

  {#if clockFaces.length}
    <section class="card">
      <h3>Clocks</h3>
      <div class="clocks">
        {#each clockFaces as c (c.timeZone)}
          <div>
            <div class="small">{c.flag ?? ''} {c.label}</div>
            <div class="clocknum mono">{c.time}</div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if places.length}
    <section class="card">
      <h3>🚕 Show the driver <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· tap for full screen</span></h3>
      <p class="muted" style="margin:0 0 4px">
        Lines marked <span class="vfy">verify</span> came from general knowledge, not your trip documents.
      </p>
      <ul class="zhlist">
        {#each places as p (p.id)}
          <li>
            <button class="txt" onclick={() => !p.pending && (driver = p)} disabled={p.pending}>
              <span class="zh" class:pend={p.pending}>{p.native}</span>
              <span class="en">
                {p.meaning}{#if p.verify}<span class="vfy"> · verify</span>{/if}
              </span>
              {#if p.note}<span class="small"><Md text={p.note} /></span>{/if}
            </button>
            {#if !p.pending}
              <button class="rowbtn" onclick={() => copyText(p.native)} aria-label="Copy">⧉</button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if phrases.length}
    <section class="card">
      <h3>🗣 Useful phrases</h3>
      <ul class="zhlist">
        {#each phrases as p (p.id)}
          <li>
            <button class="txt" onclick={() => (driver = p)}>
              <span class="zh">{p.native}</span>
              <span class="en">{p.meaning}</span>
            </button>
            <button class="rowbtn" onclick={() => copyText(p.native)} aria-label="Copy">⧉</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if contacts.length}
    <section class="card crit">
      <h3>🆘 Emergency</h3>
      <ul class="zhlist">
        {#each contacts as e (e.id)}
          <li>
            <span class="txt static">
              <span class="ev">{e.value}{#if e.verify}<span class="vfy"> verify</span>{/if}</span>
              <span class="en"><Md text={e.label} /></span>
            </span>
            {#if e.kind === 'phone'}
              <a class="btn callbtn" href="tel:{e.value.replace(/\s/g, '')}" aria-label="Call">📞</a>
            {:else if !e.pending}
              <button class="rowbtn" onclick={() => copyText(e.value)} aria-label="Copy">⧉</button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each cards as g (g.id)}
    <section class="card" class:warn={g.severity === 'crit'}>
      <h3>{g.emoji ?? 'ℹ️'} <Md text={g.heading} /></h3>
      <ul>
        {#each g.items as it, i (i)}<Md text={it} as="li" />{/each}
      </ul>
    </section>
  {/each}

  <footer class="foot">{trip.title}</footer>
</main>

{#if driver}
  <DriverOverlay
    native={driver.native}
    meaning={driver.meaning}
    suffix={trip.driverSuffix}
    onclose={() => (driver = null)}
  />
{/if}

<style>
  .clocks {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .clocknum {
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .zhlist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .zhlist li {
    padding: 10px 0;
    border-bottom: 1px dashed var(--line);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .zhlist li:last-child {
    border-bottom: none;
  }
  .txt {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    text-align: left;
    padding: 0;
    display: block;
  }
  .txt.static {
    cursor: default;
  }
  .zh {
    display: block;
    font-family: var(--font-zh);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.35;
  }
  .zh.pend {
    font-size: 13px;
    font-weight: 500;
    color: var(--warn);
  }
  .ev {
    display: block;
    font-size: 15px;
    font-weight: 700;
  }
  .en {
    display: block;
    font-size: 12px;
    color: var(--ink-2);
    margin-top: 1px;
  }
  .vfy {
    color: var(--warn);
    font-weight: 600;
  }
  .rowbtn {
    background: none;
    border: none;
    color: var(--faint);
    font-size: 16px;
    padding: 8px 10px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .callbtn {
    min-height: 38px;
    padding: 6px 13px;
    flex-shrink: 0;
  }
</style>

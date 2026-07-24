<script lang="ts">
  import type { Booking, ComplianceCounter, DayPlan, ISODate, Runbook, Stop, Trip } from '../lib/model/types';
  import { compareIso, fmtDow, fmtShort } from '../lib/logic/dates';
  import { tripPhase } from '../lib/logic/phase';
  import { db } from '../lib/db/db';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { mutate } from '../lib/data/repo';
  import { addDocument } from '../lib/data/documents';
  import { toast } from '../lib/state/toast.svelte';
  import { dayPlanSpec, runbookSpec, stopSpec } from '../lib/components/forms/specs';
  import Md from '../lib/components/ui/Md.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import RouteMap from '../lib/components/RouteMap.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    stops,
    dayPlans,
    runbooks,
    bookings,
    counters,
    now,
    editing = false,
  }: {
    trip: Trip;
    stops: Stop[];
    dayPlans: DayPlan[];
    runbooks: Runbook[];
    bookings: Booking[];
    counters: ComplianceCounter[];
    now: ISODate;
    editing?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'stop'; entity?: Stop }
    | { kind: 'day'; entity?: DayPlan; date: ISODate }
    | { kind: 'runbook'; entity?: Runbook };
  let sheet = $state<Sheet | null>(null);

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

  /* Photo picking is bespoke on purpose: FieldValue cannot hold a Blob, and the
     JSON round-trip in saveEntity would destroy one. The blob goes through the
     documents vault; only the id lands on the stop. */
  async function addStopPhoto(e: Event, s: Stop): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const old = s.photoDocId ? await db.documents.get(s.photoDocId) : undefined;
    const meta = await addDocument(file, trip.id, { stopId: s.id, tag: 'photo' });
    await mutate(async () => {
      await db.stops.update(s.id, { photoDocId: meta.id });
      if (old && old.tag === 'photo') {
        await db.documents.delete(old.id);
        await db.documentBlobs.delete(old.id);
      }
    });
    toast.show(S.plan.photoAdded);
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">
    {S.tabs.plan}
    <span class="pagesub">{ordered.filter((s) => s.kind === 'stop').length} stops</span>
  </h1>

  {#if ordered.some((s) => s.kind === 'stop')}
    <section class="card">
      <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:6px">
        <h3 style="margin:0; flex:1">The route</h3>
        <button class="editbtn" style="min-width:auto; padding:0 10px" onclick={() => router.goTab(trip.id, 'stats')}>
          📊 Stats
        </button>
      </div>
      <RouteMap {trip} stops={ordered} {bookings} {counters} {now} />
    </section>
  {/if}

  {#if ordered.length === 0}
    <section class="card" style="text-align:center; padding:26px 18px">
      <p class="muted" style="margin:0">No stops yet. They arrive with an imported trip, or you can add them once editing lands.</p>
    </section>
  {/if}

  {#snippet stopBody(s: Stop)}
    <div class="bd">
      {#if editing}
        <div class="editrow" style="margin-top:8px">
          <button class="editbtn" onclick={() => (sheet = { kind: 'stop', entity: s })}>✎ Edit stop</button>
          <button class="editbtn" onclick={() => (sheet = { kind: 'day', date: s.start })}>＋ Add a day</button>
          {#if s.kind === 'stop'}
            <label class="editbtn filelabel">
              🖼 {s.photoDocId ? S.plan.replacePhoto : S.plan.addPhoto}
              <input type="file" accept="image/*" onchange={(e) => addStopPhoto(e, s)} />
            </label>
          {/if}
        </div>
      {/if}
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
                  {#if editing}
                    <button class="editbtn" onclick={() => (sheet = { kind: 'day', entity: d, date: d.date })} aria-label="Edit">✎</button>
                  {/if}
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

      {#if s.detail || s.photoDocId}
        <button class="readmore" onclick={() => router.go(`#/trip/${trip.id}/itinerary/${s.id}`)}>
          <span>📖 {S.plan.readMore}</span><span aria-hidden="true">→</span>
        </button>
      {/if}
    </div>
  {/snippet}

  {#each ordered as s (s.id)}
    {@const here = isHere(s)}
    {#if s.kind === 'transit'}
      <details class="stop transit" style="--h:{s.hue}" open={here}>
        <summary>
          <span class="tem" aria-hidden="true">{s.emoji ?? '✈️'}</span>
          <span class="ttl">
            <span class="tnm"><Md text={s.name} /></span>
            <span class="wh">
              {s.whenLabel ?? `${fmtShort(s.start)} → ${fmtShort(s.end)}`}
              {#if here}· <b class="here">you are here</b>{/if}
            </span>
          </span>
          <span class="chev" aria-hidden="true">▸</span>
        </summary>
        {@render stopBody(s)}
      </details>
    {:else}
      <details class="stop" style="--h:{s.hue}" open={here}>
        <summary class="band">
          <span class="bandfall" aria-hidden="true"><i>{s.emoji ?? '📍'}</i></span>
          {#if s.photoDocId}
            <PhotoImg docId={s.photoDocId} alt="" />
          {/if}
          <span class="bandshade" aria-hidden="true"></span>
          <span class="bandtop">
            {#if s.nights}<span class="nn">{s.nights}n</span>{/if}
            <span class="chev" aria-hidden="true">▸</span>
          </span>
          <span class="bandtext">
            <span class="nm"><Md text={s.name} /></span>
            <span class="tick" aria-hidden="true"></span>
            <span class="wh">
              {s.whenLabel ?? `${fmtShort(s.start)} → ${fmtShort(s.end)}`}
              {#if here}<b class="herepill">you are here</b>{/if}
            </span>
          </span>
        </summary>
        {@render stopBody(s)}
      </details>
    {/if}
  {/each}

  {#if editing}
    <button class="addbtn" onclick={() => (sheet = { kind: 'stop' })}>{S.edit.add('a stop')}</button>
    <button class="addbtn" onclick={() => (sheet = { kind: 'day', date: trip.start })}>{S.edit.add('a day')}</button>

    <section class="card">
      <h3>Runbooks <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· travel-day checklists</span></h3>
      <p class="muted" style="margin:0 0 8px">
        Attach one to a day and Today shows it as tickable steps on that date.
      </p>
      <ul class="rblist">
        {#each runbooks as r (r.id)}
          <li>
            <span><Md text={r.title} /> <span class="small">· {r.steps.length} steps</span></span>
            <button class="editbtn" onclick={() => (sheet = { kind: 'runbook', entity: r })} aria-label="Edit">✎</button>
          </li>
        {/each}
      </ul>
      <button class="btn wfull" style="margin-top:10px" onclick={() => (sheet = { kind: 'runbook' })}>
        {S.edit.add('a runbook')}
      </button>
    </section>
  {/if}
</main>

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'stop'}
    <EditSheet
      spec={stopSpec(trip.id, stops.length)}
      entity={sheet.entity}
      onsave={(s) => saveEntity(db.stops, s)}
      ondelete={sheet.entity ? () => deleteEntity(db.stops, sheet?.entity as Stop, 'Stop deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'day'}
    <EditSheet
      spec={dayPlanSpec(trip.id, sheet.date, runbooks)}
      entity={sheet.entity}
      onsave={(d) => saveEntity(db.dayPlans, d)}
      ondelete={sheet.entity ? () => deleteEntity(db.dayPlans, sheet?.entity as DayPlan, 'Day deleted') : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={runbookSpec(trip.id)}
      entity={sheet.entity}
      onsave={(r) => saveEntity(db.runbooks, r)}
      ondelete={sheet.entity ? () => deleteEntity(db.runbooks, sheet?.entity as Runbook, 'Runbook deleted') : undefined}
      onclose={close}
    />
  {/if}
{/if}

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
    cursor: pointer;
  }
  .stop > summary::-webkit-details-marker {
    display: none;
  }

  /* --- photo band header (stops) --- */
  summary.band {
    position: relative;
    display: block;
    height: 112px;
    overflow: hidden;
    transition: height 0.2s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .stop[open] > summary.band {
    height: 148px;
  }
  .bandfall {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 18px;
    background: linear-gradient(135deg, hsl(var(--h) 55% 36%), hsl(var(--h) 55% 28%));
  }
  .bandfall i {
    font-style: normal;
    font-size: 54px;
    opacity: 0.18;
  }
  .band :global(img) {
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
  .bandshade {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(var(--photo-dim), var(--photo-dim)), var(--scrim);
  }
  .bandtop {
    position: absolute;
    top: 9px;
    right: 10px;
    display: flex;
    gap: 7px;
    align-items: center;
  }
  .nn {
    background: rgba(0, 0, 0, 0.38);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 999px;
    padding: 2.5px 9px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    white-space: nowrap;
  }
  .bandtext {
    position: absolute;
    left: 13px;
    right: 12px;
    bottom: 9px;
    display: block;
  }
  .nm {
    display: block;
    font-family: var(--font-display);
    font-weight: 640;
    font-size: 21px;
    line-height: 1.15;
    color: var(--on-photo);
  }
  .tick {
    display: block;
    width: 28px;
    height: 3px;
    border-radius: 2px;
    background: hsl(var(--h) 55% 68%);
    margin: 4px 0;
  }
  .wh {
    display: block;
    font-size: 12px;
  }
  .band .wh {
    color: rgba(255, 255, 255, 0.85);
  }
  .band .chev {
    color: rgba(255, 255, 255, 0.9);
  }
  .herepill {
    background: #fff;
    color: #17191e;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-left: 6px;
  }

  /* --- compact rows (transit) --- */
  .transit > summary {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-left: 3px solid var(--stop);
  }
  .tem {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--card-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .ttl {
    flex: 1;
    min-width: 0;
  }
  .tnm {
    display: block;
    font-weight: 650;
    font-size: 15px;
  }
  .transit .wh {
    color: var(--ink-2);
    font-size: 12.5px;
  }
  .here {
    color: var(--stop-text);
  }
  .chev {
    color: var(--faint);
    font-size: 12px;
    transition: transform 0.2s;
  }
  .stop[open] .chev {
    transform: rotate(90deg);
  }
  .filelabel {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    cursor: pointer;
  }
  .filelabel input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  .readmore {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    border: 1px dashed var(--line-2);
    background: none;
    border-radius: var(--radius-sm);
    margin-top: 10px;
    padding: 10px 13px;
    font-size: 11.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--stop-text);
    font-weight: 700;
  }
  .bd {
    padding: 2px 14px 14px;
  }
  .blk {
    background: var(--card-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 11px 13px;
    margin-top: 10px;
  }
  .blk h4 {
    margin: 0 0 6px;
    font-size: var(--text-xs);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--stop-text);
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
  details.sub {
    border: 1px dashed var(--line-2);
    border-radius: var(--radius-sm);
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
    color: var(--stop-text);
    white-space: nowrap;
  }
  .dp-title {
    font-weight: 650;
    font-size: 14px;
    flex: 1;
  }
  .rblist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rblist li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--line);
  }
  .rblist li:last-child {
    border-bottom: none;
  }
  .rblist li span:first-child {
    flex: 1;
  }
</style>

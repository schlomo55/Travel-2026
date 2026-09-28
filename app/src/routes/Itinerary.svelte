<script lang="ts">
  import type { Booking, DayPlan, ISODate, Runbook, Stop, Trip } from '../lib/model/types';
  import { buildConnectors, type Connector } from '../lib/logic/connectors';
  import {
    buildCoverage,
    coverageByStop,
    coverageStamp,
    notableNights,
    type CoveredLeg,
    type CoveredNight,
  } from '../lib/logic/coverage';
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
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    stops,
    bookings = [],
    dayPlans,
    runbooks,
    now,
    editing = false,
    embedded = false,
  }: {
    trip: Trip;
    stops: Stop[];
    /** Only used to derive the connectors between stops — never written here. */
    bookings?: Booking[];
    dayPlans: DayPlan[];
    runbooks: Runbook[];
    now: ISODate;
    editing?: boolean;
    /** Drawn inside Horizon's Journey, under its own header and the route
        overview: the page title becomes a section label, and the doorway to
        a route map that now sits directly above it goes away. */
    embedded?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'stop'; entity?: Stop }
    | { kind: 'day'; entity?: DayPlan; date: ISODate }
    | { kind: 'runbook'; entity?: Runbook };
  let sheet = $state<Sheet | null>(null);

  /* TRANSIT PSEUDO-STOPS NO LONGER DRAW AS STOPS. "International flights" is a
     phase of the trip, not somewhere you go, and now that the moves between
     cities are on the page it IS one of those moves — the arrival connector at
     the top and the departure connector at the bottom. It stays in the data as
     the record of one booking across four legs and their shared price, which
     the money screen reads off its costNote; it simply stops pretending to be
     a place. Ten places, and the journeys between them. */
  const ordered = $derived(
    [...stops].filter((s) => s.kind !== 'transit').sort((a, b) => a.order - b.order),
  );

  /* HOW YOU GET FROM EACH STOP TO THE NEXT. Derived, never stored — see
     logic/connectors.ts. Keyed by the stop the move ARRIVES at, so the card can
     be drawn immediately above that stop without a second lookup. */
  const connectors = $derived(buildConnectors(stops, bookings, trip));
  const arrivingAt = $derived(
    new Map(connectors.filter((c) => c.toStopId).map((c) => [c.toStopId as string, c])),
  );
  /* Drawn after the last stop — the only connector that is not above something. */
  const leaving = $derived(connectors.find((c) => c.edge === 'depart') ?? null);

  const MODE_ICON: Record<Connector['mode'], string> = {
    air: '✈️',
    rail: '🚄',
    road: '🚗',
    unknown: '⚠️',
  };
  const STATE_LABEL: Record<Connector['state'], string> = {
    booked: 'Booked',
    partial: 'Part booked',
    planned: 'Not booked',
    none: 'Nothing booked',
  };

  /** A leg's own words: "CA 8683 · 12:35 → 13:45" or "HSR · ~2 h". */
  function legLine(b: Booking): string {
    const bits: string[] = [];
    if (b.kind === 'flight') bits.push(b.flightNo);
    const dep = 'dep' in b ? b.dep : undefined;
    const arr = 'arr' in b ? b.arr : undefined;
    if (dep && arr) bits.push(`${dep} → ${arr}`);
    const dur = 'duration' in b ? b.duration : undefined;
    if (dur) bits.push(dur);
    if (b.priceNote) bits.push(b.priceNote);
    return bits.join(' · ');
  }

  /** Tapping a leg opens the card that already describes it, on the Wallet. */
  function openLeg(b: Booking): void {
    router.go(`#/trip/${trip.id}/wallet/${b.id}`);
  }

  /* IS THIS PART OF THE TRIP ACTUALLY BOOKED? Derived, never stored — see
     logic/coverage.ts. The page already showed where you sleep and how you get
     there; whether any of it is HELD was one tap away inside a different card
     for every night and every leg, and "no bed at all" was drawn as nothing
     whatsoever. A blank is the one thing you cannot check. */
  const cover = $derived(coverageByStop(buildCoverage(trip, stops, bookings, now)));

  /** A night's own state, in the words the chip uses. */
  function nightWord(n: CoveredNight): string {
    return n.state === 'missing'
      ? S.plan.cover.nightMissing
      : n.state === 'pending'
        ? S.plan.cover.nightPending
        : n.state === 'walkin'
          ? S.plan.cover.nightWalkin
          : S.plan.cover.nightTransit;
  }
  /** A move's own state — `planned` is the walk-up bus, not a gap. */
  function legWord(l: CoveredLeg): string {
    return l.state === 'none'
      ? S.plan.cover.legNone
      : l.state === 'planned'
        ? S.plan.cover.legPlanned
        : l.state === 'partial'
          ? S.plan.cover.legPartial
          : S.plan.cover.legBooked;
  }
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

<main class="wrap" style="padding-top:{embedded ? 4 : 16}px">
  {#if embedded}
    <h2 class="caps stopslabel" id="stops">
      {S.journey.stops} <span class="stopscount">· {ordered.filter((s) => s.kind === 'stop').length}</span>
    </h2>
  {:else}
    <h1 class="pagename">
      {S.tabs.plans}
      <span class="pagesub">{ordered.filter((s) => s.kind === 'stop').length} stops</span>
    </h1>
  {/if}

  {#if ordered.length === 0}
    <EmptyState
      glyph={S.empty.plans.glyph}
      title={S.empty.plans.title}
      body={S.empty.plans.body}
      actionLabel={S.empty.plans.action}
      onaction={() => (sheet = { kind: 'stop' })}
    />
  {/if}

  {#snippet stopBody(s: Stop)}
    <div class="bd">
      <!-- Directions to the city itself, without having to open the city page
           first — the last surface in the app where a place had no button.
           It is the SAME component and the SAME gold pill the city guide's hero
           uses (Lantern §2: gold is the brand voice, and map pills are on its
           list), so this is one more instance of a language that already
           exists rather than a second way of saying the same thing.

           `s.kind === 'stop'` is the guard, not the absence of a coordinate:
           cn26-stop-flights is the transit pseudo-stop — "International
           flights" is a phase of the trip, not somewhere you go — and it must
           render nothing even if it ever acquired a map field by accident. -->
      {#if s.kind === 'stop'}
        <div class="stopmaps">
          <MapButtons
            coord={s.coord}
            name={s.name}
            query={s.mapQuery}
            address={s.address}
            city={s.mapCity}
            url={s.mapUrl}
            pill
          />
        </div>
      {/if}

      <!-- WHAT IS ACTUALLY HELD, above the day plans. The chip on the band says
           it in three words; this says which night and which move, and nothing
           it does not own — every line is a fact off a booking that already
           exists. Nights that are plainly booked are not listed: twelve
           identical "booked" rows would bury the one that is not. -->
      {#if cover.get(s.id)}
        {@const cv = cover.get(s.id)!}
        {@const nn = notableNights(cv)}
        {@const ll = cv.legs.filter((l) => l.state !== 'booked')}
        <section class="cover" class:warn={cv.tone === 'warn'} class:crit={cv.tone === 'crit'}>
          <div class="cvhead">
            <h4>{S.plan.cover.heading}</h4>
            <!-- app.css's own status chip — the same one Info's journey rows
                 wear, so one language says this in both places. -->
            <span class="chip {cv.tone}">{coverageStamp(cv).label}</span>
          </div>
          <ul class="cvlist">
            {#each nn as n (n.date)}
              <li class="n-{n.state}">
                <span class="cvd">{fmtDow(n.date)}</span>
                <span class="cvt"
                  >{nightWord(n)}{#if n.booking} · <Md text={n.booking.title} />{/if}</span
                >
              </li>
            {/each}
            {#each ll as l (l.connector.id)}
              <li class="n-{l.state === 'none' ? 'missing' : 'pending'}">
                <span class="cvd">{l.role === 'in' ? S.plan.cover.legIn : S.plan.cover.legOut}</span>
                <span class="cvt">{legWord(l)}</span>
              </li>
            {/each}
            {#if !nn.length && !ll.length}
              <li><span class="cvt">{S.plan.cover.allNights(cv.nights.length)}</span></li>
            {/if}
          </ul>
        </section>
      {/if}

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

      {#if s.detail || s.photoDocId || s.options?.length}
        <button class="readmore" onclick={() => router.go(`#/trip/${trip.id}/itinerary/${s.id}`)}>
          <span>📖 {S.plan.readMore}</span><span aria-hidden="true">→</span>
        </button>
      {/if}
    </div>
  {/snippet}

  {#each ordered as s (s.id)}
    {@const here = isHere(s)}
    {@const conn = arrivingAt.get(s.id)}
    <!-- HOW YOU GOT HERE. Drawn above the stop it arrives at, so the page reads
         as a route rather than a list of beds. Each leg is a button onto the
         card that already holds it — the connector repeats no facts it does not
         own. A join with no booking still draws, because a blank between two
         cities is the thing most worth seeing. -->
    {#if conn}
      <div class="conn" class:gap={conn.state === 'none'}>
        <span class="cmode" aria-hidden="true">{MODE_ICON[conn.mode]}</span>
        <div class="cbody">
          {#if conn.legs.length}
            {#each conn.legs as leg, i (leg.id)}
              {#if i > 0}<span class="cthen">then</span>{/if}
              <button class="cleg" onclick={() => openLeg(leg)}>
                <span class="ctitle"><Md text={leg.title} /></span>
                {#if legLine(leg)}<span class="cdet">{legLine(leg)}</span>{/if}
              </button>
            {/each}
          {:else}
            <span class="cnone">No flight and no train booked for this move yet</span>
          {/if}
          {#each conn.alternatives as alt (alt.id)}
            <button class="cleg calt" onclick={() => openLeg(alt)}>
              <span class="ctitle">or · <Md text={alt.title} /></span>
              {#if legLine(alt)}<span class="cdet">{legLine(alt)}</span>{/if}
            </button>
          {/each}
        </div>
        <span class="cstate cs-{conn.state}">{STATE_LABEL[conn.state]}</span>
      </div>
    {/if}
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
            <!-- Whether this stop is BOOKED, on the one surface you already
                 scroll past. It rides in the summary rather than beside it, so
                 tapping it opens the stop like the rest of the band. -->
            {#if cover.get(s.id)}
              {@const cv = cover.get(s.id)!}
              <span class="bchip t-{cv.tone}">{coverageStamp(cv).label}</span>
            {/if}
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

  <!-- AND HOME. The one connector with no stop under it. -->
  {#if leaving}
    <div class="conn">
      <span class="cmode" aria-hidden="true">{MODE_ICON[leaving.mode]}</span>
      <div class="cbody">
        {#each leaving.legs as leg, i (leg.id)}
          {#if i > 0}<span class="cthen">then</span>{/if}
          <button class="cleg" onclick={() => openLeg(leg)}>
            <span class="ctitle"><Md text={leg.title} /></span>
            {#if legLine(leg)}<span class="cdet">{legLine(leg)}</span>{/if}
          </button>
        {/each}
      </div>
      <span class="cstate cs-{leaving.state}">{STATE_LABEL[leaving.state]}</span>
    </div>
  {/if}

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
  .stopslabel {
    margin: 6px 4px 12px;
    color: var(--ink);
  }
  .stopscount {
    color: var(--faint);
    letter-spacing: 0.06em;
  }
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
    font-size: var(--glyph-scene);
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
    color: var(--on-photo);
    font-size: var(--text-xs);
    font-weight: 700;
    border-radius: 999px;
    padding: 2.5px 9px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    white-space: nowrap;
  }
  /* THE BOOKED CHIP RIDES OVER A PHOTOGRAPH, so it carries its own floor. The
     status washes in app.css are 14 % tints meant to sit on a card, and 14 %
     amber over a bright roofline is not a colour at all — it is the roofline.
     Near-solid black under the tint, the same trick the nights pill uses, and
     the status hue keeps its own contrast whatever the picture is doing. */
  .bchip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 2.5px 9px;
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    background: rgba(0, 0, 0, 0.86);
    color: var(--on-photo);
  }
  .bchip.t-ok {
    background: linear-gradient(var(--ok-bg), var(--ok-bg)), rgba(0, 0, 0, 0.86);
    color: var(--ok);
  }
  .bchip.t-warn {
    background: linear-gradient(var(--warn-bg), var(--warn-bg)), rgba(0, 0, 0, 0.86);
    color: var(--warn);
  }
  .bchip.t-crit {
    background: linear-gradient(var(--crit-bg), var(--crit-bg)), rgba(0, 0, 0, 0.86);
    color: var(--crit);
  }

  /* --- what is actually held, inside the opened card --- */
  .cover {
    margin-top: 11px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--line-2);
    border-radius: var(--radius-sm);
    background: var(--card-2);
    padding: 9px 12px 10px;
  }
  .cover.warn {
    border-left-color: var(--warn);
  }
  .cover.crit {
    border-left-color: var(--crit);
  }
  .cvhead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cvhead h4 {
    flex: 1;
    margin: 0;
    font-size: var(--text-xs);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .cvlist {
    list-style: none;
    margin: 7px 0 0;
    padding: 0;
  }
  .cvlist li {
    display: flex;
    gap: 9px;
    align-items: baseline;
    padding: 3px 0;
    font-size: var(--text-sm);
  }
  .cvd {
    flex-shrink: 0;
    min-width: 76px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--faint);
  }
  .cvt {
    color: var(--ink-2);
  }
  /* An absent bed speaks in the segment's OWN tone rather than always in red:
     a hole three months out is amber on the chip, and a row that shouted while
     the chip stayed calm would make the reader distrust both. */
  .cover.warn .n-missing .cvt {
    color: var(--warn);
    font-weight: 650;
  }
  .cover.crit .n-missing .cvt {
    color: var(--crit);
    font-weight: 650;
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
    font-size: var(--text-lg);
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
    font-size: var(--text-sm);
  }
  /* "Which dates" is the half of this card you do NOT already know, and it was
     set two thirds the size of the city name at 85 % white over a bright
     roofline. Solid white, 13.5 px, and the band's scrim carries a flat floor
     behind the text block instead of only darkening the bottom edge. */
  .band .wh {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--on-photo);
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.85);
  }
  .band .nm {
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7);
  }
  .band .bandtext::before {
    content: '';
    position: absolute;
    left: -13px;
    right: -12px;
    top: -10px;
    bottom: -9px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.55) 38%, rgba(0, 0, 0, 0.72) 100%);
    pointer-events: none;
  }
  .bandtext > * {
    position: relative;
  }
  .band .chev {
    color: rgba(255, 255, 255, 0.9);
  }
  /* "you are here" speaks gold everywhere in Lantern — it used to be a plain
     white pill, the last legacy-styled surface on this screen. */
  .herepill {
    background: var(--gold);
    color: var(--on-accent);
    box-shadow: var(--glow-halo);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-left: 6px;
  }

  /* --- connectors: how you get from one stop to the next --- */
  .conn {
    display: grid;
    grid-template-columns: 1.5rem 1fr auto;
    gap: 2px 10px;
    align-items: start;
    margin: 6px 0 6px 14px;
    padding: 8px 10px;
    border-left: 2px dashed var(--line);
    border-radius: 0 8px 8px 0;
    background: var(--card-2, transparent);
  }
  .conn.gap { border-left-color: var(--warn); border-left-style: solid; }
  .cmode { font-size: var(--text-base); line-height: 1.3; text-align: center; }
  .cbody { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  /* These are the rows you tap in a station hall with a cold thumb, and they
     were 2 px-padded text with nothing to say they were tappable: ~24 px tall,
     1 px apart, hover-underline only — a state a touch screen never enters.
     44 px, real padding, and a chevron that says "this opens something". */
  .cleg {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 8px;
    width: 100%;
    min-height: 44px;
    background: none;
    border: 1px solid transparent;
    padding: 8px 6px;
    margin: 0;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
    border-radius: 8px;
  }
  .cleg::after {
    content: '›';
    grid-row: 1 / span 2;
    grid-column: 2;
    color: var(--faint);
    font-size: var(--text-base);
    line-height: 1;
  }
  .cleg:active { border-color: var(--line-2); background: var(--card); }
  .cleg:hover .ctitle { text-decoration: underline; }
  .cleg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ctitle { grid-column: 1; font-size: var(--text-sm); font-weight: 600; }
  .cdet { grid-column: 1; font-size: var(--text-sm); opacity: 0.72; font-variant-numeric: tabular-nums; }
  .cthen {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
  }
  .calt .ctitle { font-weight: 500; opacity: 0.8; }
  .cnone { font-size: var(--text-sm); opacity: 0.85; }
  /* The connector's state pill was 9.9 px of tint with no colour of its own —
     three states that all read as "a faint grey lozenge" on a dimmed screen.
     It takes the label rung and says its state three ways now: the word, its
     own colour, and an outline that survives when the tint does not. */
  .cstate {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 999px;
    white-space: nowrap;
    border: 1px solid color-mix(in srgb, currentColor 55%, transparent);
  }
  .cs-booked {
    background: color-mix(in oklab, var(--ok) 18%, transparent);
    color: var(--ok);
  }
  .cs-partial,
  .cs-planned {
    background: color-mix(in oklab, var(--accent) 18%, transparent);
    color: var(--gold-light);
  }
  .cs-none {
    background: color-mix(in oklab, var(--warn) 22%, transparent);
    color: var(--warn);
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
    font-size: var(--text-base);
    flex-shrink: 0;
  }
  .ttl {
    flex: 1;
    min-width: 0;
  }
  .tnm {
    display: block;
    font-weight: 650;
    font-size: var(--text-base);
  }
  .transit .wh {
    color: var(--ink-2);
    font-size: var(--text-sm);
  }
  .here {
    color: var(--stop-text);
  }
  .chev {
    color: var(--faint);
    font-size: var(--text-sm);
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
    font-size: var(--text-sm);
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--stop-text);
    font-weight: 700;
  }
  .bd {
    padding: 2px 14px 14px;
  }
  /* The pill carries its own geometry and glow from MapButtons; this row only
     places it — left-aligned, hugging the band it sits under. */
  .stopmaps {
    display: flex;
    margin: 11px 0 2px;
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
    font-size: var(--text-sm);
  }
  .dayrow {
    display: flex;
    gap: 9px;
    margin-bottom: 8px;
    font-size: var(--text-sm);
  }
  .dayrow .d {
    background: var(--stop-soft);
    color: var(--stop-text);
    font-size: var(--text-xs);
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
    font-size: var(--text-sm);
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
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--faint);
  }
  .rc ul {
    margin: 0;
    padding-left: 18px;
  }
  .rc :global(li) {
    font-size: var(--text-sm);
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
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--stop-text);
    white-space: nowrap;
  }
  .dp-title {
    font-weight: 650;
    font-size: var(--text-sm);
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

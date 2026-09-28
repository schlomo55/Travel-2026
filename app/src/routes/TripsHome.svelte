<script lang="ts">
  /* THE TRIPS SHELF (f-trips) — where the app opens when no trip is open.
     The app's mark and name, the trip you are on as a card with its route
     drawn as a constellation from the real stop coordinates (today's leg
     flowing, tonight's star ringed), then the trips ahead, behind and put
     away; the two doors to a new trip — start one here, or import one built
     from a brief — the backup, and the one promise the app makes: your data
     stays on this phone.

     A trip whose stops carry fewer than two coordinates gets its cover photo,
     or the ridges at sunrise; nothing about a trip is invented to draw it. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { daysBetween, fmtLong, fmtShort } from '../lib/logic/dates';
  import { currentStop } from '../lib/logic/day';
  import { mdliteToText } from '../lib/logic/mdlite';
  import { S } from '../lib/i18n/strings';
  import Sheet from '../lib/components/ui/Sheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import SunMark from '../lib/components/horizon/SunMark.svelte';
  import TripMap from '../lib/map/TripMap.svelte';
  import TripWizard from './TripWizard.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import type { Stop, Trip } from '../lib/model/types';
  import { deleteTripCascade, mutate } from '../lib/data/repo';
  import { backupIsStale, exportTrip } from '../lib/data/export';
  import { crossTripStats } from '../lib/logic/stats';
  import { fmtMoneyWide } from '../lib/logic/money';
  import { buildConstellation } from '../lib/logic/constellation';
  import { toast } from '../lib/state/toast.svelte';

  const tripsLive = live(() => db.trips.orderBy('start').toArray(), { initial: [] });
  const stopsLive = live(() => db.stops.toArray(), { initial: [] });
  const settingsLive = live(() => db.settings.get('settings'));
  const stale = $derived(settingsLive.current ? backupIsStale(settingsLive.current) : false);
  const expensesLive = live(() => db.expenses.toArray(), { initial: [] });

  const now = $derived(appState.now);
  const trips = $derived(tripsLive.current ?? []);
  const stopsByTrip = $derived.by(() => {
    const m = new Map<string, Stop[]>();
    for (const s of stopsLive.current ?? []) m.set(s.tripId, [...(m.get(s.tripId) ?? []), s]);
    return m;
  });
  const active = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'during'));
  const upcoming = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'before'));
  const past = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'after').reverse());
  const archived = $derived(trips.filter((t) => t.archived));

  /* Cross-trip totals; money is grouped by home currency, never converted. */
  const cross = $derived.by(() => {
    const all = expensesLive.current ?? [];
    if (trips.length < 2) return null;
    const byTrip = new Map<string, typeof all>();
    for (const e of all) byTrip.set(e.tripId, [...(byTrip.get(e.tripId) ?? []), e]);
    return crossTripStats(trips, byTrip, now);
  });

  let wizardOpen = $state(false);
  let importOpen = $state(false);
  let editing = $state<Trip | null>(null);
  let menuTrip = $state<Trip | null>(null);

  function openTrip(t: Trip): void {
    router.goTab(t.id, 'now');
  }
  function stampFor(t: Trip): { label: string; tone: string } {
    if (t.archived) return { label: S.shelf.stamps.archived, tone: '' };
    const ph = tripPhase(t, now);
    if (ph === 'during') return { label: S.shelf.stamps.active, tone: 'accent' };
    if (ph === 'before') return { label: S.shelf.stamps.upcoming, tone: 'planned' };
    return { label: S.shelf.stamps.done, tone: 'ok' };
  }
  /* How far through the trip today is, and the honest words for its phase —
     a trip that has not started reads empty, a finished one full. */
  function progressOf(t: Trip): { pct: number; day: string; left: string; tonight: string | null } {
    const ph = tripPhase(t, now);
    const total = tripDays(t);
    if (ph === 'before') return { pct: 0, day: S.shelf.daysToGo(daysUntilStart(t, now)), left: '', tonight: null };
    if (ph === 'after') return { pct: 100, day: S.shelf.completed(total), left: '', tonight: null };
    const d = tripDay(t, now);
    const here = currentStop(stopsByTrip.get(t.id) ?? [], now);
    return {
      pct: Math.max(2, Math.min(100, (d / total) * 100)),
      day: S.shelf.dayOf(d, total),
      left: S.shelf.toGo(daysBetween(now, t.end)),
      tonight: here ? mdliteToText(here.name) : null,
    };
  }
  /* '21 Nov → 27 Dec' — with the year only when it is not this one */
  function datesOf(t: Trip): string {
    const end = t.end.slice(0, 4) === now.slice(0, 4) ? fmtShort(t.end) : fmtLong(t.end);
    return `${fmtShort(t.start)} → ${end}`;
  }
  const summary = $derived(S.shelf.summary(trips.length, active.length));
  const realStops = (t: Trip): number => (stopsByTrip.get(t.id) ?? []).filter((s) => s.kind === 'stop').length;
  /* The trip as a constellation (lib/map): its first stop, where you are,
     tonight's and its last one named; null when fewer than two stops carry a
     coordinate, and the card draws the cover photo or the ridges instead. */
  const mapOf = (t: Trip, lead: boolean) =>
    buildConstellation(
      stopsByTrip.get(t.id) ?? [],
      now,
      { width: 380, height: lead ? 240 : 170, pad: 34 },
      { labels: 'key' },
    );

  /* Deleting is the one irreversible thing on this screen, so it saves the
     trip to a file first — the same courtesy "Clear the vault" pays — then
     needs a second tap. Archive stays the gentle option next to it. */
  let deleteArmed = $state(false);
  let deleting = $state(false);
  async function removeTrip(t: Trip): Promise<void> {
    if (!deleteArmed) {
      deleteArmed = true;
      setTimeout(() => (deleteArmed = false), 5000);
      return;
    }
    deleting = true;
    try {
      await exportTrip(t.id);
    } catch {
      deleting = false;
      deleteArmed = false;
      toast.show(S.shelf.saveFailedNothingDeleted);
      return;
    }
    await deleteTripCascade(t.id);
    deleting = false;
    deleteArmed = false;
    router.closeTopLayer();
    toast.show(S.misc.deleted(t.title), undefined, 6000);
  }
  async function toggleArchive(t: Trip): Promise<void> {
    await mutate(() => db.trips.update(t.id, { archived: !t.archived, updatedAt: Date.now() }));
    toast.show(t.archived ? S.shelf.restored : S.shelf.archivedToast);
    router.closeTopLayer();
  }
</script>

{#snippet tripCard(t: Trip, i: number, lead: boolean)}
  {@const stamp = stampFor(t)}
  {@const pr = progressOf(t)}
  {@const map = mapOf(t, lead)}
  <article class="tripcard u-rise" class:lead class:opal-edge={lead} style="--h:{t.accentHue}; --i:{Math.min(i, 6)}" aria-label={S.shelf.cardAria(t.title, stamp.label, pr.day)}>
    <button class="tc-scene" onclick={() => openTrip(t)} aria-label={S.shelf.open(t.title)}>
      {#if map}
        <span class="tc-grid" aria-hidden="true"></span>
        <span class="tc-dawn" aria-hidden="true"></span>
        <TripMap c={map} shelf />
      {:else if t.coverDocId}
        <span class="tc-photo" aria-hidden="true"><PhotoImg docId={t.coverDocId} alt="" /></span>
      {:else}
        <span class="tc-dawn" aria-hidden="true"></span>
        <svg class="tc-ridges" viewBox="0 0 380 120" preserveAspectRatio="none" aria-hidden="true">
          <circle class="r-sun" cx="276" cy="70" r="16" />
          <path class="r1" d="M0 80 L60 52 L110 70 L170 38 L230 66 L290 44 L380 70 L380 120 L0 120 Z" />
          <path class="r3" d="M0 98 L80 78 L150 96 L230 72 L300 98 L380 84 L380 120 L0 120 Z" />
        </svg>
      {/if}
      <span class="tc-hline" aria-hidden="true"></span>
    </button>
    <div class="tc-body">
      <div class="tc-row">
        <span class="chip {stamp.tone}">
          {#if stamp.tone === 'accent'}<span class="sundot" aria-hidden="true"></span>{/if}{stamp.label}
        </span>
        <span class="tc-fill"></span>
        <span class="num tc-day">{pr.day}</span>
        <button class="iconbtn tc-menu" onclick={() => (menuTrip = t)} aria-label={S.shelf.options(t.title)}>
          <Icon name="dots" size={18} />
        </button>
      </div>
      <div class="tc-titles">
        <h2 class="display tc-title">{t.title}</h2>
        {#if t.subtitle}<span class="tc-sub">{t.subtitle}</span>{/if}
      </div>
      <span class="num tc-dates">{datesOf(t)} · {S.shelf.days(tripDays(t))}{#if realStops(t)} · {S.shelf.stops(realStops(t))}{/if}</span>
      {#if tripPhase(t, now) === 'during'}
        <div class="tc-progress" aria-hidden="true">
          <span class="tp-track"></span>
          <span class="tp-fill" style="width:{pr.pct}%"></span>
          <span class="tp-sun" style="left:{pr.pct}%"></span>
        </div>
        <div class="tc-left">
          {#if pr.tonight}<span>{S.shelf.tonightLine} <b>{pr.tonight}</b></span>{/if}
          <span class="tc-fill"></span>
          <span>{pr.left}</span>
        </div>
      {/if}
      <button class="btn {lead ? 'primary lg' : ''} wfull tc-open" onclick={() => openTrip(t)}>
        {lead ? S.shelf.continue : S.shelf.openTrip}
        <Icon name="arrow-right" size={18} stroke={2} />
      </button>
    </div>
  </article>
{/snippet}

<span class="stars" aria-hidden="true"></span>

<header class="shelfhead wrap">
  <SunMark size={38} />
  <div class="sh-text">
    <h1 class="display sh-name">{S.app.name}</h1>
    {#if trips.length}<span class="sh-sum">{summary}</span>{/if}
  </div>
  <a class="iconbtn" href="#/settings" aria-label={S.settings.title}><Icon name="gear" size={20} /></a>
</header>

<main class="wrap shelf">
  {#if trips.length === 0}
    <EmptyState
      glyph={S.empty.shelf.glyph}
      title={S.empty.shelf.title}
      body={S.empty.shelf.body}
      actionLabel={S.shelf.newTrip}
      onaction={() => {
        editing = null;
        wizardOpen = true;
      }}
      altLabel={S.shelf.importTrip}
      onalt={() => (importOpen = true)}
    />
  {:else}
    {#if active.length}
      <h2 class="caps sect lead">{S.shelf.active}</h2>
      {#each active as t, i (t.id)}{@render tripCard(t, i, i === 0)}{/each}
    {/if}
    {#if upcoming.length}
      <h2 class="caps sect">{S.shelf.upcoming}</h2>
      {#each upcoming as t, i (t.id)}{@render tripCard(t, i, !active.length && i === 0)}{/each}
    {/if}
    {#if past.length}
      <h2 class="caps sect">{S.shelf.past}</h2>
      {#each past as t, i (t.id)}{@render tripCard(t, i, false)}{/each}
    {/if}
    {#if archived.length}
      <h2 class="caps sect">{S.shelf.archived}</h2>
      {#each archived as t, i (t.id)}{@render tripCard(t, i, false)}{/each}
    {/if}
  {/if}

  {#if trips.length}
    <div class="doors">
      <button
        class="door new"
        onclick={() => {
          editing = null;
          wizardOpen = true;
        }}
      >
        <span class="d-top"><span class="d-ic new" aria-hidden="true"><Icon name="plus" size={16} stroke={2.2} /></span><span class="d-name">{S.shelf.newTrip}</span></span>
        <span class="d-hint">{S.shelf.newTripHint}</span>
      </button>
      <button class="door" onclick={() => (importOpen = true)}>
        <span class="d-top"><span class="d-ic imp" aria-hidden="true"><Icon name="download" size={15} stroke={2} /></span><span class="d-name">{S.shelf.importTrip}</span></span>
        <span class="d-hint">{S.shelf.importHint}</span>
      </button>
    </div>
  {/if}

  <section class="backup" class:stale aria-label={S.shelf.backupTitle}>
    <span class="bk-ic" aria-hidden="true"><Icon name="shield" size={19} /></span>
    <span class="bk-text">
      <span class="bk-name">{stale ? S.backup.staleTitle : S.shelf.backupTitle}</span>
      <span class="bk-sub">{stale ? S.shelf.backupStale : S.shelf.backupBody}</span>
    </span>
    <a class="btn" href="#/backup">{S.shelf.backupBtn}</a>
  </section>

  {#if cross && cross.totalTrips > 1}
    <section class="across">
      <h2 class="caps">{S.shelf.across}</h2>
      <div class="xstats">
        <div><span class="num n">{cross.totalTrips}</span><span class="l">{S.shelf.xtrips}</span></div>
        <div><span class="num n">{cross.totalDays}</span><span class="l">{S.shelf.xdays}</span></div>
        {#each cross.totalsByCurrency as c (c.currency)}
          <div><span class="num n">{fmtMoneyWide(c.minor, c.currency === 'USD' ? '$' : '')}</span><span class="l">{S.shelf.xspent(c.currency)}</span></div>
        {/each}
      </div>
      {#if cross.daysByYear.length > 1}
        {@const most = Math.max(...cross.daysByYear.map((x) => x.days))}
        <div class="years">
          {#each cross.daysByYear as y (y.year)}
            <div class="yrow">
              <span class="num yl">{y.year}</span>
              <span class="ybar"><i style="width:{Math.round((y.days / most) * 100)}%"></i></span>
              <span class="num yv">{S.shelf.yearDays(y.days)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <p class="promise"><Icon name="device" size={14} /> {S.misc.localOnly}</p>
</main>

<svg class="ridges" viewBox="0 0 412 150" preserveAspectRatio="none" aria-hidden="true">
  <path class="rg1" d="M0 96 L52 60 L96 84 L150 36 L204 80 L250 52 L306 90 L352 48 L412 82 L412 150 L0 150 Z" />
  <path class="rg2" d="M0 114 L66 84 L128 108 L190 74 L246 110 L300 82 L360 112 L412 96 L412 150 L0 150 Z" />
  <path class="rg3" d="M0 132 L84 106 L160 128 L236 100 L310 130 L412 110 L412 150 L0 150 Z" />
</svg>

{#if wizardOpen}
  <Sheet title={editing ? S.wizard.editTitle : S.wizard.createTitle} onclose={() => (wizardOpen = false)}>
    <TripWizard trip={editing} />
  </Sheet>
{/if}

{#if importOpen}
  <Sheet title={S.shelf.importTrip} onclose={() => (importOpen = false)}>
    <ImportSheet />
  </Sheet>
{/if}

{#if menuTrip}
  <Sheet title={menuTrip.title} onclose={() => (menuTrip = null)}>
    <div class="menu">
      <button
        class="btn wfull"
        onclick={() => {
          editing = menuTrip;
          menuTrip = null;
          router.closeTopLayer();
          setTimeout(() => (wizardOpen = true), 0);
        }}><Icon name="edit" size={16} /> {S.misc.editTrip}</button
      >
      <button class="btn wfull" onclick={() => menuTrip && toggleArchive(menuTrip)}>
        <Icon name="archive" size={16} />
        {menuTrip.archived ? S.misc.unarchive : S.misc.archive}
      </button>
      <p class="mhint">{S.misc.archiveHint}</p>
      <button class="btn danger wfull" disabled={deleting} onclick={() => menuTrip && removeTrip(menuTrip)}>
        {#if !deleteArmed && !deleting}<Icon name="trash" size={16} />{/if}
        {deleting ? S.misc.deleteSaving : deleteArmed ? S.misc.deleteArm : S.misc.deleteTrip}
      </button>
      <p class="mhint">{S.misc.deleteHint}</p>
    </div>
  </Sheet>
{/if}

<style>
  /* a few quiet stars over the header — still, as the motion rules ask */
  .stars {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 120px;
    background-image:
      radial-gradient(1.2px 1.2px at 38px 96px, var(--star), transparent),
      radial-gradient(1.4px 1.4px at 92px 18px, var(--star), transparent),
      radial-gradient(1px 1px at 140px 84px, var(--lilac-ink), transparent),
      radial-gradient(1.3px 1.3px at 203px 12px, var(--star), transparent),
      radial-gradient(1px 1px at 246px 104px, var(--star), transparent),
      radial-gradient(1.5px 1.5px at 288px 30px, var(--opal-1), transparent),
      radial-gradient(1px 1px at 330px 92px, var(--star), transparent),
      radial-gradient(1.2px 1.2px at 372px 16px, var(--lilac-ink), transparent);
    opacity: 0.55;
    pointer-events: none;
    z-index: -1;
  }
  .shelfhead {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: calc(18px + env(safe-area-inset-top));
    padding-bottom: 6px;
  }
  .sh-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sh-name {
    margin: 0;
    /* the board's 19 px, on the scale */
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.1;
  }
  .sh-sum {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .shelf {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 150px;
  }
  .sect {
    margin: 14px 8px -2px;
    color: var(--faint);
  }
  .sect.lead {
    color: var(--sunrise);
    letter-spacing: 0.16em;
  }

  /* ---------- the trip card ---------- */
  /* the trip you are on wears the opal edge (global .opal-edge); the rest
     are plain cards */
  .tripcard {
    --opal-fill: var(--card);
    position: relative;
    border-radius: var(--radius-photo);
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }
  .tripcard:not(.lead) {
    background: var(--card);
    border: 1px solid var(--line);
  }
  .tripcard.lead {
    box-shadow:
      0 40px 80px -36px rgba(0, 0, 0, 0.95),
      0 0 60px -24px rgba(255, 126, 182, 0.4);
  }
  :root[data-theme='light'] .tripcard.lead {
    box-shadow: var(--glow-opal);
  }
  .tc-scene {
    position: relative;
    display: block;
    width: 100%;
    height: 170px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: var(--sky-2);
    overflow: hidden;
  }
  .tripcard.lead .tc-scene {
    height: 240px;
  }
  .tc-grid {
    position: absolute;
    inset: 0;
    background-image: var(--dot-grid);
    background-size: 20px 20px;
    -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 45%, #000 35%, transparent 85%);
    mask-image: radial-gradient(ellipse 70% 70% at 50% 45%, #000 35%, transparent 85%);
  }
  .tc-dawn {
    position: absolute;
    left: -20%;
    right: -20%;
    bottom: -150px;
    height: 240px;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgba(255, 159, 107, 0.34), rgba(255, 126, 182, 0.1) 55%, transparent 100%);
  }
  .tc-scene :global(.shelfmap) {
    position: absolute;
    inset: 0;
  }
  .tc-photo :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tc-ridges {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 70%;
  }
  .r-sun {
    fill: var(--opal-1);
    opacity: 0.9;
  }
  .r1 {
    fill: var(--ridge-2);
  }
  .r3 {
    fill: var(--ridge-3);
    stroke: var(--ridge-edge);
    stroke-width: 1;
  }
  .tc-hline {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--horizon-line);
  }
  .tc-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px 18px 20px;
  }
  .tc-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sundot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--sunrise-fill);
    box-shadow: 0 0 8px var(--sunrise-fill);
  }
  .tc-fill {
    flex: 1;
  }
  .tc-day {
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .tc-menu {
    width: 44px;
    height: 44px;
    margin: -6px -8px -6px 0;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    color: var(--ink-2);
  }
  .tc-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tc-title {
    margin: 0;
    font-size: var(--fs-screen);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }
  /* the board's 32 px, on the scale: a trip's name at a city's size */
  .tripcard.lead .tc-title {
    font-size: var(--fs-city-title);
  }
  .tc-sub {
    font-size: var(--fs-body);
    font-style: italic;
    color: var(--ink-2);
  }
  .tc-dates {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .tc-progress {
    position: relative;
    height: 16px;
  }
  .tp-track {
    position: absolute;
    left: 0;
    right: 0;
    top: 7px;
    height: 2px;
    border-radius: 2px;
    background: var(--scene-track);
  }
  .tp-fill {
    position: absolute;
    left: 0;
    top: 7px;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2));
    box-shadow: 0 0 8px rgba(255, 126, 182, 0.7);
  }
  .tp-sun {
    position: absolute;
    top: 1px;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    border-radius: 999px;
    background: var(--sunrise-fill);
    box-shadow: 0 0 12px rgba(255, 159, 107, 0.95);
    animation: h-sun var(--duration-sun) ease-in-out infinite;
  }
  .tc-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .tc-left b {
    font-weight: 600;
    color: var(--ink);
  }
  .tc-open {
    margin-top: 4px;
  }

  /* ---------- the two doors ---------- */
  .doors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 4px;
  }
  .door {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 92px;
    padding: 14px;
    border-radius: var(--radius-tile);
    text-align: left;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .door.new {
    background: color-mix(in srgb, var(--card) 60%, transparent);
    border: 1.5px dashed var(--edge);
  }
  .d-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .d-ic {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
  }
  .d-ic.new {
    color: var(--sunrise);
    background: var(--sunrise-soft);
    border: 1px solid color-mix(in srgb, var(--sunrise) 40%, transparent);
  }
  .d-ic.imp {
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border: 1px solid var(--lilac-line);
  }
  .d-name {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .d-hint {
    font-size: var(--fs-chip);
    line-height: 1.4;
    color: var(--ink-2);
  }

  /* ---------- the backup ---------- */
  .backup {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-float);
  }
  .backup.stale {
    border-color: var(--warn-line);
  }
  .bk-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-button-sm);
    color: var(--ink);
    background: var(--card-2);
  }
  .backup.stale .bk-ic {
    color: var(--warn-ink);
  }
  .bk-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bk-name {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .bk-sub {
    font-size: var(--fs-chip);
    line-height: 1.35;
    color: var(--ink-2);
  }
  .across {
    padding: 14px 16px;
    border-radius: var(--radius-tile);
    background: var(--card);
    border: 1px solid var(--line);
  }
  .across h2 {
    margin: 0 0 8px;
    color: var(--ink-2);
  }
  .xstats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .xstats .n {
    display: block;
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1.1;
  }
  .xstats .l {
    display: block;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .years {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
  }
  .yrow {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .ybar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .ybar i {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2));
  }
  .promise {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 8px 0 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .ridges {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 150px;
    pointer-events: none;
    z-index: -1;
  }
  .rg1 {
    fill: var(--ridge-1);
  }
  .rg2 {
    fill: var(--ridge-2);
  }
  .rg3 {
    fill: var(--ridge-3);
    stroke: var(--ridge-edge);
    stroke-width: 1;
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mhint {
    margin: -2px 4px 4px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>

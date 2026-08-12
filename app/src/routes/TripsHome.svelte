<script lang="ts">
  /* The shelf (plan §SCREENS 1). Golden-hour cover cards with a battery-style
     day meter, sectioned Active / Upcoming / Past / Archived, and a dashed
     "Start a New Trip" card that is the door to the builder.

     Trips without a cover photo get a designed gradient scene rather than a
     grey box: the same golden-hour wash the photos have, a hill silhouette,
     and the trip's own emoji watermarked into it. Nothing about the trip is
     invented — the scene is chrome, not content. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { fmtShort, fmtLong } from '../lib/logic/dates';
  import { S } from '../lib/i18n/strings';
  import Sheet from '../lib/components/ui/Sheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import TripWizard from './TripWizard.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import type { Trip } from '../lib/model/types';
  import { deleteTripCascade, mutate } from '../lib/data/repo';
  import { backupIsStale, exportTrip } from '../lib/data/export';
  import { crossTripStats } from '../lib/logic/stats';
  import { fmtMoneyWide } from '../lib/logic/money';
  import { toast } from '../lib/state/toast.svelte';

  const tripsLive = live(() => db.trips.orderBy('start').toArray(), { initial: [] });
  const settingsLive = live(() => db.settings.get('settings'));
  const stale = $derived(settingsLive.current ? backupIsStale(settingsLive.current) : false);

  /* Cross-trip totals; money is grouped by home currency, never converted. */
  const expensesLive = live(() => db.expenses.toArray(), { initial: [] });
  const cross = $derived.by(() => {
    const all = expensesLive.current ?? [];
    if (!trips.length) return null;
    const byTrip = new Map<string, typeof all>();
    for (const e of all) byTrip.set(e.tripId, [...(byTrip.get(e.tripId) ?? []), e]);
    return crossTripStats(trips, byTrip, now);
  });

  let wizardOpen = $state(false);
  let importOpen = $state(false);
  let editing = $state<Trip | null>(null);
  let menuTrip = $state<Trip | null>(null);

  const now = $derived(appState.now);
  const trips = $derived(tripsLive.current ?? []);
  const active = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'during'));
  const upcoming = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'before'));
  const past = $derived(trips.filter((t) => !t.archived && tripPhase(t, now) === 'after').reverse());
  const archived = $derived(trips.filter((t) => t.archived));

  function open(t: Trip): void {
    router.goTab(t.id, 'today');
  }
  function stampFor(t: Trip): { label: string; cls: string } {
    if (t.archived) return { label: S.shelf.stamps.archived, cls: '' };
    const ph = tripPhase(t, now);
    if (ph === 'during') return { label: S.shelf.stamps.active, cls: 'accent' };
    if (ph === 'before') return { label: S.shelf.stamps.upcoming, cls: 'warn' };
    return { label: S.shelf.stamps.done, cls: 'ok' };
  }
  /* The battery meter: how far through the trip today is, and the honest label
     for the phase it is in. A trip that has not started reads empty, a finished
     one reads full — neither pretends to be a day count it does not have. */
  function meterFor(t: Trip): { pct: number; label: string } {
    const ph = tripPhase(t, now);
    if (ph === 'before') return { pct: 0, label: S.shelf.daysToGo(daysUntilStart(t, now)) };
    if (ph === 'after') return { pct: 100, label: S.shelf.completed(tripDays(t)) };
    const total = tripDays(t);
    const day = tripDay(t, now);
    return { pct: Math.max(3, Math.round((day / total) * 100)), label: S.shelf.dayOf(day, total) };
  }

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
      /* A failed save must not strand the user mid-delete; the trip is still
         here and the toast below says what happened. */
      deleting = false;
      deleteArmed = false;
      toast.show('Could not save a copy — nothing was deleted');
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
    toast.show(t.archived ? 'Trip restored' : 'Trip archived');
    router.closeTopLayer();
  }
</script>

{#snippet tripCard(t: Trip, i: number)}
  {@const stamp = stampFor(t)}
  {@const meter = meterFor(t)}
  <article class="tripcard u-rise" style="--h:{t.accentHue}; --i:{Math.min(i, 6)}">
    {#if t.coverDocId}
      <div class="scene" aria-hidden="true"><PhotoImg docId={t.coverDocId} alt="" /></div>
    {:else}
      <div class="scene fallback" aria-hidden="true">
        <svg viewBox="0 0 400 120" preserveAspectRatio="none">
          <path d="M0,120 L0,84 Q92,44 190,80 T400,68 L400,120 Z" style="fill:var(--dusk-ridge)" opacity=".85" />
          <circle cx="298" cy="46" r="17" style="fill:var(--dusk-sun)" opacity=".9" />
        </svg>
        <span class="emo">{t.emoji ?? '🧭'}</span>
      </div>
    {/if}
    <span class="scrim" aria-hidden="true"></span>
    <span class="badge" aria-hidden="true"></span>
    <span class="tag">{stamp.label}</span>
    <button class="hit" onclick={() => open(t)} aria-label={t.title}></button>
    <div class="tinfo">
      <h2>{t.emoji && t.coverDocId ? `${t.emoji} ` : ''}{t.title}</h2>
      <div class="dates">{fmtShort(t.start)} – {fmtLong(t.end)}</div>
      <div class="daybar" class:lowfill={meter.pct < 26}>
        <i class="fill" style="width:{meter.pct}%"></i>
        <span class="lab">{meter.label}</span>
      </div>
      <span class="tip" aria-hidden="true"></span>
    </div>
    <button class="tc-menu" onclick={(e) => { e.stopPropagation(); menuTrip = t; }} aria-label="Trip options">⋯</button>
  </article>
{/snippet}

{#snippet newTripCard()}
  <button class="newtrip u-rise" onclick={() => { editing = null; wizardOpen = true; }}>
    <span class="plus" aria-hidden="true">＋</span>
    <b>{S.shelf.newTrip}</b>
    <small>{S.shelf.newTripHint}</small>
  </button>
{/snippet}

<main class="wrap" style="padding-top:14px">
  <h1 class="shelftitle">{S.shelf.title}</h1>

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
      altLabel={`⬆ ${S.shelf.importTrip}`}
      onalt={() => (importOpen = true)}
    />
  {:else}
    {#if active.length}
      <h3 class="sect">{S.shelf.active}</h3>
      {#each active as t, i (t.id)}{@render tripCard(t, i)}{/each}
    {/if}
    {#if upcoming.length}
      <h3 class="sect">{S.shelf.upcoming}</h3>
      {#each upcoming as t, i (t.id)}{@render tripCard(t, i)}{/each}
    {/if}
    {#if past.length}
      <h3 class="sect">{S.shelf.past}</h3>
      {#each past as t, i (t.id)}{@render tripCard(t, i)}{/each}
    {/if}
    {#if archived.length}
      <h3 class="sect">{S.shelf.archived}</h3>
      {#each archived as t, i (t.id)}{@render tripCard(t, i)}{/each}
    {/if}

    {@render newTripCard()}
    <button class="btn ghost wfull" onclick={() => (importOpen = true)}>⬆ {S.shelf.importTrip}</button>

    {#if cross && cross.totalTrips > 1}
      <section class="card" style="margin-top:16px">
        <h3>{S.shelf.across}</h3>
        <div class="xstats">
          <div><span class="n">{cross.totalTrips}</span><span class="l">trips</span></div>
          <div><span class="n">{cross.totalDays}</span><span class="l">days away</span></div>
          {#each cross.totalsByCurrency as c (c.currency)}
            <div><span class="n">{fmtMoneyWide(c.minor, c.currency === 'USD' ? '$' : '')}</span><span class="l">spent · {c.currency}</span></div>
          {/each}
        </div>
        {#if cross.daysByYear.length > 1}
          <div class="years">
            {#each cross.daysByYear as y (y.year)}
              <div class="yrow">
                <span class="yl">{y.year}</span>
                <span class="ybar"><i style="width:{Math.round((y.days / Math.max(...cross.daysByYear.map((x) => x.days))) * 100)}%"></i></span>
                <span class="yv">{y.days}d</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  {/if}

  {#if stale}
    <section class="card warn">
      <h3>💾 Save a backup</h3>
      <p class="muted" style="margin:0 0 10px">
        You have made changes since the last one. Browser storage can be cleared — a copy takes a second.
      </p>
      <button class="btn wfull" onclick={() => router.go('#/backup')}>Back up now</button>
    </section>
  {/if}

  <footer class="foot">{S.misc.localOnly}</footer>
</main>

{#if wizardOpen}
  <Sheet title={editing ? S.wizard.editTitle : S.wizard.createTitle} onclose={() => (wizardOpen = false)}>
    <TripWizard trip={editing} />
  </Sheet>
{/if}

{#if importOpen}
  <Sheet title="Import a trip" onclose={() => (importOpen = false)}>
    <ImportSheet />
  </Sheet>
{/if}

{#if menuTrip}
  <Sheet title={menuTrip.title} onclose={() => (menuTrip = null)}>
    <div style="display:flex; flex-direction:column; gap:10px">
      <button
        class="btn wfull"
        onclick={() => {
          editing = menuTrip;
          menuTrip = null;
          router.closeTopLayer();
          setTimeout(() => (wizardOpen = true), 0);
        }}>✏️ {S.misc.editTrip}</button
      >
      <button class="btn wfull" onclick={() => menuTrip && toggleArchive(menuTrip)}>
        {menuTrip.archived ? `📤 ${S.misc.unarchive}` : `📦 ${S.misc.archive}`}
      </button>
      <p class="small" style="margin:-2px 2px 2px">{S.misc.archiveHint}</p>
      <button
        class="btn danger wfull"
        disabled={deleting}
        onclick={() => menuTrip && removeTrip(menuTrip)}
      >
        {deleting ? S.misc.deleteSaving : deleteArmed ? S.misc.deleteArm : `🗑 ${S.misc.deleteTrip}`}
      </button>
      <p class="small" style="margin:-2px 2px 0">{S.misc.deleteHint}</p>
    </div>
  </Sheet>
{/if}

<style>
  .shelftitle {
    font-size: var(--text-lg);
    font-weight: 700;
    margin: 2px 2px 14px;
  }
  .sect {
    font-size: var(--text-xs);
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 800;
    margin: 18px 2px 10px;
  }

  /* ---------- the cover card ---------- */
  .tripcard {
    position: relative;
    height: 176px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 18px;
    border: 1px solid color-mix(in srgb, var(--gold) 16%, transparent);
    box-shadow: var(--glow-photo-card);
    background: var(--card);
  }
  .scene {
    position: absolute;
    inset: 0;
  }
  .scene :global(img) {
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
  .fallback {
    background: linear-gradient(180deg, var(--dusk-1) 0%, var(--dusk-2) 55%, var(--dusk-3) 100%);
  }
  .fallback svg {
    position: absolute;
    inset: auto 0 0 0;
    width: 100%;
    height: 62%;
  }
  .fallback .emo {
    position: absolute;
    right: 16px;
    top: 14px;
    font-size: var(--glyph-scene);
    opacity: 0.42;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.05) 20%, rgba(0, 0, 0, 0.62) 100%);
  }
  /* the per-trip hue, shrunk to an identity badge (LANTERN: no re-tinting) */
  .badge {
    position: absolute;
    top: 14px;
    left: 14px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--stop);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.35);
  }
  .tag {
    position: absolute;
    top: 10px;
    left: 32px;
    background: rgba(0, 0, 0, 0.42);
    color: var(--on-photo);
    font-size: var(--text-xs);
    font-weight: 800;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    border-radius: var(--radius-pill);
    padding: 3px 10px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .hit {
    position: absolute;
    inset: 0;
    background: none;
    border: none;
    cursor: pointer;
  }
  .tinfo {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
  }
  .tinfo h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--text-title);
    line-height: 1.12;
    color: var(--on-photo);
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.75);
  }
  .dates {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--cream);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.85);
  }

  /* ---------- the battery-style day meter ---------- */
  .daybar {
    position: relative;
    height: 30px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.14);
    overflow: hidden;
  }
  .daybar .fill {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    background: linear-gradient(90deg, var(--meter-cell), var(--meter-cell-2));
    border-radius: 16px;
  }
  .daybar .lab {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--cream-ink);
    font-variant-numeric: tabular-nums;
  }
  /* almost nothing filled — the label would sit on black, so it turns cream */
  .daybar.lowfill .lab {
    color: var(--cream);
  }
  /* the battery tip: the meter reads as a cell, not as a progress bar */
  .tip {
    position: absolute;
    right: -5px;
    bottom: 9px;
    width: 4px;
    height: 12px;
    border-radius: 0 3px 3px 0;
    background: rgba(255, 255, 255, 0.3);
  }
  .tc-menu {
    position: absolute;
    top: 6px;
    right: 6px;
    background: rgba(0, 0, 0, 0.3);
    border: none;
    color: var(--on-photo);
    font-size: var(--text-lg);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    z-index: 2;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .tc-menu:active {
    background: rgba(0, 0, 0, 0.55);
  }

  /* ---------- the door to a new trip ---------- */
  .newtrip {
    width: 100%;
    margin: 4px 0 12px;
    border: 2px dashed var(--line-2);
    border-radius: var(--radius);
    padding: 24px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: none;
    color: var(--ink);
  }
  .newtrip:active {
    border-color: var(--gold);
  }
  .newtrip .plus {
    width: 40px;
    height: 40px;
    border: 2px solid var(--gold);
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--gold);
    font-size: var(--text-lg);
    line-height: 1;
  }
  .newtrip b {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-lg);
  }
  .newtrip small {
    font-size: var(--text-sm);
    color: var(--ink-2);
  }

  .xstats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .xstats .n {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-title);
    line-height: 1.1;
  }
  .xstats .l {
    display: block;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--faint);
  }
  .years {
    margin-top: 12px;
  }
  .yrow {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 3px 0;
  }
  .yl {
    width: 42px;
    font-size: var(--text-sm);
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .ybar {
    flex: 1;
    height: 8px;
    background: var(--paper-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .ybar i {
    display: block;
    height: 100%;
    background: var(--gold);
    border-radius: 4px;
  }
  .yv {
    width: 40px;
    text-align: right;
    font-size: var(--text-sm);
    font-weight: 650;
  }
  .btn.danger {
    border-color: color-mix(in srgb, var(--crit) 55%, var(--line));
    color: var(--crit);
    background: var(--crit-bg);
  }
</style>

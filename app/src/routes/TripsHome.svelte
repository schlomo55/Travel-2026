<script lang="ts">
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { tripPhase, tripDay, tripDays, daysUntilStart } from '../lib/logic/phase';
  import { fmtShort, fmtLong } from '../lib/logic/dates';
  import { S } from '../lib/i18n/strings';
  import Sheet from '../lib/components/ui/Sheet.svelte';
  import TripWizard from './TripWizard.svelte';
  import ImportSheet from './ImportSheet.svelte';
  import type { Trip } from '../lib/model/types';
  import { mutate } from '../lib/data/repo';
  import { backupIsStale } from '../lib/data/export';
  import { toast } from '../lib/state/toast.svelte';

  const tripsLive = live(() => db.trips.orderBy('start').toArray(), { initial: [] });
  const settingsLive = live(() => db.settings.get('settings'));
  const stale = $derived(settingsLive.current ? backupIsStale(settingsLive.current) : false);

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
  function metaFor(t: Trip): string {
    const ph = tripPhase(t, now);
    if (ph === 'before') return S.shelf.daysToGo(daysUntilStart(t, now));
    if (ph === 'during') return S.shelf.dayOf(tripDay(t, now), tripDays(t));
    return S.shelf.completed(tripDays(t));
  }
  async function toggleArchive(t: Trip): Promise<void> {
    await mutate(() => db.trips.update(t.id, { archived: !t.archived, updatedAt: Date.now() }));
    toast.show(t.archived ? 'Trip restored' : 'Trip archived');
    router.closeTopLayer();
  }
</script>

{#snippet tripCard(t: Trip)}
  {@const stamp = stampFor(t)}
  <article class="card tripcard" style="--accent-h:{t.accentHue}">
    <button class="hit" onclick={() => open(t)} aria-label={t.title}></button>
    <div class="routeline" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="tc-top">
      <h2>{t.emoji ? `${t.emoji} ` : ''}{t.title}</h2>
      <span class="stamp {stamp.cls}">{stamp.label}</span>
    </div>
    {#if t.subtitle}<div class="muted">{t.subtitle}</div>{/if}
    <div class="tc-meta">
      <span class="mono small">{fmtShort(t.start)} → {fmtLong(t.end)}</span>
      <span class="pill">{metaFor(t)}</span>
    </div>
    <button class="tc-menu" onclick={(e) => { e.stopPropagation(); menuTrip = t; }} aria-label="Trip options">⋯</button>
  </article>
{/snippet}

<main class="wrap" style="padding-top:16px">
  {#if trips.length === 0}
    <section class="card" style="text-align:center; padding:30px 18px">
      <div class="routeline" aria-hidden="true" style="max-width:180px; margin:0 auto 16px"><i></i><i></i><i></i></div>
      <h1 style="font-size:25px; margin:0 0 8px">{S.shelf.empty}</h1>
      <p class="muted" style="margin:0 0 18px">{S.shelf.emptyHint}</p>
      <button class="btn primary wfull" onclick={() => { editing = null; wizardOpen = true; }}>＋ {S.shelf.newTrip}</button>
      <button class="btn wfull" style="margin-top:9px" onclick={() => (importOpen = true)}>⬆ Import a trip</button>
    </section>
  {:else}
    {#if active.length}
      <h3 class="sect">{S.shelf.active}</h3>
      {#each active as t (t.id)}{@render tripCard(t)}{/each}
    {/if}
    {#if upcoming.length}
      <h3 class="sect">{S.shelf.upcoming}</h3>
      {#each upcoming as t (t.id)}{@render tripCard(t)}{/each}
    {/if}
    {#if past.length}
      <h3 class="sect">{S.shelf.past}</h3>
      {#each past as t (t.id)}{@render tripCard(t)}{/each}
    {/if}
    {#if archived.length}
      <h3 class="sect">{S.shelf.archived}</h3>
      {#each archived as t (t.id)}{@render tripCard(t)}{/each}
    {/if}
    <div style="display:flex; gap:9px; margin-top:4px">
      <button class="btn" style="flex:2" onclick={() => { editing = null; wizardOpen = true; }}>＋ {S.shelf.newTrip}</button>
      <button class="btn ghost" style="flex:1" onclick={() => (importOpen = true)}>⬆ Import</button>
    </div>
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
    </div>
  </Sheet>
{/if}

<style>
  .sect {
    font-size: 11px;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 800;
    margin: 14px 2px 8px;
  }
  .tripcard {
    padding-top: 14px;
  }
  .hit {
    position: absolute;
    inset: 0;
    background: none;
    border: none;
    border-radius: inherit;
    cursor: pointer;
  }
  .tc-top {
    display: flex;
    align-items: baseline;
    gap: 10px;
    justify-content: space-between;
  }
  .tc-top h2 {
    margin: 0;
    font-size: 22px;
  }
  .tc-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
    padding-right: 38px; /* clear the ⋯ button */
  }
  .tc-menu {
    position: absolute;
    bottom: 9px;
    right: 8px;
    background: none;
    border: none;
    color: var(--faint);
    font-size: 19px;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    z-index: 1;
  }
  .tc-menu:active {
    background: var(--card-2);
  }
</style>

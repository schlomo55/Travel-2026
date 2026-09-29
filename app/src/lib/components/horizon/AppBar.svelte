<script lang="ts">
  /* THE TRIP BAR — the one row of chrome a trip's three places share.

     Left, the app's own mark: the way back to every trip (and Settings). Then
     the trip and where you are in it. Right, the status pill — the counter
     that cannot be lost track of, a doorway to Pocket's Visa screen — and the
     edit switch.

     It sits on the sky and scrolls away with the screen, the way every
     header on the boards does: the only chrome that floats is the nav. */
  import type { Snippet } from 'svelte';
  import type { ComplianceCounter, ISODate, Trip } from '../../model/types';
  import { counterState, counterWord } from '../../logic/counters';
  import { fmtDow } from '../../logic/dates';
  import { daysUntilStart, tripDay, tripDays, tripPhase } from '../../logic/phase';
  import { appState } from '../../state/appState.svelte';
  import { editMode } from '../../state/editMode.svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from './Icon.svelte';
  import SunMark from './SunMark.svelte';

  let {
    trip,
    counters,
    now,
    home,
    extra,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    now: ISODate;
    /** Now's own header (f-now): the date large, the day under it, and no
        edit switch — nothing on Now's home is edited in place. */
    home?: { title: string; sub: string };
    /** after the day line (Now's weather) */
    extra?: Snippet;
  } = $props();

  const phase = $derived(tripPhase(trip, now));
  const sub = $derived.by(() => {
    if (phase === 'before') return `${S.shelf.daysToGo(daysUntilStart(trip, now))} · ${fmtDow(now)}`;
    if (phase === 'after') return S.shelf.completed(tripDays(trip));
    return `${S.shelf.dayOf(tripDay(trip, now), tripDays(trip))} · ${fmtDow(now)}`;
  });

  /* The always-visible pill: the counter during the trip, the countdown
     before it. Tone follows danger only — tight inside the last three days,
     and on the day the limit is passed, where it is a fact, not a countdown. */
  const pill = $derived.by((): { k: string; v: string; tone: '' | 'tight' | 'ok'; name?: string } => {
    if (phase === 'before') return { k: S.appbar.starts, v: `${daysUntilStart(trip, now)} d`, tone: '' };
    if (phase === 'after') return { k: S.appbar.trip, v: S.appbar.done, tone: 'ok' };
    const pinned = counters.find((c) => c.pinned);
    if (pinned) {
      /* the pill says the word (VISA 19/30), its accessible name the whole name */
      const k = counterWord(pinned.name);
      const name = pinned.name;
      const st = counterState(pinned, now);
      if (st.phase === 'counting') {
        return { k, name, v: `${st.day}/${st.limitDays}`, tone: st.remaining <= 3 ? 'tight' : '' };
      }
      if (st.phase === 'entryDay') return { k, name, v: S.appbar.entry, tone: '' };
      if (st.phase === 'overLimit') return { k, name, v: S.appbar.over, tone: 'tight' };
      if (st.phase === 'complete') return { k, name, v: S.appbar.done, tone: 'ok' };
      if (st.phase === 'before') return { k, name, v: S.appbar.notYet, tone: '' };
    }
    return { k: S.appbar.day, v: `${tripDay(trip, now)}/${tripDays(trip)}`, tone: '' };
  });
</script>

<header class="appbar tripbar" class:home={!!home}>
  <a class="tb-home" href="#/trips" aria-label={S.appbar.allTrips}><SunMark size={30} /></a>
  <div class="tb-title">
    {#if home}
      <!-- Now's heading (Run 4): the date, as the board draws it; a screen
           reader hears which screen it is first -->
      <h1 class="display tb-date"><span class="sr-only">{S.nav.now}: </span>{home.title}</h1>
      <span class="tb-sub">{home.sub}{@render extra?.()}</span>
    {:else}
      <span class="tb-name">{trip.title}</span>
      <span class="tb-sub">{sub}</span>
    {/if}
  </div>
  <!-- The one number the weekly check drills into, and a doorway to it. -->
  <button
    class="statuspill {pill.tone}"
    class:preview={appState.previewing}
    onclick={() => router.goCompliance(trip.id)}
    aria-label={`${pill.name ?? pill.k}: ${pill.v}`}
  >
    <span class="sp-k">{pill.k}</span>
    <span class="sp-v num">{pill.v}</span>
  </button>
  {#if !home}
    <button
      class="editmode iconbtn"
      class:on={editMode.on}
      onclick={() => editMode.toggle()}
      aria-pressed={editMode.on}
      aria-label={editMode.on ? S.edit.turnOff : S.edit.turnOn}
    >
      <Icon name={editMode.on ? 'check' : 'edit'} size={18} />
    </button>
  {/if}
</header>

<style>
  .tripbar {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 480px;
    margin: 0 auto;
    padding: calc(10px + env(safe-area-inset-top)) var(--gutter) 6px;
  }
  .tb-home {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-left: -6px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .tb-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tb-name {
    font-size: var(--fs-row);
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tb-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Now (f-now): the date in the display face over the day line */
  .tb-date {
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.2;
  }
  .home .tb-sub {
    font-size: var(--fs-caption);
  }
  .home .statuspill {
    min-height: 52px;
  }
  /* the Now board's visa pill: caps over a mono value, on floating chrome */
  .statuspill {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-width: 64px;
    max-width: 44vw;
    min-height: 48px;
    padding: 4px 14px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--chrome);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-float);
  }
  .sp-k {
    max-width: 100%;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sp-v {
    font-size: var(--fs-caption);
    font-weight: 600;
    line-height: 1.2;
  }
  .statuspill.tight {
    border-color: var(--crit-line);
  }
  .statuspill.tight .sp-v {
    color: var(--crit-ink);
  }
  .statuspill.ok .sp-v {
    color: var(--ok-ink);
  }
  /* Every date on the screen is fictional while a preview is on, and this
     pill is one of them. It says so where dates are read. */
  .statuspill.preview {
    border-style: dashed;
    border-color: var(--warn-line);
  }
  .statuspill.preview .sp-v {
    color: var(--warn-ink);
  }
  .editmode.on {
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    color: var(--on-sunrise);
  }
</style>

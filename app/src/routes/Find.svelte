<script lang="ts" module>
  /* The query survives a round trip into a result and back — open the pass,
     press back, and the search is still there. */
  let lastQuery = '';
  let lastScope: import('../lib/logic/find').FindScope = 'all';
</script>

<script lang="ts">
  /* FIND (f-find) — searches this phone, no internet. Warnings first: a
     driver card the trip file flags with ⚠️ is drawn as a warning card, the
     wrong place struck through beside the right one, with the right one's
     driver card one tap away. Then the results, grouped the way a traveller
     reaches for them. The index and the order are logic/find.ts; this file
     only draws them, and marks what matched without building HTML from data. */
  import type {
    Booking,
    DayPlan,
    DocumentFile,
    EmergencyContact,
    InfoCard,
    ISODate,
    Runbook,
    ShowCard,
    Stop,
    Task,
    Trip,
    TripNote,
    WalletCard,
  } from '../lib/model/types';
  import { buildIndex, highlight, search, SCOPES, type FindHit, type FindScope, type Seg } from '../lib/logic/find';
  import { fmtDow, localToday } from '../lib/logic/dates';
  import { PASS_ICON, passKind } from '../lib/logic/pass';
  import { appState } from '../lib/state/appState.svelte';
  import { router } from '../lib/state/router.svelte';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import StatusChip from '../lib/components/horizon/StatusChip.svelte';
  import DriverCard from '../lib/components/pocket/DriverCard.svelte';

  let {
    trip,
    stops,
    dayPlans,
    runbooks,
    bookings,
    cards,
    tasks,
    infoCards,
    emergency,
    showCards,
    documents,
    note,
    now,
  }: {
    trip: Trip;
    stops: Stop[];
    dayPlans: DayPlan[];
    runbooks: Runbook[];
    bookings: Booking[];
    cards: WalletCard[];
    tasks: Task[];
    infoCards: InfoCard[];
    emergency: EmergencyContact[];
    showCards: ShowCard[];
    documents: DocumentFile[];
    note?: TripNote;
    now: ISODate;
  } = $props();

  let query = $state(lastQuery);
  let scope = $state<FindScope>(lastScope);
  $effect(() => {
    lastQuery = query;
    lastScope = scope;
  });

  const index = $derived(
    buildIndex({
      bookings,
      showCards,
      runbooks,
      dayPlans,
      stops,
      tasks,
      infoCards,
      emergency,
      walletCards: cards,
      documents,
      note: note ?? null,
    }),
  );
  const results = $derived(search(index, query, scope, now));
  const total = $derived(results.warnings.length + results.groups.reduce((n, g) => n + g.hits.length, 0));
  const bookingById = $derived(new Map(bookings.map((b) => [b.id, b])));
  const cardById = $derived(new Map(showCards.map((c) => [c.id, c])));
  const places = $derived(showCards.filter((c) => c.kind === 'place' && !c.pending).sort((a, b) => a.order - b.order));
  const phrases = $derived(showCards.filter((c) => c.kind === 'phrase').sort((a, b) => a.order - b.order));
  const tid = $derived(encodeURIComponent(trip.id));

  let input = $state<HTMLInputElement | null>(null);
  $effect(() => {
    input?.focus({ preventScroll: true });
  });

  /* ---------- opening a result ---------- */
  let driver = $state<{ list: ShowCard[]; index: number } | null>(null);
  function openCard(id: string): void {
    const c = cardById.get(id);
    if (!c || c.pending) return;
    const list = c.kind === 'place' ? places : phrases;
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) driver = { list, index: i };
  }
  function open(h: FindHit): void {
    const r = h.entry.ref;
    switch (r.to) {
      case 'pass':
        router.goPocket(trip.id, r.bookingId);
        break;
      case 'driver':
      case 'phrase':
        openCard(r.cardId);
        break;
      case 'step': {
        /* the day the list belongs to — the same preview the day's own long
           jump uses, so the Now screen shows that day */
        const d = h.entry.step?.dates.includes(now) ? now : (r.date ?? now);
        appState.setPreview(d === localToday(null) ? null : d);
        router.go(`#/trip/${tid}/now`);
        break;
      }
      case 'stop':
        router.go(`#/trip/${tid}/journey/${encodeURIComponent(r.stopId)}`);
        break;
      case 'spot':
        router.goGuide(trip.id, r.stopId, 'g-eat');
        break;
      case 'todo':
        router.go(`#/trip/${tid}/now/todo`);
        break;
      case 'info':
        router.pendingAnchor = `info-${r.cardId}`;
        router.goPocket(trip.id, 'info');
        break;
      case 'emergency':
        router.goPocket(trip.id, 'emergency');
        break;
      case 'card':
        router.goPocket(trip.id, 'cards');
        break;
      case 'doc':
        router.goPocket(trip.id, 'docs');
        break;
      case 'note':
        router.goPocket(trip.id, 'notes');
        break;
    }
  }

  const GROUP_LABEL: Record<string, string> = {
    booking: S.find.bookings,
    driver: S.find.driverCards,
    phrase: S.find.phrases,
    'today-steps': S.find.todaySteps,
    step: S.find.steps,
    stop: S.find.stops,
    spot: S.find.places,
    task: S.find.todo,
    info: S.find.info,
    emergency: S.find.emergency,
    card: S.find.cards,
    doc: S.find.docs,
    note: S.find.notes,
  };
  const SCOPE_LABEL: Record<FindScope, string> = {
    all: S.find.scope.all,
    bookings: S.find.scope.bookings,
    cards: S.find.scope.cards,
    steps: S.find.scope.steps,
    places: S.find.scope.places,
    more: S.find.scope.more,
  };
  const segs = (t: string | undefined): Seg[] => highlight(t ?? '', query);
  /* an airport code the card itself prints in parentheses — "(PEK)" */
  const codeIn = (t: string): string | null => /\(([A-Z]{3})\)/.exec(t)?.[1] ?? null;
</script>

{#snippet marked(t: string | undefined)}{#each segs(t) as s, i (i)}{#if s.hit}<mark>{s.t}</mark>{:else}{s.t}{/if}{/each}{/snippet}

<div class="find">
  <div class="fsearch wrap" role="search" aria-label={S.find.aria}>
    <div class="ffield">
      <Icon name="search" size={18} stroke={2} />
      <label for="find-q" class="sr-only">{S.find.label}</label>
      <input
        id="find-q"
        type="search"
        bind:this={input}
        bind:value={query}
        placeholder={S.find.placeholder}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
      />
      {#if query}
        <button class="fclear" onclick={() => ((query = ''), input?.focus())} aria-label={S.find.clear}>
          <Icon name="close" size={16} stroke={2} />
        </button>
      {/if}
    </div>
  </div>

  {#if query.trim()}
    <div class="fscopes" role="tablist" aria-label={S.find.scopes}>
      {#each SCOPES as sc (sc)}
        {@const n = results.counts[sc]}
        <button
          role="tab"
          class="fscope"
          class:on={scope === sc}
          class:none={n === 0 && sc !== 'all'}
          aria-selected={scope === sc}
          aria-disabled={n === 0 && sc !== 'all'}
          onclick={() => (scope = sc)}
        >
          {SCOPE_LABEL[sc]} <span class="num fsc-n">{n}</span>
        </button>
      {/each}
    </div>
  {/if}

  <main class="wrap fresults" aria-label={query.trim() ? S.find.resultsFor(query.trim()) : S.find.label}>
    {#if !query.trim()}
      <div class="fempty">
        <Icon name="search" size={26} />
        <p>{S.find.hint}</p>
      </div>
    {:else if total === 0}
      <div class="fempty">
        <p>{S.find.nothing(query.trim())}</p>
      </div>
    {/if}

    <!-- ---------- WATCH OUT — shown first ---------- -->
    {#each results.warnings as w (w.entry.key)}
      {#if w.entry.warning}
        {@const wrong = cardById.get(w.entry.ref.to === 'driver' ? w.entry.ref.cardId : '')}
        {@const ib = w.entry.instead ? bookingById.get(w.entry.instead.bookingId) : undefined}
        {@const ic = w.entry.instead?.cardId ? cardById.get(w.entry.instead.cardId) : undefined}
        {@const wcode = codeIn(w.entry.title)}
        {@const colon = (w.entry.warning ?? '').indexOf(':')}
        <section class="fwarn" aria-label={S.find.warnAria(w.entry.title)}>
          <div class="fw-head">
            <Icon name="alert" size={18} stroke={2} />
            <h2 class="fw-title">{S.find.watchOut}</h2>
            <span class="fw-first">{S.find.shownFirst}</span>
          </div>
          <div class="fw-pair" class:single={!ib}>
            <div class="fw-box wrong">
              <span class="fw-top">
                {#if wcode}<span class="num fw-code struck">{wcode}</span>{/if}
                <span class="fw-not">{S.find.notThis}</span>
              </span>
              <span class="fw-name">{@render marked(w.entry.title)}</span>
              {#if wrong}<span class="fw-zh zh" lang="zh">{@render marked(wrong.native)}</span>{/if}
            </div>
            {#if ib}
              <span class="fw-arrow" aria-hidden="true"><Icon name="arrow-right" size={22} stroke={2.2} /></span>
              <div class="fw-box right">
                <span class="fw-top">
                  <span class="num fw-code">{ib.kind === 'flight' ? ib.from.code : ''}</span>
                  <Icon name="check" size={16} stroke={2.6} />
                </span>
                <span class="fw-name">{@render marked(ib.kind === 'flight' ? `${ib.from.name ?? ib.from.code} · ${ib.flightNo}` : ib.title)}</span>
                {#if ic}<span class="fw-zh zh" lang="zh">{@render marked(ic.native)}</span>{/if}
              </div>
            {/if}
          </div>
          <p class="fw-say">
            {#if colon > 0}<strong>{@render marked(w.entry.warning.slice(0, colon))}</strong> —{@render marked(w.entry.warning.slice(colon + 1))}{:else}{@render marked(w.entry.warning)}{/if}
          </p>
          {#if ic}
            <button class="btn primary lg wfull" onclick={() => openCard(ic.id)}>
              <Icon name="card" size={18} stroke={2} />
              {S.find.showInstead(ib && ib.kind === 'flight' ? ib.from.code : '')}
            </button>
          {:else if ib}
            <button class="btn wfull" onclick={() => router.goPocket(trip.id, ib.id)}>
              <Icon name="ticket" size={17} /> {S.find.openPass(ib.title)}
            </button>
          {/if}
        </section>
      {:else}
        <!-- a critical info card: the trip file's own severity -->
        <button class="fwarn crit-info" onclick={() => open(w)}>
          <span class="fw-head">
            <Icon name="alert" size={18} stroke={2} />
            <span class="fw-title">{@render marked(w.entry.title)}</span>
            <span class="fw-first">{S.find.shownFirst}</span>
          </span>
          {#each w.lines.slice(0, 3) as l, i (i)}<span class="fw-line">{@render marked(l)}</span>{/each}
        </button>
      {/if}
    {/each}

    <!-- ---------- the groups ---------- -->
    {#each results.groups as g (g.kind)}
      <h2 class="caps fgroup">{GROUP_LABEL[g.kind]} · <span class="num">{g.hits.length}</span></h2>
      {#each g.hits as h (h.entry.key)}
        {@const e = h.entry}
        {#if e.kind === 'booking'}
          {@const b = bookingById.get(e.ref.to === 'pass' ? e.ref.bookingId : '')}
          <button class="frow" onclick={() => open(h)}>
            <span class="fr-well" aria-hidden="true"><Icon name={b ? PASS_ICON[passKind(b)] : 'ticket'} size={19} /></span>
            <span class="fr-body">
              <span class="fr-title">{@render marked(e.title)}</span>
              {#if e.sub}<span class="fr-sub">{@render marked(e.sub)}</span>{/if}
              <span class="fr-meta">{#if e.date}<span class="num">{fmtDow(e.date)}</span>{/if}{#if e.status}<StatusChip status={e.status} size="sm" />{/if}</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        {:else if e.kind === 'driver' || e.kind === 'phrase'}
          <button class="frow" onclick={() => open(h)} disabled={!!cardById.get(e.ref.to === 'driver' || e.ref.to === 'phrase' ? e.ref.cardId : '')?.pending}>
            <span class="fr-body">
              <span class="fr-zh zh" lang="zh">{@render marked(e.zh)}</span>
              <span class="fr-sub">{@render marked(e.title)}</span>
            </span>
            <span class="fr-show">{S.find.show}</span>
          </button>
        {:else if e.kind === 'step'}
          <button class="frow" onclick={() => open(h)}>
            <span class="fr-step num" aria-hidden="true">{(e.step?.index ?? 0) + 1}</span>
            <span class="fr-body">
              <span class="fr-caps">
                {S.find.stepOf((e.step?.index ?? 0) + 1, e.step?.total ?? 0)}{#if e.step?.dates.length} · <span class="num">{e.step.dates.includes(now) ? fmtDow(now) : fmtDow(e.step.dates[0] ?? now)}</span>{/if}
              </span>
              <span class="fr-text">{@render marked(e.title)}</span>
              <span class="fr-sub">{e.sub}</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        {:else}
          <button class="frow" onclick={() => open(h)}>
            <span class="fr-well plain" aria-hidden="true">
              <Icon
                name={e.kind === 'stop' || e.kind === 'spot'
                  ? 'pin'
                  : e.kind === 'task'
                    ? 'list'
                    : e.kind === 'emergency'
                      ? 'phone'
                      : e.kind === 'card'
                        ? 'card'
                        : e.kind === 'doc'
                          ? 'doc'
                          : e.kind === 'note'
                            ? 'note'
                            : 'info'}
                size={18}
              />
            </span>
            <span class="fr-body">
              <span class="fr-title">{@render marked(e.title)}</span>
              {#if e.zh}<span class="fr-zh small-zh zh" lang="zh">{@render marked(e.zh)}</span>{/if}
              {#if e.sub}<span class="fr-sub">{@render marked(e.sub)}</span>{/if}
              {#each h.lines.slice(0, 2) as l, i (i)}<span class="fr-line">{@render marked(l)}</span>{/each}
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        {/if}
      {/each}
    {/each}

    <p class="fdevice">
      <Icon name="device" size={14} />
      {S.find.offline}
    </p>
  </main>
</div>

{#if driver}
  <DriverCard cards={driver.list} start={driver.index} suffix={trip.driverSuffix} onclose={() => (driver = null)} />
{/if}

<style>
  .find {
    position: relative;
    padding-top: env(safe-area-inset-top);
  }
  .fsearch {
    display: flex;
    align-items: center;
    padding-top: 12px;
    padding-bottom: 12px;
  }
  .ffield {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 4px 0 16px;
    border-radius: 999px;
    color: var(--sunrise);
    background: var(--card);
    border: 1.5px solid var(--sunrise);
    box-shadow:
      var(--focus-halo),
      0 18px 40px -20px rgba(0, 0, 0, 0.9);
  }
  :root[data-theme='light'] .ffield {
    border-color: var(--route-lit);
    box-shadow:
      0 0 0 4px rgba(255, 159, 107, 0.22),
      0 14px 30px -18px rgba(27, 26, 46, 0.35);
  }
  .ffield input {
    flex: 1;
    min-width: 0;
    height: 44px;
    min-height: 44px;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    box-shadow: none;
    color: var(--ink);
    font-size: 17px;
    font-weight: 500;
  }
  .ffield input::-webkit-search-cancel-button {
    display: none;
  }
  .fclear {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 999px;
    border: none;
    color: var(--ink-2);
    background: var(--card-2);
  }
  .fscopes {
    display: flex;
    gap: 6px;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 var(--gutter) 10px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
    mask-image: linear-gradient(90deg, #000 88%, transparent);
  }
  .fscopes::-webkit-scrollbar {
    display: none;
  }
  .fscope {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  :root[data-theme='light'] .fscope {
    background: var(--card);
    border-color: rgba(27, 26, 46, 0.16);
  }
  .fsc-n {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .fscope.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
  }
  .fscope.on .fsc-n {
    color: var(--on-sunrise);
  }
  .fscope.none {
    color: var(--faint);
    background: transparent;
    border-style: dashed;
  }
  .fresults {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fempty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 12px 10px;
    text-align: center;
    color: var(--ink-2);
  }
  .fempty p {
    margin: 0;
    max-width: 34ch;
    font-size: var(--fs-body);
    line-height: 1.5;
  }

  /* ---------- the warning card ---------- */
  .fwarn {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 26px;
    text-align: left;
    color: var(--ink);
    background:
      linear-gradient(180deg, var(--crit-soft), transparent 70%),
      var(--card);
    border: 1.5px solid color-mix(in srgb, var(--crit) 62%, transparent);
    box-shadow: var(--glow-crit);
    animation: h-rise 500ms var(--ease-out) both;
  }
  .fw-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--crit-ink);
  }
  .fw-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-caps);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--crit-ink);
  }
  .crit-info .fw-title {
    font-size: var(--fs-row);
    letter-spacing: 0;
    text-transform: none;
  }
  .fw-first {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .fw-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr);
    align-items: stretch;
    gap: 6px;
  }
  .fw-pair.single {
    grid-template-columns: 1fr;
  }
  .fw-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 10px 12px;
    border-radius: var(--radius-inner);
  }
  .fw-box.wrong {
    background: color-mix(in srgb, var(--sky) 55%, transparent);
    border: 1px solid var(--crit-line);
  }
  .fw-box.right {
    background: var(--sunrise-soft);
    border: 1.5px solid color-mix(in srgb, var(--sunrise) 70%, transparent);
    box-shadow: 0 0 24px -8px rgba(255, 159, 107, 0.6);
  }
  :root[data-theme='light'] .fw-box.right {
    box-shadow: none;
  }
  .fw-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 24px;
  }
  .fw-box.right .fw-top :global(.hicon) {
    color: var(--ok);
  }
  .fw-code {
    position: relative;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1;
    color: var(--sunrise);
  }
  .fw-code.struck {
    color: var(--faint);
  }
  .fw-code.struck::after {
    content: '';
    position: absolute;
    left: -3px;
    right: -3px;
    top: 50%;
    height: 2.5px;
    margin-top: -1px;
    border-radius: 2px;
    background: var(--crit);
    transform: rotate(-12deg);
  }
  .fw-not {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: var(--fs-caps);
    font-weight: 700;
    color: var(--crit-ink);
    background: var(--crit-soft);
    border: 1px solid var(--crit-line);
  }
  .fw-name {
    font-size: var(--fs-chip);
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .fw-box.right .fw-name {
    color: var(--ink);
  }
  .fw-zh {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .fw-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sunrise);
  }
  .fw-say {
    margin: 0;
    font-size: var(--fs-row);
    line-height: 1.45;
    text-wrap: pretty;
  }
  .fw-say strong {
    font-weight: 700;
    color: var(--crit-ink);
  }
  .fw-line {
    font-size: var(--fs-caption);
    line-height: 1.5;
    color: var(--ink);
  }

  /* ---------- result rows ---------- */
  .fgroup {
    margin: 12px 4px 2px;
    color: var(--faint);
  }
  .frow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 10px 12px 14px;
    border-radius: 22px;
    text-align: left;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    animation: h-rise 500ms var(--ease-out) both;
  }
  .frow:disabled {
    opacity: 0.6;
  }
  .frow > :global(.hicon:last-child) {
    color: var(--faint);
  }
  .fr-well {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: var(--radius-button-sm);
    color: var(--sunrise);
    background: var(--sunrise-soft);
    border: 1px solid color-mix(in srgb, var(--sunrise) 32%, transparent);
  }
  .fr-well.plain {
    color: var(--ink-2);
    background: var(--card-2);
    border-color: var(--line);
  }
  .fr-step {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    font-size: var(--fs-code);
    font-weight: 600;
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border: 1.5px solid var(--lilac-line);
  }
  .fr-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .fr-title {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .fr-text {
    font-size: var(--fs-label);
    line-height: 1.4;
  }
  .fr-caps {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .fr-sub {
    font-size: var(--fs-caption);
    line-height: 1.35;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .fr-line {
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink);
  }
  .fr-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .fr-zh {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.3;
  }
  .fr-zh.small-zh {
    font-size: var(--fs-label);
    font-weight: 500;
  }
  .fr-show {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .fdevice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 14px 0 0;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
</style>

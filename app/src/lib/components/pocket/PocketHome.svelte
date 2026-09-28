<script lang="ts">
  /* THE POCKET (f-pocket) — everything you show someone or need in one tap,
     offline. Today's code first, on the one opal card; then the driver cards
     (white = for other eyes); the wallet as four tickets; the money; and a
     bento of the rest — phrases, the converter, the visa, emergency numbers,
     documents, packing, health, the trip's own notes, the clocks.

     Every tile answers from the trip file and opens its full screen; a tile
     with nothing to say is not drawn. */
  import type {
    Booking,
    ComplianceCounter,
    DayDefault,
    DayPlan,
    DocumentFile,
    EmergencyContact,
    Expense,
    InfoCard,
    ISODate,
    PackingItem,
    ShowCard,
    Stop,
    Trip,
    TripNote,
    WalletCard,
  } from '../../model/types';
  import { db } from '../../db/db';
  import { live } from '../../data/live.svelte';
  import { nextCommitment } from '../../logic/commitment';
  import { resolveDay } from '../../logic/day';
  import { buildBooked } from '../../logic/booked';
  import { fmtMoneyWide, sumMinor, symbolFor } from '../../logic/money';
  import { isRateEdits, rateSources, type RateEdits } from '../../logic/convert';
  import { buildHealth, hasHealth } from '../../logic/health';
  import { mdliteToText } from '../../logic/mdlite';
  import { clockIn, fmtDow } from '../../logic/dates';
  import { bookingLine, codeGroups, passKind, walletSectionOf, warningLine, whenWord } from '../../logic/pass';
  import { docsSummary, driverChips, emergencyPreview, visaPreview } from '../../logic/pocket';
  import { copyText } from '../../state/toast.svelte';
  import { appState } from '../../state/appState.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import StatusChip from '../horizon/StatusChip.svelte';
  import PaperChip from '../horizon/PaperChip.svelte';

  let {
    trip,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    bookings,
    cards,
    expenses,
    documents,
    infoCards,
    emergency,
    showCards,
    packing,
    note,
    now,
    oncounter,
    ondriver,
  }: {
    trip: Trip;
    counters: ComplianceCounter[];
    stops: Stop[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    bookings: Booking[];
    cards: WalletCard[];
    expenses: Expense[];
    documents: DocumentFile[];
    infoCards: InfoCard[];
    emergency: EmergencyContact[];
    showCards: ShowCard[];
    packing: PackingItem[];
    note?: TripNote;
    now: ISODate;
    oncounter: (b: Booking) => void;
    ondriver: (list: ShowCard[], index: number) => void;
  } = $props();

  const base = $derived(`#/trip/${encodeURIComponent(trip.id)}/pocket`);
  const to = (s: string): string => `${base}/${encodeURIComponent(s)}`;

  /* ---------- TODAY: the next thing you have to be at, and its code ---------- */
  const next = $derived(nextCommitment(bookings, now));
  const nb = $derived(next?.booking ?? null);
  const nextWhen = $derived(next ? whenWord(next.date, now) : null);
  const nextKind = $derived(nb ? passKind(nb) : null);
  const nextTitle = $derived(
    nb ? (nb.kind === 'flight' ? `${nb.carrier} · ${nb.flightNo}` : mdliteToText(nb.title)) : '',
  );
  const nextWarn = $derived(nb ? warningLine(nb.note) : null);

  /* ---------- the driver ---------- */
  const places = $derived(showCards.filter((c) => c.kind === 'place' && !c.pending).sort((a, b) => a.order - b.order));
  const day = $derived(resolveDay(now, dayPlans, dayDefaults, stops));
  const chips = $derived(driverChips(showCards, day?.placeIds));

  /* ---------- the wallet ---------- */
  const live_ = (b: Booking): boolean => b.status !== 'cancelled';
  const counts = $derived({
    travel: bookings.filter((b) => live_(b) && walletSectionOf(b) === 'travel').length,
    stays: bookings.filter((b) => live_(b) && walletSectionOf(b) === 'stays').length,
    experiences: bookings.filter((b) => live_(b) && walletSectionOf(b) === 'experiences').length,
  });

  /* ---------- money ---------- */
  const sym = $derived(symbolFor(trip, trip.homeCurrency));
  const loggedMinor = $derived(sumMinor(expenses));
  const committedMinor = $derived(
    buildBooked(trip, bookings, stops, {
      flights: S.money.flights,
      travel: S.money.travel,
      stays: S.money.stays,
      docs: S.money.fromDocs,
      experiences: S.money.experiences,
      alternatives: S.money.orInstead,
    }).total.maxMinor,
  );
  const budget = $derived(trip.budgetTotalMinor ?? 0);
  const loggedPct = $derived(budget > 0 ? Math.min(100, Math.round((loggedMinor / budget) * 100)) : 0);
  const committedPct = $derived(budget > 0 ? Math.min(100, Math.round((committedMinor / budget) * 100)) : 0);

  /* ---------- the bento ---------- */
  const phrases = $derived(showCards.filter((c) => c.kind === 'phrase').sort((a, b) => a.order - b.order));
  const firstPhrase = $derived(phrases[0]);
  const editsLive = live(() => db.meta.get('convert.rates'));
  const edits = $derived.by<RateEdits>(() => {
    const v = editsLive.current?.value;
    return isRateEdits(v) ? v : {};
  });
  const rates = $derived(rateSources(trip, expenses, edits));
  const homeRate = $derived(rates.find((r) => r.code === trip.homeCurrency));
  const others = $derived(rates.filter((r) => r.code !== trip.homeCurrency));
  /* units of the other currency per ONE home unit, as the tile prints it */
  const per = (r: { rateToHome: number }): string => {
    const v = r.rateToHome / (homeRate?.rateToHome ?? 1);
    return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : String(Math.round(v * 100) / 100);
  };
  const pinned = $derived(counters.find((c) => c.pinned) ?? counters[0]);
  const visa = $derived(visaPreview(pinned, now));
  const sos = $derived(emergencyPreview(emergency));
  const files = $derived(documents.filter((d) => d.tag !== 'photo').sort((a, b) => b.addedAt - a.addedAt));
  const docsLine = $derived(docsSummary(documents));
  const packed = $derived(packing.filter((p) => p.done).length);
  const health = $derived(buildHealth({ walletCards: cards, emergency, infoCards, documents }));
  const firstInfo = $derived([...infoCards].sort((a, b) => a.order - b.order)[0]);
  const noteLine = $derived(note?.text ? mdliteToText(note.text).split('\n').find((l) => l.trim()) ?? '' : '');

  /* the clocks tile reads live times; a 30 s tick is plenty for HH:MM */
  let tick = $state(Date.now());
  $effect(() => {
    if (!trip.clocks.length) return;
    const id = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const clocks = $derived(trip.clocks.slice(0, 3).map((c) => ({ label: c.label, time: clockIn(c.timeZone, new Date(tick)) })));

  function openChip(c: ShowCard): void {
    ondriver(places, Math.max(0, places.findIndex((p) => p.id === c.id)));
  }
</script>

<main class="pocket">
  <span class="skytop" aria-hidden="true"></span>
  <span class="dots" aria-hidden="true"></span>

  <header class="pk-head wrap">
    <div class="pk-titles">
      <h1 class="display pk-title">{S.nav.pocket}</h1>
      <span class="caps pk-sub">{S.pocket.subtitle}</span>
    </div>
    {#if emergency.length}
      <a class="pk-sos" href={to('emergency')}>
        <Icon name="phone" size={16} stroke={1.9} />
        {S.pocket.emergency}
      </a>
    {/if}
  </header>
  <!-- The Pocket is the screen read standing still with no signal, so it
       says when that is the case — quietly: offline is this trip's normal. -->
  {#if appState.offline}
    <div class="wrap pk-off"><span class="offchip"><Icon name="cloud" size={14} /> {S.system.offlineQuiet}</span></div>
  {/if}

  <div class="wrap pk-body">
    <!-- ---------- TODAY ---------- -->
    {#if nb && nextWhen && nextKind}
      <section class="today opal-edge" aria-label={S.pocket.todayAria(nextTitle)}>
        <div class="td-head">
          <Icon name="sun" size={16} stroke={2} />
          <span class="td-caps">{S.pocket.whenCaps(nextWhen.word, fmtDow(nextWhen.date), S.pocket.kindWord[nextKind])}</span>
          <StatusChip status={nb.status} />
        </div>
        <a class="td-main" href={to(nb.id)}>
          <span class="td-text">
            <span class="display td-title">{nextTitle}</span>
            <span class="num td-line">{bookingLine(nb)}</span>
            {#if nextWarn}
              <span class="td-warn"><Icon name="alert" size={13} stroke={2} />{nextWarn}</span>
            {/if}
          </span>
          <Icon name="chevron-right" size={18} />
        </a>
        {#if nb.code}
          <div class="td-code">
            <span class="td-codetext">
              <span class="td-codelabel">{nb.codeLabel ?? S.pass.bookingNo}</span>
              <span class="num td-codeval">{#each codeGroups(nb.code) as g, i (i)}<span class="grp">{g}</span>{/each}</span>
            </span>
            <button class="td-copy" onclick={() => copyText(nb.code ?? '', nb.codeLabel ?? '')} aria-label={S.pass.copyCode}>
              <Icon name="copy" size={17} />
            </button>
          </div>
        {/if}
        <div class="td-acts" class:one={!nb.code}>
          {#if nb.code}
            <button class="btn primary" onclick={() => oncounter(nb)}>
              <Icon name="counter" size={18} stroke={2} />
              {S.pocket.counterMode}
            </button>
          {/if}
          <a class="btn" href={to(nb.id)}><Icon name="ticket" size={17} /> {S.pocket.pass}</a>
        </div>
      </section>
    {/if}

    <!-- ---------- SHOW THE DRIVER ---------- -->
    {#if chips.length}
      <section class="pk-sec" aria-label={S.pocket.driverTitle}>
        <a class="sec-head" href={to('driver')}>
          <span class="caps sec-name">{S.pocket.driverTitle}</span>
          <span class="sec-count">· {S.pocket.cardsCount(places.length)}</span>
          <span class="sec-fill"></span>
          <span class="sec-hint"><span class="whitekey" aria-hidden="true"></span>{S.pocket.whiteHint}</span>
        </a>
        <div class="chips3">
          {#each chips as c (c.id)}
            <PaperChip
              native={c.native}
              english={c.meaning.split(' — ')[0] ?? c.meaning}
              label={S.pocket.driverChip(c.meaning)}
              onopen={() => openChip(c)}
            />
          {/each}
        </div>
      </section>
    {/if}

    <!-- ---------- WALLET ---------- -->
    <section class="pk-sec" aria-label={S.pocket.walletTitle}>
      <div class="sec-head static">
        <span class="caps sec-name">{S.pocket.walletTitle}</span>
        <span class="sec-count">· {S.pocket.walletHint}</span>
      </div>
      <div class="tickets">
        <a class="ticket t-travel" href={to('travel')} aria-label={S.pocket.ticketAria(S.wallet.travel, counts.travel)}>
          <span class="tk-bar" aria-hidden="true"></span><span class="tk-notch l" aria-hidden="true"></span><span class="tk-notch r" aria-hidden="true"></span>
          <span class="tk-ic"><Icon name="plane" size={16} /></span>
          <span class="tk-txt"><span class="num tk-n">{counts.travel}</span><span class="tk-l">{S.wallet.travel}</span></span>
        </a>
        <a class="ticket t-stays" href={to('stays')} aria-label={S.pocket.ticketAria(S.wallet.stays, counts.stays)}>
          <span class="tk-bar" aria-hidden="true"></span><span class="tk-notch l" aria-hidden="true"></span><span class="tk-notch r" aria-hidden="true"></span>
          <span class="tk-ic"><Icon name="bed" size={16} /></span>
          <span class="tk-txt"><span class="num tk-n">{counts.stays}</span><span class="tk-l">{S.wallet.stays}</span></span>
        </a>
        <a class="ticket t-exp" href={to('experiences')} aria-label={S.pocket.ticketAria(S.wallet.experiences, counts.experiences)}>
          <span class="tk-bar" aria-hidden="true"></span><span class="tk-notch l" aria-hidden="true"></span><span class="tk-notch r" aria-hidden="true"></span>
          <span class="tk-ic"><Icon name="ticket" size={16} /></span>
          <span class="tk-txt"><span class="num tk-n">{counts.experiences}</span><span class="tk-l tight">{S.wallet.experiences}</span></span>
        </a>
        <a class="ticket t-cards" href={to('cards')} aria-label={S.pocket.ticketAria(S.wallet.cards, cards.length)}>
          <span class="tk-bar" aria-hidden="true"></span><span class="tk-notch l" aria-hidden="true"></span><span class="tk-notch r" aria-hidden="true"></span>
          <span class="tk-ic"><Icon name="card" size={16} /></span>
          <span class="tk-txt"><span class="num tk-n">{cards.length}</span><span class="tk-l">{S.wallet.cards}</span></span>
        </a>
      </div>

      <!-- ---------- MONEY ---------- -->
      <a class="money" href={to('money')} aria-label={S.pocket.moneyAria(fmtMoneyWide(loggedMinor, sym))}>
        <span class="mo-top">
          <span class="mo-ic" aria-hidden="true"><Icon name="coins" size={17} /></span>
          <span class="caps mo-cap">{S.wallet.money}</span>
          <span class="mo-fill"></span>
          <span class="mo-log">{S.pocket.logSpend} <Icon name="chevron-right" size={16} /></span>
        </span>
        <span class="mo-figs">
          <span class="num mo-big">{fmtMoneyWide(loggedMinor, sym)}</span>
          <span class="mo-of">{S.wallet.totalSpent.toLowerCase()}{#if budget} · {S.money.ofBudget(fmtMoneyWide(budget, sym))}{/if}</span>
        </span>
        {#if budget}
          <span class="mo-meter" aria-hidden="true">
            <i class="mo-c" style="width:{committedPct}%"></i>
            <i class="mo-l" style="width:{loggedPct}%"></i>
          </span>
          <span class="mo-key">
            <span><i class="k-l" aria-hidden="true"></i>{S.pocket.logged}</span>
            <span><i class="k-c" aria-hidden="true"></i>{S.money.committedBeside(fmtMoneyWide(committedMinor, sym))}</span>
          </span>
        {/if}
      </a>
    </section>

    <!-- ---------- MORE IN THE POCKET ---------- -->
    <section class="bento" aria-label={S.pocket.moreAria}>
      {#if firstPhrase}
        <a class="tile" href={to('phrases')} aria-label={S.pocket.phrasesAria(phrases.length, firstPhrase.meaning)}>
          <span class="tl-top"><span class="tl-name">{S.info.phrases}</span><span class="num tl-count">{phrases.length}</span></span>
          <span class="zh tl-zh" lang="zh">{firstPhrase.native}</span>
          <span class="tl-sub">{firstPhrase.meaning.split(' — ')[0]}</span>
        </a>
      {/if}
      {#if others.length && homeRate}
        {@const lead = others[0]}
        {#if lead}
          <a class="tile" href={to('convert')} aria-label={S.pocket.convertAria}>
            <span class="tl-name">{S.convert.title}</span>
            <span class="num tl-rate">{homeRate.symbol}1 = {lead.symbol}{per(lead)}</span>
            <span class="tl-sub">{others.slice(1, 4).map((r) => `${r.symbol}${per(r)}`).join(' · ') || S.pocket.fromTrip}</span>
          </a>
        {/if}
      {/if}
      {#if visa}
        <a class="tile" href={to('visa')} aria-label={S.pocket.visaAria(visa.name, visa.value, visa.line)}>
          <span class="tl-top"><span class="tl-name">{S.pocket.visa}</span><span class="num tl-val {visa.tone}">{visa.value}</span></span>
          <span class="tl-bar" aria-hidden="true"><i style="width:{visa.pct}%"></i></span>
          <span class="tl-strong {visa.tone}">{visa.line}</span>
        </a>
      {/if}
      {#if sos}
        <a class="tile sos" href={to('emergency')} aria-label={S.pocket.sosAria(sos.lines.join(', '))}>
          <span class="tl-name sos-name">{S.pocket.emergency}</span>
          <span class="num sos-nums">{#each sos.lines as l, i (i)}<span>{l}</span>{/each}</span>
          <span class="tl-sub">{sos.more ? S.pocket.more(sos.more) : S.pocket.dial}</span>
        </a>
      {/if}
      {#if documents.length}
        <a class="tile" href={to('docs')} aria-label={S.pocket.docsAria(documents.length)}>
          <span class="tl-top"><span class="tl-name">{S.pocket.documents}</span><span class="num tl-count">{documents.length}</span></span>
          <span class="tl-strong">{files[0]?.name.split(' — ')[0] ?? S.pocket.photos}</span>
          <span class="tl-sub">{docsLine}</span>
        </a>
      {/if}
      {#if packing.length}
        <a class="tile" href="#/trip/{encodeURIComponent(trip.id)}/now/todo/packing" aria-label={S.pocket.packingAria(packing.length, packed)}>
          <span class="tl-name">{S.lists.packing}</span>
          <span class="num tl-big">{packing.length}</span>
          <span class="tl-sub">{packed ? S.pocket.packed(packed) : S.pocket.onTheList}</span>
        </a>
      {/if}
      {#if hasHealth(health)}
        <a class="tile" href={to('health')} aria-label={S.health.title}>
          <span class="tl-name">{S.pocket.health}</span>
          <span class="tl-ic"><Icon name="heart" size={20} /></span>
          <span class="tl-sub">{health.policies[0] ? mdliteToText(health.policies[0].title).split(' — ')[0] : S.pocket.healthSub}</span>
        </a>
      {/if}
      {#if firstInfo}
        <a class="tile" href={to('info')} aria-label={S.pocket.infoAria(infoCards.length)}>
          <span class="tl-top"><span class="tl-name">{S.pocket.goodToKnow}</span><span class="num tl-count">{infoCards.length}</span></span>
          <span class="tl-strong clamp2">{mdliteToText(firstInfo.heading)}</span>
        </a>
      {/if}
      {#if clocks.length}
        <a class="tile" href={to('clocks')} aria-label={S.info.clocks}>
          <span class="tl-name">{S.info.clocks}</span>
          <span class="tl-clocks">
            {#each clocks as c (c.label)}<span class="tl-clock"><span class="num">{c.time}</span> <span class="tl-cl">{c.label}</span></span>{/each}
          </span>
        </a>
      {/if}
      {#if noteLine}
        <a class="tile" href={to('notes')} aria-label={S.info.notes}>
          <span class="tl-name">{S.info.notes}</span>
          <span class="tl-strong clamp2">{noteLine}</span>
        </a>
      {/if}
    </section>
  </div>
</main>

<style>
  .pocket {
    position: relative;
    padding-top: calc(env(safe-area-inset-top) + 4px);
  }
  /* the sunrise glow and dot grid the Pocket board carries at its top */
  .skytop {
    position: absolute;
    left: -80px;
    right: -80px;
    top: -150px;
    height: 300px;
    border-radius: 50%;
    background: var(--sky-glow-top);
    pointer-events: none;
    z-index: -1;
  }
  .dots {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 120px;
    background-image: var(--dot-grid);
    background-size: 22px 22px;
    -webkit-mask-image: linear-gradient(180deg, #000 20%, transparent 100%);
    mask-image: linear-gradient(180deg, #000 20%, transparent 100%);
    pointer-events: none;
    z-index: -1;
  }
  .pk-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 12px;
    padding-left: 20px;
  }
  .pk-titles {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pk-title {
    margin: 0;
    font-size: var(--fs-screen);
    font-weight: 600;
    line-height: 1.05;
  }
  .pk-sub {
    color: var(--ink-2);
  }
  .pk-sos {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    text-decoration: none;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--crit-ink);
    background: var(--crit-soft);
    border: 1px solid color-mix(in srgb, var(--crit) 45%, transparent);
  }
  :root[data-theme='light'] .pk-sos {
    font-weight: 700;
  }
  .pk-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 14px;
  }

  /* ---------- TODAY, on the one opal edge ---------- */
  .today {
    --opal-fill: var(--card);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: var(--radius-card);
  }
  .td-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--sunrise);
  }
  .pk-off {
    margin-top: -4px;
  }
  .td-caps {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--sunrise);
  }
  :root[data-theme='light'] .td-caps {
    font-weight: 700;
  }
  .td-main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    text-decoration: none;
    color: var(--ink);
  }
  .td-main > :global(.hicon) {
    color: var(--faint);
  }
  .td-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .td-title {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .td-line {
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .td-warn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--warn-ink);
  }
  :root[data-theme='light'] .td-warn {
    font-weight: 700;
  }
  .td-code {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 16px;
    border-radius: var(--radius-inner);
    background: var(--sky);
    border: 1px solid var(--line);
  }
  :root[data-theme='light'] .td-code {
    background: var(--card-2);
  }
  .td-codetext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .td-codelabel {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  :root[data-theme='light'] .td-codelabel {
    color: var(--ink-2);
  }
  .td-codeval {
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.45em;
    font-size: var(--fs-code-lg);
    font-weight: 500;
    letter-spacing: 0.04em;
  }
  .td-copy {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: var(--radius-button-sm);
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  :root[data-theme='light'] .td-copy {
    background: var(--card);
    border-color: rgba(27, 26, 46, 0.14);
    box-shadow: 0 6px 14px -10px rgba(27, 26, 46, 0.4);
  }
  .td-acts {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 8px;
  }
  .td-acts.one {
    grid-template-columns: 1fr;
  }
  .td-acts .btn {
    min-height: 48px;
  }

  /* ---------- section heads ---------- */
  .pk-sec {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin: -12px 0 -12px;
    padding-left: 4px;
    text-decoration: none;
    color: var(--ink);
  }
  .sec-head.static {
    min-height: 18px;
    margin: 0;
  }
  .sec-name {
    color: var(--ink);
  }
  :root[data-theme='light'] .sec-name {
    font-weight: 700;
  }
  .sec-count {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .sec-fill {
    flex: 1;
  }
  .sec-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  :root[data-theme='light'] .sec-hint {
    color: var(--ink-2);
  }
  .whitekey {
    display: none;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--paper-chip);
    border: 1.5px solid var(--ink);
    box-shadow: 1.5px 1.5px 0 var(--ink);
  }
  :root[data-theme='light'] .whitekey {
    display: inline-block;
  }
  .chips3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  :root[data-theme='light'] .chips3 {
    gap: 10px;
  }

  /* ---------- the wallet as four tickets ---------- */
  .tickets {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .ticket {
    --tk: var(--sunrise);
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 88px;
    padding: 12px 10px 10px;
    border-radius: var(--radius-inner);
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  .t-stays {
    --tk: var(--lilac);
  }
  .t-exp {
    --tk: var(--aqua);
  }
  .t-cards {
    --tk: var(--ink-2);
  }
  .tk-bar {
    position: absolute;
    left: 10px;
    right: 10px;
    top: 0;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: var(--tk);
    box-shadow: 0 0 10px color-mix(in srgb, var(--tk) 70%, transparent);
  }
  :root[data-theme='light'] .tk-bar {
    box-shadow: none;
  }
  .tk-notch {
    position: absolute;
    top: 52px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--sky);
  }
  .tk-notch.l {
    left: -6px;
  }
  .tk-notch.r {
    right: -6px;
  }
  .tk-ic {
    display: flex;
    color: var(--tk);
  }
  .tk-txt {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tk-n {
    font-size: 20px;
    font-weight: 500;
    line-height: 1;
  }
  .tk-l {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tk-l.tight {
    letter-spacing: -0.01em;
  }

  /* ---------- money ---------- */
  .money {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 14px 14px 16px;
    border-radius: var(--radius-tile);
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .mo-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mo-ic {
    display: flex;
    color: var(--sunrise);
  }
  .mo-cap {
    color: var(--ink);
  }
  .mo-fill {
    flex: 1;
  }
  .mo-log {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--sunrise);
  }
  .mo-figs {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .mo-big {
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1;
  }
  .mo-of {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .mo-meter {
    position: relative;
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .mo-meter i {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 3px;
  }
  .mo-c {
    background: var(--lilac-line);
  }
  .mo-l {
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2));
  }
  .mo-key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .mo-key span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .mo-key i {
    width: 10px;
    height: 4px;
    border-radius: 2px;
  }
  .k-l {
    background: var(--opal-2);
  }
  .k-c {
    background: var(--lilac-line);
  }

  /* ---------- the bento ---------- */
  .bento {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
    min-height: 96px;
    padding: 11px 12px;
    border-radius: 20px;
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  .tl-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .tl-name {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
  }
  .tl-count {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .tl-zh {
    font-size: var(--fs-body);
    font-weight: 700;
    line-height: 1.2;
  }
  .tl-sub {
    font-size: var(--fs-chip);
    line-height: 1.25;
    color: var(--ink-2);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .tl-rate {
    font-size: var(--fs-body);
    font-weight: 500;
    line-height: 1.1;
    color: var(--sunrise);
  }
  .tl-val {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .tl-val.warn,
  .tl-strong.warn {
    color: var(--warn-ink);
  }
  .tl-val.crit,
  .tl-strong.crit {
    color: var(--crit-ink);
  }
  .tl-bar {
    position: relative;
    display: block;
    height: 5px;
    border-radius: 3px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .tl-bar i {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2), var(--opal-3));
  }
  .tl-strong {
    font-size: var(--fs-caption);
    font-weight: 600;
    line-height: 1.2;
  }
  .clamp2 {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .tl-big {
    font-size: var(--fs-screen-title);
    font-weight: 500;
    line-height: 1;
  }
  .tl-ic {
    display: flex;
    color: var(--crit);
  }
  .tile.sos {
    background:
      linear-gradient(180deg, var(--crit-soft), transparent),
      var(--card);
    border-color: color-mix(in srgb, var(--crit) 42%, transparent);
  }
  .sos-name {
    color: var(--crit-ink);
  }
  .sos-nums {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.15;
  }
  .tl-clocks {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tl-clock {
    font-size: var(--fs-chip);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tl-clock .num {
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
  }
</style>

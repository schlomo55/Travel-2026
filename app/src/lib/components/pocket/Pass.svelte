<script lang="ts">
  /* THE PASS (f-pass, system/components/Pass) — one booking, the most
     precious object in the Pocket: where it goes and when, the warning the
     trip file puts first, what is allowed and what changed, and — past the
     perforation — the code, printed in full and copied with one tap, with
     Counter mode one tap away.

     Every kind of booking gets a pass: a flight (the board), a train or a
     road leg (its two ends, with the stations it can open or the reason it
     cannot), a stay (check-in, check-out, nights) and a ticket (venue, time).
     A booking that is not booked is drawn UNLIT — a dashed amber edge, no
     opal, no Flow — so a pending ticket can never pass for a held one.

     `id="bk-<booking id>"` wraps the whole screen: it is the name every deep
     link and the dress rehearsal use for "this booking's card". */
  import type { Booking, DocumentFile, ISODate } from '../../model/types';
  import {
    codeGroups,
    legState,
    momentOf,
    PASS_ICON,
    passKind,
    passTitle,
    warningLine,
  } from '../../logic/pass';
  import { countdownLabel } from '../../logic/commitment';
  import { shortPlaceName } from '../../logic/places';
  import { daysBetween, fmtDow, fmtLong } from '../../logic/dates';
  import { arrivalInOriginTime, fmtShift, zoneShiftMinutes } from '../../logic/zones';
  import { minute } from '../../state/minute.svelte';
  import { copyText } from '../../state/toast.svelte';
  import { handOffDocument } from '../../data/documents';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import StatusChip from '../horizon/StatusChip.svelte';
  import MapButtons from '../ui/MapButtons.svelte';
  import ShowOnMap from '../map/ShowOnMap.svelte';
  import { bookingOnMap } from '../../logic/mapdrawn';
  import Md from '../ui/Md.svelte';
  import PassScene from './PassScene.svelte';
  import { offscreen } from '../../motion/offscreen';

  let {
    booking,
    documents = [],
    now,
    isNext = false,
    editing = false,
    oncounter,
    onedit,
  }: {
    booking: Booking;
    /** The documents attached to this booking (its e-ticket, its order). */
    documents?: DocumentFile[];
    now: ISODate;
    /** This is the next thing you have to be at — the arc Flows. */
    isNext?: boolean;
    editing?: boolean;
    oncounter: () => void;
    onedit: () => void;
  } = $props();

  $effect(() => minute.watch());

  const kind = $derived(passKind(booking));
  const head = $derived(passTitle(booking));
  const warning = $derived(warningLine(booking.note));
  const leg = $derived(legState(booking, now, isNext));
  const lit = $derived(booking.status === 'booked');
  const groups = $derived(booking.code ? codeGroups(booking.code) : []);

  /* WHEN IT HAPPENS, as the booking states it — and a countdown only where
     there is something ahead to count down to. */
  const startDate = $derived(booking.kind === 'hotel' ? booking.checkIn : booking.date);
  const startTime = $derived.by(() => {
    if (booking.kind === 'activity') return booking.time ?? null;
    return 'dep' in booking && booking.dep ? booking.dep : null;
  });
  const countdown = $derived(countdownLabel(startDate, startTime, momentOf(now, new Date(minute.t))));
  const countWord = $derived(
    kind === 'stay' ? S.pass.checkIn : kind === 'ticket' ? S.pass.starts : S.pass.departs,
  );

  /* two clocks, only where the trip's own figures prove there are two */
  const zoneBack = $derived(booking.kind === 'flight' ? arrivalInOriginTime(booking) : null);
  const zoneLabel = $derived(booking.kind === 'flight' ? fmtShift(zoneShiftMinutes(booking)) : null);

  const ends = $derived(
    booking.kind === 'train' || (booking.kind === 'other' && booking.from && booking.to)
      ? [
          { side: S.money.railFrom, end: booking.from },
          { side: S.money.railTo, end: booking.to },
        ]
      : [],
  );

  const mapName = $derived(
    booking.kind === 'flight' ? [booking.from.code, booking.from.name].filter(Boolean).join(' · ') : booking.title,
  );
  const gmailUrl = $derived(
    booking.gmailQuery ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(booking.gmailQuery)}` : null,
  );
  const nights = $derived(booking.kind === 'hotel' ? daysBetween(booking.checkIn, booking.checkOut) : 0);
  const priceLine = $derived(
    booking.priceNote ? (booking.kind === 'flight' ? S.pass.fare(booking.priceNote) : booking.priceNote) : null,
  );
  const aria = $derived(
    /* the ends in full here, where the screen shows them short */
    `${head.caps} ${head.title}${booking.kind === 'flight' ? `, ${booking.from.name ?? booking.from.code} → ${booking.to.name ?? booking.to.code}` : ''}, ${fmtLong(startDate)}, ${S.chip[booking.status]}`,
  );
</script>

<div class="passwrap" id="bk-{booking.id}">
  <article class="pass" class:opal-edge={lit} class:unlit={!lit} aria-label={aria} use:offscreen>
    <div class="ps-top">
      <div class="ps-head">
        <div class="ps-titles">
          <span class="ps-caps">{head.caps}</span>
          <span class="display ps-title" class:long={head.title.length > 14}>{head.title}</span>
        </div>
        <StatusChip status={booking.status} extra="tk-stamp" />
      </div>

      {#if kind === 'flight' || kind === 'train' || kind === 'road'}
        <PassScene
          state={leg}
          glyph={PASS_ICON[kind]}
          dep={'dep' in booking ? booking.dep : undefined}
          arr={booking.kind === 'flight'
            ? `${booking.arr}${booking.arrDayOffset ? ` +${booking.arrDayOffset}` : ''}`
            : 'arr' in booking
              ? booking.arr
              : undefined}
          duration={'duration' in booking ? booking.duration : undefined}
        />
      {/if}

      {#if booking.kind === 'flight'}
        <!-- The two codes and the day on one row, the airports' names under
             them (short — the codes say "airport"): a long name never
             squeezes the date between the codes. A phone too narrow for the
             row takes the date under the names. -->
        <div class="ps-ends air">
          <span class="display pe-code">{booking.from.code}</span>
          <span class="pe-date num">{fmtDow(booking.date)}</span>
          <span class="display pe-code">{booking.to.code}</span>
          <span class="pe-names"><span>{shortPlaceName(booking.from.name ?? '', true)}</span><span>{shortPlaceName(booking.to.name ?? '', true)}</span></span>
        </div>
      {:else if booking.kind === 'train' || booking.kind === 'other'}
        {#if booking.from && booking.to}
          <!-- two ends in words: they take the row, the day goes under them -->
          <div class="ps-ends words">
            <span class="pe-names"><span class="pe-word">{booking.from.name}</span><span class="pe-word">{booking.to.name}</span></span>
            <span class="pe-date num">{fmtDow(booking.date)}</span>
          </div>
        {:else}
          <div class="ps-when num">{fmtDow(booking.date)}</div>
        {/if}
      {:else if booking.kind === 'hotel'}
        <div class="ps-stay">
          <div class="st">
            <span class="ps-k">{S.pass.checkInLabel}</span>
            <span class="display st-date">{fmtDow(booking.checkIn)}</span>
          </div>
          <div class="st-n">
            <Icon name="moon" size={16} />
            <span class="num">{S.money.nights(nights)}</span>
          </div>
          <div class="st right">
            <span class="ps-k">{S.pass.checkOutLabel}</span>
            <span class="display st-date">{fmtDow(booking.checkOut)}</span>
          </div>
        </div>
      {:else if booking.kind === 'activity'}
        <div class="ps-venue">
          {#if booking.venue}<span class="pv-venue">{booking.venue}</span>{/if}
          <span class="num pv-when">{fmtDow(booking.date)}{#if booking.time} · {booking.time}{/if}</span>
        </div>
      {/if}

      {#if countdown}
        <div class="ps-count">
          <Icon name="sun" size={16} stroke={2} />
          <span>{countWord} <b class="num">{countdown}</b></span>
        </div>
      {/if}

      {#if warning}
        <div class="ps-warn" role="note">
          <Icon name="alert" size={17} />
          <span>{warning}</span>
        </div>
      {/if}

      {#if zoneBack}
        <div class="ps-zone">
          <Icon name="clock" size={16} />
          <span>{S.wallet.zoneBoth(booking.kind === 'flight' ? booking.arr : '', zoneBack, booking.kind === 'flight' ? booking.from.code : '', zoneLabel ?? '')}</span>
        </div>
      {/if}

      {#if ends.length}
        <!-- A rail or road leg's two ends: the stations it can open, or on its
             face the reason it cannot — an end the documents never named. -->
        <div class="stations">
          {#each ends as e (e.side)}
            <div class="stn">
              <span class="side">{e.side}</span>
              {#if e.end?.stations?.length}
                {#each e.end.stations as st (st.name)}
                  <span class="stnchip">
                    <span class="scn">{st.name}</span>
                    <MapButtons coord={st.coord} name={st.name} query={st.mapQuery} address={st.address} city={st.mapCity} compact />
                  </span>
                {/each}
              {:else}
                <span class="nostn">{e.end?.why ?? ''}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if priceLine}<div class="row dim ps-price num">{priceLine}</div>{/if}

      {#if booking.meta.length}
        <div class="meta">
          {#each booking.meta as m, i (i)}
            <span class="m" class:wide={m.v.length > 20 || m.k.length > 16}>
              <span class="k">{m.k}</span>
              <span class="v" class:warn={m.warn}>{m.v}</span>
            </span>
          {/each}
        </div>
      {/if}

      {#if booking.note}
        <div class="note" class:alert={booking.alert}><Md text={booking.note} as="div" /></div>
      {/if}
    </div>

    {#if booking.code}
      <div class="ps-perf" aria-hidden="true"><span class="n l"></span><span class="dash"></span><span class="n r"></span></div>
      <div class="ps-bottom">
        <!-- The code leaves the pass's own surface: this is the string read
             out at a counter at 22:00 on 8 % battery. In full, in fours. -->
        <div class="codestrip">
          <div class="cs-main">
            <span class="cs-label">{booking.codeLabel ?? S.pass.bookingNo}</span>
            <button class="code num" onclick={() => copyText(booking.code ?? '', booking.codeLabel ?? '')}>
              {#each groups as g, i (i)}<span class="grp">{g}</span>{/each}
            </button>
          </div>
          <button class="cs-copy" onclick={() => copyText(booking.code ?? '', booking.codeLabel ?? '')} aria-label={S.pass.copyCode}>
            <Icon name="copy" size={17} />
          </button>
          {#if booking.codeSub}
            <!-- Secondary means SMALLER: the desk must be read the big string. -->
            <button class="codesub num" onclick={() => copyText(booking.codeSub ?? '')}>{booking.codeSub}</button>
          {/if}
        </div>
      </div>
    {/if}

    {#if booking.groupLabel || documents.length}
      <div class="ps-foot">
        {#if booking.groupLabel}<span class="pf-group">{booking.groupLabel}</span>{/if}
        {#each documents as d (d.id)}
          <button class="pf-doc" onclick={() => void handOffDocument(d)}>
            <Icon name="doc" size={15} />
            {d.bookingId ? d.name : S.pass.eticket(d.name.split(' — ')[0] ?? d.name, d.mime === 'application/pdf')}
          </button>
        {/each}
      </div>
    {/if}
  </article>

  <div class="ps-actions">
    {#if booking.code}
      <button class="btn primary lg wfull" onclick={oncounter}>
        <Icon name="counter" size={18} stroke={2} />
        {S.pass.counterMode}
      </button>
    {/if}
    <div class="ps-row">
      {#if gmailUrl}
        <a class="btn" href={gmailUrl} target="_blank" rel="noopener"><Icon name="mail" size={16} /> {S.pass.findEmail}</a>
      {/if}
      {#if booking.manageUrl}
        <a class="btn" href={booking.manageUrl} target="_blank" rel="noopener"><Icon name="external" size={16} /> {S.pass.manage}</a>
      {/if}
      <MapButtons
        coord={booking.coord}
        name={mapName}
        query={booking.mapQuery}
        address={booking.address}
        city={booking.mapCity}
        url={booking.mapUrl}
        short
      />
      {#if booking.bookingLinkUrl}
        <a class="btn" href={booking.bookingLinkUrl} target="_blank" rel="noopener"><Icon name="ticket" size={16} /> {S.pass.bookingLink}</a>
      {/if}
      {#if bookingOnMap(booking)}
        <ShowOnMap labelled tripId={booking.tripId} id={booking.id} name={mapName} />
      {/if}
    </div>
    {#if gmailUrl || booking.manageUrl || booking.bookingLinkUrl}
      <p class="ps-net">{S.pass.needsNet}</p>
    {/if}
    {#if editing}
      <button class="btn ghost wfull" onclick={onedit}><Icon name="edit" size={16} /> {S.pass.edit}</button>
    {/if}
  </div>
</div>

<style>
  .passwrap {
    display: flex;
    flex-direction: column;
    gap: 14px;
    scroll-margin-top: 16px;
  }
  .pass {
    --opal-fill: var(--card);
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-photo);
    background: var(--card);
    box-shadow: var(--shadow-pass);
    animation: h-rise var(--duration-rise) var(--ease-out) both;
  }
  /* A LIT PASS WEARS ITS OPAL EDGE (f-pass) — and the perforation's notches
     cut it. The pass's own ground, shadow and rise above had been painting
     over .opal-edge (a scoped rule outranks the global one), so the edge,
     and with it the notches' bite, never showed. */
  .pass.opal-edge {
    background:
      linear-gradient(var(--card), var(--card)) padding-box,
      var(--opal) border-box;
    /* the card's own colour stays the pass's ground (under the edge's layers) */
    background-color: var(--card);
    background-size:
      100% 100%,
      300% 300%;
    box-shadow: var(--shadow-pass), var(--glow-opal);
    animation:
      h-rise var(--duration-rise) var(--ease-out) both,
      h-opal var(--duration-opal) var(--ease-linear) infinite;
  }
  .pass.unlit {
    border: 1.5px dashed var(--warn-line);
    box-shadow: var(--shadow-card);
  }
  .ps-top {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 14px 14px;
  }
  .ps-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }
  .ps-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ps-caps {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .ps-title {
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1.12;
    overflow-wrap: anywhere;
  }
  .ps-title.long {
    font-size: var(--fs-card-title);
    line-height: 1.25;
  }
  .ps-ends {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: end;
    gap: 2px 8px;
    padding: 0 4px;
  }
  .pe-code {
    font-size: var(--fs-hero-code);
    font-weight: 600;
    line-height: 1;
  }
  /* the arrival code keeps the right-hand column even when the date leaves
     the row (a narrow phone, below) */
  .pe-code ~ .pe-code {
    grid-column: 3;
  }
  /* the two names share the row under the codes, each wrapping at its own
     words — never broken inside one */
  .pe-names {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    gap: 14px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .pe-names > :last-child {
    text-align: right;
  }
  .pe-word {
    font-family: var(--font-display);
    font-size: var(--fs-card-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.15;
    color: var(--ink);
  }
  .pe-date {
    text-align: center;
    padding-bottom: 2px;
    font-size: var(--fs-chip);
    white-space: nowrap;
    color: var(--ink-2);
  }
  .words .pe-date {
    grid-column: 1 / -1;
    text-align: left;
  }
  @media (max-width: 370px) {
    .air .pe-date {
      grid-row: 3;
      grid-column: 1 / -1;
      text-align: left;
    }
  }
  .ps-when {
    padding: 0 4px;
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .ps-stay {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 6px 4px 0;
  }
  .st {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .st.right {
    align-items: flex-end;
  }
  .ps-k {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .st-date {
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.1;
  }
  .st-n {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding-bottom: 2px;
    font-size: var(--fs-time);
    color: var(--lilac);
  }
  .ps-venue {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 4px;
  }
  .pv-venue {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .pv-when {
    font-size: var(--fs-time);
    color: var(--ink-2);
  }
  .ps-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    font-size: var(--fs-label);
    color: var(--ink);
  }
  .ps-count :global(.hicon) {
    color: var(--sunrise);
  }
  .ps-count b {
    font-weight: 600;
    color: var(--sunrise);
  }
  .ps-warn {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 8px 12px;
    border-radius: var(--radius-button-sm);
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--warn-ink);
    background: var(--warn-soft);
    border: 1px solid var(--warn-line);
  }
  .ps-zone {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .stations {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 4px 0;
    border-top: 1px dashed var(--line);
  }
  .stn {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .side {
    flex-shrink: 0;
    width: 62px;
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .stnchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px 0 12px;
    border-radius: 999px;
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .scn {
    font-family: var(--font-zh);
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .nostn {
    flex: 1;
    min-width: 150px;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .ps-price {
    padding: 0 4px;
    font-size: var(--fs-row);
    font-weight: 500;
    color: var(--ink);
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    padding: 4px 4px 0;
  }
  .m {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .m.wide {
    grid-column: 1 / -1;
  }
  .m .k {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .m .v {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
    font-size: var(--fs-code);
    font-weight: 500;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .m .v.warn {
    color: var(--warn-ink);
  }
  .note {
    padding: 10px 4px 0;
    border-top: 1px solid var(--line);
    font-size: var(--fs-caption);
    line-height: 1.6;
    color: var(--ink-2);
  }
  .note :global(b) {
    color: var(--ink);
  }
  .note.alert {
    color: var(--ink);
  }
  /* the perforation: two notches cut from the sky and a dashed tear line */
  .ps-perf {
    position: relative;
    height: 24px;
  }
  .ps-perf .n {
    position: absolute;
    top: 0;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--sky);
  }
  .ps-perf .l {
    left: -13px;
  }
  .ps-perf .r {
    right: -13px;
  }
  .ps-perf .dash {
    position: absolute;
    left: 22px;
    right: 22px;
    top: 11px;
    border-top: 1.5px dashed var(--line);
  }
  .ps-bottom {
    padding: 8px 14px 14px;
  }
  .codestrip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 8px 6px 8px 16px;
    border-radius: var(--radius-inner);
    background: var(--sky);
    border: 1px solid var(--line);
  }
  .cs-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cs-label {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .code {
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.45em;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    min-height: 44px;
    align-items: center;
    font-size: var(--fs-code-lg);
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--ink);
    word-break: break-all;
  }
  .cs-copy {
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
  .codesub {
    flex-basis: 100%;
    min-height: 44px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    font-size: var(--fs-time);
    color: var(--ink-2);
    /* a word breaks only when it cannot fit a line on its own */
    overflow-wrap: anywhere;
  }
  .ps-foot {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 0 18px 16px;
    margin-top: -4px;
  }
  .pf-group {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .pf-doc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 4px;
    border: none;
    background: none;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
  }
  .ps-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ps-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .ps-row .btn {
    min-height: 48px;
    padding: 8px 10px;
    font-size: var(--fs-caption);
  }
  .ps-row :global(.addrcopy) {
    min-height: 48px;
  }
  .ps-net {
    margin: -2px 4px 0;
    font-size: var(--fs-chip);
    color: var(--faint);
  }
</style>

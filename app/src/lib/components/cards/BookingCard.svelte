<script lang="ts">
  /* A booking, drawn as a leather luggage tag (plan §SCREENS 3): clipped tag
     shape, punched hole, stitched dashed border, gold header lettering.

     The confirmation code deliberately breaks the material: it sits on a plain
     dark strip, not on the leather, because that is the string you read out at
     a counter at 22:00 on 8 % battery. Legibility beats beauty (§RULES 4). */
  import type { Booking } from '../../model/types';
  import { daysBetween, fmtDow, fmtShort } from '../../logic/dates';
  import { copyText } from '../../state/toast.svelte';
  import Md from '../ui/Md.svelte';
  import MapButtons from '../ui/MapButtons.svelte';
  import { S } from '../../i18n/strings';

  let { booking }: { booking: Booking } = $props();

  /* A flight's location is the airport it LEAVES from, so the button is
     labelled with that airport rather than with the flight number. Bookings
     whose place could not be verified carry nothing, and MapButtons then
     draws nothing — which is the point. */
  const mapName = $derived(
    booking.kind === 'flight'
      ? [booking.from.code, booking.from.name].filter(Boolean).join(' · ')
      : booking.title,
  );

  /* A TRAIN HAS TWO PLACES, NOT ONE, and that is the whole reason it is drawn
     differently from a flight. An airport code IS a place, so a flight carries
     one location on the booking itself. A rail leg carries its stations on its
     two ends instead — zero, one or two per end — and each openable station
     gets its own button, labelled with the station's own name. An end with no
     station prints WHY on the card, in the space the button would have taken.
     Nothing is inferred here: `ends` is only the two ends in travel order. */
  const ends = $derived(
    booking.kind === 'train'
      ? [
          { side: S.money.railFrom, end: booking.from },
          { side: S.money.railTo, end: booking.to },
        ]
      : [],
  );

  const glyph = $derived(
    booking.kind === 'flight' ? '✈' : booking.kind === 'train' ? '🚆' : booking.kind === 'hotel' ? '⌂' : '🎟',
  );
  const kindLabel = $derived(booking.kind.toUpperCase());
  const carrier = $derived(
    booking.kind === 'flight'
      ? [booking.carrier, booking.flightNo].filter(Boolean).join(' · ')
      : booking.title,
  );

  const stamp = $derived(
    booking.status === 'booked'
      ? { label: S.money.booked1, cls: 'ok' }
      : booking.status === 'pending'
        ? { label: S.money.pending, cls: 'warn' }
        : booking.status === 'walkin'
          ? { label: S.money.walkin, cls: '' }
          : { label: S.money.cancelled, cls: 'crit' },
  );
  const gmailUrl = $derived(
    booking.gmailQuery ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(booking.gmailQuery)}` : null,
  );
</script>

<div class="tagwrap">
  <article class="tag" class:pending={booking.status !== 'booked'}>
    <span class="hole" aria-hidden="true"></span>

    <header class="thead">
      <span class="kind">{kindLabel}</span>
      <span class="carrier">{#if booking.kind === 'flight'}{carrier}{:else}<Md text={carrier} />{/if}</span>
      <span class="ticon" aria-hidden="true">{glyph}</span>
    </header>

    <div class="body">
      {#if booking.kind === 'flight'}
        <div class="row">
          <span class="mono big">{booking.from.code}</span>{#if booking.from.name}<span class="dim"> ({booking.from.name})</span>{/if}
          <span class="arrow">→</span>
          <span class="mono big">{booking.to.code}</span>{#if booking.to.name}<span class="dim"> ({booking.to.name})</span>{/if}
        </div>
        <div class="row">
          {fmtDow(booking.date)} · {booking.dep} → {booking.arr}{#if booking.arrDayOffset}<sup>+{booking.arrDayOffset}</sup>{/if}{#if booking.duration} · {booking.duration}{/if}
        </div>
        {#if booking.priceNote}<div class="row dim">Fare {booking.priceNote}</div>{/if}
      {:else if booking.kind === 'train'}
        <div class="row">
          <span class="big">{booking.from.name}</span>
          <span class="arrow">→</span>
          <span class="big">{booking.to.name}</span>
        </div>
        <div class="row">
          {fmtDow(booking.date)}{#if booking.dep} · {booking.dep}{#if booking.arr} → {booking.arr}{/if}{/if}{#if booking.duration} · {booking.duration}{/if}
        </div>
        <div class="stations">
          {#each ends as e (e.side)}
            <div class="stn">
              <span class="side">{e.side}</span>
              {#if e.end.stations?.length}
                {#each e.end.stations as st (st.name)}
                  <span class="stnchip">
                    <span class="scn">{st.name}</span>
                    <MapButtons
                      coord={st.coord}
                      name={st.name}
                      query={st.mapQuery}
                      address={st.address}
                      city={st.mapCity}
                      compact
                    />
                  </span>
                {/each}
              {:else}
                <span class="nostn">{e.end.why}</span>
              {/if}
            </div>
          {/each}
        </div>
      {:else if booking.kind === 'hotel'}
        {@const nights = daysBetween(booking.checkIn, booking.checkOut)}
        <div class="row">
          {#if booking.city}{booking.city} · {/if}{fmtShort(booking.checkIn)} – {fmtShort(booking.checkOut)}{#if nights > 0} · {S.money.nights(nights)}{/if}
        </div>
        {#if booking.priceNote}<div class="row dim">{booking.priceNote}</div>{/if}
      {:else}
        <div class="row">{fmtDow(booking.date)}</div>
      {/if}

      {#if booking.meta.length}
        <div class="meta">
          {#each booking.meta as m, i (i)}
            <span class="m"><span class="k">{m.k}</span><span class="v" class:warn={m.warn}>{m.v}</span></span>
          {/each}
        </div>
      {/if}
    </div>

    {#if booking.code}
      <div class="codestrip">
        <button class="code mono" onclick={() => copyText(booking.code ?? '', booking.codeLabel ?? '')}>
          {booking.code}
        </button>
        <span class="copyhint">{S.wallet.tapToCopy}</span>
        {#if booking.codeSub}<span class="codesub mono">{booking.codeSub}</span>{/if}
      </div>
    {/if}

    {#if booking.note}
      <div class="note" class:alert={booking.alert}><Md text={booking.note} as="div" /></div>
    {/if}

    <div class="actions">
      {#if gmailUrl}
        <a class="btn" href={gmailUrl} target="_blank" rel="noopener">📧 Find email</a>
      {/if}
      {#if booking.manageUrl}
        <a class="btn ghost" href={booking.manageUrl} target="_blank" rel="noopener">↗ Manage</a>
      {/if}
      {#if booking.bookingLinkUrl}
        <a class="btn ghost" href={booking.bookingLinkUrl} target="_blank" rel="noopener">🔎 Booking link</a>
      {/if}
      <MapButtons
        coord={booking.coord}
        name={mapName}
        query={booking.mapQuery}
        address={booking.address}
        city={booking.mapCity}
        url={booking.mapUrl}
      />
    </div>

    <span class="stamp {stamp.cls} tk-stamp">{stamp.label}</span>
  </article>
</div>

<style>
  .tagwrap {
    margin-bottom: 18px;
    filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 16px rgba(232, 176, 75, 0.08));
  }
  .tag {
    position: relative;
    background: linear-gradient(160deg, #3b3026, var(--leather));
    border: 1px dashed #b7a483;
    border-radius: 14px;
    padding: 14px 16px 12px 52px;
    /* the tag's punched left edge */
    clip-path: polygon(0 20%, 7% 0, 100% 0, 100% 100%, 7% 100%, 0 80%);
  }
  .tag.pending {
    background: linear-gradient(160deg, #362c22, #251e18);
  }
  .hole {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--paper-2);
    border: 4px solid #6e5c44;
  }
  .thead {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    border-bottom: 1px dashed #6e5c44;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .kind {
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: var(--cream);
  }
  .carrier {
    font-size: 13.5px;
    font-weight: 650;
    color: var(--gold);
    min-width: 0;
  }
  .ticon {
    margin-left: auto;
    color: #e9e2d2;
    font-size: 15px;
  }
  .body {
    padding-right: 74px; /* clear the stamp */
  }
  .row {
    font-size: 14.5px;
    font-weight: 500;
    color: #efe8d8;
    line-height: 1.6;
  }
  .row.dim,
  .dim {
    color: #c8bda6;
    font-size: 13px;
  }
  .big {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 1px;
  }
  .arrow {
    color: var(--gold);
    padding: 0 4px;
  }
  sup {
    font-size: 10px;
    color: var(--warn);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 6px;
  }
  .m .k {
    display: block;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #b3a68d;
  }
  .m .v {
    display: block;
    font-size: 12.5px;
    font-weight: 650;
    color: #efe8d8;
    font-variant-numeric: tabular-nums;
  }
  .m .v.warn {
    color: var(--warn);
  }

  /* A rail leg's two ends. Same chip language as "📍 Places today" — the name,
     then a compact map button — except that an end with no station prints the
     REASON in the space the button would have taken. That half of this block is
     the point of it: four of the ten ends on this trip are not named in any
     document, and the card has to say so rather than look incomplete. */
  .stations {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px dashed #6e5c44;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stn {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .side {
    flex-shrink: 0;
    width: 58px;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #b3a68d;
  }
  .stnchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 4px 2px 9px;
    background: rgba(10, 9, 8, 0.45);
    border: 1px solid #6e5c44;
    border-radius: var(--radius-sm);
  }
  .scn {
    font-size: 12.5px;
    font-weight: 650;
    color: #efe8d8;
  }
  .nostn {
    flex: 1;
    min-width: 150px;
    font-size: 11.5px;
    line-height: 1.45;
    color: #c8bda6;
  }
  /* the tag's own ink, not the app's --faint: this button sits on leather */
  .stations :global(.mapbtn) {
    color: #efe8d8;
  }

  /* the code leaves the leather: this is the string read out at a counter */
  .codestrip {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin: 11px -6px 4px;
    padding: 9px 12px;
    background: var(--paper-2);
    border-radius: 10px;
  }
  .code {
    background: none;
    border: none;
    padding: 0;
    font-size: clamp(19px, 6.4vw, 26px);
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--gold);
    word-break: break-all;
    text-align: left;
    min-height: 34px;
  }
  .copyhint {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--faint);
  }
  .codesub {
    flex-basis: 100%;
    font-size: 12px;
    color: var(--ink-2);
    word-break: break-all;
  }
  .note {
    font-size: 12.5px;
    color: #d3c8b1;
    margin-top: 6px;
    line-height: 1.5;
  }
  .note.alert {
    color: var(--warn);
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .actions .btn {
    flex: 1;
    min-width: 118px;
    padding: 8px 10px;
    font-size: 12.5px;
    min-height: 40px;
    background: rgba(10, 9, 8, 0.55);
    border-color: #6e5c44;
    color: var(--cream);
  }
  .actions :global(.maps) {
    flex: 1;
    min-width: 118px;
    margin-top: 0;
  }
  .actions :global(.mapbtn) {
    font-size: 12.5px;
    background: rgba(10, 9, 8, 0.55);
    border-color: #6e5c44;
    color: var(--cream);
  }
  .tk-stamp {
    position: absolute;
    top: 40px;
    right: 12px;
  }
</style>

<script lang="ts">
  import type { Booking } from '../../model/types';
  import { fmtDow } from '../../logic/dates';
  import { copyText } from '../../state/toast.svelte';
  import Md from '../ui/Md.svelte';
  import MapButtons from '../ui/MapButtons.svelte';

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

  const stamp = $derived(
    booking.status === 'booked'
      ? { label: 'Booked ✓', cls: 'ok' }
      : booking.status === 'pending'
        ? { label: 'Pending', cls: 'warn' }
        : booking.status === 'walkin'
          ? { label: 'Walk-in', cls: '' }
          : { label: 'Cancelled', cls: 'crit' },
  );
  const gmailUrl = $derived(
    booking.gmailQuery ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(booking.gmailQuery)}` : null,
  );
</script>

<article class="tk" class:pending={booking.status !== 'booked'}>
  <header class="tk-head">
    {#if booking.kind === 'flight'}
      <span class="carrier">{booking.carrier}</span>
      <span class="fno mono">{booking.flightNo}</span>
    {:else}
      <span class="carrier"><Md text={booking.title} /></span>
    {/if}
    <span class="date">{fmtDow(booking.date)}</span>
    <span class="stamp {stamp.cls} tk-stamp">{stamp.label}</span>
  </header>

  {#if booking.kind === 'flight'}
    <div class="tk-route">
      <div class="ap">
        <div class="iata mono">{booking.from.code}</div>
        <div class="tm">{booking.dep}</div>
        <div class="apname">{booking.from.name ?? ''}</div>
      </div>
      <div class="tk-mid">
        <span class="dur">{booking.duration ?? ''}</span>
        <span class="ln"></span>
      </div>
      <div class="ap r">
        <div class="iata mono">{booking.to.code}</div>
        <div class="tm">
          {booking.arr}{#if booking.arrDayOffset}<sup>+{booking.arrDayOffset}</sup>{/if}
        </div>
        <div class="apname">{booking.to.name ?? ''}</div>
      </div>
    </div>
    {#if booking.priceNote}
      <div class="tk-fare"><span class="klabel">Fare</span><span class="v">{booking.priceNote}</span></div>
    {/if}
  {:else if booking.kind === 'hotel'}
    <div class="tk-stay">
      <div><span class="klabel">Check in</span><span class="v mono">{fmtDow(booking.checkIn)}</span></div>
      <div><span class="klabel">Check out</span><span class="v mono">{fmtDow(booking.checkOut)}</span></div>
      {#if booking.priceNote}<div><span class="klabel">Price</span><span class="v">{booking.priceNote}</span></div>{/if}
    </div>
  {/if}

  {#if booking.meta.length}
    <div class="tk-meta">
      {#each booking.meta as m, i (i)}
        <div class="m">
          <div class="k">{m.k}</div>
          <div class="v" class:warn={m.warn}>{m.v}</div>
        </div>
      {/each}
    </div>
  {/if}

  {#if booking.code}
    <div class="tk-tear"></div>
    <div class="tk-code">
      <div class="k">{booking.codeLabel ?? 'Confirmation'}</div>
      <button class="code-big mono" onclick={() => copyText(booking.code ?? '', booking.codeLabel ?? '')}>
        {booking.code}<span class="cp" aria-hidden="true">⧉</span>
      </button>
      {#if booking.codeSub}<div class="code-sub mono">{booking.codeSub}</div>{/if}
    </div>
  {/if}

  {#if booking.note}
    <div class="tk-note" class:alert={booking.alert}><Md text={booking.note} as="div" /></div>
  {/if}

  <div class="tk-actions">
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
</article>

<style>
  .tk {
    position: relative;
    background: var(--card);
    border: 1px solid var(--line);
    border-left: 5px solid var(--accent);
    border-radius: var(--radius);
    margin-bottom: 14px;
    box-shadow: var(--shadow-card);
    padding-bottom: 6px;
  }
  .tk.pending {
    border-left-style: dashed;
  }
  .tk::before {
    content: '';
    position: absolute;
    top: 15px;
    left: 9px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--paper);
    border: 1.5px solid var(--line-2);
  }
  .tk-head {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 16px 10px 24px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .carrier {
    font-weight: 700;
    font-size: 14.5px;
  }
  .fno {
    font-size: 12.5px;
    color: var(--accent-deep);
    background: var(--accent-soft);
    border-radius: 7px;
    padding: 1.5px 8px;
  }
  .date {
    font-size: 12.5px;
    color: var(--ink-2);
    font-weight: 600;
    white-space: nowrap;
  }
  .tk-stamp {
    margin-left: auto;
  }
  .tk-route {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 13px 16px 5px 24px;
  }
  .ap {
    flex: 1;
    min-width: 0;
  }
  .ap.r {
    text-align: right;
  }
  .iata {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: 1px;
    line-height: 1.1;
  }
  .tm {
    font-size: 15.5px;
    font-weight: 700;
    color: var(--accent-deep);
    font-variant-numeric: tabular-nums;
  }
  .tm sup {
    font-size: 10px;
    color: var(--crit);
  }
  .apname {
    font-size: 10.5px;
    color: var(--faint);
    line-height: 1.3;
    margin-top: 2px;
  }
  .tk-mid {
    width: 78px;
    flex-shrink: 0;
    text-align: center;
    color: var(--faint);
    font-size: 10px;
  }
  .tk-mid .ln {
    display: block;
    border-top: 2px dashed var(--line-2);
    margin: 5px 4px 0;
    position: relative;
  }
  .tk-mid .ln::after {
    content: '✈';
    position: absolute;
    top: -9px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--accent);
    font-size: 12px;
    background: var(--card);
    padding: 0 3px;
  }
  .tk-fare {
    padding: 6px 16px 0 24px;
  }
  .tk-stay {
    display: flex;
    gap: 18px;
    padding: 12px 16px 4px 24px;
    flex-wrap: wrap;
  }
  .tk-fare .v,
  .tk-stay .v {
    display: block;
    font-weight: 650;
    font-size: 14px;
  }
  .klabel {
    display: block;
    font-size: 9.5px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--faint);
  }
  .tk-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
    gap: 4px 10px;
    padding: 9px 16px 4px 24px;
  }
  .tk-meta .k {
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--faint);
    white-space: nowrap;
  }
  .tk-meta .v {
    font-size: 12.5px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .tk-meta .v.warn {
    color: var(--warn);
  }
  .tk-tear {
    position: relative;
    border-top: 2px dashed var(--line-2);
    margin: 10px 0 0;
  }
  .tk-tear::before,
  .tk-tear::after {
    content: '';
    position: absolute;
    top: -9px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--paper);
    border: 1px solid var(--line);
  }
  .tk-tear::before {
    left: -10px;
  }
  .tk-tear::after {
    right: -10px;
  }
  .tk-code {
    padding: 11px 16px 6px 24px;
  }
  .tk-code .k {
    font-size: 9.5px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--faint);
    margin-bottom: 1px;
  }
  .code-big {
    font-weight: 600;
    font-size: clamp(21px, 7.2vw, 31px);
    letter-spacing: 2px;
    color: var(--ink);
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    word-break: break-all;
  }
  .code-big .cp {
    font-size: 14px;
    color: var(--faint);
    flex-shrink: 0;
  }
  .code-sub {
    font-size: 12px;
    color: var(--ink-2);
    margin-top: 3px;
    word-break: break-all;
  }
  .tk-note {
    padding: 4px 16px 10px 24px;
    font-size: 12.5px;
    color: var(--ink-2);
  }
  .tk-note.alert {
    color: var(--warn);
    font-weight: 600;
  }
  .tk-actions {
    display: flex;
    gap: 8px;
    padding: 0 16px 12px 24px;
    flex-wrap: wrap;
  }
  .tk-actions .btn {
    flex: 1;
    min-width: 118px;
    padding: 8px 10px;
    font-size: 12.5px;
    min-height: 40px;
  }
  /* the map button sits in the same row as 📧 / ↗ / 🔎 and shares its metrics */
  .tk-actions :global(.maps) {
    flex: 1;
    min-width: 118px;
    margin-top: 0;
  }
  .tk-actions :global(.mapbtn) {
    font-size: 12.5px;
  }
  .tk-stamp {
    position: absolute;
    top: 44px;
    right: 12px;
  }
</style>

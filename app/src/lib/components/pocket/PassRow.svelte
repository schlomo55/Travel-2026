<script lang="ts">
  /* A booking as one row of a Pocket list (the Find board's booking row): an
     icon well in the colour of its list, the title, the route or the dates
     as the booking states them, the day and its status chip — and a tap
     opens the pass. */
  import type { Booking } from '../../model/types';
  import { bookingDateLabel, bookingLine, PASS_ICON, passKind } from '../../logic/pass';
  import { mdliteToText } from '../../logic/mdlite';
  import Icon from '../horizon/Icon.svelte';
  import StatusChip from '../horizon/StatusChip.svelte';
  import Md from '../ui/Md.svelte';

  let { booking, tripId }: { booking: Booking; tripId: string } = $props();

  const kind = $derived(passKind(booking));
  const line = $derived(bookingLine(booking));
  const when = $derived(bookingDateLabel(booking));
  const href = $derived(`#/trip/${encodeURIComponent(tripId)}/pocket/${encodeURIComponent(booking.id)}`);
</script>

<a class="passrow" {href} data-id={booking.id} aria-label={`${mdliteToText(booking.title)}, ${when}`}>
  <span class="pr-well {kind}" aria-hidden="true"><Icon name={PASS_ICON[kind]} size={19} /></span>
  <span class="pr-body">
    <span class="pr-title"><Md text={booking.title} /></span>
    {#if line}<span class="pr-line">{line}</span>{/if}
    <span class="pr-meta"><span class="num">{when}</span><StatusChip status={booking.status} size="sm" /></span>
  </span>
  <Icon name="chevron-right" size={18} />
</a>

<style>
  .passrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 10px 12px 14px;
    border-radius: 22px;
    text-decoration: none;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .passrow:active {
    background: var(--card-2);
  }
  .passrow > :global(.hicon) {
    color: var(--faint);
  }
  .pr-well {
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
  .pr-well.stay {
    color: var(--lilac);
    background: var(--lilac-soft);
    border-color: var(--lilac-line);
  }
  .pr-well.ticket {
    color: var(--aqua);
    background: var(--aqua-soft);
    border-color: color-mix(in srgb, var(--aqua) 36%, transparent);
  }
  .pr-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pr-title {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .pr-line {
    font-size: var(--fs-caption);
    line-height: 1.35;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .pr-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
</style>

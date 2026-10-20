<script lang="ts">
  /* A TICKET'S STATE, ON THE PLACE IT IS FOR (logic/reserveby.ts) — the Day
     view's numbered stops and chips, and the Map's place sheet. The app's own
     status chip: green "Ticket ✓" when bought; amber and DASHED "Ticket not
     booked" while pending — the dashed amber the unbought things already wear
     — with the traveller's book-by when there is one, "(passed)" once the
     phone's clock is past it. A tap opens the pass (its booking link lives
     there); inside another link (`plain`) it is only the words. */
  import type { ActivityBooking } from '../../model/types';
  import { localToday } from '../../logic/dates';
  import { mdliteToText } from '../../logic/mdlite';
  import { ticketLine } from '../../logic/reserveby';
  import { S } from '../../i18n/strings';

  let { booking, tripId, plain = false }: { booking: ActivityBooking; tripId: string; plain?: boolean } = $props();

  const line = $derived.by(() => {
    const d = new Date();
    return ticketLine(booking, localToday(), d.getHours() * 60 + d.getMinutes());
  });
</script>

{#if plain}
  <span class="chip tkchip" class:ok={line.booked} class:warn={!line.booked}>{line.text}</span>
{:else}
  <a
    class="chip tkchip"
    class:ok={line.booked}
    class:warn={!line.booked}
    href="#/trip/{encodeURIComponent(tripId)}/pocket/{encodeURIComponent(booking.id)}"
    aria-label={S.bookBy.aria(line.text, mdliteToText(booking.title))}>{line.text}</a
  >
{/if}

<style>
  .tkchip {
    max-width: 100%;
    white-space: normal;
  }
  a.tkchip {
    align-self: flex-start;
    min-height: 32px;
    text-decoration: none;
  }
  .tkchip.warn {
    border-style: dashed;
  }
</style>

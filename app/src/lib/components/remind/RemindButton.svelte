<script lang="ts">
  /* "REMIND ME" (Reminders, Part 4) — a small bell on a booking, a to-do or a
     place. It opens a sheet of ready choices (1 h before, the evening before,
     that morning, a time you pick) and makes an ordinary timed moment that
     points back here, so the reminder's tap lands on this very thing.

     The sheet is its own chunk, read the first time a bell is pressed: the
     bell is on screens every cold start draws, and the start-up bundle has
     no room for a sheet nobody opened. */
  import type { AlarmRef, HHMM, ISODate } from '../../model/types';
  import { once } from '../../state/lazy';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let {
    tripId,
    title,
    ref,
    date,
    time,
    compact = false,
  }: {
    tripId: string;
    /** What the reminder says — the thing's own name. */
    title: string;
    ref: AlarmRef;
    /** When the thing happens, if it has a day (and a time). */
    date?: ISODate;
    time?: HHMM;
    /** An icon-only button, for a row with no room for words. */
    compact?: boolean;
  } = $props();

  const sheetChunk = once(() => import('./RemindSheet.svelte').then((m) => m.default));
  let open = $state(false);
</script>

<button
  class="btn remind"
  class:iconly={compact}
  onclick={() => (open = true)}
  aria-label={compact ? S.remind.aria(title) : undefined}
>
  <Icon name="bell" size={16} />{#if !compact}{S.remind.button}{/if}
</button>
{#if open}
  {#await sheetChunk() then RemindSheet}
    <RemindSheet {tripId} {title} {ref} {date} {time} onclose={() => (open = false)} />
  {/await}
{/if}

<style>
  .remind.iconly {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    justify-content: center;
  }
</style>

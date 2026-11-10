<script lang="ts">
  /* THE MONEY STAMP beside a booking's status chip: Paid, or To pay with what
     is left and where (logic/stamps.ts payStamp — the pass's money row says
     the same), small. Draws nothing where nothing says either way. */
  import type { Booking } from '../../model/types';
  import { payStamp } from '../../logic/stamps';
  import StatusChip from './StatusChip.svelte';

  let { b }: { b: Booking } = $props();
  const s = $derived(payStamp(b));
</script>

{#if s}<StatusChip tone={s.cls} label={s.label} size="sm" extra="pay" />{/if}

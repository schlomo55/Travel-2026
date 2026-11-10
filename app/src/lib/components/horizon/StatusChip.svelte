<script lang="ts">
  /* THE STATUS CHIP (system/components/StatusChip): a word AND a colour,
     computed from the booking, never typed. Booked · Pending · Walk-in ·
     Cancelled, and the coverage words (Part booked, Missing, Planned) when a
     caller passes a tone and a label of its own. `extra` carries a class a
     caller needs to find the chip by (the pass's `tk-stamp`). */
  import type { BookingStatus } from '../../model/types';
  import { chipOf } from '../../logic/stamps';
  import Icon from './Icon.svelte';

  let {
    status,
    tone,
    label,
    extra = '',
    size = 'md',
  }: {
    status?: BookingStatus;
    tone?: 'ok' | 'warn' | 'crit' | 'planned' | 'accent' | '';
    label?: string;
    extra?: string;
    size?: 'sm' | 'md';
  } = $props();

  /* the status's word and tone are stamps.ts chipOf's — one copy; the icon says it twice for the eye */
  const c = $derived(status ? chipOf(status) : { label: label ?? '', cls: tone ?? '' });
  const icon = $derived(c.cls === 'ok' ? 'check' : c.cls === 'crit' ? (status ? 'close' : 'alert') : null);
</script>

<span class="chip stamp {c.cls} {extra}" class:sm={size === 'sm'}>
  {#if icon}<Icon name={icon} size={12} stroke={2.4} />{/if}{c.label}
</span>

<style>
  .chip.sm {
    min-height: 22px;
    padding: 0 8px;
    font-size: var(--fs-caps);
  }
</style>

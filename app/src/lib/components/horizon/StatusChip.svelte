<script lang="ts">
  /* THE STATUS CHIP (system/components/StatusChip): a word AND a colour,
     computed from the booking, never typed. Booked · Pending · Walk-in ·
     Cancelled, and the coverage words (Part booked, Missing, Planned) when a
     caller passes a tone and a label of its own. `extra` carries a class a
     caller needs to find the chip by (the pass's `tk-stamp`). */
  import type { BookingStatus } from '../../model/types';
  import { S } from '../../i18n/strings';
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

  const resolved = $derived.by((): { tone: string; label: string; icon: string | null } => {
    if (status) {
      switch (status) {
        case 'booked':
          return { tone: 'ok', label: S.chip.booked, icon: 'check' };
        case 'pending':
          return { tone: 'warn', label: S.chip.pending, icon: null };
        case 'walkin':
          return { tone: '', label: S.chip.walkin, icon: null };
        case 'cancelled':
          return { tone: 'crit', label: S.chip.cancelled, icon: 'close' };
      }
    }
    return { tone: tone ?? '', label: label ?? '', icon: tone === 'ok' ? 'check' : tone === 'crit' ? 'alert' : null };
  });
</script>

<span class="chip stamp {resolved.tone} {extra}" class:sm={size === 'sm'}>
  {#if resolved.icon}<Icon name={resolved.icon} size={12} stroke={2.4} />{/if}{resolved.label}
</span>

<style>
  .chip.sm {
    min-height: 22px;
    padding: 0 8px;
    font-size: var(--fs-caps);
  }
</style>

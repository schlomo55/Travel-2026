<script lang="ts">
  /* A WALLET LIST — Travel, Stays or Experiences: every booking of that kind
     as a row, in the groups the trip file gives them (the flights' orders,
     the tickets' bought / still to buy), each row opening its pass.

     CANCELLED IS NOT PART OF THE COUNT — booked.ts has always dropped it, so
     the Pocket counts the same way — but it is not hidden either: a cancelled
     leg is a fact worth finding, so it sits under its own heading, last. */
  import type { Booking } from '../../model/types';
  import { compareIso } from '../../logic/dates';
  import { walletSectionOf, type WalletSection } from '../../logic/pass';
  import { S } from '../../i18n/strings';
  import EmptyState from '../ui/EmptyState.svelte';
  import PassRow from './PassRow.svelte';

  let {
    section,
    bookings,
    tripId,
    editing,
    onadd,
  }: {
    section: WalletSection;
    bookings: Booking[];
    tripId: string;
    editing: boolean;
    onadd: (kind: 'flight' | 'stay' | 'train' | 'activity') => void;
  } = $props();

  const mine = $derived(bookings.filter((b) => walletSectionOf(b) === section));
  const live = $derived(mine.filter((b) => b.status !== 'cancelled'));
  const cancelled = $derived(mine.filter((b) => b.status === 'cancelled').sort((a, b) => compareIso(a.date, b.date)));

  const sorted = $derived.by(() => {
    const list = [...live];
    if (section === 'experiences') {
      /* WHAT YOU ALREADY HOLD COMES FIRST — the one you can be turned away at
         a door for not having must not sit under ten to-buys. */
      return list.sort(
        (a, b) =>
          Number(b.status === 'booked') - Number(a.status === 'booked') ||
          compareIso(a.date, b.date) ||
          a.title.localeCompare(b.title),
      );
    }
    if (section === 'stays') {
      return list.sort((a, b) => compareIso(a.kind === 'hotel' ? a.checkIn : a.date, b.kind === 'hotel' ? b.checkIn : b.date));
    }
    return list.sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title));
  });

  /* Grouped by the trip file's own group label, in first-seen order. Stays
     read best as one chronological run, so they are not grouped. */
  const groups = $derived.by((): [string, Booking[]][] => {
    if (section === 'stays') return [['', sorted]];
    const m = new Map<string, Booking[]>();
    for (const b of sorted) {
      const k = b.groupLabel ?? S.pocket.other;
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()];
  });

  const pending = $derived(live.filter((b) => b.status !== 'booked').length);
  const summary = $derived(
    section === 'stays'
      ? S.wallet.beds(live.length, pending)
      : section === 'experiences'
        ? S.wallet.tickets(live.length, pending)
        : S.pocket.legs(live.length, pending),
  );
</script>

{#if live.length === 0 && cancelled.length === 0}
  {#if section === 'travel'}
    <EmptyState
      glyph="plane"
      title={S.empty.travel.title}
      body={S.empty.travel.body}
      actionLabel={S.empty.travel.action}
      onaction={() => onadd('flight')}
      altLabel={S.empty.travel.alt}
      onalt={() => onadd('train')}
    />
  {:else if section === 'stays'}
    <EmptyState glyph="bed" title={S.empty.stays.title} body={S.empty.stays.body} actionLabel={S.empty.stays.action} onaction={() => onadd('stay')} />
  {:else}
    <EmptyState
      glyph="ticket"
      title={S.empty.experiences.title}
      body={S.empty.experiences.body}
      actionLabel={S.empty.experiences.action}
      onaction={() => onadd('activity')}
    />
  {/if}
{:else}
  <p class="wl-sum">{summary}</p>
  {#each groups as [label, items] (label)}
    {#if label}<h2 class="caps wl-group">{label}</h2>{/if}
    <div class="wl-rows">
      {#each items as b (b.id)}<PassRow booking={b} {tripId} />{/each}
    </div>
  {/each}
  {#if cancelled.length}
    <h2 class="caps wl-group crit">{S.money.cancelled} · {cancelled.length}</h2>
    <div class="wl-rows">
      {#each cancelled as b (b.id)}<PassRow booking={b} {tripId} />{/each}
    </div>
  {/if}
{/if}

{#if editing}
  <div class="wl-adds">
    {#if section === 'travel'}
      <button class="addbtn" onclick={() => onadd('flight')}>{S.edit.add('a flight')}</button>
      <button class="addbtn" onclick={() => onadd('train')}>{S.edit.add('a train or a road leg')}</button>
    {:else if section === 'stays'}
      <button class="addbtn" onclick={() => onadd('stay')}>{S.edit.add('a stay')}</button>
    {:else}
      <button class="addbtn" onclick={() => onadd('activity')}>{S.edit.add('a ticket')}</button>
    {/if}
  </div>
{/if}

<style>
  .wl-sum {
    margin: 4px 4px 14px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .wl-group {
    margin: 18px 4px 10px;
    color: var(--faint);
  }
  .wl-group.crit {
    color: var(--crit-ink);
  }
  .wl-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wl-adds {
    margin-top: 16px;
  }
</style>

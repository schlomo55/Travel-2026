<script lang="ts">
  /* THE CLOCKS — the hours you are living between, from the trip file's own
     zones, offline and DST-correct (Intl). Three fit side by side without a
     swipe; a fourth wraps rather than hiding off the edge. */
  import type { Trip } from '../../model/types';
  import { clockIn } from '../../logic/dates';
  import { S } from '../../i18n/strings';
  import EmptyState from '../ui/EmptyState.svelte';

  let { trip }: { trip: Trip } = $props();

  let tick = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (tick = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const faces = $derived(trip.clocks.map((c) => ({ ...c, time: clockIn(c.timeZone, new Date(tick)) })));
</script>

{#if faces.length === 0}
  <EmptyState glyph="clock" title={S.pocket.noClocks} body={S.pocket.noClocksBody} />
{:else}
  <section id="clocks">
    <p class="csub">{S.info.clocksSub}</p>
    <div class="clocks">
      {#each faces as c (c.timeZone)}
        <div class="clock">
          <span class="cl">{c.label}</span>
          <span class="clocknum num">{c.time}</span>
          <span class="cz">{c.timeZone}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .csub {
    margin: 4px 4px 12px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .clocks {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .clock {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 14px 12px;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .cl {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clocknum {
    font-size: var(--fs-countdown);
    font-weight: 500;
    line-height: 1.1;
    color: var(--sunrise);
  }
  .cz {
    font-size: var(--fs-caps);
    color: var(--faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

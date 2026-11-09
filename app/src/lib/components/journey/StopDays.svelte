<script lang="ts">
  /* THE DAYS VIEW of a stop's page (routes/Stop.svelte): this stop's planned
     days — the guide's "Day by day" list, one row each (logic/stopdays.ts).
     A row opens the guide at that day, its accordion item open (`onopen`
     hands the guide the day to land on before the link changes the view).
     Part of the start-up chunk: as a lazy chunk of its own (~1.2 KB) it cost
     the app's total more than it saved the cold start (10 Nov 2026). */
  import type { DayPlan, ISODate } from '../../model/types';
  import type { SegmentCoverage } from '../../logic/coverage';
  import type { BookedHere } from '../../logic/guide';
  import { stopDays } from '../../logic/stopdays';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let {
    days,
    held,
    cover,
    now,
    href,
    onopen,
  }: { days: DayPlan[]; held: BookedHere; cover: SegmentCoverage | null; now: ISODate; href: string; onopen: (anchor: string) => void } = $props();

  const rows = $derived(stopDays(days, held, cover, now));
</script>

<section class="days" aria-label={S.city.days}>
  {#if rows.length}
    <ol>
      {#each rows as r (r.date)}
        <li>
          <a class="day" {href} onclick={() => onopen(`g-day-${r.date}`)} aria-current={r.today ? 'date' : undefined}>
            <span class="dd"><span class="num dw">{r.dow}</span><span class="num dn">{r.day}</span></span>
            <span class="db">
              <span class="dt">{r.title}</span>
              {#if r.bed}<span class="bed"><Icon name="bed" size={14} /><span>{r.bed}</span></span>{/if}
              {#if r.today || r.chips.length}
                <span class="dc">
                  {#if r.today}<span class="chip accent">{S.city.todayChip}</span>{/if}
                  {#each r.chips as c, i (i)}<span class="chip {c.tone}">{c.text}</span>{/each}
                </span>
              {/if}
            </span>
            <Icon name="chevron-right" size={16} class="chev" />
          </a>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="none">{S.city.noDays}</p>
  {/if}
</section>

<style>
  /* the guide's list of days, a row each, under the page's switch; the page's
     own bottom padding (app.css body) clears the floating nav */
  .days {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 var(--gutter);
  }
  ol {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--line);
    border-radius: var(--radius-inner);
    overflow: hidden;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  .day {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 10px 12px;
    background: var(--card);
    color: var(--ink);
  }
  .day:active {
    background: var(--card-2);
  }
  /* the list clips its rounded corners: a row's focus ring goes inside */
  .day:focus-visible {
    outline-offset: -4px;
  }
  .day[aria-current='date'] {
    box-shadow: inset 3px 0 0 var(--sunrise);
  }
  .dd {
    flex: 0 0 58px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .dw {
    font-size: var(--fs-caps);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .dn {
    white-space: nowrap;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--sunrise);
  }
  .db {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .dt {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-size: var(--fs-label);
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .bed {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .bed span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dc {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    margin-top: 2px;
  }
  .day :global(.chev) {
    flex-shrink: 0;
    color: var(--faint);
  }
  .none {
    margin: 24px 0 0;
    padding: 24px 16px;
    border: 1.5px dashed var(--edge);
    border-radius: var(--radius-tile);
    text-align: center;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>

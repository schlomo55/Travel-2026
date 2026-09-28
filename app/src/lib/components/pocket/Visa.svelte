<script lang="ts">
  /* THE VISA — every compliance counter, spelled out: the day it is (the
     number a border officer counts), how much legal stay is left, the hard
     deadline, the planned exit, and the note that explains the rule. The
     trip bar's pill, Now's visa card and the Pocket tile all open here
     (router.goCompliance), so the three doorways cannot disagree.

     It has no silent branches: before the count starts it says when it will;
     past the limit it says so in red, because "day 31 of 30" is then a fact,
     not a countdown. */
  import type { ComplianceCounter, ISODate } from '../../model/types';
  import { counterState } from '../../logic/counters';
  import { compareIso, daysBetween, fmtLong, fmtShort } from '../../logic/dates';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  let {
    counters,
    now,
    editing,
    onedit,
    onadd,
  }: {
    counters: ComplianceCounter[];
    now: ISODate;
    editing: boolean;
    onedit: (c: ComplianceCounter) => void;
    onadd: () => void;
  } = $props();

  const sorted = $derived([...counters].sort((a, b) => Number(b.pinned) - Number(a.pinned)));

  function toneOf(c: ComplianceCounter): '' | 'warn' | 'crit' {
    const st = counterState(c, now);
    if (st.phase === 'overLimit') return 'crit';
    if (c.hardDeadline && st.phase === 'counting' && compareIso(now, c.hardDeadline) >= 0) return 'crit';
    if (st.phase !== 'counting') return '';
    return st.remaining <= 2 ? 'crit' : st.remaining <= 5 ? 'warn' : '';
  }
</script>

<div id="compliance" class="visas">
  {#if sorted.length === 0}
    <EmptyState glyph="passport" title={S.pocket.noCounters} body={S.pocket.noCountersBody} actionLabel={S.edit.add('a counter')} onaction={onadd} />
  {/if}

  {#each sorted as c (c.id)}
    {@const st = counterState(c, now)}
    {@const tone = toneOf(c)}
    {@const pct = st.phase === 'counting' || st.phase === 'overLimit' ? Math.min(100, Math.round((st.day / st.limitDays) * 100)) : st.phase === 'complete' ? 100 : 0}
    <article class="visa {tone}" class:pinned={c.pinned}>
      <header class="v-head">
        <span class="v-ic" aria-hidden="true"><Icon name="passport" size={18} /></span>
        <h2 class="v-name">{c.name}</h2>
        {#if c.pinned}<span class="chip accent">{S.pocket.pinned}</span>{/if}
      </header>

      {#if st.phase === 'before'}
        <p class="v-say">{S.info.counterStarts(fmtLong(c.startDate))}{c.countStartsDayAfter ? S.info.counterDayAfter : ''}.</p>
      {:else if st.phase === 'entryDay'}
        <p class="v-say">{S.today.entryDay}</p>
      {:else if st.phase === 'complete'}
        <p class="v-say">
          {S.info.counterDone(c.plannedEndDate ? fmtLong(c.plannedEndDate) : S.info.counterOnSchedule, st.day, st.limitDays)}.
        </p>
      {:else}
        <div class="v-big">
          <span class="caps v-cap">{st.phase === 'overLimit' ? S.today.counterOver(c.name) : S.info.counterDay}</span>
          <span class="num v-day">{st.day}<span class="v-of">/{st.limitDays}</span></span>
        </div>
        <p class="v-left" class:crit={st.remaining < 0}>
          {st.remaining >= 0 ? S.info.counterLeft(st.remaining) : S.pocket.overBy(-st.remaining)}
        </p>
      {/if}

      <!-- the window, as a bar: how far through, and where the wall is -->
      <div class="v-bar" aria-hidden="true"><i style="width:{pct}%"></i></div>

      <dl class="v-facts">
        <div>
          <dt>{S.pocket.countStarts}</dt>
          <dd class="num">{fmtShort(c.startDate)}{c.countStartsDayAfter ? ` ${S.pocket.dayAfter}` : ''}</dd>
        </div>
        {#if c.plannedEndDate}
          <div>
            <dt>{S.pocket.plannedExit}</dt>
            <dd class="num">{fmtShort(c.plannedEndDate)}</dd>
          </div>
        {/if}
        {#if c.hardDeadline}
          <div class="hard">
            <dt>{S.info.hardDeadline}</dt>
            <dd class="num">{fmtLong(c.hardDeadline)}</dd>
          </div>
          {#if st.phase === 'counting' && compareIso(now, c.hardDeadline) <= 0}
            <div>
              <dt>{S.pocket.untilDeadline}</dt>
              <dd class="num">{S.pocket.days(daysBetween(now, c.hardDeadline))}</dd>
            </div>
          {/if}
        {/if}
      </dl>

      {#if c.note}<div class="v-note"><Md text={c.note} as="div" /></div>{/if}

      {#if editing}
        <button class="btn ghost" onclick={() => onedit(c)}><Icon name="edit" size={16} /> {S.pass.edit}</button>
      {/if}
    </article>
  {/each}

  {#if editing && sorted.length}
    <button class="addbtn" onclick={onadd}>{S.edit.add('a counter')}</button>
  {/if}
</div>

<style>
  .visas {
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-margin-top: 16px;
  }
  .visa {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .visa.warn {
    border-color: var(--warn-line);
  }
  .visa.crit {
    border-color: var(--crit-line);
    background:
      linear-gradient(180deg, var(--crit-soft), transparent 60%),
      var(--card);
  }
  .v-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .v-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-chip-sm);
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  .v-name {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .v-say {
    margin: 0;
    font-size: var(--fs-body);
    line-height: 1.5;
  }
  .v-big {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .v-cap {
    color: var(--ink-2);
  }
  .visa.crit .v-cap {
    color: var(--crit-ink);
  }
  .v-day {
    font-size: var(--fs-hero-code);
    font-weight: 500;
    line-height: 1;
    color: var(--sunrise);
  }
  .visa.crit .v-day {
    color: var(--crit-ink);
  }
  .v-of {
    font-size: var(--fs-countdown);
    color: var(--ink-2);
  }
  .v-left {
    margin: 0;
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .v-left.crit {
    color: var(--crit-ink);
  }
  .v-bar {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: var(--scene-track);
    overflow: hidden;
  }
  .v-bar i {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--opal-1), var(--opal-2), var(--opal-3));
  }
  .visa.crit .v-bar i {
    background: var(--crit);
  }
  .v-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    margin: 0;
  }
  .v-facts div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .v-facts dt {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .v-facts dd {
    margin: 0;
    font-size: var(--fs-code);
    font-weight: 500;
  }
  .v-facts .hard dd {
    color: var(--crit-ink);
  }
  .v-note {
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: var(--fs-caption);
    line-height: 1.6;
    color: var(--ink-2);
  }
</style>

<script lang="ts">
  /* THE TO DO BLOCK on Now's home — what is late and what is due today, as
     rows you can tick without leaving the screen (logic/nowTodo.ts picks
     them: overdue first, oldest first, then today in time order, three at
     most). The header says how many are overdue, in red, and opens the To do
     page, where the rest of what is coming up lives. Nothing due: one quiet
     line and the same door.

     The round tick is the To do page's own: a to-do ticks done, an alarm ticks
     "in the phone's calendar" (lib/data/todoTick.ts), a ticket is a door to its
     pass. A previewed day is looked at, never ticked: the tick is drawn but
     locked. */
  import type { NowTodoView } from '../../logic/nowTodo';
  import { todoTitle } from '../../logic/todo';
  import { mdliteToText } from '../../logic/mdlite';
  import { tick } from '../../data/todoTick';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let { view, tripId }: { view: NowTodoView; tripId: string } = $props();

  const base = $derived(`#/trip/${encodeURIComponent(tripId)}`);
  const todoHref = $derived(`${base}/now/todo`);
</script>

<section class="ntodo" aria-labelledby="nt-h">
  <div class="nt-head">
    <h2 id="nt-h" class="caps nt-h" class:late={view.overdue > 0}>{view.overdue ? `${S.todo.overdue} · ${view.overdue}` : S.glance.todo}</h2>
    <a class="nt-all" href={todoHref}>{view.comingUp ? `${view.comingUp} ${S.todo.comingUp}` : S.todo.title}<Icon name="chevron-right" size={16} /></a>
  </div>

  {#if view.empty}
    <p class="nt-none">{S.nowTodo.none}</p>
  {:else}
    <ul class="nt-list">
      {#each view.rows as r (r.item.id)}
        {@const it = r.item}
        {@const text = mdliteToText(todoTitle(it))}
        <li class="nt-row" class:late={r.group === 'overdue'}>
          {#if it.booking}
            <span class="nt-well"><Icon name="ticket" size={18} /></span>
          {:else}
            <button
              class="nt-tick"
              class:alarm={!!it.alarm}
              disabled={view.previewing}
              aria-pressed={it.done}
              onclick={() => void tick(it, view.previewing)}
              aria-label={it.task ? S.todo.markDone(text) : it.done ? S.todo.alarmUnset(text) : S.todo.alarmSet(text)}
            >
              {#if it.alarm}<Icon name={it.done ? 'check' : 'bell'} size={18} />{/if}
            </button>
          {/if}
          <a class="nt-link" href={it.booking ? `${base}/pocket/${encodeURIComponent(it.booking.id)}` : todoHref}>
            <span class="nt-body">
              <span class="nt-title">{text}</span>
              <span class="nt-line">{r.line}</span>
            </span>
          </a>
        </li>
      {/each}
      {#if view.more > 0}
        <li class="nt-row nt-moreli"><a class="nt-link nt-more" href={todoHref}>{S.nowTodo.more(view.more)}<Icon name="chevron-right" size={16} /></a></li>
      {/if}
    </ul>
  {/if}
</section>

<style>
  .nt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }
  .nt-h {
    margin: 0;
    color: var(--ink-2);
  }
  .nt-h.late {
    color: var(--crit-ink);
  }
  .nt-all {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    padding-left: 12px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
  }
  .nt-list,
  .nt-none {
    margin: 0;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .nt-list {
    padding: 0;
    list-style: none;
  }
  .nt-none {
    padding: 12px 14px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .nt-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 56px;
    padding: 6px 10px 6px 6px;
  }
  .nt-moreli {
    min-height: 44px;
    padding-block: 0;
  }
  .nt-row + .nt-row {
    border-top: 1px solid var(--line);
  }
  .nt-tick,
  .nt-well {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }
  .nt-tick {
    color: var(--ink-2);
    background: transparent;
    border: 2px solid var(--edge);
  }
  .late .nt-tick {
    border-color: var(--crit);
  }
  .nt-tick.alarm:not([aria-pressed='true']) {
    color: var(--warn);
    border-color: var(--warn-line);
    background: var(--warn-soft);
  }
  .nt-tick[aria-pressed='true'] {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
  }
  .nt-tick:disabled {
    opacity: 0.55;
  }
  .nt-well {
    color: var(--warn);
    background: var(--warn-soft);
    border: 1px dashed var(--warn-line);
  }
  .nt-link {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    color: var(--ink);
  }
  .nt-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nt-title {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .nt-line {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .late .nt-line {
    color: var(--crit-ink);
  }
  .nt-more {
    min-height: 44px;
    justify-content: flex-end;
    gap: 4px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink-2);
  }
</style>

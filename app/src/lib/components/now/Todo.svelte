<script lang="ts">
  /* TO DO, FOLDED INTO TIME (f-todo) — every to-do on its due date, every
     alarm on its date, every booking still to buy on the day it is for;
     what is past folded into one Earlier group (kept, and never claimed done
     or not); the packing list and the checklists one tap away.

     A to-do ticks here; an alarm ticks when it is in the phone's calendar
     (the app cannot ring while it is closed — the .ics export puts every
     upcoming one there at once); a booking opens its pass. Edit mode adds
     and edits, with the same sheets as everywhere else. */
  import type { Alarm, Booking, Checklist, FlightBooking, ISODate, PackingItem, Task, Trip } from '../../model/types';
  import { db } from '../../db/db';
  import { mutate } from '../../data/repo';
  import { deleteEntity, saveEntity } from '../../data/edit';
  import { alarmSpec, taskSpec } from '../forms/specs';
  import { addDays, compareIso, fmtDow, fmtShort } from '../../logic/dates';
  import { downloadBlob } from '../../logic/backup';
  import { mdliteToText } from '../../logic/mdlite';
  import type { TodoItem, TodoPlan } from '../../logic/todo';
  import { router } from '../../state/router.svelte';
  import { toast } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import RemindButton from '../remind/RemindButton.svelte';
  import Md from '../ui/Md.svelte';
  import EditSheet from '../ui/EditSheet.svelte';

  let {
    trip,
    tasks,
    alarms,
    bookings,
    packing,
    checklists,
    plan,
    now,
    editing,
  }: {
    trip: Trip;
    tasks: Task[];
    alarms: Alarm[];
    bookings: Booking[];
    packing: PackingItem[];
    checklists: Checklist[];
    plan: TodoPlan;
    now: ISODate;
    editing: boolean;
  } = $props();

  const base = $derived(`#/trip/${encodeURIComponent(trip.id)}/now`);
  const dayLabel = (d: ISODate): string =>
    d === now ? S.todo.today(fmtDow(d)) : d === addDays(now, 1) ? S.todo.tomorrow(fmtDow(d)) : fmtDow(d);

  const toggleTask = (t: Task) =>
    mutate(() => db.tasks.update(t.id, { done: !t.done, doneAt: t.done ? undefined : Date.now() }));
  const toggleAlarm = (a: Alarm) => mutate(() => db.alarms.update(a.id, { done: !a.done }));

  const upcoming = $derived(alarms.filter((a) => !a.done && compareIso(a.date, now) >= 0));
  /* The export and the trip's zone plan are read when the button is pressed
     (the Reminders run): exact times need logic/tripzone.ts, and a cold start
     has no room for code that runs once a trip. The flights ride along now. */
  const upcomingFlights = $derived(
    bookings.filter(
      (b): b is FlightBooking => b.kind === 'flight' && b.status !== 'cancelled' && !b.alternative && compareIso(b.date, now) >= 0,
    ),
  );
  async function exportIcs(): Promise<void> {
    if (!upcoming.length && !upcomingFlights.length) return;
    const [{ buildIcs }, { tripZonePlan }, { leaveLead }] = await Promise.all([
      import('../../logic/ics'),
      import('../../platform/reminders'),
      import('../../logic/notify'),
    ]);
    const ics = buildIcs(upcoming, trip, new Date().toISOString(), {
      zone: await tripZonePlan(trip.id, bookings),
      flights: upcomingFlights,
      leaveLead,
    });
    const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(`${slug}-calendar.ics`, new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    toast.show(S.lists.exported(upcoming.length + upcomingFlights.length));
  }

  const earlierTasks = $derived(plan.earlier.filter((i) => i.kind === 'task').length);
  const earlierAlarms = $derived(plan.earlier.filter((i) => i.kind === 'alarm').length);
  const packed = $derived(packing.filter((p) => p.done).length);
  const listItems = $derived(checklists.reduce((n, l) => n + l.items.length, 0));
  const listDone = $derived(checklists.reduce((n, l) => n + l.items.filter((i) => i.done).length, 0));

  type Sheet = { kind: 'task'; entity?: Task } | { kind: 'alarm'; entity?: Alarm };
  let sheet = $state<Sheet | null>(null);
</script>

{#snippet row(it: TodoItem)}
  {@const title = it.task?.title ?? it.alarm?.title ?? it.booking?.title ?? ''}
  {#if it.booking}
    <a class="trow booking" data-kind="booking" href="#/trip/{encodeURIComponent(trip.id)}/pocket/{encodeURIComponent(it.booking.id)}">
      <span class="well warn"><Icon name="ticket" size={18} /></span>
      <span class="tr-body">
        <span class="tr-meta">{S.todo.booking}{#if it.time} · <span class="num">{it.time}</span>{/if}</span>
        <span class="tr-title"><Md text={title} /></span>
      </span>
      <span class="chip warn">{S.chip.pending}</span>
    </a>
  {:else}
    <div class="trow {it.kind}" data-kind={it.kind} class:done={it.done} class:late={it.late}>
      <button
        class="tick"
        class:on={it.done}
        aria-pressed={it.done}
        onclick={() => (it.task ? toggleTask(it.task) : it.alarm && toggleAlarm(it.alarm))}
        aria-label={it.task
          ? it.done
            ? S.todo.undo(mdliteToText(title))
            : S.todo.markDone(mdliteToText(title))
          : it.done
            ? S.todo.alarmUnset(mdliteToText(title))
            : S.todo.alarmSet(mdliteToText(title))}
      >
        {#if it.done}<Icon name="check" size={18} stroke={2.6} />{:else if it.alarm}<Icon name="bell" size={18} />{/if}
      </button>
      <span class="tr-body">
        <span class="tr-meta">
          {#if it.alarm}{S.todo.alarm} · <span class="num">{it.alarm.time}</span>{#if it.date && compareIso(it.date, now) < 0} · {fmtShort(it.date)}{/if}
          {:else if it.task?.dueLabel || it.task?.due}{S.todo.due(it.task.dueLabel ?? fmtShort(it.task.due ?? ''))}{#if it.task.dueLabel && it.task.due} · {fmtShort(it.task.due)}{/if}{/if}
        </span>
        <span class="tr-title"><Md text={title} /></span>
        {#if it.alarm?.why}<span class="tr-why"><Md text={it.alarm.why} /></span>{/if}
        {#if it.task?.detail || it.task?.link}
          <details class="why">
            <summary>{S.lists.why}</summary>
            {#if it.task.detail}<Md text={it.task.detail} as="div" />{/if}
            {#if it.task.link}<a href={it.task.link} target="_blank" rel="noopener">{S.lists.openLink}</a>{/if}
          </details>
        {/if}
      </span>
      <span class="chip {it.late ? 'crit' : it.alarm ? 'warn' : 'planned'}"
        >{it.late ? S.todo.overdue : it.alarm ? S.todo.alarm : S.todo.task}</span
      >
      {#if it.task && !it.done && !editing}
        <!-- "Remind me" (the Reminders run): a to-do that should ring. -->
        <RemindButton
          compact
          tripId={trip.id}
          title={it.task.title}
          ref={{ kind: 'task', id: it.task.id }}
          date={it.task.due ?? now}
        />
      {/if}
      {#if editing}
        <button class="editbtn" onclick={() => (sheet = it.task ? { kind: 'task', entity: it.task } : { kind: 'alarm', entity: it.alarm })} aria-label={S.edit.item(mdliteToText(title))}
          ><Icon name="edit" size={16} /></button
        >
      {/if}
    </div>
  {/if}
{/snippet}

<header class="wrap td-head">
  <button class="iconbtn" onclick={() => router.backOr(base)} aria-label={S.day.back}><Icon name="chevron-left" size={20} /></button>
  <div class="td-title">
    <span class="caps td-caps">{S.todo.caps(fmtDow(now))}</span>
    <h1 class="display td-h1">{S.todo.title}</h1>
  </div>
  <span class="td-count"><span class="num">{plan.comingUp}</span> {S.todo.comingUp}</span>
</header>
<p class="wrap td-intro">{S.todo.intro}</p>

<main class="wrap todo">
  {#each plan.days as d (d.date)}
    <section class="tday" class:today={d.date === now} aria-label={dayLabel(d.date)}>
      <h2 class="caps tday-h">{dayLabel(d.date)}<span class="hline" aria-hidden="true"></span></h2>
      {#each d.items as it (it.id)}{@render row(it)}{/each}
    </section>
  {/each}

  {#if plan.undated.length}
    <section class="tday" aria-label={S.todo.undated}>
      <h2 class="caps tday-h">{S.todo.undated}<span class="hline" aria-hidden="true"></span></h2>
      {#each plan.undated as it (it.id)}{@render row(it)}{/each}
    </section>
  {/if}

  {#if plan.earlier.length}
    <details class="earlier">
      <summary><Icon name="clock" size={18} /><span>{S.todo.earlier(earlierTasks, earlierAlarms)}</span><Icon name="chevron-down" size={18} /></summary>
      {#each plan.earlier as it (it.id)}{@render row(it)}{/each}
    </details>
  {/if}

  {#if upcoming.length}
    <p class="small td-ics">{S.lists.alarmsHint}</p>
    <button class="btn wfull" onclick={() => void exportIcs()}><Icon name="calendar" size={18} />{S.lists.exportIcs(upcoming.length + upcomingFlights.length)}</button>
  {/if}

  <a class="card tdcard" href="{base}/todo/packing">
    <span class="well sun"><Icon name="pack" size={20} /></span>
    <span class="tr-body"><b>{S.todo.packing}</b><span class="small">{S.todo.packed(packed, packing.length)}</span></span>
    <Icon name="chevron-right" size={18} />
  </a>
  <a class="card tdcard" href="{base}/todo/lists">
    <span class="well sun"><Icon name="list" size={20} /></span>
    <span class="tr-body"><b>{S.todo.checklists}</b><span class="small">{S.todo.checked(checklists.length, listDone, listItems)}</span></span>
    <Icon name="chevron-right" size={18} />
  </a>

  <div class="td-add">
    <button class="btn" onclick={() => (sheet = { kind: 'task' })}><Icon name="plus" size={18} />{S.todo.addTask}</button>
    <button class="btn" onclick={() => (sheet = { kind: 'alarm' })}><Icon name="plus" size={18} />{S.todo.addAlarm}</button>
  </div>
</main>

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'task'}
    <EditSheet
      spec={taskSpec(trip.id, tasks.length)}
      entity={sheet.entity}
      onsave={(t) => saveEntity(db.tasks, t)}
      ondelete={sheet.entity ? () => deleteEntity(db.tasks, sheet?.entity as Task, 'Task deleted') : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={alarmSpec(trip.id)}
      entity={sheet.entity}
      onsave={(a) => saveEntity(db.alarms, a)}
      ondelete={sheet.entity ? () => deleteEntity(db.alarms, sheet?.entity as Alarm, 'Moment deleted') : undefined}
      onclose={close}
    />
  {/if}
{/if}

<style>
  /* A to-do with its "Remind me" bell (the Reminders run) drops the "Task"
     chip: the round tick and the bell already say what the row is, and the
     title needs the room at 384 px. */
  .trow:has(:global(.remind.iconly)) .chip {
    display: none;
  }
  .td-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-bottom: 6px;
  }
  .td-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .td-caps {
    color: var(--ink-2);
  }
  .td-h1 {
    margin: 0;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1.05;
  }
  .td-count {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 30px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 600;
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  .td-count .num {
    color: var(--sunrise);
  }
  .td-intro {
    margin: 0 auto 12px;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--faint);
  }
  .todo {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tday {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tday-h {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--ink-2);
  }
  .tday.today .tday-h {
    color: var(--sunrise);
  }
  .hline {
    flex: 1;
    height: 1px;
    background: var(--horizon-line);
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 12px 10px 8px;
    border-radius: 20px;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .trow.done {
    background: color-mix(in srgb, var(--card) 60%, transparent);
    box-shadow: none;
  }
  .trow.done .tr-title {
    color: var(--ink-2);
  }
  .trow.late {
    border-color: var(--crit-line);
  }
  .trow.booking {
    border-style: dashed;
    border-color: var(--warn-line);
  }
  .tick,
  .well {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }
  .tick {
    color: var(--ink-2);
    background: transparent;
    border: 2px solid var(--edge);
  }
  .tick.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    box-shadow: var(--glow-sunrise);
  }
  .alarm .tick:not(.on) {
    color: var(--warn);
    border-color: var(--warn-line);
    background: var(--warn-soft);
  }
  .well.warn {
    color: var(--warn);
    background: var(--warn-soft);
    border: 1px dashed var(--warn-line);
  }
  .well.sun {
    border-radius: var(--radius-button-sm);
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  .tr-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tr-meta {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .tr-title {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.35;
  }
  .tr-why {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .why summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--sunrise);
    cursor: pointer;
  }
  .why a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .why :global(div) {
    font-size: var(--fs-caption);
    line-height: 1.5;
    color: var(--ink-2);
  }
  .trow .chip {
    flex-shrink: 0;
  }
  .earlier {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .earlier[open] {
    gap: 8px;
  }
  .earlier summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 18px;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink-2);
    background: var(--chrome);
    border: 1px solid var(--line);
    cursor: pointer;
  }
  .earlier summary::-webkit-details-marker {
    display: none;
  }
  .earlier summary span {
    flex: 1;
  }
  .earlier[open] summary :global(.hicon:last-child) {
    transform: rotate(180deg);
  }
  .earlier > :global(.trow) {
    margin-top: 8px;
  }
  .td-ics {
    margin: 0 2px -6px;
  }
  .tdcard {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: var(--ink);
  }
  .tdcard b {
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .td-add {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
</style>

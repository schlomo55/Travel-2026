<script lang="ts">
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { mutate } from '../lib/data/repo';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { applyTemplate, saveTemplate, templateFromItems } from '../lib/data/templates';
  import { alarmSpec, checklistSpec, packingItemSpec, taskSpec } from '../lib/components/forms/specs';
  import type { Alarm, Checklist, ISODate, PackingItem, PackingTemplate, Task, Trip } from '../lib/model/types';
  import { compareIso, daysBetween, fmtDow, fmtShort } from '../lib/logic/dates';
  import { buildIcs } from '../lib/logic/ics';
  import { downloadBlob } from '../lib/logic/backup';
  import Md from '../lib/components/ui/Md.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    tasks,
    packing,
    checklists,
    alarms,
    now,
    editing = false,
  }: {
    trip: Trip;
    tasks: Task[];
    packing: PackingItem[];
    checklists: Checklist[];
    alarms: Alarm[];
    now: ISODate;
    editing?: boolean;
  } = $props();

  type Sheet =
    | { kind: 'task'; entity?: Task }
    | { kind: 'alarm'; entity?: Alarm }
    | { kind: 'packing'; entity?: PackingItem }
    | { kind: 'checklist'; entity?: Checklist };
  let sheet = $state<Sheet | null>(null);

  const templatesLive = live(() => db.packingTemplates.toArray(), { initial: [] });
  const templates = $derived(templatesLive.current ?? []);

  async function storeTemplate(): Promise<void> {
    const name = prompt('Name this template', `${trip.title} packing`);
    if (!name?.trim()) return;
    await saveTemplate(templateFromItems(name.trim(), packing));
    toast.show('Template saved ✓');
  }
  async function useTemplate(t: PackingTemplate): Promise<void> {
    const added = await applyTemplate(t, trip.id);
    toast.show(added ? `${added} item${added === 1 ? '' : 's'} added` : 'Everything was already on the list');
  }

  type View = 'todo' | 'packing' | 'lists';
  let view = $state<View>('todo');
  let openDetail = $state<string | null>(null);

  const sortedTasks = $derived(
    [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due && b.due) return compareIso(a.due, b.due);
      return a.order - b.order;
    }),
  );
  const openCount = $derived(tasks.filter((t) => !t.done).length);

  const packGroups = $derived.by(() => {
    const m = new Map<string, PackingItem[]>();
    for (const p of [...packing].sort((a, b) => a.order - b.order)) {
      m.set(p.group, [...(m.get(p.group) ?? []), p]);
    }
    return [...m.entries()];
  });
  const packedCount = $derived(packing.filter((p) => p.done).length);
  const upcomingAlarms = $derived(
    [...alarms].sort((a, b) => compareIso(a.date, b.date) || a.time.localeCompare(b.time)),
  );

  function dueClass(t: Task): string {
    if (t.done || !t.due) return '';
    if (compareIso(t.due, now) < 0) return 'overdue';
    return daysBetween(now, t.due) <= 14 ? 'soon' : '';
  }

  const toggleTask = (t: Task) =>
    mutate(() => db.tasks.update(t.id, { done: !t.done, doneAt: t.done ? undefined : Date.now() }));
  const togglePack = (p: PackingItem) => mutate(() => db.packingItems.update(p.id, { done: !p.done }));
  const toggleAlarm = (a: Alarm) => mutate(() => db.alarms.update(a.id, { done: !a.done }));

  async function toggleChecklistItem(list: Checklist, itemId: string): Promise<void> {
    const items = list.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    await mutate(() => db.checklists.update(list.id, { items }));
  }

  function exportIcs(): void {
    if (!upcomingAlarms.length) return;
    const ics = buildIcs(upcomingAlarms, trip, new Date().toISOString());
    const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(`${slug}-alarms.ics`, new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    toast.show(`${upcomingAlarms.length} moments exported`);
  }
</script>

<main class="wrap" style="padding-top:16px">
  <h1 class="pagename">
    {S.tabs.tasks} <span class="pagesub">{openCount} open</span>
  </h1>

  <div class="seg" role="tablist">
    <button role="tab" aria-selected={view === 'todo'} class:on={view === 'todo'} onclick={() => (view = 'todo')}>📋 To do</button>
    <button role="tab" aria-selected={view === 'packing'} class:on={view === 'packing'} onclick={() => (view = 'packing')}>🎒 Packing</button>
    <button role="tab" aria-selected={view === 'lists'} class:on={view === 'lists'} onclick={() => (view = 'lists')}>📱 Lists</button>
  </div>

  {#if view === 'todo'}
    {#if sortedTasks.length === 0}
      <section class="card"><p class="muted" style="margin:0">Nothing to do yet.</p></section>
    {:else}
      <section class="card">
        <h3>Action list <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· by deadline</span></h3>
        <ul class="tasklist">
          {#each sortedTasks as t (t.id)}
            <li class="{dueClass(t)}" class:done={t.done} class:open={openDetail === t.id}>
              <div class="top">
                <input type="checkbox" id="t-{t.id}" checked={t.done} onchange={() => toggleTask(t)} />
                {#if t.dueLabel || t.due}
                  <span class="duetag">
                    {compareIso(t.due ?? '9999', now) < 0 && !t.done ? '⚠ ' : ''}{t.dueLabel ?? fmtShort(t.due ?? '')}
                  </span>
                {/if}
              </div>
              <label class="ttl" for="t-{t.id}"><Md text={t.title} /></label>
              {#if editing}
                <div class="editrow" style="padding-left:32px">
                  <button class="editbtn" onclick={() => (sheet = { kind: 'task', entity: t })}>✎ Edit</button>
                </div>
              {/if}
              {#if t.detail || t.link}
                <button class="more" type="button" onclick={() => (openDetail = openDetail === t.id ? null : t.id)}>
                  {openDetail === t.id ? '⌃ hide' : '⌄ why this matters'}
                </button>
                <div class="det">
                  {#if t.detail}<Md text={t.detail} as="div" />{/if}
                  {#if t.link}<a href={t.link} target="_blank" rel="noopener">Open booking link ↗</a>{/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'task' })}>{S.edit.add('a task')}</button>
    {/if}

    {#if upcomingAlarms.length || editing}
      <section class="card warn">
        <h3>⏰ Set these as phone alarms</h3>
        <p class="muted" style="margin:0 0 8px">
          Sojourn can't ring while it's closed. These are the miss-it-lose-it moments — put them in
          the phone calendar, which does ring.
        </p>
        <ul class="klist">
          {#each upcomingAlarms as a (a.id)}
            <li class:done={a.done}>
              <input type="checkbox" id="a-{a.id}" checked={a.done} onchange={() => toggleAlarm(a)} />
              <span class="due">{fmtShort(a.date)}<br />{a.time}</span>
              <label for="a-{a.id}">
                <Md text={a.title} />
                {#if a.why}<span class="det2"><Md text={a.why} /></span>{/if}
              </label>
              {#if editing}
                <button class="editbtn" onclick={() => (sheet = { kind: 'alarm', entity: a })} aria-label="Edit">✎</button>
              {/if}
            </li>
          {/each}
        </ul>
        {#if upcomingAlarms.length}
          <button class="btn primary wfull" style="margin-top:11px" onclick={exportIcs}>
            📅 Add all {upcomingAlarms.length} to the calendar (.ics)
          </button>
        {/if}
      </section>
      {#if editing}
        <button class="addbtn" onclick={() => (sheet = { kind: 'alarm' })}>{S.edit.add('a timed moment')}</button>
      {/if}
    {/if}
  {:else if view === 'packing'}
    {#if packing.length === 0}
      <section class="card"><p class="muted" style="margin:0">Nothing on the packing list yet.</p></section>
    {:else}
      <section class="card">
        <h3>Packing <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· {packedCount}/{packing.length} packed</span></h3>
        <div class="meter"><i style="width:{packing.length ? (packedCount / packing.length) * 100 : 0}%"></i></div>
      </section>
      {#each packGroups as [group, items] (group)}
        <section class="card">
          <h3><Md text={group} /></h3>
          <ul class="klist">
            {#each items as p (p.id)}
              <li class:done={p.done}>
                <input type="checkbox" id="p-{p.id}" checked={p.done} onchange={() => togglePack(p)} />
                <label for="p-{p.id}"><Md text={p.label} /></label>
                {#if editing}
                  <button class="editbtn" onclick={() => (sheet = { kind: 'packing', entity: p })} aria-label="Edit">✎</button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'packing' })}>{S.edit.add('a packing item')}</button>

      <section class="card">
        <h3>Templates <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· reuse across trips</span></h3>
        <p class="muted" style="margin:0 0 10px">
          Save this list once and the next trip starts from it instead of from nothing.
        </p>
        {#each templates as t (t.id)}
          <div class="trow">
            <span>{t.name} <span class="small">· {t.groups.reduce((n, g) => n + g.items.length, 0)} items</span></span>
            <button class="btn ghost small-btn" onclick={() => useTemplate(t)}>Apply</button>
          </div>
        {/each}
        <button class="btn wfull" style="margin-top:10px" onclick={storeTemplate} disabled={packing.length === 0}>
          💾 Save this list as a template
        </button>
      </section>
    {/if}
  {:else}
    {#if checklists.length === 0}
      <section class="card"><p class="muted" style="margin:0">No checklists yet.</p></section>
    {/if}
    {#each [...checklists].sort((a, b) => a.order - b.order) as list (list.id)}
      <section class="card">
        <h3>
          {list.title}
          {#if editing}
            <button class="editbtn" style="float:right" onclick={() => (sheet = { kind: 'checklist', entity: list })} aria-label="Edit">✎</button>
          {/if}
        </h3>
        {#if list.note}<p class="muted" style="margin:0 0 6px">{list.note}</p>{/if}
        <ul class="klist">
          {#each list.items as it (it.id)}
            <li class:done={it.done}>
              <input type="checkbox" id="c-{it.id}" checked={it.done} onchange={() => toggleChecklistItem(list, it.id)} />
              <label for="c-{it.id}"><Md text={it.label} /></label>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
    {#if editing}
      <button class="addbtn" onclick={() => (sheet = { kind: 'checklist' })}>{S.edit.add('a checklist')}</button>
    {/if}
  {/if}

  <footer class="foot">{fmtDow(now)}</footer>
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
  {:else if sheet.kind === 'alarm'}
    <EditSheet
      spec={alarmSpec(trip.id)}
      entity={sheet.entity}
      onsave={(a) => saveEntity(db.alarms, a)}
      ondelete={sheet.entity ? () => deleteEntity(db.alarms, sheet?.entity as Alarm, 'Moment deleted') : undefined}
      onclose={close}
    />
  {:else if sheet.kind === 'packing'}
    <EditSheet
      spec={packingItemSpec(trip.id, packGroups.map(([g]) => g), packing.length)}
      entity={sheet.entity}
      onsave={(p) => saveEntity(db.packingItems, p)}
      ondelete={sheet.entity ? () => deleteEntity(db.packingItems, sheet?.entity as PackingItem, 'Item deleted') : undefined}
      onclose={close}
    />
  {:else}
    <EditSheet
      spec={checklistSpec(trip.id, checklists.length)}
      entity={sheet.entity}
      onsave={(c) => saveEntity(db.checklists, c)}
      ondelete={sheet.entity ? () => deleteEntity(db.checklists, sheet?.entity as Checklist, 'Checklist deleted') : undefined}
      onclose={close}
    />
  {/if}
{/if}

<style>
  .tasklist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tasklist li {
    display: block;
    padding: 12px 0;
    border-bottom: 1px dashed var(--line);
  }
  .tasklist li:last-child {
    border-bottom: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .top input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  .duetag {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    border-radius: 16px;
    padding: 3px 10px;
    border: 1px solid var(--line-2);
    color: var(--ink-2);
    white-space: nowrap;
  }
  li.overdue .duetag {
    color: #fff;
    background: var(--crit);
    border-color: var(--crit);
  }
  li.soon .duetag {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 50%, var(--line));
  }
  .ttl {
    display: block;
    cursor: pointer;
    font-size: 14.5px;
    line-height: 1.45;
    padding-left: 32px;
  }
  li.done .ttl {
    color: var(--faint);
    text-decoration: line-through;
  }
  .more {
    background: none;
    border: none;
    color: var(--accent-deep);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    padding: 7px 0 0 32px;
    text-transform: uppercase;
  }
  .det {
    display: none;
    font-size: 13px;
    color: var(--ink-2);
    margin: 7px 0 0 32px;
    padding-left: 11px;
    border-left: 2px solid var(--line-2);
    line-height: 1.55;
  }
  li.open .det {
    display: block;
  }
  .klist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .klist li {
    display: flex;
    gap: 11px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px dashed var(--line);
  }
  .klist li:last-child {
    border-bottom: none;
  }
  .klist input[type='checkbox'] {
    width: 21px;
    height: 21px;
    accent-color: var(--accent);
    transform: translateY(3px);
    flex-shrink: 0;
  }
  .klist label {
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }
  .klist li.done label {
    color: var(--faint);
    text-decoration: line-through;
  }
  .klist .due {
    font-weight: 700;
    font-size: 11px;
    white-space: nowrap;
    min-width: 58px;
    color: var(--accent-deep);
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
  }
  .det2 {
    display: block;
    font-size: 12.5px;
    color: var(--ink-2);
    margin-top: 3px;
  }
  .meter {
    height: 6px;
    border-radius: 3px;
    background: var(--paper-2);
    overflow: hidden;
    margin-top: 4px;
  }
  .meter i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--line);
  }
  .trow span:first-child {
    flex: 1;
  }
  .small-btn {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 12.5px;
  }
</style>

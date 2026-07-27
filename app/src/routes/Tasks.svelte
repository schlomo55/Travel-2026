<script lang="ts">
  /* Lists — to-dos, packing and checklists (plan §SCREENS 4, finished in Phase 2).

     Blue is the app's only progress colour: the packing ring, every checkbox,
     the FAB. Gold never marks completion and blue never marks brand. Urgency
     rides on the text colour of the due tag — gold → warn → crit — rather than
     on a new component per state.

     Phase 2 finished the two sub-views the mockups never covered. To-dos and
     checklists now speak packing's language: rows straight on the canvas under
     a big header, hairlines instead of card walls, and one checkbox shape
     everywhere. Every checkbox carries a 44 px hit area it does not draw.

     All three segments now open with the same ring, because "how far along am
     I" is the question the tab is asked, and it was only being answered for
     the rucksack. A segment with nothing in it still gets its empty state
     instead: a ring at 0% would dress an empty list up as an unfinished one. */
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { mutate } from '../lib/data/repo';
  import { deleteEntity, plain, saveEntity } from '../lib/data/edit';
  import { applyTemplate, saveTemplate, templateFromItems } from '../lib/data/templates';
  import { alarmSpec, checklistSpec, packingItemSpec, taskSpec } from '../lib/components/forms/specs';
  import type { Alarm, Checklist, ISODate, PackingItem, PackingTemplate, Task, Trip } from '../lib/model/types';
  import { compareIso, daysBetween, fmtDow, fmtShort } from '../lib/logic/dates';
  import { buildIcs } from '../lib/logic/ics';
  import { downloadBlob } from '../lib/logic/backup';
  import Md from '../lib/components/ui/Md.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import ProgressRing from '../lib/components/ui/ProgressRing.svelte';
  import { tallyChecklists } from '../lib/logic/progress';
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
    const name = prompt(S.lists.nameTemplate, `${trip.title} packing`);
    if (!name?.trim()) return;
    await saveTemplate(templateFromItems(name.trim(), packing));
    toast.show(S.lists.templateSaved);
  }
  async function useTemplate(t: PackingTemplate): Promise<void> {
    const added = await applyTemplate(t, trip.id);
    toast.show(added ? S.lists.applied(added) : S.lists.alreadyThere);
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
  const doneTaskCount = $derived(tasks.length - openCount);

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
  const doneOf = (l: Checklist): number => l.items.filter((i) => i.done).length;
  /* Every checklist counted as one list — the ring answers "how much of the
     pre-flight is behind me", not "how far into list three am I". */
  const checkTally = $derived(tallyChecklists(checklists));

  const toggleTask = (t: Task) =>
    mutate(() => db.tasks.update(t.id, { done: !t.done, doneAt: t.done ? undefined : Date.now() }));
  const togglePack = (p: PackingItem) => mutate(() => db.packingItems.update(p.id, { done: !p.done }));
  const toggleAlarm = (a: Alarm) => mutate(() => db.alarms.update(a.id, { done: !a.done }));

  /* plain() first: the items arrive through liveQuery → $state, so they are
     deep proxies, and IndexedDB cannot structured-clone a Proxy. Without it
     every tick threw a DataCloneError into a floating promise — the box drew
     itself blue for one frame and the trip forgot it. The ring above made the
     silence loud, which is how it was found. */
  async function toggleChecklistItem(list: Checklist, itemId: string): Promise<void> {
    const items = plain(list.items).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    await mutate(() => db.checklists.update(list.id, { items }));
  }

  function exportIcs(): void {
    if (!upcomingAlarms.length) return;
    const ics = buildIcs(upcomingAlarms, trip, new Date().toISOString());
    const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(`${slug}-alarms.ics`, new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    toast.show(S.lists.exported(upcomingAlarms.length));
  }

  /* The FAB adds whatever the open segment is about. */
  function addHere(): void {
    sheet = view === 'packing' ? { kind: 'packing' } : view === 'lists' ? { kind: 'checklist' } : { kind: 'task' };
  }
</script>

<main class="wrap" style="padding-top:14px">
  <h1 class="bigtitle">{S.lists.title} <span class="sub">{S.lists.open(openCount)}</span></h1>

  <div class="seg" role="tablist">
    <button role="tab" aria-selected={view === 'todo'} class:on={view === 'todo'} onclick={() => (view = 'todo')}>📋 {S.lists.todo}</button>
    <button role="tab" aria-selected={view === 'packing'} class:on={view === 'packing'} onclick={() => (view = 'packing')}>🎒 {S.lists.packing}</button>
    <button role="tab" aria-selected={view === 'lists'} class:on={view === 'lists'} onclick={() => (view = 'lists')}>📱 {S.lists.checklists}</button>
  </div>

  {#if view === 'todo'}
    {#if sortedTasks.length === 0}
      <EmptyState
        glyph={S.empty.tasks.glyph}
        title={S.empty.tasks.title}
        body={S.empty.tasks.body}
        actionLabel={S.empty.tasks.action}
        onaction={() => (sheet = { kind: 'task' })}
      />
    {:else}
      <ProgressRing id="todo" done={doneTaskCount} total={tasks.length} label={S.lists.done} />
      <h2 class="seclabel">
        {S.lists.actionList}
        <span class="sub">{S.lists.byDeadline} · {S.lists.open(openCount)}</span>
      </h2>
      <ul class="tasklist u-stagger">
        {#each sortedTasks as t (t.id)}
          <li class="{dueClass(t)}" class:done={t.done} class:open={openDetail === t.id}>
            <div class="top">
              <button class="cbox" class:on={t.done} onclick={() => toggleTask(t)} aria-pressed={t.done} aria-label={t.done ? 'Undo' : 'Done'}>✓</button>
              <span class="ttl"><Md text={t.title} /></span>
              {#if t.dueLabel || t.due}
                <span class="duetag">
                  {compareIso(t.due ?? '9999', now) < 0 && !t.done ? '⚠ ' : ''}{t.dueLabel ?? fmtShort(t.due ?? '')}
                </span>
              {/if}
            </div>
            {#if editing}
              <div class="editrow" style="padding-left:47px">
                <button class="editbtn" onclick={() => (sheet = { kind: 'task', entity: t })}>✎ {S.edit.turnOn}</button>
              </div>
            {/if}
            {#if t.detail || t.link}
              <button class="more" type="button" onclick={() => (openDetail = openDetail === t.id ? null : t.id)}>
                {openDetail === t.id ? `⌃ ${S.lists.hideWhy}` : `⌄ ${S.lists.why}`}
              </button>
              <div class="det">
                {#if t.detail}<Md text={t.detail} as="div" />{/if}
                {#if t.link}<a href={t.link} target="_blank" rel="noopener">{S.lists.openLink}</a>{/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="seclabel">
      ⏰ {S.lists.alarms}
      <span class="sub">{S.lists.alarmsHint}</span>
    </h2>
    {#if upcomingAlarms.length === 0}
      <EmptyState
        compact
        glyph={S.empty.alarms.glyph}
        title={S.empty.alarms.title}
        body={S.empty.alarms.body}
        actionLabel={S.empty.alarms.action}
        onaction={() => (sheet = { kind: 'alarm' })}
      />
    {:else}
      <section class="card warn">
        <ul class="klist">
          {#each upcomingAlarms as a (a.id)}
            <li class:done={a.done}>
              <button class="cbox sm" class:on={a.done} onclick={() => toggleAlarm(a)} aria-pressed={a.done} aria-label={a.done ? 'Undo' : 'Done'}>✓</button>
              <span class="stub mono">{fmtShort(a.date)}<br />{a.time}</span>
              <span class="lb">
                <Md text={a.title} />
                {#if a.why}<span class="det2"><Md text={a.why} /></span>{/if}
              </span>
              {#if editing}
                <button class="editbtn" onclick={() => (sheet = { kind: 'alarm', entity: a })} aria-label="Edit">✎</button>
              {/if}
            </li>
          {/each}
        </ul>
        <button class="btn primary wfull" style="margin-top:13px" onclick={exportIcs}>
          📅 {S.lists.exportIcs(upcomingAlarms.length)}
        </button>
      </section>
      {#if editing}
        <button class="addbtn" onclick={() => (sheet = { kind: 'alarm' })}>{S.edit.add(S.lists.addAlarm)}</button>
      {/if}
    {/if}
  {:else if view === 'packing'}
    {#if packing.length === 0}
      <EmptyState
        glyph={S.empty.packing.glyph}
        title={S.empty.packing.title}
        body={S.empty.packing.body}
        actionLabel={S.empty.packing.action}
        onaction={() => (sheet = { kind: 'packing' })}
      />
    {:else}
      <ProgressRing id="packing" done={packedCount} total={packing.length} label={S.lists.packed} />
      <div class="plist">
        {#each packGroups as [group, items] (group)}
          <h2 class="pgroup"><Md text={group} /></h2>
          {#each items as p (p.id)}
            <div class="pitem" class:done={p.done}>
              <button class="cbox" class:on={p.done} onclick={() => togglePack(p)} aria-pressed={p.done} aria-label={p.done ? 'Unpack' : 'Packed'}>✓</button>
              <span class="plabel"><Md text={p.label} /></span>
              {#if editing}
                <button class="editbtn" onclick={() => (sheet = { kind: 'packing', entity: p })} aria-label="Edit">✎</button>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    {/if}
    {#if editing}
      <h2 class="seclabel">
        {S.lists.templates}
        <span class="sub">{S.lists.templatesSub} · {S.lists.templatesHint}</span>
      </h2>
      {#if templates.length === 0}
        <EmptyState compact glyph={S.empty.templates.glyph} title={S.empty.templates.title} body={S.empty.templates.body} />
      {:else}
        <section class="card">
          {#each templates as t (t.id)}
            <div class="trow">
              <span>{t.name} <span class="small">· {S.lists.itemCount(t.groups.reduce((n, g) => n + g.items.length, 0))}</span></span>
              <button class="btn ghost small-btn" onclick={() => useTemplate(t)}>{S.lists.apply}</button>
            </div>
          {/each}
        </section>
      {/if}
      <button class="btn wfull" onclick={storeTemplate} disabled={packing.length === 0}>
        💾 {S.lists.saveTemplate}
      </button>
    {/if}
  {:else}
    {#if checklists.length === 0}
      <EmptyState
        glyph={S.empty.checklists.glyph}
        title={S.empty.checklists.title}
        body={S.empty.checklists.body}
        actionLabel={S.empty.checklists.action}
        onaction={() => (sheet = { kind: 'checklist' })}
      />
    {:else if checkTally.total > 0}
      <!-- Lists that exist but hold no items yet get no ring: 0/0 is not progress. -->
      <ProgressRing id="checklists" done={checkTally.done} total={checkTally.total} label={S.lists.done} />
    {/if}
    {#each [...checklists].sort((a, b) => a.order - b.order) as list (list.id)}
      {@const done = doneOf(list)}
      <section class="card" class:lit={done > 0 && done < list.items.length}>
        <div class="lhead">
          <h3>{list.title}</h3>
          {#if list.items.length}
            <span class="chip" class:done={done === list.items.length}>{done}/{list.items.length}</span>
          {/if}
          {#if editing}
            <button class="editbtn" onclick={() => (sheet = { kind: 'checklist', entity: list })} aria-label="Edit">✎</button>
          {/if}
        </div>
        {#if list.note}<p class="muted" style="margin:0 0 6px">{list.note}</p>{/if}
        <ul class="klist">
          {#each list.items as it (it.id)}
            <li class:done={it.done}>
              <button class="cbox sm" class:on={it.done} onclick={() => toggleChecklistItem(list, it.id)} aria-pressed={it.done} aria-label={it.done ? 'Undo' : 'Done'}>✓</button>
              <span class="lb"><Md text={it.label} /></span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}

  <footer class="foot">{fmtDow(now)}</footer>
</main>

<button class="fab" onclick={addHere} aria-label={S.lists.addItem}>＋</button>

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
  .bigtitle {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 2px 2px 12px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .bigtitle .sub {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--faint);
  }

  /* ---------- the one checkbox, everywhere ----------
     34 px of drawing inside a 44 px hit area. The ::after is the target: it
     costs no layout, so the rows keep their rhythm while a cold thumb still
     lands. */
  .cbox {
    position: relative;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 2.5px solid var(--line-2);
    background: none;
    display: grid;
    place-items: center;
    color: transparent;
    font-size: 16px;
    font-weight: 800;
    transition:
      border-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }
  .cbox::after {
    content: '';
    position: absolute;
    inset: -5px;
  }
  .cbox.sm {
    width: 28px;
    height: 28px;
    border-radius: 9px;
    font-size: 14px;
  }
  .cbox.sm::after {
    inset: -8px;
  }
  .cbox.on {
    border-color: var(--neon);
    color: var(--neon);
    box-shadow: var(--glow-neon);
  }

  /* ---------- packing ---------- */
  .plist {
    padding: 6px 2px 0;
  }
  .pgroup {
    font-size: 20px;
    font-weight: 800;
    margin: 18px 0 4px;
  }
  .pitem {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }
  .plabel {
    flex: 1;
    min-width: 0;
    font-size: 16px;
    font-weight: 500;
  }
  .pitem.done .plabel {
    color: var(--ink-2);
    text-decoration: line-through;
  }

  /* ---------- to-dos: packing's language, with a deadline ---------- */
  .tasklist {
    margin: 0 2px;
    padding: 0;
    list-style: none;
  }
  .tasklist li {
    display: block;
    padding: 9px 0;
    border-bottom: 1px dashed var(--line);
  }
  .tasklist li:last-child {
    border-bottom: none;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .ttl {
    flex: 1;
    min-width: 0;
    font-size: 15.5px;
    line-height: 1.4;
  }
  li.done .ttl {
    color: var(--ink-2);
    text-decoration: line-through;
  }
  .duetag {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--gold-deep);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  li.soon .duetag {
    color: var(--warn);
  }
  li.overdue .duetag {
    color: var(--crit);
  }
  .more {
    background: none;
    border: none;
    color: var(--gold-deep);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    padding: 0 0 0 47px;
    min-height: 40px;
    text-align: left;
    text-transform: uppercase;
  }
  .det {
    display: none;
    font-size: 13.5px;
    color: var(--ink-2);
    margin: 2px 0 6px 47px;
    padding-left: 12px;
    border-left: 2px solid var(--gold-dim);
    line-height: 1.55;
  }
  li.open .det {
    display: block;
  }

  /* ---------- alarms & checklists ---------- */
  .lhead {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 8px;
  }
  .lhead h3 {
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .klist {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .klist li {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--line);
  }
  .klist li:last-child {
    border-bottom: none;
  }
  .klist .lb {
    flex: 1;
    min-width: 0;
    font-size: 14.5px;
  }
  .klist li.done .lb {
    color: var(--ink-2);
    text-decoration: line-through;
  }
  /* the ticket stub a date-and-time makes when it is the point of the row */
  .stub {
    flex: 0 0 auto;
    min-width: 62px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.45;
    color: var(--gold-light);
    background: var(--accent-soft);
    border: 1px dashed color-mix(in srgb, var(--gold) 45%, transparent);
    border-radius: 9px;
    padding: 5px 6px;
    font-variant-numeric: tabular-nums;
  }
  .det2 {
    display: block;
    font-size: 12.5px;
    color: var(--ink-2);
    margin-top: 3px;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--line);
  }
  .trow:last-child {
    border-bottom: none;
  }
  .trow span:first-child {
    flex: 1;
  }
  .small-btn {
    min-height: 44px;
    padding: 6px 16px;
    font-size: 12.5px;
  }

  /* ---------- the add button ---------- */
  .fab {
    position: fixed;
    right: max(18px, calc(50vw - 220px + 18px));
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 18px);
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: none;
    background: var(--neon);
    color: var(--on-neon);
    font-size: 26px;
    line-height: 1;
    box-shadow: var(--glow-neon), 0 8px 22px rgba(0, 0, 0, 0.55);
    z-index: 55;
  }
  .fab:active {
    transform: translateY(1px);
  }
</style>

<script lang="ts">
  /* THE PACKING LIST AND THE CHECKLISTS (To do › Packing, To do ›
     Checklists) — the lists you run once, each with the sun arc as its
     progress (Horizon's progress indicator: the sun climbs as the list gets
     done). Every tick is one write; edit mode adds and edits, and packing
     keeps its templates (reuse across trips). */
  import type { Checklist, PackingItem, PackingTemplate, Trip } from '../../model/types';
  import { db } from '../../db/db';
  import { live } from '../../data/live.svelte';
  import { mutate } from '../../data/repo';
  import { deleteEntity, plain, saveEntity } from '../../data/edit';
  import { applyTemplate, saveTemplate, templateFromItems } from '../../data/templates';
  import { checklistSpec, packingItemSpec } from '../forms/specs';
  import { arcPoint } from '../../logic/glance';
  import { mdliteToText } from '../../logic/mdlite';
  import { tallyChecklists } from '../../logic/progress';
  import { toast } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import SubHeader from '../horizon/SubHeader.svelte';
  import Md from '../ui/Md.svelte';
  import EditSheet from '../ui/EditSheet.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let {
    trip,
    packing,
    checklists,
    view,
    editing,
  }: {
    trip: Trip;
    packing: PackingItem[];
    checklists: Checklist[];
    view: string;
    editing: boolean;
  } = $props();

  const isPacking = $derived(view === 'packing');
  const up = $derived(`#/trip/${encodeURIComponent(trip.id)}/now/todo`);

  const groups = $derived.by(() => {
    const m = new Map<string, PackingItem[]>();
    for (const p of [...packing].sort((a, b) => a.order - b.order)) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  });
  const packed = $derived(packing.filter((p) => p.done).length);
  const tally = $derived(tallyChecklists(checklists));
  const lists = $derived([...checklists].sort((a, b) => a.order - b.order));

  const togglePack = (p: PackingItem) => mutate(() => db.packingItems.update(p.id, { done: !p.done }));
  /* plain() first: the items arrive through liveQuery as deep proxies, and
     IndexedDB cannot clone a Proxy — the tick would throw and un-tick. */
  async function toggleItem(list: Checklist, itemId: string): Promise<void> {
    const items = plain(list.items).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    await mutate(() => db.checklists.update(list.id, { items }));
  }

  const templatesLive = live(() => db.packingTemplates.toArray(), { initial: [] });
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

  type Sheet = { kind: 'packing'; entity?: PackingItem } | { kind: 'checklist'; entity?: Checklist };
  let sheet = $state<Sheet | null>(null);
</script>

{#snippet arc(done: number, total: number, label: string)}
  {@const p = total ? done / total : 0}
  {@const sun = arcPoint(p, 60, 58, 48)}
  <div class="sunarc" role="img" aria-label="{done} of {total} {label}">
    <svg viewBox="0 0 120 66" aria-hidden="true">
      <path class="sa-track" d="M12 58 A48 48 0 0 1 108 58" />
      {#if p > 0}<path class="sa-lit" d="M12 58 A48 48 0 0 1 {sun.x} {sun.y}" />{/if}
      <path class="sa-line" d="M0 60H120" />
      <circle class="sa-sun" cx={sun.x} cy={sun.y} r="6" />
    </svg>
    <span class="pct num">{Math.round(p * 100)}%</span>
    <span class="sa-foot"><span class="pcount num">{done}/{total}</span> <span class="plab">{label}</span></span>
  </div>
{/snippet}

<SubHeader title={isPacking ? S.todo.packing : S.todo.checklists} subtitle={S.todo.title} {up} backLabel={S.todo.back} editable />

<main class="wrap lists">
  {#if isPacking}
    {#if packing.length}
      {@render arc(packed, packing.length, S.lists.packed)}
      {#each groups as [group, items] (group)}
        <h2 class="seclabel"><Md text={group} /></h2>
        <div class="card lgroup">
          {#each items as p (p.id)}
            <div class="litem" class:done={p.done}>
              <button class="ltick" class:on={p.done} onclick={() => togglePack(p)} aria-pressed={p.done} aria-label={mdliteToText(p.label)}>
                {#if p.done}<Icon name="check" size={16} stroke={2.6} />{/if}
              </button>
              <span class="llabel"><Md text={p.label} /></span>
              {#if editing}<button class="editbtn" onclick={() => (sheet = { kind: 'packing', entity: p })} aria-label={S.edit.item(mdliteToText(p.label))}><Icon name="edit" size={16} /></button>{/if}
            </div>
          {/each}
        </div>
      {/each}
    {:else}
      <EmptyState glyph={S.empty.packing.glyph} title={S.empty.packing.title} body={S.empty.packing.body} />
    {/if}
    <button class="btn wfull ladd" onclick={() => (sheet = { kind: 'packing' })}><Icon name="plus" size={18} />{S.lists.addItem}</button>
    {#if editing}
      <h2 class="seclabel">{S.lists.templates}<span class="sub">{S.lists.templatesSub} · {S.lists.templatesHint}</span></h2>
      {#each templatesLive.current ?? [] as t (t.id)}
        <div class="card ltpl">
          <span>{t.name} <span class="small">· {S.lists.itemCount(t.groups.reduce((n, g) => n + g.items.length, 0))}</span></span>
          <button class="btn ghost" onclick={() => useTemplate(t)}>{S.lists.apply}</button>
        </div>
      {/each}
      <button class="btn wfull" onclick={storeTemplate} disabled={!packing.length}><Icon name="download" size={18} />{S.lists.saveTemplate}</button>
    {/if}
  {:else}
    {#if tally.total}{@render arc(tally.done, tally.total, S.lists.done)}{/if}
    {#if !lists.length}
      <EmptyState glyph={S.empty.checklists.glyph} title={S.empty.checklists.title} body={S.empty.checklists.body} />
    {/if}
    {#each lists as list (list.id)}
      {@const done = list.items.filter((i) => i.done).length}
      <section class="card lgroup">
        <div class="lhead">
          <h2 class="lh">{list.title}</h2>
          {#if list.items.length}<span class="chip" class:ok={done === list.items.length}>{done}/{list.items.length}</span>{/if}
          {#if editing}<button class="editbtn" onclick={() => (sheet = { kind: 'checklist', entity: list })} aria-label={S.edit.item(list.title)}><Icon name="edit" size={16} /></button>{/if}
        </div>
        {#if list.note}<p class="muted">{list.note}</p>{/if}
        {#each list.items as it (it.id)}
          <div class="litem" class:done={it.done}>
            <button class="ltick" class:on={it.done} onclick={() => toggleItem(list, it.id)} aria-pressed={it.done} aria-label={mdliteToText(it.label)}>
              {#if it.done}<Icon name="check" size={16} stroke={2.6} />{/if}
            </button>
            <span class="llabel"><Md text={it.label} /></span>
          </div>
        {/each}
      </section>
    {/each}
    <button class="btn wfull ladd" onclick={() => (sheet = { kind: 'checklist' })}><Icon name="plus" size={18} />{S.empty.checklists.action}</button>
  {/if}
</main>

{#if sheet}
  {@const close = () => (sheet = null)}
  {#if sheet.kind === 'packing'}
    <EditSheet
      spec={packingItemSpec(trip.id, groups.map(([g]) => g), packing.length)}
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
  .lists {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 8px;
  }
  .sunarc {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 4px auto 6px;
    width: 220px;
  }
  .sunarc svg {
    width: 220px;
    height: 121px;
    overflow: visible;
  }
  .sa-track,
  .sa-lit {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
  }
  .sa-track {
    stroke: var(--line);
  }
  .sa-lit {
    stroke: var(--opal-2);
  }
  .sa-line {
    stroke: var(--ridge-edge);
  }
  .sa-sun {
    fill: var(--sunrise-fill);
    filter: var(--glow-sun);
  }
  .pct {
    position: absolute;
    top: 64px;
    font-size: var(--fs-countdown);
    font-weight: 500;
    color: var(--sunrise);
  }
  .sa-foot {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .lgroup {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 6px 14px;
  }
  .lhead {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
  }
  .lh {
    flex: 1;
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .litem {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    border-bottom: 1px solid var(--line);
  }
  .litem:last-child {
    border-bottom: none;
  }
  .ltick {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    color: var(--on-sunrise);
    background: transparent;
    border: 2px solid var(--edge);
  }
  .ltick.on {
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
  }
  .llabel {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-row);
  }
  .litem.done .llabel {
    color: var(--ink-2);
    text-decoration: line-through;
  }
  .ladd {
    margin-top: 4px;
  }
  .ltpl {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
  }
  .ltpl span:first-child {
    flex: 1;
  }
</style>

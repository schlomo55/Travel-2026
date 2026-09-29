<script lang="ts">
  /* EMERGENCY — the numbers you would want at 3 a.m. A number is dialled,
     not read: it gets the big mono face and a call button that is the whole
     right-hand side of its row. A web address or a still-to-come line is not
     something you read out in an emergency, and is not typeset as one; a
     line the trip file marks pending says so in amber and dials nothing. */
  import type { EmergencyContact } from '../../model/types';
  import { copyText } from '../../state/toast.svelte';
  import { mdliteToText } from '../../logic/mdlite';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  let {
    contacts,
    editing,
    onedit,
    onadd,
  }: {
    contacts: EmergencyContact[];
    editing: boolean;
    onedit: (c: EmergencyContact) => void;
    onadd: () => void;
  } = $props();

  const sorted = $derived([...contacts].sort((a, b) => a.order - b.order));
  const tel = (v: string): string => `tel:${v.replace(/[^0-9+]/g, '')}`;
</script>

{#if sorted.length === 0}
  <EmptyState glyph="phone" title={S.empty.emergency.title} body={S.empty.emergency.body} actionLabel={S.empty.emergency.action} onaction={onadd} />
{:else}
  <p class="em-sub">{S.info.emergencySub}</p>
  <ul class="zhlist emlist" id="emergency">
    {#each sorted as e (e.id)}
      <li class="em" class:dial={e.kind === 'phone' && !e.pending}>
        <span class="txt static">
          <span class="ev" class:num={e.kind === 'phone'} class:pend={e.pending}>
            {e.value}{#if e.verify}<span class="chip warn vfy">{S.plan.verify}</span>{/if}
          </span>
          <span class="en"><Md text={e.label} /></span>
        </span>
        {#if e.kind === 'phone' && !e.pending}
          <a class="callbtn" href={tel(e.value)} aria-label={S.pocket.call(e.value)}>
            <Icon name="phone" size={18} stroke={2} />
            <span>{S.info.call}</span>
          </a>
        {:else if !e.pending}
          <button class="rowbtn" onclick={() => copyText(e.value)} aria-label={S.info.copy}><Icon name="copy" size={17} /></button>
        {/if}
        {#if editing}
          <button class="editbtn" onclick={() => onedit(e)} aria-label={S.edit.item(mdliteToText(e.label))}><Icon name="edit" size={15} /></button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if editing}
  <button class="addbtn" onclick={onadd}>{S.edit.add('an emergency contact')}</button>
{/if}

<style>
  .em-sub {
    margin: 4px 4px 12px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .emlist {
    list-style: none;
    margin: 0 0 12px;
    padding: 4px 14px;
    border-radius: var(--radius-card);
    background:
      linear-gradient(180deg, var(--crit-soft), transparent 40%),
      var(--card);
    border: 1px solid color-mix(in srgb, var(--crit) 40%, transparent);
    box-shadow: var(--shadow-card);
  }
  .em {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .em:last-child {
    border-bottom: none;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ev {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
  }
  .ev.num {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .ev.pend {
    font-family: var(--font-ui);
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--warn-ink);
  }
  .vfy {
    font-family: var(--font-ui);
    min-height: 22px;
    padding: 0 8px;
    font-size: var(--fs-caps);
  }
  .en {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .callbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 16px;
    border-radius: 999px;
    text-decoration: none;
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--crit-ink);
    background: var(--crit-soft);
    border: 1px solid color-mix(in srgb, var(--crit) 55%, transparent);
  }
  .rowbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-button-sm);
    border: 1px solid var(--line);
    background: var(--card-2);
    color: var(--ink);
  }
</style>

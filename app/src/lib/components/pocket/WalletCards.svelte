<script lang="ts">
  /* THE CARDS — the numbers you read out at a counter that are not a
     booking: a passport, an insurance policy, a deposit. Each is shown in
     full on the phone (the code copies with one tap, and opens in Counter
     mode for a desk), with the rows, balance and note the trip file gives
     it — and nothing it does not. */
  import type { WalletCard } from '../../model/types';
  import { codeGroups } from '../../logic/pass';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  let {
    cards,
    editing,
    oncounter,
    onedit,
    onadd,
  }: {
    cards: WalletCard[];
    editing: boolean;
    oncounter: (c: WalletCard) => void;
    onedit: (c: WalletCard) => void;
    onadd: () => void;
  } = $props();

  const sorted = $derived([...cards].sort((a, b) => a.order - b.order));
  const gmail = (q: string): string => `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`;
  /* A balance, in the currency it was entered in — never converted. */
  function money(minor: number, cur: string): string {
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'ILS' ? '₪' : '';
    return `${sym}${(minor / 100).toFixed(2)}${sym ? '' : ` ${cur}`}`;
  }
</script>

{#if sorted.length === 0}
  <EmptyState glyph="card" title={S.empty.cards.title} body={S.empty.cards.body} actionLabel={S.empty.cards.action} onaction={onadd} />
{/if}

<div class="wcards">
  {#each sorted as c (c.id)}
    <article class="wc" class:pending={c.pending} id="wc-{c.id}">
      <header class="wc-head">
        <span class="wc-ic" aria-hidden="true"><Icon name="card" size={18} /></span>
        <h2 class="wc-title"><Md text={c.title} /></h2>
        {#if c.pending}<span class="chip warn">{S.chip.pending}</span>{/if}
      </header>

      {#if c.code}
        <div class="wc-code">
          <span class="wc-k">{c.codeLabel ?? S.pocket.number}</span>
          <div class="wc-coderow">
            <button class="num code-big" onclick={() => copyText(c.code ?? '', c.codeLabel ?? '')}>
              {#each codeGroups(c.code) as g, i (i)}<span class="grp">{g}</span>{/each}
            </button>
            <button class="wc-copy" onclick={() => copyText(c.code ?? '', c.codeLabel ?? '')} aria-label={S.pocket.copyNumber}>
              <Icon name="copy" size={17} />
            </button>
          </div>
        </div>
      {/if}

      {#if c.rows.length}
        <dl class="wc-rows">
          {#each c.rows as r, i (i)}
            <div class="wc-row"><dt>{r.k}</dt><dd>{r.v}</dd></div>
          {/each}
        </dl>
      {/if}

      {#if c.balance}
        <div class="wc-bal">
          <span class="wc-k">{S.pocket.balance}</span>
          <span class="num wc-balv">{money(c.balance.amountMinor, c.balance.currency)}</span>
        </div>
      {/if}

      {#if c.note}<div class="wc-note"><Md text={c.note} as="div" /></div>{/if}

      {#if c.code || c.gmailQuery || editing}
        <div class="wc-acts">
          {#if c.code}
            <button class="btn primary" onclick={() => oncounter(c)}><Icon name="counter" size={17} stroke={2} /> {S.pocket.counterMode}</button>
          {/if}
          {#if c.gmailQuery}
            <a class="btn" href={gmail(c.gmailQuery)} target="_blank" rel="noopener"><Icon name="mail" size={16} /> {S.pass.findEmail}</a>
          {/if}
          {#if editing}
            <button class="btn ghost" onclick={() => onedit(c)}><Icon name="edit" size={16} /> {S.pass.edit}</button>
          {/if}
        </div>
      {/if}
    </article>
  {/each}
</div>

{#if editing}
  <button class="addbtn" onclick={onadd}>{S.edit.add('a card')}</button>
{/if}

<style>
  .wcards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
  }
  .wc {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .wc.pending {
    border: 1.5px dashed var(--warn-line);
  }
  .wc-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wc-ic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-chip-sm);
    color: var(--ink-2);
    background: var(--card-2);
  }
  .wc-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .wc-code {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 6px 8px 14px;
    border-radius: var(--radius-inner);
    background: var(--sky);
    border: 1px solid var(--line);
  }
  :root[data-theme='light'] .wc-code {
    background: var(--card-2);
  }
  .wc-k {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
  :root[data-theme='light'] .wc-k {
    color: var(--ink-2);
  }
  .wc-coderow {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .code-big {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.45em;
    min-height: 44px;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    font-size: var(--fs-code-lg);
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--ink);
    word-break: break-all;
  }
  .wc-copy {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-button-sm);
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  :root[data-theme='light'] .wc-copy {
    background: var(--card);
  }
  .wc-rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    margin: 0;
  }
  .wc-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .wc-row dt {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .wc-row dd {
    margin: 0;
    font-size: var(--fs-caption);
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .wc-bal {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .wc-balv {
    font-size: var(--fs-countdown);
    font-weight: 500;
    color: var(--ok);
  }
  .wc-note {
    font-size: var(--fs-caption);
    line-height: 1.6;
    color: var(--ink-2);
  }
  .wc-note :global(b) {
    color: var(--ink);
  }
  .wc-acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .wc-acts .btn {
    flex: 1 1 auto;
    min-height: 48px;
  }
</style>

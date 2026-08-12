<script lang="ts">
  import type { WalletCard } from '../../model/types';
  import { copyText } from '../../state/toast.svelte';
  import Md from '../ui/Md.svelte';

  let { card }: { card: WalletCard } = $props();

  const gmailUrl = $derived(
    card.gmailQuery ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(card.gmailQuery)}` : null,
  );
  function money(minor: number, cur: string): string {
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'ILS' ? '₪' : '';
    return `${sym}${(minor / 100).toFixed(2)}${sym ? '' : ' ' + cur}`;
  }
</script>

<article class="wc" class:pending={card.pending}>
  <header class="wc-head">
    <span class="ttl">{card.emoji ?? '🗂'} <Md text={card.title} /></span>
    {#if card.pending}<span class="stamp warn">Pending</span>{/if}
  </header>

  {#if card.code}
    <div class="wc-code">
      <div class="k">{card.codeLabel ?? 'Number'}</div>
      <button class="code-big mono" onclick={() => copyText(card.code ?? '', card.codeLabel ?? '')}>
        {card.code}<span class="cp" aria-hidden="true">⧉</span>
      </button>
    </div>
  {/if}

  {#if card.rows.length}
    <div class="wc-rows">
      {#each card.rows as r, i (i)}
        <div class="m"><div class="k">{r.k}</div><div class="v">{r.v}</div></div>
      {/each}
    </div>
  {/if}

  {#if card.balance}
    <div class="wc-bal">
      <div class="k">Balance remaining</div>
      <div class="balnum mono">{money(card.balance.amountMinor, card.balance.currency)}</div>
    </div>
  {/if}

  {#if card.note}<div class="wc-note"><Md text={card.note} as="div" /></div>{/if}

  {#if gmailUrl}
    <div class="wc-actions">
      <a class="btn" href={gmailUrl} target="_blank" rel="noopener">📧 Find email</a>
    </div>
  {/if}
</article>

<style>
  .wc {
    background: var(--card);
    border: 1px solid var(--line);
    border-left: 5px solid var(--accent);
    border-radius: var(--radius);
    margin-bottom: 14px;
    box-shadow: var(--shadow-card);
    position: relative;
    padding-bottom: 4px;
  }
  .wc.pending {
    border-left-style: dashed;
  }
  .wc-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px 10px;
    border-bottom: 1px solid var(--line);
  }
  .ttl {
    font-weight: 700;
    font-size: var(--text-base);
    flex: 1;
  }
  .wc-code {
    padding: 11px 16px 4px;
  }
  .k {
    font-size: var(--text-xs);
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--faint);
  }
  .code-big {
    font-weight: 600;
    font-size: var(--text-fluid-card);
    letter-spacing: 1.8px;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    word-break: break-all;
  }
  .code-big .cp {
    font-size: var(--text-base);
    color: var(--faint);
    flex-shrink: 0;
  }
  .wc-rows {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 6px 12px;
    padding: 10px 16px 6px;
  }
  .wc-rows .v {
    font-size: var(--text-sm);
    font-weight: 600;
  }
  .wc-bal {
    padding: 4px 16px 8px;
  }
  .balnum {
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--ok);
  }
  .wc-note {
    padding: 2px 16px 10px;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .wc-actions {
    display: flex;
    gap: 8px;
    padding: 0 16px 12px;
  }
  .wc-actions .btn {
    flex: 1;
    min-height: 40px;
    font-size: var(--text-sm);
  }
</style>

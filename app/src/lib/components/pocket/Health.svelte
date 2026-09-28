<script lang="ts">
  /* HEALTH & INSURANCE — one place for what you would want while somebody
     else is driving: the policy and its number, the 24-hour line, the local
     emergency numbers, and the trip's own words on carrying medicine.

     Everything on it is gathered from data that already exists on other
     screens (lib/logic/health.ts): selectors match on kind, tag and word,
     never on one insurer's name. Nothing here is a new fact, and a trip that
     carries none of it gets an honest empty screen. The one nudge it makes —
     "is your insurance PDF on this phone?" — fires only where there IS a
     policy and there is no document tagged insurance. */
  import type { DocumentFile, EmergencyContact, InfoCard, WalletCard } from '../../model/types';
  import { buildHealth, hasHealth, needsOfflineDoc } from '../../logic/health';
  import { codeGroups } from '../../logic/pass';
  import { copyText } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  const {
    walletCards,
    emergency,
    infoCards,
    documents,
    docsHref,
  }: {
    walletCards: WalletCard[];
    emergency: EmergencyContact[];
    infoCards: InfoCard[];
    documents: DocumentFile[];
    /** Where the documents live — the nudge's doorway. */
    docsHref: string;
  } = $props();

  const h = $derived(buildHealth({ walletCards, emergency, infoCards, documents }));
  const show = $derived(hasHealth(h));
  const nudge = $derived(needsOfflineDoc(h));
  const tel = (c: EmergencyContact): string => `tel:${c.value.replace(/[^0-9+]/g, '')}`;
</script>

{#if !show}
  <EmptyState glyph="heart" title={S.health.title} body={S.health.nothing} />
{:else}
  <section class="healthcard" id="health">
    {#each h.policies as p (p.id)}
      <div class="pol">
        <h2 class="p-title"><Md text={p.title} /></h2>
        {#if p.code}
          <button class="p-code num" onclick={() => copyText(p.code ?? '')} aria-label={S.pocket.copyNumber}>
            {#each codeGroups(p.code) as g, i (i)}<span class="grp">{g}</span>{/each}
            <Icon name="copy" size={16} />
          </button>
        {/if}
        {#if p.rows.length}
          <dl class="p-rows">
            {#each p.rows as r (r.k)}
              <div><dt>{r.k}</dt><dd>{r.v}</dd></div>
            {/each}
          </dl>
        {/if}
      </div>
    {/each}

    {#if h.assistance.length}
      <h3 class="caps sech">{S.health.emergencyLine}</h3>
      {#each h.assistance as c (c.id)}
        <a class="numrow crit" href={tel(c)}>
          <span class="nlabel">{c.label}</span>
          <span class="nval num">{c.value}</span>
          <Icon name="phone" size={17} />
        </a>
      {/each}
    {/if}

    {#if h.local.length}
      <h3 class="caps sech">{S.health.localHelp}</h3>
      {#each h.local as c (c.id)}
        <a class="numrow" href={tel(c)}>
          <span class="nlabel">{c.label}</span>
          <span class="nval num">{c.value}</span>
          <Icon name="phone" size={17} />
        </a>
      {/each}
    {/if}

    {#each h.medicine as m (m.id)}
      <h3 class="caps sech">{S.health.medicine}</h3>
      <ul class="mlist">
        {#each m.items as item, i (i)}<li><Md text={item} /></li>{/each}
      </ul>
    {/each}

    {#if nudge}
      <div class="nudge">
        <b>{S.health.pdfMissing}</b>
        <p>{S.health.pdfMissingBody}</p>
        <a class="btn wfull" href={docsHref}><Icon name="doc" size={16} /> {S.health.openDocs}</a>
      </div>
    {:else if h.docs.length}
      <div class="okline"><Icon name="check" size={15} stroke={2.2} /> {S.health.pdfPresent(h.docs.length)}</div>
    {/if}
  </section>
{/if}

<style>
  .healthcard {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
  }
  .pol {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .p-title {
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 600;
  }
  .p-code {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-height: 44px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--edge);
    background: var(--card-2);
    color: var(--ink);
    font-size: var(--fs-code);
    letter-spacing: 0.04em;
  }
  .p-rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
    margin: 0;
  }
  .p-rows div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .p-rows dt {
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .p-rows dd {
    margin: 0;
    font-size: var(--fs-caption);
    overflow-wrap: anywhere;
  }
  .sech {
    margin: 12px 0 2px;
    color: var(--ink-2);
  }
  .numrow {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
    text-decoration: none;
    color: var(--ink);
  }
  .numrow > :global(.hicon) {
    color: var(--ink-2);
  }
  .nlabel {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-caption);
  }
  .nval {
    font-size: var(--fs-row);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .numrow.crit .nval,
  .numrow.crit > :global(.hicon) {
    color: var(--crit-ink);
  }
  .mlist {
    margin: 0;
    padding-left: 18px;
    font-size: var(--fs-caption);
    line-height: 1.55;
  }
  .mlist li {
    margin-bottom: 4px;
  }
  .nudge {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding: 14px;
    border-radius: var(--radius-inner);
    background: var(--warn-soft);
    border: 1px solid var(--warn-line);
  }
  .nudge p {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.5;
    color: var(--ink);
  }
  .okline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: var(--fs-caption);
    color: var(--ok);
  }
</style>

<script lang="ts">
  /* Health & insurance (Lantern Run C, C2.2).
   *
   * One place for the things you would want while someone else is driving:
   * the policy and its number, the 24-hour line, the local emergency numbers,
   * and whatever the trip itself says about carrying medicine.
   *
   * Everything on it is pulled from data that already existed on four other
   * screens (lib/logic/health.ts). Nothing here is a new fact, and a trip that
   * carries none of it renders nothing at all.
   */
  import { buildHealth, hasHealth, needsOfflineDoc } from '../../logic/health';
  import { copyText } from '../../state/toast.svelte';
  import Md from '../ui/Md.svelte';
  import type { DocumentFile, EmergencyContact, InfoCard, WalletCard } from '../../model/types';
  import { S } from '../../i18n/strings';

  interface Props {
    walletCards: WalletCard[];
    emergency: EmergencyContact[];
    infoCards: InfoCard[];
    documents: DocumentFile[];
    /** The vault lives further up this same screen — the parent owns the
        scroll, so the nudge asks rather than routes. */
    onopendocs: () => void;
  }
  const { walletCards, emergency, infoCards, documents, onopendocs }: Props = $props();

  const h = $derived(buildHealth({ walletCards, emergency, infoCards, documents }));
  const show = $derived(hasHealth(h));
  const nudge = $derived(needsOfflineDoc(h));

  function telHref(c: EmergencyContact): string {
    return `tel:${c.value.replace(/[^0-9+]/g, '')}`;
  }
</script>

{#if show}
  <section class="card u-rise healthcard" id="health">
    <h3>🩺 {S.health.title} <span class="h3sub">· {S.health.subtitle}</span></h3>

    {#each h.policies as p (p.id)}
      <div class="pol">
        <div class="ptitle">{p.emoji ? `${p.emoji} ` : ''}{p.title}</div>
        {#if p.code}
          <button class="codebtn mono" onclick={() => copyText(p.code ?? '')}>
            {p.code}<span class="cphint">⧉</span>
          </button>
        {/if}
        {#each p.rows as r (r.k)}
          <div class="prow"><span class="pk">{r.k}</span><span class="pv">{r.v}</span></div>
        {/each}
      </div>
    {/each}

    {#if h.assistance.length}
      <h4 class="sech">{S.health.emergencyLine}</h4>
      {#each h.assistance as c (c.id)}
        <a class="num crit" href={telHref(c)}>
          <span class="nlabel">{c.label}</span><span class="nval mono">{c.value}</span>
        </a>
      {/each}
    {/if}

    {#if h.local.length}
      <h4 class="sech">{S.health.localHelp}</h4>
      {#each h.local as c (c.id)}
        <a class="num" href={telHref(c)}>
          <span class="nlabel">{c.label}</span><span class="nval mono">{c.value}</span>
        </a>
      {/each}
    {/if}

    {#each h.medicine as m (m.id)}
      <h4 class="sech">{m.emoji ? `${m.emoji} ` : ''}{S.health.medicine}</h4>
      <ul class="mlist">
        {#each m.items as item, i (i)}
          <li><Md text={item} /></li>
        {/each}
      </ul>
    {/each}

    <!-- THE ONE THING THIS SECTION EXISTS TO PREVENT: a policy that lives only
         in an inbox, on a phone with no signal, in a hospital. -->
    {#if nudge}
      <div class="nudge">
        <b>{S.health.pdfMissing}</b>
        <p class="small" style="margin:5px 0 9px">{S.health.pdfMissingBody}</p>
        <button class="btn wfull" onclick={onopendocs}>📂 {S.health.openDocs}</button>
      </div>
    {:else if h.docs.length}
      <div class="small okline">{S.health.pdfPresent(h.docs.length)}</div>
    {/if}
  </section>
{/if}

<style>
  .pol {
    border-bottom: 1px dashed var(--line);
    padding-bottom: 11px;
    margin-bottom: 11px;
  }
  .ptitle {
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--ink);
  }
  .codebtn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 6px;
    min-height: 44px;
    padding: 6px 13px;
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    background: var(--card-2);
    color: var(--ink);
    font-size: var(--text-sm);
    letter-spacing: 0.6px;
  }
  .cphint {
    color: var(--faint);
  }
  .prow {
    display: flex;
    gap: 10px;
    margin-top: 5px;
    font-size: var(--text-sm);
  }
  .pk {
    flex: 0 0 40%;
    color: var(--ink-2);
  }
  .pv {
    flex: 1;
    min-width: 0;
    color: var(--ink);
  }
  .sech {
    margin: 15px 0 6px;
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  /* A number here is dialled, not read — a real link, a real hit area. */
  .num {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 44px;
    padding: 7px 0;
    border-bottom: 1px dashed var(--line);
    text-decoration: none;
    color: var(--ink);
  }
  .num:last-of-type {
    border-bottom: none;
  }
  .nlabel {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
  }
  .nval {
    flex: 0 0 auto;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 1px;
  }
  .num.crit .nval {
    color: var(--crit);
  }
  .mlist {
    margin: 0;
    padding-left: 19px;
  }
  .mlist li {
    font-size: var(--text-sm);
    color: var(--ink);
    margin-bottom: 4px;
  }
  .nudge {
    margin-top: 14px;
    padding: 12px 13px;
    border: 1px solid color-mix(in srgb, var(--warn) 45%, var(--line));
    border-radius: var(--radius-sm);
    background: var(--warn-bg);
  }
  .nudge b {
    font-size: var(--text-base);
    color: var(--ink);
  }
  .okline {
    margin-top: 12px;
    color: var(--ok);
  }
</style>

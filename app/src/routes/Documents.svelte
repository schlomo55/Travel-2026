<script lang="ts">
  /* The document vault (plan §SCREENS 6). It moved out of the Wallet and into
     Info, and it moved from a stacked list to a horizontal strip of thumbnail
     cards — but every operation came with it: add, open, rename, delete.
     Rename and delete stay behind edit mode so a strip you swipe past at a
     border crossing cannot lose a file to a fat thumb. */
  import type { Booking, DocumentFile, Trip, WalletCard } from '../lib/model/types';
  import {
    addDocument,
    deleteDocument,
    fmtBytes,
    handOffDocument,
    LARGE_FILE_BYTES,
    openDocument,
    renameDocument,
  } from '../lib/data/documents';
  import { documentIcon } from '../lib/logic/backup';
  import { toast } from '../lib/state/toast.svelte';
  import { router } from '../lib/state/router.svelte';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import { S } from '../lib/i18n/strings';

  let {
    trip,
    documents,
    bookings,
    cards,
    editing = false,
  }: {
    trip: Trip;
    documents: DocumentFile[];
    bookings: Booking[];
    cards: WalletCard[];
    editing?: boolean;
  } = $props();

  let viewing = $state<{ doc: DocumentFile; url: string } | null>(null);
  let busy = $state(false);
  /* One picker, two doors into it: the add tile in the strip and the empty
     state's button. A second <input type="file"> would be a second thing to
     keep in sync for no gain. */
  let picker = $state<HTMLInputElement | null>(null);

  /* Place photos live on their stops (Plans tab), not in the files list. */
  const files = $derived(documents.filter((d) => d.tag !== 'photo'));
  const sorted = $derived([...files].sort((a, b) => b.addedAt - a.addedAt));
  const totalBytes = $derived(files.reduce((s, d) => s + d.size, 0));

  function attachedTo(d: DocumentFile): string | null {
    if (d.bookingId) return bookings.find((b) => b.id === d.bookingId)?.title ?? null;
    if (d.walletCardId) return cards.find((c) => c.id === d.walletCardId)?.title ?? null;
    return null;
  }

  async function onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const picked = [...(input.files ?? [])];
    if (!picked.length) return;
    busy = true;
    try {
      for (const f of picked) {
        if (f.size > LARGE_FILE_BYTES) {
          toast.show(S.info.vaultLarge(f.name, fmtBytes(f.size)), undefined, 6000);
        }
        await addDocument(f, trip.id);
      }
      toast.show(S.info.vaultAdded(picked.length));
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : S.info.vaultStoreFailed);
    }
    input.value = '';
    busy = false;
  }

  async function view(d: DocumentFile): Promise<void> {
    if (d.mime.startsWith('image/')) {
      const url = await openDocument(d.id);
      if (!url) {
        toast.show(S.info.vaultMissing);
        return;
      }
      viewing = { doc: d, url };
      router.pushLayer(() => {
        closeViewer();
        return true;
      });
      return;
    }
    /* Neither Chrome on Android nor a WebView renders a PDF inline — hand it to
       something that can. Still no network involved. */
    const ok = await handOffDocument(d);
    if (!ok) toast.show(S.info.vaultMissing);
  }

  function closeViewer(): void {
    if (viewing) URL.revokeObjectURL(viewing.url);
    viewing = null;
  }

  async function rename(d: DocumentFile): Promise<void> {
    const v = prompt(S.info.vaultRename, d.name);
    if (v?.trim()) await renameDocument(d.id, v.trim());
  }
</script>

<input
  class="picker"
  type="file"
  multiple
  accept="image/*,application/pdf,.pdf"
  onchange={onFiles}
  disabled={busy}
  bind:this={picker}
  tabindex="-1"
  aria-hidden="true"
/>

{#if sorted.length === 0}
  <EmptyState
    compact
    glyph={S.empty.vault.glyph}
    title={S.empty.vault.title}
    body={S.empty.vault.body}
    actionLabel={busy ? S.empty.vault.action : `＋ ${S.empty.vault.action}`}
    onaction={() => picker?.click()}
  />
{:else}
<p class="vhint">{S.info.vaultHint} · {files.length} · {fmtBytes(totalBytes)}</p>

<div class="vault">
  {#each sorted as d (d.id)}
    <div class="doc">
      <button class="dbox" onclick={() => view(d)} aria-label={d.name}>
        {#if d.mime.startsWith('image/')}
          <PhotoImg docId={d.id} alt="" />
        {:else}
          <span class="ic">{documentIcon(d)}</span>
        {/if}
      </button>
      <small class="nm">{d.name}</small>
      <small class="meta">{fmtBytes(d.size)}{attachedTo(d) ? ` · ${attachedTo(d)}` : ''}</small>
      {#if editing}
        <div class="dacts">
          <button class="editbtn" onclick={() => rename(d)} aria-label="Rename">✎</button>
          <button class="editbtn" onclick={() => deleteDocument(d)} aria-label="Delete">🗑</button>
        </div>
      {/if}
    </div>
  {/each}

  <button class="doc addtile" onclick={() => picker?.click()} disabled={busy}>
    <span class="dbox add">{busy ? '…' : '＋'}</span>
    <small class="nm">{busy ? S.info.vaultStoring : S.empty.vault.action}</small>
  </button>
</div>
{/if}

{#if viewing}
  <div class="viewer" role="dialog" aria-modal="true">
    <button class="x" onclick={() => router.closeTopLayer()} aria-label="Close">✕</button>
    <img src={viewing.url} alt={viewing.doc.name} />
    <div class="vname">{viewing.doc.name}</div>
  </div>
{/if}

<style>
  .vhint {
    margin: 0 0 8px;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .vault {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 2px 0 8px;
    scrollbar-width: none;
  }
  .vault::-webkit-scrollbar {
    display: none;
  }
  .doc {
    flex: 0 0 104px;
    /* a flex item defaults to min-width:auto, so a long file name would blow
       the tile out to its own width — the strip stays on its 104 px grid */
    min-width: 0;
    max-width: 104px;
    position: relative;
  }
  .dbox {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 78px;
    border-radius: 10px;
    border: 1px solid var(--line-2);
    background: var(--card);
    overflow: hidden;
    margin-bottom: 6px;
    padding: 0;
  }
  .dbox .ic {
    font-size: var(--text-title);
  }
  .dbox :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .nm {
    display: block;
    font-size: var(--text-sm);
    color: var(--ink-2);
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: block;
    font-size: var(--text-xs);
    color: var(--faint);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dacts {
    /* 10 px: the two ✎/🗑 buttons carry a 5 px invisible hit ring each
       (app.css .editbtn::after), so anything tighter makes them overlap */
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 6px;
  }
  .picker {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .addtile {
    position: relative;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    text-align: center;
  }
  .dbox.add {
    border-style: dashed;
    color: var(--gold);
    font-size: var(--text-title);
    background: none;
  }
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--paper);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    gap: 14px;
  }
  .viewer img {
    max-width: 100%;
    max-height: 82vh;
    object-fit: contain;
  }
  .vname {
    color: var(--ink-2);
    font-size: var(--text-sm);
  }
  .x {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    right: 16px;
    background: var(--card-2);
    border: 1px solid var(--line-2);
    color: var(--ink-2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: var(--text-base);
  }
</style>

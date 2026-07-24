<script lang="ts">
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
  import { fmtLong } from '../lib/logic/dates';
  import { toast } from '../lib/state/toast.svelte';
  import { router } from '../lib/state/router.svelte';

  let {
    trip,
    documents,
    bookings,
    cards,
  }: { trip: Trip; documents: DocumentFile[]; bookings: Booking[]; cards: WalletCard[] } = $props();

  let viewing = $state<{ doc: DocumentFile; url: string } | null>(null);
  let busy = $state(false);

  const sorted = $derived([...documents].sort((a, b) => b.addedAt - a.addedAt));
  const totalBytes = $derived(documents.reduce((s, d) => s + d.size, 0));

  function attachedTo(d: DocumentFile): string | null {
    if (d.bookingId) return bookings.find((b) => b.id === d.bookingId)?.title ?? null;
    if (d.walletCardId) return cards.find((c) => c.id === d.walletCardId)?.title ?? null;
    return null;
  }

  async function onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    busy = true;
    try {
      for (const f of files) {
        if (f.size > LARGE_FILE_BYTES) {
          toast.show(`${f.name} is ${fmtBytes(f.size)} — large files make backups slow`, undefined, 6000);
        }
        await addDocument(f, trip.id);
      }
      toast.show(`${files.length} file${files.length === 1 ? '' : 's'} added ✓`);
    } catch (ex) {
      toast.show(ex instanceof Error ? ex.message : 'Could not store that file');
    }
    input.value = '';
    busy = false;
  }

  async function view(d: DocumentFile): Promise<void> {
    if (d.mime.startsWith('image/')) {
      const url = await openDocument(d.id);
      if (!url) {
        toast.show('The file is missing from this device');
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
    if (!ok) toast.show('The file is missing from this device');
  }

  function closeViewer(): void {
    if (viewing) URL.revokeObjectURL(viewing.url);
    viewing = null;
  }

  async function rename(d: DocumentFile): Promise<void> {
    const v = prompt('Name this document', d.name);
    if (v?.trim()) await renameDocument(d.id, v.trim());
  }
</script>

<section class="card">
  <h3>Documents <span style="text-transform:none; letter-spacing:0; color:var(--faint); font-weight:500">· {documents.length} · {fmtBytes(totalBytes)}</span></h3>
  <p class="muted" style="margin:0 0 10px">
    Booking PDFs, the insurance policy, a photo of your visa — kept on this phone and openable with
    no signal at all.
  </p>
  <label class="filebtn">
    <input type="file" multiple accept="image/*,application/pdf,.pdf" onchange={onFiles} disabled={busy} />
    <span>{busy ? 'Storing…' : '📎 Add files'}</span>
  </label>
</section>

{#if sorted.length === 0}
  <section class="card"><p class="muted" style="margin:0">Nothing stored yet.</p></section>
{/if}

{#each sorted as d (d.id)}
  <article class="doc">
    <button class="docmain" onclick={() => view(d)}>
      <span class="ic">{documentIcon(d)}</span>
      <span class="txt">
        <span class="nm">{d.name}</span>
        <span class="meta">{fmtBytes(d.size)} · {fmtLong(new Date(d.addedAt).toISOString().slice(0, 10))}</span>
        {#if attachedTo(d)}<span class="meta">attached to {attachedTo(d)}</span>{/if}
      </span>
    </button>
    <button class="editbtn" onclick={() => rename(d)} aria-label="Rename">✎</button>
    <button class="editbtn" onclick={() => deleteDocument(d)} aria-label="Delete">🗑</button>
  </article>
{/each}

{#if viewing}
  <div class="viewer" role="dialog" aria-modal="true">
    <button class="x" onclick={() => router.closeTopLayer()} aria-label="Close">✕</button>
    <img src={viewing.url} alt={viewing.doc.name} />
    <div class="vname">{viewing.doc.name}</div>
  </div>
{/if}

<style>
  .filebtn {
    display: block;
    position: relative;
    overflow: hidden;
  }
  .filebtn input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  .filebtn span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--accent);
    color: #fff;
    border-radius: 12px;
    padding: 13px;
    font-weight: 650;
    min-height: 46px;
  }
  .doc {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 12px;
    margin-bottom: 10px;
    box-shadow: var(--shadow-card);
  }
  .docmain {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 11px;
    background: none;
    border: none;
    text-align: left;
    padding: 0;
  }
  .ic {
    font-size: 22px;
    flex-shrink: 0;
  }
  .txt {
    min-width: 0;
  }
  .nm {
    display: block;
    font-weight: 650;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: block;
    font-size: 11.5px;
    color: var(--faint);
  }
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #000;
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
    color: #bbb;
    font-size: 13px;
  }
  .x {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    right: 16px;
    background: #1c1c1c;
    border: 1px solid #333;
    color: #bbb;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    font-size: 17px;
  }
</style>

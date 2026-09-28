<script lang="ts">
  /* THE DOCUMENTS — the passport scan, the insurance PDF, the ticket you
     were emailed, and the trip's place photos, stored on this phone and
     opened with no signal. Every operation the vault had comes with it: add,
     open, rename, delete. Rename and delete wait behind edit mode, so a list
     swiped past at a border crossing cannot lose a file to a thumb.

     A PDF is handed to the phone's own viewer (neither Chrome on Android nor
     a WebView renders one inline); a picture opens here, full screen, on a
     layer that Android back closes. */
  import type { Booking, DocumentFile, Trip, WalletCard } from '../../model/types';
  import {
    addDocument,
    deleteDocument,
    fmtBytes,
    handOffDocument,
    LARGE_FILE_BYTES,
    openDocument,
    renameDocument,
  } from '../../data/documents';
  import { toast } from '../../state/toast.svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import PhotoImg from '../ui/PhotoImg.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

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
  let picker = $state<HTMLInputElement | null>(null);

  const files = $derived(documents.filter((d) => d.tag !== 'photo').sort((a, b) => b.addedAt - a.addedAt));
  const photos = $derived(documents.filter((d) => d.tag === 'photo').sort((a, b) => a.name.localeCompare(b.name)));
  const totalBytes = $derived(documents.reduce((s, d) => s + d.size, 0));

  function attachedTo(d: DocumentFile): string | null {
    if (d.bookingId) return bookings.find((b) => b.id === d.bookingId)?.title ?? null;
    if (d.walletCardId) return cards.find((c) => c.id === d.walletCardId)?.title ?? null;
    return null;
  }
  function iconOf(d: DocumentFile): string {
    if (d.mime === 'application/pdf') return 'doc';
    if (d.mime.startsWith('image/')) return 'image';
    return 'doc';
  }

  async function onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const picked = [...(input.files ?? [])];
    if (!picked.length) return;
    busy = true;
    try {
      for (const f of picked) {
        if (f.size > LARGE_FILE_BYTES) toast.show(S.info.vaultLarge(f.name, fmtBytes(f.size)), undefined, 6000);
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

{#if documents.length === 0}
  <EmptyState
    glyph="doc"
    title={S.empty.vault.title}
    body={S.empty.vault.body}
    actionLabel={S.empty.vault.action}
    onaction={() => picker?.click()}
  />
{:else}
  <p class="vhint">{S.info.vaultHint} · {documents.length} · <span class="num">{fmtBytes(totalBytes)}</span></p>

  <h2 class="caps vgroup">{S.pocket.files} · {files.length}</h2>
  <ul class="files">
    {#each files as d (d.id)}
      <li class="frow">
        <button class="fmain" onclick={() => view(d)}>
          <span class="fic" aria-hidden="true"><Icon name={iconOf(d)} size={20} /></span>
          <span class="fbody">
            <span class="fname">{d.name}</span>
            <span class="fmeta"><span class="num">{fmtBytes(d.size)}</span>{attachedTo(d) ? ` · ${attachedTo(d)}` : ''}</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </button>
        {#if editing}
          <div class="facts">
            <button class="editbtn" onclick={() => rename(d)} aria-label={S.pocket.rename}><Icon name="edit" size={15} /></button>
            <button class="editbtn" onclick={() => deleteDocument(d)} aria-label={S.forms.delete}><Icon name="trash" size={15} /></button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <button class="btn wfull addfile" onclick={() => picker?.click()} disabled={busy}>
    <Icon name="plus" size={17} stroke={2.2} />
    {busy ? S.info.vaultStoring : S.empty.vault.action}
  </button>

  {#if photos.length}
    <h2 class="caps vgroup">{S.pocket.placePhotos} · {photos.length}</h2>
    <div class="photos">
      {#each photos as d (d.id)}
        <div class="ph">
          <button class="phbox" onclick={() => view(d)} aria-label={d.name}>
            <PhotoImg docId={d.id} alt="" />
          </button>
          {#if editing}
            <div class="facts">
              <button class="editbtn" onclick={() => rename(d)} aria-label={S.pocket.rename}><Icon name="edit" size={15} /></button>
              <button class="editbtn" onclick={() => deleteDocument(d)} aria-label={S.forms.delete}><Icon name="trash" size={15} /></button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{/if}

{#if viewing}
  <div class="viewer" role="dialog" aria-modal="true" aria-label={viewing.doc.name}>
    <button class="iconbtn vx" onclick={() => router.closeTopLayer()} aria-label={S.misc.close}><Icon name="close" size={20} /></button>
    <img src={viewing.url} alt={viewing.doc.name} />
    <div class="vname">{viewing.doc.name}</div>
  </div>
{/if}

<style>
  .vhint {
    margin: 4px 4px 12px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .vgroup {
    margin: 16px 4px 10px;
    color: var(--faint);
  }
  .files {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .frow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fmain {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 10px 10px 12px;
    text-align: left;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 22px;
    box-shadow: var(--shadow-card);
  }
  .fmain > :global(.hicon:last-child) {
    color: var(--faint);
  }
  .fic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: var(--radius-button-sm);
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  .fbody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .fname {
    font-size: var(--fs-row);
    font-weight: 600;
    line-height: 1.3;
  }
  .fmeta {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .facts {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }
  .addfile {
    margin-bottom: 6px;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .ph {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .phbox {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border-radius: var(--radius-inner);
    border: 1px solid var(--line);
    background: var(--card-2);
    overflow: hidden;
  }
  .phbox :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 20px;
    background: var(--sky);
  }
  .viewer img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: var(--radius-inner);
  }
  .vname {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .vx {
    position: absolute;
    top: calc(14px + env(safe-area-inset-top));
    right: 16px;
  }
</style>

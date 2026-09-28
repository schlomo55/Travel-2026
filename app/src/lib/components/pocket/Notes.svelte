<script lang="ts">
  /* NOTES — the trip's own free text, read offline. In edit mode it becomes
     a plain text field (md-lite: **bold**, *italic*, links, new lines), saved
     to the trip's one note record — the same record a trip file or a backup
     carries. */
  import { untrack } from 'svelte';
  import type { TripNote } from '../../model/types';
  import { db } from '../../db/db';
  import { mutate } from '../../data/repo';
  import { toast } from '../../state/toast.svelte';
  import { S } from '../../i18n/strings';
  import EmptyState from '../ui/EmptyState.svelte';
  import Md from '../ui/Md.svelte';

  let { tripId, note, editing }: { tripId: string; note?: TripNote; editing: boolean } = $props();

  let draft = $state(untrack(() => note?.text ?? ''));
  let busy = $state(false);
  /* a fresh draft each time edit mode opens, from what is stored now */
  $effect(() => {
    if (editing) draft = untrack(() => note?.text ?? '');
  });

  async function save(): Promise<void> {
    busy = true;
    const text = draft.trim();
    await mutate(async () => {
      if (text) await db.notes.put({ tripId, text, updatedAt: Date.now() });
      else await db.notes.delete(tripId);
    });
    busy = false;
    toast.show(S.pocket.noteSaved);
  }
</script>

{#if editing}
  <div class="noteedit">
    <label for="trip-note" class="caps nl">{S.info.notes}</label>
    <textarea id="trip-note" rows="10" bind:value={draft} placeholder={S.pocket.notePh}></textarea>
    <button class="btn primary wfull" onclick={save} disabled={busy}>{busy ? S.forms.saving : S.forms.save}</button>
  </div>
{:else if note?.text}
  <article class="notecard" id="notes"><Md text={note.text} as="div" /></article>
{:else}
  <EmptyState glyph="note" title={S.pocket.noNote} body={S.pocket.noNoteBody} />
{/if}

<style>
  .notecard {
    padding: 18px;
    border-radius: var(--radius-card);
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-card);
    font-size: var(--fs-body);
    line-height: 1.6;
  }
  .noteedit {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .nl {
    color: var(--ink-2);
  }
  textarea {
    width: 100%;
    font-size: var(--fs-body);
  }
</style>

<script lang="ts" generics="T">
  /* Sheet + SchemaForm, with the dirty-guard wired to the back button. */
  import Sheet from './Sheet.svelte';
  import SchemaForm from '../forms/SchemaForm.svelte';
  import type { FormSpec } from '../forms/types';
  import { S } from '../../i18n/strings';

  let {
    spec,
    entity,
    onsave,
    ondelete,
    onclose,
    focus,
  }: {
    spec: FormSpec<T>;
    entity?: T;
    onsave: (next: T) => void | Promise<void>;
    ondelete?: () => void | Promise<void>;
    onclose: () => void;
    /** Field name to open on — the sheet scrolls to it and puts the cursor in it. */
    focus?: string;
  } = $props();

  let dirty = $state(false);
  let confirmingDiscard = $state(false);

  function guard(): boolean {
    if (!dirty) return true;
    if (confirmingDiscard) return true;
    confirmingDiscard = true;
    setTimeout(() => (confirmingDiscard = false), 4000);
    return false;
  }
</script>

<Sheet
  title={entity ? S.forms.editTitle(spec.title.toLowerCase()) : S.forms.newTitle(spec.title.toLowerCase())}
  {onclose}
  {guard}
>
  {#if confirmingDiscard}
    <div class="card warn" style="margin-bottom:14px">
      <b>{S.forms.unsaved}.</b>
      {S.forms.unsavedHint}
    </div>
  {/if}
  <SchemaForm {spec} {entity} {onsave} {ondelete} {focus} bind:dirty />
</Sheet>

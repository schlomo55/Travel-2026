<script lang="ts" generics="T">
  /* Sheet + SchemaForm, with the dirty-guard wired to the back button. */
  import Sheet from './Sheet.svelte';
  import SchemaForm from '../forms/SchemaForm.svelte';
  import type { FormSpec } from '../forms/types';

  let {
    spec,
    entity,
    onsave,
    ondelete,
    onclose,
  }: {
    spec: FormSpec<T>;
    entity?: T;
    onsave: (next: T) => void | Promise<void>;
    ondelete?: () => void | Promise<void>;
    onclose: () => void;
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

<Sheet title={entity ? `Edit ${spec.title.toLowerCase()}` : `New ${spec.title.toLowerCase()}`} {onclose} {guard}>
  {#if confirmingDiscard}
    <div class="card warn" style="margin-bottom:12px">
      <b>Unsaved changes.</b> Press back again to discard them.
    </div>
  {/if}
  <SchemaForm {spec} {entity} {onsave} {ondelete} bind:dirty />
</Sheet>

<script lang="ts">
  /* IMPORT A MAP PACK (Map 5c) — the Map tab's empty state and Settings' Map
     pack row share this one control: a real <input type=file> inside its
     label (the focus ring goes on the label, :focus-within), WITH NO ACCEPT
     FILTER — the Capacitor chooser crashes on an accept list whose only entry
     has no MIME type, and `.pmtiles` has none; the pack's own magic bytes are
     the filter (lib/map/pack.ts). While it copies it says how far; when it
     fails it says why, and only what is true of what is left on the phone.

     The import is the app's one job, not this control's (Map 5d,
     lib/map/packImport.svelte.ts): leave mid-copy and come back, and the
     control shows the copy still under way — the picker stays shut — and
     takes the new pack up when it lands, whoever started it. */
  import { untrack } from 'svelte';
  import type { PackInfo } from '../../map/pack';
  import { packImporter } from '../../map/packImport.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';

  let {
    replace = false,
    primary = true,
    onimported,
  }: {
    /** a pack is already here: the button says Replace */
    replace?: boolean;
    /** the sunrise pill (the empty state) or a quiet button (a Settings row) */
    primary?: boolean;
    onimported?: (info: PackInfo) => void;
  } = $props();

  const imp = packImporter;
  const pct = $derived(imp.pct);
  const problem = $derived(imp.problem);
  /* a pack that landed before this control was drawn is not news to it */
  let seen = untrack(() => imp.landed?.n ?? 0);
  $effect(() => {
    const l = imp.landed;
    if (!l || l.n <= seen) return;
    seen = l.n;
    untrack(() => onimported?.(l.info));
  });

  function onFile(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f || imp.busy) return;
    void imp.run(f);
  }
</script>

<div class="pk">
  <label class="pk-file" class:primary class:busy={pct !== null}>
    <input type="file" onchange={onFile} disabled={pct !== null} aria-describedby={problem ? 'pk-problem' : undefined} />
    <span class="pk-face">
      <Icon name="download" size={18} stroke={2} />
      {replace ? S.mapTab.replacePack : S.mapTab.importPack}
    </span>
  </label>
  {#if pct !== null}
    <div class="pk-progress" role="status">
      <span class="pk-bar" aria-hidden="true"><span style="width:{pct}%"></span></span>
      <span class="num">{S.mapTab.copying(pct)}</span>
    </div>
  {/if}
  {#if problem}<p class="pk-problem" id="pk-problem" role="alert"><Icon name="alert" size={16} /> {problem}</p>{/if}
</div>

<style>
  .pk {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* the label wears the button; the input covers it, invisible, so a tap
     anywhere on the face opens the picker */
  .pk-file {
    position: relative;
    display: block;
    border-radius: var(--radius-pill);
  }
  .pk-file input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0;
    opacity: 0;
    cursor: pointer;
  }
  .pk-face {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 44px;
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    background: var(--card-2);
    border: 1px solid var(--edge);
    color: var(--ink);
    font-size: var(--fs-label);
    font-weight: 600;
    white-space: nowrap;
  }
  .pk-file.primary .pk-face {
    min-height: 52px;
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    color: var(--on-sunrise);
    font-size: var(--fs-row);
    box-shadow: var(--glow-sunrise);
  }
  .pk-file.busy .pk-face {
    opacity: 0.55;
  }
  .pk-file:focus-within .pk-face {
    outline: 2px solid var(--sunrise);
    outline-offset: 3px;
  }
  .pk-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .pk-bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--card-2);
    overflow: hidden;
  }
  .pk-bar span {
    display: block;
    height: 100%;
    background: var(--sunrise-fill);
  }
  .pk-problem {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--warn-ink);
  }
</style>

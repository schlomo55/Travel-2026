<script lang="ts" generics="T">
  import { untrack } from 'svelte';
  import type { FieldSpec, FieldValue, FormSpec, FormValues } from './types';
  import { router } from '../../state/router.svelte';

  let {
    spec,
    entity,
    onsave,
    ondelete,
    dirty = $bindable(false),
  }: {
    spec: FormSpec<T>;
    entity?: T;
    onsave: (next: T) => void | Promise<void>;
    ondelete?: () => void | Promise<void>;
    dirty?: boolean;
  } = $props();

  /* The form owns its values from mount; the sheet is remounted per open. */
  let values = $state<FormValues>(untrack(() => spec.toValues(entity)));

  /** Inputs only ever bind strings — booleans live on toggles. */
  const asInput = (v: FieldValue): string => (v === undefined || v === null || typeof v === 'boolean' ? '' : String(v));
  let err = $state('');
  let confirmDelete = $state(false);
  let busy = $state(false);

  const visible = (f: FieldSpec): boolean => !f.when || f.when(values);

  function markDirty(): void {
    dirty = true;
  }

  function setAt(name: string, v: unknown): void {
    values[name] = v as FormValues[string];
    markDirty();
  }

  /* --- list helpers --- */
  function listOf(name: string): string[] {
    const v = values[name];
    return Array.isArray(v) ? (v as string[]) : [];
  }
  function pairsOf(name: string): { k: string; v: string }[] {
    const v = values[name];
    return Array.isArray(v) ? (v as { k: string; v: string }[]) : [];
  }
  function moveItem(name: string, i: number, delta: number): void {
    const arr = [...listOf(name)];
    const j = i + delta;
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) return;
    arr[i] = b;
    arr[j] = a;
    setAt(name, arr);
  }

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    const problem = spec.validate?.(values);
    if (problem) {
      err = problem;
      return;
    }
    err = '';
    busy = true;
    try {
      await onsave(spec.fromValues(values, entity));
      dirty = false;
      router.closeTopLayer();
    } catch (ex) {
      err = ex instanceof Error ? ex.message : 'Could not save';
      busy = false;
    }
  }

  async function remove(): Promise<void> {
    if (!ondelete) return;
    if (!confirmDelete) {
      confirmDelete = true;
      setTimeout(() => (confirmDelete = false), 4000);
      return;
    }
    busy = true;
    await ondelete();
    dirty = false;
    router.closeTopLayer();
  }
</script>

<form onsubmit={submit} class="sform">
  {#each spec.groups as group, gi (gi)}
    {@const shown = group.fields.filter(visible)}
    {#if shown.length}
      {#if group.title}<h4 class="gtitle">{group.title}</h4>{/if}
      <div class="grid">
        {#each shown as f (f.name)}
          <div class="field" class:half={f.width === 'half'}>
            {#if f.type === 'toggle'}
              <label class="toggle">
                <input
                  type="checkbox"
                  checked={values[f.name] === true}
                  onchange={(e) => setAt(f.name, e.currentTarget.checked)}
                />
                <span>{f.label}</span>
              </label>
            {:else}
              <label for="f-{f.name}">{f.label}{f.required ? ' *' : ''}</label>

              {#if f.type === 'text'}
                <input
                  id="f-{f.name}"
                  type="text"
                  value={asInput(values[f.name])}
                  placeholder={f.placeholder ?? ''}
                  maxlength={f.maxlength ?? 200}
                  oninput={(e) => setAt(f.name, e.currentTarget.value)}
                />
              {:else if f.type === 'mdlite'}
                <textarea
                  id="f-{f.name}"
                  rows={f.rows ?? 3}
                  value={asInput(values[f.name])}
                  placeholder={f.placeholder ?? ''}
                  oninput={(e) => setAt(f.name, e.currentTarget.value)}
                ></textarea>
              {:else if f.type === 'date'}
                <input id="f-{f.name}" type="date" value={asInput(values[f.name])} onchange={(e) => setAt(f.name, e.currentTarget.value)} />
              {:else if f.type === 'time'}
                <input id="f-{f.name}" type="time" value={asInput(values[f.name])} onchange={(e) => setAt(f.name, e.currentTarget.value)} />
              {:else if f.type === 'number'}
                <input
                  id="f-{f.name}"
                  type="number"
                  inputmode="numeric"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  value={asInput(values[f.name])}
                  oninput={(e) => setAt(f.name, e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
                />
              {:else if f.type === 'money'}
                <div class="moneyrow">
                  <span class="cur">{f.currency}</span>
                  <input
                    id="f-{f.name}"
                    type="text"
                    inputmode="decimal"
                    value={asInput(values[f.name])}
                    oninput={(e) => setAt(f.name, e.currentTarget.value)}
                  />
                </div>
              {:else if f.type === 'select'}
                <select id="f-{f.name}" value={asInput(values[f.name])} onchange={(e) => setAt(f.name, e.currentTarget.value)}>
                  {#each f.options as o (o.value)}
                    <option value={o.value}>{o.label}</option>
                  {/each}
                </select>
              {:else if f.type === 'hue'}
                <div class="swatches">
                  {#each [8, 30, 95, 150, 195, 215, 262, 330] as h (h)}
                    <button
                      type="button"
                      class="swatch"
                      class:on={values[f.name] === h}
                      style="--sw:hsl({h} 45% 42%)"
                      aria-label="Colour {h}"
                      onclick={() => setAt(f.name, h)}
                    ></button>
                  {/each}
                </div>
              {:else if f.type === 'stringList'}
                <div class="slist">
                  {#each listOf(f.name) as item, i (i)}
                    <div class="srow">
                      <textarea
                        rows="2"
                        value={item}
                        placeholder={f.placeholder ?? ''}
                        oninput={(e) => {
                          const arr = [...listOf(f.name)];
                          arr[i] = e.currentTarget.value;
                          setAt(f.name, arr);
                        }}
                      ></textarea>
                      <div class="sbtns">
                        <button type="button" onclick={() => moveItem(f.name, i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                        <button
                          type="button"
                          onclick={() => moveItem(f.name, i, 1)}
                          disabled={i === listOf(f.name).length - 1}
                          aria-label="Move down">↓</button
                        >
                        <button
                          type="button"
                          class="del"
                          onclick={() => setAt(f.name, listOf(f.name).filter((_, j) => j !== i))}
                          aria-label="Remove">✕</button
                        >
                      </div>
                    </div>
                  {/each}
                  <button type="button" class="btn ghost additem" onclick={() => setAt(f.name, [...listOf(f.name), ''])}>
                    ＋ {f.itemLabel ?? 'Add line'}
                  </button>
                </div>
              {:else if f.type === 'kvPairs'}
                <div class="slist">
                  {#each pairsOf(f.name) as pair, i (i)}
                    <div class="kvrow">
                      <input
                        type="text"
                        value={pair.k}
                        placeholder={f.keyLabel ?? 'Label'}
                        oninput={(e) => {
                          const arr = pairsOf(f.name).map((p, j) => (j === i ? { ...p, k: e.currentTarget.value } : p));
                          setAt(f.name, arr);
                        }}
                      />
                      <input
                        type="text"
                        value={pair.v}
                        placeholder={f.valueLabel ?? 'Value'}
                        oninput={(e) => {
                          const arr = pairsOf(f.name).map((p, j) => (j === i ? { ...p, v: e.currentTarget.value } : p));
                          setAt(f.name, arr);
                        }}
                      />
                      <button
                        type="button"
                        class="del"
                        onclick={() => setAt(f.name, pairsOf(f.name).filter((_, j) => j !== i))}
                        aria-label="Remove">✕</button
                      >
                    </div>
                  {/each}
                  <button type="button" class="btn ghost additem" onclick={() => setAt(f.name, [...pairsOf(f.name), { k: '', v: '' }])}>
                    ＋ Add row
                  </button>
                </div>
              {/if}

              {#if f.hint}<span class="hint">{f.hint}</span>{/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/each}

  {#if err}<div class="err">{err}</div>{/if}

  <div class="actions">
    {#if ondelete}
      <button type="button" class="btn danger" onclick={remove} disabled={busy}>
        {confirmDelete ? 'Tap again to delete' : '🗑 Delete'}
      </button>
    {/if}
    <button type="submit" class="btn primary" style="flex:2" disabled={busy}>
      {busy ? 'Saving…' : 'Save'}
    </button>
  </div>
</form>

<style>
  .sform {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .gtitle {
    margin: 6px 0 -4px;
    font-size: 10.5px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--faint);
    font-weight: 800;
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1 1 100%;
    min-width: 0;
  }
  .field.half {
    flex: 1 1 calc(50% - 6px);
  }
  .field label {
    font-size: 11px;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 700;
  }
  .field input,
  .field select,
  .field textarea {
    width: 100%;
  }
  .hint {
    font-size: 11.5px;
    color: var(--faint);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    text-transform: none;
    letter-spacing: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
  }
  .toggle input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
    flex: 0 0 auto;
  }
  .moneyrow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cur {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--faint);
  }
  .swatches {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }
  .swatch {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--line-2);
    background: var(--sw);
  }
  .swatch.on {
    outline: 2.5px solid var(--ink);
    outline-offset: 2.5px;
  }
  .slist {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .srow {
    display: flex;
    gap: 7px;
    align-items: flex-start;
  }
  .srow textarea {
    flex: 1;
    font-size: 13.5px;
  }
  .sbtns {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sbtns button,
  .del {
    background: var(--card-2);
    border: 1px solid var(--line-2);
    border-radius: 8px;
    width: 32px;
    height: 30px;
    color: var(--ink-2);
    font-size: 12px;
  }
  .sbtns button:disabled {
    opacity: 0.35;
  }
  .kvrow {
    display: flex;
    gap: 7px;
  }
  .kvrow input:first-child {
    flex: 1 1 40%;
  }
  .kvrow input:nth-child(2) {
    flex: 1 1 60%;
  }
  .additem {
    align-self: flex-start;
    min-height: 38px;
    font-size: 12.5px;
  }
  .err {
    color: var(--crit);
    font-weight: 650;
    font-size: 13px;
  }
  .actions {
    display: flex;
    gap: 9px;
    margin-top: 4px;
  }
  .actions .btn {
    flex: 1;
  }
  .btn.danger {
    background: transparent;
    border-color: color-mix(in srgb, var(--crit) 55%, var(--line));
    color: var(--crit);
  }
</style>

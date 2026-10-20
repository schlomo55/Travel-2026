<script lang="ts" generics="T">
  import { untrack } from 'svelte';
  import type { FieldSpec, FieldValue, FormSpec, FormValues } from './types';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from '../horizon/Icon.svelte';
  import TimeField from '../ui/TimeField.svelte';

  let {
    spec,
    entity,
    onsave,
    ondelete,
    focus,
    dirty = $bindable(false),
  }: {
    spec: FormSpec<T>;
    entity?: T;
    onsave: (next: T) => void | Promise<void>;
    ondelete?: () => void | Promise<void>;
    /** Open on this field — used when a screen sends you here to fill one gap. */
    focus?: string;
    dirty?: boolean;
  } = $props();

  /* One shot, on mount: the sheet animates in, so wait for it to settle. */
  $effect(() => {
    const name = untrack(() => focus);
    if (!name) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`f-${name}`);
      if (!(el instanceof HTMLElement)) return;
      el.scrollIntoView({ block: 'center' });
      el.focus({ preventScroll: true });
    }, 260);
    return () => clearTimeout(t);
  });

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
    /* a time field left holding what is not a time (TimeField) kept the old
       value — saving now would drop what was typed without a word */
    const badTime = (e.currentTarget as HTMLFormElement | null)?.querySelector<HTMLInputElement>('input.timefield[aria-invalid="true"]');
    if (badTime) {
      err = S.timeField.invalid;
      badTime.focus();
      return;
    }
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
      void router.closeTopLayer();
    } catch (ex) {
      err = ex instanceof Error ? ex.message : S.forms.saveFailed;
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
    /* a delete that strands its screen (a stop from its guide, a booking
       from its pass) moves on from the sheet's onclose — never from inside
       `ondelete` — and decides where to go BEFORE it deletes: the delete may
       take its screen away, sheet and all, and the onclose then runs as the
       sheet goes, before this line is reached (Run 4b) */
    void router.closeTopLayer();
  }
</script>

<form onsubmit={submit} class="sform">
  {#each spec.groups as group, gi (gi)}
    {@const shown = group.fields.filter(visible)}
    {#if shown.length}
      {#if group.title}<h3 class="gtitle">{group.title}</h3>{/if}
      <div class="grid">
        {#each shown as f (f.name)}
          <div class="field" class:half={f.width === 'half'}>
            {#if f.type === 'toggle'}
              <label class="switch">
                <input
                  type="checkbox"
                  checked={values[f.name] === true}
                  onchange={(e) => setAt(f.name, e.currentTarget.checked)}
                />
                <span class="sw-label">{f.label}</span>
              </label>
            {:else}
              <label for="f-{f.name}">
                {f.label}{#if f.required}<span class="req"> · {S.forms.required}</span>{/if}
              </label>

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
                <TimeField id="f-{f.name}" value={asInput(values[f.name])} onchange={(v) => setAt(f.name, v)} ontype={markDirty} />
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
                      style="--h:{h}; --sw:var(--stop)"
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
                        <button type="button" onclick={() => moveItem(f.name, i, -1)} disabled={i === 0} aria-label={S.forms.moveUp}
                          ><Icon name="chevron-up" size={16} /></button
                        >
                        <button
                          type="button"
                          onclick={() => moveItem(f.name, i, 1)}
                          disabled={i === listOf(f.name).length - 1}
                          aria-label={S.forms.moveDown}><Icon name="chevron-down" size={16} /></button
                        >
                        <button
                          type="button"
                          class="del"
                          onclick={() => setAt(f.name, listOf(f.name).filter((_, j) => j !== i))}
                          aria-label={S.forms.remove}><Icon name="close" size={15} /></button
                        >
                      </div>
                    </div>
                  {/each}
                  <button type="button" class="btn ghost additem" onclick={() => setAt(f.name, [...listOf(f.name), ''])}>
                    <Icon name="plus" size={16} stroke={2.2} />
                    {f.itemLabel ?? S.forms.addLine}
                  </button>
                </div>
              {:else if f.type === 'kvPairs'}
                <div class="slist">
                  {#each pairsOf(f.name) as pair, i (i)}
                    <div class="kvrow">
                      <input
                        type="text"
                        value={pair.k}
                        placeholder={f.keyLabel ?? S.forms.keyPh}
                        oninput={(e) => {
                          const arr = pairsOf(f.name).map((p, j) => (j === i ? { ...p, k: e.currentTarget.value } : p));
                          setAt(f.name, arr);
                        }}
                      />
                      <input
                        type="text"
                        value={pair.v}
                        placeholder={f.valueLabel ?? S.forms.valuePh}
                        oninput={(e) => {
                          const arr = pairsOf(f.name).map((p, j) => (j === i ? { ...p, v: e.currentTarget.value } : p));
                          setAt(f.name, arr);
                        }}
                      />
                      <button
                        type="button"
                        class="del"
                        onclick={() => setAt(f.name, pairsOf(f.name).filter((_, j) => j !== i))}
                        aria-label={S.forms.remove}><Icon name="close" size={15} /></button
                      >
                    </div>
                  {/each}
                  <button type="button" class="btn ghost additem" onclick={() => setAt(f.name, [...pairsOf(f.name), { k: '', v: '' }])}>
                    <Icon name="plus" size={16} stroke={2.2} />
                    {S.forms.addRow}
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

  {#if err}<div class="err" role="alert">{err}</div>{/if}

  <div class="actions">
    {#if ondelete}
      <button type="button" class="btn danger" onclick={remove} disabled={busy}>
        {#if !confirmDelete}<Icon name="trash" size={16} />{/if}
        {confirmDelete ? S.forms.deleteArm : S.forms.delete}
      </button>
    {/if}
    <button type="submit" class="btn primary" style="flex:2" disabled={busy}>
      {busy ? S.forms.saving : S.forms.save}
    </button>
  </div>
</form>

<style>
  .sform {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  /* a group heading is a caps word on a hairline */
  .gtitle {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 -4px;
    font-size: var(--fs-caps);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--sunrise);
    font-weight: 600;
  }
  .gtitle::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--line);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 100%;
    min-width: 0;
  }
  .field.half {
    flex: 1 1 calc(50% - 6px);
  }
  /* :not(.switch) — a toggle's label is a sentence, not a field caption */
  .field label:not(.switch) {
    font-size: var(--fs-caps);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-weight: 600;
  }
  .req {
    color: var(--sunrise);
    letter-spacing: 0.12em;
  }
  .field input,
  .field :global(input.timefield),
  .field select,
  .field textarea {
    width: 100%;
  }
  .field .switch input {
    width: 52px;
    flex: 0 0 auto;
  }
  .hint {
    font-size: var(--fs-caption);
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    line-height: 1.45;
  }
  .moneyrow {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .cur {
    font-family: var(--font-mono);
    font-stretch: var(--mono-stretch);
    font-size: var(--fs-time);
    font-weight: 600;
    color: var(--sunrise);
  }
  /* Eight hues on one row: a grid, not a wrap, so the eighth swatch is never
     orphaned on a line of its own at 412 px. */
  .swatches {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }
  .swatch {
    position: relative;
    width: 100%;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: none;
    padding: 0;
  }
  .swatch::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 34px;
    height: 34px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 2px solid var(--edge);
    background: var(--sw);
  }
  .swatch.on::before {
    border-color: var(--ink);
    box-shadow:
      0 0 0 2.5px var(--chrome),
      0 0 0 4.5px var(--sunrise);
  }
  .slist {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .srow {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .srow textarea {
    flex: 1;
    font-size: var(--fs-caption);
  }
  .sbtns {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sbtns button,
  .del {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: var(--radius-chip-sm);
    border: 1px solid var(--edge);
    background: var(--card-2);
    color: var(--ink-2);
  }
  .sbtns button {
    min-height: 36px;
  }
  .sbtns button:disabled {
    opacity: 0.35;
  }
  .del:active {
    border-color: var(--crit);
    color: var(--crit);
  }
  .kvrow {
    display: flex;
    gap: 8px;
  }
  .kvrow input:first-child {
    flex: 1 1 40%;
  }
  .kvrow input:nth-child(2) {
    flex: 1 1 60%;
  }
  .additem {
    align-self: flex-start;
    font-size: var(--fs-caption);
  }
  .err {
    padding: 11px 14px;
    border-radius: var(--radius-button-sm);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--crit-ink);
    background: var(--crit-soft);
    border: 1px solid var(--crit-line);
  }
  /* the save button never scrolls out of reach on a long form */
  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: 10px;
    margin-top: 4px;
    padding: 12px 0 2px;
    background: linear-gradient(180deg, transparent, var(--chrome) 34%);
  }
  .actions .btn {
    flex: 1;
    min-height: 48px;
  }
</style>

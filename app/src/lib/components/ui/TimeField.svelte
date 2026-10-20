<script lang="ts">
  /* A 24-HOUR TIME FIELD (logic/clock24.ts) — in place of the phone's own
     <input type="time">, which follows its locale and asked for AM/PM on a
     12-hour phone. A numeric keypad, "HH:MM" shaped as you type, read on
     change: a valid time is handed on as "HH:MM", an empty field as '', and
     anything else stays in the box, marked (aria-invalid, which a form's
     Save checks), and is NOT handed on. Only a time that differs from
     `value` is handed on — in and out without typing changes nothing.
     `ontype` fires on every keystroke, so a form knows it has unsaved
     changes before the field is left (Back then warns, as it does for text). */
  import { parseClock24, shapeClock24 } from '../../logic/clock24';
  import { S } from '../../i18n/strings';

  let {
    value = '',
    onchange,
    ontype,
    id,
    label,
    class: cls = '',
  }: {
    value?: string;
    onchange: (v: string) => void;
    ontype?: () => void;
    id?: string;
    label?: string;
    class?: string;
  } = $props();

  /* what is typed follows `value` (another record, a reset) until the
     traveller types; a writable $derived resets itself when `value` changes */
  let text = $derived(value ?? '');
  let bad = $derived.by(() => {
    void value;
    return false;
  });

  function commit(): void {
    const v = parseClock24(text);
    if (v === null) {
      bad = true;
      return;
    }
    bad = false;
    text = v;
    if (v !== (value ?? '')) onchange(v);
  }
</script>

<input
  {id}
  class="timefield {cls}"
  class:bad
  type="text"
  inputmode="numeric"
  autocomplete="off"
  maxlength="5"
  placeholder={S.timeField.placeholder}
  aria-label={label}
  aria-invalid={bad}
  title={bad ? S.timeField.invalid : undefined}
  value={text}
  oninput={(e) => {
    const shaped = shapeClock24(e.currentTarget.value);
    text = shaped;
    if (e.currentTarget.value !== shaped) e.currentTarget.value = shaped;
    bad = false;
    ontype?.();
  }}
  onchange={commit}
  onblur={commit}
/>

<style>
  .timefield {
    font-variant-numeric: tabular-nums;
  }
  .timefield.bad {
    border-color: var(--crit);
    box-shadow: 0 0 0 1px var(--crit);
  }
</style>

<script lang="ts">
  /* A DATE FIELD THAT READS LIKE THE APP — "Sun 29 Nov 2026" — in place of
     the phone's own <input type="date"> text, which follows the phone's
     locale: 11/29/2026 on the owner's S23, month first. The phone's calendar
     still opens on a tap, because the field IS the phone's date input; only
     its text is hidden, and the app's words lie over it (pointer-events:
     none, so every tap still reaches the input). Hands on "YYYY-MM-DD", or ''
     when cleared — `bind:value`, or `onchange` once a date is set. */
  import { fmtDowLong, isIsoDate } from '../../logic/dates';
  import { S } from '../../i18n/strings';

  let {
    value = $bindable(''),
    onchange,
    id,
    label,
    required = false,
    class: cls = '',
  }: {
    value?: string;
    onchange?: (v: string) => void;
    id?: string;
    label?: string;
    required?: boolean;
    class?: string;
  } = $props();

  const shown = $derived(value && isIsoDate(value) ? fmtDowLong(value) : '');
</script>

<span class="datefield {cls}">
  <input
    {id}
    type="date"
    {value}
    {required}
    aria-label={label}
    oninput={(e) => (value = e.currentTarget.value)}
    onchange={(e) => onchange?.(e.currentTarget.value)}
    onclick={(e) => {
      try {
        e.currentTarget.showPicker();
      } catch {
        /* the phone already opened its own, or this browser has none */
      }
    }}
  />
  <span class="df-show" class:empty={!shown} aria-hidden="true"><span>{shown || S.dateField.placeholder}</span></span>
</span>

<style>
  .datefield {
    position: relative;
    display: block;
    min-width: 0;
  }
  .datefield input {
    width: 100%;
    color: transparent;
  }
  /* hidden text, and none of its parts lit up once focused (the phone
     highlighted the year in blue behind the app's words after a pick) */
  .datefield input::-webkit-datetime-edit,
  .datefield input::-webkit-datetime-edit-day-field,
  .datefield input::-webkit-datetime-edit-month-field,
  .datefield input::-webkit-datetime-edit-year-field,
  .datefield input::-webkit-datetime-edit-text {
    color: transparent;
    background: transparent;
  }
  /* the phone's calendar icon took 40px of a half-width field, and "Wed 30
     Dec 2026" needs 129 of its 165 (S23): the whole field opens the
     calendar instead (onclick above, and the phone's own tap) */
  .datefield input::-webkit-calendar-picker-indicator {
    display: none;
  }
  /* over the input's own text, in the font of every other field: its
     border (1px) + padding (14px) on the left */
  .df-show {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding: 0 12px 0 15px;
    color: var(--ink);
    pointer-events: none;
  }
  .df-show > span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .df-show.empty {
    color: var(--placeholder);
  }
</style>

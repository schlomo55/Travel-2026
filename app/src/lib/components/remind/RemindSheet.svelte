<script lang="ts">
  /* The "Remind me" choices (Reminders, Part 4). Each makes an ordinary Alarm
     — the same timed moment the To do list shows and the calendar export
     writes — with a `ref` back to the thing, so a tap on the reminder lands
     on it. A choice whose moment has already passed is not offered. */
  import { untrack } from 'svelte';
  import type { AlarmRef, HHMM, ISODate } from '../../model/types';
  import { db } from '../../db/db';
  import { mutate } from '../../data/repo';
  import { newId } from '../../model/ids';
  import { addDays, fmtDow, localToday } from '../../logic/dates';
  import { hhmmToMinutes, minutesToHhmm } from '../../logic/zones';
  import { mdliteToText } from '../../logic/mdlite';
  import { toast } from '../../state/toast.svelte';
  import { router } from '../../state/router.svelte';
  import { R2 } from './words';
  import Sheet from '../ui/Sheet.svelte';
  import TimeField from '../ui/TimeField.svelte';
  import DateField from '../ui/DateField.svelte';

  let {
    tripId,
    title,
    ref,
    date,
    time,
    onclose,
  }: {
    tripId: string;
    title: string;
    ref: AlarmRef;
    date?: ISODate;
    time?: HHMM;
    onclose: () => void;
  } = $props();

  const today = localToday();
  const nowHm = (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();
  const future = (d: ISODate, t: HHMM): boolean => d > today || (d === today && t > nowHm);

  interface Choice {
    label: string;
    sub: string;
    date: ISODate;
    time: HHMM;
  }
  const choices = $derived.by((): Choice[] => {
    const out: Choice[] = [];
    if (!date) return out;
    const t = time && hhmmToMinutes(time) !== null ? time : null;
    if (t) {
      let m = hhmmToMinutes(t)! - 60;
      let d = date;
      if (m < 0) {
        m += 1440;
        d = addDays(d, -1);
      }
      out.push({ label: R2.hourBefore, sub: `${fmtDow(d)} · ${minutesToHhmm(m)}`, date: d, time: minutesToHhmm(m) });
    }
    const eve = addDays(date, -1);
    out.push({ label: R2.eveningBefore, sub: `${fmtDow(eve)} · 20:00`, date: eve, time: '20:00' });
    if (!t || t > '08:00') out.push({ label: R2.thatMorning, sub: `${fmtDow(date)} · 08:00`, date, time: '08:00' });
    return out.filter((c) => future(c.date, c.time));
  });

  /* the thing's own day to start from, read once: the sheet lives one opening */
  let pickDate = $state<string>(untrack(() => (date && date >= today ? date : today)));
  let pickTime = $state<string>('09:00');
  const plain = $derived(mdliteToText(title).trim());

  async function make(d: ISODate, t: HHMM): Promise<void> {
    if (!future(d, t)) {
      toast.show(R2.past);
      return;
    }
    await mutate(() =>
      db.alarms.add({ id: newId(), tripId, date: d, time: t, title: `🔔 ${plain}`, done: false, ref: { ...ref } }),
    );
    toast.show(R2.made(fmtDow(d), t));
    await router.closeTopLayer();
  }
</script>

<Sheet title={R2.title} {onclose}>
  <p class="rm-what">{plain}</p>
  <div class="rm-list">
    {#each choices as c (c.label)}
      <button class="btn rm-choice" onclick={() => void make(c.date, c.time)}>
        <span class="rm-label">{c.label}</span>
        <span class="rm-sub num">{c.sub}</span>
      </button>
    {/each}
  </div>
  <div class="rm-pick">
    <span class="rm-label">{R2.pick}</span>
    <div class="rm-row">
      <DateField bind:value={pickDate} label={R2.pickDate} />
      <TimeField class="num" value={pickTime} onchange={(v) => (pickTime = v)} label={R2.pickTime} />
    </div>
    <button class="btn primary wfull" disabled={!pickDate || !pickTime} onclick={() => void make(pickDate, pickTime)}>{R2.save}</button>
  </div>
</Sheet>

<style>
  .rm-what {
    margin: 0 0 12px;
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
  }
  .rm-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rm-choice {
    min-height: 56px;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
  }
  .rm-label {
    font-weight: 600;
    color: var(--ink);
  }
  .rm-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .rm-pick {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 18px;
  }
  .rm-row {
    display: flex;
    gap: 8px;
  }
  .rm-row :global(.datefield),
  .rm-row :global(input.timefield) {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
  }
</style>

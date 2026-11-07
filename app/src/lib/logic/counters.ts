/* Compliance counters — the visa clock, generalized.
   Semantics locked to the embassy-verified legacy behavior:
   with countStartsDayAfter, the start date itself is day 0 ("entry day");
   the day after is day 1. Without it, the start date is day 1. */
import type { ComplianceCounter, ISODate } from '../model/types';
import { addDays, compareIso, daysBetween, fmtShort } from './dates';
import { S } from '../i18n/strings';

export interface CounterState {
  phase: 'before' | 'entryDay' | 'counting' | 'complete' | 'overLimit';
  /** Day number under the counter's rule (0 on an entry day). */
  day: number;
  remaining: number; // limitDays - day (can be negative when overLimit)
  limitDays: number;
  deadline?: ISODate;
}

export function counterState(c: ComplianceCounter, date: ISODate): CounterState {
  const raw = daysBetween(c.startDate, date);
  const day = c.countStartsDayAfter ? raw : raw + 1;
  const base = { limitDays: c.limitDays, deadline: c.hardDeadline };

  if (raw < 0) return { ...base, phase: 'before', day: 0, remaining: c.limitDays };
  if (c.plannedEndDate && compareIso(date, c.plannedEndDate) > 0) {
    return { ...base, phase: 'complete', day, remaining: c.limitDays - day };
  }
  if (c.countStartsDayAfter && raw === 0) {
    return { ...base, phase: 'entryDay', day: 0, remaining: c.limitDays };
  }
  if (day > c.limitDays) return { ...base, phase: 'overLimit', day, remaining: c.limitDays - day };
  return { ...base, phase: 'counting', day, remaining: c.limitDays - day };
}

/** The word a counter goes by where the room is short — the app bar's pill
    ("VISA 19/30", as the boards draw it): the last WHOLE word of its name
    when that word is letters only, "Mainland visa" → "visa", "Sample 60-day
    permit" → "permit"; a name that ends in a number, or in a word that
    carries one ("Visa-free 240h", "Transit 144-hour"), goes by its first
    word — never by the letters left over after a digit. The whole name
    stays its accessible name. */
export function counterWord(name: string): string {
  const n = name.trim();
  return /(?:^|\s)(\p{L}[\p{L}-]*)$/u.exec(n)?.[1] ?? /^\p{L}[\p{L}-]*/u.exec(n)?.[0] ?? n;
}

/* THE WINDOW, IN ONE LINE. Every screen that names the counter's dates says
   them alike, derived from the counter's own fields and nothing else: the
   entry date, day 1 (the entry itself, or the day after it), and the last
   legal day — the hard deadline, else day 1 + the limit − 1. "Starts 22 Nov"
   beside "day 1 = 23 Nov" (QA, 7 Nov 2026) was two screens disagreeing about
   one fact. */
export const counterDay1 = (c: ComplianceCounter): ISODate => (c.countStartsDayAfter ? addDays(c.startDate, 1) : c.startDate);
export const counterLast = (c: ComplianceCounter): ISODate => c.hardDeadline ?? addDays(counterDay1(c), c.limitDays - 1);
/** "Entry 22 Nov · day 1 = 23 Nov · leave by 22 Dec 24:00" — or, where the
    entry is day 1 itself, "Entry 22 Nov = day 1 · leave by 21 Dec 24:00". */
export function counterLine(c: ComplianceCounter): string {
  return S.info.counterLine(fmtShort(c.startDate), c.countStartsDayAfter ? fmtShort(counterDay1(c)) : '', fmtShort(counterLast(c)));
}

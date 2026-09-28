/* Compliance counters — the visa clock, generalized.
   Semantics locked to the embassy-verified legacy behavior:
   with countStartsDayAfter, the start date itself is day 0 ("entry day");
   the day after is day 1. Without it, the start date is day 1. */
import type { ComplianceCounter, ISODate } from '../model/types';
import { compareIso, daysBetween } from './dates';

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

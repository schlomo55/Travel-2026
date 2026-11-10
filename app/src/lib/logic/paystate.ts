/* IS IT PAID, OR STILL TO PAY — one answer, read by the pass's money row
   (passfacts.ts) and the Paid / To pay stamp (stamps.ts payStamp), so the two
   can never disagree. "Booked" is not enough: a room paid in advance and a
   room paid at the desk (sometimes cash only) both say Booked.

   The trip file's own `pay` field ('paid' | 'due', 10 Nov 2026) is the
   answer when it is there. Without it the answer is read from the booking's
   money rows and its price note, and where they say nothing it is null —
   never a guess. Kept out of passfacts.ts so the stamp, which every cold
   start draws, does not pull the pass's whole first screen into the entry. */
import type { Booking, BookingMeta } from '../model/types';

export const PAY_KEY = /^(?:paid|pay|payment|deposit|balance|due|price|fare|fee|cost|total)\b/i;
/* a "Paid" row that is really "pay here, then": still to pay */
export const LATER =
  /\b(?:on arrival|at arrival|on arriving|cash|pay(?:ing)? (?:at|on|when|upon|there|here)|at the (?:desk|door|gate|hotel|inn|venue|counter|box office)|at check[\s-]?(?:in|out)|on the day|on site|later|due|owed|to pay|not (?:yet )?paid|unpaid)\b/i;

export type Row = { m: BookingMeta; i: number };

export interface Money {
  /** the money rows that are not the deposit */
  all: Row[];
  /** the row that says it is still to pay */
  due?: Row;
  /** a row that says it is paid */
  paidRow?: Row;
  toPay: boolean;
  paid: boolean;
}

/**
 * WHICH ROW SPEAKS FOR THE MONEY. A booking can carry several: "Paid already"
 * (an application fee), "Price", "Payment: cash on arrival". The one that says
 * it is STILL to pay wins — keyed Pay / Due / Balance, or saying "not paid",
 * "cash on arrival", "at the gate" — because a wrong "Paid" is the costly
 * error. Only with no such row does a row that says paid make it Paid. An
 * explicit `pay` field outranks every row. `rows` are the non-empty meta rows
 * the caller has not already used (the deposit is its own fact).
 */
export function money(b: Booking, rows: Row[]): Money {
  const all = rows.filter(({ m }) => PAY_KEY.test(m.k.trim()));
  const due = all.find((r) => /^(?:pay|due|balance)\b/i.test(r.m.k.trim()) || LATER.test(r.m.v));
  const paidRow = all.find((r) => r !== due && (/^paid\b/i.test(r.m.k.trim()) || /\b(?:pre)?paid\b/i.test(r.m.v)));
  const toPay = b.pay ? b.pay === 'due' : b.status === 'walkin' || (b.status === 'booked' && (!!due || LATER.test(b.priceNote ?? '')));
  return { all, due, paidRow, toPay, paid: b.pay ? b.pay === 'paid' : !toPay && ((b.paidMinor ?? 0) > 0 || !!paidRow) };
}

/** Paid, still to pay, or nothing said ('' — no price, no money row, no
    `pay` field; a cancelled booking says nothing about money). */
export function payOf(b: Booking): 'paid' | 'due' | '' {
  if (b.status === 'cancelled') return '';
  const rows = b.meta.map((m, i) => ({ m, i })).filter(({ m }) => m.v.trim());
  const dep = rows.findIndex(({ m }) => /^deposit\b/i.test(m.k.trim()));
  const m = money(b, rows.filter((_, j) => j !== dep));
  if (!b.pay && !b.priceNote?.trim() && !m.all.length) return '';
  return m.paid ? 'paid' : m.toPay ? 'due' : '';
}

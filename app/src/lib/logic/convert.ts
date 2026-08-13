/* The offline currency converter (Lantern Run C, C2.1).
 *
 * A converter that fetches a live rate is a converter that is blank in China,
 * which is the only place it was ever needed. So this one never touches the
 * network: it works from rates the trip already carries, and it says out loud
 * where each one came from and how old it is.
 *
 * There are three possible sources for a rate, in this order of trust:
 *
 *   edited  — the traveller typed it, at the counter, off the board. Best,
 *             because it is the rate they are actually getting.
 *   expense — the snapshot stored on the newest expense in that currency
 *             (every expense records the rate it was entered at). Real, dated,
 *             and evidence of what the money actually did.
 *   trip    — the rate the trip file was built with. Undated, so it is
 *             labelled as the trip's assumption rather than as a fact.
 *
 * `rateToHome` follows the existing convention everywhere in this app: units
 * of the currency per ONE home unit (USD 1, CNY 7.15).
 */
import type { Expense, ISODate, Trip } from '../model/types';
import { compareIso } from './dates';

export type RateOrigin = 'edited' | 'expense' | 'trip';

export interface RateSource {
  code: string;
  symbol: string;
  rateToHome: number;
  origin: RateOrigin;
  /** The day this rate is true of. Null only for the trip's own assumption,
      which has no date — and a date that is not known is not printed. */
  asOf: ISODate | null;
}

/** What the traveller has typed in, keyed by currency code. Stored in
    db.meta, so no schema version and nothing to migrate. */
export type RateEdits = Record<string, { rateToHome: number; setAt: ISODate }>;

export function isRateEdits(v: unknown): v is RateEdits {
  if (typeof v !== 'object' || v === null) return false;
  return Object.values(v as Record<string, unknown>).every(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as { rateToHome?: unknown }).rateToHome === 'number' &&
      typeof (e as { setAt?: unknown }).setAt === 'string',
  );
}

/** The newest expense in a currency is the freshest real evidence of its
    rate — it was snapshotted at the moment money changed hands. */
export function newestExpenseRate(
  expenses: Pick<Expense, 'currency' | 'rateToHome' | 'date'>[],
  code: string,
): { rateToHome: number; asOf: ISODate } | null {
  let best: { rateToHome: number; asOf: ISODate } | null = null;
  for (const e of expenses) {
    if (e.currency !== code) continue;
    if (!(e.rateToHome > 0)) continue;
    if (!best || compareIso(e.date, best.asOf) > 0) best = { rateToHome: e.rateToHome, asOf: e.date };
  }
  return best;
}

/**
 * Every currency the trip knows, each resolved to its best-evidenced rate.
 *
 * Nothing is invented: a currency the trip does not list does not appear, and
 * a rate with no date is never given one.
 */
export function rateSources(
  trip: Pick<Trip, 'currencies' | 'homeCurrency'>,
  expenses: Pick<Expense, 'currency' | 'rateToHome' | 'date'>[],
  edits: RateEdits = {},
): RateSource[] {
  return trip.currencies.map((c) => {
    const edited = edits[c.code];
    if (edited && edited.rateToHome > 0) {
      return { code: c.code, symbol: c.symbol, rateToHome: edited.rateToHome, origin: 'edited', asOf: edited.setAt };
    }
    const fromExpense = newestExpenseRate(expenses, c.code);
    if (fromExpense) {
      return {
        code: c.code,
        symbol: c.symbol,
        rateToHome: fromExpense.rateToHome,
        origin: 'expense',
        asOf: fromExpense.asOf,
      };
    }
    return { code: c.code, symbol: c.symbol, rateToHome: c.rateToHome, origin: 'trip', asOf: null };
  });
}

export function findRate(sources: RateSource[], code: string): RateSource | null {
  return sources.find((s) => s.code === code) ?? null;
}

/**
 * The whole arithmetic. Via the home currency, because that is the only rate
 * every currency in the trip shares.
 *
 * Returns null rather than 0 or NaN when it cannot be done: a converter that
 * prints "0.00" for a missing rate is stating a price.
 */
export function convert(amount: number, from: RateSource | null, to: RateSource | null): number | null {
  if (!from || !to) return null;
  if (!Number.isFinite(amount)) return null;
  if (!(from.rateToHome > 0) || !(to.rateToHome > 0)) return null;
  return (amount / from.rateToHome) * to.rateToHome;
}

/** Two decimals for money, but four for a rate line like "1 USD = 7.1500 CNY"
    — rounding a rate to cents makes small currencies read as nonsense. */
export function fmtAmount(n: number | null): string {
  if (n === null) return '—';
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "1 USD = 7.1500 CNY", the sentence the whole card is really about. */
export function rateLine(from: RateSource | null, to: RateSource | null): string | null {
  const one = convert(1, from, to);
  if (one === null || !from || !to) return null;
  return `1 ${from.code} = ${one.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${to.code}`;
}

/** Accepts what a thumb actually types: "7,15", " 7.15 ", "¥7.15". */
export function parseRateInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Prices as they were quoted.

   A booking carries a free-text `priceNote` — "~$376", "$17–40/n",
   "$550–950 (5n)" — because that is how a hotel or an airline quotes it. This
   module reads those strings into integer minor units (money.ts conventions)
   so the app can add up what the trip has already committed to.

   The hard rule: anything this parser does not recognise returns `null` and is
   reported in the UI as "price not recorded". A number is never guessed,
   rounded up, averaged or inferred. Pure, deterministic, locale-free. */
import type { Trip } from '../model/types';
import { fmtMoneyWide } from './money';

export interface ParsedPrice {
  minMinor: number;
  maxMinor: number;
  currency: string;
  /** '$20–30/n' — a rate, to be multiplied by the nights of the stay. */
  perNight: boolean;
  /** '(5n)' — a night count the text states itself; it wins over the derived one. */
  nights?: number;
}

export interface PriceRange {
  minMinor: number;
  maxMinor: number;
}

/** Used when a trip's own currency symbols are not to hand. */
export const DEFAULT_SYMBOLS: Record<string, string> = {
  'HK$': 'HKD',
  US$: 'USD',
  $: 'USD',
  '¥': 'CNY',
  '€': 'EUR',
  '£': 'GBP',
  '₪': 'ILS',
};

/** The trip's own currencies drive the parse, so '¥' means what the trip says. */
export function tripSymbols(trip: Pick<Trip, 'currencies'>): Record<string, string> {
  const map: Record<string, string> = { ...DEFAULT_SYMBOLS };
  for (const c of trip.currencies) map[c.symbol] = c.code;
  return map;
}

/* 1,234.50 · 950 · 6 — thousands separators optional, never required. */
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
/* en dash, em dash, hyphen — hotels quote ranges with all three. */
const DASH = String.raw`[–—-]`;
const APPROX = String.raw`(?:~|≈|about\s+|approx\.?\s*|circa\s+)?`;
/* A per-day rate on a bed is a per-night rate; both spellings are accepted. */
const UNIT = String.raw`nights?|nts?|days?|nt|n|d`;

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longest symbol first so 'HK$' is never eaten by '$'. */
function alternation(symbols: Record<string, string>): string {
  return Object.keys(symbols)
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    .map(esc)
    .join('|');
}

const priceCache = new Map<string, RegExp>();
const tailCache = new Map<string, RegExp>();

/** '~$550–950 (5n)' as a whole string: a price and nothing else. */
function priceRe(alt: string): RegExp {
  const hit = priceCache.get(alt);
  if (hit) return hit;
  const re = new RegExp(
    `^\\s*${APPROX}\\s*(${alt})\\s*(${NUM})` +
      `(?:\\s*${DASH}\\s*(?:${alt})?\\s*(${NUM}))?` +
      `(?:\\s*(?:/|per\\s+)\\s*(${UNIT}))?` +
      `(?:\\s*\\(\\s*(\\d+)\\s*(?:nights?|nts?|n)\\s*\\))?\\s*$`,
    'i',
  );
  priceCache.set(alt, re);
  return re;
}

/** 'spa day ~$40' — a label with a price hanging off the end of it. */
function tailRe(alt: string): RegExp {
  const hit = tailCache.get(alt);
  if (hit) return hit;
  const amount =
    `(?:~|≈)?\\s*(?:${alt})\\s*(?:${NUM})` +
    `(?:\\s*${DASH}\\s*(?:${alt})?\\s*(?:${NUM}))?` +
    `(?:\\s*(?:/|per\\s+)\\s*(?:${UNIT}))?` +
    /* one trailing qualifier only: '(split)', '(3 sessions)', 'incl. lift' */
    `(?:\\s+\\([^)]*\\)|\\s+[a-z][^$·]{0,14})?`;
  const re = new RegExp(`^(.*\\S)\\s+(${amount})$`, 'i');
  tailCache.set(alt, re);
  return re;
}

function toMinor(raw: string): number {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

function codeFor(symbols: Record<string, string>, symbol: string): string | null {
  const key = Object.keys(symbols).find((k) => k.toLowerCase() === symbol.toLowerCase());
  return key ? (symbols[key] ?? null) : null;
}

/**
 * '~$376' · '≈$120' · '$17–40/n' · '$20–30' · '$550–950 (5n)' · '$40'
 * → integer minor units. Anything else → null (never a guess).
 */
export function parsePrice(
  text: string | null | undefined,
  symbols: Record<string, string> = DEFAULT_SYMBOLS,
): ParsedPrice | null {
  if (!text) return null;
  const m = priceRe(alternation(symbols)).exec(text.replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const [, sym, first, second, unit, nights] = m;
  if (sym === undefined || first === undefined) return null;
  const currency = codeFor(symbols, sym);
  if (!currency) return null;
  const a = toMinor(first);
  const b = second === undefined ? a : toMinor(second);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const stated = nights === undefined ? 0 : Number(nights);
  return {
    minMinor: Math.min(a, b),
    maxMinor: Math.max(a, b),
    currency,
    perNight: unit !== undefined,
    ...(stated > 0 ? { nights: stated } : {}),
  };
}

/** '≈$1,050 (booked ~$2,026)' → the amount actually paid. Otherwise null. */
export function parseBookedNote(
  text: string | null | undefined,
  symbols: Record<string, string> = DEFAULT_SYMBOLS,
): ParsedPrice | null {
  if (!text) return null;
  const m = /\(\s*booked\b([^)]*)\)/i.exec(text);
  return m?.[1] ? parsePrice(m[1], symbols) : null;
}

/** A quote plus the nights it covers → what it actually adds up to. */
export function priceRange(p: ParsedPrice, nights = 1): PriceRange {
  const n = p.perNight ? Math.max(1, p.nights ?? nights) : 1;
  return { minMinor: p.minMinor * n, maxMinor: p.maxMinor * n };
}

export function sumRanges(list: PriceRange[]): PriceRange {
  return list.reduce<PriceRange>(
    (acc, r) => ({ minMinor: acc.minMinor + r.minMinor, maxMinor: acc.maxMinor + r.maxMinor }),
    { minMinor: 0, maxMinor: 0 },
  );
}

/** '$376' when it is one number, '$1,601 – $2,077' when it is a range. */
export function fmtRange(r: PriceRange, symbol = '$'): string {
  return r.minMinor === r.maxMinor
    ? fmtMoneyWide(r.minMinor, symbol)
    : `${fmtMoneyWide(r.minMinor, symbol)} – ${fmtMoneyWide(r.maxMinor, symbol)}`;
}

export interface CostRow {
  /** md-lite, may be empty when the line does not split into label + amount. */
  label: string;
  /** The price exactly as it was written, or null when there is none to show. */
  amount: string | null;
}

/**
 * A '💰 Costs' line — 'Hotels ~$612 (split) · spa day ~$40' — split into rows
 * that read as money: label on the left, the amount as written on the right.
 * A fragment that is prose rather than a priced item keeps its whole text as
 * the label and gets no amount. Nothing is computed here; this is display only.
 */
export function splitCostRows(item: string, symbols: Record<string, string> = DEFAULT_SYMBOLS): CostRow[] {
  const re = tailRe(alternation(symbols));
  return item
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((fragment) => {
      const m = re.exec(fragment);
      const label = m?.[1];
      const amount = m?.[2];
      if (label === undefined || amount === undefined) return { label: fragment, amount: null };
      return { label: label.replace(/[\s=:–—-]+$/, ''), amount };
    });
}

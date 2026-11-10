/* THE PASS'S FIRST SCREEN, AS DATA — what a stay's or a ticket's pass says
   before anything else, and the actions it can do. Lifted out of
   components/pocket/PassView.svelte so it can be tested with plain values.

   Nothing here invents a fact. A key fact is a `meta` row or a booking field
   the pass ALREADY draws, picked by its own key ("Check-in", "Free cancel",
   "Show") and shown under its own words; a row that becomes a key fact is
   not drawn again under "All details" (`used`). A booking with none of the
   keys has no key facts, and the pass draws no block for them.

   Only a fact that needs action is drawn in the warn colour: an amount still
   to pay, a cancellation deadline within SOON_DAYS of today, or a row the
   trip file itself flagged warn that is about money or a deadline. A flagged
   row about anything else (a late arrival the inn knows about) keeps the
   ink — it is still said, it is just not shouting. */
import type { Booking, BookingMeta, ISODate } from '../model/types';
import { SPF } from '../i18n/passfacts';
import { daysBetween } from './dates';
import { googleMapsUrl } from './geo';
import type { PassKind } from './pass';

/** How many rows the block may carry. The rest stay under "All details". */
export const MAX_FACTS = 6;
/** A deadline this many days ahead (or fewer, today included) needs action. */
export const SOON_DAYS = 7;

export interface KeyFact {
  id: 'pay' | 'time' | 'deadline' | 'address';
  /** the meta row's own key, or one of SPF's words */
  label: string;
  value: string;
  /** a second line, in the UI font: "cash on arrival" under a price, the
      English under a local-script address */
  detail?: string;
  /** monospace is for codes, times, dates and money — never a sentence */
  mono: boolean;
  /** the value is in a local script (Chinese…): the phone's own CJK face */
  local: boolean;
  /** needs action: drawn in the warn colour */
  warn: boolean;
  /** the `booking.meta` rows this fact says — not repeated under "All details" */
  from: number[];
}
export interface KeyFacts {
  facts: KeyFact[];
  /** every `meta` index a fact consumed */
  used: number[];
}
const NONE: KeyFacts = { facts: [], used: [] };

/* ---------- typography: what may be set in the mono face ---------- */

const DAY_OR_MONTH =
  /^(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;
const GLUE = /^(?:from|to|by|until|till|at|before|after|on|noon|midnight|am|pm|per|pp|each|total|nights?|n|about|approx)$/i;
const CURRENCY = /^[A-Z]{0,3}[$¥€£]$/;

/**
 * IS THIS A CODE, A TIME, A DATE OR AN AMOUNT — and so set in monospace? A
 * value counts when every word of it is a figure (it carries a digit), a
 * capitalised code ("SHA"), a currency sign, a weekday or month, or a
 * connecting word ("from", "to", "by"), and at least one is a figure or a
 * code. "from 14:00", "to Mar 27", "HK$5,200 (4n)" are; "cash on arrival",
 * "≈21:30 — they know" and a street address are sentences, and stay in the
 * UI font.
 */
export function isDataLike(value: string): boolean {
  let figures = 0;
  for (const raw of value.split(/\s+/)) {
    const t = raw.replace(/^[(~≈]+|[),.;:]+$/g, '');
    if (!t || /^[^\p{L}\p{N}]+$/u.test(t)) continue;
    if (/\d/.test(t) || /^[A-Z][A-Z-]+$/.test(t)) figures++;
    else if (!(DAY_OR_MONTH.test(t) || GLUE.test(t) || CURRENCY.test(t))) return false;
  }
  return figures > 0;
}

const CJK = /[぀-ヿ㐀-鿿가-힯豈-﫿]/;

/* ---------- deadlines ---------- */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const MON_DAY = new RegExp(`\\b${MON}\\s+(\\d{1,2})\\b`, 'i');
const DAY_MON = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}`, 'i');
const ISO = /\b\d{4}-\d{2}-\d{2}\b/;

/**
 * THE DAY A SENTENCE NAMES — "to Mar 27", "by 27 Mar", "2027-03-27" — or null.
 * A trip file writes a deadline without its year; it is read as the latest
 * such day not after `near` (the booking's own date): a cancellation
 * deadline is never after the stay it cancels.
 */
export function looseDate(text: string, near: ISODate): ISODate | null {
  const iso = ISO.exec(text);
  if (iso) return iso[0];
  const a = MON_DAY.exec(text);
  const b = a ? null : DAY_MON.exec(text);
  const month = a ? a[1] : b ? b[2] : undefined;
  const day = Number(a ? a[2] : b ? b[1] : NaN);
  const mi = month ? MONTHS.indexOf(month.toLowerCase()) : -1;
  if (mi < 0 || !(day >= 1 && day <= 31)) return null;
  const on = (y: number): ISODate => `${y}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const y = Number(near.slice(0, 4));
  return on(y) <= near ? on(y) : on(y - 1);
}

/** A deadline `text` names that falls today or within SOON_DAYS after `now`. */
export function dueSoon(text: string, near: ISODate, now: ISODate): boolean {
  const d = looseDate(text, near);
  if (!d) return false;
  const n = daysBetween(now, d);
  return n >= 0 && n <= SOON_DAYS;
}

/* ---------- which meta rows are which ---------- */

const PAY_KEY = /^(?:paid|pay|payment|deposit|balance|due|price|fare|fee|cost|total)\b/i;
/* a deadline: the last day to cancel or be refunded, or the day booking opens or must happen */
const DEADLINE_KEY = /cancel|refund|releas|book(?:ing)?[\s-]?by|reserve[\s-]?by/i;
const ARRIVE_KEY = /check[\s-]?in|arriv|pick[\s-]?up/i;
const CHECKOUT_KEY = /check[\s-]?out/i;
const TIME_KEY = /^(?:show|doors?|meet(?:ing)?|starts?|entry|entrance|curtain|time|return|boarding|opens?|slot)\b/i;
/* a "Paid" row that is really "pay here, then": still to pay */
const LATER =
  /\b(?:on arrival|at arrival|on arriving|cash|pay(?:ing)? (?:at|on|when|upon|there|here)|at the (?:desk|door|gate|hotel|inn|venue|counter|box office)|at check[\s-]?(?:in|out)|on the day|on site|later|due|owed|to pay)\b/i;

/**
 * THE KEY FACTS OF A PASS — at most MAX_FACTS rows, chosen by the kind of
 * booking from what the pass already draws. Flights, trains and road legs
 * keep their hero and have none; a stay says what to pay, when you may
 * arrive, when you leave, the cancellation deadline and the address; a
 * ticket says its times, what it costs or cost, the refund (or release)
 * deadline and where.
 * (A stay's dates and nights and a ticket's venue, day and start time are
 * the pass's hero, drawn above — never said twice.)
 */
export function passKeyFacts(b: Booking, kind: PassKind, now: ISODate): KeyFacts {
  if (kind !== 'stay' && kind !== 'ticket') return NONE;
  const cancelled = b.status === 'cancelled';
  const rows = b.meta.map((m, i) => ({ m, i })).filter(({ m }) => m.v.trim());
  const taken = new Set<number>();
  const take = (re: RegExp, max = 1): { m: BookingMeta; i: number }[] => {
    const hit = rows.filter(({ m, i }) => !taken.has(i) && re.test(m.k.trim())).slice(0, max);
    for (const r of hit) taken.add(r.i);
    return hit;
  };
  const fromRow = (id: KeyFact['id'], { m, i }: { m: BookingMeta; i: number }, warn: boolean): KeyFact => {
    const value = m.v.trim();
    return { id, label: m.k.trim(), value, mono: isDataLike(value), local: CJK.test(value), warn: warn && !cancelled, from: [i] };
  };

  /* what to pay: the quoted price, and whether it still has to be paid */
  const pay = (): KeyFact[] => {
    /* a deposit is its own fact: "CNY 500 at check-in" under the room's price would read as the price still owed */
    const dep = take(/^deposit\b/i).map((r) => fromRow('pay', r, !cancelled && (!!r.m.warn || LATER.test(r.m.v))));
    const [row] = take(PAY_KEY);
    const price = b.priceNote?.trim();
    if (cancelled || (!price && !row)) return dep;
    const paid = (b.paidMinor ?? 0) > 0 || (!!row && /^paid\b/i.test(row.m.k.trim()) && !LATER.test(row.m.v));
    /* Still to pay: a walk-in, or a booking whose own words say it is paid later
       ("cash on arrival", "at the gate"). A booked room or ticket with a price and
       no such word may be prepaid — the file does not say — so the price is just
       the price: an amber "To pay" on a prepaid room would be a false alarm. */
    const later = LATER.test(row?.m.v ?? '') || LATER.test(price ?? '');
    const toPay = !paid && (b.status === 'walkin' || (b.status === 'booked' && later));
    const value = price ?? row?.m.v.trim() ?? '';
    return [
      {
        id: 'pay',
        label: paid ? SPF.paid : toPay ? SPF.toPay : SPF.price,
        value,
        ...(price && row ? { detail: row.m.v.trim() } : {}),
        mono: isDataLike(value),
        local: CJK.test(value),
        warn: toPay || !!row?.m.warn,
        from: row ? [row.i] : [],
      },
      ...dep,
    ];
  };
  const deadline = (): KeyFact[] =>
    take(DEADLINE_KEY, 2).map((r) => fromRow('deadline', r, !!r.m.warn || dueSoon(r.m.v, b.date, now)));
  const address = (): KeyFact[] => {
    const local = b.address?.trim();
    const en = b.addressEn?.trim();
    const value = local || en;
    if (!value) return [];
    return [
      { id: 'address', label: SPF.address, value, ...(local && en && en !== local ? { detail: en } : {}), mono: false, local: CJK.test(value), warn: false, from: [] },
    ];
  };

  const facts =
    kind === 'stay'
      ? [
          ...pay(),
          ...take(ARRIVE_KEY, 2).map((r) => fromRow('time', r, false)),
          ...take(CHECKOUT_KEY).map((r) => fromRow('time', r, false)),
          ...deadline(),
          ...address(),
        ]
      : [
          ...take(TIME_KEY, 2).map((r) => fromRow('time', r, false)),
          ...pay(),
          ...deadline(),
          ...address(),
        ];
  const kept = facts.slice(0, MAX_FACTS);
  return { facts: kept, used: kept.flatMap((f) => f.from) };
}

/* ---------- the actions ---------- */

/** `tel:` for a front desk's number as written ("+86 571 0000 0001"), or null
    when there is no number to dial. */
export function telHref(phone: string | undefined): string | null {
  const p = (phone ?? '').trim();
  const digits = p.replace(/\D/g, '');
  return digits.length >= 3 ? `tel:${p.startsWith('+') ? '+' : ''}${digits}` : null;
}

export type PassAction = 'driver' | 'navigate' | 'call' | 'copy';

/**
 * THE ACTIONS A PASS CAN DO, in the order it lists them: the driver card
 * (`hasDriver` — the stay has a name or an address in the local script), a
 * map (the booking has a pin, a name, an address or a link), a call (it has
 * a number) and copying the address (it has one, and a map to hand it to —
 * the same rule as ui/MapButtons). An action the booking cannot do is not in
 * the list, and a pass with none draws no row.
 */
export function passActions(b: Booking, hasDriver: boolean): PassAction[] {
  const map = !!googleMapsUrl({ url: b.mapUrl, query: b.mapQuery, address: b.address, city: b.mapCity, coord: b.coord });
  const out: PassAction[] = [];
  if (hasDriver) out.push('driver');
  if (map) out.push('navigate');
  if (telHref(b.phone)) out.push('call');
  if (map && b.address) out.push('copy');
  return out;
}

/* Local-naive wall-calendar dates. HARD RULE: never `new Date('YYYY-MM-DD')`
   (that parses as UTC midnight and shifts a day in negative-offset zones).
   All arithmetic goes through these helpers; diffs use a noon anchor so DST
   transitions can never skew a day count. */
import type { HHMM, ISODate } from '../model/types';

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): s is ISODate {
  return ISO_DATE_RE.test(s);
}

/** ISODate → local Date at noon (noon dodges DST edges in day math). */
export function parseYmd(s: ISODate): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function ymd(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from a → b (positive when b is later). Accepts ISODate or Date. */
export function daysBetween(a: ISODate | Date, b: ISODate | Date): number {
  const da = typeof a === 'string' ? parseYmd(a) : new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12);
  const db = typeof b === 'string' ? parseYmd(b) : new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function compareIso(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Two clock times ('08:45', '19:10') in time order (Run 4). A plain
    comparison, never localeCompare: the first localeCompare a page makes
    builds ICU's collator — ~25 ms of a cold start with the CPU slowed 4×,
    inside Now's first render — and a clock needs no collation. An hour
    written without its leading zero ('6:30') sorts as its padded self, and
    so does an approximate one ('~07:30', '≈ 7:30' — Run 4b: the '~' sorted
    it after every time of the day, and after the '99:99' that stands for
    no time at all). */
export function compareClock(a: HHMM, b: HHMM): number {
  const pad = (t: string): string => {
    const s = t.replace(/^[~≈\s]+/, '');
    return /^\d:/.test(s) ? `0${s}` : s;
  };
  const x = pad(a);
  const y = pad(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Today as ISODate, honoring an optional preview override (?d=YYYY-MM-DD). */
export function localToday(previewOverride?: string | null): ISODate {
  if (previewOverride && isIsoDate(previewOverride)) return previewOverride;
  return ymd(new Date());
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** 'Tue 15 Dec' */
export function fmtDow(s: ISODate): string {
  const d = parseYmd(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}
/** 'Tue 15' — the weekday and the day, where the month goes without saying */
export function fmtDowDay(s: ISODate): string {
  const d = parseYmd(s);
  return `${DOW[d.getDay()]} ${d.getDate()}`;
}
/** '15 Dec 2026' */
export function fmtLong(s: ISODate): string {
  const d = parseYmd(s);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
/** '15 Dec' */
export function fmtShort(s: ISODate): string {
  const d = parseYmd(s);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

export function weekday(s: ISODate): number {
  return parseYmd(s).getDay();
}

/** Time in an IANA zone right now, 'HH:MM' — offline, DST-correct via Intl. */
export function clockIn(timeZone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  } catch {
    return '--:--';
  }
}

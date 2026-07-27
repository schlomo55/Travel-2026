/* The Home screen's timeline, as a pure model (plan §SCREENS 2).

   A DayPlan carries prose, not fields: `planItems` are md-lite strings the
   trip file wrote. So the timeline never INVENTS a time — it only lifts one
   out of an item that already begins with a clock reading. Everything else
   falls into the "Anytime" block below the timed items, which is the honest
   place for "Slow morning → M+ museum".

   Two traps this module exists to avoid:
   1. Cutting a time out of `**09:00 — be at the gate**` would leave the
      closing `**` unmatched and md-lite would print it. The opening marker is
      therefore put back in front of the remainder.
   2. Splitting a title from its detail at the first separator can land inside
      an emphasis run for the same reason, so a split is only taken where the
      markers before it are balanced. */
import type { Spot } from '../model/types';

export interface TimelineItem {
  /** the original md-lite string, untouched */
  raw: string;
  /** the clock reading exactly as the trip file wrote it, or null */
  time: string | null;
  /** minutes past midnight for ordering/highlighting, or null */
  minutes: number | null;
  /** md-lite, emphasis-balanced */
  title: string;
  /** md-lite one-liner, or null when the item is a single clause */
  detail: string | null;
  /** a place named in this item that already has a verified map target */
  spot: Spot | null;
}

/* Matches a leading clock reading, optionally inside an opening emphasis run:
   "09:00", "9:00 AM", "6am", "**20:00 …". A trailing separator is eaten. */
const LEADING_TIME = /^(\*\*|\*)?\s*(\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?|\d{1,2}\s?[ap]\.?m\.?)(?=$|[\s—–·:,-])[\s—–·:,-]*/i;

/** Minutes past midnight, or null when the string is not a clock reading. */
export function timeMinutes(time: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s?([ap])?\.?m?\.?$/i.exec(time.trim());
  if (!m?.[1]) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (half) {
    if (h < 1 || h > 12) return null;
    h = h % 12;
    if (half === 'p') h += 12;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/** True when every emphasis run opened before `at` is also closed before it. */
function balancedBefore(s: string, at: number): boolean {
  const head = s.slice(0, at);
  const strong = (head.match(/\*\*/g) ?? []).length;
  const stars = (head.match(/\*/g) ?? []).length - strong * 2;
  return strong % 2 === 0 && stars % 2 === 0;
}

const SPLITS = [' — ', ' – ', ' · ', ': '];

/** Split a body into a bold title and a dim one-line detail, when it is safe. */
export function splitBody(body: string): { title: string; detail: string | null } {
  let best = -1;
  let width = 0;
  for (const sep of SPLITS) {
    const i = body.indexOf(sep);
    if (i > 2 && (best === -1 || i < best) && balancedBefore(body, i)) {
      best = i;
      width = sep.length;
    }
  }
  if (best === -1) return { title: body, detail: null };
  const detail = body.slice(best + width).trim();
  return detail ? { title: body.slice(0, best).trim(), detail } : { title: body, detail: null };
}

/** The place named in this item, when one of the stop's spots is mentioned. */
export function findSpot(text: string, spots: Spot[]): Spot | null {
  const hay = text.toLowerCase();
  let best: Spot | null = null;
  for (const s of spots) {
    const hit =
      (s.native && text.includes(s.native)) || (s.name.length >= 4 && hay.includes(s.name.toLowerCase()));
    if (!hit) continue;
    const len = Math.max(s.native?.length ?? 0, s.name.length);
    if (!best || len > Math.max(best.native?.length ?? 0, best.name.length)) best = s;
  }
  return best;
}

/** One plan item, read into the shape the timeline draws. */
export function parsePlanItem(raw: string, spots: Spot[] = []): TimelineItem {
  const m = LEADING_TIME.exec(raw);
  let time: string | null = null;
  let body = raw;
  if (m?.[2]) {
    const minutes = timeMinutes(m[2]);
    if (minutes !== null) {
      time = m[2].trim();
      /* put the opening emphasis back so the closing one still has a partner */
      body = (m[1] ?? '') + raw.slice(m[0].length);
    }
  }
  const { title, detail } = splitBody(body.trim());
  return {
    raw,
    time,
    minutes: time ? timeMinutes(time) : null,
    title,
    detail,
    spot: findSpot(raw, spots),
  };
}

export interface Timeline {
  timed: TimelineItem[];
  anytime: TimelineItem[];
}

/** Timed items first, in clock order; everything else keeps its written order. */
export function buildTimeline(items: string[], spots: Spot[] = []): Timeline {
  const parsed = items.map((i) => parsePlanItem(i, spots));
  const timed = parsed.filter((p) => p.minutes !== null).sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
  return { timed, anytime: parsed.filter((p) => p.minutes === null) };
}

/**
 * Which timed item to light up gold: the next one still ahead, or the last one
 * of the day once they have all passed. Returns -1 when the day being shown is
 * not the real today — a previewed date has no "now" to point at.
 */
export function currentIndex(timed: TimelineItem[], nowMinutes: number | null): number {
  if (nowMinutes === null || timed.length === 0) return -1;
  const i = timed.findIndex((t) => (t.minutes ?? 0) >= nowMinutes);
  return i === -1 ? timed.length - 1 : i;
}

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
import type { Coord, Spot } from '../model/types';

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

/* ============================================================
   FREE BLOCKS — the space between the things that are already fixed.

   A day is not a flat list. Between "08:00 Tianmen entry" and "mid-afternoon
   HSR" there are hours nobody has spent, and the trip file has researched
   options sitting three screens away in the city guide. This turns that space
   into an object the screen can draw.

   Two rules keep it honest:

   1. ONLY WHAT CARRIES A CLOCK IS A FIXED POINT. A plan item whose text begins
      with a time, and a booking whose own record states a departure or a
      start — nothing else. Untimed prose ("Ciqikou old quarter → Liziba") does
      NOT break a block, because the trip never said when it happens; that is
      exactly what makes the afternoon free-form in the first place.
   2. NOTHING IS STORED. Blocks are derived on every render from the day's own
      points. A block is a view of the data, never a record in it — so a day
      whose plan changes has different blocks the next second, and a re-import
      cannot leave a stale one behind.
   ============================================================ */

/** One thing on the day that already has a clock attached to it. */
export interface FixedPoint {
  /** minutes past midnight where it begins */
  start: number;
  /** minutes past midnight where it lets go of you — only where the data
      states an end (a flight's arrival, a train's). Otherwise the point is an
      instant, because a plan line that says "08:00" does not say for how long
      and this module will not decide that for it. */
  end?: number;
  /** what it is, in the trip's own words — the block's "after" anchor label */
  label: string;
  /** where it is, when the entity behind it carries a verified coordinate */
  coord?: Coord;
}

/** A stretch of the day with nothing timed in it. */
export interface FreeBlock {
  /** minutes past midnight */
  start: number;
  end: number;
  /** how long it is, in minutes */
  minutes: number;
  /** "14:10–17:30" */
  span: string;
  /** "3 h 20 m" */
  duration: string;
  /** The fixed point this block opens behind — the anchor a distance is
      measured from. Null at the day's own opening bound, where the stop
      itself is the only honest anchor. */
  after: FixedPoint | null;
}

/** The waking bounds a free block is measured inside, and the shortest gap
    worth calling one.

    THIS IS A JUDGEMENT, NOT A FACT, and it is written down here rather than
    buried in a component. Nothing in a trip file says when a day starts. Left
    at midnight-to-midnight, every day would open with a six-hour "free block"
    across the hours you are asleep in, which is not an offer — it is noise
    that teaches you to stop reading the blocks. 08:00–22:00 is the window the
    trip's own days actually live in (the academy's 6am run is the single
    earliest thing written down anywhere, and it is a fixed point rather than
    a gap; "lights out ~21:30" is the latest). Sixty minutes is the floor
    because nothing in the city guide can be done in less. */
export const DAY_OPEN = 8 * 60;
export const DAY_CLOSE = 22 * 60;
export const MIN_BLOCK = 60;

/** "14:10" — minutes past midnight as the clock reads it. */
export function hhmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "3 h 20 m" · "3 h" · "45 m". Spaced, so it reads as a measurement rather
    than a clock reading standing next to a clock reading. */
export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} m`;
  return rest ? `${h} h ${rest} m` : `${h} h`;
}

/**
 * The free blocks of one day.
 *
 * `points` may arrive in any order, may overlap, and may lie wholly outside
 * the waking window — all three happen with real data (a 21:20 departure the
 * night before, two legs of one move, a 06:30 wall-run start). They are
 * sorted, clipped and merged here so the caller never has to.
 */
export function freeBlocks(
  points: FixedPoint[],
  opts: { open?: number; close?: number; min?: number } = {},
): FreeBlock[] {
  const open = opts.open ?? DAY_OPEN;
  const close = opts.close ?? DAY_CLOSE;
  const min = opts.min ?? MIN_BLOCK;
  if (close - open < min) return [];

  /* Clip to the window. A point is dropped only where it STATED an end and
     that end is already past by the time the day opens — EY 609 lands at 04:35
     and has genuinely let go of you before 08:00. A point that states no end
     is kept and clamped instead, however early it starts: "06:30 — leave for
     the wild wall" says when the day was spoken for and nothing about when it
     gives you back, so it closes the day rather than vanishing out of it and
     leaving the screen to claim fourteen free hours. An instant keeps its own
     start as its end. */
  const inside = points
    .map((p) => ({ p, from: p.start, to: Math.max(p.start, p.end ?? p.start) }))
    .filter((x) => x.from <= close && !(x.p.end !== undefined && x.to <= open))
    .sort((a, b) => a.from - b.from || a.to - b.to);

  const blocks: FreeBlock[] = [];
  let cursor = open;
  /* The point the NEXT block opens behind. It is the latest one the cursor has
     passed, which is not always the last one in the list: a 20-minute stop
     nested inside a three-hour leg must not become the anchor. */
  let after: FixedPoint | null = null;
  /* Did that point say when it LETS GO of you? See the closing bound below. */
  let afterEnds = false;
  const push = (start: number, end: number, anchor: FixedPoint | null): void => {
    if (end - start < min) return;
    blocks.push({
      start,
      end,
      minutes: end - start,
      span: `${hhmm(start)}–${hhmm(end)}`,
      duration: durationLabel(end - start),
      after: anchor,
    });
  };

  for (const x of inside) {
    const from = Math.max(open, Math.min(close, x.from));
    const to = Math.max(open, Math.min(close, x.to));
    if (from > cursor) push(cursor, from, after);
    if (to >= cursor) {
      cursor = to;
      after = x.p;
      afterEnds = x.p.end !== undefined && x.p.end > x.p.start;
    }
  }
  /* THE CLOSING BOUND IS NOT SYMMETRICAL WITH THE OPENING ONE, and that is
     deliberate. Between two fixed points the day itself proves the gap: you
     have to get from the first to the second, so the hours in between are
     yours. AFTER the last one, nothing proves anything — an item that says
     "19:30 HK Phil" says when the concert starts and not one word about when
     it ends, so an evening block drawn behind it would be the app offering
     hours the traveller is sitting in a concert hall.
     So the day's own closing bound produces a block only where the last fixed
     point STATED an end (a flight's arrival, a train's), or where the day has
     no fixed points at all — which is the honest "the whole day is open" case
     the acceptance fixtures name. */
  if (cursor < close && (after === null || afterEnds)) push(cursor, close, after);
  return blocks;
}

/** The fixed points a day's own PLAN prose states — the timed half of the
    timeline, in the shape freeBlocks() reads. A plan line is an instant: it
    says when it begins and nothing about when it ends. */
export function planFixedPoints(timed: TimelineItem[]): FixedPoint[] {
  return timed
    .filter((t) => t.minutes !== null)
    .map((t) => ({
      start: t.minutes as number,
      label: t.title,
      ...(t.spot?.coord ? { coord: t.spot.coord } : {}),
    }));
}

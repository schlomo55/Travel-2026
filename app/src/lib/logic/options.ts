/* WHAT COULD FILL A FREE BLOCK — read out of the trip's own researched
   options, and never out of anywhere else.

   The city guide already carries, for every stop, the "All the options" blocks
   and the "Extra ideas — researched" blocks: prose the owner wrote or checked,
   fourteen thumb-flicks down a page that runs to ~11,800 px. This module is
   the bridge between that prose and the free block on Home, and it is built
   around one rule:

     A CANDIDATE SHOWS ONLY WHAT ITS OWN LINE ALREADY SAYS.

   A price is printed because the line printed a price. Opening hours are
   printed because the line stated hours. "book ahead" is a flag because the
   line says book ahead. There is no lookup, no default, no inference and no
   average — an option whose line records nothing but a name renders as a name,
   which is the honest shape of a thing nobody has researched further.

   The one derived number is the straight-line distance, and it is labelled as
   one: it is drawn ONLY where both the candidate and the anchor carry a
   verified coordinate, and it never becomes a travel time. A great-circle
   kilometre between two dots is a fact; "12 minutes away" would be a guess
   about a road nobody has driven. */
import type { ContentBlock, Coord, Spot, Stop } from '../model/types';
import { findSpot, splitBody } from './timeline';
import { haversineKm } from './geoStats';
import { S } from '../i18n/strings';

/** One line of researched prose, read into the shape a card draws. */
export interface Candidate {
  /** `<blockId>#<index>` — deterministic, so a pick made in December still
      points at the same line after a reinstall and a re-import. */
  id: string;
  blockId: string;
  index: number;
  /** the line EXACTLY as the trip file wrote it — md-lite, stored on a pick */
  raw: string;
  /** the heading of the block it came from, in the trip's own words */
  heading: string;
  /** the bold run at its head, else its first clause */
  name: string;
  /** the rest of the line, or null when the line is a single clause */
  detail: string | null;
  /** the trip file marked this one recommended */
  star: boolean;
  /** the line says (verify …) — general knowledge, not a trip document */
  verify: boolean;
  /** the money the line quotes, verbatim: "~¥70pp", "HK$260–680" */
  cost: string | null;
  /** the hours the line states, verbatim: "07:00–22:00", "till 23:30" */
  hours: string | null;
  /** the line says this has to be arranged in advance */
  prebook: boolean;
  /** the line offers itself as the wet / grey / too-tired answer */
  fallback: boolean;
  /** the openable place this line names, when the stop's spot index knows it */
  spot: Spot | null;
}

/** A candidate with the block's own anchor applied. */
export interface RankedCandidate extends Candidate {
  /** straight-line kilometres from the block's anchor, or null when either end
      has no coordinate. Rounded to one decimal; never a travel time. */
  km: number | null;
  /** this line is already in the day, because it was picked */
  picked: boolean;
  /** the id of the pick that put it there — what un-picking deletes */
  pickId: string | null;
}

/* ---------- reading one line ---------- */

/* Leading decoration the trip file uses to classify a line: the star, the
   bowl, the plus. Stripped from the NAME and kept in `raw`, so nothing is
   lost and the title does not begin with punctuation. */
const LEAD = /^[\s⭐➕🍜🎭🎻💡🎯🏔🌄📍✨]+/u;

/* Money exactly as it was quoted. HK$ and US$ are tried before the bare $ or
   the match would begin one character too late. */
const MONEY =
  /[~≈]?\s?(?:HK\$|US\$|RMB\s?|[¥$€£₪])\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?[–—-]\s?(?:HK\$|US\$|[¥$€£₪])?\s?\d[\d,]*(?:\.\d{1,2})?)?(?:\s?pp\b|\s?\/\s?n\b|\s?\/\s?night\b)?/;

/* Hours, and ONLY where the line states a range or a closing time. A single
   clock reading is deliberately not read as hours: "19:30" on the HK Phil line
   is when the concert starts, not when the hall is open, and a card that
   printed it under an "hours" label would be stating something nobody wrote. */
const HOURS =
  /\b\d{1,2}:\d{2}\s?[–—-]\s?\d{1,2}:\d{2}\b|\b(?:open\s+)?(?:till|until)\s+\d{1,2}:\d{2}\b|\bclosed\s+[A-Z][a-z]+days?\b/;

/* "book ahead" in the words the trip file actually uses. Narrow on purpose:
   a false pre-booking flag sends someone to a website at 22:00 for a noodle
   counter that takes walk-ins. */
const PREBOOK =
  /\bpre-?book\w*|\bbook\w*\b[^.·;]{0,40}?\b(?:ahead|in advance)\b|\breservations?\b[^.·;]{0,30}?\b(?:required|recommended|essential)\b|\bsells?\s+out\b|\btickets?\s+release\b/i;

/* The line that offers itself when the weather or the legs have gone. The trip
   file writes these in plain words — "Fog day, no view at all", "the right call
   when the tops are in cloud", "the all-weather backup day", "a rest
   afternoon" — so they are matched in plain words too. */
const FALLBACK =
  /\b(?:rain|rainy|wet weather|fog|foggy|freezing|all-?weather|bad weather|too tired|rest afternoon|rest day|backup day|indoors?)\b|\bin cloud\b|\bgrey-?day\b/i;

/* (verify …) — the trip's own marker for a line that came from general
   knowledge rather than from a document in `sources/`. */
const VERIFY = /\(\s*verify\b/i;

const first = (re: RegExp, s: string): string | null => {
  const m = re.exec(s);
  return m ? m[0].trim() : null;
};

/** Read one option line. `spots` is the stop's verified place index. */
export function parseOption(
  raw: string,
  blockId: string,
  index: number,
  heading: string,
  spots: Spot[] = [],
): Candidate {
  const head = raw.replace(LEAD, '');
  const bold = /^\*\*(.+?)\*\*/.exec(head);
  let name: string;
  let detail: string | null;
  if (bold?.[1]) {
    name = bold[1].trim();
    const rest = head.slice(bold[0].length).replace(/^[\s—–·:,-]+/, '').trim();
    detail = rest || null;
  } else {
    const split = splitBody(head);
    name = split.title;
    detail = split.detail;
  }
  const spot = findSpot(raw, spots);
  return {
    id: `${blockId}#${index}`,
    blockId,
    index,
    raw,
    heading,
    name,
    detail,
    star: raw.includes('⭐'),
    verify: VERIFY.test(raw) || spot?.verify === true,
    /* "¥165," — the list comma after a price is not part of the price */
    cost: first(MONEY, raw)?.replace(/[,.]+$/, '') ?? null,
    hours: first(HOURS, raw),
    prebook: PREBOOK.test(raw),
    fallback: FALLBACK.test(raw),
    spot,
  };
}

/** Every researched line a stop carries: its "All the options" blocks first,
    then the "Extra ideas" ones — the same two sources, in the same order, that
    the city guide prints under "All the options". */
export function optionBlocksOf(stop: Stop): ContentBlock[] {
  return [...(stop.options ?? []), ...stop.recoBlocks];
}

export function candidatesOf(stop: Stop): Candidate[] {
  const spots = stop.spots ?? [];
  return optionBlocksOf(stop).flatMap((b) =>
    b.items.map((it, i) => parseOption(it, b.id, i, b.heading, spots)),
  );
}

/* ---------- what is already in the day ---------- */

const norm = (s: string): string =>
  s
    .replace(/[*_`]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Is this line already part of the day the trip file wrote?
 *
 * Two ways of knowing, and the strong one first. If the candidate names a
 * place the stop's spot index knows, and one of the day's own plan lines names
 * the SAME place, they are the same thing however differently they are worded
 * — which is the whole reason the spot index exists. Otherwise the candidate's
 * own name has to appear in the day's text, and only when it is long enough
 * for that to mean something.
 */
export function inTheDay(c: Candidate, dayItems: string[], spots: Spot[]): boolean {
  if (c.spot) {
    if (dayItems.some((it) => findSpot(it, spots)?.id === c.spot?.id)) return true;
  }
  const n = norm(c.name);
  if (n.length < 4) return false;
  return dayItems.some((it) => norm(it).includes(n));
}

/* ---------- what a day offers ---------- */

/** THE DAY'S OFFERS (Map 5d) — the researched lines the day screen offers to
    add to a day, and so the ONLY lines "Add to my day" may write, wherever it
    is pressed (the day's free blocks, a place's sheet on the Map tab).

    Only while the trip is on, only on a day that is not a travel day (there
    the line and the runbook ARE the day), only the lines of the stop you are
    in, and never a line the day already has — except one you picked, which
    stays so it can be taken back out. Null when the day offers nothing.

    The Map tab once asked a place's own stop instead: on Dec 8 it offered 89
    places — 70 of them in other cities, whose pick then showed under
    Beijing's "Planned" — plus the Temple of Heaven and Dong Lai Shun, which
    the day already has; and on a travel day it wrote a pick the day screen
    never offers. One rule, read by both, so they cannot disagree again. */
export interface DayOffers {
  /** the stop the day is spent in: a pick is written for it */
  stop: Stop;
  /** its candidates, in the order the guide lists them */
  pool: Candidate[];
}
export function dayOffers(o: {
  during: boolean;
  travel: boolean;
  day: { planItems: string[] } | null | undefined;
  stop: Stop | null | undefined;
  /** the candidate ids this day has already picked (data/picks.ts pickedIndex) */
  picked: { has(id: string): boolean };
}): DayOffers | null {
  const { day, stop } = o;
  if (!o.during || o.travel || !day || !stop) return null;
  const spots = stop.spots ?? [];
  return { stop, pool: candidatesOf(stop).filter((c) => o.picked.has(c.id) || !inTheDay(c, day.planItems, spots)) };
}

/** The line a day offers for a PLACE: one of the day's stop's own spots, named
    by one of the lines on offer — else null (nothing to add). */
export function offerFor(offers: DayOffers | null, place: { spotId?: string | undefined; stopId?: string | undefined }): Candidate | null {
  if (!offers || !place.spotId || place.stopId !== offers.stop.id) return null;
  return offers.pool.find((c) => c.spot?.id === place.spotId) ?? null;
}

/* ---------- ranking ---------- */

/** One decimal, because a straight line between two city-grade dots does not
    earn a second one. */
export const roundKm = (km: number): number => Math.round(km * 10) / 10;

export interface RankOptions {
  /** the fixed point the block opens behind, else the stop itself */
  anchor?: Coord | undefined;
  /** picks already made for this day, keyed by candidate id */
  pickedIds?: Map<string, string>;
  /** how many rows the block draws before it defers to the guide */
  limit?: number;
}

export interface BlockCandidates {
  /** the rows the block draws, in the order it draws them */
  shown: RankedCandidate[];
  /** the wet-weather / too-tired row, drawn last. Null when the trip file
      offers none — an invented fallback would be the worst row on the screen. */
  fallback: RankedCandidate | null;
  /** how many lines the pool held before the cap — drives "all options →" */
  total: number;
}

/**
 * Rank a pool for one block: picks first, then the trip's own stars, then the
 * nearest thing with a coordinate, then everything else in written order.
 *
 * A PICKED LINE IS NEVER CAPPED OUT. It is already in the day, and a row that
 * cannot be reached is a row that cannot be un-picked — so picks are placed
 * before the cap is applied rather than competing for the same four slots.
 */
export function rankCandidates(pool: Candidate[], opts: RankOptions = {}): BlockCandidates {
  const anchor = opts.anchor;
  const picked = opts.pickedIds ?? new Map<string, string>();
  const limit = opts.limit ?? 4;

  const ranked: RankedCandidate[] = pool.map((c) => ({
    ...c,
    km: anchor && c.spot?.coord ? roundKm(haversineKm(anchor, c.spot.coord)) : null,
    picked: picked.has(c.id),
    pickId: picked.get(c.id) ?? null,
  }));

  const order = (a: RankedCandidate, b: RankedCandidate): number => {
    if (a.picked !== b.picked) return a.picked ? -1 : 1;
    if (a.star !== b.star) return a.star ? -1 : 1;
    const ak = a.km ?? Infinity;
    const bk = b.km ?? Infinity;
    if (ak !== bk) return ak - bk;
    return 0;
  };

  /* The fallback leaves the pool so it cannot also occupy one of the four
     ordinary slots — it is drawn in its own row, under them. A fallback that
     has already been picked stays in the main list instead, where the "planned"
     look and the un-pick control live. */
  const fallbackPool = ranked.filter((c) => c.fallback && !c.picked);
  const fallback = [...fallbackPool].sort(order)[0] ?? null;
  const rest = ranked.filter((c) => c.id !== fallback?.id);

  const sorted = [...rest].sort(order);
  const pickedRows = sorted.filter((c) => c.picked);
  const openRows = sorted.filter((c) => !c.picked).slice(0, Math.max(0, limit));

  return { shown: [...pickedRows, ...openRows], fallback, total: ranked.length };
}

/** "≈ 2.3 km" — the label a straight line is allowed to wear. */
export const kmLabel = (km: number): string => `${km.toFixed(1)} km`;

/** The facts a candidate row prints, each drawn only where the line itself
    recorded it — the money it quoted, the hours it stated, "book ahead", its
    (verify), and a straight line from the block's anchor that says it is one. */
export function candidateFacts(c: RankedCandidate, anchor: string): { t: string; cls: string }[] {
  const out: { t: string; cls: string }[] = [];
  if (c.cost) out.push({ t: c.cost, cls: 'num' });
  if (c.hours) out.push({ t: S.today.free.hours(c.hours), cls: 'num' });
  if (c.prebook) out.push({ t: S.today.free.prebook, cls: 'pre' });
  if (c.verify) out.push({ t: S.plan.verify, cls: 'verify' });
  if (c.km !== null) out.push({ t: S.today.free.distance(kmLabel(c.km), anchor), cls: '' });
  return out;
}

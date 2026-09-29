/* THE CITY GUIDE AS AN EDITION (f-guide, ROUND4 "Edition = the city guide's
   reading style: headline, drop cap, pull quote, chapters").

   The guide prints a stop's own trip-file prose and nothing else. This file
   only decides its SHAPE: which chapters a stop has, in which order, under
   which number — and it gives every block the stop carries exactly one home,
   so a block the Lantern Plans page printed can never fall out of the app:

     01 Getting there & money   the "Getting there" and "Costs" blocks, the
                                budget note, the stop's warning
     02 The story               the long read (a drop cap on its first word)
     03 Booked                  what is held here, what is still to buy, is
                                every night covered — and the "Sleep" blocks
     04 Day by day              the plan at a glance (the "Day by day" block)
                                and every planned day
     …  one chapter per other block ("Tips", "Bring these…"), in file order
     …  one chapter per option block ("Our picks", "More options", "Where to
        eat", then the researched extras) — together they are "All the
        options", which Now's free blocks link into
     …  Places — every spot, each with its map button

   The pull quote is lifted from the story's own words; nothing is written
   here that the trip file did not say. */
import type { ActivityBooking, Booking, ContentBlock, DayPlan, FlightBooking, HotelBooking, Stop } from '../model/types';
import { compareClock, compareIso, daysBetween, fmtDow } from './dates';
import { mdliteToText, plainWords } from './mdlite';
import { isLive as live, staysInStop } from './booked';
import { balancedBefore } from './timeline';
import { S } from '../i18n/strings';

/* ---------- what the rest of the trip holds for a stop ---------- */

export interface BookedHere {
  /** the beds that check in during the stay — [start, end), so a
      departure-day bed belongs to the stop you sleep in, once */
  beds: HotelBooking[];
  /** flights dated inside the stay, its first and last day included — the
      one that brings you and the one that takes you on */
  flights: FlightBooking[];
  /** tickets for the city (the caller's city places decide which) */
  tickets: ActivityBooking[];
}

export function bookedHere(stop: Stop, bookings: Booking[], ticketIds: Set<string>): BookedHere {
  return {
    beds: staysInStop(bookings, stop),
    flights: bookings
      .filter((b): b is FlightBooking => b.kind === 'flight' && live(b) && compareIso(b.date, stop.start) >= 0 && compareIso(b.date, stop.end) <= 0)
      .sort((a, b) => compareIso(a.date, b.date) || compareClock(a.dep, b.dep)),
    tickets: bookings
      .filter((b): b is ActivityBooking => b.kind === 'activity' && live(b) && ticketIds.has(b.id))
      .sort((a, b) => compareIso(a.date, b.date) || compareClock(a.time ?? '', b.time ?? '')),
  };
}

/** The planned days of a stay, its first and last day included. */
export function daysHere(stop: Pick<Stop, 'start' | 'end'>, dayPlans: DayPlan[]): DayPlan[] {
  return dayPlans
    .filter((d) => compareIso(d.date, stop.start) >= 0 && compareIso(d.date, stop.end) <= 0)
    .sort((a, b) => compareIso(a.date, b.date));
}

export type ChapterKind = 'there' | 'story' | 'booked' | 'days' | 'block' | 'option' | 'places';
export interface Chapter {
  /** the element id the chapter carries — the anchors other screens land on */
  id: string;
  /** "01" */
  n: string;
  kind: ChapterKind;
  /** the chapter's heading, in the trip's own words where it has them */
  title: string;
  /** the short name a chip goes by */
  chip: string;
  block?: ContentBlock;
}

const COST = /cost/i;
const THERE = /getting there/i;
const DAYS = /day by day/i;
const SLEEP = /\bsleep/i;

/** "🛏 Sleep — two bases (BOTH BOOKED)" → "Sleep — two bases (BOTH BOOKED)" —
    a heading read as words (mdlite.ts plainWords, the one copy since Run 3c) */
export const blockTitle = plainWords;
/** the chip's words: the heading up to its dash or bracket — "Sleep" */
export function chipOf(heading: string): string {
  const t = blockTitle(heading);
  return (t.split(/\s+[—–]\s+|\s*\(/)[0] ?? t).trim() || t;
}

export interface GuideParts {
  there: ContentBlock[];
  costs: ContentBlock[];
  sleep: ContentBlock[];
  /** the "Day by day" block: the plan at a glance */
  glance: ContentBlock[];
  rest: ContentBlock[];
  options: ContentBlock[];
}

/** Every block of the stop, in exactly one part. */
export function guideParts(stop: Pick<Stop, 'blocks' | 'options' | 'recoBlocks'>): GuideParts {
  const p: GuideParts = { there: [], costs: [], sleep: [], glance: [], rest: [], options: [...(stop.options ?? []), ...stop.recoBlocks] };
  for (const b of stop.blocks) {
    if (COST.test(b.heading)) p.costs.push(b);
    else if (THERE.test(b.heading)) p.there.push(b);
    else if (DAYS.test(b.heading)) p.glance.push(b);
    else if (SLEEP.test(b.heading)) p.sleep.push(b);
    else p.rest.push(b);
  }
  return p;
}

/** The chapters a stop's guide has, numbered in reading order. `has` says
    what the rest of the trip holds for it (bookings, planned days). */
export function guideChapters(
  stop: Pick<Stop, 'blocks' | 'options' | 'recoBlocks' | 'detail' | 'costNote' | 'warn' | 'spots'>,
  has: { booked: boolean; days: boolean },
): Chapter[] {
  const p = guideParts(stop);
  const out: Omit<Chapter, 'n'>[] = [];
  const W = S.guide.chapter;
  if (p.there.length || p.costs.length || stop.costNote || stop.warn) {
    out.push({ id: 'g-there', kind: 'there', title: W.there, chip: W.thereChip });
  }
  if (stop.detail?.trim()) out.push({ id: 'g-about', kind: 'story', title: W.story, chip: W.story });
  if (has.booked || p.sleep.length) out.push({ id: 'g-booked', kind: 'booked', title: W.booked, chip: W.booked });
  if (has.days || p.glance.length) out.push({ id: 'g-days', kind: 'days', title: W.days, chip: W.days });
  for (const b of p.rest) out.push({ id: `g-blk-${b.id}`, kind: 'block', title: blockTitle(b.heading), chip: chipOf(b.heading), block: b });
  for (const b of p.options) out.push({ id: `g-opt-${b.id}`, kind: 'option', title: blockTitle(b.heading), chip: chipOf(b.heading), block: b });
  if (stop.spots?.length) out.push({ id: 'g-eat', kind: 'places', title: W.places, chip: W.places });
  return out.map((c, i) => ({ ...c, n: String(i + 1).padStart(2, '0') }));
}

/* ---------- the fallback, set apart ---------- */

export interface Fallback {
  /** the line up to the clause (may be empty) */
  before: string;
  /** the file's own word for it: "fallbacks", "fallback" */
  label: string;
  /** the clause after its colon, emphasis kept whole */
  text: string;
  /** what the line goes on to say after the clause (may be empty) */
  after: string;
}
/** A Getting-there line's "fallback(s):" clause, split out so the guide can
    set it in its own amber callout, as f-guide draws "If CA 8609 is
    cancelled": the clause runs from its label to the next " · " that is
    outside brackets and emphasis — or to the end of the line. Every word is
    the file's, in the file's order; nothing is added. No clause, null.
    Run 3c: a label that is its own emphasis run ("**Fallback:** the 07:45
    nonstop") leaves no empty "****" behind, and a clause inside a bold run
    or a bracket that opened before it is not split out at all — the line
    stays prose rather than being torn in two. */
export function fallbackOf(item: string): Fallback | null {
  const m = /(?:^| · )(\*\*|\*)?(fallbacks?)(\*\*|\*)?:(\*\*|\*)?\s*/i.exec(item);
  if (!m) return null;
  const head = item.slice(0, m.index);
  const open = (s: string): boolean => s.split('(').length !== s.split(')').length || s.split('*').length % 2 === 0;
  if (!balancedBefore(item, m.index) || head.split('(').length !== head.split(')').length) return null;
  /* the marker that opened before the label, and the one that closed right
     after it (before or after the colon): a matching pair wrapped the label
     alone; an opening with no close runs on into the clause */
  const lead = m[1] ?? '';
  const close = m[3] ?? m[4] ?? '';
  if (close && close !== lead) return null;
  const parts = `${close ? '' : lead}${item.slice(m.index + m[0].length)}`.split(' · ');
  let text = parts.shift() ?? '';
  while (parts.length && open(text)) text += ` · ${parts.shift()}`;
  return { before: head.trim(), label: m[2]!, text: text.trim(), after: parts.join(' · ').trim() };
}

/* ---------- the story ---------- */

/** The long read in its paragraphs (the trip file separates them with a
    blank line). */
export function paragraphs(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** A line of the story set large (the Edition's pull quote): a sentence of
    the trip's own, or the part of one after its colon — 40 to 110 letters,
    with no number, price or "verify" in it (a pull quote is the feeling of
    a place, not a fact to act on). A dash reads best; the first that fits
    wins. None fits → no quote. */
export function pullQuote(text: string | undefined): string | null {
  const flat = mdliteToText(text ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  const cands: string[] = [];
  for (const s of flat.split(/(?<=[.!?])\s+(?=[A-Z“"])/)) {
    const colon = s.lastIndexOf(': ');
    if (colon > 0) cands.push(s.slice(colon + 2));
    cands.push(s);
  }
  /* …and it must stand alone: a line that begins "They arrive…" quotes a
     sentence whose subject is in the one before it */
  const fits = (c: string): boolean =>
    c.length >= 40 &&
    c.length <= 110 &&
    !/\d|verify|[$¥€£₪~≈]/i.test(c) &&
    !/^(?:they|it|its|this|these|that|those|he|she|their|there)\b/i.test(c);
  const pick = cands.find((c) => fits(c) && / — /.test(c)) ?? cands.find(fits);
  if (!pick) return null;
  const t = pick.trim().replace(/[,;:]$/, '');
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

/* ---------- the dates ---------- */

/** "Fri 11 → Mon 14 Dec" (one month) · "Mon 23 Nov → Sat 5 Dec" */
export function stayRange(stop: Pick<Stop, 'start' | 'end'>): string {
  const a = fmtDow(stop.start).split(' ');
  const b = fmtDow(stop.end);
  return a[2] === b.split(' ')[2] ? `${a[0]} ${a[1]} → ${b}` : `${fmtDow(stop.start)} → ${b}`;
}

export function nightsOf(stop: Pick<Stop, 'start' | 'end' | 'nights'>): number {
  return stop.nights ?? Math.max(0, daysBetween(stop.start, stop.end));
}

/** What the trip file adds after the dates of a stay: "Fri Dec 11 → Mon
    Dec 14 · 2n park + 1n city" → "2n park + 1n city". */
export function whenTail(stop: Pick<Stop, 'whenLabel'>): string | null {
  const parts = (stop.whenLabel ?? '').split(' · ');
  if (parts.length < 2 || !/→/.test(parts[0]!) || !/\d/.test(parts[0]!)) return null;
  return parts.slice(1).join(' · ').trim() || null;
}

/* the kinds of place a night is spent "in the …" — the words that compose
   safely ("two in the park"); a place word not on the list is kept as the
   file wrote it, because "2n lake" is not "two in the lake" */
const IN_THE = new Set(['park', 'city', 'town', 'old town', 'village', 'mountains', 'hills', 'valley', 'desert', 'countryside', 'forest', 'centre', 'center']);

/** The file's own split of a stay, read out for the guide's opening line —
    "2n park + 1n city" → "two in the park, one in the city". Every part must
    be a number of nights and a place that composes safely: a name ("2n
    Kyoto" → "two in Kyoto") or a kind of place on the list, its own "the"
    never doubled ("2n the park" → "two in the park"). A tail in any other
    shape — "2-day hike", "2n lake", "2n by the lake" — stays exactly as the
    file wrote it (Run 3c). */
export function tailWords(tail: string | null): string | null {
  const parts = tail?.split(' + ').map((p) => /^(\d+)n (\p{L}[\p{L} -]*)$/u.exec(p.trim()));
  if (!parts?.every(Boolean)) return tail;
  const said: string[] = [];
  for (const m of parts) {
    const where = m![2]!.trim().replace(/^the /, '');
    const place = /^\p{Lu}/u.test(where) ? where : IN_THE.has(where) ? `the ${where}` : null;
    if (!place) return tail;
    said.push(S.guide.split(Number(m![1]), place));
  }
  return said.join(', ');
}

/** The stop's name in the local script, when the trip file stores one for
    the map search (mapCity 张家界); a Latin one is not repeated. */
export function localName(stop: Pick<Stop, 'mapCity'>): string | null {
  return stop.mapCity && /[㐀-鿿]/.test(stop.mapCity) ? stop.mapCity : null;
}

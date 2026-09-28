/* "What we booked, and what each one costs."

   Turns the trip's bookings — plus any budget note in the trip documents that
   records an amount already paid — into one honest breakdown: every item with
   the price as it was quoted, the same price in home minor units, and a total
   that counts ONLY what could be read. Items whose price cannot be read (or
   cannot be converted, because the trip carries no rate for that currency) are
   counted as unpriced and stay out of the total. Nothing is estimated here.

   Pure and deterministic: no Date.now(), no locale formatting, no DB. */
import type { Booking, BookingStatus, HotelBooking, Stop, Trip } from '../model/types';
import { compareIso, daysBetween, fmtDow, fmtShort } from './dates';
import { minorToHome } from './money';
import {
  parseBookedNote,
  parsePrice,
  priceRange,
  sumRanges,
  tripSymbols,
  type ParsedPrice,
  type PriceRange,
} from './prices';

export interface BookedItem {
  id: string;
  /** The booking this row stands for; absent on a document-sourced line. */
  booking?: Booking;
  title: string;
  /** Dates, nights, city — whatever identifies this one at a glance. */
  sub: string;
  status: BookingStatus | null;
  /** The price exactly as it was quoted, or null when none was recorded. */
  quoted: string | null;
  /** Home minor units, nights already applied. Null when it could not be read. */
  range: PriceRange | null;
  nights: number | null;
  /** Where a document-sourced amount comes from, quoted verbatim. */
  source: string | null;
}

export interface BookedGroup {
  key: 'travel' | 'stays' | 'docs' | 'experiences' | 'alternatives';
  label: string;
  items: BookedItem[];
  range: PriceRange;
  unpriced: number;
}

export interface BookedBreakdown {
  groups: BookedGroup[];
  total: PriceRange;
  /** How many rows carry a price that was counted. */
  counted: number;
  /** How many rows have no price the app could read. */
  unpriced: number;
  /** EITHER/OR LEGS, shown and never added up. `alternative` exists because
      Nov 22 is a flight to Yantai OR ELSE the HSR and only one will happen
      (types.ts). Plans has honoured that since it was introduced; the money
      did not, so both halves of the same journey inflated "Counted so far",
      the budget meter and the unpriced tally. They ride here instead: visible,
      because a fallback you cannot see is a fallback you will not take, and
      outside every total, because counting both would invent a journey. */
  alternatives: BookedGroup | null;
}

/** A booking the trip is committed to: not cancelled, and not the OTHER way
    of making a journey that is already listed (`alternative` — the Nov 22 HSR
    fallback). The one copy of the rule (Run 3c: the guide, the metro line,
    coverage and the commitments each had their own). */
export const isLive = (b: Booking): boolean => b.status !== 'cancelled' && !b.alternative;

/** Home minor units for a quote, or null when no honest conversion exists. */
function toHome(p: ParsedPrice, nights: number, trip: Trip): PriceRange | null {
  const r = priceRange(p, nights);
  if (p.currency === trip.homeCurrency) return r;
  const cur = trip.currencies.find((c) => c.code === p.currency);
  if (!cur || !(cur.rateToHome > 0)) return null;
  return { minMinor: minorToHome(r.minMinor, cur.rateToHome), maxMinor: minorToHome(r.maxMinor, cur.rateToHome) };
}

function nightsOf(b: Booking): number | null {
  return b.kind === 'hotel' ? Math.max(1, daysBetween(b.checkIn, b.checkOut)) : null;
}

function subLine(b: Booking): string {
  if (b.kind === 'hotel') {
    const n = nightsOf(b) ?? 1;
    const dates = `${fmtShort(b.checkIn)} → ${fmtShort(b.checkOut)}`;
    const nights = `${n} ${n === 1 ? 'night' : 'nights'}`;
    return b.city ? `${b.city} · ${dates} · ${nights}` : `${dates} · ${nights}`;
  }
  if (b.kind === 'flight') return `${fmtDow(b.date)} · ${b.from.code} → ${b.to.code}`;
  /* A ticket's identifying line is when it starts and where — the two things
     you check before leaving for it. Both are optional and both are omitted
     rather than filled in, so a bare activity still reads as its date. */
  if (b.kind === 'activity') return [fmtDow(b.date), b.time, b.venue].filter(Boolean).join(' · ');
  return fmtDow(b.date);
}

function itemFor(b: Booking, trip: Trip, symbols: Record<string, string>): BookedItem {
  const parsed = parsePrice(b.priceNote, symbols);
  const nights = nightsOf(b);
  return {
    id: b.id,
    booking: b,
    title: b.title,
    sub: subLine(b),
    status: b.status,
    quoted: b.priceNote ?? null,
    range: parsed ? toHome(parsed, nights ?? 1, trip) : null,
    nights,
    source: null,
  };
}

function rollGroup(key: BookedGroup['key'], label: string, items: BookedItem[]): BookedGroup {
  return {
    key,
    label,
    items,
    range: sumRanges(items.map((i) => i.range).filter((r): r is PriceRange => r !== null)),
    unpriced: items.filter((i) => i.range === null).length,
  };
}

/**
 * @param labels group headings, so the strings stay in strings.ts
 */
export function buildBooked(
  trip: Trip,
  bookings: Booking[],
  stops: Stop[],
  labels: {
    flights: string;
    travel: string;
    stays: string;
    docs: string;
    experiences: string;
    alternatives: string;
  },
): BookedBreakdown {
  const symbols = tripSymbols(trip);
  /* A cancelled booking is not something the trip is committed to — and
     neither is the half of an either/or move that will not happen. */
  const live = bookings.filter(isLive);
  const alternates = bookings.filter((b) => b.status !== 'cancelled' && b.alternative);

  /* Travel is legs. Experiences are the things you go TO — a ticket in a Travel
     total would read as a fare, and the two answer different questions ("how do
     I get there" against "what am I going to"). Same split as the Wallet's
     segments, so a row on this card opens in the segment it belongs to. */
  const travel = live
    .filter((b) => b.kind !== 'hotel' && b.kind !== 'activity')
    .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title))
    .map((b) => itemFor(b, trip, symbols));
  const stays = live
    .filter((b) => b.kind === 'hotel')
    .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title))
    .map((b) => itemFor(b, trip, symbols));
  const experiences = live
    .filter((b) => b.kind === 'activity')
    .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title))
    .map((b) => itemFor(b, trip, symbols));

  /* Amounts already paid that no single booking carries — the international
     flights are one booking across four legs, and the trip records the price
     on the stop, not on the legs. Read, never invented; the note that carries
     it is shown verbatim so the number can be traced. */
  const docs: BookedItem[] = [];
  for (const s of [...stops].sort((a, b) => a.order - b.order)) {
    const parsed = parseBookedNote(s.costNote, symbols);
    if (!parsed || !s.costNote) continue;
    const range = toHome(parsed, 1, trip);
    if (!range) continue;
    docs.push({
      id: `stop:${s.id}`,
      title: s.name,
      sub: s.whenLabel ?? `${fmtShort(s.start)} → ${fmtShort(s.end)}`,
      status: null,
      quoted: null,
      range,
      nights: null,
      source: s.costNote,
    });
  }

  const groups = [
    rollGroup('travel', travel.every((i) => i.booking?.kind === 'flight') ? labels.flights : labels.travel, travel),
    rollGroup('docs', labels.docs, docs),
    rollGroup('stays', labels.stays, stays),
    rollGroup('experiences', labels.experiences, experiences),
  ].filter((g) => g.items.length > 0);

  const altItems = alternates
    .sort((a, b) => compareIso(a.date, b.date) || a.title.localeCompare(b.title))
    .map((b) => itemFor(b, trip, symbols));
  const alternatives = altItems.length
    ? rollGroup('alternatives', labels.alternatives, altItems)
    : null;

  const all = groups.flatMap((g) => g.items);
  return {
    groups,
    total: sumRanges(groups.map((g) => g.range)),
    counted: all.filter((i) => i.range !== null).length,
    unpriced: all.filter((i) => i.range === null).length,
    alternatives,
  };
}

/** Beds whose check-in falls inside a stop's [start, end) occupancy — the
    half-open range is what stops the bed of a departure day being counted
    twice, in the stop being left and the stop being arrived at. */
export function staysInStop(bookings: Booking[], stop: Stop): HotelBooking[] {
  return bookings
    .filter((b): b is HotelBooking => b.kind === 'hotel' && isLive(b))
    .filter((b) => compareIso(b.checkIn, stop.start) >= 0 && compareIso(b.checkIn, stop.end) < 0)
    .sort((a, b) => compareIso(a.checkIn, b.checkIn) || a.title.localeCompare(b.title));
}

/** One booking's price, ready to print: what it was quoted at and what it
    adds up to in home currency. Used by the city guide, which shows a stop's
    own items without needing the whole breakdown. */
export function priceOf(b: Booking, trip: Trip): { quoted: string | null; range: PriceRange | null } {
  const parsed = parsePrice(b.priceNote, tripSymbols(trip));
  return {
    quoted: b.priceNote ?? null,
    range: parsed ? toHome(parsed, nightsOf(b) ?? 1, trip) : null,
  };
}

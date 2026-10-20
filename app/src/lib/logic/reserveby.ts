/* RESERVE BY — a ticket the day goes to, and when it has to be booked.

   A ticket (an `activity` booking) already RIDES WITH the place it is for: it
   borrows that place's pin (scripts/china/tickets.ts), and mapPlaces groups
   every entity at one point into one place, the others in its `with`. That
   is the join used here, and the only one — never a title matched against a
   place name:
     · a numbered route stop (DayRoute) reads its MapPlace's own `with`;
     · a chip (DayView, which keeps the Map's place list out of its start-up
       code) reads the same point key, `posKey` (./mapdrawn), straight from
       the records — or the chip IS the ticket.
   Only a ticket FOR THAT DAY (its `date`) is shown on a day.

   ONLY WHAT IS KNOWN. `pending` says "Ticket not booked", `booked` says
   "Ticket ✓". The book-by moment is the traveller's own (types.ts,
   ActivityBooking.bookBy): shown when set, "(passed)" once the phone's clock
   is past it while the ticket is still pending — never "open now", never
   "closed", which nobody here knows.

   Pure: records in, marks out. */
import type { ActivityBooking, Booking, Coord, HHMM, ISODate, ShowCard, Stop } from '../model/types';
import { S } from '../i18n/strings';
import { fmtDow, isIsoDate } from './dates';
import { bookingOnMap, placePos, posKey } from './mapdrawn';
import { hhmmToMinutes } from './zones';

/** A ticket the app marks: an activity, bought or still to buy, not the other way of doing a thing. */
export const isTicket = (b: Booking): b is ActivityBooking =>
  b.kind === 'activity' && (b.status === 'pending' || b.status === 'booked') && !b.alternative;

/** The book-by moment of a ticket still to buy, when the traveller set one. */
export function bookByOf(b: Booking): { date: ISODate; time: HHMM | null } | null {
  if (b.kind !== 'activity' || b.status !== 'pending' || b.alternative || !b.bookBy || !isIsoDate(b.bookBy)) return null;
  return { date: b.bookBy, time: hhmmToMinutes(b.bookByTime) === null ? null : b.bookByTime! };
}

/** Is the book-by behind the phone's clock (`today`, minutes past midnight)? */
export function bookByPassed(b: Booking, today: ISODate, nowMinutes: number | null): boolean {
  const m = bookByOf(b);
  if (!m) return false;
  if (m.date !== today) return m.date < today;
  const t = hhmmToMinutes(m.time ?? undefined);
  return t !== null && nowMinutes !== null && t <= nowMinutes;
}

/** The chip's words and tone: "Ticket ✓", or "Ticket not booked · book by Sun 29 Nov 20:00 (passed)". */
export function ticketLine(b: ActivityBooking, today: ISODate, nowMinutes: number | null): { text: string; booked: boolean } {
  if (b.status === 'booked') return { text: S.bookBy.booked, booked: true };
  const m = bookByOf(b);
  const by = m ? S.bookBy.by(`${fmtDow(m.date)}${m.time ? ` ${m.time}` : ''}`, bookByPassed(b, today, nowMinutes)) : '';
  return { text: `${S.bookBy.notBooked}${by}`, booked: false };
}

/** The tickets for `date` riding with a place of the Map's list (MapPlace): its own booking and its `with`. */
export function placeTickets(p: { booking?: Booking; with: { booking?: Booking }[] }, date: ISODate): ActivityBooking[] {
  const out: ActivityBooking[] = [];
  for (const b of [p.booking, ...p.with.map((m) => m.booking)]) {
    if (b && isTicket(b) && b.date === date && !out.includes(b)) out.push(b);
  }
  return out;
}

/**
 * The tickets for `date` at each of the day's places, by id, straight from the
 * records: an id that is a ticket, or a spot / place card / live bed or ticket
 * at the very point a ticket is drawn. The same grouping mapPlaces makes
 * (one place per posKey), without loading it. A ticket goes to the first id
 * that reaches it, so two chips at one point never both carry it.
 */
export function dayTickets(
  ids: readonly string[],
  src: { stops: Stop[]; showCards: ShowCard[]; bookings: Booking[] },
  date: ISODate,
): Map<string, ActivityBooking[]> {
  const out = new Map<string, ActivityBooking[]>();
  const tickets = src.bookings.filter((b): b is ActivityBooking => isTicket(b) && b.date === date);
  if (!tickets.length || !ids.length) return out;
  const want = new Set(ids);
  const keyOf = new Map<string, string>();
  const put = (id: string, e: { coord?: Coord; pin?: Coord }): void => {
    const pos = want.has(id) ? placePos(e) : undefined;
    if (pos) keyOf.set(id, posKey(pos));
  };
  for (const s of src.stops) for (const sp of s.spots ?? []) put(sp.id, sp);
  for (const c of src.showCards) if (c.kind === 'place' && !c.pending) put(c.id, c);
  for (const b of src.bookings) if (bookingOnMap(b)) put(b.id, b);
  const taken = new Set<string>();
  for (const id of ids) {
    const k = keyOf.get(id);
    const hits = tickets.filter((t) => {
      if (taken.has(t.id)) return false;
      if (t.id === id) return true;
      const pos = k === undefined ? undefined : placePos(t);
      return !!pos && bookingOnMap(t) && posKey(pos) === k;
    });
    if (!hits.length) continue;
    for (const t of hits) taken.add(t.id);
    out.set(id, hits);
  }
  return out;
}

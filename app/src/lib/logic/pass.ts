/* THE PASS, AS DATA — the decisions behind Pocket's booking screens, lifted
   out of the components so they can be tested with plain values.

   Nothing here invents a fact. The warning line is the trip file's own
   sentence, flagged with the trip file's own ⚠️. The code is printed exactly
   as it was stored — grouping only changes where the eye rests, never a
   character (the copy button copies the raw string). A booking with no code
   gets no code strip, no Counter mode and no placeholder. */
import type { Booking, HotelBooking, ISODate } from '../model/types';
import { addDays, daysBetween, fmtDow, fmtShort } from './dates';
import { mdliteToText } from './mdlite';

/** Which Pocket list a booking lives in. */
export type WalletSection = 'travel' | 'stays' | 'experiences';
export function walletSectionOf(b: Pick<Booking, 'kind'>): WalletSection {
  if (b.kind === 'hotel') return 'stays';
  if (b.kind === 'activity') return 'experiences';
  return 'travel';
}

/** What kind of pass this is, in the words and icons the Pocket uses. */
export type PassKind = 'flight' | 'train' | 'road' | 'stay' | 'ticket';
export function passKind(b: Booking): PassKind {
  switch (b.kind) {
    case 'flight':
      return 'flight';
    case 'train':
      return 'train';
    case 'hotel':
      return 'stay';
    case 'activity':
      return 'ticket';
    default:
      return 'road';
  }
}
export const PASS_ICON: Record<PassKind, string> = {
  flight: 'plane',
  train: 'train',
  road: 'car',
  stay: 'bed',
  ticket: 'ticket',
};

/**
 * THE WARNING THE TRIP FILE PUTS FIRST. A booking note whose first line
 * opens with ⚠️ is the trip file flagging the one thing about this booking
 * you must not get wrong ("⚠️ **Departs DAXING (PKX) — NOT Capital.**").
 * Returned as plain text — its first sentence, the glyph removed (the screen
 * draws its own alert icon), md-lite stripped. Anything else: null. The rest
 * of the note is still shown in full on the pass; this only lifts the flag.
 */
export function warningLine(note: string | undefined): string | null {
  if (!note) return null;
  const first = note.split('\n')[0]?.trim() ?? '';
  if (!first.startsWith('⚠')) return null;
  /* the glyph (with or without its emoji selector), then plain text */
  const text = mdliteToText(first.replace(/^⚠️?\s*/, '')).trim();
  /* its first sentence: up to a full stop, ! or ? followed by a space or the end */
  const m = /^(.*?[.!?])(?=\s|$)/.exec(text);
  const out = (m?.[1] ?? text).replace(/[.!]$/, '').trim();
  return out || null;
}

/**
 * WHERE THE EYE RESTS ON A LONG CODE. A 16-digit order number read out at a
 * desk is read in fours; a six-letter PNR is read whole. Codes of ten
 * characters and up split into groups of four (the last group takes the
 * remainder); a code that already carries spaces keeps its own grouping.
 * `groups.join('')` is always the stored code minus its spaces.
 */
export function codeGroups(code: string): string[] {
  const c = code.trim();
  if (!c) return [];
  if (/\s/.test(c)) return c.split(/\s+/);
  if (c.length < 10) return [c];
  const out: string[] = [];
  for (let i = 0; i < c.length; i += 4) out.push(c.slice(i, i + 4));
  /* never leave a lonely last character: fold a 1-char tail into the group before */
  if (out.length > 1 && (out[out.length - 1] ?? '').length === 1) {
    const tail = out.pop() ?? '';
    out[out.length - 1] += tail;
  }
  return out;
}

/** "today" / "tomorrow" / "Fri 11 Dec" — the TODAY card's own label. */
export type WhenWord = { word: 'today' | 'tomorrow' | 'date'; date: ISODate };
export function whenWord(date: ISODate, now: ISODate): WhenWord {
  if (date === now) return { word: 'today', date };
  if (date === addDays(now, 1)) return { word: 'tomorrow', date };
  return { word: 'date', date };
}

/** The one line a row prints under a booking's title: the route and times
    for a move, the dates and nights for a stay, the venue and time for a
    ticket. Only what the booking states. */
export function bookingLine(b: Booking): string {
  switch (b.kind) {
    case 'flight': {
      const plus = b.arrDayOffset ? `+${b.arrDayOffset}` : '';
      return `${b.from.code} ${b.dep} → ${b.to.code} ${b.arr}${plus}`;
    }
    case 'train':
    case 'other': {
      const from = b.from?.name;
      const to = b.to?.name;
      const ends = from && to ? `${from} → ${to}` : mdliteToText(b.title);
      const dep = b.dep ? ` · ${b.dep}${b.arr ? ` → ${b.arr}` : ''}` : '';
      return `${ends}${dep}${b.duration ? ` · ${b.duration}` : ''}`;
    }
    case 'hotel':
      return stayLine(b);
    case 'activity':
      return [b.venue, b.time].filter(Boolean).join(' · ');
  }
}

export function stayLine(b: HotelBooking): string {
  const n = daysBetween(b.checkIn, b.checkOut);
  const nights = n > 0 ? ` · ${n} ${n === 1 ? 'night' : 'nights'}` : '';
  return `${b.city ? `${b.city} · ` : ''}${fmtShort(b.checkIn)} → ${fmtShort(b.checkOut)}${nights}`;
}

/** The date a row leads with. */
export function bookingDateLabel(b: Booking): string {
  return fmtDow(b.kind === 'hotel' ? b.checkIn : b.date);
}

/** A flight's carrier line and number, as the pass header prints them. */
export function passTitle(b: Booking): { caps: string; title: string } {
  switch (b.kind) {
    case 'flight':
      return { caps: `${b.carrier} · flight`, title: b.flightNo };
    case 'train':
      return { caps: 'Train', title: b.trainNo ?? mdliteToText(b.title) };
    case 'hotel':
      return { caps: b.city ? `Stay · ${b.city}` : 'Stay', title: mdliteToText(b.title) };
    case 'activity':
      return { caps: 'Ticket', title: mdliteToText(b.title) };
    default:
      return { caps: 'On the road', title: mdliteToText(b.title) };
  }
}

/** The documents a booking carries (its e-ticket, its confirmation). */
export function attachedDocs<D extends { bookingId?: string }>(docs: D[], bookingId: string): D[] {
  return docs.filter((d) => d.bookingId === bookingId);
}

/* ---------- Counter mode ---------- */

/** What Counter mode shows a desk agent: who, where, when, and the code. */
export interface CounterSubject {
  caps: string;
  title: string;
  lines: string[];
  when?: string;
  codeLabel: string;
  code: string;
  codeSub?: string;
}

/** A booking or a wallet card as Counter mode prints it — or null when it
    carries no code, because Counter mode with nothing to read out is a
    white screen with a lie on it. */
export function counterSubject(
  x: Booking | { kind: 'card'; title: string; code?: string; codeLabel?: string },
): CounterSubject | null {
  const code = x.code?.trim();
  if (!code) return null;
  if (x.kind === 'card') {
    return { caps: 'Card', title: mdliteToText(x.title), lines: [], codeLabel: x.codeLabel ?? 'Number', code };
  }
  const b = x;
  const codeLabel = b.codeLabel ?? 'Booking no.';
  const codeSub = b.codeSub?.trim() || undefined;
  switch (b.kind) {
    case 'flight':
      return {
        caps: b.carrier,
        title: b.flightNo,
        lines: [
          `${b.from.name ? `${b.from.name} ` : ''}(${b.from.code})`,
          `→ ${b.to.name ? `${b.to.name} ` : ''}(${b.to.code})`,
        ],
        when: `${fmtDow(b.date)} · ${b.dep}`,
        codeLabel,
        code,
        codeSub,
      };
    case 'train':
    case 'other': {
      const lines = b.from && b.to ? [b.from.name, `→ ${b.to.name}`] : [];
      return {
        caps: b.kind === 'train' ? 'Train' : 'On the road',
        title: b.kind === 'train' && b.trainNo ? b.trainNo : mdliteToText(b.title),
        lines,
        when: `${fmtDow(b.date)}${b.dep ? ` · ${b.dep}` : ''}`,
        codeLabel,
        code,
        codeSub,
      };
    }
    case 'hotel': {
      const n = daysBetween(b.checkIn, b.checkOut);
      return {
        caps: 'Stay',
        title: mdliteToText(b.title),
        lines: b.city ? [b.city] : [],
        when: `${fmtDow(b.checkIn)} → ${fmtDow(b.checkOut)}${n > 0 ? ` · ${n} ${n === 1 ? 'night' : 'nights'}` : ''}`,
        codeLabel,
        code,
        codeSub,
      };
    }
    case 'activity':
      return {
        caps: 'Ticket',
        title: mdliteToText(b.title),
        lines: b.venue ? [b.venue] : [],
        when: `${fmtDow(b.date)}${b.time ? ` · ${b.time}` : ''}`,
        codeLabel,
        code,
        codeSub,
      };
  }
}

/* ---------- a card's own warning ---------- */

/**
 * A driver card whose own words carry ⚠️ is a place you must NOT be taken
 * to by mistake ("Beijing Capital Airport Terminal 3 (PEK) — ⚠️ NOT the
 * Dec 11 airport any more…"). The glyph marks where the warning begins, so
 * the text splits there: the name before it, the warning after it — nothing
 * rephrased, nothing added. No glyph, no warning.
 */
export function splitWarning(text: string): { main: string; warning: string | null } {
  const at = text.indexOf('⚠');
  if (at < 0) return { main: text, warning: null };
  const main = text
    .slice(0, at)
    .replace(/[\s—–\-:;,]+$/, '')
    .trim();
  const warning = mdliteToText(text.slice(at).replace(/^⚠️?\s*/, ''))
    .replace(/^[\s:—–-]+/, '')
    .trim();
  return { main: main || text.trim(), warning: warning || null };
}

/* ---------- the moment a countdown counts from ---------- */

/**
 * THE MOMENT A COUNTDOWN COUNTS FROM — the same rule Now's day view uses.
 * On the real today it is the real clock. On a PREVIEWED day it is that
 * day's 00:00, because a day you are not living has no "now" inside it:
 * pasting the wall time onto another date would make the same preview read
 * differently at 09:00 and at 23:00.
 */
export function momentOf(now: ISODate, wall: Date): Date {
  const y = wall.getFullYear();
  const m = String(wall.getMonth() + 1).padStart(2, '0');
  const d = String(wall.getDate()).padStart(2, '0');
  if (`${y}-${m}-${d}` === now) return wall;
  const [yy, mm, dd] = now.split('-').map(Number);
  return new Date(yy ?? 1970, (mm ?? 1) - 1, dd ?? 1, 0, 0, 0, 0);
}

/** How a leg is drawn on its pass: Flow while it is the next thing you
    have to be at; painted (Ink's end state) once its day has passed; dotted
    lilac while it is further ahead; unlit amber while it is not booked. */
export type LegState = 'flow' | 'done' | 'ahead' | 'unlit';
export function legState(b: Pick<Booking, 'status' | 'date'>, now: ISODate, isNext: boolean): LegState {
  if (b.status !== 'booked') return 'unlit';
  if (isNext) return 'flow';
  if (b.date < now) return 'done';
  return 'ahead';
}

/* FIND — searches the phone, no internet (f-find).

   One index over everything the trip carries that a traveller might look
   for with three letters typed on a moving train: bookings (by name, number,
   airport, station, code), driver cards and phrases (English and Chinese),
   the runbook steps and the day each belongs to, the stops and the named
   places inside them, the to-dos, the trip's own info cards, the emergency
   numbers, the wallet cards, the documents and the note.

   WARNINGS COME FIRST. A driver card whose own words carry ⚠️ is a place you
   must NOT be taken to by mistake — search "daxing" and the old Capital-
   airport card is the first thing on the screen, drawn as a warning, with
   the place you DO want beside it. That "instead" is found by exact joins on
   the data and nothing looser: the warning names a flight number; that
   number is a booking; the booking's departure airport is searched by a map
   name; the driver card searched by the same name is the one to show. If any
   link is missing, the warning stands alone rather than pointing somewhere
   plausible. The trip file's critical info cards are warnings too — its own
   `severity: 'crit'`, never a guess.

   Pure: data in, results out. Matching is case- and accent-insensitive; every
   word typed must appear somewhere in the entry; Chinese matches as written. */
import type {
  Booking,
  DayPlan,
  DocumentFile,
  EmergencyContact,
  InfoCard,
  ISODate,
  Runbook,
  ShowCard,
  Stop,
  Task,
  TripNote,
  WalletCard,
} from '../model/types';
import { compareIso, fmtDow } from './dates';
import { mdliteToText } from './mdlite';
import { bookingLine, splitWarning } from './pass';

/* ---------- the index ---------- */

export type FindKind =
  | 'booking'
  | 'driver'
  | 'phrase'
  | 'step'
  | 'stop'
  | 'spot'
  | 'task'
  | 'info'
  | 'emergency'
  | 'card'
  | 'doc'
  | 'note';

/** What a result opens. */
export type FindRef =
  | { to: 'pass'; bookingId: string }
  | { to: 'driver'; cardId: string }
  | { to: 'phrase'; cardId: string }
  | { to: 'step'; runbookId: string; index: number; date: ISODate | null }
  | { to: 'stop'; stopId: string }
  | { to: 'spot'; stopId: string; spotId: string }
  | { to: 'todo'; taskId: string }
  | { to: 'info'; cardId: string }
  | { to: 'emergency'; id: string }
  | { to: 'card'; cardId: string }
  | { to: 'doc'; docId: string }
  | { to: 'note' };

export interface FindEntry {
  kind: FindKind;
  key: string;
  /** Plain text: the row's first line. */
  title: string;
  /** Plain text: the row's second line, when there is one. */
  sub?: string;
  /** Chinese, as written — a driver card's or a place's own name. */
  zh?: string;
  /** Extra lines searched (and, when one matches, shown): an info card's
      items, a note's lines, a booking's note. */
  lines?: string[];
  /** Everything searchable, already normalised. */
  hay: string;
  /** For ordering inside a group: the day it happens. */
  date?: ISODate;
  status?: Booking['status'];
  ref: FindRef;
  /** The trip file's own warning on this entry (⚠️ on a driver card). */
  warning?: string;
  /** A critical info card — a warning by the trip file's own severity. */
  crit?: boolean;
  /** For a warned driver card: the booking its warning names, and the card
      for the place that booking leaves from — found by exact joins only. */
  instead?: { bookingId: string; cardId: string | null };
  /** A step's day(s), and the runbook it belongs to — for "Step 3 of 8". */
  step?: { runbookTitle: string; index: number; total: number; dates: ISODate[] };
}

export interface FindInput {
  bookings: Booking[];
  showCards: ShowCard[];
  runbooks: Runbook[];
  dayPlans: DayPlan[];
  stops: Stop[];
  tasks: Task[];
  infoCards: InfoCard[];
  emergency: EmergencyContact[];
  walletCards: WalletCard[];
  documents: DocumentFile[];
  note?: TripNote | null;
}

/** Lower case, accents off, one space — the form both sides are compared in. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A flight number as a comparable token: "CA 8609", "CA8609" → "ca8609". */
function flightKey(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

const plain = (s: string | undefined): string => (s ? mdliteToText(s).trim() : '');
const joinHay = (parts: (string | undefined | null)[]): string => normalize(parts.filter(Boolean).join(' · '));

export function buildIndex(input: FindInput): FindEntry[] {
  const out: FindEntry[] = [];
  const places = input.showCards.filter((c) => c.kind === 'place');

  /* ---------- bookings ---------- */
  const flightsByNo = new Map<string, Booking>();
  for (const b of input.bookings) {
    if (b.kind === 'flight') flightsByNo.set(flightKey(b.flightNo), b);
    const ends: string[] = [];
    if (b.kind === 'flight') ends.push(b.carrier, b.flightNo, b.from.code, b.from.name ?? '', b.to.code, b.to.name ?? '');
    if (b.kind === 'train' || b.kind === 'other') {
      for (const e of [b.from, b.to]) {
        if (!e) continue;
        ends.push(e.name, e.code ?? '', ...(e.stations ?? []).map((st) => st.name));
      }
      if (b.kind === 'train' && b.trainNo) ends.push(b.trainNo);
    }
    if (b.kind === 'hotel') ends.push(b.city);
    if (b.kind === 'activity' && b.venue) ends.push(b.venue);
    out.push({
      kind: 'booking',
      key: `booking:${b.id}`,
      title: plain(b.title),
      sub: bookingLine(b),
      hay: joinHay([
        plain(b.title),
        ...ends,
        b.groupLabel,
        b.code,
        b.codeSub,
        b.mapQuery,
        b.address,
        b.addressEn,
        ...b.meta.map((m) => `${m.k} ${m.v}`),
        plain(b.note),
      ]),
      date: b.kind === 'hotel' ? b.checkIn : b.date,
      status: b.status,
      ref: { to: 'pass', bookingId: b.id },
    });
  }

  /* ---------- driver cards and phrases ---------- */
  for (const c of input.showCards) {
    const parts = splitWarning(c.meaning);
    const entry: FindEntry = {
      kind: c.kind === 'place' ? 'driver' : 'phrase',
      key: `${c.kind}:${c.id}`,
      title: parts.main,
      zh: c.native,
      hay: joinHay([c.native, c.meaning, plain(c.note), c.address, c.addressEn, c.mapQuery]),
      ref: c.kind === 'place' ? { to: 'driver', cardId: c.id } : { to: 'phrase', cardId: c.id },
    };
    if (c.kind === 'place' && parts.warning) {
      entry.warning = parts.warning;
      /* THE INSTEAD, by exact joins: a flight number the warning names → that
         booking → the card searched by the same map name it leaves from. */
      const named = [...parts.warning.matchAll(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/g)]
        .map((m) => flightsByNo.get(flightKey(`${m[1]}${m[2]}`)))
        .find((b): b is Booking => !!b);
      if (named) {
        const card = named.mapQuery
          ? places.find((p) => p.id !== c.id && !p.pending && p.mapQuery === named.mapQuery && !splitWarning(p.meaning).warning)
          : undefined;
        entry.instead = { bookingId: named.id, cardId: card?.id ?? null };
      }
    }
    out.push(entry);
  }

  /* ---------- runbook steps, with the days they are the day's list ---------- */
  const datesOf = new Map<string, ISODate[]>();
  for (const d of input.dayPlans) {
    if (!d.runbookId) continue;
    datesOf.set(d.runbookId, [...(datesOf.get(d.runbookId) ?? []), d.date].sort(compareIso));
  }
  for (const r of input.runbooks) {
    const dates = datesOf.get(r.id) ?? [];
    r.steps.forEach((step, i) => {
      out.push({
        kind: 'step',
        key: `step:${r.id}:${i}`,
        title: plain(step),
        sub: plain(r.title),
        hay: joinHay([plain(step), plain(r.title)]),
        date: dates[0],
        ref: { to: 'step', runbookId: r.id, index: i, date: dates[0] ?? null },
        step: { runbookTitle: plain(r.title), index: i, total: r.steps.length, dates },
      });
    });
  }

  /* ---------- stops and the named places inside them ---------- */
  for (const s of input.stops) {
    if (s.kind !== 'stop') continue;
    out.push({
      kind: 'stop',
      key: `stop:${s.id}`,
      title: plain(s.name),
      sub: s.whenLabel ? plain(s.whenLabel) : `${fmtDow(s.start)} → ${fmtDow(s.end)}`,
      hay: joinHay([plain(s.name), s.whenLabel, s.mapQuery, s.mapCity, s.address, s.addressEn]),
      date: s.start,
      ref: { to: 'stop', stopId: s.id },
    });
    for (const sp of s.spots ?? []) {
      out.push({
        kind: 'spot',
        key: `spot:${sp.id}`,
        title: plain(sp.name),
        sub: plain(s.name),
        zh: sp.native,
        hay: joinHay([plain(sp.name), sp.native, sp.address, sp.addressEn, sp.mapQuery]),
        date: s.start,
        ref: { to: 'spot', stopId: s.id, spotId: sp.id },
      });
    }
  }

  /* ---------- to-dos ---------- */
  for (const t of input.tasks) {
    out.push({
      kind: 'task',
      key: `task:${t.id}`,
      title: plain(t.title),
      sub: t.dueLabel ?? (t.due ? fmtDow(t.due) : undefined),
      hay: joinHay([plain(t.title), plain(t.detail), t.dueLabel]),
      date: t.due,
      ref: { to: 'todo', taskId: t.id },
    });
  }

  /* ---------- the trip's own knowledge ---------- */
  for (const g of input.infoCards) {
    const lines = g.items.map(plain);
    out.push({
      kind: 'info',
      key: `info:${g.id}`,
      title: plain(g.heading),
      lines,
      hay: joinHay([plain(g.heading), ...lines]),
      crit: g.severity === 'crit',
      ref: { to: 'info', cardId: g.id },
    });
  }
  for (const e of input.emergency) {
    out.push({
      kind: 'emergency',
      key: `emergency:${e.id}`,
      title: plain(e.label),
      sub: e.value,
      hay: joinHay([plain(e.label), e.value]),
      ref: { to: 'emergency', id: e.id },
    });
  }
  for (const w of input.walletCards) {
    out.push({
      kind: 'card',
      key: `card:${w.id}`,
      title: plain(w.title),
      sub: w.codeLabel,
      hay: joinHay([plain(w.title), w.code, w.codeLabel, ...w.rows.map((r) => `${r.k} ${r.v}`), plain(w.note)]),
      ref: { to: 'card', cardId: w.id },
    });
  }
  for (const d of input.documents) {
    out.push({
      kind: 'doc',
      key: `doc:${d.id}`,
      title: d.name,
      sub: d.fileName,
      hay: joinHay([d.name, d.fileName]),
      ref: { to: 'doc', docId: d.id },
    });
  }
  if (input.note?.text) {
    const lines = mdliteToText(input.note.text)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    out.push({ kind: 'note', key: 'note', title: 'Notes', lines, hay: joinHay(lines), ref: { to: 'note' } });
  }
  return out;
}

/* ---------- searching ---------- */

/** The chips over the results (f-find): All · Bookings · Cards · Steps ·
    Places · More. */
export type FindScope = 'all' | 'bookings' | 'cards' | 'steps' | 'places' | 'more';
export const SCOPES: FindScope[] = ['all', 'bookings', 'cards', 'steps', 'places', 'more'];
export function scopeOf(k: FindKind): Exclude<FindScope, 'all'> {
  switch (k) {
    case 'booking':
      return 'bookings';
    case 'driver':
    case 'phrase':
    case 'card':
      return 'cards';
    case 'step':
      return 'steps';
    case 'stop':
    case 'spot':
      return 'places';
    default:
      return 'more';
  }
}

export interface FindHit {
  entry: FindEntry;
  score: number;
  /** For an entry with lines: the ones that matched, in order. */
  lines: string[];
}
export interface FindGroup {
  kind: FindKind | 'today-steps';
  hits: FindHit[];
}
export interface FindResults {
  query: string;
  /** Warnings, first — a warned driver card, a critical info card. */
  warnings: FindHit[];
  groups: FindGroup[];
  counts: Record<FindScope, number>;
}

/** The words typed, normalised; empty words are dropped. */
export function tokens(query: string): string[] {
  return normalize(query).split(' ').filter(Boolean);
}

/** Where the words sit: a title that starts with the first word beats one
    that merely contains it, which beats a match buried in a note. */
function scoreOf(e: FindEntry, words: string[]): number {
  const title = normalize(e.title);
  const zh = normalize(e.zh ?? '');
  const sub = normalize(e.sub ?? '');
  let s = 0;
  for (const w of words) {
    if (title === w) s += 60;
    else if (title.startsWith(w)) s += 40;
    else if (new RegExp(`(^|[^a-z0-9])${escapeRe(w)}`).test(title)) s += 30;
    else if (title.includes(w)) s += 20;
    else if (zh.includes(w)) s += 20;
    else if (sub.includes(w)) s += 12;
    else s += 4;
  }
  return s;
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** THE ORDER OF THE RESULTS: warnings, then the kinds in the order a
    traveller reaches for them. */
const KIND_ORDER: FindKind[] = ['booking', 'driver', 'phrase', 'step', 'stop', 'spot', 'task', 'info', 'emergency', 'card', 'doc', 'note'];

export function search(index: FindEntry[], query: string, scope: FindScope = 'all', today?: ISODate): FindResults {
  const words = tokens(query);
  const counts: Record<FindScope, number> = { all: 0, bookings: 0, cards: 0, steps: 0, places: 0, more: 0 };
  const empty: FindResults = { query, warnings: [], groups: [], counts };
  if (!words.length) return empty;

  const hits: FindHit[] = [];
  for (const e of index) {
    if (!words.every((w) => e.hay.includes(w))) continue;
    const lines = (e.lines ?? []).filter((l) => {
      const n = normalize(l);
      return words.some((w) => n.includes(w));
    });
    hits.push({ entry: e, score: scoreOf(e, words), lines });
  }
  for (const h of hits) {
    counts.all++;
    counts[scopeOf(h.entry.kind)]++;
  }

  const inScope = hits.filter((h) => scope === 'all' || scopeOf(h.entry.kind) === scope);
  const isWarning = (h: FindHit): boolean => !!h.entry.warning || !!h.entry.crit;
  const warnings = inScope
    .filter(isWarning)
    /* a place you must not be taken to outranks a critical note */
    .sort((a, b) => Number(!!b.entry.warning) - Number(!!a.entry.warning) || b.score - a.score);

  const byDate = (a: FindHit, b: FindHit): number =>
    b.score - a.score || compareIso(a.entry.date ?? '9999-99-99', b.entry.date ?? '9999-99-99') || a.entry.title.localeCompare(b.entry.title);

  const groups: FindGroup[] = [];
  for (const kind of KIND_ORDER) {
    const list = inScope.filter((h) => h.entry.kind === kind && !isWarning(h));
    if (!list.length) continue;
    if (kind === 'step' && today) {
      /* the steps of TODAY'S list lead, under their own heading */
      const todays = list.filter((h) => h.entry.step?.dates.includes(today));
      const rest = list.filter((h) => !h.entry.step?.dates.includes(today));
      if (todays.length) groups.push({ kind: 'today-steps', hits: todays.sort((a, b) => (a.entry.step?.index ?? 0) - (b.entry.step?.index ?? 0)) });
      if (rest.length) groups.push({ kind, hits: rest.sort(byDate) });
      continue;
    }
    groups.push({ kind, hits: list.sort(byDate) });
  }
  return { query, warnings, groups, counts };
}

/* ---------- highlighting ---------- */

export interface Seg {
  t: string;
  hit: boolean;
}

/**
 * The text cut into plain and matched pieces, so a screen can <mark> what was
 * found without ever building HTML from data. Matching is done on the
 * normalised form (accents off, lower case) and mapped back to the original
 * characters, so "Hôtel" lights up for "hotel" with its accent intact.
 */
export function highlight(text: string, query: string): Seg[] {
  const words = tokens(query);
  if (!text) return [];
  if (!words.length) return [{ t: text, hit: false }];
  /* the normalised text, and for each of its characters the original index */
  let norm = '';
  const at: number[] = [];
  const chars = [...text];
  let pos = 0;
  for (const ch of chars) {
    const n = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (let k = 0; k < n.length; k++) {
      norm += n[k];
      at.push(pos);
    }
    pos += ch.length;
  }
  const ranges: [number, number][] = [];
  for (const w of words) {
    let from = 0;
    for (;;) {
      const i = norm.indexOf(w, from);
      if (i < 0) break;
      const start = at[i] ?? 0;
      const lastIdx = at[i + w.length - 1] ?? start;
      /* the original character at the last index may be a surrogate pair */
      const end = lastIdx + ([...text.slice(lastIdx)][0]?.length ?? 1);
      ranges.push([start, end]);
      from = i + w.length;
    }
  }
  if (!ranges.length) return [{ t: text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: Seg[] = [];
  let i = 0;
  for (const [s, e] of merged) {
    if (s > i) out.push({ t: text.slice(i, s), hit: false });
    out.push({ t: text.slice(s, e), hit: true });
    i = e;
  }
  if (i < text.length) out.push({ t: text.slice(i), hit: false });
  return out;
}

/* THE TRAVEL DAY AS A METRO LINE (f-travelday, mx-today) — generated from
   the day's own bookings, never drawn by hand.

   STATIONS are the ends of the day's legs: last night's bed (checked out
   today), each leg's departure and arrival, tonight's bed. Two stations that
   are one place (you land at Daxing and fly on from Daxing) are one station.
   SEGMENTS join them: a LEG is a booking (a flight is drawn as an arc, a
   train or a road leg as a line); a TRANSFER is the gap between two places
   that no booking covers — getting from Qinghe to Daxing — drawn dashed and
   pointing at the runbook step that says how.

   THE RUNBOOK, JOINED BY EXACT WORDS ONLY. A leg is the step that names it
   (its flight number, its own label — "Shared car" — or both of its ends); a
   transfer is the step between its neighbouring legs that names the most of
   its two ends. A time is lifted from a step only where it is anchored to
   the place it is about ("into Qinghe by ~14:30", "be at PKX by ~16:45",
   "Pullman ≈21:30") — "off the snow by ~11:00" is about nothing on the line
   and is left alone. Nothing is composed: no mode of transport, no duration
   and no time that the trip file does not state.

   WHERE YOU ARE. A segment is behind you when its step is ticked, when the
   clock has passed a leg's own arrival (real today only), or when anything
   after it is behind you. The first segment that is not is NOW: it Flows,
   and you are at the station it leaves from. A day already over in real
   life is all behind you.

   Pure: bookings, the runbook, its ticks and the clock in; values out. */
import type { Booking, BookingStatus, HotelBooking, ISODate, RailEnd, Runbook, ShowCard } from '../model/types';
import { addDays, compareIso } from './dates';
import { plainWords as plain } from './mdlite';
import { isLive as live } from './booked';
import { spansNight } from './commitment';
import { timeMinutes } from './timeline';
import { chipOf, noBookingStamp, type Stamp } from './stamps';
export { chipOf };
import { S } from '../i18n/strings';

export type SegState = 'done' | 'now' | 'ahead';

export interface Station {
  /** English, as the trip names the place. */
  name: string;
  code?: string;
  /** Chinese, where the data gives it (a station's own name, or the driver
      card joined by exact name or airport code). */
  native?: string;
  /** The driver card for this place (exact joins only). */
  card?: string;
  bed?: 'last' | 'tonight';
  /** The stay behind a bed station. */
  booking?: Booking;
  /** Tonight with nothing held: no stay covers it and no leg spans it. */
  missing?: boolean;
  /** A clock the booking states here (departure or arrival). */
  time?: string;
  /** A time lifted from the runbook, anchored to this place ("~14:30"). */
  by?: string;
  /** A warning lifted from the same step, in its own words, anchored to
      this place ("Cross to Daxing (PKX) — NOT Capital (PEK)" → "NOT Capital"). */
  warn?: string;
}
export interface Segment {
  kind: 'leg' | 'transfer';
  mode: 'air' | 'rail' | 'road' | 'transfer';
  booking?: Booking;
  /** "CA 8609", "HSR", "Tina's bus" — empty for a transfer. */
  label: string;
  duration?: string;
  status?: BookingStatus;
  /** The runbook step (0-based) that describes it. */
  step: number | null;
  /** That step says *verify*. */
  verify: boolean;
  /** The move between two beds that nothing covers — no flight, no train. */
  missing?: boolean;
  state: SegState;
}
export interface MetroLine {
  stations: Station[];
  /** segments[i] joins stations[i] → stations[i + 1] */
  segments: Segment[];
  /** The station you are at — where the NOW segment leaves from; -1 when none. */
  you: number;
  /** Everything on the line is behind you. */
  arrived: boolean;
}

/* ---------- the day's legs ---------- */

const MOVES = new Set(['flight', 'train', 'other']);

/** Departure order — a leg with NO stated departure first, because on this
    trip the untimed leg is the feeder (the train to the airport); the same
    rule as connectors.ts. */
function byDeparture(a: Booking, b: Booking): number {
  const t = (x: Booking): string => ('dep' in x && typeof x.dep === 'string' && x.dep) || '00:00';
  return compareIso(a.date, b.date) || t(a).localeCompare(t(b));
}

/** The legs that move you on `date`: those dated that day, and one that
    left the day before and lands on it. */
export function dayMoves(bookings: Booking[], date: ISODate): Booking[] {
  const out = bookings.filter((b) => MOVES.has(b.kind) && live(b) && b.date === date);
  for (const b of bookings) {
    if (!MOVES.has(b.kind) || !live(b) || !spansNight(b)) continue;
    const offset = b.kind === 'flight' ? b.arrDayOffset : 1;
    if (addDays(b.date, offset) === date && !out.includes(b)) out.push(b);
  }
  return out.sort(byDeparture);
}

/** A travel day: the trip wrote a runbook for it, or something moves you. */
export function isTravelDay(runbookId: string | undefined, bookings: Booking[], date: ISODate): boolean {
  return !!runbookId || dayMoves(bookings, date).length > 0;
}

/* ---------- places ---------- */

/** "⚠️ Dec 11 runbook — the Daxing flight" → "The Daxing flight". A title
    that is only a date and the word runbook before its dash says nothing the
    date on the screen does not; anything else is kept whole, emoji aside. */
export function runbookHeadline(title: string): string {
  const t = plain(title);
  const m = /^(?:[A-Z][a-z]{2} \d{1,2}|\d{1,2} [A-Z][a-z]{2}) runbook\s+[—–-]\s+(.+)$/.exec(t);
  const rest = m?.[1]?.trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : t;
}

/** The label a leg goes by: a flight's number, a train's number, else the
    words before " · " in its title ("HSR", "Tina's bus", "Shared car"). */
export function legLabel(b: Booking): string {
  if (b.kind === 'flight') return b.flightNo;
  if (b.kind === 'train' && b.trainNo) return b.trainNo;
  return plain(b.title).split(' · ')[0]?.trim() ?? '';
}

const GENERIC = new Set([
  'intl',
  'international',
  'airport',
  'terminal',
  'station',
  'railway',
  'hotel',
  'the',
  'and',
  'city',
  'south',
  'north',
  'east',
  'west',
]);
/** The words that name a place in a step: its code, its native name, and
    the distinctive words of its English name. */
function tokens(s: Station): string[] {
  const out: string[] = [];
  if (s.code) out.push(s.code);
  if (s.native) out.push(...s.native.split(/\s*\/\s*/));
  for (const w of s.name.split(/[^\p{L}\p{N}']+/u)) if (w.length >= 4 && !GENERIC.has(w.toLowerCase())) out.push(w);
  return out;
}
const norm = (s: string): string => s.toLowerCase();
const same = (a: Station, b: Station): boolean =>
  (!!a.code && a.code === b.code) || norm(a.name) === norm(b.name) || (!!a.native && a.native === b.native);

function railStation(e: RailEnd | undefined, fallback: string): Station {
  const st = e?.stations ?? [];
  return {
    name: plain(e?.name ?? fallback),
    ...(st.length ? { native: st.map((x) => x.name).join(' / ') } : {}),
  };
}
function ends(b: Booking): [Station, Station] {
  if (b.kind === 'flight') {
    return [
      { name: b.from.name ?? b.from.code, code: b.from.code, time: b.dep },
      { name: b.to.name ?? b.to.code, code: b.to.code, time: b.arr + (b.arrDayOffset ? `+${b.arrDayOffset}` : '') },
    ];
  }
  const from = 'from' in b ? b.from : undefined;
  const to = 'to' in b ? b.to : undefined;
  const dep = 'dep' in b ? b.dep : undefined;
  const arr = 'arr' in b ? b.arr : undefined;
  return [
    { ...railStation(from, plain(b.title)), ...(dep ? { time: dep } : {}) },
    { ...railStation(to, plain(b.title)), ...(arr ? { time: arr + (spansNight(b) ? '+1' : '') } : {}) },
  ];
}

/** Join a station to its driver card: the card's Chinese is the station's
    own name, or the card names the airport's code "(PKX)". */
function joinCard(s: Station, cards: ShowCard[]): void {
  const card = cards.find(
    (c) =>
      c.kind === 'place' &&
      !c.pending &&
      ((!!s.native && c.native === s.native) || (!!s.code && new RegExp(`\\(${s.code}\\)`).test(c.meaning))),
  );
  if (!card) return;
  s.card = card.id;
  s.native ??= card.native;
}

/* ---------- the runbook ---------- */

/** A place's words as a pattern that matches them literally. */
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "into Qinghe by ~14:30" · "be at PKX by ~16:45" · "Pullman ≈21:30" — a
    time the step ties to THIS place, or nothing. */
export function timeAt(step: string, place: string[]): string | null {
  const text = plain(step);
  for (const t of place) {
    const at = esc(t);
    const m =
      new RegExp(`${at}[^.;·]{0,24}?\\bby\\s+(?:about\\s+)?([~≈]?\\s?\\d{1,2}:\\d{2})`, 'i').exec(text) ??
      new RegExp(`${at}\\s*([~≈]\\s?\\d{1,2}:\\d{2})`, 'i').exec(text);
    if (m?.[1]) return m[1].replace(/\s/g, '');
  }
  return null;
}

/** "Cross to Daxing (PKX) — NOT Capital (PEK)" → "NOT Capital": the trip
    file's own capital NOT and the name it rules out, only where the step ties
    it to THIS place (the place, then the NOT, within a few words) — a
    warning is lifted, never composed. The name is every Title-case word in a
    row ("NOT Beijing South", not "NOT Beijing"); a shouted word after the
    NOT is a status, not a place ("NOT BOOKED YET" is no warning — Run 3c). */
export function warnAt(step: string, place: string[]): string | null {
  const text = plain(step);
  for (const t of place) {
    const m = new RegExp(`${esc(t)}[^.;·]{0,24}?\\b(NOT \\p{Lu}\\p{Ll}[\\p{L}-]*(?: \\p{Lu}\\p{Ll}[\\p{L}-]*)*)`, 'u').exec(text);
    if (m?.[1]) return m[1];
  }
  return null;
}

const compact = (s: string): string => s.replace(/\s+/g, '').toUpperCase();
const has = (text: string, t: string): boolean => norm(text).includes(norm(t));

function legStep(b: Booking, from: Station, to: Station, steps: string[], min: number): number | null {
  const label = legLabel(b);
  for (let i = Math.max(0, min); i < steps.length; i++) {
    const text = plain(steps[i]!);
    const id = b.kind === 'flight' || (b.kind === 'train' && b.trainNo) ? compact(label) : '';
    if (id && compact(text).includes(id)) return i;
    if (!id && label.length >= 4 && has(text, label)) return i;
    if (tokens(from).some((t) => has(text, t)) && tokens(to).some((t) => has(text, t))) return i;
  }
  return null;
}

const MOVE_WORDS = /\b(transfer|taxi|metro|shuttle|walk|cross|didi|pickup|drive)\b/i;
function transferStep(from: Station, to: Station, steps: string[], lo: number, hi: number): number | null {
  let best: number | null = null;
  let score = 0;
  for (let i = lo + 1; i < Math.min(hi, steps.length); i++) {
    const text = plain(steps[i]!);
    const s =
      tokens(to).filter((t) => has(text, t)).length * 2 +
      tokens(from).filter((t) => has(text, t)).length +
      (MOVE_WORDS.test(text) ? 1 : 0);
    if (s > score) {
      best = i;
      score = s;
    }
  }
  return best;
}

/* ---------- the line ---------- */

export interface MetroInput {
  date: ISODate;
  bookings: Booking[];
  cards?: ShowCard[];
  runbook?: Runbook;
  /** Which runbook steps are ticked (0-based). */
  ticked?: (i: number) => boolean;
  /** The day's own label for tonight's bed, for a night nobody has booked. */
  bedLabel?: string;
  /** The real clock, in minutes, when `date` is the real today — else null. */
  nowMinutes?: number | null;
  /** The real today, to know a day that is already over. */
  realToday?: ISODate;
}

const STAY_RANK: Record<string, number> = { booked: 0, walkin: 1, pending: 2 };
const stays = (bookings: Booking[]): HotelBooking[] =>
  bookings
    .filter((b): b is HotelBooking => b.kind === 'hotel' && live(b))
    .sort((a, b) => (STAY_RANK[a.status] ?? 9) - (STAY_RANK[b.status] ?? 9));

export function buildMetroLine(input: MetroInput): MetroLine | null {
  const { date, bookings, runbook } = input;
  const cards = input.cards ?? [];
  const steps = runbook?.steps ?? [];
  const ticked = input.ticked ?? (() => false);
  const moves = dayMoves(bookings, date);
  const beds = stays(bookings);
  const last = beds.find((b) => b.checkOut === date);
  const tonight =
    beds.find((b) => b.checkIn === date) ?? beds.find((b) => compareIso(b.checkIn, date) < 0 && compareIso(date, b.checkOut) < 0);
  if (!moves.length && !(last && tonight && last.id !== tonight.id)) return null;

  const stations: Station[] = [];
  const segments: Segment[] = [];
  const bedStation = (b: HotelBooking, bed: 'last' | 'tonight'): Station => ({ name: plain(b.title), bed, booking: b });
  /* add a station, joining it to the one before by a transfer unless it is
     the same place (then the two are one station) */
  const put = (s: Station): void => {
    const prev = stations[stations.length - 1];
    if (prev && same(prev, s)) {
      prev.time ??= s.time;
      prev.native ??= s.native;
      prev.bed ??= s.bed;
      prev.booking ??= s.booking;
      return;
    }
    if (prev) segments.push({ kind: 'transfer', mode: 'transfer', label: '', step: null, verify: false, state: 'ahead' });
    stations.push(s);
  };

  if (last && last !== tonight) put(bedStation(last, 'last'));
  for (const b of moves) {
    const [from, to] = ends(b);
    /* a leg that left yesterday is joined where it lands */
    if (b.date !== date) {
      put({ ...to, ...('arr' in b && b.arr ? { time: b.arr } : {}) });
    } else {
      put(from);
      segments.push({
        kind: 'leg',
        mode: b.kind === 'flight' ? 'air' : b.kind === 'train' ? 'rail' : 'road',
        booking: b,
        label: legLabel(b),
        ...(b.kind !== 'hotel' && 'duration' in b && b.duration ? { duration: b.duration } : {}),
        status: b.status,
        step: null,
        verify: false,
        state: 'ahead',
      });
      stations.push(to);
    }
  }
  const lastLeg = moves[moves.length - 1];
  if (tonight) put(bedStation(tonight, 'tonight'));
  else if (!(lastLeg && lastLeg.date === date && spansNight(lastLeg)) && input.bedLabel) {
    put({ name: plain(input.bedLabel), bed: 'tonight', missing: true });
  }
  for (const s of stations) joinCard(s, cards);
  /* two beds and nothing booked between them: that gap is a move nobody has
     bought, not a transfer (5 Dec, Yantai → Beijing) */
  if (!moves.length && segments[0]) segments[0].missing = true;

  /* ---- the runbook, joined ---- */
  let min = 0;
  segments.forEach((seg, i) => {
    if (seg.kind !== 'leg' || !seg.booking) return;
    seg.step = legStep(seg.booking, stations[i]!, stations[i + 1]!, steps, min);
    if (seg.step !== null) min = seg.step;
  });
  segments.forEach((seg, i) => {
    if (seg.kind !== 'transfer') return;
    const before = segments.slice(0, i).reverse().find((s) => s.step !== null)?.step ?? -1;
    const after = segments.slice(i + 1).find((s) => s.step !== null)?.step ?? steps.length;
    seg.step = transferStep(stations[i]!, stations[i + 1]!, steps, before, after);
  });
  segments.forEach((seg, i) => {
    if (seg.step === null) return;
    const text = steps[seg.step] ?? '';
    seg.verify = /\*?\bverify\b/i.test(text);
    const to = stations[i + 1]!;
    to.by ??= timeAt(text, tokens(to)) ?? undefined;
    if (!to.by) delete to.by;
    to.warn ??= warnAt(text, tokens(to)) ?? undefined;
    if (!to.warn) delete to.warn;
    /* the bed you leave: "check out of Element by 12:00" */
    const from = stations[i]!;
    if (from.bed === 'last' && !from.by) {
      const out = timeAt(text, tokens(from));
      if (out) from.by = out;
    }
  });

  /* ---- where you are ---- */
  const over = !!input.realToday && compareIso(date, input.realToday) < 0;
  const clock = input.nowMinutes ?? null;
  const done = segments.map((seg) => {
    if (over) return true;
    if (seg.step !== null && ticked(seg.step)) return true;
    const arr = seg.booking && 'arr' in seg.booking && seg.booking.arr ? timeMinutes(seg.booking.arr) : null;
    const sameDay = !!seg.booking && seg.booking.date === date && !spansNight(seg.booking);
    return clock !== null && arr !== null && sameDay && clock >= arr;
  });
  for (let i = done.length - 2; i >= 0; i--) if (done[i + 1]) done[i] = true;
  const now = done.indexOf(false);
  segments.forEach((seg, i) => {
    seg.state = done[i] ? 'done' : i === now ? 'now' : 'ahead';
  });
  return { stations, segments, you: now, arrived: now === -1 };
}

/* ---------- the runbook's own progress ---------- */

export interface StepProgress {
  total: number;
  done: number;
  /** The first step not ticked — the one the Focus card holds; null when all are. */
  current: number | null;
}
export function stepProgress(total: number, ticked: (i: number) => boolean): StepProgress {
  let done = 0;
  let current: number | null = null;
  for (let i = 0; i < total; i++) {
    if (ticked(i)) done++;
    else current ??= i;
  }
  return { total, done, current };
}

/** The segment a runbook step is about, if any. */
export function segmentOfStep(line: MetroLine | null, step: number | null): number {
  if (!line || step === null) return -1;
  return line.segments.findIndex((s) => s.step === step);
}

/* ---------- the line as rows (the screen's layout, decided here) ----------
   One row per station and one per segment between them, each carrying the
   words it prints and the classes its rail is drawn with, so the screen is a
   single loop with no decisions of its own. */

export interface MetroRow {
  kind: 'st' | 'seg';
  /* a station */
  name?: string;
  native?: string;
  sub?: string;
  time?: string;
  /** the dot's classes: you · bed · done · now · ahead (+ air) */
  dot?: string;
  /** the rail above and below the dot ('' when the line ends there) */
  up?: string;
  down?: string;
  /** the segment before is the one you are on: its calm arrowhead lands here */
  arrow?: boolean;
  you?: boolean;
  /* a segment */
  rail?: string;
  /** its facts are clocks and durations (the numbers face) */
  num?: boolean;
  air?: boolean;
  label?: string;
  facts?: string;
  verify?: boolean;
  missing?: boolean;
  /* both */
  chip?: Stamp;
  /** the booking a row opens (tonight's stay, a leg's pass) */
  booking?: Booking;
  /** a station's own warning, in warn amber ("NOT Capital") */
  warn?: string;
}

/* The segment's own row carries the motion (Flow, Ink); the half-lines that
   run into and out of a station's dot are drawn still, so one segment never
   shows two dash patterns out of step. */
const railCls = (s: Segment, ink: boolean, still = false): string =>
  `r ${s.state} ${s.kind}${s.state === 'now' && !still ? ' flow' : ''}${ink && s.state === 'done' ? ' ink' : ''}`;

/** "18:15 → 20:30 · 2h 15m" — a leg's own clocks and duration, and a time
    the step ties to where it goes, when asked for. */
export function legFacts(seg: Segment, to?: Station): string {
  const b = seg.booking;
  const dep = b && 'dep' in b ? b.dep : undefined;
  const arr = b && 'arr' in b ? b.arr : undefined;
  return [dep ? `${dep}${arr ? ` → ${arr}` : ''}` : '', seg.duration ?? '', to?.by ? S.day.by(to.by) : '']
    .filter(Boolean)
    .join(' · ');
}

/** "HSR Taizicheng → Qinghe" · "CA 8609 PKX → DYG" · "Qinghe → Beijing Daxing Intl" */
export function segTitle(seg: Segment, a: Station, b: Station): string {
  if (seg.kind !== 'leg') return `${a.name} → ${b.name}`;
  return seg.mode === 'air' ? `${seg.label} ${a.code ?? a.name} → ${b.code ?? b.name}` : `${seg.label} ${a.name} → ${b.name}`;
}

/** The rows of the line; `inked` is the segment just finished with Done. */
export function metroRows(line: MetroLine, inked = -1): MetroRow[] {
  const out: MetroRow[] = [];
  line.stations.forEach((st, i) => {
    const before = line.segments[i - 1];
    const after = line.segments[i];
    const you = i === line.you;
    const tonight = st.bed === 'tonight';
    out.push({
      kind: 'st',
      name: st.name,
      ...(st.native ? { native: st.native } : {}),
      sub:
        st.bed === 'last'
          ? before || after?.state === 'done'
            ? S.day.checkedOut
            : st.by
              ? S.day.checkOutBy(st.by)
              : S.day.checkOut
          : tonight
            ? S.day.tonightBed
            : st.by
              ? S.day.by(st.by)
              : '',
      time: st.time ?? (tonight ? st.by : undefined) ?? '',
      dot: you ? 'you' : st.bed ? 'bed' : `${after?.state ?? before?.state ?? 'ahead'}${after?.mode === 'air' ? ' air' : ''}`,
      up: before ? railCls(before, false, true) : '',
      down: after ? railCls(after, false, true) : '',
      arrow: before?.state === 'now',
      you,
      ...(tonight ? { chip: st.missing ? noBookingStamp() : st.booking ? chipOf(st.booking.status) : undefined } : {}),
      ...(tonight && st.booking ? { booking: st.booking } : {}),
      ...(st.warn ? { warn: st.warn } : {}),
    });
    if (!after) return;
    const leg = after.kind === 'leg';
    out.push({
      kind: 'seg',
      rail: railCls(after, inked === i),
      air: after.mode === 'air',
      label: leg ? after.label : '',
      facts: leg ? legFacts(after) : after.missing ? '' : [S.day.transfer, after.step !== null ? S.day.seeStep(after.step + 1) : ''].filter(Boolean).join(' · '),
      num: leg,
      verify: after.verify,
      missing: !!after.missing,
      ...(leg ? { chip: chipOf(after.status) } : {}),
      ...(after.booking ? { booking: after.booking } : {}),
    });
  });
  return out;
}

/* ---------- the Focus card ---------- */
export interface Focus {
  /** 1-based */
  n: number;
  of: number;
  chip?: Stamp;
  /** the step as a move (a leg or a crossing) … */
  title?: string;
  facts?: string;
  /** … or the step's own words */
  text?: string;
  /** the driver card to show for it */
  card?: string;
  /** where it goes carries a warning of its own ("NOT Capital") */
  warn?: string;
}
export function focusOf(line: MetroLine | null, steps: string[], current: number | null): Focus | null {
  if (current === null || current >= steps.length) return null;
  const f: Focus = { n: current + 1, of: steps.length };
  const i = segmentOfStep(line, current);
  if (!line || i < 0) return { ...f, text: steps[current] ?? '' };
  const seg = line.segments[i]!;
  const a = line.stations[i]!;
  const b = line.stations[i + 1]!;
  const card = seg.kind === 'transfer' ? b.card : a.card;
  return {
    ...f,
    ...(seg.kind === 'leg' ? { chip: chipOf(seg.status) } : {}),
    title: segTitle(seg, a, b),
    facts: [a.bed === 'last' && a.by ? S.day.checkOutBy(a.by) : '', legFacts(seg, b)].filter(Boolean).join(' · '),
    ...(card ? { card } : {}),
    ...(b.warn ? { warn: b.warn } : {}),
  };
}

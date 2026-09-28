/* REPLAY — the trip as a timeline you can play, step and drag (f-journey).

   The scrubber runs from the trip's first day to its last. Everything here is
   a pure function of the trip file and a day on that scrubber:

   · THE CLOCK. Play walks the days in order. A day a leg is walked holds for
     the Comet to fly that leg (COMET_MS — tokens.json duration-comet); any
     other day passes quickly. `replayClock` lays that out once and
     `playheadAt` reads it, so the knob, the map and the comet share one time.
   · THE BARS under the knob: one per stop (its nights, [start, end)), and a
     thin one for the days spent between stops — the flights in and home.
   · THE VISA WINDOW as a bar (counters.ts): from the counter's day 1 to its
     last legal day, lit up to the playhead and never past the planned exit,
     with the hard deadline as a tick.
   · WHERE the trip is on a date, in a few words ("Chongli → Zhangjiajie").

   Nothing is guessed: a day is a day of the trip file, a leg is walked on the
   day its destination begins, and a time of day is never invented — the
   playhead moves in days, and only the real today carries a clock. */
import type { Booking, ComplianceCounter, ISODate, Stop, Trip } from '../model/types';
import { addDays, compareIso, daysBetween, fmtShort } from './dates';
import { counterState } from './counters';
import { shortName } from './constellation';
import { realStops } from './day';
import { S } from '../i18n/strings';

/** One flight of the Comet — tokens.json `duration-comet`. */
export const COMET_MS = 1200;
/** A day with no leg, during Play. */
export const DAY_MS = 170;

/** Every date of the trip, first to last (a corrupt range stops at 400). */
export function tripDates(trip: Pick<Trip, 'start' | 'end'>): ISODate[] {
  const out: ISODate[] = [];
  for (let d = trip.start; compareIso(d, trip.end) <= 0 && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A date's place on the scrubber, clamped to the trip. */
export function dayIndex(trip: Pick<Trip, 'start' | 'end'>, date: ISODate): number {
  const n = Math.max(1, daysBetween(trip.start, trip.end) + 1);
  return Math.min(Math.max(daysBetween(trip.start, date), 0), n - 1);
}

/* ---------- the clock ---------- */

export interface ReplayClock {
  /** ms after Play at which each day begins */
  starts: number[];
  /** how long each day holds */
  durs: number[];
  total: number;
}

/** Lay the trip out in time: a leg day holds for one Comet, any other day
    for `dayMs`. */
export function replayClock(dates: ISODate[], legDays: Set<ISODate>, dayMs = DAY_MS, legMs = COMET_MS): ReplayClock {
  const starts: number[] = [];
  const durs: number[] = [];
  let at = 0;
  for (const d of dates) {
    const dur = legDays.has(d) ? legMs : dayMs;
    starts.push(at);
    durs.push(dur);
    at += dur;
  }
  return { starts, durs, total: at };
}

/** The playhead at `t` ms into Play: which day, and how far through it. */
export function playheadAt(clock: ReplayClock, t: number): { index: number; frac: number } {
  const n = clock.starts.length;
  if (!n) return { index: 0, frac: 0 };
  if (t <= 0) return { index: 0, frac: 0 };
  if (t >= clock.total) return { index: n - 1, frac: 1 };
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (clock.starts[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  const dur = clock.durs[lo] || 1;
  return { index: lo, frac: Math.min(1, (t - clock.starts[lo]!) / dur) };
}

/* ---------- Play, as a state machine (Run 3c) ----------
   The playhead is always one of four things, and every control moves it
   from one to another — so a control can never be overruled by the next
   animation frame ("Back to today" did nothing while Play ran: the frame
   after it put the playhead back), and the Play button can say what it
   will do.
   · home    — resting on today (the playhead is the screen's "now")
   · playing — Play walks the days, `t` ms into the replay's clock
   · paused  — Play stopped where it was; pressed again it resumes from `t`
   · parked  — moved by hand (‹ ›, the scrubber); Play starts from that day
   The last frame of a replay comes home. A frame never advances more than
   100 ms, so an app that was hidden does not jump. */
export type PlayMode = 'home' | 'playing' | 'paused' | 'parked';
export interface Playback {
  mode: PlayMode;
  /** ms into the replay's clock (playing, paused) */
  t: number;
  /** the playhead in days (day index + how far through it); null at home */
  pos: number | null;
}
export const PLAY_HOME: Playback = { mode: 'home', t: 0, pos: null };
export type PlayEvent =
  /** the Play / Pause button */
  | { kind: 'toggle' }
  /** one animation frame, `dt` ms after the last */
  | { kind: 'frame'; dt: number }
  /** ‹ ›, or the scrubber, to a day */
  | { kind: 'seek'; day: number }
  /** Back to today */
  | { kind: 'home' };

const posAt = (clock: ReplayClock, t: number): number => {
  const ph = playheadAt(clock, t);
  return ph.index + ph.frac;
};
/** The day Play would start from: a parked playhead's day — unless it is
    parked on the last day, where there is nothing left to play. */
const startDay = (s: Playback, n: number): number => {
  const d = s.mode === 'parked' && s.pos !== null ? Math.floor(s.pos) : 0;
  return d >= n - 1 ? 0 : d;
};

export function playback(s: Playback, e: PlayEvent, clock: ReplayClock): Playback {
  const n = clock.starts.length;
  switch (e.kind) {
    case 'toggle': {
      if (s.mode === 'playing') return { ...s, mode: 'paused' };
      if (s.mode === 'paused') return { ...s, mode: 'playing' };
      const t = clock.starts[startDay(s, n)] ?? 0;
      return { mode: 'playing', t, pos: posAt(clock, t) };
    }
    case 'frame': {
      if (s.mode !== 'playing') return s;
      const t = s.t + Math.min(Math.max(e.dt, 0), 100);
      return t >= clock.total ? PLAY_HOME : { mode: 'playing', t, pos: posAt(clock, t) };
    }
    case 'seek':
      return { mode: 'parked', t: 0, pos: Math.min(Math.max(n - 1, 0), Math.max(0, e.day)) + 0.5 };
    case 'home':
      return PLAY_HOME;
  }
}

/** What the Play button will do if pressed — its accessible name says so:
    pause; resume where it paused; or play from a day (day 0: the whole
    trip, from its first day). */
export function playAction(s: Playback, n: number): { act: 'pause' | 'resume' | 'play'; day: number } {
  if (s.mode === 'playing') return { act: 'pause', day: 0 };
  if (s.mode === 'paused') return { act: 'resume', day: Math.floor(s.pos ?? 0) };
  return { act: 'play', day: startDay(s, n) };
}

/* ---------- the bars ---------- */

export interface ScrubBar {
  /** first and last day index, inclusive */
  from: number;
  to: number;
  /** a stop's nights, or days spent moving between stops */
  kind: 'stop' | 'move';
  stopId?: string;
}

/** One bar per stop — the nights it covers, [start, end) — and a thin bar
    for every run of days no stop covers (the flights in, the flights home). */
export function scrubBars(trip: Pick<Trip, 'start' | 'end'>, stops: Stop[]): ScrubBar[] {
  const dates = tripDates(trip);
  const owner: (string | null)[] = dates.map(() => null);
  for (const s of stops) {
    if (s.kind !== 'stop') continue;
    for (let d = s.start, i = 0; compareIso(d, s.end) < 0 && i < 400; d = addDays(d, 1), i++) {
      const k = daysBetween(trip.start, d);
      if (k >= 0 && k < owner.length) owner[k] = s.id;
    }
  }
  const out: ScrubBar[] = [];
  for (let i = 0; i < owner.length; ) {
    let j = i;
    while (j + 1 < owner.length && owner[j + 1] === owner[i]) j++;
    const id = owner[i];
    out.push(id ? { from: i, to: j, kind: 'stop', stopId: id } : { from: i, to: j, kind: 'move' });
    i = j + 1;
  }
  return out;
}

/** Which days get a date under the scrubber: the first, the last, and every
    tenth between (every fifth on a short trip, every fifteenth or thirtieth
    on a long one) — never one crowding the last. Given the track's width
    in px, never one whose date would TOUCH the last's either: a date is
    ~40 px wide in the number face at its narrowest, centred on its day,
    and the last is set flush right (Run 3c: on a 384 px phone "21 Dec" ran
    into "27 Dec"; at 412 px they keep their 4 px). */
export function scrubMarks(n: number, trackPx = Infinity, labelPx = 40, gapPx = 3): number[] {
  if (n <= 1) return [0];
  const step = n > 90 ? 30 : n > 45 ? 15 : n > 20 ? 10 : n > 8 ? 5 : 1;
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  while (out.length > 1 && n - 1 - out[out.length - 1]! < step / 2) out.pop();
  while (out.length > 1 && ((out[out.length - 1]! + 0.5) / n) * trackPx + labelPx / 2 + gapPx > trackPx - labelPx) out.pop();
  out.push(n - 1);
  return out;
}

/* ---------- the visa window ---------- */

export interface VisaWindow {
  name: string;
  /** day indexes: the counter's day 1 and its last legal day — the hard
      deadline when that is earlier (either may run off an end of the trip) */
  from: number;
  to: number;
  /** the planned exit day — the lit bar stops at its end */
  planned: number | null;
  /** there is a hard deadline — drawn as a tick at the end of the window */
  deadline: boolean;
  /** "19 / 30", "starts 23 Nov", "29 / 30 · left 21 Dec" */
  value: string;
  /** "Exit by 22 Dec" */
  exit: string;
  tone: '' | 'warn' | 'crit';
}

/** The counter as a bar on the scrubber, on `date` (counters.ts decides the
    day; this only places it). */
export function visaWindow(
  c: ComplianceCounter | undefined,
  trip: Pick<Trip, 'start' | 'end'>,
  date: ISODate,
): VisaWindow | null {
  if (!c || !(c.limitDays > 0)) return null;
  const day1 = c.countStartsDayAfter ? addDays(c.startDate, 1) : c.startDate;
  const last = addDays(day1, c.limitDays - 1);
  const at = (d: ISODate): number => daysBetween(trip.start, d);
  const st = counterState(c, date);
  let value: string;
  let tone: VisaWindow['tone'] = '';
  switch (st.phase) {
    case 'before':
    case 'entryDay':
      value = S.journey.visaStarts(fmtShort(day1));
      break;
    case 'complete': {
      const end = c.plannedEndDate ? counterState(c, c.plannedEndDate).day : st.day;
      value = S.journey.visaLeft(end, c.limitDays, c.plannedEndDate ? fmtShort(c.plannedEndDate) : '');
      break;
    }
    case 'overLimit':
      value = S.journey.visaOver(st.day, c.limitDays);
      tone = 'crit';
      break;
    case 'counting':
      value = `${st.day} / ${c.limitDays}`;
      tone = st.remaining <= 2 ? 'crit' : st.remaining <= 5 ? 'warn' : '';
      break;
  }
  return {
    name: c.name,
    from: at(day1),
    to: at(c.hardDeadline && compareIso(c.hardDeadline, last) < 0 ? c.hardDeadline : last),
    planned: c.plannedEndDate ? at(c.plannedEndDate) : null,
    deadline: !!c.hardDeadline,
    value,
    exit: c.hardDeadline ? S.journey.visaExit(fmtShort(c.hardDeadline)) : S.journey.visaLast(fmtShort(last)),
    tone,
  };
}

/* ---------- where ---------- */

/** Where the trip is on `date`, in a few words: the move of a travel day
    ("Chongli → Zhangjiajie"), the stop you are in, or the way in and home. */
export function whereOn(stops: Stop[], bookings: Booking[], date: ISODate): string {
  const real = realStops(stops);
  const first = real[0];
  const last = real[real.length - 1];
  if (!first || !last) return '';
  const name = (s: Stop): string => shortName(s.name);
  if (compareIso(date, first.start) < 0 || compareIso(date, last.end) >= 0) {
    const inbound = compareIso(date, first.start) < 0;
    /* flights, when a flight is what brings you in (or takes you home) */
    const air = bookings.some(
      (b) => b.kind === 'flight' && b.status !== 'cancelled' && (inbound ? compareIso(b.date, first.start) < 0 : compareIso(b.date, last.end) >= 0),
    );
    return inbound ? (air ? S.journey.flightsIn : S.journey.wayIn) : air ? S.journey.flightsHome : S.journey.wayHome;
  }
  const arriving = real.find((s) => s.start === date);
  const leaving = real.find((s) => s.end === date);
  if (arriving && leaving && arriving !== leaving) return `${name(leaving)} → ${name(arriving)}`;
  const here = real.find((s) => compareIso(date, s.start) >= 0 && compareIso(date, s.end) < 0);
  if (here) return name(here);
  const next = real.find((s) => compareIso(s.start, date) > 0);
  const prev = [...real].reverse().find((s) => compareIso(s.end, date) <= 0);
  return prev && next ? `${name(prev)} → ${name(next)}` : '';
}

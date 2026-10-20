/* THE REMINDER PLAN (Reminders, Parts 1–3). Pure: the trip in, the list of
   notifications Android should hold out. The scheduler (platform/reminders.ts)
   hands this list to the phone; nothing here touches the phone, the clock or
   the database, so every rule is a test.

   WHAT RINGS, all from data the trip already carries:
   - a timed moment (Alarm) at its time, plus a heads-up before it;
   - a leg: "leave for the airport/station" before it, and "online check-in
     opens" 24 h before a flight;
   - a to-do with a due date: 09:00 the day before and on the day;
   - a ticket still to buy, at the book-by the traveller set (+ heads-up);
   - a visa-free counter as its limit gets close, and on the exit day;
   - the backup, three days after changes nobody saved;
   - on a travel day, a quiet card with the day's legs that becomes
     "You've landed" at the last arrival (same id, so one replaces the other);
   - the morning brief (off by default) and the evening prep.

   EVERY TIME IS READ WHERE THE TRAVELLER WILL BE (logic/tripzone.ts). A
   moment whose zone cannot be proven falls back to the phone's own clock and
   is re-planned at the next open.

   Ids are stable: the same thing on the same day always gets the same id, so
   re-planning after an edit replaces a notification instead of adding one. */
import type {
  Alarm,
  Booking,
  ComplianceCounter,
  DayDefault,
  DayPlan,
  HHMM,
  HotelBooking,
  ISODate,
  ReminderPrefs,
  Stop,
  Task,
  Trip,
} from '../model/types';
import { R } from '../i18n/reminders';
import { S } from '../i18n/strings';
import { bookByOf } from './reserveby';
import { addDays, compareIso, fmtDow, fmtShort } from './dates';
import { counterState } from './counters';
import { currentStop, resolveDay } from './day';
import { plainWords } from './mdlite';
import { legLabel } from './metroline';
import { dayIn, isSnowCode, weatherChip, type WeatherCache } from './weather';
import { hhmmToMinutes, minutesToHhmm } from './zones';
import { deviceOffsetAt, instantAt, legShift, offsetFor, type OffsetAt, type ZonePlan } from './tripzone';

export type Channel = 'moments' | 'travel' | 'card' | 'briefs' | 'backup';
export type ActionKind = 'item' | 'leg' | 'backup' | 'landed';

export interface Planned {
  id: number;
  /** Absolute instant, ms since the epoch. */
  at: number;
  channel: Channel;
  title: string;
  body: string;
  /** Where a tap lands. */
  route: string;
  action?: ActionKind;
  ongoing?: boolean;
  /** A travel-day card's landing: past it, the card is cleared. */
  until?: number;
  /** What a Done / Snooze / live-status button acts on. */
  ref?: { kind: 'alarm' | 'task' | 'booking'; id: string };
  /** The wall-clock moment it was planned from, for tests and the next-up line. */
  wall: { date: ISODate; time: HHMM };
}

export interface Snooze {
  id: number;
  at: number;
  title: string;
  body: string;
  route: string;
  ref?: Planned['ref'];
}

export interface PlanInput {
  trip: Trip;
  bookings: Booking[];
  alarms: Alarm[];
  tasks: Task[];
  counters: ComplianceCounter[];
  stops: Stop[];
  dayPlans: DayPlan[];
  dayDefaults: DayDefault[];
  prefs: ReminderPrefs | undefined;
  lastBackupAt: number | null;
  lastMutationAt: number;
  /** Cached forecasts by stop id. */
  weather: Record<string, WeatherCache | null | undefined>;
  zone: ZonePlan;
  now: number;
}

/** Soonest first; far below Android's 500-alarm ceiling, and topped up at
    every open. */
export const MAX_PLANNED = 150;
const MIN = 60_000;
const HOUR = 60 * MIN;

export interface Prefs {
  on: boolean;
  alarms: boolean;
  legs: boolean;
  tasks: boolean;
  visa: boolean;
  backup: boolean;
  travelCard: boolean;
  morning: boolean;
  evening: boolean;
  lead: number;
  quiet: boolean;
  quietFrom: HHMM;
  quietTo: HHMM;
}

/** Every preference with its default filled in. Off until turned on; the
    six basics and the evening prep on; the morning brief off. */
export function reminderPrefs(p: ReminderPrefs | undefined): Prefs {
  return {
    on: p?.on === true,
    alarms: p?.alarms !== false,
    legs: p?.legs !== false,
    tasks: p?.tasks !== false,
    visa: p?.visa !== false,
    backup: p?.backup !== false,
    travelCard: p?.travelCard !== false,
    morning: p?.morning === true,
    evening: p?.evening !== false,
    lead: typeof p?.lead === 'number' && p.lead >= 0 ? p.lead : 30,
    quiet: p?.quiet !== false,
    quietFrom: p?.quietFrom ?? '22:00',
    quietTo: p?.quietTo ?? '07:00',
  };
}

/** FNV-1a, folded into a positive 31-bit int: Android's notification id. */
export function stableId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

/** A booking reference on a lock screen: all but the last three masked. */
export function maskRef(code: string | undefined): string | null {
  const c = code?.trim();
  if (!c) return null;
  if (c.length <= 3) return c;
  return `••••${c.slice(-3)}`;
}

/* Hong Kong, Macau and Taiwan keep China's clock but have their own border:
   a flight to them is international even though no zone changes. */
const OWN_BORDER = new Set(['HKG', 'MFM', 'TPE', 'TSA', 'KHH', 'RMQ']);

/** How long before departure to leave: 3 h for an international flight, 2 h
    domestic, 1 h for a train or anything on the road. */
export function leaveLead(b: Booking): number {
  if (b.kind === 'flight') {
    const intl = legShift(b) !== 0 || OWN_BORDER.has(b.from.code) || OWN_BORDER.has(b.to.code);
    return intl ? 3 * HOUR : 2 * HOUR;
  }
  return HOUR;
}

function inQuiet(time: HHMM, p: Prefs): boolean {
  if (!p.quiet) return false;
  const t = hhmmToMinutes(time);
  const a = hhmmToMinutes(p.quietFrom);
  const b = hhmmToMinutes(p.quietTo);
  if (t === null || a === null || b === null || a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Move a wall-clock moment out of quiet hours, to the morning. */
function unquiet(date: ISODate, time: HHMM, p: Prefs): { date: ISODate; time: HHMM } {
  if (!inQuiet(time, p)) return { date, time };
  const t = hhmmToMinutes(time)!;
  const a = hhmmToMinutes(p.quietFrom)!;
  /* Late evening rolls to tomorrow's morning; the small hours to this one. */
  const next = a > hhmmToMinutes(p.quietTo)! && t >= a ? addDays(date, 1) : date;
  return { date: next, time: p.quietTo };
}

/** The instant for a wall-clock moment, falling back to the phone's own clock
    when the trip cannot prove the zone. */
function at(zone: ZonePlan, date: ISODate, time: HHMM, offsetAt: OffsetAt = deviceOffsetAt): number {
  const off = offsetFor(zone, date, time);
  if (off !== null) return instantAt(date, time, off);
  let o = offsetAt(instantAt(date, time, 0));
  o = offsetAt(instantAt(date, time, o));
  return instantAt(date, time, o);
}

/** The wall-clock moment `ms` earlier, in the same zone as (date, time). */
function earlier(date: ISODate, time: HHMM, ms: number): { date: ISODate; time: HHMM } {
  const t = hhmmToMinutes(time) ?? 0;
  let m = t - Math.round(ms / MIN);
  let d = date;
  while (m < 0) {
    m += 1440;
    d = addDays(d, -1);
  }
  return { date: d, time: minutesToHhmm(m) };
}

/** What a lock screen should not spell out: booking codes (letters and
    digits, 6+), long numbers (6+ digits, spaced or not) and phone numbers.
    Amounts ("US$940", "¥4,200") and times stay. */
export function masked(s: string): string {
  return s
    .replace(/\+\d[\d\s-]{6,}\d/g, '+••••')
    .replace(/\b\d(?:[\d ]{4,}\d)\b/g, (m) => (m.replace(/\D/g, '').length >= 6 ? `••••${m.replace(/\D/g, '').slice(-3)}` : m))
    .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g, (m) => `••••${m.slice(-3)}`);
}

const trunc = (s: string, n = 180): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const words = (s: string | undefined): string => (s ? plainWords(s) : '');

function isLiveLeg(b: Booking): boolean {
  return (b.kind === 'flight' || b.kind === 'train' || b.kind === 'other') && b.status !== 'cancelled' && !b.alternative;
}
const depOf = (b: Booking): HHMM | null =>
  'dep' in b && typeof b.dep === 'string' && hhmmToMinutes(b.dep) !== null ? b.dep : null;
const arrOf = (b: Booking): HHMM | null =>
  'arr' in b && typeof b.arr === 'string' && hhmmToMinutes(b.arr) !== null ? b.arr : null;

function endName(b: Booking, end: 'from' | 'to'): string {
  if (b.kind === 'flight') return b[end].code;
  const e = (b as { from?: { name: string }; to?: { name: string } })[end];
  return e?.name ?? '';
}

/** The day a leg lands, in the arrival's own calendar. */
function arrivalDate(b: Booking): ISODate {
  if (b.kind === 'flight') return addDays(b.date, b.arrDayOffset);
  const dep = depOf(b);
  const arr = arrOf(b);
  return dep && arr && arr < dep ? addDays(b.date, 1) : b.date;
}

export function planNotifications(input: PlanInput): Planned[] {
  const p = reminderPrefs(input.prefs);
  if (!p.on) return [];
  const { trip, zone, now } = input;
  const out: Planned[] = [];
  const tripRoute = (tail: string): string => `#/trip/${trip.id}/${tail}`;
  const push = (x: Omit<Planned, 'at'> & { at?: number }): void => {
    const when = x.at ?? at(zone, x.wall.date, x.wall.time);
    if (when > now) out.push({ ...x, at: when });
  };

  /* ---------- timed moments ---------- */
  if (p.alarms) {
    for (const a of input.alarms) {
      if (a.done || !a.date || hhmmToMinutes(a.time) === null) continue;
      const title = masked(words(a.title));
      const route = a.ref?.kind === 'booking' ? tripRoute(`pocket/${a.ref.id}`) : a.ref?.kind === 'place' ? tripRoute(`map/${a.ref.id}`) : tripRoute('now/todo');
      const ref = { kind: 'alarm' as const, id: a.id };
      push({
        id: stableId(`alarm:${a.id}`),
        channel: 'moments',
        title: R.alarm(title),
        body: trunc(masked(words(a.why))),
        route,
        action: 'item',
        ref,
        wall: { date: a.date, time: a.time },
      });
      if (p.lead > 0) {
        const w = earlier(a.date, a.time, p.lead * MIN);
        push({
          id: stableId(`alarm-soon:${a.id}`),
          channel: 'moments',
          title: R.alarmSoon(p.lead, title),
          body: trunc(masked(words(a.why))),
          route,
          action: 'item',
          ref,
          wall: w,
          at: at(zone, a.date, a.time) - p.lead * MIN,
        });
      }
    }
  }

  /* ---------- journeys: legs chained by their connections ---------- */
  /* A leg that leaves the airport the previous flight landed at, within 8 h,
     is a CONNECTION, not a fresh departure: nobody "leaves for the airport"
     from inside it. EY608 → EY888 in Abu Dhabi, EY871 → EY609 on the way
     home, and EY888 → CA8641 at Daxing are each one journey. */
  const legs = input.bookings
    .filter(isLiveLeg)
    .filter((b) => depOf(b) !== null)
    .sort((a, b) => at(zone, a.date, depOf(a)!) - at(zone, b.date, depOf(b)!));
  const depAtOf = (b: Booking): number => at(zone, b.date, depOf(b)!);
  const arrAtOf = (b: Booking): number | null => (arrOf(b) ? at(zone, arrivalDate(b), arrOf(b)!) : null);
  const journeys: Booking[][] = [];
  for (const b of legs) {
    const cur = journeys[journeys.length - 1];
    const prev = cur?.[cur.length - 1];
    const prevArr = prev ? arrAtOf(prev) : null;
    const sameGround = !!prev && prev.kind === 'flight' && b.kind === 'flight' && prev.to.code === b.from.code;
    const gap = prevArr === null ? null : depAtOf(b) - prevArr;
    if (cur && sameGround && gap !== null && gap >= 0 && gap <= 8 * HOUR) cur.push(b);
    else journeys.push([b]);
  }

  if (p.legs) {
    for (const journey of journeys) {
      journey.forEach((b, i) => {
        const dep = depOf(b)!;
        const label = legLabel(b) || words(b.title);
        const depAt = depAtOf(b);
        const route = tripRoute(`pocket/${b.id}`);
        const ref = { kind: 'booking' as const, id: b.id };
        if (i === 0) {
          const lead = leaveLead(b);
          push({
            id: stableId(`leave:${b.id}`),
            channel: 'travel',
            title: b.kind === 'flight' ? R.leaveAirport(label, dep) : b.kind === 'train' ? R.leaveStation(label, dep) : R.leaveOther(label, dep),
            body: R.legBody(endName(b, 'from'), endName(b, 'to'), arrOf(b), maskRef(b.code)),
            route,
            action: b.kind === 'flight' ? 'leg' : undefined,
            ref,
            wall: earlier(b.date, dep, lead),
            at: depAt - lead,
          });
        }
        if (b.kind === 'flight') {
          push({
            id: stableId(`checkin:${b.id}`),
            channel: 'travel',
            title: R.checkIn(label),
            body: R.checkInBody(dep, b.from.code, b.to.code),
            route,
            action: 'leg',
            ref,
            wall: earlier(b.date, dep, 24 * HOUR),
            at: depAt - 24 * HOUR,
          });
        }
      });
    }
  }

  /* ---------- to-dos ---------- */
  if (p.tasks) {
    for (const t of input.tasks) {
      if (t.done || !t.due) continue;
      const title = trunc(masked(words(t.title)), 90);
      const common = { channel: 'moments' as const, route: tripRoute('now/todo'), action: 'item' as const, ref: { kind: 'task' as const, id: t.id } };
      const body = trunc(masked(words(t.detail)));
      const before = unquiet(addDays(t.due, -1), '09:00', p);
      push({ ...common, id: stableId(`task-1:${t.id}`), title: R.dueTomorrow(title), body, wall: before });
      push({ ...common, id: stableId(`task-0:${t.id}`), title: R.dueToday(title), body, wall: unquiet(t.due, '09:00', p) });
    }
  }

  /* ---------- tickets: the book-by the traveller set (logic/reserveby.ts) ----------
     At the moment itself, as an alarm rings (quiet hours do not move a time
     the traveller chose), with the heads-up before it; with no time, 09:00
     like a to-do. Only while the ticket is pending: booked, cancelled or the
     book-by cleared, the next re-plan has nothing under these ids. */
  if (p.tasks) {
    for (const b of input.bookings) {
      const by = bookByOf(b);
      if (!by) continue;
      const title = trunc(masked(words(b.title)), 90);
      const common = { channel: 'moments' as const, route: tripRoute(`pocket/${b.id}`), ref: { kind: 'booking' as const, id: b.id } };
      const body = S.bookBy.notifyBody(fmtDow(b.date));
      if (!by.time) {
        push({ ...common, id: stableId(`bookby:${b.id}`), title: S.bookBy.notify(title), body, wall: unquiet(by.date, '09:00', p) });
        continue;
      }
      const when = at(zone, by.date, by.time);
      push({ ...common, id: stableId(`bookby:${b.id}`), title: S.bookBy.notify(title), body, wall: { date: by.date, time: by.time }, at: when });
      if (p.lead > 0) {
        push({
          ...common,
          id: stableId(`bookby-soon:${b.id}`),
          title: S.bookBy.notifySoon(p.lead, title),
          body,
          wall: earlier(by.date, by.time, p.lead * MIN),
          at: when - p.lead * MIN,
        });
      }
    }
  }

  /* ---------- visa-free days ---------- */
  if (p.visa) {
    for (const c of input.counters) {
      const exit = c.plannedEndDate ? fmtShort(c.plannedEndDate) : null;
      const deadline = c.hardDeadline ? fmtShort(c.hardDeadline) : null;
      const body = R.visaBody(exit, deadline);
      const route = tripRoute('pocket/visa');
      for (const n of [c.limitDays - 5, c.limitDays - 2, c.limitDays - 1]) {
        if (n < 1) continue;
        const date = addDays(c.startDate, c.countStartsDayAfter ? n : n - 1);
        const st = counterState(c, date);
        if (st.phase !== 'counting' || st.day !== n) continue;
        push({ id: stableId(`visa:${c.id}:${n}`), channel: 'moments', title: R.visaDay(c.name, n, c.limitDays), body, route, wall: unquiet(date, '09:00', p) });
      }
      if (c.plannedEndDate) {
        push({ id: stableId(`visa-exit:${c.id}`), channel: 'moments', title: R.visaExit(c.name), body, route, wall: unquiet(c.plannedEndDate, '08:00', p) });
      }
    }
  }

  /* ---------- backup ---------- */
  if (p.backup && input.lastMutationAt > (input.lastBackupAt ?? 0)) {
    /* Three days after the LAST BACKUP (never: now), at 20:00 on the phone's
       own clock. Counting from the newest change would push it back with
       every tick, and a trip ticks every day. */
    const due = Math.max((input.lastBackupAt ?? 0) + 3 * 24 * HOUR, now);
    const d = new Date(due);
    d.setHours(20, 0, 0, 0);
    const when = d.getTime() >= due ? d.getTime() : d.getTime() + 24 * HOUR;
    push({ id: stableId('backup'), channel: 'backup', title: R.backup, body: R.backupBody, route: '#/backup', action: 'backup', wall: { date: '', time: '20:00' }, at: when });
  }

  /* ---------- journeys: the travel-day card, then "You've landed" ---------- */
  /* Two notifications with two ids: Android keys a scheduled alarm by id, so
     one id for both would let the landing replace the card before it ever
     showed. The card carries `until` (the landing), and the scheduler clears
     a card still on screen once that has passed. It is not pinned: a card
     nobody can swipe away would outstay a phone left unopened. */
  const travelDays = new Map<ISODate, Booking[]>();
  for (const journey of journeys) {
    const first = journey[0]!;
    travelDays.set(first.date, [...(travelDays.get(first.date) ?? []), ...journey]);
  }
  if (p.travelCard) {
    for (const journey of journeys) {
      const first = journey[0]!;
      const last = journey[journey.length - 1]!;
      const lastArr = arrOf(last);
      const landAt = arrAtOf(last);
      const facts = (b: Booking): string =>
        `${legLabel(b) || words(b.title)} · ${endName(b, 'from')} ${depOf(b)} → ${endName(b, 'to')}${arrOf(b) ? ` ${arrOf(b)}` : ''}`;
      const ref = maskRef(first.code);
      push({
        id: stableId(`card:${first.id}`),
        channel: 'card',
        title: R.travelCard(facts(first)),
        body: [ref ? `ref ${ref}` : null, journey.length > 1 ? R.travelCardMore(journey.length - 1) : null].filter(Boolean).join(' · '),
        route: tripRoute(`pocket/${first.id}`),
        action: first.kind === 'flight' ? 'leg' : undefined,
        ref: { kind: 'booking', id: first.id },
        until: landAt ?? undefined,
        wall: earlier(first.date, depOf(first)!, 4 * HOUR),
        at: depAtOf(first) - 4 * HOUR,
      });
      if (lastArr && landAt !== null) {
        const landDate = arrivalDate(last);
        const home = compareIso(landDate, trip.end) >= 0;
        const stop = home ? null : currentStop(input.stops, landDate);
        const bed = home ? null : bedFor(input.bookings, landDate);
        push({
          id: stableId(`landed:${last.id}`),
          channel: 'travel',
          title: home ? R.landedHome : R.landed(stop?.name ?? endName(last, 'to')),
          body: home ? R.landedHomeBody : bed ? R.landedBed(bedLine(bed)) : R.landedNoBed,
          route: bed ? tripRoute(`pocket/${bed.id}`) : tripRoute('now'),
          action: home ? undefined : 'landed',
          ref: bed ? { kind: 'booking', id: bed.id } : undefined,
          wall: { date: landDate, time: lastArr },
          at: landAt + 10 * MIN,
        });
      }
    }
  }

  /* ---------- the morning brief and the evening prep ---------- */
  if (p.morning || p.evening) {
    for (let d = trip.start; compareIso(d, trip.end) <= 0; d = addDays(d, 1)) {
      const stop = currentStop(input.stops, d) ?? input.stops.find((s) => s.start === d) ?? null;
      const cache = stop ? input.weather[stop.id] : null;
      const wx = dayIn(cache, d);
      const legsToday = travelDays.get(d) ?? [];
      const alarmsToday = input.alarms.filter((a) => !a.done && a.date === d).sort((a, b) => (a.time < b.time ? -1 : 1));
      const firstTimed = earliest(
        alarmsToday.map((a) => ({ time: a.time, what: words(a.title) })),
        legsToday.map((b) => ({ time: depOf(b)!, what: legLabel(b) || words(b.title) })),
      );
      if (p.morning) {
        const day = resolveDay(d, input.dayPlans, input.dayDefaults, input.stops);
        if (day || legsToday.length) {
          const age = cache && wx && now - cache.fetchedAt > 36 * HOUR ? R.morningAge(fmtDow(dateOfMs(cache.fetchedAt))) : null;
          const bits = [
            day ? words(day.title) : null,
            firstTimed ? R.morningFirst(firstTimed.time, firstTimed.what) : null,
            day?.bedLabel ? R.morningBed(words(day.bedLabel)) : null,
            age,
          ].filter(Boolean) as string[];
          push({
            id: stableId(`morning:${trip.id}:${d}`),
            channel: 'briefs',
            title: R.morning(stop?.name ?? trip.title, wx ? weatherChip(wx) : null),
            body: trunc(bits.join(' · '), 220),
            route: tripRoute('now'),
            wall: unquiet(d, '08:00', p),
          });
        }
      }
      if (p.evening) {
        const early = firstTimed && firstTimed.time < '09:00' ? firstTimed : null;
        if (legsToday.length || early) {
          const hint = wx ? (isSnowCode(wx.code) ? R.snowLikely : wx.pp >= 60 ? R.rainLikely : null) : null;
          const bits = [
            firstTimed ? R.morningFirst(firstTimed.time, firstTimed.what) : null,
            hint,
            legsToday.some((b) => b.kind === 'flight') ? R.eveningPassport : null,
          ].filter(Boolean) as string[];
          push({
            id: stableId(`evening:${trip.id}:${d}`),
            channel: 'briefs',
            title: early ? R.evening(early.time) : R.eveningTravel,
            body: trunc(bits.join(' · '), 220),
            route: tripRoute('now'),
            wall: unquiet(addDays(d, -1), '20:00', p),
          });
        }
      }
    }
  }

  /* Soonest first. Snoozes and the test are not here: the scheduler sets
     them once and never cancels them (platform/reminders.ts). */
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, MAX_PLANNED);
}

function earliest(...lists: { time: HHMM; what: string }[][]): { time: HHMM; what: string } | null {
  let best: { time: HHMM; what: string } | null = null;
  for (const l of lists) for (const x of l) if (hhmmToMinutes(x.time) !== null && (!best || x.time < best.time)) best = x;
  return best;
}

/** The bed for the night of `date`: a hotel whose stay covers it. */
function bedFor(bookings: Booking[], date: ISODate): HotelBooking | null {
  for (const b of bookings) {
    if (b.kind !== 'hotel' || b.status === 'cancelled' || b.alternative) continue;
    if (compareIso(date, b.checkIn) >= 0 && compareIso(date, b.checkOut) < 0) return b;
  }
  return null;
}

function bedLine(b: HotelBooking): string {
  return words(b.title);
}

function dateOfMs(ms: number): ISODate {
  const d = new Date(ms);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** The next thing that will ring — for Settings' "Next:" line. */
export function nextUp(plan: Planned[], now: number): Planned | null {
  return plan.find((x) => x.at > now && !x.ongoing) ?? null;
}



export { isSampleTrip, reminderTrip } from './tripchoice';

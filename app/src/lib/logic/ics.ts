/* Calendar export. The phone's calendar can ring while the app is closed, so
   timed moments (and, since the Reminders run, the flights) leave as .ics.

   EXACT TIMES, NOT FLOATING ONES (Reminders, Part 5). A floating "19:45" is
   read by the calendar in whatever zone the phone is in when it imports the
   file: exported in Tel Aviv in October, the Jade Dragon release rang at
   19:45 Israel time, 01:45 in Lijiang. Given the trip's zone plan
   (logic/tripzone.ts), every time is written as the exact UTC instant (…Z),
   so a calendar rings at the right local hour wherever the file was
   imported. A moment whose zone the trip cannot prove stays floating, which
   is what it always was. Without a zone plan the old floating form is kept. */
import type { Alarm, FlightBooking, Trip } from '../model/types';
import { mdliteToText } from './mdlite';
import { addDays } from './dates';
import { instantFor, type ZonePlan } from './tripzone';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function stamp(date: string, time: string): string {
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}

function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 caps lines at 75 octets; long SUMMARY lines must be folded. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    out.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) out.push(' ' + rest);
  return out.join('\r\n');
}

function plusOneHour(time: string): string {
  const h = Math.min(23, parseInt(time.slice(0, 2), 10) + 1);
  return String(h).padStart(2, '0') + ':' + time.slice(3, 5);
}

export interface IcsOptions {
  /** The trip's zone plan: with it, times are exact instants. */
  zone?: ZonePlan;
  /** Flights to add as events, each with a "leave now" alarm. */
  flights?: FlightBooking[];
  /** How long before a flight its alarm rings, per flight (ms). */
  leaveLead?: (f: FlightBooking) => number;
}

export function buildIcs(alarms: Alarm[], trip: Pick<Trip, 'id' | 'title'>, nowIso: string, opts: IcsOptions = {}): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Living the dream//Trip//EN', 'CALSCALE:GREGORIAN'];
  const dtstamp = nowIso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const when = (date: string, time: string): { start: string; end: (mins: number) => string } => {
    const at = opts.zone ? instantFor(opts.zone, date, time) : null;
    if (at !== null) return { start: `DTSTART:${utcStamp(at)}`, end: (m) => `DTEND:${utcStamp(at + m * 60_000)}` };
    return { start: `DTSTART:${stamp(date, time)}`, end: () => `DTEND:${stamp(date, plusOneHour(time))}` };
  };
  alarms.forEach((a, i) => {
    const title = mdliteToText(a.title);
    const w = when(a.date, a.time);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:livingthedream-${trip.id}-${a.date.replace(/-/g, '')}-${i}@trip.local`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(w.start);
    lines.push(w.end(60));
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (a.why) lines.push(fold(`DESCRIPTION:${esc(mdliteToText(a.why))}`));
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(title)}`), 'END:VALARM');
    lines.push('END:VEVENT');
  });
  for (const f of opts.flights ?? []) {
    const title = `${f.flightNo} ${f.from.code}→${f.to.code}`;
    const dep = opts.zone ? instantFor(opts.zone, f.date, f.dep) : null;
    const arr = opts.zone ? instantFor(opts.zone, addDays(f.date, f.arrDayOffset), f.arr) : null;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:livingthedream-${trip.id}-flight-${f.id}@trip.local`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (dep !== null && arr !== null && arr > dep) {
      lines.push(`DTSTART:${utcStamp(dep)}`, `DTEND:${utcStamp(arr)}`);
    } else {
      const w = when(f.date, f.dep);
      lines.push(w.start, w.end(60));
    }
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (f.code) lines.push(fold(`DESCRIPTION:${esc(`${f.codeLabel ?? 'Booking'} ${f.code}`)}`));
    const lead = Math.round((opts.leaveLead?.(f) ?? 3 * 3600_000) / 60_000);
    lines.push('BEGIN:VALARM', `TRIGGER:-PT${lead}M`, 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(title)}`), 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

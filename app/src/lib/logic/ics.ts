/* Calendar export. An installed web app cannot ring while closed — the phone's
   calendar can, so timed moments leave as .ics with a 30-minute alarm.
   Times are floating-local: an 06:30 pickup is 06:30 wherever you are. */
import type { Alarm, Trip } from '../model/types';
import { mdliteToText } from './mdlite';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function stamp(date: string, time: string): string {
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
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

export function buildIcs(alarms: Alarm[], trip: Pick<Trip, 'id' | 'title'>, nowIso: string): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Living the dream//Trip//EN', 'CALSCALE:GREGORIAN'];
  const dtstamp = nowIso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  alarms.forEach((a, i) => {
    const title = mdliteToText(a.title);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:livingthedream-${trip.id}-${a.date.replace(/-/g, '')}-${i}@trip.local`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${stamp(a.date, a.time)}`);
    lines.push(`DTEND:${stamp(a.date, plusOneHour(a.time))}`);
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (a.why) lines.push(fold(`DESCRIPTION:${esc(mdliteToText(a.why))}`));
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(title)}`), 'END:VALARM');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

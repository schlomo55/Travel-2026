/* THE DAYS OF A STOP (lib/components/journey/StopDays.svelte, the Days view of
   its page): one row per planned day — `days` is guide.ts `daysHere`, so the
   list and the guide's "Day by day" can never differ — with its bed and what
   is still to do that day, in the same chips (and the same words) as the
   stop's status line (stopview.ts).

   Pure: records in, rows out. */
import type { DayPlan, ISODate } from '../model/types';
import type { SegmentCoverage } from './coverage';
import type { BookedHere } from './guide';
import { compareIso, fmtDow } from './dates';
import { mdliteToText } from './mdlite';
import { legChips, type StatusChip } from './stopview';
import { S } from '../i18n/strings';

const W = S.city.status;

export interface DayRow {
  date: ISODate;
  /** "Fri" */
  dow: string;
  /** "11 Dec" */
  day: string;
  title: string;
  /** the night's bed: the day's own words, else the stay that covers the night */
  bed: string | null;
  today: boolean;
  /** what is still to do that day: a ticket to buy, a bed, a move */
  chips: StatusChip[];
}

/** `now` is the day the app is showing (a preview's included). */
export function stopDays(days: DayPlan[], held: BookedHere, seg: SegmentCoverage | null, now: ISODate): DayRow[] {
  return days.map((d) => {
    const night = seg?.nights.find((n) => n.date === d.date);
    const stay = night?.booking?.kind === 'hotel' ? night.booking.title : '';
    const buy = held.tickets.filter((t) => t.date === d.date && t.status === 'pending').length;
    const chips: StatusChip[] = [];
    if (buy) chips.push({ text: W.dayTicket(buy), tone: 'warn' });
    if (night?.state === 'missing') chips.push({ text: W.dayNoBed, tone: compareIso(d.date, now) >= 0 ? 'crit' : 'warn' });
    if (night?.state === 'pending') chips.push({ text: W.dayBed, tone: 'warn' });
    chips.push(...legChips((seg?.legs ?? []).filter((l) => l.connector.date === d.date)));
    const [dow = '', ...rest] = fmtDow(d.date).split(' ');
    return {
      date: d.date,
      dow,
      day: rest.join(' '),
      title: mdliteToText(d.title),
      bed: mdliteToText(d.bedLabel || stay) || null,
      today: d.date === now,
      chips,
    };
  });
}

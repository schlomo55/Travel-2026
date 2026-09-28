/* THE CONCIERGE — the ONE plain-English sentence on Now that says what to do
   next (f-now: "Next: the train to Qinghe — not booked yet. Be in Qinghe by
   about 14:30.").

   It is composed from facts the app already holds and never from anywhere
   else: the runbook's current step and the line it joins (metroline.ts), the
   next commitment (commitment.ts), tonight's bed, the to-do list. Every name,
   time and status in it is the trip file's own; the only words this file
   adds are the joining words of a sentence. When nothing is worth saying the
   sentence says what the day is — it never invents urgency.

   The order is the order of what matters now:
     1. a travel day: the step you are on — the leg, the crossing, or the
        step's own first clause (with no runbook: the segment you are on);
     2. tonight's bed, when nobody has booked it;
     3. a to-do due today;
     4. the next move, when it is tomorrow;
     5. the day itself, and where you sleep.
   Before the trip it counts down; after it, it says the trip is complete.

   Pure: values in, words out. The sentence comes back in PARTS so the screen
   can set a status in its colour and a time in the numbers face without
   parsing its own words. */
import type { BookingStatus, ISODate } from '../model/types';
import type { Commitment } from './commitment';
import { addDays, fmtDow } from './dates';
import type { MetroLine } from './metroline';
import { plainWords as bare } from './mdlite';
import { splitBody } from './timeline';
import { S } from '../i18n/strings';

export type Tone = '' | 'warn' | 'crit';
export interface Part {
  t: string;
  /** 'warn' / 'crit' — a status in its colour; 'time' — a clock. */
  em?: 'warn' | 'crit' | 'time';
}
export interface Sentence {
  /** the caps line over it ("Now · step 2 of 8") */
  caps: string;
  parts: Part[];
  tone: Tone;
}

export interface TonightFact {
  /** the bed's own name — a stay's title or the day's bed label */
  name: string;
  state: 'booked' | 'pending' | 'walkin' | 'transit' | 'missing';
}

export interface ConciergeInput {
  phase: 'before' | 'during' | 'after';
  now: ISODate;
  /** "Day 21 of 37" */
  dayTag: string;
  tripDays: number;
  stops: number;
  daysToStart: number;
  dayTitle?: string;
  line?: MetroLine | null;
  /** the runbook's steps and the first one not ticked */
  steps?: string[];
  current?: number | null;
  tonight?: TonightFact | null;
  next?: Commitment | null;
  /** a to-do due today, its title as written */
  dueToday?: string | null;
}

const clock = (by: string): string => by.replace(/^[~≈]\s?/, '');
const status = (s: BookingStatus | undefined): Part =>
  s === 'booked' ? { t: S.concierge.booked } : { t: S.concierge.notBooked, em: 'warn' };
const toneOf = (parts: Part[]): Tone =>
  parts.some((p) => p.em === 'crit') ? 'crit' : parts.some((p) => p.em === 'warn') ? 'warn' : '';

/** What segment `i` of the line asks of you, as a sentence. */
function segmentSentence(line: MetroLine, i: number): Part[] {
  const seg = line.segments[i]!;
  const to = line.stations[i + 1]!;
  if (seg.missing) return [{ t: `${S.concierge.next} ${S.concierge.moveTo(to.name)} — ` }, { t: S.concierge.nothingBooked, em: 'crit' }, { t: '.' }];
  if (seg.kind === 'transfer') {
    const from = line.stations[i]!;
    /* leaving last night's bed: the check-out comes first, with its time */
    const out: Part[] =
      from.bed === 'last'
        ? [
            { t: `${S.concierge.next} ${S.concierge.checkOutOf(from.name)}` },
            ...(from.by ? [{ t: ` ${S.concierge.byWord} ` }, { t: clock(from.by), em: 'time' as const }] : []),
            { t: S.concierge.thenGetTo(to.name) },
          ]
        : [{ t: `${S.concierge.next} ${S.concierge.getTo(to.name)}` }];
    if (to.by) out.push({ t: ` ${S.concierge.byAbout} ` }, { t: clock(to.by), em: 'time' });
    out.push({ t: '.' });
    return out;
  }
  const what =
    seg.mode === 'air'
      ? S.concierge.flightTo(seg.label, to.name)
      : seg.mode === 'rail'
        ? S.concierge.trainTo(to.name)
        : S.concierge.byTo(seg.label, to.name);
  const out: Part[] = [{ t: `${S.concierge.next} ${what} — ` }, status(seg.status), { t: '.' }];
  const dep = seg.booking && 'dep' in seg.booking ? seg.booking.dep : undefined;
  if (to.by) out.push({ t: ` ${S.concierge.beIn(to.name)} ` }, { t: clock(to.by), em: 'time' }, { t: '.' });
  else if (dep) out.push({ t: ` ${S.concierge.leaves} ` }, { t: dep, em: 'time' }, { t: '.' });
  return out;
}

export function concierge(x: ConciergeInput): Sentence {
  if (x.phase === 'after') {
    return { caps: S.concierge.capsAfter, parts: [{ t: S.concierge.complete(x.tripDays, x.stops) }], tone: '' };
  }
  if (x.phase === 'before') {
    const parts: Part[] = [{ t: S.concierge.startsIn(x.daysToStart) }];
    const leg = x.next?.kind === 'leg' ? x.next : null;
    if (leg) {
      parts.push({ t: ` ${S.concierge.first(bare(leg.booking.title), fmtDow(leg.date))}` });
      if (leg.time) parts.push({ t: ` ${S.concierge.at} ` }, { t: leg.time, em: 'time' });
      parts.push({ t: '.' });
    }
    return { caps: x.dayTag, parts, tone: '' };
  }

  /* 1 — a travel day: the step you are on, or the segment you are on */
  const steps = x.steps ?? [];
  if (steps.length && x.current !== null && x.current !== undefined) {
    const i = x.line ? x.line.segments.findIndex((s) => s.step === x.current) : -1;
    const parts =
      i >= 0 && x.line
        ? segmentSentence(x.line, i)
        : [{ t: `${splitBody(bare(steps[x.current] ?? '')).title.replace(/[.:;,]+$/, '')}.` }];
    return { caps: S.concierge.capsStep(x.current + 1, steps.length), parts, tone: toneOf(parts) };
  }
  if (x.line && !steps.length && x.line.you >= 0) {
    const parts = segmentSentence(x.line, x.line.you);
    return { caps: S.concierge.capsNow, parts, tone: toneOf(parts) };
  }

  /* 2 — tonight, when nobody has booked it */
  if (x.tonight?.state === 'missing') {
    const parts: Part[] = [
      { t: `${S.concierge.tonightBed} ` },
      { t: S.concierge.notBooked, em: 'crit' },
      { t: ` — ${bare(x.tonight.name)}.` },
    ];
    return { caps: S.concierge.capsTonight, parts, tone: 'crit' };
  }

  /* 3 — a to-do that is due today */
  if (x.dueToday) return { caps: S.concierge.capsTodo, parts: [{ t: `${bare(x.dueToday)}.` }], tone: '' };

  /* 4 — the next move, when it is tomorrow */
  const next = x.next;
  if (next && next.kind === 'leg' && next.date === addDays(x.now, 1)) {
    const parts: Part[] = [{ t: `${S.concierge.tomorrow} ${bare(next.booking.title)}` }];
    if (next.time) parts.push({ t: ` ${S.concierge.at} ` }, { t: next.time, em: 'time' });
    parts.push({ t: ' — ' }, status(next.booking.status), { t: '.' });
    return { caps: x.dayTag, parts, tone: toneOf(parts) };
  }

  /* 5 — the day itself, and where you sleep */
  const parts: Part[] = [];
  if (x.dayTitle) parts.push({ t: `${bare(x.dayTitle).replace(/[.]+$/, '')}.` });
  const t = x.tonight;
  if (t) {
    parts.push({ t: `${parts.length ? ' ' : ''}${S.concierge.tonightIs(bare(t.name))} ` });
    parts.push(
      t.state === 'booked'
        ? { t: S.concierge.booked }
        : t.state === 'transit'
          ? { t: S.concierge.aboard }
          : t.state === 'walkin'
            ? { t: S.concierge.walkin }
            : { t: S.concierge.notBooked, em: 'warn' },
      { t: '.' },
    );
  }
  if (!parts.length) parts.push({ t: S.concierge.nothing });
  return { caps: x.dayTag, parts, tone: toneOf(parts) };
}

/** The sentence as one string — for a screen reader, and for tests. */
export const sentenceText = (s: Sentence): string => s.parts.map((p) => p.t).join('');

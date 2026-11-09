/* WHAT A STOP'S PAGE SAYS ABOUT ITS BOOKINGS (routes/Stop.svelte) — the one
   status line under the city guide's heading. (Its days are stopdays.ts.)

   Nothing here is stored or fetched, and nothing is counted a second time:
   what is held and what is still to buy is guide.ts `bookedHere` (the guide's
   own Booked chapter), which night has no bed and which move is not booked is
   coverage.ts (Journey's route check reads the same). A line is only an
   answer to those, in the route check's own words and tones: amber for not
   booked, red for a bed missing on a night still ahead.

   Pure: records in, chips out. */
import type { CoveredLeg, SegmentCoverage } from './coverage';
import type { BookedHere } from './guide';
import { S } from '../i18n/strings';

export interface StatusChip {
  text: string;
  tone: 'ok' | 'warn' | 'crit';
}

const W = S.city.status;

/** The moves that are not held, one chip each kind: "train not booked",
    "2 rides not booked", "flight part booked". A held move says nothing. */
export function legChips(legs: readonly CoveredLeg[]): StatusChip[] {
  const kinds = new Map<string, { mode: string; part: boolean; n: number }>();
  for (const l of legs) {
    if (l.state === 'booked') continue;
    const mode = W.move[l.connector.mode] ?? W.move.unknown!;
    const part = l.state === 'partial';
    const k = kinds.get(`${mode}${part}`) ?? { mode, part, n: 0 };
    kinds.set(`${mode}${part}`, { ...k, n: k.n + 1 });
  }
  return [...kinds.values()].map((k) => ({ text: W.leg(k.mode, k.n, k.part), tone: 'warn' as const }));
}

/** The stop's one line: "3 booked · 2 tickets to buy · train not booked".
    `seg` is the stop's coverage segment (null when it has none); a stop with
    nothing to say has no chips. */
export function stopStatus(held: BookedHere, seg: SegmentCoverage | null): StatusChip[] {
  const booked = [...held.beds, ...held.flights, ...held.tickets].filter((b) => b.status === 'booked').length;
  const toBuy = held.tickets.filter((t) => t.status === 'pending').length;
  const stays = held.beds.filter((b) => b.status === 'pending').length;
  const chips: StatusChip[] = [];
  if (booked) chips.push({ text: W.booked(booked), tone: 'ok' });
  if (toBuy) chips.push({ text: W.toBuy(toBuy), tone: 'warn' });
  if (stays) chips.push({ text: W.staysPending(stays), tone: 'warn' });
  if (seg?.bedsMissing) chips.push({ text: W.noBed(seg.bedsMissing), tone: seg.tone === 'crit' ? 'crit' : 'warn' });
  return [...chips, ...legChips(seg?.legs ?? [])];
}

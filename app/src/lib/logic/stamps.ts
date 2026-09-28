/* ONE four-way stamp, everywhere a booking's status is shown.

   Home, the Wallet's luggage tag and the city guide each grew their own
   version of the same ternary, and the guide's had no `cancelled` arm — so a
   cancelled bed fell through to the last branch and the app told the traveller
   he could walk in to a room that no longer exists. A status map with a hole in
   it is worse than no stamp at all, so there is exactly one of them now and it
   is exhaustive over BookingStatus.

   Pure: strings in, strings out, no DOM and no dates. */
import type { BookingStatus } from '../model/types';
import { S } from '../i18n/strings';

export interface Stamp {
  label: string;
  /** '' is the neutral stamp (walk-in); the rest are Lantern status classes. */
  cls: '' | 'ok' | 'warn' | 'crit';
}

/** The stamp a booking status wears. Exhaustive by construction. */
export function statusStamp(status: BookingStatus): Stamp {
  switch (status) {
    case 'booked':
      return { label: S.money.booked1, cls: 'ok' };
    case 'pending':
      return { label: S.money.pending, cls: 'warn' };
    case 'walkin':
      return { label: S.money.walkin, cls: '' };
    case 'cancelled':
      return { label: S.money.cancelled, cls: 'crit' };
  }
}

/** A status as Horizon's chips say it — a word (Booked, Pending, Walk-in,
    Cancelled) and its tone; no status reads as pending. The one copy (Run
    3c): the route check's legs, the guide's Booked chapter and the city's
    pin lines each hand-rolled their own, and two of them called a walk-in
    "Pending" or painted it amber. */
export function chipOf(s: BookingStatus | undefined): Stamp {
  const st = s ?? 'pending';
  return { label: S.chip[st], cls: statusStamp(st).cls };
}

/** The stamp a night with NO reservation behind it wears. Absence of a stamp
    reads as "fine"; this is the state drawn out loud instead. */
export function noBookingStamp(): Stamp {
  return { label: S.today.noBooking, cls: 'crit' };
}

/** A NIGHT SPENT MOVING IS NOT A MISSING BED. When an overnight leg spans the
    night, the absent reservation is the correct state of the world and not a
    hole in the plan, so it takes the neutral stamp rather than the crit one —
    the same reasoning that gives a walk-in no colour. Red that fires on a night
    nobody could book teaches the reader to skip red. */
export function transitNightStamp(): Stamp {
  return { label: S.today.nightInTransit, cls: '' };
}

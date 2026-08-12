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

/** The stamp a night with NO reservation behind it wears. Absence of a stamp
    reads as "fine"; this is the state drawn out loud instead. */
export function noBookingStamp(): Stamp {
  return { label: S.today.noBooking, cls: 'crit' };
}

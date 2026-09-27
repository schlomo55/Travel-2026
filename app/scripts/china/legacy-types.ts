/* Shape of the legacy app's DATA object (legacy/index.html, lines ~412–1308).
   Typed to exactly what the transformer consumes — the legacy file is frozen. */

export interface LegacyDay {
  title: string;
  bed: string;
  plan: string[];
  run?: string;
}

export interface LegacyBlock {
  h: string;
  li?: string[];
  days?: { d: string; t: string }[];
}

export interface LegacyStop {
  id: string;
  em: string;
  h: number;
  name: string;
  when: string;
  start: string;
  end: string;
  nights: number;
  cost?: string;
  warn?: string;
  blocks: LegacyBlock[];
  reco?: { h: string; li: string[] }[];
}

export interface LegacyBooking {
  id: string;
  kind: string;
  group: string;
  carrier: string;
  fno: string;
  date: string;
  dateLabel: string;
  from: string;
  fromName: string;
  dep: string;
  to: string;
  toName: string;
  arr: string;
  plus?: number;
  dur: string;
  ac: string;
  meta: [string, string, (0 | 1)?][];
  code: string;
  codeLabel: string;
  sub?: string;
  gmail: string;
  note?: string;
  alert?: 0 | 1;
  manage?: string;
}

export interface LegacyDoc {
  id: string;
  icon: string;
  title: string;
  code: string;
  codeLabel: string;
  rows: [string, string][];
  balance?: number;
  gmail?: string;
  note?: string;
  pending?: 0 | 1;
}

export interface LegacyHotel {
  city: string;
  name: string;
  dates: string;
  /* OPTIONAL SINCE 2026-08-12, when the Kunyu academy fortnight arrived with no
     rate confirmed in writing and shipped without one rather than borrowing the
     ~$890/month the accommodation document called unconfirmed.
     EVERY BED CARRIES ONE AGAIN SINCE 2026-08-13: the school put $840 in
     writing. The field stays optional on purpose — the rule is "a bed with no
     confirmed price ships none", and a rule that only ever held for one bed for
     one month is still the rule. See the transform, where `priceNote` is spread
     only when this exists. */
  price?: string;
  pending?: 0 | 1;
  walkin?: 0 | 1;
  link?: string;
  note?: string;
  /* A BOOKED bed carries the same counter-facing set a flight ticket does:
     the number you read out at the desk, what to call it, a secondary line
     under it (a PIN belongs here, never in the big type), the k/v chips, and a
     link to the order rather than to a search for a hotel you already hold. */
  code?: string;
  codeLabel?: string;
  sub?: string;
  meta?: [string, string, (0 | 1)?][];
  manage?: string;
  /* Same field a flight has, and it arrived on a bed for the same reason: from
     27 to 29 Jul 2026 the ibis Kunming order was paid and numbered while
     Trip.com still showed it as "Confirming". The note is drawn as an alert
     rather than as prose. No bed sets it today — the property accepted — and
     the field stays because a paid-but-unaccepted bed must always be able to
     say so. */
  alert?: 0 | 1;
}

export interface LegacyTask {
  k: string;
  due: string;
  dueLabel: string;
  pri: 1 | 2 | 3;
  t: string;
  d?: string;
  link?: string;
}

export interface LegacyAlarm {
  d: string;
  tm: string;
  t: string;
  why: string;
  /** 1 = the moment has passed and it was acted on. Alarms are keyed by INDEX
      (cn26-alarm-NN), so a finished one is marked, never deleted — deleting
      would renumber every alarm after it. */
  done?: 1;
}

export interface LegacyData {
  version: string;
  updated: string;
  trip: { start: string; end: string; entry: string; exit: string; visaDeadline: string };
  traveler: { name: string; passport: string; passportKind: string; dob: string; ffp: string; note: string };
  stops: LegacyStop[];
  days: Record<string, LegacyDay>;
  kunyuDefault: LegacyDay;
  kunyuSunday: LegacyDay;
  runbooks: Record<string, { t: string; s: string[] }>;
  bookings: LegacyBooking[];
  docs: LegacyDoc[];
  hotels: LegacyHotel[];
  tasks: LegacyTask[];
  alarms: LegacyAlarm[];
  packing: { h: string; items: [string, string][] }[];
  apps: [string, string][];
  info: { icon: string; h: string; crit?: 0 | 1; li: string[] }[];
  emergency: { t: string; v: string; vfy?: 0 | 1; pend?: 0 | 1 }[];
  phrases: { zh: string; en: string; key?: 0 | 1 }[];
  places: { zh: string; en: string; note?: string; vfy?: 0 | 1; pend?: 0 | 1 }[];
  cats: Record<string, { label: string; plan: number; dot: string }>;
  totalPlan: number;
  rates: Record<string, number>;
  syms: Record<string, string>;
}

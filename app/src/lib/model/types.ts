/* Living the dream data model. Conventions (see docs/ARCHITECTURE.md):
   - ISODate is a LOCAL-NAIVE 'YYYY-MM-DD' wall-calendar date. Never new Date(str).
   - Money is integer minor units in the trip's home currency (homeMinor).
   - Rich text fields are md-lite strings (**bold**, *italic*, [label](url), newlines).
   - Seed/import ids are deterministic slugs; app-created ids come from newId(). */

export type Id = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type HHMM = string; // '17:00'

export interface TripCurrency {
  code: string;
  symbol: string;
  rateToHome: number; // units of this currency per 1 home unit
}
export interface TripClock {
  label: string;
  timeZone: string; // IANA
  flag?: string;
}

export interface Trip {
  id: Id;
  title: string;
  subtitle?: string;
  emoji?: string;
  start: ISODate; // inclusive
  end: ISODate; // inclusive
  homeCurrency: string;
  currencies: TripCurrency[];
  accentHue: number; // 0–360, drives --accent-h
  coverDocId?: Id; // documents-vault photo shown as the shelf cover
  clocks: TripClock[];
  budgetTotalMinor?: number;
  driverSuffix?: { native: string; meaning: string };
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Generalized visa clock — 0..n per trip; a pinned one shows in the app bar. */
export interface ComplianceCounter {
  id: Id;
  tripId: Id;
  name: string;
  icon?: string;
  startDate: ISODate;
  countStartsDayAfter: boolean;
  limitDays: number;
  hardDeadline?: ISODate;
  plannedEndDate?: ISODate;
  note?: string;
  pinned: boolean;
}

export interface ContentBlock {
  id: Id;
  heading: string;
  items: string[]; // md-lite
  dayRows?: { label: string; text: string }[];
}

export interface Stop {
  id: Id;
  tripId: Id;
  kind: 'stop' | 'transit';
  name: string;
  emoji?: string;
  hue: number;
  start: ISODate;
  end: ISODate; // [start, end) occupancy
  nights?: number;
  whenLabel?: string;
  costNote?: string;
  warn?: string; // md-lite
  photoDocId?: Id; // documents-vault photo shown on the stop card
  detail?: string; // md-lite, multi-paragraph — the "read more" long text
  blocks: ContentBlock[];
  recoBlocks: ContentBlock[];
  order: number;
}

export interface DayPlan {
  id: Id;
  tripId: Id;
  date: ISODate; // unique per [tripId+date]
  title: string;
  bedEmoji?: string;
  bedLabel?: string;
  planItems: string[]; // md-lite
  runbookId?: Id;
}

/** Fallback plan while inside a stop's range (generalizes the Kunyu default days). */
export interface DayDefault {
  id: Id;
  tripId: Id;
  stopId?: Id;
  weekdays?: number[]; // 0=Sun; undefined = all
  title: string;
  bedEmoji?: string;
  bedLabel?: string;
  planItems: string[];
}

export interface Runbook {
  id: Id;
  tripId: Id;
  title: string;
  severity: 'info' | 'warn' | 'crit';
  steps: string[]; // md-lite; ticks live in checkState per (runbook, date, index)
}

export type BookingStatus = 'booked' | 'pending' | 'walkin' | 'cancelled';
export interface BookingMeta {
  k: string;
  v: string;
  warn?: boolean;
}
interface BookingBase {
  id: Id;
  tripId: Id;
  status: BookingStatus;
  title: string;
  groupLabel?: string;
  date: ISODate; // anchor: departure / check-in
  code?: string;
  codeLabel?: string;
  codeSub?: string;
  gmailQuery?: string;
  manageUrl?: string;
  bookingLinkUrl?: string;
  meta: BookingMeta[];
  note?: string; // md-lite
  alert?: boolean;
  paidMinor?: number;
  stopId?: Id;
  createdAt: number;
  updatedAt: number;
}
export interface FlightBooking extends BookingBase {
  kind: 'flight';
  carrier: string;
  flightNo: string;
  from: { code: string; name?: string };
  to: { code: string; name?: string };
  dep: HHMM;
  arr: HHMM;
  arrDayOffset: 0 | 1 | 2;
  duration?: string;
  aircraft?: string;
}
export interface TrainBooking extends BookingBase {
  kind: 'train';
  from: { code?: string; name: string };
  to: { code?: string; name: string };
  dep?: HHMM;
  arr?: HHMM;
  trainNo?: string;
}
export interface HotelBooking extends BookingBase {
  kind: 'hotel';
  city: string;
  checkIn: ISODate;
  checkOut: ISODate;
  priceNote?: string;
}
export interface ActivityBooking extends BookingBase {
  kind: 'activity';
  venue?: string;
  time?: HHMM;
}
export interface OtherBooking extends BookingBase {
  kind: 'other';
}
export type Booking = FlightBooking | TrainBooking | HotelBooking | ActivityBooking | OtherBooking;

/** Money & ID cards (legacy docs[]): passport, gift card, deposits, insurance. */
export interface WalletCard {
  id: Id;
  tripId: Id;
  emoji?: string;
  title: string;
  code?: string;
  codeLabel?: string;
  rows: { k: string; v: string }[];
  balance?: { amountMinor: number; currency: string } | null;
  gmailQuery?: string;
  note?: string; // md-lite
  pending: boolean;
  order: number;
}

export type DocumentTag = 'ticket' | 'insurance' | 'passport' | 'photo' | 'other';
export interface DocumentFile {
  id: Id;
  tripId: Id;
  bookingId?: Id;
  walletCardId?: Id;
  stopId?: Id; // place photos link to their stop, like bookingId links to a booking
  name: string;
  fileName: string;
  mime: string;
  size: number;
  tag: DocumentTag;
  addedAt: number;
}
export interface DocumentBlob {
  id: Id; // same id as its DocumentFile
  blob: Blob;
}

export interface Task {
  id: Id;
  tripId: Id;
  title: string; // md-lite
  detail?: string; // md-lite — the "why this matters" body
  due?: ISODate;
  dueLabel?: string;
  priority: 1 | 2 | 3;
  link?: string;
  done: boolean;
  doneAt?: number;
  order: number;
}

export interface Alarm {
  id: Id;
  tripId: Id;
  date: ISODate;
  time: HHMM;
  title: string;
  why?: string;
  done: boolean; // "put in the phone calendar" tick
}

export interface PackingItem {
  id: Id;
  tripId: Id;
  group: string;
  label: string; // md-lite
  done: boolean;
  order: number;
}
export interface PackingTemplate {
  id: Id;
  name: string;
  groups: { name: string; items: string[] }[];
  updatedAt: number;
}

export interface ChecklistItem {
  id: Id;
  label: string; // md-lite
  done: boolean;
}
export interface Checklist {
  id: Id;
  tripId: Id;
  title: string;
  note?: string;
  items: ChecklistItem[];
  order: number;
}

export interface Expense {
  id: Id;
  tripId: Id;
  date: ISODate;
  categoryId: Id;
  desc: string;
  amount: number; // as entered, in `currency`
  currency: string;
  rateToHome: number; // snapshot at entry time
  homeMinor: number; // integer minor units, trip home currency (may be negative-representing via refund flag)
  payment: 'card' | 'cash';
  refund: boolean;
  ts: number;
}
export interface ExpenseCategory {
  id: Id;
  tripId: Id;
  label: string;
  planMinor: number;
  color: string;
  order: number;
  legacyKey?: string; // legacy 'flights'|'training'|… — enables old-data import
}

/** Phrase & place cards — the taxi-card system, generalized. */
export interface ShowCard {
  id: Id;
  tripId: Id;
  kind: 'phrase' | 'place';
  native: string; // the big text a driver/vendor reads
  meaning: string;
  note?: string;
  verify: boolean; // from general knowledge, not trip documents
  pending: boolean;
  isKey: boolean; // the "please take me here" suffix phrase
  order: number;
}

export interface EmergencyContact {
  id: Id;
  tripId: Id;
  label: string;
  value: string;
  kind: 'phone' | 'url' | 'text';
  verify: boolean;
  pending: boolean;
  order: number;
}

export interface InfoCard {
  id: Id;
  tripId: Id;
  emoji?: string;
  heading: string;
  items: string[]; // md-lite
  severity: 'normal' | 'crit';
  order: number;
}

export interface TripNote {
  tripId: Id;
  text: string;
  updatedAt: number;
}

/** Dated checkbox state (runbook step ticks): key `${tripId}:run:${runbookId}:${date}:${idx}` */
export interface CheckState {
  key: string;
  tripId: Id;
  at: number;
}

export interface Settings {
  id: 'settings';
  theme: 'light' | 'dark' | 'system';
  activeTripId: Id | null;
  lastBackupAt: number | null;
  lastMutationAt: number;
  backupNagDays: number;
  persisted?: boolean;
}
export interface MetaKV {
  key: string;
  value: unknown;
}

/* ---------- backup / seed envelope (docs/ARCHITECTURE.md §7) ---------- */

export interface TripBundle {
  trip: Trip;
  counters: ComplianceCounter[];
  stops: Stop[];
  dayPlans: DayPlan[];
  dayDefaults: DayDefault[];
  runbooks: Runbook[];
  bookings: Booking[];
  walletCards: WalletCard[];
  tasks: Task[];
  alarms: Alarm[];
  packingItems: PackingItem[];
  checklists: Checklist[];
  expenses: Expense[];
  categories: ExpenseCategory[];
  showCards: ShowCard[];
  emergency: EmergencyContact[];
  infoCards: InfoCard[];
  note?: TripNote;
  checkState: CheckState[];
  documents: { meta: DocumentFile; dataBase64: string }[];
}

export interface AppBackup {
  format: 'livingthedream/backup';
  formatVersion: 1;
  kind: 'vault' | 'trip';
  exportedAt: string;
  appVersion: string;
  settings?: Settings;
  packingTemplates?: PackingTemplate[];
  trips: TripBundle[];
}

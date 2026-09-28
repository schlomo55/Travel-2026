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

/** WGS-84, always. Chinese map apps need GCJ-02 — convert at the link builder
    (lib/logic/geo.ts), never in storage. */
export interface Coord {
  lat: number;
  lng: number;
}

/* THE MAP TAB'S THREE FIELDS — on Spot, ShowCard and every booking (Map 5a,
   2026-09-28). All three are optional, and a trip file written before them
   simply has none.

   `pin` — where the Map tab may DRAW the place. WGS-84, like every coordinate
   here. Written only by the coordinate pass (scripts/china/pins.ts, generated
   by `npm run verify:places`), only where OpenStreetMap's answer passed the
   name, distance and kind checks, and only where `coord` is absent — the Map
   tab reads `coord ?? pin`. IT IS NEVER A MAP TARGET. The map buttons, the
   weather and the city close-up read `coord`, whose rules are older and
   stricter: a spot opens by its NAME, and a bed never ships a dot. Keeping the
   two apart is what lets a place gain a pin without changing what any button
   opens or what any existing screen draws.

   `category` — what the place is FOR the traveller, one of PlaceCategory: the
   Map tab's icon, colour and filter chip (MAPS6.md). From OpenStreetMap's tags
   where the pass confirmed the place, else from the entity's own kind; the
   trip's own words win over both (the Beijing Massage Hospital is a spa — blind
   massage — not a hospital).

   `detail` — ONE line, at most 90 characters, of the trip's OWN words about
   the place: verbatim, or a trimmed clause of them. Never composed and never
   general knowledge; absent where the trip does not describe the place. */
export type PlaceCategory = 'food' | 'spa' | 'sight' | 'show' | 'hotel' | 'transport' | 'medical' | 'shopping';

/** One named place inside a stop — the actionable index behind the options
    prose. Every spot in the seed had its name checked against OpenStreetMap at
    BUILD time (scripts/china/spots.ts, `npm run verify:places`); the ones that
    could not be confirmed are simply not here, so every spot the app shows can
    be opened. Same map fields as everything else, so one button serves all. */
export interface Spot {
  id: Id;
  name: string;
  native?: string; // the Chinese a driver reads
  kind: 'sight' | 'food' | 'show' | 'transport' | 'other';
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  mapUrl?: string;
  address?: string; // the street address in the local script — see AddressFields
  addressInSearch?: boolean; // only chains need the street to pick a branch
  addressEn?: string;
  /* The city guide's option row (plan §SCREENS 5). All three are optional and
     all three are drawn ONLY when the trip data carries them: no spot is ever
     given a star it did not earn, and a guide whose facts are all sourced is
     indistinguishable from the mockup. */
  photoDocId?: Id; // a photo from the documents vault, shown in the cream frame
  rating?: number; // 0–5, from the traveller's own notes
  verify?: boolean; // this line came from general knowledge, not the documents
  /* The Map tab's fields — see the block under Coord. */
  category?: PlaceCategory;
  detail?: string;
  pin?: Coord;
}

/* THE ADDRESS FIELDS, on Stop, ShowCard, Spot and every booking.

   `address` is the address in the LOCAL script — 重庆市渝中区朝天门街道千厮门大桥 —
   because that is the string a taxi driver reads and a Chinese map app
   resolves. `addressEn` is the romanised form, optional, and only ever a
   convenience for the owner: nothing routes on it.

   Neither is ever composed by hand. They come from OpenStreetMap's
   `addressdetails` at BUILD time (scripts/verify-place-names.ts →
   scripts/china/map-links.ts, spots.ts), or from what the owner pasted out of
   their own booking confirmation. A place whose address neither source knows
   simply has none — the app renders nothing rather than inventing a street.

   They show in two places, both decided by the owner: full screen in the
   driver overlay, and folded into the map search behind the button. They add
   no line to the Info lists. */

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
  coord?: Coord; // city/area grade — drives the map buttons and the weather lookup
  mapQuery?: string; // place NAME a map search opens (Chinese on the mainland)
  mapCity?: string; // city/region context for that search
  mapUrl?: string; // a share link the owner pasted — wins over name and coord
  address?: string; // local-script street address — see AddressFields above
  addressInSearch?: boolean; // only chains need the street to pick a branch
  addressEn?: string;
  blocks: ContentBlock[];
  recoBlocks: ContentBlock[];
  options?: ContentBlock[]; // "All the options" — researched picks + alternatives
  spots?: Spot[]; // the openable places named in those options
  order: number;
}

/* THE PLACES A DAY GOES TO, on DayPlan and DayDefault.

   `planItems` are prose: the sentences the trip file wrote, naming places the
   way a person says them ("Forbidden City", "Big Buddha", "the races"). The
   entities that can be opened in a map are named the way a map answers to
   (`Palace Museum`, `Tian Tan Buddha`, `Happy Valley Racecourse`). `placeIds`
   is the join between the two, written by a human and shipped as data — ids of
   stops, spots, driver cards or bookings, in the day's own order.

   It is EXPLICIT on purpose. Matching the prose against the names at runtime
   would have to guess, and the guesses it gets wrong are the expensive ones:
   "The Peak" is not the `Peak Tram`, and "Yat Lok is closed Wednesdays" names
   a restaurant precisely in order to say you are not going to it.

   Every id is checked at BUILD time (scripts/china/assert.ts): it must resolve
   to a real entity that carries a map target, or the seed is not written. A
   place the day names but the trip does not carry is simply absent — the app
   renders one fewer chip, never a chip that opens the wrong place. A day with
   nothing to link has NO FIELD, never an empty array. */

export interface DayPlan {
  id: Id;
  tripId: Id;
  date: ISODate; // unique per [tripId+date]
  title: string;
  bedEmoji?: string;
  bedLabel?: string;
  planItems: string[]; // md-lite
  placeIds?: Id[]; // openable places this day's plan refers to — see above
  runbookId?: Id;
}

/* THE ONE PLAN ITEM THE APP ITSELF WROTE.

   A free block on Home offers the stop's own researched options, and picking
   one puts it in the day. It could not go into `DayPlan.planItems`, for three
   reasons that are all the same reason:

     · a DayPlan is AUTHORED TEXT. Editing it to hold a choice made on a phone
       in Chongqing means the trip file and the app disagree about what the
       trip file says.
     · re-importing the seed upserts every DayPlan, so a pick written into one
       would vanish the next time the trip file is loaded — silently, and
       exactly when someone is restoring after a wiped phone.
     · half the days of this trip have no DayPlan at all; they resolve through
       a DayDefault (logic/day.ts). There is no row to write into.

   So a pick is its own record, on its own table, carrying `origin` as the
   provenance marker that says who wrote it. Un-picking deletes exactly this
   row and nothing else. It rides in the backup envelope like every other
   per-trip collection, so the marker survives export → import.

   IT CARRIES NO TIME, DELIBERATELY. See docs/ARCHITECTURE.md §3a. */
export interface DayPick {
  id: Id;
  tripId: Id;
  date: ISODate;
  /** The option line EXACTLY as the trip file wrote it — md-lite, verbatim.
      Stored rather than referenced so the day still reads if the stop's
      options are later edited: the day says what was chosen, not what the
      guide says today. */
  text: string;
  /** Which researched line it was, for the block that offered it:
      `<ContentBlock id>` + index. The pair is what flips a candidate row to
      its "planned" look in place. */
  blockId: Id;
  itemIndex: number;
  /** The stop whose options offered it — the guide this pick came out of. */
  stopId?: Id;
  /** The verified place the line names, when the stop's spot index knew one. */
  spotId?: Id;
  /** THE PROVENANCE MARKER. 'picked' is the only value the app writes; the
      field exists so a future origin can never be confused with this one, and
      so an importer can tell an app-created plan item from an authored one. */
  origin: 'picked';
  createdAt: number;
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
  placeIds?: Id[]; // same contract as DayPlan.placeIds
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
  /** THIS LEG IS THE OTHER WAY OF DOING THE SAME JOURNEY, not a second part of
      it. Two bookings can share a handover date for opposite reasons: Dec 11 is
      a train to Beijing AND THEN a flight to Zhangjiajie — genuinely two parts —
      while Nov 22 is a flight to Yantai OR ELSE the HSR, and only one of them
      will happen. Without this flag the Plans page would read the second as a
      second hop and tell you to do both. Set on the alternative, never on the
      plan. */
  alternative?: boolean;
  /** Free text — "≈$120", "$20–30/n". Fares and room rates as they were quoted. */
  priceNote?: string;
  paidMinor?: number;
  stopId?: Id;
  /* Where this booking IS, for the map button. A flight carries its departure
     airport — the place you have to reach. A bed carries whatever survived
     verification, and never a coordinate: no hotel address is in the sources,
     and a guessed one would be the worst lie in the app. */
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  mapUrl?: string;
  /** Pasted from a booking confirmation, in whatever script it arrived in.
      The four beds that ship with no button light up the moment this is
      typed — nothing else about them changes. */
  address?: string;
  addressInSearch?: boolean; // only chains need the street to pick a branch
  
  addressEn?: string;
  /* The Map tab's fields — see the block under Coord. A bed may carry a `pin`
     (never a `coord`); a ticket borrows its place's. */
  category?: PlaceCategory;
  detail?: string;
  pin?: Coord;
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
/** One station a rail leg can actually open — the map fields borrowed whole
    from an entity this repo has ALREADY verified (a driver card or a stop's
    spot), never composed here. `name` is that entity's own name. */
export interface RailStation {
  name: string;
  coord?: Coord;
  mapQuery?: string;
  mapCity?: string;
  address?: string;
}
/** One end of a rail leg. A flight has exactly one place at each end, because
    an airport code IS a place. A train does not:

      · `stations` holds ZERO where the trip's documents name no station (the
        Dec 14 arrival is "Chongqing", and Chongqing has two main stations far
        apart), ONE in the ordinary case, and TWO where the documents offer a
        choice and have not made it ("Beijing North / Qinghe", Dec 9).
      · `why` is printed on the card wherever `stations` is empty. A rail end
        with no button says on its face why it has none — the same honesty the
        buttonless driver cards and beds already use. */
export interface RailEnd {
  code?: string;
  /** What the documents call this end, in their own words. */
  name: string;
  stations?: RailStation[];
  /** Required in practice wherever `stations` is empty; shown on the card. */
  why?: string;
}
export interface TrainBooking extends BookingBase {
  kind: 'train';
  from: RailEnd;
  to: RailEnd;
  dep?: HHMM;
  arr?: HHMM;
  trainNo?: string;
  /** "~2 h" — the documents' own figure, never a computed one. */
  duration?: string;
}
export interface HotelBooking extends BookingBase {
  kind: 'hotel';
  city: string;
  checkIn: ISODate;
  checkOut: ISODate;
}
/** THE THINGS YOU DO: a ticket, an attraction, a guided day, a table that has
    to be reserved. It is the kind behind the Wallet's **Experiences** segment
    (routes/Wallet.svelte) and the money screen's Experiences group.

    It was declared with the model and stood empty until 2026-08-06, when the
    owner bought a concert ticket and it turned out to have nowhere to live — in
    the day plan and in the money, and absent from the one screen you hold up at
    a counter. No SIXTH kind was invented for that: an experience is a venue, a
    date, a time, a reference and a price, which is exactly what this already
    said, and a second kind meaning the same thing would be a second dialect for
    one idea. `code`/`codeLabel`/`codeSub`, `priceNote`, `status` and the map
    fields all come from BookingBase, and `BookingCard` draws it. Seat, section,
    deposit and release window ride as `meta` chips. */
export interface ActivityBooking extends BookingBase {
  kind: 'activity';
  /** Where it happens, in the words the trip's own documents use. */
  venue?: string;
  /** Only where a document states a start time for the thing itself. */
  time?: HHMM;
}
/** ANYTHING THAT MOVES YOU AND IS NEITHER A FLIGHT NOR A TRAIN — on this trip,
    a bus into Tiger Leaping Gorge and a shared car out of it (scripts/china/
    road.ts). No SIXTH kind was invented for them, for the reason ActivityBooking
    gives above: a road leg is structurally a rail leg without the rails — two
    ends, a date, a duration, a fare — so it reuses `RailEnd` and the same
    "no button where no document names a place" contract. What separates it from
    a train is the word, and a second kind meaning one idea is a second dialect.
    The fields are optional because `other` is still the catch-all it always
    was; a road leg simply fills them in. */
export interface OtherBooking extends BookingBase {
  kind: 'other';
  from?: RailEnd;
  to?: RailEnd;
  dep?: HHMM;
  arr?: HHMM;
  /** "~4–5 h" — the documents' own figure, never a computed one. */
  duration?: string;
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
  coord?: Coord; // POI grade, WGS-84 — omitted when it could not be verified
  mapQuery?: string; // place NAME a map search opens (Chinese on the mainland)
  mapCity?: string; // city/region context for that search
  mapUrl?: string; // a share link the owner pasted — wins over name and coord
  address?: string; // shown FULL SCREEN under the name in the driver overlay
  addressInSearch?: boolean; // only chains need the street to pick a branch
  addressEn?: string;
  verify: boolean; // from general knowledge, not trip documents
  pending: boolean;
  isKey: boolean; // the "please take me here" suffix phrase
  order: number;
  /* The Map tab's fields — see the block under Coord. Place cards only. */
  category?: PlaceCategory;
  detail?: string;
  pin?: Coord;
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
  activeTripId: Id | null;
  lastBackupAt: number | null;
  lastMutationAt: number;
  backupNagDays: number;
  persisted?: boolean;
  /** The one network switch in the app. Undefined = on (see repo.ts). */
  weatherOnline?: boolean;
  /** Undefined = off — the phone's own reduced-motion setting still wins. */
  calmMotion?: boolean;
  /** Horizon's route motions — Flow, Comet, Ink, Relay. Undefined = ON, which
      is also what every settings record written before 2026-09-27 says by
      saying nothing. Off, the route lines stand still at their end states;
      Calm motion stills them too, and more. See lib/logic/motion.ts. */
  routeAnimations?: boolean;
  /** 'dark' | 'light'. Undefined = dark, which is also what every settings
      record written before 2026-08-12 says by saying nothing. See
      lib/logic/theme.ts — anything that is not 'light' is dark. */
  theme?: 'dark' | 'light';
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
  /** OPTIONAL, and it will stay that way. A trip FILE cannot carry picks: a
      pick is something a traveller did on a phone, not something a trip file
      says, so the seed builder emits no such key and neither does any backup
      written before 2026-08-12. `normalizeBundle` fills it with []. */
  dayPicks?: DayPick[];
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

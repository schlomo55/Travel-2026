/* Legacy DATA → Living the dream TripBundle. Deterministic ids (cn26-*), deterministic
   timestamps (SEED_TS), md-lite conversion for every rich-text field.
   Nothing is summarized or invented; pending/verify flags carry over. */
import { htmlToMdlite } from '../../src/lib/logic/mdlite';
import type {
  Alarm,
  Booking,
  Checklist,
  ComplianceCounter,
  ContentBlock,
  Coord,
  DayDefault,
  DayPlan,
  EmergencyContact,
  Expense,
  ExpenseCategory,
  FlightBooking,
  HotelBooking,
  InfoCard,
  ISODate,
  PackingItem,
  Runbook,
  ShowCard,
  Spot,
  Stop,
  Task,
  Trip,
  TripBundle,
  WalletCard,
} from '../../src/lib/model/types';
import type { LegacyData, LegacyDay } from './legacy-types';
import type { OptionBlockInput } from './inputs';
import { AIRPORT_COORDS, PLACE_COORDS, STOP_COORDS } from './coords';
import { AIRPORT_MAPS, PLACE_MAPS, STAY_MAPS, STOP_MAPS, type MapPlan } from './map-links';
import { SPOTS } from './spots';
import { COVER_STOP_KEY } from './photos';

/** Deterministic build timestamp → byte-identical seed on rebuild. */
export const SEED_TS = Date.UTC(2026, 6, 24); // 2026-07-24, the day the legacy app was verified
export const SEED_DATE = '2026-07-24' as const; // same instant as an ISO date

/** Fares, keyed by flight number as the legacy data spells it.

    Provenance (2026-07-25): the guide's key-dates list, item `book-flights`, in
    sources/china-2026/china-2026-trip-guide-v12.html:
      "✅ ALL FLIGHTS BOOKED (~$2,790) — Etihad Deluxe open-jaw (~$2,026) +
       3 internal: Dec 11 CA1953 PEK→Zhangjiajie ($241) · Dec 16 Sichuan
       CKG→Lijiang ($230) · Dec 21 China Eastern Business KMG→HK ($293)."
    Those are the prices PAID. The same guide writes "~$120" for CA1953 in the
    Dec 11 day narrative — that is the pre-booking estimate, superseded by the
    $241 actually booked, so the booked figure is the one that ships.

    The four Etihad legs share ONE booking (PNR 8CR7MR) and one price, ~$2,026.
    It is deliberately not split across them — the international-flights stop
    already carries it in its costNote ("≈$1,050 (booked ~$2,026)"), and the
    app reads it from there so it is counted exactly once.

    The flights PDF carries NO fares at all (checked by eye 2026-07-25 — its
    text layer is unreadable by script). Extend this map as real fares surface;
    the owner can also type one into any flight card in the app
    (flightSpec → "Fare"). */
export const FLIGHT_FARES: Record<string, string> = {
  'CA 1953': '$241',
  '3U 8011': '$230',
  'MU 733': '$293',
};

/** Driver cards whose Chinese name was WRONG, corrected against Wikidata.

    The legacy app spelled Zhangjiajie's airport 张家界荷花机场. Wikidata
    Q1134280 — the item whose IATA code is DYG and whose coordinate matches the
    one coords.ts verified from Wikipedia to 0.01 km — calls it
    张家界荷花国际机场. OpenStreetMap agrees: it has no node for the short form
    at all, and answers the full one 0.17 km from our pin. So the card a driver
    reads now carries the name that is actually painted on the terminal.

    This map exists for corrections that TWO independent sources agree on. It
    is not a place to reword content. */
export const PLACE_NATIVE_FIXES: Record<string, string> = {
  'cn26-place-09': '张家界荷花国际机场',
};

const TRIP_ID = 'cn26';
const md = htmlToMdlite;
const pad2 = (n: number) => String(n).padStart(2, '0');

function splitBed(bed: string): { bedEmoji?: string; bedLabel: string } {
  const sp = bed.indexOf(' ');
  if (sp > 0 && !/[A-Za-z0-9]/.test(bed.slice(0, sp))) {
    return { bedEmoji: bed.slice(0, sp), bedLabel: md(bed.slice(sp + 1).trim()) };
  }
  return { bedLabel: md(bed) };
}

function blocks(stopId: string, prefix: string, src: { h: string; li?: string[]; days?: { d: string; t: string }[] }[]): ContentBlock[] {
  return src.map((b, i) => ({
    id: `${stopId}-${prefix}${i}`,
    heading: md(b.h),
    items: (b.li ?? []).map(md),
    ...(b.days ? { dayRows: b.days.map((d) => ({ label: d.d, text: md(d.t) })) } : {}),
  }));
}

/** 'Dec 5 – 7' → ['2026-12-05', '2026-12-07'] (all legacy stays are December 2026). */
export function parseLegacyStayDates(s: string): [ISODate, ISODate] {
  const m = /^Dec (\d{1,2}) – (\d{1,2})$/.exec(s.trim());
  if (!m || !m[1] || !m[2]) throw new Error(`Unparseable legacy hotel dates: "${s}"`);
  return [`2026-12-${pad2(Number(m[1]))}`, `2026-12-${pad2(Number(m[2]))}`];
}

function dayPlan(date: string, d: LegacyDay): DayPlan {
  return {
    id: `cn26-day-${date}`,
    tripId: TRIP_ID,
    date,
    title: md(d.title),
    ...splitBed(d.bed),
    planItems: d.plan.map(md),
    ...(d.run ? { runbookId: `cn26-run-${d.run}` } : {}),
  };
}


/* The map-button decision from map-links.ts, flattened onto the entity.
   'name' ships the query, 'url' ships the share link, 'coord' ships neither —
   the coordinate already on the entity is then the only thing left to open.

   The ADDRESS rides along with a name or a saved link, never on its own: an
   address only ever exists here because a name PASSED verification and OSM
   handed its address back with the answer. A demoted entry (via 'coord') has
   no address by construction, and shipping one would silently turn its
   coordinate pin back into a search — the exact thing the demotion prevented. */
function mapFields(plan: MapPlan | undefined): { mapQuery?: string; mapCity?: string; mapUrl?: string; address?: string } {
  if (!plan) return {};
  const addr = plan.address ? { address: plan.address } : {};
  if (plan.via === 'url') return plan.url ? { mapUrl: plan.url, ...addr } : {};
  if (plan.via === 'name' && plan.query) {
    return { mapQuery: plan.query, ...(plan.city ? { mapCity: plan.city } : {}), ...addr };
  }
  return {};
}

/** IATA → the driver card that already carries a verified airport name, so a
    flight borrows the card's own decision instead of inventing a second one.
    The three airports with no card (TLV, AUH, HKG) fall through to
    AIRPORT_MAPS. Ids are the stable `cn26-place-NN` the transform assigns. */
export const AIRPORT_CARDS: Record<string, string> = {
  PKX: 'cn26-place-01',
  PEK: 'cn26-place-02',
  DYG: 'cn26-place-09',
  CKG: 'cn26-place-12',
  LJG: 'cn26-place-15',
  KMG: 'cn26-place-20',
};

/** A flight opens the airport it LEAVES from — the one you have to get to.
    Resolved here, at build time, so the app never cross-looks-up anything. */
function airportFields(iata: string): { coord?: Coord; mapQuery?: string; mapCity?: string; mapUrl?: string } {
  const card = AIRPORT_CARDS[iata];
  const plan = card ? PLACE_MAPS[card] : AIRPORT_MAPS[iata];
  const coord = card ? PLACE_COORDS[card] : AIRPORT_COORDS[iata];
  return { ...(coord ? { coord } : {}), ...mapFields(plan) };
}

/** The verified spots of one stop. `via: 'none'` entries stay in the manifest
    with their reasoning but never reach the app: every spot it shows opens. */
function spotsFor(key: string): Spot[] {
  return (SPOTS[key] ?? [])
    .filter((s) => s.via === 'name')
    .map((s) => ({
      id: `cn26-spot-${key}-${s.id}`,
      name: s.name,
      ...(s.native ? { native: s.native } : {}),
      kind: s.kind,
      mapQuery: s.query,
      ...(s.city ? { mapCity: s.city } : {}),
      ...(s.address ? { address: s.address } : {}),
      ...(s.addressInSearch ? { addressInSearch: true } : {}),
    }));
}

export interface ChinaSeedInput {
  legacy: LegacyData;
  /** The flights-manifest PDF from sources/, embedded into the documents vault. */
  flightsPdf: { base64: string; size: number };
  /** Curated place photos (images/<key>.webp), embedded like the PDF. */
  photos?: { key: string; base64: string; size: number }[];
  /** Read-more texts (md-lite) keyed by legacy stop id. */
  extras?: Record<string, string>;
  /** "All the options" blocks keyed by legacy stop id. */
  options?: Record<string, OptionBlockInput[]>;
}

export function buildChinaBundle({
  legacy,
  flightsPdf,
  photos = [],
  extras = {},
  options = {},
}: ChinaSeedInput): TripBundle {
  const L = legacy;
  const photoKeys = new Set(photos.map((p) => p.key));

  const trip: Trip = {
    id: TRIP_ID,
    title: 'China 2026',
    subtitle: 'Kung fu, powder & the south', // guide hero title
    emoji: '🇨🇳',
    start: L.trip.start,
    end: L.trip.end,
    homeCurrency: 'USD',
    currencies: Object.keys(L.rates).map((code) => ({
      code,
      symbol: L.syms[code] ?? code,
      rateToHome: L.rates[code] ?? 1,
    })),
    accentHue: 8, // vermilion — the one China-specific thing that survives, as this trip's accent
    ...(photoKeys.has(COVER_STOP_KEY) ? { coverDocId: `cn26-photo-${COVER_STOP_KEY}` } : {}),
    clocks: [
      { label: 'China', timeZone: 'Asia/Shanghai', flag: '🇨🇳' },
      { label: 'Tel Aviv', timeZone: 'Asia/Jerusalem', flag: '🇮🇱' },
      { label: 'Abu Dhabi', timeZone: 'Asia/Dubai', flag: '🇦🇪' },
    ],
    budgetTotalMinor: L.totalPlan * 100,
    driverSuffix: { native: '请带我去这里', meaning: 'Please take me here' },
    archived: false,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  };

  const counters: ComplianceCounter[] = [
    {
      id: 'cn26-counter-visa',
      tripId: TRIP_ID,
      name: 'Mainland visa',
      icon: '🛂',
      startDate: L.trip.entry,
      countStartsDayAfter: true, // embassy-verified: the count starts the day AFTER entry
      limitDays: 30,
      hardDeadline: L.trip.visaDeadline,
      plannedEndDate: L.trip.exit,
      note: 'French 30-day visa-free, policy valid through Dec 31 2026. Hong Kong is separate and does not count. Planned Dec 21 exit = day 29, a one-day buffer.',
      pinned: true,
    },
  ];

  const stops: Stop[] = L.stops.map((s, i) => ({
    id: `cn26-stop-${s.id}`,
    tripId: TRIP_ID,
    kind: s.id === 'flights' ? 'transit' : 'stop',
    name: md(s.name),
    emoji: s.em,
    hue: s.h,
    start: s.start,
    end: s.end,
    nights: s.nights,
    whenLabel: md(s.when),
    ...(s.cost ? { costNote: md(s.cost) } : {}),
    ...(s.warn ? { warn: md(s.warn) } : {}),
    ...(photoKeys.has(s.id) ? { photoDocId: `cn26-photo-${s.id}` } : {}),
    ...(extras[s.id] ? { detail: extras[s.id] } : {}),
    ...(STOP_COORDS[s.id] ? { coord: STOP_COORDS[s.id] } : {}),
    ...mapFields(STOP_MAPS[s.id]),
    blocks: blocks(`cn26-stop-${s.id}`, 'b', s.blocks),
    recoBlocks: s.reco ? blocks(`cn26-stop-${s.id}`, 'r', s.reco) : [],
    ...(spotsFor(s.id).length ? { spots: spotsFor(s.id) } : {}),
    ...(options[s.id]?.length
      ? {
          options: (options[s.id] ?? []).map((b, bi) => ({
            id: `cn26-stop-${s.id}-o${bi}`,
            heading: b.heading,
            items: b.items,
          })),
        }
      : {}),
    order: i,
  }));

  const dayPlans: DayPlan[] = Object.keys(L.days)
    .sort()
    .map((date) => {
      const d = L.days[date];
      if (!d) throw new Error(`missing day ${date}`);
      return dayPlan(date, d);
    });

  const kunyuStopId = 'cn26-stop-kunyu';
  const dayDefaults: DayDefault[] = [
    {
      id: 'cn26-daydef-kunyu-week',
      tripId: TRIP_ID,
      stopId: kunyuStopId,
      weekdays: [1, 2, 3, 4, 5, 6],
      title: md(L.kunyuDefault.title),
      ...splitBed(L.kunyuDefault.bed),
      planItems: L.kunyuDefault.plan.map(md),
    },
    {
      id: 'cn26-daydef-kunyu-sunday',
      tripId: TRIP_ID,
      stopId: kunyuStopId,
      weekdays: [0],
      title: md(L.kunyuSunday.title),
      ...splitBed(L.kunyuSunday.bed),
      planItems: L.kunyuSunday.plan.map(md),
    },
  ];

  const runbooks: Runbook[] = Object.keys(L.runbooks)
    .sort()
    .map((key) => {
      const r = L.runbooks[key];
      if (!r) throw new Error(`missing runbook ${key}`);
      return {
        id: `cn26-run-${key}`,
        tripId: TRIP_ID,
        title: md(r.t),
        severity: key === 'exit' || key === 'dec11' ? 'crit' : 'warn', // matches legacy card styling
        steps: r.s.map(md),
      };
    });

  const flights: FlightBooking[] = L.bookings.map((b) => ({
    id: `cn26-flight-${b.id}`,
    tripId: TRIP_ID,
    kind: 'flight',
    status: 'booked',
    title: `${b.carrier} · ${b.fno}`,
    groupLabel: md(b.group),
    date: b.date,
    code: b.code,
    codeLabel: b.codeLabel,
    ...(b.sub ? { codeSub: b.sub } : {}),
    gmailQuery: b.gmail,
    ...(b.manage ? { manageUrl: b.manage } : {}),
    meta: b.meta.map(([k, v, warn]) => ({ k, v, ...(warn ? { warn: true } : {}) })),
    ...(b.note ? { note: md(b.note) } : {}),
    ...(b.alert ? { alert: true } : {}),
    carrier: b.carrier,
    flightNo: b.fno,
    from: { code: b.from, name: b.fromName },
    to: { code: b.to, name: b.toName },
    dep: b.dep,
    arr: b.arr,
    arrDayOffset: (b.plus ?? 0) as 0 | 1 | 2,
    duration: b.dur,
    aircraft: b.ac,
    ...(FLIGHT_FARES[b.fno] ? { priceNote: FLIGHT_FARES[b.fno] } : {}),
    ...airportFields(b.from),
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  }));

  const stays: HotelBooking[] = L.hotels.map((h, i) => {
    const [checkIn, checkOut] = parseLegacyStayDates(h.dates);
    return {
      id: `cn26-stay-${pad2(i)}`,
      tripId: TRIP_ID,
      kind: 'hotel',
      status: h.walkin ? 'walkin' : h.pending ? 'pending' : 'booked',
      title: md(h.name),
      date: checkIn,
      city: h.city,
      checkIn,
      checkOut,
      priceNote: h.price,
      ...(h.link ? { bookingLinkUrl: h.link } : {}),
      gmailQuery: h.name,
      ...mapFields(STAY_MAPS[`cn26-stay-${pad2(i)}`]),
      meta: [],
      ...(h.note ? { note: md(h.note) } : {}),
      createdAt: SEED_TS,
      updatedAt: SEED_TS,
    };
  });

  const bookings: Booking[] = [...flights, ...stays];

  const walletCards: WalletCard[] = L.docs.map((d, i) => ({
    id: `cn26-card-${d.id}`,
    tripId: TRIP_ID,
    emoji: d.icon,
    title: md(d.title),
    code: d.code,
    codeLabel: d.codeLabel,
    rows: d.rows.map(([k, v]) => ({ k, v })),
    ...(d.balance != null ? { balance: { amountMinor: Math.round(d.balance * 100), currency: 'USD' } } : {}),
    ...(d.gmail ? { gmailQuery: d.gmail } : {}),
    ...(d.note ? { note: md(d.note) } : {}),
    pending: !!d.pending,
    order: i,
  }));

  const tasks: Task[] = L.tasks.map((t, i) => ({
    id: `cn26-task-${t.k}`,
    tripId: TRIP_ID,
    title: md(t.t),
    ...(t.d ? { detail: md(t.d) } : {}),
    due: t.due,
    dueLabel: t.dueLabel,
    priority: t.pri,
    ...(t.link ? { link: t.link } : {}),
    done: false,
    order: i,
  }));

  const alarms: Alarm[] = L.alarms.map((a, i) => ({
    id: `cn26-alarm-${pad2(i)}`, // index-stable: legacy ticks are keyed alarm-<i>
    tripId: TRIP_ID,
    date: a.d,
    time: a.tm,
    title: md(a.t),
    why: md(a.why),
    done: false,
  }));

  const packingItems: PackingItem[] = L.packing.flatMap((g, gi) =>
    g.items.map(([id, label], ii) => ({
      id: `cn26-pack-${id}`, // legacy ticks are keyed pk-<id>
      tripId: TRIP_ID,
      group: md(g.h),
      label: md(label),
      done: false,
      order: gi * 100 + ii,
    })),
  );

  const checklists: Checklist[] = [
    {
      id: 'cn26-check-apps',
      tripId: TRIP_ID,
      title: 'Before you fly',
      note: 'All of this must work BEFORE landing.',
      items: L.apps.map(([id, label]) => ({
        id: `cn26-app-${id}`, // legacy ticks are keyed app-<id>
        label: md(label),
        done: false,
      })),
      order: 0,
    },
  ];

  const categories: ExpenseCategory[] = Object.keys(L.cats).map((key, i) => {
    const c = L.cats[key];
    if (!c) throw new Error(`missing category ${key}`);
    return {
      id: `cn26-cat-${key}`,
      tripId: TRIP_ID,
      label: c.label,
      planMinor: c.plan * 100,
      color: c.dot,
      order: i,
      legacyKey: key,
    };
  });

  /* Money that has already left the account before departure, so the spending
     tracker tells the truth from day one instead of showing $0. Only what the
     documents state as PAID: the guide's key-date line "ALL FLIGHTS BOOKED
     (~$2,790) — Etihad Deluxe open-jaw (~$2,026) + 3 internal: CA1953 ($241)
     · Sichuan ($230) · China Eastern Business ($293)", and the Kunyu deposit
     ($100, from its costs block; its wallet card reads "deposit paid").
     Every bed is still `pending`, so no stay is counted here.
     Dated the day the documents were verified, which keeps them out of the
     daily-burn bars — they are not spending that happens on the trip. */
  const prepaid: [key: string, cat: string, minor: number, desc: string][] = [
    ['etihad', 'flights', 202600, 'Etihad open-jaw · TLV→Beijing, Hong Kong→TLV (≈, paid)'],
    ['ca1953', 'transport', 24100, 'Air China CA1953 · Beijing → Zhangjiajie'],
    ['3u8011', 'transport', 23000, 'Sichuan 3U8011 · Chongqing → Lijiang'],
    ['mu733', 'transport', 29300, 'China Eastern MU733 · Kunming → Hong Kong (Business)'],
    ['kunyu-deposit', 'training', 10000, 'Kunyu Academy · deposit paid'],
  ];
  const expenses: Expense[] = prepaid.map(([key, cat, minor, desc]) => ({
    id: `cn26-exp-prepaid-${key}`,
    tripId: TRIP_ID,
    date: SEED_DATE,
    categoryId: `cn26-cat-${cat}`,
    desc,
    amount: minor / 100,
    currency: 'USD', // trip home currency — no conversion involved
    rateToHome: 1,
    homeMinor: minor,
    payment: 'card',
    refund: false,
    ts: SEED_TS,
  }));

  const showCards: ShowCard[] = [
    ...L.phrases.map((p, i) => ({
      id: `cn26-phrase-${pad2(i)}`,
      tripId: TRIP_ID,
      kind: 'phrase' as const,
      native: p.zh,
      meaning: p.en,
      verify: false,
      pending: false,
      isKey: !!p.key,
      order: i,
    })),
    ...L.places.map((p, i) => ({
      id: `cn26-place-${pad2(i)}`,
      tripId: TRIP_ID,
      kind: 'place' as const,
      native: PLACE_NATIVE_FIXES[`cn26-place-${pad2(i)}`] ?? p.zh,
      meaning: p.en,
      ...(p.note ? { note: md(p.note) } : {}),
      ...(PLACE_COORDS[`cn26-place-${pad2(i)}`] ? { coord: PLACE_COORDS[`cn26-place-${pad2(i)}`] } : {}),
      ...mapFields(PLACE_MAPS[`cn26-place-${pad2(i)}`]),
      verify: !!p.vfy,
      pending: !!p.pend,
      isKey: false,
      order: 100 + i,
    })),
  ];

  const emergency: EmergencyContact[] = L.emergency.map((e, i) => ({
    id: `cn26-emg-${pad2(i)}`,
    tripId: TRIP_ID,
    label: md(e.t),
    value: e.v,
    kind: /^[+0-9][0-9 ]*$/.test(e.v) ? 'phone' : /\.[a-z]{2,}\//i.test(e.v) || /\.(com|cn|org)/i.test(e.v) ? 'url' : 'text',
    verify: !!e.vfy,
    pending: !!e.pend,
    order: i,
  }));

  const infoCards: InfoCard[] = [
    ...L.info.map((g, i) => ({
      id: `cn26-info-${pad2(i)}`,
      tripId: TRIP_ID,
      emoji: g.icon,
      heading: md(g.h),
      items: g.li.map(md),
      severity: g.crit ? ('crit' as const) : ('normal' as const),
      order: i,
    })),
    {
      /* Transcribed from the legacy Tasks tab's dedicated VPN card (renderTasks,
         legacy/index.html ~line 1983) — content lived outside DATA. */
      id: 'cn26-info-vpn',
      tripId: TRIP_ID,
      emoji: '🔒',
      heading: 'The VPN, specifically',
      items: [
        'nordvpn.com is **blocked inside China** — you cannot install or fix it once you land. Before Nov 21: install NordVPN, log in, switch the protocol to **NordWhisper / obfuscated** (the default NordLynx is blocked), favorite a few servers, and confirm it actually connects.',
      ],
      severity: 'crit',
      order: L.info.length,
    },
  ];

  const documents: TripBundle['documents'] = [
    {
      meta: {
        id: 'cn26-doc-flights-pdf',
        tripId: TRIP_ID,
        name: 'Flight manifest — all seats, e-tickets, terminals',
        fileName: 'China-2026-Flights.pdf',
        mime: 'application/pdf',
        size: flightsPdf.size,
        tag: 'ticket',
        addedAt: SEED_TS,
      },
      dataBase64: flightsPdf.base64,
    },
    ...photos.map((p) => ({
      meta: {
        id: `cn26-photo-${p.key}`,
        tripId: TRIP_ID,
        stopId: `cn26-stop-${p.key}`,
        name: `Place photo · ${p.key}`,
        fileName: `${p.key}.webp`,
        mime: 'image/webp',
        size: p.size,
        tag: 'photo' as const,
        addedAt: SEED_TS,
      },
      dataBase64: p.base64,
    })),
  ];

  return {
    trip,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    runbooks,
    bookings,
    walletCards,
    tasks,
    alarms,
    packingItems,
    checklists,
    expenses,
    categories,
    showCards,
    emergency,
    infoCards,
    checkState: [],
    documents,
  };
}

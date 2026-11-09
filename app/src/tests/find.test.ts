/* FIND — searches the phone, no internet. Warnings come first, and the
   "instead" beside a warning is found by exact joins or not at all. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, FlightBooking, ShowCard, TripBundle } from '../lib/model/types';
import { buildIndex, highlight, normalize, scopeOf, search, tokens, type FindInput } from '../lib/logic/find';

const card = (id: string, native: string, meaning: string, extra: Partial<ShowCard> = {}): ShowCard => ({
  id,
  tripId: 't',
  kind: 'place',
  native,
  meaning,
  verify: false,
  pending: false,
  isKey: false,
  order: 0,
  ...extra,
});
const flight = (id: string, flightNo: string, fromCode: string, mapQuery?: string): FlightBooking => ({
  id,
  tripId: 't',
  kind: 'flight',
  status: 'booked',
  title: `Airline · ${flightNo}`,
  date: '2027-03-04',
  carrier: 'Airline',
  flightNo,
  from: { code: fromCode, name: `${fromCode} Intl` },
  to: { code: 'ZZZ', name: 'Zed' },
  dep: '18:15',
  arr: '20:30',
  arrDayOffset: 0,
  meta: [],
  mapQuery,
  createdAt: 0,
  updatedAt: 0,
});
const empty: FindInput = {
  bookings: [],
  showCards: [],
  runbooks: [],
  dayPlans: [],
  stops: [],
  tasks: [],
  infoCards: [],
  emergency: [],
  walletCards: [],
  documents: [],
};

describe('find · matching', () => {
  it('is case- and accent-insensitive, and every word must match', () => {
    const idx = buildIndex({ ...empty, showCards: [card('a', '东站', 'Hôtel Élysée — the East Station')] });
    expect(search(idx, 'hotel').counts.all).toBe(1);
    expect(search(idx, 'ELYSEE east').counts.all).toBe(1);
    expect(search(idx, 'elysee west').counts.all).toBe(0);
  });

  it('matches Chinese as written', () => {
    const idx = buildIndex({ ...empty, showCards: [card('a', '上海浦东国际机场', 'Airport')] });
    expect(search(idx, '浦东').counts.all).toBe(1);
    expect(search(idx, '虹桥').counts.all).toBe(0);
  });

  it('an empty query finds nothing and says nothing', () => {
    const idx = buildIndex({ ...empty, showCards: [card('a', '站', 'Station')] });
    expect(search(idx, '   ')).toMatchObject({ warnings: [], groups: [], counts: { all: 0 } });
  });

  it('finds a booking by its code, its airports and its note', () => {
    const b = { ...flight('f', 'XY 12', 'AAA'), code: '1234567890', note: 'Terminal **2**, gate area C' };
    const idx = buildIndex({ ...empty, bookings: [b] });
    expect(search(idx, '4567').counts.bookings).toBe(1);
    expect(search(idx, 'aaa').counts.bookings).toBe(1);
    expect(search(idx, 'terminal 2').counts.bookings).toBe(1);
    expect(search(idx, 'xy12').counts.bookings).toBe(1);
    expect(search(idx, 'xy 12').counts.bookings).toBe(1);
  });

  /* QA 9 Nov 2026: "3U8011" found nothing where the booking read "3U 8011" */
  it('a flight or train number matches with and without the space, both ways', () => {
    const spaced = buildIndex({ ...empty, bookings: [flight('f', '3U 8011', 'AAA')] });
    expect(search(spaced, '3U8011').counts.bookings).toBe(1);
    expect(search(spaced, '3u 8011').counts.bookings).toBe(1);
    const closed = buildIndex({ ...empty, bookings: [flight('g', 'G1234', 'BBB')] });
    expect(search(closed, 'G 1234').counts.bookings).toBe(1);
    expect(search(closed, 'g1234').counts.bookings).toBe(1);
    expect(search(closed, 'G 1235').counts.bookings).toBe(0);
  });

  it('closing up the space does not glue unrelated words', () => {
    const idx = buildIndex({ ...empty, showCards: [card('a', '站', 'Room 1203, floor 12')] });
    expect(search(idx, 'room1203').counts.all).toBe(0);
    expect(search(idx, 'floor 12').counts.all).toBe(1);
  });
});

describe('find · warnings first', () => {
  const wrong = card('wrong', '西机场', 'West Airport (WWW) — ⚠️ NOT the Monday airport any more: XY12 leaves from East (rebooked)', {
    mapQuery: '西机场',
  });
  const right = card('right', '东机场', 'East Airport (EEE) — Monday departure (XY12)', { mapQuery: '东机场' });
  const f = flight('fx', 'XY 12', 'EEE', '东机场');

  it('puts a warned driver card first, with the place to go instead, by exact joins', () => {
    const idx = buildIndex({ ...empty, showCards: [right, wrong], bookings: [f] });
    const r = search(idx, 'east');
    expect(r.warnings.map((h) => h.entry.key)).toEqual(['place:wrong']);
    expect(r.warnings[0]?.entry.warning).toBe('NOT the Monday airport any more: XY12 leaves from East (rebooked)');
    expect(r.warnings[0]?.entry.instead).toEqual({ bookingId: 'fx', cardId: 'right' });
    /* the right card is still a result, under driver cards — not a warning */
    expect(r.groups.find((g) => g.kind === 'driver')?.hits.map((h) => h.entry.key)).toEqual(['place:right']);
  });

  it('with a link missing, the warning stands alone rather than pointing somewhere plausible', () => {
    /* the flight named is not a booking on this trip */
    const idx = buildIndex({ ...empty, showCards: [right, wrong], bookings: [] });
    expect(search(idx, 'west').warnings[0]?.entry.instead).toBeUndefined();
    /* the booking exists but no card is searched by its departure name */
    const idx2 = buildIndex({ ...empty, showCards: [wrong], bookings: [f] });
    expect(search(idx2, 'west').warnings[0]?.entry.instead).toEqual({ bookingId: 'fx', cardId: null });
  });

  it('never offers a warned card, or a pending one, as the instead', () => {
    const alsoWrong = card('also', '东机场', 'East Airport — ⚠️ closed', { mapQuery: '东机场' });
    const pending = card('pend', '东机场', 'East Airport', { mapQuery: '东机场', pending: true });
    const idx = buildIndex({ ...empty, showCards: [wrong, alsoWrong, pending], bookings: [f] });
    expect(search(idx, 'west').warnings[0]?.entry.instead).toEqual({ bookingId: 'fx', cardId: null });
  });

  it('a critical info card is a warning by its own severity; a normal one is not', () => {
    const idx = buildIndex({
      ...empty,
      infoCards: [
        { id: 'c', tripId: 't', heading: 'Visa rules', items: ['Leave by **day 30**'], severity: 'crit', order: 0 },
        { id: 'n', tripId: 't', heading: 'Visa photos', items: ['Two photos'], severity: 'normal', order: 1 },
      ],
    });
    const r = search(idx, 'visa');
    expect(r.warnings.map((h) => h.entry.key)).toEqual(['info:c']);
    expect(r.groups.find((g) => g.kind === 'info')?.hits.map((h) => h.entry.key)).toEqual(['info:n']);
    expect(search(idx, 'day 30').warnings[0]?.lines).toEqual(['Leave by day 30']);
  });
});

describe('find · steps, scopes and order', () => {
  const input: FindInput = {
    ...empty,
    runbooks: [{ id: 'r', tripId: 't', title: 'Travel day', severity: 'warn', steps: ['Pack', 'Taxi to the **station**', 'Board'] }],
    dayPlans: [
      { id: 'd1', tripId: 't', date: '2027-03-05', title: 'Go', planItems: [], runbookId: 'r' },
      { id: 'd2', tripId: 't', date: '2027-03-09', title: 'Go again', planItems: [], runbookId: 'r' },
    ],
    stops: [
      {
        id: 's',
        tripId: 't',
        kind: 'stop',
        name: 'Station Town',
        hue: 0,
        start: '2027-03-05',
        end: '2027-03-09',
        blocks: [],
        recoBlocks: [],
        order: 0,
        spots: [{ id: 'sp', name: 'Old Station', kind: 'sight', native: '老站' }],
      },
    ],
  };

  it('a step knows its list, its place in it and its days', () => {
    const r = search(buildIndex(input), 'station', 'all', '2027-01-01');
    const step = r.groups.find((g) => g.kind === 'step')?.hits[0]?.entry;
    expect(step?.title).toBe('Taxi to the station');
    expect(step?.step).toEqual({ runbookTitle: 'Travel day', index: 1, total: 3, dates: ['2027-03-05', '2027-03-09'] });
  });

  it("today's steps lead, under their own heading", () => {
    const r = search(buildIndex(input), 'station', 'all', '2027-03-09');
    expect(r.groups[0]?.kind).toBe('today-steps');
  });

  it('counts every scope whatever scope is shown, and shows only the one asked for', () => {
    const r = search(buildIndex(input), 'station', 'places', '2027-01-01');
    expect(r.counts).toMatchObject({ all: 3, steps: 1, places: 2 });
    expect(r.groups.map((g) => g.kind)).toEqual(['stop', 'spot']);
  });

  it('files each kind under its chip', () => {
    expect(scopeOf('booking')).toBe('bookings');
    expect(scopeOf('driver')).toBe('cards');
    expect(scopeOf('phrase')).toBe('cards');
    expect(scopeOf('card')).toBe('cards');
    expect(scopeOf('step')).toBe('steps');
    expect(scopeOf('spot')).toBe('places');
    expect(scopeOf('task')).toBe('more');
  });
});

describe('find · highlighting', () => {
  it('marks every typed word, and keeps the text exactly as written', () => {
    const segs = highlight('Shanghai Pudong (PVG)', 'pudong pvg');
    expect(segs).toEqual([
      { t: 'Shanghai ', hit: false },
      { t: 'Pudong', hit: true },
      { t: ' (', hit: false },
      { t: 'PVG', hit: true },
      { t: ')', hit: false },
    ]);
    expect(segs.map((s) => s.t).join('')).toBe('Shanghai Pudong (PVG)');
  });

  it('lights an accented word for an unaccented query, accent intact', () => {
    expect(highlight('Hôtel', 'hotel')).toEqual([{ t: 'Hôtel', hit: true }]);
  });

  it('marks Chinese inside a longer name', () => {
    expect(highlight('上海浦东国际机场', '浦东')).toEqual([
      { t: '上海', hit: false },
      { t: '浦东', hit: true },
      { t: '国际机场', hit: false },
    ]);
  });

  it('merges overlapping matches and leaves unmatched text alone', () => {
    expect(highlight('station', 'stat tion')).toEqual([{ t: 'station', hit: true }]);
    expect(highlight('nothing here', 'xyz')).toEqual([{ t: 'nothing here', hit: false }]);
    /* a code typed closed up lights the spaced one */
    expect(highlight('Airline · 3U 8011', '3u8011')).toEqual([
      { t: 'Airline · ', hit: false },
      { t: '3U 8011', hit: true },
    ]);
  });

  it('normalises the way both sides are compared', () => {
    expect(normalize('  Élan   VITAL ')).toBe('elan vital');
    expect(tokens(' a  B ')).toEqual(['a', 'b']);
  });
});

/* ---------- the demo trip: the board's own case ---------- */
/* The airport trap, on a whole trip. The demo's Apr 4 flight leaves from
   Shanghai HONGQIAO on MU 5001; the first plan, MU 5003 from Pudong, is
   cancelled but still a booking record. No driver card warns about an
   airport (the trap lives in the bookings, the runbook and a normal info
   card), so Find must raise no airport warning — the warning mechanism
   itself stays proved on the synthetic cards above. */
describe('find · demo trip, Apr 4 from Hongqiao (f-find)', () => {
  const seed = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup;
  const b = seed.trips[0] as TripBundle;
  const idx = buildIndex({
    bookings: b.bookings,
    showCards: b.showCards,
    runbooks: b.runbooks,
    dayPlans: b.dayPlans,
    stops: b.stops,
    tasks: b.tasks,
    infoCards: b.infoCards,
    emergency: b.emergency,
    walletCards: b.walletCards,
    documents: b.documents.map((d) => d.meta),
    note: b.note ?? null,
  });

  it('"hongqiao": the MU 5001 booking, and today’s step that gets you there', () => {
    const r = search(idx, 'hongqiao', 'all', '2027-04-04');
    expect(r.warnings).toEqual([]);
    expect(r.groups.find((g) => g.kind === 'booking')?.hits.some((h) => h.entry.key === 'booking:dm27-flight-mu5001')).toBe(true);
    expect(r.groups.find((g) => g.kind === 'today-steps')?.hits.some((h) => /Hongqiao/.test(h.entry.title))).toBe(true);
  });

  it('"pudong", "pvg" and "浦东" raise no airport warning — and the cancelled MU 5003 is still found', () => {
    for (const q of ['pudong', 'pvg', '浦东']) {
      expect(search(idx, q, 'all', '2027-04-04').warnings.filter((h) => h.entry.key.startsWith('place:')), q).toEqual([]);
    }
    const r = search(idx, 'pudong', 'all', '2027-04-04');
    /* cancelled, but still a booking record, so still a booking you can find */
    expect(r.groups.find((g) => g.kind === 'booking')?.hits.some((h) => h.entry.key === 'booking:dm27-flight-mu5003')).toBe(true);
    expect(r.groups.find((g) => g.kind === 'driver')?.hits.some((h) => h.entry.key === 'place:dm27-place-01')).toBe(true);
  });
});

/* QA, 7 Nov 2026: a plan line ("Winter Wonderland Wednesday") was in no field
   Find searched. Every day's own plan is indexed; a hit opens that day. */
describe('find · inside the days’ plans', () => {
  const day = (date: string, title: string, planItems: string[]) => ({ id: `d-${date}`, tripId: 't', date, title, planItems });
  const index = buildIndex({
    bookings: [],
    showCards: [],
    runbooks: [],
    stops: [],
    tasks: [],
    infoCards: [],
    emergency: [],
    walletCards: [],
    documents: [],
    dayPlans: [
      day('2027-04-13', 'Ridge walk + the races', ['Ridge walk → the bay', '✅ **It IS a race night** — billed as **"Winter Wonderland Wednesday"**']),
      day('2027-04-14', 'Old town', ['Slow morning, the market']),
    ],
  });
  it('finds a word in a plan line, shows the line, and opens the day', () => {
    const r = search(index, 'winter wonderland');
    const g = r.groups.find((x) => x.kind === 'day');
    expect(g?.hits.map((h) => h.entry.title)).toEqual(['Ridge walk + the races']);
    expect(g?.hits[0]?.lines).toEqual(['✅ It IS a race night — billed as "Winter Wonderland Wednesday"']);
    expect(g?.hits[0]?.entry.ref).toEqual({ to: 'day', date: '2027-04-13' });
    expect(r.counts.steps).toBe(1);
  });
  it('a day’s own title is searched too', () => {
    expect(search(index, 'old town').groups.find((x) => x.kind === 'day')?.hits.map((h) => h.entry.ref)).toEqual([{ to: 'day', date: '2027-04-14' }]);
  });
});

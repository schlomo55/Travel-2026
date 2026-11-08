/* The offline converter, the health section, and the two-clock derivation
   (Lantern Run C, C2). All three are proved against the demo seed (a made-up
   but fully-populated China + Hong Kong trip) as well as against synthetic
   cases: a selector that matches nothing on the rich trip that ships is a
   selector that does not work. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  convert,
  findRate,
  fmtAmount,
  isRateEdits,
  newestExpenseRate,
  parseRateInput,
  rateLine,
  rateSources,
} from '../lib/logic/convert';
import { buildHealth, hasHealth, needsOfflineDoc } from '../lib/logic/health';
import {
  arrivalInOriginTime,
  crossesZone,
  fmtShift,
  hhmmToMinutes,
  minutesToHhmm,
  parseDurationMinutes,
  zoneShiftMinutes,
} from '../lib/logic/zones';
import type { FlightBooking, TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json');
const bundle = (JSON.parse(readFileSync(seedPath, 'utf8')) as { trips: TripBundle[] }).trips[0]!;
const trip = bundle.trip;

/* ---------- the converter ---------- */

describe('rate provenance', () => {
  it('falls back to the trip’s own rate, undated', () => {
    const s = findRate(rateSources(trip, [], {}), 'CNY');
    expect(s?.origin).toBe('trip');
    expect(s?.rateToHome).toBe(7.15);
    /* A date that is not known is NOT printed. */
    expect(s?.asOf).toBeNull();
  });

  it('prefers the newest real expense, and carries its date', () => {
    const expenses = [
      { currency: 'CNY', rateToHome: 7.2, date: '2027-03-25' },
      { currency: 'CNY', rateToHome: 7.05, date: '2027-04-02' },
      { currency: 'EUR', rateToHome: 0.9, date: '2027-04-05' },
    ];
    const s = findRate(rateSources(trip, expenses, {}), 'CNY');
    expect(s?.origin).toBe('expense');
    expect(s?.rateToHome).toBe(7.05);
    expect(s?.asOf).toBe('2027-04-02');
  });

  it('the traveller’s own rate beats everything', () => {
    const expenses = [{ currency: 'CNY', rateToHome: 7.05, date: '2027-04-02' }];
    const edits = { CNY: { rateToHome: 6.9, setAt: '2027-04-06' } };
    const s = findRate(rateSources(trip, expenses, edits), 'CNY');
    expect(s?.origin).toBe('edited');
    expect(s?.rateToHome).toBe(6.9);
    expect(s?.asOf).toBe('2027-04-06');
  });

  it('ignores a nonsense stored rate rather than dividing by it', () => {
    const s = findRate(rateSources(trip, [], { CNY: { rateToHome: 0, setAt: '2027-04-06' } }), 'CNY');
    expect(s?.origin).toBe('trip');
  });

  it('offers every currency the trip carries, and no others', () => {
    const codes = rateSources(trip, [], {}).map((s) => s.code);
    expect(codes).toEqual(['USD', 'CNY', 'HKD', 'MOP', 'EUR']);
    expect(findRate(rateSources(trip, [], {}), 'JPY')).toBeNull();
  });

  it('ignores expenses in other currencies and zero rates', () => {
    expect(newestExpenseRate([{ currency: 'EUR', rateToHome: 0.9, date: '2027-04-01' }], 'CNY')).toBeNull();
    expect(newestExpenseRate([{ currency: 'CNY', rateToHome: 0, date: '2027-04-01' }], 'CNY')).toBeNull();
  });

  it('validates what came out of the database', () => {
    expect(isRateEdits({ CNY: { rateToHome: 7, setAt: '2027-04-01' } })).toBe(true);
    expect(isRateEdits({ CNY: { rateToHome: '7', setAt: '2027-04-01' } })).toBe(false);
    expect(isRateEdits('nope')).toBe(false);
    expect(isRateEdits(null)).toBe(false);
  });
});

describe('conversion', () => {
  const s = rateSources(trip, [], {});
  const usd = findRate(s, 'USD');
  const cny = findRate(s, 'CNY');
  const eur = findRate(s, 'EUR');

  it('converts through the home currency', () => {
    expect(convert(100, usd, cny)).toBeCloseTo(715, 6);
    expect(convert(715, cny, usd)).toBeCloseTo(100, 6);
    /* CNY → EUR, neither of them home: 715 CNY = 100 USD = 92 EUR */
    expect(convert(715, cny, eur)).toBeCloseTo(92, 6);
  });

  it('round-trips', () => {
    expect(convert(convert(42, cny, eur) ?? 0, eur, cny)).toBeCloseTo(42, 6);
  });

  it('returns null rather than printing a price it cannot know', () => {
    expect(convert(100, null, cny)).toBeNull();
    expect(convert(100, usd, null)).toBeNull();
    expect(convert(Number.NaN, usd, cny)).toBeNull();
    expect(fmtAmount(null)).toBe('—');
  });

  it('states the rate as a sentence', () => {
    expect(rateLine(usd, cny)).toBe('1 USD = 7.15 CNY');
    expect(rateLine(usd, null)).toBeNull();
  });

  it('reads what a thumb actually types', () => {
    expect(parseRateInput('7,15')).toBe(7.15);
    expect(parseRateInput(' ¥7.15 ')).toBe(7.15);
    expect(parseRateInput('abc')).toBeNull();
    expect(parseRateInput('-3')).toBe(3); // the minus is stripped, not honoured
    expect(parseRateInput('0')).toBeNull();
  });

  it('shows more precision for small numbers than for large ones', () => {
    expect(fmtAmount(1234.5)).toBe('1,235');
    expect(fmtAmount(12.345)).toBe('12.35');
    expect(fmtAmount(0.1399)).toBe('0.1399');
  });
});

/* ---------- health & insurance ---------- */

describe('health section, against the demo trip', () => {
  const h = buildHealth({
    walletCards: bundle.walletCards,
    emergency: bundle.emergency,
    infoCards: bundle.infoCards,
    documents: bundle.documents.map((d) => d.meta),
  });

  it('finds the policy the trip actually carries', () => {
    expect(h.policies.length).toBeGreaterThan(0);
    expect(h.policies.some((p) => /insurance/i.test(p.title))).toBe(true);
  });

  it('finds the 24-hour assistance line', () => {
    /* "Sample insurer · 24h assistance" — named by the insurer, not the word
       "insurance", which the selector must still recognise. */
    expect(h.assistance.length).toBeGreaterThan(0);
    expect(h.assistance.every((c) => /insur/i.test(c.label))).toBe(true);
  });

  it('finds police, ambulance and fire — and does not double-count the insurer', () => {
    const labels = h.local.map((c) => c.label.toLowerCase());
    expect(labels.some((l) => l.includes('police'))).toBe(true);
    expect(labels.some((l) => l.includes('ambulance'))).toBe(true);
    expect(labels.some((l) => l.includes('fire'))).toBe(true);
    expect(labels.some((l) => l.includes('insur'))).toBe(false);
  });

  it('finds the trip’s own medicine note — and invents none', () => {
    /* The demo trip carries no medicine card, so the section shows none. */
    expect(h.medicine).toEqual([]);
    /* A trip that does carry one gets it, the trip's own words untouched. */
    const note = { ...bundle.infoCards[0]!, id: 'dm27-info-meds', heading: '💊 Medicine — carry the prescription', items: ['Keep pills in their boxes'] };
    const withNote = buildHealth({ walletCards: [], emergency: [], infoCards: [...bundle.infoCards, note], documents: [] });
    expect(withNote.medicine.map((c) => c.id)).toEqual(['dm27-info-meds']);
    expect(withNote.medicine[0]?.items.length).toBeGreaterThan(0);
  });

  it('renders at all for this trip', () => {
    expect(hasHealth(h)).toBe(true);
  });

  /* The one thing this section exists to prevent. */
  it('nudges for an offline copy when there is a policy and no file', () => {
    expect(needsOfflineDoc(h)).toBe(h.docs.length === 0);
  });
});

describe('health section, on a trip that carries none of it', () => {
  const empty = buildHealth({ walletCards: [], emergency: [], infoCards: [], documents: [] });

  it('renders nothing rather than an empty promise', () => {
    expect(hasHealth(empty)).toBe(false);
  });

  it('does not nudge about a policy that does not exist', () => {
    expect(needsOfflineDoc(empty)).toBe(false);
  });
});

/* ---------- two clocks ---------- */

describe('timezone derivation', () => {
  it('parses and prints wall times', () => {
    expect(hhmmToMinutes('08:45')).toBe(525);
    expect(hhmmToMinutes('24:00')).toBeNull();
    expect(hhmmToMinutes(undefined)).toBeNull();
    expect(minutesToHhmm(525)).toBe('08:45');
    expect(minutesToHhmm(-135)).toBe('21:45'); // wraps backwards over midnight
  });

  it('parses the airline’s own flying time', () => {
    expect(parseDurationMinutes('3h 15m')).toBe(195);
    expect(parseDurationMinutes('7h 25m')).toBe(445);
    expect(parseDurationMinutes('2h')).toBe(120);
    /* An APPROXIMATE figure cannot carry a timezone claim. */
    expect(parseDurationMinutes('~2 h')).toBeNull();
    expect(parseDurationMinutes(undefined)).toBeNull();
  });

  it('derives the real offsets on the four Finnair legs', () => {
    const flights = bundle.bookings.filter((b): b is FlightBooking => b.kind === 'flight');
    const byNo = (no: string): FlightBooking => flights.find((f) => f.flightNo === no)!;

    // Paris → Helsinki, 11:05 → 15:20 in 3h 15m: +1 h
    expect(zoneShiftMinutes(byNo('AY 1501'))).toBe(60);
    // Helsinki → Shanghai, 17:30 → 08:50 next day in 9h 20m: +6 h
    expect(zoneShiftMinutes(byNo('AY 9057'))).toBe(360);
    /* The way home is after the EU clocks change: Helsinki is UTC+3, Paris +2. */
    // Hong Kong → Helsinki, 23:55 → 06:05 next day in 11h 10m: −5 h
    expect(zoneShiftMinutes(byNo('AY 9070'))).toBe(-300);
    // Helsinki → Paris, 08:00 → 09:40 in 2h 40m: −1 h
    expect(zoneShiftMinutes(byNo('AY 1506'))).toBe(-60);
  });

  it('stays silent on every leg inside China and on to Hong Kong — one zone', () => {
    const flights = bundle.bookings.filter((b): b is FlightBooking => b.kind === 'flight');
    const domestic = flights.filter((f) => !/Finnair/i.test(f.carrier));
    expect(domestic.length).toBe(5); // MU 5001, MU 5003 (cancelled), 3U 9001, 3U 9003, CZ 9005
    for (const f of domestic) expect(crossesZone(f)).toBe(false);
  });

  it('says what the arrival is on the clock you left', () => {
    const flights = bundle.bookings.filter((b): b is FlightBooking => b.kind === 'flight');
    const ay9057 = flights.find((f) => f.flightNo === 'AY 9057')!;
    /* Lands 08:50 in Shanghai; the body, still on Helsinki time, calls it 02:50. */
    expect(ay9057.arr).toBe('08:50');
    expect(arrivalInOriginTime(ay9057)).toBe('02:50');
  });

  it('refuses to guess when the data cannot prove it', () => {
    expect(zoneShiftMinutes({ dep: '10:00', arr: '12:00' })).toBeNull(); // no duration
    expect(zoneShiftMinutes({ dep: '10:00', arr: '12:00', duration: '~2 h' })).toBeNull();
    expect(zoneShiftMinutes({ arr: '12:00', duration: '2h' })).toBeNull(); // no departure
    /* Twenty minutes is rounding noise, not a timezone. */
    expect(zoneShiftMinutes({ dep: '10:00', arr: '12:20', duration: '2h' })).toBeNull();
    /* Nor is anything that is not a whole quarter-hour. */
    expect(zoneShiftMinutes({ dep: '10:00', arr: '12:50', duration: '2h' })).toBeNull();
  });

  it('formats a signed offset', () => {
    expect(fmtShift(240)).toBe('+4 h');
    expect(fmtShift(-120)).toBe('−2 h');
    expect(fmtShift(330)).toBe('+5 h 30');
    expect(fmtShift(null)).toBeNull();
  });
});

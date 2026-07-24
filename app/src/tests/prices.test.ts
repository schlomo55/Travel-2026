import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SYMBOLS,
  fmtRange,
  parseBookedNote,
  parsePrice,
  priceRange,
  splitCostRows,
  sumRanges,
  tripSymbols,
} from '../lib/logic/prices';

/* Every string in these tests is a real one from the China 2026 seed, or a
   deliberate near-miss that must NOT parse. */

describe('parsePrice — the forms the trip actually uses', () => {
  it('reads an approximate flat price', () => {
    expect(parsePrice('~$376')).toEqual({ minMinor: 37600, maxMinor: 37600, currency: 'USD', perNight: false });
    expect(parsePrice('~$236')?.minMinor).toBe(23600);
    expect(parsePrice('~$200')?.minMinor).toBe(20000);
    expect(parsePrice('~$50')?.minMinor).toBe(5000);
    expect(parsePrice('~$35')?.minMinor).toBe(3500);
    expect(parsePrice('~$20')?.minMinor).toBe(2000);
    expect(parsePrice('~$40')?.minMinor).toBe(4000);
  });

  it('reads the ≈ marker the guide prefers', () => {
    expect(parsePrice('≈$120')).toEqual({ minMinor: 12000, maxMinor: 12000, currency: 'USD', perNight: false });
  });

  it('reads a plain price with no marker at all', () => {
    expect(parsePrice('$40')?.maxMinor).toBe(4000);
    expect(parsePrice('$241')?.maxMinor).toBe(24100);
    expect(parsePrice('$293')?.minMinor).toBe(29300);
  });

  it('reads a per-night range with an en dash', () => {
    expect(parsePrice('$17–40/n')).toEqual({ minMinor: 1700, maxMinor: 4000, currency: 'USD', perNight: true });
    expect(parsePrice('$20–30/n')).toEqual({ minMinor: 2000, maxMinor: 3000, currency: 'USD', perNight: true });
  });

  it('reads the same range with a plain hyphen or an em dash', () => {
    expect(parsePrice('$17-40/n')).toEqual({ minMinor: 1700, maxMinor: 4000, currency: 'USD', perNight: true });
    expect(parsePrice('$17—40/n')?.maxMinor).toBe(4000);
  });

  it('reads a range with no unit as a flat range', () => {
    expect(parsePrice('$20–30')).toEqual({ minMinor: 2000, maxMinor: 3000, currency: 'USD', perNight: false });
  });

  it('reads a total that states the nights it covers', () => {
    expect(parsePrice('$550–950 (5n)')).toEqual({
      minMinor: 55000,
      maxMinor: 95000,
      currency: 'USD',
      perNight: false,
      nights: 5,
    });
    expect(parsePrice('$550–950 (5 nights)')?.nights).toBe(5);
  });

  it('reads thousands separators', () => {
    expect(parsePrice('~$2,026')?.minMinor).toBe(202600);
    expect(parsePrice('≈$1,050')?.minMinor).toBe(105000);
    expect(parsePrice('$1,234.50')?.minMinor).toBe(123450);
  });

  it('reads the spelled-out and repeated-symbol variants', () => {
    expect(parsePrice('$20 – $30')).toEqual({ minMinor: 2000, maxMinor: 3000, currency: 'USD', perNight: false });
    expect(parsePrice('$100/night')?.perNight).toBe(true);
    expect(parsePrice('$100 per night')?.perNight).toBe(true);
    expect(parsePrice('$30/nt')?.perNight).toBe(true);
    /* a per-day rate on a bed is a per-night rate */
    expect(parsePrice('$30/day')?.perNight).toBe(true);
    expect(parsePrice('about $30')?.minMinor).toBe(3000);
  });

  it('puts a backwards range the right way round', () => {
    expect(parsePrice('$40–20')).toMatchObject({ minMinor: 2000, maxMinor: 4000 });
  });

  it('knows the other currencies of the trip', () => {
    expect(parsePrice('HK$1,200')).toMatchObject({ currency: 'HKD', minMinor: 120000 });
    expect(parsePrice('¥350')).toMatchObject({ currency: 'CNY', minMinor: 35000 });
    expect(parsePrice('€92')).toMatchObject({ currency: 'EUR' });
    expect(parsePrice('₪340')).toMatchObject({ currency: 'ILS' });
  });

  it('lets the trip decide what a symbol means', () => {
    const trip = { currencies: [{ code: 'JPY', symbol: '¥', rateToHome: 155 }] };
    expect(parsePrice('¥350', tripSymbols(trip))?.currency).toBe('JPY');
    /* the defaults stay available for the symbols the trip does not list */
    expect(parsePrice('$10', tripSymbols(trip))?.currency).toBe('USD');
    expect(DEFAULT_SYMBOLS['¥']).toBe('CNY');
  });
});

describe('parsePrice — what it refuses to guess', () => {
  const nope = [
    '',
    '   ',
    'free',
    'TBD',
    'ask at the desk',
    'included',
    '$',
    '$ per night',
    'about twenty dollars',
    '~$40 or so',
    '$890/mo',
    '5 nights',
    '40',
    'paid in cash',
    'Hotels ~$612 (split)',
    '$890 flat month + $100 deposit',
    'No published 2-week rate ($890/mo or $70/day)',
  ];
  for (const s of nope) {
    it(`returns null for ${JSON.stringify(s)}`, () => {
      expect(parsePrice(s)).toBeNull();
    });
  }
  it('returns null for nothing at all', () => {
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
});

describe('parseBookedNote', () => {
  it('pulls the amount actually paid out of a budget note', () => {
    expect(parseBookedNote('≈$1,050 (booked ~$2,026)')).toMatchObject({ minMinor: 202600, maxMinor: 202600 });
  });
  it('is null when the note carries no booked figure', () => {
    expect(parseBookedNote('≈$930')).toBeNull();
    expect(parseBookedNote('≈$1,050 (estimate)')).toBeNull();
    expect(parseBookedNote(undefined)).toBeNull();
  });
});

describe('priceRange — a quote plus its nights', () => {
  it('multiplies a per-night rate by the nights of the stay', () => {
    const p = parsePrice('$17–40/n');
    expect(p && priceRange(p, 2)).toEqual({ minMinor: 3400, maxMinor: 8000 });
  });
  it('leaves a flat price alone however long the stay is', () => {
    const p = parsePrice('~$376');
    expect(p && priceRange(p, 2)).toEqual({ minMinor: 37600, maxMinor: 37600 });
  });
  it('does not multiply a total that already states its nights', () => {
    const p = parsePrice('$550–950 (5n)');
    expect(p && priceRange(p, 5)).toEqual({ minMinor: 55000, maxMinor: 95000 });
  });
  it('lets a stated night count win over the derived one', () => {
    const p = parsePrice('$100/n (3n)');
    expect(p && priceRange(p, 9)).toEqual({ minMinor: 30000, maxMinor: 30000 });
  });
  it('never multiplies by zero', () => {
    const p = parsePrice('$20/n');
    expect(p && priceRange(p, 0)).toEqual({ minMinor: 2000, maxMinor: 2000 });
  });
});

describe('adding up and printing', () => {
  it('sums both ends of every range', () => {
    expect(
      sumRanges([
        { minMinor: 3400, maxMinor: 8000 },
        { minMinor: 55000, maxMinor: 95000 },
      ]),
    ).toEqual({ minMinor: 58400, maxMinor: 103000 });
    expect(sumRanges([])).toEqual({ minMinor: 0, maxMinor: 0 });
  });

  it('adds up the eleven beds of the China trip exactly', () => {
    const quoted: [string, number][] = [
      ['~$376', 2], ['~$236', 2], ['~$200', 2], ['~$50', 2], ['~$35', 1], ['$17–40/n', 2],
      ['$20–30/n', 2], ['~$20', 1], ['$20–30', 1], ['~$40', 1], ['$550–950 (5n)', 5],
    ];
    const rolled = sumRanges(
      quoted.map(([text, nights]) => {
        const p = parsePrice(text);
        if (!p) throw new Error(`unparsed: ${text}`);
        return priceRange(p, nights);
      }),
    );
    expect(rolled).toEqual({ minMinor: 160100, maxMinor: 207700 });
    expect(fmtRange(rolled)).toBe('$1,601 – $2,077');
  });

  it('prints one number when there is no range', () => {
    expect(fmtRange({ minMinor: 24100, maxMinor: 24100 })).toBe('$241');
    expect(fmtRange({ minMinor: 0, maxMinor: 0 })).toBe('$0');
  });
});

describe('splitCostRows — the 💰 Costs blocks, read as money', () => {
  it('splits the Beijing line into five priced rows', () => {
    const rows = splitCostRows(
      'Hotels ~$612 (split) · wild-wall guide + driver ~$180 · spa day ~$40 · massages ~$90–110 (3 sessions) · Palace ~$6',
    );
    expect(rows).toEqual([
      { label: 'Hotels', amount: '~$612 (split)' },
      { label: 'wild-wall guide + driver', amount: '~$180' },
      { label: 'spa day', amount: '~$40' },
      { label: 'massages', amount: '~$90–110 (3 sessions)' },
      { label: 'Palace', amount: '~$6' },
    ]);
  });

  it('keeps per-night and per-day rates as they were written', () => {
    expect(splitCostRows('Lift ~$60–80/day · slope hotel ~$100/n')).toEqual([
      { label: 'Lift', amount: '~$60–80/day' },
      { label: 'slope hotel', amount: '~$100/n' },
    ]);
    expect(splitCostRows('Hotel $550–950 (5n) · food ~$40/day here')).toEqual([
      { label: 'Hotel', amount: '$550–950 (5n)' },
      { label: 'food', amount: '~$40/day here' },
    ]);
  });

  it('keeps a short qualifier with its amount', () => {
    expect(splitCostRows('Jade Dragon ~$60 incl. lift')).toEqual([
      { label: 'Jade Dragon', amount: '~$60 incl. lift' },
    ]);
  });

  it('leaves prose alone rather than mangling it', () => {
    expect(splitCostRows('+ **~$55 mandatory winter uniform** on arrival')).toEqual([
      { label: '+ **~$55 mandatory winter uniform** on arrival', amount: null },
    ]);
    expect(splitCostRows('No published 2-week rate ($890/mo or $70/day) — confirm in writing')).toEqual([
      { label: 'No published 2-week rate ($890/mo or $70/day) — confirm in writing', amount: null },
    ]);
    expect(splitCostRows('Park pass ~$35 · Tianmen ~$40 · hotels ~$85')[2]).toEqual({
      label: 'hotels',
      amount: '~$85',
    });
  });

  it('drops the trailing equals of a summed line', () => {
    expect(splitCostRows('$890 flat month + $100 deposit = ~$990–1,090')).toEqual([
      { label: '$890 flat month + $100 deposit', amount: '~$990–1,090' },
    ]);
  });
});

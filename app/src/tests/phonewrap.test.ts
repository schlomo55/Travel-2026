/* A PHONE NUMBER NEVER BREAKS MID-NUMBER (QA 9 Nov 2026): "+86 151 5325" on
   one line, "4963" on the next. keepPhonesWhole makes a phone run's spaces
   non-breaking and changes nothing else. */
import { describe, expect, it } from 'vitest';
import { keepPhonesWhole } from '../lib/logic/pass';

const NB = ' ';

describe('keepPhonesWhole', () => {
  it('a spaced international number becomes one unbreakable run', () => {
    expect(keepPhonesWhole('+86 151 5325 4963')).toBe(`+86${NB}151${NB}5325${NB}4963`);
    expect(keepPhonesWhole('front desk +852 2123-4567, ask for Sam')).toBe(`front desk +852${NB}2123-4567, ask for Sam`);
  });
  it('leaves codes, prices, dates and short numbers alone', () => {
    for (const t of ['1234567890', 'CNY 200 in cash on arrival', 'ARRANGED — the inn, 9 Nov 15:54 for XX8011 · ¥80', 'room 12 34'])
      expect(keepPhonesWhole(t)).toBe(t);
  });
});

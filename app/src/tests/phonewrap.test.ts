/* A PHONE NUMBER NEVER BREAKS MID-NUMBER (QA 9 Nov 2026): "+86 151 5325" on
   one line, "4963" on the next. phoneSegments finds the runs a screen keeps
   whole; the pieces join back to the text exactly. */
import { describe, expect, it } from 'vitest';
import { phoneSegments } from '../lib/logic/pass';

const phones = (s: string): string[] => phoneSegments(s).filter((g) => g.phone).map((g) => g.t);

describe('phone segments', () => {
  it('finds a spaced international number', () => {
    expect(phones('+86 151 5325 4963')).toEqual(['+86 151 5325 4963']);
    expect(phones('front desk +852 2123-4567, ask for Sam')).toEqual(['+852 2123-4567']);
  });
  it('leaves codes, prices, dates and short numbers alone', () => {
    expect(phones('1234567890')).toEqual([]);
    expect(phones('CNY 200 in cash on arrival')).toEqual([]);
    expect(phones('ARRANGED — the inn, 9 Nov 15:54 for XX8011 · ¥80')).toEqual([]);
  });
  it('joins back to the text exactly', () => {
    const t = 'call +86 151 5325 4963 or the desk';
    expect(phoneSegments(t).map((g) => g.t).join('')).toBe(t);
  });
});

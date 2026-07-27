import { describe, expect, it } from 'vitest';
import { ringPct, tallyChecklists } from '../lib/logic/progress';
import type { Checklist } from '../lib/model/types';

const list = (id: string, done: boolean[]): Checklist => ({
  id,
  tripId: 't',
  title: id,
  items: done.map((d, i) => ({ id: `${id}-${i}`, label: `item ${i}`, done: d })),
  order: 0,
});

describe('ringPct', () => {
  it('is a whole percent', () => {
    expect(ringPct(3, 4)).toBe(75);
    expect(ringPct(1, 3)).toBe(33);
    expect(ringPct(2, 3)).toBe(67);
  });
  it('reaches 100 only when everything is done', () => {
    expect(ringPct(30, 30)).toBe(100);
    expect(ringPct(29, 30)).toBe(97);
  });
  it('is 0, not NaN, when there is nothing to finish', () => {
    /* The screens keep a ring off an empty segment, but a component that
       divided by zero would still print "NaN%" the day one slips through. */
    expect(ringPct(0, 0)).toBe(0);
  });
  it('starts at 0 with nothing ticked', () => {
    expect(ringPct(0, 21)).toBe(0);
  });
});

describe('tallyChecklists', () => {
  it('counts ticked items across every list, not lists completed', () => {
    const t = tallyChecklists([list('a', [true, false, false]), list('b', [true, true])]);
    expect(t).toEqual({ done: 3, total: 5 });
    expect(ringPct(t.done, t.total)).toBe(60);
  });
  it('counts a list with no items as nothing at all', () => {
    expect(tallyChecklists([list('empty', [])])).toEqual({ done: 0, total: 0 });
  });
  it('is zero for no lists', () => {
    expect(tallyChecklists([])).toEqual({ done: 0, total: 0 });
  });
  it('reaches 100% only when every list is finished', () => {
    const partly = tallyChecklists([list('a', [true, true]), list('b', [true, false])]);
    expect(ringPct(partly.done, partly.total)).toBe(75);
    const all = tallyChecklists([list('a', [true, true]), list('b', [true, true])]);
    expect(ringPct(all.done, all.total)).toBe(100);
  });
});

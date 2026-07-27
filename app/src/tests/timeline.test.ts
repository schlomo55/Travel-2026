import { describe, expect, it } from 'vitest';
import { buildTimeline, currentIndex, findSpot, parsePlanItem, splitBody, timeMinutes } from '../lib/logic/timeline';
import type { Spot } from '../lib/model/types';

describe('timeMinutes', () => {
  it('reads 24-hour and 12-hour clocks', () => {
    expect(timeMinutes('09:00')).toBe(540);
    expect(timeMinutes('20:20')).toBe(1220);
    expect(timeMinutes('6am')).toBe(360);
    expect(timeMinutes('6 PM')).toBe(1080);
    expect(timeMinutes('12am')).toBe(0);
    expect(timeMinutes('12pm')).toBe(720);
  });
  it('refuses what is not a clock', () => {
    expect(timeMinutes('25:00')).toBeNull();
    expect(timeMinutes('9:75')).toBeNull();
    expect(timeMinutes('later')).toBeNull();
  });
});

describe('parsePlanItem', () => {
  it('lifts a leading time out of the text', () => {
    const p = parsePlanItem('09:00 — Walk the Bund promenade');
    expect(p.time).toBe('09:00');
    expect(p.minutes).toBe(540);
    expect(p.title).toBe('Walk the Bund promenade');
  });

  it('never invents a time that is not at the front', () => {
    const p = parsePlanItem('Be at HKG Terminal 1 by ~16:30 for the 19:35 EY871');
    expect(p.time).toBeNull();
    expect(p.minutes).toBeNull();
  });

  it('keeps md-lite emphasis balanced when the time was inside it', () => {
    const p = parsePlanItem('**20:00 Beijing time: Forbidden City tickets release** for Dec 6');
    expect(p.time).toBe('20:00');
    /* the opening ** is put back, so the closing ** still has a partner */
    const both = `${p.title} ${p.detail ?? ''}`;
    expect((both.match(/\*\*/g) ?? []).length % 2).toBe(0);
    expect(both).toContain('Forbidden City tickets release');
  });

  it('splits a title from its detail only where emphasis is balanced', () => {
    expect(splitBody('Yu Garden — explore the classical garden')).toEqual({
      title: 'Yu Garden',
      detail: 'explore the classical garden',
    });
    expect(splitBody('**Cross to PEK — NOT Daxing.** Allow 1.5–2h').detail).toBeNull();
  });

  it('leaves a single clause whole', () => {
    const p = parsePlanItem('Rest day: Yantai seaside, laundry, recover');
    expect(p.title).toBe('Rest day');
    expect(p.detail).toBe('Yantai seaside, laundry, recover');
    const q = parsePlanItem('Slow morning');
    expect(q.title).toBe('Slow morning');
    expect(q.detail).toBeNull();
  });
});

describe('buildTimeline', () => {
  it('orders timed items by the clock and keeps the rest in written order', () => {
    const t = buildTimeline([
      '13:00 Lunch at Old Shanghai',
      'Slow morning → last shopping',
      '9:00 Visit the Bund',
      'Buy a SIM somewhere',
    ]);
    expect(t.timed.map((i) => i.time)).toEqual(['9:00', '13:00']);
    expect(t.anytime.map((i) => i.title)).toEqual(['Slow morning → last shopping', 'Buy a SIM somewhere']);
  });

  it('puts everything in Anytime when nothing carries a clock', () => {
    const t = buildTimeline(['6am run & basics → breakfast'.replace('6am', 'Morning run'), 'Evening Mandarin']);
    expect(t.timed).toHaveLength(0);
    expect(t.anytime).toHaveLength(2);
  });
});

describe('currentIndex', () => {
  const timed = buildTimeline(['09:00 a', '13:00 b', '18:00 c']).timed;
  it('points at the next item still ahead', () => {
    expect(currentIndex(timed, 10 * 60)).toBe(1);
  });
  it('falls back to the last item once the day is done', () => {
    expect(currentIndex(timed, 23 * 60)).toBe(2);
  });
  it('points at nothing when the day shown is not today', () => {
    expect(currentIndex(timed, null)).toBe(-1);
  });
});

describe('findSpot', () => {
  const spots: Spot[] = [
    { id: 's1', name: 'Yu Garden', kind: 'sight', native: '豫园' },
    { id: 's2', name: 'Nishiki Market', kind: 'food' },
  ];
  it('matches on the local-script name and on the latin one', () => {
    expect(findSpot('Wander 豫园 before lunch', spots)?.id).toBe('s1');
    expect(findSpot('Breakfast at Nishiki Market', spots)?.id).toBe('s2');
  });
  it('returns nothing when no place is named', () => {
    expect(findSpot('Laundry and a nap', spots)).toBeNull();
  });
});

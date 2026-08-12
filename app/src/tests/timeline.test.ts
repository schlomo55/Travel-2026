import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  currentIndex,
  DAY_CLOSE,
  DAY_OPEN,
  durationLabel,
  findSpot,
  freeBlocks,
  hhmm,
  parsePlanItem,
  planFixedPoints,
  splitBody,
  timeMinutes,
  type FixedPoint,
} from '../lib/logic/timeline';
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

/* ---------- free blocks (Gap B) ---------- */

const at = (start: number, label = 'x', end?: number): FixedPoint =>
  end === undefined ? { start, label } : { start, end, label };

describe('freeBlocks', () => {
  it('gives a day with nothing timed one all-day block', () => {
    const b = freeBlocks([]);
    expect(b).toHaveLength(1);
    expect(b[0]?.start).toBe(DAY_OPEN);
    expect(b[0]?.end).toBe(DAY_CLOSE);
    expect(b[0]?.span).toBe('08:00–22:00');
    expect(b[0]?.duration).toBe('14 h');
    /* nothing to stand behind: the caller falls back to the stop itself */
    expect(b[0]?.after).toBeNull();
  });

  it('opens a block between two consecutive fixed points', () => {
    const b = freeBlocks([at(9 * 60, 'gate', 10 * 60), at(17 * 60, 'concert')]);
    /* 08:00–09:00 before the first, 10:00–17:00 between, nothing after the
       17:00 instant because nothing states when it lets go */
    expect(b.map((x) => x.span)).toEqual(['08:00–09:00', '10:00–17:00']);
    expect(b[1]?.duration).toBe('7 h');
    expect(b[1]?.after?.label).toBe('gate');
  });

  it('gives back-to-back fixed points no block at all', () => {
    const b = freeBlocks([
      at(8 * 60, 'a', 12 * 60),
      at(12 * 60, 'b', 17 * 60),
      at(17 * 60, 'c', 22 * 60),
    ]);
    expect(b).toEqual([]);
  });

  it('refuses a gap shorter than an hour', () => {
    const b = freeBlocks([at(8 * 60, 'a', 13 * 60), at(13 * 60 + 40, 'b', 22 * 60)]);
    expect(b).toEqual([]);
    /* …and keeps it the moment it reaches the floor */
    expect(freeBlocks([at(8 * 60, 'a', 13 * 60), at(14 * 60, 'b', 22 * 60)])).toHaveLength(1);
  });

  it('measures the labels in tabular words', () => {
    expect(durationLabel(200)).toBe('3 h 20 m');
    expect(durationLabel(180)).toBe('3 h');
    expect(durationLabel(45)).toBe('45 m');
    expect(hhmm(14 * 60 + 10)).toBe('14:10');
    expect(hhmm(0)).toBe('00:00');
  });

  it('draws the trip’s own example: 3 h 20 m free · 14:10–17:30', () => {
    const b = freeBlocks([at(12 * 60, 'lunch', 14 * 60 + 10), at(17 * 60 + 30, 'show', 20 * 60)]);
    const mid = b.find((x) => x.start === 14 * 60 + 10);
    expect(mid?.span).toBe('14:10–17:30');
    expect(mid?.duration).toBe('3 h 20 m');
  });

  it('closes the day behind a point that never said when it ends', () => {
    /* 19:30 HK Phil states a start and no finish — the evening behind it is
       not knowably free, so no block is drawn there. */
    expect(freeBlocks([at(19 * 60 + 30, 'HK Phil')]).map((x) => x.span)).toEqual(['08:00–19:30']);
    /* a stated arrival is different: the flight let go of you at 16:05 */
    expect(freeBlocks([at(13 * 60 + 50, 'MU733', 16 * 60 + 5)]).map((x) => x.span)).toEqual([
      '08:00–13:50',
      '16:05–22:00',
    ]);
  });

  it('clips to the waking window and ignores what falls outside it', () => {
    /* EY609 lands at 04:35: it cannot shorten a day that starts at 08:00 */
    expect(freeBlocks([at(2 * 60 + 45, 'EY609', 4 * 60 + 35)])).toHaveLength(1);
    /* a 06:30 departure is inside the day but before the window opens */
    const b = freeBlocks([at(6 * 60 + 30, 'wild wall')]);
    expect(b).toEqual([]);
  });

  it('is not confused by overlap, nesting or unsorted input', () => {
    const b = freeBlocks([
      at(15 * 60, 'nested', 15 * 60 + 20),
      at(9 * 60, 'long leg', 16 * 60),
      at(9 * 60 + 30, 'inside it', 10 * 60),
    ]);
    expect(b.map((x) => x.span)).toEqual(['08:00–09:00', '16:00–22:00']);
    /* the anchor is the point the cursor actually left, not the last in the
       array — the 20-minute nested stop must not claim it */
    expect(b[1]?.after?.label).toBe('long leg');
  });

  it('reads the timed half of a real timeline as fixed points', () => {
    const t = buildTimeline(['09:00 Gate', 'Slow morning', '20:00 Concert']);
    const pts = planFixedPoints(t.timed);
    expect(pts.map((p) => p.start)).toEqual([540, 1200]);
    /* a plan line states a start and nothing else — never an end */
    expect(pts.every((p) => p.end === undefined)).toBe(true);
  });
});

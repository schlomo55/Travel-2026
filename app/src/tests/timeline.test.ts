import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, compareIso } from '../lib/logic/dates';
import { resolveDay } from '../lib/logic/day';
import type { AppBackup } from '../lib/model/types';
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
  it('reads the file’s own “about” (~, ≈) as the clock it qualifies', () => {
    expect(timeMinutes('~07:30')).toBe(450);
    expect(timeMinutes('≈21:30')).toBe(1290);
    expect(timeMinutes('~2h')).toBeNull();
  });
});

/* Run 3b: Dec 12 drew "14 h free · 08:00–22:00 · nothing timed yet today"
   because neither of its two clocks came first in its line. */
describe('parsePlanItem — the clock where the trip file puts it', () => {
  const DEC12 = [
    'First entry ~07:30 · Golden Whip Stream valley walk',
    'Stone-step ascent (~2h) to Yuanjiajie + the Avatar Hallelujah pillars — on foot, not the elevator',
    'Sunset ~17:45 — be off the steps in daylight',
    '🍜 **Carry breakfast and lunch up** — in-park food is poor and dear, and Pullman’s breakfast is included (and is for two)',
    '🍜 **Dinner: 唐师傅湘西名菜馆 Tang Shifu Xiangxi**, Wuling Rd ~70 m SE of Genli mall, ~¥70pp',
  ];

  it('reads a clock that closes a short lead-in, and keeps the lead-in as the title', () => {
    const a = parsePlanItem(DEC12[0]!);
    expect([a.time, a.minutes, a.title, a.detail]).toEqual(['~07:30', 450, 'First entry', 'Golden Whip Stream valley walk']);
    const b = parsePlanItem(DEC12[2]!);
    expect([b.time, b.minutes, b.title, b.detail]).toEqual(['~17:45', 1065, 'Sunset', 'be off the steps in daylight']);
    /* inside emphasis, the emphasis stays balanced */
    const c = parsePlanItem('**Airport run ~18:00** — CKG T3');
    expect([c.time, c.title, c.detail]).toEqual(['~18:00', '**Airport run**', 'CKG T3']);
  });

  it('gives Dec 12 its timed morning and a free block that ends at sunset', () => {
    const t = buildTimeline(DEC12);
    expect(t.timed.map((x) => x.time)).toEqual(['~07:30', '~17:45']);
    expect(t.anytime).toHaveLength(3);
    const blocks = freeBlocks(planFixedPoints(t.timed));
    expect(blocks.map((b) => [b.span, b.duration, b.after?.label])).toEqual([['08:00–17:45', '9 h 45 m', 'First entry']]);
  });

  it('reads a clock that leads, behind the item’s emoji or a “~”', () => {
    const p = parsePlanItem('🚐 **11:00 — THEY COLLECT YOU AT THE HOTEL** (confirmed in writing, 13 Aug)');
    expect(p.time).toBe('11:00');
    expect(p.title).toBe('🚐 **THEY COLLECT YOU AT THE HOTEL** (confirmed in writing, 13 Aug)');
    const q = parsePlanItem('~07:30 · first entry');
    expect([q.time, q.minutes, q.title]).toEqual(['~07:30', 450, 'first entry']);
  });

  it('never turns a duration, a price or prose into a clock', () => {
    for (const s of [
      DEC12[1]!,
      DEC12[4]!,
      'A 2h ascent — then lunch at the top',
      'Tickets ¥165 · passport real-name',
      'Shared car toward Dali (~4–5h, ~$25) — leave with daylight in hand',
      /* a comma is not a separator: the wall walk is not over at 13:30 */
      'Heading down by ~13:30, out the East Gate before 15:00',
      'Big Sanlitun night → ~23:15 leave the bars → midnight massage (fallback: Bodhi)',
      /* the clock sits inside the lead-in, not at its end */
      '⏰ **So the RETURN FERRY IS ~16:15 FROM TAIPA** — ~17:15 left only ~30 min of slack',
      /* the clock comes after the first separator */
      'Evening: Shuhe stroll + 20:00 Naxi Ancient Music concert — OR a hot-spring soak',
      'TLV Ben Gurion Terminal 3 — be there by ~11:00 for the 14:00 EY608',
      /* a lead-in with a number in it is not a label */
      '3U8011 20:20 → Lijiang 22:00 · the inn has approved a late arrival',
      /* five words is a sentence, not a label */
      '⏰ **BE AT THE TERMINAL BY 10:50 — three hours, not two.**',
      /* "until" says when something stops */
      'Open until 22:00 — the night market',
    ]) {
      expect(parsePlanItem(s).time, s).toBeNull();
    }
  });

  it('keeps the clock in the words where the lead-in would be left hanging', () => {
    const p = parsePlanItem('At the gate by 09:00 · the doors shut at 09:30');
    expect([p.time, p.minutes, p.title]).toEqual(['09:00', 540, 'At the gate by 09:00']);
    const q = parsePlanItem('Dinner at 20:00 — Tang Shifu Xiangxi');
    expect([q.time, q.title, q.detail]).toEqual(['20:00', 'Dinner at 20:00', 'Tang Shifu Xiangxi']);
  });
});

/* Run 3c: the next three cases were read as moments of the day */
describe('parsePlanItem — hours, ranges and a lead-in left hanging (Run 3c)', () => {
  it('never reads a place’s opening hours as a moment of the day', () => {
    for (const s of [
      'Temple closes 17:00 · last tickets an hour before',
      'Open daily 09:00 · closed Mondays',
      'Gates shut 17:30 — be out by then',
      'Last entry 16:30 · the queue starts early',
      'Open until 22:00 — the night market',
      '**Museum opens 09:00** · book ahead',
    ]) {
      expect(parsePlanItem(s).time, s).toBeNull();
    }
    /* a word that only starts like one is not one */
    expect(parsePlanItem('Open-air concert 20:00 · the lake stage').time).toBe('20:00');
  });

  it('reads a clock range as a start and an end, and no free block inside it', () => {
    const p = parsePlanItem('10:00 – 12:00 · cooking class at the school');
    expect([p.time, p.minutes, p.until, p.untilMinutes, p.title]).toEqual(['10:00', 600, '12:00', 720, 'cooking class at the school']);
    const q = parsePlanItem('Cooking class 10:00–12:00 · at the school');
    expect([q.time, q.until, q.title, q.detail]).toEqual(['10:00', '12:00', 'Cooking class', 'at the school']);
    expect(parsePlanItem('9am to 1pm — the market walk').until).toBe('1pm');
    /* a single clock states no end */
    expect(parsePlanItem('06:30 - leave for the wall').until).toBeNull();
    const pts = planFixedPoints(buildTimeline(['10:00 – 12:00 · cooking class']).timed);
    expect(pts).toEqual([{ start: 600, end: 720, label: 'cooking class' }]);
    expect(freeBlocks(pts).map((b) => b.span)).toEqual(['08:00–10:00', '12:00–22:00']);
    /* a range past midnight ends the next day */
    expect(planFixedPoints(buildTimeline(['21:00 – 01:00 · the night market']).timed)[0]).toMatchObject({ start: 1260, end: 1500 });
  });

  it('keeps the clock in the words after "than", "for", "on" and "to"', () => {
    const p = parsePlanItem('Leave no later than 09:00 · the road closes for the race');
    expect([p.time, p.title]).toEqual(['09:00', 'Leave no later than 09:00']);
    expect(parsePlanItem('Table for 19:30 · Lung King Heen').title).toBe('Table for 19:30');
    expect(parsePlanItem('Boat back to 16:00 · the last one').title).toBe('Boat back to 16:00');
  });
});

/* Every day of every seed, read the way the day screen reads it. Run 3c
   replaced a table that pinned the China seed's every clock (a plan line
   edited on main broke `npm test`) with what must hold on ANY day, plus the
   few days the design rests on. */
describe('the seeds, every day', () => {
  const seed = (f: string) => (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', f), 'utf8')) as AppBackup).trips[0]!;
  const china = seed('china-2026.trip.json');
  const days = (t: ReturnType<typeof seed>) => {
    const out: { date: string; items: string[] }[] = [];
    for (let d = t.trip.start; compareIso(d, t.trip.end) <= 0; d = addDays(d, 1)) {
      out.push({ date: d, items: resolveDay(d, t.dayPlans, t.dayDefaults, t.stops)?.planItems ?? [] });
    }
    return out;
  };
  const stars = (s: string) => (s.match(/\*\*/g) ?? []).length % 2;

  it('never invents a clock, never times a place’s hours, keeps emphasis whole, orders the day', () => {
    for (const t of [china, seed('israel-test.trip.json'), seed('template-example.trip.json')]) {
      for (const { date, items } of days(t)) {
        const tl = buildTimeline(items);
        for (const it of tl.timed) {
          const at = `${date} ${it.raw}`;
          /* the clock is the file's own words, and reads as itself */
          expect(it.raw.includes(it.time!), at).toBe(true);
          expect(it.minutes, at).toBe(timeMinutes(it.time!));
          /* the words before the clock are a short label, never a place's hours */
          const lead = it.raw.slice(0, it.raw.indexOf(it.time!));
          expect(/\b(?:until|till|open|opens|close|closes|shut|shuts|last)\b/i.test(lead), at).toBe(false);
          expect(lead.replace(/\*/g, '').trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length <= 4, at).toBe(true);
          /* the words shown are balanced md-lite */
          expect(stars(`${it.title} ${it.detail ?? ''}`), at).toBe(0);
        }
        const mins = tl.timed.map((x) => x.minutes!);
        expect(mins, date).toEqual([...mins].sort((a, b) => a - b));
        /* the blocks sit inside the waking day, an hour at least, in order */
        const blocks = freeBlocks(planFixedPoints(tl.timed));
        blocks.forEach((b, i) => {
          expect(b.start >= DAY_OPEN && b.end <= DAY_CLOSE && b.minutes >= 60, date).toBe(true);
          if (i) expect(b.start >= blocks[i - 1]!.end, date).toBe(true);
        });
      }
    }
  });

  it('Dec 12: the first entry and sunset are the morning and the evening, the day between is free', () => {
    const d = days(china).find((x) => x.date === '2026-12-12')!;
    const tl = buildTimeline(d.items);
    expect(tl.timed.map((x) => [x.time, x.title])).toEqual([
      ['~07:30', 'First entry'],
      ['~17:45', 'Sunset'],
    ]);
    expect(freeBlocks(planFixedPoints(tl.timed)).map((b) => [b.span, b.after?.label])).toEqual([['08:00–17:45', 'First entry']]);
  });

  /* 11:00 from 13 Aug; on 28 Sep the school moved it to "earliest 10:30, wait
     in the lobby" — the 11:00 is history and may not be a fixed point */
  it('Nov 23: the academy’s 10:30 pickup is the day’s fixed point', () => {
    const tl = buildTimeline(days(china).find((x) => x.date === '2026-11-23')!.items);
    const pickup = tl.timed.find((x) => x.time === '10:30');
    expect(pickup?.title).toMatch(/THE SCHOOL COLLECTS YOU FROM THE HOTEL LOBBY/);
    expect(tl.timed.some((x) => x.time === '11:00')).toBe(false);
    expect(freeBlocks(planFixedPoints(tl.timed)).map((b) => b.span)).toEqual(['08:00–10:30']);
  });

  it('Dec 10: the Jade Dragon release at 20:00 closes the day’s free block', () => {
    const tl = buildTimeline(days(china).find((x) => x.date === '2026-12-10')!.items);
    const release = tl.timed.find((x) => x.time === '20:00');
    expect(release?.title).toMatch(/JADE DRAGON/);
    expect(freeBlocks(planFixedPoints(tl.timed)).map((b) => b.span)).toEqual(['08:00–20:00']);
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

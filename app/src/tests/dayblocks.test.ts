/* QA, 7 Nov 2026: "12 h free · nothing timed yet today" on full days, and
   the free block's "+" offering scraps of guide text — the previous day's
   train, "Hours:", the hostel's name. Synthetic trips only. */
import { describe, expect, it } from 'vitest';
import { buildTimeline, dayBlocks, type FixedPoint } from '../lib/logic/timeline';
import { dayOffers, offeredOf } from '../lib/logic/options';
import type { ContentBlock, Stop } from '../lib/model/types';

const at = (h: number, m = 0, label = 'x'): FixedPoint => ({ start: h * 60 + m, label });

describe('dayBlocks — a planned day is not a free one', () => {
  it('a day the plan says is taken whole has no free block, whatever its clocks', () => {
    const tl = buildTimeline(['🏰 **The theme park, the whole day — stay until it closes** (~20:30)', '20:00 — the release, be logged in']);
    expect(dayBlocks(tl, [], [at(19, 45), at(20, 15)], false)).toEqual([]);
    expect(dayBlocks(buildTimeline(['A full-day tour of the islands']), [], [], false)).toEqual([]);
  });

  it('untimed things to do take the hours before the first clock: no "nothing timed yet" block', () => {
    const tl = buildTimeline(['Ridge hike → the bay', 'Seafood lunch in the village', 'Evening: the races']);
    expect(dayBlocks(tl, [], [], false)).toEqual([]);
    /* a ticket with no time does the same on a day whose lines are all timed */
    const timed = buildTimeline(['18:00 — dinner']);
    expect(dayBlocks(timed, [], [], true)).toEqual([]);
    expect(dayBlocks(timed, [], [], false).map((b) => b.span)).toEqual(['08:00–18:00']);
  });

  it('keeps the gap between two clocks, which the day itself proves', () => {
    const tl = buildTimeline(['09:00 — the museum opens', 'A slow walk by the river', '15:00 — the tea house']);
    const blocks = dayBlocks(tl, [], [], false);
    expect(blocks.map((b) => [b.span, b.after?.label])).toEqual([['09:00–15:00', 'the museum opens']]);
  });

  it('counts the alarms and timed to-dos it is given as clocks', () => {
    const tl = buildTimeline(['09:00 — the museum opens', '17:00 — the tea house']);
    expect(dayBlocks(tl, [], [], false).map((b) => b.span)).toEqual(['08:00–09:00', '09:00–17:00']);
    expect(dayBlocks(tl, [], [at(12, 30, 'alarm')], false).map((b) => b.span)).toEqual(['08:00–09:00', '09:00–12:30', '12:30–17:00']);
  });

  it('a reminder cuts a block but never makes one: the hours before it are not proved free', () => {
    const tl = buildTimeline(['06:00 — the run', 'Training, morning and afternoon']);
    expect(dayBlocks(tl, [], [], false)).toEqual([]);
    expect(dayBlocks(tl, [], [at(12, 45, 'tickets on sale')], false)).toEqual([]);
  });

  it('an empty day is still open from morning to night', () => {
    expect(dayBlocks(buildTimeline([]), [], [], false).map((b) => [b.span, b.after])).toEqual([['08:00–22:00', null]]);
  });
});

const blk = (id: string, heading: string, items: string[]): ContentBlock => ({ id, heading, items });
const city: Stop = {
  id: 's',
  tripId: 't',
  kind: 'stop',
  name: 'Sample City',
  hue: 200,
  start: '2027-04-12',
  end: '2027-04-15',
  blocks: [],
  order: 1,
  options: [
    blk('picks', '⭐ Our picks', [
      '⭐ **The old market** — morning stalls, ~€5',
      '**The river walk** — 3 km along the quay',
      '**The castle** — the view over the roofs',
      'The harbour at sunset',
      '**Hours:** 09:00–18:00 most days',
      '✅ **The tower — booked 3 Mar**',
      '**Leave the hotel ~09:00** for the train',
    ]),
    blk('day', '🚄 Tue 13 Apr — the train south', ['⭐ **IC 520, Central 10:05 → South 12:40**', '**The ticket:** bought in March', '**Evening:** the old town']),
    blk('bed', '🏨 The bed (✅ booked)', ['⭐ **Sample Hostel** · the quay']),
    blk('undo', '🔁 Undoing the old plan', ['**1. The first hotel — done:**', '**2. The flight — done:**', 'A refund was hoped for']),
  ],
  recoBlocks: [blk('tips', '💡 Good to know', ['Shops close at 13:00 on Sundays']), blk('budget', 'Sample budget', ['~€80 a day'])],
};

describe('offeredOf — only real options under a free block', () => {
  it('offers the menu’s options and nothing else', () => {
    expect(offeredOf(city).map((c) => c.name)).toEqual(['The old market', 'The river walk', 'The castle', 'The harbour at sunset']);
  });

  it('a day’s offers leave out the scraps, and a picked line stays so it can be taken back', () => {
    const day = { planItems: ['Breakfast at the hotel'] };
    const none = { has: () => false };
    const o = dayOffers({ during: true, travel: false, day, stop: city, picked: none })!;
    expect(o.pool.map((c) => c.name)).toEqual(['The old market', 'The river walk', 'The castle', 'The harbour at sunset']);
    const picked = dayOffers({ during: true, travel: false, day, stop: city, picked: { has: (id: string) => id === 'day#0' } })!;
    expect(picked.pool.map((c) => c.id)).toContain('day#0');
  });
});

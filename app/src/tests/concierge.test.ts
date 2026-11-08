/* THE CONCIERGE — one plain sentence, made only of the trip's own facts,
   in the order of what matters now. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { concierge, sentenceText, type ConciergeInput } from '../lib/logic/concierge';
import { buildMetroLine, stepProgress } from '../lib/logic/metroline';
import { nextCommitment } from '../lib/logic/commitment';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const base: ConciergeInput = {
  phase: 'during',
  now: '2027-04-04',
  dayTag: 'Day 17 of 31',
  tripDays: 31,
  stops: 9,
  daysToStart: 0,
};
const apr04 = (ticked: Set<number>) => {
  const runbook = demo.runbooks.find((r) => r.id === 'dm27-run-apr04')!;
  const line = buildMetroLine({
    date: '2027-04-04',
    bookings: demo.bookings,
    cards: demo.showCards,
    runbook,
    ticked: (i) => ticked.has(i),
    realToday: '2027-03-01',
  });
  const p = stepProgress(runbook.steps.length, (i) => ticked.has(i));
  return concierge({ ...base, line, steps: runbook.steps, current: p.current });
};

/* Sun 4 Apr on the demo trip: Suzhou → the Canal Hostel for the bag → train
   to Shanghai HONGQIAO → MU 5001 (booked) → Huangshan Tunxi → the Pine Lodge
   in Tangkou. The crit runbook "the Hongqiao flight" has seven steps. */
describe('concierge · a travel day (Sun 4 Apr)', () => {
  it('starts with the first step, in its own words, before anything moves', () => {
    const s = apr04(new Set());
    expect(s.caps).toBe('Now · step 1 of 7');
    expect(sentenceText(s)).toBe('Breakfast, check out by 12:00 and leave the bag at the Canal Hostel.');
  });

  it('leaves the bed with the time the step gives', () => {
    const s = apr04(new Set([0]));
    expect(s.caps).toBe('Now · step 2 of 7');
    expect(sentenceText(s)).toBe('Next: check out of Sample Canal Hostel, Pingjiang Road by 14:00, then get to Shanghai Hongqiao · T2 by about 17:10.');
    expect(s.parts.find((p) => p.em === 'time')?.t).toBe('14:00');
  });

  it('a step that is not a place says its own first clause', () => {
    const s = apr04(new Set([0, 1]));
    expect(s.caps).toBe('Now · step 3 of 7');
    expect(sentenceText(s)).toBe('Eat properly before security.');
  });

  /* MU 5001 is booked, so the sentence says "booked" — and does not warn. */
  it('the flight says it is booked, with its own departure clock', () => {
    const s = apr04(new Set([0, 1, 2]));
    expect(sentenceText(s)).toBe('Next: flight MU 5001 to Huangshan Tunxi — booked. It leaves at 19:10.');
    expect(s.tone).not.toBe('warn');
    expect(s.parts.find((p) => p.em === 'warn')).toBeUndefined();
    expect(s.parts.find((p) => p.em === 'time')?.t).toBe('19:10');
  });

  it('the last step: to tonight’s bed, by the time the step gives', () => {
    const s = apr04(new Set([0, 1, 2, 3, 4, 5]));
    expect(s.caps).toBe('Now · step 7 of 7');
    expect(sentenceText(s)).toBe('Next: get to Sample Pine Lodge, Tangkou by about 21:30.');
  });
});

describe('concierge · the rules, in order', () => {
  it('a bed nobody has booked comes first on an ordinary day', () => {
    const s = concierge({ ...base, tonight: { name: 'Ping’an village — **NOT BOOKED YET**', state: 'missing' }, dueToday: 'x' });
    expect(s.caps).toBe('Tonight');
    expect(s.tone).toBe('crit');
    expect(sentenceText(s)).toBe('Tonight’s bed is not booked yet — Ping’an village — NOT BOOKED YET.');
  });

  it('then a to-do that is due today', () => {
    const s = concierge({ ...base, dueToday: 'Book **蜀风雅韵** for the Apr 8 evening', tonight: { name: 'Sample Pine Lodge', state: 'booked' } });
    expect(s.caps).toBe('Due today');
    expect(sentenceText(s)).toBe('Book 蜀风雅韵 for the Apr 8 evening.');
  });

  it('then tomorrow’s move, booked or not', () => {
    /* Apr 2's train to Suzhou is still pending … */
    const next = nextCommitment(demo.bookings, '2027-04-02');
    const s = concierge({ ...base, now: '2027-04-01', next, tonight: { name: 'Sample Lane House', state: 'booked' } });
    expect(sentenceText(s)).toBe('Tomorrow: HSR · Shanghai → Suzhou — not booked yet.');
    expect(s.tone).toBe('warn');
    /* … Apr 9's evening flight to Guilin is booked. */
    const fly = concierge({ ...base, now: '2027-04-08', next: nextCommitment(demo.bookings, '2027-04-09') });
    expect(sentenceText(fly)).toBe('Tomorrow: Sichuan Airlines · 3U 9003 at 20:20 — booked.');
  });

  it('otherwise the day itself, and where you sleep', () => {
    const s = concierge({ ...base, now: '2027-04-08', dayTitle: 'Chengdu full day', tonight: { name: 'Sample Teahouse Hotel, Chunxi Road', state: 'booked' } });
    expect(sentenceText(s)).toBe('Chengdu full day. Tonight: Sample Teahouse Hotel, Chunxi Road — booked.');
    const air = concierge({ ...base, tonight: { name: 'AY 9057', state: 'transit' } });
    expect(sentenceText(air)).toBe('Tonight: AY 9057 — a night in transit.');
    expect(sentenceText(concierge(base))).toBe('Nothing is planned for today.');
  });

  it('never counts a move further away than tomorrow as urgent', () => {
    const s = concierge({ ...base, now: '2027-03-31', next: nextCommitment(demo.bookings, '2027-04-02'), dayTitle: 'Day' });
    expect(sentenceText(s)).toBe('Day.');
  });

  it('before the trip it counts down to the first leg, after it it closes', () => {
    const before = concierge({
      ...base,
      phase: 'before',
      now: '2027-03-13',
      daysToStart: 6,
      dayTag: '6 days to go',
      next: nextCommitment(demo.bookings, '2027-03-13'),
    });
    expect(sentenceText(before)).toBe('The trip starts in 6 days. First: Finnair · AY 1501, Fri 19 Mar at 11:05.');
    expect(sentenceText(concierge({ ...base, phase: 'after' }))).toBe('Trip complete — 31 days, 9 stops.');
  });
});

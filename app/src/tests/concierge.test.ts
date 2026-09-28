/* THE CONCIERGE — one plain sentence, made only of the trip's own facts,
   in the order of what matters now. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { concierge, sentenceText, type ConciergeInput } from '../lib/logic/concierge';
import { buildMetroLine, stepProgress } from '../lib/logic/metroline';
import { nextCommitment } from '../lib/logic/commitment';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const base: ConciergeInput = {
  phase: 'during',
  now: '2026-12-11',
  dayTag: 'Day 21 of 37',
  tripDays: 37,
  stops: 10,
  daysToStart: 0,
};
const dec11 = (ticked: Set<number>) => {
  const runbook = china.runbooks.find((r) => r.id === 'cn26-run-dec11')!;
  const line = buildMetroLine({
    date: '2026-12-11',
    bookings: china.bookings,
    cards: china.showCards,
    runbook,
    ticked: (i) => ticked.has(i),
    realToday: '2026-09-28',
  });
  const p = stepProgress(runbook.steps.length, (i) => ticked.has(i));
  return concierge({ ...base, line, steps: runbook.steps, current: p.current });
};

describe('concierge · a travel day (Fri 11 Dec)', () => {
  it('starts at the bed you leave, with the check-out time the step gives', () => {
    const s = dec11(new Set());
    expect(s.caps).toBe('Now · step 1 of 8');
    expect(sentenceText(s)).toBe('Next: check out of Element Chongli by 12:00, then get to Taizicheng.');
    expect(s.parts.find((p) => p.em === 'time')?.t).toBe('12:00');
  });

  it('says the board’s own sentence at step 2', () => {
    const s = dec11(new Set([0]));
    expect(s.caps).toBe('Now · step 2 of 8');
    expect(sentenceText(s)).toBe('Next: the train to Qinghe — not booked yet. Be in Qinghe by about 14:30.');
    expect(s.tone).toBe('warn');
    expect(s.parts.find((p) => p.em === 'warn')?.t).toBe('not booked yet');
    expect(s.parts.find((p) => p.em === 'time')?.t).toBe('14:30');
  });

  it('the crossing to Daxing, with the time the step ties to it', () => {
    const s = dec11(new Set([0, 1]));
    expect(sentenceText(s)).toBe('Next: get to Beijing Daxing Intl by about 16:45.');
    expect(s.tone).toBe('');
  });

  it('the booked flight, with its own departure clock', () => {
    const s = dec11(new Set([0, 1, 2]));
    expect(sentenceText(s)).toBe('Next: flight CA 8609 to Zhangjiajie Hehua · Terminal 2 — booked. It leaves at 18:15.');
  });

  it('a step that is not a place says its own first clause', () => {
    const s = dec11(new Set([0, 1, 2, 3]));
    expect(s.caps).toBe('Now · step 5 of 8');
    expect(sentenceText(s)).toBe('Eat properly at PKX before security.');
  });

  it('the last step: to tonight’s bed, by the time the step gives', () => {
    const s = dec11(new Set([0, 1, 2, 3, 4, 5, 6]));
    expect(sentenceText(s)).toBe('Next: get to Pullman Zhangjiajie, Wulingyuan by about 21:30.');
  });
});

describe('concierge · the rules, in order', () => {
  it('a bed nobody has booked comes first on an ordinary day', () => {
    const s = concierge({ ...base, tonight: { name: 'Yantai city — **NOT BOOKED YET**', state: 'missing' }, dueToday: 'x' });
    expect(s.caps).toBe('Tonight');
    expect(s.tone).toBe('crit');
    expect(sentenceText(s)).toBe('Tonight’s bed is not booked yet — Yantai city — NOT BOOKED YET.');
  });

  it('then a to-do that is due today', () => {
    const s = concierge({ ...base, dueToday: 'Book **重庆1949** for the Dec 15 evening', tonight: { name: 'Pullman', state: 'booked' } });
    expect(s.caps).toBe('Due today');
    expect(sentenceText(s)).toBe('Book 重庆1949 for the Dec 15 evening.');
  });

  it('then tomorrow’s move, booked or not', () => {
    const next = nextCommitment(china.bookings, '2026-12-14');
    const s = concierge({ ...base, now: '2026-12-13', next, tonight: { name: 'Huatian', state: 'booked' } });
    expect(sentenceText(s)).toBe('Tomorrow: HSR · Zhangjiajie West → Chongqing — not booked yet.');
    expect(s.tone).toBe('warn');
    const fly = concierge({ ...base, now: '2026-12-15', next: nextCommitment(china.bookings, '2026-12-16') });
    expect(sentenceText(fly)).toBe('Tomorrow: Sichuan Airlines · 3U 8011 at 20:20 — booked.');
  });

  it('otherwise the day itself, and where you sleep', () => {
    const s = concierge({ ...base, now: '2026-12-12', dayTitle: 'Zhangjiajie on foot', tonight: { name: 'Pullman Zhangjiajie, Wulingyuan', state: 'booked' } });
    expect(sentenceText(s)).toBe('Zhangjiajie on foot. Tonight: Pullman Zhangjiajie, Wulingyuan — booked.');
    const air = concierge({ ...base, tonight: { name: 'EY 888', state: 'transit' } });
    expect(sentenceText(air)).toBe('Tonight: EY 888 — a night in transit.');
    expect(sentenceText(concierge(base))).toBe('Nothing is planned for today.');
  });

  it('never counts a move further away than tomorrow as urgent', () => {
    const s = concierge({ ...base, now: '2026-12-12', next: nextCommitment(china.bookings, '2026-12-14'), dayTitle: 'Day' });
    expect(sentenceText(s)).toBe('Day.');
  });

  it('before the trip it counts down to the first leg, after it it closes', () => {
    const before = concierge({
      ...base,
      phase: 'before',
      now: '2026-11-15',
      daysToStart: 6,
      dayTag: '6 days to go',
      next: nextCommitment(china.bookings, '2026-11-15'),
    });
    expect(sentenceText(before)).toBe('The trip starts in 6 days. First: Etihad Airways · EY 608, Sat 21 Nov at 14:00.');
    expect(sentenceText(concierge({ ...base, phase: 'after' }))).toBe('Trip complete — 37 days, 10 stops.');
  });
});

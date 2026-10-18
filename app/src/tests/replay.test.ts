/* REPLAY — the trip as a timeline: the clock Play runs on, the bars under
   the scrubber, the visa window as a bar, and where the trip is on a day. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, ComplianceCounter } from '../lib/model/types';
import {
  COMET_MS,
  DAY_MS,
  dayIndex,
  PLAY_HOME,
  playAction,
  playback,
  playheadAt,
  replayClock,
  type PlayEvent,
  type Playback,
  scrubBars,
  scrubMarks,
  tripDates,
  visaWindow,
  whereOn,
} from '../lib/logic/replay';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const trip = china.trip;
const visa = china.counters.find((c) => c.pinned)!;

describe('replay · the days', () => {
  it('lists every date of the trip, first to last', () => {
    const d = tripDates(trip);
    expect(d.length).toBe(37);
    expect(d[0]).toBe('2026-11-21');
    expect(d[20]).toBe('2026-12-11');
    expect(d[36]).toBe('2026-12-27');
  });
  it('places a date on the scrubber, clamped to the trip', () => {
    expect(dayIndex(trip, '2026-12-11')).toBe(20);
    expect(dayIndex(trip, '2026-09-28')).toBe(0);
    expect(dayIndex(trip, '2027-01-05')).toBe(36);
  });
});

describe('replay · the clock', () => {
  const dates = tripDates(trip);
  const legs = new Set(['2026-12-05', '2026-12-11']);
  const clock = replayClock(dates, legs);

  it('holds a leg day for one comet and passes any other day quickly', () => {
    expect(clock.durs[14]).toBe(COMET_MS);
    expect(clock.durs[20]).toBe(COMET_MS);
    expect(clock.durs[0]).toBe(DAY_MS);
    expect(clock.total).toBe(35 * DAY_MS + 2 * COMET_MS);
    expect(clock.starts[1]).toBe(DAY_MS);
  });

  it('reads the playhead at any moment of Play', () => {
    expect(playheadAt(clock, 0)).toEqual({ index: 0, frac: 0 });
    const inLeg = playheadAt(clock, clock.starts[20]! + COMET_MS / 2);
    expect(inLeg.index).toBe(20);
    expect(inLeg.frac).toBeCloseTo(0.5, 5);
    expect(playheadAt(clock, clock.total + 50)).toEqual({ index: 36, frac: 1 });
  });
});

/* Run 3c: "Back to today" did nothing while Play ran — the next frame put
   the playhead back — and Play's name said "from 21 Nov" after a pause or a
   drag. Every control is now an event on one state. */
describe('replay · Play, Pause, the scrubber and Back to today', () => {
  const clock = replayClock(tripDates(trip), new Set(['2026-12-05', '2026-12-11']));
  const run = (s: Playback, ...events: PlayEvent[]) => events.reduce((x, e) => playback(x, e, clock), s);
  const frames = (k: number, dt = 50): PlayEvent[] => Array.from({ length: k }, () => ({ kind: 'frame', dt }));

  it('plays from the first day, and a frame walks the playhead', () => {
    const s = run(PLAY_HOME, { kind: 'toggle' });
    expect(s).toEqual({ mode: 'playing', t: 0, pos: 0 });
    expect(playAction(PLAY_HOME, 37)).toEqual({ act: 'play', day: 0 });
    expect(playAction(s, 37).act).toBe('pause');
    const later = run(s, ...frames(10));
    expect(later.t).toBe(500);
    expect(later.pos!).toBeGreaterThan(2);
  });

  it('comes back to today when pressed WHILE playing — and a later frame does not undo it', () => {
    const s = run(PLAY_HOME, { kind: 'toggle' }, ...frames(8), { kind: 'home' });
    expect(s).toEqual(PLAY_HOME);
    expect(run(s, ...frames(5))).toEqual(PLAY_HOME);
  });

  it('pauses where it is, and resumes from there — its name says Resume', () => {
    const paused = run(PLAY_HOME, { kind: 'toggle' }, ...frames(8), { kind: 'toggle' });
    expect(paused.mode).toBe('paused');
    expect(run(paused, ...frames(5))).toEqual(paused);
    expect(playAction(paused, 37).act).toBe('resume');
    const resumed = run(paused, { kind: 'toggle' }, { kind: 'frame', dt: 20 });
    expect(resumed.mode).toBe('playing');
    expect(resumed.t).toBe(paused.t + 20);
  });

  it('plays from the day the playhead was moved to — its name says that day', () => {
    const parked = run(PLAY_HOME, { kind: 'seek', day: 20 });
    expect(parked).toEqual({ mode: 'parked', t: 0, pos: 20.5 });
    expect(playAction(parked, 37)).toEqual({ act: 'play', day: 20 });
    expect(run(parked, { kind: 'toggle' })).toEqual({ mode: 'playing', t: clock.starts[20], pos: 20 });
    /* parked on the last day there is nothing left: Play replays the trip */
    const end = run(PLAY_HOME, { kind: 'seek', day: 99 });
    expect(end.pos).toBe(36.5);
    expect(playAction(end, 37)).toEqual({ act: 'play', day: 0 });
    /* a seek while playing stops Play there */
    expect(run(PLAY_HOME, { kind: 'toggle' }, ...frames(4), { kind: 'seek', day: 3 }).mode).toBe('parked');
  });

  it('comes home by itself when the replay ends, and never jumps more than 100 ms a frame', () => {
    const s = run(PLAY_HOME, { kind: 'toggle' }, { kind: 'frame', dt: 60_000 });
    expect(s.t).toBe(100);
    const all = run(PLAY_HOME, { kind: 'toggle' }, ...frames(Math.ceil(clock.total / 100) + 1, 100));
    expect(all).toEqual(PLAY_HOME);
  });
});

describe('replay · the bars under the scrubber', () => {
  const bars = scrubBars(trip, china.stops);
  it('draws one bar per stop, over its nights, and thin bars for the moves in and home', () => {
    expect(bars[0]).toEqual({ from: 0, to: 1, kind: 'move' }); // Nov 21–22: the flights in, the night in Yantai
    expect(bars[1]).toMatchObject({ from: 2, to: 13, kind: 'stop', stopId: 'cn26-stop-kunyu' });
    expect(bars.find((b) => b.stopId === 'cn26-stop-zhangjiajie')).toMatchObject({ from: 20, to: 22 });
    expect(bars[bars.length - 1]).toEqual({ from: 35, to: 36, kind: 'move' }); // Dec 26–27: home
    expect(bars.filter((b) => b.kind === 'stop').length).toBe(10);
  });
  it('covers every day exactly once', () => {
    const days = bars.flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, i) => b.from + i));
    expect(days).toEqual(Array.from({ length: 37 }, (_, i) => i));
  });
  it('dates the first day, every tenth and the last', () => {
    expect(scrubMarks(37)).toEqual([0, 10, 20, 30, 36]);
    expect(scrubMarks(60)).toEqual([0, 15, 30, 45, 59]);
    expect(scrubMarks(33)).toEqual([0, 10, 20, 32]);
    expect(scrubMarks(1)).toEqual([0]);
  });
  /* Run 3c: the S23's track (384 − 48 px) put "21 Dec" against "27 Dec" */
  it('drops the date that would touch the last one on a narrow track', () => {
    expect(scrubMarks(37, 364)).toEqual([0, 10, 20, 30, 36]); // 412 px: 4 px apart
    expect(scrubMarks(37, 336)).toEqual([0, 10, 20, 36]); // 384 px: they would touch
    expect(scrubMarks(60, 336)).toEqual([0, 15, 30, 45, 59]);
  });
});

describe('replay · the visa window as a bar', () => {
  it('runs from day 1 (23 Nov) to the last legal day (22 Dec), the deadline ticked', () => {
    const v = visaWindow(visa, trip, '2026-12-11')!;
    expect(v.from).toBe(2);
    expect(v.to).toBe(31);
    expect(v.planned).toBe(30);
    expect(v.deadline).toBe(true);
    expect(v.value).toBe('19 / 30');
    expect(v.exit).toBe('Exit by 22 Dec');
    expect(v.tone).toBe('');
  });
  it('says when it starts, before the count', () => {
    expect(visaWindow(visa, trip, '2026-11-21')!.value).toBe('starts 23 Nov');
    expect(visaWindow(visa, trip, '2026-11-22')!.value).toBe('starts 23 Nov');
  });
  it('goes loud near the limit and says the day you left, after it', () => {
    expect(visaWindow(visa, trip, '2026-12-17')!.tone).toBe('warn');
    expect(visaWindow(visa, trip, '2026-12-21')!.value).toBe('29 / 30');
    expect(visaWindow(visa, trip, '2026-12-21')!.tone).toBe('crit');
    expect(visaWindow(visa, trip, '2026-12-24')!.value).toBe('29 / 30 · left 21 Dec');
  });
  it('is over the limit, in red, past the last legal day with no planned exit', () => {
    const c: ComplianceCounter = { ...visa, plannedEndDate: undefined };
    const v = visaWindow(c, trip, '2026-12-24')!;
    expect(v.value).toBe('32 / 30 · over');
    expect(v.tone).toBe('crit');
  });
  it('ends the window on a hard deadline earlier than the limit', () => {
    const v = visaWindow({ ...visa, hardDeadline: '2026-12-20' }, trip, '2026-12-11')!;
    expect(v.to).toBe(29);
    expect(v.exit).toBe('Exit by 20 Dec');
  });
  it('draws nothing without a counter', () => {
    expect(visaWindow(undefined, trip, '2026-12-11')).toBeNull();
  });
});

describe('replay · where the trip is', () => {
  const where = (d: string): string => whereOn(china.stops, china.bookings, d);
  it('names the move on a travel day and the stop on any other', () => {
    expect(where('2026-12-11')).toBe('Shanghai + Disneyland → Zhangjiajie'); // Chongli until 2026-10-17
    expect(where('2026-12-12')).toBe('Zhangjiajie');
    expect(where('2026-12-05')).toBe('Kunyu Academy → Beijing');
  });
  it('says the flights in and the flights home at both ends', () => {
    expect(where('2026-11-21')).toBe('Flights in');
    expect(where('2026-11-22')).toBe('Flights in');
    expect(where('2026-12-26')).toBe('Flights home');
  });
});

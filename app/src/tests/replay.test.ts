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

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const trip = demo.trip;
const visa = demo.counters.find((c) => c.pinned)!;

describe('replay · the days', () => {
  it('lists every date of the trip, first to last', () => {
    const d = tripDates(trip);
    expect(d.length).toBe(31);
    expect(d[0]).toBe('2027-03-19');
    expect(d[21]).toBe('2027-04-09');
    expect(d[30]).toBe('2027-04-18');
  });
  it('places a date on the scrubber, clamped to the trip', () => {
    expect(dayIndex(trip, '2027-04-09')).toBe(21);
    expect(dayIndex(trip, '2026-12-28')).toBe(0);
    expect(dayIndex(trip, '2027-05-05')).toBe(30);
  });
});

describe('replay · the clock', () => {
  const dates = tripDates(trip);
  /* Apr 4 (Suzhou → Huangshan) and Apr 9 (Chengdu → Yangshuo) */
  const legs = new Set(['2027-04-04', '2027-04-09']);
  const clock = replayClock(dates, legs);

  it('holds a leg day for one comet and passes any other day quickly', () => {
    expect(clock.durs[16]).toBe(COMET_MS);
    expect(clock.durs[21]).toBe(COMET_MS);
    expect(clock.durs[0]).toBe(DAY_MS);
    expect(clock.total).toBe(29 * DAY_MS + 2 * COMET_MS);
    expect(clock.starts[1]).toBe(DAY_MS);
  });

  it('reads the playhead at any moment of Play', () => {
    expect(playheadAt(clock, 0)).toEqual({ index: 0, frac: 0 });
    const inLeg = playheadAt(clock, clock.starts[21]! + COMET_MS / 2);
    expect(inLeg.index).toBe(21);
    expect(inLeg.frac).toBeCloseTo(0.5, 5);
    expect(playheadAt(clock, clock.total + 50)).toEqual({ index: 30, frac: 1 });
  });
});

/* Run 3c: "Back to today" did nothing while Play ran — the next frame put
   the playhead back — and Play's name said "from <the first day>" after a pause or a
   drag. Every control is now an event on one state. */
describe('replay · Play, Pause, the scrubber and Back to today', () => {
  const clock = replayClock(tripDates(trip), new Set(['2027-04-04', '2027-04-09']));
  const run = (s: Playback, ...events: PlayEvent[]) => events.reduce((x, e) => playback(x, e, clock), s);
  const frames = (k: number, dt = 50): PlayEvent[] => Array.from({ length: k }, () => ({ kind: 'frame', dt }));

  it('plays from the first day, and a frame walks the playhead', () => {
    const s = run(PLAY_HOME, { kind: 'toggle' });
    expect(s).toEqual({ mode: 'playing', t: 0, pos: 0 });
    expect(playAction(PLAY_HOME, 31)).toEqual({ act: 'play', day: 0 });
    expect(playAction(s, 31).act).toBe('pause');
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
    expect(playAction(paused, 31).act).toBe('resume');
    const resumed = run(paused, { kind: 'toggle' }, { kind: 'frame', dt: 20 });
    expect(resumed.mode).toBe('playing');
    expect(resumed.t).toBe(paused.t + 20);
  });

  it('plays from the day the playhead was moved to — its name says that day', () => {
    const parked = run(PLAY_HOME, { kind: 'seek', day: 21 });
    expect(parked).toEqual({ mode: 'parked', t: 0, pos: 21.5 });
    expect(playAction(parked, 31)).toEqual({ act: 'play', day: 21 });
    expect(run(parked, { kind: 'toggle' })).toEqual({ mode: 'playing', t: clock.starts[21], pos: 21 });
    /* parked on the last day there is nothing left: Play replays the trip */
    const end = run(PLAY_HOME, { kind: 'seek', day: 99 });
    expect(end.pos).toBe(30.5);
    expect(playAction(end, 31)).toEqual({ act: 'play', day: 0 });
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
  const bars = scrubBars(trip, demo.stops);
  it('draws one bar per stop, over its nights, and thin bars for the moves in and home', () => {
    /* Mar 19–20: the flights in, and the arrival night by Hangzhou East before the school opens */
    expect(bars[0]).toEqual({ from: 0, to: 1, kind: 'move' });
    expect(bars[1]).toMatchObject({ from: 2, to: 9, kind: 'stop', stopId: 'dm27-stop-hangzhou' }); // the nights of Mar 21–28
    expect(bars.find((b) => b.stopId === 'dm27-stop-huangshan')).toMatchObject({ from: 16, to: 18 }); // Apr 4–6
    expect(bars[bars.length - 1]).toEqual({ from: 29, to: 30, kind: 'move' }); // Apr 17–18: home
    /* nine stops — the flights are a transit, not a stop */
    expect(bars.filter((b) => b.kind === 'stop').length).toBe(9);
  });
  it('covers every day exactly once', () => {
    const days = bars.flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, i) => b.from + i));
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i));
  });
  it('dates the first day, every tenth and the last', () => {
    expect(scrubMarks(31)).toEqual([0, 10, 20, 30]);
    expect(scrubMarks(37)).toEqual([0, 10, 20, 30, 36]);
    expect(scrubMarks(60)).toEqual([0, 15, 30, 45, 59]);
    expect(scrubMarks(33)).toEqual([0, 10, 20, 32]);
    expect(scrubMarks(1)).toEqual([0]);
  });
  /* Run 3c: on a 37-day trip the S23's track (384 − 48 px) put the 31st day's date against the last's */
  it('drops the date that would touch the last one on a narrow track', () => {
    expect(scrubMarks(37, 364)).toEqual([0, 10, 20, 30, 36]); // 412 px: 4 px apart
    expect(scrubMarks(37, 336)).toEqual([0, 10, 20, 36]); // 384 px: they would touch
    expect(scrubMarks(60, 336)).toEqual([0, 15, 30, 45, 59]);
  });
});

describe('replay · the visa window as a bar', () => {
  /* entry Mar 20, counted from the day after: day 1 = Mar 21, day 25 = Apr 14 = the deadline; exit planned Apr 13 */
  it('runs from day 1 (21 Mar) to the last legal day (14 Apr), the deadline ticked', () => {
    const v = visaWindow(visa, trip, '2027-04-08')!;
    expect(v.from).toBe(2);
    expect(v.to).toBe(26);
    expect(v.planned).toBe(25);
    expect(v.deadline).toBe(true);
    expect(v.value).toBe('19 / 25');
    expect(v.exit).toBe('Exit by 14 Apr');
    expect(v.tone).toBe('');
  });
  it('says when it starts, before the count', () => {
    expect(visaWindow(visa, trip, '2027-03-19')!.value).toBe('Day 1 = 21 Mar');
    expect(visaWindow(visa, trip, '2027-03-20')!.value).toBe('Day 1 = 21 Mar');
  });
  it('goes loud near the limit and says the day you left, after it', () => {
    expect(visaWindow(visa, trip, '2027-04-09')!.tone).toBe('warn'); // day 20, five left
    expect(visaWindow(visa, trip, '2027-04-13')!.value).toBe('24 / 25');
    expect(visaWindow(visa, trip, '2027-04-13')!.tone).toBe('crit');
    expect(visaWindow(visa, trip, '2027-04-16')!.value).toBe('24 / 25 · left 13 Apr');
  });
  it('is over the limit, in red, past the last legal day with no planned exit', () => {
    const c: ComplianceCounter = { ...visa, plannedEndDate: undefined };
    const v = visaWindow(c, trip, '2027-04-17')!;
    expect(v.value).toBe('28 / 25 · over');
    expect(v.tone).toBe('crit');
  });
  it('ends the window on a hard deadline earlier than the limit', () => {
    const v = visaWindow({ ...visa, hardDeadline: '2027-04-12' }, trip, '2027-04-08')!;
    expect(v.to).toBe(24);
    expect(v.exit).toBe('Exit by 12 Apr');
  });
  it('draws nothing without a counter', () => {
    expect(visaWindow(undefined, trip, '2027-04-08')).toBeNull();
  });
});

describe('replay · where the trip is', () => {
  const where = (d: string): string => whereOn(demo.stops, demo.bookings, d);
  it('names the move on a travel day and the stop on any other', () => {
    expect(where('2027-04-04')).toBe('Suzhou + the gardens → Huangshan');
    expect(where('2027-04-05')).toBe('Huangshan');
    /* a stop's name is cut at its aside: "Tai-chi school — Hangzhou" */
    expect(where('2027-03-29')).toBe('Tai-chi school → Shanghai');
  });
  it('says the flights in and the flights home at both ends', () => {
    expect(where('2027-03-19')).toBe('Flights in');
    expect(where('2027-03-20')).toBe('Flights in');
    expect(where('2027-04-17')).toBe('Flights home');
  });
});

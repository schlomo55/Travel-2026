/* THE REMINDER PLAN (Reminders, Parts 1–3): what rings, when, and with what
   words, pinned on the real China trip with the phone still in Tel Aviv. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, ReminderPrefs } from '../lib/model/types';
import { leaveLead, masked, maskRef, MAX_PLANNED, nextUp, planNotifications, reminderPrefs, reminderTrip, stableId, type PlanInput } from '../lib/logic/notify';
import { zonePlan, type OffsetAt } from '../lib/logic/tripzone';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const ISRAEL_DST_END = Date.UTC(2026, 9, 24, 23, 0);
const israel: OffsetAt = (ms) => (ms < ISRAEL_DST_END ? 180 : 120);
const utc = (y: number, mo: number, d: number, h: number, mi = 0): number => Date.UTC(y, mo - 1, d, h, mi);
const NOW = utc(2026, 10, 1, 9);

function input(prefs: ReminderPrefs | undefined = { on: true }, over: Partial<PlanInput> = {}): PlanInput {
  return {
    trip: china.trip,
    bookings: china.bookings,
    alarms: china.alarms,
    tasks: china.tasks,
    counters: china.counters,
    stops: china.stops,
    dayPlans: china.dayPlans,
    dayDefaults: china.dayDefaults,
    prefs,
    lastBackupAt: NOW,
    lastMutationAt: NOW - 1000,
    weather: {},
    zone: zonePlan(china.bookings, NOW, israel),
    now: NOW,
    ...over,
  };
}
const flight = (no: string) => china.bookings.find((b) => b.kind === 'flight' && b.flightNo === no)!;

describe('the switches', () => {
  it('rings nothing until the owner turns reminders on', () => {
    expect(planNotifications(input({}))).toEqual([]);
    expect(reminderPrefs(undefined)).toMatchObject({ on: false, alarms: true, legs: true, morning: false, evening: true, lead: 30 });
  });

  it('a category switched off rings nothing of its kind', () => {
    const plan = planNotifications(input({ on: true, legs: false, travelCard: false }));
    expect(plan.some((x) => x.title.startsWith('✈'))).toBe(false);
  });
});

describe('timed moments', () => {
  it('the Jade Dragon release rings at 19:45 Beijing, with a 30-minute heads-up', () => {
    const a = china.alarms.find((x) => x.date === '2026-12-10' && x.time === '19:45')!;
    const plan = planNotifications(input());
    const main = plan.find((x) => x.id === stableId(`alarm:${a.id}`))!;
    const soon = plan.find((x) => x.id === stableId(`alarm-soon:${a.id}`))!;
    expect(main.at).toBe(utc(2026, 12, 10, 11, 45));
    expect(soon.at).toBe(utc(2026, 12, 10, 11, 15));
    expect(soon.title).toMatch(/^⏰ In 30 min: /);
    expect(main.action).toBe('item');
    expect(main.ref).toEqual({ kind: 'alarm', id: a.id });
  });

  it('a done moment stays silent, and a heads-up of 0 means none', () => {
    const done = china.alarms.find((x) => x.done)!;
    const plan = planNotifications(input({ on: true, lead: 0 }));
    expect(plan.some((x) => x.ref?.id === done.id)).toBe(false);
    expect(plan.some((x) => x.title.startsWith('⏰ In '))).toBe(false);
  });
});

describe('legs', () => {
  it('leave 2 h before a mainland flight, 3 h before one that crosses a border', () => {
    expect(leaveLead(flight('CA 8641'))).toBe(2 * 3600_000);
    expect(leaveLead(flight('EY 888'))).toBe(3 * 3600_000);
    expect(leaveLead(flight('MU 733'))).toBe(3 * 3600_000); // Kunming → Hong Kong: same clock, own border
  });

  it('CA1560 on 5 Dec: leave at 12:55 Beijing; check-in opens the day before', () => {
    const b = flight('CA 1560');
    const plan = planNotifications(input());
    const leave = plan.find((x) => x.id === stableId(`leave:${b.id}`))!;
    expect(leave.at).toBe(utc(2026, 12, 5, 4, 55));
    expect(leave.title).toBe('✈ Leave for the airport: CA 1560 at 14:55');
    expect(leave.body).toContain('YNT → PEK');
    expect(leave.action).toBe('leg');
    const checkin = plan.find((x) => x.id === stableId(`checkin:${b.id}`))!;
    expect(checkin.at).toBe(utc(2026, 12, 4, 6, 55));
  });

  it('a connection is not a fresh departure: no "leave for the airport" inside a journey', () => {
    const plan = planNotifications(input());
    const leave = (no: string) => plan.some((x) => x.id === stableId(`leave:${flight(no).id}`));
    expect(leave('EY 608')).toBe(true);
    expect(leave('EY 888')).toBe(false); // Abu Dhabi, 2 h later
    expect(leave('CA 8641')).toBe(false); // Daxing, 6 h 15 later
    expect(leave('EY 871')).toBe(true);
    expect(leave('EY 609')).toBe(false); // Abu Dhabi on the way home
    /* check-in still opens for every flight */
    expect(plan.some((x) => x.id === stableId(`checkin:${flight('CA 8641').id}`))).toBe(true);
  });

  it('a booking reference is masked on the lock screen', () => {
    expect(maskRef('ABC9EM')).toBe('••••9EM');
    expect(maskRef('AB')).toBe('AB');
    expect(maskRef(undefined)).toBeNull();
    const plan = planNotifications(input());
    /* the refs the planner itself writes; a to-do's own words are the owner's */
    for (const x of plan.filter((y) => y.channel === 'travel' || y.channel === 'card')) {
      for (const b of china.bookings) if (b.code && b.code.length > 3) expect(`${x.title} ${x.body}`).not.toContain(b.code);
    }
  });
});

describe('the travel-day card and "You\'ve landed"', () => {
  it('21 Nov: one journey, Tel Aviv to Yantai; the card 4 h before EY608, the landing at Yantai', () => {
    const plan = planNotifications(input());
    const card = plan.find((x) => x.id === stableId(`card:${flight('EY 608').id}`))!;
    const landed = plan.find((x) => x.id === stableId(`landed:${flight('CA 8641').id}`))!;
    expect(card.id).not.toBe(landed.id);
    expect(card.channel).toBe('card');
    expect(card.ongoing).toBeFalsy();
    expect(card.at).toBe(utc(2026, 11, 21, 8)); // 14:00 Tel Aviv − 4 h
    expect(card.body).toContain('2 more legs');
    expect(card.until).toBe(utc(2026, 11, 22, 8, 20)); // lands YNT 16:20
    expect(landed.title).toMatch(/^🛬 Welcome to /);
    expect(landed.at).toBe(utc(2026, 11, 22, 8, 30));
    expect(plan.some((x) => x.id === stableId(`card:${flight('EY 888').id}`))).toBe(false);
  });

  it('the flight home ends in "Welcome home", not a bed that is not in the trip', () => {
    const plan = planNotifications(input());
    const home = plan.find((x) => x.id === stableId(`landed:${flight('EY 609').id}`))!;
    expect(home.title).toBe('🛬 Welcome home');
  });
});

describe('to-dos and quiet hours', () => {
  it('a to-do with a due date rings at 09:00 the day before and on the day', () => {
    const t = china.tasks.find((x) => !x.done && x.due && x.due > '2026-10-02')!;
    const plan = planNotifications(input());
    const before = plan.find((x) => x.id === stableId(`task-1:${t.id}`))!;
    const on = plan.find((x) => x.id === stableId(`task-0:${t.id}`))!;
    expect(before.wall.time).toBe('09:00');
    expect(on.wall).toEqual({ date: t.due, time: '09:00' });
    expect(on.title).toMatch(/^📋 Due today: /);
  });

  it('quiet hours move a to-do to the morning, but never a flight', () => {
    const t = china.tasks.find((x) => !x.done && x.due && x.due > '2026-10-02')!;
    const plan = planNotifications(input({ on: true, quietFrom: '08:00', quietTo: '10:00' }));
    expect(plan.find((x) => x.id === stableId(`task-0:${t.id}`))!.wall.time).toBe('10:00');
    const leave = plan.find((x) => x.id === stableId(`leave:${flight('CA 1560').id}`))!;
    expect(leave.at).toBe(utc(2026, 12, 5, 4, 55));
  });
});

describe('visa-free days', () => {
  it('rings as the limit gets close and on the planned exit day', () => {
    const c = china.counters[0];
    if (!c) return;
    const plan = planNotifications(input());
    const visa = plan.filter((x) => x.title.startsWith('🛂'));
    expect(visa.length).toBeGreaterThanOrEqual(c.plannedEndDate ? 1 : 0);
    for (const v of visa) expect(v.route).toBe(`#/trip/${china.trip.id}/pocket/visa`);
  });
});

describe('the backup', () => {
  it('rings three days after changes nobody saved, and not when the backup is newer', () => {
    const stale = planNotifications(input({ on: true }, { lastBackupAt: NOW - 1000, lastMutationAt: NOW }));
    const b = stale.find((x) => x.id === stableId('backup'))!;
    expect(b.at).toBeGreaterThan(NOW + 2.5 * 86_400_000);
    expect(b.action).toBe('backup');
    expect(planNotifications(input()).some((x) => x.id === stableId('backup'))).toBe(false);
  });
});

describe('the briefs', () => {
  it('the morning brief is off by default and on when asked', () => {
    expect(planNotifications(input()).some((x) => x.title.startsWith('☀'))).toBe(false);
    const plan = planNotifications(input({ on: true, morning: true }));
    const nov23 = plan.find((x) => x.id === stableId(`morning:${china.trip.id}:2026-11-23`));
    expect(nov23?.wall.time).toBe('08:00');
  });

  it('the evening before a travel day says so', () => {
    const plan = planNotifications(input());
    const e = plan.find((x) => x.id === stableId(`evening:${china.trip.id}:2026-12-16`))!;
    expect(e.wall).toEqual({ date: '2026-12-15', time: '20:00' });
  });

  it('the forecast joins the brief when the app has one', () => {
    const stop = china.stops.find((s) => s.kind === 'stop' && s.start <= '2026-12-14' && s.end > '2026-12-14')!;
    const weather = { [stop.id]: { fetchedAt: NOW, daily: [{ date: '2026-12-14', code: 61, tmin: 4, tmax: 11, snow: 0, pp: 80 }] } };
    const plan = planNotifications(input({ on: true, morning: true }, { weather }));
    const m = plan.find((x) => x.id === stableId(`morning:${china.trip.id}:2026-12-14`))!;
    expect(m.title).toContain('🌧');
    expect(m.title).toContain('4°…11°');
  });
});

describe('what a lock screen may say', () => {
  it('masks booking codes, long numbers and phone numbers, and keeps amounts', () => {
    expect(masked('Trip.com 1653 7166 9040 6769, PNR 8CR7MR')).toBe('Trip.com ••••769, PNR ••••7MR');
    expect(masked('call +86 535 339 9333 at the desk')).toBe('call +•••• at the desk');
    expect(masked('US$940 cash and ¥4,200 at 09:30')).toBe('US$940 cash and ¥4,200 at 09:30');
  });

  it('no alarm or to-do in the plan spells out a booking code', () => {
    const plan = planNotifications(input());
    const codes = china.bookings.map((b) => b.code).filter((c): c is string => !!c && c.length > 5);
    for (const x of plan) for (const c of codes) expect(`${x.title} ${x.body}`).not.toContain(c);
  });
});

describe('which trip rings', () => {
  const t = (id: string, start: string, end: string, extra: Record<string, unknown> = {}) =>
    ({ id, start, end, archived: false, emoji: '', title: id, ...extra }) as never;
  const china26 = t('cn26', '2026-11-21', '2026-12-27');
  const israel = t('il26', '2026-07-25', '2026-09-22', { emoji: '🧪', title: '🧪 TEST — Israel' });
  const porto = t('tx00', '2027-04-12', '2027-04-16', { emoji: '🧪' });

  it('before the trip, the next real trip, even right after a rehearsal on a sample one', () => {
    expect(reminderTrip([israel, china26, porto], '2026-10-01', 'il26')).toBe(china26);
  });
  it('on the road, the trip on the road', () => {
    expect(reminderTrip([china26, porto], '2026-12-01', null)).toBe(china26);
  });
  it('a sample trip never rings', () => {
    expect(reminderTrip([israel, porto], '2026-08-01', 'il26')).toBeNull();
  });
});

describe('the list itself', () => {
  it('is stable across re-plans, soonest first, capped', () => {
    const a = planNotifications(input({ on: true, morning: true }));
    const b = planNotifications(input({ on: true, morning: true }));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    for (let i = 1; i < a.length; i++) expect(a[i]!.at).toBeGreaterThanOrEqual(a[i - 1]!.at);
    expect(a.length).toBeLessThanOrEqual(MAX_PLANNED);
    expect(a.every((x) => x.at > NOW)).toBe(true);
  });

  it('nextUp skips the pinned card', () => {
    const plan = planNotifications(input());
    expect(nextUp(plan, NOW)?.ongoing).toBeFalsy();
  });

  it('ids are positive 31-bit integers', () => {
    for (const k of ['a', 'alarm:cn26-alarm-25', 'card:cn26:2026-11-22']) {
      const id = stableId(k);
      expect(id).toBeGreaterThan(0);
      expect(id).toBeLessThan(2 ** 31);
    }
  });
});

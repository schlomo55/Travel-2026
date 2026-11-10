/* THE REMINDER PLAN (Reminders, Parts 1–3): what rings, when, and with what
   words, pinned on the demo trip with the phone still at home in Paris. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, ReminderPrefs } from '../lib/model/types';
import { leaveLead, masked, maskRef, MAX_PLANNED, nextUp, planNotifications, reminderGap, reminderPrefs, reminderTrip, stableId, type PlanInput } from '../lib/logic/notify';
import { zonePlan, type OffsetAt } from '../lib/logic/tripzone';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
/* Paris: CET (+1) until the last Sunday of March, then CEST (+2) */
const PARIS_DST_START = Date.UTC(2027, 2, 28, 1, 0);
const paris: OffsetAt = (ms) => (ms < PARIS_DST_START ? 60 : 120);
const utc = (y: number, mo: number, d: number, h: number, mi = 0): number => Date.UTC(y, mo - 1, d, h, mi);
const NOW = utc(2027, 2, 20, 9);

function input(prefs: ReminderPrefs | undefined = { on: true }, over: Partial<PlanInput> = {}): PlanInput {
  return {
    trip: demo.trip,
    bookings: demo.bookings,
    alarms: demo.alarms,
    tasks: demo.tasks,
    counters: demo.counters,
    stops: demo.stops,
    dayPlans: demo.dayPlans,
    dayDefaults: demo.dayDefaults,
    prefs,
    lastBackupAt: NOW,
    lastMutationAt: NOW - 1000,
    weather: {},
    zone: zonePlan(demo.bookings, NOW, paris),
    now: NOW,
    ...over,
  };
}
const flight = (no: string) => demo.bookings.find((b) => b.kind === 'flight' && b.flightNo === no)!;

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
  it('the museum ticket release rings at 19:45 Shanghai, with a 30-minute heads-up', () => {
    const a = demo.alarms.find((x) => x.date === '2027-03-23' && x.time === '19:45')!;
    const plan = planNotifications(input());
    const main = plan.find((x) => x.id === stableId(`alarm:${a.id}`))!;
    const soon = plan.find((x) => x.id === stableId(`alarm-soon:${a.id}`))!;
    expect(main.at).toBe(utc(2027, 3, 23, 11, 45));
    expect(soon.at).toBe(utc(2027, 3, 23, 11, 15));
    expect(soon.title).toMatch(/^⏰ In 30 min: /);
    expect(main.action).toBe('item');
    expect(main.ref).toEqual({ kind: 'alarm', id: a.id });
  });

  it('a done moment stays silent, and a heads-up of 0 means none', () => {
    const done = demo.alarms.find((x) => x.done)!;
    const plan = planNotifications(input({ on: true, lead: 0 }));
    expect(plan.some((x) => x.ref?.id === done.id)).toBe(false);
    expect(plan.some((x) => x.title.startsWith('⏰ In '))).toBe(false);
  });
});

describe('legs', () => {
  it('leave 2 h before a mainland flight, 3 h before one that crosses a border', () => {
    expect(leaveLead(flight('MU 5001'))).toBe(2 * 3600_000);
    expect(leaveLead(flight('AY 9057'))).toBe(3 * 3600_000);
    expect(leaveLead(flight('CZ 9005'))).toBe(3 * 3600_000); // Guilin → Hong Kong: same clock, own border
  });

  it('MU5001 on 4 Apr: leave at 17:10 Shanghai; check-in opens the day before', () => {
    const b = flight('MU 5001');
    const plan = planNotifications(input());
    const leave = plan.find((x) => x.id === stableId(`leave:${b.id}`))!;
    expect(leave.at).toBe(utc(2027, 4, 4, 9, 10));
    expect(leave.title).toBe('✈ Leave for the airport: MU 5001 at 19:10');
    expect(leave.body).toContain('SHA → TXN');
    expect(leave.action).toBe('leg');
    const checkin = plan.find((x) => x.id === stableId(`checkin:${b.id}`))!;
    expect(checkin.at).toBe(utc(2027, 4, 3, 11, 10));
    /* the cancelled MU5003 rings nothing */
    expect(plan.some((x) => x.id === stableId(`leave:${flight('MU 5003').id}`))).toBe(false);
  });

  it('a connection is not a fresh departure: no "leave for the airport" inside a journey', () => {
    const plan = planNotifications(input());
    const leave = (no: string) => plan.some((x) => x.id === stableId(`leave:${flight(no).id}`));
    expect(leave('AY 1501')).toBe(true);
    expect(leave('AY 9057')).toBe(false); // Helsinki, 2 h 10 later
    expect(leave('AY 9070')).toBe(true);
    expect(leave('AY 1506')).toBe(false); // Helsinki on the way home
    /* check-in still opens for every flight */
    expect(plan.some((x) => x.id === stableId(`checkin:${flight('AY 9057').id}`))).toBe(true);
    expect(plan.some((x) => x.id === stableId(`checkin:${flight('AY 1506').id}`))).toBe(true);
  });

  it('a booking reference is masked on the lock screen', () => {
    expect(maskRef('DEMOAY')).toBe('••••OAY');
    expect(maskRef('AB')).toBe('AB');
    expect(maskRef(undefined)).toBeNull();
    const plan = planNotifications(input());
    /* the refs the planner itself writes; a to-do's own words are the owner's */
    for (const x of plan.filter((y) => y.channel === 'travel' || y.channel === 'card')) {
      for (const b of demo.bookings) if (b.code && b.code.length > 3) expect(`${x.title} ${x.body}`).not.toContain(b.code);
    }
  });
});

describe('the travel-day card and "You\'ve landed"', () => {
  it('19 Mar: one journey, Paris to Pudong; the card 4 h before AY1501, the landing at PVG', () => {
    const plan = planNotifications(input());
    const card = plan.find((x) => x.id === stableId(`card:${flight('AY 1501').id}`))!;
    const landed = plan.find((x) => x.id === stableId(`landed:${flight('AY 9057').id}`))!;
    expect(card.id).not.toBe(landed.id);
    expect(card.channel).toBe('card');
    expect(card.ongoing).toBeFalsy();
    expect(card.at).toBe(utc(2027, 3, 19, 6, 5)); // 11:05 Paris (CET) − 4 h
    expect(card.body).toContain('one more leg');
    expect(card.until).toBe(utc(2027, 3, 20, 0, 50)); // lands PVG 08:50
    expect(landed.title).toMatch(/^🛬 Welcome to /);
    expect(landed.at).toBe(utc(2027, 3, 20, 1, 0));
    expect(plan.some((x) => x.id === stableId(`card:${flight('AY 9057').id}`))).toBe(false);
  });

  it('the flight home ends in "Welcome home", not a bed that is not in the trip', () => {
    const plan = planNotifications(input());
    const home = plan.find((x) => x.id === stableId(`landed:${flight('AY 1506').id}`))!;
    expect(home.title).toBe('🛬 Welcome home');
  });
});

describe('to-dos and quiet hours', () => {
  it('a to-do with a due date rings at 09:00 the day before and on the day', () => {
    const t = demo.tasks.find((x) => !x.done && x.due && x.due > '2027-02-21')!;
    const plan = planNotifications(input());
    const before = plan.find((x) => x.id === stableId(`task-1:${t.id}`))!;
    const on = plan.find((x) => x.id === stableId(`task-0:${t.id}`))!;
    expect(before.wall.time).toBe('09:00');
    expect(on.wall).toEqual({ date: t.due, time: '09:00' });
    expect(on.title).toMatch(/^📋 Due today: /);
  });

  it('quiet hours move a to-do to the morning, but never a flight', () => {
    const t = demo.tasks.find((x) => !x.done && x.due && x.due > '2027-02-21')!;
    const plan = planNotifications(input({ on: true, quietFrom: '08:00', quietTo: '10:00' }));
    expect(plan.find((x) => x.id === stableId(`task-0:${t.id}`))!.wall.time).toBe('10:00');
    const leave = plan.find((x) => x.id === stableId(`leave:${flight('MU 5001').id}`))!;
    expect(leave.at).toBe(utc(2027, 4, 4, 9, 10));
  });
});

describe('visa-free days', () => {
  it('rings as the limit gets close and on the planned exit day', () => {
    const c = demo.counters[0]!;
    expect(c.plannedEndDate).toBe('2027-04-13');
    const plan = planNotifications(input());
    const visa = plan.filter((x) => x.title.startsWith('🛂'));
    expect(visa.length).toBeGreaterThanOrEqual(1);
    for (const v of visa) expect(v.route).toBe(`#/trip/${demo.trip.id}/pocket/visa`);
    /* the planned exit day itself rings */
    expect(visa.some((v) => v.wall.date === '2027-04-13')).toBe(true);
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
    const mar22 = plan.find((x) => x.id === stableId(`morning:${demo.trip.id}:2027-03-22`));
    expect(mar22?.wall.time).toBe('08:00');
  });

  it('the evening before a travel day says so', () => {
    const plan = planNotifications(input());
    const e = plan.find((x) => x.id === stableId(`evening:${demo.trip.id}:2027-04-04`))!;
    expect(e.wall).toEqual({ date: '2027-04-03', time: '20:00' });
    expect(e.title).toBe('🌆 Tomorrow is a travel day');
  });

  it('the forecast joins the brief when the app has one', () => {
    const stop = demo.stops.find((s) => s.kind === 'stop' && s.start <= '2027-04-05' && s.end > '2027-04-05')!;
    expect(stop.id).toBe('dm27-stop-huangshan');
    const weather = { [stop.id]: { fetchedAt: NOW, daily: [{ date: '2027-04-05', code: 61, tmin: 4, tmax: 11, snow: 0, pp: 80 }] } };
    const plan = planNotifications(input({ on: true, morning: true }, { weather }));
    const m = plan.find((x) => x.id === stableId(`morning:${demo.trip.id}:2027-04-05`))!;
    expect(m.title).toContain('🌧');
    expect(m.title).toContain('4°…11°');
  });
});

describe('what a lock screen may say', () => {
  it('masks booking codes, long numbers and phone numbers, and keeps amounts', () => {
    expect(masked('Sample Agency 1234 5678 9012 3456, PNR DEMO7Q')).toBe('Sample Agency ••••456, PNR ••••O7Q');
    expect(masked('call +86 571 0000 0001 at the desk')).toBe('call +•••• at the desk');
    expect(masked('US$720 cash and ¥1,180 at 09:30')).toBe('US$720 cash and ¥1,180 at 09:30');
  });

  it('no alarm or to-do in the plan spells out a booking code', () => {
    const plan = planNotifications(input());
    const codes = demo.bookings.map((b) => b.code).filter((c): c is string => !!c && c.length > 5);
    for (const x of plan) for (const c of codes) expect(`${x.title} ${x.body}`).not.toContain(c);
  });
});

describe('which trip rings', () => {
  const t = (id: string, start: string, end: string, extra: Record<string, unknown> = {}) =>
    ({ id, start, end, archived: false, emoji: '', title: id, ...extra }) as never;
  /* a synthetic real trip next to the three sample ones in the repo */
  const real = t('rl26', '2026-11-21', '2026-12-27');
  const israel = t('il26', '2026-07-25', '2026-09-22', { emoji: '🧪', title: '🧪 TEST — Israel' });
  const sample = t('dm27', '2027-03-19', '2027-04-18', { emoji: '🧪', title: 'TEST — Demo China' });
  const porto = t('tx00', '2027-04-12', '2027-04-16', { emoji: '🧪' });

  it('before the trip, the next real trip, even right after a rehearsal on a sample one', () => {
    expect(reminderTrip([israel, real, sample, porto], '2026-10-01', 'il26')).toBe(real);
  });
  it('on the road, the trip on the road', () => {
    expect(reminderTrip([real, sample, porto], '2026-12-01', null)).toBe(real);
  });
  it('a sample trip never rings', () => {
    expect(reminderTrip([israel, porto], '2026-08-01', 'il26')).toBeNull();
    expect(reminderTrip([sample, porto], '2027-03-25', 'dm27')).toBeNull();
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
    for (const k of ['a', 'alarm:dm27-alarm-14', 'card:dm27:2027-03-19']) {
      const id = stableId(k);
      expect(id).toBeGreaterThan(0);
      expect(id).toBeLessThan(2 ** 31);
    }
  });
});

/* QA, 7 Nov 2026: Now shows a banner while reminders cannot ring. */
describe('reminderGap — what Now’s banner says', () => {
  it('off in the app, whatever Android allows — never set up counts as off', () => {
    expect(reminderGap(undefined, 'granted')).toBe('off');
    expect(reminderGap({ on: false }, 'granted')).toBe('off');
  });
  it('on, but Android has not granted the permission', () => {
    expect(reminderGap({ on: true }, 'denied')).toBe('denied');
    expect(reminderGap({ on: true }, 'prompt')).toBe('denied');
  });
  it('on and allowed: no banner', () => {
    expect(reminderGap({ on: true }, 'granted')).toBeNull();
  });
});

/* 10 Nov 2026, the phone test: the Remind me sheet said "Reminder set" with the setting off and no
   permission. One question — can a reminder ring? — answered here for Now's banner AND the sheet. */
describe('reminderGap — can a reminder ring?', () => {
  it('the setting is off: no, whatever Android allows', () => {
    expect(reminderGap({ on: false }, 'granted')).toBe('off');
    expect(reminderGap({ on: false }, 'denied')).toBe('off');
    expect(reminderGap(undefined, 'granted')).toBe('off');
  });
  it('the setting is on, Android says denied: no', () => {
    expect(reminderGap({ on: true }, 'denied')).toBe('denied');
  });
  it('the setting is on, the permission never asked or unknown: no', () => {
    expect(reminderGap({ on: true }, 'prompt')).toBe('denied');
    expect(reminderGap({ on: true }, '')).toBe('denied');
  });
  it('a browser: no, even with the setting on and the permission granted', () => {
    expect(reminderGap({ on: true }, 'granted', false)).toBe('off');
    expect(reminderGap(undefined, 'denied', false)).toBe('off');
  });
  it('the Android app, setting on, permission granted: yes', () => {
    expect(reminderGap({ on: true }, 'granted', true)).toBeNull();
    expect(reminderGap({ on: true }, 'granted')).toBeNull();
  });
});

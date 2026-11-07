/* TO DO, FOLDED INTO TIME — each thing on its day, everything past in one
   Earlier group (kept, never claimed done or not), and a count of what is
   still open from today on. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Task } from '../lib/model/types';
import { dueNote, todoNext, todoOn, todoPlan } from '../lib/logic/todo';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const plan = todoPlan(china.tasks, china.alarms, china.bookings, '2026-12-11');

describe('to do · the real trip on Fri 11 Dec', () => {
  it('puts today’s alarm on today, and the 重庆1949 to-do on its own day', () => {
    const today = todoOn(plan, '2026-12-11');
    /* 11:00 (check out of Element) until 2026-10-17; then 16:00, and 15:30 once MU394's booking
       advised being at PVG 2 h before — collect the bag at Hi Cozy → Line 2 to Pudong */
    expect(today.some((i) => i.kind === 'alarm' && i.time === '15:30')).toBe(true);
    const sat = todoOn(plan, '2026-12-12');
    expect(sat.map((i) => i.id)).toContain(china.tasks.find((t) => /1949/.test(t.title))!.id);
  });

  it('carries the bookings still to buy on their days — Tianmen on the 14th', () => {
    const mon = todoOn(plan, '2026-12-14');
    const tianmen = mon.find((i) => i.id === 'cn26-ticket-tianmen');
    expect(tianmen?.kind).toBe('booking');
    /* a booked thing is not a to-do, and an either/or leg is never one */
    const all = plan.days.flatMap((d) => d.items);
    expect(all.some((i) => i.booking?.status === 'booked')).toBe(false);
    expect(all.some((i) => i.booking?.alternative)).toBe(false);
  });

  /* 28 → 24 on 27–28 Sep 2026: lijiang-bagtransfer, yantai-flights (CA1560
     booked), yantai-bed (the Muping night booked), psb (the school registers
     you) and late-arrivals closed, and cash-plan opened (no ATM in China, due
     12 Oct) — the rehearsal's to-do count carries the same history.
     24 → 25 → 24 on 29 Sep 2026: muping-late-arrival opened, then closed the
     same day once Trip.com confirmed the request reached the hotel.
     24 → 30 on 17 Oct 2026, skiing dropped: ski-lesson closed, and seven
     opened for Shanghai (the Meliá, the Disney ticket, the train, MU394, the
     CA8609 refund, the Element cancellation, the Pullman's ~22:30) — every one
     due before Dec 11, so all seven land in Earlier.
     30 → 28 the same evening: the Hi Cozy hostel was booked in the Meliá's
     place and Element was cancelled, so `melia` and `element-cancel` closed. */
  /* 28 → 27 later still on 17 Oct: MU394 booked, so `mu394` closed; 27 → 26:
     the Dec 9 train reserved, so `train-shanghai` closed.
     26 → 28 in the 17 Oct follow-up: + a personal to-do (Oct 16, since removed) and
     + hicozy-arrival (Dec 1) — both before Dec 11, so both land in Earlier.
     28 → 27 later on 17 Oct: `cash-plan` (Oct 17, in Earlier) closed — the cash
     was ordered at Bank Hapoalim.
     27 → 26 on 18 Oct: `hicozy-arrival` closed — Hi Cozy was told ~15:20. */
  it('folds everything before today into Earlier, newest first, all 25 to-dos accounted for', () => {
    const tasks = [...plan.earlier, ...plan.days.flatMap((d) => d.items), ...plan.undated].filter((i) => i.kind === 'task');
    expect(tasks).toHaveLength(25);
    expect(plan.earlier.filter((i) => i.kind === 'task')).toHaveLength(24);
    const dates = plan.earlier.map((i) => i.date!);
    expect([...dates].sort().reverse()).toEqual(dates);
    /* → 25 on 4 Nov 2026: + beijing-hikers, − wall-guide (the Wild Great Wall plan,
       superseded), two personal to-dos removed — and the CA8609 refund check is the one
       task ticked in the trip file (done 4 Nov), so of the 24 in Earlier 23 are late.
       23 → 22 on 5 Nov 2026: the eSIM was bought, so `esim` ships ticked too. */
    expect(plan.earlier.filter((i) => i.late)).toHaveLength(22);
  });

  it('orders a day by the clock, untimed last', () => {
    for (const d of plan.days) {
      const times = d.items.map((i) => i.time ?? '99:99');
      expect([...times].sort()).toEqual(times);
    }
  });

  it('counts what is still open from today on', () => {
    const open = plan.days.flatMap((d) => d.items).filter((i) => !i.done).length;
    expect(plan.comingUp).toBe(open);
    expect(plan.comingUp).toBeGreaterThan(5);
  });

  it('the tile holds the first open thing from today, and how many are late', () => {
    const n = todoNext(plan);
    expect(n.item?.date).toBe('2026-12-11');
    expect(n.late).toBe(22);
  });
});

describe('to do · the rules', () => {
  const t = (id: string, due: string | undefined, done = false): Task => ({
    id,
    tripId: 't',
    title: id,
    ...(due ? { due } : {}),
    priority: 2,
    done,
    order: 0,
  });

  it('a to-do with no date sits in its own group', () => {
    const p = todoPlan([t('a', undefined), t('b', '2027-01-02')], [], [], '2027-01-01');
    expect(p.undated.map((i) => i.id)).toEqual(['a']);
    expect(p.days.map((d) => d.date)).toEqual(['2027-01-02']);
  });

  it('a done to-do stays on its day, ticked, and is not counted as coming up', () => {
    const p = todoPlan([t('a', '2027-01-02', true), t('b', '2027-01-02')], [], [], '2027-01-01');
    expect(p.days[0]!.items.map((i) => i.done)).toEqual([true, false]);
    expect(p.comingUp).toBe(1);
    expect(todoNext(p).item?.id).toBe('b');
  });

  it('with nothing dated ahead, the tile falls back to the undated list', () => {
    const p = todoPlan([t('a', undefined)], [], [], '2027-01-01');
    expect(todoNext(p).item?.id).toBe('a');
    expect(todoNext(todoPlan([], [], [], '2027-01-01'))).toEqual({ item: null, late: 0 });
  });
});

/* QA, 7 Nov 2026: overdue to-dos were folded away at the bottom ("Earlier · 5
   to-dos"), ticked ones stayed in the open list, and the due line read "due
   resolved 29 Sep — nothing left to chase", "due decide", "due Nov 10· 10 Nov". */
describe('to do · overdue first, done out of the way', () => {
  const t = (id: string, due: string | undefined, done = false): Task => ({ id, tripId: 't', title: id, ...(due ? { due } : {}), priority: 2, done, order: 0 });

  it('lists what is late and still open as overdue, oldest first — the tile counts the same', () => {
    const p = todoPlan([t('b', '2027-01-05'), t('a', '2027-01-02'), t('ok', '2027-01-03', true), t('next', '2027-01-12')], [], [], '2027-01-10');
    expect(p.overdue.map((i) => i.id)).toEqual(['a', 'b']);
    expect(p.overdue.every((i) => i.late && !i.done)).toBe(true);
    expect(todoNext(p).late).toBe(2);
  });

  it('gathers every ticked to-do, past or ahead, in Done — and never as overdue', () => {
    const p = todoPlan([t('past', '2027-01-02', true), t('ahead', '2027-01-20', true), t('open', '2027-01-20')], [], [], '2027-01-10');
    expect(p.done.map((i) => i.id)).toEqual(['past', 'ahead']);
    expect(p.overdue).toEqual([]);
    expect(p.comingUp).toBe(1);
  });

  it('a past alarm is a moment gone by, not an overdue to-do', () => {
    const p = todoPlan([], [{ id: 'al', tripId: 't', date: '2027-01-02', time: '09:00', title: 'al', done: false }], [], '2027-01-10');
    expect(p.overdue).toEqual([]);
    expect(p.earlier.map((i) => i.id)).toEqual(['al']);
  });
});

describe('to do · dueNote — the label, less the date it restates', () => {
  it('drops a label that only restates the due date', () => {
    expect(dueNote('Nov 10', '2026-11-10')).toBeNull();
    expect(dueNote('by Dec 9', '2026-12-09')).toBeNull();
    expect(dueNote('~Dec 12', '2026-12-12')).toBeNull();
    expect(dueNote('10 November 2026', '2026-11-10')).toBeNull();
  });
  it('keeps what the label adds after the date', () => {
    expect(dueNote('Nov 22 — the hotel night', '2026-11-22')).toBe('the hotel night');
    expect(dueNote('Tue 1 Dec 20:00 Beijing (14:00 home)', '2026-12-01')).toBe('20:00 Beijing (14:00 home)');
    expect(dueNote('Dec 8, 19:00 — your reminder', '2026-12-08')).toBe('19:00 — your reminder');
  });
  it('keeps a label whole that is not the date, or not exactly it', () => {
    expect(dueNote('decide', '2026-12-01')).toBe('decide');
    expect(dueNote('e-Ticket offline', '2026-11-15')).toBe('e-Ticket offline');
    expect(dueNote('resolved 29 Sep — nothing left to chase', '2026-11-15')).toBe('resolved 29 Sep — nothing left to chase');
    expect(dueNote('Dec 5/6 — when sales open', '2026-12-06')).toBe('Dec 5/6 — when sales open');
    expect(dueNote('Nov 20+', '2026-11-20')).toBe('Nov 20+');
    expect(dueNote('Dec 4 → Dec 17', '2026-12-04')).toBe('Dec 4 → Dec 17');
  });
  it('with no due date the label is all there is; with no label, nothing', () => {
    expect(dueNote('pre-trip', undefined)).toBe('pre-trip');
    expect(dueNote(undefined, '2026-11-10')).toBeNull();
    expect(dueNote('  ', '2026-11-10')).toBeNull();
  });
});

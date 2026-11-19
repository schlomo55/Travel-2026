/* SNOOZE, DONE AND DELETE KEEP THE ALARM AND ANDROID IN STEP (19 Nov 2026,
   the phone test). An alarm rang at 08:28, "Snooze 10 min" moved Android's
   alarm to 08:38, but the card still said 08:28; ticking it done in the app
   left the 08:38 ringing; and an alarm could not be deleted at all.

   Now: snoozing an alarm's own ring moves the alarm itself (the next sync
   rings it under its own id, which Done and delete cancel), and a sync drops
   every kept snooze whose to-do or alarm is done or gone. The plugin, the
   database and the repo are stand-ins; the scheduler is the real one. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stableId, type Snooze } from '../lib/logic/notify';

const calls = vi.hoisted(() => ({ cancel: [] as number[][], schedule: [] as number[][], pending: [] as number[] }));
const store = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  alarms: new Map<string, { id: string; date: string; time: string; done: boolean }>(),
  tasks: new Map<string, { id: string; done: boolean }>(),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }),
    createChannel: async () => {},
    registerActionTypes: async () => {},
    getPending: async () => ({ notifications: calls.pending.map((id) => ({ id })) }),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => void calls.cancel.push(notifications.map((n) => n.id)),
    schedule: async ({ notifications }: { notifications: { id: number }[] }) => void calls.schedule.push(notifications.map((n) => n.id)),
    getDeliveredNotifications: async () => ({ notifications: [] }),
  },
}));
vi.mock('../lib/platform/files', () => ({ isNative: () => true }));
vi.mock('../lib/db/db', () => {
  const table = (m: Map<string, Record<string, unknown>>) => ({
    get: async (id: string) => m.get(id),
    update: async (id: string, patch: Record<string, unknown>) => void m.set(id, { ...m.get(id)!, ...patch }),
  });
  const tables: Record<string, ReturnType<typeof table>> = {
    alarms: table(store.alarms as never),
    tasks: table(store.tasks as never),
    bookings: table(new Map()),
  };
  return {
    db: {
      ...tables,
      table: (name: string) => tables[name],
      meta: { get: async (key: string) => (store.meta.has(key) ? { key, value: store.meta.get(key) } : undefined), put: async (r: { key: string; value: unknown }) => void store.meta.set(r.key, r.value) },
    },
  };
});
vi.mock('../lib/data/repo', () => ({
  addMutationHook: () => {},
  mutate: async (fn: () => Promise<unknown>) => fn(),
  updateSettings: async () => {},
  /* reminders off: the plan is empty, so a sync is only its cancel step */
  getSettings: async () => ({ reminders: { on: false } }),
}));
vi.mock('../lib/state/router.svelte', () => ({ router: { go: () => {} } }));
vi.mock('../lib/state/toast.svelte', () => ({ toast: { show: () => {} } }));

const T = new Date(2026, 11, 5, 8, 28).getTime(); /* the alarm's ring, 08:28 */

beforeEach(() => {
  calls.cancel.length = 0;
  calls.schedule.length = 0;
  calls.pending.length = 0;
  store.meta.clear();
  store.alarms.clear();
  store.tasks.clear();
  store.alarms.set('a1', { id: 'a1', date: '2026-12-05', time: '08:28', done: false });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T);
});

describe('Snooze on an alarm', () => {
  it('Snooze 10 min on the alarm itself moves the alarm to 08:38, and no separate snooze is kept', async () => {
    const r = await import('../lib/platform/reminders');
    await r.onAction('snooze10', { ref: { kind: 'alarm', id: 'a1' }, at: T, route: '#/x' }, stableId('alarm:a1'));
    expect(store.alarms.get('a1')).toMatchObject({ date: '2026-12-05', time: '08:38' });
    expect(store.meta.get('reminders:snoozes')).toBeUndefined();
    expect(calls.schedule).toEqual([]); /* the sync rings it, under alarm:a1 */
  });

  it('Snooze 1 h late in the evening moves it past midnight', async () => {
    store.alarms.set('a1', { id: 'a1', date: '2026-12-05', time: '23:30', done: false });
    const at = new Date(2026, 11, 5, 23, 30).getTime();
    vi.setSystemTime(at);
    const r = await import('../lib/platform/reminders');
    await r.onAction('snooze60', { ref: { kind: 'alarm', id: 'a1' }, at }, stableId('alarm:a1'));
    expect(store.alarms.get('a1')).toMatchObject({ date: '2026-12-06', time: '00:30' });
  });

  it('a heads-up snoozed leaves the alarm where it is (a snooze of its own, as before)', async () => {
    const r = await import('../lib/platform/reminders');
    await r.onAction('snooze10', { ref: { kind: 'alarm', id: 'a1' }, at: T - 30 * 60_000, route: '#/x' }, stableId('alarm-soon:a1'));
    expect(store.alarms.get('a1')?.time).toBe('08:28');
    expect((store.meta.get('reminders:snoozes') as Snooze[]).length).toBe(1);
    expect(calls.schedule.length).toBe(1);
  });
});

describe('a sync cancels the snoozes of what is done or deleted', () => {
  it('done alarm, deleted alarm, done to-do: cancelled; an open to-do and the test: kept', async () => {
    const at = T + 10 * 60_000;
    const s = (id: number, ref?: Snooze['ref']): Snooze => ({ id, at, title: '', body: '', route: '#/x', ref });
    store.alarms.set('a1', { id: 'a1', date: '2026-12-05', time: '08:28', done: true });
    store.tasks.set('t-open', { id: 't-open', done: false });
    store.tasks.set('t-done', { id: 't-done', done: true });
    store.meta.set('reminders:snoozes', [
      s(11, { kind: 'alarm', id: 'a1' }),
      s(12, { kind: 'alarm', id: 'gone' }),
      s(13, { kind: 'task', id: 't-done' }),
      s(14, { kind: 'task', id: 't-open' }),
      s(15),
    ]);
    calls.pending.push(11, 12, 13, 14, 15);
    const r = await import('../lib/platform/reminders');
    await r.syncReminders();
    expect(calls.cancel).toEqual([[11, 12, 13]]);
  });
});

describe('an alarm can be deleted from the To do list', () => {
  it('its row opens the edit sheet (with Delete) outside Edit mode', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'components', 'now', 'Todo.svelte'), 'utf8');
    expect(src).toMatch(/\{#if editing \|\| it\.alarm\}\s*(<!--[^>]*-->\s*)?<button class="editbtn"/);
    expect(src).toMatch(/ondelete=\{sheet\.entity \? \(\) => deleteEntity\(db\.alarms/);
  });
});

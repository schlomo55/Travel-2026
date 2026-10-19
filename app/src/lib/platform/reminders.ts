/* THE SCHEDULER (Reminders, Part 1). Reads the trip, asks logic/notify.ts
   what should ring, and hands that list to Android through
   @capacitor/local-notifications. Android then rings on its own: the app can
   be closed, the phone in airplane mode, or restarted (the plugin restores
   its alarms after a boot).

   IT KEEPS ITSELF TRUE. The list is rebuilt when the app starts, when it
   comes back to the front, after every change, and when the phone's time
   zone changes (that is also a coming-back: the zone changes while the app
   sleeps). Rebuilding cancels everything pending and schedules the plan
   again; ids are stable, so nothing doubles.

   NEVER AT START-UP. This module and the plugin are reached only through a
   dynamic import from main.ts, after the first paint (the start-up bundle
   has no room for them), and only inside the Android app: in a browser
   nothing here runs. */
import { db } from '../db/db';
import { addMutationHook, getSettings, mutate, updateSettings } from '../data/repo';
import { router } from '../state/router.svelte';
import { toast } from '../state/toast.svelte';
import { R } from '../i18n/reminders';
import { MAX_PLANNED, planNotifications, reminderPrefs, reminderTrip, stableId, type Planned, type Snooze } from '../logic/notify';
import { zonePlan, type HomeAnchor, type ZonePlan } from '../logic/tripzone';
import { asWeatherCache, weatherKey, type WeatherCache } from '../logic/weather';
import { flightAwareUrl } from '../logic/flightlinks';
import { localToday } from '../logic/dates';
import { bufferText, leaveBys, retimeLeaves } from '../logic/leaveby';
import { minutesText } from '../logic/dayroute';
import { S } from '../i18n/strings';
import { isNative } from './files';
import type { Booking, ReminderPrefs, Trip } from '../model/types';

type LN = typeof import('@capacitor/local-notifications').LocalNotifications;
let plugin: Promise<LN> | null = null;
const ln = (): Promise<LN> => (plugin ??= import('@capacitor/local-notifications').then((m) => m.LocalNotifications));

const SNOOZES = 'reminders:snoozes';
const STATUS = 'reminders:status';
export const BACKUP_NOW = 'ltd:backup-now';

export interface SyncStatus {
  count: number;
  next: { title: string; at: number } | null;
  at: number;
}

/* ---------- permissions ---------- */

export type Allowed = 'granted' | 'denied' | 'prompt';

export async function notificationsAllowed(): Promise<Allowed> {
  if (!isNative()) return 'denied';
  const { display } = await (await ln()).checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

export async function askNotifications(): Promise<Allowed> {
  if (!isNative()) return 'denied';
  const { display } = await (await ln()).requestPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

/** Android 12+ "Alarms & reminders": without it a reminder rings within
    Android's own window instead of on the minute. */
export async function exactAllowed(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { exact_alarm } = await (await ln()).checkExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch {
    return true; /* older Android: exact is simply allowed */
  }
}

export async function openExactSetting(): Promise<void> {
  try {
    await (await ln()).changeExactNotificationSetting();
  } catch {
    /* nothing to open on this Android */
  }
}

/* ---------- channels and buttons ---------- */

let prepared: Promise<void> | null = null;
function prepare(): Promise<void> {
  return (prepared ??= (async () => {
    const L = await ln();
    /* importance: 4 high (heads-up), 3 default, 2 low (no sound) */
    const channels = [
      { id: 'moments', name: R.chMoments, description: R.chMomentsSub, importance: 4 as const },
      { id: 'travel', name: R.chTravel, description: R.chTravelSub, importance: 4 as const },
      { id: 'card', name: R.chCard, description: R.chCardSub, importance: 2 as const },
      { id: 'briefs', name: R.chBriefs, description: R.chBriefsSub, importance: 3 as const },
      { id: 'backup', name: R.chBackup, description: R.chBackupSub, importance: 2 as const },
    ];
    /* visibility 0 = private: with the phone's "hide sensitive content" on,
       the lock screen shows that LTD has a reminder, not what it says. */
    for (const c of channels) await L.createChannel({ ...c, visibility: 0, vibration: c.importance >= 3 });
    await L.registerActionTypes({
      types: [
        {
          id: 'item',
          actions: [
            { id: 'done', title: R.actDone },
            { id: 'snooze10', title: R.actSnooze10 },
            { id: 'snooze60', title: R.actSnooze60 },
          ],
        },
        { id: 'leg', actions: [{ id: 'live', title: R.actLive, foreground: true }, { id: 'open', title: R.actBooking, foreground: true }] },
        { id: 'backup', actions: [{ id: 'backup', title: R.actBackup, foreground: true }] },
        { id: 'landed', actions: [{ id: 'open', title: R.actBed, foreground: true }, { id: 'driver', title: R.actDriver, foreground: true }] },
      ],
    });
  })().catch((e: unknown) => {
    prepared = null;
    throw e;
  }));
}

/* ---------- the trip the reminders follow ---------- */

/** The one trip that rings (logic/notify.ts → reminderTrip). */
async function activeTrip(activeId: string | null): Promise<Trip | null> {
  return reminderTrip(await db.trips.toArray(), localToday(), activeId);
}

const HOME = 'reminders:home';

/** The trip's zone plan, with the home offset remembered while the phone
    was still at home (logic/tripzone.ts → HomeAnchor). Also used by the
    calendar export, so both read the trip the same way. */
export async function tripZonePlan(tripId: string, bookings: Booking[], now = Date.now()): Promise<ZonePlan> {
  const row = (await db.meta.get(HOME))?.value as { tripId?: string; anchor?: HomeAnchor } | undefined;
  const anchor = row?.tripId === tripId ? (row.anchor ?? null) : null;
  const plan = zonePlan(bookings, now, undefined, anchor);
  if (plan.homeAnchor && (plan.homeAnchor.firstDep !== anchor?.firstDep || plan.homeAnchor.offset !== anchor?.offset)) {
    await db.meta.put({ key: HOME, value: { tripId, anchor: plan.homeAnchor } });
  }
  return plan;
}

async function readSnoozes(): Promise<Snooze[]> {
  const row = await db.meta.get(SNOOZES);
  const list = Array.isArray(row?.value) ? (row.value as Snooze[]) : [];
  return list.filter((s) => typeof s.at === 'number' && s.at > Date.now());
}

export async function buildPlan(now = Date.now()): Promise<Planned[]> {
  const settings = await getSettings();
  if (!reminderPrefs(settings.reminders).on) return [];
  const trip = await activeTrip(settings.activeTripId);
  if (!trip) return [];
  const id = trip.id;
  const [bookings, alarms, tasks, counters, stops, dayPlans, dayDefaults] = await Promise.all([
    db.bookings.where('tripId').equals(id).toArray(),
    db.alarms.where('tripId').equals(id).toArray(),
    db.tasks.where('tripId').equals(id).toArray(),
    db.counters.where('tripId').equals(id).toArray(),
    db.stops.where('tripId').equals(id).toArray(),
    db.dayPlans.where('tripId').equals(id).toArray(),
    db.dayDefaults.where('tripId').equals(id).toArray(),
  ]);
  const weather: Record<string, WeatherCache | null> = {};
  for (const s of stops) weather[s.id] = asWeatherCache((await db.meta.get(weatherKey(s.id)))?.value);
  const plan = planNotifications({
    trip,
    bookings,
    alarms,
    tasks,
    counters,
    stops,
    dayPlans,
    dayDefaults,
    prefs: settings.reminders,
    lastBackupAt: settings.lastBackupAt,
    lastMutationAt: settings.lastMutationAt,
    weather,
    zone: await tripZonePlan(id, bookings, now),
    now,
  });
  /* The leave-by (logic/leaveby.ts) moves each leg's "leave for…" to the
     moment the taxi has to go, with the alarms' heads-up before it. */
  const L = S.leaveBy;
  return retimeLeaves(plan, leaveBys(bookings), {
    idOf: stableId,
    lead: reminderPrefs(settings.reminders).lead,
    now,
    title: (l) => L.notify(l.place, l.label, l.dep),
    soon: (l, lead) => L.notifySoon(lead, l.place, l.time),
    body: (l, was) => `${L.notifyBody(minutesText(l.leg.minutes), bufferText(l.buffer))} · ${was}`,
  }).slice(0, MAX_PLANNED);
}

/* ---------- the sync ---------- */

let running: Promise<void> | null = null;
let again = false;

/** Rebuild what Android holds. Concurrent calls fold into one more run. */
export function syncReminders(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } catch (e) {
      console.warn('reminders: sync failed', e);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** One notification in the plugin's shape. */
function toNative(x: {
  id: number;
  at: number;
  title: string;
  body: string;
  channel: string;
  route: string;
  action?: string;
  ref?: Planned['ref'];
  ongoing?: boolean;
  until?: number;
}) {
  return {
    id: x.id,
    title: x.title,
    body: x.body,
    largeBody: x.body,
    channelId: x.channel,
    schedule: { at: new Date(x.at), allowWhileIdle: true },
    ongoing: x.ongoing ?? false,
    autoCancel: !x.ongoing,
    actionTypeId: x.action,
    smallIcon: 'ic_stat_ltd',
    iconColor: '#E8B04B',
    extra: { route: x.route, ref: x.ref ?? null, title: x.title, body: x.body, until: x.until ?? null },
  };
}

async function syncOnce(): Promise<void> {
  const L = await ln();
  const plan = await buildPlan();
  if (plan.length) await prepare();
  /* Snoozes and the test are set once and left alone: a sync in the minute
     after "Send a test" must not cancel the test. */
  const keep = new Set((await readSnoozes()).map((x) => x.id));
  const { notifications: pending } = await L.getPending();
  const stale = pending.filter((n) => !keep.has(n.id));
  if (stale.length) await L.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
  if (plan.length && (await notificationsAllowed()) === 'granted') {
    const items = plan.map(toNative);
    /* A few at a time: one bridge call per notification is slower than one
       call for many, and a very large call is the one that fails. */
    for (let i = 0; i < items.length; i += 40) await L.schedule({ notifications: items.slice(i, i + 40) });
  }
  /* A travel-day card still on screen after its journey landed goes. */
  try {
    const { notifications: shown } = await L.getDeliveredNotifications();
    const now = Date.now();
    const landed = shown.filter((n) => {
      const until = (n.extra as { until?: number | null } | undefined)?.until;
      return typeof until === 'number' && until < now;
    });
    if (landed.length) await L.removeDeliveredNotifications({ notifications: landed });
  } catch {
    /* an Android that cannot list what is showing: the card stays until swiped */
  }
  const first = plan.find((x) => !x.ongoing);
  const status: SyncStatus = { count: plan.length, next: first ? { title: first.title, at: first.at } : null, at: Date.now() };
  await db.meta.put({ key: STATUS, value: status });
}

export async function readStatus(): Promise<SyncStatus | null> {
  const v = (await db.meta.get(STATUS))?.value as SyncStatus | undefined;
  return v && typeof v.count === 'number' ? v : null;
}

/* ---------- Settings ---------- */

export async function setPrefs(patch: Partial<ReminderPrefs>): Promise<void> {
  const cur = (await getSettings()).reminders ?? {};
  await updateSettings({ reminders: { ...cur, ...patch } });
  await syncReminders();
}

/** The master switch. Turning it on is the one moment Android asks. */
export async function turnOn(): Promise<boolean> {
  let allowed = await notificationsAllowed();
  if (allowed !== 'granted') allowed = await askNotifications();
  if (allowed !== 'granted') {
    toast.show(R.denied);
    return false;
  }
  await setPrefs({ on: true });
  toast.show(R.enabled);
  return true;
}

export async function sendTest(): Promise<void> {
  if (!isNative()) return;
  if ((await notificationsAllowed()) !== 'granted' && (await askNotifications()) !== 'granted') {
    toast.show(R.denied);
    return;
  }
  await prepare();
  const L = await ln();
  const test: Snooze = { id: stableId(`test:${Date.now()}`), at: Date.now() + 60_000, title: R.testTitle, body: R.testBody, route: '#/settings' };
  /* Kept with the snoozes first, so a sync in the next minute leaves it be. */
  await addSnooze(test);
  await L.schedule({ notifications: [toNative({ ...test, channel: 'moments' })] });
  toast.show(R.testQueued);
}

async function addSnooze(s: Snooze): Promise<void> {
  const list = await readSnoozes();
  await db.meta.put({ key: SNOOZES, value: [...list.filter((x) => x.id !== s.id), s] });
}

/* ---------- a tap, or a button ---------- */

interface Extra {
  route?: string;
  ref?: Planned['ref'] | null;
  title?: string;
  body?: string;
}

async function onAction(actionId: string, extra: Extra): Promise<void> {
  const route = extra.route ?? '#/trips';
  const ref = extra.ref ?? null;
  switch (actionId) {
    case 'done':
      if (ref?.kind === 'alarm') await mutate(() => db.alarms.update(ref.id, { done: true }));
      else if (ref?.kind === 'task') await mutate(() => db.tasks.update(ref.id, { done: true, doneAt: Date.now() }));
      return;
    case 'snooze10':
    case 'snooze60': {
      const mins = actionId === 'snooze10' ? 10 : 60;
      const at = Date.now() + mins * 60_000;
      const snooze: Snooze = { id: stableId(`snooze:${ref?.id ?? route}:${at}`), at, title: extra.title ?? '', body: extra.body ?? '', route, ref: ref ?? undefined };
      await addSnooze(snooze);
      await prepare();
      await (await ln()).schedule({ notifications: [toNative({ ...snooze, channel: 'moments', action: 'item' })] });
      return;
    }
    case 'live': {
      const b = ref?.kind === 'booking' ? await db.bookings.get(ref.id) : null;
      const url = b?.kind === 'flight' ? flightAwareUrl(b.flightNo) : null;
      if (url) {
        const { openLink } = await import('./maps');
        await openLink(url);
      } else router.go(route);
      return;
    }
    case 'backup':
      try {
        sessionStorage.setItem(BACKUP_NOW, '1');
      } catch {
        /* the Backup screen still opens; the person taps Save */
      }
      router.go('#/backup');
      return;
    case 'driver': {
      const m = /^#\/trip\/([^/]+)\//.exec(route);
      router.go(m ? `#/trip/${m[1]}/pocket/driver` : route);
      return;
    }
    default:
      router.go(route);
  }
}

/* ---------- start ---------- */

let started = false;

export async function startReminders(): Promise<void> {
  if (started || !isNative()) return;
  started = true;
  const L = await ln();
  await L.addListener('localNotificationActionPerformed', (a) => {
    void onAction(a.actionId, (a.notification.extra ?? {}) as Extra);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  addMutationHook(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncReminders(), 2000);
  });
  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    /* Every return to the front re-plans. A new time zone is one of them:
       Android moves the clock while the app sleeps, and the next plan reads
       the phone's new offset (logic/tripzone.ts anchors on it). */
    void syncReminders();
  });
  await syncReminders();
}

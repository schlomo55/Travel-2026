/* LONG-PRESS SHORTCUTS (Reminders, Part 6). The launcher icon offers Now,
   Wallet, Map and To do (android/app/build.gradle writes them). Each opens
   the app with an ltd://open/<place> URL, which lands here: through
   getLaunchUrl on a cold start, through appUrlOpen when the app was already
   running. The place opens in the trip on the road, else the one last opened,
   else the shelf.

   Its own small chunk, read right after start-up and only inside the
   Android app. */
import { db } from '../db/db';
import { getSettings } from '../data/repo';
import { router } from '../state/router.svelte';
import { localToday } from '../logic/dates';
import { tripPhase } from '../logic/phase';
import { reminderTrip } from '../logic/tripchoice';
import { isNative } from './files';

const PREFIX = 'ltd://open/';
const TAIL: Record<string, string> = {
  now: 'now',
  wallet: 'pocket',
  map: 'map',
  todo: 'now/todo',
};

/** 'ltd://open/wallet' → '#/trip/<id>/pocket', or null for any other URL. */
export async function shortcutRoute(url: string | undefined): Promise<string | null> {
  if (!url?.startsWith(PREFIX)) return null;
  const tail = TAIL[url.slice(PREFIX.length).replace(/\/+$/, '')];
  if (!tail) return null;
  const trips = (await db.trips.toArray()).filter((t) => !t.archived);
  const today = localToday();
  const active = (await getSettings()).activeTripId;
  const trip =
    trips.find((t) => tripPhase(t, today) === 'during') ??
    trips.find((t) => t.id === active) ??
    reminderTrip(trips, today, active);
  return trip ? `#/trip/${encodeURIComponent(trip.id)}/${tail}` : '#/trips';
}

let started = false;

export async function startShortcuts(): Promise<void> {
  if (started || !isNative()) return;
  started = true;
  const { App } = await import('@capacitor/app');
  const go = async (url: string | undefined): Promise<void> => {
    const to = await shortcutRoute(url);
    if (to) router.go(to);
  };
  await App.addListener('appUrlOpen', (e) => void go(e.url));
  /* A cold start: the launch URL, once. After the app's own first redirect
     (App.svelte), so the shortcut has the last word; and never again after a
     WebView reload, which would hand back the same URL. */
  const launch = await App.getLaunchUrl().catch(() => undefined);
  const url = launch?.url;
  let seen = '';
  try {
    seen = sessionStorage.getItem('ltd:launch-url') ?? '';
    if (url) sessionStorage.setItem('ltd:launch-url', url);
  } catch {
    /* no session storage: route it anyway */
  }
  if (url && url !== seen) setTimeout(() => void go(url), 700);
}

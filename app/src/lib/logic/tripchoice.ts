/* WHICH TRIP RINGS (the Reminders run). Its own tiny module: the launcher
   shortcuts need it right after start-up and must not pull the whole
   reminder planner along. */
import type { ISODate, Trip } from '../model/types';
import { compareIso } from './dates';

/** A sample trip (🧪): for rehearsing the app, never for waking anyone. */
export function isSampleTrip(t: Pick<Trip, 'emoji' | 'title'>): boolean {
  return t.emoji === '🧪' || /^\s*(🧪\s*)?TEST\b/.test(t.title);
}

/** The ONE trip reminders follow: the one on the road; else the next one
    still to come (a rehearsal on a sample trip must not silence China's
    pre-trip reminders); else the one last opened. Sample trips never. */
export function reminderTrip<T extends Pick<Trip, 'id' | 'start' | 'end' | 'archived' | 'emoji' | 'title'>>(
  trips: T[],
  today: ISODate,
  activeId: string | null,
): T | null {
  const real = trips.filter((t) => !t.archived && !isSampleTrip(t));
  const during = real.find((t) => compareIso(t.start, today) <= 0 && compareIso(today, t.end) <= 0);
  if (during) return during;
  const next = real.filter((t) => compareIso(t.start, today) > 0).sort((a, b) => compareIso(a.start, b.start))[0];
  return next ?? real.find((t) => t.id === activeId) ?? null;
}

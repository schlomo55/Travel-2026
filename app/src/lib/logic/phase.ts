import type { ISODate, Trip } from '../model/types';
import { compareIso, daysBetween } from './dates';

export type TripPhase = 'before' | 'during' | 'after';

export function tripPhase(trip: Pick<Trip, 'start' | 'end'>, date: ISODate): TripPhase {
  if (compareIso(date, trip.start) < 0) return 'before';
  if (compareIso(date, trip.end) > 0) return 'after';
  return 'during';
}

/** Inclusive length: China Nov 21 → Dec 27 = 37. */
export function tripDays(trip: Pick<Trip, 'start' | 'end'>): number {
  return daysBetween(trip.start, trip.end) + 1;
}

/** 1-based day number within the trip (day 1 = start date). */
export function tripDay(trip: Pick<Trip, 'start' | 'end'>, date: ISODate): number {
  return daysBetween(trip.start, date) + 1;
}

export function daysUntilStart(trip: Pick<Trip, 'start'>, date: ISODate): number {
  return daysBetween(date, trip.start);
}

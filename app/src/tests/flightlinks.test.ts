/* "CHECK LIVE STATUS" (Reminders, Part 2): the flight's own public pages.
   The FlightAware formats below were opened for real on 2026-09-29 and each
   answered with its own flight (e.g. "3U8011 (CSC8011) Sichuan Airlines");
   Flightradar24 answers a script with a bot check, so its format is pinned
   here only. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { flightAwareUrl, flightradarUrl, splitFlightNo } from '../lib/logic/flightlinks';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;

describe('flight links', () => {
  it('splits a flight number with or without a space', () => {
    expect(splitFlightNo('CA 8641')).toEqual({ airline: 'CA', number: '8641' });
    expect(splitFlightNo('3U8011')).toEqual({ airline: '3U', number: '8011' });
    expect(splitFlightNo('not a flight')).toBeNull();
  });

  it('FlightAware files a flight under the ICAO airline code', () => {
    expect(flightAwareUrl('CA 8641')).toBe('https://flightaware.com/live/flight/CCA8641');
    expect(flightAwareUrl('3U 8011')).toBe('https://flightaware.com/live/flight/CSC8011');
    expect(flightAwareUrl('MU 733')).toBe('https://flightaware.com/live/flight/CES733');
    expect(flightAwareUrl('EY 888')).toBe('https://flightaware.com/live/flight/ETD888');
    expect(flightAwareUrl('ZZ 1')).toBe('https://flightaware.com/live/flight/ZZ1');
  });

  it('Flightradar24 files it under the IATA code, lower-case', () => {
    expect(flightradarUrl('CA 8641')).toBe('https://www.flightradar24.com/data/flights/ca8641');
  });

  it('every flight on the China trip gets a known airline', () => {
    const flights = china.bookings.filter((b) => b.kind === 'flight');
    expect(flights.length).toBe(10); // + MU394 (China Eastern, Dec 11, not booked yet), 2026-10-17
    for (const f of flights) {
      const url = flightAwareUrl(f.flightNo)!;
      expect(url).toMatch(/^https:\/\/flightaware\.com\/live\/flight\/[A-Z]{3}\d+$/);
    }
  });
});

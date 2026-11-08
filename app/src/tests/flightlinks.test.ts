/* "CHECK LIVE STATUS" (Reminders, Part 2): the flight's own public pages.
   The FlightAware formats below were opened for real on 2026-09-29 and each
   answered with its own flight (a Sichuan Airlines flight under its CSC
   ICAO code, for one); Flightradar24 answers a script with a bot check, so
   its format is pinned here only. The flight numbers used here are the demo
   trip's invented ones. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { flightAwareUrl, flightradarUrl, splitFlightNo } from '../lib/logic/flightlinks';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;

describe('flight links', () => {
  it('splits a flight number with or without a space', () => {
    expect(splitFlightNo('MU 5001')).toEqual({ airline: 'MU', number: '5001' });
    expect(splitFlightNo('3U9003')).toEqual({ airline: '3U', number: '9003' });
    expect(splitFlightNo('not a flight')).toBeNull();
  });

  it('FlightAware files a flight under the ICAO airline code', () => {
    expect(flightAwareUrl('CA 1234')).toBe('https://flightaware.com/live/flight/CCA1234');
    expect(flightAwareUrl('3U 9001')).toBe('https://flightaware.com/live/flight/CSC9001');
    expect(flightAwareUrl('MU 5001')).toBe('https://flightaware.com/live/flight/CES5001');
    expect(flightAwareUrl('CZ 9005')).toBe('https://flightaware.com/live/flight/CSN9005');
    expect(flightAwareUrl('EY 100')).toBe('https://flightaware.com/live/flight/ETD100');
    expect(flightAwareUrl('ZZ 1')).toBe('https://flightaware.com/live/flight/ZZ1');
  });

  it('Flightradar24 files it under the IATA code, lower-case', () => {
    expect(flightradarUrl('MU 5001')).toBe('https://www.flightradar24.com/data/flights/mu5001');
  });

  it('every flight on the demo trip gets a FlightAware link — the known airlines under their ICAO code', () => {
    const flights = demo.bookings.filter((b) => b.kind === 'flight');
    /* 4 Finnair long-haul legs + MU 5001, the cancelled MU 5003, 3U 9001,
       3U 9003 and the exit flight CZ 9005. */
    expect(flights.length).toBe(9);
    for (const f of flights) {
      const url = flightAwareUrl(f.flightNo)!;
      /* Finnair (AY) is not in the ICAO table, so its legs take the documented
         unknown-airline path — FlightAware under the IATA code, which its own
         search also answers. Every Chinese carrier must resolve to ICAO. */
      if (f.flightNo.startsWith('AY')) expect(url).toMatch(/^https:\/\/flightaware\.com\/live\/flight\/AY\d+$/);
      else expect(url).toMatch(/^https:\/\/flightaware\.com\/live\/flight\/[A-Z]{3}\d+$/);
    }
  });
});

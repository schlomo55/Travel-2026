/* NOW'S ROUTE STRIP — the trip as one line of dots (logic/nowroute.ts): the
   road so far, tonight's stop (or the next one), the road ahead, and the
   sentence a screen reader hears. Same rule as the map for what is behind
   you, where you are and what is ahead — and a stop with no coordinate is
   still a dot. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routeStrip } from '../lib/logic/nowroute';
import { buildConstellation } from '../lib/logic/constellation';
import type { AppBackup, Stop } from '../lib/model/types';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const states = (day: string, arrived = false) => routeStrip(demo.stops, day, arrived)!.dots.map((d) => d.state);

const stop = (id: string, start: string, end: string, o: Partial<Stop> = {}): Stop =>
  ({ id, tripId: 't', kind: 'stop', name: `Place ${id}`, start, end, order: 0, ...o }) as Stop;

describe('route strip · the demo trip', () => {
  it('one dot per real stop in trip order — the transit pseudo-stop is not one', () => {
    const s = routeStrip(demo.stops, '2027-03-07')!;
    expect(s.dots).toHaveLength(9);
    expect(s.count).toBe('9 stops');
    /* Suzhou has no coordinate and the map leaves it out; the strip keeps it */
    expect(buildConstellation(demo.stops, '2027-03-07', { width: 400, height: 400, pad: 20 })!.stars).toHaveLength(8);
  });

  it('twelve days before: every stop ahead, the first one marked, the road dotted', () => {
    const s = routeStrip(demo.stops, '2027-03-07')!;
    expect(s.dots.every((d) => d.state === 'ahead')).toBe(true);
    expect(s.dots.map((d) => d.next)).toEqual([true, ...Array(8).fill(false)]);
    expect(s.dots.slice(0, -1).every((d) => d.leg === 'ahead')).toBe(true);
    expect(s.where).toBe('First stop: Tai-chi school');
    expect(s.aria).toBe('Route: 9 stops, Tai-chi school to Hong Kong & Macau. First stop: Tai-chi school. Open the journey.');
  });

  it('in a city: the road behind lit, tonight’s stop marked, the road ahead dotted', () => {
    expect(states('2027-03-25')).toEqual(['here', ...Array(8).fill('ahead')]);
    expect(states('2027-04-05')).toEqual(['done', 'done', 'done', 'here', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
    const s = routeStrip(demo.stops, '2027-04-05')!;
    expect(s.dots.map((d) => d.leg).slice(0, 4)).toEqual(['done', 'done', 'done', 'ahead']);
    expect(s.dots.some((d) => d.next)).toBe(false);
    expect(s.where).toBe('In Huangshan');
  });

  it('a travel day: today’s leg is the dashed one, until the day’s line says you have arrived', () => {
    /* Apr 7: Huangshan's last night was the 6th; Chengdu begins today */
    const moving = routeStrip(demo.stops, '2027-04-07')!;
    expect(moving.dots.map((d) => d.leg).slice(0, 5)).toEqual(['done', 'done', 'done', 'today', 'ahead']);
    expect(moving.where).toBe('In Chengdu');
    const there = routeStrip(demo.stops, '2027-04-07', true)!;
    expect(there.dots.map((d) => d.leg).slice(0, 5)).toEqual(['done', 'done', 'done', 'done', 'ahead']);
  });

  it('the day after the last night: the whole road lit and nothing marked', () => {
    const s = routeStrip(demo.stops, '2027-04-20')!;
    expect(s.dots.every((d) => d.state === 'done' && !d.next)).toBe(true);
    expect(s.dots.slice(0, -1).every((d) => d.leg === 'done')).toBe(true);
    expect(s.where).toBe('Trip complete');
  });

  it('agrees with the map about which stop you are at and which are behind you', () => {
    for (const day of ['2027-03-25', '2027-04-02', '2027-04-05', '2027-04-12', '2027-04-14']) {
      const real = demo.stops.filter((x) => x.kind === 'stop').sort((a, b) => a.start.localeCompare(b.start));
      const strip = routeStrip(demo.stops, day)!;
      const map = buildConstellation(demo.stops, day, { width: 400, height: 400, pad: 20 })!;
      for (const star of map.stars) {
        const i = real.findIndex((x) => x.id === star.id);
        expect(strip.dots[i]!.state).toBe(star.state);
      }
    }
  });
});

describe('route strip · the odd shapes', () => {
  it('no stops, or only the transit pseudo-stop: no strip', () => {
    expect(routeStrip([], '2027-03-07')).toBeNull();
    expect(routeStrip([stop('t', '2027-03-01', '2027-03-02', { kind: 'transit' })], '2027-03-01')).toBeNull();
  });

  it('one stop is still a line of one dot, named once', () => {
    const s = routeStrip([stop('a', '2027-03-01', '2027-03-04', { name: 'Solo — a place' })], '2027-03-02')!;
    expect(s.dots).toHaveLength(1);
    expect(s.count).toBe('1 stop');
    expect(s.aria).toBe('Route: 1 stop, Solo. In Solo. Open the journey.');
  });

  it('a night in transit between two stops marks the next stop, not a place you are not at', () => {
    const s = routeStrip([stop('a', '2027-03-01', '2027-03-03'), stop('b', '2027-03-05', '2027-03-08', { order: 1 })], '2027-03-04')!;
    expect(s.dots.map((d) => d.state)).toEqual(['done', 'ahead']);
    expect(s.dots.map((d) => d.next)).toEqual([false, true]);
    expect(s.where).toBe('Next: Place b');
  });
});

import { describe, expect, it } from 'vitest';
import { fmtKm, haversineKm, routeDistanceKm } from '../lib/logic/geoStats';
import type { Stop } from '../lib/model/types';

const stop = (id: string, order: number, coord?: { lat: number; lng: number }): Stop => ({
  id,
  tripId: 't',
  kind: 'stop',
  name: id,
  hue: 40,
  start: '2026-01-01',
  end: '2026-01-02',
  blocks: [],
  recoBlocks: [],
  order,
  ...(coord ? { coord } : {}),
});

describe('haversineKm', () => {
  it('measures a known pair within a kilometre', () => {
    /* Tel Aviv → Beijing, ~7,140 km great circle */
    const km = haversineKm({ lat: 32.0853, lng: 34.7818 }, { lat: 39.9042, lng: 116.4074 });
    expect(km).toBeGreaterThan(7000);
    expect(km).toBeLessThan(7300);
  });
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBe(0);
  });
});

describe('routeDistanceKm', () => {
  it('adds the legs between stops that carry a coordinate, in order', () => {
    const km = routeDistanceKm([
      stop('b', 1, { lat: 39.9042, lng: 116.4074 }),
      stop('a', 0, { lat: 32.0853, lng: 34.7818 }),
    ]);
    expect(km).toBeGreaterThan(7000);
  });
  it('skips stops with no coordinate rather than guessing one', () => {
    const withGap = routeDistanceKm([
      stop('a', 0, { lat: 0, lng: 0 }),
      stop('gap', 1),
      stop('c', 2, { lat: 0, lng: 1 }),
    ]);
    const without = routeDistanceKm([stop('a', 0, { lat: 0, lng: 0 }), stop('c', 2, { lat: 0, lng: 1 })]);
    expect(withGap).toBe(without);
  });
  it('returns null when fewer than two stops are locatable', () => {
    expect(routeDistanceKm([stop('a', 0, { lat: 1, lng: 1 })])).toBeNull();
    expect(routeDistanceKm([])).toBeNull();
  });
});

describe('fmtKm', () => {
  it('groups thousands', () => {
    expect(fmtKm(12540)).toBe('12,540 km');
  });
});

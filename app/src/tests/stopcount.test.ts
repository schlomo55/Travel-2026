/* ONE RULE FOR "N STOPS" (QA 9 Nov 2026). Journey said "9 stops" in its
   subtitle, "The route: 8 stops" on the map (it counted the drawn stars, and
   a stop without map coordinates has none) and STOPS 9 in the statistics.
   A stop is kind 'stop'; the transit pseudo-stop is not one; coordinates do
   not change the count. */
import { describe, expect, it } from 'vitest';
import { countStops, realStops } from '../lib/logic/day';
import { buildConstellation } from '../lib/logic/constellation';
import { S } from '../lib/i18n/strings';
import type { Stop } from '../lib/model/types';

const stop = (id: string, start: string, end: string, extra: Partial<Stop> = {}): Stop => ({
  id, tripId: 't', kind: 'stop', name: id, hue: 0, start, end, blocks: [], recoBlocks: [], order: 0, ...extra,
} as Stop);

const stops: Stop[] = [
  stop('A', '2027-01-01', '2027-01-03', { coord: { lat: 30, lng: 110 } }),
  stop('night-train', '2027-01-03', '2027-01-04', { kind: 'transit' }),
  stop('B', '2027-01-04', '2027-01-06', { coord: { lat: 31, lng: 112 } }),
  stop('Gorge', '2027-01-06', '2027-01-07'), // no coordinates
  stop('C', '2027-01-07', '2027-01-09', { coord: { lat: 25, lng: 114 } }),
];

describe('stop count · one rule', () => {
  it('counts kind stop, not transit, with or without coordinates', () => {
    expect(countStops(stops)).toBe(4);
    expect(realStops(stops).length).toBe(countStops(stops));
  });

  it('the map label says the same number as the subtitle, and names the stop it cannot draw', () => {
    const c = buildConstellation(stops, '2027-01-01', { width: 300, height: 300 } as never)!;
    expect(c.stars.length).toBe(3);
    const aria = S.journey.mapAria(countStops(stops), 0, c.unplaced.length);
    expect(aria).toContain('4 stops');
    expect(aria).toContain('1 not on the map');
    expect(S.journey.subtitle('x', countStops(stops))).toContain('4 stops');
  });
});

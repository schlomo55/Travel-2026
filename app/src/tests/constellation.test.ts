/* THE CONSTELLATION — real coordinates, north up, fitted to a box; nothing
   placed that the trip file does not locate. */
import { describe, expect, it } from 'vitest';
import type { Stop } from '../lib/model/types';
import { buildConstellation, legPath } from '../lib/logic/constellation';

const stop = (id: string, order: number, start: string, end: string, lat?: number, lng?: number): Stop => ({
  id,
  tripId: 't',
  kind: 'stop',
  name: `**${id}**`,
  hue: 0,
  start,
  end,
  blocks: [],
  recoBlocks: [],
  order,
  ...(lat !== undefined && lng !== undefined ? { coord: { lat, lng } } : {}),
});
const box = { width: 380, height: 266, pad: 24 };
/* north-west, north-east, south — a triangle with a real shape */
const stops = [
  stop('a', 0, '2027-03-01', '2027-03-04', 40, 110),
  stop('b', 1, '2027-03-04', '2027-03-08', 40, 120),
  stop('c', 2, '2027-03-08', '2027-03-12', 30, 115),
  stop('x', 3, '2027-03-12', '2027-03-14'),
  { ...stop('flights', 4, '2027-03-14', '2027-03-15', 25, 55), kind: 'transit' as const },
];

describe('constellation', () => {
  it('places every stop that has a coordinate, north up, inside the box', () => {
    const c = buildConstellation(stops, '2027-03-01', box);
    expect(c).not.toBeNull();
    const [a, b, s] = c?.stars ?? [];
    expect(a && b && s).toBeTruthy();
    /* north is up: the southern stop sits lower */
    expect(s!.y).toBeGreaterThan(a!.y);
    /* east is right */
    expect(b!.x).toBeGreaterThan(a!.x);
    for (const st of c!.stars) {
      expect(st.x).toBeGreaterThanOrEqual(box.pad - 0.1);
      expect(st.x).toBeLessThanOrEqual(box.width - box.pad + 0.1);
      expect(st.y).toBeGreaterThanOrEqual(box.pad - 0.1);
      expect(st.y).toBeLessThanOrEqual(box.height - box.pad + 0.1);
    }
  });

  it('lists a stop with no coordinate instead of placing it, and ignores transit phases', () => {
    const c = buildConstellation(stops, '2027-03-01', box);
    expect(c?.stars.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(c?.unplaced).toEqual(['x']);
  });

  it('keeps the trip’s shape: one scale for both axes', () => {
    const c = buildConstellation(stops, '2027-03-01', box)!;
    const [a, b] = c.stars;
    /* 10° of longitude at 35° N is wider than 10° of latitude is tall × cos */
    const dx = Math.abs(b!.x - a!.x);
    const dy = Math.abs(c.stars[2]!.y - a!.y);
    expect(dx / dy).toBeCloseTo((10 * Math.cos((110 / 3) * (Math.PI / 180))) / 10, 1);
  });

  it('knows the road so far, today’s leg and the stops ahead', () => {
    const c = buildConstellation(stops, '2027-03-08', box)!;
    expect(c.stars.map((s) => s.state)).toEqual(['done', 'done', 'here']);
    expect(c.legs.map((l) => l.state)).toEqual(['done', 'today']);
    expect(c.here?.id).toBe('c');
    const before = buildConstellation(stops, '2027-02-01', box)!;
    expect(before.legs.map((l) => l.state)).toEqual(['ahead', 'ahead']);
    expect(before.here).toBeNull();
  });

  it('draws nothing from fewer than two placed stops', () => {
    expect(buildConstellation([stops[0]!, stops[3]!], '2027-03-01', box)).toBeNull();
    expect(buildConstellation([], '2027-03-01', box)).toBeNull();
  });

  it('bends a leg gently between its stars', () => {
    expect(legPath({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe('M0 0 Q 50 18 100 0');
  });
});

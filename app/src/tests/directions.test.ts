/* A DAY'S LEG, HANDED TO A MAP APP (platform/directions.ts) — the leg's own
   start goes along: the stop before it, never "from where you are" — and only
   the first stop, which has no leg, starts from you. maps.ts is stood in for:
   what matters here is what each opener is told. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayRoute, Leg } from '../lib/logic/dayroute';
import type { MapPlace } from '../lib/logic/mapplaces';

const amap = vi.fn();
const google = vi.fn();
vi.mock('../lib/platform/maps', () => ({
  openAmapRoute: (...a: unknown[]) => amap(...a),
  openGoogleDirections: (...a: unknown[]) => google(...a),
}));

const { legDestination, legOrigin, openLegDirections } = await import('../lib/platform/directions');

const place = (id: string, name: string, lat: number): MapPlace =>
  ({ id, name, label: name, native: `${name}-zh`, kind: 'spot', category: 'sight', pos: { lat, lng: 114 }, target: { coord: { lat, lng: 114 }, query: name }, with: [] }) as MapPlace;
const A = place('a', 'Alpha', 22.1);
const B = place('b', 'Beta', 22.2);
const BED = place('bed', 'Hotel', 22.3);
const leg = (fromId: string, toId: string, over: Partial<Leg> = {}): Leg => ({ fromId, toId, metres: 1000, mode: 'walk', minutes: 13, chosen: false, far: false, ...over });
const route = {
  stops: [
    { n: 1, id: 'a', place: A, pos: A.pos! },
    { n: 2, id: 'b', place: B, pos: B.pos! },
  ],
  bed: BED,
} as unknown as DayRoute;

beforeEach(() => {
  amap.mockClear();
  google.mockClear();
});

describe('a leg · where it starts and where it ends', () => {
  it('starts at the stop before it and ends at the stop, or the bed, after it', () => {
    expect(legOrigin(route, leg('a', 'b'))).toBe(A);
    expect(legDestination(route, leg('a', 'b'))).toBe(B);
    expect(legDestination(route, leg('b', 'bed'))).toBe(BED);
    expect(legOrigin(route, leg('b', 'bed'))).toBe(B);
    /* a far leg (a ferry, a train) still arrives at a place that opens in a map app */
    expect(legDestination(route, leg('a', 'b', { far: true }))).toBe(B);
    expect(legOrigin(route, leg('zzz', 'b'))).toBeNull();
  });
});

describe('a leg · what the map app is told', () => {
  it('Amap: the destination in its own name, in the leg’s mode, from the previous stop', async () => {
    await openLegDirections(B, 'taxi', 'amap', A);
    expect(amap).toHaveBeenCalledWith(B.target, 'Beta-zh', 'drive', { target: A.target, name: 'Alpha-zh' });
    expect(google).not.toHaveBeenCalled();
  });
  it('Google: the destination’s target, the mode, and the previous stop’s target as the origin', async () => {
    await openLegDirections(B, 'walk', 'google', A);
    expect(google).toHaveBeenCalledWith(B.target, 'walk', A.target);
    await openLegDirections(BED, 'metro', 'google', B);
    expect(google).toHaveBeenLastCalledWith(BED.target, 'transit', B.target);
  });
  it('the first stop starts from you, in no mode', async () => {
    await openLegDirections(A, null, 'google');
    expect(google).toHaveBeenCalledWith(A.target, null, undefined);
    await openLegDirections(A, null, 'amap');
    expect(amap).toHaveBeenCalledWith(A.target, 'Alpha-zh', null, undefined);
  });
});

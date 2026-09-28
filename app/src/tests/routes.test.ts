/* THE ROUTE GRAMMAR, and every link the app has ever written.

   Horizon renamed the places (Now · Journey · Pocket · Find) and split Info.
   Old links live in backups, in the owner's memory and in the rehearsal; each
   one must still land where its content lives now. These are asserted as
   strings in, routes out — the router itself only adds history on top. */
import { describe, expect, it } from 'vitest';
import { isPocketSection, parseHash, routeHash, tabPath, type Route } from '../lib/logic/routes';

const trip = (r: Route) => (r.name === 'trip' ? r : null);

describe('routes · the new grammar', () => {
  it('reads the three places and Find', () => {
    expect(trip(parseHash('#/trip/cn26/now'))).toMatchObject({ place: 'now', tripId: 'cn26' });
    expect(trip(parseHash('#/trip/cn26/journey'))).toMatchObject({ place: 'journey' });
    expect(trip(parseHash('#/trip/cn26/pocket'))).toMatchObject({ place: 'pocket' });
    expect(trip(parseHash('#/trip/cn26/find'))).toMatchObject({ place: 'find' });
  });

  it('a trip with no place opens on Now', () => {
    expect(trip(parseHash('#/trip/cn26'))).toMatchObject({ place: 'now', sub: undefined });
  });

  it('carries the sub-routes: a city, a pass, a Pocket section, To do and its lists', () => {
    expect(trip(parseHash('#/trip/cn26/journey/cn26-stop-beijing'))).toMatchObject({ place: 'journey', sub: 'cn26-stop-beijing' });
    expect(trip(parseHash('#/trip/cn26/pocket/cn26-flight-mu733'))).toMatchObject({ place: 'pocket', sub: 'cn26-flight-mu733' });
    expect(trip(parseHash('#/trip/cn26/pocket/visa'))).toMatchObject({ place: 'pocket', sub: 'visa' });
    expect(trip(parseHash('#/trip/cn26/now/todo'))).toMatchObject({ place: 'now', sub: 'todo', view: undefined });
    expect(trip(parseHash('#/trip/cn26/now/todo/packing'))).toMatchObject({ place: 'now', sub: 'todo', view: 'packing' });
  });

  it('the screens outside a trip', () => {
    expect(parseHash('')).toEqual({ name: 'redirect' });
    expect(parseHash('#/')).toEqual({ name: 'redirect' });
    expect(parseHash('#/trips')).toEqual({ name: 'shelf' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/backup')).toEqual({ name: 'backup' });
    expect(parseHash('#/nowhere')).toEqual({ name: 'shelf' });
  });

  it('an unknown tab name opens the trip rather than an error', () => {
    expect(trip(parseHash('#/trip/cn26/lists'))).toMatchObject({ place: 'now' });
  });

  it('knows a Pocket section from a booking id', () => {
    for (const s of ['travel', 'stays', 'experiences', 'cards', 'money', 'docs', 'driver', 'phrases', 'visa', 'emergency', 'convert', 'health', 'info', 'notes', 'clocks']) {
      expect(isPocketSection(s)).toBe(true);
    }
    expect(isPocketSection('cn26-stay-00')).toBe(false);
    expect(isPocketSection(undefined)).toBe(false);
  });
});

describe('routes · every old link still resolves', () => {
  const cases: [string, Partial<Extract<Route, { name: 'trip' }>>][] = [
    ['#/trip/cn26/today', { place: 'now' }],
    ['#/trip/cn26/itinerary', { place: 'journey' }],
    ['#/trip/cn26/itinerary/cn26-stop-zhangjiajie', { place: 'journey', sub: 'cn26-stop-zhangjiajie' }],
    ['#/trip/cn26/wallet', { place: 'pocket' }],
    ['#/trip/cn26/wallet/cn26-stay-11', { place: 'pocket', sub: 'cn26-stay-11' }],
    ['#/trip/cn26/wallet/spend', { place: 'pocket', sub: 'money' }],
    ['#/trip/cn26/tasks', { place: 'now', sub: 'todo' }],
    ['#/trip/cn26/tasks/packing', { place: 'now', sub: 'todo', view: 'packing' }],
    ['#/trip/cn26/tasks/lists', { place: 'now', sub: 'todo', view: 'lists' }],
    ['#/trip/cn26/info', { place: 'pocket' }],
    ['#/trip/cn26/map', { place: 'journey', anchor: 'route' }],
    ['#/trip/cn26/stats', { place: 'journey', anchor: 'stats' }],
    ['#/trip/cn26/docs', { place: 'pocket', sub: 'docs' }],
  ];
  for (const [hash, want] of cases) {
    it(`${hash} → ${want.place}${want.sub ? '/' + want.sub : ''}`, () => {
      expect(trip(parseHash(hash))).toMatchObject({ tripId: 'cn26', ...want });
    });
  }
});

describe('routes · the canonical hash', () => {
  it('rewrites an old name to the new one', () => {
    expect(routeHash(parseHash('#/trip/cn26/wallet/cn26-flight-mu733'))).toBe('#/trip/cn26/pocket/cn26-flight-mu733');
    expect(routeHash(parseHash('#/trip/cn26/tasks/packing'))).toBe('#/trip/cn26/now/todo/packing');
    expect(routeHash(parseHash('#/trip/cn26/stats'))).toBe('#/trip/cn26/journey');
    expect(routeHash(parseHash('#/trip/cn26/info'))).toBe('#/trip/cn26/pocket');
  });

  it('is a fixed point for every canonical route', () => {
    for (const h of ['#/trip/cn26/now', '#/trip/cn26/now/todo', '#/trip/cn26/journey/cn26-stop-kunyu', '#/trip/cn26/pocket/money', '#/trip/cn26/find', '#/trips', '#/settings', '#/backup']) {
      expect(routeHash(parseHash(h))).toBe(h);
    }
  });

  it('encodes and decodes an id that needs it', () => {
    const r = parseHash('#/trip/a%20b/pocket/x%2Fy');
    expect(trip(r)).toMatchObject({ tripId: 'a b', sub: 'x/y' });
    expect(routeHash(r)).toBe('#/trip/a%20b/pocket/x%2Fy');
  });

  it('goTab paths: a legacy id and a place land in the same place', () => {
    expect(tabPath('cn26', 'itinerary')).toBe('#/trip/cn26/journey');
    expect(tabPath('cn26', 'journey')).toBe('#/trip/cn26/journey');
    expect(tabPath('cn26', 'tasks')).toBe('#/trip/cn26/now/todo');
    expect(tabPath('cn26', 'wallet')).toBe('#/trip/cn26/pocket');
    expect(tabPath('cn26', 'today')).toBe('#/trip/cn26/now');
  });
});

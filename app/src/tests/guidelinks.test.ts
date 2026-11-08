/* GUIDE ME'S HAND-OFF (Map 5c, lib/logic/geo.ts) — "Turn-by-turn in Amap" on
   Amap's own datum (GCJ-02 inland, plain in Hong Kong), its web fallback's
   LNG,LAT order, Google directions by name first, and walk or drive. */
import { describe, expect, it } from 'vitest';
import { amapRouteUrl, amapWebRouteUrl, googleDirectionsUrl, modeFor, toAmapDatum } from '../lib/logic/geo';

/* the demo's Sample Blind Massage, Shanghai, and its Hong Kong stop */
const massage = { lat: 31.2242, lng: 121.4691 };
const tst = { lat: 22.2934, lng: 114.1751 };

describe('Guide me · Amap turn-by-turn', () => {
  it('inland, the destination goes on Amap’s shifted datum; t=2 walks, t=0 drives', () => {
    const g = toAmapDatum(massage);
    expect(g.lat).not.toBeCloseTo(massage.lat, 4);
    const url = amapRouteUrl(massage, '样本盲人按摩', 'walk');
    expect(url).toMatch(/^androidamap:\/\/route\?sourceApplication=ltd&/);
    expect(url).toContain(`dlat=${g.lat.toFixed(6)}&dlon=${g.lng.toFixed(6)}`);
    expect(url).toContain(`dname=${encodeURIComponent('样本盲人按摩')}`);
    expect(url).toContain('dev=0');
    expect(url).toMatch(/&t=2$/);
    expect(amapRouteUrl(massage, 'x', 'drive')).toMatch(/&t=0$/);
  });
  it('Hong Kong is not shifted', () => {
    expect(amapRouteUrl(tst, 'TST', 'walk')).toContain(`dlat=${tst.lat.toFixed(6)}&dlon=${tst.lng.toFixed(6)}`);
  });
  it('the web fallback takes LNG,LAT and says the datum is Amap’s', () => {
    const g = toAmapDatum(massage);
    const url = amapWebRouteUrl(massage, 'Sample Blind Massage', 'walk');
    expect(url).toContain(`to=${g.lng.toFixed(6)},${g.lat.toFixed(6)},Sample%20Blind%20Massage`);
    expect(url).toContain('mode=walk');
    expect(url).toContain('coordinate=gaode');
    expect(amapWebRouteUrl(massage, 'x', 'drive')).toContain('mode=car');
  });
});

describe('Guide me · Google directions', () => {
  it('by the place’s name where it has one, else its coordinate; a saved link wins', () => {
    expect(googleDirectionsUrl({ query: '样本盲人按摩', city: '上海' }, 'walk')).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('样本盲人按摩 上海')}&travelmode=walking`,
    );
    expect(googleDirectionsUrl({ coord: massage }, 'drive')).toBe('https://www.google.com/maps/dir/?api=1&destination=31.224200,121.469100&travelmode=driving');
    expect(googleDirectionsUrl({ url: 'https://maps.app.goo.gl/abc', query: 'x' }, 'walk')).toBe('https://maps.app.goo.gl/abc');
    expect(googleDirectionsUrl({}, 'walk')).toBeNull();
  });
  it('a stroll walks, farther drives, and no distance walks', () => {
    expect(modeFor(1900)).toBe('walk');
    expect(modeFor(2500)).toBe('walk');
    expect(modeFor(8400)).toBe('drive');
    expect(modeFor(null)).toBe('walk');
  });
});

/* MAP 5D — Guide me's first button follows the territory rule the map
   buttons keep (isAmapTerritory): Hong Kong and Macau pins were offered
   "Turn-by-turn in Amap — works in mainland China without a VPN", and the
   Israel sample trip an Amap route to Israel. */
describe('Guide me · which app is the first button', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { guideApp } = await import('../lib/logic/geo');
  const { mapPlaces } = await import('../lib/logic/mapplaces');
  const pinned = (file: string) => {
    const t = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', file), 'utf8')).trips[0];
    return mapPlaces({ tripId: 'x', stops: t.stops, showCards: t.showCards, bookings: t.bookings, dayPlans: t.dayPlans, dayDefaults: t.dayDefaults }).filter((p) => p.pos);
  };
  it('the demo trip: Amap on the mainland; Google for the 22 Hong Kong and Macau pins', () => {
    const dm = pinned('demo-2027.trip.json');
    const google = dm.filter((p) => guideApp(p.target) === 'google');
    /* every pin of the Hong Kong & Macau stop, and nothing else */
    expect(google).toHaveLength(22);
    expect(dm.filter((p) => p.stopId === 'dm27-stop-hongkong')).toHaveLength(22);
    expect(google.every((p) => p.stopId === 'dm27-stop-hongkong')).toBe(true);
    expect(google.map((p) => p.id)).toEqual(expect.arrayContaining(['dm27-spot-hongkong-tai-kwun', 'dm27-spot-hongkong-ruins-st-paul', 'dm27-spot-hongkong-the-peak']));
    expect(dm.filter((p) => p.stopId === 'dm27-stop-shanghai').every((p) => guideApp(p.target) === 'amap')).toBe(true);
    expect(guideApp({ coord: massage })).toBe('amap');
    expect(guideApp({ coord: tst })).toBe('google');
    /* a place that opens by name: its words say Hong Kong or Macau */
    expect(guideApp({ query: 'Tai Kwun', city: 'Hong Kong' })).toBe('google');
    expect(guideApp({ query: '样本盲人按摩', city: '上海' })).toBe('amap');
  });
  it('the Israel sample trip: Google, never an Amap route to Israel', () => {
    const il = pinned('israel-test.trip.json');
    expect(il.length).toBeGreaterThan(0);
    expect(il.every((p) => guideApp(p.target) === 'google')).toBe(true);
  });
});

/* TURN-BY-TURN (demo): a day's metro leg goes out as public transit, and the
   traveller's choice of app (Settings › Turn-by-turn) beats the automatic one. */
describe('Turn-by-turn · transit and the chosen app', () => {
  it('transit is t=1 in Amap, mode=bus on its web page, travelmode=transit in Google', () => {
    expect(amapRouteUrl(massage, 'x', 'transit')).toMatch(/&t=1$/);
    expect(amapWebRouteUrl(massage, 'x', 'transit')).toContain('mode=bus');
    expect(googleDirectionsUrl({ coord: massage }, 'transit')).toBe('https://www.google.com/maps/dir/?api=1&destination=31.224200,121.469100&travelmode=transit');
  });
  it('automatic keeps Amap inland and Google in Hong Kong; a chosen app always wins', async () => {
    const { navAppFor } = await import('../lib/state/navApp.svelte');
    expect(navAppFor({ coord: massage }, 'auto')).toBe('amap');
    expect(navAppFor({ coord: tst }, 'auto')).toBe('google');
    expect(navAppFor({ coord: massage }, 'google')).toBe('google');
    expect(navAppFor({ coord: tst }, 'amap')).toBe('amap');
  });
  it('a leg goes out in its own mode: walk, taxi as a drive, metro as transit', async () => {
    const { LEG_TRAVEL } = await import('../lib/platform/directions');
    expect(LEG_TRAVEL).toEqual({ walk: 'walk', taxi: 'drive', metro: 'transit' });
  });
});

/* A7 — a day's leg starts at the stop before it */
describe('a day’s leg · directions from the leg’s own start', () => {
  const hk = { lat: 22.2809, lng: 114.1583 };
  it('Google: origin is the from-place’s name, else its verified coordinate; no origin is as before', () => {
    expect(googleDirectionsUrl({ query: '样本盲人按摩', city: '上海' }, 'walk', { query: '新天地', city: '上海' })).toBe(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('新天地 上海')}&destination=${encodeURIComponent('样本盲人按摩 上海')}&travelmode=walking`,
    );
    expect(googleDirectionsUrl({ coord: massage }, 'drive', { coord: tst })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=22.293400,114.175100&destination=31.224200,121.469100&travelmode=driving',
    );
    expect(googleDirectionsUrl({ coord: massage }, 'transit', {})).toBe('https://www.google.com/maps/dir/?api=1&destination=31.224200,121.469100&travelmode=transit');
    expect(googleDirectionsUrl({ coord: massage }, 'walk')).toBe('https://www.google.com/maps/dir/?api=1&destination=31.224200,121.469100&travelmode=walking');
  });
  it('Google: "walking" is the documented travelmode; the first stop, with no leg, names none', () => {
    expect(googleDirectionsUrl({ coord: hk }, 'walk')).toContain('&travelmode=walking');
    expect(googleDirectionsUrl({ coord: hk }, 'walk')).not.toMatch(/bicycling/);
    expect(googleDirectionsUrl({ coord: hk }, null)).toBe('https://www.google.com/maps/dir/?api=1&destination=22.280900,114.158300');
  });
  it('Amap: both ends verified → the route URI with slat/slon/sname, each on Amap’s datum', () => {
    const g = toAmapDatum(massage);
    const s = toAmapDatum(tst);
    const url = amapRouteUrl(massage, '样本盲人按摩', 'walk', { coord: tst, name: 'TST' });
    expect(url).toBe(
      `androidamap://route?sourceApplication=ltd&slat=${s.lat.toFixed(6)}&slon=${s.lng.toFixed(6)}&sname=TST&dlat=${g.lat.toFixed(6)}&dlon=${g.lng.toFixed(6)}&dname=${encodeURIComponent('样本盲人按摩')}&dev=0&t=2`,
    );
    const inland = toAmapDatum({ lat: 31.24, lng: 121.4903 });
    expect(amapRouteUrl(massage, 'x', 'drive', { coord: { lat: 31.24, lng: 121.4903 }, name: '外滩' })).toContain(`slat=${inland.lat.toFixed(6)}&slon=${inland.lng.toFixed(6)}&sname=${encodeURIComponent('外滩')}`);
    expect(amapWebRouteUrl(massage, 'x', 'walk', { coord: tst, name: 'TST' })).toContain(`from=${s.lng.toFixed(6)},${s.lat.toFixed(6)},TST&to=${g.lng.toFixed(6)},${g.lat.toFixed(6)},x`);
  });
  it('Amap: no start is today’s URL, and no mode is a drive', () => {
    expect(amapRouteUrl(massage, 'x', 'walk')).not.toContain('slat');
    expect(amapWebRouteUrl(massage, 'x', 'walk')).not.toContain('from=');
    expect(amapRouteUrl(massage, 'x', null)).toMatch(/&t=0$/);
    expect(amapWebRouteUrl(massage, 'x', null)).toContain('mode=car');
  });
});

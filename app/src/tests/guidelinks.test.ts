/* GUIDE ME'S HAND-OFF (Map 5c, lib/logic/geo.ts) — "Turn-by-turn in Amap" on
   Amap's own datum (GCJ-02 inland, plain in Hong Kong), its web fallback's
   LNG,LAT order, Google directions by name first, and walk or drive. */
import { describe, expect, it } from 'vitest';
import { amapRouteUrl, amapWebRouteUrl, googleDirectionsUrl, modeFor, toAmapDatum } from '../lib/logic/geo';

const massage = { lat: 39.9337, lng: 116.3655 };
const tst = { lat: 22.2934, lng: 114.1751 };

describe('Guide me · Amap turn-by-turn', () => {
  it('inland, the destination goes on Amap’s shifted datum; t=2 walks, t=0 drives', () => {
    const g = toAmapDatum(massage);
    expect(g.lat).not.toBeCloseTo(massage.lat, 4);
    const url = amapRouteUrl(massage, '北京按摩医院', 'walk');
    expect(url).toMatch(/^androidamap:\/\/route\?sourceApplication=ltd&/);
    expect(url).toContain(`dlat=${g.lat.toFixed(6)}&dlon=${g.lng.toFixed(6)}`);
    expect(url).toContain(`dname=${encodeURIComponent('北京按摩医院')}`);
    expect(url).toContain('dev=0');
    expect(url).toMatch(/&t=2$/);
    expect(amapRouteUrl(massage, 'x', 'drive')).toMatch(/&t=0$/);
  });
  it('Hong Kong is not shifted', () => {
    expect(amapRouteUrl(tst, 'TST', 'walk')).toContain(`dlat=${tst.lat.toFixed(6)}&dlon=${tst.lng.toFixed(6)}`);
  });
  it('the web fallback takes LNG,LAT and says the datum is Amap’s', () => {
    const g = toAmapDatum(massage);
    const url = amapWebRouteUrl(massage, 'Beijing Massage Hospital', 'walk');
    expect(url).toContain(`to=${g.lng.toFixed(6)},${g.lat.toFixed(6)},Beijing%20Massage%20Hospital`);
    expect(url).toContain('mode=walk');
    expect(url).toContain('coordinate=gaode');
    expect(amapWebRouteUrl(massage, 'x', 'drive')).toContain('mode=car');
  });
});

describe('Guide me · Google directions', () => {
  it('by the place’s name where it has one, else its coordinate; a saved link wins', () => {
    expect(googleDirectionsUrl({ query: '北京按摩医院', city: '北京' }, 'walk')).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('北京按摩医院 北京')}&travelmode=walking`,
    );
    expect(googleDirectionsUrl({ coord: massage }, 'drive')).toBe('https://www.google.com/maps/dir/?api=1&destination=39.933700,116.365500&travelmode=driving');
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

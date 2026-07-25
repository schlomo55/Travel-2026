import { describe, expect, it } from 'vitest';
import {
  amapAppSearchUrl,
  amapAppUrl,
  amapWebSearchUrl,
  safeMapUrl,
  amapWebUrl,
  geoUri,
  googleMapsUrl,
  isShiftedDatumArea,
  outOfChina,
  toAmapDatum,
  wgs84ToGcj02,
} from '../lib/logic/geo';

/** Reference pairs. The offset is a few hundred metres, always NE-ish inland. */
const TIANANMEN = { lat: 39.9075, lng: 116.3972 };
const SHANGHAI_BUND = { lat: 31.2397, lng: 121.4903 };
const GUANGZHOU = { lat: 23.1291, lng: 113.2644 };

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

describe('wgs84ToGcj02', () => {
  it('lands Tiananmen on the published GCJ-02 value', () => {
    const g = wgs84ToGcj02(TIANANMEN.lat, TIANANMEN.lng);
    /* The reference in the plan: 39.9075,116.3972 → ≈39.9089,116.4034 */
    expect(g.lat).toBeCloseTo(39.9089, 3);
    expect(g.lng).toBeCloseTo(116.4034, 3);
  });

  it('shifts by the 100–600 m the mainland datum is known for', () => {
    for (const p of [TIANANMEN, SHANGHAI_BUND, GUANGZHOU]) {
      const d = metres(p, wgs84ToGcj02(p.lat, p.lng));
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThan(700);
    }
  });

  it('is deterministic and pure', () => {
    expect(wgs84ToGcj02(TIANANMEN.lat, TIANANMEN.lng)).toEqual(wgs84ToGcj02(TIANANMEN.lat, TIANANMEN.lng));
  });

  it('is a no-op outside China', () => {
    expect(outOfChina(48.8584, 2.2945)).toBe(true); // Eiffel Tower
    expect(wgs84ToGcj02(48.8584, 2.2945)).toEqual({ lat: 48.8584, lng: 2.2945 });
  });
});

describe('the Hong Kong exemption', () => {
  const TST = { lat: 22.2934, lng: 114.1751 };

  it('does not treat Hong Kong as a shifted-datum area', () => {
    expect(isShiftedDatumArea(TST.lat, TST.lng)).toBe(false);
    expect(toAmapDatum(TST)).toEqual(TST);
  });

  it('still shifts the mainland', () => {
    expect(isShiftedDatumArea(TIANANMEN.lat, TIANANMEN.lng)).toBe(true);
    expect(toAmapDatum(TIANANMEN)).not.toEqual(TIANANMEN);
  });
});

describe('link builders', () => {
  it('gives Google plain WGS-84, lat first, when only a coordinate is known', () => {
    expect(googleMapsUrl({ coord: TIANANMEN })).toBe(
      'https://www.google.com/maps/search/?api=1&query=39.907500,116.397200',
    );
  });

  it('opens the PLACE, not a dot, once a name is known', () => {
    /* The owner's complaint: a coordinate link lands on a nameless pin. */
    expect(googleMapsUrl({ query: '洪崖洞', city: '重庆', coord: TIANANMEN })).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('洪崖洞, 重庆'),
    );
    expect(amapAppSearchUrl({ query: '洪崖洞', city: '重庆' })).toBe(
      'androidamap://poi?sourceApplication=ltd&keywords=' +
        encodeURIComponent('洪崖洞') +
        '&city=' +
        encodeURIComponent('重庆') +
        '&dev=0',
    );
    expect(amapWebSearchUrl({ query: '武陵源' })).toBe(
      'https://uri.amap.com/search?keyword=' + encodeURIComponent('武陵源'),
    );
    expect(amapAppSearchUrl({ coord: TIANANMEN })).toBeNull();
  });

  it('lets a pasted share link win, and refuses anything that is not a web link', () => {
    const share = 'https://maps.app.goo.gl/fHfSus2NQN8NmxKcA';
    expect(googleMapsUrl({ url: share, query: '武陵源', coord: TIANANMEN })).toBe(share);
    expect(safeMapUrl(share)).toBe(share);
    expect(safeMapUrl('javascript:alert(1)')).toBeNull();
    expect(safeMapUrl('androidamap://poi?keywords=x')).toBeNull();
    expect(safeMapUrl('not a url')).toBeNull();
    expect(safeMapUrl(undefined)).toBeNull();
    /* Nothing to open at all — the buttons must not render. */
    expect(googleMapsUrl({})).toBeNull();
  });

  it('gives the Amap app the shifted datum with lat/lon named params', () => {
    const url = amapAppUrl(TIANANMEN, '天安门');
    expect(url.startsWith('androidamap://viewMap?sourceApplication=ltd&lat=39.908')).toBe(true);
    expect(url).toContain('&lon=116.403');
    expect(url).toContain('&dev=0');
    expect(url).toContain(encodeURIComponent('天安门'));
  });

  it("gives the Amap web URI its position as LNG,LAT — the order it wants", () => {
    const url = amapWebUrl(TIANANMEN, 'x');
    const pos = /position=([-\d.]+),([-\d.]+)/.exec(url);
    expect(pos).toBeTruthy();
    expect(Number(pos?.[1])).toBeCloseTo(116.4034, 2); // longitude first
    expect(Number(pos?.[2])).toBeCloseTo(39.9089, 2);
  });

  it('escapes a place name with spaces and punctuation', () => {
    expect(amapWebUrl(TIANANMEN, 'Beijing South Railway Station')).toContain('name=Beijing%20South%20Railway%20Station');
  });
});

describe('geoUri — the one link the phone opens', () => {
  it('sends a NAME as a search, so each app resolves it on its own datum', () => {
    /* The whole reason a name beats a coordinate on the mainland: nothing is
       handed to Amap that GCJ-02 could shift. */
    expect(geoUri({ query: '洪崖洞', city: '重庆' })).toBe('geo:0,0?q=' + encodeURIComponent('洪崖洞, 重庆'));
    expect(geoUri({ query: '洪崖洞', city: '重庆' })).toContain('%E6%B4%AA%E5%B4%96%E6%B4%9E');
    /* A name wins over a coordinate even when both are known. */
    expect(geoUri({ query: '武陵源', coord: TIANANMEN })).toBe('geo:0,0?q=' + encodeURIComponent('武陵源'));
  });

  it('sends a COORDINATE as a labelled pin, in WGS-84 — never the shifted datum', () => {
    const uri = geoUri({ coord: TIANANMEN }, '天安门');
    expect(uri).toBe('geo:39.907500,116.397200?q=39.907500,116.397200(' + encodeURIComponent('天安门') + ')');
    /* If this ever carried 39.9089 it would be GCJ-02, and every app that
       converts on the way in would double-shift the pin. */
    expect(uri).not.toContain('39.908');
    expect(geoUri({ coord: TIANANMEN })).toBe('geo:39.907500,116.397200?q=39.907500,116.397200');
  });

  it('refuses to wrap a saved share link, and has nothing to say about nothing', () => {
    /* A pasted https link is opened as itself; there is nothing to convert. */
    expect(geoUri({ url: 'https://maps.app.goo.gl/fHfSus2NQN8NmxKcA' })).toBeNull();
    expect(geoUri({})).toBeNull();
    /* An unopenable value is not a URL, so the name/coordinate still decide. */
    expect(geoUri({ url: 'javascript:alert(1)', query: '大理古城' })).toBe(
      'geo:0,0?q=' + encodeURIComponent('大理古城'),
    );
  });
});

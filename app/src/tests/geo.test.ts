import { describe, expect, it } from 'vitest';
import {
  ADDRESS_MAX,
  QUERY_MAX,
  amapAppSearchUrl,
  amapAppUrl,
  amapWebSearchUrl,
  joinAddress,
  safeMapUrl,
  amapWebUrl,
  geoUri,
  googleMapsUrl,
  isAmapTerritory,
  isHongKongOrMacau,
  isShiftedDatumArea,
  outOfChina,
  searchTerms,
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

  /* REGRESSION, 2026-07-28. Shenzhen sits directly across the border river and
     lands inside the crude HK box on BOTH axes, so the Shan Clinic driver card
     (cn26-place-24, 深南大道2003号 in Futian) was being sent to Google Maps —
     blocked where it stands — and exempted from the GCJ-02 shift. Latitude
     alone cannot separate the two: Hong Kong reaches 22.56°N, Futian is at
     22.54°N. Both consequences are checked here, because they are one
     question answered in two places. */
  const FUTIAN = { lat: 22.5416, lng: 114.0607 };

  it('treats Shenzhen as the mainland, though it falls inside the Hong Kong box', () => {
    expect(isHongKongOrMacau({ coord: FUTIAN })).toBe(false);
    expect(isShiftedDatumArea(FUTIAN.lat, FUTIAN.lng)).toBe(true);
    expect(toAmapDatum(FUTIAN)).not.toEqual(FUTIAN);
  });

  /* REGRESSION, 2026-08-01. The rule used to be "not Hong Kong or Macau", which
     handed Amap two airports on other continents. Amap cannot hold them, so it
     answered with the nearest Chinese thing of that name — both in Beijing:
       Ben Gurion Airport         → the Israeli Embassy, Chaoyang
       Zayed International Airport → an Emirates office, Chaoyang
     Those are the cards for the flights that open and close the trip. */
  it('sends places outside China to Google, not to Amap', () => {
    const TLV = { lat: 32.0114, lng: 34.8867 };
    const AUH = { lat: 24.4328, lng: 54.6511 };
    expect(isAmapTerritory({ query: 'Ben Gurion Airport', coord: TLV })).toBe(false);
    expect(isAmapTerritory({ query: 'Zayed International Airport', coord: AUH })).toBe(false);
    /* …while the mainland still gets Amap, including the Shenzhen case above. */
    expect(isAmapTerritory({ query: '中国国家博物馆', coord: TIANANMEN })).toBe(true);
    expect(isAmapTerritory({ coord: FUTIAN })).toBe(true);
    /* …and Hong Kong stays on Google, which it already was. */
    expect(isAmapTerritory({ coord: TST })).toBe(false);
  });

  it('keeps Hong Kong and Macau on the Google side of that same fix', () => {
    expect(isHongKongOrMacau({ coord: TST })).toBe(true);
    /* HKG airport, and Senado Square — the tightest Macau margin, ~4 km. */
    expect(isHongKongOrMacau({ coord: { lat: 22.3089, lng: 113.9144 } })).toBe(true);
    expect(isHongKongOrMacau({ coord: { lat: 22.1936, lng: 113.5397 } })).toBe(true);
    /* Sha Tin is the northernmost Hong Kong place this trip uses, and is
       comfortably south of the Shenzhen box's 22.52 floor. */
    expect(isHongKongOrMacau({ coord: { lat: 22.3826, lng: 114.1892 } })).toBe(true);
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
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('洪崖洞 重庆'),
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

  /* REGRESSION, 2026-08-01, found on the phone. encodeURIComponent leaves
     ! ' ( ) * alone because they are legal in a URI — and a literal apostrophe
     kills a Google Maps link stone dead. Three forms of one query, on the
     device:
       Ruins%20of%20St.%20Paul's%20Macau   → Maps opened its HOME SCREEN
       Ruins%20of%20St.%20Paul%27s%20Macau → 大三巴牌坊, 4.4 stars, 26,445 reviews
     Four of this trip's places carry an apostrophe: Dragon's Back, the Ruins of
     St. Paul's, Lord Stow's Bakery and Tina's. */
  it("escapes the apostrophe, which encodeURIComponent leaves alone", () => {
    const g = googleMapsUrl({ query: "Ruins of St. Paul's", city: 'Macau' });
    expect(g).toContain('%27');
    expect(g).not.toMatch(/'/);
    const geo = geoUri({ query: "Tina's", city: '虎跳峡' });
    expect(geo).toContain('%27');
    expect(geo).not.toMatch(/'/);
    /* …and the same for the other characters it skips, so no future place name
       with a bracket or a star has to rediscover this. */
    expect(googleMapsUrl({ query: "A(B)*C!", city: 'X' })).not.toMatch(/[!()*]/);
  });

  it('escapes a place name with spaces and punctuation', () => {
    expect(amapWebUrl(TIANANMEN, 'Beijing South Railway Station')).toContain('name=Beijing%20South%20Railway%20Station');
  });
});

describe('geoUri — the one link the phone opens', () => {
  it('separates terms with a space, never a comma — Amap reads q as one keyword', () => {
    /* Proven on the phone 2026-07-25: `geo:0,0?q=中国国家博物馆, 北京` makes Amap
       answer "Info not found"; the same query space-joined opens the National
       Museum of China. Google accepts both, so the space is the shared format. */
    const t = { query: '中国国家博物馆', city: '北京' };
    const q = (t: Parameters<typeof geoUri>[0]) =>
      decodeURIComponent((geoUri(t) as string).split('?q=')[1] ?? '');
    expect(geoUri(t)).toBe('geo:0,0?q=' + encodeURIComponent('中国国家博物馆 北京'));
    expect(q(t)).not.toContain(',');
    const withAddr = { query: '洪崖洞', addressInSearch: true, address: '重庆市渝中区朝天门街道沧白路', city: '重庆' };
    expect(q(withAddr)).not.toContain(',');
    expect(searchTerms(withAddr)).not.toContain(',');
  });

  it('sends a NAME as a search, so each app resolves it on its own datum', () => {
    /* The whole reason a name beats a coordinate on the mainland: nothing is
       handed to Amap that GCJ-02 could shift. */
    expect(geoUri({ query: '洪崖洞', city: '重庆' })).toBe('geo:0,0?q=' + encodeURIComponent('洪崖洞 重庆'));
    expect(geoUri({ query: '洪崖洞', city: '重庆' })).toContain('%E6%B4%AA%E5%B4%96%E6%B4%9E');
    /* A name wins over a coordinate even when both are known. */
    expect(geoUri({ query: '武陵源', coord: TIANANMEN })).toBe('geo:0,0?q=' + encodeURIComponent('武陵源'));
  });

  it('sends a COORDINATE as a BARE pin, in WGS-84 — never the shifted datum, never a label', () => {
    /* Amap does not decode the `(name)` part: with a label it drew no pin at
       all and left the raw %E2%80%94 in its search box (phone, 2026-07-25). */
    const uri = geoUri({ coord: TIANANMEN });
    expect(uri).toBe('geo:39.907500,116.397200?q=39.907500,116.397200');
    expect(uri).not.toContain('(');
    /* If this ever carried 39.9089 it would be GCJ-02, and every app that
       converts on the way in would double-shift the pin. */
    expect(uri).not.toContain('39.908');
    expect(geoUri({ coord: TIANANMEN })).toBe('geo:39.907500,116.397200?q=39.907500,116.397200');
  });

  it('keeps the ADDRESS out of the search unless the entry asks for it', () => {
    /* The owner asked for "the place itself… or using the addresses". Both:
       the name still leads, the address narrows it to one building. */
    const t = { query: '洪崖洞', addressInSearch: true, address: '重庆市渝中区解放碑街道解放碑书院巷', city: '重庆' };
    expect(geoUri(t)).toBe('geo:0,0?q=' + encodeURIComponent('洪崖洞 重庆市渝中区解放碑街道解放碑书院巷 重庆'));
    /* The name is still the first thing the search sees. */
    expect(searchTerms(t).startsWith('洪崖洞')).toBe(true);
    /* Chinese survives the encoding, as bytes a map app can read back. */
    expect(geoUri(t)).toContain(encodeURIComponent('渝中区'));
  });

  it('keeps the precedence: saved link > name+address > name > coordinate', () => {
    const share = 'https://maps.app.goo.gl/fHfSus2NQN8NmxKcA';
    const all = { url: share, query: '洪崖洞', addressInSearch: true, address: '重庆市渝中区解放碑街道', city: '重庆', coord: TIANANMEN };
    /* 1 · a link the owner pasted wins outright and is never wrapped. */
    expect(googleMapsUrl(all)).toBe(share);
    expect(geoUri(all)).toBeNull();
    /* 2 · name + address beats 3 · name alone… */
    const { url: _u, ...noUrl } = all;
    expect(searchTerms(noUrl)).toBe('洪崖洞 重庆市渝中区解放碑街道 重庆');
    const { address: _a, ...noAddr } = noUrl;
    expect(searchTerms(noAddr)).toBe('洪崖洞 重庆');
    /* …and both beat 4 · the coordinate, which only speaks when nothing else can. */
    expect(geoUri({ coord: TIANANMEN })).toContain('39.907500');
    expect(googleMapsUrl({})).toBeNull();
  });

  it('lets an address ALONE open a place — the one-paste fix for a bed', () => {
    /* Blossom House Houhai ships no name and no coordinate — booked, but its
       confirmation names a district rather than a street. The moment an
       address is typed, a button must appear. (Four Points was the example
       here until 2026-07-27, when booking it produced the address it now
       ships.) The value below is a typed test string, not a sourced fact. */
    const bed = { address: '北京市朝阳区工人体育场东路4号' };
    expect(googleMapsUrl(bed)).toContain(encodeURIComponent('北京市朝阳区工人体育场东路4号'));
    expect(geoUri(bed)).toBe('geo:0,0?q=' + encodeURIComponent('北京市朝阳区工人体育场东路4号'));
    expect(amapAppSearchUrl(bed)).toContain('keywords=' + encodeURIComponent('北京市朝阳区工人体育场东路4号'));
    /* A cleared field is an absent field — no button searches for whitespace. */
    expect(googleMapsUrl({ address: '   ' })).toBeNull();
    expect(geoUri({ address: '   ' })).toBeNull();
    expect(googleMapsUrl({})).toBeNull();
    expect(geoUri({})).toBeNull();
  });

  it('drops the address rather than send an absurdly long search', () => {
    const long = '重庆市'.repeat(50); // 150 characters of postal noise
    expect(long.length).toBeGreaterThan(QUERY_MAX);
    const t = { query: '洪崖洞', address: long, city: '重庆' };
    expect(searchTerms(t)).toBe('洪崖洞 重庆');
    expect(searchTerms(t).length).toBeLessThanOrEqual(QUERY_MAX);
    /* Just under the cap it is kept — the rule is a cap, not a dislike. */
    const short = { query: '洪崖洞', addressInSearch: true, address: '渝中区解放碑街道', city: '重庆' };
    expect(searchTerms(short)).toContain('渝中区解放碑街道');
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

describe('joinAddress — the address as it is written where it is used', () => {
  it('writes a Chinese address biggest-first and unseparated', () => {
    expect(joinAddress(['重庆市', '渝中区', '朝天门街道', '千厮门大桥'])).toBe('重庆市渝中区朝天门街道千厮门大桥');
    /* The plan's second measured example, same shape. */
    expect(joinAddress(['北京市', '怀柔区', '雁栖镇'])).toBe('北京市怀柔区雁栖镇');
  });

  it('writes a latin address the other way round, smallest-first with commas', () => {
    expect(joinAddress(['Hong Kong', 'Yau Tsim Mong District', 'Salisbury Road'])).toBe(
      'Salisbury Road, Yau Tsim Mong District, Hong Kong',
    );
  });

  it('trims from the BIG end when it runs long — the taxi is already in the city', () => {
    const out = joinAddress(['云南省', '丽江市', '古城区', '祥和街道', '太和社区', '吉祥路'.repeat(15)]);
    expect(out.length).toBeLessThanOrEqual(ADDRESS_MAX);
    /* The street is what survives; the province is what goes. */
    expect(out).toContain('吉祥路');
    expect(out.startsWith('云南省')).toBe(false);
  });

  it('drops empty rungs and repeats, and invents nothing', () => {
    expect(joinAddress(['', '  ', '重庆市', '重庆市', '渝中区'])).toBe('重庆市渝中区');
    expect(joinAddress([])).toBe('');
    expect(joinAddress(['   '])).toBe('');
  });
});

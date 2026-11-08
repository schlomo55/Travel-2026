/* THE CITY CLOSE-UP — pins only where the trip file stores a coordinate,
   everything else listed as "No pin yet", and the ways out drawn as bearings
   towards real neighbouring stops. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import {
  bearing,
  buildCityMap,
  cityConstellation,
  cityKeepOut,
  cityPlaces,
  labelSize,
  layoutCity,
  nearestStop,
  pinText,
  scaleBar,
  stayRoute,
  wayOnLine,
} from '../lib/logic/citymap';
import { buildConnectors } from '../lib/logic/connectors';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const hs = demo.stops.find((s) => s.id === 'dm27-stop-huangshan')!;
const all = {
  stops: demo.stops,
  showCards: demo.showCards,
  bookings: demo.bookings,
  dayPlans: demo.dayPlans,
  dayDefaults: demo.dayDefaults,
};
const box = { width: 412, height: 420, pad: 40 };

describe('city map · Huangshan, the demo trip', () => {
  const places = cityPlaces(hs, all);
  const map = buildCityMap(hs, places, demo.stops, box)!;

  it('pins the three verified places: the park gate, the airport and the cableway', () => {
    const names = map.pins.flatMap((p) => p.places.map((x) => x.name));
    expect(names).toContain('汤口');
    expect(names).toContain('黄山屯溪国际机场');
    expect(names).toContain('云谷索道');
  });

  it('merges a card and a ticket that share one coordinate into one pin', () => {
    const cableway = map.pins.find((p) => p.places.some((x) => x.name === '云谷索道'))!;
    expect(cableway.places.map((x) => x.id).sort()).toEqual(['dm27-place-10', 'dm27-ticket-cableway']);
  });

  /* The spots and beds carry only the Map tab's `pin`, never a `coord`. */
  it('lists every mountain spot and both beds as "No pin yet" — never a guessed pin', () => {
    const noPin = map.noPin.map((p) => p.id);
    for (const s of hs.spots ?? []) if (!s.coord) expect(noPin).toContain(s.id);
    expect(noPin).toContain('dm27-stay-07'); // Pine Lodge
    expect(noPin).toContain('dm27-stay-08'); // Old Street Hotel
    expect(map.pins.every((p) => p.places.every((x) => x.coord))).toBe(true);
  });

  it('keeps Shanghai’s airports off a Huangshan map', () => {
    const ids = map.pins.flatMap((p) => p.places.map((x) => x.id));
    expect(ids).not.toContain('dm27-place-01'); // Pudong
    expect(ids).not.toContain('dm27-place-02'); // Hongqiao T2
    expect(ids).not.toContain('dm27-flight-mu5001'); // boards at Hongqiao
  });

  it('measures straight lines from the centre, and says how big a kilometre is', () => {
    const txn = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-08'))!;
    /* Tunxi airport sits down in the valley, ~45 km from the mountain */
    expect(txn.km).toBeGreaterThan(40);
    expect(txn.km).toBeLessThan(50);
    expect(map.kmPx).toBeGreaterThan(0);
  });

  /* The stop before Huangshan is Suzhou, which has no coordinate — so there
     is no bearing to draw, and the map draws no way in rather than a guessed
     one. */
  it('points the ways out at the real stops before and after — and not at one with no coordinate', () => {
    expect(map.exits.find((e) => e.role === 'in')).toBeUndefined();
    const out = map.exits.find((e) => e.role === 'out')!;
    expect(out.name).toBe('Chengdu');
    /* Chengdu is west (a little south) of Huangshan */
    expect(out.bearing).toBeGreaterThan(260);
    expect(out.bearing).toBeLessThan(290);
    /* on the edge of the padded box */
    expect(Math.min(out.x - box.pad, box.width - box.pad - out.x, out.y - box.pad, box.height - box.pad - out.y)).toBeCloseTo(0, 0);
  });
});

describe('city map · the rules', () => {
  it('belongs a coordinate to the nearest stop within reach, or to none', () => {
    expect(nearestStop({ lat: 30.1355, lng: 118.1669 }, demo.stops)?.id).toBe('dm27-stop-huangshan');
    /* Ping'an is the terraces, not Guilin, though they are ~55 km apart */
    expect(nearestStop({ lat: 25.7531, lng: 110.1092 }, demo.stops)?.id).toBe('dm27-stop-longji');
    /* Helsinki is a change of planes, nowhere on this trip's ground */
    expect(nearestStop({ lat: 60.3172, lng: 24.9633 }, demo.stops)).toBeNull();
  });

  it('computes a bearing clockwise from north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 0);
  });

  it('draws nothing where nothing is located', () => {
    const bare = { ...hs, coord: undefined, spots: [] };
    expect(buildCityMap(bare, [], demo.stops, box)).toBeNull();
  });
});

describe('city map · the stay, walked in order', () => {
  const places = cityPlaces(hs, all);
  const map = buildCityMap(hs, places, demo.stops, box)!;
  const placesOn = (d: string) => demo.dayPlans.find((p) => p.date === d)?.placeIds;
  const pinAt = (id: string) => map.pins.find((p) => p.places.some((x) => x.id === id))!;

  it('joins the pins the days themselves name, and leaves by the bearing to the next stop', () => {
    const hops = stayRoute(hs, map, placesOn, '2026-11-08');
    /* Apr 4 lands at TXN · Apr 5: the park gate · Apr 6: the cableway ·
       Apr 7: back to TXN, then out west */
    expect(hops.map((h) => h.date)).toEqual(['2027-04-05', '2027-04-06', '2027-04-07', '2027-04-07']);
    const txn = pinAt('dm27-place-08');
    const gate = pinAt('dm27-place-09');
    const cable = pinAt('dm27-place-10');
    expect(hops[0]!.from).toEqual({ x: txn.x, y: txn.y });
    expect(hops[0]!.to).toEqual({ x: gate.x, y: gate.y });
    expect(hops[1]!.to).toEqual({ x: cable.x, y: cable.y });
    expect(hops[3]!.exit).toBe(true);
    const out = map.exits.find((e) => e.role === 'out')!;
    expect(hops[3]!.to).toEqual({ x: out.x, y: out.y });
    /* Apr 4 also names Hongqiao (SHA), which is not on this map: no hop is invented to it */
    expect(hops.some((h) => h.date === '2027-04-04')).toBe(false);
  });

  it('says which hops are done, today and ahead, and flows only while you are here', () => {
    expect(stayRoute(hs, map, placesOn, '2026-11-08').some((h) => h.live)).toBe(false);
    const on6 = stayRoute(hs, map, placesOn, '2027-04-06');
    expect(on6.map((h) => h.state)).toEqual(['done', 'today', 'ahead', 'ahead']);
    expect(on6.findIndex((h) => h.live)).toBe(1);
    const on5 = stayRoute(hs, map, placesOn, '2027-04-05');
    expect(on5[0]!.state).toBe('today');
    expect(on5[0]!.live).toBe(true);
  });

  it('with no day naming a located place, leaves from the stop itself', () => {
    const hz = demo.stops.find((s) => s.id === 'dm27-stop-hangzhou')!;
    const km = buildCityMap(hz, cityPlaces(hz, all), demo.stops, box)!;
    const hops = stayRoute(hz, km, placesOn, '2026-11-08');
    expect(hops.length).toBe(1);
    expect(hops[0]!.exit).toBe(true);
    expect(hops[0]!.date).toBe(hz.end);
  });
});

describe('city map · the words on the pins', () => {
  const places = cityPlaces(hs, all);
  const map = buildCityMap(hs, places, demo.stops, box)!;

  it('names a pin by its driver card — the Chinese, and the first clause of its meaning', () => {
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-09'))!;
    const t = pinText(gate, demo.showCards, demo.bookings, '2027-04-04');
    expect(t.native).toBe('汤口');
    expect(t.title).toBe('Tangkou');
    expect(t.booking?.id).toBe('dm27-ticket-park-pass');
    const cable = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-10'))!;
    expect(pinText(cable, demo.showCards, demo.bookings, '2027-04-04').title).toBe('Yungu cableway');
  });

  /* Run 3b: a park gate once read "Sat 12 · Pending" under its name on the
     night a booked, paid hotel was the bed — the pending park pass's status,
     with nothing saying it was the pass's. */
  it('says which booking a pin’s line is about, with that booking’s own status', () => {
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-09'))!;
    for (const now of ['2027-04-04', '2027-04-05', '2027-04-08']) {
      const t = pinText(gate, demo.showCards, demo.bookings, now);
      expect(t.booking?.id).toBe('dm27-ticket-park-pass');
      expect(t.line).toBe('Mon 5\nticket pending');
    }
    /* the Pine Lodge carries a Map-tab `pin` but no `coord` — the city map
       draws coordinates only, so it is no pin's line, and it is listed */
    expect(map.pins.some((p) => p.places.some((x) => x.id === 'dm27-stay-07'))).toBe(false);
    expect(map.noPin.map((p) => p.id)).toContain('dm27-stay-07');
    const cable = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-10'))!;
    expect(pinText(cable, demo.showCards, demo.bookings, '2027-04-04').line).toBe('Tue 6 · 07:30\nticket pending');
  });

  it('speaks for a stay held at the pin before anything else there, and else for the next booking', () => {
    const lodge = demo.bookings.find((b) => b.id === 'dm27-stay-07')!;
    const pass = demo.bookings.find((b) => b.id === 'dm27-ticket-park-pass')!;
    const coord = { lat: 30.0947, lng: 118.1758 };
    const pin = { x: 0, y: 0, km: 0, places: [{ id: pass.id, name: 'pass', kind: 'booking' as const, coord }, { id: lodge.id, name: 'Lodge', kind: 'booking' as const, coord }] };
    const t = pinText(pin, [], [pass, lodge], '2027-04-05');
    expect(t.booking?.id).toBe('dm27-stay-07');
    /* two bookings at one pin: the line names the one it speaks for (Run 3c) */
    expect(t.line).toBe('Sun 4 → Tue 6\nSample Pine Lodge booked');
    /* Shanghai: MU 5003 from Pudong is CANCELLED, so it is on no pin and the
       Pudong pin speaks for nothing; the Hongqiao pin speaks for MU 5001 on
       every date — the map never sends you to Pudong for Apr 4. */
    const sh = demo.stops.find((s) => s.id === 'dm27-stop-shanghai')!;
    const sm = buildCityMap(sh, cityPlaces(sh, all), demo.stops, box)!;
    const pvg = sm.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-01'))!;
    expect(pvg.places.map((x) => x.id)).toEqual(['dm27-place-01']);
    expect(pinText(pvg, demo.showCards, demo.bookings, '2027-04-04').booking).toBeUndefined();
    const sha = sm.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-02'))!;
    for (const now of ['2027-03-29', '2027-04-02', '2027-04-04']) {
      expect(pinText(sha, demo.showCards, demo.bookings, now).line, now).toBe('Sun 4 · 19:10\nMU 5001 booked');
    }
  });

  /* Run 3c: two tickets of different status at one pin both read "ticket
     pending" / "ticket booked" — nothing said which ticket */
  it('names each ticket by its own title where a pin holds more than one', () => {
    const cable = demo.bookings.find((b) => b.id === 'dm27-ticket-cableway')!;
    const show = { ...demo.bookings.find((b) => b.id === 'dm27-ticket-concert')!, id: 'show', date: '2027-04-07' };
    const coord = { lat: 30.1218, lng: 118.2005 };
    const pin = { x: 0, y: 0, km: 0, places: [cable, show].map((b) => ({ id: b.id, name: b.title, kind: 'booking' as const, coord })) };
    expect(pinText(pin, [], [cable, show], '2027-04-04').line).toBe('Tue 6 · 07:30\nYungu cableway pending');
    expect(pinText(pin, [], [cable, show], '2027-04-07').line).toBe('Wed 7 · 19:30\nSample Orchestra booked');
    /* one ticket alone still goes by its kind, as the board writes it */
    const one = { ...pin, places: pin.places.slice(0, 1) };
    expect(pinText(one, [], [cable], '2027-04-04').line).toBe('Tue 6 · 07:30\nticket pending');
  });

  /* Run 3c: the test used to re-implement the screen's keep-out rectangles;
     both now read citymap.ts cityKeepOut */
  it('keeps the labels clear of the note, the scale bar and the way on — the screen’s own rectangles', () => {
    const k = cityKeepOut({ width: 384, height: 390 }, 60, { x: 380, y: 300 }, 'Sichuan Airlines · 3U 9001');
    expect(k.rects.slice(0, 2)).toEqual([
      { l: 40, t: 4, r: 250, b: 24 },
      { l: 14, t: 352, r: 128, b: 390 },
    ]);
    /* the way on leaves by the right edge, low down: its note sits inward and above it */
    expect(k.note).toMatchObject({ right: true, top: 242 });
    expect(k.note!.rect.r).toBe(372);
    expect(k.rects[2]).toBe(k.note!.rect);
    expect(cityKeepOut({ width: 384, height: 390 }, null, null, '').note).toBeNull();
  });

  it('lays the labels out beside their pins, never on top of each other or outside the box', () => {
    for (const s of demo.stops.filter((x) => x.kind === 'stop')) {
      const m = buildCityMap(s, cityPlaces(s, all), demo.stops, box);
      if (!m) continue;
      const sizes = m.pins.map(() => ({ w: 120, h: 34 }));
      const labels = layoutCity(m.pins, sizes, box);
      for (const a of labels) {
        expect(a.x).toBeGreaterThanOrEqual(4);
        expect(a.y).toBeGreaterThanOrEqual(4);
        expect(a.x + a.w).toBeLessThanOrEqual(box.width - 4);
        expect(a.y + a.h).toBeLessThanOrEqual(box.height - 4);
        for (const b of labels) {
          if (a === b) continue;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
        for (const p of m.pins) {
          const onPin = p.x + 7 > a.x && p.x - 7 < a.x + a.w && p.y + 7 > a.y && p.y - 7 < a.y + a.h;
          expect(onPin).toBe(false);
        }
      }
    }
  });

  it('calls an airport by its code, as the boards do — the Chinese under it is still its whole name', () => {
    const txn = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-place-08'))!;
    const t = pinText(txn, demo.showCards, demo.bookings, '2027-04-04');
    expect(t.title).toBe('TXN airport');
    expect(t.native).toBe('黄山屯溪国际机场');
    /* a place that is not an airport keeps its own words */
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'dm27-ticket-park-pass'))!;
    expect(pinText(gate, demo.showCards, demo.bookings, '2027-04-04').title).toBe('Tangkou');
  });

  /* at the boards' 412 px and at the S23's 384 px: the city is laid out in
     its own pixels, so the same words have less room on the phone. Hong Kong:
     the Cultural Centre and the Harbour Hotel are ~half a km from the centre
     and from each other, the airport 26 km out. */
  const hk = demo.stops.find((s) => s.id === 'dm27-stop-hongkong')!;
  for (const W of [412, 384]) {
    it(`finds a place for two close pins, so Hong Kong names all three places (${W} px)`, () => {
      const H = 390;
      const m = buildCityMap(hk, cityPlaces(hk, all), demo.stops, { width: W, height: H, pad: 40 })!;
      const texts = m.pins.map((p) => pinText(p, demo.showCards, demo.bookings, '2027-04-13'));
      const sizes = m.pins.map((p, i) => (p.places.every((x) => x.kind === 'stop') ? null : labelSize(texts[i]!)));
      /* the screen's own keep-outs (citymap.ts cityKeepOut, which the screen
         reads too): the note up top, the scale bar, and the way on's note in
         its own words (the two flights home); the guide sheet laps the last 20 px */
      const out = buildConnectors(demo.stops, demo.bookings, demo.trip).find((c) => c.fromStopId === hk.id)!;
      const line = wayOnLine(out, demo.stops);
      expect(line).toBe('Finnair · AY 9070 then Finnair · AY 1506');
      const exit = m.exits.find((e) => e.role === 'out') ?? null;
      const keep = cityKeepOut({ width: W, height: H }, scaleBar(m.kmPx)!.px, exit, line).rects;
      const labels = layoutCity(m.pins, sizes, { width: W, height: H - 20 }, keep);
      const named = labels.map((l) => texts[l.pin]!.native).sort();
      expect(named).toEqual(['香港國際機場', '香港文化中心', '樣本海港酒店'].sort());
      for (const a of labels) expect(a.y + a.h).toBeLessThanOrEqual(H - 20 - 4);
    });
  }

  it('draws a scale bar of a round distance', () => {
    expect(scaleBar(map.kmPx)).toMatchObject({ km: 10 });
    expect(scaleBar(0)).toBeNull();
    const s = scaleBar(12.38)!;
    expect(s.px).toBeGreaterThanOrEqual(40);
    expect(s.px).toBeLessThanOrEqual(100);
  });
});

describe('city map · drawn by the trip’s own map', () => {
  const map = buildCityMap(hs, cityPlaces(hs, all), demo.stops, box)!;
  const placesOn = (d: string) => demo.dayPlans.find((p) => p.date === d)?.placeIds;

  it('hands the pins over as stars and the hops as legs, the way on with its arrow', () => {
    const hops = stayRoute(hs, map, placesOn, '2027-04-06');
    const c = cityConstellation(map, hops, box, false);
    expect(c.stars.length).toBe(map.pins.length);
    expect(c.legs.length).toBe(hops.length);
    const way = c.legs[c.legs.length - 1]!;
    expect(way.arrow).toBe(true);
    expect(way.notBooked).toBe(true);
    expect(c.legs.findIndex((l) => l.live)).toBe(1);
    /* Apr 5's hop is behind you on the 6th: the airport is a place you have been */
    const txn = map.pins.findIndex((p) => p.places.some((x) => x.id === 'dm27-place-08'));
    expect(c.stars[txn]!.state).toBe('done');
    expect(c.labels).toEqual([]);
  });

  it('marks today’s pins, and nothing is you — a city map does not guess where you are', () => {
    const c = cityConstellation(map, stayRoute(hs, map, placesOn, '2027-04-05'), box);
    expect(c.stars.some((s) => s.tonight)).toBe(true);
    expect(c.stars.some((s) => s.you)).toBe(false);
    expect(c.legs[c.legs.length - 1]!.notBooked).toBe(false);
  });
});

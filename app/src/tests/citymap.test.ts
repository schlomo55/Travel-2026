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

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const zjj = china.stops.find((s) => s.id === 'cn26-stop-zhangjiajie')!;
const all = {
  stops: china.stops,
  showCards: china.showCards,
  bookings: china.bookings,
  dayPlans: china.dayPlans,
  dayDefaults: china.dayDefaults,
};
const box = { width: 412, height: 420, pad: 40 };

describe('city map · Zhangjiajie, the real trip', () => {
  const places = cityPlaces(zjj, all);
  const map = buildCityMap(zjj, places, china.stops, box)!;

  it('pins the three verified places: the park gate, the airport and Tianmen', () => {
    const names = map.pins.flatMap((p) => p.places.map((x) => x.name));
    expect(names).toContain('武陵源');
    expect(names).toContain('张家界荷花国际机场');
    expect(names).toContain('天门山');
  });

  it('merges a card and a ticket that share one coordinate into one pin', () => {
    const tianmen = map.pins.find((p) => p.places.some((x) => x.name === '天门山'))!;
    expect(tianmen.places.map((x) => x.id).sort()).toEqual(['cn26-place-11', 'cn26-ticket-tianmen']);
  });

  it('lists every park spot and both beds as "No pin yet" — never a guessed pin', () => {
    const noPin = map.noPin.map((p) => p.id);
    for (const s of zjj.spots ?? []) if (!s.coord) expect(noPin).toContain(s.id);
    expect(noPin).toContain('cn26-stay-03'); // Pullman
    expect(noPin).toContain('cn26-stay-04'); // Huatian
    expect(map.pins.every((p) => p.places.every((x) => x.coord))).toBe(true);
  });

  it('keeps Beijing’s airports off a Zhangjiajie map', () => {
    const ids = map.pins.flatMap((p) => p.places.map((x) => x.id));
    expect(ids).not.toContain('cn26-place-01'); // Daxing
    expect(ids).not.toContain('cn26-flight-ca1953'); // boards at Daxing
  });

  it('measures straight lines from the centre, and says how big a kilometre is', () => {
    const dyg = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-09'))!;
    expect(dyg.km).toBeGreaterThan(25);
    expect(dyg.km).toBeLessThan(35);
    expect(map.kmPx).toBeGreaterThan(0);
  });

  /* The way IN pointed north at Chongli until 2026-10-17. The stop before
     Zhangjiajie is Shanghai now, which has no verified coordinate — so there
     is no bearing to draw, and the map draws no way in rather than a guessed
     one. The way out is unchanged. */
  it('points the ways out at the real stops before and after — and not at one with no coordinate', () => {
    expect(map.exits.find((e) => e.role === 'in')).toBeUndefined();
    const out = map.exits.find((e) => e.role === 'out')!;
    expect(out.name).toBe('Chongqing');
    /* Chongqing is west (a little south) of Zhangjiajie */
    expect(out.bearing).toBeGreaterThan(240);
    expect(out.bearing).toBeLessThan(280);
    /* on the edge of the padded box */
    expect(Math.min(out.x - box.pad, box.width - box.pad - out.x, out.y - box.pad, box.height - box.pad - out.y)).toBeCloseTo(0, 0);
  });
});

describe('city map · the rules', () => {
  it('belongs a coordinate to the nearest stop within reach, or to none', () => {
    expect(nearestStop({ lat: 29.1031, lng: 110.4433 }, china.stops)?.id).toBe('cn26-stop-zhangjiajie');
    /* Qiaotou is the gorge, not Lijiang, though they are 40 km apart */
    expect(nearestStop({ lat: 27.1892, lng: 100.0488 }, china.stops)?.id).toBe('cn26-stop-gorge');
    /* Abu Dhabi is nowhere on this trip */
    expect(nearestStop({ lat: 24.4328, lng: 54.6511 }, china.stops)).toBeNull();
  });

  it('computes a bearing clockwise from north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 0);
    expect(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 0);
  });

  it('draws nothing where nothing is located', () => {
    const bare = { ...zjj, coord: undefined, spots: [] };
    expect(buildCityMap(bare, [], china.stops, box)).toBeNull();
  });
});

describe('city map · the stay, walked in order', () => {
  const places = cityPlaces(zjj, all);
  const map = buildCityMap(zjj, places, china.stops, box)!;
  const placesOn = (d: string) => china.dayPlans.find((p) => p.date === d)?.placeIds;
  const pinAt = (id: string) => map.pins.find((p) => p.places.some((x) => x.id === id))!;

  it('joins the pins the days themselves name, and leaves by the bearing to the next stop', () => {
    const hops = stayRoute(zjj, map, placesOn, '2026-10-01');
    /* Dec 11: the airport, then the park gate · Dec 14: Tianmen, then out west */
    expect(hops.map((h) => h.date)).toEqual(['2026-12-11', '2026-12-14', '2026-12-14']);
    const dyg = pinAt('cn26-place-09');
    const gate = pinAt('cn26-place-10');
    expect(hops[0]!.from).toEqual({ x: dyg.x, y: dyg.y });
    expect(hops[0]!.to).toEqual({ x: gate.x, y: gate.y });
    expect(hops[2]!.exit).toBe(true);
    const out = map.exits.find((e) => e.role === 'out')!;
    expect(hops[2]!.to).toEqual({ x: out.x, y: out.y });
    /* the park days name places with no coordinate: no hop is invented */
    expect(hops.some((h) => h.date === '2026-12-12' || h.date === '2026-12-13')).toBe(false);
  });

  it('says which hops are done, today and ahead, and flows only while you are here', () => {
    expect(stayRoute(zjj, map, placesOn, '2026-10-01').some((h) => h.live)).toBe(false);
    const on12 = stayRoute(zjj, map, placesOn, '2026-12-12');
    expect(on12.map((h) => h.state)).toEqual(['done', 'ahead', 'ahead']);
    expect(on12.findIndex((h) => h.live)).toBe(1);
    const on11 = stayRoute(zjj, map, placesOn, '2026-12-11');
    expect(on11[0]!.state).toBe('today');
    expect(on11[0]!.live).toBe(true);
  });

  it('with no day naming a located place, leaves from the stop itself', () => {
    const kunyu = china.stops.find((s) => s.id === 'cn26-stop-kunyu')!;
    const km = buildCityMap(kunyu, cityPlaces(kunyu, all), china.stops, box)!;
    const hops = stayRoute(kunyu, km, placesOn, '2026-10-01');
    expect(hops.length).toBe(1);
    expect(hops[0]!.exit).toBe(true);
    expect(hops[0]!.date).toBe(kunyu.end);
  });
});

describe('city map · the words on the pins', () => {
  const places = cityPlaces(zjj, all);
  const map = buildCityMap(zjj, places, china.stops, box)!;

  it('names a pin by its driver card — the Chinese, and the first clause of its meaning', () => {
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-10'))!;
    const t = pinText(gate, china.showCards, china.bookings, '2026-12-11');
    expect(t.native).toBe('武陵源');
    expect(t.title).toBe('Wulingyuan');
    expect(t.booking?.id).toBe('cn26-ticket-forest-park');
    const tianmen = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-11'))!;
    expect(pinText(tianmen, china.showCards, china.bookings, '2026-12-11').title).toBe('Tianmen Mountain cableway');
  });

  /* Run 3b: the gate read "Sat 12 · Pending" under WULINGYUAN on the night
     the booked, paid Pullman is the bed — the pending park pass's status,
     with nothing saying it was the pass's. */
  it('says which booking a pin’s line is about, with that booking’s own status', () => {
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-10'))!;
    for (const now of ['2026-12-11', '2026-12-12', '2026-12-15']) {
      const t = pinText(gate, china.showCards, china.bookings, now);
      expect(t.booking?.id).toBe('cn26-ticket-forest-park');
      expect(t.line).toBe('Sat 12\nticket pending');
    }
    /* the Pullman has no coordinate: it is no pin's line, and it is listed */
    expect(map.pins.some((p) => p.places.some((x) => x.id === 'cn26-stay-03'))).toBe(false);
    expect(map.noPin.map((p) => p.id)).toContain('cn26-stay-03');
    const tianmen = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-11'))!;
    expect(pinText(tianmen, china.showCards, china.bookings, '2026-12-11').line).toBe('Mon 14 · 08:00\nticket pending');
  });

  it('speaks for a stay held at the pin before anything else there, and else for the next booking', () => {
    const pullman = china.bookings.find((b) => b.id === 'cn26-stay-03')!;
    const pass = china.bookings.find((b) => b.id === 'cn26-ticket-forest-park')!;
    const coord = { lat: 29.3488, lng: 110.5457 };
    const pin = { x: 0, y: 0, km: 0, places: [{ id: pass.id, name: 'pass', kind: 'booking' as const, coord }, { id: pullman.id, name: 'Pullman', kind: 'booking' as const, coord }] };
    const t = pinText(pin, [], [pass, pullman], '2026-12-12');
    expect(t.booking?.id).toBe('cn26-stay-03');
    /* two bookings at one pin: the line names the one it speaks for (Run 3c) */
    expect(t.line).toBe('Fri 11 → Sun 13\nPullman Zhangjiajie booked');
    /* Beijing's PKX pin held two flights until 2026-10-17, and the one ahead
       of you spoke. CA8609 is still booked but is the `alternative` now (to
       refund once MU394 is held), so the pin no longer speaks for it — it
       speaks for CA8641 on every date, and never sends you to Daxing for Dec 11. */
    const bj = china.stops.find((s) => s.id === 'cn26-stop-beijing')!;
    const bm = buildCityMap(bj, cityPlaces(bj, all), china.stops, box)!;
    const pkx = bm.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-01'))!;
    expect(pinText(pkx, china.showCards, china.bookings, '2026-11-22').line).toBe('Sun 22 · 15:00\nCA 8641 booked'); // CA8683 retimed onto CA8641 on 29 Sep
    expect(pinText(pkx, china.showCards, china.bookings, '2026-12-06').line).toBe('Sun 22 · 15:00\nCA 8641 booked');
    expect(pinText(pkx, china.showCards, china.bookings, '2026-12-20').line).toBe('Sun 22 · 15:00\nCA 8641 booked');
  });

  /* Run 3c: two tickets of different status at one pin both read "ticket
     pending" / "ticket booked" — nothing said which ticket */
  it('names each ticket by its own title where a pin holds more than one', () => {
    const tianmen = china.bookings.find((b) => b.id === 'cn26-ticket-tianmen')!;
    const show = { ...china.bookings.find((b) => b.id === 'cn26-ticket-hkphil')!, id: 'show', date: '2026-12-15' };
    const coord = { lat: 29.05, lng: 110.48 };
    const pin = { x: 0, y: 0, km: 0, places: [tianmen, show].map((b) => ({ id: b.id, name: b.title, kind: 'booking' as const, coord })) };
    expect(pinText(pin, [], [tianmen, show], '2026-12-11').line).toBe('Mon 14 · 08:00\nTianmen Mountain pending');
    expect(pinText(pin, [], [tianmen, show], '2026-12-15').line).toBe('Tue 15 · 19:30\nHK Phil booked');
    /* one ticket alone still goes by its kind, as the board writes it */
    const one = { ...pin, places: pin.places.slice(0, 1) };
    expect(pinText(one, [], [tianmen], '2026-12-11').line).toBe('Mon 14 · 08:00\nticket pending');
  });

  /* Run 3c: the test used to re-implement the screen's keep-out rectangles;
     both now read citymap.ts cityKeepOut */
  it('keeps the labels clear of the note, the scale bar and the way on — the screen’s own rectangles', () => {
    const k = cityKeepOut({ width: 384, height: 390 }, 60, { x: 380, y: 300 }, 'HSR · Zhangjiajie West → Chongqing');
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
    for (const s of china.stops.filter((x) => x.kind === 'stop')) {
      const m = buildCityMap(s, cityPlaces(s, all), china.stops, box);
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
    const dyg = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-place-09'))!;
    const t = pinText(dyg, china.showCards, china.bookings, '2026-12-11');
    expect(t.title).toBe('DYG airport');
    expect(t.native).toBe('张家界荷花国际机场');
    /* a place that is not an airport keeps its own words */
    const gate = map.pins.find((p) => p.places.some((x) => x.id === 'cn26-ticket-forest-park'))!;
    expect(pinText(gate, china.showCards, china.bookings, '2026-12-11').title).toBe('Wulingyuan');
  });

  /* at the boards' 412 px and at the S23's 384 px: the city is laid out in
     its own pixels, so the same words have less room on the phone */
  for (const W of [412, 384]) {
    it(`finds a corner for two close pins at the foot of the map, so Zhangjiajie names all three places (${W} px)`, () => {
      const H = 390;
      const m = buildCityMap(zjj, cityPlaces(zjj, all), china.stops, { width: W, height: H, pad: 40 })!;
      const texts = m.pins.map((p) => pinText(p, china.showCards, china.bookings, '2026-12-11'));
      const sizes = m.pins.map((p, i) => (p.places.every((x) => x.kind === 'stop') ? null : labelSize(texts[i]!)));
      /* the screen's own keep-outs (citymap.ts cityKeepOut, which the screen
         reads too): the note up top, the scale bar, and the way on's note in
         its own words ("HSR · Zhangjiajie West → Chongqing"); the guide sheet
         laps the last 20 px */
      const out = buildConnectors(china.stops, china.bookings, china.trip).find((c) => c.fromStopId === zjj.id)!;
      const line = wayOnLine(out, china.stops);
      expect(line).toBe('HSR · Zhangjiajie West → Chongqing');
      const keep = cityKeepOut({ width: W, height: H }, scaleBar(m.kmPx)!.px, m.exits.find((e) => e.role === 'out')!, line).rects;
      const labels = layoutCity(m.pins, sizes, { width: W, height: H - 20 }, keep);
      const named = labels.map((l) => texts[l.pin]!.native).sort();
      expect(named).toEqual(['天门山', '张家界荷花国际机场', '武陵源'].sort());
      for (const a of labels) expect(a.y + a.h).toBeLessThanOrEqual(H - 20 - 4);
      /* the park gate's words sit beside it, clear of the two routes that
         leave it downwards */
      const gate = labels.find((l) => texts[l.pin]!.native === '武陵源')!;
      expect(gate.side).toBe('right');
    });
  }

  it('draws a scale bar of a round distance', () => {
    expect(scaleBar(map.kmPx)).toMatchObject({ km: 5 });
    expect(scaleBar(0)).toBeNull();
    const s = scaleBar(12.38)!;
    expect(s.px).toBeGreaterThanOrEqual(40);
    expect(s.px).toBeLessThanOrEqual(100);
  });
});

describe('city map · drawn by the trip’s own map', () => {
  const map = buildCityMap(zjj, cityPlaces(zjj, all), china.stops, box)!;
  const placesOn = (d: string) => china.dayPlans.find((p) => p.date === d)?.placeIds;

  it('hands the pins over as stars and the hops as legs, the way on with its arrow', () => {
    const hops = stayRoute(zjj, map, placesOn, '2026-12-12');
    const c = cityConstellation(map, hops, box, false);
    expect(c.stars.length).toBe(map.pins.length);
    expect(c.legs.length).toBe(hops.length);
    const way = c.legs[c.legs.length - 1]!;
    expect(way.arrow).toBe(true);
    expect(way.notBooked).toBe(true);
    expect(c.legs.findIndex((l) => l.live)).toBe(1);
    /* Dec 11's hop is behind you on the 12th: the airport and the park gate are places you have been */
    const dyg = map.pins.findIndex((p) => p.places.some((x) => x.id === 'cn26-place-09'));
    expect(c.stars[dyg]!.state).toBe('done');
    expect(c.labels).toEqual([]);
  });

  it('marks today’s pins, and nothing is you — a city map does not guess where you are', () => {
    const c = cityConstellation(map, stayRoute(zjj, map, placesOn, '2026-12-11'), box);
    expect(c.stars.some((s) => s.tonight)).toBe(true);
    expect(c.stars.some((s) => s.you)).toBe(false);
    expect(c.legs[c.legs.length - 1]!.notBooked).toBe(false);
  });
});

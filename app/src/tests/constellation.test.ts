/* THE CONSTELLATION — real coordinates, north up, fitted to a box; nothing
   placed that the trip file does not locate; the day decides which leg is
   done, which is today's, which one Flows and where YOU are; and the labels
   never sit on top of each other (the cluster rule). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Stop } from '../lib/model/types';
import { buildConstellation, chipSpot, legPath, placeLabels, shortName, CHAR_PX, type MapLabel } from '../lib/logic/constellation';

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

describe('constellation · placing', () => {
  it('places every stop that has a coordinate, north up, inside the box', () => {
    const c = buildConstellation(stops, '2027-03-01', box);
    expect(c).not.toBeNull();
    const [a, b, s] = c?.stars ?? [];
    expect(a && b && s).toBeTruthy();
    expect(s!.y).toBeGreaterThan(a!.y);
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
    const dx = Math.abs(b!.x - a!.x);
    const dy = Math.abs(c.stars[2]!.y - a!.y);
    expect(dx / dy).toBeCloseTo((10 * Math.cos((110 / 3) * (Math.PI / 180))) / 10, 1);
  });

  it('draws nothing from fewer than two placed stops', () => {
    expect(buildConstellation([stops[0]!, stops[3]!], '2027-03-01', box)).toBeNull();
    expect(buildConstellation([], '2027-03-01', box)).toBeNull();
  });

  it('bends a leg gently between its stars', () => {
    expect(legPath({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe('M0 0 Q 50 18 100 0');
  });

  it('names a stop by the part before its dash', () => {
    expect(shortName('Tai-chi school — Hangzhou')).toBe('Tai-chi school');
    expect(shortName('**Hong Kong** — the harbour finale')).toBe('Hong Kong');
    expect(shortName('Guilin')).toBe('Guilin');
  });
});

describe('constellation · the day', () => {
  it('knows the road so far, today’s leg and the stops ahead', () => {
    const c = buildConstellation(stops, '2027-03-08', box)!;
    expect(c.stars.map((s) => s.state)).toEqual(['done', 'done', 'here']);
    expect(c.legs.map((l) => l.state)).toEqual(['done', 'today']);
    expect(c.here?.id).toBe('c');
    const before = buildConstellation(stops, '2027-02-01', box)!;
    expect(before.legs.map((l) => l.state)).toEqual(['ahead', 'ahead']);
    expect(before.here).toBeNull();
    expect(before.you).toBeNull();
    expect(before.legs.some((l) => l.live)).toBe(false);
  });

  it('on a travel day YOU are at the start of today’s leg, and that leg Flows', () => {
    const c = buildConstellation(stops, '2027-03-08', box)!;
    expect(c.you?.id).toBe('b');
    expect(c.here?.id).toBe('c');
    expect(c.here?.tonight).toBe(true);
    expect(c.legs.filter((l) => l.live).map((l) => `${l.from.id}>${l.to.id}`)).toEqual(['b>c']);
  });

  it('once the day’s line says you have arrived, the leg is done and you are tonight’s', () => {
    const c = buildConstellation(stops, '2027-03-08', box, { arrived: true })!;
    expect(c.legs.map((l) => l.state)).toEqual(['done', 'done']);
    expect(c.you?.id).toBe('c');
    /* nothing ahead of the last stop, so nothing Flows */
    expect(c.legs.some((l) => l.live)).toBe(false);
  });

  it('on an ordinary day the NEXT move Flows, from where you are', () => {
    const c = buildConstellation(stops, '2027-03-05', box)!;
    expect(c.you?.id).toBe('b');
    expect(c.legs.map((l) => l.state)).toEqual(['done', 'ahead']);
    expect(c.legs.find((l) => l.live)?.to.id).toBe('c');
  });

  it('a leg that skips a stop with no coordinate is never where YOU stand (2026-10-17)', () => {
    /* a → x (no coordinate) → c: on c's first day you are at x, which has no
       star — so no YOU at a, and nothing Flows; arrived, you are at c */
    const trip = [stop('a', 0, '2027-03-01', '2027-03-04', 40, 110), stop('x', 1, '2027-03-04', '2027-03-08'), stop('c', 2, '2027-03-08', '2027-03-12', 30, 115)];
    const day = buildConstellation(trip, '2027-03-08', box)!;
    expect(day.you).toBeNull();
    expect(day.here?.id).toBe('c');
    expect(day.legs.map((l) => l.state)).toEqual(['today']);
    expect(day.legs.some((l) => l.live)).toBe(false);
    expect(buildConstellation(trip, '2027-03-08', box, { arrived: true })!.you?.id).toBe('c');
    /* while you are AT x there is no star for you at all */
    expect(buildConstellation(trip, '2027-03-05', box)!.you).toBeNull();
  });

  it('flags a leg ahead with nothing held — only when told', () => {
    const c = buildConstellation(stops, '2027-03-05', box, { unbooked: new Set(['b>c']) })!;
    expect(c.legs.map((l) => l.notBooked)).toEqual([false, true]);
    const d = buildConstellation(stops, '2027-03-09', box, { unbooked: new Set(['a>b']) })!;
    expect(d.legs.every((l) => !l.notBooked)).toBe(true); // a leg behind you is not "to book"
  });

  it('gives every leg a midpoint for its chip and an arrowhead for the calm end state', () => {
    const c = buildConstellation(stops, '2027-03-08', box)!;
    const l = c.legs[1]!;
    expect(l.tip.x).toBe(l.to.x);
    expect(l.tip.y).toBe(l.to.y);
    expect(Number.isFinite(l.tip.angle)).toBe(true);
    expect(l.mid.y).toBeGreaterThan(Math.min(l.from.y, l.to.y));
    expect(l.mid.y).toBeLessThan(Math.max(l.from.y, l.to.y));
    expect(l.len).toBeGreaterThan(0);
  });
});

/* ---------- labels ---------- */
const rect = (l: MapLabel): { l: number; r: number; t: number; b: number } => {
  const w = Math.max(...l.lines.map((s) => s.length * CHAR_PX));
  const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
  return { l: left, r: left + w, t: l.y - 11, b: l.y - 11 + l.lines.length * 15 };
};
const overlap = (a: MapLabel, b: MapLabel): boolean => {
  const p = rect(a);
  const q = rect(b);
  return p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
};

const seed = (file: string) =>
  (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', file), 'utf8')) as AppBackup).trips[0]!;

describe('constellation · the demo trip, Sun 4 Apr', () => {
  const demo = seed('demo-2027.trip.json');
  const nowBox = { width: 412, height: 440, pad: 34 };
  const c = buildConstellation(demo.stops, '2027-04-04', nowBox)!;

  /* Suzhou is a stop with NO coordinate — listed, never placed. */
  it('places the eight stops that carry a coordinate, lists Suzhou, and none of the flights', () => {
    expect(c.stars).toHaveLength(8);
    expect(c.unplaced).toEqual(['Suzhou + the gardens']);
  });

  /* Apr 4 you wake in Suzhou, which is not on the board — so there is NO YOU
     star rather than a wrong one: today's leg runs Shanghai → Huangshan on
     the board, skipping the unplaced stop, and SHANGHAI · YOU on Apr 4 would
     be a lie. */
  it('you are in Suzhou, which has no star: no YOU, tonight is Huangshan, and no leg Flows', () => {
    expect(c.you).toBeNull();
    expect(c.here?.id).toBe('dm27-stop-huangshan');
    expect(c.legs.filter((l) => l.live)).toEqual([]);
    expect(c.legs.filter((l) => l.state === 'today').map((l) => `${l.from.id}>${l.to.id}`)).toEqual([
      'dm27-stop-shanghai>dm27-stop-huangshan',
    ]);
    expect(c.legs.filter((l) => l.state === 'done').map((l) => l.to.id)).toEqual(['dm27-stop-shanghai']);
    /* once the day's line says you have arrived, you are tonight's */
    const there = buildConstellation(demo.stops, '2027-04-04', nowBox, { arrived: true })!;
    expect(there.you?.id).toBe('dm27-stop-huangshan');
  });

  it('labels the board’s way: no YOU, HUANGSHAN / TONIGHT', () => {
    expect(c.labels.find((l) => l.tone === 'you')).toBeUndefined();
    expect(c.labels.find((l) => l.tone === 'tonight')?.lines).toEqual(['HUANGSHAN', 'TONIGHT']);
  });

  it('folds Yangshuo, the terraces and Guilin into one label, in trip order', () => {
    const cluster = c.labels.find((l) => /GUILIN/.test(l.lines[0] ?? ''));
    /* in a group a long name keeps its last word: "Yangshuo & the Li River"
       reads RIVER, "Longji rice terraces" reads TERRACES */
    expect(cluster?.lines[0]).toBe('RIVER · TERRACES · GUILIN');
    /* and names the stops that stand apart on their own */
    const all = c.labels.flatMap((l) => l.lines).join(' | ');
    for (const n of ['SHANGHAI', 'CHENGDU', 'HONG KONG & MACAU']) expect(all).toContain(n);
  });

  it('never lets two labels overlap, and keeps them inside the box', () => {
    for (let i = 0; i < c.labels.length; i++) {
      const r = rect(c.labels[i]!);
      expect(r.l).toBeGreaterThanOrEqual(5);
      expect(r.r).toBeLessThanOrEqual(nowBox.width - 5);
      for (let j = i + 1; j < c.labels.length; j++) expect(overlap(c.labels[i]!, c.labels[j]!)).toBe(false);
    }
  });

  it('the shelf names only the first stop, you, tonight and the last', () => {
    const shelf = buildConstellation(demo.stops, '2027-04-04', { width: 380, height: 240, pad: 34 }, { labels: 'key' })!;
    const words = shelf.labels.flatMap((l) => l.lines).join(' | ');
    expect(words).toContain('TONIGHT');
    expect(words).toContain('HUANGSHAN');
    expect(words).toContain('HONG KONG');
    expect(words).not.toContain('CHENGDU');
  });
});

describe('constellation · every day of the demo trip, on every map the app draws', () => {
  const demo = seed('demo-2027.trip.json');
  const boxes = [
    { name: 'Now', box: { width: 412, height: 470, pad: 30, padTop: 96, padBottom: 62 }, key: false },
    { name: 'Journey', box: { width: 412, height: 380, pad: 30 }, key: false },
    { name: 'the shelf, lead', box: { width: 380, height: 240, pad: 34 }, key: true },
    { name: 'the shelf', box: { width: 380, height: 170, pad: 34 }, key: true },
  ];
  const days: string[] = [];
  for (let d = new Date(2027, 2, 18); d <= new Date(2027, 3, 19); d.setDate(d.getDate() + 1)) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  it('no two labels ever overlap, and none leaves the box', () => {
    const bad: string[] = [];
    for (const { name, box: b, key } of boxes) {
      for (const day of days) {
        const c = buildConstellation(demo.stops, day, b, key ? { labels: 'key' } : {})!;
        for (let i = 0; i < c.labels.length; i++) {
          const r = rect(c.labels[i]!);
          if (r.l < 5 || r.r > b.width - 5) bad.push(`${name} ${day}: ${c.labels[i]!.lines.join('/')} leaves the box`);
          for (let j = i + 1; j < c.labels.length; j++) {
            if (overlap(c.labels[i]!, c.labels[j]!)) bad.push(`${name} ${day}: ${c.labels[i]!.lines[0]} × ${c.labels[j]!.lines[0]}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  /* On the shelf's lead card, Hangzhou and Shanghai are a few px apart at
     trip scale: YOU and TONIGHT share one label on Mar 29. */
  it('YOU and TONIGHT too close to name apart share one label (Hangzhou → Shanghai, Mar 29)', () => {
    const c = buildConstellation(demo.stops, '2027-03-29', boxes[2]!.box)!;
    expect(c.labels.find((l) => l.tone === 'you')?.lines).toEqual(['TAI-CHI SCHOOL · YOU', 'SHANGHAI · TONIGHT']);
    expect(c.labels.some((l) => l.tone === 'tonight')).toBe(false);
    /* a move between stars far apart names them apart: Huangshan is YOU, Chengdu is TONIGHT */
    const d = buildConstellation(demo.stops, '2027-04-07', boxes[2]!.box)!;
    expect(d.labels.find((l) => l.tone === 'you')?.lines).toEqual(['HUANGSHAN · YOU']);
    expect(d.labels.find((l) => l.tone === 'tonight')?.lines).toEqual(['CHENGDU', 'TONIGHT']);
  });
});

describe('constellation · today’s leg chip (Now)', () => {
  const demo = seed('demo-2027.trip.json');
  /* Now's own box: a header over the top, the legend and the sheet's lip at the foot */
  const home = { width: 412, height: 470, pad: 30, padTop: 96, padBottom: 62 };
  const clear = (c: NonNullable<ReturnType<typeof buildConstellation>>, p: { x: number; y: number }, w: number, h: number): boolean => {
    const chip = { l: p.x, r: p.x + w, t: p.y, b: p.y + h };
    const hit = (q: { l: number; r: number; t: number; b: number }): boolean => chip.l < q.r && q.l < chip.r && chip.t < q.b && q.t < chip.b;
    return !c.labels.some((l) => hit(rect(l))) && !c.stars.some((s) => hit({ l: s.x - 8, r: s.x + 8, t: s.y - 8, b: s.y + 8 }));
  };

  /* The rule itself, on a plain leg with room on its right: the chip sits
     right of the midpoint. */
  it('sits right of today’s leg, as the board draws it, over no name', () => {
    const two = [stop('p', 0, '2027-03-01', '2027-03-04', 40, 110), stop('q', 1, '2027-03-04', '2027-03-08', 30, 110)];
    const c = buildConstellation(two, '2027-03-04', home)!;
    const leg = c.legs.find((l) => l.live)!;
    const p = chipSpot(c, leg, 120, 32, 70, 50)!;
    expect(p).not.toBeNull();
    expect(p.x).toBe(Math.round((leg.mid.x + 10) * 10) / 10);
    expect(clear(c, p, 120, 32)).toBe(true);
  });

  /* On Now's 412 px box the demo trip leaves room beside every leg, so the
     crowded case is proved on the shelf-sized map, where Hangzhou → Shanghai
     is a few px long under the shared TAI-CHI SCHOOL · YOU label. */
  it('gives way where the names crowd (Hangzhou → Shanghai, Mar 29, on the shelf-sized map)', () => {
    const c = buildConstellation(demo.stops, '2027-03-29', { width: 380, height: 240, pad: 34 })!;
    const leg = c.legs.find((l) => l.live)!;
    expect(leg.to.id).toBe('dm27-stop-shanghai');
    /* no free side within reach: no chip, rather than a chip over
       TAI-CHI SCHOOL · YOU (the sentence and the NEXT tile say it) */
    expect(chipSpot(c, leg, 120, 32, 70, 50)).toBeNull();
  });

  it('wherever it goes on the trip’s travel days, it covers no name and no star', () => {
    for (const day of ['2027-03-29', '2027-04-07', '2027-04-09', '2027-04-11', '2027-04-12', '2027-04-13']) {
      const c = buildConstellation(demo.stops, day, home)!;
      const leg = c.legs.find((l) => l.live && l.state === 'today')!;
      const p = chipSpot(c, leg, 140, 32, 70, 50);
      expect(p, day).not.toBeNull();
      expect(clear(c, p!, 140, 32), day).toBe(true);
      expect(Math.hypot(Math.max(p!.x - leg.mid.x, 0, leg.mid.x - p!.x - 140), Math.max(p!.y - leg.mid.y, 0, leg.mid.y - p!.y - 32))).toBeLessThanOrEqual(60);
    }
  });

  it('is not drawn at all when no side is free', () => {
    const c = buildConstellation(demo.stops, '2027-04-07', home)!;
    expect(chipSpot(c, c.legs.find((l) => l.live)!, 159, 32, 0, home.height)).toBeNull();
  });
});

describe('constellation · labels, the hard cases', () => {
  it('names two stops at one coordinate once (Tel Aviv at both ends of a trip)', () => {
    const israel = seed('israel-test.trip.json');
    const c = buildConstellation(israel.stops, '2026-08-20', { width: 412, height: 440, pad: 34 })!;
    const words = c.labels.flatMap((l) => l.lines);
    expect(words.filter((w) => /TEL AVIV/.test(w))).toHaveLength(1);
    /* you are in the Galilee */
    expect(words).toContain('GALILEE & THE GOLAN · YOU');
  });

  it('inside a group, a long name keeps its last word', () => {
    const near = (id: string, order: number, lat: number, lng: number, name: string): Stop => ({
      ...stop(id, order, '2027-03-0' + (order + 1), '2027-03-0' + (order + 2), lat, lng),
      name,
    });
    const far = near('z', 3, 40, 130, 'Far Away');
    const trip = [
      near('p', 0, 30, 100, 'Yangshuo'),
      near('q', 1, 30.05, 100.02, 'Longji Rice Terraces Of Many Words'),
      near('r', 2, 29.97, 100.03, 'Guilin'),
      far,
    ];
    const c = buildConstellation(trip, '2027-01-01', { width: 300, height: 300, pad: 30 })!;
    const g = c.labels.find((l) => l.lines[0]?.includes('YANGSHUO'));
    expect(g?.lines[0]).toBe('YANGSHUO · WORDS · GUILIN');
  });

  it('places nothing when there are no stars', () => {
    expect(placeLabels([], box, 'all')).toEqual([]);
  });
});

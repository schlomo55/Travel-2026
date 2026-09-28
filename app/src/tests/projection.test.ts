/* THE PROJECTION — real coordinates, north up, one scale, fitted to a box;
   and a grid whose labels are real latitudes. */
import { describe, expect, it } from 'vitest';
import { fitProjection, graticule, KM_PER_DEG } from '../lib/logic/projection';

const box = { width: 412, height: 440, pad: 30 };
/* Beijing, Chongqing, Hong Kong */
const pts = [
  { lat: 39.9033, lng: 116.3917 },
  { lat: 29.5602, lng: 106.5734 },
  { lat: 22.2934, lng: 114.1751 },
];

describe('projection', () => {
  it('puts north up and east right, inside the padded box', () => {
    const p = fitProjection(pts, box)!;
    const [bj, cq, hk] = pts.map((c) => ({ x: p.x(c), y: p.y(c) }));
    expect(bj!.y).toBeLessThan(hk!.y); // Beijing is north of Hong Kong
    expect(cq!.x).toBeLessThan(bj!.x); // Chongqing is west of Beijing
    for (const q of [bj!, cq!, hk!]) {
      expect(q.x).toBeGreaterThanOrEqual(box.pad - 0.1);
      expect(q.x).toBeLessThanOrEqual(box.width - box.pad + 0.1);
      expect(q.y).toBeGreaterThanOrEqual(box.pad - 0.1);
      expect(q.y).toBeLessThanOrEqual(box.height - box.pad + 0.1);
    }
  });

  it('fills the tighter axis and centres the other', () => {
    const p = fitProjection(pts, box)!;
    const ys = pts.map((c) => p.y(c));
    /* 17.6° of latitude is the long axis here: it spans the inner height */
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(box.height - box.pad * 2, 0);
    const xs = pts.map((c) => p.x(c));
    const mid = (Math.max(...xs) + Math.min(...xs)) / 2;
    expect(mid).toBeCloseTo(box.width / 2, 0);
  });

  it('keeps one scale: a kilometre is as long east-west as north-south', () => {
    const p = fitProjection(pts, box)!;
    const north = p.y({ lat: 30, lng: 110 }) - p.y({ lat: 31, lng: 110 });
    expect(north).toBeCloseTo(p.kmPx * KM_PER_DEG, 0);
  });

  it('refuses to blow a single place up to the whole screen', () => {
    expect(fitProjection([pts[0]!], box)).toBeNull();
    const p = fitProjection([pts[0]!], box, 6)!;
    /* 6 km across the tighter inner axis (352 px wide) */
    expect(p.kmPx * 6).toBeCloseTo(box.width - box.pad * 2, 0);
    expect(p.x(pts[0]!)).toBeCloseTo(box.width / 2, 0);
    expect(p.y(pts[0]!)).toBeCloseTo(box.height / 2, 0);
  });

  it('never places what is not a coordinate', () => {
    expect(fitProjection([], box)).toBeNull();
    expect(fitProjection([{ lat: Number.NaN, lng: 3 }], box, 5)).toBeNull();
  });

  it('inverts its own mapping', () => {
    const p = fitProjection(pts, box)!;
    expect(p.latAt(p.y(pts[1]!))).toBeCloseTo(pts[1]!.lat, 1);
    expect(p.lngAt(p.x(pts[1]!))).toBeCloseTo(pts[1]!.lng, 1);
  });
});

describe('graticule', () => {
  it('draws real latitudes, every 5° across a country', () => {
    const p = fitProjection(pts, box)!;
    const g = graticule(p, box);
    expect(g.lats.map((l) => l.label)).toEqual(['40°N', '35°N', '30°N', '25°N']);
    /* north on top */
    expect(g.lats[0]!.y).toBeLessThan(g.lats[1]!.y);
    for (const l of g.lats) expect(p.latAt(l.y)).toBeCloseTo(Number(l.label.replace('°N', '')), 1);
    expect(g.lngs.length).toBeGreaterThanOrEqual(2);
  });

  it('steps down for a small country, and still labels at least two lines', () => {
    const israel = [
      { lat: 32.9686, lng: 35.5425 },
      { lat: 29.5577, lng: 34.9519 },
    ];
    const p = fitProjection(israel, box)!;
    const g = graticule(p, box);
    expect(g.lats.length).toBeGreaterThanOrEqual(2);
    expect(g.lats.map((l) => l.label)).toContain('31°N');
  });

  it('names the southern hemisphere as south', () => {
    const p = fitProjection(
      [
        { lat: -33.9, lng: 18.4 },
        { lat: -26.2, lng: 28.0 },
      ],
      box,
    )!;
    expect(graticule(p, box).lats.some((l) => l.label.endsWith('°S'))).toBe(true);
  });
});

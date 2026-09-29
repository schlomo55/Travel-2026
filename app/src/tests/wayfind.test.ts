/* FINDING THE WAY (Map 5c, lib/logic/wayfind.ts) — straight-line distance and
   bearing (checked against MAPS5's own table, from Houhai), the 16-point
   compass and its words, the distance's wording, a rough position, which way
   to turn, the phone's heading, the scale bar, clusters and nearest-first. */
import { describe, expect, it } from 'vitest';
import {
  accuracyText,
  bearingDeg,
  clusterBadge,
  clusterCategory,
  clusterSpoken,
  compass16,
  compassWords,
  distanceM,
  distanceSpoken,
  distanceText,
  fitView,
  headingFromOrientation,
  meaningful,
  metresPerPx,
  nearestFirst,
  scaleBar,
  signedDelta,
  steerHeading,
  turnOf,
} from '../lib/logic/wayfind';

const houhai = { lat: 39.938, lng: 116.3871 };

describe('wayfind · distance and bearing, from Houhai (MAPS5’s table)', () => {
  const cases: [string, { lat: number; lng: number }, number, string][] = [
    ['Huguosi TCM Hospital', { lat: 39.9377, lng: 116.3683 }, 1.6, 'W'],
    ['Beijing Massage Hospital', { lat: 39.9337, lng: 116.3655 }, 1.9, 'WSW'],
  ];
  for (const [name, at, km, point] of cases) {
    it(`${name}: ≈ ${km} km ${point}`, () => {
      expect(Math.round(distanceM(houhai, at) / 100) / 10).toBe(km);
      expect(compass16(bearingDeg(houhai, at))).toBe(point);
    });
  }
  it('the 16 points at MAPS5’s bearings', () => {
    expect([269, 255, 92, 188, 53, 178].map(compass16)).toEqual(['W', 'WSW', 'E', 'S', 'NE', 'S']);
    expect(compass16(359)).toBe('N');
    expect(compass16(-10)).toBe('N');
    expect(compassWords('WSW')).toBe('west-south-west');
    expect(compassWords('NE')).toBe('north-east');
  });
  it('a difference of angles, the short way', () => {
    expect(signedDelta(10, 350)).toBe(20);
    expect(signedDelta(350, 10)).toBe(-20);
    expect(signedDelta(180, 0)).toBe(180);
  });
});

describe('wayfind · the words a distance wears', () => {
  it('never more digits than a straight line has earned', () => {
    expect(distanceText(3)).toBe('≈ 10 m');
    expect(distanceText(447)).toBe('≈ 450 m');
    expect(distanceText(1903)).toBe('≈ 1.9 km');
    expect(distanceText(47_690)).toBe('≈ 47.7 km');
    expect(distanceText(310_400)).toBe('≈ 310 km');
    expect(distanceSpoken(1903)).toBe('1.9 kilometres');
    expect(distanceSpoken(447)).toBe('450 metres');
  });
  it('a rough position says how rough, and hides what it cannot stand behind', () => {
    expect(accuracyText(25)).toBeNull();
    expect(accuracyText(100)).toBeNull();
    expect(accuracyText(880)).toBe('≈ 900 m');
    expect(accuracyText(2100)).toBe('≈ 2 km');
    expect(accuracyText(3300)).toBe('≈ 3.5 km');
    expect(meaningful(1900, 25)).toBe(true);
    expect(meaningful(1900, 900)).toBe(false);
    expect(meaningful(5000, 900)).toBe(true);
    expect(meaningful(10, null)).toBe(true);
  });
});

describe('wayfind · which way, and the phone’s heading', () => {
  it('ahead, slightly, to the side, behind', () => {
    expect(turnOf(255, 262)).toBe('ahead');
    expect(turnOf(255, 270)).toBe('slightLeft');
    expect(turnOf(285, 270)).toBe('slightRight');
    expect(turnOf(180, 270)).toBe('left');
    expect(turnOf(0, 270)).toBe('right');
    expect(turnOf(90, 270)).toBe('behind');
  });
  it('the compass heading from the orientation: flat, upright, and none', () => {
    expect(headingFromOrientation(0, 0, 0)).toBe(0);
    expect(headingFromOrientation(90, 0, 0)).toBe(270);
    expect(headingFromOrientation(90, 90, 0)).toBeCloseTo(270, 6);
    expect(headingFromOrientation(270, 60, 0)).toBeCloseTo(90, 6);
    expect(headingFromOrientation(null, 0, 0)).toBeNull();
  });
  it('steer by the GPS course while walking, else the compass made true, else nothing', () => {
    expect(steerHeading({ compassMagnetic: 270, declination: -7.6, course: 250, speed: 1.2 })).toEqual({ deg: 250, from: 'course' });
    expect(steerHeading({ compassMagnetic: 270, declination: -7.6, course: 250, speed: 0.3 })).toEqual({ deg: 262.4, from: 'compass' });
    expect(steerHeading({ compassMagnetic: null, declination: -7.6, course: null, speed: null })).toBeNull();
  });
});

describe('wayfind · framing you and a place', () => {
  const HOUHAI: [number, number] = [116.3871, 39.938];
  const MASSAGE: [number, number] = [116.3655, 39.9337];
  it('both in the box with the margin, the middle between them', () => {
    const v = fitView([HOUHAI, MASSAGE], 324, 480, 16);
    expect(v).not.toBeNull();
    expect(v!.center[0]).toBeCloseTo((HOUHAI[0] + MASSAGE[0]) / 2, 6);
    expect(v!.center[1]).toBeCloseTo((HOUHAI[1] + MASSAGE[1]) / 2, 3);
    /* their 1.84 km east to west fills the 324 − 2 × 56 px, and not a pixel more */
    const across = distanceM({ lat: HOUHAI[1], lng: HOUHAI[0] }, { lat: HOUHAI[1], lng: MASSAGE[0] }) / metresPerPx(v!.center[1], v!.zoom);
    expect(across).toBeGreaterThan(211);
    expect(across).toBeLessThanOrEqual(212.5);
  });
  it('no closer than the zoom asked for, a smaller margin in a small box, none without room', () => {
    expect(fitView([HOUHAI, [116.3872, 39.9381]], 324, 480, 16)!.zoom).toBe(16);
    const tight = fitView([HOUHAI, MASSAGE], 324, 90, 16)!;
    const roomy = fitView([HOUHAI, MASSAGE], 324, 480, 16)!;
    expect(tight.zoom).toBeLessThan(roomy.zoom);
    expect(fitView([HOUHAI, MASSAGE], 324, 20, 16)).toBeNull();
    expect(fitView([], 324, 480, 16)).toBeNull();
    /* wider margins at the sides frame the same two points further out */
    expect(fitView([HOUHAI, MASSAGE], 324, 480, 16, [88, 56])!.zoom).toBeLessThan(roomy.zoom);
  });
});

describe('wayfind · the scale bar, clusters, nearest first', () => {
  it('the longest round length that fits', () => {
    const mpp = metresPerPx(39.938, 13.5);
    expect(mpp).toBeCloseTo(5.18, 1);
    expect(scaleBar(mpp, 95)).toEqual({ px: 38.6, label: '200 m' });
    expect(scaleBar(10.5, 95)?.label).toBe('500 m');
    expect(scaleBar(11, 100)?.label).toBe('1 km');
    expect(scaleBar(0, 95)).toBeNull();
  });
  it('a cluster: its badge, its one category or none, its words', () => {
    expect(clusterBadge(4)).toBe('+4');
    expect(clusterBadge(240)).toBe('+99');
    expect(clusterCategory({ sight: 4 })).toBe('sight');
    expect(clusterCategory({ sight: 3, food: 1 })).toBeNull();
    expect(clusterSpoken({ sight: 4 })).toBe('4 sights');
    expect(clusterSpoken({ sight: 3, food: 2 })).toBe('5 places: 3 sights, 2 places to eat');
    expect(clusterSpoken({ spa: 1 })).toBe('1 spa');
  });
  it('nearest first, ties in the order given, no position no place', () => {
    const items = [
      { id: 'far', at: { lat: 39.9337, lng: 116.3655 } },
      { id: 'none', at: undefined },
      { id: 'near', at: { lat: 39.9377, lng: 116.3683 } },
      { id: 'near-too', at: { lat: 39.9377, lng: 116.3683 } },
    ];
    expect(nearestFirst(items, (x) => x.at, houhai).map((r) => r.item.id)).toEqual(['near', 'near-too', 'far']);
  });
});

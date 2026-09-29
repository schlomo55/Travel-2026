/* FINDING THE WAY (Map 5c, lib/logic/wayfind.ts) — straight-line distance and
   bearing (checked against MAPS5's own table, from Houhai), the 16-point
   compass and its words, the distance's wording, a rough position, which way
   to turn, the phone's heading, the scale bar, clusters and nearest-first. */
import { describe, expect, it } from 'vitest';
import {
  accuracyText,
  bearingDeg,
  byDistanceThenName,
  clusterBadge,
  compass16,
  compassWords,
  distanceM,
  distanceSpoken,
  distanceText,
  fitView,
  footPlace,
  headingFromOrientation,
  legText,
  meaningful,
  metresPerPx,
  nearestFirst,
  pinBox,
  pinOn,
  ringLabelBox,
  ringLabelCorner,
  type RingCorner,
  roomMiddle,
  scaleBar,
  screenAngleOf,
  signedDelta,
  steerHeading,
  tagBelow,
  turnOf,
} from '../lib/logic/wayfind';
import { PHOTO_RIM, PHOTO_TONIGHT } from '../lib/logic/placephotos';

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
  /* MAP 5D — the unit changes at the ROUNDED value (the review's numbers) */
  it('the unit changes where the number rounds, not before: ≈ 1.0 km, ≈ 1 km, ≈ 100 km', () => {
    expect(distanceText(995)).toBe('≈ 1.0 km'); // was "≈ 1000 m"
    expect(distanceText(994)).toBe('≈ 990 m');
    expect(distanceText(1000)).toBe('≈ 1.0 km');
    expect(accuracyText(990)).toBe('≈ 1 km'); // was "≈ 1000 m"
    expect(accuracyText(970)).toBe('≈ 950 m');
    expect(distanceText(99_950)).toBe('≈ 100 km'); // was "≈ 100.0 km"
    expect(distanceText(99_949)).toBe('≈ 99.9 km');
    expect(distanceSpoken(995)).toBe('1.0 kilometres');
  });
  it('the leg from you wears its distance only where your position stands behind it', () => {
    expect(legText(1903, 25)).toBe('1.9 km');
    expect(legText(30, 25)).toBe('30 m'); // was "0 km"
    expect(legText(1903, 900)).toBeNull(); // a rough fix: no number to stand behind
    expect(legText(5000, 900)).toBe('5.0 km');
    expect(legText(Number.NaN, 25)).toBeNull();
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

  /* MAP 5D — the phone held near flat with any roll. The heading was the
     W3C back-of-device vector, which near flat swings with the roll: facing
     north it said 56°, 34° and 350° (the review's numbers, reproduced here
     from that formula so the failing case stays on record). */
  const w3cBack = (a: number, b: number, g: number): number => {
    const r = Math.PI / 180;
    const vx = -Math.cos(a * r) * Math.sin(g * r) - Math.sin(a * r) * Math.sin(b * r) * Math.cos(g * r);
    const vy = -Math.sin(a * r) * Math.sin(g * r) + Math.cos(a * r) * Math.sin(b * r) * Math.cos(g * r);
    return (((Math.atan2(vx, vy) / r) % 360) + 360) % 360;
  };
  const off = (h: number | null, want: number): number => Math.abs(signedDelta(h ?? NaN, want));
  it('near flat, facing north, whatever the roll: ~0°, not 56°, 34° or 350°', () => {
    for (const [b, g, was] of [
      [2, -3, 56],
      [15, -10, 34],
      [30, 5, 350],
    ] as const) {
      expect(Math.round(w3cBack(0, b, g))).toBe(was);
      expect(off(headingFromOrientation(0, b, g), 0), `β${b} γ${g}`).toBeLessThan(0.5);
    }
  });
  it('near flat the top edge points the way — 360 − alpha — for every alpha, pitch and roll', () => {
    for (let a = 0; a < 360; a += 30)
      for (const b of [-40, -15, 0, 5, 20, 45, 55])
        for (const g of [-60, -20, -3, 0, 7, 30, 60]) expect(off(headingFromOrientation(a, b, g), 360 - a), `α${a} β${b} γ${g}`).toBeLessThan(1e-6);
  });
  it('upright, the back of the phone points the way — and a roll of an upright phone is a turn', () => {
    expect(off(headingFromOrientation(0, 90, 10), 350)).toBeLessThan(1e-6);
    expect(off(headingFromOrientation(0, 88, 10), w3cBack(0, 88, 10))).toBeLessThan(1e-6);
    expect(off(headingFromOrientation(30, 85, -15), w3cBack(30, 85, -15))).toBeLessThan(1e-6);
    expect(off(headingFromOrientation(200, 82, 25), w3cBack(200, 82, 25))).toBeLessThan(1e-6);
  });
  it('coming upright the heading turns smoothly, never a jump', () => {
    for (const g of [-20, 10, 35]) {
      let prev = headingFromOrientation(40, 0, g)!;
      for (let b = 1; b <= 90; b++) {
        const h = headingFromOrientation(40, b, g)!;
        expect(off(h, prev), `β${b} γ${g}`).toBeLessThan(3);
        prev = h;
      }
    }
  });
  it('the screen turned: its drawn top edge is the pointer, in each of the four angles', () => {
    /* flat, the drawn top edge at north: alpha equals the screen's angle */
    for (const k of [0, 90, 180, 270]) expect(off(headingFromOrientation(k, 0, 0, k), 0), `screen ${k}`).toBeLessThan(1e-6);
    /* landscape (90): the drawn top is the phone's right side — tilted up 20°, still north */
    expect(off(headingFromOrientation(90, 0, -20, 90), 0)).toBeLessThan(1e-6);
    /* landscape, rolled about that drawn top edge (the phone's β here), still north */
    expect(off(headingFromOrientation(90, 12, 0, 90), 0)).toBeLessThan(1e-6);
    expect(off(headingFromOrientation(90, -25, 0, 90), 0)).toBeLessThan(1e-6);
    /* landscape (270), the drawn top at east */
    expect(off(headingFromOrientation(180, 0, 0, 270), 90)).toBeLessThan(1e-6);
    /* landscape, held upright: the camera faces north */
    expect(off(headingFromOrientation(90, 0, -90, 90), 0)).toBeLessThan(1e-6);
    /* a portrait heading read with the landscape angle is a quarter turn out — the angle matters */
    expect(off(headingFromOrientation(0, 5, 0, 90), 90)).toBeLessThan(1e-6);
  });
  it('the screen’s angle: screen.orientation, else the old window.orientation, else 0', () => {
    expect(screenAngleOf({ screen: { orientation: { angle: 90 } } })).toBe(90);
    expect(screenAngleOf({ screen: { orientation: { angle: 270 } }, orientation: 90 })).toBe(270);
    expect(screenAngleOf({ orientation: -90 })).toBe(270);
    expect(screenAngleOf({})).toBe(0);
  });
  it('steer by the GPS course while walking, else the compass made true, else nothing', () => {
    expect(steerHeading({ compassMagnetic: 270, declination: -7.6, course: 250, speed: 1.2 })).toEqual({ deg: 250, from: 'course' });
    expect(steerHeading({ compassMagnetic: 270, declination: -7.6, course: 250, speed: 0.3 })).toEqual({ deg: 262.4, from: 'compass' });
    expect(steerHeading({ compassMagnetic: null, declination: -7.6, course: null, speed: null })).toBeNull();
  });
});

describe('wayfind · the room the panels leave (Map 5e: the places’ sheet folded)', () => {
  it('its middle — where the map’s centre is drawn — for the 412 × 915 screen', () => {
    /* the top row, the side controls' lane, "Near you" open (330 px + the foot's 56) */
    expect(roomMiddle({ top: 126, bottom: 386, left: 16, right: 72 }, 412, 915)).toEqual([178, 327.5]);
    /* folded to its bar (150 + 56): the middle drops by half the room given back, so the point drawn there
       becomes the centre and nothing on the screen moves */
    const open = roomMiddle({ top: 126, bottom: 386, left: 16, right: 72 }, 412, 915);
    const folded = roomMiddle({ top: 126, bottom: 206, left: 16, right: 72 }, 412, 915);
    expect(folded[1] - open[1]).toBe((386 - 206) / 2);
    expect(folded[0]).toBe(open[0]);
    expect(roomMiddle({ top: 0, bottom: 0, left: 0, right: 0 }, 384, 824)).toEqual([192, 412]);
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

/* MAP 5D — the words that sat on pins: a ring's label under a cluster's "+3"
   (412-map: "250 m"), and the scale and the attribution over Beihai Park. */
describe('wayfind · keeping the map’s own words off the pins', () => {
  /* you at (206, 400), a ring of 48 px (250 m at z13.5) */
  const ring = (c: RingCorner) => {
    const a = (c * Math.PI) / 180;
    return { x: 206 + 48 * Math.sin(a), y: 400 - 48 * Math.cos(a) };
  };
  const size = { w: 36, h: 14 };
  it('a ring’s label on the NE diagonal, as the board draws it, when nothing covers it', () => {
    expect(ringLabelCorner(ring, size, [])).toBe(45);
    expect(ringLabelCorner(ring, size, [{ x: 100, y: 600 }])).toBe(45);
  });
  it('a cluster on the NE spot: the next free diagonal — SE, then NW, then SW', () => {
    const ne = ringLabelBox(ring(45), 45, size);
    const onNe = { x: (ne.l + ne.r) / 2, y: (ne.t + ne.b) / 2 };
    expect(ringLabelCorner(ring, size, [onNe])).toBe(135);
    const se = ringLabelBox(ring(135), 135, size);
    expect(ringLabelCorner(ring, size, [onNe, { x: se.l + 5, y: se.t + 5 }])).toBe(315);
    const nw = ringLabelBox(ring(315), 315, size);
    expect(ringLabelCorner(ring, size, [onNe, { x: se.l + 5, y: se.t + 5 }, { x: nw.r - 5, y: nw.b - 5 }])).toBe(225);
  });
  it('covered everywhere: it stays NE', () => {
    const all = ([45, 135, 225, 315] as const).map((c) => {
      const b = ringLabelBox(ring(c), c, size);
      return { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 };
    });
    expect(ringLabelCorner(ring, size, all)).toBe(45);
  });
  it('the label grows away from the ring: right and up at NE, left and down at SW', () => {
    const p = { x: 100, y: 100 };
    expect(ringLabelBox(p, 45, size)).toEqual({ l: 103, t: 84, r: 139, b: 98 });
    expect(ringLabelBox(p, 225, size)).toEqual({ l: 61, t: 102, r: 97, b: 116 });
  });
  it('the foot: left unless a pin (or its name) is under it; then right if clear of pins and the side controls; else one short line', () => {
    const full = { w: 200, h: 60 };
    const lane = { width: 412, bottom: 540 };
    expect(footPlace(full, lane, [])).toBe('l');
    expect(footPlace(full, lane, [{ x: 100, y: 510 }])).toBe('r'); // Beihai Park under the left
    expect(footPlace(full, lane, [{ x: 100, y: 450 }])).toBe('r'); // its NAME under it (38 px below the point)
    expect(footPlace(full, lane, [{ x: 100, y: 430 }])).toBe('l'); // name and all clear above it
    expect(footPlace(full, lane, [{ x: 100, y: 510 }, { x: 300, y: 500 }])).toBe('short'); // both sides taken
    /* at 384 the side controls come down into the right-hand lane */
    const side = { l: 384 - 16 - 48, t: 300, r: 384 - 16, b: 500 };
    expect(footPlace(full, { width: 384, bottom: 520 }, [{ x: 100, y: 470 }], [side])).toBe('short');
    expect(footPlace(full, { width: 384, bottom: 520 }, [{ x: 100, y: 470 }], [])).toBe('r');
    expect(footPlace(full, lane, [{ x: 234, y: 520 }])).toBe('l'); // just clear of it (a pin's 17 px disc)
  });
  /* MAP 5F, item 5: the keep-off geometry assumed icon pins (17 px, the name 38 px down) — a photo pin is a 23.5 px
     round with its name 43 px down */
  it('the foot keeps off a photo pin’s larger round and lower name', () => {
    const full = { w: 200, h: 60 };
    const lane = { width: 412, bottom: 540 };
    /* the box's top is at 480: an icon pin's name ends 38 px under its point, a photo pin's 43 */
    expect(footPlace(full, lane, [{ x: 100, y: 440 }])).toBe('l');
    expect(footPlace(full, lane, [{ x: 100, y: 440, photo: true }])).toBe('r');
    /* and beside it: 17 px of disc clear of the left box's edge at 216, a photo's 23.5 not — and it lies in the
       right-hand lane too, so the foot goes short */
    expect(footPlace(full, lane, [{ x: 234, y: 520 }])).toBe('l');
    expect(footPlace(full, lane, [{ x: 234, y: 520, photo: true }])).toBe('short');
  });
  it('a pin’s room: its disc or photo, and a name as wide and as long as it is', () => {
    expect(pinBox({ x: 100, y: 200 })).toEqual({ l: 83, t: 183, r: 117, b: 238 });
    expect(pinBox({ x: 100, y: 200, photo: true })).toEqual({ l: 76.5, t: 176.5, r: 123.5, b: 243 });
    /* "Kau Kee" (7 characters): no wider than the photo; a long name wraps to a second line, 9 em at most */
    expect(pinBox({ x: 100, y: 200, photo: true, chars: 7 }).r).toBe(123.5);
    const long = pinBox({ x: 100, y: 200, photo: true, chars: 30 });
    expect(long.r - long.l).toBeCloseTo(9 * 11.5, 5);
    expect(long.b).toBe(243 + 14);
  });
  /* MAP 5F, item 16: the "Dragon'… 10.4 km" chip lay on the name of the photo pin left of Kau Kee (Central, z15.5) */
  it('an edge chip keeps off a photo pin’s name, which the old 17 px square missed', () => {
    const chip = { l: 40, t: 321, r: 212, b: 365 }; // the chip at the left edge, 44 px tall round y 343
    const pin = { x: 69, y: 298, photo: true, chars: 12 };
    /* the old test: the point within 17 px of the chip */
    const old = pin.x > chip.l - 17 && pin.x < chip.r + 17 && pin.y > chip.t - 17 && pin.y < chip.b + 17;
    expect(old).toBe(false);
    expect(pinOn(pin, chip)).toBe(true);
    /* a step down its edge (52 px) clears it */
    expect(pinOn(pin, { ...chip, t: chip.t + 52, b: chip.b + 52 })).toBe(false);
  });
  /* MAP 5F, item 4: today's and tonight's tags hung 20 px under a photo pin's point — on its 23.5 px rim, under
     tonight's 26.5 px ring, inside today's 29 px halo */
  it('today’s and tonight’s tags hang below what is really drawn', () => {
    expect(tagBelow('today', false)).toBe(20);
    expect(tagBelow('tonight', false)).toBe(20);
    expect(tagBelow('today', true)).toBeGreaterThan(PHOTO_RIM);
    expect(tagBelow('tonight', true)).toBeGreaterThan(PHOTO_TONIGHT);
    expect(tagBelow('today', true)).toBeGreaterThan(20);
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
  it('a cluster: its badge', () => {
    expect(clusterBadge(4)).toBe('+4');
    expect(clusterBadge(240)).toBe('+99');
  });
  /* MAP 5D — the list under a rough fix: some rows measured, some not */
  it('the list: rows with a distance first, nearest first, then the rest by name', () => {
    const rows = [
      { n: 'Shichahai', d: 300 },
      { n: 'Beihai Park', d: null },
      { n: 'Drum Tower', d: 100 },
      { n: 'Ande Road', d: null },
      { n: 'Houhai', d: 10 },
    ];
    const order = byDistanceThenName(rows, (r) => r.d, (r) => r.n).map((r) => r.n);
    expect(order).toEqual(['Houhai', 'Drum Tower', 'Shichahai', 'Ande Road', 'Beihai Park']);
    /* the comparator it replaced: 0 whenever a side had no distance — the 300 m row came before the 100 m one */
    const old = [...rows].sort((x, y) => (x.d !== null && y.d !== null ? x.d - y.d : 0)).map((r) => r.n);
    expect(old.indexOf('Shichahai')).toBeLessThan(old.indexOf('Drum Tower'));
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

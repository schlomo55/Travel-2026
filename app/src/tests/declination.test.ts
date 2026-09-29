/* THE COMPASS'S DECLINATION (Map 5c) — the table computed at dev time from
   the World Magnetic Model 2025 (scripts/maps/declination.ts), looked up
   offline (lib/logic/declination.ts): checked here against the model itself
   (the `magvar` devDependency) at every stop of every seed, and at the edges. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { magvar } from 'magvar';
import type { AppBackup } from '../lib/model/types';
import { declinationAt } from '../lib/logic/declination';
import { EPOCH } from '../lib/logic/declination-grid';

const here = dirname(fileURLToPath(import.meta.url));
const seeds = ['china-2026.trip.json', 'israel-test.trip.json', 'template-example.trip.json'].map(
  (f) => JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', f), 'utf8')) as AppBackup,
);

describe('declination · the table against the model', () => {
  it('within 0.3° of WMM2025 at every stop of every seed', () => {
    let n = 0;
    for (const s of seeds.flatMap((x) => x.trips.flatMap((t) => t.stops))) {
      if (!s.coord) continue;
      n++;
      expect(Math.abs(declinationAt(s.coord.lat, s.coord.lng) - magvar(s.coord.lat, s.coord.lng, 0, EPOCH)), s.name).toBeLessThan(0.3);
    }
    expect(n).toBeGreaterThan(15);
  });
  it('the trip’s own numbers: Beijing ≈ 7.6° W, Lijiang ≈ 1.4° W, Hong Kong ≈ 3.3° W', () => {
    expect(declinationAt(39.9033, 116.3917)).toBeCloseTo(-7.55, 1);
    expect(declinationAt(26.8739, 100.2353)).toBeCloseTo(-1.41, 1);
    expect(declinationAt(22.2934, 114.1751)).toBeCloseTo(-3.3, 1);
  });
  it('round the date line and past the grid’s latitudes it still answers', () => {
    expect(declinationAt(10, 180)).toBeCloseTo(declinationAt(10, -180), 5);
    expect(Number.isFinite(declinationAt(89, 20))).toBe(true);
    expect(declinationAt(Number.NaN, 0)).toBe(0);
  });
});

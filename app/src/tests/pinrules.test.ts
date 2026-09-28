/* MAP 5a — the coordinate pass's RULES (scripts/china/pin-rules.ts) and the
   category table (scripts/china/categories.ts), against small fixtures built
   from the failures this repo has already met: "CHAO Sanlitun" is a hospital,
   Walnut Garden's namesake is a bus stop, the 28 Bends' a petrol station, a
   chain has branches. Pure — no seed, no network. */
import { describe, expect, it } from 'vitest';
import type { Coord } from '../lib/model/types';
import { decidePin, fits, namesAgree, normName, osmNames, type OsmCand, type PinAsk } from '../../scripts/china/pin-rules';
import { categoryFromOsm } from '../../scripts/china/categories';

const TIANANMEN: Coord = { lat: 39.9033, lng: 116.3917 };
/** A point `dKm` due east of `from` (good enough for fixtures). */
const east = (from: Coord, dKm: number): Coord => ({ lat: from.lat, lng: from.lng + dKm / (111.32 * Math.cos((from.lat * Math.PI) / 180)) });
const cand = (at: Coord, names: string[], cls: string, type: string, extra: Partial<OsmCand> = {}): OsmCand => ({
  lat: at.lat,
  lng: at.lng,
  label: `${names[0]}, 北京市, 中国`,
  names,
  cls,
  type,
  osm: 'node/1',
  ...extra,
});
const ask = (over: Partial<PinAsk>): PinAsk => ({ kind: 'sight', anchor: TIANANMEN, nearKm: 25, want: ['北海公园'], osm: [], wd: [], ...over });

describe('the coordinate rules (pin-rules.ts)', () => {
  it('pins one clean answer, and says when a second source agrees', () => {
    const hit = cand(east(TIANANMEN, 2), ['北海公园', 'Beihai Park'], 'leisure', 'park');
    const one = decidePin(ask({ osm: [hit] }));
    expect(one.ok).toBe(true);
    expect(one.sources).toBe('osm');
    const two = decidePin(ask({ osm: [hit], wd: [{ id: 'Q1', names: ['北海公园'], coord: east(TIANANMEN, 2.2) }] }));
    expect(two.ok).toBe(true);
    expect(two.sources).toBe('osm+wikidata');
    expect(two.wd?.id).toBe('Q1');
  });

  it('never pins another place that answers to the query — "CHAO Sanlitun" is a hospital', () => {
    const v = decidePin(ask({ kind: 'hotel', want: ['CHAO'], osm: [cand(east(TIANANMEN, 5), ['北京朝阳医院'], 'amenity', 'hospital')] }));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/a different place/);
  });

  it('never pins the right name on the wrong kind of thing', () => {
    /* Walnut Garden's OSM namesake is a bus stop; the 28 Bends' a petrol station */
    const bus = decidePin(ask({ kind: 'other', want: ['核桃园'], osm: [cand(TIANANMEN, ['核桃园'], 'highway', 'bus_stop')] }));
    expect(bus.ok).toBe(false);
    expect(bus.reason).toMatch(/highway=bus_stop/);
    const fuel = decidePin(ask({ want: ['二十八道拐'], osm: [cand(TIANANMEN, ['二十八道拐'], 'amenity', 'fuel')] }));
    expect(fuel.ok).toBe(false);
    /* and a housing estate is never a resort */
    const estate = decidePin(ask({ want: ['九华山庄'], osm: [cand(TIANANMEN, ['九华山庄'], 'landuse', 'residential')] }));
    expect(estate.ok).toBe(false);
  });

  it('never pins past the radius its anchor allows', () => {
    const v = decidePin(ask({ nearKm: 6, osm: [cand(east(TIANANMEN, 9), ['北海公园'], 'leisure', 'park')] }));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/too far/);
  });

  it('two answers of one name in the circle — a chain’s branches — pin nothing, unless Wikidata sides with one', () => {
    const a = cand(east(TIANANMEN, 1), ['东来顺'], 'amenity', 'restaurant');
    const b = cand(east(TIANANMEN, 6), ['东来顺'], 'amenity', 'restaurant', { osm: 'node/2' });
    const base = ask({ kind: 'food', want: ['东来顺'], osm: [a, b] });
    const alone = decidePin(base);
    expect(alone.ok).toBe(false);
    expect(alone.reason).toMatch(/ambiguous/);
    const sided = decidePin({ ...base, wd: [{ id: 'Q9', names: ['东来顺'], coord: east(TIANANMEN, 1.1) }] });
    expect(sided.ok).toBe(true);
    expect(sided.hit?.lat).toBe(a.lat);
    expect(sided.reason).toMatch(/Q9 sides with this answer/);
  });

  it('where Wikidata puts the name elsewhere in the same circle, the sources disagree and nothing pins', () => {
    const v = decidePin(ask({ osm: [cand(east(TIANANMEN, 1), ['北海公园'], 'leisure', 'park')], wd: [{ id: 'Q5', names: ['北海公园'], coord: east(TIANANMEN, 6) }] }));
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/disagree/);
    /* the item OSM links the answer to disagrees just as loudly — Huanglong Cave's sits 26.6 km away */
    const linked = decidePin(ask({ want: ['黄龙洞'], osm: [cand(TIANANMEN, ['黄龙洞'], 'natural', 'cave_entrance', { wikidata: 'Q7' })], wd: [{ id: 'Q7', names: ['Huanglong Cave'], coord: east(TIANANMEN, 26.6) }], nearKm: 30 }));
    expect(linked.ok).toBe(false);
  });

  it('only the place’s own name can contradict — a metro station whose alias contains it cannot', () => {
    const road = cand(east(TIANANMEN, 1.6), ['南滨路', 'Nanbin Road'], 'highway', 'primary');
    const v = decidePin(ask({ want: ['南滨路'], osm: [road], wd: [{ id: 'Q116258885', names: ['后堡站', '南滨路站'], coord: east(TIANANMEN, 4) }] }));
    expect(v.ok).toBe(true);
    expect(v.sources).toBe('osm');
  });

  it('a district is measured point to point: inside its outline says nothing about where its town is', () => {
    const district = (name: string, at: typeof TIANANMEN) => cand(at, [name], 'boundary', 'administrative', { bbox: [39.5, 40.5, 116.0, 117.0] });
    /* OSM's point 9 km from the item's: no agreement, and the linked item contradicts it */
    const off = decidePin(ask({ want: ['崇礼区'], osm: [district('崇礼区', east(TIANANMEN, 9))], wd: [{ id: 'Q1076119', names: ['崇礼区'], coord: TIANANMEN }] }));
    expect(off.ok).toBe(false);
    expect(off.reason).toMatch(/disagree/);
    /* a city's centre 1.9 km from Wikidata's point agrees */
    const on = decidePin(ask({ want: ['威海市'], osm: [district('威海市', east(TIANANMEN, 1.9))], wd: [{ id: 'Q373023', names: ['威海市'], coord: TIANANMEN }] }));
    expect(on.ok).toBe(true);
    expect(on.sources).toBe('osm+wikidata');
  });

  it('a Wikidata point just off a lake’s outline is on the lake — both sources agree', () => {
    const lake = cand(TIANANMEN, ['宝峰湖'], 'water', 'lake', { bbox: [39.898, 39.909, 116.389, 116.394] });
    const shore = { lat: 39.9, lng: 116.3965 }; // ~0.2 km east of the outline, ~0.4 km from the answer's own point
    const v = decidePin(ask({ want: ['宝峰湖'], osm: [lake], wd: [{ id: 'Q4857450', names: ['宝峰湖'], coord: shore }] }));
    expect(v.ok).toBe(true);
    expect(v.sources).toBe('osm+wikidata');
  });

  it('far from its anchor, one source is not enough', () => {
    const far = cand(east(TIANANMEN, 70), ['慕田峪长城'], 'historic', 'citywalls');
    const alone = decidePin(ask({ nearKm: 85, want: ['慕田峪长城'], osm: [far] }));
    expect(alone.ok).toBe(false);
    expect(alone.reason).toMatch(/Wikidata does not confirm/);
    const backed = decidePin(ask({ nearKm: 85, want: ['慕田峪长城'], osm: [far], wd: [{ id: 'Q2', names: ['慕田峪长城'], coord: east(TIANANMEN, 70.3) }] }));
    expect(backed.ok).toBe(true);
  });

  it('reads every name an OSM object carries, never its old one, normalised for width, case, quotes and dashes only', () => {
    const names = osmNames('文武廟, 荷李活道, 香港', { name: '文武廟', 'name:en': 'Man Mo Temple', alt_name: 'A;B', old_name: 'Gone', 'name:etymology:wikidata': 'Q1' });
    expect(names).toEqual(['文武廟', 'Man Mo Temple', 'A', 'B']);
    expect(namesAgree(['Man Mo Temple'], ['man mo temple'])).toBe('Man Mo Temple');
    expect(normName('Ｍ＋')).toBe('m+'); // full width folds; the plus survives
    expect(normName('Lord Stow’s')).toBe(normName("Lord Stow's"));
    expect(normName('Central–Mid-Levels')).toBe(normName('Central-Mid-Levels'));
    expect(namesAgree(['Gone'], ['Man Mo'])).toBeNull();
  });

  it('skips a namesake above the place — a metro station, a bus stop — and says so', () => {
    const station = cand(east(TIANANMEN, 3.3), ['南锣鼓巷'], 'railway', 'station');
    const alley = cand(east(TIANANMEN, 3.6), ['南锣鼓巷', 'South Luogu Alley'], 'highway', 'pedestrian', { osm: 'way/4922662' });
    const v = decidePin(ask({ want: ['南锣鼓巷'], osm: [station, alley] }));
    expect(v.ok).toBe(true);
    expect(v.hit?.osm).toBe('way/4922662');
    expect(v.reason).toMatch(/skipped railway=station "南锣鼓巷" above it/);
    /* and where nothing below the namesake is the place, nothing pins */
    const only = decidePin(ask({ want: ['云南大学'], osm: [cand(TIANANMEN, ['云南大学'], 'highway', 'bus_stop'), cand(TIANANMEN, ['云南大学站'], 'railway', 'station')] }));
    expect(only.ok).toBe(false);
    expect(only.reason).toMatch(/none of its other answers is the place/);
  });

  it('a hotel named after a sight is not the sight', () => {
    const v = decidePin(ask({ want: ['天坛'], osm: [cand(east(TIANANMEN, 3), ['天坛饭店'], 'tourism', 'hotel')] }));
    expect(v.ok).toBe(false);
  });

  it('reads a road OSM keeps in pieces as one place — and two roads of one name far apart as two', () => {
    const piece = (dKm: number, osm: string) => cand(east(TIANANMEN, dKm), ['南滨路', 'Nanbin Road'], 'highway', 'primary', { osm });
    const one = decidePin(ask({ kind: 'sight', want: ['南滨路'], osm: [piece(1.6, 'way/1'), piece(3.2, 'way/2'), piece(4.1, 'way/3')] }));
    expect(one.ok).toBe(true);
    const two = decidePin(ask({ kind: 'sight', want: ['南滨路'], osm: [piece(1.6, 'way/1'), piece(12, 'way/9')] }));
    expect(two.ok).toBe(false);
    expect(two.reason).toMatch(/ambiguous/);
  });

  it('holds a place to its own kinds where the trip says exactly what it is — a ferry terminal, not the light-rail stop that shares its name', () => {
    const lrt = cand(TIANANMEN, ['氹仔碼頭'], 'railway', 'station');
    const own = ['amenity=ferry_terminal'] as const;
    expect(decidePin(ask({ kind: 'transport', want: ['氹仔'], osm: [lrt] })).ok).toBe(true); // the kind table alone would take it
    expect(decidePin(ask({ kind: 'transport', want: ['氹仔'], osm: [lrt], fits: own })).ok).toBe(false);
    const terminal = cand(east(TIANANMEN, 0.2), ['氹仔客運碼頭'], 'amenity', 'ferry_terminal', { osm: 'way/7' });
    const v = decidePin(ask({ kind: 'transport', want: ['氹仔'], osm: [lrt, terminal], fits: own }));
    expect(v.ok).toBe(true);
    expect(v.hit?.osm).toBe('way/7');
  });

  it('knows what kind of thing fits what the trip says the place is', () => {
    expect(fits('food', 'amenity', 'restaurant')).toBe(true);
    expect(fits('food', 'highway', 'bus_stop')).toBe(false);
    expect(fits('sight', 'amenity', 'school')).toBe(false);
    expect(fits('sight', 'leisure', 'park')).toBe(true);
    expect(fits('transport', 'railway', 'station')).toBe(true);
    expect(fits('hotel', 'tourism', 'hotel')).toBe(true);
    expect(fits('hotel', 'building', 'residential')).toBe(false);
  });

  it('maps OSM tags onto the eight categories, and says nothing about a road or a building', () => {
    expect(categoryFromOsm('amenity=restaurant')).toBe('food');
    expect(categoryFromOsm('shop=bakery')).toBe('food');
    expect(categoryFromOsm('natural=hot_spring')).toBe('spa');
    expect(categoryFromOsm('amenity=theatre')).toBe('show');
    expect(categoryFromOsm('tourism=guest_house')).toBe('hotel');
    expect(categoryFromOsm('aerialway=station')).toBe('transport');
    expect(categoryFromOsm('amenity=hospital')).toBe('medical');
    expect(categoryFromOsm('amenity=marketplace')).toBe('shopping');
    expect(categoryFromOsm('historic=monument')).toBe('sight');
    expect(categoryFromOsm('highway=pedestrian')).toBeNull();
    expect(categoryFromOsm('building=yes')).toBeNull();
  });
});


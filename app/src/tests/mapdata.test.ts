/* MAP 5a — the Map tab's data layer: `pin`, `category`, `detail` on every
   spot, driver card and booking (docs/design/horizon/MAP-5A.md).

   The layer against the real China trip, built by the real pipeline twice —
   with the layer and without it — and against the seed on disk. The rules
   themselves are tested on fixtures in pinrules.test.ts. No network. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, ShowCard, Spot, TripBundle } from '../lib/model/types';
import { geoUri, googleMapsUrl, isAmapTerritory, type MapTarget } from '../lib/logic/geo';
import { km } from '../../scripts/china/pin-rules';
import { COORD_CHECKS, PINS } from '../../scripts/china/pins';
import { OVERRIDES, PLACE_CATEGORIES } from '../../scripts/china/categories';
import { DETAIL_MAX, DETAILS, detailProblems, isVerbatim, ownText } from '../../scripts/china/details';
import { mapLayerProblems } from '../../scripts/china/map-layer';
import { TICKETS } from '../../scripts/china/tickets';
import { extractLegacyData } from '../../scripts/china/extract';
import { readExtras, readOptions, readPhotoInputs } from '../../scripts/china/inputs';
import { buildChinaBundle } from '../../scripts/china/transform';
import { PLACE_COORDS, STOP_COORDS } from '../../scripts/china/coords';

/* ------------------------------------------------------------- the layer */

const repo = join(__dirname, '..', '..', '..');
const legacy = extractLegacyData(join(repo, 'legacy', 'index.html'));
const pdf = readFileSync(join(repo, 'sources', 'china-2026', 'China-2026-Flights.pdf'));
const inputs = {
  legacy,
  flightsPdf: { base64: pdf.toString('base64'), size: pdf.byteLength },
  photos: readPhotoInputs(repo),
  extras: readExtras(repo),
  options: readOptions(repo),
};
const layered = buildChinaBundle(inputs);
const bare = buildChinaBundle({ ...inputs, mapLayer: false });
const onDisk = (JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup).trips[0] as TripBundle;

type Placed = { id: string; e: Spot | ShowCard | Booking };
const placesOf = (b: TripBundle): Placed[] => [
  ...b.stops.flatMap((s) => (s.spots ?? []).map((sp) => ({ id: sp.id, e: sp as Spot }))),
  ...b.showCards.filter((c) => c.kind === 'place').map((c) => ({ id: c.id, e: c as ShowCard })),
  ...b.bookings.map((x) => ({ id: x.id, e: x as Booking })),
];

/** Where each pin came from in pins.ts. */
function pinKey(id: string): string | undefined {
  const m = /^cn26-spot-([a-z]+)-(.+)$/.exec(id);
  if (m) return `${m[1]}/${m[2]}`;
  if (id.startsWith('cn26-place-')) return id;
  if (id.startsWith('cn26-stay-')) return `stay:${id.slice(-2)}`;
  if (id.startsWith('cn26-ticket-')) return TICKETS.find((t) => `cn26-ticket-${t.key}` === id)?.placeId;
  return undefined;
}

describe('the Map 5a layer on the China trip', () => {
  it('passes the build’s own proof: categories, pins, beds, details', () => {
    expect(mapLayerProblems(layered)).toEqual([]);
  });

  it('every new coordinate lies within its anchor’s radius, and is exactly the one pins.ts confirmed', () => {
    const pinned = placesOf(layered).filter((p) => p.e.pin);
    expect(pinned.length).toBeGreaterThan(0);
    for (const { id, e } of pinned) {
      const rec = PINS[pinKey(id) ?? ''];
      expect(rec?.ok, `${id} has a confirmed record`).toBe(true);
      expect(km(rec!.anchor, e.pin!), `${id} within ${rec!.nearKm} km of its anchor`).toBeLessThanOrEqual(rec!.nearKm);
      expect(e.pin, id).toEqual({ lat: rec!.lat, lng: rec!.lng });
      expect(e.coord, `${id}: a pin only where there is no coord`).toBeUndefined();
    }
    /* and every confirmed record reached its entity */
    for (const [key, rec] of Object.entries(PINS)) {
      if (!rec.ok) continue;
      const e = placesOf(layered).find((p) => p.id === rec.entity)?.e;
      expect(e?.pin, `${key} → ${rec.entity}`).toEqual({ lat: rec.lat, lng: rec.lng });
    }
  });

  it('every spot, driver card and booking has one of the eight categories', () => {
    for (const { id, e } of placesOf(layered)) expect(PLACE_CATEGORIES, id).toContain(e.category);
    /* the trip's own words win: the massage hospital is a spa, the TCM hospital medical */
    const card = (id: string) => layered.showCards.find((c) => c.id === id);
    expect(card('cn26-place-07')?.category).toBe('spa');
    expect(card('cn26-place-27')?.category).toBe('medical');
    expect(layered.bookings.filter((b) => b.kind === 'hotel').every((b) => b.category === 'hotel')).toBe(true);
    /* every place where the trip's words overrule OSM's tags got the trip's word */
    const byId = new Map(placesOf(layered).map((p) => [p.id, p.e]));
    for (const [id, o] of Object.entries(OVERRIDES)) expect(byId.get(id)?.category, id).toBe(o.category);
  });

  it('every detail is the trip’s own words, verbatim, within 90 characters', () => {
    expect(detailProblems(layered)).toEqual([]);
    for (const { id, e } of placesOf(layered)) {
      if (!e.detail) continue;
      expect(e.detail.length, id).toBeLessThanOrEqual(DETAIL_MAX);
      expect(isVerbatim(e.detail, ownText(layered, id)), id).toBe(true);
      expect(e.detail).toBe(DETAILS[id]);
    }
    /* a line from elsewhere is caught */
    expect(isVerbatim('Copper-pot mutton hotpot since 1903', ownText(layered, 'cn26-spot-kunming-cuihu'))).toBe(false);
  });

  it('only ADDS: without its three keys, every entity is the pipeline’s own, field for field and in order', () => {
    /* the three keys come off spots, place cards and bookings ONLY — a stop's
       read-more `detail` and a task's `detail` are older fields and must match */
    const without = <T extends object>(e: T): T => {
      const { pin: _p, category: _c, detail: _d, ...rest } = e as T & { pin?: unknown; category?: unknown; detail?: unknown };
      return rest as T;
    };
    const stripped: TripBundle = {
      ...layered,
      stops: layered.stops.map((s) => (s.spots ? { ...s, spots: s.spots.map(without) } : s)),
      showCards: layered.showCards.map((c) => (c.kind === 'place' ? without(c) : c)),
      bookings: layered.bookings.map(without),
    };
    const text = (b: TripBundle) => JSON.stringify({ ...b, documents: b.documents.map((d) => d.meta) });
    expect(text(stripped)).toBe(text(bare));
    /* and the three keys are the only ones the layer brought */
    const keys = (b: TripBundle) => new Set(placesOf(b).flatMap((p) => Object.keys(p.e)));
    expect([...keys(layered)].filter((k) => !keys(bare).has(k)).sort()).toEqual(['category', 'detail', 'pin']);
  });

  it('never changes what a button opens — a pin is drawn, never opened', () => {
    const targetOf = (e: Spot | ShowCard | Booking): MapTarget => ({
      ...(e.coord ? { coord: e.coord } : {}),
      ...(e.mapQuery ? { query: e.mapQuery } : {}),
      ...(e.address ? { address: e.address } : {}),
      ...(e.mapCity ? { city: e.mapCity } : {}),
      ...(e.mapUrl ? { url: e.mapUrl } : {}),
      ...(e.addressInSearch ? { addressInSearch: true } : {}),
    });
    const before = new Map(placesOf(bare).map((p) => [p.id, p.e]));
    for (const { id, e } of placesOf(layered)) {
      const old = before.get(id)!;
      expect(geoUri(targetOf(e)), id).toBe(geoUri(targetOf(old)));
      expect(googleMapsUrl(targetOf(e)), id).toBe(googleMapsUrl(targetOf(old)));
      expect(isAmapTerritory(targetOf(e)), id).toBe(isAmapTerritory(targetOf(old)));
    }
    /* and a bed still never carries a dot */
    expect(layered.bookings.filter((b) => b.kind === 'hotel').every((b) => !b.coord)).toBe(true);
  });

  it('the seed on disk is exactly what the pipeline builds — never hand-edited', () => {
    expect(JSON.stringify(onDisk)).toBe(JSON.stringify(layered));
  });

  it('measured the coordinates the trip already stored, and changed none of them', () => {
    for (const [id, c] of Object.entries(COORD_CHECKS)) {
      const ours = id.startsWith('stop:') ? STOP_COORDS[id.slice(5)] : id.startsWith('cn26-place-') ? PLACE_COORDS[id] : undefined;
      if (ours) expect(c.coord, id).toEqual(ours);
    }
    for (const s of layered.stops) if (STOP_COORDS[s.id.slice('cn26-stop-'.length)]) expect(s.coord).toEqual(STOP_COORDS[s.id.slice('cn26-stop-'.length)]);
  });
});

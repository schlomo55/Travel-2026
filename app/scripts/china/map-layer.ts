/* THE MAP TAB'S LAYER ON THE SEED (Map 5a) — `pin`, `category` and `detail`
   added to every spot, driver card and booking, and NOTHING ELSE TOUCHED.

   It runs once, last, over the finished bundle (transform.ts), so the rest of
   the pipeline cannot tell it exists — and `buildChinaBundle({ mapLayer:
   false })` builds the same trip without it, which is how the tests prove it
   only ever adds (src/tests/mapdata.test.ts). The three keys are inserted
   after the entity's own name rather than appended, so a text diff of the
   seed shows new lines and never an edited one.

   · pin      — pins.ts, only where the pass pinned the place and the entity
                has no `coord` (the Map tab reads coord ?? pin). A ticket
                borrows the pin of the spot it happens at, as it already
                borrows that spot's map button (tickets.ts).
   · category — categories.ts: the trip's words, then OSM's confirmed tags,
                then the entity's own kind.
   · detail   — details.ts, verbatim.

   `mapLayerProblems()` is the build's proof of all of it (assert.ts). */
import type { Booking, Coord, PlaceCategory, ShowCard, Spot, TripBundle } from '../../src/lib/model/types';
import { bookingKindCategory, CARD_KIND, categoryOf, PLACE_CATEGORIES, spotKindCategory } from './categories';
import { DETAILS, detailProblems } from './details';
import { km } from './pin-rules';
import { PINS } from './pins';
import { TICKETS } from './tickets';

interface Layer {
  category: PlaceCategory;
  detail?: string;
  pin?: Coord;
}

/** Insert `extra` right after `after`, keeping every other key where it was. */
function withAfter<T extends object>(obj: T, after: keyof T & string, extra: Layer): T {
  const out: Record<string, unknown> = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === after) {
      Object.assign(out, extraKeys(extra));
      placed = true;
    }
  }
  if (!placed) Object.assign(out, extraKeys(extra));
  return out as T;
}

const extraKeys = (l: Layer) => ({
  category: l.category,
  ...(l.detail ? { detail: l.detail } : {}),
  ...(l.pin ? { pin: l.pin } : {}),
});

/** The pin pins.ts holds for a place, if the pass pinned it. */
function pinOf(key: string): Coord | undefined {
  const p = PINS[key];
  return p?.ok && p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : undefined;
}
export const pinnedClass = (key: string): string | undefined => (PINS[key]?.ok ? PINS[key]?.osmClass : undefined);

/** `cn26-spot-<stop>-<id>` → the `<stop>/<id>` key spots.ts and pins.ts use. */
export function spotKey(stopKey: string, spotId: string): string {
  return `${stopKey}/${spotId.slice(`cn26-spot-${stopKey}-`.length)}`;
}

function spotLayer(stopKey: string, sp: Spot): Layer {
  const key = spotKey(stopKey, sp.id);
  const pin = sp.coord ? undefined : pinOf(key);
  return {
    category: categoryOf(sp.id, pinnedClass(key), spotKindCategory(sp.kind)).category,
    ...(DETAILS[sp.id] ? { detail: DETAILS[sp.id] } : {}),
    ...(pin ? { pin } : {}),
  };
}

/* A DRIVER CARD SAYS WHAT IT IS — its meaning names an airport, a station, a
   district, a clinic — so its category is its own (categories.ts CARD_KIND,
   and the trip's words above that). OSM's tags are never read for a card: the
   answer its button gate reads is whatever Nominatim ranks first, and for
   后海/什刹海 that is the metro station, which would file the lakes as
   transport. (A spot's and a bed's tags come from its PIN — the answer the
   pass found to BE the place — which is why those may be read.) */
function cardLayer(c: ShowCard): Layer {
  const pin = c.coord ? undefined : pinOf(c.id);
  const kind = CARD_KIND[c.id];
  if (!kind) throw new Error(`map layer: driver card ${c.id} has no CARD_KIND — say what it is in categories.ts`);
  return {
    category: categoryOf(c.id, undefined, kind.category).category,
    ...(DETAILS[c.id] ? { detail: DETAILS[c.id] } : {}),
    ...(pin ? { pin } : {}),
  };
}

export function addMapLayer(bundle: TripBundle): TripBundle {
  const spotCategory = new Map<string, PlaceCategory>();
  const spotPin = new Map<string, Coord>();
  const stops = bundle.stops.map((st) => {
    if (!st.spots) return st;
    const stopKey = st.id.slice('cn26-stop-'.length);
    return {
      ...st,
      spots: st.spots.map((sp) => {
        const layer = spotLayer(stopKey, sp);
        spotCategory.set(spotKey(stopKey, sp.id), layer.category);
        if (layer.pin) spotPin.set(spotKey(stopKey, sp.id), layer.pin);
        return withAfter(sp, 'kind', layer);
      }),
    };
  });

  const cardCategory = new Map<string, PlaceCategory>();
  const showCards = bundle.showCards.map((c) => {
    if (c.kind !== 'place') return c;
    const layer = cardLayer(c);
    cardCategory.set(c.id, layer.category);
    return withAfter(c, 'meaning', layer);
  });

  const ticketPlace = new Map(TICKETS.map((t) => [`cn26-ticket-${t.key}`, t.placeId]));
  const bookings = bundle.bookings.map((b): Booking => {
    let category = bookingKindCategory(b);
    let pin: Coord | undefined;
    if (b.kind === 'hotel') {
      const key = `stay:${b.id.slice(-2)}`;
      pin = b.coord ? undefined : pinOf(key);
      category = categoryOf(b.id, pinnedClass(key), 'hotel').category;
    } else if (b.kind === 'activity') {
      /* a ticket is what happens AT a place: that place's category, and —
         where it has no coordinate of its own — that place's pin */
      const place = ticketPlace.get(b.id);
      const placeCategory = place ? (cardCategory.get(place) ?? spotCategory.get(place)) : undefined;
      category = categoryOf(b.id, undefined, placeCategory ?? 'sight').category;
      if (!b.coord && place && !place.startsWith('cn26-place-')) pin = spotPin.get(place);
    }
    return withAfter(b, 'title', { category, ...(DETAILS[b.id] ? { detail: DETAILS[b.id] } : {}), ...(pin ? { pin } : {}) });
  });

  return { ...bundle, stops, showCards, bookings };
}

/** Where a pin came from, so its distance can be re-measured: the key in
    pins.ts, for every entity that can carry one. */
function pinKeyOf(bundle: TripBundle, entity: string): string | undefined {
  for (const st of bundle.stops) {
    const stopKey = st.id.slice('cn26-stop-'.length);
    if ((st.spots ?? []).some((sp) => sp.id === entity)) return spotKey(stopKey, entity);
  }
  if (entity.startsWith('cn26-place-')) return entity;
  if (entity.startsWith('cn26-stay-')) return `stay:${entity.slice(-2)}`;
  if (entity.startsWith('cn26-ticket-')) return TICKETS.find((t) => `cn26-ticket-${t.key}` === entity)?.placeId;
  return undefined;
}

/** Every broken promise of the layer, as readable lines; [] when all hold. */
export function mapLayerProblems(bundle: TripBundle): string[] {
  const out: string[] = [];
  const entities: { id: string; e: { category?: PlaceCategory; pin?: Coord; coord?: Coord; kind?: string } }[] = [
    ...bundle.stops.flatMap((s) => (s.spots ?? []).map((sp) => ({ id: sp.id, e: sp }))),
    ...bundle.showCards.filter((c) => c.kind === 'place').map((c) => ({ id: c.id, e: c })),
    ...bundle.bookings.map((b) => ({ id: b.id, e: b })),
  ];
  for (const { id, e } of entities) {
    if (!e.category || !PLACE_CATEGORIES.includes(e.category)) out.push(`${id}: category "${String(e.category)}" is not one of the eight`);
    if (e.pin && e.coord) out.push(`${id}: carries both a coord and a pin — the pin is only for a place with no coord`);
    if (e.pin) {
      const key = pinKeyOf(bundle, id);
      const rec = key ? PINS[key] : undefined;
      if (!rec?.ok) out.push(`${id}: a pin pins.ts never confirmed`);
      else {
        const d = km(rec.anchor, e.pin);
        if (d > rec.nearKm) out.push(`${id}: its pin is ${d.toFixed(2)} km from its anchor, past ${rec.nearKm} km`);
        if (rec.lat !== e.pin.lat || rec.lng !== e.pin.lng) out.push(`${id}: its pin is not the one pins.ts confirmed`);
      }
    }
  }
  for (const b of bundle.bookings) if (b.kind === 'hotel' && b.coord) out.push(`${b.id}: a bed with a coord — a bed may carry a pin, never a dot`);
  out.push(...detailProblems(bundle));
  return out;
}

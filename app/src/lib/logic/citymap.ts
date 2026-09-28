/* THE CITY CLOSE-UP, AS DATA (mx-city, f-city) — one stop at city scale.

   Every pin is a coordinate the trip file stores: the stop's own centre, its
   spots, the driver cards and the bookings that carry one. Everything the
   city holds WITHOUT a coordinate — a park spot, a hotel whose address was
   never verified — goes in `noPin`, to be listed ("No pin yet"), never drawn
   at a guessed place. Run 3 draws it; this file only decides it.

   WHICH CITY A PLACE BELONGS TO
   · A spot belongs to the stop that carries it.
   · Anything WITH a coordinate belongs to the stop it is nearest to, within
     CITY_KM — the one rule that holds for an airport 29 km out of town and
     for a flight dated on the day you leave (its coordinate is where you
     board it, so it lands on the city you board it in).
   · Anything WITHOUT one belongs where the trip file puts it: a stay by its
     check-in date or its stop, an experience by its date, a driver card by
     the days that name it (DayPlan.placeIds — the explicit join).

   THE WAYS OUT. The legs in and out of the stop point at the previous and
   next stops, whose coordinates are real, so the arrow on the map's edge is
   a bearing and not a guess — Zhangjiajie West has no coordinate, and its
   train is drawn as an arrow towards Chongqing, which does. */
import type { Booking, Coord, DayDefault, DayPlan, ISODate, ShowCard, Stop } from '../model/types';
import { addDays, compareIso, fmtDowDay } from './dates';
import { haversineKm } from './geoStats';
import { mdliteToText } from './mdlite';
import { fitProjection, type Box, type Projection } from './projection';
import { legPath, shortName, type Constellation, type Leg, type Star } from './constellation';
import { splitBody } from './timeline';
import { realStops } from './day';
import { legLabel } from './metroline';
import type { Connector } from './connectors';
import { S } from '../i18n/strings';

/** How far from a stop's centre a place may be and still be "in" it. */
export const CITY_KM = 80;

export type CityKind = 'stop' | 'spot' | 'card' | 'booking';
export interface CityPlace {
  id: string;
  name: string;
  kind: CityKind;
  coord?: Coord;
}
export interface CityPin {
  x: number;
  y: number;
  /** Everything stored at this exact coordinate (a card and a ticket for
      the same cableway are one pin). */
  places: CityPlace[];
  /** Straight-line km from the stop's centre — never a travel time. */
  km: number;
}
export interface CityExit {
  role: 'in' | 'out';
  stopId: string;
  name: string;
  /** Degrees clockwise from north, from this stop to that one. */
  bearing: number;
  /** Where the arrow meets the edge of the box. */
  x: number;
  y: number;
}
export interface CityMap {
  pins: CityPin[];
  noPin: CityPlace[];
  exits: CityExit[];
  /** Screen pixels per kilometre. */
  kmPx: number;
  proj: Projection;
}

const ok = (c: Coord | undefined): c is Coord => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
const inStay = (s: Stop, d: string): boolean => compareIso(d, s.start) >= 0 && compareIso(d, s.end) < 0;

/** The stop a coordinate belongs to: the nearest, within CITY_KM. */
export function nearestStop(c: Coord, stops: Stop[]): Stop | null {
  let best: Stop | null = null;
  let bestKm = Infinity;
  for (const s of stops) {
    if (s.kind !== 'stop' || !ok(s.coord)) continue;
    const km = haversineKm(c, s.coord);
    if (km < bestKm) {
      best = s;
      bestKm = km;
    }
  }
  return bestKm <= CITY_KM ? best : null;
}

function bookingName(b: Booking): string {
  return b.kind === 'flight' ? `${b.from.name ?? b.from.code} · ${b.flightNo}` : mdliteToText(b.title);
}

/** Everything that belongs to `stop`, located or not. */
export function cityPlaces(
  stop: Stop,
  all: { stops: Stop[]; showCards: ShowCard[]; bookings: Booking[]; dayPlans?: DayPlan[]; dayDefaults?: DayDefault[] },
): CityPlace[] {
  const mine = (c: Coord | undefined): boolean => ok(c) && nearestStop(c, all.stops)?.id === stop.id;
  const out: CityPlace[] = [];
  if (ok(stop.coord)) out.push({ id: stop.id, name: shortName(stop.name), kind: 'stop', coord: stop.coord });
  for (const sp of stop.spots ?? []) {
    out.push({ id: sp.id, name: sp.name, kind: 'spot', ...(ok(sp.coord) ? { coord: sp.coord } : {}) });
  }
  /* the cards the stop's own days name — the explicit join */
  const named = new Set<string>();
  for (const d of all.dayPlans ?? []) if (inStay(stop, d.date)) for (const id of d.placeIds ?? []) named.add(id);
  for (const d of all.dayDefaults ?? []) if (d.stopId === stop.id) for (const id of d.placeIds ?? []) named.add(id);
  for (const c of all.showCards) {
    if (c.kind !== 'place' || c.pending) continue;
    const place: CityPlace = { id: c.id, name: c.native, kind: 'card' };
    if (ok(c.coord)) {
      if (mine(c.coord)) out.push({ ...place, coord: c.coord });
    } else if (named.has(c.id)) out.push(place);
  }
  for (const b of all.bookings) {
    if (b.status === 'cancelled' || b.alternative) continue;
    const place: CityPlace = { id: b.id, name: bookingName(b), kind: 'booking' };
    if (ok(b.coord)) {
      if (mine(b.coord)) out.push({ ...place, coord: b.coord });
      continue;
    }
    /* unlocated: a bed or a ticket is a place in the city; a move is a way out */
    const here =
      b.stopId === stop.id ||
      (b.kind === 'hotel' && inStay(stop, b.checkIn)) ||
      (b.kind === 'activity' && inStay(stop, b.date));
    if (here && (b.kind === 'hotel' || b.kind === 'activity')) out.push(place);
  }
  return out;
}

/** Bearing in degrees clockwise from north, from a to b. */
export function bearing(a: Coord, b: Coord): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return Math.round(((Math.atan2(y, x) / r + 360) % 360) * 10) / 10;
}

/**
 * Lay a city out: every located place projected (a few km at least, so a
 * city with one pin is not blown up to fill the phone), the rest listed, and
 * an arrow to the stop before and the stop after.
 */
export function buildCityMap(stop: Stop, places: CityPlace[], stops: Stop[], box: Box, minSpanKm = 6): CityMap | null {
  const located = places.filter((p) => ok(p.coord));
  const proj = fitProjection(
    located.map((p) => p.coord!),
    box,
    minSpanKm,
  );
  if (!proj) return null;
  const byKey = new Map<string, CityPin>();
  for (const p of located) {
    const key = `${p.coord!.lat.toFixed(4)},${p.coord!.lng.toFixed(4)}`;
    const pin = byKey.get(key);
    if (pin) pin.places.push(p);
    else
      byKey.set(key, {
        x: proj.x(p.coord!),
        y: proj.y(p.coord!),
        places: [p],
        km: ok(stop.coord) ? Math.round(haversineKm(stop.coord, p.coord!) * 10) / 10 : 0,
      });
  }
  const real = realStops(stops);
  const i = real.findIndex((s) => s.id === stop.id);
  const exits: CityExit[] = [];
  const cx = box.width / 2;
  const cy = box.height / 2;
  for (const [role, other] of [
    ['in', real[i - 1]],
    ['out', real[i + 1]],
  ] as const) {
    if (!other || !ok(other.coord) || !ok(stop.coord)) continue;
    const deg = bearing(stop.coord, other.coord);
    const rad = (deg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    /* from the centre of the box to its edge, along the bearing */
    const t = Math.min(
      dx ? (dx > 0 ? box.width - box.pad - cx : box.pad - cx) / dx : Infinity,
      dy ? (dy > 0 ? box.height - box.pad - cy : box.pad - cy) / dy : Infinity,
    );
    exits.push({
      role,
      stopId: other.id,
      name: shortName(other.name),
      bearing: deg,
      x: Math.round((cx + dx * t) * 10) / 10,
      y: Math.round((cy + dy * t) * 10) / 10,
    });
  }
  return { pins: [...byKey.values()], noPin: places.filter((p) => !ok(p.coord)), exits, kmPx: proj.kmPx, proj };
}

/* ---------- the stay's route ----------
   The days of the stop, in order, walked as hops between the pins the days
   themselves name (DayPlan.placeIds — the explicit join; nothing is matched
   out of prose). A day that names no located place adds no hop, so a park
   day whose spots carry no coordinate draws nothing rather than a guessed
   line. The way on is the last hop: from the last pin to the edge, along
   the bearing to the next stop. */

export type HopState = 'done' | 'today' | 'ahead';
export interface StayHop {
  /** the day the hop is walked — the day its end is first named */
  date: ISODate;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** the way on: this hop leaves the map towards the next stop */
  exit: boolean;
  state: HopState;
  /** the hop that Flows: today's, else the next one, while you are here */
  live: boolean;
  d: string;
  mid: { x: number; y: number };
  tip: { x: number; y: number; angle: number };
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

export function stayRoute(
  stop: Stop,
  map: CityMap,
  placesOn: (date: ISODate) => string[] | undefined,
  now: ISODate,
): StayHop[] {
  const pinOf = (id: string): CityPin | undefined => map.pins.find((p) => p.places.some((x) => x.id === id));
  const way: { pin: CityPin; date: ISODate }[] = [];
  for (let d = stop.start, i = 0; compareIso(d, stop.end) <= 0 && i < 400; d = addDays(d, 1), i++) {
    for (const id of placesOn(d) ?? []) {
      const pin = pinOf(id);
      if (pin && pin !== way[way.length - 1]?.pin) way.push({ pin, date: d });
    }
  }
  const legs: { date: ISODate; from: { x: number; y: number }; to: { x: number; y: number }; exit: boolean }[] = [];
  for (let i = 1; i < way.length; i++) {
    legs.push({ date: way[i]!.date, from: way[i - 1]!.pin, to: way[i]!.pin, exit: false });
  }
  const out = map.exits.find((e) => e.role === 'out');
  const start = way[way.length - 1]?.pin ?? map.pins.find((p) => p.places.some((x) => x.kind === 'stop'));
  if (out && start) legs.push({ date: stop.end, from: start, to: { x: out.x, y: out.y }, exit: true });

  const here = compareIso(now, stop.start) >= 0 && compareIso(now, stop.end) <= 0;
  const liveAt = here ? legs.findIndex((l) => compareIso(l.date, now) >= 0) : -1;
  return legs.map((l, i) => {
    const a = { x: l.from.x, y: l.from.y };
    const b = l.to;
    const cx = (a.x + b.x) / 2 - (b.y - a.y) * 0.18;
    const cy = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
    const c = compareIso(l.date, now);
    return {
      date: l.date,
      from: a,
      to: { x: b.x, y: b.y },
      exit: l.exit,
      state: c < 0 ? 'done' : c === 0 ? 'today' : 'ahead',
      live: i === liveAt,
      d: legPath(a, b),
      mid: { x: r1((a.x + 2 * cx + b.x) / 4), y: r1((a.y + 2 * cy + b.y) / 4) },
      tip: { x: b.x, y: b.y, angle: r1((Math.atan2(b.y - cy, b.x - cx) * 180) / Math.PI) },
    };
  });
}

/* ---------- the pins' words ---------- */

export interface PinText {
  /** the English name, short: "Wulingyuan", "Tianmen Mountain cableway" */
  title: string;
  /** the name a driver reads, when a card carries one */
  native?: string;
  /** the one booking the pin speaks for (see pinText) */
  booking?: Booking;
  /** its two short rows — when, then WHICH booking with its own status:
      "Mon 14 · 08:00\nticket pending", "Fri 11 · 18:15\nCA 8609 booked",
      "Fri 11 → Sun 13\nstay booked" */
  line?: string;
}

/** What a pin is called: a driver card's own words first (its Chinese and
    the first clause of its meaning), else a booking's title, else a spot's
    name, else the stop's.
    Several places can share a coordinate — Wulingyuan's park gate holds its
    driver card and the pending park pass — so the pin's booking line names
    the booking it is about and carries that booking's own status, never
    another's: a stay held here first, else the next one from `now`, else the
    last. (A bed never carries a coordinate in the trip file, so the Pullman
    is "No pin yet" and the gate's line is the park pass: "Sat 12 · ticket
    pending" — not a status the Pullman could be read as having.) Two short
    rows rather than one long one, so the label still fits beside its pin on
    a 384 px phone. */
export function pinText(pin: CityPin, cards: ShowCard[], bookings: Booking[], now: ISODate): PinText {
  /* Run 3c: where a pin holds more than one booking, the line names the one
     it speaks for by its own title ("Tianmen Mountain pending"), never the
     generic "ticket pending" that could be read as the other's status. */
  const cardId = pin.places.find((p) => p.kind === 'card')?.id;
  const card = cardId ? cards.find((c) => c.id === cardId) : undefined;
  const held = pin.places
    .map((p) => (p.kind === 'booking' ? bookings.find((b) => b.id === p.id) : undefined))
    .filter((b): b is Booking => !!b)
    .sort((a, b) => compareIso(a.date, b.date));
  const booking =
    held.find((b) => b.kind === 'hotel') ?? held.find((b) => compareIso(b.kind === 'hotel' ? b.checkOut : b.date, now) >= 0) ?? held[held.length - 1];
  const clip = (s: string): string => {
    const t = (splitBody(mdliteToText(s)).title.split(', ')[0] ?? '').trim();
    /* an airport goes by its code on the map, as the boards write it —
       "DYG airport"; its Chinese under it is still the whole name */
    const code = /Airport\b.*\(([A-Z]{3})\)/.exec(t)?.[1];
    return code ? `${code} airport` : t;
  };
  const first = pin.places.find((p) => p.kind === 'spot') ?? pin.places[0];
  const out: PinText = card ? { title: clip(card.meaning), native: card.native } : { title: clip(first?.name ?? '') };
  if (booking) {
    const b = booking;
    const time = b.kind === 'activity' ? b.time : b.kind === 'hotel' ? undefined : b.dep;
    /* a flight by its number, a train by its number or its label, a road leg
       by its label, and — where the pin holds more than one booking — a stay
       or a ticket by the first words of its own title (metroline legLabel);
       a lone stay or ticket by its kind */
    const kind = held.length === 1 && !(b.kind === 'train' && b.trainNo) ? S.city.pinKind[b.kind] : undefined;
    out.booking = b;
    out.line = `${b.kind === 'hotel' ? `${fmtDowDay(b.checkIn)} → ${fmtDowDay(b.checkOut)}` : fmtDowDay(b.date)}${time ? ` · ${time}` : ''}\n${kind ?? legLabel(b).split(', ')[0]} ${S.chip[b.status].toLowerCase()}`;
  }
  return out;
}

/** The room a pin's words take, in map px — the city is laid out in its own
    pixels, so these are the phone's: the title in caps (~9.2 px a letter)
    wrapping at 150 px, the Chinese (~13.5 px a character), and each row of
    the booking's line (~5.2 px a letter and 1.6 more for a digit, measured
    in the app's face), wrapping where a row is wider than the label. */
export function labelSize(t: PinText): { w: number; h: number } {
  const rows = (t.line ?? '').split('\n').filter(Boolean).map((r) => r.length * 5.2 + (r.match(/\d/g)?.length ?? 0) * 1.6);
  const w = Math.min(150, Math.max(t.title.length * 9.2, (t.native?.length ?? 0) * 13.5, ...rows, 40)) + 4;
  return { w, h: Math.ceil((t.title.length * 9.2) / 150) * 16 + (t.native ? 17 : 0) + rows.reduce((n, r) => n + Math.ceil(r / (w - 4)), 0) * 16 };
}

/* ---------- where the words go ---------- */

export interface CityLabel {
  /** index into the pins */
  pin: number;
  /** top-left corner, map px */
  x: number;
  y: number;
  w: number;
  h: number;
  /** the side of the pin it sits on — text aligns towards the pin */
  side: 'right' | 'left' | 'below' | 'above';
}

/** Place each pin's label beside, under or over it — never over another
    label, a pin, or an exit, never outside the box; a label that cannot be
    placed is left off (the sheet names every place). `sizes` are the
    labels' boxes in map px, one per pin; a pin with no size gets none. */
export function layoutCity(
  pins: { x: number; y: number }[],
  sizes: ({ w: number; h: number } | null)[],
  box: { width: number; height: number },
  keepOut: { l: number; t: number; r: number; b: number }[] = [],
): CityLabel[] {
  const M = 4;
  const taken = [...keepOut, ...pins.map((p) => ({ l: p.x - 7, t: p.y - 7, r: p.x + 7, b: p.y + 7 }))];
  const hit = (a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }): boolean =>
    a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const out: CityLabel[] = [];
  pins.forEach((p, i) => {
    const s = sizes[i];
    if (!s) return;
    /* beside it, under it, over it; then beside it raised; then over or
       under it to one side — the corners two close pins leave each other */
    const tries: [CityLabel['side'], number, number][] = [
      ['right', p.x + 12, p.y - 9],
      ['left', p.x - 12 - s.w, p.y - 9],
      ['below', p.x - s.w / 2, p.y + 12],
      ['above', p.x - s.w / 2, p.y - 12 - s.h],
      ['right', p.x + 12, p.y - s.h + 9],
      ['left', p.x - 12 - s.w, p.y - s.h + 9],
      ['right', p.x - 10, p.y - 12 - s.h],
      ['left', p.x + 10 - s.w, p.y - 12 - s.h],
      ['right', p.x - 10, p.y + 12],
      ['left', p.x + 10 - s.w, p.y + 12],
    ];
    for (const [side, x, y] of tries) {
      const r = { l: x, t: y, r: x + s.w, b: y + s.h };
      if (r.l < M || r.t < M || r.r > box.width - M || r.b > box.height - M) continue;
      /* the label starts 12 px from its own pin, which is 7 px wide: it can
         only ever collide with something else */
      if (taken.some((q) => hit(q, r))) continue;
      taken.push(r);
      out.push({ pin: i, x: r1(x), y: r1(y), w: s.w, h: s.h, side });
      return;
    }
  });
  return out;
}

/* ---------- the map's own furniture ---------- */

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** The way on, in words: its legs' own titles with "then" between them —
    "HSR · Zhangjiajie West → Chongqing" — or, with nothing booked, "to"
    the next stop. */
export function wayOnLine(out: Pick<Connector, 'legs' | 'toStopId'>, stops: Stop[]): string {
  if (out.legs.length) return out.legs.map((b) => mdliteToText(b.title)).join(` ${S.journey.then} `);
  const next = out.toStopId ? stops.find((s) => s.id === out.toStopId) : undefined;
  return next ? S.city.to(shortName(next.name)) : '';
}

/** WHAT A PIN'S LABEL MUST KEEP CLEAR OF (Run 3c: one copy, for the screen
    and its test): the note and the compass up top, the scale bar and its km
    at the foot — and the way-on note, which sits inward from the edge the
    way on leaves by, its words taking ~6.4 px a character and wrapping at
    190 px under its date and chip. `note` says where that note goes. */
export function cityKeepOut(
  box: { width: number; height: number },
  barPx: number | null,
  exit: { x: number; y: number } | null,
  line: string,
): { rects: Rect[]; note: { right: boolean; top: number; rect: Rect } | null } {
  const rects: Rect[] = [
    { l: 40, t: 4, r: 250, b: 24 },
    { l: 14, t: box.height - 38, r: 68 + (barPx ?? 0), b: box.height },
  ];
  if (!exit) return { rects, note: null };
  const right = exit.x > box.width / 2;
  const top = Math.min(Math.max(exit.y + (exit.y > box.height / 2 ? -58 : 10), 6), box.height - 64);
  const w = Math.min(190, Math.max(128, line.length * 6.4));
  const h = 27 + 16 * Math.ceil((line.length * 6.4) / 190);
  const rect = right ? { l: exit.x - 8 - w, t: top, r: exit.x - 8, b: top + h } : { l: exit.x + 8, t: top, r: exit.x + 8 + w, b: top + h };
  rects.push(rect);
  return { rects, note: { right, top, rect } };
}

/** A scale bar a thumb can read: a round number of kilometres, 40–100 px. */
export function scaleBar(kmPx: number): { km: number; px: number } | null {
  if (!(kmPx > 0)) return null;
  for (const km of [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) {
    const px = km * kmPx;
    if (px >= 40 && px <= 100) return { km, px: r1(px) };
  }
  return null;
}

/* ---------- the city, drawn by the trip's own map ----------
   A city at real positions is the same picture as the trip — places as
   stars, the stay's hops as legs, Flow on the live one, a Comet to fly them
   — so it is handed to lib/map/TripMap as a constellation. A pin a hop
   behind you touches is a place you have been; one today's hop touches is
   today's (the opal ring); the rest are ahead. The way on keeps its arrow. */
/** `wayOnHeld`: the move out is booked — else the way on is drawn amber. */
export function cityConstellation(map: CityMap, hops: StayHop[], box: { width: number; height: number }, wayOnHeld = true): Constellation {
  const at = (p: { x: number; y: number }, q: { x: number; y: number }): boolean => p.x === q.x && p.y === q.y;
  const stars: Star[] = map.pins.map((p, i) => {
    const touch = hops.filter((h) => at(h.from, p) || (!h.exit && at(h.to, p)));
    const today = touch.some((h) => h.state === 'today');
    const done = !today && touch.some((h) => h.state === 'done');
    const name = p.places[0]?.name ?? '';
    return { id: `pin-${i}`, name, short: name, x: p.x, y: p.y, state: done ? 'done' : today ? 'here' : 'ahead', you: false, tonight: today };
  });
  const starAt = (q: { x: number; y: number }): Star =>
    stars.find((s) => at(s, q)) ?? { id: 'exit', name: '', short: '', x: q.x, y: q.y, state: 'ahead', you: false, tonight: false };
  const legs: Leg[] = hops.map((h) => ({
    from: starAt(h.from),
    to: starAt(h.to),
    state: h.state,
    live: h.live,
    notBooked: h.exit && !wayOnHeld,
    d: h.d,
    mid: h.mid,
    tip: h.tip,
    len: Math.hypot(h.to.x - h.from.x, h.to.y - h.from.y),
    ...(h.exit ? { arrow: true } : {}),
  }));
  return { width: box.width, height: box.height, stars, legs, here: stars.find((s) => s.tonight) ?? null, you: null, labels: [], unplaced: [], proj: map.proj };
}

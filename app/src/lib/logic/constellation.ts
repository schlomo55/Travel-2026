/* THE CONSTELLATION — a trip's stops as stars, placed from their REAL stored
   latitude and longitude (logic/projection.ts), north up, fitted into a box.
   Now draws it large (f-now); the Trips shelf draws it small (f-trips).

   Nothing is guessed. A stop with no stored coordinate is not placed — it is
   returned in `unplaced`, so a screen can list it rather than invent a
   position. With fewer than two placed stops there is no constellation at
   all, and the screen draws something else.

   WHAT THE DAY MAKES OF IT
   · Stars: done (left behind), here (tonight's stop) and ahead.
   · Legs: done (the road so far — Ink paints it), today (the move that
     ends at tonight's stop), ahead (dotted lilac); a leg ahead with nothing
     held for it is flagged `notBooked` when the caller passes that in.
   · YOU: on a travel day, until the day's line says you have arrived, you
     are at the START of today's leg (f-now: "CHONGLI · YOU", "ZHANGJIAJIE /
     TONIGHT"); otherwise at tonight's stop.
   · The LIVE leg — the one that Flows — is the first leg still ahead of you
     that leaves where you are: today's leg on a travel day, the next move on
     any other day (ROUND4: "the leg you are on or the next segment").

   LABELS, AND THE YUNNAN-CLUSTER RULE. Every star may carry its short name
   (the part before " — "). Stars closer together than a label can separate
   — Lijiang, the gorge and Dali on this trip — share ONE label that names
   them in trip order, placed under or over the group — and inside a group a
   name of three words or more keeps its last word ("LIJIANG · GORGE · DALI",
   the board's own label). The star you are at and tonight's star are never
   folded into a group. Labels are placed greedily — you, tonight, then the
   trip in order — beside, under or over their stars, never over another
   label or star and never outside the box; one that cannot be placed is left
   off rather than drawn on top of something (the map is a picture; the
   names are all in the lists beside it). */
import type { ISODate, Stop } from '../model/types';
import { compareIso } from './dates';
import { mdliteToText } from './mdlite';
import { fitProjection, type Box, type Projection } from './projection';
import { realStops } from './day';
import { S } from '../i18n/strings';

export type StarState = 'done' | 'here' | 'ahead';
export type LegState = 'done' | 'today' | 'ahead';

export interface Star {
  id: string;
  name: string;
  /** The label's own words: the stop name up to " — ". */
  short: string;
  x: number;
  y: number;
  state: StarState;
  /** You are here (the ping). */
  you: boolean;
  /** Tonight's stop. */
  tonight: boolean;
}
export interface Leg {
  from: Star;
  to: Star;
  state: LegState;
  /** The leg that Flows. */
  live: boolean;
  /** Ahead, and nothing is held for it (from the caller's coverage). */
  notBooked: boolean;
  /** The gentle arc between the two stars. */
  d: string;
  /** The arc's midpoint — where a chip about the leg sits. */
  mid: { x: number; y: number };
  /** Where it ends and which way it points there (Flow's calm arrowhead). */
  tip: { x: number; y: number; angle: number };
  /** Its length in px, for pacing Ink along the road so far. */
  len: number;
  /** Draw its arrowhead even standing still — the way on, off a city map. */
  arrow?: boolean;
}
export interface MapLabel {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  lines: string[];
  tone: 'you' | 'tonight' | 'plain';
}
export interface Constellation {
  width: number;
  height: number;
  stars: Star[];
  legs: Leg[];
  /** Tonight's stop, when the trip is under way. */
  here: Star | null;
  you: Star | null;
  labels: MapLabel[];
  /** Stops with no stored coordinate — listed, never placed. */
  unplaced: string[];
  proj: Projection;
}

export interface ConstellationOpts {
  /** The day's line says the travel is over: you are at tonight's stop. */
  arrived?: boolean;
  /** Every stop labelled (Now), the first/you/tonight/last (the shelf), or none. */
  labels?: 'all' | 'key' | 'none';
  /** Legs with nothing held, keyed `${fromStopId}>${toStopId}`. */
  unbooked?: Set<string>;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** "Kunyu Academy — Yantai" → "Kunyu Academy". */
export function shortName(name: string): string {
  const t = mdliteToText(name).trim();
  return t.split(/\s+[—–]\s+/)[0]?.trim() || t;
}

/** A gentle arc between two stars (the boards' quadratic legs): the control
    point sits off the midpoint, perpendicular, by a fraction of the length. */
export function legPath(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18): string {
  const c = control(a, b, bend);
  return `M${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
}
function control(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18): { x: number; y: number } {
  return { x: r1((a.x + b.x) / 2 - (b.y - a.y) * bend), y: r1((a.y + b.y) / 2 + (b.x - a.x) * bend) };
}

export function buildConstellation(
  stops: Stop[],
  now: ISODate,
  box: Box,
  opts: ConstellationOpts = {},
): Constellation | null {
  const real = realStops(stops);
  const placed = real.filter((s) => s.coord && Number.isFinite(s.coord.lat) && Number.isFinite(s.coord.lng));
  const unplaced = real.filter((s) => !placed.includes(s)).map((s) => mdliteToText(s.name));
  if (placed.length < 2) return null;
  const proj = fitProjection(
    placed.map((s) => s.coord!),
    box,
  );
  if (!proj) return null;

  const stateOf = (s: Stop): StarState =>
    compareIso(s.end, now) <= 0 ? 'done' : compareIso(s.start, now) <= 0 ? 'here' : 'ahead';
  const stars: Star[] = placed.map((s) => ({
    id: s.id,
    name: mdliteToText(s.name),
    short: shortName(s.name),
    x: proj.x(s.coord!),
    y: proj.y(s.coord!),
    state: stateOf(s),
    you: false,
    tonight: false,
  }));
  const here = stars.find((s) => s.state === 'here') ?? null;
  if (here) here.tonight = true;

  /* A leg is walked on the day its destination begins: before that day it
     is ahead, on it it is today's leg — done once the day's line says you
     have arrived — and after it the road so far. */
  const legs: Leg[] = [];
  let todayLeg: Leg | null = null;
  /* A leg that SKIPS a stop with no coordinate (the stop is between its two
     stars in trip order, but unplaced) is drawn, and is never where YOU
     stand: on its day you are at the stop that could not be placed. China
     2026 from 2026-10-17: Shanghai (Dec 9–11) has no verified coordinate, so
     Dec 11's leg runs Beijing → Zhangjiajie on the board — and BEIJING · YOU
     on Dec 11 would be a lie. */
  let todayGap = false;
  for (let i = 0; i + 1 < placed.length; i++) {
    const to = placed[i + 1]!;
    const gap = real.indexOf(to) - real.indexOf(placed[i]!) > 1;
    const a = stars[i]!;
    const b = stars[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const c = compareIso(to.start, now);
    const state: LegState = c < 0 || (c === 0 && opts.arrived) ? 'done' : c === 0 ? 'today' : 'ahead';
    if (len < 1) continue; // two stops at one coordinate: nothing to draw
    const k = control(a, b);
    const leg: Leg = {
      from: a,
      to: b,
      state,
      live: false,
      notBooked: state === 'ahead' && !!opts.unbooked?.has(`${placed[i]!.id}>${to.id}`),
      d: legPath(a, b),
      mid: { x: r1((a.x + 2 * k.x + b.x) / 4), y: r1((a.y + 2 * k.y + b.y) / 4) },
      tip: { x: b.x, y: b.y, angle: r1((Math.atan2(b.y - k.y, b.x - k.x) * 180) / Math.PI) },
      len: r1(len),
    };
    if (c === 0) {
      if (gap) todayGap = true;
      else todayLeg = leg;
    }
    legs.push(leg);
  }

  const you = todayLeg && !opts.arrived ? todayLeg.from : todayGap && !opts.arrived ? null : here;
  if (you) you.you = true;
  const live = you ? legs.find((l) => l.from === you && l.state !== 'done') : undefined;
  if (live) live.live = true;

  const c: Constellation = { width: box.width, height: box.height, stars, legs, here, you, labels: [], unplaced, proj };
  if (opts.labels !== 'none') c.labels = placeLabels(stars, box, opts.labels ?? 'all');
  return c;
}

/* ---------- labels ---------- */

/** 11 px Figtree 600, uppercase, 0.12em tracking: about 8.4 px a character. */
export const CHAR_PX = 8.4;
const LINE_PX = 15;
/** Stars closer than this share one label. */
export const CLUSTER_PX = 26;
const MARGIN = 6;

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
const hits = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const textW = (s: string): number => s.length * CHAR_PX;

/** The label candidates for a group of stars, best first. */
function spots(group: Star[], w: number, h: number, box: Box): MapLabel[] {
  const xs = group.map((s) => s.x);
  const ys = group.map((s) => s.y);
  const l = Math.min(...xs);
  const r = Math.max(...xs);
  const t = Math.min(...ys);
  const b = Math.max(...ys);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  /* a centred label slides sideways to stay inside the box */
  const mid = (x: number): number => Math.min(Math.max(x, MARGIN + w / 2), box.width - MARGIN - w / 2);
  const one = (x: number, y: number, anchor: MapLabel['anchor']): MapLabel => ({
    x: r1(x),
    y: r1(y),
    anchor,
    lines: [],
    tone: 'plain',
  });
  const below = one(mid(cx), b + 18, 'middle');
  const above = one(mid(cx), t - 10 - (h - LINE_PX), 'middle');
  const right = one(r + 12, cy + 4, 'start');
  const left = one(l - 12, cy + 4, 'end');
  /* a group reads best under itself; a single star beside itself */
  return group.length > 1 ? [below, above, right, left] : [right, left, below, above];
}

function rectOf(lb: MapLabel, w: number, h: number): Rect {
  const l = lb.anchor === 'start' ? lb.x : lb.anchor === 'end' ? lb.x - w : lb.x - w / 2;
  return { l, t: lb.y - 11, r: l + w, b: lb.y - 11 + h };
}

export function placeLabels(stars: Star[], box: Box, mode: 'all' | 'key'): MapLabel[] {
  if (!stars.length) return [];
  const first = stars[0]!;
  const last = stars[stars.length - 1]!;
  const wanted = mode === 'all' ? stars : stars.filter((s) => s === first || s === last || s.you || s.tonight);
  const special = wanted.filter((s) => s.you || s.tonight);

  /* The plain stars, grouped where they are too close to part. A plain star
     that sits on a special one with the SAME name (Tel Aviv at both ends of
     a trip) is already named by it. */
  const plain = wanted.filter(
    (s) => !s.you && !s.tonight && !special.some((p) => p.short === s.short && Math.hypot(p.x - s.x, p.y - s.y) < CLUSTER_PX),
  );
  const groups: Star[][] = [];
  for (const s of plain) {
    const near = groups.filter((g) => g.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < CLUSTER_PX));
    const merged = [s, ...near.flat()];
    for (const g of near) groups.splice(groups.indexOf(g), 1);
    groups.push(merged.sort((a, b) => stars.indexOf(a) - stars.indexOf(b)));
  }
  groups.sort((a, b) => stars.indexOf(a[0]!) - stars.indexOf(b[0]!));

  const placed: Rect[] = [];
  const out: MapLabel[] = [];
  const starRects: Rect[] = stars.map((s) => ({ l: s.x - 6, t: s.y - 6, r: s.x + 6, b: s.y + 6 }));
  /* never under a header drawn over the map's top margin */
  const top = Math.max(0, (box.padTop ?? 0) - 16);
  const inside = (r: Rect): boolean =>
    r.l >= MARGIN - 0.5 && r.r <= box.width - MARGIN + 0.5 && r.t >= top && r.b <= box.height;

  const tryPlace = (group: Star[], lines: string[], tone: MapLabel['tone'], force: boolean, only?: number): boolean => {
    const w = Math.max(...lines.map(textW));
    const h = lines.length * LINE_PX;
    const own = new Set(group.map((s) => s.id));
    const all = spots(group, w, h, box);
    const cands = only === undefined ? all : all.slice(only, only + 1);
    const fits = (lb: MapLabel): boolean => {
      const r = rectOf(lb, w, h);
      return (
        inside(r) &&
        !placed.some((p) => hits(p, r)) &&
        !stars.some((s, i) => !own.has(s.id) && hits(starRects[i]!, r))
      );
    };
    const pick = cands.find(fits) ?? (force ? cands.find((lb) => inside(rectOf(lb, w, h))) : undefined);
    if (!pick) return false;
    placed.push(rectOf(pick, w, h));
    out.push({ ...pick, lines, tone });
    return true;
  };

  /* you first, then tonight — they always get their words. Two stars too
     close to name apart (Lijiang → the gorge on Dec 18: a few px at trip
     scale) share ONE label rather than print over each other:
     LIJIANG · YOU / GORGE · TONIGHT (a long name keeps its last word). */
  const you = special.find((s) => s.you);
  const tonight = special.find((s) => s.tonight && !s.you);
  const short = (s: Star): string => {
    const n = s.short.toUpperCase().split(/\s+/);
    return n.length > 2 ? n[n.length - 1]! : n.join(' ');
  };
  const youLines = you ? [`${you.short.toUpperCase()} · ${S.map.you}`] : [];
  const tonightLines = tonight ? [tonight.short.toUpperCase(), S.map.tonight] : [];
  const youPlaced = !!you && tryPlace([you], youLines, 'you', true);
  if (tonight) {
    const close = !!you && youPlaced && Math.hypot(you.x - tonight.x, you.y - tonight.y) < 2 * CLUSTER_PX;
    /* Two stars far enough apart to be named apart, where TONIGHT does not
       fit beside YOU's first spot: try YOU's other spots before forcing a
       label over another (the shelf, Kunyu → Beijing on Dec 5, once a stop
       without a coordinate changed the trip's scale — 2026-10-17). The
       first pair that both fit cleanly wins; none, and nothing changes. */
    let clean = !close && tryPlace([tonight], tonightLines, 'tonight', false);
    if (!close && !clean && you && youPlaced) {
      const firstRect = placed.pop()!;
      const firstLabel = out.pop()!;
      for (let i = 0; i < 4 && !clean; i++) {
        if (!tryPlace([you], youLines, 'you', false, i)) continue;
        clean = tryPlace([tonight], tonightLines, 'tonight', false);
        if (!clean) {
          placed.pop();
          out.pop();
        }
      }
      if (!clean) {
        placed.push(firstRect);
        out.push(firstLabel);
      }
    }
    if (!clean && !tryPlace([tonight], tonightLines, 'tonight', !close) && close) {
      placed.pop();
      out.pop();
      tryPlace([you!, tonight], [`${short(you!)} · ${S.map.you}`, `${short(tonight)} · ${S.map.tonight}`], 'you', true);
    }
  }
  for (const g of groups) {
    /* in a group, a long name keeps its last word — "Tiger Leaping Gorge"
       reads as GORGE beside LIJIANG and DALI (the board's own label) */
    const names = [...new Set(g.map((s) => s.short.toUpperCase()))].map((n) =>
      g.length > 1 && n.split(/\s+/).length > 2 ? n.split(/\s+/).pop()! : n,
    );
    const line = names.join(' · ');
    if (!tryPlace(g, [line], 'plain', false) && g.length > 1) {
      /* a group that cannot be named together is named one by one */
      for (const s of g) tryPlace([s], [s.short.toUpperCase()], 'plain', false);
    }
  }
  return out;
}

/** How far (map px) a chip may sit from its leg's midpoint and still read as
    that leg's. */
export const CHIP_REACH = 60;

/** WHERE TODAY'S LEG CHIP GOES (Now): beside the leg's midpoint — right of it
    as the board draws it, else the nearest place that covers no name and no
    star (left, slid up or down, below, above), within CHIP_REACH, between
    `top` (the header drawn over the map) and `bottom` (the legend and the
    sheet's lip). Null when there is none: a chip laid over a name hides the
    name, and the sentence and the NEXT tile already say it. `w` and `h` are
    the chip's size in map pixels; the answer is its top-left corner. */
export function chipSpot(
  c: Constellation,
  leg: Leg,
  w: number,
  h: number,
  top: number,
  bottom: number,
): { x: number; y: number } | null {
  const taken: Rect[] = [
    ...c.labels.map((lb) => rectOf(lb, Math.max(...lb.lines.map(textW)), lb.lines.length * LINE_PX)),
    ...c.stars.map((s) => ({ l: s.x - 8, t: s.y - 8, r: s.x + 8, b: s.y + 8 })),
  ];
  const { x, y } = leg.mid;
  const tries: Rect[] = [];
  const at = (l: number, t: number): void => {
    const cl = Math.min(Math.max(l, MARGIN), c.width - MARGIN - w);
    tries.push({ l: cl, t, r: cl + w, b: t + h });
  };
  for (const dy of [0, -26, 26, -52, 52]) {
    at(x + 10, y - h / 2 + dy);
    at(x - 10 - w, y - h / 2 + dy);
  }
  for (const dx of [0, -w / 3, w / 3]) {
    at(x - w / 2 + dx, y + 12);
    at(x - w / 2 + dx, y - 12 - h);
  }
  /* nearest first; at a tie the order above (right, left, below, above) wins */
  const gap = (r: Rect): number => Math.hypot(Math.max(r.l - x, 0, x - r.r), Math.max(r.t - y, 0, y - r.b));
  const free = tries
    .map((r, i) => ({ r, i, d: gap(r) }))
    .filter(({ r, d }) => d <= CHIP_REACH && r.t >= top && r.b <= c.height - bottom && !taken.some((q) => hits(q, r)))
    .sort((a, b) => a.d - b.d || a.i - b.i)[0];
  return free ? { x: r1(free.r.l), y: r1(free.r.t) } : null;
}

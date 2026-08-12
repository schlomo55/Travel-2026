/* A schematic route map: a vertical time spine where distance is days, so a
   long stay reads as a long bar. Deterministic and collision-free by
   construction — stops are ordered by date, so labels never overlap. */
import type { Booking, ComplianceCounter, ISODate, Stop, Trip } from '../model/types';
import { compareIso, daysBetween, fmtShort } from './dates';

export type LegMode = 'air' | 'rail' | 'ground';

export interface MapStation {
  id: string;
  name: string;
  emoji?: string;
  hue: number;
  y: number;
  /** Label baseline — nudged down when consecutive stops sit too close to read. */
  labelY: number;
  barTop: number;
  barBottom: number;
  nights?: number;
  dateLabel: string;
  isCurrent: boolean;
}
export interface MapLeg {
  id: string;
  mode: LegMode;
  fromY: number;
  toY: number;
  label?: string;
}
export interface MapTick {
  y: number;
  label: string;
  major: boolean;
}
export interface MapWall {
  y: number;
  /** Where the tick is drawn — the real date, never nudged. */
  label: string;
  /** Where the LABEL is drawn: pushed clear of the stop labels around it.
      The visa wall used to be drawn with no collision pass at all, so it
      printed on top of "Kunming — exit safety night" — the one line on the
      map that names why the wall is there. */
  labelY: number;
}
export interface RouteMapModel {
  width: number;
  height: number;
  spineX: number;
  stations: MapStation[];
  legs: MapLeg[];
  ticks: MapTick[];
  walls: MapWall[];
  nowY: number | null;
  startY: number;
  endY: number;
}

const TOP = 26;
const BOTTOM_PAD = 26;
/** Leaves room for the date rail to the left of the spine. */
const SPINE_X = 58;
const WIDTH = 380;
/** A name plus its date line needs this much vertical room to stay readable.
    27 was not enough and the arithmetic says so: RouteMap.svelte draws the
    name at labelY − 1 (13 px) and the date sub at labelY + 12 (9.5 px), so at
    a 27 px gap the next name's baseline landed 14 px below the previous date —
    tighter than single leading, and the Dec 14–21 cluster (Chongqing,
    Lijiang, Tiger Leaping, Dali, Kunming) overprinted into one grey stack. */
const MIN_LABEL_GAP = 36;

/** Days are the y axis; the scale adapts so a long trip stays scrollable but sane. */
export function pxPerDay(days: number): number {
  if (days <= 10) return 34;
  if (days <= 21) return 24;
  if (days <= 45) return 17;
  return Math.max(8, Math.round(760 / days));
}

function modeFor(stop: Stop, next: Stop, bookings: Booking[]): LegMode {
  /* A booking dated on the handover day tells us how the leg was travelled. */
  const onDay = bookings.filter((b) => compareIso(b.date, next.start) === 0 && b.status !== 'cancelled');
  const linked = bookings.filter((b) => b.stopId === next.id && b.status !== 'cancelled');
  const pool = [...onDay, ...linked];
  if (pool.some((b) => b.kind === 'flight')) return 'air';
  if (pool.some((b) => b.kind === 'train')) return 'rail';
  /* A transit stop between two stops usually means a flight day. */
  void stop;
  return 'ground';
}

export function buildRouteMap(
  trip: Pick<Trip, 'start' | 'end'>,
  stops: Stop[],
  bookings: Booking[],
  counters: ComplianceCounter[],
  now: ISODate | null,
): RouteMapModel {
  const totalDays = Math.max(1, daysBetween(trip.start, trip.end));
  const scale = pxPerDay(totalDays);
  const yOf = (d: ISODate): number => TOP + daysBetween(trip.start, d) * scale;

  const ordered = [...stops]
    .filter((s) => s.kind === 'stop')
    .sort((a, b) => compareIso(a.start, b.start) || a.order - b.order);

  /* Short consecutive stops (one-night stands at the end of a trip) would draw
     their labels on top of each other — push each one below the previous. */
  let lastLabelY = -Infinity;
  const stations: MapStation[] = ordered.map((s) => {
    const y = yOf(s.start);
    const labelY = Math.max(y, lastLabelY + MIN_LABEL_GAP);
    lastLabelY = labelY;
    return {
      id: s.id,
      name: s.name,
      ...(s.emoji ? { emoji: s.emoji } : {}),
      hue: s.hue,
      y,
      labelY,
      barTop: y,
      barBottom: Math.max(y + 6, yOf(s.end)),
      ...(s.nights ? { nights: s.nights } : {}),
      dateLabel: fmtShort(s.start),
      isCurrent: !!now && compareIso(now, s.start) >= 0 && compareIso(now, s.end) < 0,
    };
  });

  const legs: MapLeg[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (!a || !b) continue;
    legs.push({
      id: `${a.id}->${b.id}`,
      mode: modeFor(a, b, bookings),
      fromY: yOf(a.end),
      toY: yOf(b.start),
    });
  }

  /* Date rail: a label per week, so a 37-day trip gets six of them. */
  const ticks: MapTick[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const date = addDaysLocal(trip.start, d);
    const major = d === 0 || d === totalDays || d % 7 === 0;
    if (!major && scale < 20) continue;
    ticks.push({ y: TOP + d * scale, label: major ? fmtShort(date) : '', major });
  }

  /* THE WALL GOES THROUGH THE SAME PASS AS THE STOPS. Its tick stays on the
     real date — a deadline that moved to make room would be a lie — but its
     LABEL is pushed below whichever stop label it would have printed over. */
  const taken = stations.map((s) => s.labelY).sort((a, b) => a - b);
  const clearOf = (y: number): number => {
    let out = y;
    for (const t of taken) {
      if (Math.abs(out - t) < MIN_LABEL_GAP) out = t + MIN_LABEL_GAP;
    }
    return out;
  };
  const walls: MapWall[] = counters
    .filter((c) => c.hardDeadline)
    .map((c) => {
      const y = yOf(c.hardDeadline as ISODate);
      return { y, labelY: clearOf(y), label: `${c.icon ?? '🛂'} ${c.name} deadline` };
    })
    .filter((w) => w.y >= TOP && w.y <= TOP + totalDays * scale)
    /* Two counters on the same week must not stack either. */
    .sort((a, b) => a.labelY - b.labelY)
    .map((w, i, all) => {
      const prev = all[i - 1];
      return prev && w.labelY - prev.labelY < MIN_LABEL_GAP
        ? { ...w, labelY: prev.labelY + MIN_LABEL_GAP }
        : w;
    });

  const nowY = now && compareIso(now, trip.start) >= 0 && compareIso(now, trip.end) <= 0 ? yOf(now) : null;

  const lastLabel = Math.max(
    stations.length ? (stations[stations.length - 1]?.labelY ?? 0) : 0,
    ...walls.map((w) => w.labelY),
    0,
  );
  return {
    width: WIDTH,
    height: Math.max(TOP + totalDays * scale, lastLabel + 14) + BOTTOM_PAD,
    spineX: SPINE_X,
    stations,
    legs,
    ticks,
    walls,
    nowY,
    startY: TOP,
    endY: TOP + totalDays * scale,
  };
}

function addDaysLocal(start: ISODate, n: number): ISODate {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const d = Number(start.slice(8, 10));
  const dt = new Date(y, m - 1, d + n, 12);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

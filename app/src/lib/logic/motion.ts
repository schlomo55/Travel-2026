/* THE MOTION STATE — which of Horizon's motions may run, decided once.

   Horizon's motion rules (system/README.md § Motion): every route motion has
   one job (Flow = live, Comet = moving through time, Ink = done, Relay =
   check); besides routes only the you-are-here pulse, the sun's glow and the
   opal edge may breathe; and all of it pauses while the app is hidden.

   Three switches decide what actually moves, and they are not the same
   switch:

   · CALM MOTION (a setting) and the phone's reduce-motion jump EVERY motion
     to its end state — routes, pulses, entrances. The phone's own switch is
     honoured in CSS (@media prefers-reduced-motion), so it needs no class.
   · ROUTE ANIMATIONS (a setting, default ON) stops the route motions only:
     the lines stand still at their end states (Flow = a solid line with an
     arrow), and the ambient pulses carry on.
   · HIDDEN (the app is not on screen) pauses everything, and resumes where
     it left off.

   The screens read the classes on <html> (app.css); this module only decides
   which classes those are, so the decision is testable without a DOM. */

export interface MotionInput {
  /** Settings.calmMotion — undefined means off. */
  calmMotion?: boolean;
  /** Settings.routeAnimations — undefined means ON. */
  routeAnimations?: boolean;
  /** document.hidden */
  hidden?: boolean;
}

export type MotionClass = 'calm' | 'no-routes' | 'app-hidden';

export function motionClasses(m: MotionInput): MotionClass[] {
  const out: MotionClass[] = [];
  if (m.calmMotion === true) out.push('calm');
  if (m.calmMotion === true || m.routeAnimations === false) out.push('no-routes');
  if (m.hidden === true) out.push('app-hidden');
  return out;
}

/** Route animations as the Settings row shows them: on, off, or on-but-held
    by Calm motion — three states, because "on" that does nothing is a lie. */
export type RouteMotionState = 'on' | 'off' | 'calm';
export function routeMotionState(m: MotionInput): RouteMotionState {
  if (m.routeAnimations === false) return 'off';
  if (m.calmMotion === true) return 'calm';
  return 'on';
}

/* ---------- INK — done ----------
   A finished leg paints itself once and then stays painted; the first open
   of a day inks the road so far once. Once means once: the phone remembers
   the last thing it inked (a key per trip, day and length of the road), so
   a second open of the same day draws the road already painted. */

/** Is `key` still to be inked, given the last key the phone inked? */
export function inkDue(stored: string | null, key: string): boolean {
  return stored !== key;
}

/** The key Ink remembers: the trip, the day, and how many legs are done —
    so arriving (one more leg done) inks again, and nothing else does. */
export function inkKey(tripId: string, date: string, legsDone: number): string {
  return `${tripId}:${date}:${legsDone}`;
}

export interface InkStep {
  /** ms after the ink starts that this leg's brush reaches it */
  delay: number;
  /** ms the brush spends on it */
  dur: number;
}

/** ONE BRUSH, ONE SPEED: the road so far is painted in `total` ms, each leg
    taking its share of the time by its share of the length, one after the
    other — so the stroke never jumps or hurries on a short leg. */
export function inkPace(lengths: number[], total: number): InkStep[] {
  const sum = lengths.reduce((n, l) => n + Math.max(0, l), 0);
  let at = 0;
  return lengths.map((l) => {
    const dur = sum > 0 ? Math.round((Math.max(0, l) / sum) * total) : 0;
    const step = { delay: at, dur };
    at += dur;
    return step;
  });
}

/* ---------- RELAY — check ----------
   Opening Journey runs one status sweep along the route: each stop and each
   leg lights in order — green when it is booked, and the sweep PAUSES where
   something is not: amber on a leg not booked, longer on red (a bed missing)
   — then it ends on a count. Journey (Run 3) draws it; this is its clock. */
export type RelayTone = 'ok' | 'warn' | 'crit';
export interface RelayStep {
  tone: RelayTone;
  delay: number;
  dur: number;
}
export interface RelayPlan {
  steps: RelayStep[];
  /** when the last light is on — the moment the count appears */
  total: number;
  counts: Record<RelayTone, number>;
}
export function relayPlan(tones: RelayTone[], step = 180, pause = { warn: 420, crit: 700 }): RelayPlan {
  const counts: Record<RelayTone, number> = { ok: 0, warn: 0, crit: 0 };
  let at = 0;
  const steps = tones.map((tone) => {
    counts[tone]++;
    const dur = tone === 'ok' ? step : step + pause[tone];
    const s = { tone, delay: at, dur };
    at += dur;
    return s;
  });
  return { steps, total: at, counts };
}

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

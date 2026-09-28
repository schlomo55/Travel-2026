/* RELAY, AS AN ACTION — one status sweep, once (logic/motion.ts relayPlan is
   its clock). `use:relay={step}` lights an element at its moment; add
   `relay-leg` as well to a path that should draw itself in. Calm motion,
   reduce-motion and Route animations off show the final colours at once
   (app.css). Journey wires it (Run 3). */
import type { Action } from 'svelte/action';
import type { RelayStep } from '../logic/motion';

export const relay: Action<HTMLElement | SVGElement, RelayStep> = (node, step) => {
  const set = (s: RelayStep): void => {
    node.classList.add('relay', `t-${s.tone}`);
    node.style.setProperty('--rd', `${s.delay}ms`);
    node.style.setProperty('--rt', `${s.dur}ms`);
  };
  set(step);
  return { update: set };
};

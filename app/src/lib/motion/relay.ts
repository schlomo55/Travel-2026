/* RELAY, AS AN ACTION — one status sweep, once (logic/motion.ts relayPlan is
   its clock). `use:relay={step}` lights an element at its moment: it gets
   `relay` and `t-<tone>`, and `--rd` / `--rt` (its delay and how long it
   holds) for its children to pace themselves by. Add `relay-leg` as well to
   a path that should draw itself in. A null step is the end state — the
   sweep already ran (or is not wanted), so nothing is added. Calm motion,
   reduce-motion and Route animations off show the final colours at once
   (app.css). Journey wires it: the route check's rows and the map's rings. */
import type { Action } from 'svelte/action';
import type { RelayStep } from '../logic/motion';

export const relay: Action<HTMLElement | SVGElement, RelayStep | null | undefined> = (node, step) => {
  /* A live re-render hands the same step back: touching the classes then
     could restart a sweep that has finished, so an unchanged step is left
     alone. */
  let last = '';
  const set = (s: RelayStep | null | undefined): void => {
    const key = s ? `${s.tone}:${s.delay}:${s.dur}` : '';
    if (key === last) return;
    last = key;
    node.classList.remove('relay', 't-ok', 't-warn', 't-crit');
    if (!s) return;
    node.classList.add('relay', `t-${s.tone}`);
    node.style.setProperty('--rd', `${s.delay}ms`);
    node.style.setProperty('--rt', `${s.dur}ms`);
  };
  set(step);
  return { update: set };
};

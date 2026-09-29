/* OFF SCREEN, STILL (Horizon Run 4). A loop nobody can see is work for
   nothing: the Flow on a map scrolled out of view restrokes its path every
   frame, the opal edge on a card below the fold repaints its border, the sun
   breathes under the fold — all on the main thread, all battery. The motion
   rules already pause everything while the app is hidden (html.app-hidden);
   this does the same for one element at a time, while no part of it is on
   the screen.

   `use:offscreen` on the element that loops (or the card that holds the
   loops) sets `data-offscreen` on it while it is out of the viewport, and
   app.css pauses every animation in it — animation-play-state, so a loop
   resumes where it stopped and nothing restarts or jumps. A data attribute,
   not a class: Svelte rewrites the class of an element with dynamic classes
   and would drop one it does not own. One IntersectionObserver serves the
   whole app. */
import type { Action } from 'svelte/action';

let io: IntersectionObserver | null = null;

function observer(): IntersectionObserver | null {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement | SVGElement;
      if (e.isIntersecting) delete el.dataset.offscreen;
      else el.dataset.offscreen = '';
    }
  });
  return io;
}

export const offscreen: Action<HTMLElement | SVGElement> = (node) => {
  const o = observer();
  o?.observe(node);
  return {
    destroy() {
      o?.unobserve(node);
    },
  };
};
